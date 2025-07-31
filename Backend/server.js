require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const {
  PORT = 4000,
  JWT_SECRET,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME
} = process.env;

let db;
const sseClients = new Set();

async function initDb() {
  db = await mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    connectionLimit: 10
  });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','student') NOT NULL DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await db.execute(`SELECT * FROM users WHERE username = ?`, ['admin']);
  if (rows.length === 0) {
    const defaultPassword = 'Admin123!';
    const hash = await bcrypt.hash(defaultPassword, 10);
    await db.execute(
      `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`,
      ['admin', hash]
    );
    console.log(`Seeded default admin -> username: admin, password: ${defaultPassword}`);
  } else {
    console.log('Admin exists, skipping seed');
  }
}

function authenticate(req, res, next) {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
}

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Uppercase missing');
  if (!/[a-z]/.test(password)) errors.push('Lowercase missing');
  if (!/\d/.test(password)) errors.push('Number missing');
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) errors.push('Special char missing');
  return errors;
}

async function broadcastUsersUpdate() {
  const [rows] = await db.execute(`SELECT id, username, role, created_at FROM users ORDER BY id`);
  const payload = JSON.stringify(rows.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdDate: u.created_at
  })));
  for (const clientRes of sseClients) {
    clientRes.write(`event: users\n`);
    clientRes.write(`data: ${payload}\n\n`);
  }
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username & password required' });

  const [rows] = await db.execute(`SELECT * FROM users WHERE username = ?`, [username]);
  if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdDate: user.created_at
    }
  });
});

app.post('/api/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  if (!username || !password || !confirmPassword)
    return res.status(400).json({ message: 'All fields required' });
  if (password !== confirmPassword)
    return res.status(400).json({ message: 'Passwords do not match' });

  const pwdErrors = validatePassword(password);
  if (pwdErrors.length) return res.status(400).json({ message: pwdErrors.join(', ') });

  const [existing] = await db.execute(`SELECT id FROM users WHERE username = ?`, [username]);
  if (existing.length) return res.status(400).json({ message: 'Username already exists' });

  const hash = await bcrypt.hash(password, 10);
  await db.execute(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'student')`, [
    username,
    hash
  ]);
  await broadcastUsersUpdate();
  res.status(201).json({ message: 'Registration successful' });
});

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  const [rows] = await db.execute(`SELECT id, username, role, created_at FROM users ORDER BY id`);
  res.json(rows.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdDate: u.created_at
  })));
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ message: 'username, password, role required' });
  if (!['admin', 'student'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

  const pwdErrors = validatePassword(password);
  if (pwdErrors.length) return res.status(400).json({ message: pwdErrors.join(', ') });

  const [existing] = await db.execute(`SELECT id FROM users WHERE username = ?`, [username]);
  if (existing.length) return res.status(400).json({ message: 'Username already exists' });

  const hash = await bcrypt.hash(password, 10);
  await db.execute(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`, [
    username,
    hash,
    role
  ]);
  await broadcastUsersUpdate();
  res.status(201).json({ message: 'User created' });
});

app.delete('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (req.user.id === targetId) return res.status(400).json({ message: 'Cannot delete yourself' });
  await db.execute(`DELETE FROM users WHERE id = ?`, [targetId]);
  await broadcastUsersUpdate();
  res.json({ message: 'User deleted' });
});

app.post('/api/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmNewPassword)
    return res.status(400).json({ message: 'All fields required' });
  if (newPassword !== confirmNewPassword)
    return res.status(400).json({ message: 'New passwords do not match' });

  const [rows] = await db.execute(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
  if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

  const user = rows[0];
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) return res.status(400).json({ message: 'Current password incorrect' });

  const pwdErrors = validatePassword(newPassword);
  if (pwdErrors.length) return res.status(400).json({ message: pwdErrors.join(', ') });

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, req.user.id]);
  res.json({ message: 'Password changed successfully' });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// SSE: admin real-time user list
app.get('/api/users/stream', authenticate, requireAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendUsers = async () => {
    const [rows] = await db.execute(`SELECT id, username, role, created_at FROM users ORDER BY id`);
    const payload = JSON.stringify(rows.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdDate: u.created_at
    })));
    res.write(`event: users\n`);
    res.write(`data: ${payload}\n\n`);
  };

  await sendUsers();
  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

app.listen(PORT, async () => {
  try {
    await initDb();
    console.log(`Server running on port ${PORT}`);
  } catch (e) {
    console.error('DB init failed', e);
    process.exit(1);
  }
});

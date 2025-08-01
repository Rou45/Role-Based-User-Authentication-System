let currentUser = null;
let users = [];

// show message
function showMessage(message, type = 'success') {
    const messageContainer = document.getElementById('messageContainer');
    const messageElement = document.createElement('div');
    messageElement.className = `message message--${type}`;
    messageElement.textContent = message;
    messageContainer.appendChild(messageElement);
    setTimeout(() => {
        if (messageElement.parentNode) messageElement.remove();
    }, 5000);
}

// UI helpers
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');

    const navbar = document.getElementById('navbar');
    if (pageId === 'loginPage' || pageId === 'registerPage') {
        navbar.classList.add('hidden');
    } else {
        navbar.classList.remove('hidden');
        updateNavbar();
    }
}

function updateNavbar() {
    const currentUserElement = document.getElementById('currentUser');
    if (currentUser) {
        currentUserElement.textContent = `${currentUser.username} (${currentUser.role})`;
    } else {
        currentUserElement.textContent = '';
    }
}

// Auth header helper
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// Login
async function attemptLogin(username, password) {
    try {
        const resp = await fetch('http://localhost:4000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await resp.json();
        if (!resp.ok) {
            showMessage(data.message || 'Login failed', 'error');
            return false;
        }
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        showMessage('Login successful!', 'success');
        if (currentUser.role === 'admin') {
            showPage('adminDashboard');
            startSSEForUsers();
        } else {
            showPage('studentWelcome');
        }
        updateNavbar();
        return true;
    } catch (e) {
        showMessage('Network error', 'error');
        return false;
    }
}

// Logout
function attemptLogout() {
    localStorage.removeItem('token');
    currentUser = null;
    if (window._usersSSE) window._usersSSE.close();
    showMessage('Logged out successfully', 'success');
    showPage('loginPage');
    updateNavbar();
}

// Register student
async function registerStudent(username, password, confirmPassword) {
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return false;
    }
    try {
        const resp = await fetch('http://localhost:4000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, confirmPassword })
        });
        const data = await resp.json();
        if (!resp.ok) {
            showMessage(data.message || 'Registration failed', 'error');
            return false;
        }
        showMessage('Registration successful! Please login.', 'success');
        showPage('loginPage');
        return true;
    } catch (e) {
        showMessage('Network error', 'error');
        return false;
    }
}

// Fetch users (admin)
async function fetchAndRenderUsers() {
    try {
        const resp = await fetch('http://localhost:4000/api/users', {
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            }
        });
        const data = await resp.json();
        if (!resp.ok) {
            showMessage(data.message || 'Failed to load users', 'error');
            return;
        }
        users = data;
        renderUsersTable();
    } catch (e) {
        showMessage('Network error while fetching users', 'error');
    }
}

// Create user (admin)
async function createNewUser(username, password, role) {
    try {
        const resp = await fetch('http://localhost:4000/api/users', {
            method: 'POST',
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, role })
        });
        const data = await resp.json();
        if (!resp.ok) {
            showMessage(data.message || 'User creation failed', 'error');
            return false;
        }
        showMessage('User created successfully!', 'success');
        await fetchAndRenderUsers();
        return true;
    } catch (e) {
        showMessage('Network error', 'error');
        return false;
    }
}

// Delete user (admin)
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
        const resp = await fetch(`http://localhost:4000/api/users/${userId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await resp.json();
        if (!resp.ok) {
            showMessage(data.message || 'Deletion failed', 'error');
            return;
        }
        showMessage('User deleted successfully', 'success');
        await fetchAndRenderUsers();
    } catch (e) {
        showMessage('Network error', 'error');
    }
}

// Change password
async function changeUserPassword(currentPassword, newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
        showMessage('New passwords do not match', 'error');
        return false;
    }
    try {
        const resp = await fetch('http://localhost:4000/api/change-password', {
            method: 'POST',
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
                confirmNewPassword: confirmPassword
            })
        });
        const data = await resp.json();
        if (!resp.ok) {
            showMessage(data.message || 'Password change failed', 'error');
            return false;
        }
        showMessage('Password changed successfully!', 'success');
        return true;
    } catch (e) {
        showMessage('Network error', 'error');
        return false;
    }
}

// Render users table (reuse existing DOM structure)
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td><span class="role-badge role-badge--${user.role}">${user.role}</span></td>
            <td>${new Date(user.createdDate).toISOString().split('T')[0]}</td>
            <td>
                ${currentUser && user.id !== currentUser.id ? 
                    `<button class="delete-btn" onclick="deleteUser(${user.id})">Delete</button>` : 
                    '<span style="color: var(--color-text-secondary);">Current User</span>'
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}

// SSE real-time users (admin)
function startSSEForUsers() {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Use query param because EventSource can't set Authorization header
    const evtSource = new EventSource(`http://localhost:4000/api/users/stream?token=${token}`);

    evtSource.addEventListener('users', (e) => {
        try {
            const list = JSON.parse(e.data);
            users = list;
            renderUsersTable();
        } catch (err) {
            console.warn('Error parsing SSE data', err);
        }
    });

    evtSource.onerror = () => {
        console.warn('SSE connection failed, falling back to polling');
        // fallback polling every 5s
        setInterval(fetchAndRenderUsers, 5000);
    };

    window._usersSSE = evtSource;
}

// On load: try to restore session
async function restoreSession() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const resp = await fetch('http://localhost:4000/api/me', {
            headers: authHeaders()
        });
        if (!resp.ok) {
            localStorage.removeItem('token');
            return;
        }
        const user = await resp.json();
        currentUser = user;
        if (currentUser.role === 'admin') {
            showPage('adminDashboard');
            startSSEForUsers();
        } else {
            showPage('studentWelcome');
        }
        updateNavbar();
    } catch (e) {
        console.warn('Session restore failed');
    }
}

// DOM initialization
document.addEventListener('DOMContentLoaded', function() {
    // Login form
    document.getElementById('loginForm').onsubmit = function(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        attemptLogin(username, password);
    };

    // Show register
    document.getElementById('showRegisterBtn').onclick = function(e) {
        e.preventDefault();
        showPage('registerPage');
    };

    // Back to login
    document.getElementById('showLoginBtn').onclick = function(e) {
        e.preventDefault();
        showPage('loginPage');
    };

    // Register form
    document.getElementById('registerForm').onsubmit = function(e) {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        registerStudent(username, password, confirmPassword);
    };

    // Logout
    document.getElementById('logoutBtn').onclick = function() {
        attemptLogout();
    };

    // Change password navigation
    document.getElementById('changePasswordBtn').onclick = function() {
        showPage('changePasswordPage');
    };

    // Change password form
    document.getElementById('changePasswordForm').onsubmit = async function(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        const success = await changeUserPassword(currentPassword, newPassword, confirmNewPassword);
        if (success) {
            if (currentUser.role === 'admin') {
                showPage('adminDashboard');
                fetchAndRenderUsers();
            } else {
                showPage('studentWelcome');
            }
        }
    };

    // Create user modal open/close
    document.getElementById('showCreateUserBtn').onclick = function() {
        document.getElementById('createUserModal').classList.remove('hidden');
    };
    document.getElementById('closeCreateUserModal').onclick = function() {
        document.getElementById('createUserModal').classList.add('hidden');
    };

    // Create user form (admin)
    document.getElementById('createUserForm').onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const role = document.getElementById('newUserRole').value;
        const created = await createNewUser(username, password, role);
        if (created) {
            document.getElementById('createUserForm').reset();
            document.getElementById('createUserModal').classList.add('hidden');
        }
    };

    // Close modal by clicking outside
    document.getElementById('createUserModal').onclick = function(e) {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.add('hidden');
        }
    };


    restoreSession().then(() => {
        if (!currentUser) showPage('loginPage');
    });
});

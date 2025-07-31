# 🔐 Role-Based User Authentication System

A complete **Role-Based User Authentication System** using:

- 🌐 Frontend: HTML, CSS, JavaScript (Vanilla)
- 🧠 Backend: Node.js + Express
- 🗄️ Database: MySQL
- 🔐 Auth: JWT (JSON Web Tokens)

🎯 It provides secure login, registration, and admin-level user management with real-time updates.

---

## 🚀 Features

✅ Student Registration & Login  
✅ Admin Dashboard  
✅ Create/Delete Users (Admin)  
✅ Change Password for any user  
✅ JWT Authentication with Role-based Access  
✅ Realtime User List via Server-Sent Events (SSE)  
✅ Secure Password Validation Rules  
✅ Token-based Session Handling  
✅ Modern UI using pure HTML/CSS  

---

## 🏗️ Tech Stack

| Layer      | Technology        |
|------------|-------------------|
| Frontend   | HTML, CSS, JS     |
| Backend    | Node.js + Express |
| Database   | MySQL             |
| Auth       | JWT               |
| Realtime   | Server-Sent Events (SSE) |
| Dev Tools  | Dotenv, Nodemon   |

---

## 📁 Folder Structure

Role-Based-User-Authentication-System/
├── backend/
│ ├── server.js
│ ├── .env
│ └── package.json
├── frontend/
│ ├── index.html
│ ├── style.css
│ └── app.js
└── README.md


---

## 🛠️ Local Setup Instructions

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Rou45/Role-Based-User-Authentication-System.git
cd Role-Based-User-Authentication-System

2️⃣ MySQL: Create the Database

3️⃣ Backend Setup
bash
Copy
Edit
cd backend
npm install
4️⃣ Configure .env
Create a .env file inside backend/:

ini
Copy
Edit
PORT=4000
JWT_SECRET=112233@rou
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=coplur_auth
🔐 Never push your .env file to GitHub.

5️⃣ Run the Server
bash
Copy
Edit
npm run dev
Expected output:

pgsql
Copy
Edit
Seeded default admin -> username: admin, password: Admin123!
Server running on port 4000
6️⃣ Run the Frontend
Open the file:

bash
Copy
Edit
frontend/index.html
(Use Live Server in VS Code or just double-click to open in browser)

🔑 Default Admin Credentials
Username	Password
admin	Admin123!

📡 REST API Endpoints
Method	Endpoint	Access	Description
POST	/api/login	Public	Login (returns JWT)
POST	/api/register	Public	Register as student
GET	/api/users	Admin only	List all users
POST	/api/users	Admin only	Create new user
DELETE	/api/users/:id	Admin only	Delete user by ID
POST	/api/change-password	Authenticated	Change own password
GET	/api/me	Authenticated	Get logged-in user info
GET	/api/users/stream	Admin only	Realtime user updates (SSE)

🧠 Password Validation Rules
Minimum 8 characters

At least 1 uppercase letter

At least 1 lowercase letter

At least 1 digit

At least 1 special character

🌐 Live Demo
Coming soon...

You can deploy backend on Render and frontend on GitHub Pages / Vercel.

🧑‍💻 Contributing
Pull requests are welcome.
If you want to add new features, open an issue first.

📄 License
MIT License © 2025 Roushan Kumar

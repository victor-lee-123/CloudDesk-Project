# CloudDesk ☁️
A Cloud-Based Help Desk and Ticket Management Web Application

---

## 📌 Overview
CloudDesk is a cloud-based web application that allows users to submit support tickets and track their progress online. Administrators can manage, update, and resolve tickets through a centralized system.

The application is containerised using Docker and deployed on AWS EC2, demonstrating key cloud computing concepts such as scalability, reliability, and security.

---

## 🚀 Features

- User registration and login
- Submit and track support tickets
- Admin dashboard for ticket management
- Ticket status updates (Open, In Progress, Resolved)
- RESTful API backend
- Persistent database storage

---

## 🏗️ Architecture

The system follows a **3-tier architecture**:

- **Frontend**: Static web interface served via Nginx  
- **Backend**: Flask REST API  
- **Database**: MySQL 8.0  

All services are containerised and managed using Docker Compose on AWS EC2.

### 🔁 Request Flow

1. User accesses the web application via EC2 public IP (port 8080)
2. Nginx serves static frontend files
3. Frontend sends API requests to Flask backend (port 5000)
4. Backend processes logic and queries MySQL database
5. Database returns data to backend → frontend → user

---

## ⚙️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript, Nginx  
- **Backend**: Python (Flask)  
- **Database**: MySQL 8.0  
- **Containerisation**: Docker, Docker Compose  
- **Cloud Platform**: AWS EC2  

---

## 📦 Project Structure
```text
clouddesk/
│
├── frontend/              # Static web files (index.html, JS, CSS)
├── backend/               # Flask API application
├── mysql-init/            # Database initialisation scripts
│   ├── schema.sql
│   └── test.sql
├── docker-compose.yml     # Multi-container setup
└── README.md
```
---

## 🐳 Setup & Installation
### You can choose to run locally, or via EC2 Instance. Instructions shown below.

### 🏃 Quick Start (Run Locally)
1. Clone the repository
- git clone <your-repo-link>
- cd clouddesk

2. Install Docker
Make sure Docker is installed:
- docker --version
- docker compose version

3. Run the application
- docker compose up --build

4. Open in browser
- Frontend: http://localhost:8080
- Backend: http://localhost:5000

### ☁️ Deploying on AWS EC2
1. Launch EC2 Instance
- Ubuntu
- Allow ports: 22 (SSH), 8080 (frontend), 5000 (backend)

2. Connect via SSH
- ssh -i your-key.pem ubuntu@your-ec2-ip

3. Install Docker
- sudo apt update
- sudo apt install -y docker.io docker-compose-v2
- sudo systemctl start docker
- sudo systemctl enable docker
- sudo usermod -aG docker $USER
- newgrp docker

4. Upload project (choose one)
- Option A: Git clone
- git clone <your-repo-link>
- cd clouddesk

- Option B: SCP (manual copy)
- scp -i your-key.pem -r clouddesk ubuntu@your-ec2-ip:~

5. Run the application
- docker compose up --build -d

6. Access your app
- http://your-ec2-ip:8080

---

## 🗄️ Database
- MySQL runs in a container
- Database is initialised using:
- schema.sql → creates tables
- test.sql → inserts sample data
- Persistent storage is handled via Docker volumes

---

## 🔐 Security
- Passwords are securely hashed before storage
- Role-based access control (admin vs user)
- Database is not exposed publicly (internal Docker network)
- Sensitive credentials are stored using environment variables

---

## 👥 Team Members
- Victor Lee Meng Hui
- Belinda Chua Jia Xuan
- Nurul Hannah
- Edwin Leow
- Dylan Lau
- Teo Joel

---

## 📄 License

This project is developed as part of a Cloud Computing project using containerised microservices architecture. Created at Singapore Institute of Technology© in Collaboration with Digipen Institute of Technology©.

---

## ⭐ If you find this useful

Feel free to fork, use, or improve it for your own projects!

---

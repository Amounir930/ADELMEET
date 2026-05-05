# Meet-2 Classroom Platform

A real-time classroom communication platform built with LiveKit, React 19, and Node.js.

## 🚀 Quick Start (Windows)

To start the entire project with one click:

1.  Double-click the **`START-PROJECT.bat`** file.
2.  **Teacher Portal (5174)**: Open [http://localhost:5174](http://localhost:5174). Create a session by entering a Room ID (e.g., `class-123`).
3.  **Student Portal (5173)**: Open [http://localhost:5173](http://localhost:5173). Join the same Room ID (`class-123`).

### 🔗 Access Points
- **Teacher Dashboard**: [http://localhost:5174](http://localhost:5174)
- **Student Entrance**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)

## 🏗️ Components

- **`/backend`**: Express server handling token generation and security.
- **`/student-client`**: React application for students.
- **`/wall-client`**: React application for the classroom grid display.

## 🛡️ Requirements
- Node.js v18 or higher.
- A LiveKit Cloud project (API Key and Secret).
- `.env` file in the `backend/` directory.

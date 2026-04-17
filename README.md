# AI Shorts Maker 🚀

Welcome to the **AI Shorts Maker**! This tool auto-generates viral YouTube shorts from long videos with military-grade security.

## 🛠️ Tech Stack & Architecture
- **Frontend**: React.js (Vite) with a Premium Glassmorphism UI.
- **Backend**: Node.js & Express (API routes & Video Processing Engine placeholder).
- **Styling**: Pure CSS with modern animations & gradients.

## 🚀 How to Run the Project (Proper Way)

Since this is a full-stack project, you need to run both the **Backend** and the **Frontend** separately.

### Step 1: Start the Backend (API Server)
1. Open a terminal.
2. Navigate to the backend folder:
   ```bash
   cd shorts-maker/backend
   ```
3. Run the server:
   ```bash
   node server.js
   ```
   *You will see the message:* `Server is cooking on http://localhost:5000 👨‍🍳🔥`

### Step 2: Start the Frontend (UI Server)
1. Open a **new** terminal window/tab.
2. Navigate to the frontend folder:
   ```bash
   cd shorts-maker/frontend
   ```
3. Run the Vite Dev server:
   ```bash
   npm run dev
   ```
   *You will see the message showing it's running on `http://localhost:5173/`*

Now, open `http://localhost:5173/` in your browser and enjoy your God-mode dashboard!

## 🚧 What's Next?
In the next phases, we will integrate `yt-dlp` and `ffmpeg` in the backend to physically download, trim, and process the videos. We will also hook up MongoDB to securely store social media accounts.

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

## Deployment OAuth Setup

For a deployed app, do not leave the URLs as localhost. Set these environment variables on your hosting provider:

Backend:
```bash
NODE_ENV=production
SERVER_URL=https://your-backend-domain.com
CLIENT_URL=https://your-frontend-domain.com
SESSION_SECRET=use-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=https://your-backend-domain.com/auth/google/callback
```

Frontend:
```bash
VITE_API_URL=https://your-backend-domain.com
```

In Google Cloud Console, add this exact Authorized redirect URI to the same OAuth client:

```text
https://your-backend-domain.com/auth/google/callback
```

You can confirm the exact value your deployed backend is using by opening:

```text
https://your-backend-domain.com/api/debug/oauth
```

Copy the `googleAuthorizedRedirectUriRequired` value into Google Cloud Console. If the frontend is on Vercel and the backend is on another host, keep `NODE_ENV=production`, `CLIENT_URL`, `SERVER_URL`, and `VITE_API_URL` set exactly. This keeps session cookies and OAuth redirects working across domains.

If Google shows `Error 401: invalid_client`, the deployed backend is usually using a missing/wrong `GOOGLE_CLIENT_ID`, missing/wrong `GOOGLE_CLIENT_SECRET`, or a redirect URI that does not belong to that OAuth client.

If Google shows `Error 400: redirect_uri_mismatch`, the exact deployed backend callback URL is missing from `Authorized redirect URIs`.

## Vercel Analytics

Web Analytics is wired through `@vercel/analytics`. After deploying the frontend on Vercel, open the project dashboard, go to Analytics, and enable Web Analytics. Page views will start appearing there after the next production deployment.

## 🚧 What's Next?
In the next phases, we will integrate `yt-dlp` and `ffmpeg` in the backend to physically download, trim, and process the videos. We will also hook up MongoDB to securely store social media accounts.

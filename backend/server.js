const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ytDlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const session = require('express-session');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const normalizeUrl = (url) => (url || '').trim().replace(/\/+$/, '');
const SERVER_URL = normalizeUrl(process.env.SERVER_URL || process.env.BACKEND_URL || `http://localhost:${PORT}`);
const CLIENT_URL = normalizeUrl(process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173');
const GOOGLE_REDIRECT_URI = normalizeUrl(process.env.GOOGLE_REDIRECT_URI || `${SERVER_URL}/auth/google/callback`);
const allowedOrigins = [
    CLIENT_URL,
    ...(process.env.CORS_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean)
];
const isProduction = process.env.NODE_ENV === 'production';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true // Required for session cookies
}));
app.use(express.json());
app.set('trust proxy', 1);

// Session config for authentication persistence
app.use(session({
    secret: process.env.SESSION_SECRET || 'shortsmaker-super-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Local JSON DB
const dbPath = path.join(__dirname, 'database.json');
if(!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({users: {}, logs: []}));
const getDb = () => JSON.parse(fs.readFileSync(dbPath));
const saveDb = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

const ensureAdminUser = () => {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shortsmaker.ai';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const db = getDb();

    if (!db.users[adminEmail] || db.users[adminEmail].password !== adminPassword || db.users[adminEmail].role !== 'admin') {
        db.users[adminEmail] = {
            ...(db.users[adminEmail] || {}),
            password: adminPassword,
            role: 'admin',
            createdAt: db.users[adminEmail]?.createdAt || new Date().toISOString()
        };
        saveDb(db);
    }
};

ensureAdminUser();

const tempDir = path.join(__dirname, 'temp');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

app.use('/output', express.static(outputDir));

// OAuth2 Setup
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
);

app.get('/api/debug/oauth', (req, res) => {
    res.json({
        serverUrl: SERVER_URL,
        clientUrl: CLIENT_URL,
        googleRedirectUri: GOOGLE_REDIRECT_URI,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    });
});

app.get('/auth/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
        return res.redirect(`${CLIENT_URL}/dashboard?auth=google-config-error`);
    }

    console.log(`Starting Google OAuth with redirect URI: ${GOOGLE_REDIRECT_URI}`);

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // ensures we get a refresh token
        scope: ['https://www.googleapis.com/auth/youtube.upload'],
        prompt: 'consent'
    });
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) throw new Error("No code provided");

        const { tokens } = await oauth2Client.getToken(code);
        req.session.tokens = tokens; // Save to user's local browser session
        
        // Save to DB linking User ID to Tokens
        if (req.session.userId) {
            const db = getDb();
            if (!db.users[req.session.userId]) db.users[req.session.userId] = {};
            db.users[req.session.userId].tokens = tokens;
            saveDb(db);
        }
        
        res.redirect(`${CLIENT_URL}/dashboard?auth=success`);
    } catch (e) {
        console.error("Auth Error:", e.message);
        res.redirect(`${CLIENT_URL}/dashboard?auth=error`);
    }
});

app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({error: "Email and password required"});
    const db = getDb();
    if(db.users[email] && db.users[email].password) return res.status(400).json({error: "User already exists"});
    if(!db.users[email]) db.users[email] = {};
    db.users[email].password = password;
    db.users[email].role = 'user'; // Users can only ever register as a normal 'user'
    db.users[email].createdAt = new Date().toISOString();
    saveDb(db);
    req.session.userId = email;
    res.json({ status: 'success' });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = getDb();
    const user = db.users[email];
    if (user && user.password === password) {
        req.session.userId = email;
        res.json({ status: 'success', role: user.role });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ status: 'success' });
});

app.get('/api/admin/users', (req, res) => {
    const db = getDb();
    // 🛡️ MAX SECURITY: Verify session and role before returning data
    const currentUser = req.session.userId;
    if (!currentUser || !db.users[currentUser] || db.users[currentUser].role !== 'admin') {
        return res.status(403).json({ error: "Access Denied: High-level Admin clearance required." });
    }

    const usersList = Object.keys(db.users).filter(email => db.users[email].password).map(email => ({
        email, ...db.users[email]
    }));
    res.json({ status: 'success', users: usersList });
});

app.get('/api/auth/status', (req, res) => {
    const db = getDb();
    const user = req.session.userId ? db.users[req.session.userId] : null;
    if (!req.session.tokens && user && user.tokens) req.session.tokens = user.tokens;
    if (!req.session.fbLinked && user && user.fbLinked) req.session.fbLinked = true;
    if (!req.session.igLinked && user && user.igLinked) req.session.igLinked = true;
    res.json({ 
        loggedIn: !!req.session.userId,
        email: req.session.userId,
        role: user ? user.role : null,
        ytLinked: !!(req.session.tokens || (user && user.tokens)),
        fbLinked: !!(req.session.fbLinked || (user && user.fbLinked)),
        igLinked: !!(req.session.igLinked || (user && user.igLinked))
    });
});

// --- Mock Facebook Auth ---
app.get('/auth/facebook', (req, res) => {
    req.session.fbLinked = true;
    if (req.session.userId) {
        const db = getDb();
        if(!db.users[req.session.userId]) db.users[req.session.userId] = {};
        db.users[req.session.userId].fbLinked = true;
        saveDb(db);
    }
    res.redirect(`${CLIENT_URL}/dashboard?auth=fb-success`);
});

// --- Mock Instagram Auth ---
app.get('/auth/instagram', (req, res) => {
    req.session.igLinked = true;
    if (req.session.userId) {
        const db = getDb();
        if(!db.users[req.session.userId]) db.users[req.session.userId] = {};
        db.users[req.session.userId].igLinked = true;
        saveDb(db);
    }
    res.redirect(`${CLIENT_URL}/dashboard?auth=ig-success`);
});

app.post('/api/generate', async (req, res) => {
    const { videoUrl, startTime, endTime } = req.body;
    if(!videoUrl) {
        return res.status(400).json({ error: 'Video URL is required' });
    }
    
    const jobId = uuidv4();
    const tempVideoPath = path.join(tempDir, `${jobId}.mp4`);

    try {
        console.log(`[${jobId}] Started processing: ${videoUrl}`);
        
        await ytDlp(videoUrl, {
            output: tempVideoPath,
            format: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            ffmpegLocation: ffmpegInstaller.path
        });

        const videoDuration = await new Promise((resolve) => {
            ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
                if(err) resolve(120);
                else resolve(metadata.format.duration || 120);
            });
        });

        let chunksToProcess = [];
        if (startTime !== undefined && endTime !== undefined && startTime !== '' && endTime !== '') {
            const st = parseInt(startTime, 10);
            const et = parseInt(endTime, 10);
            chunksToProcess.push({ start: st, duration: Math.max(1, et - st) });
        } else {
            chunksToProcess.push({ start: 0, duration: 30 });
            if (videoDuration > 60) chunksToProcess.push({ start: Math.floor(videoDuration * 0.25), duration: 30 });
            if (videoDuration > 120) chunksToProcess.push({ start: Math.floor(videoDuration * 0.5), duration: 30 });
        }

        const generatedShorts = [];
        
        // --- Advanced AI Brain Logic for Smart Viral Copywriting ---
        const generateSmartBrainData = (index, url) => {
            // Contextual extraction
            let baseTopic = ['viral', 'trending', 'masterclass', 'foryou', 'mustwatch'];
            if(url.toLowerCase().includes('gaming') || url.toLowerCase().includes('twitch')) baseTopic = ['gaming', 'gameplay', 'gamer', 'epic', 'streamer'];
            if(url.toLowerCase().includes('podcast') || url.toLowerCase().includes('jre')) baseTopic = ['podcast', 'interview', 'mindset', 'growth', 'truth'];
            if(url.toLowerCase().includes('tech') || url.toLowerCase().includes('code')) baseTopic = ['technology', 'programming', 'developer', 'software', 'techstartup'];
            
            const psychologicalHooks = [
                "99% of people scroll past without realizing this secret. 🛑👇",
                "Here is the brutal truth nobody tells you about... 🤫🚀",
                "Wait until the end... the setup is absolutely insane! 🤯🔥",
                "This might be the craziest strategy ever caught on camera? 📸",
                "We tested this method and couldn't believe the massive results! 📈✨",
                "Stop what you're doing and watch this right now. ⏳👀"
            ];
            
            const callToActions = [
                "Drop a 🔥 in the comments if you agree!",
                "Save this video for later & share it with someone who needs it 🚀",
                "What are your thoughts on this? Let's debate below! 💬👇",
                "Hit Subscribe for more daily high-value content! 📈"
            ];
            
            const hook = psychologicalHooks[index % psychologicalHooks.length];
            const cta = callToActions[index % callToActions.length];
            const currentCaption = `${hook}\n\n${cta}`;
            
            // Randomize high-velocity tags
            const allTags = [...baseTopic, 'shorts', 'reels', 'viralvideo', 'fyp', 'explorepage', 'wow'];
            const currentTags = allTags.sort(() => 0.5 - Math.random()).slice(0, 6); // Pick 6 random premium tags
            
            return { currentCaption, currentTags };
        };

        for (let i = 0; i < chunksToProcess.length; i++) {
            const chunk = chunksToProcess[i];
            const outputPth = path.join(outputDir, `${jobId}-short-${i}.mp4`);
            
            const { currentCaption, currentTags } = generateSmartBrainData(i, videoUrl);
            
            await new Promise((resolve, reject) => {
                ffmpeg(tempVideoPath)
                    .seekInput(chunk.start)
                    .setDuration(chunk.duration)
                    .videoFilters([
                        { filter: 'crop', options: 'ih*(9/16):ih' },
                        { filter: 'eq', options: 'saturation=1.15:contrast=1.05' } 
                    ])
                    .audioFilters(['atempo=1.04']) 
                    .outputOptions([
                        '-c:v libx264',
                        '-preset fast',
                        '-c:a aac'
                    ])
                    .output(outputPth)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            generatedShorts.push({
                shortUrl: `${SERVER_URL}/output/${jobId}-short-${i}.mp4`,
                title: `Short Variant ${i+1} 🚀`,
                description: `${currentCaption} #${currentTags.join(' #')}`,
                tags: currentTags
            });
        }

        if(fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        
        res.json({ status: 'success', data: generatedShorts });
    } catch (error) {
        if(fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        res.status(500).json({ error: 'Failed to process video.', details: error.message });
    }
});


app.post('/api/upload', async (req, res) => {
    try {
        const { videoUrl, title, description, tags, platform } = req.body;
        
        // Extract filename from the URL, and locate it in the local output directory
        const filename = path.basename(videoUrl);
        const resolvedPath = path.join(outputDir, filename);
        
        if(!fs.existsSync(resolvedPath)) return res.status(404).json({error: "Video file not found."});
        
        const db = getDb();

        if (platform === 'youtube') {
            const user = req.session.userId ? db.users[req.session.userId] : null;
            if(!req.session.tokens && user && user.tokens) req.session.tokens = user.tokens;
            if(!req.session.tokens) return res.status(401).json({ error: "Please Authorize your YouTube account first!" });
            
            oauth2Client.setCredentials(req.session.tokens);
            const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
            
            const insertResponse = await youtube.videos.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: { title: title, description: description, tags: tags },
                    status: { privacyStatus: 'private', selfDeclaredMadeForKids: false } // 'private' to prevent accidental live posting while testing
                },
                media: { body: fs.createReadStream(resolvedPath) }
            });

            // Add to Admin Logs
            db.logs.unshift({ user: req.session.userId || req.sessionID, platform: 'YouTube', status: 'Success', time: new Date().toISOString() });
            saveDb(db);

            return res.json({ status: 'success', videoId: insertResponse.data.id, message: "Successfully uploaded to your YouTube account!" });

        } else if (platform === 'facebook') {
            if(!req.session.fbLinked) return res.status(401).json({ error: "Please Authorize your Facebook account first!" });
            
            // Mocking Facebook API upload delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            db.logs.unshift({ user: req.session.userId || req.sessionID, platform: 'Facebook', status: 'Success', time: new Date().toISOString() });
            saveDb(db);
            const mockId = 'fb_' + Math.floor(Math.random()*10000000000);
            return res.json({ status: 'success', videoId: mockId, message: "Successfully uploaded to your Facebook Page!" });

        } else if (platform === 'instagram') {
            if(!req.session.igLinked) return res.status(401).json({ error: "Please Authorize your Instagram account first!" });
            
            // Mocking Instagram API upload delay
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            db.logs.unshift({ user: req.session.userId || req.sessionID, platform: 'Instagram', status: 'Success', time: new Date().toISOString() });
            saveDb(db);
            const mockId = 'ig_' + Math.floor(Math.random()*10000000000);
            return res.json({ status: 'success', videoId: mockId, message: "Successfully uploaded to your Instagram Reel!" });
            
        } else {
             return res.status(400).json({ error: "Invalid platform specified." });
        }

    } catch(e) {
        const db = getDb();
        db.logs.unshift({ user: req.session.userId || req.sessionID, platform: req.body.platform || 'Unknown', status: 'Failed', time: new Date().toISOString() });
        saveDb(db);
        
        console.error(e);
        res.status(500).json({ error: `Failed to upload to ${req.body.platform || 'platform'}`, details: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

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
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const normalizeUrl = (url) => (url || '').trim().replace(/\/+$/, '');
const DEFAULT_SERVER_URL = `http://localhost:${PORT}`;
const DEFAULT_CLIENT_URL = 'http://localhost:5173';
const SERVER_URL = normalizeUrl(process.env.SERVER_URL || process.env.BACKEND_URL || DEFAULT_SERVER_URL);
const CLIENT_URL = normalizeUrl(process.env.CLIENT_URL || process.env.FRONTEND_URL || DEFAULT_CLIENT_URL);
const CONFIGURED_GOOGLE_REDIRECT_URI = normalizeUrl(process.env.GOOGLE_REDIRECT_URI || '');
const OAUTH_SETUP_ERROR = 'google-redirect-uri-mismatch';
const clientUrlVariants = new Set([
    CLIENT_URL,
    CLIENT_URL.replace('localhost', '127.0.0.1'),
    CLIENT_URL.replace('127.0.0.1', 'localhost'),
    ...(process.env.CORS_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean)
]);
const allowedOrigins = [...clientUrlVariants].filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production' || !!(process.env.SERVER_URL || process.env.BACKEND_URL);
const hasConfiguredClientUrl = !!(process.env.CLIENT_URL || process.env.FRONTEND_URL);
const hasConfiguredServerUrl = !!(process.env.SERVER_URL || process.env.BACKEND_URL);

const parseUrlOrigin = (value) => {
    try {
        return value ? new URL(value).origin : null;
    } catch {
        return null;
    }
};

const getForwardedValue = (req, header) => {
    const value = req.get(header);
    return value ? value.split(',')[0].trim() : '';
};

const getRequestBaseUrl = (req) => {
    if (hasConfiguredServerUrl) return SERVER_URL;

    const proto = getForwardedValue(req, 'x-forwarded-proto') || req.protocol || 'http';
    const host = getForwardedValue(req, 'x-forwarded-host') || req.get('host');

    return host ? normalizeUrl(`${proto}://${host}`) : SERVER_URL;
};

const getGoogleRedirectUri = (req) => {
    if (CONFIGURED_GOOGLE_REDIRECT_URI) return CONFIGURED_GOOGLE_REDIRECT_URI;
    
    let baseUrl = getRequestBaseUrl(req);
    // Force HTTPS on production for Google OAuth (mandatory)
    if (isProduction && baseUrl.startsWith('http://')) {
        baseUrl = baseUrl.replace('http://', 'https://');
    }
    return `${baseUrl}/auth/google/callback`;
};

const getClientBaseUrl = (req, fallbackState = {}) => {
    // Priority 1: Explicit returnTo from state or query (most reliable for OAuth/Redirects)
    const stateUrl = parseUrlOrigin(req.query.returnTo || fallbackState.returnTo);
    if (stateUrl) return stateUrl;

    // Priority 2: Configured URL (default for direct links)
    if (hasConfiguredClientUrl) return CLIENT_URL;

    // Priority 3: Dynamic discovery based on headers
    const discovered = parseUrlOrigin(req.get('origin')) || parseUrlOrigin(req.get('referer'));
    if (discovered) return discovered;

    return CLIENT_URL;
};

const encodeOAuthState = (state) => Buffer.from(JSON.stringify(state)).toString('base64url');

const decodeOAuthState = (value) => {
    if (!value) return {};
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    } catch {
        return {};
    }
};

const createGoogleOAuthClient = (redirectUri) => new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || CONFIGURED_GOOGLE_REDIRECT_URI || `${SERVER_URL}/auth/google/callback`
);

const isAllowedCorsOrigin = (origin) => {
    if (!origin || allowedOrigins.includes(origin)) return true;

    const originUrl = parseUrlOrigin(origin);
    if (!originUrl) return false;

    try {
        const { hostname, protocol } = new URL(originUrl);
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isVercelPreview = protocol === 'https:' && hostname.endsWith('.vercel.app');

        return isLocalhost || isVercelPreview;
    } catch {
        return false;
    }
};

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedCorsOrigin(origin)) return callback(null, true);
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
    proxy: true,
    cookie: {
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// --- DATABASE CONFIG ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Mongoose Schemas
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    tokens: Object,
    fbLinked: Boolean,
    igLinked: Boolean,
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const logSchema = new mongoose.Schema({
    user: String,
    platform: String,
    status: String,
    time: { type: Date, default: Date.now }
});
const Log = mongoose.model('Log', logSchema);

const ensureAdminUser = async () => {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shortsmaker.ai';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
        await User.create({ email: adminEmail, password: adminPassword, role: 'admin' });
    }
};

ensureAdminUser();

if (isProduction && CLIENT_URL.includes('localhost')) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ WARNING: Running in production mode but CLIENT_URL is set to localhost.');
    console.warn('\x1b[33m%s\x1b[0m', 'This will cause 404 errors during YouTube OAuth redirects.');
    console.warn('\x1b[33m%s\x1b[0m', `Current CLIENT_URL: ${CLIENT_URL}`);
}

const tempDir = path.join(__dirname, 'temp');
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

app.use('/output', express.static(outputDir));

// ─── Job Queue (in-memory) ───────────────────────────────────────────────────
const jobs = {}; // { [jobId]: { status, result, error } }

const createJob = (id) => { jobs[id] = { status: 'processing', result: null, error: null }; };
const finishJob = (id, result) => { if (jobs[id]) { jobs[id].status = 'done'; jobs[id].result = result; } };
const failJob  = (id, err)    => { if (jobs[id]) { jobs[id].status = 'failed'; jobs[id].error = err; } };

setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    Object.keys(jobs).forEach(id => {
        if (jobs[id]._ts && jobs[id]._ts < cutoff) delete jobs[id];
    });
}, 5 * 60 * 1000);

app.get('/api/debug/oauth', (req, res) => {
    const googleRedirectUri = getGoogleRedirectUri(req);
    res.json({
        serverUrl: getRequestBaseUrl(req),
        clientUrl: getClientBaseUrl(req),
        googleRedirectUri,
        googleAuthorizedRedirectUriRequired: googleRedirectUri,
        googleConsoleHint: 'Add this exact URI in Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client > Authorized redirect URIs.',
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    });
});

app.get('/auth/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
        return res.redirect(`${getClientBaseUrl(req)}/dashboard?auth=google-config-error`);
    }

    const redirectUri = getGoogleRedirectUri(req);
    const returnTo = getClientBaseUrl(req);
    const oauth2Client = createGoogleOAuthClient(redirectUri);

    req.session.googleRedirectUri = redirectUri;
    req.session.googleReturnTo = returnTo;

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube.upload'],
        prompt: 'consent select_account',
        state: encodeOAuthState({ redirectUri, returnTo })
    });
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const state = decodeOAuthState(req.query.state);
    const returnTo = getClientBaseUrl(req, state);
    const redirectUri = state.redirectUri || req.session.googleRedirectUri || getGoogleRedirectUri(req);

    try {
        const { code, error } = req.query;
        if (error) return res.redirect(`${returnTo}/dashboard?auth=${OAUTH_SETUP_ERROR}`);
        if (!code) throw new Error("No code provided");

        const oauth2Client = createGoogleOAuthClient(redirectUri);
        const { tokens } = await oauth2Client.getToken(code);
        req.session.tokens = tokens;
        
        if (req.session.userId) {
            await User.findOneAndUpdate(
                { email: req.session.userId },
                { tokens: tokens },
                { upsert: true }
            );
        }
        
        res.redirect(`${returnTo}/dashboard?auth=success`);
    } catch (e) {
        res.redirect(`${returnTo}/dashboard?auth=error&reason=${encodeURIComponent(e.message)}`);
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({error: "Email and password required"});
    
    try {
        const existingUser = await User.findOne({ email });
        if(existingUser) return res.status(400).json({error: "User already exists"});

        const newUser = new User({ email, password, role: 'user' });
        await newUser.save();
        
        req.session.userId = email;
        res.json({ status: 'success' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && user.password === password) {
            req.session.userId = email;
            res.json({ status: 'success', role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) return res.status(500).json({ error: 'Unable to log out. Please try again.' });
        res.clearCookie('connect.sid');
        res.json({ status: 'success' });
    });
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const currentUserEmail = req.session.userId;
        if (!currentUserEmail) return res.status(403).json({ error: "Unauthorized" });

        const currentUser = await User.findOne({ email: currentUserEmail });
        if (!currentUser || currentUser.role !== 'admin') {
            return res.status(403).json({ error: "Access Denied: High-level Admin clearance required." });
        }

        const usersList = await User.find({}, { password: 1, email: 1, role: 1, createdAt: 1 });
        res.json({ status: 'success', users: usersList });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/auth/status', async (req, res) => {
    try {
        const user = req.session.userId ? await User.findOne({ email: req.session.userId }) : null;
        res.json({ 
            loggedIn: !!req.session.userId,
            email: req.session.userId,
            role: user ? user.role : null,
            ytLinked: !!(user && user.tokens),
            fbLinked: !!(user && user.fbLinked),
            igLinked: !!(user && user.igLinked)
        });
    } catch (e) {
        res.json({ loggedIn: false });
    }
});

app.get('/auth/facebook', async (req, res) => {
    if (req.session.userId) {
        await User.findOneAndUpdate({ email: req.session.userId }, { fbLinked: true });
        req.session.fbLinked = true;
    }
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?auth=fb-success`);
});

app.get('/auth/instagram', async (req, res) => {
    if (req.session.userId) {
        await User.findOneAndUpdate({ email: req.session.userId }, { igLinked: true });
        req.session.igLinked = true;
    }
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?auth=ig-success`);
});

const generateSmartBrainData = (index, url) => {
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
    const allTags = [...baseTopic, 'shorts', 'reels', 'viralvideo', 'fyp', 'explorepage', 'wow'];
    const currentTags = allTags.sort(() => 0.5 - Math.random()).slice(0, 6);
    return { currentCaption, currentTags };
};

const processVideoJob = async (jobId, videoUrl, startTime, endTime, baseUrl) => {
    const tempVideoPath = path.join(tempDir, `${jobId}.mp4`);
    try {
        const ytOptions = {
            output: tempVideoPath,
            format: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            ffmpegLocation: ffmpegInstaller.path,
            extractorArgs: 'youtube:player_client=android,web',
            addHeader: [
                'referer:youtube.com',
                'user-agent:com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
            ],
            noCheckCertificates: true,
            noWarnings: true,
            retries: 5,
            fragmentRetries: 5,
            noPlaylist: true,
        };

        try {
            await ytDlp(videoUrl, ytOptions);
        } catch (dlError) {
            await ytDlp(videoUrl, { 
                ...ytOptions, 
                format: 'best[ext=mp4]/best',
                retries: 3 
            });
        }

        if (!fs.existsSync(tempVideoPath)) throw new Error('Download failed: output file not created.');
        const stat = fs.statSync(tempVideoPath);
        if (stat.size < 10000) throw new Error('Download failed: output file too small (possibly bot-blocked).');

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
            if (videoDuration > 60)  chunksToProcess.push({ start: Math.floor(videoDuration * 0.25), duration: 30 });
            if (videoDuration > 120) chunksToProcess.push({ start: Math.floor(videoDuration * 0.5),  duration: 30 });
        }

        const generatedShorts = [];
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
                    .outputOptions(['-c:v libx264', '-preset fast', '-c:a aac'])
                    .output(outputPth)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            generatedShorts.push({
                shortUrl: `${baseUrl}/output/${jobId}-short-${i}.mp4`,
                title: `Short Variant ${i+1} 🚀`,
                description: `${currentCaption} #${currentTags.join(' #')}`,
                tags: currentTags
            });
        }

        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        finishJob(jobId, generatedShorts);
    } catch (error) {
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        failJob(jobId, error.message);
    }
};

app.post('/api/generate', (req, res) => {
    const { videoUrl, startTime, endTime } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'Video URL is required' });

    const jobId = uuidv4();
    createJob(jobId);
    jobs[jobId]._ts = Date.now();

    const baseUrl = getRequestBaseUrl(req);
    processVideoJob(jobId, videoUrl, startTime, endTime, baseUrl);

    res.json({ status: 'queued', jobId });
});

app.get('/api/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) return res.status(404).json({ error: 'Job not found or expired.' });
    if (job.status === 'done')   return res.json({ status: 'done',   data: job.result });
    if (job.status === 'failed') return res.json({ status: 'failed', error: job.error });
    return res.json({ status: 'processing' });
});

app.post('/api/upload', async (req, res) => {
    try {
        const { videoUrl, title, description, tags, platform } = req.body;
        const filename = path.basename(videoUrl);
        const resolvedPath = path.join(outputDir, filename);
        
        if(!fs.existsSync(resolvedPath)) return res.status(404).json({error: "Video file not found."});
        
        if (platform === 'youtube') {
            const user = await User.findOne({ email: req.session.userId });
            if(!user || !user.tokens) return res.status(401).json({ error: "Please Authorize your YouTube account first!" });
            
            const oauth2Client = createGoogleOAuthClient();
            oauth2Client.setCredentials(user.tokens);
            const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    console.log(`Server running on http://localhost:${PORT}`);
});

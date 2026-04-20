import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Scissors, ShieldCheck, Video, LayoutDashboard, UserCircle, LogOut, Eye, EyeOff, Mail } from 'lucide-react';

const Youtube = ({ size = 24, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

const Facebook = ({ size = 24, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const Instagram = ({ size = 24, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);
import './index.css';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE_URL}${path}`;
const authUrl = (path) => `${apiUrl(path)}?returnTo=${encodeURIComponent(window.location.origin)}`;

const Navbar = ({ isAuthenticated, setIsAuthenticated, setRole }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
    } catch (error) {
      console.warn('Logout request failed, clearing local session anyway.', error);
    } finally {
      localStorage.removeItem('auth');
      localStorage.removeItem('role');
      setIsAuthenticated(false);
      setRole(null);
      navigate('/login', { replace: true });
    }
  };

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <Scissors size={28} color="#00f2fe" />
        ShortsMaker
      </Link>
      <div className="nav-links">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard" className="nav-btn">Dashboard</Link>
            {localStorage.getItem('role') === 'admin' && <Link to="/admin" className="nav-btn">Admin</Link>}
            <button className="nav-btn" onClick={handleLogout}>
              <LogOut size={18} style={{display:'inline', verticalAlign:'middle'}}/> Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-btn">Login</Link>
            <Link to="/register" className="nav-btn primary">Get Started</Link>
          </>
        )}
      </div>
    </nav>
  );
};

// Animated progress steps shown while the server processes the video
const ProcessingSteps = () => {
  const steps = [
    '📥 Downloading video from YouTube...',
    '🎬 Analyzing video duration...',
    '✂️ Cutting short clips...',
    '🎨 Applying vertical crop & color grading...',
    '📝 Generating viral captions...',
    '✅ Almost done...',
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % steps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      marginTop: '20px',
      padding: '20px',
      background: 'rgba(79, 172, 254, 0.08)',
      borderRadius: '12px',
      border: '1px solid rgba(79, 172, 254, 0.25)',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '1rem', color: '#4facfe', marginBottom: '10px', fontWeight: 600 }}>
        ⏳ AI is processing your video on the server...
      </div>
      <div style={{ fontSize: '0.9rem', color: '#94a3b8', transition: 'all 0.5s ease' }}>
        {steps[step]}
      </div>
      <div style={{ marginTop: '14px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: '40%',
          background: 'linear-gradient(90deg, #4facfe, #00f2fe)',
          borderRadius: '4px',
          animation: 'pulse-bar 2s ease-in-out infinite'
        }} />
      </div>
      <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '10px' }}>
        This may take 2–4 minutes depending on video length. Please keep this tab open.
      </p>
    </div>
  );
};

const Dashboard = () => {
  const [url, setUrl] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [ytLinked, setYtLinked] = useState(false);
  const [fbLinked, setFbLinked] = useState(false);
  const [igLinked, setIgLinked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check callback status from URL
    if (location.search.includes('auth=error')) alert("Google authorization failed. Please try linking your YouTube channel again.");
    if (location.search.includes('auth=google-config-error')) alert("Google OAuth is not configured on the server. Please contact support.");
    if (location.search.includes('auth=google-redirect-uri-mismatch')) {
      alert("Google OAuth redirect URI mismatch. Add your hosted backend callback URL in Google Cloud Console, then try again.");
    }
    if (location.search.includes('auth=success')) alert("YouTube Channel successfully authorized! 🎉");
    if (location.search.includes('auth=fb-success')) alert("Facebook Page successfully authorized! 🎉");
    if (location.search.includes('auth=ig-success')) alert("Instagram Account successfully authorized! 🎉");

    // Check auth status from backend API
    fetch(apiUrl('/api/auth/status'), { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setYtLinked(data.ytLinked);
        setFbLinked(data.fbLinked);
        setIgLinked(data.igLinked);
      })
      .catch(e => console.error(e));
  }, [location]);

  const handleGenerate = async () => {
    if (!url) return alert("Please paste a valid YouTube URL!");
    setLoading(true); setResult(null); setError(null);

    try {
      // Step 1: Queue the job — returns immediately with a jobId
      const queueRes = await fetch(apiUrl('/api/generate'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ videoUrl: url, startTime: customStart, endTime: customEnd }),
      });
      const queueData = await queueRes.json();

      if (queueData.status !== 'queued' || !queueData.jobId) {
        setError(queueData.error || "Failed to queue the job.");
        setLoading(false);
        return;
      }

      const jobId = queueData.jobId;

      // Step 2: Poll /api/status/:jobId every 4 seconds until done or failed
      const POLL_INTERVAL = 4000;
      const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes max
      const startedAt = Date.now();

      await new Promise((resolve, reject) => {
        const poll = async () => {
          if (Date.now() - startedAt > MAX_WAIT_MS) {
            reject(new Error("Processing timed out after 10 minutes. Please try a shorter video or try again."));
            return;
          }
          try {
            const statusRes = await fetch(apiUrl(`/api/status/${jobId}`), { credentials: 'include' });
            const statusData = await statusRes.json();

            if (statusData.status === 'done') {
              setResult(statusData.data);
              resolve();
            } else if (statusData.status === 'failed') {
              reject(new Error(statusData.error || "Video processing failed on the server."));
            } else {
              // Still processing — poll again after interval
              setTimeout(poll, POLL_INTERVAL);
            }
          } catch (e) {
            reject(e);
          }
        };
        poll();
      });

    } catch (e) {
      setError(e.message || "Failed to connect to the backend server.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (short, platform) => {
    if (platform === 'youtube' && !ytLinked) { alert("You must link your YouTube account first!"); window.location.href = authUrl('/auth/google'); return; }
    if (platform === 'facebook' && !fbLinked) { alert("You must link your Facebook account first!"); window.location.href = authUrl('/auth/facebook'); return; }
    if (platform === 'instagram' && !igLinked) { alert("You must link your Instagram account first!"); window.location.href = authUrl('/auth/instagram'); return; }

    alert(`Initiating ${platform} Upload for: ${short.title}\nPlease wait, this may take a minute...`);
    try {
      const response = await fetch(apiUrl('/api/upload'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          videoUrl: short.shortUrl,
          title: short.title,
          description: short.description,
          tags: short.tags,
          platform: platform
        }),
      });
      const data = await response.json();
      if (data.status === 'success') alert(`Success! Uploaded Video ID: ${data.videoId}.\n${data.message}`);
      else alert(`Error: ${data.error} \n${data.details}`);
    } catch {
      alert("Upload failed. Make sure your server is running.");
    }
  };

  return (
    <div className="app-container">
      <div className="glass-panel" style={{ maxWidth: '1200px' }}>
        <h1 className="title">AI Shorts Studio</h1>

        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px'}}>
          <div style={{padding: '10px 20px', borderRadius: '12px', background: ytLinked ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)', color: ytLinked ? '#4ade80' : '#a1a1aa', display: 'flex', alignItems: 'center', gap: '10px', border: `1px solid ${ytLinked ? '#4ade80' : 'rgba(255,255,255,0.1)'}`}}>
            <Youtube size={20} />
            {ytLinked ? <span>YouTube Linked</span> : <a href={authUrl('/auth/google')} style={{color: '#fff', textDecoration: 'none'}}>Link YouTube</a>}
          </div>
          <div style={{padding: '10px 20px', borderRadius: '12px', background: fbLinked ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)', color: fbLinked ? '#4ade80' : '#a1a1aa', display: 'flex', alignItems: 'center', gap: '10px', border: `1px solid ${fbLinked ? '#4ade80' : 'rgba(255,255,255,0.1)'}`}}>
            <Facebook size={20} />
            {fbLinked ? <span>Facebook Linked</span> : <a href={authUrl('/auth/facebook')} style={{color: '#fff', textDecoration: 'none'}}>Link Facebook</a>}
          </div>
          <div style={{padding: '10px 20px', borderRadius: '12px', background: igLinked ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 255, 255, 0.05)', color: igLinked ? '#4ade80' : '#a1a1aa', display: 'flex', alignItems: 'center', gap: '10px', border: `1px solid ${igLinked ? '#4ade80' : 'rgba(255,255,255,0.1)'}`}}>
            <Instagram size={20} />
            {igLinked ? <span>Instagram Linked</span> : <a href={authUrl('/auth/instagram')} style={{color: '#fff', textDecoration: 'none'}}>Link Instagram</a>}
          </div>
        </div>

        <div className="input-group" style={{ flexDirection: 'column', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Paste your YouTube Video Link here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            style={{ width: '100%', maxWidth: '800px', marginBottom: '15px' }}
          />

          <div style={{ display: 'flex', gap: '15px', width: '100%', maxWidth: '800px', marginBottom: '20px' }}>
            <input
              type="number"
              placeholder="Start Time (secs) - Auto if blank"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              disabled={loading}
            />
            <input
              type="number"
              placeholder="End Time (secs) - Auto if blank"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              disabled={loading}
            />
          </div>

          <button className="action-btn" onClick={handleGenerate} disabled={loading} style={{ maxWidth: '400px' }}>
            {loading ? '⏳ Processing...' : <><Video size={20} /> Auto-Generate Shorts</>}
          </button>
        </div>

        {loading && <ProcessingSteps />}
        {error && <p style={{color: '#ff4d4f', marginTop: '15px', textAlign: 'center'}}>{error}</p>}

        {result && (
          <div className="results-grid">
            {Array.isArray(result) && result.map((res, index) => (
              <div key={index} className="result-card">
                <h3 style={{color: '#fff', fontSize: '1.2rem', marginBottom: '10px'}}>{res.title}</h3>
                <p style={{color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '10px'}}>{res.description}</p>
                <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
                  {res.tags.map(t => <span key={t} style={{padding:'4px 8px', background:'rgba(255,255,255,0.1)', borderRadius:'4px', fontSize:'0.75rem', color:'#4facfe'}}>#{t}</span>)}
                </div>
                <video src={res.shortUrl} controls autoPlay={index === 0} loop />

                <div style={{display:'flex', gap:'10px', marginTop:'15px', flexDirection:'column'}}>
                  <button onClick={() => handleUpload(res, 'youtube')} className="upload-btn yt" style={{flex: 1, justifyContent:'center'}}>
                    <Youtube size={18} /> Publish to YouTube
                  </button>
                  <button onClick={() => handleUpload(res, 'facebook')} className="upload-btn fb" style={{flex: 1, justifyContent:'center'}}>
                    <Facebook size={18} /> Share on Facebook
                  </button>
                  <button onClick={() => handleUpload(res, 'instagram')} className="upload-btn ig" style={{flex: 1, justifyContent:'center'}}>
                    <Instagram size={18} /> Post to Instagram
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="app-container">
    <div className="glass-panel auth-box">
      <UserCircle size={64} color="#4facfe" style={{marginBottom: '20px'}}/>
      <h2 className="title" style={{fontSize: '2rem'}}>{title}</h2>
      {subtitle && <p className="subtitle" style={{marginBottom: '2rem'}}>{subtitle}</p>}
      {children}
      {footer}
    </div>
  </div>
);

const AuthForm = ({ buttonText, onSubmit, email, password, setEmail, setPassword, error, loading, showForgot = false }) => {
  const [showPass, setShowPass] = useState(false);
  return (
    <form onSubmit={onSubmit}>
      <div className="input-group" style={{flexDirection: 'column'}}>
        <label className="label-text">Email Address</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required disabled={loading} placeholder="Enter your email" />
        
        <label className="label-text">Password</label>
        <div style={{position: 'relative', width: '100%'}}>
          <input 
            type={showPass ? "text" : "password"} 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            required 
            disabled={loading} 
            minLength={6} 
            placeholder="Enter password"
            style={{paddingRight: '45px'}}
          />
          <button 
            type="button" 
            onClick={() => setShowPass(!showPass)} 
            style={{position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '5px'}}
          >
            {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {showForgot && (
          <div style={{textAlign: 'right', marginTop: '-10px', marginBottom: '10px'}}>
            <Link to="/forgot-password" style={{color: '#94a3b8', fontSize: '0.85rem', textDecoration: 'none'}}>Forgot Password?</Link>
          </div>
        )}

        {error && <p style={{color: '#ff4d4f', margin: '5px 0', fontSize: '0.9rem'}}>{error}</p>}
        <button type="submit" className="action-btn" disabled={loading} style={{marginTop: '10px'}}>
          {loading ? 'Please wait...' : buttonText}
        </button>
      </div>
    </form>
  );
};

const Login = ({ setIsAuthenticated, setRole }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        localStorage.setItem('auth', 'true');
        localStorage.setItem('role', data.role || 'user');
        setIsAuthenticated(true);
        setRole(data.role || 'user');
        navigate('/dashboard');
      } else {
        setError(data.error || 'Login failed.');
      }
    } catch {
      setError("Network or server error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your ShortsMaker workspace."
      footer={<p style={{marginTop: '20px', color: '#94a3b8'}}>New here? <Link to="/register" style={{color: '#4facfe', fontWeight: 'bold'}}>Create an account</Link></p>}
    >
      <AuthForm
        buttonText="Sign In Securely"
        onSubmit={handleSubmit}
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        error={error}
        loading={loading}
        showForgot={true}
      />
    </AuthLayout>
  );
};

const Register = ({ setIsAuthenticated, setRole }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/auth/register'), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        localStorage.setItem('auth', 'true');
        localStorage.setItem('role', data.role || 'user');
        setIsAuthenticated(true);
        setRole(data.role || 'user');
        navigate('/dashboard');
      } else {
        setError(data.error || 'Registration failed.');
      }
    } catch {
      setError("Network or server error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Start clipping and publishing shorts from one dashboard."
      footer={<p style={{marginTop: '20px', color: '#94a3b8'}}>Already registered? <Link to="/login" style={{color: '#4facfe', fontWeight: 'bold'}}>Login instead</Link></p>}
    >
      <AuthForm
        buttonText="Create Account"
        onSubmit={handleSubmit}
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        error={error}
        loading={loading}
      />
    </AuthLayout>
  );
};

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage("Success! Password reset instructions sent to your email.");
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your email to receive a reset link."
      footer={<p style={{marginTop: '20px', color: '#94a3b8'}}>Remembered? <Link to="/login" style={{color: '#4facfe', fontWeight: 'bold'}}>Back to Login</Link></p>}
    >
      <form onSubmit={handleSubmit}>
        <div className="input-group" style={{flexDirection: 'column'}}>
          <label className="label-text">Email Address</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required disabled={loading} placeholder="Enter your email" />
          {message && <p style={{color: '#4ade80', fontSize: '0.9rem', marginTop: '10px'}}>{message}</p>}
          {error && <p style={{color: '#ff4d4f', fontSize: '0.9rem', marginTop: '10px'}}>{error}</p>}
          <button type="submit" className="action-btn" disabled={loading} style={{marginTop: '20px'}}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
};

const RequireAuth = ({ isAuthenticated, children }) => (
  isAuthenticated ? children : <Navigate to="/login" replace />
);

const RequireAdmin = ({ isAuthenticated, role, children }) => (
  isAuthenticated && role === 'admin' ? children : <Navigate to="/login" replace />
);

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/admin/users'), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error("Security Access Denied. Only Admins can view this data.");
        return res.json();
      })
      .then(data => {
        if (data.status === 'success') setUsers(data.users || []);
      }).catch(e => setError(e.message));
  }, []);

  return (
    <div className="app-container" style={{maxWidth: '1400px'}}>
      <div className="glass-panel" style={{ maxWidth: '1200px', width: '100%', textAlign: 'left', border: '1px solid rgba(196, 113, 237, 0.4)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <ShieldCheck size={40} color="#f64f59"/>
            <div>
              <h1 style={{fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(45deg, #f64f59, #c471ed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Security Center</h1>
              <p style={{color: '#a1a1aa', fontSize: '1rem'}}>Level 5 Admin Clearance Verified</p>
            </div>
          </div>
        </div>

        {error ? (
          <div style={{background: 'rgba(255,0,0,0.1)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,0,0,0.3)', color: '#ff4d4f', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold'}}>
            🚨 {error}
          </div>
        ) : (
          <>
            <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ color: '#a1a1aa', fontSize: '1rem', marginBottom: '10px' }}>Total Registered</h3>
                <div className="value" style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#c471ed' }}>{users.length}</div>
              </div>
              <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ color: '#a1a1aa', fontSize: '1rem', marginBottom: '10px' }}>Admins</h3>
                <div className="value" style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f64f59' }}>{users.filter(u => u.role === 'admin').length}</div>
              </div>
              <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ color: '#a1a1aa', fontSize: '1rem', marginBottom: '10px' }}>System Status</h3>
                <div className="value" style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4ade80' }}>SECURE</div>
              </div>
            </div>

            <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: '#fff' }}>User Database Intelligence</h2>
            <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.4)', borderRadius: '15px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '15px 10px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>Account ID / Email</th>
                    <th style={{ padding: '15px 10px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>Decrypted Sequence</th>
                    <th style={{ padding: '15px 10px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>Access Node</th>
                    <th style={{ padding: '15px 10px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.3s' }}>
                      <td style={{ padding: '15px 10px', color: '#38bdf8', fontWeight: '500' }}>{user.email}</td>
                      <td style={{ padding: '15px 10px', fontFamily: 'monospace', color: '#ec4899', letterSpacing: '2px' }}>{user.password}</td>
                      <td style={{ padding: '15px 10px' }}>
                        <span style={{
                          background: user.role === 'admin' ? 'rgba(246, 79, 89, 0.2)' : 'rgba(56, 189, 248, 0.1)',
                          color: user.role === 'admin' ? '#f64f59' : '#38bdf8',
                          padding: '6px 12px', border: `1px solid ${user.role === 'admin' ? '#f64f59' : '#38bdf8'}`,
                          borderRadius: '8px', fontSize:'0.8rem', textTransform: 'uppercase', fontWeight: 'bold'
                        }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: '15px 10px', fontSize: '0.85rem', color: '#94a3b8' }}>{new Date(user.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan="4" style={{padding: '30px', textAlign: 'center', color: '#64748b'}}>Scanning for users...</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('auth') === 'true');
  const [role, setRole] = useState(() => localStorage.getItem('role'));

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/auth/status'), { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.loggedIn) {
          localStorage.setItem('auth', 'true');
          localStorage.setItem('role', data.role || 'user');
          setIsAuthenticated(true);
          setRole(data.role || 'user');
        } else {
          localStorage.removeItem('auth');
          localStorage.removeItem('role');
          setIsAuthenticated(false);
          setRole(null);
        }
      })
      .catch(error => {
        console.warn('Unable to verify auth status.', error);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <Router>
      <Navbar isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} setRole={setRole} />
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login setIsAuthenticated={setIsAuthenticated} setRole={setRole}/>} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register setIsAuthenticated={setIsAuthenticated} setRole={setRole}/>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<RequireAuth isAuthenticated={isAuthenticated}><Dashboard /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin isAuthenticated={isAuthenticated} role={role}><Admin /></RequireAdmin>} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;

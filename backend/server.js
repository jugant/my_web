const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Enable CORS for all domains to prevent "failed to fetch"
app.use(cors({ origin: '*' }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-caption-ai-key-2026';
const DB_PATH = path.join(__dirname, 'database.json');

// INIT DB
function getDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], reviews: [] }));
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// AUTH MIDDLEWARE
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ success: false, error: 'Access Denied. No token provided.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}

// =======================
// AUTH ROUTES
// =======================

app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });
        
        const db = getDB();
        if (db.users.find(u => u.email === email)) {
            return res.status(400).json({ success: false, error: 'Account with this email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            name: name || email.split('@')[0],
            email,
            password: hashedPassword,
            plan: 'Free',
            credits: 20,
            history: [],
            schedule: []
        };
        
        db.users.push(newUser);
        saveDB(db);
        
        const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        const { password: _, ...userWithoutPass } = newUser;
        
        res.json({ success: true, token, user: userWithoutPass });
    } catch(e) {
        res.status(500).json({ success: false, error: 'Server error during signup' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });
        
        const db = getDB();
        const user = db.users.find(u => u.email === email);
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        const { password: _, ...userWithoutPass } = user;
        res.json({ success: true, token, user: userWithoutPass });
    } catch(e) {
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
});

app.post('/api/logout', authenticateToken, (req, res) => {
    // JWT is stateless, handled by client deleting token. But we provide route to satisfy spec.
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/user', authenticateToken, (req, res) => {
    const db = getDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    const { password, ...userWithoutPass } = user;
    res.json({ success: true, user: userWithoutPass });
});

// Used for settings profile updates & upgrades
app.post('/api/user/update', authenticateToken, async (req, res) => {
    const db = getDB();
    const user = db.users.find(u => u.id === req.user.id);
    if(!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { name, password } = req.body;
    if(name) user.name = name;
    if(password) user.password = await bcrypt.hash(password, 10);
    
    saveDB(db);
    const { password: _, ...userWithoutPass } = user;
    res.json({ success: true, user: userWithoutPass });
});

app.post('/api/user/upgrade', authenticateToken, (req, res) => {
    const db = getDB();
    const user = db.users.find(u => u.id === req.user.id);
    if(!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.plan = 'Pro';
    user.credits = 99999;
    
    saveDB(db);
    const { password: _, ...userWithoutPass } = user;
    res.json({ success: true, user: userWithoutPass });
});


// =======================
// SYSTEM LOGIC
// =======================

function handleCredits(user) {
    if(user.credits <= 0 && user.plan !== 'Pro') {
        throw new Error('Upgrade to Pro to continue using the generator.');
    }
    user.credits -= 1;
}

// Generate Captions
app.post('/api/generate-caption', authenticateToken, (req, res) => {
    try {
        const { topic, tone, platform, type } = req.body;
        const db = getDB();
        const user = db.users.find(u => u.id === req.user.id);
        if(!user) return res.status(404).json({ success: false, error: 'User not found' });

        handleCredits(user);

        let results = [];
        if (type === 'image') {
            results = [
                `A picture is worth a thousand words, but this one says purely "Vibes". ✨ Dropping some heat on your timeline. [${platform}]`,
                `Capturing the aesthetic. 📸 Sometimes the perfect moment just happens naturally. Thoughts on this? 👇`,
                `Behind the scenes of greatness. The energy in this shot is unmatched! 🔥 #Photography #Vibes`
            ];
            user.history.unshift({ id: uuidv4(), date: new Date().toISOString(), type: 'Image-to-Caption', platform, text: results[0] });
        } else if (type === 'hashtags') {
            results = Array.from({length: 10}, (_, i) => {
                const tag = `#${topic.replace(/\s/g, '')}${['Daily','Vibes','Pro','Win'][Math.floor(Math.random()*4)]}`;
                return { tag, popularity: '10k Posts', reach: '1M', trending: 80 };
            });
            // Hashtags generally don't log to history in this spec
        } else {
            results = [
                `[${platform}] Stop everything and read this! 🤯 When it comes to ${topic.substring(0,20)}..., I always thought I knew better. But applying this ${tone.toLowerCase()} strategy changed the game. 🚀\n\n#Growth #Success #Viral`,
                `The secret to mastering ${topic.substring(0,10)}? Keep it ${tone.toLowerCase()}. 🔥\n\nDrop a 💯 if you agree!\n\n#Hustle #Creator`
            ];
            user.history.unshift({ id: uuidv4(), date: new Date().toISOString(), type: 'Caption Model', platform, text: results[0] });
        }

        saveDB(db);
        res.json({ success: true, results, credits: user.credits });

    } catch (e) {
        res.status(403).json({ success: false, error: e.message || 'Server error' });
    }
});

// Rewrite Captions
app.post('/api/rewrite-caption', authenticateToken, (req, res) => {
    try {
        const { original } = req.body;
        const db = getDB();
        const user = db.users.find(u => u.id === req.user.id);
        if(!user) return res.status(404).json({ success: false, error: 'User not found' });

        handleCredits(user);

        const results = [
            `🔥 ${original.substring(0, 30)}... Wait until you see the rest! 🤯 Follow me for more insane value drops like this. 👇\n#Viral #Trending`,
            `Here’s the truth about this: "${original.substring(0, 40)}..." It’s completely changed how I operate. 📈 Save this! 📌 \n#GrowthMindset`
        ];
        
        user.history.unshift({ id: uuidv4(), date: new Date().toISOString(), type: 'Rewrite', platform: 'Any', text: results[0] });
        saveDB(db);
        res.json({ success: true, results, credits: user.credits });

    } catch(e) {
        res.status(403).json({ success: false, error: e.message || 'Server error' });
    }
});

// History Endpoints
app.get('/api/history', authenticateToken, (req, res) => {
    const db = getDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    res.json({ success: true, history: user.history });
});

app.post('/api/history/clear', authenticateToken, (req, res) => {
    const db = getDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    user.history = [];
    saveDB(db);
    res.json({ success: true });
});

// Schedule Endpoints
app.post('/api/schedule-caption', authenticateToken, (req, res) => {
    const { text, date, time } = req.body;
    const db = getDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    user.schedule.unshift({ id: uuidv4(), text, date, time });
    saveDB(db);
    res.json({ success: true, schedule: user.schedule });
});

// Reviews Endpoints
app.post('/api/review', authenticateToken, (req, res) => {
    const { rating, text } = req.body;
    const db = getDB();
    const user = db.users.find(u => u.id === req.user.id);
    if(!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    const review = {
        id: uuidv4(),
        userName: user.name,
        rating, text,
        avatar: user.name.charAt(0).toUpperCase()
    };
    db.reviews.unshift(review);
    saveDB(db);
    res.json({ success: true, reviews: db.reviews });
});

app.get('/api/reviews', (req, res) => {
    const db = getDB();
    let reviews = db.reviews;
    if(reviews.length === 0) {
        reviews = [
            { id: '1', userName: 'Sarah J.', rating: 5, text: 'This tool saved me 10 hours a week! The captions are insanely good and sound exactly like me.', avatar: 'S' },
            { id: '2', userName: 'Mike T.', rating: 5, text: 'The Aesthetic tone perfectly matches my brand. Best tool ever.', avatar: 'M' }
        ];
        db.reviews = reviews;
        saveDB(db);
    }
    res.json({ success: true, reviews });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Node.js backend running on http://localhost:${PORT}`);
});

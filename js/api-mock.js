// Local Mock API to prevent "Failed to fetch"
// This fully simulates a backend connection by using LocalStorage DB

function simulateNetwork(data, error = null) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if(error) reject(new Error(error));
            else resolve(data);
        }, 800); // 800ms natural delay
    });
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

const api = {
    // Auth endpoints
    async signup(name, email, password) {
        if (!email || !password) return simulateNetwork(null, 'Email and password required');
        
        const db = getDB();
        if (db.users.find(u => u.email === email)) {
            return simulateNetwork(null, 'Account with this email already exists');
        }
        
        const newUser = {
            id: generateId(),
            name: name || email.split('@')[0],
            email,
            password: password, // For mock ONLY, plaintext to allow login checks
            plan: 'Free',
            credits: 20,
            history: [],
            schedule: []
        };
        db.users.push(newUser);
        saveDB(db);
        
        const token = 'mock_jwt_token_' + newUser.id;
        // Don't leak pwd
        const { password: _, ...userExport } = newUser;
        return simulateNetwork({ success: true, token, user: userExport });
    },

    async login(email, password) {
        if (!email || !password) return simulateNetwork(null, 'Email and password required');
        
        const db = getDB();
        const user = db.users.find(u => u.email === email);
        if (!user || user.password !== password) {
            return simulateNetwork(null, 'Invalid email or password');
        }
        
        const token = 'mock_jwt_token_' + user.id;
        const { password: _, ...userExport } = user;
        return simulateNetwork({ success: true, token, user: userExport });
    },

    async logout() {
        return simulateNetwork({ success: true });
    },

    async getUser() {
        const token = localStorage.getItem('caption_jwt_token');
        if(!token) return simulateNetwork(null, 'No token');
        
        const id = token.split('_')[3];
        const db = getDB();
        const user = db.users.find(u => u.id === id);
        
        if(!user) return simulateNetwork(null, 'Token invalid');
        
        const { password: _, ...userExport } = user;
        return simulateNetwork({ success: true, user: userExport });
    },

    // Utilities for local checks
    _getUserFromToken() {
        const token = localStorage.getItem('caption_jwt_token');
        if(!token) return null;
        const id = token.split('_')[3];
        return getDB().users.find(u => u.id === id);
    },

    _checkCreditsAndReturn(userContext) {
        if(userContext.credits <= 0 && userContext.plan !== 'Pro') {
            throw new Error('Upgrade to Pro to continue using the generator.');
        }
        userContext.credits -= 1;
        return true;
    },

    // Generation endpoints
    async generateCaptions(topic, tone, platform) {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        try { this._checkCreditsAndReturn(user); } 
        catch(e) { return simulateNetwork(null, e.message); }

        const results = [
            `[${platform}] Stop everything and read this! 🤯 When it comes to ${topic.substring(0,20)}..., I always thought I knew better. But applying this ${tone.toLowerCase()} strategy changed the game. 🚀\n\n#Growth #Success #Viral`,
            `The secret to mastering ${topic.substring(0,10)}? Keep it ${tone.toLowerCase()}. 🔥\n\nDrop a 💯 if you agree!\n\n#Hustle #Creator`
        ];
        
        user.history.unshift({ id: generateId(), date: new Date().toISOString(), type: 'Caption Model', platform, text: results[0] });
        
        // Save back user
        const uIndex = db.users.findIndex(u => u.id === user.id);
        db.users[uIndex] = user;
        saveDB(db);
        
        auth.updateLocalUserCredits(user.credits); 
        return simulateNetwork(results);
    },

    async generateImageCaption(platform) {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        try { this._checkCreditsAndReturn(user); } 
        catch(e) { return simulateNetwork(null, e.message); }

        const results = [
            `A picture is worth a thousand words, but this one says purely "Vibes". ✨ Dropping some heat on your timeline. [${platform}]`,
            `Capturing the aesthetic. 📸 Sometimes the perfect moment just happens naturally. Thoughts on this? 👇`
        ];
        
        user.history.unshift({ id: generateId(), date: new Date().toISOString(), type: 'Image-to-Caption', platform, text: results[0] });
        const uIndex = db.users.findIndex(u => u.id === user.id);
        db.users[uIndex] = user;
        saveDB(db);
        
        auth.updateLocalUserCredits(user.credits); 
        return simulateNetwork(results);
    },

    async generateHashtags(topic) {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        try { this._checkCreditsAndReturn(user); } 
        catch(e) { return simulateNetwork(null, e.message); }

        const words = ['Daily','Vibes','Pro','Win', 'Life', 'Goals', 'Tips', 'Hack', 'Community', 'Expert'];
        const results = Array.from({length: 10}, (_, i) => {
            const suffix = words[Math.floor(Math.random() * words.length)];
            const isBaseTopic = i === 0;
            const tag = isBaseTopic ? `#${topic.replace(/\s/g, '')}` : `#${topic.replace(/\s/g, '')}${suffix}`;
            
            // Generate realistic score based on length and some random variance
            const variance = Math.floor(Math.random() * 20) - 10; // -10 to +10
            let trendingScore = isBaseTopic ? 95 : 85 - (tag.length) + variance;
            trendingScore = Math.max(20, Math.min(99, trendingScore)); // clamp between 20-99
            
            // Popularity calculation based on trending score
            let popularity = 'Low';
            let reachNum = Math.floor(Math.random() * 50) + 10;
            let reachScale = 'K';
            
            if(trendingScore > 85) {
                popularity = 'High';
                reachNum = Math.floor(Math.random() * 8) + 1;
                reachScale = 'M';
            } else if (trendingScore > 60) {
                popularity = 'Medium';
                reachNum = Math.floor(Math.random() * 500) + 100;
                reachScale = 'K';
            }
            
            return { 
                tag: tag.toLowerCase(), 
                popularity: popularity, 
                reach: `${reachNum}${reachScale}`, 
                trending: trendingScore 
            };
        });
        
        const uIndex = db.users.findIndex(u => u.id === user.id);
        db.users[uIndex] = user;
        saveDB(db);

        auth.updateLocalUserCredits(user.credits);
        return simulateNetwork(results);
    },

    async rewriteCaption(original) {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        try { this._checkCreditsAndReturn(user); } 
        catch(e) { return simulateNetwork(null, e.message); }

        const results = [
            `🔥 ${original.substring(0, 30)}... Wait until you see the rest! 🤯 Follow me for more insane value drops like this. 👇\n#Viral #Trending`
        ];
        
        user.history.unshift({ id: generateId(), date: new Date().toISOString(), type: 'Rewrite', platform: 'Any', text: results[0] });
        const uIndex = db.users.findIndex(u => u.id === user.id);
        db.users[uIndex] = user;
        saveDB(db);
        
        auth.updateLocalUserCredits(user.credits);
        return simulateNetwork(results);
    },

    // User endpoints
    async updateProfile(name, password) {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        if(name) user.name = name;
        if(password) user.password = password;
        
        const uIndex = db.users.findIndex(u => u.id === user.id);
        db.users[uIndex] = user;
        saveDB(db);

        const { password: _, ...userExport } = user;
        return simulateNetwork({ success: true, user: userExport });
    },

    async upgradeToPro() {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        user.plan = 'Pro';
        user.credits = 99999;
        
        const uIndex = db.users.findIndex(u => u.id === user.id);
        db.users[uIndex] = user;
        saveDB(db);

        const { password: _, ...userExport } = user;
        return simulateNetwork({ success: true, user: userExport });
    },

    // History and Schedule
    async clearHistory() {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        user.history = [];
        const uIndex = db.users.findIndex(u => u.id === user.id);
        db.users[uIndex] = user;
        saveDB(db);
        
        return simulateNetwork({ success: true });
    },

    async schedulePost(text, date, time) {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        user.schedule.unshift({ id: generateId(), text, date, time });
        const uIndex = db.users.findIndex(u => u.id === user.id);
        db.users[uIndex] = user;
        saveDB(db);
        
        return simulateNetwork({ success: true, schedule: user.schedule });
    },

    // Reviews
    async submitReview(rating, text) {
        const db = getDB();
        const user = this._getUserFromToken();
        if(!user) return simulateNetwork(null, 'Auth error');
        
        db.reviews.unshift({
            id: generateId(),
            userName: user.name,
            rating, text,
            avatar: user.name.charAt(0).toUpperCase()
        });
        saveDB(db);
        return simulateNetwork({ success: true, reviews: db.reviews });
    },

    async getReviews() {
        const db = getDB();
        return simulateNetwork({ success: true, reviews: db.reviews });
    }
};

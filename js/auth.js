// Real Authentication State Management 
const auth = {
    currentUser: null,

    async init() {
        const token = localStorage.getItem('caption_jwt_token');
        if (token) {
            try {
                // Verify session with the real backend
                const data = await api.getUser();
                if(data.user) {
                    this.setCurrentUser(data.user);
                    app.navigateTo('app');
                    app.setPage('dashboard');
                    return true;
                }
            } catch (error) {
                console.error("Session expired or invalid token", error);
                this.logout();
            }
        }
        return false;
    },

    async login(email, password) {
        const data = await api.login(email, password);
        localStorage.setItem('caption_jwt_token', data.token);
        this.setCurrentUser(data.user);
        app.navigateTo('app');
        app.setPage('dashboard');
        return data.user;
    },

    async signup(name, email, password) {
        const data = await api.signup(name, email, password);
        localStorage.setItem('caption_jwt_token', data.token);
        this.setCurrentUser(data.user);
        app.navigateTo('app');
        app.setPage('dashboard');
        return data.user;
    },

    setCurrentUser(user) {
        this.currentUser = user;
        app.updateUserUI(user);
        app.refreshStats();
    },

    async logout() {
        if (this.currentUser) {
            try {
                await api.logout();
            } catch (e) {
                console.log('Logout API call failed, still clearing local session.');
            }
        }
        this.currentUser = null;
        localStorage.removeItem('caption_jwt_token');
        app.navigateTo('landing');
    },

    updateLocalUserCredits(newCredits) {
        if(!this.currentUser) return;
        this.currentUser.credits = newCredits;
        app.updateUserUI(this.currentUser);
        app.refreshStats();
    },

    // UI Checks before making an api call
    updateCredits(amount) {
        // This checks if we CAN make a call before firing it to save time
        if (!this.currentUser) return false;
        
        if (amount < 0 && this.currentUser.credits <= 0 && this.currentUser.plan !== 'Pro') {
            app.showToast("Upgrade to Pro to continue generating captions.", "warning");
            app.setPage('settings');
            return false;
        }
        return true;
    },
    
    addHistory(item) {
        // Optimistically add to local history for instant UI updates
        if(!this.currentUser) return;
        this.currentUser.history.unshift({
            id: 'temp_' + Date.now(),
            date: new Date().toISOString(),
            ...item
        });
        app.refreshStats();
    },

    addSchedule(item) {
        if(!this.currentUser) return;
        this.currentUser.schedule.unshift({
            id: 'temp_' + Date.now(),
            ...item
        });
        app.refreshStats();
    },

    async clearHistory() {
        if(!this.currentUser) return;
        this.currentUser.history = [];
        app.refreshStats();
        await api.clearHistory();
    },

    async updateProfile(data) {
        if(!this.currentUser) return;
        const res = await api.updateProfile(data.name, data.password);
        this.setCurrentUser(res.user);
    },

    async upgradeToPro() {
        if(!this.currentUser) return;
        const res = await api.upgradeToPro();
        this.setCurrentUser(res.user);
    },

    async addReview(rating, text) {
        if(!this.currentUser) return;
        await api.submitReview(rating, text);
        app.showToast("Review submitted successfully! Thank you.", "success");
        // Re-render
        if(app.pages) reviews.render();
    }
};

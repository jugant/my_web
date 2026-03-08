// CORE APPLICATION LOGIC
const app = {
    theme: 'dark',

    async init() {
        this.cacheDOM();
        this.bindEvents();
        
        // Load public data initially
        await this.loadInitialData();

        // Check auth status
        const isLoggedIn = await auth.init();
        if (!isLoggedIn) {
            this.navigateTo('landing');
        }
    },

    cacheDOM() {
        this.views = {
            landing: document.getElementById('view-landing'),
            auth: document.getElementById('view-auth'),
            app: document.getElementById('view-app')
        };
        this.pages = document.querySelectorAll('.app-page');
        this.navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-page]');
        this.toastContainer = document.getElementById('toast-container');
    },

    bindEvents() {
        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        
        // Sidebar nav
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = item.getAttribute('data-page');
                this.setPage(pageId);
                // Mobile menu close
                document.querySelector('.sidebar')?.classList.remove('open');
            });
        });

        // Mobile menu toggle
        document.querySelector('.menu-toggle')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('open');
        });

        // Email Autocomplete Logic
        const emailInput = document.getElementById('auth-email');
        const suggestionsBox = document.getElementById('email-suggestions');
        const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];

        if (emailInput && suggestionsBox) {
            emailInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if(val.includes('@')) {
                    const [prefix, domainPart] = val.split('@');
                    
                    if (!domainPart || commonDomains.some(d => d.startsWith(domainPart) && d !== domainPart)) {
                        const matches = commonDomains.filter(d => d.startsWith(domainPart));
                        
                        if(matches.length > 0) {
                            suggestionsBox.innerHTML = matches.map(d => `
                                <div class="autocomplete-item" onclick="app.selectEmailSuggestion('${prefix}@${d}')">${prefix}@${d}</div>
                            `).join('');
                            suggestionsBox.classList.remove('hidden');
                        } else {
                            suggestionsBox.classList.add('hidden');
                        }
                    } else {
                        suggestionsBox.classList.add('hidden');
                    }
                } else {
                    suggestionsBox.classList.add('hidden');
                }
            });

            // Hide suggestions if clicking outside
            document.addEventListener('click', (e) => {
                if(e.target !== emailInput && !suggestionsBox.contains(e.target)) {
                    suggestionsBox.classList.add('hidden');
                }
            });
        }

        // Auth Form submit
        document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.clearAuthError();
            
            const btn = document.getElementById('auth-submit-btn');
            btn.classList.add('btn-loading');
            
            const mode = document.getElementById('auth-name-group').style.display === 'none' ? 'login' : 'signup';
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const name = document.getElementById('auth-name').value;

            try {
                if (mode === 'login') {
                    await auth.login(email, password);
                } else {
                    await auth.signup(name, email, password);
                }
                btn.classList.remove('btn-loading');
                this.showToast("Welcome to CaptionAI!", "success");
            } catch (err) {
                btn.classList.remove('btn-loading');
                this.showAuthError(err.message);
            }
        });
    },

    async loadInitialData() {
        try {
            const data = await api.getReviews();
            const reviewsContainer = document.getElementById('landing-reviews-container');
            if(reviewsContainer && data.reviews && data.reviews.length > 0) {
                reviewsContainer.innerHTML = data.reviews.slice(0, 3).map(r => `
                    <div class="review-card glass-card hover-lift">
                        <div class="stars">
                            ${'<i class="ph-fill ph-star"></i>'.repeat(r.rating)}${'<i class="ph ph-star"></i>'.repeat(5 - r.rating)}
                        </div>
                        <p class="text-muted">"${r.text}"</p>
                        <div class="user">
                            <div class="avatar">${r.avatar}</div>
                            <strong>${r.userName}</strong>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error("Could not load initial data", error);
        }
    },

    navigateTo(viewId, params = {}) {
        Object.values(this.views).forEach(v => v.classList.remove('active'));
        this.views[viewId].classList.add('active');

        if (viewId === 'auth') {
            this.setAuthMode(params.mode || 'login');
        }
        if (viewId === 'app' && !auth.currentUser) {
            this.navigateTo('auth'); // Protect route
        }
    },

    setAuthMode(mode) {
        const isLogin = mode === 'login';
        
        // Add tiny exit animation effect
        const formGroup = document.getElementById('auth-name-group');
        if(formGroup) {
            if(!isLogin) {
                formGroup.style.display = 'block';
                // Trigger reflow for animation
                void formGroup.offsetWidth;
                formGroup.classList.add('scale-in');
            } else {
                formGroup.style.display = 'none';
            }
        }
        
        document.getElementById('auth-title').textContent = isLogin ? 'Welcome back' : 'Create an account';
        document.getElementById('auth-subtitle').textContent = isLogin ? 'Login to your account to continue' : 'Sign up for free and start generating';
        document.getElementById('auth-submit-btn').textContent = isLogin ? 'Log in' : 'Sign up free';
        document.getElementById('auth-switch-text').textContent = isLogin ? "Don't have an account?" : "Already have an account?";
        document.getElementById('auth-switch-link').textContent = isLogin ? "Sign up" : "Log in";
        this.clearAuthError();
    },

    toggleAuthMode(e) {
        e.preventDefault();
        const currentMode = document.getElementById('auth-name-group').style.display === 'none' ? 'login' : 'signup';
        this.setAuthMode(currentMode === 'login' ? 'signup' : 'login');
    },

    togglePasswordVisibility() {
        const input = document.getElementById('auth-password');
        const icon = document.getElementById('pwd-toggle-icon');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('ph-eye', 'ph-eye-closed');
        } else {
            input.type = 'password';
            icon.classList.replace('ph-eye-closed', 'ph-eye');
        }
    },

    selectEmailSuggestion(email) {
        const emailInput = document.getElementById('auth-email');
        const suggestionsBox = document.getElementById('email-suggestions');
        
        emailInput.value = email;
        suggestionsBox.classList.add('hidden');
        emailInput.focus();
    },

    showAuthError(message) {
        const errorEl = document.getElementById('auth-error');
        if(errorEl) {
            errorEl.innerHTML = `<i class="ph-fill ph-warning-circle"></i> ${message}`;
            errorEl.style.display = 'block';
            
            // Re-trigger auth box shake/scale if we wanted, but popping into view is enough
            errorEl.classList.remove('scale-in');
            void errorEl.offsetWidth;
            errorEl.classList.add('scale-in');
        }
    },

    clearAuthError() {
        const errorEl = document.getElementById('auth-error');
        if(errorEl) errorEl.style.display = 'none';
    },

    setPage(pageId) {
        this.pages.forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(`page-${pageId}`);
        if(targetPage) targetPage.classList.add('active');

        this.navItems.forEach(n => n.classList.remove('active'));
        const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
        if(targetNav) {
            targetNav.classList.add('active');
            document.getElementById('current-page-title').innerHTML = targetNav.innerHTML;
        }

        if(pageId === 'dashboard') this.refreshStats();
        if(pageId === 'history') history.render();
        if(pageId === 'schedule') scheduler.render();
        if(pageId === 'reviews') reviews.render();
        if(pageId === 'settings') settings.render();
    },

    toggleTheme() {
        const body = document.body;
        if(body.classList.contains('light-mode')) {
            body.classList.replace('light-mode', 'dark-mode');
            this.theme = 'dark';
        } else {
            body.classList.replace('dark-mode', 'light-mode');
            this.theme = 'light';
        }
        const toggleBtn = document.getElementById('theme-toggle');
        if(toggleBtn) {
            toggleBtn.innerHTML = this.theme === 'dark' ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
        }
    },

    updateUserUI(user) {
        if(!user) return;
        document.getElementById('user-name-display').textContent = user.name;
        document.getElementById('user-avatar-initial').textContent = user.name.charAt(0).toUpperCase();
        document.getElementById('user-credits').textContent = user.credits;
        document.getElementById('user-plan').textContent = user.plan + ' Plan';
        
        const upgradeBanner = document.getElementById('dashboard-upgrade-banner');
        if(upgradeBanner) {
            upgradeBanner.style.display = user.plan === 'Pro' ? 'none' : 'flex';
        }
    },

    refreshStats() {
        if(!auth.currentUser) return;
        document.getElementById('dashboard-welcome').textContent = `Welcome back, ${auth.currentUser.name}!`;
        document.getElementById('stat-total-captions').textContent = auth.currentUser.history.length;
        document.getElementById('stat-scheduled').textContent = auth.currentUser.schedule.length;
        document.getElementById('stat-credits-left').textContent = auth.currentUser.credits;
    },

    showToast(message, type = 'info') {
        const icons = {
            success: 'ph-check-circle',
            error: 'ph-warning-circle',
            info: 'ph-info',
            warning: 'ph-warning'
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="ph-fill ${icons[type]} text-lg"></i> <span>${message}</span>`;
        if (this.toastContainer) {
            this.toastContainer.appendChild(toast);
        }
        setTimeout(() => toast.remove(), 4000);
    }
};

// ==========================================
// FEATURE MODULES
// ==========================================

const generator = {
    async runGeneration(btnId, type, processFn) {
        const btn = document.getElementById(btnId);
        if(!auth.updateCredits(-1)) return; // Checks credits
        
        btn.classList.add('btn-loading');
        try {
            await processFn();
            app.showToast("Generated successfully!", "success");
        } catch(e) {
            app.showToast("Error generating content.", "error");
            auth.updateCredits(1); // Refund
        } finally {
            btn.classList.remove('btn-loading');
        }
    },

    async generateCaptions() {
        const topic = document.getElementById('gen-topic').value;
        const tone = document.getElementById('gen-tone').value;
        const platform = document.getElementById('gen-platform').value;

        if(!topic) return app.showToast("Please enter a topic", "error");

        await this.runGeneration('page-generate .generate-btn', 'caption', async () => {
            const results = await api.generateCaptions(topic, tone, platform);
            const container = document.getElementById('gen-results');
            container.innerHTML = results.map(r => this.createResultCard(r)).join('');
            
            // Save to history
            auth.addHistory({ type: 'Caption Model', platform, text: results[0] });
        });
    },

    async generateImageCaptions() {
        const platform = document.getElementById('img-platform').value;
        await this.runGeneration('btn-img-generate', 'image', async () => {
            const results = await api.generateImageCaption(platform);
            const container = document.getElementById('img-results');
            container.innerHTML = results.map(r => this.createResultCard(r)).join('');
            auth.addHistory({ type: 'Image-to-Caption', platform, text: results[0] });
        });
    },

    async generateHashtags() {
        const topic = document.getElementById('hash-topic').value;
        if(!topic) return app.showToast("Enter a topic for hashtags", "error");

        const btn = document.querySelector('#page-hashtags .btn-primary');
        if(!auth.updateCredits(-1)) return;
        btn.classList.add('btn-loading');

        try {
            const results = await api.generateHashtags(topic);
            const tbody = document.getElementById('hashtags-body');
            tbody.innerHTML = results.map(r => `
                <tr>
                    <td class="font-bold font-mono text-gradient" style="font-size: 1.1rem;">${r.tag}</td>
                    <td>
                        <span class="plan-badge ${r.popularity === 'High' ? 'text-success' : r.popularity === 'Medium' ? 'text-gold' : 'text-muted'}" style="background: rgba(255,255,255,0.05); border: none;">
                            ${r.popularity}
                        </span>
                    </td>
                    <td class="text-muted"><i class="ph ph-users"></i> ~${r.reach} Est.</td>
                    <td>
                        <div class="progress-container">
                            <span style="min-width: 40px; font-weight: bold; color: ${r.trending > 85 ? '#20c997' : r.trending > 60 ? '#f39c12' : '#95a5a6'}">
                                ${r.trending}%
                            </span>
                            <div class="progress-bg">
                                <div class="progress-fill" style="width: ${r.trending}%; background: ${r.trending > 85 ? 'var(--success)' : r.trending > 60 ? 'var(--gold)' : 'var(--text-muted)'};"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            `).join('');
            
            document.getElementById('btn-copy-hashtags').disabled = false;
            window.currentHashtags = results.map(r => r.tag).join(' ');
            app.showToast("Hashtags generated!", "success");
        } catch(e) {
            auth.updateCredits(1);
        } finally {
            btn.classList.remove('btn-loading');
        }
    },

    async rewriteCaption() {
        const original = document.getElementById('rew-original').value;
        if(!original) return app.showToast("Enter a caption to rewrite", "error");

        await this.runGeneration('page-rewrite .generate-btn', 'rewrite', async () => {
            const results = await api.rewriteCaption(original);
            const container = document.getElementById('rew-results');
            container.innerHTML = results.map(r => this.createResultCard(r)).join('');
            auth.addHistory({ type: 'Rewrite', platform: 'Any', text: results[0] });
        });
    },

    createResultCard(text) {
        return `
            <div class="result-card fade-in">
                <div class="text-content">${text}</div>
                <div class="actions mt-3">
                    <button class="btn-secondary btn-small copy-btn" onclick="generator.copyText(this)"><i class="ph ph-copy"></i> Copy</button>
                    <button class="btn-primary btn-small" onclick="scheduler.prepareSchedule(this)"><i class="ph ph-calendar-plus"></i> Schedule</button>
                </div>
            </div>
        `;
    },

    copyText(btnElement) {
        const text = btnElement.closest('.result-card').querySelector('.text-content').innerText;
        navigator.clipboard.writeText(text);
        
        btnElement.classList.add('copy-animation', 'text-green');
        btnElement.innerHTML = '<i class="ph ph-check"></i> Copied';
        app.showToast("Copied to clipboard!", "success");
        
        setTimeout(() => {
            btnElement.classList.remove('copy-animation', 'text-green');
            btnElement.innerHTML = '<i class="ph ph-copy"></i> Copy';
        }, 2000);
    },

    copyAllHashtags() {
        if(window.currentHashtags) {
            navigator.clipboard.writeText(window.currentHashtags);
            app.showToast("All hashtags copied!", "success");
        }
    },

    handleImageUpload(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('image-upload-zone').classList.add('hidden');
            document.getElementById('image-preview-container').classList.remove('hidden');
            document.getElementById('image-preview').src = event.target.result;
            document.getElementById('btn-img-generate').disabled = false;
        };
        reader.readAsDataURL(file);
    },

    clearImage() {
        document.getElementById('image-upload-zone').classList.remove('hidden');
        document.getElementById('image-preview-container').classList.add('hidden');
        document.getElementById('image-input').value = '';
        document.getElementById('btn-img-generate').disabled = true;
    }
};

// Scheduler Module
const scheduler = {
    prepareSchedule(btnElement) {
        const text = btnElement.closest('.result-card').querySelector('.text-content').innerText;
        app.setPage('schedule');
        document.getElementById('sch-text').value = text;
        const now = new Date();
        document.getElementById('sch-date').value = now.toISOString().split('T')[0];
        document.getElementById('sch-time').value = now.toTimeString().substring(0,5);
    },
    
    schedulePost() {
        const text = document.getElementById('sch-text').value;
        const date = document.getElementById('sch-date').value;
        const time = document.getElementById('sch-time').value;
        
        if(!text || !date || !time) return app.showToast("Fill in all fields", "error");
        
        auth.addSchedule({ text, date, time });
        app.showToast("Post scheduled!", "success");
        
        // Reset form
        document.getElementById('sch-text').value = '';
        this.render();
    },
    
    render() {
        const list = document.getElementById('schedule-list');
        const items = auth.currentUser.schedule;
        
        if(items.length === 0) {
            list.innerHTML = `<div class="empty-state"><p>No scheduled posts yet.</p></div>`;
            return;
        }
        
        list.innerHTML = items.map(item => `
            <div class="schedule-item scale-in">
                <div>
                    <div class="font-bold text-sm text-gradient mb-2"><i class="ph ph-clock"></i> ${item.date} at ${item.time}</div>
                    <p class="text-sm">${item.text.length > 100 ? item.text.substring(0,100)+'...' : item.text}</p>
                </div>
            </div>
        `).join('');
    }
};

// History Module
const history = {
    render() {
        const container = document.getElementById('history-container');
        const items = auth.currentUser.history;
        
        if(items.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><p>No history found.</p></div>`;
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="glass-card hover-lift fade-in">
                <div class="flex-between mb-3 text-sm">
                    <span class="plan-badge">${item.platform || 'General'}</span>
                    <span class="text-muted"><i class="ph ph-clock"></i> ${new Date(item.date).toLocaleDateString()}</span>
                </div>
                <p class="mb-4 text-sm">${item.text.length > 100 ? item.text.substring(0,100)+'...' : item.text}</p>
                <div class="flex-between">
                    <span class="text-xs text-muted">Via ${item.type}</span>
                    <button class="btn-secondary btn-small" onclick="navigator.clipboard.writeText('${item.text.replace(/'/g, "\\'")}'); app.showToast('Copied!')"><i class="ph ph-copy"></i> Copy</button>
                </div>
            </div>
        `).join('');
    },
    clear() {
        if(confirm("Are you sure you want to clear your history?")) {
            auth.clearHistory();
            this.render();
            app.showToast("History cleared.", "success");
        }
    }
};

// Reviews Module
const reviews = {
    currentRating: 5,
    
    init() {
        const stars = document.querySelectorAll('#review-stars-input i');
        stars.forEach(star => {
            star.addEventListener('click', (e) => {
                this.currentRating = parseInt(e.target.dataset.val);
                stars.forEach(s => {
                    s.classList.remove('ph-fill');
                    s.classList.add('ph');
                    if(s.dataset.val <= this.currentRating) {
                        s.classList.remove('ph');
                        s.classList.add('ph-fill');
                    }
                });
            });
        });
    },
    
    submitReview() {
        const textArea = document.getElementById('review-text');
        if(!textArea.value) return app.showToast("Please enter a review message", "error");
        
        auth.addReview(this.currentRating, textArea.value);
        textArea.value = '';
        this.render();
    },
    
    async render() {
        const container = document.getElementById('reviews-list-dashboard');
        
        try {
            const data = await api.getReviews();
            const items = data.reviews || [];
            
            container.innerHTML = items.map(r => `
                <div class="glass-card mb-3 fade-in">
                    <div class="stars mb-2 text-gold">
                        ${'<i class="ph-fill ph-star"></i>'.repeat(r.rating)}${'<i class="ph ph-star"></i>'.repeat(5 - r.rating)}
                    </div>
                    <p class="text-sm mb-2">"${r.text}"</p>
                    <div class="text-xs text-muted flex-center justify-start gap-2">
                        <div class="avatar" style="width:24px;height:24px;font-size:10px">${r.avatar}</div>
                        ${r.userName}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = '<p class="text-danger">Failed to load reviews.</p>';
        }
    }
};

// Settings Module
const settings = {
    render() {
        const user = auth.currentUser;
        document.getElementById('set-name').value = user.name;
        document.getElementById('set-email').value = user.email;
        
        const isPro = user.plan === 'Pro';
        const badge = document.getElementById('set-plan-badge');
        badge.textContent = `${user.plan} Plan`;
        badge.className = `badge plan-badge large ${isPro ? '' : 'text-danger'}`;
        badge.style.borderColor = isPro ? 'var(--primary)' : 'var(--text-muted)';
        badge.style.color = isPro ? 'white' : 'inherit';
        if(isPro) badge.style.background = 'var(--gradient-primary)';
        
        document.getElementById('set-plan-desc').textContent = isPro 
            ? "You have unlimited caption generation and full feature access."
            : "You receive 20 free captions per month.";
            
        document.getElementById('upgrade-section').style.display = isPro ? 'none' : 'block';
    },
    
    updateProfile() {
        const name = document.getElementById('set-name').value;
        const pass = document.getElementById('set-password').value;
        const obj = { name };
        if(pass) obj.password = pass;
        
        auth.updateProfile(obj);
        document.getElementById('set-password').value = '';
        app.showToast("Profile updated successfully", "success");
    },
    
    upgradeToPro() {
        app.showToast("Processing payment...", "info");
        setTimeout(() => {
            auth.upgradeToPro();
            this.render();
            app.showToast("Welcome to Pro plan! Unlimited captions unlocked.", "success");
        }, 1500);
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
    
    // Bind file upload
    document.getElementById('image-upload-zone').addEventListener('click', () => {
        document.getElementById('image-input').click();
    });
    document.getElementById('image-input').addEventListener('change', (e) => generator.handleImageUpload(e));
    
    // Bind review stars
    reviews.init();
});

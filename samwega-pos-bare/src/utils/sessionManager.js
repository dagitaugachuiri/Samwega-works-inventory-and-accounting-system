class SessionManager {
    constructor() {
        this.sessionExpired = false;
        this.listeners = [];
    }

    on(event, callback) {
        if (event === 'sessionExpired') {
            this.listeners.push(callback);
        }
    }

    off(event, callback) {
        if (event === 'sessionExpired') {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        }
    }

    triggerSessionExpired() {
        if (!this.sessionExpired) {
            this.sessionExpired = true;
            this.listeners.forEach(listener => {
                try {
                    listener();
                } catch (error) {
                    console.error('[SessionManager] Error in listener:', error);
                }
            });
        }
    }

    resetSession() {
        this.sessionExpired = false;
    }

    isSessionExpired() {
        return this.sessionExpired;
    }
}

export default new SessionManager();

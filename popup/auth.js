export class AuthManager {
    constructor() {
        this.token = null;
        this.isAuthenticated = false;
        this.API_URL = 'http://localhost/panel'; // Update this to your panel URL
    }

    async initialize() {
        // Check for stored token
        const stored = await chrome.storage.local.get(['authToken']);
        if (stored.authToken) {
            this.token = stored.authToken;
            // Don't validate on init - only validate when exporting
            this.isAuthenticated = true;
        }
        this.initializeUI();
    }

    initializeUI() {
        // Initialize modal elements
        const modal = document.getElementById('authModal');
        const closeBtn = modal?.querySelector('.close');
        const validateBtn = document.getElementById('validateTokenBtn');
        const tokenInput = document.getElementById('tokenInput');

        // Close button handler
        if (closeBtn) {
            closeBtn.onclick = () => this.hideModal();
        }

        // Click outside modal to close
        if (modal) {
            window.onclick = (event) => {
                if (event.target === modal) {
                    this.hideModal();
                }
            };
        }

        // Validate button handler
        if (validateBtn && tokenInput) {
            validateBtn.onclick = async () => {
                const token = tokenInput.value.trim();
                if (!token) {
                    this.showTokenStatus('Please enter a token', 'error');
                    return;
                }

                validateBtn.disabled = true;
                validateBtn.textContent = 'Validating...';

                const isValid = await this.validateToken(token);
                
                validateBtn.disabled = false;
                validateBtn.textContent = 'Validate Token';

                if (isValid) {
                    this.showTokenStatus('Token validated successfully!', 'success');
                    setTimeout(() => this.hideModal(), 1500);
                } else {
                    this.showTokenStatus('Invalid token or subscription expired', 'error');
                }
            };
        }
    }

    showTokenStatus(message, type) {
        const statusEl = document.getElementById('tokenStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'token-status ' + type;
        }
    }

    showModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'block';
            // Clear previous status
            this.showTokenStatus('', '');
            // Clear input
            const tokenInput = document.getElementById('tokenInput');
            if (tokenInput) {
                tokenInput.value = this.token || '';
            }
        }
    }

    hideModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch(`${this.API_URL}/token.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'validate',
                    token: token
                })
            });

            const data = await response.json();
            
            if (data.valid) {
                // Store token if valid
                this.token = token;
                this.isAuthenticated = true;
                await chrome.storage.local.set({ authToken: token });
                
                // Store user data if available
                if (data.user) {
                    await chrome.storage.local.set({ userData: data.user });
                }
                
                return true;
            } else {
                this.token = null;
                this.isAuthenticated = false;
                await chrome.storage.local.remove(['authToken', 'userData']);
                console.error('Token validation failed:', data.message);
                return false;
            }
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    async checkAuth() {
        if (!this.token) {
            return false;
        }

        const isValid = await this.validateToken(this.token);
        if (!isValid) {
            this.showModal();
        }
        return isValid;
    }

    getToken() {
        return this.token;
    }

    isValid() {
        return this.isAuthenticated && this.token !== null;
    }
}
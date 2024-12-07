export class AuthManager {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.isAuthenticated = false;
        this.API_URL = 'https://kgqwiwjayaydewyuygxt.supabase.co';
        this.modal = null;
        this.tokenRefreshInterval = null;
    }

    async initialize() {
        console.log('Initializing AuthManager...');
        try {
            // Get modal element from the DOM
            this.modal = document.getElementById('authModal');
            if (!this.modal) {
                throw new Error('Auth modal not found in the DOM');
            }
            
            // Check for stored tokens
            const stored = await chrome.storage.local.get(['encryptedAccessToken', 'encryptedRefreshToken', 'tokenExpiry']);
            if (stored.encryptedAccessToken && stored.encryptedRefreshToken) {
                try {
                    // Decrypt tokens
                    this.accessToken = await this.decryptToken(
                        stored.encryptedAccessToken.encrypted,
                        stored.encryptedAccessToken.iv,
                        stored.encryptedAccessToken.key
                    );
                    this.refreshToken = await this.decryptToken(
                        stored.encryptedRefreshToken.encrypted,
                        stored.encryptedRefreshToken.iv,
                        stored.encryptedRefreshToken.key
                    );

                    // Check token expiry
                    if (stored.tokenExpiry && Date.now() < stored.tokenExpiry) {
                        const isValid = await this.validateToken(this.accessToken);
                        this.isAuthenticated = isValid;
                        if (isValid) {
                            this.setupAutoRefresh();
                        }
                    } else {
                        // Token expired, try refresh
                        await this.refreshAccessToken();
                    }
                } catch (error) {
                    console.error('Error decrypting tokens:', error);
                    await this.clearTokens();
                }
            }
            this.initializeUI();
        } catch (error) {
            console.error('Error initializing AuthManager:', error);
            throw error;
        }
    }

    async encryptToken(token) {
        const encoder = new TextEncoder();
        const data = encoder.encode(token);
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );
        return { 
            encrypted: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv),
            key: await crypto.subtle.exportKey('raw', key)
        };
    }

    async decryptToken(encrypted, iv, key) {
        try {
            const importedKey = await crypto.subtle.importKey(
                'raw',
                new Uint8Array(key),
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(iv) },
                importedKey,
                new Uint8Array(encrypted)
            );
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw error;
        }
    }

    async storeTokens(accessToken, refreshToken) {
        const encryptedAccess = await this.encryptToken(accessToken);
        const encryptedRefresh = await this.encryptToken(refreshToken);
        
        await chrome.storage.local.set({
            'encryptedAccessToken': encryptedAccess,
            'encryptedRefreshToken': encryptedRefresh,
            'tokenExpiry': Date.now() + (60 * 60 * 1000) // 1 hour
        });
    }

    async refreshAccessToken() {
        try {
            if (!this.refreshToken) {
                return false;
            }

            const response = await fetch(`${this.API_URL}/api/auth/refresh_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh_token: this.refreshToken
                })
            });

            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                await this.storeTokens(data.access_token, data.refresh_token);
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                this.isAuthenticated = true;
                return true;
            }
            
            await this.clearTokens();
            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            await this.clearTokens();
            return false;
        }
    }

    setupAutoRefresh() {
        if (this.tokenRefreshInterval) {
            clearInterval(this.tokenRefreshInterval);
        }

        this.tokenRefreshInterval = setInterval(async () => {
            const stored = await chrome.storage.local.get(['tokenExpiry']);
            if (stored.tokenExpiry && Date.now() > (stored.tokenExpiry - 5 * 60 * 1000)) {
                await this.refreshAccessToken();
            }
        }, 4 * 60 * 1000);
    }

    initializeUI() {
        console.log('Setting up validate button handler');
        
        // Get token input and validate button
        const tokenInput = this.modal?.querySelector('#tokenInput');
        const validateBtn = this.modal?.querySelector('#validateToken');
        const getTokenLink = this.modal?.querySelector('.get-token-link');
        
        if (getTokenLink) {
            getTokenLink.href = `${this.API_URL}/dashboard.php`;
        }

        if (validateBtn && tokenInput) {
            validateBtn.onclick = async () => {
                const token = tokenInput.value?.trim();
                console.log('Validating token:', token);

                if (!token) {
                    this.showTokenStatus('Please enter a token', 'error');
                    return;
                }

                validateBtn.disabled = true;
                const originalText = validateBtn.innerHTML;
                validateBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Validating...';

                try {
                    const isValid = await this.validateToken(token);
                    console.log('Validation result:', isValid);
                    
                    if (isValid) {
                        this.showTokenStatus('Token validated successfully!', 'success');
                        setTimeout(() => this.hideModal(), 1500);
                    } else {
                        this.showTokenStatus('Invalid token or subscription expired', 'error');
                    }
                } catch (error) {
                    console.error('Validation error:', error);
                    this.showTokenStatus(error.message || 'Error validating token', 'error');
                } finally {
                    validateBtn.disabled = false;
                    validateBtn.innerHTML = originalText;
                }
            };
        }
    }

    showTokenStatus(message, type) {
        console.log('Showing token status:', message, type);
        const statusEl = this.modal?.querySelector('#tokenStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'token-status ' + type;
        }
    }

    showModal() {
        const modal = this.modal;
        if (modal) {
            modal.style.display = 'block';
            // Clear previous status
            this.showTokenStatus('', '');
            // Clear input
            const tokenInput = this.modal?.querySelector('#tokenInput');
            if (tokenInput) {
                tokenInput.value = this.accessToken || '';
            }
        }
    }

    hideModal() {
        const modal = this.modal;
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async validateToken(token) {
        try {
            // Rate limiting check
            const lastCheck = await chrome.storage.local.get(['lastTokenCheck']);
            if (lastCheck.lastTokenCheck && Date.now() - lastCheck.lastTokenCheck < 1000) {
                throw new Error('Too many validation attempts');
            }

            await chrome.storage.local.set({ lastTokenCheck: Date.now() });

            const response = await fetch(`${this.API_URL}/validate_token.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                console.error('Token validation failed:', response.status, response.statusText);
                if (response.status === 500) {
                    throw new Error('Server error. Please try again later.');
                }
                throw new Error(`Validation failed (${response.status})`);
            }

            const data = await response.json();
            console.log('Token validation response:', data);
            
            if (data.valid) {
                // Store the validated token
                await this.storeTokens(token, token);
                this.accessToken = token;
                this.refreshToken = token;
                this.isAuthenticated = true;
                
                // Store user data if available
                if (data.user) {
                    await chrome.storage.local.set({ userData: data.user });
                }
                
                return true;
            }

            throw new Error(data.message || 'Invalid token');
        } catch (error) {
            console.error('Token validation error:', error);
            await this.clearTokens();
            throw error;
        }
    }

    async clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.isAuthenticated = false;
        if (this.tokenRefreshInterval) {
            clearInterval(this.tokenRefreshInterval);
        }
        await chrome.storage.local.remove([
            'encryptedAccessToken',
            'encryptedRefreshToken',
            'tokenExpiry',
            'userData',
            'lastTokenCheck'
        ]);
    }

    async checkAuth() {
        console.log('Checking auth...', this.accessToken, this.isAuthenticated);
        if (!this.accessToken) {
            console.log('No token found, showing modal');
            this.showModal();
            return false;
        }
        if (!this.isAuthenticated) {
            console.log('Not authenticated, validating token');
            const isValid = await this.validateToken(this.accessToken);
            if (!isValid) {
                console.log('Token invalid, showing modal');
                this.showModal();
                return false;
            }
        }
        console.log('Auth check passed');
        return true;
    }

    getToken() {
        return this.accessToken;
    }

    isValid() {
        return this.isAuthenticated && this.accessToken !== null;
    }
}
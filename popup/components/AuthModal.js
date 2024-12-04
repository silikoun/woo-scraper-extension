class AuthModal {
    constructor() {
        this.modal = document.createElement('div');
        this.modal.id = 'authModal';
        this.modal.className = 'modal';
        this.setupModal();
    }

    setupModal() {
        this.modal.innerHTML = `
            <div class="modal-content auth-modal">
                <h2>Authentication Required</h2>
                <p>Please get your access token to use export features.</p>
                <div class="auth-form">
                    <a href="http://localhost:5656/index.php" target="_blank" class="get-token-link">
                        Get Access Token
                    </a>
                    <div class="token-input-container">
                        <input type="text" id="tokenInput" placeholder="Enter your access token">
                        <button id="validateToken" class="validate-btn">Validate Token</button>
                    </div>
                    <div id="tokenStatus" class="token-status"></div>
                </div>
                <div class="modal-actions">
                    <button class="close-modal">Close</button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const closeBtn = this.modal.querySelector('.close-modal');
        const validateBtn = this.modal.querySelector('#validateToken');
        const tokenInput = this.modal.querySelector('#tokenInput');

        closeBtn.addEventListener('click', () => this.hide());
        validateBtn.addEventListener('click', async () => {
            // First test the connection
            if (await this.testConnection()) {
                // If connection successful, proceed with token validation
                this.validateToken(tokenInput.value);
            }
        });
        
        tokenInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                if (await this.testConnection()) {
                    this.validateToken(tokenInput.value);
                }
            }
        });
    }

    async testConnection() {
        this.showStatus('Testing connection...', 'validating');
        
        try {
            const response = await fetch('http://localhost:5656/token.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ test: 'connection' })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                this.showStatus('Connection successful, validating token...', 'validating');
                return true;
            } else {
                this.showStatus('Connection test failed. Please check server.', 'error');
                console.error('Connection test response:', data);
                return false;
            }
        } catch (error) {
            this.showStatus('Connection failed. Please check server.', 'error');
            console.error('Connection test error:', error);
            return false;
        }
    }

    async validateToken(token) {
        if (!token.trim()) {
            this.showStatus('Please enter a token', 'error');
            return;
        }

        this.showStatus('Validating...', 'validating');

        try {
            const response = await fetch('http://localhost:5656/token.php', {
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
                this.showStatus('Token validated successfully!', 'success');
                localStorage.setItem('accessToken', token);
                setTimeout(() => this.hide(), 1500);
            } else {
                this.showStatus(data.error || 'Invalid token. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Token validation error:', error);
            this.showStatus('Error connecting to server. Please try again.', 'error');
        }
    }

    showStatus(message, type) {
        const statusElement = this.modal.querySelector('#tokenStatus');
        statusElement.textContent = message;
        statusElement.className = `token-status ${type}`;
    }

    show() {
        document.body.appendChild(this.modal);
        this.modal.style.display = 'flex';
    }

    hide() {
        this.modal.style.display = 'none';
        if (this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
    }
}

export { AuthModal };

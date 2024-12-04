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
                <div class="modal-actions" style="display: none;">
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
        const modalActions = this.modal.querySelector('.modal-actions');

        closeBtn?.addEventListener('click', () => this.hide());
        validateBtn.addEventListener('click', async () => {
            await this.validateToken(tokenInput.value);
        });
        
        tokenInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await this.validateToken(tokenInput.value);
            }
        });
    }

    async validateToken(token) {
        const tokenStatus = this.modal.querySelector('#tokenStatus');
        const validateBtn = this.modal.querySelector('#validateToken');
        const modalActions = this.modal.querySelector('.modal-actions');

        if (!token) {
            this.showError('Please enter a token');
            modalActions.style.display = 'none';
            return;
        }

        try {
            validateBtn.disabled = true;
            validateBtn.textContent = 'Validating...';
            tokenStatus.textContent = 'Validating token...';
            tokenStatus.className = 'token-status validating';
            modalActions.style.display = 'none';

            const response = await fetch('http://localhost:5656/validate_token.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (data.valid) {
                localStorage.setItem('accessToken', token);
                tokenStatus.textContent = 'Token is valid! You can now use the export features.';
                tokenStatus.className = 'token-status success';
                modalActions.style.display = 'flex';
                setTimeout(() => {
                    this.hide();
                    window.location.reload();
                }, 1500);
            } else {
                this.showError(data.message || 'Invalid token. Please try again.');
                localStorage.removeItem('accessToken');
                modalActions.style.display = 'none';
            }
        } catch (error) {
            console.error('Error validating token:', error);
            this.showError('Error validating token. Please try again.');
            localStorage.removeItem('accessToken');
            modalActions.style.display = 'none';
        } finally {
            validateBtn.disabled = false;
            validateBtn.textContent = 'Validate Token';
        }
    }

    showError(message) {
        const tokenStatus = this.modal.querySelector('#tokenStatus');
        const modalActions = this.modal.querySelector('.modal-actions');
        tokenStatus.textContent = message;
        tokenStatus.className = 'token-status error';
        modalActions.style.display = 'none';
    }

    show() {
        this.modal.style.display = 'block';
        const tokenInput = this.modal.querySelector('#tokenInput');
        const modalActions = this.modal.querySelector('.modal-actions');
        const savedToken = localStorage.getItem('accessToken');
        
        modalActions.style.display = 'none';
        
        if (savedToken) {
            tokenInput.value = savedToken;
        }
    }

    hide() {
        this.modal.style.display = 'none';
    }
}

export { AuthModal };

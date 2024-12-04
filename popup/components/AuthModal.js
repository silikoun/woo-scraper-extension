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
                    <a href="https://your-panel-url.com/get-token" target="_blank" class="get-token-link">
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
        validateBtn.addEventListener('click', () => this.validateToken(tokenInput.value));
    }

    async validateToken(token) {
        const statusElement = this.modal.querySelector('#tokenStatus');
        statusElement.textContent = 'Validating...';
        statusElement.className = 'token-status validating';

        try {
            const response = await fetch('https://your-panel-url.com/validate-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (data.valid) {
                statusElement.textContent = 'Token validated successfully!';
                statusElement.className = 'token-status success';
                localStorage.setItem('accessToken', token);
                setTimeout(() => this.hide(), 1500);
            } else {
                statusElement.textContent = 'Invalid token. Please try again.';
                statusElement.className = 'token-status error';
            }
        } catch (error) {
            statusElement.textContent = 'Error validating token. Please try again.';
            statusElement.className = 'token-status error';
        }
    }

    show() {
        this.modal.style.display = 'flex';
    }

    hide() {
        this.modal.style.display = 'none';
    }
}

export { AuthModal };

import { AuthManager } from '../auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const authManager = new AuthManager();
    await authManager.initialize();
    
    // Add event listener for validate token button
    document.getElementById('validateTokenBtn').addEventListener('click', async () => {
        const tokenInput = document.getElementById('tokenInput');
        const token = tokenInput.value.trim();
        
        try {
            const isValid = await authManager.validateToken(token);
            if (isValid) {
                // Hide error message if it exists
                const errorElement = document.querySelector('.error-message');
                if (errorElement) {
                    errorElement.style.display = 'none';
                }
            }
        } catch (error) {
            // Show error message
            const errorElement = document.querySelector('.error-message') || document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.textContent = error.message;
            errorElement.style.color = 'red';
            errorElement.style.marginTop = '10px';
            
            const authSection = document.querySelector('.auth-section');
            if (authSection && !document.querySelector('.error-message')) {
                authSection.appendChild(errorElement);
            }
        }
    });
});

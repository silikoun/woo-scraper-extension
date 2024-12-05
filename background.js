// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('WooCommerce Scraper extension installed');
});

// Initialize extension data
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.set({
        scrapedData: {
            products: [],
            categories: []
        },
        apiKeys: {
            consumerKey: '',
            consumerSecret: ''
        }
    });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);

    if (request.action === 'validateToken') {
        handleTokenValidation(request.token)
            .then(response => {
                console.log('Token validation response:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('Token validation error:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message || 'Token validation failed' 
                });
            });
        return true; // Keep the message channel open for async response
    }

    if (request.action === 'saveData') {
        try {
            chrome.storage.local.set({ scrapedData: request.data })
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    if (request.action === 'getData') {
        try {
            chrome.storage.local.get(['scrapedData', 'apiKeys'])
                .then((data) => {
                    sendResponse({
                        scrapedData: data.scrapedData || { products: [], categories: [] },
                        apiKeys: data.apiKeys || { consumerKey: '', consumerSecret: '' }
                    });
                })
                .catch((error) => {
                    sendResponse({ 
                        scrapedData: { products: [], categories: [] },
                        apiKeys: { consumerKey: '', consumerSecret: '' },
                        error: error.message 
                    });
                });
        } catch (error) {
            sendResponse({ 
                scrapedData: { products: [], categories: [] },
                apiKeys: { consumerKey: '', consumerSecret: '' },
                error: error.message 
            });
        }
        return true;
    }

    if (request.action === 'saveApiKeys') {
        try {
            chrome.storage.local.set({ apiKeys: request.apiKeys })
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }

    // Handle validation request
    if (request.action === 'validateSite') {
        try {
            fetch(`${request.url}/wp-json/wc/v3/products`, {
                headers: {
                    'Authorization': 'Basic ' + btoa(`${request.apiKeys.consumerKey}:${request.apiKeys.consumerSecret}`)
                }
            })
            .then(response => {
                sendResponse({ isValid: response.ok });
            })
            .catch(() => {
                sendResponse({ isValid: false });
            });
        } catch (error) {
            sendResponse({ isValid: false, error: error.message });
        }
        return true;
    }
});

async function handleTokenValidation(token) {
    try {
        const response = await fetch('http://localhost:5656/api/auth/validate_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ token })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.valid) {
            await chrome.storage.local.set({ 
                validatedToken: token,
                userData: data.user_data
            });
        }

        return {
            success: data.valid,
            message: data.message,
            userData: data.user_data
        };
    } catch (error) {
        console.error('Token validation error:', error);
        throw new Error(error.message || 'Failed to validate token');
    }
}

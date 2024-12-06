export const config = {
    API_URL: 'https://panel-production-5838.up.railway.app',
    REQUEST_TIMEOUT: 10000, // 10 seconds
    MAX_RETRIES: 3,
    RATE_LIMIT: {
        MAX_ATTEMPTS: 5,
        WINDOW_MS: 60000 // 1 minute
    }
};

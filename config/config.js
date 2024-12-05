export const config = {
    API_URL: 'http://localhost:5656',
    REQUEST_TIMEOUT: 10000, // 10 seconds
    MAX_RETRIES: 3,
    RATE_LIMIT: {
        MAX_ATTEMPTS: 5,
        WINDOW_MS: 60000 // 1 minute
    }
};

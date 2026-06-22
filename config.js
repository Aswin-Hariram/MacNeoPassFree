const CONFIG = {
    BACKEND_BASE_URL: 'https://study-backend-f5ck.onrender.com',
    
    // API Endpoints (relative to BACKEND_BASE_URL)
    ENDPOINTS: {
        MCQ_TEXT: '/api/mcq-text',
        CODING_TEXT: '/api/coding-text',
        HEALTH: '/api/health'
    },
    
    REQUEST_TIMEOUT: 15000 // 15 seconds timeout for blocking requests
};
Object.freeze(CONFIG);
Object.freeze(CONFIG.ENDPOINTS);

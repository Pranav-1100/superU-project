const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later',
        code: 'rate_limit_exceeded'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    skipSuccessfulRequests: true, // Don't count successful requests
    message: {
        error: 'Too many login attempts, please try again after 15 minutes',
        code: 'auth_rate_limit_exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter for registration
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 registrations per hour
    message: {
        error: 'Too many accounts created from this IP, please try again after an hour',
        code: 'register_rate_limit_exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Content creation rate limiter
const contentCreationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit to 10 content scrapes per 15 minutes
    message: {
        error: 'Too many content creation requests, please try again later',
        code: 'content_creation_rate_limit_exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter,
    authLimiter,
    registerLimiter,
    contentCreationLimiter
};

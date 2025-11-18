const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/team');
const contentRoutes = require('./routes/content');
// New feature routes
const lockRoutes = require('./routes/locks');
const commentRoutes = require('./routes/comments');
const templateRoutes = require('./routes/templates');
const activityRoutes = require('./routes/activity');
const approvalRoutes = require('./routes/approvals');
const diffRoutes = require('./routes/diff');
const exportRoutes = require('./routes/export');

// Import database configuration
const db = require('./models');

const app = express();

// Get allowed origins from environment
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'];

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true
}));

// Routes
app.use('/api', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/content', contentRoutes);
// New feature routes
app.use('/api/locks', lockRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/diff', diffRoutes);
app.use('/api/export', exportRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404 handler (must be before error handler)
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handlers (must be last)
app.use((err, req, res, next) => {
    // JWT errors
    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token',
            code: 'invalid_token'
        });
    }

    // Token expired
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token has expired',
            code: 'token_expired'
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.message
        });
    }

    // CORS errors
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            error: 'CORS policy violation',
            code: 'cors_error'
        });
    }

    // Log error for debugging
    console.error('Error:', err);

    // Generic error
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message
    });
});

// Database initialization
db.sequelize.sync()
    .then(() => {
        console.log('Database synced successfully');
    })
    .catch((err) => {
        console.error('Failed to sync database:', err);
        process.exit(1);
    });

module.exports = app;

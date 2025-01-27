const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Redis = require('redis');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/team');
const contentRoutes = require('./routes/content');

// Import database configuration
const db = require('./models');

const app = express();

// Redis client setup
const redisClient = Redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Credentials'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// JWT error handling middleware
app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Invalid token',
            code: 'invalid_token'
        });
    }
    next(err);
});

// Routes
app.use('/api', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/content', contentRoutes);

// Error handlers
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Database initialization
db.sequelize.sync()
    .then(() => {
        console.log('Database synced successfully');
    })
    .catch((err) => {
        console.error('Failed to sync database:', err);
    });

module.exports = app;

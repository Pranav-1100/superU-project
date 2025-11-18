require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const socketIo = require('socket.io');
const logger = require('./src/utils/logger');

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET_KEY'];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        logger.error(`Environment variable not set: ${varName}`);
        process.exit(1);
    }
});

const server = http.createServer(app);

// Get allowed origins from environment or use default
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'];

const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    }
});

// Attach io to app for use in routes
app.set('io', io);

// Socket.io setup
require('./src/services/socketService')(io);

const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const socketIo = require('socket.io');

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET_KEY'];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`Error: ${varName} environment variable is not set`);
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
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

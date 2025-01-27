const app = require('./src/app');
const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    }
});

// Socket.io setup
require('./src/services/socketService')(io);

const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const { checkTeamPermissions } = require('../middleware/auth');
const logger = require('../utils/logger');

module.exports = (io) => {
    io.on('connection', (socket) => {
        socket.on('join', async (data) => {
            const { content_id, user_id } = data;
            if (!content_id) return;

            const room = `content_${content_id}`;
            socket.join(room);
            logger.info(`User ${user_id} joined room: ${room}`);

            socket.to(room).emit('user_joined', {
                user_id,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('leave', (data) => {
            const { content_id, user_id } = data;
            if (!content_id) return;

            const room = `content_${content_id}`;
            socket.leave(room);
            logger.info(`User ${user_id} left room: ${room}`);

            socket.to(room).emit('user_left', {
                user_id,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('cursor_move', (data) => {
            const { content_id, user_id, position } = data;
            if (!content_id) return;

            const room = `content_${content_id}`;
            socket.to(room).emit('cursor_update', {
                user_id,
                position,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('typing', (data) => {
            const { content_id, user_id, node_id } = data;
            if (!content_id || !user_id || !node_id) return;

            const room = `content_${content_id}`;
            socket.to(room).emit('user_typing', {
                user_id,
                node_id,
                timestamp: new Date().toISOString()
            });
        });
    });
};

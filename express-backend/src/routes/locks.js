const express = require('express');
const router = express.Router();
const { ContentLock, ContentNode, Content } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');
const { Op } = require('sequelize');

// Lock a content node for editing
router.post('/acquire/:node_id', authMiddleware, async (req, res) => {
    try {
        const { node_id } = req.params;
        const userId = req.user.id;
        const duration = parseInt(req.body.duration) || 5; // Default 5 minutes

        // Get node and check permissions
        const node = await ContentNode.findByPk(node_id, {
            include: [{ model: Content }]
        });

        if (!node) {
            return res.status(404).json({ error: 'Node not found' });
        }

        const hasPermission = await checkTeamPermissions(userId, node.Content.team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Check for existing lock
        const existingLock = await ContentLock.findOne({
            where: { node_id }
        });

        if (existingLock) {
            // Check if lock is expired
            if (existingLock.isExpired()) {
                // Remove expired lock
                await existingLock.destroy();
            } else if (existingLock.locked_by !== userId) {
                return res.status(423).json({
                    error: 'Content is locked by another user',
                    code: 'content_locked',
                    locked_by: existingLock.locked_by,
                    expires_at: existingLock.expires_at
                });
            } else {
                // User already has the lock, extend it
                existingLock.expires_at = new Date(Date.now() + duration * 60 * 1000);
                await existingLock.save();
                return res.json({
                    message: 'Lock extended',
                    lock: existingLock
                });
            }
        }

        // Create new lock
        const lock = await ContentLock.create({
            node_id,
            locked_by: userId,
            expires_at: new Date(Date.now() + duration * 60 * 1000)
        });

        res.json({
            message: 'Lock acquired',
            lock
        });
    } catch (error) {
        console.error('Error acquiring lock:', error);
        res.status(500).json({ error: error.message });
    }
});

// Release a lock
router.delete('/release/:node_id', authMiddleware, async (req, res) => {
    try {
        const { node_id } = req.params;
        const userId = req.user.id;

        const lock = await ContentLock.findOne({
            where: { node_id }
        });

        if (!lock) {
            return res.status(404).json({ error: 'No lock found' });
        }

        // Only the locker can release the lock
        if (lock.locked_by !== userId) {
            return res.status(403).json({ error: 'You do not own this lock' });
        }

        await lock.destroy();

        res.json({ message: 'Lock released' });
    } catch (error) {
        console.error('Error releasing lock:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check lock status
router.get('/status/:node_id', authMiddleware, async (req, res) => {
    try {
        const { node_id } = req.params;

        const lock = await ContentLock.findOne({
            where: { node_id }
        });

        if (!lock) {
            return res.json({ locked: false });
        }

        if (lock.isExpired()) {
            await lock.destroy();
            return res.json({ locked: false });
        }

        res.json({
            locked: true,
            locked_by: lock.locked_by,
            locked_at: lock.locked_at,
            expires_at: lock.expires_at,
            is_owner: lock.locked_by === req.user.id
        });
    } catch (error) {
        console.error('Error checking lock status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clean up expired locks (can be called by a cron job)
router.post('/cleanup', authMiddleware, async (req, res) => {
    try {
        const deleted = await ContentLock.destroy({
            where: {
                expires_at: {
                    [Op.lt]: new Date()
                }
            }
        });

        res.json({
            message: 'Expired locks cleaned up',
            deleted_count: deleted
        });
    } catch (error) {
        console.error('Error cleaning up locks:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { ActivityLog, User } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');

// Get activity feed for a team
router.get('/team/:team_id', authMiddleware, async (req, res) => {
    try {
        const { team_id } = req.params;
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;
        const actionType = req.query.action_type; // Optional filter

        const hasPermission = await checkTeamPermissions(userId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Build where clause
        const where = { team_id };
        if (actionType) {
            where.action_type = actionType;
        }

        const { count, rows: activities } = await ActivityLog.findAndCountAll({
            where,
            include: [{
                model: User,
                as: 'actor',
                attributes: ['id', 'email']
            }],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        res.json({
            activities,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching activity feed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get activity for a specific user in a team
router.get('/team/:team_id/user/:user_id', authMiddleware, async (req, res) => {
    try {
        const { team_id, user_id } = req.params;
        const requesterId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;

        const hasPermission = await checkTeamPermissions(requesterId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { count, rows: activities } = await ActivityLog.findAndCountAll({
            where: {
                team_id,
                user_id
            },
            include: [{
                model: User,
                as: 'actor',
                attributes: ['id', 'email']
            }],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        res.json({
            activities,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get activity stats for a team
router.get('/team/:team_id/stats', authMiddleware, async (req, res) => {
    try {
        const { team_id } = req.params;
        const userId = req.user.id;
        const days = parseInt(req.query.days) || 7; // Default last 7 days

        const hasPermission = await checkTeamPermissions(userId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const since = new Date();
        since.setDate(since.getDate() - days);

        // Get activity counts by type
        const activities = await ActivityLog.findAll({
            where: {
                team_id,
                created_at: {
                    [require('sequelize').Op.gte]: since
                }
            },
            attributes: [
                'action_type',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            group: ['action_type']
        });

        // Get most active users
        const activeUsers = await ActivityLog.findAll({
            where: {
                team_id,
                created_at: {
                    [require('sequelize').Op.gte]: since
                }
            },
            attributes: [
                'user_id',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'action_count']
            ],
            include: [{
                model: User,
                as: 'actor',
                attributes: ['id', 'email']
            }],
            group: ['user_id'],
            order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']],
            limit: 10
        });

        res.json({
            period: `Last ${days} days`,
            activity_by_type: activities.map(a => ({
                action_type: a.action_type,
                count: parseInt(a.get('count'))
            })),
            most_active_users: activeUsers.map(u => ({
                user: u.actor,
                action_count: parseInt(u.get('action_count'))
            }))
        });
    } catch (error) {
        console.error('Error fetching activity stats:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

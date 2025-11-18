const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Team, TeamMember, Invitation, Content, ContentEdit } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');

// Login route - With rate limiting
router.post('/login', authLimiter, validate(schemas.login), async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });

        if (!user) {
            // Generic error message to prevent user enumeration
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is suspended
        if (user.status === 'suspended') {
            return res.status(403).json({
                error: 'Account suspended. Please contact support.',
                code: 'account_suspended'
            });
        }

        // Use the model method for password checking
        const isValidPassword = await user.checkPassword(password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { sub: user.id },
            process.env.JWT_SECRET_KEY,
            { expiresIn: process.env.JWT_EXPIRY || '24h' }
        );

        res.json({
            token,
            user_id: user.id,
            email: user.email
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register route - With rate limiting and password validation
router.post('/register', registerLimiter, validate(schemas.register), async (req, res) => {
    try {
        const { email, password } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                error: 'Email already registered',
                code: 'email_exists'
            });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 12); // Increased from 10 to 12 rounds

        // Create user
        const user = await User.create({
            email,
            password_hash,
            status: 'active'
        });

        const token = jwt.sign(
            { sub: user.id },
            process.env.JWT_SECRET_KEY,
            { expiresIn: process.env.JWT_EXPIRY || '24h' }
        );

        res.status(201).json({
            token,
            user_id: user.id,
            email: user.email
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user info route
router.get('/user/info', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get team memberships with proper pagination
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = (page - 1) * limit;

        const { count, rows: teamMemberships } = await TeamMember.findAndCountAll({
            where: { user_id: user.id },
            include: [{
                model: Team,
                include: [{
                    model: Content,
                    limit: 5,
                    order: [['updated_at', 'DESC']],
                    separate: true // Prevents cartesian product
                }]
            }],
            limit,
            offset,
            distinct: true // Important for correct count with includes
        });

        const teamsInfo = teamMemberships.map(membership => ({
            team_id: membership.team_id,
            team_name: membership.Team.name,
            role: membership.role,
            joined_at: membership.joined_at,
            is_owner: membership.Team.owner_id === user.id,
            recent_activity: membership.Team.Contents.map(content => ({
                content_id: content.id,
                title: content.title,
                updated_at: content.updated_at
            }))
        }));

        // Get pending invitations
        const pendingInvites = await Invitation.findAll({
            where: {
                email: user.email,
                status: 'pending',
                expires_at: { [require('sequelize').Op.gt]: new Date() }
            },
            include: [{
                model: Team,
                attributes: ['id', 'name']
            }],
            order: [['created_at', 'DESC']],
            limit: 10
        });

        // Get recent edits
        const recentEdits = await ContentEdit.findAll({
            where: { user_id: user.id },
            order: [['created_at', 'DESC']],
            limit: 10,
            include: [{
                model: Content,
                attributes: ['id', 'title']
            }]
        });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                status: user.status,
                teams_count: count
            },
            teams: teamsInfo,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            },
            pending_invitations: pendingInvites.map(invite => ({
                team_id: invite.team_id,
                team_name: invite.Team.name,
                role: invite.role,
                invite_code: invite.invite_code,
                expires_at: invite.expires_at
            })),
            recent_activity: recentEdits.map(edit => ({
                content_id: edit.content_id,
                content_title: edit.Content?.title,
                node_id: edit.node_id,
                created_at: edit.created_at,
                has_changes: edit.previous_content !== edit.new_content
            }))
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Refresh token endpoint
router.post('/refresh', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user || user.status !== 'active') {
            return res.status(401).json({ error: 'Invalid user' });
        }

        const newToken = jwt.sign(
            { sub: user.id },
            process.env.JWT_SECRET_KEY,
            { expiresIn: process.env.JWT_EXPIRY || '24h' }
        );

        res.json({ token: newToken });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        // Validate new password
        const passwordSchema = schemas.register.extract('password');
        const { error } = passwordSchema.validate(new_password);
        if (error) {
            return res.status(400).json({
                error: 'New password does not meet requirements',
                details: error.message
            });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValidPassword = await user.checkPassword(current_password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash and update password
        user.password_hash = await bcrypt.hash(new_password, 12);
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

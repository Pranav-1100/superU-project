const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Team, TeamMember, Invitation, Content, ContentEdit } = require('../models');
const { authMiddleware } = require('../middleware/auth');

// Login route
router.post('/login', async (req, res) => {
    try {
        console.log('Received login request');
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ where: { email } });
        console.log(`Found user: ${user?.id}`);

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { sub: user.id },
            process.env.JWT_SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user_id: user.id,
            email: user.email
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Register route
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            email,
            password_hash,
            status: 'active'
        });

        const token = jwt.sign(
            { sub: user.id },
            process.env.JWT_SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user_id: user.id,
            email: user.email
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: error.message });
    }
});


// Get user info route
router.get('/user/info', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get team memberships with proper column names
        const teamMemberships = await TeamMember.findAll({
            where: { user_id: user.id },
            include: [{
                model: Team,
                include: [{
                    model: Content,
                    limit: 5,
                    order: [['updated_at', 'DESC']]
                }]
            }]
        });

        const teamsInfo = teamMemberships.map(membership => ({
            team_id: membership.team_id,
            team_name: membership.Team.name,
            role: membership.role,
            joined_at: membership.created_at,
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
                status: 'pending'
            }
        });

        // Get recent edits
        const recentEdits = await ContentEdit.findAll({
            where: { user_id: user.id },
            order: [['created_at', 'DESC']],
            limit: 10
        });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
                status: user.status,
                teams_count: teamsInfo.length
            },
            teams: teamsInfo,
            pending_invitations: pendingInvites.map(invite => ({
                team_id: invite.team_id,
                role: invite.role,
                invite_code: invite.invite_code,
                expires_at: invite.expires_at
            })),
            recent_activity: recentEdits.map(edit => ({
                content_id: edit.content_id,
                node_id: edit.node_id,
                created_at: edit.created_at,
                has_changes: edit.previous_content !== edit.new_content
            }))
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

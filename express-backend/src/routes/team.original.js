const express = require('express');
const router = express.Router();
const { Team, TeamMember, Invitation, User } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { addDays } = require('date-fns');

// Create team route
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.id;

        const team = await Team.create({
            name,
            owner_id: userId
        });

        await TeamMember.create({
            team_id: team.id,
            user_id: userId,
            role: 'owner'
        });

        res.status(201).json({
            team_id: team.id,
            name: team.name,
            role: 'owner'
        });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: error.message });
    }
});

// Invite member route
// src/routes/team.js - Update the invite route
router.post('/invite', authMiddleware, async (req, res) => {
    try {
        const { team_id, email, role } = req.body;
        const userId = req.user.id;

        // Check permissions
        const member = await TeamMember.findOne({
            where: {
                team_id,
                user_id: userId,
                role: ['owner', 'admin']
            }
        });

        if (!member) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Create invitation
        const invitation = await Invitation.create({
            team_id,
            email,
            role,
            invited_by: userId,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        // Get team name
        const team = await Team.findByPk(team_id);
        // Updated URL format
        const invite_url = `http://localhost:3000/auth/team/${invitation.invite_code}`;

        // Send email
        const emailService = require('../services/emailService');
        const emailSent = await emailService.sendTeamInvitation(
            email,
            team.name,
            role,
            invite_url
        );

        if (!emailSent) {
            console.warn('Failed to send invitation email');
        }

        res.status(201).json({
            invite_code: invitation.invite_code,
            invite_url: invite_url
        });
    } catch (error) {
        console.error('Error creating invitation:', error);
        res.status(500).json({ error: error.message });
    }
});


// Accept invitation route
router.post('/accept-invite/:invite_code', authMiddleware, async (req, res) => {
    try {
        const { invite_code } = req.params;
        const userId = req.user.id;

        const invitation = await Invitation.findOne({
            where: {
                invite_code,
                status: 'pending'
            }
        });

        if (!invitation || invitation.expires_at < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired invitation' });
        }

        await TeamMember.create({
            team_id: invitation.team_id,
            user_id: userId,
            role: invitation.role,
            invited_by: invitation.invited_by
        });

        invitation.status = 'accepted';
        await invitation.save();

        res.json({ message: 'Invitation accepted successfully' });
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get team members route
router.get('/members/:team_id', authMiddleware, async (req, res) => {
    try {
        const { team_id } = req.params;
        const userId = req.user.id;

        const hasPermission = await checkTeamPermissions(userId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const members = await TeamMember.findAll({
            where: { team_id },
            include: [{
                model: User,
                attributes: ['email']
            }]
        });

        const membersData = members.map(member => ({
            id: member.id,
            user_id: member.user_id,
            email: member.User.email,
            role: member.role,
            joined_at: member.joined_at
        }));

        res.json({ members: membersData });
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

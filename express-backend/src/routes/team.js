const express = require('express');
const router = express.Router();
const { Team, TeamMember, Invitation, User, ActivityLog } = require('../models');
const { authMiddleware, checkTeamPermissions, requireTeamRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');

// Create team route
router.post('/create', authMiddleware, validate(schemas.createTeam), async (req, res) => {
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

        // Log activity
        await ActivityLog.logActivity(
            team.id,
            userId,
            'team_created',
            'team',
            team.id,
            { team_name: name }
        );

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

// Invite member route - FIXED
router.post('/invite', authMiddleware, validate(schemas.inviteMember), async (req, res) => {
    try {
        const { team_id, email, role } = req.body;
        const userId = req.user.id;

        // Check permissions - FIXED: Properly check for owner or admin
        const hasPermission = await checkTeamPermissions(userId, team_id, ['owner', 'admin']);

        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized - Only owners and admins can invite members' });
        }

        // Check if user is already a member
        const existingMember = await TeamMember.findOne({
            include: [{
                model: User,
                where: { email }
            }],
            where: { team_id }
        });

        if (existingMember) {
            return res.status(400).json({ error: 'User is already a team member' });
        }

        // Check for pending invitation
        const existingInvitation = await Invitation.findOne({
            where: {
                team_id,
                email,
                status: 'pending',
                expires_at: { [Op.gt]: new Date() }
            }
        });

        if (existingInvitation) {
            return res.status(400).json({ error: 'Invitation already sent to this email' });
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

        // Use environment variable for frontend URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const invite_url = `${frontendUrl}/auth/team/${invitation.invite_code}`;

        // Send email
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
            invite_url: invite_url,
            email_sent: emailSent
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

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        if (invitation.expires_at < new Date()) {
            invitation.status = 'expired';
            await invitation.save();
            return res.status(400).json({ error: 'Invitation has expired' });
        }

        // Check if already a member
        const existingMember = await TeamMember.findOne({
            where: {
                team_id: invitation.team_id,
                user_id: userId
            }
        });

        if (existingMember) {
            return res.status(400).json({ error: 'You are already a member of this team' });
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
                attributes: ['id', 'email', 'status']
            }],
            order: [['joined_at', 'DESC']]
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

// Remove team member (owner/admin only)
router.delete('/members/:team_id/:user_id', authMiddleware, async (req, res) => {
    try {
        const { team_id, user_id } = req.params;
        const requesterId = req.user.id;

        // Check if requester has permission
        const hasPermission = await checkTeamPermissions(requesterId, team_id, ['owner', 'admin']);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized - Only owners and admins can remove members' });
        }

        // Check if target user is the owner
        const team = await Team.findByPk(team_id);
        if (team.owner_id === user_id) {
            return res.status(400).json({ error: 'Cannot remove the team owner' });
        }

        // Check if requester is trying to remove themselves
        if (requesterId === user_id) {
            return res.status(400).json({ error: 'Use the leave team endpoint to remove yourself' });
        }

        const deleted = await TeamMember.destroy({
            where: {
                team_id,
                user_id
            }
        });

        if (deleted === 0) {
            return res.status(404).json({ error: 'Team member not found' });
        }

        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing team member:', error);
        res.status(500).json({ error: error.message });
    }
});

// Leave team
router.post('/leave/:team_id', authMiddleware, async (req, res) => {
    try {
        const { team_id } = req.params;
        const userId = req.user.id;

        // Check if user is the owner
        const team = await Team.findByPk(team_id);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        if (team.owner_id === userId) {
            return res.status(400).json({
                error: 'Team owner cannot leave the team. Transfer ownership or delete the team instead.'
            });
        }

        const deleted = await TeamMember.destroy({
            where: {
                team_id,
                user_id: userId
            }
        });

        if (deleted === 0) {
            return res.status(404).json({ error: 'You are not a member of this team' });
        }

        res.json({ message: 'Successfully left the team' });
    } catch (error) {
        console.error('Error leaving team:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

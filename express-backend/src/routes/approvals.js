const express = require('express');
const router = express.Router();
const { ApprovalRequest, ContentEdit, ContentNode, Content, User } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');

// Request approval for a content edit
router.post('/request/:edit_id', authMiddleware, async (req, res) => {
    try {
        const { edit_id } = req.params;
        const userId = req.user.id;
        const { comment } = req.body;

        const edit = await ContentEdit.findByPk(edit_id, {
            include: [{
                model: ContentNode,
                include: [{ model: Content }]
            }]
        });

        if (!edit) {
            return res.status(404).json({ error: 'Edit not found' });
        }

        // Only the editor can request approval
        if (edit.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Check if approval already exists
        const existing = await ApprovalRequest.findOne({
            where: { content_edit_id: edit_id }
        });

        if (existing) {
            return res.status(400).json({
                error: 'Approval request already exists',
                status: existing.status
            });
        }

        const approval = await ApprovalRequest.create({
            content_edit_id: edit_id,
            requested_by: userId,
            comment
        });

        // Emit socket event to notify admins
        const io = req.app.get('io');
        if (io) {
            io.to(`content_${edit.ContentNode.content_id}`).emit('approval_requested', {
                approval_id: approval.id,
                edit_id,
                requested_by: userId,
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            message: 'Approval requested',
            approval
        });
    } catch (error) {
        console.error('Error requesting approval:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get pending approvals for a team
router.get('/pending/:team_id', authMiddleware, async (req, res) => {
    try {
        const { team_id } = req.params;
        const userId = req.user.id;

        // Only admins and owners can see pending approvals
        const hasPermission = await checkTeamPermissions(userId, team_id, ['owner', 'admin']);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Only owners and admins can view approval requests' });
        }

        const approvals = await ApprovalRequest.findAll({
            where: { status: 'pending' },
            include: [
                {
                    model: ContentEdit,
                    include: [{
                        model: ContentNode,
                        include: [{
                            model: Content,
                            where: { team_id }
                        }]
                    }]
                },
                {
                    model: User,
                    as: 'requester',
                    attributes: ['id', 'email']
                }
            ],
            order: [['created_at', 'ASC']]
        });

        res.json({ approvals });
    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.status(500).json({ error: error.message });
    }
});

// Approve or reject an approval request
router.post('/:approval_id/:action', authMiddleware, async (req, res) => {
    try {
        const { approval_id, action } = req.params;
        const userId = req.user.id;
        const { comment } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
        }

        const approval = await ApprovalRequest.findByPk(approval_id, {
            include: [{
                model: ContentEdit,
                include: [{
                    model: ContentNode,
                    include: [{ model: Content }]
                }]
            }]
        });

        if (!approval) {
            return res.status(404).json({ error: 'Approval request not found' });
        }

        if (approval.status !== 'pending') {
            return res.status(400).json({
                error: 'Approval request already processed',
                status: approval.status
            });
        }

        // Check permissions (admin or owner)
        const teamId = approval.ContentEdit.ContentNode.Content.team_id;
        const hasPermission = await checkTeamPermissions(userId, teamId, ['owner', 'admin']);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Only owners and admins can approve/reject' });
        }

        // Can't approve own request
        if (approval.requested_by === userId) {
            return res.status(403).json({ error: 'Cannot approve your own request' });
        }

        approval.status = action === 'approve' ? 'approved' : 'rejected';
        approval.approved_by = userId;
        approval.reviewed_at = new Date();
        if (comment) approval.comment = comment;

        await approval.save();

        // If approved, apply the edit
        if (action === 'approve') {
            const edit = approval.ContentEdit;
            const content = edit.ContentNode.Content;

            let currentData = {};
            try {
                currentData = JSON.parse(content.current_content);
            } catch (e) {
                currentData = {};
            }

            const nodeTitle = edit.ContentNode.title;
            if (!currentData[nodeTitle]) {
                currentData[nodeTitle] = {};
            }
            currentData[nodeTitle].content = edit.new_content;

            await content.update({
                current_content: JSON.stringify(currentData),
                updated_at: new Date()
            });
        }

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`content_${approval.ContentEdit.ContentNode.content_id}`).emit('approval_processed', {
                approval_id,
                status: approval.status,
                reviewed_by: userId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            message: `Edit ${action}d`,
            approval
        });
    } catch (error) {
        console.error('Error processing approval:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get approval history for a content item
router.get('/history/:content_id', authMiddleware, async (req, res) => {
    try {
        const { content_id } = req.params;
        const userId = req.user.id;

        const content = await Content.findByPk(content_id);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        const hasPermission = await checkTeamPermissions(userId, content.team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const approvals = await ApprovalRequest.findAll({
            include: [
                {
                    model: ContentEdit,
                    include: [{
                        model: ContentNode,
                        where: { content_id }
                    }]
                },
                {
                    model: User,
                    as: 'requester',
                    attributes: ['id', 'email']
                },
                {
                    model: User,
                    as: 'reviewer',
                    attributes: ['id', 'email']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ approvals });
    } catch (error) {
        console.error('Error fetching approval history:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

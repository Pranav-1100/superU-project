const express = require('express');
const router = express.Router();
const { Comment, ContentNode, Content, User } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');
const Joi = require('joi');

// Validation schema
const commentSchema = Joi.object({
    content: Joi.string().min(1).max(5000).required(),
    position: Joi.object().optional(),
    parent_comment_id: Joi.string().uuid().optional()
});

// Create comment
router.post('/:node_id', authMiddleware, async (req, res) => {
    try {
        const { node_id } = req.params;
        const userId = req.user.id;

        // Validate input
        const { error, value } = commentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details
            });
        }

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

        // Create comment
        const comment = await Comment.create({
            node_id,
            user_id: userId,
            content: value.content,
            position: value.position,
            parent_comment_id: value.parent_comment_id || null
        });

        // Fetch comment with author info
        const fullComment = await Comment.findByPk(comment.id, {
            include: [{
                model: User,
                as: 'author',
                attributes: ['id', 'email']
            }]
        });

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`content_${node.content_id}`).emit('comment_added', {
                comment: fullComment,
                node_id,
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            message: 'Comment created',
            comment: fullComment
        });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get comments for a node
router.get('/:node_id', authMiddleware, async (req, res) => {
    try {
        const { node_id } = req.params;
        const userId = req.user.id;
        const includeResolved = req.query.include_resolved === 'true';

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

        // Build query
        const where = { node_id, parent_comment_id: null };
        if (!includeResolved) {
            where.resolved = false;
        }

        // Get comments with replies
        const comments = await Comment.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'email']
                },
                {
                    model: Comment,
                    as: 'replies',
                    include: [{
                        model: User,
                        as: 'author',
                        attributes: ['id', 'email']
                    }]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ comments });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update comment
router.put('/:comment_id', authMiddleware, async (req, res) => {
    try {
        const { comment_id } = req.params;
        const userId = req.user.id;
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const comment = await Comment.findByPk(comment_id);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Only author can edit
        if (comment.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        comment.content = content;
        await comment.save();

        res.json({
            message: 'Comment updated',
            comment
        });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resolve comment
router.post('/:comment_id/resolve', authMiddleware, async (req, res) => {
    try {
        const { comment_id } = req.params;
        const userId = req.user.id;

        const comment = await Comment.findByPk(comment_id, {
            include: [{
                model: ContentNode,
                include: [{ model: Content }]
            }]
        });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const hasPermission = await checkTeamPermissions(
            userId,
            comment.ContentNode.Content.team_id
        );

        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        comment.resolved = true;
        comment.resolved_by = userId;
        comment.resolved_at = new Date();
        await comment.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`content_${comment.ContentNode.content_id}`).emit('comment_resolved', {
                comment_id,
                resolved_by: userId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            message: 'Comment resolved',
            comment
        });
    } catch (error) {
        console.error('Error resolving comment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete comment
router.delete('/:comment_id', authMiddleware, async (req, res) => {
    try {
        const { comment_id } = req.params;
        const userId = req.user.id;

        const comment = await Comment.findByPk(comment_id);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Only author can delete
        if (comment.user_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Delete all replies first
        await Comment.destroy({
            where: { parent_comment_id: comment_id }
        });

        await comment.destroy();

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

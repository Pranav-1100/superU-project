const express = require('express');
const router = express.Router();
const { Content, ContentNode, ContentEdit, ActivityLog } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const contentService = require('../services/contentService');
const { Op } = require('sequelize');

// Scrape and create content
router.post('/scrape', authMiddleware, validate(schemas.scrapeContent), async (req, res) => {
    try {
        const { url, team_id } = req.body;
        const userId = req.user.id;

        console.log(`User ${userId} attempting to scrape ${url}`);

        const hasPermission = await checkTeamPermissions(userId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const contentId = await contentService.createContent(team_id, url);
        if (!contentId) {
            return res.status(500).json({ error: 'Failed to scrape content' });
        }

        const content = await Content.findByPk(contentId);
        console.log(`Successfully created content with ID: ${contentId}`);

        // Log activity
        await ActivityLog.logActivity(
            team_id,
            userId,
            'content_created',
            'content',
            contentId,
            { title: content.title, url: content.url }
        );

        res.status(201).json({
            message: 'Content scraped successfully',
            content_id: contentId,
            title: content.title,
            url: content.url
        });
    } catch (error) {
        console.error('Error scraping content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get content and structure
router.get('/:content_id', authMiddleware, async (req, res) => {
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

        const rootNode = await ContentNode.findOne({
            where: {
                content_id,
                parent_id: null
            }
        });

        res.json({
            content: {
                id: content.id,
                title: content.title,
                url: content.url,
                team_id: content.team_id,
                meta: content.meta,
                tree: rootNode ? rootNode.toJSON() : null,
                created_at: content.created_at,
                updated_at: content.updated_at
            }
        });
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get node content - FIXED: Added proper JSON.parse error handling
router.get('/node/:node_id', authMiddleware, async (req, res) => {
    try {
        const { node_id } = req.params;
        const userId = req.user.id;
        const includeHistory = req.query.history === 'true';

        const node = await ContentNode.findByPk(node_id, {
            include: [{
                model: Content,
                attributes: ['team_id', 'current_content']
            }]
        });

        if (!node) {
            return res.status(404).json({ error: 'Node not found' });
        }

        const hasPermission = await checkTeamPermissions(userId, node.Content.team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // FIXED: Safe JSON parsing with try-catch
        let currentContentData = {};
        try {
            currentContentData = JSON.parse(node.Content.current_content);
        } catch (parseError) {
            console.error('Error parsing content JSON:', parseError);
            return res.status(500).json({
                error: 'Content data is corrupted',
                code: 'content_parse_error'
            });
        }

        const nodeData = {
            id: node.id,
            title: node.title,
            content: currentContentData[node.title]?.content || '',
            type: node.node_type,
            level: node.level
        };

        if (includeHistory) {
            const edits = await ContentEdit.findAll({
                where: { node_id },
                order: [['created_at', 'DESC']],
                limit: 50 // Limit history to prevent large responses
            });
            nodeData.history = edits.map(edit => edit.toJSON());
        }

        res.json({ node: nodeData });
    } catch (error) {
        console.error('Error fetching node content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update node content - FIXED: Added proper JSON.parse error handling
router.put('/node/:node_id', authMiddleware, validate(schemas.updateNode), async (req, res) => {
    try {
        const { node_id } = req.params;
        const { content: newContent } = req.body;
        const userId = req.user.id;

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

        // FIXED: Safe JSON parsing
        let currentData = {};
        try {
            currentData = JSON.parse(node.Content.current_content);
        } catch (parseError) {
            console.error('Error parsing content JSON:', parseError);
            return res.status(500).json({
                error: 'Content data is corrupted',
                code: 'content_parse_error'
            });
        }

        // Create edit history
        await ContentEdit.create({
            content_id: node.content_id,
            node_id,
            user_id: userId,
            previous_content: currentData[node.title]?.content || '',
            new_content: newContent
        });

        // Update content
        if (!currentData[node.title]) {
            currentData[node.title] = {};
        }
        currentData[node.title].content = newContent;

        // Save updated content
        await node.Content.update({
            current_content: JSON.stringify(currentData),
            updated_at: new Date()
        });

        // Emit socket event if io is available
        const io = req.app.get('io');
        if (io) {
            io.to(`content_${node.content_id}`).emit('content_updated', {
                node_id,
                content: newContent,
                user_id: userId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            message: 'Content updated successfully',
            node_id
        });
    } catch (error) {
        console.error('Error updating content:', error);
        res.status(500).json({ error: error.message });
    }
});

// List team content
router.get('/team/:team_id', authMiddleware, async (req, res) => {
    try {
        const { team_id } = req.params;
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
        const offset = (page - 1) * limit;

        const hasPermission = await checkTeamPermissions(userId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { count, rows: contentList } = await Content.findAndCountAll({
            where: { team_id },
            attributes: ['id', 'title', 'url', 'created_at', 'updated_at', 'meta'],
            order: [['updated_at', 'DESC']],
            limit,
            offset
        });

        res.json({
            content: contentList.map(content => ({
                id: content.id,
                title: content.title,
                url: content.url,
                created_at: content.created_at,
                updated_at: content.updated_at,
                meta: content.meta
            })),
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error listing content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get content history
router.get('/history/:node_id', authMiddleware, async (req, res) => {
    try {
        const { node_id } = req.params;
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

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

        const { count, rows: edits } = await ContentEdit.findAndCountAll({
            where: { node_id },
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        res.json({
            history: edits.map(edit => edit.toJSON()),
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching content history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Search content - FIXED: SQL injection prevention
router.get('/search/:team_id', authMiddleware, async (req, res) => {
    try {
        const { team_id } = req.params;
        const query = req.query.q;
        const userId = req.user.id;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Sanitize query - remove special SQL characters
        const sanitizedQuery = query.trim().substring(0, 200);

        const hasPermission = await checkTeamPermissions(userId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // FIXED: Use parameterized query to prevent SQL injection
        const results = await Content.findAll({
            where: {
                team_id,
                [Op.or]: [
                    { title: { [Op.like]: `%${sanitizedQuery}%` } },
                    { current_content: { [Op.like]: `%${sanitizedQuery}%` } }
                ]
            },
            attributes: ['id', 'title', 'url', 'updated_at'],
            limit: 50 // Limit results
        });

        res.json({
            results: results.map(content => ({
                id: content.id,
                title: content.title,
                url: content.url,
                updated_at: content.updated_at
            })),
            query: sanitizedQuery
        });
    } catch (error) {
        console.error('Error searching content:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

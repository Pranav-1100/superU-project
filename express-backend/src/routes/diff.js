const express = require('express');
const router = express.Router();
const { ContentEdit, ContentNode, Content } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');
const diff = require('diff');

// Compare two specific edits
router.get('/compare/:edit1_id/:edit2_id', authMiddleware, async (req, res) => {
    try {
        const { edit1_id, edit2_id } = req.params;
        const userId = req.user.id;
        const format = req.query.format || 'json'; // json, html, unified

        const edit1 = await ContentEdit.findByPk(edit1_id, {
            include: [{
                model: ContentNode,
                include: [{ model: Content }]
            }]
        });

        const edit2 = await ContentEdit.findByPk(edit2_id, {
            include: [{
                model: ContentNode,
                include: [{ model: Content }]
            }]
        });

        if (!edit1 || !edit2) {
            return res.status(404).json({ error: 'One or both edits not found' });
        }

        // Check permissions
        const hasPermission = await checkTeamPermissions(
            userId,
            edit1.ContentNode.Content.team_id
        );
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Make sure both edits are for the same node
        if (edit1.node_id !== edit2.node_id) {
            return res.status(400).json({ error: 'Edits must be from the same content node' });
        }

        // Generate diff
        const differences = diff.diffWords(edit1.new_content, edit2.new_content);

        if (format === 'html') {
            let html = '';
            differences.forEach(part => {
                const color = part.added ? 'green' :
                              part.removed ? 'red' : 'grey';
                const decoration = part.added ? 'background-color: #c6f6d5;' :
                                   part.removed ? 'background-color: #fed7d7; text-decoration: line-through;' : '';
                html += `<span style="color: ${color}; ${decoration}">${part.value}</span>`;
            });
            return res.send(html);
        } else if (format === 'unified') {
            const patch = diff.createPatch(
                'content',
                edit1.new_content,
                edit2.new_content,
                `Edit ${edit1.id}`,
                `Edit ${edit2.id}`
            );
            return res.type('text/plain').send(patch);
        }

        // Default JSON format
        res.json({
            edit1: {
                id: edit1.id,
                created_at: edit1.created_at,
                user_id: edit1.user_id
            },
            edit2: {
                id: edit2.id,
                created_at: edit2.created_at,
                user_id: edit2.user_id
            },
            differences: differences.map(part => ({
                value: part.value,
                added: part.added || false,
                removed: part.removed || false
            })),
            stats: {
                additions: differences.filter(p => p.added).reduce((sum, p) => sum + p.value.length, 0),
                deletions: differences.filter(p => p.removed).reduce((sum, p) => sum + p.value.length, 0),
                unchanged: differences.filter(p => !p.added && !p.removed).reduce((sum, p) => sum + p.value.length, 0)
            }
        });
    } catch (error) {
        console.error('Error comparing edits:', error);
        res.status(500).json({ error: error.message });
    }
});

// Compare current content with a previous edit
router.get('/compare-current/:node_id/:edit_id', authMiddleware, async (req, res) => {
    try {
        const { node_id, edit_id } = req.params;
        const userId = req.user.id;
        const format = req.query.format || 'json';

        const node = await ContentNode.findByPk(node_id, {
            include: [{ model: Content }]
        });

        const edit = await ContentEdit.findByPk(edit_id);

        if (!node || !edit) {
            return res.status(404).json({ error: 'Node or edit not found' });
        }

        const hasPermission = await checkTeamPermissions(userId, node.Content.team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get current content
        let currentData = {};
        try {
            currentData = JSON.parse(node.Content.current_content);
        } catch (e) {
            currentData = {};
        }

        const currentContent = currentData[node.title]?.content || '';

        // Generate diff
        const differences = diff.diffWords(edit.new_content, currentContent);

        if (format === 'html') {
            let html = '';
            differences.forEach(part => {
                const color = part.added ? 'green' :
                              part.removed ? 'red' : 'grey';
                const decoration = part.added ? 'background-color: #c6f6d5;' :
                                   part.removed ? 'background-color: #fed7d7; text-decoration: line-through;' : '';
                html += `<span style="color: ${color}; ${decoration}">${part.value}</span>`;
            });
            return res.send(html);
        }

        res.json({
            old_version: {
                edit_id: edit.id,
                created_at: edit.created_at,
                user_id: edit.user_id
            },
            current_version: {
                node_id: node.id,
                updated_at: node.Content.updated_at
            },
            differences: differences.map(part => ({
                value: part.value,
                added: part.added || false,
                removed: part.removed || false
            })),
            stats: {
                additions: differences.filter(p => p.added).reduce((sum, p) => sum + p.value.length, 0),
                deletions: differences.filter(p => p.removed).reduce((sum, p) => sum + p.value.length, 0)
            }
        });
    } catch (error) {
        console.error('Error comparing with current:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get diff statistics for a node over time
router.get('/stats/:node_id', authMiddleware, async (req, res) => {
    try {
        const { node_id } = req.params;
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

        const edits = await ContentEdit.findAll({
            where: { node_id },
            order: [['created_at', 'ASC']]
        });

        const stats = [];
        for (let i = 1; i < edits.length; i++) {
            const prev = edits[i - 1];
            const curr = edits[i];

            const differences = diff.diffWords(prev.new_content, curr.new_content);

            stats.push({
                edit_id: curr.id,
                user_id: curr.user_id,
                created_at: curr.created_at,
                additions: differences.filter(p => p.added).reduce((sum, p) => sum + p.value.length, 0),
                deletions: differences.filter(p => p.removed).reduce((sum, p) => sum + p.value.length, 0),
                net_change: differences.filter(p => p.added).reduce((sum, p) => sum + p.value.length, 0) -
                           differences.filter(p => p.removed).reduce((sum, p) => sum + p.value.length, 0)
            });
        }

        res.json({
            node_id,
            total_edits: edits.length,
            statistics: stats,
            summary: {
                total_additions: stats.reduce((sum, s) => sum + s.additions, 0),
                total_deletions: stats.reduce((sum, s) => sum + s.deletions, 0),
                net_growth: stats.reduce((sum, s) => sum + s.net_change, 0)
            }
        });
    } catch (error) {
        console.error('Error fetching diff stats:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { ContentTemplate, Content, ContentNode, Team } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');
const Joi = require('joi');

// Validation schema
const templateSchema = Joi.object({
    name: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(1000).optional(),
    structure: Joi.array().items(Joi.object()).required(),
    is_public: Joi.boolean().optional()
});

// Create template
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { team_id } = req.body;

        // Validate input
        const { error, value } = templateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details
            });
        }

        // Check team permissions
        const hasPermission = await checkTeamPermissions(userId, team_id, ['owner', 'admin']);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Only owners and admins can create templates' });
        }

        const template = await ContentTemplate.create({
            team_id,
            name: value.name,
            description: value.description,
            structure: value.structure,
            is_public: value.is_public || false,
            created_by: userId
        });

        res.status(201).json({
            message: 'Template created',
            template
        });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get templates for a team
router.get('/team/:team_id', authMiddleware, async (req, res) => {
    try {
        const { team_id } = req.params;
        const userId = req.user.id;

        const hasPermission = await checkTeamPermissions(userId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get team templates + public templates
        const templates = await ContentTemplate.findAll({
            where: {
                [require('sequelize').Op.or]: [
                    { team_id },
                    { is_public: true }
                ]
            },
            include: [{
                model: require('../models').User,
                as: 'creator',
                attributes: ['id', 'email']
            }],
            order: [['usage_count', 'DESC'], ['created_at', 'DESC']]
        });

        res.json({ templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get template by ID
router.get('/:template_id', authMiddleware, async (req, res) => {
    try {
        const { template_id } = req.params;
        const userId = req.user.id;

        const template = await ContentTemplate.findByPk(template_id, {
            include: [{
                model: require('../models').User,
                as: 'creator',
                attributes: ['id', 'email']
            }]
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Check if user has access (team member or public template)
        if (!template.is_public) {
            const hasPermission = await checkTeamPermissions(userId, template.team_id);
            if (!hasPermission) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        res.json({ template });
    } catch (error) {
        console.error('Error fetching template:', error);
        res.status(500).json({ error: error.message });
    }
});

// Use template to create content
router.post('/use/:template_id', authMiddleware, async (req, res) => {
    try {
        const { template_id } = req.params;
        const { team_id, title, url } = req.body;
        const userId = req.user.id;

        if (!team_id || !title) {
            return res.status(400).json({ error: 'team_id and title are required' });
        }

        const hasPermission = await checkTeamPermissions(userId, team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const template = await ContentTemplate.findByPk(template_id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Check template access
        if (!template.is_public && template.team_id !== team_id) {
            return res.status(403).json({ error: 'Template not accessible' });
        }

        // Create content from template
        const content = await Content.create({
            team_id,
            url: url || 'template://generated',
            title,
            original_content: JSON.stringify({}),
            current_content: JSON.stringify({}),
            meta: { created_from_template: template_id }
        });

        // Create root node
        const rootNode = await ContentNode.create({
            content_id: content.id,
            title,
            node_type: 'root',
            level: 0,
            order: 0
        });

        // Create structure from template
        const createNodes = async (structure, parentId = rootNode.id, level = 1) => {
            for (let i = 0; i < structure.length; i++) {
                const item = structure[i];
                const node = await ContentNode.create({
                    content_id: content.id,
                    parent_id: parentId,
                    title: item.title || `Section ${i + 1}`,
                    node_type: item.type || 'section',
                    level,
                    order: i
                });

                if (item.children && item.children.length > 0) {
                    await createNodes(item.children, node.id, level + 1);
                }
            }
        };

        await createNodes(template.structure);

        // Increment usage count
        template.usage_count += 1;
        await template.save();

        res.status(201).json({
            message: 'Content created from template',
            content_id: content.id,
            template_used: template.name
        });
    } catch (error) {
        console.error('Error using template:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update template
router.put('/:template_id', authMiddleware, async (req, res) => {
    try {
        const { template_id } = req.params;
        const userId = req.user.id;

        const template = await ContentTemplate.findByPk(template_id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Only creator or team owner/admin can update
        if (template.created_by !== userId) {
            const hasPermission = await checkTeamPermissions(
                userId,
                template.team_id,
                ['owner', 'admin']
            );
            if (!hasPermission) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        const { name, description, structure, is_public } = req.body;

        if (name) template.name = name;
        if (description !== undefined) template.description = description;
        if (structure) template.structure = structure;
        if (is_public !== undefined) template.is_public = is_public;

        await template.save();

        res.json({
            message: 'Template updated',
            template
        });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete template
router.delete('/:template_id', authMiddleware, async (req, res) => {
    try {
        const { template_id } = req.params;
        const userId = req.user.id;

        const template = await ContentTemplate.findByPk(template_id);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Only creator or team owner can delete
        if (template.created_by !== userId) {
            const hasPermission = await checkTeamPermissions(
                userId,
                template.team_id,
                ['owner']
            );
            if (!hasPermission) {
                return res.status(403).json({ error: 'Only the creator or team owner can delete templates' });
            }
        }

        await template.destroy();

        res.json({ message: 'Template deleted' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

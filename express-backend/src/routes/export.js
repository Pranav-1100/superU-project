const express = require('express');
const router = express.Router();
const { Content, ContentNode } = require('../models');
const { authMiddleware, checkTeamPermissions } = require('../middleware/auth');
const showdown = require('showdown');

// Export content as Markdown
router.get('/:content_id/markdown', authMiddleware, async (req, res) => {
    try {
        const { content_id } = req.params;
        const userId = req.user.id;

        const content = await Content.findByPk(content_id, {
            include: [{
                model: ContentNode,
                as: 'nodes'
            }]
        });

        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        const hasPermission = await checkTeamPermissions(userId, content.team_id);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get root node
        const rootNode = await ContentNode.findOne({
            where: {
                content_id,
                parent_id: null
            }
        });

        if (!rootNode) {
            return res.status(404).json({ error: 'Root node not found' });
        }

        // Parse current content
        let currentData = {};
        try {
            currentData = JSON.parse(content.current_content);
        } catch (e) {
            currentData = {};
        }

        // Build markdown recursively
        const buildMarkdown = async (nodeId, level = 0) => {
            const node = await ContentNode.findByPk(nodeId);
            if (!node) return '';

            const heading = '#'.repeat(Math.min(level + 1, 6));
            let markdown = level > 0 ? `\n${heading} ${node.title}\n\n` : `# ${content.title}\n\n`;

            // Add content if exists
            const nodeContent = currentData[node.title]?.content;
            if (nodeContent) {
                markdown += nodeContent + '\n\n';
            }

            // Get children
            const children = await ContentNode.findAll({
                where: { parent_id: nodeId },
                order: [['order', 'ASC']]
            });

            for (const child of children) {
                markdown += await buildMarkdown(child.id, level + 1);
            }

            return markdown;
        };

        const markdown = await buildMarkdown(rootNode.id);

        res.type('text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${content.title.replace(/[^a-z0-9]/gi, '_')}.md"`);
        res.send(markdown);
    } catch (error) {
        console.error('Error exporting to markdown:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export content as HTML
router.get('/:content_id/html', authMiddleware, async (req, res) => {
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

        // Get root node
        const rootNode = await ContentNode.findOne({
            where: {
                content_id,
                parent_id: null
            }
        });

        if (!rootNode) {
            return res.status(404).json({ error: 'Root node not found' });
        }

        // Parse current content
        let currentData = {};
        try {
            currentData = JSON.parse(content.current_content);
        } catch (e) {
            currentData = {};
        }

        // Build HTML recursively
        const buildHTML = async (nodeId, level = 0) => {
            const node = await ContentNode.findByPk(nodeId);
            if (!node) return '';

            const headingTag = `h${Math.min(level + 1, 6)}`;
            let html = level > 0 ? `<${headingTag}>${node.title}</${headingTag}>\n` : '';

            // Add content if exists
            const nodeContent = currentData[node.title]?.content;
            if (nodeContent) {
                // Convert markdown to HTML if needed
                const converter = new showdown.Converter();
                html += `<div class="content">${converter.makeHtml(nodeContent)}</div>\n`;
            }

            // Get children
            const children = await ContentNode.findAll({
                where: { parent_id: nodeId },
                order: [['order', 'ASC']]
            });

            if (children.length > 0) {
                html += '<div class="section">\n';
                for (const child of children) {
                    html += await buildHTML(child.id, level + 1);
                }
                html += '</div>\n';
            }

            return html;
        };

        const bodyContent = await buildHTML(rootNode.id);

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }
        h1 { font-size: 2.5em; }
        h2 { font-size: 2em; }
        h3 { font-size: 1.75em; }
        h4 { font-size: 1.5em; }
        .content {
            margin-bottom: 1.5em;
        }
        .section {
            margin-left: 20px;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        pre {
            background-color: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 15px;
            color: #666;
            margin: 1em 0;
        }
        .meta {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 2em;
        }
    </style>
</head>
<body>
    <h1>${content.title}</h1>
    <div class="meta">
        Source: <a href="${content.url}">${content.url}</a><br>
        Exported: ${new Date().toLocaleString()}
    </div>
    ${bodyContent}
</body>
</html>
        `;

        res.type('text/html');
        res.setHeader('Content-Disposition', `attachment; filename="${content.title.replace(/[^a-z0-9]/gi, '_')}.html"`);
        res.send(html);
    } catch (error) {
        console.error('Error exporting to HTML:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export content structure as JSON
router.get('/:content_id/json', authMiddleware, async (req, res) => {
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

        // Get root node with all children
        const rootNode = await ContentNode.findOne({
            where: {
                content_id,
                parent_id: null
            }
        });

        if (!rootNode) {
            return res.status(404).json({ error: 'Root node not found' });
        }

        // Parse current content
        let currentData = {};
        try {
            currentData = JSON.parse(content.current_content);
        } catch (e) {
            currentData = {};
        }

        // Build structure recursively
        const buildStructure = async (nodeId) => {
            const node = await ContentNode.findByPk(nodeId);
            if (!node) return null;

            const structure = {
                id: node.id,
                title: node.title,
                type: node.node_type,
                level: node.level,
                content: currentData[node.title]?.content || null,
                children: []
            };

            const children = await ContentNode.findAll({
                where: { parent_id: nodeId },
                order: [['order', 'ASC']]
            });

            for (const child of children) {
                const childStructure = await buildStructure(child.id);
                if (childStructure) {
                    structure.children.push(childStructure);
                }
            }

            return structure;
        };

        const structure = await buildStructure(rootNode.id);

        const exportData = {
            metadata: {
                id: content.id,
                title: content.title,
                url: content.url,
                created_at: content.created_at,
                updated_at: content.updated_at,
                exported_at: new Date().toISOString()
            },
            structure
        };

        res.type('application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${content.title.replace(/[^a-z0-9]/gi, '_')}.json"`);
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting to JSON:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

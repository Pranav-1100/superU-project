const axios = require('axios');
const cheerio = require('cheerio');
const { Content, ContentNode, ContentEdit } = require('../models');

class ContentService {
    constructor() {
        this.axios = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DocumentationBot/1.0)'
            }
        });
    }

    async scrapeUrl(url) {
        try {
            console.log(`Starting to scrape URL: ${url}`);
            const response = await this.axios.get(url, { timeout: 10000 });
            const $ = cheerio.load(response.data);

            // Remove unwanted elements
            $('script, style, iframe, nav, footer, header, noscript').remove();
            $('[style*="display: none"]').remove();

            // Extract content
            const title = this._extractTitle($);
            const content = this._extractContent($);
            const structure = this._extractStructure($);
            const meta = this._extractMeta($);

            return {
                title,
                content,
                structure,
                meta
            };
        } catch (error) {
            console.error(`Error scraping ${url}:`, error);
            return null;
        }
    }

    async createContent(teamId, url) {
        try {
            const scrapedData = await this.scrapeUrl(url);
            if (!scrapedData) {
                throw new Error('Failed to scrape content');
            }

            // Create base content record
            const content = await Content.create({
                team_id: teamId,
                url,
                title: scrapedData.title,
                original_content: JSON.stringify(scrapedData.content),
                current_content: JSON.stringify(scrapedData.content),
                meta: scrapedData.meta
            });

            // Create root node
            const rootNode = await ContentNode.create({
                content_id: content.id,
                title: scrapedData.title,
                node_type: 'root',
                level: 0,
                order: 0
            });

            // Create structure nodes
            await this._createFileTree(content.id, scrapedData.structure, rootNode.id);

            return content.id;
        } catch (error) {
            console.error('Error creating content:', error);
            throw error;
        }
    }

    // Helper methods for content extraction and processing
    _extractTitle($) {
        return $('h1').first().text() || $('title').text() || 'Untitled Document';
    }

    _extractContent($) {
        const mainContent = $('main').first() || $('article').first() || $('div[class*="content"], div[class*="main"]').first();
        return this._structureContent(mainContent);
    }

    _structureContent($element) {
        const structured = {};
        let currentSection = null;
        let buffer = [];

        $element.children().each((i, el) => {
            const $el = $(el);
            if ($el.is('h1, h2, h3, h4, h5, h6')) {
                if (currentSection && buffer.length) {
                    structured[currentSection] = {
                        content: buffer.join(''),
                        type: 'section'
                    };
                    buffer = [];
                }
                currentSection = $el.text().trim();
                structured[currentSection] = { content: '', type: 'section' };
            } else if (currentSection) {
                buffer.push($el.toString());
            }
        });

        if (currentSection && buffer.length) {
            structured[currentSection].content = buffer.join('');
        }

        return structured;
    }

    async _createFileTree(contentId, structure, parentId = null, order = 0) {
        for (const item of structure) {
            const node = await ContentNode.create({
                content_id: contentId,
                parent_id: parentId,
                title: item.title,
                node_type: 'section',
                level: item.level,
                order: order++
            });

            if (item.children?.length) {
                await this._createFileTree(contentId, item.children, node.id, 0);
            }
        }
    }
}

module.exports = new ContentService();

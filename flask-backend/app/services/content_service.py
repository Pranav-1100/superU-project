import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re
from .. import db
from ..models import Content, ContentNode, ContentEdit
from datetime import datetime
import json

class ContentManager:
    def __init__(self):
        self.scraper = WebScraper()

        
    def create_content(self, team_id, url):
        """Create new content from URL"""
        try:
            scraped_data = self.scraper.scrape_url(url)
            if not scraped_data:
                raise ValueError("Failed to scrape content")

            # Create base content record
            content = Content(
                team_id=team_id,
                url=url,
                title=scraped_data['title'],
                original_content=json.dumps(scraped_data['content']),
                current_content=json.dumps(scraped_data['content']),
                meta=scraped_data.get('meta', {}),
                created_at=datetime.utcnow()
            )
            db.session.add(content)
            db.session.flush()

            # Create root node
            root_node = ContentNode(
                content_id=content.id,
                title=scraped_data['title'],
                node_type='root',
                level=0,
                order=0
            )
            db.session.add(root_node)
            db.session.flush()

            # Create structure nodes
            self._create_file_tree(content.id, scraped_data['structure'], root_node.id)
            
            db.session.commit()
            return content.id
            
        except Exception as e:
            db.session.rollback()
            print(f"Error creating content: {str(e)}")
            raise

    def _create_file_tree(self, content_id, structure, parent_id=None, order=0):
        """Recursively create file tree nodes"""
        for item in structure:
            node = ContentNode(
                content_id=content_id,
                parent_id=parent_id,
                title=item['title'],
                node_type='section',
                level=item['level'],
                order=order
            )
            db.session.add(node)
            db.session.flush()
            
            if item.get('children'):
                self._create_file_tree(content_id, item['children'], node.id, 0)
            order += 1

    def update_content(self, content_id, node_id, new_content, user_id):
        """Update content with version control"""
        try:
            node = ContentNode.query.get(node_id)
            if not node:
                raise ValueError("Node not found")

            content = Content.query.get(content_id)
            if not content:
                raise ValueError("Content not found")

            current_data = json.loads(content.current_content)

            # Store previous content for version control
            edit = ContentEdit(
                content_id=content_id,
                node_id=node_id,
                user_id=user_id,
                previous_content=current_data.get(node.title, {}).get('content', ''),
                new_content=new_content,
                created_at=datetime.utcnow()
            )
            db.session.add(edit)

            # Update content
            if node.title not in current_data:
                current_data[node.title] = {}
            current_data[node.title]['content'] = new_content
            content.current_content = json.dumps(current_data)
            content.updated_at = datetime.utcnow()
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Error updating content: {str(e)}")
            raise

    def get_node_content(self, node_id, include_history=False):
        """Get node content with optional history"""
        try:
            node = ContentNode.query.get(node_id)
            if not node:
                return None

            content = Content.query.get(node.content_id)
            if not content:
                return None

            content_data = json.loads(content.current_content)
            node_content = content_data.get(node.title, {}).get('content', '')

            result = {
                'id': node.id,
                'title': node.title,
                'content': node_content,
                'type': node.node_type,
                'level': node.level
            }

            if include_history:
                edits = ContentEdit.query.filter_by(node_id=node_id)\
                    .order_by(ContentEdit.created_at.desc())\
                    .all()
                result['history'] = [edit.to_dict() for edit in edits]

            return result

        except Exception as e:
            print(f"Error fetching node content: {str(e)}")
            return None


    def _find_section_content(self, content_data, node):
        """Find specific section content from the full content"""
        # Implementation depends on how content is structured
        # This is a placeholder for the actual implementation
        return content_data.get(node.title, "")

class WebScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; DocumentationBot/1.0)'
        })

    def scrape_url(self, url):
        """Scrape content from URL"""
        try:
            print(f"Starting to scrape URL: {url}")
            response = self.session.get(url, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')
            print("Successfully fetched page content")

            # Clean up the HTML
            self._remove_unwanted_elements(soup)

            # Extract content
            title = self._extract_title(soup)
            content = self._extract_content(soup)
            structure = self._extract_structure(soup)
            meta = self._extract_meta(soup)

            print(f"Extracted Title: {title}")
            print(f"Found {len(structure)} main sections")

            return {
                'title': title,
                'content': content,
                'structure': structure,
                'meta': meta
            }
        except Exception as e:
            print(f"Error scraping {url}: {str(e)}")
            return None

    def _remove_unwanted_elements(self, soup):
        """Remove unwanted elements from HTML"""
        unwanted = ['script', 'style', 'iframe', 'nav', 'footer', 'header', 'noscript']
        for tag in unwanted:
            for element in soup.find_all(tag):
                element.decompose()
        
        # Remove hidden elements
        for element in soup.find_all(style=re.compile(r'display:\s*none')):
            element.decompose()

    def _extract_title(self, soup):
        """Extract page title"""
        if h1 := soup.find('h1'):
            return h1.get_text(strip=True)
        if title := soup.find('title'):
            return title.get_text(strip=True)
        return "Untitled Document"

    def _extract_content(self, soup):
        """Extract main content"""
        main_content = (
            soup.find('main') or 
            soup.find('article') or 
            soup.find('div', class_=re.compile(r'content|main|docs|documentation', re.I))
        )
        
        if not main_content:
            print("Warning: No main content found")
            return {}

        return self._structure_content(main_content)

    def _structure_content(self, content):
        """Convert HTML content to structured format"""
        structured = {}
        current_section = None
        buffer = []
        
        for element in content.children:
            if not element.name:  # Skip text nodes
                continue
                
            if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                # Save previous section
                if current_section and buffer:
                    structured[current_section]['content'] = ''.join(str(b) for b in buffer)
                    buffer = []
                
                current_section = element.get_text(strip=True)
                structured[current_section] = {'content': '', 'type': 'section'}
            elif current_section:
                buffer.append(element)
            
        # Save last section
        if current_section and buffer:
            structured[current_section]['content'] = ''.join(str(b) for b in buffer)
        
        return structured

    def _extract_structure(self, soup):
        """Extract document structure"""
        structure = []
        headers = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        current_path = [None] * 6
        
        for header in headers:
            level = int(header.name[1]) - 1
            title = header.get_text(strip=True)
            
            node = {
                'title': title,
                'level': level,
                'children': []
            }
            
            if level == 0:
                structure.append(node)
            else:
                # Find appropriate parent
                parent_level = level - 1
                while parent_level >= 0:
                    if current_path[parent_level]:
                        current_path[parent_level]['children'].append(node)
                        break
                    parent_level -= 1
                if parent_level < 0:
                    structure.append(node)
            
            current_path[level] = node
            # Reset deeper levels
            for i in range(level + 1, 6):
                current_path[i] = None
        
        return structure

    def _extract_meta(self, soup):
        """Extract meta information"""
        meta = {}
        
        # Description
        if desc := soup.find('meta', {'name': 'description'}):
            meta['description'] = desc.get('content', '')
        
        # Keywords
        if keywords := soup.find('meta', {'name': 'keywords'}):
            meta['keywords'] = [k.strip() for k in keywords.get('content', '').split(',')]
        
        # Author
        if author := soup.find('meta', {'name': 'author'}):
            meta['author'] = author.get('content', '')
        
        # Add more metadata as needed
        meta['last_scraped'] = datetime.utcnow().isoformat()
        
        return meta
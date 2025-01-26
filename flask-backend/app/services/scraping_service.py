import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re
from ..models import db, Content, ContentNode
from datetime import datetime

class WebScraper:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })

    def fetch_page(self, url):
        """Fetch page content with error handling"""
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Error fetching {url}: {str(e)}")
            return None

    def parse_content(self, html):
        """Parse HTML and extract structured content"""
        if not html:
            return None

        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted elements
        for element in soup.find_all(['script', 'style', 'nav', 'footer']):
            element.decompose()

        # Extract main content
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile(r'content|main|docs', re.I))
        
        if not main_content:
            return None

        # Extract structure
        structure = self._extract_structure(main_content)
        
        return {
            'title': self._extract_title(soup),
            'content': str(main_content),
            'structure': structure,
            'meta': self._extract_meta(soup)
        }

    def _extract_title(self, soup):
        """Extract page title"""
        title = soup.find('h1')
        if title:
            return title.get_text(strip=True)
        return soup.title.string if soup.title else "Untitled"

    def _extract_meta(self, soup):
        """Extract meta information"""
        meta = {}
        
        # Get meta description
        desc_tag = soup.find('meta', attrs={'name': 'description'})
        if desc_tag:
            meta['description'] = desc_tag.get('content', '')

        # Get keywords
        keywords_tag = soup.find('meta', attrs={'name': 'keywords'})
        if keywords_tag:
            meta['keywords'] = keywords_tag.get('content', '').split(',')

        return meta

    def _extract_structure(self, content):
        """Extract content structure (headers and sections)"""
        structure = []
        current_section = None

        for element in content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            level = int(element.name[1])
            title = element.get_text(strip=True)
            
            section = {
                'title': title,
                'level': level,
                'id': element.get('id', ''),
                'children': []
            }

            # Find the appropriate parent based on header level
            if not structure or level <= structure[-1]['level']:
                structure.append(section)
            else:
                parent = structure[-1]
                while parent['children'] and parent['children'][-1]['level'] < level:
                    parent = parent['children'][-1]
                parent['children'].append(section)

        return structure

def create_content_nodes(team_id, url, parsed_content):
    """Create content nodes in the database"""
    try:
        # Create root content
        root_content = Content(
            team_id=team_id,
            url=url,
            title=parsed_content['title'],
            content=parsed_content['content'],
            meta=parsed_content['meta'],
            created_at=datetime.utcnow()
        )
        db.session.add(root_content)
        db.session.flush()  # Get the ID without committing

        # Create the root node
        root_node = ContentNode(
            content_id=root_content.id,
            title=parsed_content['title'],
            node_type='root',
            level=0
        )
        db.session.add(root_node)

        # Create child nodes from structure
        def create_child_nodes(parent_node, children, level):
            for child in children:
                child_node = ContentNode(
                    content_id=root_content.id,
                    parent_id=parent_node.id,
                    title=child['title'],
                    node_type='section',
                    level=level
                )
                db.session.add(child_node)
                db.session.flush()
                
                if child.get('children'):
                    create_child_nodes(child_node, child['children'], level + 1)

        create_child_nodes(root_node, parsed_content['structure'], 1)
        db.session.commit()
        
        return root_content.id

    except Exception as e:
        db.session.rollback()
        print(f"Error creating content nodes: {str(e)}")
        raise


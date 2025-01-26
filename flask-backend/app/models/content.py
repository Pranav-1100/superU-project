from . import db
from datetime import datetime
import uuid

class Content(db.Model):
    """Main content model"""
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = db.Column(db.String(36), db.ForeignKey('team.id'), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    original_content = db.Column(db.Text, nullable=False)  # Original scraped content
    current_content = db.Column(db.Text, nullable=False)   # Current edited content
    meta = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    nodes = db.relationship('ContentNode', backref='content', lazy=True)
    edits = db.relationship('ContentEdit', backref='content', lazy=True)

class ContentNode(db.Model):
    """File tree node"""
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    content_id = db.Column(db.String(36), db.ForeignKey('content.id'), nullable=False)
    parent_id = db.Column(db.String(36), db.ForeignKey('content_node.id'))
    title = db.Column(db.String(200), nullable=False)
    node_type = db.Column(db.String(50), nullable=False)  # 'section', 'subsection'
    level = db.Column(db.Integer, nullable=False)
    order = db.Column(db.Integer, default=0)
    
    children = db.relationship(
        'ContentNode',
        backref=db.backref('parent', remote_side=[id]),
        lazy='joined',
        order_by='ContentNode.order'
    )
    edits = db.relationship('ContentEdit', backref='node', lazy=True)

    def to_dict(self, include_content=False):
        """Convert node to dictionary"""
        data = {
            'id': self.id,
            'title': self.title,
            'type': self.node_type,
            'level': self.level,
            'children': [child.to_dict(include_content) for child in self.children]
        }
        if include_content:
            data['content'] = self.content.current_content
        return data

class ContentEdit(db.Model):
    """Content edit history"""
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    content_id = db.Column(db.String(36), db.ForeignKey('content.id'), nullable=False)
    node_id = db.Column(db.String(36), db.ForeignKey('content_node.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    previous_content = db.Column(db.Text, nullable=False)
    new_content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert edit to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat(),
            'has_changes': self.previous_content != self.new_content
        }


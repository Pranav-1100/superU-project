from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit, join_room, leave_room
from ..services.content_service import ContentManager
from ..models import Team, Content, ContentNode, ContentEdit, db
from ..routes.team import check_team_permissions

content_bp = Blueprint('content', __name__)
content_manager = ContentManager()

@content_bp.route('/content/scrape', methods=['POST'])
@jwt_required()
def scrape_content():
    """Scrape and create content from URL"""
    try:
        data = request.get_json()
        if not data or 'url' not in data or 'team_id' not in data:
            return jsonify({'error': 'URL and team_id are required'}), 400

        user_id = get_jwt_identity()
        print(f"User {user_id} attempting to scrape {data['url']}")
        
        if not check_team_permissions(user_id, data['team_id']):
            return jsonify({'error': 'Unauthorized'}), 403

        content_id = content_manager.create_content(data['team_id'], data['url'])
        if not content_id:
            return jsonify({'error': 'Failed to scrape content'}), 500
        
        content = Content.query.get(content_id)
        if not content:
            return jsonify({'error': 'Content creation failed'}), 500
            
        print(f"Successfully created content with ID: {content_id}")
        
        return jsonify({
            'message': 'Content scraped successfully',
            'content_id': content_id,
            'title': content.title,
            'url': content.url
        }), 201

    except Exception as e:
        print(f"Error scraping content: {str(e)}")
        return jsonify({'error': str(e)}), 500

@content_bp.route('/content/<content_id>', methods=['GET'])
@jwt_required()
def get_content(content_id):
    """Get content and its structure"""
    try:
        user_id = get_jwt_identity()
        content = Content.query.get_or_404(content_id)
        
        if not check_team_permissions(user_id, content.team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        root_node = ContentNode.query.filter_by(
            content_id=content_id,
            parent_id=None
        ).first()

        return jsonify({
            'content': {
                'id': content.id,
                'title': content.title,
                'url': content.url,
                'team_id': content.team_id,
                'meta': content.meta,
                'tree': root_node.to_dict() if root_node else None,
                'created_at': content.created_at.isoformat(),
                'updated_at': content.updated_at.isoformat()
            }
        }), 200

    except Exception as e:
        print(f"Error fetching content: {str(e)}")
        return jsonify({'error': str(e)}), 500

@content_bp.route('/content/node/<node_id>', methods=['GET'])
@jwt_required()
def get_node_content(node_id):
    """Get node content with optional history"""
    try:
        user_id = get_jwt_identity()
        node = ContentNode.query.get_or_404(node_id)
        
        if not check_team_permissions(user_id, node.content.team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        include_history = request.args.get('history', '').lower() == 'true'
        node_data = content_manager.get_node_content(node_id, include_history)
        
        return jsonify({'node': node_data}), 200

    except Exception as e:
        print(f"Error fetching node content: {str(e)}")
        return jsonify({'error': str(e)}), 500

@content_bp.route('/content/node/<node_id>', methods=['PUT'])
@jwt_required()
def update_node_content(node_id):
    """Update node content and notify collaborators"""
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'Content is required'}), 400

        user_id = get_jwt_identity()
        node = ContentNode.query.get_or_404(node_id)
        
        if not check_team_permissions(user_id, node.content.team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        # Update content
        success = content_manager.update_content(
            node.content_id,
            node_id,
            data['content'],
            user_id
        )
        
        if success:
            # Emit update event to all users in the room
            room = f"content_{node.content_id}"
            emit('content_updated', {
                'node_id': node_id,
                'content': data['content'],
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat()
            }, room=room)
            
            return jsonify({
                'message': 'Content updated successfully',
                'node_id': node_id
            }), 200
        
        return jsonify({'error': 'Failed to update content'}), 500

    except Exception as e:
        print(f"Error updating content: {str(e)}")
        return jsonify({'error': str(e)}), 500

@content_bp.route('/content/team/<team_id>', methods=['GET'])
@jwt_required()
def list_team_content(team_id):
    """List all team content"""
    try:
        user_id = get_jwt_identity()
        
        if not check_team_permissions(user_id, team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        content_list = Content.query.filter_by(team_id=team_id).all()
        
        return jsonify({
            'content': [{
                'id': content.id,
                'title': content.title,
                'url': content.url,
                'created_at': content.created_at.isoformat(),
                'updated_at': content.updated_at.isoformat(),
                'meta': content.meta
            } for content in content_list]
        }), 200

    except Exception as e:
        print(f"Error listing content: {str(e)}")
        return jsonify({'error': str(e)}), 500

@content_bp.route('/content/history/<node_id>', methods=['GET'])
@jwt_required()
def get_content_history(node_id):
    """Get node edit history"""
    try:
        user_id = get_jwt_identity()
        node = ContentNode.query.get_or_404(node_id)
        
        if not check_team_permissions(user_id, node.content.team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        edits = ContentEdit.query.filter_by(node_id=node_id)\
            .order_by(ContentEdit.created_at.desc())\
            .all()
            
        return jsonify({
            'history': [edit.to_dict() for edit in edits]
        }), 200

    except Exception as e:
        print(f"Error fetching content history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@content_bp.route('/content/search/<team_id>', methods=['GET'])
@jwt_required()
def search_content(team_id):
    """Search team content"""
    try:
        user_id = get_jwt_identity()
        if not check_team_permissions(user_id, team_id):
            return jsonify({'error': 'Unauthorized'}), 403

        query = request.args.get('q', '')
        if not query:
            return jsonify({'error': 'Search query is required'}), 400

        # Search in content titles and content
        results = Content.query.filter(
            Content.team_id == team_id,
            (Content.title.ilike(f'%{query}%') | 
             Content.current_content.ilike(f'%{query}%'))
        ).all()

        return jsonify({
            'results': [{
                'id': content.id,
                'title': content.title,
                'url': content.url,
                'updated_at': content.updated_at.isoformat()
            } for content in results]
        }), 200

    except Exception as e:
        print(f"Error searching content: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Socket.IO event handlers
def handle_socket_events(socketio):
    @socketio.on('join')
    def handle_join(data):
        """Handle user joining a content room"""
        content_id = data.get('content_id')
        user_id = data.get('user_id')
        if not content_id:
            return
            
        room = f"content_{content_id}"
        join_room(room)
        print(f"User {user_id} joined room: {room}")
        
        # Notify others in the room
        emit('user_joined', {
            'user_id': user_id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room, include_self=False)

    @socketio.on('leave')
    def handle_leave(data):
        """Handle user leaving a content room"""
        content_id = data.get('content_id')
        user_id = data.get('user_id')
        if not content_id:
            return
            
        room = f"content_{content_id}"
        leave_room(room)
        print(f"User {user_id} left room: {room}")
        
        # Notify others in the room
        emit('user_left', {
            'user_id': user_id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room, include_self=False)

    @socketio.on('cursor_move')
    def handle_cursor_move(data):
        """Handle user cursor movement"""
        content_id = data.get('content_id')
        user_id = data.get('user_id')
        if not content_id:
            return
            
        room = f"content_{content_id}"
        emit('cursor_update', {
            'user_id': user_id,
            'position': data.get('position'),
            'timestamp': datetime.utcnow().isoformat()
        }, room=room, skip_sid=request.sid)  # Skip sender

    @socketio.on('typing')
    def handle_typing(data):
        """Handle user typing indicator"""
        content_id = data.get('content_id')
        user_id = data.get('user_id')
        node_id = data.get('node_id')
        if not all([content_id, user_id, node_id]):
            return
            
        room = f"content_{content_id}"
        emit('user_typing', {
            'user_id': user_id,
            'node_id': node_id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room, skip_sid=request.sid)



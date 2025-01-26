from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from ..models import User, Team, TeamMember, Invitation, Content, ContentEdit, db
from datetime import timedelta

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        # Debug log
        print("Received login request")
        print("Request data:", request.get_data())
        
        data = request.get_json()
        
        # Validate request data
        if not data:
            print("No JSON data received")
            return jsonify({'error': 'No data provided'}), 400
            
        print("Received data:", data)  # Debug log
        
        # Check required fields
        if 'email' not in data or 'password' not in data:
            print("Missing email or password")
            return jsonify({'error': 'Email and password are required'}), 400
            
        # Find user
        user = User.query.filter_by(email=data['email']).first()
        print(f"Found user: {user}")  # Debug log
        
        if not user:
            print("User not found")
            return jsonify({'error': 'Invalid credentials'}), 401
            
        # Check password
        if not user.check_password(data['password']):
            print("Invalid password")
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'token': access_token,
            'user_id': user.id,
            'email': user.email
        }), 200
        
    except Exception as e:
        print(f"Login error: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate request data
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        if 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Email and password are required'}), 400
            
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 400
            
        user = User(email=data['email'])
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        access_token = create_access_token(identity=user.id)
        return jsonify({
            'token': access_token, 
            'user_id': user.id,
            'email': user.email
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Register error: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/user/info', methods=['GET'])
@jwt_required()
def get_user_info():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get all teams where user is a member
        team_memberships = TeamMember.query.filter_by(user_id=user_id).all()
        
        teams_info = []
        for membership in team_memberships:
            team = Team.query.get(membership.team_id)
            if team:
                # Get active content/work in this team
                active_content = Content.query.filter_by(
                    team_id=team.id
                ).order_by(Content.updated_at.desc()).limit(5).all()

                teams_info.append({
                    'team_id': team.id,
                    'team_name': team.name,
                    'role': membership.role,
                    'joined_at': membership.joined_at.isoformat(),
                    'is_owner': team.owner_id == user_id,
                    'recent_activity': [{
                        'content_id': content.id,
                        'title': content.title,
                        'updated_at': content.updated_at.isoformat()
                    } for content in active_content]
                })

        # Get pending invitations
        pending_invites = Invitation.query.filter_by(
            email=user.email,
            status='pending'
        ).all()

        # Get user's recent edits
        recent_edits = ContentEdit.query.filter_by(
            user_id=user_id
        ).order_by(ContentEdit.created_at.desc()).limit(10).all()

        return jsonify({
            'user': {
                'id': user.id,
                'email': user.email,
                'created_at': user.created_at.isoformat(),
                'status': user.status,
                'teams_count': len(teams_info)
            },
            'teams': teams_info,
            'pending_invitations': [{
                'team_id': invite.team_id,
                'role': invite.role,
                'invite_code': invite.invite_code,
                'expires_at': invite.expires_at.isoformat()
            } for invite in pending_invites],
            'recent_activity': [{
                'content_id': edit.content_id,
                'node_id': edit.node_id,
                'created_at': edit.created_at.isoformat(),
                'has_changes': edit.previous_content != edit.new_content
            } for edit in recent_edits]
        }), 200

    except Exception as e:
        print(f"Error fetching user info: {str(e)}")
        return jsonify({'error': str(e)}), 500
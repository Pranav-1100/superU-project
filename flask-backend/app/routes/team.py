from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import Team, TeamMember, Invitation, User, db
from datetime import datetime, timedelta
import uuid

team_bp = Blueprint('team', __name__)

def check_team_permissions(user_id, team_id, required_roles=None):
    """Check if user has required permissions for team operations"""
    member = TeamMember.query.filter_by(
        team_id=team_id,
        user_id=user_id
    ).first()
    
    if not member:
        return False
        
    if required_roles and member.role not in required_roles:
        return False
        
    return True

@team_bp.route('/team/create', methods=['POST'])
@jwt_required()
def create_team():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # First create and commit the team
        team = Team(
            name=data['name'],
            owner_id=user_id
        )
        db.session.add(team)
        db.session.flush()  # This gets us the team.id without committing
        
        # Now create the team member with the team_id
        member = TeamMember(
            team_id=team.id,
            user_id=user_id,
            role='owner',
            joined_at=datetime.utcnow()
        )
        db.session.add(member)
        db.session.commit()
        
        return jsonify({
            'team_id': team.id,
            'name': team.name,
            'role': 'owner'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating team: {str(e)}")
        return jsonify({'error': 'Failed to create team'}), 500

@team_bp.route('/team/invite', methods=['POST'])
@jwt_required()
def invite_member():
    data = request.get_json()
    user_id = get_jwt_identity()
    
    # Verify user has permission to invite
    team_member = TeamMember.query.filter_by(
        team_id=data['team_id'],
        user_id=user_id
    ).first()
    
    if not team_member or team_member.role == 'member':
        return jsonify({'error': 'Unauthorized'}), 403
    
    invitation = Invitation(
        team_id=data['team_id'],
        email=data['email'],
        role=data['role'],
        invited_by=user_id,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    
    db.session.add(invitation)
    db.session.commit()
    
    # Get team name and send invitation email
    team = Team.query.get(data['team_id'])
    invite_url = f"http://localhost:3000/invite/{invitation.invite_code}"
    
    from ..services.email_service import send_team_invitation
    email_sent = send_team_invitation(
        data['email'],
        team.name,
        data['role'],
        invite_url
    )
    
    if not email_sent:
        return jsonify({'error': 'Failed to send invitation email'}), 500
    
    return jsonify({
        'invite_code': invitation.invite_code,
        'invite_url': invite_url
    }), 201

@team_bp.route('/team/accept-invite/<invite_code>', methods=['POST'])
@jwt_required()
def accept_invite(invite_code):
    user_id = get_jwt_identity()
    invitation = Invitation.query.filter_by(
        invite_code=invite_code,
        status='pending'
    ).first()
    
    if not invitation or invitation.expires_at < datetime.utcnow():
        return jsonify({'error': 'Invalid or expired invitation'}), 400
    
    member = TeamMember(
        team_id=invitation.team_id,
        user_id=user_id,
        role=invitation.role,
        invited_by=invitation.invited_by
    )
    
    invitation.status = 'accepted'
    db.session.add(member)
    db.session.commit()
    
    return jsonify({'message': 'Invitation accepted successfully'}), 200

@team_bp.route('/team/members/<team_id>', methods=['GET'])
@jwt_required()
def get_team_members(team_id):
    user_id = get_jwt_identity()
    
    # Check if user is part of the team
    if not TeamMember.query.filter_by(team_id=team_id, user_id=user_id).first():
        return jsonify({'error': 'Unauthorized'}), 403
    
    members = TeamMember.query.filter_by(team_id=team_id).all()
    members_data = []
    
    for member in members:
        user = User.query.get(member.user_id)
        members_data.append({
            'id': member.id,
            'user_id': member.user_id,
            'email': user.email,
            'role': member.role,
            'joined_at': member.joined_at.isoformat()
        })
    
    return jsonify({'members': members_data}), 200

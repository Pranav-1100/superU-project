from flask_mail import Mail, Message
from flask import current_app, render_template_string
import os
from ..models import Team

mail = Mail()

# HTML template for invitation email
INVITE_TEMPLATE = """
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Team Invitation</h2>
    <p>Hello!</p>
    <p>You've been invited to join a team as a {{ role }}.</p>
    <p>Click the link below to accept the invitation:</p>
    <a href="{{ invite_url }}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        Accept Invitation
    </a>
    <p>This invitation will expire in 7 days.</p>
    <p>Best regards,<br>Your Team</p>
</body>
</html>
"""

def configure_email(app):
    """Configure email settings for the Flask app"""
    try:
        mail_username = os.getenv('MAIL_USERNAME')
        mail_password = os.getenv('MAIL_APP_PASSWORD')
        
        if not mail_username or not mail_password:
            print("Warning: Email credentials are not set in environment variables")
            return

        app.config.update(
            MAIL_SERVER='smtp.gmail.com',
            MAIL_PORT=587,
            MAIL_USE_TLS=True,
            MAIL_USERNAME=mail_username,
            MAIL_PASSWORD=mail_password,
            MAIL_DEFAULT_SENDER=mail_username,
            MAIL_USE_SSL=False,
            MAIL_DEBUG=True  # This will help us see detailed SMTP interaction
        )
        mail.init_app(app)
        
        # Test the connection
        with app.app_context():
            try:
                mail.connect()
                print("Email configuration successful!")
            except Exception as e:
                print(f"Failed to connect to email server: {str(e)}")
                
    except Exception as e:
        print(f"Error configuring email: {str(e)}")


def send_team_invitation(email, team_id, role, invite_url):
    """Send team invitation email"""
    try:
        msg = Message(
            'Team Invitation',
            sender=current_app.config['MAIL_DEFAULT_SENDER'],
            recipients=[email]
        )
        
        # Render HTML template
        msg.html = render_template_string(
            INVITE_TEMPLATE,
            role=role,
            invite_url=invite_url
        )
        
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False


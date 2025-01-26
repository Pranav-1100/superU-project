from flask import Flask, jsonify, request, make_response  
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO
from redis import Redis
from datetime import timedelta
import os

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO()
redis_client = Redis(host='redis', port=6379, db=0)

def configure_email(app):
    app.config.update(
        MAIL_SERVER='smtp.gmail.com',
        MAIL_PORT=587,
        MAIL_USE_TLS=True,
        MAIL_USERNAME=os.getenv('MAIL_USERNAME'),
        MAIL_PASSWORD=os.getenv('MAIL_PASSWORD'),
        MAIL_DEFAULT_SENDER=os.getenv('MAIL_DEFAULT_SENDER', 'your-email@gmail.com')
    )
    mail.init_app(app)



def create_app():
    app = Flask(__name__)
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Configure app with SQLite
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_ERROR_MESSAGE_KEY'] = 'error'

    # Initialize CORS once
    CORS(app, 
        supports_credentials=True,
        resources={
            r"/*": {
                "origins": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
                "expose_headers": ["Content-Range", "X-Content-Range"]
            }
        }
    )

    # Initialize other extensions
    db.init_app(app)
    jwt.init_app(app)
    
    # Initialize SocketIO once with proper mode
    socketio.init_app(app, 
        cors_allowed_origins="*",
        async_mode=None,  # Let it auto-detect
        ping_timeout=60,
        ping_interval=25
    )
    
    # Configure email
    from .services.email_service import configure_email
    configure_email(app)
    
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.team import team_bp
    from .routes.content import content_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(team_bp)
    app.register_blueprint(content_bp)
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': 'Token has expired',
            'code': 'token_expired'
        }), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            'error': 'Invalid token',
            'code': 'invalid_token'
        }), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            'error': 'Authorization token is missing',
            'code': 'authorization_required'
        }), 401

    # CORS Preflight handler
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = make_response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            return response

    # Error handlers
    @app.errorhandler(500)
    def handle_500(error):
        response = jsonify({'error': 'Internal Server Error'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response, 500

    @app.errorhandler(404)
    def handle_404(error):
        response = jsonify({'error': 'Not Found'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response, 404

    @app.errorhandler(401)
    def handle_401(error):
        response = jsonify({'error': 'Unauthorized'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response, 401

    return app
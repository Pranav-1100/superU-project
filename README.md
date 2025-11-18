# SuperU - Collaborative Content Management Platform

A real-time collaborative platform for teams to scrape, organize, and edit web documentation together.

## 🌟 Features

- **Web Scraping**: Automatically extract and structure content from URLs
- **Team Collaboration**: Invite team members with role-based permissions
- **Real-time Editing**: See changes as they happen with Socket.io
- **Version Control**: Complete edit history with diff tracking
- **Smart Search**: Find content across your team's documentation
- **Secure**: JWT authentication, rate limiting, input validation

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- SQLite3 (included)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd superU-project

# Navigate to Express backend
cd express-backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env  # or your favorite editor

# Start the server
npm run dev
```

The server will start on `http://localhost:3002`

### Environment Setup

Edit `.env` file with your configuration:

```env
# Required
JWT_SECRET_KEY=your-super-secret-key-change-this
MAIL_USERNAME=your-email@gmail.com
MAIL_APP_PASSWORD=your-gmail-app-password

# Optional (defaults provided)
PORT=3002
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Gmail App Password Setup:**
1. Go to Google Account settings
2. Security > 2-Step Verification
3. App passwords > Generate new password
4. Copy the password to `MAIL_APP_PASSWORD`

## 📚 API Documentation

### Authentication

#### Register
```bash
POST /api/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: { "token": "...", "user_id": "...", "email": "..." }
```

#### Login
```bash
POST /api/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: { "token": "...", "user_id": "...", "email": "..." }
```

### Teams

#### Create Team
```bash
POST /api/team/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Engineering Team"
}
```

#### Invite Member
```bash
POST /api/team/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "team_id": "uuid",
  "email": "member@example.com",
  "role": "admin"  # or "member"
}
```

### Content

#### Scrape Content
```bash
POST /api/content/scrape
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://docs.example.com/guide",
  "team_id": "uuid"
}
```

#### Update Content Node
```bash
PUT /api/content/node/:node_id
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated content here..."
}
```

#### Search Content
```bash
GET /api/content/search/:team_id?q=keyword
Authorization: Bearer <token>
```

### Health Check
```bash
GET /health

Response: {
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

## 🔌 WebSocket Events

### Connect
```javascript
import io from 'socket.io-client';
const socket = io('http://localhost:3002');
```

### Join Content Room
```javascript
socket.emit('join', {
  content_id: 'uuid',
  user_id: 'uuid'
});
```

### Listen for Updates
```javascript
socket.on('content_updated', (data) => {
  console.log('Content updated:', data);
  // { node_id, content, user_id, timestamp }
});

socket.on('user_joined', (data) => {
  console.log('User joined:', data.user_id);
});

socket.on('user_typing', (data) => {
  console.log('User typing in node:', data.node_id);
});
```

## 🛡️ Security Features

- **Rate Limiting**
  - Login: 5 attempts per 15 minutes
  - Registration: 3 accounts per hour
  - Content scraping: 10 per 15 minutes

- **Input Validation**
  - Email format validation
  - Password strength requirements (8+ chars, uppercase, lowercase, number)
  - URL validation for scraping
  - SQL injection prevention

- **Authentication**
  - JWT tokens with expiration
  - Bcrypt password hashing (12 rounds)
  - Role-based access control

## 📁 Project Structure

```
express-backend/
├── src/
│   ├── app.js                  # Express app configuration
│   ├── config/
│   │   └── database.js         # Database configuration
│   ├── middleware/
│   │   ├── auth.js            # Authentication & permissions
│   │   ├── validation.js      # Input validation schemas
│   │   └── rateLimiter.js     # Rate limiting configs
│   ├── models/
│   │   ├── index.js           # Model loader
│   │   ├── user.js            # User model
│   │   ├── team.js            # Team model
│   │   ├── teamMember.js      # Team membership
│   │   ├── invitation.js      # Team invitations
│   │   ├── content.js         # Content model
│   │   ├── contentNode.js     # Content tree nodes
│   │   └── contentEdit.js     # Edit history
│   ├── routes/
│   │   ├── auth.js            # Auth endpoints
│   │   ├── team.js            # Team management
│   │   └── content.js         # Content management
│   └── services/
│       ├── contentService.js  # Web scraping logic
│       ├── emailService.js    # Email sending
│       └── socketService.js   # Socket.io handlers
├── server.js                   # Server entry point
├── package.json
└── .env.example
```

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.js
```

## 🐛 Troubleshooting

### Database Issues
```bash
# Delete the database and restart (WARNING: deletes all data)
rm database.sqlite
npm run dev
```

### Port Already in Use
```bash
# Find process using port 3002
lsof -i :3002

# Kill the process
kill -9 <PID>
```

### Email Not Sending
1. Verify Gmail app password is correct
2. Check that 2FA is enabled on your Google account
3. Verify `MAIL_USERNAME` and `MAIL_APP_PASSWORD` in `.env`

### CORS Errors
Add your frontend URL to `ALLOWED_ORIGINS` in `.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://yourfrontend.com
```

## 📊 Database Schema

### Users
- `id` (UUID)
- `email` (unique)
- `password_hash`
- `status` (active/inactive/suspended)

### Teams
- `id` (UUID)
- `name`
- `owner_id` (FK to Users)
- `created_at`

### TeamMembers
- `id` (UUID)
- `team_id` (FK to Teams)
- `user_id` (FK to Users)
- `role` (owner/admin/member)
- `joined_at`

### Content
- `id` (UUID)
- `team_id` (FK to Teams)
- `url`
- `title`
- `original_content` (JSON)
- `current_content` (JSON)
- `meta` (JSON)
- `created_at`, `updated_at`

### ContentNodes (Tree Structure)
- `id` (UUID)
- `content_id` (FK to Content)
- `parent_id` (FK to self, nullable for root)
- `title`
- `node_type`
- `level`
- `order`

### ContentEdits (Version History)
- `id` (UUID)
- `content_id` (FK to Content)
- `node_id` (FK to ContentNodes)
- `user_id` (FK to Users)
- `previous_content`
- `new_content`
- `created_at`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Express.js for the web framework
- Socket.io for real-time communication
- Sequelize for ORM
- Cheerio for web scraping
- Joi for validation

## 📞 Support

For issues and questions:
- Check the [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) for detailed documentation
- Open an issue on GitHub
- Review closed issues for similar problems

## 🗺️ Roadmap

See [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) for:
- Detailed feature analysis
- Improvement recommendations
- New feature ideas
- Architecture recommendations
- Security enhancements

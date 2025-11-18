# Changelog

All notable changes to the SuperU project.

## [2.0.0] - 2024 (Major Security & Feature Update)

### 🔒 Security Fixes

#### Critical
- **Fixed CORS vulnerability** - Changed from `origin: "*"` to environment-based whitelist
- **Fixed SQL injection risk** - Added input sanitization and parameterized queries
- **Fixed role checking bug** - Corrected Sequelize `Op.in` usage for proper permission validation
- **Added JWT secret validation** - Server now validates required environment variables on startup
- **Removed unused Redis client** - Eliminated potential security risk from unconnected client

#### High Priority
- Added password strength requirements (min 8 chars, uppercase, lowercase, number)
- Implemented request size limits (10MB)
- Added JWT secret environment validation
- Fixed hardcoded URLs - moved to environment variables

### ✨ New Features

#### Rate Limiting
- **Auth endpoints**: 5 failed login attempts per 15 minutes per IP
- **Registration**: 3 accounts per hour per IP
- **Content creation**: 10 scrapes per 15 minutes
- **General API**: 100 requests per 15 minutes

#### Input Validation
- Added Joi validation schemas for all endpoints
- Email format validation
- Password complexity requirements
- URL validation for web scraping
- UUID validation for IDs

#### Enhanced User Management
- `/api/refresh` - Token refresh endpoint
- `/api/change-password` - Password change functionality
- User status checking (suspended accounts blocked)

#### Improved Team Management
- `DELETE /api/team/members/:team_id/:user_id` - Remove team members (admin/owner only)
- `POST /api/team/leave/:team_id` - Leave team functionality
- Prevention of owner removal
- Better permission checking with proper role arrays

#### Better Content Management
- Pagination on all list endpoints (users, teams, content, history)
- Safe JSON parsing with error handling
- Improved search with query sanitization
- Content history pagination

#### Infrastructure
- `/health` - Health check endpoint
- Graceful shutdown handling (SIGTERM/SIGINT)
- Centralized error handling middleware
- Environment-based configuration

### 🐛 Bug Fixes

#### Critical Bugs
1. **Socket.io integration** - Fixed by attaching `io` to Express app in `server.js`
2. **JSON.parse crashes** - Added try-catch error handling in content routes
3. **Team permission check** - Fixed role array checking using `Op.in`
4. **Model import in function** - Moved TeamMember import to top of auth.js

#### Performance
- Fixed N+1 query issues - Added `separate: true` and `distinct: true` to associations
- Added pagination to prevent loading all records at once
- Optimized team info queries with proper includes

### 📝 Code Quality Improvements

#### Structure
- Created `src/middleware/validation.js` - Centralized validation schemas
- Created `src/middleware/rateLimiter.js` - Rate limiting configurations
- Improved error handling with specific error codes
- Removed console.log from production paths (kept in error handlers only)

#### Error Handling
- JWT errors with specific codes (`invalid_token`, `token_expired`)
- Validation errors with field-level details
- CORS errors with proper messaging
- Generic errors with environment-aware messages

#### Configuration
- Created `.env.example` with all required variables
- Added environment variable documentation
- Validated required env vars on startup
- Made all URLs and origins configurable

### 📚 Documentation

#### New Files
- `README.md` - Quick start guide and API documentation
- `PROJECT_ANALYSIS.md` - Comprehensive project analysis, improvements, and feature ideas
- `CHANGELOG.md` - This file
- `.env.example` - Environment variable template

#### API Documentation
- Documented all endpoints with examples
- Added Socket.io event documentation
- Included authentication headers
- Provided error response formats

### 🔄 Changed

#### Breaking Changes
- **CORS**: Now requires `ALLOWED_ORIGINS` environment variable
- **JWT**: Now requires `JWT_SECRET_KEY` environment variable (validated on startup)
- **Email**: Team invitation URLs now use `FRONTEND_URL` environment variable

#### Routes
- `src/routes/auth.js` - Complete rewrite with validation and rate limiting
- `src/routes/team.js` - Fixed permission checks, added new endpoints
- `src/routes/content.js` - Added error handling, pagination, sanitization

#### Middleware
- `src/middleware/auth.js` - Improved permission checking, added `requireTeamRole`
- `src/app.js` - Removed Redis, improved CORS, centralized error handling
- `server.js` - Added env validation, Socket.io setup, graceful shutdown

#### Dependencies
- Added `joi` for input validation
- Added `express-rate-limit` for rate limiting
- Removed unused `redis` dependency from app.js

### 🗑️ Removed

- Unused Redis client initialization
- Hardcoded URLs (localhost:3000)
- Unsafe CORS configuration (`origin: "*"`)
- Console.log statements from request handlers
- JWT error middleware from wrong position

### 📦 New Dependencies

```json
{
  "joi": "^17.11.0",
  "express-rate-limit": "^7.1.5"
}
```

### 🔧 Configuration

#### New Environment Variables
```env
# Required
JWT_SECRET_KEY=your-secret-key
MAIL_USERNAME=your-email@gmail.com
MAIL_APP_PASSWORD=your-gmail-app-password

# Optional (with defaults)
NODE_ENV=development
PORT=3002
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
FRONTEND_URL=http://localhost:3000
JWT_EXPIRY=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## [1.0.0] - Previous Version

### Initial Features
- User authentication (register/login)
- Team creation and management
- Team member invitations
- Web content scraping
- Content organization with tree structure
- Real-time collaboration with Socket.io
- Edit history tracking
- Content versioning
- Search functionality
- Email notifications

### Technical Stack
- Express.js
- SQLite + Sequelize
- Socket.io
- JWT authentication
- Bcrypt password hashing
- Nodemailer for emails
- Cheerio for web scraping

---

## Migration Guide (v1 to v2)

### Required Actions

1. **Create .env file**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Update JWT_SECRET_KEY**
   - Generate a strong secret key
   - Add to .env file
   - Server will fail to start without it

3. **Configure CORS**
   - Add your frontend URLs to `ALLOWED_ORIGINS`
   - Comma-separated list

4. **Update Frontend**
   - All auth errors now have `code` field
   - Handle new error codes: `auth_rate_limit_exceeded`, `register_rate_limit_exceeded`
   - Update invite URLs to use new format

5. **Test Integration**
   - Test login rate limiting
   - Verify CORS with your frontend
   - Test Socket.io reconnection

### Optional Improvements

1. **Enable Pagination**
   - Add `?page=1&limit=20` to list endpoints
   - Update frontend to handle pagination response

2. **Implement Error Handling**
   - Handle validation errors with field details
   - Show user-friendly messages for rate limiting
   - Handle JWT expiration gracefully

3. **Use Health Check**
   - Monitor `/health` endpoint
   - Set up uptime monitoring

---

## Future Roadmap

See [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) for detailed roadmap including:

### High Priority
- Database migrations with Sequelize CLI
- Automated testing suite (Jest + Supertest)
- Winston logging system
- Database indexing
- Caching layer with Redis

### Medium Priority
- Swagger API documentation
- Content diff storage
- Background job queue
- Webhook system
- File attachments

### Feature Ideas
- AI-powered content summarization
- Collaborative comments
- Version comparison
- Content approval workflow
- Content locking
- Multi-language support
- Content templates
- Analytics dashboard

---

## Known Issues

### Flask Backend
- Mail import issue in `app/__init__.py` (line 24) - mail object not defined
- Duplicate implementation - recommend consolidating to Express only

### Minor Issues
- Database uses auto-sync (should use migrations in production)
- No automated tests yet
- Content stored as full copies (should use diffs)
- No database indexes on foreign keys

---

## Contributors

- Initial development and security fixes
- Code review and analysis

---

## Support

For questions or issues:
1. Check [README.md](README.md) for quick start
2. Review [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) for detailed documentation
3. Open a GitHub issue with:
   - Environment details
   - Error messages
   - Steps to reproduce

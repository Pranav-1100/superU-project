const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authorization token is missing',
                code: 'authorization_required'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.user = { id: decoded.sub };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token has expired',
                code: 'token_expired'
            });
        }
        return res.status(401).json({
            error: 'Invalid token',
            code: 'invalid_token'
        });
    }
};

// Helper function to check team permissions
const checkTeamPermissions = async (userId, teamId, requiredRoles = null) => {
    const { TeamMember } = require('../models');
    
    const member = await TeamMember.findOne({
        where: {
            team_id: teamId,
            user_id: userId
        }
    });

    if (!member) return false;
    if (requiredRoles && !requiredRoles.includes(member.role)) return false;
    return true;
};

module.exports = {
    authMiddleware,
    checkTeamPermissions
};

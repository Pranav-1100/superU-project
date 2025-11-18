const jwt = require('jsonwebtoken');
const { TeamMember } = require('../models');
const { Op } = require('sequelize');

// Authentication middleware
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

        // Verify JWT_SECRET_KEY is set
        if (!process.env.JWT_SECRET_KEY) {
            console.error('JWT_SECRET_KEY is not set!');
            return res.status(500).json({
                error: 'Server configuration error',
                code: 'server_error'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.user = {
            id: decoded.sub,
            iat: decoded.iat,
            exp: decoded.exp
        };
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token has expired',
                code: 'token_expired'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token',
                code: 'invalid_token'
            });
        }
        return res.status(401).json({
            error: 'Authentication failed',
            code: 'auth_failed'
        });
    }
};

// Helper function to check team permissions
const checkTeamPermissions = async (userId, teamId, requiredRoles = null) => {
    try {
        const where = {
            team_id: teamId,
            user_id: userId
        };

        // Add role filter if required
        if (requiredRoles && requiredRoles.length > 0) {
            where.role = { [Op.in]: requiredRoles };
        }

        const member = await TeamMember.findOne({ where });

        return !!member; // Returns true if member exists, false otherwise
    } catch (error) {
        console.error('Error checking team permissions:', error);
        return false;
    }
};

// Middleware to require specific team roles
const requireTeamRole = (requiredRoles) => {
    return async (req, res, next) => {
        try {
            const teamId = req.params.team_id || req.body.team_id;

            if (!teamId) {
                return res.status(400).json({
                    error: 'Team ID is required',
                    code: 'missing_team_id'
                });
            }

            const hasPermission = await checkTeamPermissions(
                req.user.id,
                teamId,
                requiredRoles
            );

            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    code: 'forbidden'
                });
            }

            next();
        } catch (error) {
            console.error('Error in requireTeamRole middleware:', error);
            return res.status(500).json({
                error: 'Internal server error',
                code: 'server_error'
            });
        }
    };
};

module.exports = {
    authMiddleware,
    checkTeamPermissions,
    requireTeamRole
};

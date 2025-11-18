const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

module.exports = (sequelize, DataTypes) => {
    const ActivityLog = sequelize.define('ActivityLog', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4()
        },
        team_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Teams',
                key: 'id'
            }
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        action_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'e.g., content_created, content_updated, member_added, comment_added'
        },
        resource_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'e.g., content, team, member, comment'
        },
        resource_id: {
            type: DataTypes.UUID,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Additional context about the action'
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        timestamps: false,
        tableName: 'activity_logs',
        indexes: [
            { fields: ['team_id'] },
            { fields: ['user_id'] },
            { fields: ['action_type'] },
            { fields: ['created_at'] }
        ]
    });

    ActivityLog.associate = (models) => {
        ActivityLog.belongsTo(models.Team, { foreignKey: 'team_id' });
        ActivityLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'actor' });
    };

    // Static method to log activity
    ActivityLog.logActivity = async function(teamId, userId, actionType, resourceType, resourceId, metadata = {}) {
        try {
            return await this.create({
                team_id: teamId,
                user_id: userId,
                action_type: actionType,
                resource_type: resourceType,
                resource_id: resourceId,
                metadata
            });
        } catch (error) {
            logger.error('Error logging activity:', error);
            return null;
        }
    };

    return ActivityLog;
};

const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const ContentLock = sequelize.define('ContentLock', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4()
        },
        node_id: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: {
                model: 'ContentNodes',
                key: 'id'
            }
        },
        locked_by: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        locked_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        }
    }, {
        timestamps: false,
        tableName: 'content_locks',
        indexes: [
            { fields: ['node_id'], unique: true },
            { fields: ['locked_by'] },
            { fields: ['expires_at'] }
        ]
    });

    ContentLock.associate = (models) => {
        ContentLock.belongsTo(models.ContentNode, { foreignKey: 'node_id' });
        ContentLock.belongsTo(models.User, { foreignKey: 'locked_by', as: 'locker' });
    };

    // Helper method to check if lock is expired
    ContentLock.prototype.isExpired = function() {
        return new Date() > this.expires_at;
    };

    return ContentLock;
};

const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const ApprovalRequest = sequelize.define('ApprovalRequest', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4()
        },
        content_edit_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'ContentEdits',
                key: 'id'
            }
        },
        requested_by: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        approved_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending'
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        reviewed_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        timestamps: false,
        tableName: 'approval_requests',
        indexes: [
            { fields: ['content_edit_id'] },
            { fields: ['requested_by'] },
            { fields: ['status'] }
        ]
    });

    ApprovalRequest.associate = (models) => {
        ApprovalRequest.belongsTo(models.ContentEdit, { foreignKey: 'content_edit_id' });
        ApprovalRequest.belongsTo(models.User, { foreignKey: 'requested_by', as: 'requester' });
        ApprovalRequest.belongsTo(models.User, { foreignKey: 'approved_by', as: 'reviewer' });
    };

    return ApprovalRequest;
};

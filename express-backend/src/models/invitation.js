const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const Invitation = sequelize.define('Invitation', {
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
        email: {
            type: DataTypes.STRING(120),
            allowNull: false
        },
        role: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        invite_code: {
            type: DataTypes.UUID,
            unique: true,
            allowNull: false,
            defaultValue: () => uuidv4()
        },
        invited_by: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'pending'
        }
    }, {
        timestamps: true, // Enable timestamps
        createdAt: true,
        updatedAt: true,
        tableName: 'Invitations'
    });

    Invitation.associate = (models) => {
        Invitation.belongsTo(models.Team, { foreignKey: 'team_id' });
        Invitation.belongsTo(models.User, { foreignKey: 'invited_by', as: 'inviter' });
    };

    return Invitation;
};

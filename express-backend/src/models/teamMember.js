const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const TeamMember = sequelize.define('TeamMember', {
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
        role: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        invited_by: {
            type: DataTypes.UUID,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        joined_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        timestamps: true,
        createdAt: 'joined_at',
        updatedAt: false,
        tableName: 'TeamMembers'
    });

    TeamMember.associate = (models) => {
        TeamMember.belongsTo(models.Team, { foreignKey: 'team_id' });
        TeamMember.belongsTo(models.User, { foreignKey: 'user_id' });
        TeamMember.belongsTo(models.User, { foreignKey: 'invited_by', as: 'inviter' });
    };

    return TeamMember;
};

const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const Team = sequelize.define('Team', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4()
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        owner_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        tableName: 'Teams'
    });

    Team.associate = (models) => {
        Team.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
        Team.hasMany(models.TeamMember, { foreignKey: 'team_id' });
        Team.hasMany(models.Content, { foreignKey: 'team_id' });
    };

    return Team;
};

const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const Content = sequelize.define('Content', {
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
        url: {
            type: DataTypes.STRING(500),
            allowNull: false
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        original_content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        current_content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        meta: {
            type: DataTypes.JSON
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    Content.associate = (models) => {
        Content.belongsTo(models.Team, { foreignKey: 'team_id' });
        Content.hasMany(models.ContentNode, { foreignKey: 'content_id', as: 'nodes' });
        Content.hasMany(models.ContentEdit, { foreignKey: 'content_id', as: 'edits' });
    };

    return Content;
};

const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const ContentTemplate = sequelize.define('ContentTemplate', {
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
        name: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        structure: {
            type: DataTypes.JSON,
            allowNull: false,
            comment: 'Template structure with sections and placeholders'
        },
        is_public: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'If true, available to all teams'
        },
        created_by: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        usage_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
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
        updatedAt: 'updated_at',
        tableName: 'content_templates',
        indexes: [
            { fields: ['team_id'] },
            { fields: ['created_by'] },
            { fields: ['is_public'] }
        ]
    });

    ContentTemplate.associate = (models) => {
        ContentTemplate.belongsTo(models.Team, { foreignKey: 'team_id' });
        ContentTemplate.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    };

    return ContentTemplate;
};

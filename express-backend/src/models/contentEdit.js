const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const ContentEdit = sequelize.define('ContentEdit', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4()
        },
        content_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Contents',
                key: 'id'
            }
        },
        node_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'ContentNodes',
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
        previous_content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        new_content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    ContentEdit.associate = (models) => {
        ContentEdit.belongsTo(models.Content, { foreignKey: 'content_id' });
        ContentEdit.belongsTo(models.ContentNode, { foreignKey: 'node_id' });
        ContentEdit.belongsTo(models.User, { foreignKey: 'user_id' });
    };

    ContentEdit.prototype.toJSON = function() {
        const values = { ...this.get() };
        return {
            id: values.id,
            user_id: values.user_id,
            created_at: values.created_at,
            has_changes: values.previous_content !== values.new_content
        };
    };

    return ContentEdit;
};

const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const Comment = sequelize.define('Comment', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4()
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
        parent_comment_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Comments',
                key: 'id'
            }
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        position: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Stores cursor position or highlighted text range'
        },
        resolved: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        resolved_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        resolved_at: {
            type: DataTypes.DATE,
            allowNull: true
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
        tableName: 'comments',
        indexes: [
            { fields: ['node_id'] },
            { fields: ['user_id'] },
            { fields: ['parent_comment_id'] },
            { fields: ['resolved'] }
        ]
    });

    Comment.associate = (models) => {
        Comment.belongsTo(models.ContentNode, { foreignKey: 'node_id' });
        Comment.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
        Comment.belongsTo(models.User, { foreignKey: 'resolved_by', as: 'resolver' });
        Comment.belongsTo(Comment, { as: 'parentComment', foreignKey: 'parent_comment_id' });
        Comment.hasMany(Comment, { as: 'replies', foreignKey: 'parent_comment_id' });
    };

    Comment.prototype.toJSON = function() {
        const values = { ...this.get() };
        return {
            id: values.id,
            node_id: values.node_id,
            user_id: values.user_id,
            content: values.content,
            position: values.position,
            resolved: values.resolved,
            resolved_by: values.resolved_by,
            resolved_at: values.resolved_at,
            created_at: values.created_at,
            updated_at: values.updated_at,
            author: values.author,
            replies: values.replies || []
        };
    };

    return Comment;
};

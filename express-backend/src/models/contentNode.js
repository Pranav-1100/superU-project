const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
    const ContentNode = sequelize.define('ContentNode', {
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
        parent_id: {
            type: DataTypes.UUID,
            references: {
                model: 'ContentNodes',
                key: 'id'
            }
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        node_type: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        level: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        order: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        timestamps: false
    });

    ContentNode.associate = (models) => {
        ContentNode.belongsTo(models.Content, { foreignKey: 'content_id' });
        ContentNode.belongsTo(ContentNode, { as: 'parent', foreignKey: 'parent_id' });
        ContentNode.hasMany(ContentNode, { as: 'children', foreignKey: 'parent_id' });
        ContentNode.hasMany(models.ContentEdit, { foreignKey: 'node_id' });
    };

    ContentNode.prototype.toJSON = function() {
        const values = { ...this.get() };
        return {
            id: values.id,
            title: values.title,
            type: values.node_type,
            level: values.level,
            children: values.children ? values.children.map(child => child.toJSON()) : []
        };
    };

    return ContentNode;
};

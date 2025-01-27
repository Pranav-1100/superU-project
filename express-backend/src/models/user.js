const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4()
        },
        email: {
            type: DataTypes.STRING(120),
            unique: true,
            allowNull: false,
            validate: {
                isEmail: {
                    msg: "Must be a valid email address"
                }
            }
        },
        password_hash: {
            type: DataTypes.STRING(256),
            allowNull: false
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'active',
            validate: {
                isIn: [['active', 'inactive', 'suspended']]
            }
        }
    }, {
        timestamps: false, // Disable Sequelize's timestamp handling
        tableName: 'users'
    });

    User.associate = (models) => {
        User.hasMany(models.Team, { 
            foreignKey: 'owner_id',
            as: 'ownedTeams' 
        });
        User.hasMany(models.TeamMember, { 
            foreignKey: 'user_id',
            as: 'teamMemberships' 
        });
        User.hasMany(models.ContentEdit, { 
            foreignKey: 'user_id',
            as: 'contentEdits' 
        });
        User.hasMany(models.Invitation, { 
            foreignKey: 'invited_by',
            as: 'sentInvitations' 
        });
    };

    // Instance method to verify password
    User.prototype.checkPassword = async function(password) {
        return await bcrypt.compare(password, this.password_hash);
    };

    // Instance method to serialize user data
    User.prototype.toJSON = function() {
        const values = { ...this.get() };
        delete values.password_hash;
        return values;
    };

    return User;
};

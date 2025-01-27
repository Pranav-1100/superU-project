const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize({
    dialect: dbConfig.dialect,
    storage: dbConfig.storage,
    logging: dbConfig.logging,
    define: {
        timestamps: true, // Enable timestamps by default
        underscored: true, // Use snake_case rather than camelCase
    }
});

const db = {
    sequelize,
    Sequelize
};

// Import models
db.User = require('./user')(sequelize, Sequelize.DataTypes);
db.Team = require('./team')(sequelize, Sequelize.DataTypes);
db.TeamMember = require('./teamMember')(sequelize, Sequelize.DataTypes);
db.Invitation = require('./invitation')(sequelize, Sequelize.DataTypes);
db.Content = require('./content')(sequelize, Sequelize.DataTypes);
db.ContentNode = require('./contentNode')(sequelize, Sequelize.DataTypes);
db.ContentEdit = require('./contentEdit')(sequelize, Sequelize.DataTypes);

// Define associations
Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

module.exports = db;

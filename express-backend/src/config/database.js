module.exports = {
    development: {
        dialect: 'sqlite',
        storage: './database.sqlite',
        logging: false,
        define: {
            timestamps: true,
            underscored: true
        }
    },
    test: {
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
        define: {
            timestamps: true,
            underscored: true
        }
    },
    production: {
        dialect: 'sqlite',
        storage: './database.sqlite',
        logging: false,
        define: {
            timestamps: true,
            underscored: true
        }
    }
};

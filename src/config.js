require('dotenv').config();

module.exports = {
    app: {
        port: process.env.PORT || 4000,
    },
    jwt: {
        secret: process.env.JET_SECRET || 'secret',	
    },
    mysql: {
        host: process.env.MYSQL_HOST || '172.18.5.17',
        user: process.env.MYSQL_USER || 'cristian.jimenez',
        password: process.env.MYSQL_PASSWORD || 'Dgp123456*',
        database: process.env.MYSQL_DATABASE || 'helpdesk',
    }
};
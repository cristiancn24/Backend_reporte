const db = require('../../DB/mysql');
const ctrl = require('./controller');

module.exports = ctrl(db);
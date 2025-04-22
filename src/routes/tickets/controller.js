module.exports = function (dbInyected) {

    let db = dbInyected;

    if (!db) {
        db = require('../../DB/mysql');
    }

    function getAll () {
        return db.getAll('tickets');
    }
    
    function getOne (id) {  
        return db.getOne('tickets', id);
    }

    function getTicketsSoportes () {
        return db.getTicketsSoportes();
    }

    function getTicketsByUserId (id) {
        return db.getTicketsByUserId(id);
    }

    function getClosedTicketsByUserId (id) {
        return db.getClosedTicketsByUserId(id);
    }

    function getOpenedTicketsByUserId (id) {
        return db.getOpenedTicketsByUserId(id);
    }

    return {
        getAll,
        getOne,
        getTicketsSoportes,
        getTicketsByUserId,
        getClosedTicketsByUserId,
        getOpenedTicketsByUserId
    }
}
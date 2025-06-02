const express = require('express');

const response = require('../../services/responses');
const controller = require('./index');

const router = express.Router();

router.get('/', getTickets);
router.get('/assigned', getTicketsSoportes);
router.get('/:id', getOne);
router.get('/user/:id', getTicketsByUserId);

async function getTickets(req, res) {
    try {
        const filters = {
            range: req.query.range ? JSON.parse(req.query.range) : null,
            singleDate: req.query.date ? new Date(req.query.date) : null,
            estados: req.query.estados ? req.query.estados.split(',') : [],
            asignados: req.query.asignados ? req.query.asignados.split(',') : [],
            searchText: req.query.search || ''
        };

        const tickets = await controller.getTickets(filters);
        response.success(req, res, tickets, 200);
    } catch (error) {
        console.error('Error al obtener tickets:', error);
        response.error(req, res, 'Error al obtener tickets', 500);
    }
}

async function getOne (req, res) {
    try{
        const items = await controller.getOne(req.params.id)
        response.success(req, res, items, 200);
    }
    catch (err) {
        response.error(req, res, err, 500);
    }
}

async function getTicketsSoportes (req, res) {
    try{
        const items = await controller.getTicketsSoportes()
        response.success(req, res, items, 200);
    }
    catch (err) {
        response.error(req, res, err, 500);
    }
}

async function getTicketsByUserId (req, res) {
    try{
        const items = await controller.getTicketsByUserId(req.params.id)
        response.success(req, res, items, 200);
    }
    catch (err) {
        response.error(req, res, err, 500);
    }
}




module.exports = router;
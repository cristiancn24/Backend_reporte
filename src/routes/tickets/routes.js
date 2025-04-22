const express = require('express');

const response = require('../../services/responses');
const controller = require('./index');

const router = express.Router();

router.get('/', getAll);
router.get('/assigned', getTicketsSoportes);
router.get('/:id', getOne);
router.get('/user/:id', getTicketsByUserId);
router.get('/closed/:id', getClosedTicketsByUserId);
router.get('/opened/:id', getOpenedTicketsByUserId);

async function getAll (req, res) {
    try{
        const items = await controller.getAll()
        response.success(req, res, items, 200);
    }
    catch (err) {
        response.error(req, res, err, 500);
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

async function getClosedTicketsByUserId(req, res) {
    try {
        const result = await controller.getClosedTicketsByUserId(req.params.id);
        response.success(req, res, result, 200);
    } catch (err) {
        response.error(req, res, err, 500);
    }
}

async function getOpenedTicketsByUserId(req, res) {
    try {
        const result = await controller.getOpenedTicketsByUserId(req.params.id);
        response.success(req, res, result, 200);
    } catch (err) {
        response.error(req, res, err, 500);
    }
}



module.exports = router;
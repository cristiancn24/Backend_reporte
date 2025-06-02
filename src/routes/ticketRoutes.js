const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

router.get('/', ticketController.getTicketsForTable);
router.get('/status-options', ticketController.getStatusOptions);

module.exports = router;
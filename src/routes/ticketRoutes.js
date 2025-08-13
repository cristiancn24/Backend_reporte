const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const verificarToken = require('../middlewares/auth');

router.post('/', verificarToken, ticketController.createTicket);
router.get('/', ticketController.getTickets);
router.get('/status-options', ticketController.getStatusOptions);
router.get('/:id', ticketController.getTicketById);
router.get('/assigned/:userId', ticketController.getTicketsByAssignedUserId);
router.patch('/:id', verificarToken, ticketController.updateTicket);
router.delete('/:id', verificarToken, ticketController.deleteTicket);

module.exports = router;
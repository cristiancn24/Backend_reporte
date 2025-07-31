const express = require('express');
const router = express.Router();
const officesController = require('../controllers/officesController');
const verificarToken = require('../middlewares/auth');

router.get('/', officesController.getAllOffices);

module.exports = router;
const express = require('express');
const router = express.Router();
const officesController = require('../controllers/officesController');
const verificarToken = require('../middlewares/auth');

router.get('/', officesController.getAllOffices);
router.post('/', verificarToken, officesController.createOffice);

module.exports = router;
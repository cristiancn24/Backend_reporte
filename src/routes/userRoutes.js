const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getAllUsers);
router.get('/estadisticas', userController.getEstadisticasSoportes);
router.get('/tecnicos', userController.getTechnicians);

module.exports = router;
const express = require('express');
const router = express.Router();
const departmentsController = require('../controllers/departmentsController');
const verificarToken = require('../middlewares/auth');

router.get('/', departmentsController.getAllDepartments);

module.exports = router;
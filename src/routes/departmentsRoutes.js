const express = require('express');
const router = express.Router();
const departmentsController = require('../controllers/departmentsController');
const verificarToken = require('../middlewares/auth');

router.get('/', departmentsController.getAllDepartments);
router.post('/', verificarToken, departmentsController.createDepartment);

module.exports = router;
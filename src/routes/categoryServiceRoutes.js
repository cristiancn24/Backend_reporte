const express = require('express');
const router = express.Router();
const categoryServicesController = require('../controllers/categoryServicesController');
const verificarToken = require('../middlewares/auth');

router.get('/', categoryServicesController.getAllCategoryServices);
router.post('/', verificarToken, categoryServicesController.createCategoryService);
router.patch('/:id', verificarToken, categoryServicesController.toggleActive);

module.exports = router;
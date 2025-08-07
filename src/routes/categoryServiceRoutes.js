const express = require('express');
const router = express.Router();
const categoryServicesController = require('../controllers/categoryServicesController');
const verificarToken = require('../middlewares/auth');

router.get('/', categoryServicesController.getAllCategoryServices);
router.post('/', verificarToken, categoryServicesController.createCategoryService);

module.exports = router;
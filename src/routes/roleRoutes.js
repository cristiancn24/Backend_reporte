const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const verificarToken = require('../middlewares/auth');

router.get('/', verificarToken, roleController.getAllRoles);
router.post('/', verificarToken, roleController.createRole);
router.patch('/:id', verificarToken, roleController.updateRole);
router.delete('/:id', verificarToken, roleController.deleteRole);

module.exports = router;

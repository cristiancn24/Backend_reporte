const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const verificarToken = require('../middlewares/auth');

router.get('/', permissionController.getAllPermissions);
router.get('/:id', permissionController.getPermissionById);
router.post('/', verificarToken, permissionController.createPermission);
router.patch('/:id', verificarToken, permissionController.updatePermission);
router.delete('/:id', verificarToken, permissionController.deletePermission);

module.exports = router;

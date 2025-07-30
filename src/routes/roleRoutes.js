const express = require('express');
const router = express.Router();
const faqController = require('../controllers/roleController');
const verificarToken = require('../middlewares/auth');

router.get('/', faqController.getAllRoles);
router.post('/', verificarToken, faqController.createRole);
router.patch('/:id', verificarToken, faqController.updateRole);
router.delete('/:id', verificarToken, faqController.deleteRole);

module.exports = router;

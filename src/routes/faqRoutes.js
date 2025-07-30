const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const verificarToken = require('../middlewares/auth');

router.get('/', faqController.getAllFAQs);
router.get('/:id', faqController.getFAQById);
router.post('/', verificarToken, faqController.createFAQ);
router.patch('/:id', verificarToken, faqController.updateFAQ);
router.delete('/:id', verificarToken, faqController.deleteFAQ);

module.exports = router;
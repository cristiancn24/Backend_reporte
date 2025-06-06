const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getAllUsers);
router.get('/estadisticas', userController.getEstadisticasSoportes);
router.get('/tecnicos', userController.getTechnicians);
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        const result = await userController.login(email, password);
        res.json(result);
    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(401).json({ error: error.message || 'Error de autenticación' });
    }
});
router.post('/logout', userController.logout);


module.exports = router;
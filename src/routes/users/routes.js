const express = require('express');
const response = require('../../services/responses');
const controller = require('./index');

const router = express.Router();

router.get('/', getAll);
router.get('/soportes', getSoportesActivos); 
router.get('/soportes/estadisticas', getEstadisticasSoportes); // Nueva ruta para estadísticas de soportes
router.get('/:id', getOne);
router.post('/login', login);  // Cambiado de GET a POST

async function getAll(req, res) {
    try {
        const items = await controller.getAll();
        response.success(req, res, items, 200);
    } catch (err) {
        response.error(req, res, err, 500);
    }
}

async function getOne(req, res) {
    try {
        const items = await controller.getOne(req.params.id);
        response.success(req, res, items, 200);
    } catch (err) {
        response.error(req, res, err, 500);
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y password son requeridos'
            });
        }

        const result = await controller.login(email, password);
        
        // Envía los datos del usuario directamente en el nivel superior
        res.json({
            ...result.user,  // Todos los campos del usuario
            token: result.token  // Token también en nivel superior
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
}

async function getSoportesActivos(req, res, next)  {
    try {
        const soportes = await controller.getSoportesActivos();
        
        res.status(200).json({
            success: true,
            count: soportes.length,
            data: soportes
        });
        
    } catch (error) {
        console.error('Error en GET /soportes:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function getEstadisticasSoportes(req, res) {
    try {
        // Extraer parámetros de fecha
        const filters = {
            range: req.query.fechaInicio && req.query.fechaFin ? 
                [new Date(req.query.fechaInicio), new Date(req.query.fechaFin)] : null,
            singleDate: req.query.fecha ? new Date(req.query.fecha) : null
        };

        // Depuración
        console.log('Filtros recibidos:', filters);

        const items = await controller.getEstadisticasSoportes(filters);
        
        res.status(200).json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (err) {
        console.error('Error en getEstadisticasSoportes:', err);
        res.status(500).json({
            success: false,
            message: err.message,
            // Solo en desarrollo
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
}

module.exports = router;

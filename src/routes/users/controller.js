const bcrypt = require('bcrypt');
const auth = require('../../auth');
const { getTicketsBySoporte } = require('../../DB/mysql');

module.exports = function (dbInyected) {
    let db = dbInyected;

    if (!db) {
        db = require('../../DB/mysql');
    }

    function getAll() {
        return db.getAll('users');
    }

    function getOne(id) {
        return db.getOne('users', id);
    }

   // Versión CORREGIDA del controlador
   async function login(email, password) {
    // 1. Buscar usuario por email
    const user = await db.query('users', { email });
    if (!user || user.length === 0) {
        throw new Error('Usuario no encontrado');
    }

    // 2. Verificar contraseña
    const storedHash = user[0].password.replace('$2y$', '$2a$');
    const passwordMatch = await bcrypt.compare(password, storedHash);
    
    if (!passwordMatch) {
        throw new Error('Contraseña incorrecta');
    }

    // 3. Generar token y devolver datos
    const token = auth.asignarToken({ 
        id: user[0].id, 
        email: user[0].email 
    });

    return {
        token,
        user: {
            id: user[0].id,
            email: user[0].email,
            nombre: user[0].first_name,
            apellido: user[0].last_name
        }
    };
}

    async function getSoportesActivos() {
        try {
            const soportes = await db.getSoportesActivos();
            
            // Validación adicional de datos
            const soportesValidados = soportes.map(soporte => ({
                id: soporte.id || 0,
                first_name: soporte.first_name || '',
                last_name: soporte.last_name || ''
            }));
            
            return soportesValidados;
        } catch (error) {
            console.error('Error en controller.getSoportesActivos:', error);
            throw new Error('No se pudieron obtener los soportes activos');
        }
    }

    async function getEstadisticasSoportes(filters = {}) {
        try {
            console.log('Filtros recibidos en controller:', filters);
            
            const soportes = await db.getSoportesActivos();
            const data = await Promise.all(
                soportes.map(async (soporte) => {
                    const stats = await db.getTicketsBySoporte(soporte.id, filters);
                    console.log(`Estadísticas para soporte ${soporte.id}:`, stats);
                    return {
                        ...soporte,
                        ticketsAbiertos: stats.abiertos || 0,
                        ticketsCerrados: stats.cerrados || 0,
                        promedioTiempo: stats.promedio_minutos || 0
                    };
                })
            );
    
            // Devuelve SOLO el array de datos que espera el frontend
            return data;
            
        } catch (error) {
            console.error('Error completo en getEstadisticasSoportes:', error);
            throw error;
        }
    }
    

    return {
        getAll,
        getOne,
        login,
        getSoportesActivos,
        getEstadisticasSoportes,
        getTicketsBySoporte,
    };
}

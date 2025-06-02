const { get } = require('./routes');

module.exports = function (dbInyected) {

    let db = dbInyected;

    if (!db) {
        db = require('../../DB/mysql');
    }
    
    function getOne (id) {  
        return db.getOne('tickets', id);
    }

    function getTicketsSoportes () {
        return db.getTicketsSoportes();
    }

    function getTicketsByUserId (id) {
        return db.getTicketsByUserId(id);
    }

    async function getTickets(filters = {}) {
        try {
            // Parte base de la consulta
            let query = `
                SELECT 
                    t.id,
                    CONCAT('TKT-', LPAD(t.id, 3, '0')) as ticket_id,
                    t.subject as asunto,
                    ts.name as estado,
                    t.description as descripcion,
                    u_creador.name as creadoPor,
                    IFNULL(u_asignado.name, 'No asignado') as asignadoA,
                    DATE_FORMAT(t.created_at, '%d %b %Y, %H:%i') as fechaCreacion,
                    t.created_at as fechaCreacionObj,
                    CASE 
                        WHEN t.closed_at IS NOT NULL 
                        THEN CONCAT(
                            FLOOR(TIMESTAMPDIFF(DAY, t.created_at, t.closed_at)), 'd ',
                            FLOOR(TIMESTAMPDIFF(HOUR, t.created_at, t.closed_at) % 24), 'h ',
                            FLOOR(TIMESTAMPDIFF(MINUTE, t.created_at, t.closed_at) % 60), 'm'
                        )
                        ELSE '-' 
                    END as tiempoResolucion
                FROM tickets t
                JOIN ticket_statuses ts ON t.status_id = ts.id
                JOIN users u_creador ON t.user_id = u_creador.id
                LEFT JOIN users u_asignado ON t.assigned_user_id = u_asignado.id
                WHERE 1=1
            `;
    
            const params = [];
    
            // Filtro por rango de fechas
            if (filters.range && filters.range[0] && filters.range[1]) {
                query += ` AND t.created_at BETWEEN ? AND ?`;
                params.push(
                    new Date(filters.range[0]),
                    new Date(filters.range[1])
                );
            } 
            // Filtro por fecha exacta
            else if (filters.singleDate) {
                const startDate = new Date(filters.singleDate);
                startDate.setHours(0, 0, 0, 0);
                
                const endDate = new Date(filters.singleDate);
                endDate.setHours(23, 59, 59, 999);
                
                query += ` AND t.created_at BETWEEN ? AND ?`;
                params.push(startDate, endDate);
            }
    
            // Filtro por estados
            if (filters.estados && filters.estados.length > 0) {
                query += ` AND ts.name IN (?)`;
                params.push(filters.estados);
            }
    
            // Filtro por asignados (maneja "No asignado" correctamente)
            if (filters.asignados && filters.asignados.length > 0) {
                const hasUnassigned = filters.asignados.includes('No asignado');
                const assignedUsers = filters.asignados.filter(a => a !== 'No asignado');
                
                if (assignedUsers.length > 0 && hasUnassigned) {
                    query += ` AND (u_asignado.name IN (?) OR t.assigned_user_id IS NULL)`;
                    params.push(assignedUsers);
                } else if (assignedUsers.length > 0) {
                    query += ` AND u_asignado.name IN (?)`;
                    params.push(assignedUsers);
                } else if (hasUnassigned) {
                    query += ` AND t.assigned_user_id IS NULL`;
                }
            }
    
            // Filtro por texto de búsqueda
            if (filters.searchText) {
                query += ` AND (
                    t.subject LIKE ? OR 
                    t.description LIKE ? OR 
                    u_creador.name LIKE ? OR 
                    IFNULL(u_asignado.name, '') LIKE ?
                )`;
                const searchTerm = `%${filters.searchText}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }
    
            // Agregar ordenación por defecto
            query += ` ORDER BY t.created_at DESC`;
    
            console.log('Consulta SQL final:', query); // Para depuración
            console.log('Parámetros:', params); // Para depuración
    
            // Ejecutar consulta
            const results = await db.query(query, params);
            
            return results.map(ticket => ({
                ...ticket,
                fechaCreacionObj: new Date(ticket.fechaCreacionObj)
            }));
            
        } catch (error) {
            console.error('Error en getTickets:', error);
            throw new Error('Error al obtener tickets de la base de datos');
        }
    }

    return {
        getOne,
        getTicketsSoportes,
        getTicketsByUserId,
        getTickets,
    }
}
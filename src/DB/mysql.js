const mysql = require('mysql');
const config = require('../config');

const dbconfig = {
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
}

let connection;

function handleCon () {
    connection = mysql.createConnection(dbconfig);

    connection.connect((err) => {
        if (err) {
            console.error('[db err]', err);
            setTimeout(handleCon, 2000);
        } else {
            console.log('DB Connected!');
        }
    });

    connection.on('error', err => {
        console.error('[db err]', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleCon();
        } else {
            throw err;
        }
    });

}

handleCon();

    connection.on('error', err => {
        console.error('[db err]', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleCon();
        } else {
            throw err;
        }
    });


function getAll (table) {
    return new Promise((resolve, reject) => {
        connection.query(`SELECT * FROM ${table}`, (err, data) => {
            return err ?  reject(err) : resolve(data);
        });
    });	
}

function getOne (table, id) {
    return new Promise((resolve, reject) => {
        connection.query(`SELECT * FROM ${table} WHERE id = ${id}`, (err, data) => {
            return err ?  reject(err) : resolve(data);
        });
    });	
}

function query (table, consulta) {
    return new Promise((resolve, reject) => {
        connection.query(`SELECT * FROM ${table} WHERE ?`, consulta, (err, data) => {
            return err ?  reject(err) : resolve(data);
        });
    });	
}

function getTicketsSoportes () {
    return new Promise((resolve, reject) => {
        connection.query(`SELECT t. * FROM tickets t INNER JOIN users u ON t.user_id = u.id WHERE u.role_id = 4 AND u.activated = 1`, (err, data) => {
            return err ?  reject(err) : resolve(data);
        });
    });	
}

function getTicketsByUserId(id) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM tickets WHERE assigned_user_id = ?`;
        connection.query(query, [id], (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function getClosedTicketsByUserId(id) {
    return new Promise((resolve, reject) => {
        const query = `SELECT COUNT(*) AS closed_tickets FROM tickets WHERE assigned_user_id = ? AND status_id = 5`;
        connection.query(query, [id], (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data[0]); // Devuelve el primer (y único) resultado
            }
        });
    });
}

function getOpenedTicketsByUserId(id) {
    return new Promise((resolve, reject) => {
        const query = `SELECT COUNT(*) AS opened_tickets FROM tickets WHERE assigned_user_id = ? AND status_id IN (4, 7, 8)`;
        connection.query(query, [id], (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data[0]); // Devuelve el primer (y único) resultado
            }
        });
    });
}

// Versión corregida de tu función original
function getSoportesActivos() {
    return new Promise((resolve, reject) => {
        connection.query(
            `SELECT id, first_name, last_name FROM users WHERE role_id = 4 AND activated = 1 AND office_id = 1 AND dashboard_position IN (1, 2)`,
            (err, results) => {
                if (err) {
                    console.error('Error en getSoportesActivos:', err);
                    return reject(new Error('Error al obtener soportes activos'));
                }
                // Asegurar que siempre se resuelve con un array
                resolve(Array.isArray(results) ? results : []);
            }
        );
    });
}

function getTicketsBySoporte(soporteId, filters = {}) {
    return new Promise((resolve, reject) => {
        let query = `
            SELECT 
                SUM(CASE WHEN t.status_id IN (1, 3, 4, 7, 8) THEN 1 ELSE 0 END) as abiertos,
                SUM(CASE WHEN t.status_id = 5 THEN 1 ELSE 0 END) as cerrados,
                AVG(
                    CASE WHEN th_cierre.created_at IS NOT NULL 
                    THEN TIMESTAMPDIFF(MINUTE, th_asignacion.created_at, th_cierre.created_at)
                    ELSE NULL END
                ) as promedio_minutos
            FROM ticket_histories th_asignacion
            JOIN tickets t ON th_asignacion.ticket_id = t.id
            LEFT JOIN ticket_histories th_cierre ON (
                th_cierre.ticket_id = t.id 
                AND th_cierre.status_id = 5
            )
            WHERE th_asignacion.status_id = 3
            AND t.assigned_user_id = ?
        `;

        const params = [soporteId];

        // Filtro por defecto (últimos 30 días) si no hay otros filtros
        if (!filters.range && !filters.singleDate) {
            query += ` AND th_asignacion.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
        } 
        // Filtros específicos si existen
        else if (filters.range) {
            query += ` AND DATE(th_asignacion.created_at) BETWEEN ? AND ?`;
            params.push(
                filters.range[0].toISOString().split('T')[0],
                filters.range[1].toISOString().split('T')[0]
            );
        } else if (filters.singleDate) {
            query += ` AND DATE(th_asignacion.created_at) = ?`;
            params.push(filters.singleDate.toISOString().split('T')[0]);
        }

        console.log('Consulta SQL corregida:', query.replace(/\s+/g, ' '));
        console.log('Parámetros:', params);

        // 3. Ejecución
        connection.query(query, params, (err, results) => {
            if (err) {
                console.error('Error en getTicketsBySoporte:', err);
                return reject(err);
            }
            
            const result = results[0] || { abiertos: 0, cerrados: 0, promedio_minutos: null };
            
            // Conversión segura de valores
            result.abiertos = Number(result.abiertos) || 0;
            result.cerrados = Number(result.cerrados) || 0;
            result.promedio_minutos = result.promedio_minutos !== null ? 
                Number(result.promedio_minutos) : null;
            
            console.log('Resultado para soporte', soporteId, ':', result);
            resolve(result);
        });
    });
}

async function getEstadisticasSoportes(filters = {}) {
    try {
        const soportes = await getSoportesActivos();
        
        const estadisticas = await Promise.all(
            soportes.map(async (soporte) => {
                const stats = await getTicketsBySoporte(soporte.id, filters);
                return {
                    ...soporte,
                    ticketsAbiertos: stats.abiertos,
                    ticketsCerrados: stats.cerrados,
                    promedioTiempo: stats.promedio_minutos || 0
                };
            })
        );

        return estadisticas;
    } catch (error) {
        console.error('Error en getEstadisticasSoportes:', error);
        throw error;
    }
}



function Insert (table, data) {

}

function Update (table, id, data) {

}

function Delete (table, id) {

}


module.exports = {
  getAll,
  getOne,
  Insert,
  Update,
  Delete,
  query,
  getTicketsSoportes,
  getTicketsByUserId,
  getClosedTicketsByUserId,
  getOpenedTicketsByUserId,
  getSoportesActivos,
  getEstadisticasSoportes,
  getTicketsBySoporte,
}
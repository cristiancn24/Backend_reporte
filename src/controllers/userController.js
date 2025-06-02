const { users_activated } = require('@prisma/client/wasm');
const prisma = require('../db');
const { Prisma } = require('@prisma/client');

const userController = {
  // Obtener todos los usuarios
  getAllUsers: async (req, res) => {
    try {
      const users = await prisma.users.findMany({
        where: { deleted_at: null },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          roles: true,
          offices: true,
          created_at: true
        }
      });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Obtener usuario por ID
  getUserById: async (req, res) => {
    try {
      const user = await prisma.users.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          roles: true,
          offices: true,
          departments: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Crear nuevo usuario
  createUser: async (req, res) => {
    try {
      const newUser = await prisma.users.create({
        data: {
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          email: req.body.email,
          password: req.body.password, // Asegúrate de hashear esto
          role_id: req.body.role_id,
          office_id: req.body.office_id,
          department_id: req.body.department_id
        }
      });
      res.status(201).json(newUser);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Actualizar usuario
  updateUser: async (req, res) => {
    try {
      const updatedUser = await prisma.users.update({
        where: { id: parseInt(req.params.id) },
        data: req.body
      });
      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Eliminar usuario (soft delete)
  deleteUser: async (req, res) => {
    try {
      await prisma.users.update({
        where: { id: parseInt(req.params.id) },
        data: { deleted_at: new Date() }
      });
      res.json({ message: 'Usuario marcado como eliminado' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Estadísticas de soportes - Versión corregida
getEstadisticasSoportes: async (req, res) => {
  try {
    const ROL_SOPORTE = 4;
    
    // Configuración de fechas
    const dateCondition = {};
    if (req.query.startDate && req.query.endDate) {
      dateCondition.gte = new Date(req.query.startDate);
      dateCondition.lte = new Date(req.query.endDate);
    } else {
      dateCondition.gte = new Date(new Date().setDate(new Date().getDate() - 30));
      dateCondition.lte = new Date();
    }

    // Obtener soportes activos
    const soportes = await prisma.users.findMany({
      where: {
        role_id: ROL_SOPORTE,
        deleted_at: null,
        activated: "active",
        office_id: 1,
        dashboard_position: {
    in: [1, 2]
  }
      },
      select: {
        id: true,
        first_name: true,
        last_name: true
      }
    });

    // Calcular métricas para cada soporte
    const estadisticas = await Promise.all(
      soportes.map(async (soporte) => {
        // Tickets abiertos y cerrados
        const abiertos = await prisma.tickets.count({
          where: {
            assigned_user_id: soporte.id,
            status_id: { in: [1, 3, 4, 7, 8] },
            created_at: dateCondition
          }
        });

        const cerrados = await prisma.tickets.count({
          where: {
            assigned_user_id: soporte.id,
            status_id: 5,
            created_at: dateCondition
          }
        });

        // CONSULTA CORREGIDA PARA TIEMPO PROMEDIO
        const resoluciones = await prisma.$queryRaw`
          SELECT 
            AVG(
              TIMESTAMPDIFF(
                MINUTE,
                t.created_at,
                th_cierre.created_at
              )
            ) as promedio_minutos
          FROM tickets t
          JOIN ticket_histories th_cierre ON t.id = th_cierre.ticket_id
          WHERE t.assigned_user_id = ${soporte.id}
          AND th_cierre.status_id = 5
          AND t.status_id = 5
          AND th_cierre.created_at BETWEEN ${dateCondition.gte} AND ${dateCondition.lte}
          AND t.created_at BETWEEN ${dateCondition.gte} AND ${dateCondition.lte}
          AND th_cierre.created_at > t.created_at
        `;

        return {
          ...soporte,
          ticketsAbiertos: abiertos,
          ticketsCerrados: cerrados,
          promedioTiempo: resoluciones[0]?.promedio_minutos 
            ? Math.round(resoluciones[0].promedio_minutos)
            : 0
        };
      })
    );

    res.json({
      success: true,
      data: estadisticas
    });
  } catch (error) {
    console.error('Error en getEstadisticasSoportes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener estadísticas',
      details: error.message 
    });
  }
},

  // Función auxiliar para tickets por soporte
  getTicketsBySoporte: async (soporteId, filters = {}) => {
    try {
      let dateFilter = {};
      
      if (!filters.range && !filters.singleDate) {
        dateFilter = {
          created_at: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        };
      } else if (filters.range) {
        dateFilter = {
          created_at: {
            gte: new Date(filters.range[0]),
            lte: new Date(filters.range[1])
          }
        };
      } else if (filters.singleDate) {
        const date = new Date(filters.singleDate);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        
        dateFilter = {
          created_at: {
            gte: date,
            lt: nextDay
          }
        };
      }

      const ticketsAbiertos = await prisma.ticket_histories.count({
        where: {
          status_id: 3,
          tickets: {
            assigned_user_id: soporteId
          },
          ...dateFilter
        }
      });

      const ticketsCerrados = await prisma.ticket_histories.count({
        where: {
          status_id: 5,
          tickets: {
            assigned_user_id: soporteId
          },
          ...dateFilter
        }
      });

      const tiemposResolucion = await prisma.$queryRaw`
        SELECT AVG(
          TIMESTAMPDIFF(
            MINUTE, 
            (SELECT MIN(created_at) 
             FROM ticket_histories 
             WHERE ticket_id = t.id AND status_id = 3),
            (SELECT MIN(created_at) 
             FROM ticket_histories 
             WHERE ticket_id = t.id AND status_id = 5)
          )
        ) as promedio_minutos
        FROM tickets t
        WHERE t.assigned_user_id = ${soporteId}
        AND EXISTS (
          SELECT 1 FROM ticket_histories 
          WHERE ticket_id = t.id AND status_id = 5
        )
        ${filters.range ? Prisma.sql`AND (SELECT MIN(created_at) FROM ticket_histories WHERE ticket_id = t.id AND status_id = 3) BETWEEN ${new Date(filters.range[0])} AND ${new Date(filters.range[1])}` : Prisma.empty}
        ${filters.singleDate ? Prisma.sql`AND DATE((SELECT MIN(created_at) FROM ticket_histories WHERE ticket_id = t.id AND status_id = 3)) = DATE(${new Date(filters.singleDate)})` : Prisma.empty}
      `;

      return {
        abiertos: ticketsAbiertos,
        cerrados: ticketsCerrados,
        promedio_minutos: tiemposResolucion[0]?.promedio_minutos || null
      };
    } catch (error) {
      console.error('Error en getTicketsBySoporte:', error);
      throw error;
    }
  },

  // Buscar usuarios
  searchUsers: async (req, res) => {
    try {
      const users = await prisma.users.findMany({
        where: {
          OR: [
            { first_name: { contains: req.params.term, mode: 'insensitive' } },
            { last_name: { contains: req.params.term, mode: 'insensitive' } },
            { email: { contains: req.params.term, mode: 'insensitive' } }
          ],
          deleted_at: null
        },
        take: 20
      });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTechnicians: async (req, res) => {
    try {
      const technicians = await prisma.users.findMany({
        where: {
          role_id: 4,
          deleted_at: null,
          activated: "active",
          office_id: 1,
          dashboard_position: {
            in: [1, 2]
          }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true
        },
        orderBy: {
          first_name: 'asc'
        }
      });
      
      res.json(technicians);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = userController;
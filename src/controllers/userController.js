const { users_activated } = require('@prisma/client/wasm');
const bcrypt = require('bcrypt');
const prisma = require('../db');
const { Prisma } = require('@prisma/client');
const { asignarToken } = require('../auth');
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || require('../config').jwt.secret;


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


    console.log(req.user);

    if (req.user?.role_id !== 1) {
      return res.status(403).json({ error: 'No tienes permisos para crear usuarios' });
    }

    const { first_name, last_name, email, password, role_id, office_id, department_id } = req.body;

    if (!first_name || !last_name || !email || !password || !role_id) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.users.create({
  data: {
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    email: req.body.email,
    password: hashedPassword,
    office_id: parseInt(req.body.office_id),
    department_id: parseInt(req.body.department_id),
    role_id: parseInt(req.body.role_id),
    created_at: new Date(),
    updated_at: new Date()
  }
});

    res.status(201).json({
      id: newUser.id,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      email: newUser.email,
      role_id: newUser.role_id
    });
  } catch (error) {
    console.error('Error en createUser:', error);
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
        dashboard_position: { in: [1, 2] }
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
        // Tickets abiertos y cerrados (manteniendo misma lógica)
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

        // Consulta SQL compatible y corregida
        const resoluciones = await prisma.$queryRaw`
          SELECT 
            AVG(
              TIMESTAMPDIFF(
                MINUTE,
                (SELECT MIN(th_inicio.created_at) 
                 FROM ticket_histories th_inicio 
                 WHERE th_inicio.ticket_id = t.id AND th_inicio.status_id = 3),
                (SELECT MIN(th_cierre.created_at)
                 FROM ticket_histories th_cierre
                 WHERE th_cierre.ticket_id = t.id AND th_cierre.status_id = 5)
              )
            ) as promedio_minutos
          FROM tickets t
          WHERE t.assigned_user_id = ${soporte.id}
            AND t.status_id = 5
            AND t.created_at BETWEEN ${dateCondition.gte} AND ${dateCondition.lte}
            AND EXISTS (
              SELECT 1 FROM ticket_histories th
              WHERE th.ticket_id = t.id AND th.status_id = 3
            )
        `;

        // Manteniendo el mismo formato de respuesta original
        return {
          ...soporte,
          ticketsAbiertos: abiertos,
          ticketsCerrados: cerrados,
          promedioTiempo: resoluciones[0]?.promedio_minutos 
            ? Math.round(resoluciones[0].promedio_minutos) // Manteniendo en minutos como antes
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
  },

  login: async (email, password) => {
    console.log('Credenciales recibidas:', { email, password });
        try {
            // 1. Buscar usuario por email
            const user = await prisma.users.findUnique({
                where: { email }
            });

            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // 2. Verificar contraseña
            const storedHash = user.password.replace('$2y$', '$2a$');
            const passwordMatch = await bcrypt.compare(password, storedHash);
            
            if (!passwordMatch) {
                throw new Error('Contraseña incorrecta');
            }

            // 3. Generar token usando la función importada
            const token = asignarToken({ 
                id: user.id, 
                email: user.email,
                role_id: user.role_id
            });

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    nombre: user.first_name,
                    apellido: user.last_name,
                    role_id: user.role_id,
                }
            };
        } catch (error) {
            console.error('Error en login:', error);
            
            // Mejoramos el manejo de errores
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                throw new Error('Error de base de datos');
            }
            
            throw error; // Re-lanzamos otros errores
        }
    },

    logout: async (req, res) => {
      console.log("👉 Cookie recibida:", req.headers.cookie);
  const cookie = require("cookie");
  const jwt = require("jsonwebtoken");
  const secret = process.env.JWT_SECRET || require('../config').jwt.secret;

  try {
    const rawCookies = req.headers.cookie;

    // 🔐 1. Validar si existen cookies
    if (!rawCookies) {
      return res.status(401).json({ error: "No autenticado. Cookie no encontrada." });
    }

    // 🔍 2. Parsear cookies y obtener auth_token
    const cookies = cookie.parse(rawCookies);
    const token = cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: "No autenticado. auth_token no encontrado." });
    }

    // 🔐 3. Verificar el JWT
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    // ✅ 4. Si todo está bien, eliminar cookie
    const serialized = cookie.serialize("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/"
    });

    res.setHeader("Set-Cookie", serialized);

    return res.status(200).json({
      success: true,
      message: "Sesión cerrada exitosamente",
      user: {
        id: decoded.id,
        email: decoded.email
      }
    });

  } catch (error) {
    console.error("Error en logout:", error);
    res.status(500).json({ error: "Error al cerrar sesión" });
  }
}




};

module.exports = userController;
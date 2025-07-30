const prisma = require('../db');
const { tickets_priority } = require('@prisma/client');


// Función robusta para formatear fecha en 24 horas
const formatDate24h = (dateString) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Fecha inválida';
    
    // Usamos toISOString() para evitar problemas de zona horaria
    const isoString = d.toISOString();
    const [year, month, day] = isoString.substr(0, 10).split('-');
    const [hours, minutes] = isoString.substr(11, 5).split(':');
    const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    return `${day} ${monthNames[parseInt(month)-1]} ${year}, ${hours}:${minutes}`;
};

const ticketController = {
    getTicketsForTable: async (req, res) => {
        try {
            const { 
                page = 1, 
                limit = 100, 
                sortField = 'created_at', 
                sortOrder = 'desc',
                estados = [],
                asignados = [],
                searchText,
                fechaExacta
            } = req.query;

            const skip = (page - 1) * limit;

            // Construir objeto where
            const where = {
                users_tickets_assigned_user_idTousers: {
                    role_id: 4
                }
            };

            // Aplicar filtros
            if (estados?.length > 0) {
                where.ticket_status = {
                    id: { in: estados.map(id => parseInt(id)) }
                };
            }

            if (asignados?.length > 0) {
                where.OR = asignados.map(item => {
                    if (item === 'No asignado') return { assigned_user_id: null };
                    return { assigned_user_id: parseInt(item) };
                });
            }

            if (fechaExacta) {
                const date = new Date(fechaExacta);
                const nextDay = new Date(date);
                nextDay.setDate(date.getDate() + 1);
                
                where.created_at = {
                    gte: date,
                    lt: nextDay
                };
            }

            if (searchText) {
                const searchLower = searchText.toLowerCase();
                where.OR = [
                    { subject: { contains: searchLower } },
                    { comment: { contains: searchLower } }
                ];

                // Búsqueda por número de ticket (TKT-001 o solo 001)
                const ticketNumberMatch = searchLower.match(/^tkt-?(\d+)$/i) || 
                                        searchLower.match(/^(\d+)$/);
                
                if (ticketNumberMatch) {
                    const ticketId = parseInt(ticketNumberMatch[1]);
                    where.OR.push({ id: ticketId });
                }
            }

            // Consulta a la base de datos
            const tickets = await prisma.tickets.findMany({
                skip,
                take: parseInt(limit),
                orderBy: { [sortField]: sortOrder },
                include: {
                    ticket_status: { select: { name: true } },
                    users_tickets_user_idTousers: { select: { first_name: true, last_name: true } },
                    users_tickets_assigned_user_idTousers: { 
                        select: { first_name: true, last_name: true, role_id: true } 
                    },
                    ticket_histories: {
                        select: { status_id: true, created_at: true },
                        orderBy: { created_at: 'asc' }
                    }
                },
                where
            });

            // Calcular tiempo de resolución
            const calculateResolutionTime = (histories, ticketStatus) => {
                if (ticketStatus !== 'Cerrado' || !histories?.length) return '-';
                
                try {
                    const openedHistory = histories.find(h => h.status_id === 3);
                    const closedHistory = histories.find(h => h.status_id === 5);
                    if (!openedHistory || !closedHistory) return '-';
                    
                    const diffMs = new Date(closedHistory.created_at) - new Date(openedHistory.created_at);
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    
                    return [
                        diffDays > 0 ? `${diffDays}d` : null,
                        diffHours > 0 ? `${diffHours}h` : null,
                        diffMins > 0 ? `${diffMins}m` : null
                    ].filter(Boolean).join(' ') || '<1m';
                } catch (e) {
                    console.error('Error calculando tiempo:', e);
                    return '-';
                }
            };

            // Formatear respuesta
            const formattedTickets = tickets.map(ticket => {
                const statusName = ticket.ticket_status?.name || 'Desconocido';
                return {
                    id: ticket.id,
                    ticket: `TKT-${ticket.id.toString().padStart(3, '0')}`,
                    subject: ticket.subject,
                    comment: ticket.comment,
                    created_by: ticket.users_tickets_user_idTousers 
                        ? `${ticket.users_tickets_user_idTousers.first_name} ${ticket.users_tickets_user_idTousers.last_name}`
                        : 'Desconocido',
                    assigned_to: ticket.users_tickets_assigned_user_idTousers 
                        ? `${ticket.users_tickets_assigned_user_idTousers.first_name} ${ticket.users_tickets_assigned_user_idTousers.last_name}`
                        : 'No asignado',
                    status: statusName,
                    created_at: formatDate24h(ticket.created_at),
                    resolution_time: calculateResolutionTime(ticket.ticket_histories, statusName),
                    assigned_user_role: ticket.users_tickets_assigned_user_idTousers?.role_id || null
                };
            });

            const total = await prisma.tickets.count({ where });

            res.json({
                success: true,
                data: formattedTickets,
                pagination: {
                    total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: parseInt(page),
                    perPage: parseInt(limit),
                },
            });
        } catch (error) {
            console.error('Error en getTicketsForTable:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener tickets',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getStatusOptions: async (req, res) => {
        try {
            const statuses = await prisma.ticket_status.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });
            res.json(statuses);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    createTicket: async (req, res) => {
    try {

         const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
        const {
            subject,
            comment,
            department_id,
            category_service_id = null,
            user_id = userId,
            priority = null,
            validated = null,
            office_support_to = 1,
            assigned_user_id = null,
            office_id = null,
        } = req.body;

        if (!subject || !comment || !department_id) {
            return res.status(400).json({
                success: false,
                error: 'Los campos subject, comment y department_id son obligatorios'
            });
        }

        const ticket = await prisma.tickets.create({
            data: {
                subject,
                comment,
                department_id,
                category_service_id,
                user_id,
                priority: priority ? tickets_priority[priority] : null,
                validated,
                office_support_to,
                assigned_user_id,
                office_id,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        res.status(201).json({
            success: true,
            message: 'Ticket creado correctamente',
            data: {
                id: ticket.id,
                ticket: `TKT-${ticket.id.toString().padStart(3, '0')}`,
                ...ticket
            }
        });
    } catch (error) {
        console.error('Error en createTicket:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear ticket',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},

getTicketById: async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'ID de ticket inválido'
      });
    }

    const ticket = await prisma.tickets.findUnique({
      where: { id: parseInt(id) },
      include: {
        ticket_status: { select: { name: true } },
        users_tickets_user_idTousers: { select: { first_name: true, last_name: true } },
        users_tickets_assigned_user_idTousers: { 
          select: { first_name: true, last_name: true, role_id: true }
        },
        ticket_histories: {
          select: { status_id: true, created_at: true },
          orderBy: { created_at: 'asc' }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket no encontrado'
      });
    }

    const statusName = ticket.ticket_status?.name || 'Desconocido';
    const createdBy = ticket.users_tickets_user_idTousers
      ? `${ticket.users_tickets_user_idTousers.first_name} ${ticket.users_tickets_user_idTousers.last_name}`
      : 'Desconocido';
    const assignedTo = ticket.users_tickets_assigned_user_idTousers
      ? `${ticket.users_tickets_assigned_user_idTousers.first_name} ${ticket.users_tickets_assigned_user_idTousers.last_name}`
      : 'No asignado';

    res.json({
      success: true,
      data: {
        id: ticket.id,
        ticket: `TKT-${ticket.id.toString().padStart(3, '0')}`,
        subject: ticket.subject,
        comment: ticket.comment,
        created_by: createdBy,
        assigned_to: assignedTo,
        status: statusName,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        histories: ticket.ticket_histories
      }
    });
  } catch (error) {
    console.error('Error en getTicketById:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener ticket',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
},

getTicketsByAssignedUserId: async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        error: 'ID de usuario inválido'
      });
    }

    const tickets = await prisma.tickets.findMany({
      where: { assigned_user_id: parseInt(userId) },
      include: {
        ticket_status: { select: { name: true } },
        users_tickets_user_idTousers: { select: { first_name: true, last_name: true } },
        users_tickets_assigned_user_idTousers: { 
          select: { first_name: true, last_name: true, role_id: true }
        },
        ticket_histories: {
          select: { status_id: true, created_at: true },
          orderBy: { created_at: 'asc' }
        }
      }
    });

    const formattedTickets = tickets.map(ticket => {
      const statusName = ticket.ticket_status?.name || 'Desconocido';
      return {
        id: ticket.id,
        ticket: `TKT-${ticket.id.toString().padStart(3, '0')}`,
        subject: ticket.subject,
        comment: ticket.comment,
        created_by: ticket.users_tickets_user_idTousers 
          ? `${ticket.users_tickets_user_idTousers.first_name} ${ticket.users_tickets_user_idTousers.last_name}`
          : 'Desconocido',
        assigned_to: ticket.users_tickets_assigned_user_idTousers 
          ? `${ticket.users_tickets_assigned_user_idTousers.first_name} ${ticket.users_tickets_assigned_user_idTousers.last_name}`
          : 'No asignado',
        status: statusName,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at
      };
    });

    res.json({
      success: true,
      data: formattedTickets
    });
  } catch (error) {
    console.error('Error en getTicketsByAssignedUserId:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tickets asignados',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
},

updateTicket: async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, comment, status_id, assigned_user_id } = req.body;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'ID de ticket inválido'
            });
        }

        const ticket = await prisma.tickets.update({
            where: { id: parseInt(id) },
            data: {
                subject,
                comment,
                ticket_status_id: status_id,
                assigned_user_id,
                updated_at: new Date()
            }
        });

        res.json({
            success: true,
            message: 'Ticket actualizado correctamente',
            data: ticket
        });
    } catch (error) {
        console.error('Error en updateTicket:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar ticket',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},

deleteTicket: async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                error: 'ID de ticket inválido'
            });
        }

        await prisma.tickets.delete({
            where: { id: parseInt(id) }
        });

        res.json({
            success: true,
            message: 'Ticket eliminado correctamente'
        });
    } catch (error) {
        console.error('Error en deleteTicket:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar ticket',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }

},
};

module.exports = ticketController;
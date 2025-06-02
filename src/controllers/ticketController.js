const prisma = require('../db');

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

            // Construir objeto where con el filtro base de role_id = 4
            const where = {
                users_tickets_assigned_user_idTousers: {
                    role_id: 4
                }
            };

            // Añadir filtros adicionales si existen
            if (estados && estados.length > 0) {
                where.ticket_status = {
                id: { in: estados.map(id => parseInt(id)) } // Filtra por ID en lugar de nombre
            };
}

            if (asignados && asignados.length > 0) {
                where.OR = asignados.map(item => {
            if (item === 'No asignado') {
            return { assigned_user_id: null };
            }
            return { 
                assigned_user_id: parseInt(item) // Filtra directamente por ID
            };
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
        { 
            subject: { 
                contains: searchLower 
            } 
        },
        { 
            comment: { 
                contains: searchLower 
            } 
        }
    ];
}

            // Consulta principal con todos los filtros
            const tickets = await prisma.tickets.findMany({
                skip,
                take: parseInt(limit),
                orderBy: {
                    [sortField]: sortOrder,
                },
                include: {
                    ticket_status: {
                        select: {
                            name: true
                        }
                    },
                    users_tickets_user_idTousers: {
                        select: {
                            first_name: true,
                            last_name: true
                        }
                    },
                    users_tickets_assigned_user_idTousers: {
                        select: {
                            first_name: true,
                            last_name: true,
                            role_id: true
                        }
                    },
                    ticket_histories: {
                        select: {
                            status_id: true,
                            created_at: true
                        },
                        orderBy: {
                            created_at: 'asc'
                        }
                    }
                },
                where
            });

            // Función para calcular tiempo de resolución mejorada
            const calculateResolutionTime = (histories, ticketStatus) => {
                if (ticketStatus !== 'Cerrado') return '-';
                if (!histories || histories.length < 2) return '-';
                
                try {
                    const openedHistory = histories.find(h => h.status_id === 3);
                    const closedHistory = histories.find(h => h.status_id === 5);
                    
                    if (!openedHistory || !closedHistory) return '-';
                    
                    const diffMs = new Date(closedHistory.created_at) - new Date(openedHistory.created_at);
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    
                    // Formato más limpio
                    let result = [];
                    if (diffDays > 0) result.push(`${diffDays}d`);
                    if (diffHours > 0) result.push(`${diffHours}h`);
                    if (diffMins > 0) result.push(`${diffMins}m`);
                    
                    return result.length > 0 ? result.join(' ') : '<1m';
                } catch (e) {
                    console.error('Error calculating resolution time:', e);
                    return '-';
                }
            };

            // Formatear los tickets para el frontend
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
                    created_at: ticket.created_at.toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    resolution_time: calculateResolutionTime(ticket.ticket_histories, statusName),
                    assigned_user_role: ticket.users_tickets_assigned_user_idTousers?.role_id || null
                };
            });

            // Contar tickets con los mismos filtros
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
                error: 'Error al obtener los tickets',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    getStatusOptions: async (req, res) => {
    try {
      const statuses = await prisma.ticket_status.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      
      res.json(statuses);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ticketController;
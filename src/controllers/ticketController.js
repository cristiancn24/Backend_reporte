const prisma = require('../db');

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
    }
};

module.exports = ticketController;
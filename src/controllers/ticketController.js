// controllers/ticket.controller.js (CommonJS)
const prisma = require("../db");
const { Prisma } = require("@prisma/client");

// util
const initialsOf = (f = "", l = "") =>
  `${(f?.[0] || "").toUpperCase()}${(l?.[0] || "").toUpperCase()}`;

const formatDate24h = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
};

// Whitelist de ordenamiento -> mapea a columnas reales
const SORT_MAP = new Set(["created_at", "updated_at", "id", "status_id", "priority"]);

async function getTickets(req, res) {
  try {
    const page  = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 15, 1), 100);
    const skip  = (page - 1) * limit;

    let {
      q,
      statusId,
      priority,
      categoryId,
      officeId,
      officeSupportToId,
      departmentId,
      technicianId,
      dateFrom,
      dateTo,
      sortBy = "created_at",
      order  = "desc",
      latest // <-- '1' | 'true' | undefined
    } = req.query;

    const latestMode = String(latest).toLowerCase() === "1" || String(latest).toLowerCase() === "true";

    // filtros
    const where = {
      deleted_at: null,
      ...(statusId ?        { status_id: Number(statusId) } : {}),
      ...(priority ?        { priority } : {}),
      ...(categoryId ?      { category_service_id: Number(categoryId) } : {}),
      ...(officeId ?        { office_id: Number(officeId) } : {}),
      ...(officeSupportToId ? { office_support_to: Number(officeSupportToId) } : {}),
      ...(departmentId ?    { department_id: Number(departmentId) } : {}),
      ...(technicianId ?    { assigned_user_id: Number(technicianId) } : {}),
      ...((dateFrom || dateTo) && {
        created_at: {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00Z`) } : {}),
          ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59Z`) } : {}),
        },
      }),
      ...(q && {
        OR: [
          { subject: { contains: q } },
          ...(Number.isNaN(Number(q)) ? [] : [{ id: Number(q) }]),
        ],
      }),
    };

    let totalItems, rows;

    if (latestMode) {
      // 1) IDs de los 100 más recientes que cumplan
      const topIds = await prisma.tickets.findMany({
        where,
        select: { id: true },
        orderBy: { created_at: "desc" },
        take: 200,
      });
      const idList = topIds.map(x => x.id);

      // 2) pagina dentro de ese subconjunto
      totalItems = idList.length; // el total ahora es el tamaño del subconjunto
      rows = await prisma.tickets.findMany({
        where: { id: { in: idList } },
        skip,
        take: limit,
        orderBy: { created_at: "desc" }, // mantiene el orden dentro del subconjunto
        include: {
          ticket_status: { select: { id: true, name: true } },
          category_services: { select: { id: true, name: true } },
          departments: { select: { id: true, name: true } },
          offices_tickets_office_idTooffices: { select: { id: true, name: true } },
          offices_tickets_office_support_toTooffices: { select: { id: true, name: true } },
          users_tickets_assigned_user_idTousers: { select: { id: true, first_name: true, last_name: true } },
        },
      });
    } else {
      // paginación normal en todo el universo
      order = order?.toLowerCase() === "asc" ? "asc" : "desc";
      if (!["created_at","updated_at","id"].includes(sortBy)) sortBy = "created_at";

      const [count, list] = await Promise.all([
        prisma.tickets.count({ where }),
        prisma.tickets.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include: {
            ticket_status: { select: { id: true, name: true } },
            category_services: { select: { id: true, name: true } },
            departments: { select: { id: true, name: true } },
            offices_tickets_office_idTooffices: { select: { id: true, name: true } },
            offices_tickets_office_support_toTooffices: { select: { id: true, name: true } },
            users_tickets_assigned_user_idTousers: { select: { id: true, first_name: true, last_name: true } },
          },
        }),
      ]);
      totalItems = count;
      rows = list;
    }

    const data = rows.map((t) => {
      const tech = t.users_tickets_assigned_user_idTousers;
      return {
        id: `#${t.id}`,
        rawId: t.id,
        title: t.subject,
        status: t.ticket_status?.name ?? "Open",
        priority: t.priority ?? "Medium",
        assignee: tech ? `${tech.first_name} ${tech.last_name}` : "Sin asignar",
        assigneeInitials: tech ? `${(tech.first_name?.[0]||"").toUpperCase()}${(tech.last_name?.[0]||"").toUpperCase()}` : "NA",
        category: t.category_services?.name ?? "—",
        department: t.departments?.name ?? "—",
        branch: t.offices_tickets_office_idTooffices?.name ?? "—",
        supportOffice: t.offices_tickets_office_support_toTooffices?.name ?? "—",
        created: t.created_at ? new Date(t.created_at).toISOString().slice(0,10) : null,
        updatedAt: t.updated_at,
      };
    });

    res.json({
      data,
      page,
      limit,
      totalItems,
      totalPages: Math.max(Math.ceil(totalItems / limit), 1),
      latest: latestMode,
    });
  } catch (err) {
    console.error("getTickets error:", err);
    res.status(500).json({ error: "Error obteniendo tickets" });
  }
}



async function getTicketsForTable(req, res) {
  try {
    const {
      page = 1,
      limit = 100,
      sortField = "created_at",
      sortOrder = "desc",
      estados = [],
      asignados = [],
      searchText,
      fechaExacta,
    } = req.query;

    const skip = (page - 1) * limit;
    const where = { deleted_at: null };

    // Solo tickets cuyo asignado tiene role_id = 4
    where.users_tickets_assigned_user_idTousers = { is: { role_id: 4 } };

    if (Array.isArray(estados) && estados.length) {
      where.status_id = { in: estados.map((id) => Number(id)) };
    }

    const or = [];

    if (Array.isArray(asignados) && asignados.length) {
      or.push(
        ...asignados.map((item) =>
          item === "No asignado" ? { assigned_user_id: null } : { assigned_user_id: Number(item) }
        )
      );
    }

    if (fechaExacta) {
      const date = new Date(fechaExacta);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      where.created_at = { gte: date, lt: next };
    }

    if (searchText) {
      const m = searchText.match(/^tkt-?(\d+)$/i) || searchText.match(/^(\d+)$/);
      or.push(
        { subject: { contains: searchText } },
        { comment: { contains: searchText } },
        ...(m ? [{ id: Number(m[1]) }] : [])
      );
    }

    if (or.length) where.OR = or;

    const [rows, total] = await Promise.all([
      prisma.tickets.findMany({
        skip,
        take: Number(limit),
        orderBy: { [SORT_MAP.has(sortField) ? sortField : "created_at"]: sortOrder === "asc" ? "asc" : "desc" },
        include: {
          ticket_status: { select: { name: true } },
          users_tickets_user_idTousers: { select: { first_name: true, last_name: true } },
          users_tickets_assigned_user_idTousers: { select: { first_name: true, last_name: true, role_id: true } },
          ticket_histories: { select: { status_id: true, created_at: true }, orderBy: { created_at: "asc" } },
        },
        where,
      }),
      prisma.tickets.count({ where }),
    ]);

    const calcResolution = (hist, statusName) => {
      if (statusName !== "Cerrado" || !hist?.length) return "-";
      const opened = hist.find((h) => h.status_id === 3);
      const closed = hist.find((h) => h.status_id === 5);
      if (!opened || !closed) return "-";
      const diffMs = new Date(closed.created_at) - new Date(opened.created_at);
      const d = Math.floor(diffMs / 86400000);
      const h = Math.floor((diffMs % 86400000) / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      return [d ? `${d}d` : null, h ? `${h}h` : null, m ? `${m}m` : null].filter(Boolean).join(" ") || "<1m";
    };

    const data = rows.map((t) => {
      const statusName = t.ticket_status?.name || "Desconocido";
      const createdBy = t.users_tickets_user_idTousers
        ? `${t.users_tickets_user_idTousers.first_name} ${t.users_tickets_user_idTousers.last_name}`
        : "Desconocido";
      const assignedTo = t.users_tickets_assigned_user_idTousers
        ? `${t.users_tickets_assigned_user_idTousers.first_name} ${t.users_tickets_assigned_user_idTousers.last_name}`
        : "No asignado";

      return {
        id: t.id,
        ticket: `TKT-${String(t.id).padStart(3, "0")}`,
        subject: t.subject,
        comment: t.comment,
        created_by: createdBy,
        assigned_to: assignedTo,
        status: statusName,
        created_at: formatDate24h(t.created_at),
        resolution_time: calcResolution(t.ticket_histories, statusName),
        assigned_user_role: t.users_tickets_assigned_user_idTousers?.role_id ?? null,
      };
    });

    res.json({
      success: true,
      data,
      pagination: {
        total,
        totalPages: Math.max(Math.ceil(total / Number(limit)), 1),
        currentPage: Number(page),
        perPage: Number(limit),
      },
    });
  } catch (e) {
    console.error("Error en getTicketsForTable:", e);
    res.status(500).json({ success: false, error: "Error al obtener tickets" });
  }
}

async function getStatusOptions(req, res) {
  try {
    const statuses = await prisma.ticket_status.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json(statuses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function createTicket(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Usuario no autenticado" });

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

    if (!subject || !comment || !department_id)
      return res.status(400).json({ success: false, error: "subject, comment y department_id son obligatorios" });

    const ticket = await prisma.tickets.create({
      data: {
        subject,
        comment,
        department_id,
        category_service_id,
        user_id,
        priority: priority ? Prisma.tickets_priority[priority] ?? priority : null,
        validated,
        office_support_to,
        assigned_user_id,
        office_id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: "Ticket creado correctamente",
      data: { id: ticket.id, ticket: `TKT-${String(ticket.id).padStart(3, "0")}`, ...ticket },
    });
  } catch (e) {
    console.error("Error en createTicket:", e);
    res.status(500).json({ success: false, error: "Error al crear ticket" });
  }
}

async function getTicketById(req, res) {
  try {
    const { id } = req.params;
    const ticket = await prisma.tickets.findUnique({
      where: { id: Number(id) },
      include: {
        ticket_status: { select: { name: true } },
        users_tickets_user_idTousers: { select: { first_name: true, last_name: true } },
        users_tickets_assigned_user_idTousers: { select: { first_name: true, last_name: true, role_id: true } },
        ticket_histories: { select: { status_id: true, created_at: true }, orderBy: { created_at: "asc" } },
      },
    });
    if (!ticket) return res.status(404).json({ success: false, error: "Ticket no encontrado" });

    const statusName = ticket.ticket_status?.name || "Desconocido";
    const createdBy = ticket.users_tickets_user_idTousers
      ? `${ticket.users_tickets_user_idTousers.first_name} ${ticket.users_tickets_user_idTousers.last_name}`
      : "Desconocido";
    const assignedTo = ticket.users_tickets_assigned_user_idTousers
      ? `${ticket.users_tickets_assigned_user_idTousers.first_name} ${ticket.users_tickets_assigned_user_idTousers.last_name}`
      : "No asignado";

    res.json({
      success: true,
      data: {
        id: ticket.id,
        ticket: `TKT-${String(ticket.id).padStart(3, "0")}`,
        subject: ticket.subject,
        comment: ticket.comment,
        created_by: createdBy,
        assigned_to: assignedTo,
        status: statusName,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        histories: ticket.ticket_histories,
      },
    });
  } catch (e) {
    console.error("Error en getTicketById:", e);
    res.status(500).json({ success: false, error: "Error al obtener ticket" });
  }
}

async function getTicketsByAssignedUserId(req, res) {
  try {
    const { userId } = req.params;
    const rows = await prisma.tickets.findMany({
      where: { assigned_user_id: Number(userId) },
      include: {
        ticket_status: { select: { name: true } },
        users_tickets_user_idTousers: { select: { first_name: true, last_name: true } },
        users_tickets_assigned_user_idTousers: { select: { first_name: true, last_name: true, role_id: true } },
      },
    });

    const data = rows.map((t) => ({
      id: t.id,
      ticket: `TKT-${String(t.id).padStart(3, "0")}`,
      subject: t.subject,
      comment: t.comment,
      created_by: t.users_tickets_user_idTousers
        ? `${t.users_tickets_user_idTousers.first_name} ${t.users_tickets_user_idTousers.last_name}`
        : "Desconocido",
      assigned_to: t.users_tickets_assigned_user_idTousers
        ? `${t.users_tickets_assigned_user_idTousers.first_name} ${t.users_tickets_assigned_user_idTousers.last_name}`
        : "No asignado",
      status: t.ticket_status?.name || "Desconocido",
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));

    res.json({ success: true, data });
  } catch (e) {
    console.error("Error en getTicketsByAssignedUserId:", e);
    res.status(500).json({ success: false, error: "Error al obtener tickets asignados" });
  }
}

async function updateTicket(req, res) {
  try {
    const { id } = req.params;
    const { subject, comment, status_id, assigned_user_id } = req.body;

    const data = {
      ...(subject !== undefined ? { subject } : {}),
      ...(comment !== undefined ? { comment } : {}),
      ...(status_id !== undefined ? { status_id: Number(status_id) } : {}),
      ...(assigned_user_id !== undefined ? { assigned_user_id: Number(assigned_user_id) } : {}),
      updated_at: new Date(),
    };

    const ticket = await prisma.tickets.update({ where: { id: Number(id) }, data });
    res.json({ success: true, message: "Ticket actualizado correctamente", data: ticket });
  } catch (e) {
    console.error("Error en updateTicket:", e);
    res.status(500).json({ success: false, error: "Error al actualizar ticket" });
  }
}

async function deleteTicket(req, res) {
  try {
    const { id } = req.params;
    await prisma.tickets.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: "Ticket eliminado correctamente" });
  } catch (e) {
    console.error("Error en deleteTicket:", e);
    res.status(500).json({ success: false, error: "Error al eliminar ticket" });
  }
}

module.exports = {
  getTickets,
  getTicketsForTable,
  getStatusOptions,
  createTicket,
  getTicketById,
  getTicketsByAssignedUserId,
  updateTicket,
  deleteTicket,
};

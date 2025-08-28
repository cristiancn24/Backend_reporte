// controllers/ticket.controller.js (CommonJS)
const prisma = require("../db");
const { Prisma } = require("@prisma/client");
const path = require("path");

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

// controllers/ticketController.js
// GET /api/tickets
// controllers/tickets.js
// controllers/tickets.js
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
      latest,
      triage, // ← NUEVO
    } = req.query;

    const roleId = req.user?.role_id ?? null;
    const userId = req.user?.id ?? null;

    const latestMode =
      String(latest || "").toLowerCase() === "1" ||
      String(latest || "").toLowerCase() === "true";

    const triageMode =
      String(triage || "").toLowerCase() === "1" ||
      String(triage || "").toLowerCase() === "true";

    order = order?.toLowerCase() === "asc" ? "asc" : "desc";
    if (!["created_at","updated_at","id"].includes(sortBy)) sortBy = "created_at";

    const pr = typeof priority === "string" ? priority.toUpperCase() : undefined;

    // WHERE base
    const where = {
      deleted_at: null,
      ...(statusId ?        { status_id: Number(statusId) } : {}),
      ...(pr ?              { priority: pr } : {}),
      ...(categoryId ?      { category_service_id: Number(categoryId) } : {}),
      ...(officeId ?        { office_id: Number(officeId) } : {}),
      ...(officeSupportToId ? { office_support_to: Number(officeSupportToId) } : {}),
      ...(departmentId ?    { department_id: Number(departmentId) } : {}),
      ...(technicianId ?    { assigned_user_id: Number(technicianId) } : {}),
      ...((dateFrom || dateTo) && {
        created_at: {
          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
          ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
        },
      }),
      ...(q && {
        OR: [
          { subject: { contains: q } },
          ...(Number.isNaN(Number(q)) ? [] : [{ id: Number(q) }]),
        ],
      }),
    };

    // Reglas por rol
    if (triageMode) {
      if (![1,5].includes(roleId)) {
        return res.status(403).json({ success:false, error:"No autorizado para triage" });
      }
      // TRIAGE: falta categoría O falta técnico
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { category_service_id: { equals: null } },
            { category_service_id: 0 },
            { assigned_user_id:    { equals: null } },
            { assigned_user_id: 0 },
          ],
        },
      ];
    } else {
      if (roleId === 4) {
        // Técnico: solo sus tickets
        where.AND = [
          ...(where.AND || []),
          { assigned_user_id: userId },
        ];
      } else if (![1,5].includes(roleId)) {
        // Otros roles: sólo tickets ya categorizados y asignados
        where.AND = [
          ...(where.AND || []),
          { category_service_id: { gt: 0 } },
          { assigned_user_id:    { gt: 0 } },
        ];
      }
    }

    const include = {
      ticket_status: { select: { id: true, name: true } },
      category_services: { select: { id: true, name: true } },
      departments: { select: { id: true, name: true } },
      offices_tickets_office_idTooffices: { select: { id: true, name: true } },
      offices_tickets_office_support_toTooffices: { select: { id: true, name: true } },
      users_tickets_assigned_user_idTousers: { select: { id: true, first_name: true, last_name: true } },
      users_tickets_user_idTousers: { select: { id: true, first_name: true, last_name: true } },
    };

    let totalItems, rows;

    if (latestMode) {
      const topIds = await prisma.tickets.findMany({
        where,
        select: { id: true },
        orderBy: { created_at: "desc" },
        take: 200,
      });
      const idList = topIds.map(x => x.id);

      totalItems = idList.length;
      rows = await prisma.tickets.findMany({
        where: { id: { in: idList } },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include,
      });
    } else {
      const [count, list] = await Promise.all([
        prisma.tickets.count({ where }),
        prisma.tickets.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: order },
          include,
        }),
      ]);
      totalItems = count;
      rows = list;
    }

    const data = rows.map((t) => {
      const tech    = t.users_tickets_assigned_user_idTousers;
      const creator = t.users_tickets_user_idTousers;

      const needsCategory = (t.category_service_id == null || t.category_service_id === 0);
      const needsAssignee = (t.assigned_user_id   == null || t.assigned_user_id   === 0);

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
        createdBy: creator ? `${creator.first_name} ${creator.last_name}` : "—",
        supportOffice: t.offices_tickets_office_support_toTooffices?.name ?? "—",
        created: t.created_at ? new Date(t.created_at).toISOString().slice(0,10) : null,
        updatedAt: t.updated_at,
        needsCategory,
        needsAssignee,
      };
    });

    res.json({
      success: true,
      data,
      page,
      limit,
      totalItems,
      totalPages: Math.max(Math.ceil(totalItems / limit), 1),
      latest: latestMode,
      triage: triageMode,
    });
  } catch (err) {
    console.error("getTickets error:", err);
    res.status(500).json({ success:false, error: "Error obteniendo tickets" });
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

// controllers/ticket.controller.js
async function createTicket(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Usuario no autenticado" });
    }

    const {
      subject,
      comment,
      office_id = null,
      category_service_id = null,
      office_support_to = 1,
      assigned_user_id = null,
    } = req.body;

    if (!subject?.trim() || !comment?.trim()) {
      return res.status(400).json({ success: false, error: "subject y comment son obligatorios" });
    }

    // 1) Tomar el department_id del usuario logueado
    let departmentIdFromUser = req.user?.department_id;

    // 2) Si el middleware no adjuntó el departamento, lo buscamos
    if (!departmentIdFromUser) {
      const u = await prisma.users.findUnique({
        where: { id: userId },
        select: { department_id: true },
      });
      departmentIdFromUser = u?.department_id;
    }

    if (!departmentIdFromUser) {
      return res.status(400).json({
        success: false,
        error: "El usuario no tiene department_id configurado",
      });
    }

    const ticket = await prisma.tickets.create({
      data: {
        subject: subject.trim(),
        comment: comment.trim(),
        department_id: Number(departmentIdFromUser), // 👈 viene del usuario
        category_service_id: category_service_id ? Number(category_service_id) : null,
        user_id: userId,
        priority: null,          // la prioridad no se envía al crear
        validated: null,
        office_support_to: Number(office_support_to) || 1,
        assigned_user_id: assigned_user_id ? Number(assigned_user_id) : null,
        office_id: office_id ? Number(office_id) : null,
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


// controllers/ticket.controller.js
async function getTicketById(req, res) {
  try {
    const { id } = req.params;
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    // 1) Ticket base
    const t = await prisma.tickets.findUnique({ where: { id: ticketId } });
    if (!t) {
      return res.status(404).json({ success: false, error: "Ticket no encontrado" });
    }

    // 2) Resolver nombres (estado, creador, asignado)
    const [status, createdByUser, assignedToUser] = await Promise.all([
      prisma.ticket_status.findUnique({
        where: { id: t.status_id ?? 0 },
        select: { name: true },
      }),
      prisma.users.findUnique({
        where: { id: t.user_id ?? 0 },
        select: { first_name: true, last_name: true },
      }),
      prisma.users.findUnique({
        where: { id: t.assigned_user_id ?? 0 },
        select: { first_name: true, last_name: true },
      }),
    ]);

    // 3) Oficina
    const officeIdCandidate = t.office_id ?? t.office_support_to ?? t.office_support_from ?? null;
    const office = officeIdCandidate
      ? await prisma.offices.findUnique({
          where: { id: Number(officeIdCandidate) },
          select: { name: true },
        })
      : null;

    // 4) Historial
    const rawHistories = await prisma.ticket_histories.findMany({
      where: { ticket_id: ticketId },
      orderBy: { created_at: "asc" },
      select: { status_id: true, created_at: true, user_id: true },
    });

    const statusIds = [...new Set(rawHistories.map(h => h.status_id).filter(Boolean))];
    const userIds   = [...new Set(rawHistories.map(h => h.user_id).filter(Boolean))];

    const [statusList, userList] = await Promise.all([
      statusIds.length
        ? prisma.ticket_status.findMany({
            where: { id: { in: statusIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      userIds.length
        ? prisma.users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, first_name: true, last_name: true },
          })
        : Promise.resolve([]),
    ]);

    const statusMap = new Map(statusList.map(s => [s.id, s.name]));
    const userMap   = new Map(userList.map(u => [u.id, `${u.first_name} ${u.last_name}`]));

    let historiesOut = rawHistories.map(h => ({
      status_id: h.status_id,
      status: statusMap.get(h.status_id) || null,
      created_at: h.created_at,
      user: h.user_id ? (userMap.get(h.user_id) || null) : null,
    }));

    if (!historiesOut.length) {
      historiesOut = [{
        status_id: t.status_id ?? null,
        status: "Creado",
        created_at: t.created_at,
        user: createdByUser ? `${createdByUser.first_name} ${createdByUser.last_name}` : null,
      }];
    }

    // 5) Adjuntos
    const uploadsRows = await prisma.ticket_uploads.findMany({
      where: { ticket_id: ticketId, deleted_at: null },
      select: { id: true, original_name: true, path: true, created_at: true },
      orderBy: { created_at: "asc" },
    });

    const base = `${req.protocol}://${req.get("host")}`;
    const uploadsOut = uploadsRows.map(u => ({
      id: u.id,
      name: u.original_name,
      url: `${base}/uploads/${u.path}`,
      created_at: u.created_at,
    }));

    // 6) Comentarios (⚠️ usa `comment` en vez de `content`)
    //   No usamos `select` para evitar errores de nombres; mapeamos después.
    const rawComments = await prisma.ticket_comments.findMany({
      where: { ticket_id: ticketId, deleted_at: null },
      orderBy: { created_at: "asc" },
    });

    const commentUserIds = [...new Set(rawComments.map(c => c.user_id).filter(Boolean))];
    const commentUsers = commentUserIds.length
      ? await prisma.users.findMany({
          where: { id: { in: commentUserIds } },
          select: { id: true, first_name: true, last_name: true },
        })
      : [];

    const commentUserMap = new Map(
      commentUsers.map(u => [u.id, `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()])
    );

    const commentsOut = rawComments.map(c => ({
      id: c.id,
      user_name: commentUserMap.get(c.user_id) || "—",
      content: c.comment ?? "",            // 👈 aquí va el texto del comentario
      is_internal: Boolean(c.is_internal), // si no existe la columna, quedará `false`
      created_at: c.created_at ?? null,
    }));

    // 7) Respuesta
    return res.json({
      success: true,
      data: {
        id: t.id,
        ticket: `TKT-${String(t.id).padStart(3, "0")}`,
        subject: t.subject,
        comment: t.comment,
        created_by: createdByUser ? `${createdByUser.first_name} ${createdByUser.last_name}` : "Desconocido",
        assigned_to: assignedToUser ? `${assignedToUser.first_name} ${assignedToUser.last_name}` : "No asignado",
        status_id: t.status_id,
        status: status?.name || "Desconocido",
        office_name: office?.name || null,
        created_at: t.created_at,
        updated_at: t.updated_at,
        histories: historiesOut,
        uploads: uploadsOut,
        comments: commentsOut,
      },
    });
  } catch (e) {
    console.error("Error en getTicketById:", e);
    return res.status(500).json({
      success: false,
      error: e?.message || "Error al obtener ticket",
      code: e?.code,
      meta: e?.meta,
    });
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

// controllers/tickets.js
async function updateTicket(req, res) {
  try {
    const id = Number(req.params.id);
    const userId = req.user?.id || null;
    const { subject, comment, status_id, assigned_user_id, category_service_id } = req.body;

    const prev = await prisma.tickets.findUnique({ where: { id } });
    if (!prev) return res.status(404).json({ success:false, error:"Ticket no encontrado" });

    const newStatus = status_id !== undefined ? Number(status_id) : undefined;
    const statusChanged = newStatus !== undefined && newStatus !== prev.status_id;

    const updated = await prisma.tickets.update({
      where: { id },
      data: {
        ...(subject !== undefined ? { subject } : {}),
        ...(comment !== undefined ? { comment } : {}),
        ...(newStatus !== undefined ? { status_id: newStatus } : {}),
        ...(assigned_user_id !== undefined ? { assigned_user_id: Number(assigned_user_id) || null } : {}),
        ...(category_service_id !== undefined ? { category_service_id: Number(category_service_id) || null } : {}),
        updated_at: new Date(),
      },
      include: {
        ticket_status: { select: { id:true, name:true } },
        category_services: { select: { id:true, name:true } },
        users_tickets_assigned_user_idTousers: { select: { id:true, first_name:true, last_name:true } },
      }
    });

    if (statusChanged) {
      await prisma.ticket_histories.create({
        data: {
          ticket_id: id,
          status_id: newStatus,
          user_id: userId,
          created_at: new Date(),
        },
      });
    }

    const assigneeName = updated.users_tickets_assigned_user_idTousers
      ? `${updated.users_tickets_assigned_user_idTousers.first_name} ${updated.users_tickets_assigned_user_idTousers.last_name}`
      : null;

    const categoryName = updated.category_services?.name ?? null;

    const needsCategory = (updated.category_service_id == null || updated.category_service_id === 0);
    const needsAssignee = (updated.assigned_user_id   == null || updated.assigned_user_id   === 0);

    res.json({
      success:true,
      message:"Ticket actualizado correctamente",
      data: {
        ...updated,
        assigned_user_name: assigneeName,
        category_name: categoryName,
        needsCategory,
        needsAssignee,
      }
    });
  } catch (e) {
    console.error("Error en updateTicket:", e);
    res.status(500).json({ success:false, error:"Error al actualizar ticket" });
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

function normalizePriority(p) {
  if (!p) return undefined;
  const n = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n === "low" || n === "baja") return "low";
  if (n === "medium" || n === "media") return "medium";
  if (n === "high" || n === "alta") return "high";
  if (n === "urgent" || n === "urgente") return "urgent";
}


// controllers/ticket.controller.js
async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const [techs, statuses, categories, offices, departments] = await Promise.all([
      prisma.users.findMany({
        where: { deleted_at: null },
        select: { id: true, first_name: true, last_name: true },
        orderBy: [{ first_name: "asc" }, { last_name: "asc" }],
      }),
      prisma.ticket_status.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.category_services.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.offices.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.departments.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const technicians = techs.map(u => ({
      id: u.id,
      name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Sin nombre",
    }));

    // Sólo para filtros (no se usa al crear)
    const priorities = [
      { value: "URGENTE", label: "Urgente" },
      { value: "ALTA",    label: "Alta" },
      { value: "MEDIA",   label: "Media" },
      { value: "BAJA",    label: "Baja" },
    ];

    res.status(200).json({
      technicians,
      statuses,
      priorities,
      categories,
      offices,
      departments,   // 👈 nuevo
    });
  } catch (err) {
    console.error("GET /api/tickets/filters error:", err);
    res.status(500).json({ error: "No se pudieron obtener filtros" });
  }
}

async function setTicketCategory(req, res) {
  const { id } = req.params;
  const { category_service_id } = req.body;
  await prisma.tickets.update({
    where: { id: Number(id) },
    data: { category_service_id: Number(category_service_id), updated_at: new Date() },
  });
  res.json({ success: true, message: "Categoría actualizada" });
}

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

async function addAttachments(req, res) {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, error: "No se enviaron archivos" });
    }

    const rows = await prisma.$transaction(
      files.map((f) => {
        const rel = path.relative(UPLOAD_ROOT, f.path).replace(/\\/g, "/");
        return prisma.ticket_uploads.create({
          data: {
            ticket_id: ticketId,
            original_name: f.originalname,
            file: path.basename(f.path),
            path: rel,                  // ej: "tickets/25/171077_test.pdf"
            created_at: new Date(),
            updated_at: new Date(),
          },
          select: { id: true, original_name: true, path: true, created_at: true },
        });
      })
    );

    const host = `${req.protocol}://${req.get("host")}`;
    return res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        name: r.original_name,
        url: `${host}/uploads/${r.path}`, // 👈 público
        created_at: r.created_at,
      })),
    });
  } catch (e) {
    console.error("upload attachments error:", e);
    res.status(500).json({ success: false, error: "No se pudieron subir los archivos" });
  }
}

// controllers/ticketController.js
async function addTicketComment(req, res) {
  try {
    const ticketId = Number(req.params.id);
    const userId = req.user?.id ?? null; // si usas auth
    const { comment } = req.body;

    if (!Number.isFinite(ticketId)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }
    if (!comment?.trim()) {
      return res.status(400).json({ success: false, error: "El comentario es obligatorio" });
    }

    // opcional: verifica que exista el ticket
    const exists = await prisma.tickets.count({ where: { id: ticketId } });
    if (!exists) {
      return res.status(404).json({ success: false, error: "Ticket no encontrado" });
    }

    const row = await prisma.ticket_comments.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,               // puede ser null si no usas auth
        comment: comment.trim(),       // ⚠️ tu columna es `comment`
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: { id: true, comment: true, created_at: true, user_id: true }, // ❌ sin is_internal
    });

    // Resuelve nombre del usuario (opcional)
    let user_name = "—";
    if (row.user_id) {
      const u = await prisma.users.findUnique({
        where: { id: row.user_id },
        select: { first_name: true, last_name: true },
      });
      user_name = `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || "—";
    }

    return res.json({
      success: true,
      data: {
        id: row.id,
        user_name,
        content: row.comment,      // lo mando como `content` para la UI
        created_at: row.created_at,
      },
    });
  } catch (e) {
    console.error("addTicketComment error:", e);
    return res.status(500).json({ success: false, error: "No se pudo agregar el comentario" });
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
  handler,
  addAttachments,
  addTicketComment,
};

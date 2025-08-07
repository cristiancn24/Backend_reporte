const prisma = require('../db');

const roleController = {
  async getAllRoles(req, res) {
  try {
    const roles = await prisma.roles.findMany({
      where: {
        id: {
          notIn: [6, 7, 9, 10] // 🚫 Excluye estos roles
        }
      },
      include: {
        _count: {
          select: { users: true } // 👈 Asume que hay relación roles → users
        }
      }
    });

    // Agregamos el userCount a cada rol
    const rolesWithUserCount = roles.map(role => ({
      ...role,
      userCount: role._count.users
    }));

    res.json(rolesWithUserCount);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ error: 'Error al obtener roles' });
  }
},

  async createRole(req, res) {
  const { name } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Nombre inválido" });
  }

  try {
    // Generar access_name automáticamente (ej: nombre en minúsculas sin espacios)
    const access_name = name.toLowerCase().replace(/\s+/g, "_");

    const newRole = await prisma.roles.create({
      data: {
        name,
        access_name,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return res.status(201).json(newRole);
  } catch (error) {
    console.error("Error al crear rol:", error);
    return res.status(500).json({ error: "Error al crear rol" });
  }
},

  async updateRole(req, res) {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const updatedRole = await prisma.roles.update({
        where: { id: Number(id) },
        data: { name },
      });
      res.json(updatedRole);
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      res.status(500).json({ error: 'Error al actualizar rol' });
    }
  },
  async deleteRole(req, res) {
    const { id } = req.params;
    try {
      await prisma.roles.delete({
        where: { id: Number(id) },
      });
      res.status(204).send();
    } catch (error) {
      console.error('Error al eliminar rol:', error);
      res.status(500).json({ error: 'Error al eliminar rol' });
    }
  },

  async getRolePermissions(req, res) {
    try {
    const { roleId } = req.params;

    const role = await prisma.roles.findUnique({
      where: { id: parseInt(roleId) },
      include: {
        permission_role: {
          include: { permissions: true }
        }
      }
    });

    if (!role) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    // Solo devolvemos la lista de permisos
    const permisos = role.permission_role.map(pr => pr.permissions);
    res.json(permisos);
  } catch (error) {
    console.error("Error obteniendo permisos del rol:", error);
    res.status(500).json({ error: "Error interno" });
  }
},

async assignPermissionsToRole (req, res) {
  try {
    const { roleId, permissions } = req.body;

    // Eliminar permisos actuales
    await prisma.permission_role.deleteMany({
      where: { role_id: parseInt(roleId) }
    });

    // Insertar nuevos
    const newAssignments = permissions.map(permId => ({
      role_id: parseInt(roleId),
      permission_id: parseInt(permId)
    }));

    await prisma.permission_role.createMany({ data: newAssignments });

    res.json({ message: "Permisos asignados correctamente" });
  } catch (error) {
    console.error("Error asignando permisos:", error);
    res.status(500).json({ error: "Error interno" });
  }
},

async getRolesWithPermissions(req, res) {
  try {
    const roles = await prisma.roles.findMany({
      include: {
        _count: {
          select: { users: true } // Cuenta de usuarios por rol
        },
        permission_role: {
          include: { permissions: true }
        }
      }
    });

    const formattedRoles = roles.map(role => ({
      id: role.id,
      roleName: role.name,
      userCount: role._count.users, // <- Ahora sí tendrás el número correcto
      permissions: role.permission_role.reduce((acc, pr) => {
        acc[pr.permissions.name] = true;
        return acc;
      }, {})
    }));

    res.json(formattedRoles);
  } catch (error) {
    console.error("Error obteniendo roles con permisos:", error);
    res.status(500).json({ error: "Error interno" });
  }
},

};

module.exports = roleController;
const prisma = require('../db');

const permissionController = {
  async getAllPermissions(req, res) {
    try {
      const permissions = await prisma.permissions.findMany();
      res.json(permissions);
    } catch (error) {
      console.error('Error al obtener permisos:', error);
      res.status(500).json({ error: 'Error al obtener permisos' });
    }
  },

    async createPermission(req, res) {
        const { name, description, status } = req.body;
        try {
        const newPermission = await prisma.permissions.create({
            data: {
            name,
            description,
            status,
            created_at: new Date(),
            updated_at: new Date()
            },
        });
        res.status(201).json(newPermission);
        } catch (error) {
        console.error('Error al crear permiso:', error);
        res.status(500).json({ error: 'Error al crear permiso' });
        }
    },

    async updatePermission(req, res) {
        const { id } = req.params;
        const { name, description, status } = req.body;
        try {
            const updatedPermission = await prisma.permissions.update({
                where: { id: Number(id) },
                data: { name, description, status },
            });
            res.json(updatedPermission);
        } catch (error) {
            console.error('Error al actualizar permiso:', error);
            res.status(500).json({ error: 'Error al actualizar permiso' });
        }
    },

    async deletePermission(req, res) {
        const { id } = req.params;
        try {
            await prisma.permissions.delete({
                where: { id: Number(id) },
            });
            res.status(204).send();
        } catch (error) {
            console.error('Error al eliminar permiso:', error);
            res.status(500).json({ error: 'Error al eliminar permiso' });
        }
    },

    async getPermissionById(req, res) {
        const { id } = req.params;
        try {
            const permission = await prisma.permissions.findUnique({
                where: { id: Number(id) },
            });
            if (!permission) {
                return res.status(404).json({ error: 'Permiso no encontrado' });
            }
            res.json(permission);
        } catch (error) {
            console.error('Error al obtener permiso por ID:', error);
            res.status(500).json({ error: 'Error al obtener permiso por ID' });
        }
    }
};

module.exports = permissionController;

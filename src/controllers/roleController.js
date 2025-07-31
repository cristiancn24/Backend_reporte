const prisma = require('../db');

const roleController = {
  async getAllRoles(req, res) {
  try {
    const roles = await prisma.roles.findMany({
      where: {
        id: {
          notIn: [5, 6, 7, 9, 10] // 🚫 Excluye estos roles
        }
      }
    });
    res.json(roles);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ error: 'Error al obtener roles' });
  }
},
  async createRole(req, res) {
    const { name } = req.body;
    try {
      const newRole = await prisma.roles.create({
        data: {
          name,
          created_at: new Date(),
        updated_at: new Date()
        },
      });
      res.status(201).json(newRole);
    } catch (error) {
      console.error('Error al crear rol:', error);
      res.status(500).json({ error: 'Error al crear rol' });
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
};

module.exports = roleController;
const prisma = require('../db');

const officesController = {
  async getAllOffices(req, res) {
    try {
      const offices = await prisma.offices.findMany();
      res.json(offices);
    } catch (error) {
      console.error('Error al obtener oficinas:', error);
      res.status(500).json({ error: 'Error al obtener oficinas' });
    }
  },
};

module.exports = officesController;

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

  async createOffice(req, res) {
   try {
    const office = await prisma.offices.create({
      data: {
        name: req.body.name,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    res.json(office);
  } catch (error) {
    console.error("Error al crear oficina:", error);
    res.status(500).json({ error: "Error al crear oficina" });
  }
  },

};

module.exports = officesController;

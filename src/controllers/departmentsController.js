const prisma = require('../db');

const departmentsController = {
    async getAllDepartments(req, res) {
      try {
        const departments = await prisma.departments.findMany();
        res.json(departments);
      } catch (error) {
        console.error('Error al obtener departamentos:', error);
        res.status(500).json({ error: 'Error al obtener departamentos' });
      }
    },
  };
  
  module.exports = departmentsController;

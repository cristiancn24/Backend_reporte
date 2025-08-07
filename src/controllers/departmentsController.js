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
    async createDepartment(req, res) {
      try {
        const department = await prisma.departments.create({
          data: {
            name: req.body.name,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        res.status(201).json(department);
      } catch (error) {
        console.error('Error al crear departamento:', error);
        res.status(500).json({ error: 'Error al crear departamento' });
      }
    },
  };
  
  module.exports = departmentsController;

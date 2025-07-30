const prisma = require('../db');

const faqController = {
  async getAllFAQs(req, res) {
    try {
      const faqs = await prisma.faqs.findMany();
      res.json({
        success: true,
        data: faqs
      });
    } catch (error) {
      console.error('Error en getAllFAQs:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener FAQs',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  getFAQById: async (req, res) => {
    try {
      const { id } = req.params;
      const faq = await prisma.faqs.findUnique({
        where: { id: parseInt(id) }
      });

      if (!faq) {
        return res.status(404).json({
          success: false,
          error: 'FAQ no encontrado'
        });
      }

      res.json({
        success: true,
        data: faq
      });
    } catch (error) {
      console.error('Error en getFAQById:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener FAQ',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  createFAQ: async (req, res) => {
    try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

      const { subject, description, category_service_id } = req.body;

      if (!subject || !description || !category_service_id) {
        return res.status(400).json({
          success: false,
          error: 'Todos los campos son requeridos'
        });
      }

      const newFAQ = await prisma.faqs.create({
        data: { subject, description, category_service_id }
      });

      res.status(201).json({
        success: true,
        data: newFAQ
      });
    } catch (error) {
      console.error('Error en createFAQ:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear FAQ',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

    updateFAQ: async (req, res) => {
        try {

            const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado'
            });
        }

        const { id } = req.params;
        const { subject, description, category_service_id } = req.body;

        if (!subject || !description || !category_service_id) {
            return res.status(400).json({
            success: false,
            error: 'Todos los campos son requeridos'
            });
        }
    
        const updatedFAQ = await prisma.faqs.update({
            where: { id: parseInt(id) },
            data: { subject, description, category_service_id }
        });
    
        res.json({
            success: true,
            data: updatedFAQ
        });
        } catch (error) {
        console.error('Error en updateFAQ:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar FAQ',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        }
    },

    deleteFAQ: async (req, res) => {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
            }

            const { id } = req.params;
            await prisma.faqs.delete({
                where: { id: parseInt(id) }
            });
            res.json({
                success: true,
                message: 'FAQ eliminado correctamente'
            });
        } catch (error) {
            console.error('Error en deleteFAQ:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar FAQ',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = faqController;

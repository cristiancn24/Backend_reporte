const prisma = require('../db');

const categoryServicesController = {
   getAllCategoryServices: async (req, res) => {
  try {
    const colorNames = [
  "category-color-red",
  "category-color-orange",
  "category-color-amber",
  "category-color-yellow",
  "category-color-green",
  "category-color-blue",
  "category-color-purple",
  "category-color-pink",
  "category-color-gray",
  "category-color-indigo",
  "category-color-teal",
  "category-color-cyan",
  "category-color-fuchsia",
  "category-color-rose",
];


    const categories = await prisma.category_services.findMany({
      include: {
        _count: {
          select: { faqs: true },
        },
      },
    });

    const formatted = categories.map((cat, index) => ({
  id: cat.id,
  name: cat.name,
  icon: cat.icon || "HelpCircle",
  count: cat._count.faqs,
  color: colorNames[index % colorNames.length], // 👈 aquí
}));

    res.json(formatted);
  } catch (error) {
    console.error('Error al obtener categorías de servicios:', error);
    res.status(500).json({ error: 'Error al obtener categorías de servicios' });
  }
},


    createCategoryService: async (req, res) => {
        try {
            const { name, description } = req.body;
            const newCategory = await prisma.category_services.create({
                data: { name, description },
            });
            res.status(201).json(newCategory);
        } catch (error) {
            console.error('Error al crear categoría de servicio:', error);
            res.status(500).json({ error: 'Error al crear categoría de servicio' });
        }
    },
};

module.exports = categoryServicesController;
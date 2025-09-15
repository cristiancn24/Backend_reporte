const prisma = require('../db');

const categoryServicesController = {
   getAllCategoryServices: async (req, res) => {
  try {
    const colorNames = [
      "category-color-red","category-color-orange","category-color-amber","category-color-yellow",
      "category-color-green","category-color-blue","category-color-purple","category-color-pink",
      "category-color-gray","category-color-indigo","category-color-teal","category-color-cyan",
      "category-color-fuchsia","category-color-rose",
    ];

    const rows = await prisma.category_services.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    });

    const data = rows.map((cat, i) => ({
      id: cat.id,
      name: cat.name,
      active: !!cat.active,
      color: colorNames[i % colorNames.length],
      icon: "HelpCircle",
    }));

    res.json(data);
  } catch (e) {
    console.error("getAllCategoryServices error:", e);
    res.status(500).json({ error: "Error al obtener categorías de servicios" });
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

    toggleActive: async (req, res) => {
      try {
    const id = Number(req.params.id);
    const { active } = req.body;
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });
    if (typeof active !== "boolean") return res.status(400).json({ error: "active debe ser boolean" });

    const row = await prisma.category_services.update({
      where: { id },
      data: { active, updated_at: new Date() },
      select: { id: true, name: true, active: true },
    });
    res.json(row);
  } catch (e) {
    console.error("toggleActive error:", e);
    res.status(500).json({ error: "No se pudo actualizar la categoría" });
  }
}
};

module.exports = categoryServicesController;
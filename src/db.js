const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});

prisma.$connect()
  .then(() => {
    console.log('🟢 [Prisma] Conexión a la base de datos establecida');
    console.log(`📊 Motor de BD: ${process.env.DATABASE_URL.split(':')[0]}`);
  })
  .catch((err) => {
    console.error('🔴 [Prisma] Error de conexión a la BD:', err.message);
    process.exit(1); 
  });

process.on('beforeExit', async () => {
  await prisma.$disconnect();
  console.log('🔌 [Prisma] Conexión cerrada');
});

module.exports = prisma;
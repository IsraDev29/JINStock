import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { prisma } from '../config/prisma';

dotenv.config();

async function seedAdmin() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME || 'Administrador JINStock';

  if (!adminEmail || !adminPassword) {
    console.error('❌ Error: INITIAL_ADMIN_EMAIL y INITIAL_ADMIN_PASSWORD deben estar definidos en las variables de entorno.');
    process.exit(1);
  }

  console.log('--- Sembrando Administrador Inicial Seguro ---');
  console.log(`Email: ${adminEmail}`);

  const existing = await prisma.usuario.findUnique({
    where: { email: adminEmail },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (existing) {
    console.log(`⚠️ Usuario ${adminEmail} ya existe. Actualizando contraseña y rol...`);
    await prisma.usuario.update({
      where: { email: adminEmail },
      data: {
        passwordHash,
        rol: 'ADMINISTRADOR',
        estado: true,
        verificado: true,
      },
    });
  } else {
    console.log(`Creando nuevo usuario administrador...`);
    await prisma.usuario.create({
      data: {
        nombre: adminName,
        email: adminEmail,
        passwordHash,
        rol: 'ADMINISTRADOR',
        estado: true,
        verificado: true,
      },
    });
  }

  console.log('✅ Administrador inicial configurado exitosamente.');
  console.log(`Usuario administrador: ${adminEmail}`);
  console.log('----------------------------------------------');
}

seedAdmin()
  .catch((err) => {
    console.error('❌ Error sembrando administrador:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { prisma } from '../config/prisma';

dotenv.config();

/**
 * Script utilitario para rotación segura de contraseñas de usuarios en base de datos.
 * Uso:
 *   npx ts-node src/scripts/changePassword.ts <email> <nueva_contraseña>
 */
async function changePassword() {
  const args = process.argv.slice(2);
  const email = args[0] || process.env.USER_EMAIL;
  const newPassword = args[1] || process.env.NEW_PASSWORD;

  if (!email || !newPassword) {
    console.error('❌ Uso requerido: npx ts-node src/scripts/changePassword.ts <email> <nueva_contraseña>');
    console.error('   O definir USER_EMAIL y NEW_PASSWORD en variables de entorno.');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('❌ Error de seguridad: La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  console.log(`🔐 Rotando contraseña para el usuario: ${email}...`);

  const user = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user) {
    console.error(`❌ Usuario '${email}' no encontrado en la base de datos.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.usuario.update({
    where: { id: user.id },
    data: {
      passwordHash,
      estado: true,
      verificado: true,
    },
  });

  console.log('✅ Contraseña actualizada exitosamente en la base de datos.');
  console.log(`   Usuario: ${user.nombre} (${user.email})`);
  console.log(`   Rol: ${user.rol}`);
  console.log('   Hash bcrypt generado con costo 10.');
}

changePassword()
  .catch((err) => {
    console.error('❌ Error actualizando contraseña:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

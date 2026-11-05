"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = require("../config/prisma");
dotenv_1.default.config();
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
    const user = await prisma_1.prisma.usuario.findUnique({
        where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
        console.error(`❌ Usuario '${email}' no encontrado en la base de datos.`);
        process.exit(1);
    }
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma_1.prisma.usuario.update({
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
    await prisma_1.prisma.$disconnect();
});

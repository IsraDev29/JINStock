"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.toggleUserStatus = exports.createUser = exports.getUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../config/prisma");
const errors_1 = require("../utils/errors");
const getUsers = async (req, res, next) => {
    try {
        const users = await prisma_1.prisma.usuario.findMany({
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                estado: true,
                verificado: true,
                createdAt: true,
            },
            orderBy: { nombre: 'asc' },
        });
        res.json({
            success: true,
            data: users,
            message: 'Usuarios obtenidos correctamente.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUsers = getUsers;
const createUser = async (req, res, next) => {
    try {
        const { nombre, email, password, rol } = req.body;
        if (!nombre || !email || !password) {
            throw new errors_1.ValidationError('Nombre, correo electrónico y contraseña son obligatorios.');
        }
        const cleanEmail = email.trim().toLowerCase();
        const assignedRol = rol === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'CAJERO';
        const existing = await prisma_1.prisma.usuario.findUnique({ where: { email: cleanEmail } });
        if (existing) {
            throw new errors_1.ConflictError('Ya existe un usuario registrado con este correo electrónico.');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const newUser = await prisma_1.prisma.usuario.create({
            data: {
                nombre: nombre.trim(),
                email: cleanEmail,
                passwordHash,
                rol: assignedRol,
                estado: true,
                verificado: true, // Usuarios creados por el administrador quedan activos y verificados
            },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                estado: true,
                verificado: true,
                createdAt: true,
            },
        });
        res.status(201).json({
            success: true,
            data: newUser,
            message: `Usuario ${newUser.nombre} (${newUser.rol}) registrado exitosamente.`,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createUser = createUser;
const toggleUserStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (req.user?.id === id) {
            throw new errors_1.ValidationError('No puede desactivar su propio usuario administrador en sesión.');
        }
        const current = await prisma_1.prisma.usuario.findUnique({ where: { id } });
        if (!current) {
            throw new errors_1.NotFoundError('Usuario no encontrado.');
        }
        const updatedUser = await prisma_1.prisma.usuario.update({
            where: { id },
            data: { estado: !current.estado },
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                estado: true,
            },
        });
        res.json({
            success: true,
            data: updatedUser,
            message: `Usuario '${updatedUser.nombre}' ${updatedUser.estado ? 'activado' : 'desactivado'} correctamente.`,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.toggleUserStatus = toggleUserStatus;
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (req.user?.id === id) {
            throw new errors_1.ValidationError('No puede eliminar su propia cuenta de administrador en sesión.');
        }
        const user = await prisma_1.prisma.usuario.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        ventas: true,
                        compras: true,
                        movimientos: true,
                    },
                },
            },
        });
        if (!user) {
            throw new errors_1.NotFoundError('Usuario no encontrado.');
        }
        // Proteger cuenta principal de administrador del sistema
        if (user.email === 'admin@jinstock.ni' || (process.env.INITIAL_ADMIN_EMAIL && user.email === process.env.INITIAL_ADMIN_EMAIL)) {
            throw new errors_1.ForbiddenError('No está permitido eliminar la cuenta raíz de administración del sistema.');
        }
        // Integridad contable: Si el usuario tiene ventas o compras históricas, no se debe borrar físicamente
        const totalRegistros = user._count.ventas + user._count.compras + user._count.movimientos;
        if (totalRegistros > 0) {
            throw new errors_1.ConflictError(`No se puede eliminar permanentemente al usuario porque tiene historial operativo (${user._count.ventas} ventas, ${user._count.compras} compras, ${user._count.movimientos} movimientos de inventario). Puede desactivarlo para revocar su acceso sin comprometer la integridad contable.`);
        }
        await prisma_1.prisma.usuario.delete({
            where: { id },
        });
        res.json({
            success: true,
            message: `Usuario '${user.nombre}' (${user.email}) eliminado permanentemente del sistema.`,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;

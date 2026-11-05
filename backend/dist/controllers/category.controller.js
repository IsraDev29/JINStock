"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleCategoryStatus = exports.updateCategory = exports.createCategory = exports.getCategories = void 0;
const prisma_1 = require("../config/prisma");
const errors_1 = require("../utils/errors");
const getCategories = async (req, res, next) => {
    try {
        const { includeInactive } = req.query;
        const whereClause = includeInactive === 'true' ? {} : { estado: true };
        const categories = await prisma_1.prisma.categoria.findMany({
            where: whereClause,
            orderBy: { nombre: 'asc' },
            include: {
                _count: {
                    select: { productos: true },
                },
            },
        });
        res.json({
            success: true,
            data: categories,
            message: 'Categorías obtenidas correctamente.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res, next) => {
    try {
        const { nombre, descripcion } = req.body;
        if (!nombre || !nombre.trim()) {
            throw new errors_1.ValidationError('El nombre de la categoría es obligatorio.');
        }
        const cleanNombre = nombre.trim();
        const existing = await prisma_1.prisma.categoria.findUnique({ where: { nombre: cleanNombre } });
        if (existing) {
            throw new errors_1.ConflictError('Ya existe una categoría con este nombre.');
        }
        const category = await prisma_1.prisma.categoria.create({
            data: {
                nombre: cleanNombre,
                descripcion: descripcion ? descripcion.trim() : null,
                estado: true,
            },
        });
        res.status(201).json({
            success: true,
            data: category,
            message: 'Categoría creada exitosamente.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, estado } = req.body;
        const existing = await prisma_1.prisma.categoria.findUnique({ where: { id } });
        if (!existing) {
            throw new errors_1.NotFoundError('Categoría no encontrada.');
        }
        if (nombre && nombre.trim() !== existing.nombre) {
            const duplicate = await prisma_1.prisma.categoria.findUnique({ where: { nombre: nombre.trim() } });
            if (duplicate) {
                throw new errors_1.ConflictError('Ya existe otra categoría con este nombre.');
            }
        }
        const updatedCategory = await prisma_1.prisma.categoria.update({
            where: { id },
            data: {
                ...(nombre && { nombre: nombre.trim() }),
                ...(descripcion !== undefined && { descripcion: descripcion ? descripcion.trim() : null }),
                ...(estado !== undefined && { estado: Boolean(estado) }),
            },
        });
        res.json({
            success: true,
            data: updatedCategory,
            message: 'Categoría actualizada correctamente.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateCategory = updateCategory;
// M-05: Desactivar categoría con validación de regla de negocio
const toggleCategoryStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { force } = req.query;
        const current = await prisma_1.prisma.categoria.findUnique({
            where: { id },
            include: {
                productos: {
                    where: { estado: true },
                    select: { id: true, nombre: true },
                },
            },
        });
        if (!current) {
            throw new errors_1.NotFoundError('Categoría no encontrada.');
        }
        // Regla de negocio: si se va a desactivar (pasar de true a false) y tiene productos activos
        if (current.estado && current.productos.length > 0 && force !== 'true') {
            res.status(409).json({
                success: false,
                code: 'CATEGORY_HAS_ACTIVE_PRODUCTS',
                message: `No se puede desactivar la categoría '${current.nombre}' porque contiene ${current.productos.length} producto(s) activo(s). Reubique los productos o confirme la desactivación forzada.`,
                activeProductsCount: current.productos.length,
            });
            return;
        }
        const updated = await prisma_1.prisma.categoria.update({
            where: { id },
            data: { estado: !current.estado },
        });
        res.json({
            success: true,
            data: updated,
            message: `Categoría '${updated.nombre}' ${updated.estado ? 'activada' : 'desactivada'} correctamente.`,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.toggleCategoryStatus = toggleCategoryStatus;

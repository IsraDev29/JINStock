import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { includeInactive } = req.query;
    const whereClause = includeInactive === 'true' ? {} : { estado: true };

    const categories = await prisma.categoria.findMany({
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
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre || !nombre.trim()) {
      throw new ValidationError('El nombre de la categoría es obligatorio.');
    }

    const cleanNombre = nombre.trim();

    const existing = await prisma.categoria.findUnique({ where: { nombre: cleanNombre } });
    if (existing) {
      throw new ConflictError('Ya existe una categoría con este nombre.');
    }

    const category = await prisma.categoria.create({
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
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;

    const existing = await prisma.categoria.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Categoría no encontrada.');
    }

    if (nombre && nombre.trim() !== existing.nombre) {
      const duplicate = await prisma.categoria.findUnique({ where: { nombre: nombre.trim() } });
      if (duplicate) {
        throw new ConflictError('Ya existe otra categoría con este nombre.');
      }
    }

    const updatedCategory = await prisma.categoria.update({
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
  } catch (error) {
    next(error);
  }
};

// M-05: Desactivar categoría con validación de regla de negocio
export const toggleCategoryStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const current = await prisma.categoria.findUnique({
      where: { id },
      include: {
        productos: {
          where: { estado: true },
          select: { id: true, nombre: true },
        },
      },
    });

    if (!current) {
      throw new NotFoundError('Categoría no encontrada.');
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

    const updated = await prisma.categoria.update({
      where: { id },
      data: { estado: !current.estado },
    });

    res.json({
      success: true,
      data: updated,
      message: `Categoría '${updated.nombre}' ${updated.estado ? 'activada' : 'desactivada'} correctamente.`,
    });
  } catch (error) {
    next(error);
  }
};

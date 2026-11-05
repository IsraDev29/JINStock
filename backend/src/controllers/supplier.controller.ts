import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { ValidationError, NotFoundError } from '../utils/errors';

export const getSuppliers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { includeInactive } = req.query;
    const where = includeInactive === 'true' ? {} : { estado: true };

    const suppliers = await prisma.proveedor.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { compras: true },
        },
      },
    });

    res.json({
      success: true,
      data: suppliers,
      message: 'Proveedores obtenidos correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { nombre, ruc, telefono, email, direccion } = req.body;

    if (!nombre || !nombre.trim()) {
      throw new ValidationError('El nombre del proveedor es obligatorio.');
    }

    const newSupplier = await prisma.proveedor.create({
      data: {
        nombre: nombre.trim(),
        ruc: ruc ? ruc.trim() : null,
        telefono: telefono ? telefono.trim() : null,
        email: email ? email.trim().toLowerCase() : null,
        direccion: direccion ? direccion.trim() : null,
        estado: true,
      },
    });

    res.status(201).json({
      success: true,
      data: newSupplier,
      message: 'Proveedor registrado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.proveedor.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Proveedor no encontrado.');
    }

    const updatedSupplier = await prisma.proveedor.update({
      where: { id },
      data: {
        ...(data.nombre && { nombre: data.nombre.trim() }),
        ...(data.ruc !== undefined && { ruc: data.ruc ? data.ruc.trim() : null }),
        ...(data.telefono !== undefined && { telefono: data.telefono ? data.telefono.trim() : null }),
        ...(data.email !== undefined && { email: data.email ? data.email.trim().toLowerCase() : null }),
        ...(data.direccion !== undefined && { direccion: data.direccion ? data.direccion.trim() : null }),
        ...(data.estado !== undefined && { estado: Boolean(data.estado) }),
      },
    });

    res.json({
      success: true,
      data: updatedSupplier,
      message: 'Proveedor actualizado correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

// M-05: Toggle estado de proveedor
export const toggleSupplierStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const current = await prisma.proveedor.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundError('Proveedor no encontrado.');
    }

    const updated = await prisma.proveedor.update({
      where: { id },
      data: { estado: !current.estado },
    });

    res.json({
      success: true,
      data: updated,
      message: `Proveedor '${updated.nombre}' ${updated.estado ? 'activado' : 'desactivado'} correctamente.`,
    });
  } catch (error) {
    next(error);
  }
};

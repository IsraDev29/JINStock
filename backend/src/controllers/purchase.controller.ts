import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';

export const createPurchase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { proveedorId, numeroFactura, detalles } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      throw new ForbiddenError('No autenticado.');
    }

    if (!proveedorId || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
      throw new ValidationError('Por favor seleccione un proveedor e incluya al menos un producto en la compra.');
    }

    const purchaseResult = await prisma.$transaction(async (tx) => {
      const supplier = await tx.proveedor.findUnique({ where: { id: proveedorId } });
      if (!supplier) {
        throw new NotFoundError('El proveedor seleccionado no existe.');
      }

      // Generar número de factura secuencial seguro si no se especifica
      let invoiceNum = numeroFactura ? numeroFactura.trim() : '';
      if (!invoiceNum) {
        const count = await tx.compra.count();
        invoiceNum = `PUR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
      }

      let grandTotal = 0;
      const purchaseDetailsData: any[] = [];

      for (const item of detalles) {
        const product = await tx.producto.findUnique({ where: { id: item.productoId } });
        if (!product) {
          throw new NotFoundError(`El producto con ID ${item.productoId} no existe.`);
        }

        const qty = Number(item.cantidad);
        const unitCost = Number(item.costoUnitario);

        if (!Number.isInteger(qty) || qty <= 0 || unitCost < 0) {
          throw new ValidationError(`Cantidad debe ser entero positivo y costo no negativo para '${product.nombre}'.`);
        }

        const subtotal = Number((qty * unitCost).toFixed(2));
        grandTotal += subtotal;

        purchaseDetailsData.push({
          productoId: item.productoId,
          cantidad: qty,
          costoUnitario: unitCost,
          subtotal,
        });

        // 1. Actualizar stock del producto (ENTRADA) y último costo
        const stockAnterior = product.stock;
        const stockNuevo = stockAnterior + qty;

        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stock: stockNuevo,
            costo: unitCost,
          },
        });

        // 2. Registrar movimiento Kardex ENTRADA
        await tx.movimientoInventario.create({
          data: {
            productoId: item.productoId,
            usuarioId,
            tipo: 'ENTRADA',
            cantidad: qty,
            stockAnterior,
            stockNuevo,
            motivo: `Compra Factura #${invoiceNum} (Proveedor: ${supplier.nombre})`,
          },
        });
      }

      grandTotal = Number(grandTotal.toFixed(2));

      // 3. Crear registro maestro de compra
      const purchase = await tx.compra.create({
        data: {
          numeroFactura: invoiceNum,
          proveedorId,
          usuarioId,
          total: grandTotal,
          estado: 'CONFIRMADA',
          detalles: {
            create: purchaseDetailsData,
          },
        },
        include: {
          proveedor: { select: { nombre: true, ruc: true } },
          detalles: {
            include: { producto: { select: { nombre: true, sku: true, unidadMedida: true } } },
          },
          usuario: { select: { nombre: true } },
        },
      });

      return purchase;
    });

    res.status(201).json({
      success: true,
      data: purchaseResult,
      message: 'Compra registrada exitosamente y stock actualizado.',
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { desde, hasta, page = '1', limit = '50', proveedorId } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (proveedorId) {
      where.proveedorId = String(proveedorId);
    }
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(String(desde));
      if (hasta) {
        const hastaDate = new Date(String(hasta));
        hastaDate.setHours(23, 59, 59, 999);
        where.fecha.lte = hastaDate;
      }
    }

    const [purchases, total] = await Promise.all([
      prisma.compra.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { fecha: 'desc' },
        include: {
          proveedor: { select: { nombre: true, ruc: true } },
          usuario: { select: { nombre: true } },
          detalles: {
            include: { producto: { select: { nombre: true, sku: true } } },
          },
        },
      }),
      prisma.compra.count({ where }),
    ]);

    res.json({
      success: true,
      data: purchases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'Historial de compras obtenido correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

// T-05: Anular compra (solo ADMINISTRADOR)
export const anularPurchase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const adminId = req.user?.id;

    if (!motivo || !motivo.trim()) {
      throw new ValidationError('El motivo de cancelación es obligatorio.');
    }

    if (!adminId) {
      throw new ForbiddenError('No autenticado.');
    }

    const purchase = await prisma.compra.findUnique({
      where: { id },
      include: { detalles: true },
    });

    if (!purchase) {
      throw new NotFoundError('Compra no encontrada.');
    }

    if (purchase.estado === 'CANCELADA') {
      throw new ValidationError('Esta compra ya ha sido cancelada.');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Revertir existencias de cada producto
      for (const item of purchase.detalles) {
        const prod = await tx.producto.findUnique({ where: { id: item.productoId } });
        if (prod) {
          const stockAnterior = prod.stock;
          const stockNuevo = Math.max(0, stockAnterior - item.cantidad);

          await tx.producto.update({
            where: { id: item.productoId },
            data: { stock: stockNuevo },
          });

          await tx.movimientoInventario.create({
            data: {
              productoId: item.productoId,
              usuarioId: adminId,
              tipo: 'SALIDA',
              cantidad: item.cantidad,
              stockAnterior,
              stockNuevo,
              motivo: `Cancelación de Compra #${purchase.numeroFactura || purchase.id}: ${motivo.trim()}`,
              referenciaId: purchase.id,
            },
          });
        }
      }

      return await tx.compra.update({
        where: { id },
        data: { estado: 'CANCELADA' },
      });
    });

    res.json({
      success: true,
      data: result,
      message: `Compra cancelada exitosamente y stock deducido del Kardex.`,
    });
  } catch (error) {
    next(error);
  }
};

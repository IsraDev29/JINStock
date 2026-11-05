import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { dayStartUTC, dayEndUTC, todayStringInManagua } from '../utils/timezone';

export const getSalesReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { desde, hasta } = req.query;

    const where: any = { estado: 'COMPLETADA' };
    if (desde || hasta) {
      where.fecha = {};
      // Interpret date strings as Nicaragua calendar dates (not UTC midnight)
      if (desde) where.fecha.gte = dayStartUTC(String(desde));
      if (hasta) where.fecha.lte = dayEndUTC(String(hasta));
    }

    const sales = await prisma.venta.findMany({
      where,
      orderBy: { fecha: 'asc' },
      include: {
        usuario: { select: { nombre: true } },
        detalles: {
          include: { producto: { select: { nombre: true, sku: true } } },
        },
      },
    });

    const totalVendido = sales.reduce((acc, s) => acc + s.total, 0);

    const porMetodoPago = sales.reduce((acc: Record<string, number>, s) => {
      acc[s.metodoPago] = (acc[s.metodoPago] || 0) + s.total;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalVentas: sales.length,
        montoTotal: Number(totalVendido.toFixed(2)),
        porMetodoPago,
        ventas: sales,
      },
      message: 'Reporte de ventas generado correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchasesReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { desde, hasta } = req.query;

    const where: any = { estado: 'CONFIRMADA' };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = dayStartUTC(String(desde));
      if (hasta) where.fecha.lte = dayEndUTC(String(hasta));
    }

    const purchases = await prisma.compra.findMany({
      where,
      orderBy: { fecha: 'asc' },
      include: {
        proveedor: { select: { nombre: true } },
        detalles: {
          include: { producto: { select: { nombre: true, sku: true } } },
        },
      },
    });

    const totalComprado = purchases.reduce((acc, p) => acc + p.total, 0);

    res.json({
      success: true,
      data: {
        totalCompras: purchases.length,
        montoTotal: Number(totalComprado.toFixed(2)),
        compras: purchases,
      },
      message: 'Reporte de compras generado correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

export const getTopProductsReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { desde, hasta } = req.query;

    const ventaWhere: any = { estado: 'COMPLETADA' };
    if (desde || hasta) {
      ventaWhere.fecha = {};
      if (desde) ventaWhere.fecha.gte = dayStartUTC(String(desde));
      if (hasta) ventaWhere.fecha.lte = dayEndUTC(String(hasta));
    }

    const whereVenta: any = {};
    if (desde || hasta) {
      whereVenta.fecha = {};
      if (desde) whereVenta.fecha.gte = dayStartUTC(String(desde));
      if (hasta) whereVenta.fecha.lte = dayEndUTC(String(hasta));
    }

    const topDetails = await prisma.detalleVenta.groupBy({
      by: ['productoId'],
      _sum: { cantidad: true, subtotal: true },
      where: { venta: { ...ventaWhere, estado: 'COMPLETADA' } },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 20,
    });

    const productIds = topDetails.map((d) => d.productoId);
    const products = await prisma.producto.findMany({
      where: { id: { in: productIds } },
      select: { id: true, nombre: true, sku: true, categoriaId: true, categoria: { select: { nombre: true } } },
    });

    const productMap: Record<string, any> = {};
    products.forEach((p) => { productMap[p.id] = p; });

    const data = topDetails.map((d) => ({
      productoId: d.productoId,
      nombre: productMap[d.productoId]?.nombre || 'Producto eliminado',
      sku: productMap[d.productoId]?.sku || '',
      categoria: productMap[d.productoId]?.categoria?.nombre || 'General',
      totalUnidades: Number(d._sum.cantidad || 0),
      totalVendido: Number((d._sum.subtotal || 0).toFixed(2)),
    }));

    res.json({
      success: true,
      data,
      message: 'Top productos generado correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

// F-03: Cierre de caja diario
export const getDailyCashClosing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fecha, usuarioId } = req.query;

    // If no date supplied, use today in Nicaragua time
    const dateStr = fecha ? String(fecha) : todayStringInManagua();
    const dayStart = dayStartUTC(dateStr);
    const dayEnd = dayEndUTC(dateStr);

    const where: any = {
      fecha: { gte: dayStart, lte: dayEnd },
      estado: 'COMPLETADA',
    };

    // Si es cajero o se filtró por usuario
    if (req.user?.rol === 'CAJERO') {
      where.usuarioId = req.user.id;
    } else if (usuarioId) {
      where.usuarioId = String(usuarioId);
    }

    const sales = await prisma.venta.findMany({
      where,
      orderBy: { fecha: 'asc' },
      include: {
        usuario: { select: { nombre: true, email: true } },
      },
    });

    let totalGeneral = 0;
    let totalEfectivoNIO = 0;
    let totalEfectivoUSD = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    let totalCambioNIO = 0;

    for (const s of sales) {
      totalGeneral += s.total;
      if (s.montoPagadoUSD && s.montoPagadoUSD > 0) {
        totalEfectivoUSD += s.montoPagadoUSD;
      }
      if (s.cambioNIO && s.cambioNIO > 0) {
        totalCambioNIO += s.cambioNIO;
      }

      if (s.metodoPago === 'EFECTIVO') {
        totalEfectivoNIO += s.total;
      } else if (s.metodoPago === 'TARJETA') {
        totalTarjeta += s.total;
      } else if (s.metodoPago === 'TRANSFERENCIA') {
        totalTransferencia += s.total;
      } else {
        totalEfectivoNIO += s.montoPagadoNIO || s.total;
      }
    }

    res.json({
      success: true,
      data: {
        fecha: dateStr,
        ventasCount: sales.length,
        totalGeneral: Number(totalGeneral.toFixed(2)),
        efectivoEsperadoNIO: Number(totalEfectivoNIO.toFixed(2)),
        efectivoEsperadoUSD: Number(totalEfectivoUSD.toFixed(2)),
        totalTarjeta: Number(totalTarjeta.toFixed(2)),
        totalTransferencia: Number(totalTransferencia.toFixed(2)),
        totalCambioEntregadoNIO: Number(totalCambioNIO.toFixed(2)),
        ventas: sales,
      },
      message: 'Cierre de caja calculado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

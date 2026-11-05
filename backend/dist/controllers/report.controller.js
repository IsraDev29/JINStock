"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyCashClosing = exports.getTopProductsReport = exports.getPurchasesReport = exports.getSalesReport = void 0;
const prisma_1 = require("../config/prisma");
const getSalesReport = async (req, res, next) => {
    try {
        const { desde, hasta } = req.query;
        const where = { estado: 'COMPLETADA' };
        if (desde || hasta) {
            where.fecha = {};
            if (desde)
                where.fecha.gte = new Date(String(desde));
            if (hasta) {
                const hastaDate = new Date(String(hasta));
                hastaDate.setHours(23, 59, 59, 999);
                where.fecha.lte = hastaDate;
            }
        }
        const sales = await prisma_1.prisma.venta.findMany({
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
        const porMetodoPago = sales.reduce((acc, s) => {
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
    }
    catch (error) {
        next(error);
    }
};
exports.getSalesReport = getSalesReport;
const getPurchasesReport = async (req, res, next) => {
    try {
        const { desde, hasta } = req.query;
        const where = { estado: 'CONFIRMADA' };
        if (desde || hasta) {
            where.fecha = {};
            if (desde)
                where.fecha.gte = new Date(String(desde));
            if (hasta) {
                const hastaDate = new Date(String(hasta));
                hastaDate.setHours(23, 59, 59, 999);
                where.fecha.lte = hastaDate;
            }
        }
        const purchases = await prisma_1.prisma.compra.findMany({
            where,
            orderBy: { fecha: 'asc' },
            include: {
                proveedor: { select: { id: true, nombre: true, ruc: true } },
                usuario: { select: { nombre: true } },
                detalles: {
                    include: { producto: { select: { nombre: true, sku: true } } },
                },
            },
        });
        const totalComprado = purchases.reduce((acc, p) => acc + p.total, 0);
        // Agrupación por proveedor
        const porProveedorMap = new Map();
        for (const p of purchases) {
            const suppName = p.proveedor.nombre;
            const current = porProveedorMap.get(p.proveedorId) || {
                proveedorNombre: suppName,
                total: 0,
                facturasCount: 0,
            };
            current.total += p.total;
            current.facturasCount += 1;
            porProveedorMap.set(p.proveedorId, current);
        }
        res.json({
            success: true,
            data: {
                totalCompras: purchases.length,
                montoTotal: Number(totalComprado.toFixed(2)),
                porProveedor: Array.from(porProveedorMap.values()).map((p) => ({
                    ...p,
                    total: Number(p.total.toFixed(2)),
                })),
                compras: purchases,
            },
            message: 'Reporte de compras generado correctamente.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPurchasesReport = getPurchasesReport;
const getTopProductsReport = async (req, res, next) => {
    try {
        const { desde, hasta, limit = '10' } = req.query;
        const limitNum = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 10));
        const whereVenta = { estado: 'COMPLETADA' };
        if (desde || hasta) {
            whereVenta.fecha = {};
            if (desde)
                whereVenta.fecha.gte = new Date(String(desde));
            if (hasta) {
                const hastaDate = new Date(String(hasta));
                hastaDate.setHours(23, 59, 59, 999);
                whereVenta.fecha.lte = hastaDate;
            }
        }
        // Buscar ventas en rango y agregar detalles
        const topGroup = await prisma_1.prisma.detalleVenta.groupBy({
            by: ['productoId'],
            where: {
                venta: whereVenta,
            },
            _sum: {
                cantidad: true,
                subtotal: true,
            },
            orderBy: {
                _sum: {
                    cantidad: 'desc',
                },
            },
            take: limitNum,
        });
        const productIds = topGroup.map((t) => t.productoId);
        const products = await prisma_1.prisma.producto.findMany({
            where: { id: { in: productIds } },
            select: { id: true, nombre: true, sku: true, categoria: { select: { nombre: true } } },
        });
        const prodMap = new Map(products.map((p) => [p.id, p]));
        const result = topGroup.map((item) => {
            const prod = prodMap.get(item.productoId);
            return {
                productoId: item.productoId,
                nombre: prod?.nombre || 'Producto desconocido',
                sku: prod?.sku,
                categoria: prod?.categoria?.nombre || 'General',
                cantidadVendida: item._sum.cantidad || 0,
                ingresoTotal: Number((item._sum.subtotal || 0).toFixed(2)),
            };
        });
        res.json({
            success: true,
            data: result,
            message: 'Reporte de productos más vendidos obtenido correctamente.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getTopProductsReport = getTopProductsReport;
// F-03: Cierre de caja diario
const getDailyCashClosing = async (req, res, next) => {
    try {
        const { fecha, usuarioId } = req.query;
        const targetDate = fecha ? new Date(String(fecha)) : new Date();
        const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
        const where = {
            fecha: { gte: dayStart, lte: dayEnd },
            estado: 'COMPLETADA',
        };
        // Si es cajero o se filtró por usuario
        if (req.user?.rol === 'CAJERO') {
            where.usuarioId = req.user.id;
        }
        else if (usuarioId) {
            where.usuarioId = String(usuarioId);
        }
        const sales = await prisma_1.prisma.venta.findMany({
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
            }
            else if (s.metodoPago === 'TARJETA') {
                totalTarjeta += s.total;
            }
            else if (s.metodoPago === 'TRANSFERENCIA') {
                totalTransferencia += s.total;
            }
            else {
                totalEfectivoNIO += s.montoPagadoNIO || s.total;
            }
        }
        res.json({
            success: true,
            data: {
                fecha: dayStart.toISOString().split('T')[0],
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
    }
    catch (error) {
        next(error);
    }
};
exports.getDailyCashClosing = getDailyCashClosing;

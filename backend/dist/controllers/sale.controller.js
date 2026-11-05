"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = exports.anularSale = exports.getSales = exports.createSale = void 0;
const prisma_1 = require("../config/prisma");
const errors_1 = require("../utils/errors");
let sequenceEnsured = false;
async function ensureSequenceReady() {
    if (sequenceEnsured)
        return;
    try {
        const currentYear = new Date().getFullYear();
        const seqName = `venta_comprobante_seq_${currentYear}`;
        if (typeof prisma_1.prisma.$executeRawUnsafe === 'function') {
            await prisma_1.prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1 INCREMENT 1`);
            sequenceEnsured = true;
        }
    }
    catch {
        // Si la base no es PostgreSQL o estamos con mocks, fallback a count()+1
    }
}
const createSale = async (req, res, next) => {
    try {
        await ensureSequenceReady();
        const { detalles, metodoPago, montoPagadoNIO, montoPagadoUSD, cambioNIO, offlineId } = req.body;
        const usuarioId = req.user?.id;
        if (!usuarioId) {
            throw new errors_1.ForbiddenError('No autenticado.');
        }
        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            throw new errors_1.ValidationError('El carrito de venta debe contener al menos un producto.');
        }
        // C-04 Punto 1: Idempotencia estricta para sincronizaciones offline (RNF-07)
        if (offlineId) {
            const existingSale = await prisma_1.prisma.venta.findUnique({
                where: { offlineId },
                include: {
                    detalles: {
                        include: { producto: { select: { nombre: true, sku: true } } },
                    },
                    usuario: { select: { nombre: true } },
                },
            });
            if (existingSale) {
                res.status(200).json({
                    success: true,
                    data: existingSale,
                    message: 'Venta previamente registrada con este ID offline (operación idempotente).',
                });
                return;
            }
        }
        // C-04 Punto 5: Agrupar y sumar productos duplicados en el carrito
        const consolidatedItemsMap = new Map();
        for (const item of detalles) {
            const qty = Number(item.cantidad);
            if (!Number.isInteger(qty) || qty <= 0) {
                throw new errors_1.ValidationError(`La cantidad para el producto ${item.productoId} debe ser un número entero positivo.`);
            }
            const current = consolidatedItemsMap.get(item.productoId) || 0;
            consolidatedItemsMap.set(item.productoId, current + qty);
        }
        const consolidatedItems = Array.from(consolidatedItemsMap.entries()).map(([productoId, cantidad]) => ({
            productoId,
            cantidad,
        }));
        // Ejecución transaccional atómica sin fallback en memoria (C-03 & C-04)
        const runSaleTransaction = () => prisma_1.prisma.$transaction(async (tx) => {
            // C-04 Punto 4: Obtener todos los productos en una sola consulta (evitar N+1)
            const productIds = consolidatedItems.map((i) => i.productoId);
            const dbProducts = await tx.producto.findMany({
                where: { id: { in: productIds } },
            });
            const prodMap = new Map(dbProducts.map((p) => [p.id, p]));
            // Validar existencia y estado activo de todos los productos
            for (const item of consolidatedItems) {
                const prod = prodMap.get(item.productoId);
                if (!prod) {
                    throw new errors_1.NotFoundError(`El producto con ID ${item.productoId} no existe en el catálogo.`);
                }
                if (!prod.estado) {
                    throw new errors_1.ValidationError(`El producto '${prod.nombre}' está inactivo y no se puede vender.`);
                }
            }
            // C-04 Punto 3: Descuento atómico de existencias con updateMany condicional
            for (const item of consolidatedItems) {
                const prod = prodMap.get(item.productoId);
                const updateResult = await tx.producto.updateMany({
                    where: {
                        id: item.productoId,
                        estado: true,
                        stock: { gte: item.cantidad },
                    },
                    data: {
                        stock: { decrement: item.cantidad },
                    },
                });
                if (updateResult.count !== 1) {
                    throw new errors_1.StockInsuficienteError(`Existencias insuficientes para '${prod.nombre}'. Disponibles en servidor: ${prod.stock}, solicitadas: ${item.cantidad}.`);
                }
            }
            // BUG-04: usar secuencia nativa atómica de PostgreSQL si está disponible;
            // fallback a count()+1 para entornos de test con mocks de Prisma.
            const currentYear = new Date().getFullYear();
            let numeroComprobante;
            if (sequenceEnsured && typeof tx.$queryRawUnsafe === 'function') {
                const seqName = `venta_comprobante_seq_${currentYear}`;
                const seqResult = (await tx.$queryRawUnsafe(`SELECT nextval('"${seqName}"')`));
                const seqNum = Number(seqResult[0].nextval);
                numeroComprobante = `FAC-${currentYear}-${String(seqNum).padStart(5, '0')}`;
            }
            else {
                const count = await tx.venta.count();
                numeroComprobante = `FAC-${currentYear}-${String(count + 1).padStart(5, '0')}`;
            }
            // Calcular totales con el precio unitario del servidor (no del cliente)
            let grandTotal = 0;
            const saleDetailsData = [];
            for (const item of consolidatedItems) {
                const prod = prodMap.get(item.productoId);
                const price = prod.precioVenta;
                const subtotal = Number((price * item.cantidad).toFixed(2));
                grandTotal += subtotal;
                saleDetailsData.push({
                    productoId: item.productoId,
                    cantidad: item.cantidad,
                    precioUnitario: price,
                    subtotal,
                });
                const stockAnterior = prod.stock;
                const stockNuevo = stockAnterior - item.cantidad;
                // Registrar movimiento Kardex SALIDA
                await tx.movimientoInventario.create({
                    data: {
                        productoId: item.productoId,
                        usuarioId,
                        tipo: 'SALIDA',
                        cantidad: item.cantidad,
                        stockAnterior,
                        stockNuevo,
                        motivo: `Venta POS Comprobante #${numeroComprobante}`,
                    },
                });
            }
            grandTotal = Number(grandTotal.toFixed(2));
            // Crear venta maestra
            const sale = await tx.venta.create({
                data: {
                    numeroComprobante,
                    usuarioId,
                    total: grandTotal,
                    metodoPago: metodoPago || 'EFECTIVO',
                    montoPagadoNIO: montoPagadoNIO ? Number(montoPagadoNIO) : null,
                    montoPagadoUSD: montoPagadoUSD ? Number(montoPagadoUSD) : null,
                    cambioNIO: cambioNIO ? Number(cambioNIO) : null,
                    estado: 'COMPLETADA',
                    offlineId: offlineId || null,
                    synced: true,
                    detalles: {
                        create: saleDetailsData,
                    },
                },
                include: {
                    detalles: {
                        include: { producto: { select: { nombre: true, sku: true, unidadMedida: true } } },
                    },
                    usuario: { select: { nombre: true, email: true } },
                },
            });
            return sale;
        });
        // BUG-04 resuelto con secuencia PostgreSQL: ya no hay carrera en numeroComprobante.
        // Se mantiene el guard de offlineId por si la red duplica la petición.
        let saleResult;
        for (let attempt = 1;; attempt++) {
            try {
                saleResult = await runSaleTransaction();
                break;
            }
            catch (err) {
                const target = Array.isArray(err?.meta?.target)
                    ? err.meta.target.join(',')
                    : String(err?.meta?.target ?? '');
                if (err?.code === 'P2002' && offlineId && target.includes('offlineId')) {
                    const existing = await prisma_1.prisma.venta.findUnique({
                        where: { offlineId },
                        include: {
                            detalles: { include: { producto: { select: { nombre: true, sku: true } } } },
                            usuario: { select: { nombre: true } },
                        },
                    });
                    if (existing) {
                        res.status(200).json({
                            success: true,
                            data: existing,
                            message: 'Venta previamente registrada con este ID offline (operación idempotente).',
                        });
                        return;
                    }
                }
                if (err?.code === 'P2002' && target.includes('numeroComprobante') && attempt < 5) {
                    continue;
                }
                throw err;
            }
        }
        res.status(201).json({
            success: true,
            data: saleResult,
            message: 'Venta procesada y comprobante generado exitosamente.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createSale = createSale;
const getSales = async (req, res, next) => {
    try {
        const { desde, hasta, page = '1', limit = '50', usuarioId } = req.query;
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        // M-01: Si el rol es CAJERO, solo puede consultar sus propias ventas
        if (req.user?.rol === 'CAJERO') {
            where.usuarioId = req.user.id;
        }
        else if (usuarioId) {
            where.usuarioId = String(usuarioId);
        }
        // Filtro por rango de fechas
        if (desde || hasta) {
            where.fecha = {};
            if (desde) {
                where.fecha.gte = new Date(String(desde));
            }
            if (hasta) {
                const hastaDate = new Date(String(hasta));
                hastaDate.setHours(23, 59, 59, 999);
                where.fecha.lte = hastaDate;
            }
        }
        const [sales, totalCount] = await Promise.all([
            prisma_1.prisma.venta.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { fecha: 'desc' },
                include: {
                    usuario: { select: { id: true, nombre: true } },
                    detalles: {
                        include: {
                            producto: { select: { id: true, nombre: true, sku: true } },
                        },
                    },
                },
            }),
            prisma_1.prisma.venta.count({ where }),
        ]);
        res.json({
            success: true,
            data: sales,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitNum),
            },
            message: 'Historial de ventas obtenido correctamente.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getSales = getSales;
// T-05 & F-06: Anulación de ventas (Solo ADMINISTRADOR)
const anularSale = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        const adminId = req.user?.id;
        if (!motivo || !motivo.trim()) {
            throw new errors_1.ValidationError('El motivo de anulación es obligatorio.');
        }
        if (!adminId) {
            throw new errors_1.ForbiddenError('No autenticado.');
        }
        const sale = await prisma_1.prisma.venta.findUnique({
            where: { id },
            include: { detalles: true },
        });
        if (!sale) {
            throw new errors_1.NotFoundError('Venta no encontrada.');
        }
        if (sale.estado === 'ANULADA') {
            throw new errors_1.ValidationError('Esta venta ya se encuentra anulada.');
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Revertir existencias de cada producto
            for (const item of sale.detalles) {
                const prod = await tx.producto.findUnique({ where: { id: item.productoId } });
                if (prod) {
                    const stockAnterior = prod.stock;
                    const stockNuevo = stockAnterior + item.cantidad;
                    await tx.producto.update({
                        where: { id: item.productoId },
                        data: { stock: stockNuevo },
                    });
                    // Registrar movimiento Kardex de retorno (ENTRADA por anulación)
                    await tx.movimientoInventario.create({
                        data: {
                            productoId: item.productoId,
                            usuarioId: adminId,
                            tipo: 'ENTRADA',
                            cantidad: item.cantidad,
                            stockAnterior,
                            stockNuevo,
                            motivo: `Anulación de Venta #${sale.numeroComprobante}: ${motivo.trim()}`,
                            referenciaId: sale.id,
                        },
                    });
                }
            }
            const updatedSale = await tx.venta.update({
                where: { id },
                data: { estado: 'ANULADA' },
            });
            return updatedSale;
        });
        res.json({
            success: true,
            data: result,
            message: `Venta #${sale.numeroComprobante} anulada exitosamente y stock restaurado en Kardex.`,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.anularSale = anularSale;
// M-06: Indicadores agregados del Dashboard calculados en base de datos
const getDashboardStats = async (req, res, next) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [todayAgg, monthAgg, totalProducts, lowStockProducts, outOfStockProducts, topDetails] = await Promise.all([
            // Total de ventas de hoy
            prisma_1.prisma.venta.aggregate({
                _sum: { total: true },
                _count: { id: true },
                where: {
                    fecha: { gte: todayStart },
                    estado: 'COMPLETADA',
                },
            }),
            // Total de ventas del mes
            prisma_1.prisma.venta.aggregate({
                _sum: { total: true },
                _count: { id: true },
                where: {
                    fecha: { gte: monthStart },
                    estado: 'COMPLETADA',
                },
            }),
            // Total de productos en catálogo
            prisma_1.prisma.producto.count({ where: { estado: true } }),
            // Productos con bajo stock (stock <= stockMinimo y stock > 0)
            prisma_1.prisma.$queryRaw `
          SELECT COUNT(*)::bigint AS count FROM "Producto" 
          WHERE estado = true AND stock > 0 AND stock <= "stockMinimo"
        `,
            // Productos agotados (stock = 0)
            prisma_1.prisma.producto.count({ where: { estado: true, stock: 0 } }),
            // M-06: Agregación real de los más vendidos sobre DetalleVenta
            prisma_1.prisma.detalleVenta.groupBy({
                by: ['productoId'],
                _sum: { cantidad: true },
                orderBy: { _sum: { cantidad: 'desc' } },
                take: 6,
            }),
        ]);
        // Consultar nombres y fotos de los productos más vendidos
        const topProductIds = topDetails.map((t) => t.productoId);
        const topProductRecords = await prisma_1.prisma.producto.findMany({
            where: { id: { in: topProductIds } },
            select: { id: true, nombre: true, sku: true, precioVenta: true, stock: true },
        });
        const topProdMap = new Map(topProductRecords.map((p) => [p.id, p]));
        const topSellingProducts = topDetails.map((item) => {
            const prod = topProdMap.get(item.productoId);
            return {
                productoId: item.productoId,
                nombre: prod?.nombre || 'Producto desconocido',
                sku: prod?.sku,
                precioVenta: prod?.precioVenta || 0,
                stock: prod?.stock || 0,
                unidadesVendidas: item._sum.cantidad || 0,
            };
        });
        const lowStockCount = Number(lowStockProducts[0]?.count || 0);
        res.json({
            success: true,
            data: {
                todaySalesTotal: todayAgg._sum.total || 0,
                todaySalesCount: todayAgg._count.id || 0,
                monthSalesTotal: monthAgg._sum.total || 0,
                monthSalesCount: monthAgg._count.id || 0,
                totalProductsCount: totalProducts,
                lowStockCount,
                outOfStockCount: outOfStockProducts,
                topSellingProducts,
            },
            message: 'Métricas de dashboard calculadas correctamente en servidor.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboardStats = getDashboardStats;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idParamSchema = exports.dateRangeFilterSchema = exports.inventoryAdjustmentSchema = exports.updateSupplierSchema = exports.createSupplierSchema = exports.updateCategorySchema = exports.createCategorySchema = exports.productListQuerySchema = exports.updateProductSchema = exports.createProductSchema = exports.anularPurchaseSchema = exports.createPurchaseSchema = exports.purchaseDetailItemSchema = exports.anularSaleSchema = exports.createSaleSchema = exports.saleDetailItemSchema = exports.createUserSchema = exports.verifyEmailSchema = exports.registerSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
// Autenticación
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Correo electrónico no válido'),
    password: zod_1.z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});
exports.registerSchema = zod_1.z
    .object({
    nombre: zod_1.z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: zod_1.z.string().trim().email('Correo electrónico no válido'),
    password: zod_1.z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})
    .refine((data) => data.password.toLowerCase() !== data.email.toLowerCase(), {
    message: 'La contraseña no puede ser igual al correo electrónico',
    path: ['password'],
});
exports.verifyEmailSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Correo electrónico no válido'),
    code: zod_1.z.string().trim().min(4, 'Código de verificación inválido'),
});
// Usuarios
exports.createUserSchema = zod_1.z
    .object({
    nombre: zod_1.z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: zod_1.z.string().trim().email('Correo electrónico no válido'),
    password: zod_1.z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    rol: zod_1.z.enum(['ADMINISTRADOR', 'CAJERO']).default('CAJERO'),
})
    .refine((data) => data.password.toLowerCase() !== data.email.toLowerCase(), {
    message: 'La contraseña no puede ser igual al correo electrónico',
    path: ['password'],
});
// Ventas
exports.saleDetailItemSchema = zod_1.z.object({
    productoId: zod_1.z.string().min(1, 'El ID de producto es requerido'),
    cantidad: zod_1.z.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
    precioUnitario: zod_1.z.number().nonnegative().optional(),
    subtotal: zod_1.z.number().nonnegative().optional(),
});
exports.createSaleSchema = zod_1.z.object({
    detalles: zod_1.z.array(exports.saleDetailItemSchema).min(1, 'El carrito debe contener al menos un producto'),
    metodoPago: zod_1.z.string().default('EFECTIVO'),
    montoPagadoNIO: zod_1.z.number().nonnegative().nullable().optional(),
    montoPagadoUSD: zod_1.z.number().nonnegative().nullable().optional(),
    cambioNIO: zod_1.z.number().nonnegative().nullable().optional(),
    offlineId: zod_1.z.string().nullable().optional(),
});
exports.anularSaleSchema = zod_1.z.object({
    motivo: zod_1.z.string().trim().min(3, 'El motivo de anulación es obligatorio y debe tener al menos 3 caracteres'),
});
// Compras
exports.purchaseDetailItemSchema = zod_1.z.object({
    productoId: zod_1.z.string().min(1, 'El ID de producto es requerido'),
    cantidad: zod_1.z.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
    costoUnitario: zod_1.z.number().nonnegative('El costo unitario no puede ser negativo'),
});
exports.createPurchaseSchema = zod_1.z.object({
    proveedorId: zod_1.z.string().min(1, 'El proveedor es requerido'),
    numeroFactura: zod_1.z.string().trim().optional().nullable(),
    detalles: zod_1.z.array(exports.purchaseDetailItemSchema).min(1, 'La compra debe incluir al menos un producto'),
});
exports.anularPurchaseSchema = zod_1.z.object({
    motivo: zod_1.z.string().trim().min(3, 'El motivo de cancelación es obligatorio'),
});
// Productos
exports.createProductSchema = zod_1.z.object({
    nombre: zod_1.z.string().trim().min(1, 'El nombre del producto es requerido'),
    codigoBarras: zod_1.z.string().trim().optional().nullable(),
    sku: zod_1.z.string().trim().optional().nullable(),
    descripcion: zod_1.z.string().trim().optional().nullable(),
    imagenUrl: zod_1.z.string().trim().optional().nullable(),
    categoriaId: zod_1.z.string().min(1, 'La categoría es requerida'),
    precioVenta: zod_1.z.number().positive('El precio de venta debe ser mayor a 0'),
    costo: zod_1.z.number().nonnegative('El costo no puede ser negativo'),
    stock: zod_1.z.number().int().nonnegative('El stock no puede ser negativo').default(0),
    stockMinimo: zod_1.z.number().int().nonnegative('El stock mínimo no puede ser negativo').default(5),
    unidadMedida: zod_1.z.string().trim().default('Unidad'),
});
exports.updateProductSchema = exports.createProductSchema.partial();
exports.productListQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().max(100, 'La búsqueda no puede superar 100 caracteres').optional(),
    categoriaId: zod_1.z.string().trim().min(1, 'La categoría no puede estar vacía').optional(),
    lowStock: zod_1.z.enum(['true', 'false'], { errorMap: () => ({ message: 'lowStock debe ser true o false' }) }).optional(),
    includeInactive: zod_1.z.enum(['true', 'false'], { errorMap: () => ({ message: 'includeInactive debe ser true o false' }) }).optional(),
    all: zod_1.z.enum(['true', 'false'], { errorMap: () => ({ message: 'all debe ser true o false' }) }).optional(),
    page: zod_1.z.string()
        .regex(/^\d+$/, 'page debe ser un entero positivo')
        .refine((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0, 'page debe ser un entero positivo seguro')
        .optional(),
    limit: zod_1.z.string()
        .regex(/^\d+$/, 'limit debe ser un entero positivo')
        .refine((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0, 'limit debe ser un entero positivo seguro')
        .optional(),
});
// Categorías
exports.createCategorySchema = zod_1.z.object({
    nombre: zod_1.z.string().trim().min(1, 'El nombre de la categoría es requerido'),
    descripcion: zod_1.z.string().trim().optional().nullable(),
});
exports.updateCategorySchema = zod_1.z.object({
    nombre: zod_1.z.string().trim().min(1).optional(),
    descripcion: zod_1.z.string().trim().optional().nullable(),
    estado: zod_1.z.boolean().optional(),
});
// Proveedores
exports.createSupplierSchema = zod_1.z.object({
    nombre: zod_1.z.string().trim().min(1, 'El nombre del proveedor es requerido'),
    ruc: zod_1.z.string().trim().optional().nullable(),
    telefono: zod_1.z.string().trim().optional().nullable(),
    email: zod_1.z.string().trim().email('Correo de proveedor inválido').optional().nullable(),
    direccion: zod_1.z.string().trim().optional().nullable(),
});
exports.updateSupplierSchema = exports.createSupplierSchema.partial();
// Ajuste manual de inventario
exports.inventoryAdjustmentSchema = zod_1.z.object({
    productoId: zod_1.z.string().min(1, 'El ID de producto es requerido'),
    cantidad: zod_1.z.number().int().refine((val) => val !== 0, 'La cantidad de ajuste no puede ser 0'),
    motivo: zod_1.z.string().trim().min(3, 'El motivo del ajuste es obligatorio (ej. conteo físico, merma, rotura)'),
});
// Validación de parámetros de consulta (Fechas y Paginación)
const isValidDateString = (val) => {
    if (!val)
        return true;
    return /^\d{4}-\d{2}-\d{2}/.test(val) && !isNaN(new Date(val).getTime());
};
exports.dateRangeFilterSchema = zod_1.z.object({
    desde: zod_1.z.string().refine(isValidDateString, 'La fecha "desde" no es válida').optional(),
    hasta: zod_1.z.string().refine(isValidDateString, 'La fecha "hasta" no es válida').optional(),
    page: zod_1.z.string().regex(/^\d+$/, 'El parámetro page debe ser un número entero positivo').optional(),
    limit: zod_1.z.string().regex(/^\d+$/, 'El parámetro limit debe ser un número entero positivo').optional(),
    usuarioId: zod_1.z.string().optional(),
    proveedorId: zod_1.z.string().optional(),
    productoId: zod_1.z.string().optional(),
    tipo: zod_1.z.string().optional(),
    fecha: zod_1.z.string().refine(isValidDateString, 'La fecha no es válida').optional(),
    search: zod_1.z.string().optional(),
    categoriaId: zod_1.z.string().optional(),
    lowStock: zod_1.z.string().optional(),
    includeInactive: zod_1.z.string().optional(),
    all: zod_1.z.string().optional(),
    force: zod_1.z.string().optional(),
});
exports.idParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'El identificador no puede estar vacío'),
});

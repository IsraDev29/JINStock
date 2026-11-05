import { z } from 'zod';

// Autenticación
export const loginSchema = z.object({
  email: z.string().trim().email('Correo electrónico no válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const registerSchema = z
  .object({
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().trim().email('Correo electrónico no válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  })
  .refine((data) => data.password.toLowerCase() !== data.email.toLowerCase(), {
    message: 'La contraseña no puede ser igual al correo electrónico',
    path: ['password'],
  });

export const verifyEmailSchema = z.object({
  email: z.string().trim().email('Correo electrónico no válido'),
  code: z.string().trim().min(4, 'Código de verificación inválido'),
});

// Usuarios
export const createUserSchema = z
  .object({
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().trim().email('Correo electrónico no válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    rol: z.enum(['ADMINISTRADOR', 'CAJERO']).default('CAJERO'),
  })
  .refine((data) => data.password.toLowerCase() !== data.email.toLowerCase(), {
    message: 'La contraseña no puede ser igual al correo electrónico',
    path: ['password'],
  });

// Ventas
export const saleDetailItemSchema = z.object({
  productoId: z.string().min(1, 'El ID de producto es requerido'),
  cantidad: z.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
});

export const createSaleSchema = z.object({
  detalles: z.array(saleDetailItemSchema).min(1, 'El carrito debe contener al menos un producto'),
  metodoPago: z.string().default('EFECTIVO'),
  montoPagadoNIO: z.number().nonnegative().nullable().optional(),
  montoPagadoUSD: z.number().nonnegative().nullable().optional(),
  cambioNIO: z.number().nonnegative().nullable().optional(),
  offlineId: z.string().nullable().optional(),
  fecha: z.string().nullable().optional(),
});

export const anularSaleSchema = z.object({
  motivo: z.string().trim().min(3, 'El motivo de anulación es obligatorio y debe tener al menos 3 caracteres'),
});

// Compras
export const purchaseDetailItemSchema = z.object({
  productoId: z.string().min(1, 'El ID de producto es requerido'),
  cantidad: z.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
  costoUnitario: z.number().nonnegative('El costo unitario no puede ser negativo'),
});

export const createPurchaseSchema = z.object({
  proveedorId: z.string().min(1, 'El proveedor es requerido'),
  numeroFactura: z.string().trim().optional().nullable(),
  detalles: z.array(purchaseDetailItemSchema).min(1, 'La compra debe incluir al menos un producto'),
});

export const anularPurchaseSchema = z.object({
  motivo: z.string().trim().min(3, 'El motivo de cancelación es obligatorio'),
});

// Productos
export const createProductSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del producto es requerido'),
  codigoBarras: z.string().trim().optional().nullable(),
  sku: z.string().trim().optional().nullable(),
  descripcion: z.string().trim().optional().nullable(),
  imagenUrl: z.string().trim().optional().nullable(),
  categoriaId: z.string().min(1, 'La categoría es requerida'),
  precioVenta: z.number().positive('El precio de venta debe ser mayor a 0'),
  costo: z.number().nonnegative('El costo no puede ser negativo'),
  stock: z.number().int().nonnegative('El stock no puede ser negativo').default(0),
  stockMinimo: z.number().int().nonnegative('El stock mínimo no puede ser negativo').default(5),
  unidadMedida: z.string().trim().default('Unidad'),
});

export const updateProductSchema = createProductSchema.partial();

export const productListQuerySchema = z.object({
  search: z.string().trim().max(100, 'La búsqueda no puede superar 100 caracteres').optional(),
  categoriaId: z.string().trim().min(1, 'La categoría no puede estar vacía').optional(),
  lowStock: z.enum(['true', 'false'], { errorMap: () => ({ message: 'lowStock debe ser true o false' }) }).optional(),
  includeInactive: z.enum(['true', 'false'], { errorMap: () => ({ message: 'includeInactive debe ser true o false' }) }).optional(),
  all: z.enum(['true', 'false'], { errorMap: () => ({ message: 'all debe ser true o false' }) }).optional(),
  page: z.string()
    .regex(/^\d+$/, 'page debe ser un entero positivo')
    .refine((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0, 'page debe ser un entero positivo seguro')
    .optional(),
  limit: z.string()
    .regex(/^\d+$/, 'limit debe ser un entero positivo')
    .refine((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0, 'limit debe ser un entero positivo seguro')
    .optional(),
});

// Categorías
export const createCategorySchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre de la categoría es requerido'),
  descripcion: z.string().trim().optional().nullable(),
});

export const updateCategorySchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  descripcion: z.string().trim().optional().nullable(),
  estado: z.boolean().optional(),
});

// Proveedores
export const createSupplierSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del proveedor es requerido'),
  ruc: z.string().trim().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().email('Correo de proveedor inválido').optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// Ajuste manual de inventario
export const inventoryAdjustmentSchema = z.object({
  productoId: z.string().min(1, 'El ID de producto es requerido'),
  cantidad: z.number().int().refine((val) => val !== 0, 'La cantidad de ajuste no puede ser 0'),
  motivo: z.string().trim().min(3, 'El motivo del ajuste es obligatorio (ej. conteo físico, merma, rotura)'),
});

// Validación de parámetros de consulta (Fechas y Paginación)
const isValidDateString = (val?: string) => {
  if (!val) return true;
  return /^\d{4}-\d{2}-\d{2}/.test(val) && !isNaN(new Date(val).getTime());
};

export const dateRangeFilterSchema = z.object({
  desde: z.string().refine(isValidDateString, 'La fecha "desde" no es válida').optional(),
  hasta: z.string().refine(isValidDateString, 'La fecha "hasta" no es válida').optional(),
  page: z.string().regex(/^\d+$/, 'El parámetro page debe ser un número entero positivo').optional(),
  limit: z.string().regex(/^\d+$/, 'El parámetro limit debe ser un número entero positivo').optional(),
  usuarioId: z.string().optional(),
  proveedorId: z.string().optional(),
  productoId: z.string().optional(),
  tipo: z.string().optional(),
  fecha: z.string().refine(isValidDateString, 'La fecha no es válida').optional(),
  search: z.string().optional(),
  categoriaId: z.string().optional(),
  lowStock: z.string().optional(),
  includeInactive: z.string().optional(),
  all: z.string().optional(),
  force: z.string().optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'El identificador no puede estar vacío'),
});

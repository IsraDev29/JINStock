import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock Prisma antes de importar server/app
vi.mock('../src/config/prisma', () => {
  return {
    prisma: {
      venta: {
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      producto: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        fields: {
          stockMinimo: 'stockMinimo',
        },
      },
      usuario: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      movimientoInventario: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      compra: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      proveedor: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    },
  };
});

vi.mock('../src/utils/mailer', () => ({
  sendConfirmationEmail: vi.fn().mockResolvedValue(true),
}));

import app from '../src/server';
import { prisma } from '../src/config/prisma';
import { sanitizeLogData } from '../src/utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-test-jwt-key-minimum-32-chars-long';

const adminToken = jwt.sign(
  { id: 'admin-123', email: 'admin@libreria.ni', rol: 'ADMINISTRADOR', nombre: 'Admin General' },
  JWT_SECRET,
  { expiresIn: '2h' }
);

const cajeroToken = jwt.sign(
  { id: 'cajero-456', email: 'cajero@libreria.ni', rol: 'CAJERO', nombre: 'Cajero Mostrador' },
  JWT_SECRET,
  { expiresIn: '2h' }
);

describe('Suite de Pruebas Automáticas del Backend (Sección 6 del Informe Técnico)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.$queryRaw as any).mockResolvedValue([{ 1: 1 }]);
  });

  // 1. Una venta con stock suficiente descuenta el inventario y crea el movimiento SALIDA.
  it('1. Una venta con stock suficiente descuenta el inventario y crea el movimiento SALIDA', async () => {
    const mockProduct = {
      id: 'prod-001',
      nombre: 'Cuaderno Loro 100 Hojas',
      sku: 'CUAD-100',
      precioVenta: 45.0,
      stock: 20,
      estado: true,
    };

    // Simular findUnique para offlineId (no existe)
    (prisma.venta.findUnique as any).mockResolvedValue(null);

    // Simular transacción
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const txMock = {
        producto: {
          findMany: vi.fn().mockResolvedValue([mockProduct]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }), // Descuento exitoso
        },
        venta: {
          count: vi.fn().mockResolvedValue(10),
          create: vi.fn().mockResolvedValue({
            id: 'sale-001',
            numeroComprobante: 'FAC-2026-00011',
            total: 90.0,
            estado: 'COMPLETADA',
            detalles: [{ productoId: 'prod-001', cantidad: 2, precioUnitario: 45.0, subtotal: 90.0 }],
          }),
        },
        movimientoInventario: {
          create: vi.fn().mockResolvedValue({
            id: 'mov-001',
            tipo: 'SALIDA',
            cantidad: 2,
            stockAnterior: 20,
            stockNuevo: 18,
          }),
        },
      };
      return callback(txMock);
    });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({
        detalles: [{ productoId: 'prod-001', cantidad: 2 }],
        metodoPago: 'EFECTIVO_CORDOBAS',
        montoPagadoNIO: 100,
        cambioNIO: 10,
        offlineId: 'offline-sale-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.numeroComprobante).toBe('FAC-2026-00011');
  });

  // 2. Una venta con stock insuficiente responde 400 con código STOCK_INSUFICIENTE y no modifica el stock.
  it('2. Una venta con stock insuficiente responde 400 con código STOCK_INSUFICIENTE', async () => {
    const mockProduct = {
      id: 'prod-001',
      nombre: 'Cuaderno Loro 100 Hojas',
      sku: 'CUAD-100',
      precioVenta: 45.0,
      stock: 1, // Solo hay 1
      estado: true,
    };

    (prisma.venta.findUnique as any).mockResolvedValue(null);

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const txMock = {
        producto: {
          findMany: vi.fn().mockResolvedValue([mockProduct]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }), // count 0 indica que la condición WHERE stock >= cantidad no se cumplió
        },
        venta: {
          count: vi.fn().mockResolvedValue(10),
          create: vi.fn(),
        },
        movimientoInventario: {
          create: vi.fn(),
        },
      };
      return callback(txMock);
    });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({
        detalles: [{ productoId: 'prod-001', cantidad: 5 }], // Pide 5
        metodoPago: 'EFECTIVO_CORDOBAS',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('STOCK_INSUFICIENTE');
  });

  // 3. Enviar dos veces el mismo offlineId crea una sola venta y la segunda respuesta devuelve la existente (Idempotencia).
  it('3. Enviar dos veces el mismo offlineId es idempotente y responde 200 con la venta existente', async () => {
    const existingOfflineSale = {
      id: 'sale-already-created',
      offlineId: 'client-offline-uuid-999',
      numeroComprobante: 'FAC-2026-00050',
      total: 120.0,
      detalles: [],
    };

    // findUnique encuentra la venta existente con ese offlineId
    (prisma.venta.findUnique as any).mockResolvedValue(existingOfflineSale);

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({
        detalles: [{ productoId: 'prod-001', cantidad: 2 }],
        metodoPago: 'EFECTIVO_CORDOBAS',
        offlineId: 'client-offline-uuid-999',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('sale-already-created');
    expect(res.body.data.offlineId).toBe('client-offline-uuid-999');
    // Verifica que NO se llamó a $transaction para duplicar la venta
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // 4. Dos ventas simultáneas del mismo producto con stock para una sola no dejan stock negativo.
  it('4. Concurrencia: updateMany atómico rechaza la segunda venta si el stock ya fue consumido', async () => {
    const mockProduct = {
      id: 'prod-002',
      nombre: 'Bolígrafo Pilot G2',
      sku: 'PILOT-G2',
      precioVenta: 35.0,
      stock: 1, // Solo queda 1 bolígrafo
      estado: true,
    };

    (prisma.venta.findUnique as any).mockResolvedValue(null);

    // Si dos transacciones intentan comprar 1 bolígrafo a la vez, la segunda recibirá count === 0 en updateMany
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const txMock = {
        producto: {
          findMany: vi.fn().mockResolvedValue([mockProduct]),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }), // La condición atómica { stock: { gte: 1 } } falló
        },
        venta: { count: vi.fn(), create: vi.fn() },
        movimientoInventario: { create: vi.fn() },
      };
      return callback(txMock);
    });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({
        detalles: [{ productoId: 'prod-002', cantidad: 1 }],
        metodoPago: 'EFECTIVO_CORDOBAS',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('STOCK_INSUFICIENTE');
  });

  // 5. Un cajero recibe 403 al llamar a compras, usuarios, creación de productos o proveedores.
  it('5. Un cajero recibe 403 al llamar a rutas restringidas a ADMINISTRADOR', async () => {
    // 5a. Compras
    const resCompras = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({ proveedorId: 'prov-1', detalles: [] });
    expect(resCompras.status).toBe(403);
    expect(resCompras.body.code).toBe('FORBIDDEN');

    // 5b. Usuarios
    const resUsuarios = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${cajeroToken}`);
    expect(resUsuarios.status).toBe(403);
    expect(resUsuarios.body.code).toBe('FORBIDDEN');

    // 5c. Creación de productos
    const resProd = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({ nombre: 'Nuevo Item' });
    expect(resProd.status).toBe(403);
    expect(resProd.body.code).toBe('FORBIDDEN');

    // 5d. Proveedores
    const resProv = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({ nombre: 'Distribuidora Central' });
    expect(resProv.status).toBe(403);
    expect(resProv.body.code).toBe('FORBIDDEN');
  });

  // 6. El registro público no puede crear administradores.
  it('6. El registro público no permite crear administradores', async () => {
    (prisma.usuario.findFirst as any).mockResolvedValue(null);
    (prisma.usuario.findUnique as any).mockResolvedValue(null);
    (prisma.usuario.create as any).mockImplementation(({ data }: any) => {
      return {
        id: 'new-user-id',
        nombre: data.nombre,
        email: data.email,
        rol: data.rol, // Verificamos qué rol le asignó el controlador
        estado: true,
      };
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'Intruso Hack',
        email: 'intruso@hack.com',
        password: 'Password123!',
        rol: 'ADMINISTRADOR', // Intenta solicitar ser admin públicamente
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // El controlador fuerza el rol a CAJERO y no otorga ADMINISTRADOR a registros públicos
    expect(res.body.data.usuario.rol).toBe('CAJERO');
  });

  describe('FASE 0: Verificaciones del Parche de Seguridad y Resiliencia', () => {
    it('/api/logs exige token de ADMINISTRADOR (401 sin token, 403 con CAJERO, 200 con ADMINISTRADOR)', async () => {
      // Sin token -> 401
      const resNoToken = await request(app).get('/api/logs');
      expect(resNoToken.status).toBe(401);
      expect(resNoToken.body.code).toBe('UNAUTHORIZED');

      // Con cajero -> 403
      const resCajero = await request(app)
        .get('/api/logs')
        .set('Authorization', `Bearer ${cajeroToken}`);
      expect(resCajero.status).toBe(403);
      expect(resCajero.body.code).toBe('FORBIDDEN');

      // Con admin -> 200
      const resAdmin = await request(app)
        .get('/api/logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.success).toBe(true);
      expect(Array.isArray(resAdmin.body.data)).toBe(true);
    });

    it('JSON malformado en body devuelve 400 con code JSON_INVALIDO', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "invalido",'); // JSON truncado/malformado

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('JSON_INVALIDO');
      expect(res.body.success).toBe(false);
    });

    it('Rutas inexistentes devuelven 404 en formato JSON con RUTA_NO_ENCONTRADA', async () => {
      const res = await request(app).get('/api/ruta-inexistente-aleatoria-xyz');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RUTA_NO_ENCONTRADA');
      expect(res.body.success).toBe(false);
    });

    it('createSale reintenta ante P2002 de numeroComprobante y completa la venta', async () => {
      (prisma.venta.findUnique as any).mockResolvedValue(null);

      let attempts = 0;
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        attempts++;
        if (attempts === 1) {
          const p2002Err: any = new Error('Unique constraint failed on numeroComprobante');
          p2002Err.code = 'P2002';
          p2002Err.meta = { target: ['numeroComprobante'] };
          throw p2002Err;
        }

        return {
          id: 'sale-retry-success',
          numeroComprobante: 'FAC-2026-00012',
          total: 50.0,
          estado: 'COMPLETADA',
          detalles: [],
        };
      });

      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${cajeroToken}`)
        .send({
          detalles: [{ productoId: 'prod-001', cantidad: 1 }],
          metodoPago: 'EFECTIVO',
          montoPagadoNIO: 50.0,
        });

      expect(attempts).toBe(2);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('sale-retry-success');
    });

    it('createSale responde 200 con la venta existente ante P2002 de offlineId', async () => {
      const existingSale = {
        id: 'sale-offline-existing',
        numeroComprobante: 'FAC-2026-00007',
        total: 100.0,
        offlineId: 'offline-uuid-999',
        estado: 'COMPLETADA',
        detalles: [],
      };

      // Primer findUnique antes de la transacción devuelve null (condición de carrera)
      // Segundo findUnique dentro del catch devuelve la venta que ganó la carrera
      (prisma.venta.findUnique as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingSale);

      (prisma.$transaction as any).mockImplementation(async () => {
        const p2002Err: any = new Error('Unique constraint failed on offlineId');
        p2002Err.code = 'P2002';
        p2002Err.meta = { target: ['offlineId'] };
        throw p2002Err;
      });

      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${cajeroToken}`)
        .send({
          detalles: [{ productoId: 'prod-001', cantidad: 1 }],
          metodoPago: 'EFECTIVO',
          offlineId: 'offline-uuid-999',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('sale-offline-existing');
      expect(res.body.message).toContain('operación idempotente');
    });
  });

  describe('FASE 1: Seguridad y Políticas de Autenticación', () => {
    it('Rechaza contraseña menor a 8 caracteres con 400 y código DATOS_INVALIDOS', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          nombre: 'Juan Perez',
          email: 'juan@libreria.ni',
          password: 'corta', // 5 caracteres < 8
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DATOS_INVALIDOS');
      expect(res.body.message).toContain('al menos 8 caracteres');
    });

    it('Rechaza contraseña idéntica al correo electrónico con 400 y código DATOS_INVALIDOS', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          nombre: 'Juan Perez',
          email: 'juanperez@libreria.ni',
          password: 'juanperez@libreria.ni', // Igual al email
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DATOS_INVALIDOS');
      expect(res.body.message).toContain('no puede ser igual al correo');
    });

    it('Login con cuenta desactivada devuelve 401 NO_AUTORIZADO idéntico a usuario inexistente', async () => {
      // Simular usuario existente pero desactivado (estado: false)
      (prisma.usuario.findUnique as any).mockResolvedValue({
        id: 'user-deactivated',
        nombre: 'Cajero Inactivo',
        email: 'inactivo@libreria.ni',
        passwordHash: '$2a$10$fwpnTfbUzBXPKYHWkMmhW.U.CpOpvmNG1uewY.44qZoSWjEROKoA.',
        rol: 'CAJERO',
        estado: false,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactivo@libreria.ni',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('NO_AUTORIZADO');
      expect(res.body.message).toBe('Credenciales inválidas. Verifique su correo o contraseña.');
    });
  });

  describe('FASE 2: Validación de Parámetros de Consulta y Manejo de Errores', () => {
    it('GET /api/sales con fecha desde inválida responde 400 DATOS_INVALIDOS', async () => {
      const res = await request(app)
        .get('/api/sales?desde=fecha-invalida-123')
        .set('Authorization', `Bearer ${cajeroToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DATOS_INVALIDOS');
      expect(res.body.message).toContain('desde');
    });

    it('GET /api/sales con page no numérica responde 400 DATOS_INVALIDOS', async () => {
      const res = await request(app)
        .get('/api/sales?page=pagina-uno')
        .set('Authorization', `Bearer ${cajeroToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DATOS_INVALIDOS');
      expect(res.body.message).toContain('page');
    });

    it('Violación de clave foránea P2003 devuelve 409 CONFLICTO sin fugar datos sensibles', async () => {
      (prisma.$transaction as any).mockImplementation(async () => {
        const p2003Err: any = new Error('Foreign key constraint failed on proveedorId');
        p2003Err.code = 'P2003';
        throw p2003Err;
      });

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          proveedorId: 'prov-inexistente',
          detalles: [{ productoId: 'prod-001', cantidad: 10, costoUnitario: 25.0 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICTO');
      expect(res.body.message).toBe('No se puede completar la operación debido a dependencias con otros registros relacionados.');
    });
  });

  describe('FASE 3: Rendimiento, Paginación Compatible y Health Check Resiliente', () => {
    it('expone liveness sin depender de la base de datos', async () => {
      (prisma.$queryRaw as any).mockRejectedValue(new Error('Database unavailable'));

      const res = await request(app).get('/api/live');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, status: 'alive' });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('expone el tiempo de la comprobación de DB y evita cachear la respuesta', async () => {
      (prisma.$queryRaw as any).mockResolvedValue([{ 1: 1 }]);

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['server-timing']).toMatch(/db;dur=\d+\.\d{2};desc="checked"/);
      expect(res.headers['server-timing']).toMatch(/app;dur=\d+\.\d{2}/);
    });

    it('coalescea sondas concurrentes del health check en una sola consulta', async () => {
      (prisma.$queryRaw as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ 1: 1 }]), 20))
      );

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => request(app).get('/api/health'))
      );

      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('GET /api/products con page y limit devuelve metadata de paginación', async () => {
      (prisma.producto.findMany as any).mockResolvedValue([
        { id: 'p1', nombre: 'Cuaderno', sku: 'C-01', precioVenta: 50, stock: 10, stockMinimo: 5, estado: true },
      ]);
      (prisma.producto.count as any).mockResolvedValue(15);

      const res = await request(app)
        .get('/api/products?page=1&limit=5')
        .set('Authorization', `Bearer ${cajeroToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.pagination.total).toBe(15);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    it('GET /api/products rechaza page inválida con 400 sin consultar la base de datos', async () => {
      const res = await request(app)
        .get('/api/products?page=pagina-uno')
        .set('Authorization', `Bearer ${cajeroToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DATOS_INVALIDOS');
      expect(res.body.message).toContain('page');
      expect(prisma.producto.findMany).not.toHaveBeenCalled();
    });

    it('GET /api/products rechaza filtros booleanos inválidos y búsquedas excesivas', async () => {
      const invalidFilter = await request(app)
        .get('/api/products?lowStock=maybe')
        .set('Authorization', `Bearer ${cajeroToken}`);

      expect(invalidFilter.status).toBe(400);
      expect(invalidFilter.body.code).toBe('DATOS_INVALIDOS');

      const longSearch = await request(app)
        .get('/api/products')
        .query({ search: 'x'.repeat(101) })
        .set('Authorization', `Bearer ${cajeroToken}`);

      expect(longSearch.status).toBe(400);
      expect(longSearch.body.code).toBe('DATOS_INVALIDOS');
      expect(prisma.producto.findMany).not.toHaveBeenCalled();
    });

    it('GET /api/products con all=true no pagina y devuelve catálogo completo (modo offline)', async () => {
      (prisma.producto.findMany as any).mockResolvedValue([
        { id: 'p1', nombre: 'Cuaderno', sku: 'C-01', precioVenta: 50, stock: 10, stockMinimo: 5, estado: true },
        { id: 'p2', nombre: 'Lapicero', sku: 'L-01', precioVenta: 15, stock: 20, stockMinimo: 5, estado: true },
      ]);

      const res = await request(app)
        .get('/api/products?all=true&limit=1')
        .set('Authorization', `Bearer ${cajeroToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination).toBeUndefined();
    });

    it('GET /api/health devuelve 503 si la base de datos no responde (simulando timeout o caída)', async () => {
      (prisma.$queryRaw as any).mockRejectedValue(new Error('Connection terminated'));

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe('unhealthy');
      expect(res.body.message).toContain('base de datos');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['server-timing']).toContain('desc="failed"');
    });
  });

  describe('FASE 4: Monitoreo, Logs Estructurados, X-Request-Id y Sanitización', () => {
    it('usa una cantidad limitada de saltos de proxy en vez de trust proxy permisivo', () => {
      expect(app.get('trust proxy')).toBe(0);
    });

    it('Todas las respuestas HTTP incluyen el header X-Request-Id', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
    });

    it('Si el cliente envía X-Request-Id personalizado, se preserva en el header y la respuesta', async () => {
      const customId = 'trace-id-abc-12345';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', customId);

      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('Las respuestas de error (ej. 404) devuelven el requestId en el cuerpo JSON', async () => {
      const res = await request(app)
        .get('/api/ruta-inexistente-para-test')
        .set('X-Request-Id', 'req-error-404-test');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RUTA_NO_ENCONTRADA');
      expect(res.body.requestId).toBe('req-error-404-test');
    });

    it('sanitizeLogData redacta contraseñas, tokens y authorization de los logs', () => {
      const payload = {
        email: 'user@libreria.ni',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOi...',
        nested: {
          secret: 'shhh',
          authorization: 'Bearer 12345',
          cookie: 'session=xyz',
          normalData: 42,
        },
      };

      const sanitized = sanitizeLogData(payload);
      expect(sanitized.email).toBe('user@libreria.ni');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.nested.secret).toBe('[REDACTED]');
      expect(sanitized.nested.authorization).toBe('[REDACTED]');
      expect(sanitized.nested.cookie).toBe('[REDACTED]');
      expect(sanitized.nested.normalData).toBe(42);
    });
  });
});

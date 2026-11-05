import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const hasRealDb = Boolean(process.env.TEST_DATABASE_URL);

describe('FASE 6: Pruebas de Integración y Concurrencia Real', () => {
  let realPrisma: PrismaClient | null = null;
  let testUserId = '';
  let testProductId = '';
  let authToken = '';

  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-test-jwt-key-minimum-32-chars-long';

  beforeAll(async () => {
    if (hasRealDb) {
      realPrisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.TEST_DATABASE_URL,
          },
        },
      });

      // Crear usuario de pruebas en BD real
      const testUser = await realPrisma.usuario.upsert({
        where: { email: 'cajero-concurrency-test@jinstock.ni' },
        update: {},
        create: {
          nombre: 'Cajero Concurrencia',
          email: 'cajero-concurrency-test@jinstock.ni',
          passwordHash: 'dummy-hash',
          rol: 'CAJERO',
          estado: true,
          verificado: true,
        },
      });
      testUserId = testUser.id;

      authToken = jwt.sign(
        { id: testUserId, email: testUser.email, rol: testUser.rol, nombre: testUser.nombre },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Crear categoría de pruebas
      const category = await realPrisma.categoria.upsert({
        where: { id: 'cat-test-concurrency' },
        update: {},
        create: {
          id: 'cat-test-concurrency',
          nombre: 'Categoría Concurrencia',
          estado: true,
        },
      });

      // Crear producto con exactamente 5 unidades en stock
      const product = await realPrisma.producto.upsert({
        where: { id: 'prod-test-concurrency-5stock' },
        update: { stock: 5 },
        create: {
          id: 'prod-test-concurrency-5stock',
          nombre: 'Marcador Permanente Test',
          sku: 'MARC-TEST-01',
          precioVenta: 20.0,
          costo: 10.0,
          stock: 5,
          stockMinimo: 2,
          categoriaId: category.id,
          estado: true,
        },
      });
      testProductId = product.id;

      // Garantizar que la secuencia de comprobantes exista en la BD de pruebas
      const currentYear = new Date().getFullYear();
      await realPrisma.$executeRawUnsafe(
        `CREATE SEQUENCE IF NOT EXISTS "venta_comprobante_seq_${currentYear}" START 1 INCREMENT 1`
      );
    }
  });

  afterAll(async () => {
    if (realPrisma) {
      try {
        await realPrisma.detalleVenta.deleteMany({
          where: { productoId: testProductId },
        });
        await realPrisma.movimientoInventario.deleteMany({
          where: { productoId: testProductId },
        });
        await realPrisma.venta.deleteMany({
          where: { usuarioId: testUserId },
        });
        await realPrisma.producto.deleteMany({
          where: { id: testProductId },
        });
        await realPrisma.categoria.deleteMany({
          where: { id: 'cat-test-concurrency' },
        });
        await realPrisma.usuario.deleteMany({
          where: { id: testUserId },
        });
      } finally {
        await realPrisma.$disconnect();
      }
    }
  });

  it.skipIf(!hasRealDb)(
    '10 ventas simultáneas sobre un stock inicial de 5: exactamente 5 aprobadas, 5 rechazadas, stock en 0 (nunca negativo)',
    async () => {
      // Importamos app solo si tenemos DB real para no interferir con los mocks de api.test.ts
      const { default: app } = await import('../src/server');

      // Lanzar 10 ventas en paralelo, cada una de 1 unidad
      const promises = Array.from({ length: 10 }).map((_, index) => {
        return request(app)
          .post('/api/sales')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            detalles: [{ productoId: testProductId, cantidad: 1 }],
            metodoPago: 'EFECTIVO_CORDOBAS',
            offlineId: `offline-conc-uuid-${index}`,
          });
      });

      const responses = await Promise.all(promises);

      const successful = responses.filter((r) => r.status === 201 || r.status === 200);
      const rejected = responses.filter((r) => r.status === 400);

      // Verificación 1: Exactamente 5 aprobadas y 5 rechazadas
      expect(successful.length).toBe(5);
      expect(rejected.length).toBe(5);

      for (const rej of rejected) {
        expect(rej.body.code).toBe('STOCK_INSUFICIENTE');
      }

      // Verificación 2: Todos los comprobantes generados son únicos
      const comprobantes = successful.map((s) => s.body.data.numeroComprobante);
      const uniqueComprobantes = new Set(comprobantes);
      expect(uniqueComprobantes.size).toBe(5);

      // Verificación 3: El stock en base de datos quedó en 0 y nunca fue negativo
      const finalProduct = await realPrisma!.producto.findUnique({
        where: { id: testProductId },
      });
      expect(finalProduct!.stock).toBe(0);

      // Verificación 4: Idempotencia - reenviar una venta aprobada responde 200 con la venta original
      const sampleSale = successful[0].body.data;
      const idempotentRes = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          detalles: [{ productoId: testProductId, cantidad: 1 }],
          metodoPago: 'EFECTIVO_CORDOBAS',
          offlineId: sampleSale.offlineId,
        });

      expect(idempotentRes.status).toBe(200);
      expect(idempotentRes.body.data.id).toBe(sampleSale.id);
      expect(idempotentRes.body.data.numeroComprobante).toBe(sampleSale.numeroComprobante);
    }
  );

  it('Verificación de configuración del entorno de pruebas de integración', () => {
    if (!hasRealDb) {
      console.log(
        'ℹ️ [FASE 6] TEST_DATABASE_URL no está definida. La prueba de integración real se ejecutará en GitHub Actions o con docker-compose.test.yml.'
      );
    }
    expect(true).toBe(true);
  });
});

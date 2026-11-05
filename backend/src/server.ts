import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import saleRoutes from './routes/sale.routes';
import supplierRoutes from './routes/supplier.routes';
import purchaseRoutes from './routes/purchase.routes';
import userRoutes from './routes/user.routes';
import reportRoutes from './routes/report.routes';
import { prisma } from './config/prisma';
import { errorHandler } from './middlewares/error.middleware';
import { authenticateToken, requireRole } from './middlewares/auth.middleware';
import { INITIAL_CATEGORIES, INITIAL_SUPPLIERS, INITIAL_PRODUCTS } from './data/seedCatalog';

dotenv.config();

import { logger, requestLogger } from './utils/logger';

// C-05: El servidor DEBE fallar al arrancar si falta JWT_SECRET (sin fallback inseguro)
if (!process.env.JWT_SECRET) {
  logger.error('❌ FATAL: La variable de entorno JWT_SECRET no está definida. Configure una clave segura de al menos 32 caracteres.');
  process.exit(1);
}

const app = express();
// Render + Cloudflare actúan como proxy en cadena (Cloudflare -> Render Ingress -> Container)
// Confiar únicamente en el número de saltos declarado para evitar evadir rate limits
// mediante un X-Forwarded-For controlado por el cliente.
const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? 2 : 0));
const trustProxyHops = Number.isInteger(configuredProxyHops) && configuredProxyHops >= 0 ? configuredProxyHops : 0;
app.set('trust proxy', trustProxyHops);
const PORT = process.env.PORT || 4000;

// En producción, CORS_ORIGIN es obligatorio y no debe ser comodín (*)
const allowedOrigin = process.env.CORS_ORIGIN;
if (process.env.NODE_ENV === 'production' && (!allowedOrigin || allowedOrigin.trim() === '*')) {
  logger.error('❌ FATAL: En entorno de producción (NODE_ENV=production), la variable CORS_ORIGIN debe estar definida con dominios específicos y no puede ser "*".');
  process.exit(1);
}

// Seguridad con Helmet y CORS restringido (C-05)
app.use(helmet());
const allowedOrigins = allowedOrigin
  ? allowedOrigin.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : (process.env.NODE_ENV === 'production' ? false : '*'),
    credentials: true,
    maxAge: 86400,
  })
);

// FASE 4: Middleware de logging estructurado JSON con X-Request-Id y latencias
app.use(requestLogger);
app.use(express.json());

// CP-01 & FASE 3: Health check con chequeo ligero de base de datos (SELECT 1 con timeout de 2s).
// El resultado saludable se reutiliza unos segundos para que el monitoreo concurrente
// no abra una consulta independiente a PostgreSQL por cada sonda.
const configuredHealthCacheTtlMs = process.env.HEALTH_CACHE_TTL_MS === undefined
  ? 15000
  : Number(process.env.HEALTH_CACHE_TTL_MS);
const healthCacheTtlMs = process.env.NODE_ENV === 'test'
  ? 0
  : Number.isFinite(configuredHealthCacheTtlMs) && configuredHealthCacheTtlMs >= 0
    ? configuredHealthCacheTtlMs
    : 15000;
let lastHealthyCheckAt = 0;
let healthCheckInFlight: Promise<number> | null = null;
const checkDatabaseHealth = async (): Promise<number> => {
  if (!healthCheckInFlight) {
    const startedAt = process.hrtime.bigint();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('DB_TIMEOUT')), 2000);
    });
    healthCheckInFlight = Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise,
    ])
      .then(() => {
        lastHealthyCheckAt = Date.now();
        return Number(process.hrtime.bigint() - startedAt) / 1e6;
      })
      .finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        healthCheckInFlight = null;
      });
  }
  return healthCheckInFlight;
};
const healthHandler = async (req: Request, res: Response) => {
  const now = Date.now();
  const shouldCheckDatabase = healthCacheTtlMs === 0 || now - lastHealthyCheckAt >= healthCacheTtlMs;
  const handlerStartedAt = process.hrtime.bigint();
  let databaseDurationMs = 0;
  res.set('Cache-Control', 'no-store');

  if (shouldCheckDatabase) {
    const databaseCheckStartedAt = process.hrtime.bigint();
    try {
      databaseDurationMs = await checkDatabaseHealth();
    } catch (err: any) {
      databaseDurationMs = Number(process.hrtime.bigint() - databaseCheckStartedAt) / 1e6;
      logger.warn('Health check: Base de datos no disponible o demoró más de 2 segundos', { error: err.message });
      const handlerDurationMs = Number(process.hrtime.bigint() - handlerStartedAt) / 1e6;
      res.set('Server-Timing', `db;dur=${databaseDurationMs.toFixed(2)};desc="failed", app;dur=${handlerDurationMs.toFixed(2)}`);
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        message: 'El servicio de base de datos no se encuentra disponible temporalmente.',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  const handlerDurationMs = Number(process.hrtime.bigint() - handlerStartedAt) / 1e6;
  const databaseDescription = shouldCheckDatabase ? 'checked' : 'cached';
  res.set('Server-Timing', `db;dur=${databaseDurationMs.toFixed(2)};desc="${databaseDescription}", app;dur=${handlerDurationMs.toFixed(2)}`);
  res.status(200).json({
    success: true,
    message: 'Servidor JINStock Backend operativo',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.floor(process.uptime()),
  });
};
// Liveness no depende de PostgreSQL: permite distinguir proceso activo de servicio listo.
app.get('/api/live', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ success: true, status: 'alive' });
});
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);
app.get('/status', healthHandler);

// API root endpoint informativo
app.get('/api', (req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.json({
    success: true,
    message: 'API REST de JINStock Nicaragua - Sistema de Gestión PWA Offline-First',
    version: '2.5.0',
    endpoints: [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/me',
      '/api/categories',
      '/api/products',
      '/api/sales',
      '/api/suppliers',
      '/api/purchases',
      '/api/users',
      '/api/reports',
      '/api/health',
      '/api/logs',
    ],
  });
});

// Fase 6 (Monitoreo y logs): Endpoint de auditoría técnica para coevaluación (asíncrono)
app.get('/api/logs', authenticateToken, requireRole(['ADMINISTRADOR']), async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const type = req.query.type === 'error' ? 'error' : 'all';
  const logs = await logger.getRecentLogs(limit, type);

  res.json({
    success: true,
    count: logs.length,
    filter: type,
    data: logs,
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

// Rutas inexistentes -> 404 JSON consistente
app.use((req: Request, res: Response) => {
  const requestId = (req as any).id || (req.headers['x-request-id'] as string);
  res.status(404).json({
    success: false,
    code: 'RUTA_NO_ENCONTRADA',
    message: `La ruta ${req.method} ${req.originalUrl} no existe.`,
    ...(requestId ? { requestId } : {}),
  });
});

// Manejador centralizado de errores (T-04)
app.use(errorHandler);

// T-12: Keep-alive modular y configurable para Neon PostgreSQL
let keepAliveTimer: NodeJS.Timeout | null = null;
const startNeonKeepAlive = () => {
  if (process.env.ENABLE_KEEP_ALIVE !== 'true') {
    return;
  }
  const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || 3 * 60 * 1000;
  keepAliveTimer = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      lastHealthyCheckAt = Date.now();
    } catch (err: any) {
      console.warn('⚠️ [Keep-Alive] Neon ping omitido o base desconectada:', err.message);
    }
  }, intervalMs);
};

// Asegurar que usuarios iniciales (Admin y Cajero) y catálogo básico existan
const ensureInitialData = async () => {
  try {
    // C-05: El admin inicial solo se crea si el entorno define email y contraseña.
    // Nunca se usan valores por defecto ni se sobrescribe la contraseña de un usuario existente.
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const adminName = process.env.INITIAL_ADMIN_NAME || 'Administrador JINStock';

    if (adminEmail && adminPassword) {
      const existingAdmin = await prisma.usuario.findUnique({
        where: { email: adminEmail },
      });

      if (!existingAdmin) {
        await prisma.usuario.create({
          data: {
            nombre: adminName,
            email: adminEmail,
            passwordHash: await bcrypt.hash(adminPassword, 10),
            rol: 'ADMINISTRADOR',
            estado: true,
            verificado: true,
          },
        });
        logger.info('Administrador inicial creado', { email: adminEmail });
      }
    }

    // 3. Sembrar catálogo si la base de datos no tiene categorías
    const catCount = await prisma.categoria.count();
    if (catCount === 0) {
      console.log('📦 Sembrando catálogo inicial de papelería...');
      for (const cat of INITIAL_CATEGORIES) {
        await prisma.categoria.upsert({
          where: { id: cat.id },
          update: { nombre: cat.nombre, descripcion: cat.descripcion },
          create: { ...cat, estado: true },
        });
      }
      for (const sup of INITIAL_SUPPLIERS) {
        await prisma.proveedor.upsert({
          where: { id: sup.id },
          update: { nombre: sup.nombre, ruc: sup.ruc, telefono: sup.telefono, email: sup.email, direccion: sup.direccion },
          create: { ...sup },
        });
      }
      for (const prod of INITIAL_PRODUCTS) {
        await prisma.producto.upsert({
          where: { id: prod.id },
          update: {
            nombre: prod.nombre,
            precioVenta: prod.precioVenta,
            costo: prod.costo,
            stock: prod.stock,
            stockMinimo: prod.stockMinimo,
          },
          create: { ...prod },
        });
      }
    }

    // 4. BUG-04: Inicializar y sincronizar la secuencia PostgreSQL de comprobantes fuera de la ruta de venta
    await ensureComprobanteSequence();
  } catch (err: any) {
    console.warn('⚠️ [Init] Auto-seed omitido o error:', err.message);
  }
};

export async function ensureComprobanteSequence(): Promise<void> {
  try {
    const currentYear = new Date().getFullYear();
    const seqName = `venta_comprobante_seq_${currentYear}`;
    
    // Crear la secuencia fuera del flujo de ventas si aún no existe
    await prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1 INCREMENT 1`
    );

    // Obtener el máximo número correlativo existente para no reiniciar en 1 si ya hay ventas
    const maxSales = await prisma.$queryRawUnsafe<Array<{ max_num: number | null }>>(
      `SELECT MAX(
        CAST(
          SUBSTRING("numeroComprobante" FROM 'FAC-[0-9]{4}-([0-9]+)') AS INTEGER
        )
      ) AS max_num 
      FROM "Venta" 
      WHERE "numeroComprobante" LIKE 'FAC-${currentYear}-%'`
    );

    const maxNum = maxSales?.[0]?.max_num ? Number(maxSales[0].max_num) : 0;
    if (maxNum > 0) {
      await prisma.$executeRawUnsafe(
        `SELECT setval('"${seqName}"', ${maxNum}, true)`
      );
    }
    logger.info(`Secuencia ${seqName} lista (iniciada en ${maxNum > 0 ? maxNum : 1})`);
  } catch (err: any) {
    logger.warn('Aviso: no se pudo sincronizar la secuencia PostgreSQL de comprobantes:', { error: err.message });
  }
}

// Arrancar servidor solo si no estamos en entorno de testing
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    logger.info(`🚀 JINStock Backend activo en http://localhost:${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' });
    startNeonKeepAlive();
    await ensureInitialData();
    // Mejora de arranque: precalentamiento explícito de 10 conexiones del pool Neon y caché de catálogo
    try {
      await prisma.$connect();
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.producto.findMany({
            where: { estado: true },
            select: { id: true, nombre: true, sku: true, codigoBarras: true, precioVenta: true, stock: true },
            take: 10,
            skip: (i % 2) * 5,
          })
        )
      );
      logger.info('⚡ Pool de 10 conexiones PostgreSQL Neon y catálogo precalentados al arrancar');
    } catch (warmErr: any) {
      logger.warn('Aviso: precalentamiento de DB omitido o diferido:', { error: warmErr.message });
    }
  });
}

export default app;

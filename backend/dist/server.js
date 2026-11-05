"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureComprobanteSequence = ensureComprobanteSequence;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const sale_routes_1 = __importDefault(require("./routes/sale.routes"));
const supplier_routes_1 = __importDefault(require("./routes/supplier.routes"));
const purchase_routes_1 = __importDefault(require("./routes/purchase.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const prisma_1 = require("./config/prisma");
const error_middleware_1 = require("./middlewares/error.middleware");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const seedCatalog_1 = require("./data/seedCatalog");
dotenv_1.default.config();
const logger_1 = require("./utils/logger");
// C-05: El servidor DEBE fallar al arrancar si falta JWT_SECRET (sin fallback inseguro)
if (!process.env.JWT_SECRET) {
    logger_1.logger.error('❌ FATAL: La variable de entorno JWT_SECRET no está definida. Configure una clave segura de al menos 32 caracteres.');
    process.exit(1);
}
const app = (0, express_1.default)();
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
    logger_1.logger.error('❌ FATAL: En entorno de producción (NODE_ENV=production), la variable CORS_ORIGIN debe estar definida con dominios específicos y no puede ser "*".');
    process.exit(1);
}
// Seguridad con Helmet y CORS restringido (C-05)
app.use((0, helmet_1.default)());
const allowedOrigins = allowedOrigin
    ? allowedOrigin.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
app.use((0, cors_1.default)({
    origin: allowedOrigins.length > 0 ? allowedOrigins : (process.env.NODE_ENV === 'production' ? false : '*'),
    credentials: true,
    maxAge: 86400,
}));
// FASE 4: Middleware de logging estructurado JSON con X-Request-Id y latencias
app.use(logger_1.requestLogger);
app.use(express_1.default.json());
// CP-01 & FASE 3: Health check con chequeo ligero de base de datos (SELECT 1 con timeout de 2s).
// El resultado saludable se reutiliza unos segundos para que el monitoreo concurrente
// no abra una consulta independiente a PostgreSQL por cada sonda.
const healthCacheTtlMs = process.env.NODE_ENV === 'test'
    ? 0
    : Math.max(0, Number(process.env.HEALTH_CACHE_TTL_MS) || 5000);
let lastHealthyCheckAt = 0;
let healthCheckInFlight = null;
const checkDatabaseHealth = async () => {
    if (!healthCheckInFlight) {
        healthCheckInFlight = Promise.race([
            prisma_1.prisma.$queryRaw `SELECT 1`,
            new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 2000)),
        ])
            .then(() => {
            lastHealthyCheckAt = Date.now();
        })
            .finally(() => {
            healthCheckInFlight = null;
        });
    }
    await healthCheckInFlight;
};
const healthHandler = async (req, res) => {
    const now = Date.now();
    if (healthCacheTtlMs === 0 || now - lastHealthyCheckAt >= healthCacheTtlMs) {
        try {
            await checkDatabaseHealth();
        }
        catch (err) {
            logger_1.logger.warn('Health check: Base de datos no disponible o demoró más de 2 segundos', { error: err.message });
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                message: 'El servicio de base de datos no se encuentra disponible temporalmente.',
                timestamp: new Date().toISOString(),
            });
            return;
        }
    }
    res.set('Cache-Control', 'no-store');
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
app.get('/api/live', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ success: true, status: 'alive' });
});
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);
app.get('/status', healthHandler);
// API root endpoint informativo
app.get('/api', (req, res) => {
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
app.get('/api/logs', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['ADMINISTRADOR']), async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const type = req.query.type === 'error' ? 'error' : 'all';
    const logs = await logger_1.logger.getRecentLogs(limit, type);
    res.json({
        success: true,
        count: logs.length,
        filter: type,
        data: logs,
    });
});
// Rutas de la API
app.use('/api/auth', auth_routes_1.default);
app.use('/api/categories', category_routes_1.default);
app.use('/api/products', product_routes_1.default);
app.use('/api/sales', sale_routes_1.default);
app.use('/api/suppliers', supplier_routes_1.default);
app.use('/api/purchases', purchase_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/reports', report_routes_1.default);
// Rutas inexistentes -> 404 JSON consistente
app.use((req, res) => {
    const requestId = req.id || req.headers['x-request-id'];
    res.status(404).json({
        success: false,
        code: 'RUTA_NO_ENCONTRADA',
        message: `La ruta ${req.method} ${req.originalUrl} no existe.`,
        ...(requestId ? { requestId } : {}),
    });
});
// Manejador centralizado de errores (T-04)
app.use(error_middleware_1.errorHandler);
// T-12: Keep-alive modular y configurable para Neon PostgreSQL
let keepAliveTimer = null;
const startNeonKeepAlive = () => {
    if (process.env.ENABLE_KEEP_ALIVE !== 'true') {
        return;
    }
    const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || 3 * 60 * 1000;
    keepAliveTimer = setInterval(async () => {
        try {
            await prisma_1.prisma.$queryRaw `SELECT 1`;
        }
        catch (err) {
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
            const existingAdmin = await prisma_1.prisma.usuario.findUnique({
                where: { email: adminEmail },
            });
            if (!existingAdmin) {
                await prisma_1.prisma.usuario.create({
                    data: {
                        nombre: adminName,
                        email: adminEmail,
                        passwordHash: await bcryptjs_1.default.hash(adminPassword, 10),
                        rol: 'ADMINISTRADOR',
                        estado: true,
                        verificado: true,
                    },
                });
                logger_1.logger.info('Administrador inicial creado', { email: adminEmail });
            }
        }
        // 3. Sembrar catálogo si la base de datos no tiene categorías
        const catCount = await prisma_1.prisma.categoria.count();
        if (catCount === 0) {
            console.log('📦 Sembrando catálogo inicial de papelería...');
            for (const cat of seedCatalog_1.INITIAL_CATEGORIES) {
                await prisma_1.prisma.categoria.upsert({
                    where: { id: cat.id },
                    update: { nombre: cat.nombre, descripcion: cat.descripcion },
                    create: { ...cat, estado: true },
                });
            }
            for (const sup of seedCatalog_1.INITIAL_SUPPLIERS) {
                await prisma_1.prisma.proveedor.upsert({
                    where: { id: sup.id },
                    update: { nombre: sup.nombre, ruc: sup.ruc, telefono: sup.telefono, email: sup.email, direccion: sup.direccion },
                    create: { ...sup },
                });
            }
            for (const prod of seedCatalog_1.INITIAL_PRODUCTS) {
                await prisma_1.prisma.producto.upsert({
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
    }
    catch (err) {
        console.warn('⚠️ [Init] Auto-seed omitido o error:', err.message);
    }
};
async function ensureComprobanteSequence() {
    try {
        const currentYear = new Date().getFullYear();
        const seqName = `venta_comprobante_seq_${currentYear}`;
        // Crear la secuencia fuera del flujo de ventas si aún no existe
        await prisma_1.prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1 INCREMENT 1`);
        // Obtener el máximo número correlativo existente para no reiniciar en 1 si ya hay ventas
        const maxSales = await prisma_1.prisma.$queryRawUnsafe(`SELECT MAX(
        CAST(
          SUBSTRING("numeroComprobante" FROM 'FAC-[0-9]{4}-([0-9]+)') AS INTEGER
        )
      ) AS max_num 
      FROM "Venta" 
      WHERE "numeroComprobante" LIKE 'FAC-${currentYear}-%'`);
        const maxNum = maxSales?.[0]?.max_num ? Number(maxSales[0].max_num) : 0;
        if (maxNum > 0) {
            await prisma_1.prisma.$executeRawUnsafe(`SELECT setval('"${seqName}"', ${maxNum}, true)`);
        }
        logger_1.logger.info(`Secuencia ${seqName} lista (iniciada en ${maxNum > 0 ? maxNum : 1})`);
    }
    catch (err) {
        logger_1.logger.warn('Aviso: no se pudo sincronizar la secuencia PostgreSQL de comprobantes:', { error: err.message });
    }
}
// Arrancar servidor solo si no estamos en entorno de testing
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, async () => {
        logger_1.logger.info(`🚀 JINStock Backend activo en http://localhost:${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' });
        startNeonKeepAlive();
        await ensureInitialData();
        // Mejora de arranque: precalentamiento explícito de 10 conexiones del pool Neon y caché de catálogo
        try {
            await prisma_1.prisma.$connect();
            await Promise.all(Array.from({ length: 10 }, (_, i) => prisma_1.prisma.producto.findMany({
                where: { estado: true },
                select: { id: true, nombre: true, sku: true, codigoBarras: true, precioVenta: true, stock: true },
                take: 10,
                skip: (i % 2) * 5,
            })));
            logger_1.logger.info('⚡ Pool de 10 conexiones PostgreSQL Neon y catálogo precalentados al arrancar');
        }
        catch (warmErr) {
            logger_1.logger.warn('Aviso: precalentamiento de DB omitido o diferido:', { error: warmErr.message });
        }
    });
}
exports.default = app;

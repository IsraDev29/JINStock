"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = exports.logger = exports.sanitizeLogData = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const LOGS_DIR = path_1.default.resolve(__dirname, '../../logs');
const COMBINED_LOG = path_1.default.join(LOGS_DIR, 'combined.log');
const ERROR_LOG = path_1.default.join(LOGS_DIR, 'error.log');
// Asegurar que el directorio de logs exista
try {
    if (!fs_1.default.existsSync(LOGS_DIR)) {
        fs_1.default.mkdirSync(LOGS_DIR, { recursive: true });
    }
}
catch (err) {
    // En entornos de solo lectura (como serverless extremo), continuar con stdout
}
const writeToFile = (filePath, line) => {
    try {
        fs_1.default.appendFileSync(filePath, line + '\n', 'utf8');
    }
    catch {
        // Si el filesystem es de solo lectura, se ignora silenciosamente
    }
};
/**
 * FASE 4: Sanitiza objetos para que nunca se registren contraseñas, tokens ni credenciales
 */
const sanitizeLogData = (data) => {
    if (!data || typeof data !== 'object')
        return data;
    if (Array.isArray(data))
        return data.map(exports.sanitizeLogData);
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        const lower = key.toLowerCase();
        if (lower.includes('password') ||
            lower.includes('token') ||
            lower.includes('secret') ||
            lower.includes('authorization') ||
            lower.includes('cookie')) {
            sanitized[key] = '[REDACTED]';
        }
        else if (typeof value === 'object' && value !== null) {
            sanitized[key] = (0, exports.sanitizeLogData)(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};
exports.sanitizeLogData = sanitizeLogData;
class Logger {
    format(level, message, context, error) {
        const sanitizedContext = context ? (0, exports.sanitizeLogData)(context) : undefined;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
        };
        if (sanitizedContext && sanitizedContext.requestId) {
            entry.requestId = sanitizedContext.requestId;
        }
        if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
            entry.context = sanitizedContext;
        }
        if (error) {
            entry.error = {
                code: error.code || error.name,
                message: error.message || String(error),
                ...(process.env.NODE_ENV !== 'production' && error.stack ? { stack: error.stack } : {}),
            };
        }
        return entry;
    }
    output(entry) {
        const jsonString = JSON.stringify(entry);
        if (entry.level === 'ERROR' || entry.level === 'WARN') {
            if (entry.level === 'ERROR') {
                console.error(jsonString);
            }
            else {
                console.warn(jsonString);
            }
            writeToFile(ERROR_LOG, jsonString);
        }
        else {
            console.log(jsonString);
        }
        writeToFile(COMBINED_LOG, jsonString);
    }
    info(message, context) {
        this.output(this.format('INFO', message, context));
    }
    warn(message, context) {
        this.output(this.format('WARN', message, context));
    }
    error(message, error, context) {
        this.output(this.format('ERROR', message, context, error));
    }
    debug(message, context) {
        if (process.env.NODE_ENV !== 'production') {
            this.output(this.format('DEBUG', message, context));
        }
    }
    /**
     * FASE 3: Obtiene los últimos logs de forma asíncrona leyendo solo el final del archivo
     */
    async getRecentLogs(limit = 50, type = 'all') {
        const targetFile = type === 'error' ? ERROR_LOG : COMBINED_LOG;
        try {
            await fs_1.default.promises.access(targetFile);
        }
        catch {
            return [];
        }
        try {
            const stat = await fs_1.default.promises.stat(targetFile);
            if (stat.size === 0)
                return [];
            // Leer máximo los últimos 64 KB para evitar cargar archivos gigantes
            const chunkSize = Math.min(stat.size, 64 * 1024);
            const position = stat.size - chunkSize;
            const buffer = Buffer.alloc(chunkSize);
            const fileHandle = await fs_1.default.promises.open(targetFile, 'r');
            try {
                await fileHandle.read(buffer, 0, chunkSize, position);
            }
            finally {
                await fileHandle.close();
            }
            const content = buffer.toString('utf8');
            const lines = content.trim().split('\n').filter(Boolean);
            return lines
                .slice(-limit)
                .map((line) => {
                try {
                    return JSON.parse(line);
                }
                catch {
                    return null;
                }
            })
                .filter(Boolean);
        }
        catch {
            return [];
        }
    }
}
exports.logger = new Logger();
/**
 * FASE 4: Middleware para registrar todas las peticiones con X-Request-Id y latencia
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || crypto_1.default.randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    const { method, originalUrl, ip } = req;
    res.on('finish', () => {
        const durationMs = Date.now() - start;
        const statusCode = res.statusCode;
        const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
        const clientIp = req.headers['cf-connecting-ip'] ||
            (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
            ip ||
            req.socket.remoteAddress ||
            'unknown';
        const logEntry = {
            requestId,
            method,
            url: originalUrl,
            status: statusCode,
            durationMs,
            ip: clientIp,
            userAgent: req.get('user-agent') || 'unknown',
        };
        if (level === 'ERROR') {
            exports.logger.error(`HTTP ${method} ${originalUrl} ${statusCode} (${durationMs}ms)`, undefined, logEntry);
        }
        else if (level === 'WARN') {
            exports.logger.warn(`HTTP ${method} ${originalUrl} ${statusCode} (${durationMs}ms)`, logEntry);
        }
        else {
            exports.logger.info(`HTTP ${method} ${originalUrl} ${statusCode} (${durationMs}ms)`, logEntry);
        }
    });
    next();
};
exports.requestLogger = requestLogger;

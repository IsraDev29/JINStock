import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: Record<string, any>;
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
}

const LOGS_DIR = path.resolve(__dirname, '../../logs');
const COMBINED_LOG = path.join(LOGS_DIR, 'combined.log');
const ERROR_LOG = path.join(LOGS_DIR, 'error.log');

// Asegurar que el directorio de logs exista
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (err) {
  // En entornos de solo lectura (como serverless extremo), continuar con stdout
}

const writeToFile = (filePath: string, line: string) => {
  try {
    fs.appendFileSync(filePath, line + '\n', 'utf8');
  } catch {
    // Si el filesystem es de solo lectura, se ignora silenciosamente
  }
};

/**
 * FASE 4: Sanitiza objetos para que nunca se registren contraseñas, tokens ni credenciales
 */
export const sanitizeLogData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeLogData);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('authorization') ||
      lower.includes('cookie')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

class Logger {
  private format(level: LogLevel, message: string, context?: Record<string, any>, error?: any): LogEntry {
    const sanitizedContext = context ? sanitizeLogData(context) : undefined;
    const entry: LogEntry = {
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

  private output(entry: LogEntry) {
    const jsonString = JSON.stringify(entry);

    if (entry.level === 'ERROR' || entry.level === 'WARN') {
      if (entry.level === 'ERROR') {
        console.error(jsonString);
      } else {
        console.warn(jsonString);
      }
      writeToFile(ERROR_LOG, jsonString);
    } else {
      console.log(jsonString);
    }

    writeToFile(COMBINED_LOG, jsonString);
  }

  info(message: string, context?: Record<string, any>) {
    this.output(this.format('INFO', message, context));
  }

  warn(message: string, context?: Record<string, any>) {
    this.output(this.format('WARN', message, context));
  }

  error(message: string, error?: any, context?: Record<string, any>) {
    this.output(this.format('ERROR', message, context, error));
  }

  debug(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      this.output(this.format('DEBUG', message, context));
    }
  }

  /**
   * FASE 3: Obtiene los últimos logs de forma asíncrona leyendo solo el final del archivo
   */
  async getRecentLogs(limit: number = 50, type: 'all' | 'error' = 'all'): Promise<LogEntry[]> {
    const targetFile = type === 'error' ? ERROR_LOG : COMBINED_LOG;
    try {
      await fs.promises.access(targetFile);
    } catch {
      return [];
    }

    try {
      const stat = await fs.promises.stat(targetFile);
      if (stat.size === 0) return [];

      // Leer máximo los últimos 64 KB para evitar cargar archivos gigantes
      const chunkSize = Math.min(stat.size, 64 * 1024);
      const position = stat.size - chunkSize;
      const buffer = Buffer.alloc(chunkSize);

      const fileHandle = await fs.promises.open(targetFile, 'r');
      try {
        await fileHandle.read(buffer, 0, chunkSize, position);
      } finally {
        await fileHandle.close();
      }

      const content = buffer.toString('utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines
        .slice(-limit)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as LogEntry[];
    } catch {
      return [];
    }
  }
}

export const logger = new Logger();

/**
 * FASE 4: Middleware para registrar todas las peticiones con X-Request-Id y latencia
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as any).id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;
    const level: LogLevel = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';

    const clientIp =
      (req.headers['cf-connecting-ip'] as string) ||
      ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) ||
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
      logger.error(`HTTP ${method} ${originalUrl} ${statusCode} (${durationMs}ms)`, undefined, logEntry);
    } else if (level === 'WARN') {
      logger.warn(`HTTP ${method} ${originalUrl} ${statusCode} (${durationMs}ms)`, logEntry);
    } else {
      logger.info(`HTTP ${method} ${originalUrl} ${statusCode} (${durationMs}ms)`, logEntry);
    }
  });

  next();
};

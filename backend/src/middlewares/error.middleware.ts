import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response headers have already been sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = (req as any).id || (req.headers['x-request-id'] as string);

  const clientIp =
    (req.headers['cf-connecting-ip'] as string) ||
    ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) ||
    req.ip ||
    'unknown';

  const context = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: clientIp,
  };

  // Known custom application error
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`AppError [${err.code}]: ${err.message}`, err, context);
    } else {
      logger.warn(`AppWarning [${err.code}]: ${err.message}`, context);
    }

    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(requestId ? { requestId } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // JSON malformado o cuerpo demasiado grande (errores de express.json)
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    logger.warn(`Cuerpo de solicitud inválido: ${err.type}`, context);
    res.status(err.type === 'entity.too.large' ? 413 : 400).json({
      success: false,
      code: err.type === 'entity.too.large' ? 'PAYLOAD_DEMASIADO_GRANDE' : 'JSON_INVALIDO',
      message: err.type === 'entity.too.large'
        ? 'El cuerpo de la solicitud excede el tamaño permitido.'
        : 'El cuerpo de la solicitud no es un JSON válido.',
      ...(requestId ? { requestId } : {}),
    });
    return;
  }

  // Prisma unique constraint violation (e.g. P2002)
  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'campo único';
    logger.warn(`Prisma P2002 Duplicado en: ${target}`, context);
    res.status(409).json({
      success: false,
      code: 'DUPLICATE_KEY',
      message: `Ya existe un registro con el mismo valor para: ${target}.`,
      ...(requestId ? { requestId } : {}),
    });
    return;
  }

  // Prisma foreign key violation (e.g. P2003)
  if (err.code === 'P2003') {
    logger.warn('Prisma P2003 Violación de clave foránea', context);
    res.status(409).json({
      success: false,
      code: 'CONFLICTO',
      message: 'No se puede completar la operación debido a dependencias con otros registros relacionados.',
      ...(requestId ? { requestId } : {}),
    });
    return;
  }

  // Prisma record not found (e.g. P2025)
  if (err.code === 'P2025') {
    logger.warn(`Prisma P2025 Registro no encontrado`, context);
    res.status(404).json({
      success: false,
      code: 'NO_ENCONTRADO',
      message: 'El registro solicitado no fue encontrado en la base de datos.',
      ...(requestId ? { requestId } : {}),
    });
    return;
  }

  // Default internal server error (never leak raw stack or sensitive database connection strings)
  logger.error('Error interno no controlado en servidor', err, context);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor. Intente nuevamente más tarde.',
    ...(requestId ? { requestId } : {}),
  });
};

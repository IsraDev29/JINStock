export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class StockInsuficienteError extends AppError {
  constructor(message = 'Existencias insuficientes para completar la venta.') {
    super(message, 400, 'STOCK_INSUFICIENTE');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Datos de solicitud inválidos.', details?: any) {
    super(message, 400, 'DATOS_INVALIDOS', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado.') {
    super(message, 401, 'NO_AUTORIZADO');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado. Permisos insuficientes.') {
    super(message, 403, 'ACCESO_DENEGADO');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado.') {
    super(message, 404, 'NO_ENCONTRADO');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto con recurso existente.') {
    super(message, 409, 'CONFLICTO');
  }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.StockInsuficienteError = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class StockInsuficienteError extends AppError {
    constructor(message = 'Existencias insuficientes para completar la venta.') {
        super(message, 400, 'STOCK_INSUFICIENTE');
    }
}
exports.StockInsuficienteError = StockInsuficienteError;
class ValidationError extends AppError {
    constructor(message = 'Datos de solicitud inválidos.', details) {
        super(message, 400, 'DATOS_INVALIDOS', details);
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends AppError {
    constructor(message = 'No autorizado.') {
        super(message, 401, 'NO_AUTORIZADO');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Acceso denegado. Permisos insuficientes.') {
        super(message, 403, 'ACCESO_DENEGADO');
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(message = 'Recurso no encontrado.') {
        super(message, 404, 'NO_ENCONTRADO');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message = 'Conflicto con recurso existente.') {
        super(message, 409, 'CONFLICTO');
    }
}
exports.ConflictError = ConflictError;

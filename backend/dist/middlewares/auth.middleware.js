"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            message: 'Acceso no autorizado. Token de autenticación no provisto.',
        });
        return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({
            success: false,
            code: 'SERVER_CONFIG_ERROR',
            message: 'Error de configuración de seguridad en el servidor.',
        });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Token de autenticación inválido o expirado.',
        });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                code: 'UNAUTHORIZED',
                message: 'No autenticado.',
            });
            return;
        }
        if (!allowedRoles.includes(req.user.rol)) {
            res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'Acceso denegado. Permisos insuficientes para realizar esta operación.',
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;

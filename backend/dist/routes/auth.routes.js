"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const schemas_1 = require("../validators/schemas");
const router = (0, express_1.Router)();
// BUG-05: Extraer IP real del cliente (Cloudflare cf-connecting-ip / x-forwarded-for)
const getClientIpKey = (req) => {
    return (req.headers['cf-connecting-ip'] ||
        (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
        req.ip ||
        '127.0.0.1');
};
// C-05: Rate limit en login para evitar ataques de fuerza bruta
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // 20 intentos por IP
    keyGenerator: getClientIpKey,
    message: {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiados intentos de inicio de sesión. Por favor intente más tarde (15 min).',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Rate limit en registro para prevenir creación masiva de cuentas
const registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // 10 registros por hora por IP
    keyGenerator: getClientIpKey,
    message: {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas solicitudes de registro desde esta dirección IP. Intente de nuevo en una hora.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
router.post('/login', loginLimiter, (0, validate_middleware_1.validate)(schemas_1.loginSchema), auth_controller_1.login);
router.post('/register', registerLimiter, (0, validate_middleware_1.validate)(schemas_1.registerSchema), auth_controller_1.register);
router.post('/verify', (0, validate_middleware_1.validate)(schemas_1.verifyEmailSchema), auth_controller_1.verifyEmail);
router.get('/me', auth_middleware_1.authenticateToken, auth_controller_1.getMe);
exports.default = router;

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, register, getMe, verifyEmail } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { loginSchema, registerSchema, verifyEmailSchema } from '../validators/schemas';

const router = Router();

// BUG-05: Extraer IP real del cliente (Cloudflare cf-connecting-ip / x-forwarded-for)
const getClientIpKey = (req: any): string => {
  return (
    (req.headers['cf-connecting-ip'] as string) ||
    ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) ||
    req.ip ||
    '127.0.0.1'
  );
};

// C-05: Rate limit en login para evitar ataques de fuerza bruta
const loginLimiter = rateLimit({
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
const registerLimiter = rateLimit({
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

router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/verify', validate(verifyEmailSchema), verifyEmail);
router.get('/me', authenticateToken, getMe);

export default router;

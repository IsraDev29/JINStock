import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';

export interface TokenPayload {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
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
    const decoded = jwt.verify(token, secret) as TokenPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Token de autenticación inválido o expirado.',
    });
  }
};

export const requireRole = (allowedRoles: Rol[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

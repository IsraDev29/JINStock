import { Rol } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        nombre: string;
        rol: Rol;
      };
    }
  }
}

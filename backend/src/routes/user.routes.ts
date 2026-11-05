import { Router } from 'express';
import { getUsers, createUser, toggleUserStatus, deleteUser, resetUserPassword, changeOwnPassword } from '../controllers/user.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createUserSchema } from '../validators/schemas';

const router = Router();

// Ruta para cambiar la propia contraseña (cualquier usuario autenticado)
router.patch('/me/password', authenticateToken, changeOwnPassword);

// Rutas exclusivas para ADMINISTRADOR
router.use(authenticateToken, requireRole(['ADMINISTRADOR']));

router.get('/', getUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id/status', toggleUserStatus);
router.patch('/:id/password', resetUserPassword);
router.delete('/:id', deleteUser);

export default router;

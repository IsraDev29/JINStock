import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
} from '../controllers/category.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createCategorySchema, updateCategorySchema } from '../validators/schemas';

const router = Router();

router.use(authenticateToken);

router.get('/', getCategories);
router.post('/', requireRole(['ADMINISTRADOR']), validate(createCategorySchema), createCategory);
router.put('/:id', requireRole(['ADMINISTRADOR']), validate(updateCategorySchema), updateCategory);
router.patch('/:id/status', requireRole(['ADMINISTRADOR']), toggleCategoryStatus);

export default router;

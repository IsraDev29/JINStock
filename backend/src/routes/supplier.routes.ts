import { Router } from 'express';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus,
} from '../controllers/supplier.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createSupplierSchema, updateSupplierSchema } from '../validators/schemas';

const router = Router();

router.use(authenticateToken);

router.get('/', getSuppliers);
router.post('/', requireRole(['ADMINISTRADOR']), validate(createSupplierSchema), createSupplier);
router.put('/:id', requireRole(['ADMINISTRADOR']), validate(updateSupplierSchema), updateSupplier);
router.patch('/:id/status', requireRole(['ADMINISTRADOR']), toggleSupplierStatus);

export default router;

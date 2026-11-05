import { Router } from 'express';
import { createPurchase, getPurchases, anularPurchase } from '../controllers/purchase.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import { validate, validateQuery } from '../middlewares/validate.middleware';
import { createPurchaseSchema, anularPurchaseSchema, dateRangeFilterSchema } from '../validators/schemas';

const router = Router();

router.use(authenticateToken, requireRole(['ADMINISTRADOR']));

router.post('/', validate(createPurchaseSchema), createPurchase);
router.get('/', validateQuery(dateRangeFilterSchema), getPurchases);
router.patch('/:id/anular', validate(anularPurchaseSchema), anularPurchase);

export default router;

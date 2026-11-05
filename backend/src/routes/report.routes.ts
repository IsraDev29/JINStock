import { Router } from 'express';
import {
  getSalesReport,
  getPurchasesReport,
  getTopProductsReport,
  getDailyCashClosing,
} from '../controllers/report.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validate.middleware';
import { dateRangeFilterSchema } from '../validators/schemas';

const router = Router();

router.use(authenticateToken);

// Cierre de caja diario disponible tanto para CAJERO (su caja) como ADMINISTRADOR (todas o por cajero)
router.get('/cash-closing', validateQuery(dateRangeFilterSchema), getDailyCashClosing);

// Reportes gerenciales (solo ADMINISTRADOR)
router.get('/sales', requireRole(['ADMINISTRADOR']), validateQuery(dateRangeFilterSchema), getSalesReport);
router.get('/purchases', requireRole(['ADMINISTRADOR']), validateQuery(dateRangeFilterSchema), getPurchasesReport);
router.get('/top-products', requireRole(['ADMINISTRADOR']), validateQuery(dateRangeFilterSchema), getTopProductsReport);

export default router;

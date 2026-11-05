"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = require("../controllers/report.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const schemas_1 = require("../validators/schemas");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
// Cierre de caja diario disponible tanto para CAJERO (su caja) como ADMINISTRADOR (todas o por cajero)
router.get('/cash-closing', (0, validate_middleware_1.validateQuery)(schemas_1.dateRangeFilterSchema), report_controller_1.getDailyCashClosing);
// Reportes gerenciales (solo ADMINISTRADOR)
router.get('/sales', (0, auth_middleware_1.requireRole)(['ADMINISTRADOR']), (0, validate_middleware_1.validateQuery)(schemas_1.dateRangeFilterSchema), report_controller_1.getSalesReport);
router.get('/purchases', (0, auth_middleware_1.requireRole)(['ADMINISTRADOR']), (0, validate_middleware_1.validateQuery)(schemas_1.dateRangeFilterSchema), report_controller_1.getPurchasesReport);
router.get('/top-products', (0, auth_middleware_1.requireRole)(['ADMINISTRADOR']), (0, validate_middleware_1.validateQuery)(schemas_1.dateRangeFilterSchema), report_controller_1.getTopProductsReport);
exports.default = router;

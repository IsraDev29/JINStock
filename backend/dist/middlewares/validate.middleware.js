"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParams = exports.validateQuery = exports.validate = void 0;
const zod_1 = require("zod");
const errors_1 = require("../utils/errors");
const validate = (schema) => {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                const errorMessages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
                next(new errors_1.ValidationError(errorMessages, err.errors));
            }
            else {
                next(err);
            }
        }
    };
};
exports.validate = validate;
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                const errorMessages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
                next(new errors_1.ValidationError(errorMessages, err.errors));
            }
            else {
                next(err);
            }
        }
    };
};
exports.validateQuery = validateQuery;
const validateParams = (schema) => {
    return (req, res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                const errorMessages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
                next(new errors_1.ValidationError(errorMessages, err.errors));
            }
            else {
                next(err);
            }
        }
    };
};
exports.validateParams = validateParams;

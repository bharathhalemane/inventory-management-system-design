const AppError = require('../utils/AppError');
const { validateBodyFields } = require('../middleware/validate');

const MAX_QUANTITY_PER_OPERATION = 1000000;

const checkStockBody = (req, res, next) => {
    const { quantity, reason } = req.body;

    if (
        typeof quantity !== 'number' || 
        !Number.isInteger(quantity) || 
        quantity < 1 ||
        quantity > MAX_QUANTITY_PER_OPERATION
    ) {
        return next(
            new AppError(400, 'VALIDATION_ERROR', `"quantity" must be a whole number between 1 and ${MAX_QUANTITY_PER_OPERATION}`)
        );
    }

    if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length > 200)) {
        return next(new AppError(400, 'VALIDATION_ERROR', '"reason" must be a string of at most 200 characters'));
    }

    next();
}

const validateStockChange = [validateBodyFields({ allowed: ['quantity', 'reason'] }), checkStockBody];

module.exports = { validateStockChange , checkStockBody};
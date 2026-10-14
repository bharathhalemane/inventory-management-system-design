const AppError = require('../utils/AppError');
const { validateBodyFields } = require('../middleware/validate');

const CREATE_FIELDS = ['sku', 'name', 'description', 'category', 'priceMinor', 'currency'];
const UPDATE_FIELDS = ['name', 'description', 'category', 'priceMinor', 'currency','status'];
const STRING_FIELDS = ['sku', 'name', 'description', 'category', 'currency', 'status'];
const LIST_STATUSES = ['active', 'inactive', 'all'];


const checkProductTypes = (req, res, next) => {
    const body = req.body;

    for (const field of STRING_FIELDS) {
        if (field in body && typeof body[field] !== 'string') {
            return next(new AppError(400, 'VALIDATION_ERROR', `"${field}" must be a string`));
        }
    }

    if ('priceMinor' in body && typeof body.priceMinor !== 'number') {
        return next(new AppError(400, 'VALIDATION_ERROR', '"priceMinor" must be a number'));
    }
    next();
}

const validateCreateProduct = [validateBodyFields({ allowed: CREATE_FIELDS }), checkProductTypes];

const validateUpdateProduct = [
    validateBodyFields({
        allowed: UPDATE_FIELDS,
        immutable: ['sku'],
        requireAtLeastOne: true
    }),
    checkProductTypes,
];

const readInt = (raw, { name, defaultValue, min, max }) => {
    if (raw === undefined) return defaultValue;

    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        throw new AppError(400, 'INVALID_QUERY', `"${name}" must be a whole number`);
    }

    const n = Number(raw);
    if(n<min || n > max){
        throw new AppError(400, 'INVALID_QUERY', `"${name}" must be between ${min} and ${max}`);
    }

    return n;
}

const readString = (raw, name) => {
    if(raw === undefined) return undefined;

    if (typeof raw !== 'string') {
        throw new AppError(400, 'INVALID_QUERY', `"${name}" must be a single value`);
    }
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : trimmed;
}

const parseListQuery = (req, res, next) => {
    const page = readInt(req.query.page, { name: 'page', defaultValue: 1, min: 1, max: 10000 });
    const limit = readInt(req.query.limit, { name: 'limit', defaultValue: 20, min: 1, max: 100 });


    const status = readString(req.query.status, 'status') ?? 'active';

    if (!LIST_STATUSES.includes(status)) { 
        throw new AppError(400, 'INVALID_QUERY', `"status" must be one of: ${LIST_STATUSES.join(", ")}`);
    }

    const category = readString(req.query.category, 'category');

    const q = readString(req.query.q, 'q');
    if(q && q.length > 100) {
        throw new AppError(400, 'INVALID_QUERY', '"q" cannot exceed 100 characters')
    }

    req.listQuery = { page, limit, status, category, q };
    next();
}

module.exports = { validateCreateProduct, validateUpdateProduct, parseListQuery };
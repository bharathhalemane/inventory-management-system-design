const AppError = require('../utils/AppError');

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const validateObjectId = (param = 'id') => {
    return (req, res, next) => {
        const value = req.params[param];
        if (!OBJECT_ID_RE.test(value)) {
            return next(new AppError(400, 'INVALID_ID', `"${value}" is not a valid ${param}`));
        }
        next();
    }
}

const validateBodyFields=({ allowed, immutable = [], requireAtLeastOne = false }) => {
    return (req, res, next) => {
        const body = req.body;

        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            return next(new AppError(400, 'INVALID_BODY', 'Request body must be a JSON object'));
        }

        const keys = Object.keys(body);

        const immutableSent = keys.filter((k) => immutable.includes(k));
        if (immutableSent.length > 0) {
            return next(
                new AppError(400, 'IMMUTABLE_FIELD', `Field(s) cannot be changed: ${immutableSent.join(', ')}`)
            );
        }

        const unknown = keys.filter((k) => !allowed.includes(k));
        if (unknown.length > 0) {
            return next(
                new AppError(400, 'UNKNOWN_FIELDS', `Unknown or not allowed field(s): ${unknown.join(', ')}`)
            );
        }

        if (requireAtLeastOne && keys.length === 0) {
            return next(new AppError(400, 'INVALID_BODY', 'Provide at least one field to update'));
        }

        next();
    };
}


const readInt = (raw, { name, defaultValue, min, max }) => {
    if (raw === undefined) return defaultValue;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        throw new AppError(400, 'INVALID_QUERY', `"${name}" must be a whole number`);
    }

    const n = Number(raw);
    if (n < min || n > max) {
        throw new AppError(400, 'INVALID_QUERY', `"${name}" must be between ${min} and ${max}`);
    }
    return n;
}

const parsePagination = (req, res, next) => {
    const page = readInt(req.query.page, {
        name: 'page', defaultValue: 1, min: 1, max: 10000
    });
    const limit = readInt(req.query.limit, { name: 'limit', defaultValue: 20, min: 1, max: 100 });
    req.pagination = {page, limit};
    next();
        
}

module.exports = { validateObjectId, validateBodyFields, readInt, parsePagination };
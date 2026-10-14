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

module.exports = { validateObjectId, validateBodyFields };
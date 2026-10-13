const config = require('../config/env');

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || err.status || 500;
    const isServerError = statusCode >= 500;

    if (isServerError) {
        console.error('[error]', err);
    }

    const body = {
        error: {
            code: err.isOperational ? err.code : isServerError ? 'INTERNAL_ERROR' : 'BAD_ERROR',
            message: isServerError && config.env === 'PRODUCTION' ? 'Internal server error' : err.message,
        },
    };

    res.status(statusCode).json(body);
}

module.exports = errorHandler;


const config = require('../config/env');

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    let statusCode = err.statusCode || err.status || 500;
    let code = err.isOperational ? err.code : null;
    let message = err.message;
    let details = err.isOperational ? err.details : undefined;    
    
    if(err.name === 'ValidationError' && err.errors){
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = Object.values(err.errors).map((e) => ({
            field: e.path, message: e.message
        }));
    }else if(err.name === 'CastError'){
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = [{
            field: err.path,
            message: `Invalid value for ${err.path}`
        }];
    }   
    
    const isServerError = statusCode >= 500;

    if (isServerError) {
        console.error('[error]', err);
    }
    if(!code){
        code = isServerError ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
    }
    if(isServerError && config.env === 'production'){
        message = 'Internal server error';
    }

    const body = {
        error: {
            code,message
        },
    };

    if (details) {
        body.error.details = details;        
    }

    if(isServerError && config.env !== 'production'){
        body.error.stack = err.stack;
    }

    res.status(statusCode).json(body);
}

module.exports = errorHandler;


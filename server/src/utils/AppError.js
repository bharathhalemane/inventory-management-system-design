class AppError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = 'App Error';
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);            
    }
}

module.exports = AppError;
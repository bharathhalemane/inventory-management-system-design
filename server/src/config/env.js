// In tests, the environment comes only from .env.test (loaded by the test setup), never from .env.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}
const required = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);        
    }
    return value;
}

const config = Object.freeze({
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 5000,
    mongoUri: required('MONGO_URI'),
});

module.exports = config;
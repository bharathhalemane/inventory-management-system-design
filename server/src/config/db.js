const mongoose = require('mongoose')
const config = require('./env')

const connectDB = async () => {
    mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
    mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));

    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[db] connected to database "${mongoose.connection.name}"`);
}

const disconnectDB =async () => {
    await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB };
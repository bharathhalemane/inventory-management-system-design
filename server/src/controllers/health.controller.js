const mongoose = require('mongoose');

const getHealth = async (req, res) => {
    const body = {
        status: 'OK',
        database: 'connected',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    };

    try {
        await mongoose.connection.db.admin().ping();
        res.status(200).json(body);
    } catch (err) {
        res.status(503).json({
            ...body,
            status: 'degraded', 
            database: 'unreachable',
        })
    }
}

module.exports = { getHealth };
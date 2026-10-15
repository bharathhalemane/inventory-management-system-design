const config = require('./config/env');
const app = require('./app.js');
const { connectDB, disconnectDB } = require('./config/db.js');
const Product = require('./models/Product');
const InventoryRecord = require('./models/InventoryRecord');
const StockMovement = require('./models/StockMovement');

const start = async () => {
    await connectDB();
    await Promise.all([Product.init(), InventoryRecord.init(), StockMovement.init()]);

    const server = app.listen(config.port, () => {
        console.log(`[server] listening on http://localhost:${config.port} (${config.env})`);
    });

    let shuttingDown = false;

    const shutdown = (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[server] ${signal} received, shutting down gracefully`);
        
        server.close(async () => {
            await disconnectDB();
            
            console.log('[server] shutdown complete');
            process.exit(0);
        })
        
        setTimeout(() => {
            console.error('[server] forced exit after timeout');
            process.exit(1);
        }, 10000).unref();
    };
        
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
    console.error('[server] failed to start:' , err.message);
    process.exit(1);
})
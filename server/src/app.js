const express = require('express')
const healthRoutes = require('./routes/health.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.use('/health', healthRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
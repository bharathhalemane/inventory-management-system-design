const express = require('express');
const productRoutes = require('./product.routes');
const stockRoutes = require('./stock.routes');

const router = express.Router();

router.use('/products', productRoutes);
router.use('/products', stockRoutes);

module.exports = router;
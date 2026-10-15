const express = require('express');
const controller = require('../controllers/stock.controller');
const { validateObjectId, parsePagination } = require('../middleware/validate');
const { validateStockChange } = require('../validators/stock.validators');

const router = express.Router();

router.get('/:id/stock', validateObjectId(), controller.getStock);
router.post('/:id/stock/add', validateObjectId(), validateStockChange, controller.addStock);
router.post('/:id/stock/remove', validateObjectId(),validateStockChange, controller.removeStock);
router.get('/:id/movements', validateObjectId(), parsePagination, controller.listMovements);

module.exports = router;
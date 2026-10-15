const stockService = require('../services/stock.service');

const getStock = async (req, res) => {
    res.json({
        data: await stockService.getStock(req.params.id)
    });
}

const addStock = async (req, res) => {
    const { quantity, reason } = req.body;
    res.json({
        data: await stockService.addStock(req.params.id, { quantity, reason })
    });
}

const removeStock = async (req, res) => {
    const { quantity, reason } = req.body;
    res.json({
        data: await stockService.removeStock(req.params.id, {
            quantity, reason
        })
    });
}

const listMovements = async (req, res) => {
    res.json(await stockService.listMovements(req.params.id, req.pagination));
}

module.exports = {
    getStock,
    addStock,
    removeStock,
    listMovements
}
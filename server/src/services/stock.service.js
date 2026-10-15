const mongoose = require('mongoose');
const InventoryRecord = require('../models/InventoryRecord');
const StockMovement = require("../models/StockMovement");
const AppError = require('../utils/AppError');

const ACTOR = 'system';


const productNotFound = (productId) => {
    return new AppError(404, 'PRODUCT_NOT_FOUND', `Product ${productId} not found`);
}

const toStockView = (record) => {
    return {
        productId: record.productId,
        quantity: record.quantity,
        updatedAt: record.updatedAt
    };
}

const getStock = async (productId) => {
    const record = await InventoryRecord.findOne({ productId }).lean();
    if(!record) throw productNotFound(productId);
    return toStockView(record);
}

const applyMovement = async ({ productId, type, quantity, reason }) => {
    const delta = type === 'IN' ? quantity : -quantity;

    const filter = type === 'OUT' ? {
        productId, quantity: { $gte: quantity }
    } : {productId}

    return mongoose.connection.transaction(async (session) => {
        const updated = await InventoryRecord.findOneAndUpdate(
            filter,
            { $inc: { quantity: delta } },
            { new: true, session }
        );

        if (!updated) {
            const current = await InventoryRecord.findOne({ productId }).session(session).lean();

            if (!current) throw productNotFound(productId);
            throw new AppError(
                409,
                'INSUFFICIENT_STOCK',
                `Cannot remove ${quantity}; only ${current.quantity} available`,
                { available: current.quantity, requested: quantity }
            );
        }

        const quantityAfter = updated.quantity;
        const quantityBefore = quantityAfter - delta;

        const [movement] = await StockMovement.create(
            [{ productId, type, quantity, quantityBefore, quantityAfter, reason, performedBy: ACTOR }], { session }
        );
        return { inventory: toStockView(updated), movement };
    });
}

const addStock= (productId, { quantity, reason }) => {
    return applyMovement({ productId, type: 'IN', quantity, reason });
}

const removeStock = (productId, { quantity, reason }) => {
    return applyMovement({ productId, type: 'OUT', quantity, reason });
}

const listMovements = async (productId, { page, limit }) => {
    const exists = await InventoryRecord.exists({ productId });
    if (!exists) throw productNotFound(productId);

    const filter = { productId };
    const [items, total] = await Promise.all([
        StockMovement.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        StockMovement.countDocuments(filter),
    ]);

    return { data: items, pagination: { page, limit, total, totalPage: Math.ceil(total / limit) } };
}

module.exports = { getStock, addStock, removeStock, listMovements };
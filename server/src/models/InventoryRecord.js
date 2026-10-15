const mongoose = require('mongoose');

const inventoryRecordSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        unique: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Quantity cannot be negative'],
        validate: {
            validator: Number.isInteger,
            message: 'Quantity must be a whole number',
        },
    },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('InventoryRecord', inventoryRecordSchema);
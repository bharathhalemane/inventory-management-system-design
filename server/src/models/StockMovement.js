const mongoose = require('mongoose');

const MOVEMENT_TYPES = ['IN', 'OUT'];

const stockMovementSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    type: {
        type: String,
        enum: MOVEMENT_TYPES,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: 'Must be a whole number'
        },
    },
    quantityBefore: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: "Must be a whole number"
        },
    },
    quantityAfter: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: "Must be a whole number"
        },
    },
    reason: {
        type: String,
        trim: true,
        maxlength: [200, 'Reason cannot exceed 200 characters'],
        default: ''
    },
    performedBy: {
        type: String,
        default: 'system',
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
});


module.exports = mongoose.model('StockMovement', stockMovementSchema);
module.exports.MOVEMENT_TYPES = MOVEMENT_TYPES;
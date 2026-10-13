const mongoose = require('mongoose');

const PRODUCT_STATUSES = ['active', 'inactive'];

const productSchema = new mongoose.Schema({
    sku: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        match: [/^[A-Z0-9][A-Z0-9-]{1,63}$/, 'SKU must be 2-64 chars: A-Z, 0-9 and hyphens'],
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [1, 'Name cannot be empty'],
        maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
        default: '',
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true,
        lowercase: true,
        maxlength: [100, 'category cannot exceed 100 characters'],
    },
    priceMinor: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative'],
        validate: {
            validator: Number.isInteger,
            message: 'Price must be an integer in minor units (e.g. paise)',
        },
    },
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        match: [/^[A-Z]{3}$/, 'Currency must be a 3-letter code'],
    },
    status: {
        type: String,
        enum: { values: PRODUCT_STATUSES, message: 'Status must be one of: ' + PRODUCT_STATUSES.join(', ') },
        default: 'active',
    }
},
    {
        timestamps: true,
        versionKey: false,
    }
);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
module.exports.PRODUCT_STATUSES = PRODUCT_STATUSES;
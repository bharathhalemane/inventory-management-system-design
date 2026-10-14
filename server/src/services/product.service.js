const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const escapeRegex = require('../utils/escapeRegex');


const createProduct = async (data) => {
    try{
        return await Product.create(data);
    } catch (err) {
        if (err.code === 11000) {
            const sku = err.keyValue?.sku ?? data.sku;
            throw new AppError(409, 'DUPLICATE_SKU', `A product with sku "${sku}" already exists`);
        }
        throw err;
    }
}

const getProductById = async (id) => {
    const product = await Product.findById(id);
    if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product ${id} not found`);
    }
    return product;
}


const listProducts = async ({ page, limit, status, category, q }) => {
    const filter = {};

    if (status !== 'all') filter.status = status;
    if (category) filter.category = category.toLowerCase();
    if (q) {
        const safe = escapeRegex(q);
        filter.$or = [{ name: new RegExp(safe, 'i') },
        { sku: new RegExp('^' + safe, 'i') }
        ];
    }

    const [items, total] = await Promise.all([
        Product.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Product.countDocuments(filter)
    ]);

    return {
        data: items,
        pagination: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit)
        }
    };
}

const updateProduct = async (id, updates) => {
    const product = await getProductById(id);
    product.set(updates);
    await product.save();
    return product;
}

const deactivateProduct = async (id) => {
    const product = await getProductById(id);
    if (product.status !== 'inactive') {
        product.status = 'inactive';
        await product.save();
    }
    return product;
}

module.exports = { createProduct, getProductById, listProducts, updateProduct, deactivateProduct };
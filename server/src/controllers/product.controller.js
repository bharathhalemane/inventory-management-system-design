const productService = require('../services/product.service');

const create = async (req, res) => {
    const product = await productService.createProduct(req.body);
    res.status(201).location(`/api/v1/products/${product._id}`).json({
        data: product
    });
}


const getOne = async (req, res) => {
    const product = await productService.getProductById(req.params.id);
    res.json({ data: product });
}

const list = async (req, res) => {
    const result = await productService.listProducts(req.listQuery);
    res.json(result);
}

const update = async (req, res) => {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.json({ data: product });
}

const deactivate = async (req, res) => {
    const product = await productService.deactivateProduct(req.params.id);
    res.json({ data: product });
}

module.exports = { create, getOne, list, update, deactivate };
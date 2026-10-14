const express = require('express');
const controller = require('../controllers/product.controller');
const { validateObjectId } = require('../middleware/validate');
const {
    validateCreateProduct,
    validateUpdateProduct,
    parseListQuery,
} = require('../validators/product.validators');

const router = express.Router();

router.post('/', validateCreateProduct, controller.create);
router.get('/',parseListQuery, controller.list);
router.get('/:id', validateObjectId(), controller.getOne);
router.patch('/:id', validateObjectId(), validateUpdateProduct, controller.update);
router.delete('/:id', validateObjectId(), controller.deactivate);

module.exports = router;
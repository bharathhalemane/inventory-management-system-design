const { assertBenchDatabase } = require('./env');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../../src/config/db');
const Product = require("../../src/models/Product");
const InventoryRecord = require("../../src/models/InventoryRecord");
const StockMovement = require("../../src/models/StockMovement");
const { CATEGORIES, ADJECTIVES, NOUNS, mulberry32, idFor, skuFor } = require("./dataset");

const COUNT = Number(process.argv[2]) || 100000;
const BATCH_SIZE = 5000;
const BASE_TIME = Date.UTC(2026, 0, 1);
const ObjectId = mongoose.Types.ObjectId;

const pick = (rng, list) => {
    return list[Math.floor(rng() * list.length)];
}

const buildBatch = (from, to, rng) => {
    const products = [];
    const inventory = [];
    const movements = [];

    for (let i = from; i <= to; i++){
        const productId = new ObjectId(idFor(i));
        const createdAt = new Date(BASE_TIME + i * 60000);


        products.push({
            _id: productId,
            sku: skuFor(i),
            name: `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)} ${i}`,
            description: "",
            category: pick(rng, CATEGORIES),
            priceMinor: 100 + Math.floor(rng() * 500000),
            currency: 'INR',
            status: rng() < 0.05 ? 'inactive' : 'active',
            createdAt,
            updatedAt: createdAt,
        });

        const opening = Math.floor(rng() * 500);
        let quantity = 0;
        let clock = createdAt.getTime();
        const move = (type, amount) => {
            const before = quantity;
            quantity += type === 'IN' ? amount : -amount;
            clock += 1000;
            movements.push({
                productId,
                type,
                quantity: amount,
                quantityBefore: before,
                quantityAfter: quantity,
                reason: 'seed',
                performedBy: 'seed',
                createAt: new Date(clock),
            });
        };

        if(opening > 0) move('IN', opening);
        if (i % 100 === 0) {
            for (let k = 0; k < 49; k++){
                move(k % 2 === 0 ? 'IN' : 'OUT', k % 2 === 0 ? 10 : 5);
            }
        }

        inventory.push({
            productId, quantity, createdAt, updatedAt: new Date(clock)
        });        
    }
    return { products, inventory, movements };
}

const main = async () => {
    if (!Number.isInteger(COUNT) || COUNT < 1 || COUNT > 1000000) {
        throw new Error('Usage: node scripts/bench/seed.js [count between 1 and 1000000]');
    }

    await connectDB();
    try{
        assertBenchDatabase(mongoose.connection);
        await Promise.all([Product.init(), InventoryRecord.init(), StockMovement.init()]);

        console.log(`Clearing "${mongoose.connection.name}" and seeding ${COUNT} products...`);
        await Promise.all([Product.deleteMany({}), InventoryRecord.deleteMany({}), StockMovement.deleteMany({})]);

        const rng = mulberry32(12345);
        const started = Date.now();
        for (let from = 1; from <= COUNT; from += BATCH_SIZE){
            const to = Math.min(from + BATCH_SIZE - 1, COUNT);
            const { products, inventory, movements } = buildBatch(from, to, rng);
            await Product.collection.insertMany(products, { ordered: false });
            await InventoryRecord.collection.insertMany(inventory, { ordered: false });
            if (movements.length > 0) await StockMovement.collection.insertMany(movements, { ordered: false });
            if (to % 20000 === 0 || to === COUNT) console.log(` ${to} / ${COUNT}`);
        }
        console.log(`Inserted in ${((Date.now() - started) / 1000).toFixed(1)} s`);

        const [products, inactive, records, movements] = await Promise.all([
            Product.countDocuments(),
            Product.countDocuments({ status: 'inactive' }),
            InventoryRecord.countDocuments(),
            StockMovement.countDocuments(),
        ]);

        const [stockTotal] = await InventoryRecord.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]);
        const [ledgerNet] = await StockMovement.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: { $cond: [{ $eq: ['$type', 'IN'] }, '$quantity', { $multiply: ['$quantity', -1] }] } },
                },
            },
        ]);
        const stats = await mongoose.connection.db.command({ dbStats: 1, scale: 1024 * 1024 });

        console.log('\nDataset summary');
        console.log(`  products:           ${products} (${inactive} inactive)`);
        console.log(`  inventory records:  ${records}`);
        console.log(`  stock movements:    ${movements}`);
        console.log(`  ledger check:       sum of quantities = ${stockTotal.total}, net of movements = ${ledgerNet.total}`);
        console.log(`  data size ${stats.dataSize.toFixed(1)} MB, index size ${stats.indexSize.toFixed(1)} MB`);
    } finally {
        await disconnectDB();
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
})
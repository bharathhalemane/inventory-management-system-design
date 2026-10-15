const { connectDB, disconnectDB } = require('../src/config/db')
const Product = require('../src/models/Product');
const InventoryRecord = require('../src/models/InventoryRecord');


const main = async () => {
    await connectDB();
    await InventoryRecord.init();

    const products = await Product.find({}, { _id: 1 }).lean();
    let created = 0;

    for (const { _id } of products) {
        const result = await InventoryRecord.updateOne(
            { productId: _id },
            { $setOnInsert: { quantity: 0 } },
            { upsert: true }
        );
        if (result.upsertedCount) created += 1;
    }

    console.log(`Products: ${products.length}, inventory records created: ${created}`);
    await disconnectDB();    
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
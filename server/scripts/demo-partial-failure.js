const mongoose = require('mongoose');
const config = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const InventoryRecord = require('../src/models/InventoryRecord');
const StockMovement = require('../src/models/StockMovement');

async function snapshot(productId, label) {
  const record = await InventoryRecord.findOne({ productId }).lean();
  const movements = await StockMovement.countDocuments({ productId });
  console.log(`${label}: quantity=${record.quantity}, movements recorded=${movements}`);
}

async function main() {
  if (config.env === 'production') throw new Error('Refusing to run in production');
  await connectDB();

  const record = await InventoryRecord.findOne().lean();
  if (!record) throw new Error('No inventory records found. Run the backfill script first.');
  const productId = record.productId;

  await snapshot(productId, 'Start');

  console.log('\nA) WITHOUT a transaction: stock update succeeds, then the server "crashes"');
  try {
    await InventoryRecord.updateOne({ productId }, { $inc: { quantity: 5 } });
    throw new Error('simulated crash before the movement is written');
  } catch (err) {
    console.log(`   error: ${err.message}`);
  }
  await snapshot(productId, 'After A');
  console.log('   -> quantity changed but there is NO movement explaining it. Ledger and count disagree.');
  await InventoryRecord.updateOne({ productId }, { $inc: { quantity: -5 } }); // demo cleanup
  console.log('   (demo cleanup: quantity restored)');

  console.log('\nB) WITH a transaction: same simulated crash');
  try {
    await mongoose.connection.transaction(async (session) => {
      await InventoryRecord.updateOne({ productId }, { $inc: { quantity: 5 } }, { session });
      throw new Error('simulated crash before the movement is written');
    });
  } catch (err) {
    console.log(`   error: ${err.message}`);
  }
  await snapshot(productId, 'After B');
  console.log('   -> the stock update was rolled back. Count and ledger still agree.');

  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require('dotenv');

const file = path.join(__dirname, '..', '..', '.env.bench');
if (!fs.existsSync(file)) {
    throw new Error('.env.bench not found. Create it from .env.bench.example first.');
}

Object.assign(process.env, dotenv.parse(fs.readFileSync(file)), { NODE_ENV: 'bench' });


const assertBenchDatabase = (connection) => {
    const name = connection.name;
    if (!name || !name.endsWith('_bench')) {
        throw new Error(`Refusing to run: database "${name}" does not end with "_bench".`);
    }
}

module.exports = { assertBenchDatabase };
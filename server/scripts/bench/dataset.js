const CATEGORIES = [
    'accessories', 'computers', 'audio', 'storage', 'networking',
    'cameras', 'gaming', 'wearables', 'home', 'office',
    'kitchen', 'tools', 'toys', 'sports', 'books',
    'beauty', 'garden', 'automotive', 'pets', 'stationery',
];

const ADJECTIVES = [
    'Wireless', 'Portable', 'Premium', 'Compact', 'Ergonomic',
    'Smart', 'Classic', 'Heavy-duty', 'Slim', 'Rugged',
];

const NOUNS = [
  'Mouse', 'Keyboard', 'Cable', 'Charger', 'Speaker',
  'Headphones', 'Monitor', 'Webcam', 'Router', 'Drive',
  'Lamp', 'Bottle', 'Backpack', 'Stand', 'Hub',
];

const mulberry32 = (seed) => {
    let a = seed | 0;
    return next = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

const idFor = (i) => i.toString(16).padStart(24, '0');
const skuFor = (i) => 'SKU-' + String(i).padStart(7, '0');

module.exports = { CATEGORIES, ADJECTIVES, NOUNS, mulberry32, idFor, skuFor };
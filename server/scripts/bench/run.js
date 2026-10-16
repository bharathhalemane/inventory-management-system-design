const { assertBenchDatabase } = require('./env'); // loads .env.bench first
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../../src/config/db');
const Product = require('../../src/models/Product');
const { CATEGORIES, mulberry32, idFor } = require('./dataset');

const ROOT = path.join(__dirname, '..', '..');
const SAMPLE_REQUESTS = 100; // requests used for the database-side (profiler) sample

function num(name, fallback, min, max) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = raw ? Number(raw.split('=')[1]) : fallback;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`--${name} must be a number between ${min} and ${max}`);
  }
  return value;
}

function str(name, fallback) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  return raw ? raw.split('=')[1] : fallback;
}

// Hard caps protect your machine from an accidental huge run.
const DURATION_S = num('duration', 20, 1, 120);
const WARMUP_S = num('warmup', 5, 0, 30);
const CONCURRENCY = num('concurrency', 10, 1, 50);
const LABEL = str('label', 'baseline');
const ONLY = str('only', null);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (n) => (n === null ? null : Number(n.toFixed(2)));

function buildScenarios(total) {
  const hotCount = Math.floor(total / 100); // products 100, 200, 300, ... have long histories
  const maxPage = Math.max(1, Math.floor((total * 0.9) / 20));
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];
  const randomId = (rng) => idFor(1 + Math.floor(rng() * total));
  const hotId = (rng) => idFor(100 * (1 + Math.floor(rng() * hotCount)));
  const terms = ['wireless', 'portable', 'premium', 'router', 'mouse', 'headphones', 'compact', 'webcam'];

  return [
    { name: 'get-product-by-id', path: (rng) => `/api/v1/products/${randomId(rng)}` },
    { name: 'get-stock', path: (rng) => `/api/v1/products/${randomId(rng)}/stock` },
    { name: 'movements-hot-product', path: (rng) => `/api/v1/products/${hotId(rng)}/movements` },
    { name: 'list-first-page', path: () => '/api/v1/products?limit=20' },
    { name: 'list-by-category', path: (rng) => `/api/v1/products?category=${pick(rng, CATEGORIES)}&limit=20` },
    { name: 'list-deep-page', path: (rng) => `/api/v1/products?limit=20&page=${1 + Math.floor(rng() * maxPage)}` },
    { name: 'search-by-name', path: (rng) => `/api/v1/products?q=${pick(rng, terms)}&limit=20` },
  ];
}

async function startServer() {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));

  const base = `http://127.0.0.1:${process.env.PORT}`;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return { child, base };
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  child.kill();
  throw new Error(`Server did not become healthy within 10 seconds:\n${output}`);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length) - 1; // nearest-rank method
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}

// Closed-loop load: `concurrency` workers each send a request, wait for the full response, then send the next.
async function runLoad({ base, makePath, seconds, concurrency, seed }) {
  const latencies = [];
  const statuses = {};
  let ok = 0;
  let httpErrors = 0;
  let networkErrors = 0;
  const startedAt = performance.now();
  const stopAt = startedAt + seconds * 1000;

  async function worker(index) {
    const rng = mulberry32(seed + index);
    while (performance.now() < stopAt) {
      const url = base + makePath(rng);
      const t0 = performance.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        await res.arrayBuffer(); // read the whole body so latency includes the transfer
        const ms = performance.now() - t0;
        statuses[res.status] = (statuses[res.status] || 0) + 1;
        if (res.status >= 200 && res.status < 300) {
          ok += 1;
          latencies.push(ms);
        } else {
          httpErrors += 1;
        }
      } catch {
        networkErrors += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));

  const elapsed = (performance.now() - startedAt) / 1000;
  const sorted = latencies.sort((a, b) => a - b);
  const requests = ok + httpErrors + networkErrors;
  const mean = sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length : null;

  return {
    requests,
    ok,
    errorRatePercent: requests ? round(((httpErrors + networkErrors) / requests) * 100) : 0,
    throughputRps: round(ok / elapsed),
    meanMs: round(mean),
    p50Ms: round(percentile(sorted, 50)),
    p95Ms: round(percentile(sorted, 95)),
    p99Ms: round(percentile(sorted, 99)),
    maxMs: round(sorted.length ? sorted[sorted.length - 1] : null),
    statuses,
  };
}

// Database-side view: turn MongoDB's profiler on for a short sample and read back time, plan and documents examined.
async function sampleDbTime(base, scenario, dbName) {
  const db = mongoose.connection.db;
  await db.command({ profile: 0 });
  await db.collection('system.profile').drop().catch(() => {});
  await db.command({ profile: 2 }); // level 2 logs every operation (slows things down, so never during measurement)

  const rng = mulberry32(3000);
  for (let i = 0; i < SAMPLE_REQUESTS; i++) {
    const res = await fetch(base + scenario.path(rng));
    await res.arrayBuffer();
  }
  await db.command({ profile: 0 });

  const entries = await db
    .collection('system.profile')
    .find({ ns: new RegExp(`^${dbName}\\.(products|inventoryrecords|stockmovements)$`) })
    .toArray();

  const groups = new Map();
  for (const e of entries) {
    const collection = e.ns.split('.')[1];
    const kind = e.op === 'query' ? 'find' : e.command && e.command.aggregate ? 'aggregate' : e.op;
    const key = `${kind} ${collection}`;
    if (!groups.has(key)) groups.set(key, { op: key, millis: [], docs: [], plans: new Set() });
    const g = groups.get(key);
    g.millis.push(e.millis);
    g.docs.push(e.docsExamined || 0);
    if (e.planSummary) g.plans.add(e.planSummary);
  }

  const mean = (list) => list.reduce((s, v) => s + v, 0) / list.length;
  return [...groups.values()].map((g) => ({
    op: g.op,
    calls: g.millis.length,
    avgMs: round(mean(g.millis)),
    maxMs: Math.max(...g.millis),
    avgDocsExamined: round(mean(g.docs)),
    plans: [...g.plans],
  }));
}

async function main() {
  await connectDB();
  let server;
  try {
    assertBenchDatabase(mongoose.connection);
    const dbName = mongoose.connection.name;
    const total = await Product.estimatedDocumentCount();
    if (total < 1000) {
      throw new Error(`Only ${total} products in "${dbName}". Run: npm run bench:seed`);
    }

    const scenarios = buildScenarios(total).filter((s) => !ONLY || s.name === ONLY);
    if (scenarios.length === 0) throw new Error(`No scenario named "${ONLY}"`);

    server = await startServer();
    const serverVersion = (await mongoose.connection.db.admin().serverInfo()).version;
    console.log(`API up at ${server.base}. Database "${dbName}" has ${total} products (MongoDB ${serverVersion}).`);
    console.log(`Workload: ${CONCURRENCY} concurrent workers, ${WARMUP_S}s warmup, ${DURATION_S}s measured per scenario.`);

    const results = [];
    for (const [index, scenario] of scenarios.entries()) {
      console.log(`\n[${index + 1}/${scenarios.length}] ${scenario.name}`);
      await runLoad({ base: server.base, makePath: scenario.path, seconds: WARMUP_S, concurrency: CONCURRENCY, seed: 1000 });
      const load = await runLoad({ base: server.base, makePath: scenario.path, seconds: DURATION_S, concurrency: CONCURRENCY, seed: 2000 });
      const dbOps = await sampleDbTime(server.base, scenario, dbName);
      results.push({ scenario: scenario.name, example: scenario.path(mulberry32(1)), ...load, dbOps });
      console.log(`    ${load.throughputRps} req/s, p50 ${load.p50Ms} ms, p95 ${load.p95Ms} ms, p99 ${load.p99Ms} ms, errors ${load.errorRatePercent}%`);
    }

    console.log('\n=== Summary (latency in ms; successful requests only) ===');
    console.table(
      results.map((r) => ({
        scenario: r.scenario,
        'req/s': r.throughputRps,
        mean: r.meanMs,
        p50: r.p50Ms,
        p95: r.p95Ms,
        p99: r.p99Ms,
        max: r.maxMs,
        'errors %': r.errorRatePercent,
      }))
    );

    console.log('\n=== Database side (100-request sample with the profiler on) ===');
    for (const r of results) {
      console.log(`\n${r.scenario}`);
      for (const op of r.dbOps) {
        console.log(`  ${op.op}: ${op.calls} calls, avg ${op.avgMs} ms, max ${op.maxMs} ms, avg docs examined ${op.avgDocsExamined}, plan: ${op.plans.join(' | ') || 'n/a'}`);
      }
    }

    const report = {
      label: LABEL,
      takenAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: `${os.platform()} ${os.release()}`,
        cpu: `${os.cpus()[0].model} x${os.cpus().length}`,
        memoryGB: Math.round(os.totalmem() / 1024 ** 3),
        mongodb: serverVersion,
      },
      workload: { concurrency: CONCURRENCY, warmupSeconds: WARMUP_S, durationSeconds: DURATION_S, loop: 'closed', readOnly: true },
      dataset: { database: dbName, products: total },
      results,
    };
    const outDir = path.join(ROOT, 'bench-results');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${LABEL}.json`);
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log(`\nSaved ${outFile}`);
  } finally {
    if (server) server.child.kill();
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
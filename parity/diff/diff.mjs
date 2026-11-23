#!/usr/bin/env node
// Differential tester (PRICE-42). Generates N seeded random requests (valid and invalid), sends each to two base
// URLs and diffs the responses (A is the reference). Same seed + N => the same requests, so a failure is reproducible.
// It finds what the golden corpus missed. Known TS quirks (500s on inherited object keys, null lines) are not generated.
// Exit codes: 0 no differences · 1 differences · 3 a target is unreachable · 64 usage.
// Usage: node parity/diff/diff.mjs --a http://localhost:8082 --b http://localhost:8090 [--seed 42] [--n 1000] [--show 5] [--concurrency 8] [--json out.json]
import { writeFileSync } from "node:fs";
import { closeAgent, compare, describe, parseArgs, requireUrl, send, toRecorded } from "../lib/http.mjs";

const usage = "node parity/diff/diff.mjs --a <reference-url> --b <candidate-url> [--seed 42] [--n 1000] [--show 5] [--concurrency 8] [--json <file>]";
const args = parseArgs();
const A = requireUrl(args, "a", usage);
const B = requireUrl(args, "b", usage);
const seed = Number(args.seed ?? 42);
const N = Number(args.n ?? 1000);
const show = Number(args.show ?? 5);
const concurrency = Number(args.concurrency ?? 8);
if (!Number.isInteger(seed) || !Number.isInteger(N) || N < 1) { process.stderr.write(`error: --seed and --n must be integers\nusage: ${usage}\n`); process.exit(64); }

// mulberry32: tiny, fast, deterministic PRNG.
function prng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = prng(seed);
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

const SKUS = ["SKU-1", "SKU-2", "SKU-3", "SKU-4", "SKU-5"];
const CURRENCIES = ["EUR", "USD", "UAH"];
const BAD_SKUS = ["SKU-0", "SKU-6", "SKU-10", "sku-1", "", "SKU-1 ", " SKU-2", "SKU_3", "SKU-1 "];
const BAD_CURRENCIES = ["GBP", "eur", "usd", "", "EURO", "US", " UAH", "uah", "XXX"];
const BAD_QUANTITIES = [0, -1, 101, 1000, 1.5, 99.9, "3", "", null, true, false, [], {}, -0.5];
const JSON_CT = { "content-type": "application/json" };

/** Mostly boundary-heavy valid quantities. */
const quantity = () => (rnd() < 0.4 ? pick([1, 2, 9, 10, 11, 99, 100]) : int(1, 100));
const validLines = () => Array.from({ length: int(1, 6) }, () => ({ sku: pick(SKUS), quantity: quantity() }));
const quoteReq = (json) => ({ method: "POST", path: "/quote", headers: JSON_CT, json });

const generators = {
  "valid-quote": [40, () => quoteReq({ currency: pick(CURRENCIES), lines: validLines() })],
  "valid-price": [10, () => ({ method: "GET", path: `/prices/${pick(SKUS)}${rnd() < 0.15 ? "" : `?currency=${pick(CURRENCIES)}`}` })],
  "bad-quantity": [10, () => { const lines = validLines(); lines[int(0, lines.length - 1)].quantity = pick(BAD_QUANTITIES); return quoteReq({ currency: pick(CURRENCIES), lines }); }],
  "unknown-sku": [8, () => { const lines = validLines(); lines[int(0, lines.length - 1)].sku = pick(BAD_SKUS); return quoteReq({ currency: pick(CURRENCIES), lines }); }],
  "bad-currency": [8, () => quoteReq({ currency: pick(BAD_CURRENCIES), lines: rnd() < 0.2 ? [] : validLines() })],
  "bad-shape": [8, () => quoteReq(pick([{}, { currency: pick(CURRENCIES) }, { lines: validLines() }, { currency: pick(CURRENCIES), lines: [] }, { currency: pick(CURRENCIES), lines: validLines()[0] }, { currency: 978, lines: validLines() }]))],
  "malformed-json": [6, () => { const body = JSON.stringify({ currency: pick(CURRENCIES), lines: validLines() }); return { method: "POST", path: "/quote", headers: JSON_CT, body: body.slice(0, int(0, body.length - 1)) }; }],
  "content-type": [4, () => ({ method: "POST", path: "/quote", headers: pick([{ "content-type": "text/plain" }, {}, { "content-type": "application/json; charset=utf-8" }]), body: JSON.stringify({ currency: pick(CURRENCIES), lines: validLines() }) })],
  "bad-price-query": [6, () => ({ method: "GET", path: rnd() < 0.5 ? `/prices/${pick(BAD_SKUS.filter((s) => s)).replace(/ /g, "%20").replace(/ /g, "%C2%A0")}?currency=${pick(CURRENCIES)}` : `/prices/${pick(SKUS)}?${pick([`currency=${encodeURIComponent(pick(BAD_CURRENCIES))}`, "currency=EUR&currency=USD", "currency[]=USD", "Currency=USD", "currency"])}` })],
};
const total = Object.values(generators).reduce((s, [w]) => s + w, 0);
function generate() { let r = rnd() * total; for (const [kind, [w, fn]] of Object.entries(generators)) { if ((r -= w) < 0) return { kind, request: fn() }; } }

const work = Array.from({ length: N }, (_, i) => ({ i, ...generate() }));
console.log(`parity:diff A(reference)=${A} B(candidate)=${B} seed=${seed} n=${N}`);

const mismatches = [];
const kinds = {};
const statuses = {};
let next = 0;
async function worker() {
  while (next < work.length) {
    const w = work[next++];
    let a, b;
    try { [a, b] = await Promise.all([send(A, w.request), send(B, w.request)]); }
    catch (e) { console.error(`\nERROR: target unreachable (${e.code ?? e.message}) on request #${w.i}. Are both services running?`); process.exit(3); }
    kinds[w.kind] ??= [0, 0];
    kinds[w.kind][1]++;
    statuses[a.status] = (statuses[a.status] ?? 0) + 1;
    const diffs = compare(toRecorded(a), b, "full");
    if (diffs.length) { kinds[w.kind][0]++; mismatches.push({ ...w, diffs, aStatus: a.status, bStatus: b.status }); }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
closeAgent();
mismatches.sort((x, y) => x.i - y.i);

for (const m of mismatches.slice(0, show)) {
  console.log(`\nMISMATCH #${m.i} (${m.kind}) A=${m.aStatus} B=${m.bStatus}`);
  console.log(`  request: ${describe(m.request)}`);
  for (const d of m.diffs) console.log(`  - ${d}`);
}
console.log(`\nreference statuses: ${Object.entries(statuses).map(([s, n]) => `${s}=${n}`).join(" ")}`);
console.log(`by kind (mismatches/sent): ${Object.entries(kinds).map(([k, [m, n]]) => `${k} ${m}/${n}`).join(", ")}`);
console.log(mismatches.length ? `RESULT: FAIL (${mismatches.length}/${N} requests differ; showing first ${Math.min(show, mismatches.length)})` : `RESULT: PASS (0/${N} requests differ)`);
if (typeof args.json === "string") writeFileSync(args.json, JSON.stringify({ a: A, b: B, seed, n: N, statuses, kinds, mismatches }, null, 2) + "\n");
process.exit(mismatches.length ? 1 : 0);

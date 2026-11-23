#!/usr/bin/env node
// Rounding-trap finder (PRICE-42). Sends every single-line quote (3 currencies x 5 SKUs x quantity 1..100 = 1500)
// to a running service and compares each response field with plausible naive reimplementations of the published rules.
// It shows where a migration is likely to go wrong, so the corpus can hold a tagged case for each rounding site.
// Usage: node parity/traps.mjs --base http://localhost:8082 [--json out.json]
import { writeFileSync } from "node:fs";
import { Decimal } from "decimal.js";
import { closeAgent, parseArgs, requireUrl, send } from "./lib/http.mjs";

const args = parseArgs();
const base = requireUrl(args, "base", "node parity/traps.mjs --base <url> [--json <file>]");

// Published rules (contracts/openapi.yaml, src/pricing.ts header). Kept here so the finder does not import the service.
const BASE = { "SKU-1": 8990, "SKU-2": 12950, "SKU-3": 24900, "SKU-4": 3333, "SKU-5": 4125 };
const RATE = { EUR: "1", USD: "1.0825", UAH: "45.6" };
const PROMO = { "SKU-3": "0.15" };

const D = Decimal.clone({ precision: 40 });
const isTie = (d) => d.minus(d.floor()).eq("0.5");

/** Models: each returns the six money fields for a single-line quote. */
const models = {
  // Go math.Round, Kotlin/Java RoundingMode.HALF_UP, JS Math.round: binary doubles, ties away from zero.
  floatHalfUp: (cur, sku, q) => floatModel(cur, sku, q, Math.round),
  // Binary doubles with ties-to-even (Go math.RoundToEven, BigDecimal(double).setScale(HALF_EVEN)).
  floatHalfEven: (cur, sku, q) => floatModel(cur, sku, q, (x) => { const f = Math.floor(x); const r = x - f; return r > 0.5 ? f + 1 : r < 0.5 ? f : f % 2 === 0 ? f : f + 1; }),
  // Exact decimal, half-even, but the unit price is rounded to cents before it is multiplied by the quantity.
  roundUnitFirst: (cur, sku, q) => decModel(cur, sku, q, { unitFirst: true }),
  // Exact decimal, half-even, but line = round(gross) - round(discount) instead of round(gross - discount).
  subtractRounded: (cur, sku, q) => decModel(cur, sku, q, { subtractRounded: true }),
};

function floatModel(cur, sku, q, round) {
  const r = Number(RATE[cur]);
  const unit = BASE[sku] * r, gross = unit * q;
  const pct = Math.max(Number(PROMO[sku] ?? 0), q >= 10 ? 0.05 : 0);
  const disc = gross * pct;
  const line = round(gross - disc);
  const cart = line / r / 100 >= 200 ? line * 0.03 : 0;
  const taxable = line - round(cart);
  const tax = taxable * 0.2;
  return { unitCents: round(unit), discountCents: round(disc), lineCents: line, subtotalCents: line, cartDiscountCents: round(cart), taxCents: round(tax), totalCents: round(taxable + round(tax)) };
}

function decModel(cur, sku, q, { unitFirst = false, subtractRounded = false }) {
  const he = (d) => d.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber();
  const r = new D(RATE[cur]);
  const unitExact = new D(BASE[sku]).mul(r);
  const unit = unitFirst ? new D(he(unitExact)) : unitExact;
  const gross = unit.mul(q);
  const pct = D.max(PROMO[sku] ?? 0, q >= 10 ? "0.05" : 0);
  const disc = gross.mul(pct);
  const line = subtractRounded ? he(gross) - he(disc) : he(gross.minus(disc));
  const cart = new D(line).div(r).div(100).gte(200) ? new D(line).mul("0.03") : new D(0);
  const taxable = line - he(cart);
  const tax = new D(taxable).mul("0.2");
  return { unitCents: he(unitExact), discountCents: he(disc), lineCents: line, subtotalCents: line, cartDiscountCents: he(cart), taxCents: he(tax), totalCents: taxable + he(tax) };
}

/** Exact intermediate values, to label a mismatch as a half tie (and the parity of its floor). */
function ties(cur, sku, q) {
  const r = new D(RATE[cur]);
  const unit = new D(BASE[sku]).mul(r), gross = unit.mul(q);
  const pct = D.max(PROMO[sku] ?? 0, q >= 10 ? "0.05" : 0);
  const disc = gross.mul(pct), lineExact = gross.minus(disc);
  const line = lineExact.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
  const cart = line.div(r).div(100).gte(200) ? line.mul("0.03") : new D(0);
  const out = {};
  for (const [k, v] of Object.entries({ unitCents: unit, discountCents: disc, lineCents: lineExact, cartDiscountCents: cart })) {
    if (isTie(v)) out[k] = `${v.toString()} (floor ${v.floor().mod(2).eq(0) ? "even" : "odd"})`;
  }
  return out;
}

const FIELDS = ["unitCents", "discountCents", "lineCents", "subtotalCents", "cartDiscountCents", "taxCents", "totalCents"];
const report = { base, searched: "single-line quotes: EUR/USD/UAH x SKU-1..SKU-5 x quantity 1..100", requests: 0, models: {} };
for (const m of Object.keys(models)) report.models[m] = { mismatchedQuotes: 0, byField: Object.fromEntries(FIELDS.map((f) => [f, 0])), examples: [] };

for (const cur of Object.keys(RATE)) for (const sku of Object.keys(BASE)) for (let q = 1; q <= 100; q++) {
  const res = await send(base, { method: "POST", path: "/quote", headers: { "content-type": "application/json" }, json: { currency: cur, lines: [{ sku, quantity: q }] } });
  report.requests++;
  if (res.status !== 200) throw new Error(`unexpected ${res.status} for ${cur} ${sku} x${q}: ${res.text}`);
  const body = JSON.parse(res.text);
  const actual = { ...body.lines[0], subtotalCents: body.subtotalCents, cartDiscountCents: body.cartDiscountCents, taxCents: body.taxCents, totalCents: body.totalCents };
  for (const [m, fn] of Object.entries(models)) {
    const exp = fn(cur, sku, q);
    const bad = FIELDS.filter((f) => exp[f] !== actual[f]);
    if (!bad.length) continue;
    const rm = report.models[m];
    rm.mismatchedQuotes++;
    for (const f of bad) rm.byField[f]++;
    if (rm.examples.length < 12) rm.examples.push({ cart: `${cur} ${sku} x${q}`, fields: Object.fromEntries(bad.map((f) => [f, { service: actual[f], model: exp[f] }])), ties: ties(cur, sku, q) });
  }
}
closeAgent();

console.log(`traps: ${report.searched} against ${base} (${report.requests} requests)`);
for (const [m, r] of Object.entries(report.models)) {
  const fields = Object.entries(r.byField).filter(([, n]) => n).map(([f, n]) => `${f}=${n}`).join(", ") || "-";
  console.log(`  ${m.padEnd(16)} ${String(r.mismatchedQuotes).padStart(4)}/${report.requests} quotes differ; fields: ${fields}`);
  for (const e of r.examples.slice(0, 4)) console.log(`      e.g. ${e.cart}: ${Object.entries(e.fields).map(([f, v]) => `${f} service=${v.service} model=${v.model}`).join("; ")}${Object.keys(e.ties).length ? `  ties: ${JSON.stringify(e.ties)}` : ""}`);
}
if (typeof args.json === "string") writeFileSync(args.json, JSON.stringify(report, null, 2) + "\n");

// Black-box HTTP suite (PRICE-42): what src/pricing.test.ts asserts, re-stated at the HTTP level so it runs
// unchanged against any implementation. Run through parity/blackbox/run.mjs --base <url> (sets PARITY_BASE).
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { closeAgent, send } from "../lib/http.mjs";

const base = process.env.PARITY_BASE;
if (!base) throw new Error("PARITY_BASE is not set; run: node parity/blackbox/run.mjs --base <url>");

const get = async (path) => { const r = await send(base, { method: "GET", path }); return { ...r, body: JSON.parse(r.text) }; };
const post = async (json) => { const r = await send(base, { method: "POST", path: "/quote", headers: { "content-type": "application/json" }, json }); return { ...r, body: JSON.parse(r.text) }; };
after(closeAgent);

describe("unit prices (vitest: unit prices)", () => {
  it("returns the base price in EUR", async () => {
    const r = await get("/prices/SKU-3?currency=EUR");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { sku: "SKU-3", currency: "EUR", baseCents: 24900 });
  });
  it("converts at the fixed rate and rounds half-even (3333 x 1.0825 = 3607.9725 -> 3608)", async () => {
    const r = await get("/prices/SKU-4?currency=USD");
    assert.equal(r.status, 200);
    assert.equal(r.body.baseCents, 3608);
  });
  it("defaults to EUR when no currency is given", async () => {
    assert.equal((await get("/prices/SKU-4")).body.currency, "EUR");
  });
  it("returns 404 with an error body for an unknown SKU", async () => {
    const r = await get("/prices/SKU-9?currency=EUR");
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, { error: "unknown sku SKU-9" });
  });
});

describe("quote (vitest: quote)", () => {
  it("prices a small cart with VAT and no cart discount", async () => {
    const r = await post({ currency: "EUR", lines: [{ sku: "SKU-1", quantity: 1 }] });
    assert.equal(r.status, 200);
    assert.equal(r.contentType, "application/json");
    assert.equal(r.body.subtotalCents, 8990);
    assert.equal(r.body.cartDiscountCents, 0);
    assert.equal(r.body.taxCents, 1798);
    assert.equal(r.body.totalCents, 10788);
  });
  it("uses the larger line discount, not both (15% of 249000, not 20%)", async () => {
    const r = await post({ currency: "EUR", lines: [{ sku: "SKU-3", quantity: 10 }] });
    assert.equal(r.body.lines[0].discountCents, 37350);
  });
  it("adds the 3% cart discount from 200.00 EUR (259.00 -> 777)", async () => {
    const r = await post({ currency: "EUR", lines: [{ sku: "SKU-2", quantity: 2 }] });
    assert.equal(r.body.cartDiscountCents, 777);
  });
  it("rejects quantity 0 with 422 and a 1..100 message", async () => {
    const r = await post({ currency: "EUR", lines: [{ sku: "SKU-1", quantity: 0 }] });
    assert.equal(r.status, 422);
    assert.match(r.body.error, /1\.\.100/);
  });
  it("rejects an unknown currency with 422 'unsupported'", async () => {
    const r = await post({ currency: "GBP", lines: [{ sku: "SKU-1", quantity: 1 }] });
    assert.equal(r.status, 422);
    assert.match(r.body.error, /unsupported/);
  });
});

describe("HTTP contract (consumers: shop-web, shop-orders)", () => {
  it("GET /catalog lists sku and name only", async () => {
    const r = await get("/catalog");
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 5);
    for (const p of r.body) assert.deepEqual(Object.keys(p).sort(), ["name", "sku"]);
  });
  it("POST /quote returns the full quote shape (shop-orders reads totalCents)", async () => {
    const r = await post({ currency: "USD", lines: [{ sku: "SKU-1", quantity: 2 }, { sku: "SKU-3", quantity: 1 }] });
    assert.deepEqual(Object.keys(r.body).sort(), ["cartDiscountCents", "currency", "lines", "subtotalCents", "taxCents", "totalCents"]);
    assert.deepEqual(Object.keys(r.body.lines[0]).sort(), ["discountCents", "lineCents", "quantity", "sku", "unitCents"]);
    assert.ok(Number.isInteger(r.body.totalCents));
  });
  it("rounds the cart discount half-even (1348.5 -> 1348)", async () => {
    const r = await post({ currency: "EUR", lines: [{ sku: "SKU-1", quantity: 5 }] });
    assert.equal(r.body.cartDiscountCents, 1348);
  });
  it("returns 400 'malformed JSON' for a broken body", async () => {
    const r = await send(base, { method: "POST", path: "/quote", headers: { "content-type": "application/json" }, body: "{bad" });
    assert.equal(r.status, 400);
    assert.deepEqual(JSON.parse(r.text), { error: "malformed JSON" });
  });
  it("returns 400 for a body without lines", async () => {
    const r = await post({ currency: "EUR" });
    assert.equal(r.status, 400);
    assert.equal(typeof r.body.error, "string");
  });
  it("returns 422 for an empty cart", async () => {
    const r = await post({ currency: "EUR", lines: [] });
    assert.equal(r.status, 422);
  });
  it("returns 404 for an unknown SKU in a quote", async () => {
    const r = await post({ currency: "EUR", lines: [{ sku: "SKU-9", quantity: 1 }] });
    assert.equal(r.status, 404);
  });
});

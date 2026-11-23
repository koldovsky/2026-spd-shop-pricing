// Golden-corpus case definitions (PRICE-42). The recorder sends each request to the reference service (TS)
// and stores the response next to it in corpus.json. Expected values are never typed by hand.
//
// match: "full"        status + media type + JSON body (exact error messages, integer-only number literals)
//        "error-shape" status + media type + body is exactly { "error": <string> } (message is a JS
//                      stringification artifact such as "unknown sku undefined"; the text is not contract)
//        "status"      status only (framework HTML pages, e.g. Express's "Cannot GET /x", are not contract)
// gate:  false marks a recorded quirk of the TS service (500s, framework behaviour). Quirks are replayed and
//        reported, but do not fail the check. Parity "100%" is over gating cases only.

const SKUS = ["SKU-1", "SKU-2", "SKU-3", "SKU-4", "SKU-5"];
const CURRENCIES = ["EUR", "USD", "UAH"];
const JSON_CT = { "content-type": "application/json" };

const cases = [];
const add = (id, tags, request, opts = {}) => cases.push({ id, tags, match: opts.match ?? "full", gate: opts.gate ?? true, ...(opts.note ? { note: opts.note } : {}), request });
const get = (path) => ({ method: "GET", path });
const quote = (json) => ({ method: "POST", path: "/quote", headers: JSON_CT, json });
const raw = (body, headers = JSON_CT) => ({ method: "POST", path: "/quote", headers, body });
const cart = (currency, ...lines) => quote({ currency, lines: lines.map(([sku, quantity]) => ({ sku, quantity })) });

// ---- GET /catalog
add("catalog", ["catalog", "happy"], get("/catalog"));

// ---- GET /prices/:sku — every SKU in every currency, plus the default currency
for (const sku of SKUS) for (const cur of CURRENCIES) add(`prices-${sku}-${cur}`, ["prices", "happy", `currency:${cur}`], get(`/prices/${sku}?currency=${cur}`));
for (const sku of ["SKU-1", "SKU-4"]) add(`prices-${sku}-default-currency`, ["prices", "happy", "default-currency"], get(`/prices/${sku}`));
add("prices-unknown-sku", ["prices", "unknown-sku"], get("/prices/SKU-9?currency=EUR"));
add("prices-lowercase-sku", ["prices", "unknown-sku"], get("/prices/sku-1?currency=EUR"));
add("prices-unknown-sku-before-currency", ["prices", "unknown-sku", "validation-order"], get("/prices/SKU-9?currency=GBP"), { note: "SKU is checked before currency: 404, not 422" });
add("prices-non-ascii-sku", ["prices", "unknown-sku"], get("/prices/%E2%82%AC"));
add("prices-sku-with-space", ["prices", "unknown-sku"], get("/prices/SKU%201"));
add("prices-percent-encoded-sku", ["prices", "happy"], get("/prices/SKU%2D4?currency=UAH"), { note: "path segment is percent-decoded before lookup" });
add("prices-unsupported-currency", ["prices", "invalid-currency"], get("/prices/SKU-1?currency=GBP"));
add("prices-lowercase-currency", ["prices", "invalid-currency"], get("/prices/SKU-1?currency=usd"));
add("prices-empty-currency", ["prices", "invalid-currency", "malformed-query"], get("/prices/SKU-1?currency="));
add("prices-currency-leading-space", ["prices", "invalid-currency", "malformed-query"], get("/prices/SKU-1?currency=%20EUR"));
add("prices-repeated-currency", ["prices", "invalid-currency", "malformed-query"], get("/prices/SKU-1?currency=EUR&currency=USD"), { note: "repeated key becomes the list 'EUR,USD' and is rejected" });
add("prices-bracket-currency-ignored", ["prices", "malformed-query"], get("/prices/SKU-4?currency[]=USD"), { note: "'currency[]' is a different key: currency defaults to EUR" });
add("prices-nested-currency-ignored", ["prices", "malformed-query"], get("/prices/SKU-4?currency[a]=USD"));
add("prices-currency-param-case", ["prices", "malformed-query"], get("/prices/SKU-1?Currency=USD"), { note: "parameter names are case-sensitive: currency defaults to EUR" });
add("prices-extra-param-ignored", ["prices", "malformed-query"], get("/prices/SKU-2?currency=USD&debug=1"));
add("prices-no-sku", ["routing"], get("/prices/"), { match: "status" });
add("prices-extra-segment", ["routing"], get("/prices/SKU-1/extra"), { match: "status" });

// ---- routing
add("unknown-route", ["routing"], get("/nope"), { match: "status" });
add("get-quote-not-routed", ["routing"], get("/quote"), { match: "status" });
add("post-catalog-not-routed", ["routing"], { method: "POST", path: "/catalog", headers: JSON_CT, body: "{}" }, { match: "status" });

// ---- POST /quote happy paths: every SKU in every currency
for (const sku of SKUS) for (const cur of CURRENCIES) add(`quote-${sku}-${cur}-x1`, ["quote", "happy", `currency:${cur}`], cart(cur, [sku, 1]));

// bulk discount boundary (5% from 10 units) and the max quantity
for (const cur of CURRENCIES) {
  add(`quote-bulk-below-${cur}`, ["quote", "bulk", "boundary"], cart(cur, ["SKU-1", 9]));
  add(`quote-bulk-at-${cur}`, ["quote", "bulk", "boundary"], cart(cur, ["SKU-1", 10]));
  add(`quote-max-quantity-${cur}`, ["quote", "bulk", "boundary"], cart(cur, ["SKU-2", 100]));
}
// promo (15% on SKU-3) vs bulk: the larger one applies, not both
add("quote-promo-x1", ["quote", "promo"], cart("EUR", ["SKU-3", 1]));
add("quote-promo-x9", ["quote", "promo", "boundary"], cart("USD", ["SKU-3", 9]));
add("quote-promo-beats-bulk-x10", ["quote", "promo", "bulk"], cart("EUR", ["SKU-3", 10]), { note: "vitest: 15% of 249000 = 37350, not 20%" });
add("quote-promo-max-UAH", ["quote", "promo", "bulk", "boundary"], cart("UAH", ["SKU-3", 100]));

// cart discount (3% from 200.00 EUR-equivalent). An exact 200.00 subtotal is not reachable with this catalog
// (searched, see docs/evidence/PRICE-42/oracle.md); nearest carts below and above in each currency:
for (const cur of CURRENCIES) {
  add(`quote-cart-below-threshold-${cur}`, ["quote", "cart-discount", "boundary"], cart(cur, ["SKU-4", 6]), { note: "199.98 EUR-equivalent: no cart discount" });
  add(`quote-cart-above-threshold-${cur}`, ["quote", "cart-discount", "boundary"], cart(cur, ["SKU-2", 1], ["SKU-4", 1], ["SKU-5", 1]), { note: "204.08 EUR-equivalent: 3% cart discount" });
}
add("quote-cart-discount-vitest", ["quote", "cart-discount"], cart("EUR", ["SKU-2", 2]), { note: "vitest: 259.00 -> 777" });
add("quote-vitest-small-cart", ["quote", "happy"], cart("EUR", ["SKU-1", 1]), { note: "vitest: 8990 + VAT 1798 = 10788" });

// lines are not merged: ten lines of 1 unit get no bulk discount
add("quote-duplicate-lines-not-merged", ["quote", "bulk", "lines"], cart("EUR", ...Array.from({ length: 10 }, () => ["SKU-1", 1])));
add("quote-mixed-cart-USD", ["quote", "happy", "lines"], cart("USD", ["SKU-1", 2], ["SKU-3", 1], ["SKU-4", 12], ["SKU-5", 3]));
add("quote-mixed-cart-UAH", ["quote", "happy", "lines"], cart("UAH", ["SKU-2", 3], ["SKU-3", 10], ["SKU-5", 7]));
add("quote-largest-cart-UAH", ["quote", "boundary", "lines"], cart("UAH", ...SKUS.map((s) => [s, 100])));
add("quote-50-lines", ["quote", "lines"], cart("EUR", ...Array.from({ length: 50 }, (_, i) => [SKUS[i % 5], (i % 12) + 1])));

// ---- rounding traps (from parity/traps.mjs; each is an exact .5 tie or a rounding-order case)
add("trap-cart-discount-tie-even", ["quote", "rounding", "rounding-trap", "half-even"], cart("EUR", ["SKU-1", 5]), { note: "cart 44950 x 3% = 1348.5 -> 1348 (half-even); half-up gives 1349" });
add("trap-cart-discount-tie-odd", ["quote", "rounding", "half-even"], cart("EUR", ["SKU-2", 3]), { note: "cart 38850 x 3% = 1165.5 -> 1166 (same in half-up)" });
add("trap-line-discount-tie-even", ["quote", "rounding", "rounding-trap", "half-even"], cart("EUR", ["SKU-1", 11]), { note: "discount 4944.5 -> 4944; half-up gives 4945" });
add("trap-line-total-tie-even", ["quote", "rounding", "rounding-trap", "half-even"], cart("EUR", ["SKU-1", 13]), { note: "line 111026.5 -> 111026; half-up gives 111027" });
add("trap-round-unit-first", ["quote", "rounding", "rounding-trap", "rounding-order"], cart("USD", ["SKU-1", 2]), { note: "line = round(9731.675 x 2) = 19463; round(unit) x 2 gives 19464" });
add("trap-subtract-rounded", ["quote", "rounding", "rounding-trap", "rounding-order"], cart("USD", ["SKU-1", 16]), { note: "line = round(gross - discount); round(gross) - round(discount) is 1 cent off" });
add("trap-unit-conversion-USD", ["prices", "rounding"], get("/prices/SKU-4?currency=USD"), { note: "vitest: 3333 x 1.0825 = 3607.9725 -> 3608" });

// ---- JSON number forms for quantity (JS accepts any integral number value)
add("quantity-1.0-is-integer", ["quote", "json-number"], raw('{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1.0}]}'));
add("quantity-1e2-is-100", ["quote", "json-number", "boundary"], raw('{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1e2}]}'));
add("quantity-1e3-too-large", ["quote", "json-number", "invalid-quantity"], raw('{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1e3}]}'));
add("quantity-fraction", ["quote", "invalid-quantity"], cart("EUR", ["SKU-1", 1.5]));
add("quantity-string", ["quote", "invalid-quantity"], cart("EUR", ["SKU-1", "2"]));
add("quantity-zero", ["quote", "invalid-quantity", "boundary"], cart("EUR", ["SKU-1", 0]), { note: "vitest: rejects quantity 0 (/1..100/)" });
add("quantity-negative", ["quote", "invalid-quantity"], cart("EUR", ["SKU-1", -1]));
add("quantity-101", ["quote", "invalid-quantity", "boundary"], cart("EUR", ["SKU-1", 101]));
add("quantity-null", ["quote", "invalid-quantity"], cart("EUR", ["SKU-1", null]));
add("quantity-boolean", ["quote", "invalid-quantity"], cart("EUR", ["SKU-1", true]));
add("quantity-huge", ["quote", "invalid-quantity"], cart("EUR", ["SKU-1", 9007199254740993]));
add("quantity-missing", ["quote", "invalid-quantity"], quote({ currency: "EUR", lines: [{ sku: "SKU-1" }] }));

// ---- SKU problems in quotes
add("quote-unknown-sku", ["quote", "unknown-sku"], cart("EUR", ["SKU-9", 1]));
add("quote-lowercase-sku", ["quote", "unknown-sku"], cart("USD", ["sku-2", 1]));
add("quote-non-ascii-sku", ["quote", "unknown-sku"], cart("EUR", ["€", 1]));
add("quote-sku-missing", ["quote", "unknown-sku"], quote({ currency: "EUR", lines: [{ quantity: 1 }] }), { match: "error-shape", note: "TS message is 'unknown sku undefined'" });
add("quote-sku-number", ["quote", "unknown-sku"], quote({ currency: "EUR", lines: [{ sku: 1, quantity: 1 }] }), { match: "error-shape" });
add("quote-line-is-string", ["quote", "invalid-input"], quote({ currency: "EUR", lines: ["SKU-1"] }), { match: "error-shape", note: "422: quantity is checked first" });

// ---- currency problems in quotes
add("quote-unsupported-currency", ["quote", "invalid-currency"], cart("GBP", ["SKU-1", 1]), { note: "vitest: rejects an unknown currency (/unsupported/)" });
add("quote-lowercase-currency", ["quote", "invalid-currency"], cart("eur", ["SKU-1", 1]));
add("quote-empty-currency", ["quote", "invalid-currency"], cart("", ["SKU-1", 1]));
add("quote-currency-number", ["quote", "invalid-input"], quote({ currency: 1, lines: [{ sku: "SKU-1", quantity: 1 }] }));
add("quote-currency-missing", ["quote", "invalid-input"], quote({ lines: [{ sku: "SKU-1", quantity: 1 }] }));

// ---- validation order
add("order-empty-lines-before-currency", ["quote", "validation-order", "empty"], cart("GBP"), { note: "empty lines (422) is checked before the currency" });
add("order-currency-before-lines", ["quote", "validation-order"], cart("GBP", ["SKU-1", 0]));
add("order-quantity-before-sku", ["quote", "validation-order"], cart("EUR", ["SKU-9", 0]));
add("order-first-failing-line-wins", ["quote", "validation-order"], cart("EUR", ["SKU-1", 1], ["SKU-2", 0], ["SKU-9", 1]));
add("order-unknown-sku-in-first-line", ["quote", "validation-order"], cart("EUR", ["SKU-9", 1], ["SKU-1", 0]));

// ---- body shape problems
add("quote-empty-lines", ["quote", "empty"], cart("EUR"));
add("quote-lines-missing", ["quote", "invalid-input", "empty"], quote({ currency: "EUR" }));
add("quote-lines-object", ["quote", "invalid-input"], quote({ currency: "EUR", lines: { sku: "SKU-1", quantity: 1 } }));
add("quote-lines-string", ["quote", "invalid-input"], quote({ currency: "EUR", lines: "SKU-1" }));
add("quote-empty-object", ["quote", "invalid-input", "empty"], quote({}));
add("quote-body-array", ["quote", "invalid-input"], raw("[]"));
add("quote-body-empty", ["quote", "invalid-input", "empty"], raw(""));
add("quote-malformed-json", ["quote", "malformed-json"], raw("{bad"));
add("quote-truncated-json", ["quote", "malformed-json"], raw('{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]'));
add("quote-json-null", ["quote", "malformed-json"], raw("null"), { note: "strict JSON parser: only objects and arrays are accepted" });
add("quote-json-string", ["quote", "malformed-json"], raw('"x"'));
add("quote-text-plain", ["quote", "content-type"], raw('{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}', { "content-type": "text/plain" }), { note: "non-JSON content type: body is ignored -> 400" });
add("quote-no-content-type", ["quote", "content-type"], raw('{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}', {}));
add("quote-json-charset", ["quote", "content-type", "happy"], raw('{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}', { "content-type": "application/json; charset=utf-8" }));
add("quote-extra-fields-ignored", ["quote", "happy"], quote({ currency: "USD", note: "x", lines: [{ sku: "SKU-5", quantity: 2, price: 1 }] }), { note: "unknown fields are ignored and not echoed" });
add("quote-duplicate-key-last-wins", ["quote", "json-parsing"], raw('{"currency":"USD","currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}'));

// ---- recorded quirks of the TS service (gate: false). A reimplementation may keep or fix them.
add("quirk-prices-currency-toString", ["quirk", "prices"], get("/prices/SKU-1?currency=toString"), { gate: false, note: "RATES is a plain object: inherited keys pass the lookup and crash (500)" });
add("quirk-prices-currency-proto", ["quirk", "prices"], get("/prices/SKU-1?currency=__proto__"), { gate: false });
add("quirk-quote-currency-constructor", ["quirk", "quote"], cart("constructor", ["SKU-1", 1]), { gate: false });
add("quirk-quote-null-line", ["quirk", "quote"], quote({ currency: "EUR", lines: [null] }), { gate: false, note: "destructuring null throws a TypeError (500)" });
add("quirk-trailing-slash", ["quirk", "routing"], get("/catalog/"), { gate: false, note: "Express non-strict routing" });
add("quirk-oversized-body", ["quirk", "quote"], cart("EUR", ...Array.from({ length: 4000 }, () => ["SKU-1", 1])), { gate: false, note: "body over Express's 100 kB limit: the error handler maps 413 to 500" });

export default cases;

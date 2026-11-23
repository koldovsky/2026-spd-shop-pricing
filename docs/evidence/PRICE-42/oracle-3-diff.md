# PRICE-42 oracle, slice 3: differential tester, black-box suite, rounding traps — evidence

Verified revision: **fdeddb48b2312b8427a009b2399d156f297d2c6c** (`PRICE-42-oracle-diff`). Only this evidence file changes after it.
Machine: Windows 11 Pro 10.0.26300, Intel Core Ultra 9 275HX (24 logical CPUs), Node v24.18.0. Date: 2026-11-23.

Targets: 8082 and 8083 are two separate `npm start` processes of the TS service (`src/` identical to main);
8091 is the one-line half-up mutant described in `oracle-2-contract.md` (negative control).

| Command | Result | Exit |
|---|---|---|
| diff TS vs TS, seed 42, n 1000 | 0/1000 differ (reference statuses 200=527 400=145 404=128 422=200) | 0 |
| diff TS vs TS, seed 7, n 5000 | 0/5000 differ | 0 |
| diff TS vs half-up mutant, seed 42, n 1000 | 77/1000 differ (76 valid quotes, 1 content-type case) | 1 |
| black-box vs TS | 16/16 pass | 0 |
| black-box vs half-up mutant | 15/16 (fails "rounds the cart discount half-even (1348.5 -> 1348)") | 1 |
| traps vs TS (1500 single-line quotes) | half-up differs on 137/1500; float + half-even on 0/1500; round-unit-first on 573/1500; round(gross)-round(discount) on 144/1500 | 0 |
| diff without `--b` | usage error | 64 |

Reading of the trap finder: what breaks parity is the **rounding mode and the rounding order**, not binary
floating point. Doubles with ties-to-even match the service on all 1500 single-line quotes; ties-away-from-zero
(Go `math.Round`, Java/Kotlin `RoundingMode.HALF_UP`, JS `Math.round`) differs on 137. Only single-line carts were
searched; multi-line carts are covered by the corpus and the differential tester.

Raw output:

```text
$ node parity/diff/diff.mjs --a http://localhost:8082 --b http://localhost:8083 --seed 42 --n 1000
parity:diff A(reference)=http://localhost:8082 B(candidate)=http://localhost:8083 seed=42 n=1000

reference statuses: 200=527 400=145 404=128 422=200
by kind (mismatches/sent): unknown-sku 0/91, valid-quote 0/419, valid-price 0/83, malformed-json 0/65, bad-currency 0/74, bad-quantity 0/98, bad-shape 0/78, content-type 0/22, bad-price-query 0/70
RESULT: PASS (0/1000 requests differ)
[exit 0]

$ node parity/diff/diff.mjs --a http://localhost:8082 --b http://localhost:8083 --seed 7 --n 5000
parity:diff A(reference)=http://localhost:8082 B(candidate)=http://localhost:8083 seed=7 n=5000

reference statuses: 200=2630 400=755 404=553 422=1062
by kind (mismatches/sent): valid-quote 0/2047, malformed-json 0/264, bad-shape 0/398, unknown-sku 0/403, bad-price-query 0/279, valid-price 0/465, bad-currency 0/388, bad-quantity 0/536, content-type 0/220
RESULT: PASS (0/5000 requests differ)
[exit 0]

$ node parity/diff/diff.mjs --a http://localhost:8082 --b http://localhost:8091 --seed 42 --n 1000
parity:diff A(reference)=http://localhost:8082 B(candidate)=http://localhost:8091 seed=42 n=1000

MISMATCH #3 (valid-quote) A=200 B=200
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-3","quantity":11},{"sku":"SKU-2","quantity":99},{"sku":"SKU-5","quantity":21},{"sku":"SKU-2","quantity":1}]}
  - $.lines[1].discountCents: expected 64102, got 64103

MISMATCH #9 (valid-quote) A=200 B=200
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-3","quantity":17},{"sku":"SKU-1","quantity":30},{"sku":"SKU-2","quantity":42},{"sku":"SKU-4","quantity":9},{"sku":"SKU-5"…
  - $.lines[4].discountCents: expected 2062, got 2063

MISMATCH #10 (valid-quote) A=200 B=200
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-2","quantity":23},{"sku":"SKU-1","quantity":32}]}
  - $.lines[0].discountCents: expected 14892, got 14893

MISMATCH #47 (valid-quote) A=200 B=200
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-2","quantity":11},{"sku":"SKU-3","quantity":9},{"sku":"SKU-1","quantity":100},{"sku":"SKU-5","quantity":47}]}
  - $.lines[0].discountCents: expected 7122, got 7123

MISMATCH #83 (valid-quote) A=200 B=200
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-1","quantity":83},{"sku":"SKU-4","quantity":9},{"sku":"SKU-3","quantity":2},{"sku":"SKU-5","quantity":10},{"sku":"SKU-3",…
  - $.lines[0].discountCents: expected 37308, got 37309
  - $.lines[3].discountCents: expected 2062, got 2063

reference statuses: 200=527 400=145 404=128 422=200
by kind (mismatches/sent): unknown-sku 0/91, valid-quote 76/419, valid-price 0/83, malformed-json 0/65, bad-currency 0/74, bad-quantity 0/98, bad-shape 0/78, content-type 1/22, bad-price-query 0/70
RESULT: FAIL (77/1000 requests differ; showing first 5)
[exit 1]

$ node parity/blackbox/run.mjs --base http://localhost:8082
blackbox target=http://localhost:8082
▶ unit prices (vitest: unit prices)
  ✔ returns the base price in EUR (17.7992ms)
  ✔ converts at the fixed rate and rounds half-even (3333 x 1.0825 = 3607.9725 -> 3608) (0.8759ms)
  ✔ defaults to EUR when no currency is given (0.5466ms)
  ✔ returns 404 with an error body for an unknown SKU (0.6224ms)
✔ unit prices (vitest: unit prices) (20.4756ms)
▶ quote (vitest: quote)
  ✔ prices a small cart with VAT and no cart discount (0.9806ms)
  ✔ uses the larger line discount, not both (15% of 249000, not 20%) (0.715ms)
  ✔ adds the 3% cart discount from 200.00 EUR (259.00 -> 777) (0.6413ms)
  ✔ rejects quantity 0 with 422 and a 1..100 message (0.762ms)
  ✔ rejects an unknown currency with 422 'unsupported' (0.7705ms)
✔ quote (vitest: quote) (4.1519ms)
▶ HTTP contract (consumers: shop-web, shop-orders)
  ✔ GET /catalog lists sku and name only (1.1516ms)
  ✔ POST /quote returns the full quote shape (shop-orders reads totalCents) (0.6298ms)
  ✔ rounds the cart discount half-even (1348.5 -> 1348) (1.093ms)
  ✔ returns 400 'malformed JSON' for a broken body (0.6465ms)
  ✔ returns 400 for a body without lines (0.5459ms)
  ✔ returns 422 for an empty cart (0.4453ms)
  ✔ returns 404 for an unknown SKU in a quote (0.5254ms)
✔ HTTP contract (consumers: shop-web, shop-orders) (5.2525ms)
ℹ tests 16
ℹ suites 3
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 107.17
[exit 0]

$ node parity/blackbox/run.mjs --base http://localhost:8091
blackbox target=http://localhost:8091
▶ unit prices (vitest: unit prices)
  ✔ returns the base price in EUR (18.6347ms)
  ✔ converts at the fixed rate and rounds half-even (3333 x 1.0825 = 3607.9725 -> 3608) (1.048ms)
  ✔ defaults to EUR when no currency is given (0.6737ms)
  ✔ returns 404 with an error body for an unknown SKU (0.8707ms)
✔ unit prices (vitest: unit prices) (21.9177ms)
▶ quote (vitest: quote)
  ✔ prices a small cart with VAT and no cart discount (1.1059ms)
  ✔ uses the larger line discount, not both (15% of 249000, not 20%) (0.6824ms)
  ✔ adds the 3% cart discount from 200.00 EUR (259.00 -> 777) (0.6088ms)
  ✔ rejects quantity 0 with 422 and a 1..100 message (0.7096ms)
  ✔ rejects an unknown currency with 422 'unsupported' (0.7797ms)
✔ quote (vitest: quote) (4.1568ms)
▶ HTTP contract (consumers: shop-web, shop-orders)
  ✔ GET /catalog lists sku and name only (0.9189ms)
  ✔ POST /quote returns the full quote shape (shop-orders reads totalCents) (0.7589ms)
  ✖ rounds the cart discount half-even (1348.5 -> 1348) (1.7413ms)
  ✔ returns 400 'malformed JSON' for a broken body (1.0221ms)
  ✔ returns 400 for a body without lines (0.7417ms)
  ✔ returns 422 for an empty cart (0.5508ms)
  ✔ returns 404 for an unknown SKU in a quote (0.5485ms)
✖ HTTP contract (consumers: shop-web, shop-orders) (6.5383ms)
ℹ tests 16
ℹ suites 3
ℹ pass 15
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 115.1485

✖ failing tests:

test at parity\blackbox\http-suite.mjs:78:3
✖ rounds the cart discount half-even (1348.5 -> 1348) (1.7413ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  1349 !== 1348
  
      at TestContext.<anonymous> (file:///D:/projects/clients/spd-technology/demo/2026-spd-shop-pricing/parity/blackbox/http-suite.mjs:80:12)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1332:7)
      at async Suite.processPendingSubtests (node:internal/test_runner/test:911:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 1349,
    expected: 1348,
    operator: 'strictEqual',
    diff: 'simple'
  }
[exit 1]

$ node parity/traps.mjs --base http://localhost:8082
traps: single-line quotes: EUR/USD/UAH x SKU-1..SKU-5 x quantity 1..100 against http://localhost:8082 (1500 requests)
  floatHalfUp       137/1500 quotes differ; fields: discountCents=62, lineCents=61, subtotalCents=61, cartDiscountCents=15, taxCents=16, totalCents=74
      e.g. EUR SKU-1 x5: cartDiscountCents service=1348 model=1349; totalCents service=52322 model=52321  ties: {"cartDiscountCents":"1348.5 (floor even)"}
      e.g. EUR SKU-1 x11: discountCents service=4944 model=4945  ties: {"discountCents":"4944.5 (floor even)","lineCents":"93945.5 (floor odd)"}
      e.g. EUR SKU-1 x13: lineCents service=111026 model=111027; subtotalCents service=111026 model=111027; totalCents service=129234 model=129235  ties: {"discountCents":"5843.5 (floor odd)","lineCents":"111026.5 (floor even)"}
      e.g. EUR SKU-1 x15: discountCents service=6742 model=6743  ties: {"discountCents":"6742.5 (floor even)","lineCents":"128107.5 (floor odd)"}
  floatHalfEven       0/1500 quotes differ; fields: -
  roundUnitFirst    573/1500 quotes differ; fields: discountCents=350, lineCents=572, subtotalCents=572, cartDiscountCents=207, taxCents=482, totalCents=572
      e.g. USD SKU-1 x2: lineCents service=19463 model=19464; subtotalCents service=19463 model=19464; totalCents service=23356 model=23357
      e.g. USD SKU-1 x3: lineCents service=29195 model=29196; subtotalCents service=29195 model=29196; totalCents service=33983 model=33984
      e.g. USD SKU-1 x4: lineCents service=38927 model=38928; subtotalCents service=38927 model=38928; totalCents service=45311 model=45312
      e.g. USD SKU-1 x5: lineCents service=48658 model=48660; subtotalCents service=48658 model=48660; totalCents service=56638 model=56640
  subtractRounded   144/1500 quotes differ; fields: lineCents=144, subtotalCents=144, cartDiscountCents=4, taxCents=27, totalCents=140
      e.g. USD SKU-1 x16: lineCents service=147921 model=147922; subtotalCents service=147921 model=147922; totalCents service=172180 model=172181
      e.g. USD SKU-1 x17: lineCents service=157167 model=157166; subtotalCents service=157167 model=157166; totalCents service=182942 model=182941
      e.g. USD SKU-1 x18: lineCents service=166412 model=166411; subtotalCents service=166412 model=166411; totalCents service=193704 model=193703
      e.g. USD SKU-1 x23: lineCents service=212637 model=212638; subtotalCents service=212637 model=212638; totalCents service=247510 model=247511
[exit 0]

$ node parity/diff/diff.mjs --a http://localhost:8082
error: --b <url> is required (no default, so a check never silently hits the wrong service)
usage: node parity/diff/diff.mjs --a <reference-url> --b <candidate-url> [--seed 42] [--n 1000] [--show 5] [--concurrency 8] [--json <file>]
[exit 64]

```

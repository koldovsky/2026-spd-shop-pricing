# PRICE-42 oracle, slice 2: contract, corpus replayer, contract check — evidence

Verified revision: **05fcb07084440c457af5a6ec98d5bdf09b5149de** (`PRICE-42-oracle-contract`). Only this evidence file changes after it.
Machine: Windows 11 Pro 10.0.26300, Intel Core Ultra 9 275HX (24 logical CPUs), Node v24.18.0. Date: 2026-11-23.

Targets:

| Port | Process | Purpose |
|---|---|---|
| 8082 | `PORT=8082 npm start` (TS reference, `src/` identical to main) | must pass |
| 8091 | copy of `src/` with one line changed: `Decimal.ROUND_HALF_EVEN` -> `Decimal.ROUND_HALF_UP` (scratchpad, not committed) | negative control: must fail parity |
| 8092 | `bench/null-server.mjs` (answers every request with a fixed JSON array) | negative control: must fail the contract |
| 8099 | nothing listening | must exit 3 |

Results:

| Command | Result | Exit |
|---|---|---|
| contract vs TS | 125/125 gating requests conform | 0 |
| check vs TS | 130/130 gating, 6/6 quirks same | 0 |
| check vs half-up mutant | 126/130: 4 gating mismatches (3 half-even ties + the 50-line cart) | 1 |
| contract vs half-up mutant | 125/125 conform (wrong cents are still valid integers; parity catches them, the contract alone does not) | 0 |
| contract vs null server | 1/125 conform, 124 violations | 1 |
| check without `--base` | usage error, no default target | 64 |
| check vs dead port | "cannot reach" | 3 |
| PowerShell 5.1 `npm run parity:check -- --base <dead port>` | arguments reach the tool | 3 |

Raw output (paths shortened to the repo root):

```text
$ node parity/contract.mjs --base http://localhost:8082
contract target=http://localhost:8082 spec=contracts/openapi.yaml (shop-pricing 1.0.0)

contract: 125/125 gating corpus requests conform (status-only cases excluded)
RESULT: PASS
[exit 0]

$ node parity/check.mjs --base http://localhost:8082
parity:check target=http://localhost:8082
corpus parity\corpus\corpus.json sha256=0211ef856e503d89… recorded from http://localhost:8082 at 25f3e2b940ad

gating: 130/130 passed
quirks (not gating): 6/6 same as reference
RESULT: PASS
[exit 0]

$ node parity/check.mjs --base http://localhost:8091
parity:check target=http://localhost:8091
corpus parity\corpus\corpus.json sha256=0211ef856e503d89… recorded from http://localhost:8082 at 25f3e2b940ad

FAIL quote-50-lines  [quote, lines]
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1},{"sku":"SKU-2","quantity":2},{"sku":"SKU-3","quantity":3},{"sku":"SKU-4","quantity":4},{"sku":"SKU-5","q…
  - $.lines[9].discountCents: expected 2062, got 2063
  - $.lines[10].discountCents: expected 4944, got 4945
  - $.lines[33].discountCents: expected 1666, got 1667
  - $.lines[46].discountCents: expected 7122, got 7123

FAIL trap-cart-discount-tie-even  [quote, rounding, rounding-trap, half-even]
  note: cart 44950 x 3% = 1348.5 -> 1348 (half-even); half-up gives 1349
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-1","quantity":5}]}
  - $.cartDiscountCents: expected 1348, got 1349
  - $.totalCents: expected 52322, got 52321

FAIL trap-line-discount-tie-even  [quote, rounding, rounding-trap, half-even]
  note: discount 4944.5 -> 4944; half-up gives 4945
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-1","quantity":11}]}
  - $.lines[0].discountCents: expected 4944, got 4945

FAIL trap-line-total-tie-even  [quote, rounding, rounding-trap, half-even]
  note: line 111026.5 -> 111026; half-up gives 111027
  request: POST /quote [application/json] {"currency":"EUR","lines":[{"sku":"SKU-1","quantity":13}]}
  - $.lines[0].lineCents: expected 111026, got 111027
  - $.subtotalCents: expected 111026, got 111027
  - $.totalCents: expected 129234, got 129235

gating: 126/130 passed (failing tags: quote 87/91, lines 4/5, rounding 4/7, rounding-trap 2/5, half-even 1/4)
quirks (not gating): 6/6 same as reference
RESULT: FAIL (4 gating mismatches)
[exit 1]

$ node parity/contract.mjs --base http://localhost:8091
contract target=http://localhost:8091 spec=contracts/openapi.yaml (shop-pricing 1.0.0)

contract: 125/125 gating corpus requests conform (status-only cases excluded)
RESULT: PASS
[exit 0]

$ node parity/contract.mjs --base http://localhost:8092
contract target=http://localhost:8092 spec=contracts/openapi.yaml (shop-pricing 1.0.0)

VIOLATION prices-SKU-1-EUR
  request: GET /prices/SKU-1?currency=EUR
  - $: expected object, got array

VIOLATION prices-SKU-1-USD
  request: GET /prices/SKU-1?currency=USD
  - $: expected object, got array

VIOLATION prices-SKU-1-UAH
  request: GET /prices/SKU-1?currency=UAH
  - $: expected object, got array

VIOLATION prices-SKU-2-EUR
  request: GET /prices/SKU-2?currency=EUR
  - $: expected object, got array

VIOLATION prices-SKU-2-USD
  request: GET /prices/SKU-2?currency=USD
  - $: expected object, got array

VIOLATION prices-SKU-2-UAH
  request: GET /prices/SKU-2?currency=UAH
  - $: expected object, got array

VIOLATION prices-SKU-3-EUR
  request: GET /prices/SKU-3?currency=EUR
  - $: expected object, got array

VIOLATION prices-SKU-3-USD
  request: GET /prices/SKU-3?currency=USD
  - $: expected object, got array

VIOLATION prices-SKU-3-UAH
  request: GET /prices/SKU-3?currency=UAH
  - $: expected object, got array

VIOLATION prices-SKU-4-EUR
  request: GET /prices/SKU-4?currency=EUR
  - $: expected object, got array

VIOLATION prices-SKU-4-USD
  request: GET /prices/SKU-4?currency=USD
  - $: expected object, got array

VIOLATION prices-SKU-4-UAH
  request: GET /prices/SKU-4?currency=UAH
  - $: expected object, got array

VIOLATION prices-SKU-5-EUR
  request: GET /prices/SKU-5?currency=EUR
  - $: expected object, got array

VIOLATION prices-SKU-5-USD
  request: GET /prices/SKU-5?currency=USD
  - $: expected object, got array

VIOLATION prices-SKU-5-UAH
  request: GET /prices/SKU-5?currency=UAH
  - $: expected object, got array

VIOLATION prices-SKU-1-default-currency
  request: GET /prices/SKU-1
  - $: expected object, got array

VIOLATION prices-SKU-4-default-currency
  request: GET /prices/SKU-4
  - $: expected object, got array

VIOLATION prices-unknown-sku
  request: GET /prices/SKU-9?currency=EUR
  - $: expected object, got array

VIOLATION prices-lowercase-sku
  request: GET /prices/sku-1?currency=EUR
  - $: expected object, got array

VIOLATION prices-unknown-sku-before-currency
  request: GET /prices/SKU-9?currency=GBP
  - $: expected object, got array

contract: 1/125 gating corpus requests conform (status-only cases excluded)
RESULT: FAIL (124 violations)
[exit 1]

$ node parity/check.mjs
error: --base <url> is required (no default, so a check never silently hits the wrong service)
usage: node parity/check.mjs --base <url> [--corpus <file>] [--json <file>] [--tag <tag>] [--show <n>]
[exit 64]

$ node parity/check.mjs --base http://localhost:8099
parity:check target=http://localhost:8099
corpus parity\corpus\corpus.json sha256=0211ef856e503d89… recorded from http://localhost:8082 at 25f3e2b940ad

ERROR: cannot reach http://localhost:8099 (ECONNREFUSED) on case catalog. Is the service running?
[exit 3]

$ (PowerShell 5.1) npm run parity:check -- --base http://localhost:8099
PS 5.1.26100.9818
[exit 3]
```

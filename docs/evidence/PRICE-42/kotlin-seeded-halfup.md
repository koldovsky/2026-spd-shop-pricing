# PRICE-42 Kotlin — SEEDED DEFECT evidence (demo of the parity gate, not to be merged)

- **Seeded**, not natural: the Kotlin agent got the rounding rule right on its first attempt (iteration 04, from AGENTS.md and the spec), and the converged candidate passes `trap-cart-discount-tie-even`. After convergence (79dcaa9) the orchestrator made one human intervention on branch `PRICE-42-kotlin-seeded-halfup`: `cents()` in `kotlin/src/main/kotlin/pricing/Pricing.kt` uses `RoundingMode.HALF_UP` instead of `HALF_EVEN`. Nothing else changed (the `DIV` MathContext for the cart threshold stays half-even).
- Verified revision: `d7d927a32bf0bf837f399dc1c677441ef8103e73` (seeded). Oracle: read-only checkout `D:/demo-s2/oracle-kotlin` at 128c922; TS reference on 8093; candidate on 8083. Run by the orchestrator on 2026-11-23T20:46:25+02:00.

## Build with unit tests (what the parity-kotlin workflow runs first)

```text
$ kotlin/gradlew -p kotlin clean build --console=plain
> Task :test FAILED
PricingTest > trap - cart discount ties round half-even() FAILED
PricingTest > cart threshold in USD() FAILED
QuoteHttpTest > cart discount tie rounds half even over HTTP() FAILED
45 tests completed, 3 failed
BUILD FAILED in 3s
exit code: 1
```

The agent's own unit tests catch the seeded defect before the oracle runs, so in Actions the gate is expected to go red at the Build step.

## Oracle against the seeded jar (built locally with `-x test`, a command-line flag, not a tree change)

```text
$ node parity/check.mjs --base http://localhost:8083     (exit 1)
FAIL quote-50-lines  [quote, lines]
FAIL trap-cart-discount-tie-even  [quote, rounding, rounding-trap, half-even]
FAIL trap-line-discount-tie-even  [quote, rounding, rounding-trap, half-even]
FAIL trap-line-total-tie-even  [quote, rounding, rounding-trap, half-even]
gating: 126/130 passed (failing tags: quote 87/91, lines 4/5, rounding 4/7, rounding-trap 2/5, half-even 1/4)
RESULT: FAIL (4 gating mismatches)
$ node parity/contract.mjs --base http://localhost:8083  (exit 0)
contract: 125/125 gating corpus requests conform (status-only cases excluded)
RESULT: PASS
$ node parity/blackbox/run.mjs --base http://localhost:8083  (exit 1)
ℹ fail 1
ℹ pass 15
ℹ tests 16
✖ HTTP contract (consumers: shop-web, shop-orders) (6.5874ms)
✖ failing tests:
✖ rounds the cart discount half-even (1348.5 -> 1348) (1.2804ms)
$ node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 42 --n 1000  (exit 1)
by kind (mismatches/sent): unknown-sku 0/91, valid-quote 76/419, valid-price 0/83, malformed-json 0/65, bad-currency 0/74, bad-quantity 0/98, bad-shape 0/78, content-type 1/22, bad-price-query 0/70
RESULT: FAIL (77/1000 requests differ; showing first 5)
```

The oracle catches it: corpus 126/130 with `trap-cart-discount-tie-even` failing, black-box 15/16, diff 77/1000. The contract passes (shapes are unchanged; only values move).

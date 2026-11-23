# PRICE-42 oracle — evidence (baseline against the TS service)

Verified revision: **6952c00450edde2b7b56c7521db6a8ecf2766470** (`PRICE-42-oracle`, oracle slice 5/5, on top of
slices 1-4 merged to main as #3-#6). Only files under `docs/evidence/` change after it.
Machine: Windows 11 Pro 10.0.26300, Intel Core Ultra 9 275HX (24 logical CPUs, 127.68 GB), Node v24.18.0.
Date: 2026-11-23. Raw outputs: `docs/evidence/PRICE-42/oracle-logs/` (one file per command, with the exit code).
`src/` is unchanged from main 25f3e2b (`git diff 25f3e2b 6952c00 -- src` is empty).

Targets: :8082 and :8083 are two `npm start` processes of the TS service; :8091 is a scratch copy of `src/` with
one line changed (`Decimal.ROUND_HALF_EVEN` -> `Decimal.ROUND_HALF_UP`), used as a negative control and not committed.

## Results

| # | Command | Result | Exit |
|---|---|---|---|
| 01 | `npm test` | 7/7 | 0 |
| 02 | `npm run typecheck` | clean | 0 |
| 03 | `npm run hook:test` | 41/41 payloads (25 block, 16 allow) | 0 |
| 04 | `node .claude/hooks/protect-oracle.mjs < .claude/hooks/test-payloads/block-edit-relative.json` (+ allow, + PowerShell 5.1 pipe) | blocked with reason / allowed / blocked | 2 / 0 / 2 |
| 05 | `node parity/contract.mjs --base http://localhost:8082` | 125/125 gating requests conform | 0 |
| 06 | `node parity/check.mjs --base http://localhost:8082` | **130/130 gating (100%)**, 6/6 quirks same | 0 |
| 07 | `node parity/blackbox/run.mjs --base http://localhost:8082` | 16/16 | 0 |
| 08 | `node parity/diff/diff.mjs --a http://localhost:8082 --b http://localhost:8083 --seed 42 --n 1000` | **0/1000 differ** | 0 |
| 09 | `node parity/traps.mjs --base http://localhost:8082` | see "Rounding traps" | 0 |
| 10 | `node parity/check.mjs --base http://localhost:8091` (half-up mutant) | 126/130, 4 mismatches | 1 |
| 11 | `node parity/diff/diff.mjs --a http://localhost:8082 --b http://localhost:8091 --seed 42 --n 1000` | 77/1000 differ | 1 |
| 12 | `node parity/blackbox/run.mjs --base http://localhost:8091` | 15/16 | 1 |
| 13 | live `claude -p` in this repo (env scrubbed per the brief, `CLAUDE_CODE_HIDE_ACCOUNT_INFO=1`), asked to Edit `parity/README.md` | hook fired, file unchanged; 3 turns, 7.4 s, $0.1446 (claude-sonnet-5-5) | 0 |

Corpus: `parity/corpus/corpus.json`, sha256 `0211ef856e503d898ae2f689fc9ef827f4ba128bd647f9d0ab59eac3ca4ba37a`,
136 cases (130 gating, 6 non-gating quirks); statuses over all 136: 200=77, 400=14, 404=16, 422=24, 500=5 (all five 500s are quirks).
Earlier slices: `oracle-1-corpus.md` (recorder reproduces the corpus), `oracle-2-contract.md` (null server fails the
contract with 124 violations; no `--base` exits 64; dead port exits 3; PowerShell 5.1 passes npm arguments),
`oracle-3-diff.md` (TS vs TS 0/5000 with seed 7), `oracle-4-bench.md` (benchmark).

## Benchmark baseline (`bench/results/ts-baseline.json`, at 59ea5f2, same `src/` and `bench/`)

Median of 3 (min-max), 5 s warm-up + 20 s, 64 keep-alive connections, `node dist/server.js`:
RPS **15430.7** (15036.04-15578.01) · p50 **4.39 ms** · p95 **5.64 ms** (5.63-5.66) · p99 **6.41 ms** ·
peak RSS **105.94 MB** · cold start **158.43 ms** · 921,144 requests, 0 non-2xx.
Same code in two other sessions gave 17005.93 / 21282.61 RPS and 5.22 / 4.55 ms p95, so the budget in
`docs/specs/PRICE-42.md` is same-session relative, with 5.64 ms as the recorded reference. Load-generator ceiling:
128775.21 RPS (`bench-client-ceiling.json`).

## Rounding traps (candidates for the migration's "caught bug" moment)

From run 09 (1500 single-line quotes) and run 10:

| Likely reimplementation mistake | Single-line quotes that differ | Corpus case that fails | First divergence |
|---|---|---|---|
| **Ties away from zero** (Go `math.Round`, Kotlin/Java `RoundingMode.HALF_UP`, `Math.round`) | 137/1500 | `trap-cart-discount-tie-even`, `trap-line-discount-tie-even`, `trap-line-total-tie-even` | 5 x SKU-1 EUR: cart discount 44950 x 3% = 1348.5 -> service **1348**, half-up 1349; total 52322 vs 52321 |
| Round the unit price, then multiply | 573/1500 | `trap-round-unit-first` | 2 x SKU-1 USD: line 9731.675 x 2 = 19463.35 -> 19463; 9732 x 2 = 19464 |
| line = round(gross) - round(discount) | 144/1500 | `trap-subtract-rounded` | 16 x SKU-1 USD: 147921 vs 147922 |
| Binary doubles with ties-to-even | 0/1500 | none | not a trap on single-line carts |

Recommended demo case: **5 x SKU-1 in EUR** (`POST /quote {"currency":"EUR","lines":[{"sku":"SKU-1","quantity":5}]}`),
expected `cartDiscountCents` 1348 and `totalCents` 52322. The half-up mutant turns `parity:check` red on exactly
this case (run 10), and the black-box test "rounds the cart discount half-even (1348.5 -> 1348)" fails (run 12).
Tax can never tie (taxable x 0.2 has a fraction of k/5).

## Findings about the TS service (recorded, not fixed)

- 500 `{"error":"internal error"}` for `currency` values that are inherited object keys (`toString`, `__proto__`,
  `constructor`), for `lines: [null]`, and for bodies over 100 kB (Express's 413 is mapped to 500). Non-gating quirks.
- `.claude/rules/api-errors.md` says business-rule violations are 400; the service returns 422. Contract follows the service.
- `?currency=EUR&currency=USD` is read as `EUR,USD` (422); `currency[]=USD` and `Currency=USD` are ignored (EUR).
- An exact 200.00 EUR-equivalent subtotal is not reachable with this catalog (exhaustive search over line values);
  the threshold is tested with 199.98 and 204.08.

## Not verified

- The hook against a migration agent's creative writes (a script it writes and runs can write anywhere; only
  obvious shell writes are blocked). Live firing was verified for Edit only (run 13); Bash/PowerShell patterns
  only through payload tests.
- Benchmark isolation: desktop machine, other agent sessions running; no containers, CPU/memory limits or image size.
- Multi-line rounding traps were not searched exhaustively.

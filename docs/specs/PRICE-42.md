# PRICE-42 — Migrate shop-pricing to Kotlin and Go, with proof

Ticket: koldovsky/2026-spd-shop-workspace `tickets/PRICE-42.md`. Owner: @koldovsky (pricing).

## Goal

Two reimplementations of this service, one in Kotlin (Java 21, Gradle wrapper, as in shop-orders) and one in Go,
each in its own folder of this repo. Each must be indistinguishable from the TypeScript service for its consumers
(shop-web: `GET /catalog`, `GET /prices/{sku}`; shop-orders: `POST /quote`, reads `totalCents`), and the claim must
rest on evidence the migrating agent could not change.

## The oracle (on `main` before the first migration commit)

| Part | Where | Gate |
|---|---|---|
| Contract | `contracts/openapi.yaml` | `node parity/contract.mjs --base <url>` exits 0 |
| Golden corpus | `parity/corpus/corpus.json` (130 gating + 6 non-gating cases, recorded from TS; sha256 `0211ef856e503d898ae2f689fc9ef827f4ba128bd647f9d0ab59eac3ca4ba37a`) | `node parity/check.mjs --base <url>` exits 0 |
| Differential tester | `parity/diff/diff.mjs` | `--a <TS> --b <candidate> --seed 42 --n 1000` exits 0 |
| Black-box suite | `parity/blackbox/` | `node parity/blackbox/run.mjs --base <url>` exits 0 |
| Benchmark | `bench/run.mjs`, baseline `bench/results/ts-baseline.json` | see the budget below |
| Lock | `.claude/hooks/protect-oracle.mjs` + `.github/CODEOWNERS` | agents cannot edit `parity/`, `contracts/`, `bench/`, nor the lock itself (`.claude/settings.json`, `.claude/hooks/`) |

## Acceptance criteria (per stack)

1. `parity/check.mjs` passes **100% of the 130 gating cases** (denominator: gating cases; the 6 quirks are
   reported, not gated).
2. `parity/contract.mjs` passes; `parity/blackbox/run.mjs` passes 16/16.
3. `parity/diff/diff.mjs` against the TS service shows **0 differences** for seed 42, n 1000, and for one more
   seed chosen by the reviewer at review time.
4. The service reads its port from `PORT` (default 8082) and needs no other configuration.
5. **Performance budget:** median p95 over 3 repeats with the default `bench/run.mjs` profile is **not above
   the TS median p95 measured in the same session, back to back, on the same machine**. Reference value:
   TS median p95 **5.64 ms** (`bench/results/ts-baseline.json`, 3 x 20 s, 64 connections). The TS figure moved
   between 5.22 and 5.64 ms in two recorded sessions (`bench/results/ts-baseline.json`, `docs/evidence/PRICE-42/bench-ts-rerun.json`), so the comparison must be same-session; a fixed number alone is
   not a valid gate. RPS, p99, peak RSS and cold start are reported as measured, with no pass/fail.
6. Every PR: key `PRICE-42` in title and branch, `Refs:` on every commit, an evidence file naming the verified
   SHA, under 400 changed lines (shop-harness gates), and a reviewer who is not the agent.
7. Evidence per slice in `docs/evidence/PRICE-42/`: commands, outputs, exit codes, SHA. Kotlin and Go benchmark
   results go there too (`--out docs/evidence/PRICE-42/bench-<stack>.json`), never into `bench/`.

## Known trap (expected to be caught)

ADR-007 rounding is half-even, once per line value and once per total. Ties are reachable: 5 x SKU-1 in EUR has a
cart discount of 44950 x 3% = 1348.5, which must become 1348. Kotlin `RoundingMode.HALF_UP` or Go `math.Round`
give 1349 (corpus case `trap-cart-discount-tie-even`). Rounding the unit price before multiplying
(`trap-round-unit-first`) and subtracting a rounded discount from a rounded gross (`trap-subtract-rounded`) also
fail. Binary floating point with ties-to-even matched all 1500 single-line quotes searched, so the trap is the
rounding mode and order, not float as such.

## Non-goals

- No behaviour change: no new endpoints, fields, messages, status codes or rounding rules. Bugs found in TS are
  fixed in TS first, under their own ticket, and the corpus is re-recorded by a human in its own PR.
- The 6 recorded quirks (500 for `currency=toString` and similar inherited keys, `null` lines, bodies over
  100 kB; `GET /catalog/`) may be kept or fixed; they do not gate.
- No containers, image size, CPU or memory limits, or compose shadow run (no Docker on the presenter machine).
- No cutover in this repo: switching consumers is a separate PR in 2026-spd-shop-workspace, with an ADR.
- Not a stack recommendation: the method is the point.

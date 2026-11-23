# PRICE-42 — Go reimplementation: slice plan

Status: slices 1-4 merged, slice 5 implemented (no fixes needed; benchmark deferred to the presenter). Spec: `docs/specs/PRICE-42.md`. Oracle: `parity/README.md`, `contracts/openapi.yaml`.
Reference implementation: `src/` (TypeScript, Express 5, `decimal.js`).

## Ground rules for every slice

- All code lives in `go/` (module `go/go.mod`, `package main` plus small internal files). Go 1.27, standard library
  only: `net/http` (1.22+ method/path patterns), `encoding/json`, `math/big` for decimal arithmetic. No third-party
  modules, so `go.sum` should stay absent.
- The binary reads `PORT` (default `8082`) and nothing else.
- The only repo-root change in the whole series is the new `.github/workflows/parity-go.yml` (slice 1). The existing
  `.github/workflows/pr-gates.yml` (shop-harness trace and size gates) is not touched. No README, AGENTS.md,
  `.gitattributes` changes.
- `parity/`, `contracts/`, `bench/`, `.claude/` are never edited. If an oracle result looks wrong: stop and ask.
- Every PR: `PRICE-42` in title and branch, `Refs: PRICE-42` on every commit, under 400 changed lines (added +
  deleted, excluding `docs/evidence/**` and `go.sum`), an evidence file `docs/evidence/PRICE-42/go-<n>-<slug>.md`
  naming the verified SHA with commands, outputs and exit codes, and a human reviewer.
- The parity gate (`parity-go.yml`) is green at merge. Each slice only adds `--tag` runs for behaviour it
  implements, so the gate never runs a case the candidate is not yet expected to pass.

## The parity gate (`.github/workflows/parity-go.yml`)

On `pull_request` and `push` to `main`, `ubuntu-latest`, filtered by `paths` (since slice 3, because
`parity-kotlin.yml` shares the repo): `go/**`, `.github/workflows/parity-go.yml`, `parity/**`, `contracts/**`,
`package-lock.json`.

1. `actions/checkout`, `actions/setup-go` (`go-version: '1.27'`), `actions/setup-node` (Node version as used by the
   TS service), `npm ci` (the oracle tools import nothing beyond Node built-ins and repo files; `npm ci` is kept
   only if a tool needs it — checked in slice 1).
2. `go vet ./...` and `go test ./...` in `go/`.
3. `go build -o "$RUNNER_TEMP/pricing-go" .` in `go/`; start it with `PORT=8090` in the background; poll
   `http://localhost:8090/catalog` until it answers (timeout 30 s).
4. Oracle steps against `--base http://localhost:8090`, one step per command (listed per slice below), each must exit 0.

Each slice edits only the list of oracle steps in step 4.

## Rounding design (ADR-007, the known trap)

Money is `*big.Rat` end to end. One helper `cents(r *big.Rat) int64` rounds half-even to an integer (quotient and
remainder of num/den; compare `2*|rem|` with `den`; on a tie pick the even quotient). It is applied exactly where
`src/pricing.ts` calls `cents(...)`: unit, line discount, line total = round(gross − discount) (not
round(gross) − round(discount)), subtotal, cart discount, tax on `subtotal − cents(cartDiscount)`, total =
cents(taxable + cents(tax)). No `float64` and no `math.Round` anywhere in pricing. Go unit tests restate every
`trap-*` case and the vitest cases, including boundary values (9/10 units, 199.98 / 204.08 EUR carts, quantity 1/100).

## Slices

| # | Slug | Est. changed lines | Oracle steps at slice head | Expected |
|---|---|---|---|---|
| 1 | `go-skeleton-catalog` | ~330 (plan ~150) | `check.mjs --tag catalog`, `check.mjs --tag routing` | exit 0, all gating cases of both tags pass |
| 2 | `go-money-prices` | ~200 | + `check.mjs --tag prices` | exit 0 |
| 3 | `go-quote-happy` | ~260 | + `--tag happy`, `--tag bulk`, `--tag promo`, `--tag cart-discount`, `--tag lines`, `--tag rounding` | exit 0 |
| 4 | `go-quote-validation` | ~300 | all `--tag` steps replaced by unfiltered `check.mjs` | exit 0, 130/130 gating |
| 5 | `go-contract-blackbox` | ~60 | `check.mjs`, `contract.mjs`, `blackbox/run.mjs` (all unfiltered) | all exit 0, blackbox 16/16 |

`contract.mjs` and `blackbox/run.mjs` have no filter and exercise all three endpoints including error paths, so they
cannot be gated before the whole API exists; they are run locally from slice 4 on (results in evidence, not gating)
and become gating in slice 5.

### 1. `go-skeleton-catalog`

Scope: Go module, server entry point with `PORT` handling, the catalog data, `GET /catalog`, framework-style 404 for
unrouted paths and methods (`GET /quote`, `POST /catalog`, `/nope`, `/prices/`, `/prices/SKU-1/extra` all 404, since
they are not routed yet or never routed). The parity workflow. This plan file.

Files: `docs/plans/PRICE-42-go.md`, `.github/workflows/parity-go.yml`, `go/go.mod`, `go/main.go`,
`go/catalog.go`, `go/server.go`, `go/server_test.go` (`httptest`: catalog shape, default port, unknown route 404).

Estimate: plan ~150, workflow ~50, Go ~90, tests ~40 → ~330.

Verify: workflow runs `node parity/check.mjs --base http://localhost:8090 --tag catalog` and
`... --tag routing`; expected exit 0 (the `routing` cases compare status only; `GET /catalog/` is a non-gating
quirk and is only reported). Locally the same two commands, outputs in the evidence file.

Note: `routing` stays green in later slices only if new routes keep exact matching (`GET /prices/{sku}` must not
match `/prices/` or `/prices/SKU-1/extra`; Go `{sku}` matches one non-empty segment, which gives exactly that).

### 2. `go-money-prices`

Scope: `big.Rat` money helpers and half-even `cents`, rates (EUR 1, USD 1.0825, UAH 45.6), `GET /prices/{sku}`.
TS semantics to match: SKU is percent-decoded and looked up case-sensitively before the currency (404 before 422);
`currency` defaults to `EUR` only when the key is absent; a repeated key is joined with `,` (Express 5
`String(["EUR","USD"])`) and rejected; `currency[]`, `currency[a]`, `Currency` are other keys; empty value is
rejected as `unsupported currency `. Errors as `{"error": "..."}` with 404 / 422.

Files: `go/money.go`, `go/money_test.go` (half-even ties both ways, negative-free, 3333 × 1.0825 → 3608),
`go/prices.go`, `go/prices_test.go`, `go/server.go` (route), `.github/workflows/parity-go.yml` (+1 step).

Estimate: ~200.

Verify: gate adds `check.mjs --tag prices` (covers `trap-unit-conversion-USD`, unknown SKU, invalid currency,
malformed query); expected exit 0, with `catalog` and `routing` still green.

### 3. `go-quote-happy`

Scope: `POST /quote` for well-formed carts: line pricing (convert, gross = unit × qty, larger of promo 15% on SKU-3
or bulk 5% at ≥10 units, never both), subtotal, 3% cart discount when subtotal in EUR terms ≥ 200.00, VAT 20%, the
exact rounding order above. Lines are not merged. Response field order irrelevant, all numbers as integers (`int64`).
Minimal input handling only (decode into `{currency, lines:[{sku, quantity}]}`); full validation is slice 4.

Files: `go/quote.go`, `go/quote_test.go` (vitest cases, every `trap-*` case, bulk 9/10, threshold below/above per
currency, quantity 100), `go/server.go` (route), `.github/workflows/parity-go.yml` (+6 steps).

Estimate: ~260.

Verify: gate adds `check.mjs --tag happy`, `--tag bulk`, `--tag promo`, `--tag cart-discount`, `--tag lines`,
`--tag rounding` (includes `rounding-trap`, `half-even`, `rounding-order` cases); expected exit 0. Locally also
`node parity/traps.mjs --base http://localhost:8090` for analysis, logged in evidence.

Risk: `--tag boundary` is not used here because it includes `quantity-zero`, `quantity-101`, `quantity-1e2-is-100`,
which need slice 4.

### 4. `go-quote-validation`

Scope: reproduce Express 5 + `express.json()` input semantics and the TS validation order exactly:
- body decode: malformed JSON → 400 `malformed JSON`; empty body / `[]` / non-object → 400 body-shape message;
  `currency` not a string or `lines` not an array → 400 `body must be { currency, lines: [{ sku, quantity }] }`.
- empty `lines` → 422 before currency; then currency (422 `unsupported currency X`); then per line in order:
  quantity (JS `Number.isInteger` semantics on raw JSON numbers: `1.0` and `1e2` are integers, `1e3` too large,
  strings/booleans/null/missing rejected; message `quantity for <sku> must be 1..100`, with JS stringification of a
  missing or non-string sku), then SKU (404 `unknown sku <sku>`). First failing line wins.
- Decode `quantity` via `json.Number` / `json.RawMessage`, never into `float64` arithmetic for pricing.

Files: `go/quote.go`, `go/validate.go`, `go/validate_test.go`, `.github/workflows/parity-go.yml` (tag steps replaced
by one unfiltered step).

Estimate: ~300.

Verify: gate runs `node parity/check.mjs --base http://localhost:8090` with no filter; expected exit 0, 130/130
gating; the 6 quirks are reported, not gated (kept or fixed, outcome recorded in evidence). Locally, not gating yet:
`contract.mjs`, `blackbox/run.mjs`, and `node parity/diff/diff.mjs --a http://localhost:8082 --b
http://localhost:8090 --seed 42 --n 1000` against the TS service; any failure is fixed in this slice or slice 5.

### 5. `go-contract-blackbox`

Scope: turn on the remaining gates, fix any contract or black-box finding (expected small: media types, error body
shape on 404/500, unknown-route body). `contract.mjs` imports the `yaml` package, so the workflow adds `npm ci`
(with the npm cache) before the oracle steps. Add `go/README.md` (build, test, run; production start is the built
binary with `PORT` set, not `go run`) and `go/.gitignore` for the local binary. Acceptance evidence (diff seed 42
n 1000 plus a reviewer-chosen seed) is recorded by the orchestrator, not in this PR's code commits.

Out of scope: the benchmark (`node bench/run.mjs --label go ...` against `bench:ts`). The presenter runs it later;
it is not run as part of this slice and `bench-go.json` is not produced here.

Outcome: no oracle finding locally (check 130/130, contract 125/125, blackbox 16/16, diff seed 42 0/1000), so no
`go/*.go` changes.

Files: `.github/workflows/parity-go.yml` (+2 oracle steps, `npm ci`), `go/README.md`, `go/.gitignore`,
`go/*.go` (fixes only, if any; none needed), evidence by the orchestrator.

Estimate: ~60 (workflow ~10, README ~40, fixes ≤ 50).

Verify: gate runs `node parity/check.mjs --base http://localhost:8090`, `node parity/contract.mjs --base
http://localhost:8090`, `node parity/blackbox/run.mjs --base http://localhost:8090`, all unfiltered; expected all
exit 0, 130/130 gating, contract ok, blackbox 16/16. This is the final state of the workflow.

## Open points for the reviewer

- If slice 4 exceeds 400 lines, split it into 4a (body decode + empty/currency/malformed JSON:
  `--tag malformed-json`, `--tag empty`, `--tag invalid-currency`, `--tag invalid-input`) and 4b (quantity and SKU
  rules, validation order, then unfiltered `check.mjs`); the series stays at 6 PRs.
- Slice 5 adds `go/README.md` at the user's request (the root README stays untouched).
- Diff and benchmark need the TS service running next to the candidate, so they are local evidence, not CI steps,
  per the workflow scope above.

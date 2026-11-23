<!-- owner: @koldovsky (pricing team) · why: instructions every agent needs in every session · review-by: 2027-02-19 -->
# 2026-spd-shop-pricing

Pricing service of the Shop system: catalog prices, discounts, VAT, currency conversion. TypeScript + Express 5.
The only place where prices are computed. Contract: 2026-spd-shop-workspace `docs/contracts.md#pricing`.

## Commands
- Test: `npm test` · Typecheck: `npm run typecheck` · Run: `npm run dev` → :8082
- Oracle (PRICE-42): `node parity/check.mjs --base <url>` · `node parity/diff/diff.mjs --a <ref> --b <url>` · `node parity/blackbox/run.mjs --base <url>` · see `parity/README.md`

## Hard rules
- Decimal arithmetic (`decimal.js`) inside; integer cents in the API; round half-even once per line and once per total (ADR-007).
- Every pricing rule has a test, including the boundary value.
- API errors: see `.claude/rules/api-errors.md`.
- `parity/`, `contracts/`, `bench/` are the PRICE-42 oracle: run them, never edit them (a hook blocks it). If the oracle looks wrong, stop and ask.

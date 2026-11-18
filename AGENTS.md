<!-- owner: @koldovsky (pricing team) · why: instructions every agent needs in every session · review-by: 2027-02-19 -->
# 2026-spd-shop-pricing

Pricing service of the Shop system: catalog prices, discounts, VAT, currency conversion. TypeScript + Express 5.
The only place where prices are computed. Contract: 2026-spd-shop-workspace `docs/contracts.md#pricing`.

## Commands
- Test: `npm test` · Typecheck: `npm run typecheck` · Run: `npm run dev` → :8082

## Hard rules
- Decimal arithmetic (`decimal.js`) inside; integer cents in the API; round half-even once per line and once per total (ADR-007).
- Every pricing rule has a test, including the boundary value.
- API errors: the `api-errors` skill from 2026-spd-shop-harness (team-core). No local copies — the drift check fails on them.

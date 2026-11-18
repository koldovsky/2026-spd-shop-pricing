# 2026-spd-shop-pricing

Pricing service of the demo **Shop** system (SPD «Team AI Engineering», Workshop 1). TypeScript + Express 5.
In Session 2 an agent migrates it to another stack, with proof.

| | |
|---|---|
| Install | `npm install` |
| Test | `npm test` |
| Run | `npm run dev` → http://localhost:8082 |

API: `GET /catalog`, `GET /prices/:sku?currency=EUR`, `POST /quote` `{ currency, lines: [{ sku, quantity }] }`.
Rules are documented at the top of `src/pricing.ts`. Demo code; nothing here is real.

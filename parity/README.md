# PRICE-42 oracle

The oracle decides whether a reimplementation of shop-pricing (Kotlin, Go, or anything else) behaves like the
TypeScript service. It was built and recorded **before** any migration commit, and agents cannot change it:
`.claude/hooks/protect-oracle.mjs` blocks agent writes into `parity/`, `contracts/` and `bench/`, and
`.github/CODEOWNERS` requires the pricing owner's review for any change to them.

Every tool takes the target as an argument and has **no default URL**, so a check never silently hits the wrong
service. Start the candidate on its own port (for example `PORT=8090`) and point the tools at it.

| Tool | What it proves | Command (any shell) | Exit |
|---|---|---|---|
| Contract | `contracts/openapi.yaml`: every status, media type and body the candidate returns for the corpus requests is declared | `node parity/contract.mjs --base http://localhost:8090` | 0 ok, 1 violations |
| Golden corpus | Same response as TS for 130 gating cases (happy paths, every currency, bulk, promo, cart threshold, half-even ties, invalid input, unknown SKU, malformed JSON and query) | `node parity/check.mjs --base http://localhost:8090` | 0 = 100% of gating cases, 1 otherwise |
| Differential | Seeded random valid and invalid requests to two services; any difference is shown with the request | `node parity/diff/diff.mjs --a http://localhost:8082 --b http://localhost:8090 --seed 42 --n 1000` | 0 = no differences |
| Black-box | The assertions of `src/pricing.test.ts`, restated over HTTP | `node parity/blackbox/run.mjs --base http://localhost:8090` | node:test |
| Benchmark | Cold start, RPS, p50/p95/p99, peak RSS, 3 repeats, native | `node bench/run.mjs --label go --cmd "<start command>" --out docs/evidence/PRICE-42/bench-go.json` | 1 if any non-2xx |
| Rounding traps | Where naive rounding (half-up, round-unit-first, ...) diverges from the service | `node parity/traps.mjs --base http://localhost:8082` | analysis only |

npm aliases: `npm run parity:check -- --base <url>` (also `parity:contract`, `parity:diff -- --a <url> --b <url>`,
`blackbox -- --base <url>`, `bench -- ...`, `bench:ts`, `hook:test`). `parity:record` re-records the corpus
from the TS reference; only a human runs it, in a PR of its own.

## How responses are compared

- Status code always; media type without parameters (`application/json; charset=utf-8` equals `application/json`).
- JSON bodies are compared as data: key order is ignored, array order is not, extra or missing keys fail.
- Every number literal in a JSON response must be an integer literal (`10788`, not `10788.0`).
- Error messages are compared exactly, except for cases marked `error-shape`, where the TS message is a JavaScript
  stringification artifact (`unknown sku undefined`); there only `{ "error": <non-empty string> }` is required.
- Framework 404 pages for unknown routes compare by status only.

## Honesty limits

- **Parity is over gating cases only.** Six recorded quirks of the TS service (500 for `currency=toString` and
  other inherited object keys, `null` quote lines, bodies over 100 kB; `GET /catalog/` answering 200) are replayed
  and reported but do not gate. A candidate may keep or fix them.
- **The corpus and the differential tester sample the input space; they do not prove equivalence.** The
  differential tester does not generate the quirk inputs above. Exact 200.00 EUR cart subtotals are not reachable
  with this catalog, so the threshold is tested with the nearest carts below and above.
- **The trap finder searched single-line carts only** (1500 quotes). Multi-line carts are covered by the
  corpus and the differential tester, not by an exhaustive search.
- **The hook is a guard rail, not a sandbox.** It blocks Claude Code's file tools on these folders and *obvious*
  shell writes (redirection, `rm`/`mv`/`cp`/`tee`/`sed -i`/`Set-Content`, `--out` into the folders, inline
  `node -e`/`python -c` writes, the recorder). A program that the agent writes and runs can still write anywhere.
  The final lock is review: CODEOWNERS on these folders, and the corpus sha256 in
  `docs/evidence/PRICE-42/oracle.md`.
- **Benchmark numbers are machine-specific.** Client and server share one desktop machine, so other load is not
  controlled. The load generator is Node; `bench/null-server.mjs` measures its ceiling, and a candidate that
  gets close to that ceiling is client-bound. No containers: no CPU or memory limits and no image size.

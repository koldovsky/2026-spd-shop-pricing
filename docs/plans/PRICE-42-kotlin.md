# PRICE-42 — Kotlin reimplementation: slice plan

Goal: a Kotlin service in `kotlin/` that consumers cannot tell apart from the TS service (`src/`), proven by the
locked oracle (`parity/`, `contracts/`). Spec: `docs/specs/PRICE-42.md`. This plan is committed with slice 1.

## Decisions

- **Java 21, Kotlin JVM, Gradle 9.9.1 wrapper in `kotlin/`** (wrapper files copied from 2026-spd-shop-orders).
- **HTTP: plain `com.sun.net.httpserver`**, not Ktor. Reason: parity needs byte-level control over things Ktor
  would decide for us (query parsing, content-type handling, path decoding, 404 for unknown routes and methods,
  JSON number literals), it adds no dependencies, starts fast (helps the bench budget) and keeps the jar small.
  Request handling runs on a fixed thread pool (`Executors.newFixedThreadPool`) — no virtual-thread tuning.
- **JSON: a small hand-written parser and writer** (no kotlinx.serialization / Jackson). Reason: the request
  semantics are Express `body-parser` strict mode (top-level must be object or array, last duplicate key wins,
  `1.0` / `1e2` are integer quantities, anything else is `malformed JSON`), and the output must be integer
  literals only. A dynamic `JsonValue` tree mirrors how the TS code sees `req.body`.
- **Money: `BigDecimal`**, rounding `RoundingMode.HALF_EVEN` with `setScale(0)` exactly where TS calls `cents()`:
  unit, discount, line, cart discount, tax. Never round the unit before multiplying.
- **Artifact:** `kotlin/build/libs/pricing.jar`, a self-contained jar (runtime classpath merged in the `jar`
  task, `Main-Class` in the manifest). Production start: `java -jar kotlin/build/libs/pricing.jar`.
- **Config:** `PORT` env var only, default 8082.
- Layout: `kotlin/src/main/kotlin/pricing/{Main,Router,Catalog,Pricing,Json,Http}.kt`, tests in
  `kotlin/src/test/kotlin/pricing/`. Tests use `kotlin("test")` (JUnit 5).

## Rules for every slice

- Branch `PRICE-42-kotlin-<slug>`, PR title contains `PRICE-42`, < 400 changed lines as the diff-size gate counts
  them (wrapper files, lockfiles and `docs/evidence/**` excluded; `docs/plans/` counts).
- Each commit message ends with:
  ```
  Refs: PRICE-42
  Assisted-by: Claude Code (claude-opus-5-5)
  ```
- Never touch `parity/`, `contracts/`, `bench/`, `.claude/`. Nothing at the repo root except
  `.github/workflows/parity-kotlin.yml`. No bench runs. Evidence files are written by the orchestrator.
- Local runs: candidate on `PORT=8083` only; TS reference already on `http://localhost:8093` (never start/stop it;
  never use 8082, 8084, 8094). Common local commands (from repo root, Git Bash):
  - build: `kotlin/gradlew -p kotlin build` (runs unit tests, produces the jar)
  - start: `PORT=8083 java -jar kotlin/build/libs/pricing.jar` (background; stop it after the checks)
  - `node parity/check.mjs --base http://localhost:8083`
  - `node parity/contract.mjs --base http://localhost:8083`
  - `node parity/blackbox/run.mjs --base http://localhost:8083`
  - `node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 42 --n 1000`

## Slices

### 1. `skeleton` — build, runnable server, parity gate (~330 lines)

- Scope: Gradle wrapper + build; `Main.kt` reads `PORT`, starts the server; router with exact-path matching and
  framework-style 404 for unknown routes/methods; `GET /catalog` from an in-code catalog (same 5 products, same
  order); JSON writer for the catalog; CI workflow; this plan.
- Files: `kotlin/{settings.gradle.kts,build.gradle.kts,gradle.properties,.gitignore,gradlew,gradlew.bat}`,
  `kotlin/gradle/wrapper/*` (not counted), `kotlin/src/main/kotlin/pricing/{Main,Router,Catalog,Json}.kt`
  (writer part only), `kotlin/src/test/kotlin/pricing/CatalogTest.kt`, `.github/workflows/parity-kotlin.yml`,
  `docs/plans/PRICE-42-kotlin.md`.
- Workflow: `on: pull_request`, `ubuntu-latest`, `actions/setup-java` (temurin 21), `actions/setup-node` (24),
  `./kotlin/gradlew -p kotlin build`, `PORT=8083 java -jar kotlin/build/libs/pricing.jar &`, wait loop on
  `curl -sf http://localhost:8083/catalog` (timeout 60 s, fail if never up), then the three steps
  `node parity/check.mjs`, `node parity/contract.mjs`, `node parity/blackbox/run.mjs` with `--base
  http://localhost:8083`. No `continue-on-error`, no case filters. Expected red until slice 5.
- Estimate: plan ~150, build files ~45, Kotlin main ~90, test ~20, workflow ~45 → **~350**.
- Verify: `kotlin/gradlew -p kotlin build`; start on 8083; `curl -s http://localhost:8083/catalog`;
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:8083/nope` → 404; run the three oracle tools and record
  the counts.
- Oracle after it: catalog and unknown-route cases in `check.mjs` pass; the rest fail (expected). Gate red.

### 2. `pricing-core` — pricing rules in BigDecimal, unit-tested (~250 lines)

- Scope: `Pricing.kt` — rates (EUR 1, USD 1.0825, UAH 45.6), VAT 0.20, promo SKU-3 15%, bulk 5% at ≥10 units
  (max, not both), cart 3% when `subtotal / rate / 100 >= 200`, `PricingError(message, status)`, `unitPrice`,
  `quote` with the same validation order as TS (empty lines → currency → per line quantity then SKU). Pure
  functions, no HTTP yet. Rates looked up in an explicit map (inherited-key quirks are not reproduced: they are
  non-gating).
- Files: `kotlin/src/main/kotlin/pricing/Pricing.kt`, `kotlin/src/test/kotlin/pricing/PricingTest.kt`.
- Tests: every rule with its boundary — 9 vs 10 units, SKU-3 with 10 units (15% wins), cart just below/above
  200 EUR in each currency, quantity 0/1/100/101, the three traps (`5 x SKU-1 EUR` cart discount 1348,
  round-unit-first, subtract-rounded), plus the cases of `src/pricing.test.ts` restated.
- Estimate: main ~90, tests ~160 → **~250**.
- Verify: `kotlin/gradlew -p kotlin test`.
- Oracle after it: unchanged (not wired to HTTP); unit tests green.

### 3. `json` — request JSON parser with Express semantics (~330 lines)

- Scope: complete `Json.kt`: parser to a `JsonValue` tree (object with last-key-wins, array, string with all
  escapes incl. surrogate pairs, number kept as `BigDecimal` text so `1.0`, `1e2` and huge values behave like JS
  `Number.isInteger`, true/false/null), strict top-level rule (object or array, else `malformed JSON`), writer
  for integer-only numbers and correctly escaped strings.
- Files: `kotlin/src/main/kotlin/pricing/Json.kt`, `kotlin/src/test/kotlin/pricing/JsonTest.kt`.
- Estimate: main ~180, tests ~150 → **~330**.
- Verify: `kotlin/gradlew -p kotlin test`; cross-check unusual inputs against the TS reference with `curl` to
  `http://localhost:8093/quote` (read only).
- Oracle after it: unchanged.

### 4. `prices` — `GET /prices/{sku}` and the error envelope (~220 lines)

- Scope: `Http.kt`: Express-like query parsing for `currency` (missing → EUR, repeated → joined with `,`,
  `currency[]`/other keys ignored, empty → 422), percent-decoding of the path segment, error responses
  `{"error": msg}` with `application/json; charset=utf-8`, 404 before 422 order; route wired in the router.
- Files: `kotlin/src/main/kotlin/pricing/{Http,Router}.kt`, `kotlin/src/test/kotlin/pricing/HttpTest.kt`.
- Estimate: main ~100, tests ~120 → **~220**.
- Verify: build, start on 8083, `check.mjs` (count of passing cases rises), targeted `curl` vs 8093.
- Oracle after it: all `/catalog` and `/prices` gating cases in `check.mjs`; contract has no violations on these
  paths. Gate still red (quote missing).

### 5. `quote` — `POST /quote` end to end (~250 lines)

- Scope: content-type handling (`application/json` with any charset, else empty body → shape 400), body read with
  the 100 kB limit, `malformed JSON`, shape check (`currency` string and `lines` array → else 400), line
  extraction exactly as JS destructuring sees it (non-object line → `sku`/`quantity` undefined, messages with JS
  stringification where the corpus marks `error-shape`), call into `Pricing.quote`, response serialization.
- Files: `kotlin/src/main/kotlin/pricing/{Http,Router}.kt`, `kotlin/src/test/kotlin/pricing/QuoteHttpTest.kt`.
- Estimate: main ~110, tests ~140 → **~250**.
- Verify: build; start on 8083; `check.mjs`, `contract.mjs`, `blackbox/run.mjs`; `diff.mjs --a
  http://localhost:8093 --b http://localhost:8083 --seed 42 --n 1000`.
- Oracle after it: target is the full gate green (130/130, contract, blackbox 16/16); diff seed 42 is a stretch
  goal here, remaining differences go to slice 6.

### 6. `parity` — close differential gaps, README (~150 lines)

- Scope: fix every difference found by `diff.mjs` for seed 42 and several extra seeds (e.g. 7, 1234, 2026,
  99991), each fix with a regression unit test; `kotlin/README.md` with the exact build
  (`kotlin/gradlew -p kotlin build`) and production start (`java -jar kotlin/build/libs/pricing.jar`, `PORT`).
- Files: `kotlin/src/**` as needed, `kotlin/README.md`.
- Estimate: fixes + tests ~100, README ~50 → **~150** (buffer for unknowns).
- Verify: all four oracle tools; diff for seed 42 n 1000 and for the reviewer's seed, both 0 differences.
- Oracle after it: `check.mjs` 130/130 gating, `contract.mjs` exit 0, `blackbox/run.mjs` 16/16, `diff.mjs` 0
  differences (seed 42 and reviewer seed). CI gate green.

Total estimate ~1550 lines over 6 PRs; no slice above ~350.

## Risks

1. **Express/`qs`/`body-parser` edge semantics** (repeated or bracketed query keys, malformed `%` escapes in the
   path, trailing slashes, HEAD requests, charset parameters, non-object lines) are where diffs hide; mitigated by
   probing the TS reference on 8093 before coding each route and by multiple diff seeds.
2. **JS number semantics**: `Number.isInteger` on `1e2`, `1.0`, `-0`, huge or tiny values; parsing via
   `BigDecimal` must reproduce the JS double view (e.g. `100.0000000000000001` is 100 in JS).
3. **Rounding traps**: HALF_UP, rounding the unit first, or BigDecimal `equals` vs `compareTo` at the 200 EUR
   threshold; covered by the trap unit tests in slice 2 and by the corpus.
4. **Slice 1 size**: the plan document counts toward 400 lines; if it overflows, the catalog route moves to
   slice 4.
5. **CI**: gate red for slices 1–4 by design, so reviewers must merge on unit tests + recorded partial counts;
   startup wait must not hide a crashed JVM (the wait step fails on timeout).
6. **Performance budget** (bench, run by the orchestrator, not here): JVM warm-up may hurt p95; fixed thread
   pool and no reflection-heavy libs keep this low, but it is only measured after slice 6.

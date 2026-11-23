# shop-pricing — Kotlin implementation (PRICE-42)

A Kotlin/JVM reimplementation of the TypeScript pricing service (`src/`). Consumers must not be able to tell the
two apart; the locked oracle in `parity/` and `contracts/` is the judge. Spec: `docs/specs/PRICE-42.md`,
plan: `docs/plans/PRICE-42-kotlin.md`.

## Requirements

- Java 21 (JDK for building, JRE is enough to run).
- No other installs: the Gradle wrapper (`kotlin/gradlew`) downloads Gradle itself.

## Build

From the repo root:

```
kotlin/gradlew -p kotlin build
```

This compiles, runs the unit tests (`kotlin/src/test/kotlin/pricing/`) and produces the self-contained jar
`kotlin/build/libs/pricing.jar` (runtime classpath merged, `Main-Class` in the manifest).

## Run (production)

```
java -jar kotlin/build/libs/pricing.jar
```

- `PORT` environment variable sets the listen port; default `8082` (same as the TS service).
- No other configuration. The catalog, rates, VAT and discount rules are in code, as in the TS service.

## Endpoints

Same as the TS service and `contracts/openapi.yaml`: `GET /catalog`, `GET /prices/{sku}?currency=`, `POST /quote`.
Errors are `{"error": "<message>"}` with `application/json; charset=utf-8`; unknown routes answer 404.

## Layout

| File | Role |
|---|---|
| `Main.kt` | reads `PORT`, starts `com.sun.net.httpserver` on a fixed thread pool |
| `Router.kt` | exact-path routing, framework-style 404 |
| `Http.kt` | Express-like query parsing, path decoding, body/content-type handling, error envelope |
| `Json.kt` | strict JSON parser (body-parser semantics) and integer-only writer |
| `Pricing.kt` | `BigDecimal` pricing, half-even rounding where TS rounds (ADR-007) |
| `Catalog.kt` | the five products, in TS order |

## Parity checks

Start the candidate on a free port (for example `8083`), then from the repo root:

```
node parity/check.mjs --base http://localhost:8083
node parity/contract.mjs --base http://localhost:8083
node parity/blackbox/run.mjs --base http://localhost:8083
node parity/diff/diff.mjs --a <TS reference url> --b http://localhost:8083 --seed 42 --n 1000
```

CI runs the first three in `.github/workflows/parity-kotlin.yml`. Non-gating TS quirks (see `parity/README.md`)
are not reproduced.

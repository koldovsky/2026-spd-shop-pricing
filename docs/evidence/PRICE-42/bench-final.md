# PRICE-42 evidence: final benchmark, TS vs Kotlin vs Go

Verified revision: the benchmark files were added in commit `d3eb600`; the services were built from `904a685` (pricing `main` after both streams merged).

## What ran

- Machine: Intel Core Ultra 9 275HX, 24 logical CPUs, 128 GB RAM, Windows 11 (10.0.26300), Node v24.18.0, Java 21, Go 1.27.4. Native processes, no containers. The load client runs on the same machine and shares the CPU.
- Profile (`bench/run.mjs` defaults): 5 s warm-up, 20 s closed-loop load, 64 keep-alive connections, 8 client workers, seed 42, mix 20% catalog / 30% prices / 50% quote, 3 repeats per run. Cold start = spawn to first 200 on `GET /catalog`.
- Order: TS, Kotlin, Go, then the same again (`bench-final/run-all.sh`); then Kotlin once more with `-Xmx256m`. No migration agents were running.
- Build: `npm run build`; `go -C go build -o pricing.exe .`; `kotlin/gradlew -p kotlin build -x test` (tests ran in CI on the merged PRs).
- Every run: 0 non-2xx, 0 errors; all bench exits 0 (`run-all.sh` writes `exits.txt`, all `exit 0`).

## Results (median [min–max] over 3 repeats; `node docs/evidence/PRICE-42/bench-final/summarize.mjs`)

| run | rps | p50Ms | p95Ms | p99Ms | peakRssMB | coldStartMs | non-2xx | errors |
|---|---|---|---|---|---|---|---|---|
| r1-go (go/pricing.exe) | 81518.08 [80990.63–82043.13] | 0.46 [0.45–0.48] | 2.64 [2.56–2.66] | 4.34 [4.22–4.43] | 54.17 [44.48–80.68] | 30.35 [25.92–263.37] | 0 | 0 |
| r1-kotlin (java -jar kotlin/build/libs/pricing.jar) | 105779.52 [105243.39–106604.43] | 0.58 [0.57–0.58] | 0.92 [0.89–0.93] | 1.22 [1.17–1.24] | 1354.34 [1347.7–1355.46] | 181.37 [180.31–181.86] | 0 | 0 |
| r1-ts (node dist/server.js) | 16958.98 [16699.84–17051.75] | 4.04 [4.01–4.09] | 5.12 [5.1–5.21] | 5.61 [5.59–5.71] | 105.65 [105.4–105.94] | 146.22 [138.7–147.98] | 0 | 0 |
| r2-go (go/pricing.exe) | 81601.26 [81385.41–82016.17] | 0.46 [0.45–0.48] | 2.65 [2.57–2.65] | 4.39 [4.21–4.39] | 44.1 [43.82–44.95] | 35.01 [28.77–38.29] | 0 | 0 |
| r2-kotlin (java -jar kotlin/build/libs/pricing.jar) | 106035.9 [105709.55–106076.77] | 0.58 [0.57–0.58] | 0.91 [0.91–0.92] | 1.18 [1.18–1.2] | 1365.63 [1350.72–1367.39] | 180.77 [179.72–192.7] | 0 | 0 |
| r2-ts (node dist/server.js) | 17252.76 [16563–17388.97] | 3.95 [3.93–4.08] | 5.1 [5.07–5.15] | 5.71 [5.58–5.84] | 105.64 [105.5–106.09] | 138.94 [138.09–149.88] | 0 | 0 |
| r3-kotlin-xmx256m (java -Xmx256m -jar kotlin/build/libs/pricing.jar) | 103946.97 [103542.53–104844.35] | 0.59 [0.58–0.59] | 0.94 [0.92–0.95] | 1.24 [1.23–1.26] | 304.44 [299.75–306.29] | 182.19 [179.84–186.87] | 0 | 0 |

## Against the budget (spec §5: median p95 not above the TS median p95 measured in the same session)

| | TS p95 (same session) | candidate p95 | within budget |
|---|---|---|---|
| Kotlin, round 1 / 2 | 5.12 / 5.10 ms | 0.92 / 0.91 ms | yes / yes |
| Go, round 1 / 2 | 5.12 / 5.10 ms | 2.64 / 2.65 ms | yes / yes |

## Parity of the benchmarked builds (`bench-final/parity-at-904a685.txt`)

Go and Kotlin binaries built at 904a685: `check.mjs` PASS (130 gating cases), `contract.mjs` 125/125, black-box exit 0. Non-gating quirks matching TS: Go 0/6, Kotlin 2/6.

## Read with care

- The JVM's peak RSS (about 1.35 GB) is the default heap sizing on a 128 GB machine, not the service's need: with `-Xmx256m` it is about 304 MB at about 2% lower throughput. Say which one you quote.
- One Go cold start was 263 ms (round 1, first repeat); the other five were 26–38 ms.
- Client and server share one machine, so absolute RPS is a property of this desktop, not of production. Compare the ratios within a session, not with other machines.
- This is one workload (small JSON, in-memory catalog). It says nothing about I/O-bound behaviour, GC under memory pressure, or maintainability.

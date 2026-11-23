# PRICE-42 oracle, slice 4: benchmark and the TS baseline — evidence

Verified revision: **59ea5f2147168c8ba4d171653287d7d11d4b53e9** (`PRICE-42-oracle-bench`). After it only this file,
`docs/evidence/PRICE-42/bench-*.json` and `bench/results/ts-baseline.json` (named in the Evidence trailer) change.

Machine (from `bench/results/ts-baseline.json`): Windows_NT 10.0.26300 x64, Intel Core Ultra 9 275HX, 24 logical CPUs,
127.68 GB RAM, Node v24.18.0. Native processes, no containers, no CPU or memory limits. Client and server share
the machine; other load was not controlled (other agent sessions were running; CPU load 17% read right after the runs).

Profile (all runs): server started by the bench on :8090 with `PORT=8090`; 5 s warm-up; 20 s closed loop;
64 keep-alive connections over 8 client worker threads; 1000 seeded requests (20% `GET /catalog`, 30% `GET /prices`,
50% `POST /quote` with 1-5 lines); 3 repeats, each from a fresh process. TS runs `node dist/server.js` (compiled by
`npm run build`, the production way to run it; `npm start` uses tsx and starts slower).

## TS baseline (`bench/results/ts-baseline.json`)

| Metric (median of 3; min-max) | TS |
|---|---|
| RPS | 15430.7 (15036.04-15578.01) |
| p50 latency | 4.39 ms (4.35-4.54) |
| **p95 latency** | **5.64 ms (5.63-5.66)** |
| p99 latency | 6.41 ms (6.2-6.63) |
| Peak RSS (OS peak working set of the listening process) | 105.94 MB (105.91-106.39) |
| Cold start (spawn to first 200) | 158.43 ms (150.99-161.98) |
| Requests measured / non-2xx / errors | 921,144 / 0 / 0 |

## Variance between sessions (same code, same profile, same machine)

| Session | RPS median | p95 median | Source |
|---|---|---|---|
| earlier the same evening, at 82f204a (identical service and bench code, before the PR split) | 21282.61 | 4.55 ms | console output, file not kept |
| baseline, at 59ea5f2 | 15430.7 | 5.64 ms | `bench/results/ts-baseline.json` |
| re-run right after, at 59ea5f2 | 17005.93 | 5.22 ms | `docs/evidence/PRICE-42/bench-ts-rerun.json` |

RPS moves by up to 38% and p95 by up to 24% between sessions on this desktop, so a candidate must be compared with
TS **in the same session**: the PRICE-42 budget is "candidate median p95 <= TS median p95 measured back to back
with the same profile"; 5.64 ms is the recorded reference value, not a fixed threshold.

## Load generator ceiling (`docs/evidence/PRICE-42/bench-client-ceiling.json`)

`bench/null-server.mjs` (8 Node processes, no pricing work) reached a median 128775.21 RPS (123537.04-134872.57)
with the same profile. A candidate whose RPS approaches that number is bounded by the client, not by itself.
Peak RSS there is the primary process only (the 8 workers are not counted).

## Raw output

```text
$ npm run bench:ts -- --out bench/results/ts-baseline.json

> shop-pricing@1.0.0 bench:ts
> npm run build && node bench/run.mjs --label ts --cmd "node dist/server.js" --out bench/results/ts-baseline.json


> shop-pricing@1.0.0 build
> tsc src/server.ts --outDir dist --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --esModuleInterop

bench ts: cmd="node dist/server.js" port=8090 repeats=3 warmup=5s duration=20s connections=64 client-workers=8
  run 1: cold=158.43 ms rps=15578.01 p50=4.35 p95=5.66 p99=6.41 ms peakRSS=105.94 MB requests=311637 non2xx=0 errors=0
  run 2: cold=150.99 ms rps=15036.04 p50=4.54 p95=5.64 p99=6.2 ms peakRSS=105.91 MB requests=300801 non2xx=0 errors=0
  run 3: cold=161.98 ms rps=15430.7 p50=4.39 p95=5.63 p99=6.63 ms peakRSS=106.39 MB requests=308706 non2xx=0 errors=0
summary (median of 3): rps=15430.7 p50=4.39 p95=5.64 p99=6.41 ms peakRSS=105.94 MB cold=158.43 ms
wrote bench/results/ts-baseline.json
[exit 0]

$ node bench/run.mjs --label client-ceiling --cmd node bench/null-server.mjs --out docs/evidence/PRICE-42/bench-client-ceiling.json
bench client-ceiling: cmd="node bench/null-server.mjs" port=8090 repeats=3 warmup=5s duration=20s connections=64 client-workers=8
  run 1: cold=148.77 ms rps=134872.57 p50=0.45 p95=0.74 p99=0.91 ms peakRSS=71.95 MB requests=2697633 non2xx=0 errors=0
  run 2: cold=146.73 ms rps=128775.21 p50=0.46 p95=0.83 p99=1.16 ms peakRSS=72.17 MB requests=2575706 non2xx=0 errors=0
  run 3: cold=145.42 ms rps=123537.04 p50=0.47 p95=0.86 p99=1.32 ms peakRSS=71.97 MB requests=2470996 non2xx=0 errors=0
summary (median of 3): rps=128775.21 p50=0.46 p95=0.83 p99=1.16 ms peakRSS=71.97 MB cold=146.73 ms
wrote docs/evidence/PRICE-42/bench-client-ceiling.json
[exit 0]

$ node bench/run.mjs --label ts-smoke-bad --cmd node dist/server.js --base http://localhost:8082
error: --label and exactly one of --cmd / --base are required
usage: node bench/run.mjs --label <name> (--cmd "<server command>" [--port 8090] | --base <url>) [--repeats 3] [--warmup 5] [--duration 20] [--connections 64] [--client-workers 8] [--seed 42] [--out <file>]
[exit 64]

$ node bench/run.mjs --label ts-rerun --cmd "node dist/server.js" --out docs/evidence/PRICE-42/bench-ts-rerun.json
bench ts-rerun: cmd="node dist/server.js" port=8090 repeats=3 warmup=5s duration=20s connections=64 client-workers=8
  run 1: cold=145.98 ms rps=17005.93 p50=4.03 p95=5.17 p99=5.83 ms peakRSS=106.36 MB requests=340197 non2xx=0 errors=0
  run 2: cold=156.74 ms rps=17164.14 p50=3.96 p95=5.22 p99=5.71 ms peakRSS=106.31 MB requests=343372 non2xx=0 errors=0
  run 3: cold=145.99 ms rps=16795.11 p50=4.04 p95=5.39 p99=6.01 ms peakRSS=105.91 MB requests=335986 non2xx=0 errors=0
summary (median of 3): rps=17005.93 p50=4.03 p95=5.22 p99=5.83 ms peakRSS=106.31 MB cold=145.99 ms
wrote docs/evidence/PRICE-42/bench-ts-rerun.json
[exit 0]
```

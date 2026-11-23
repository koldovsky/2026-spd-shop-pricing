# PRICE-42 Go slice 2 `money-prices` — evidence

Verified revision: **dd71c1f1af71950cb7c06da392e3276287707bc5** (branch `PRICE-42-go-money-prices`). Only evidence files change after it.
Recorded by the orchestrator (Claude Code, claude-opus-5-5), not by the agent under test. Oracle tools run from a separate
checkout of `128c922` (`D:\demo-s2\oracle-go`), candidate built from the verified revision to a binary outside the clone,
started with `PORT=8084`, TS reference `node dist/server.js` from the oracle checkout on `PORT=8094`.
Machine: Windows 11 Pro 10.0.26300, go1.27.4 windows/amd64, Node v24.18.0. Date: 2026-11-23 20:20 +0200.

Parity gate steps at this head (`.github/workflows/parity-go.yml`): go vet, go test, build, start on :8090, `check.mjs --tag catalog`, `--tag routing`, `--tag prices`. Expected at this head: the three tag runs exit 0; the full-oracle rows are expected to fail until slices 3–5 land (`/quote` is not implemented yet).

| Check (full oracle, no filter unless stated) | Result | Exit |
|---|---|---|
| `check.mjs --tag catalog` | gating: 1/1 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag prices` | gating: 33/33 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag routing` | gating: 5/5 passed;RESULT: PASS | [exit 0] |
| `check.mjs` (130 gating) | gating: 39/130 passed (failing tags: happy 19/39, currency:EUR 5/10, currency:USD 5/10, currency:UAH 5/10, unknown-sku 5/10, validation-order 1/6, invalid-currency 5/8, quote 0/91, bulk 0/12, boundary 0/21, promo 0/4, cart-discount 0/7, lines 0/5, rounding 1/7, rounding-trap 0/5, half-even 0/4, rounding-order 0/2, json-number 0/3, invalid-quantity 0/10, invalid-input 0/9, empty 0/5, malformed-json 0/4, content-type 0/3, json-parsing 0/1);RESULT: FAIL (91 gating mismatches) | [exit 1] |
| `contract.mjs` (125) | contract: 34/125 gating corpus requests conform (status-only cases excluded);RESULT: FAIL (91 violations) | [exit 1] |
| `blackbox/run.mjs` (16) | ℹ tests 16;ℹ pass 5;ℹ fail 11 | [exit 1] |
| `diff.mjs --seed 42 --n 1000` vs TS | RESULT: FAIL (847/1000 requests differ; showing first 5) | [exit 1] |
| `diff.mjs --seed 7 --n 1000` vs TS | RESULT: FAIL (856/1000 requests differ; showing first 5) | [exit 1] |

Build and unit tests (from `build.log`):

```text
# oracle run s2 at dd71c1f1af71950cb7c06da392e3276287707bc5 (2026-11-23T20:20:06+0200)
$ git -C <clone> status --porcelain
[end status]
$ go version
go version go1.27.4 windows/amd64
$ go -C go vet ./...
[exit 0]
$ go -C go test ./...
ok  	pricing	0.527s
[exit 0]
$ go -C go build -o D:/demo-s2/bin-go/pricing-dd71c1f.exe .
[exit 0]
9968640 bytes D:/demo-s2/bin-go/pricing-dd71c1f.exe
candidate started: D:/demo-s2/bin-go/pricing-dd71c1f.exe PID=66512; port 8084 owner PID=66512
stopped PID 66512
```

Oracle lock (`lock.log`; empty diff and empty status = the agent's tree did not change the oracle):

```text
$ git -C <clone> diff --stat 128c922 -- parity contracts bench .claude
[end diff]
$ git -C <clone> status --porcelain -- parity contracts bench .claude
[end status]
```

Raw outputs: `docs/evidence/PRICE-42/go-logs/2-money-prices/` (commands are the first line of each log; `check.log` lists every failing case).
Agent runs for this slice (raw `claude -p` JSON, prompt, start/end): `runs/go/03-money-prices.json` 

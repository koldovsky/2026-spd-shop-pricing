# PRICE-42 Go slice 1 `skeleton-catalog` — evidence

Verified revision: **a0ef62087b617c911f541a48839d47786e587c58** (branch `PRICE-42-go-skeleton-catalog`). Only evidence files change after it.
Recorded by the orchestrator (Claude Code, claude-opus-5-5), not by the agent under test. Oracle tools run from a separate
checkout of `128c922` (`D:\demo-s2\oracle-go`), candidate built from the verified revision to a binary outside the clone,
started with `PORT=8084`, TS reference `node dist/server.js` from the oracle checkout on `PORT=8094`.
Machine: Windows 11 Pro 10.0.26300, go1.27.4 windows/amd64, Node v24.18.0. Date: 2026-11-23 20:16 +0200.

Parity gate steps at this head (`.github/workflows/parity-go.yml`): go vet, go test, build, start on :8090, `check.mjs --tag catalog`, `check.mjs --tag routing`. Expected at this head: both tag runs exit 0; the full-oracle rows below are expected to fail until slices 2–5 land (the plan, `docs/plans/PRICE-42-go.md`).

| Check (full oracle, no filter unless stated) | Result | Exit |
|---|---|---|
| `check.mjs --tag catalog` | gating: 1/1 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag routing` | gating: 5/5 passed;RESULT: PASS | [exit 0] |
| `check.mjs` (130 gating) | gating: 6/130 passed (failing tags: happy 1/39, prices 0/33, currency:EUR 0/10, currency:USD 0/10, currency:UAH 0/10, default-currency 0/2, unknown-sku 0/10, validation-order 0/6, invalid-currency 0/8, malformed-query 0/7, quote 0/91, bulk 0/12, boundary 0/21, promo 0/4, cart-discount 0/7, lines 0/5, rounding 0/7, rounding-trap 0/5, half-even 0/4, rounding-order 0/2, json-number 0/3, invalid-quantity 0/10, invalid-input 0/9, empty 0/5, malformed-json 0/4, content-type 0/3, json-parsing 0/1);RESULT: FAIL (124 gating mismatches) | [exit 1] |
| `contract.mjs` (125) | contract: 1/125 gating corpus requests conform (status-only cases excluded);RESULT: FAIL (124 violations) | [exit 1] |
| `blackbox/run.mjs` (16) | ℹ tests 16;ℹ pass 1;ℹ fail 15 | [exit 1] |
| `diff.mjs --seed 42 --n 1000` vs TS | RESULT: FAIL (1000/1000 requests differ; showing first 5) | [exit 1] |
| `diff.mjs --seed 7 --n 1000` vs TS | RESULT: FAIL (1000/1000 requests differ; showing first 5) | [exit 1] |

Build and unit tests (from `build.log`):

```text
# oracle run s1 at a0ef62087b617c911f541a48839d47786e587c58 (2026-11-23T20:16:12+0200)
$ git -C <clone> status --porcelain
[end status]
$ go version
go version go1.27.4 windows/amd64
$ go -C go vet ./...
[exit 0]
$ go -C go test ./...
ok  	pricing	(cached)
[exit 0]
$ go -C go build -o D:/demo-s2/bin-go/pricing-a0ef620.exe .
[exit 0]
9937920 bytes D:/demo-s2/bin-go/pricing-a0ef620.exe
candidate started: D:/demo-s2/bin-go/pricing-a0ef620.exe PID=89348; port 8084 owner PID=89348
stopped PID 89348
```

Oracle lock (`lock.log`; empty diff and empty status = the agent's tree did not change the oracle):

```text
$ git -C <clone> diff --stat 128c922 -- parity contracts bench .claude
[end diff]
$ git -C <clone> status --porcelain -- parity contracts bench .claude
[end status]
```

Raw outputs: `docs/evidence/PRICE-42/go-logs/1-skeleton-catalog/` (commands are the first line of each log; `check.log` lists every failing case).
Agent runs for this slice (raw `claude -p` JSON, prompt, start/end): `runs/go/01-plan.json` `runs/go/02-skeleton-catalog.json` 

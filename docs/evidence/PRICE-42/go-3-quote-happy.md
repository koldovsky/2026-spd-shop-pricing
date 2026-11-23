# PRICE-42 Go slice 3 `quote-happy` — evidence

Verified revision: **09bbb2cf5f3513c325347af7ce9548fc53a51a64** (branch `PRICE-42-go-quote-happy`). Only evidence files change after it.
Recorded by the orchestrator (Claude Code, claude-opus-5-5), not by the agent under test. Oracle tools run from a separate
checkout of `128c922` (`D:\demo-s2\oracle-go`), candidate built from the verified revision to a binary outside the clone,
started with `PORT=8084`, TS reference `node dist/server.js` from the oracle checkout on `PORT=8094`.
Machine: Windows 11 Pro 10.0.26300, go1.27.4 windows/amd64, Node v24.18.0. Date: 2026-11-23 20:25 +0200.

Parity gate steps at this head (`.github/workflows/parity-go.yml`): go vet, go test, build, start on :8090, `check.mjs --tag` catalog, routing, prices, happy, bulk, promo, cart-discount, lines, rounding. The workflow now runs only when go/**, the workflow, parity/**, contracts/** or package-lock.json change. Expected at this head: every tag run exits 0 (the orchestrator also ran `--tag rounding-trap`: 5/5, which includes `trap-cart-discount-tie-even`); the full-oracle rows are expected to fail only on validation cases until slice 4.

| Check (full oracle, no filter unless stated) | Result | Exit |
|---|---|---|
| `check.mjs --tag bulk` | gating: 12/12 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag cart-discount` | gating: 7/7 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag catalog` | gating: 1/1 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag happy` | gating: 39/39 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag lines` | gating: 5/5 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag prices` | gating: 33/33 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag promo` | gating: 4/4 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag rounding-trap` | gating: 5/5 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag rounding` | gating: 7/7 passed;RESULT: PASS | [exit 0] |
| `check.mjs --tag routing` | gating: 5/5 passed;RESULT: PASS | [exit 0] |
| `check.mjs` (130 gating) | gating: 106/130 passed (failing tags: unknown-sku 9/10, validation-order 4/6, quote 67/91, boundary 18/21, json-number 0/3, invalid-quantity 0/10, invalid-input 3/9, empty 4/5, malformed-json 3/4, content-type 1/3);RESULT: FAIL (24 gating mismatches) | [exit 1] |
| `contract.mjs` (125) | contract: 119/125 gating corpus requests conform (status-only cases excluded);RESULT: FAIL (6 violations) | [exit 1] |
| `blackbox/run.mjs` (16) | ℹ tests 16;ℹ pass 15;ℹ fail 1 | [exit 1] |
| `diff.mjs --seed 42 --n 1000` vs TS | RESULT: FAIL (139/1000 requests differ; showing first 5) | [exit 1] |
| `diff.mjs --seed 7 --n 1000` vs TS | RESULT: FAIL (175/1000 requests differ; showing first 5) | [exit 1] |

Build and unit tests (from `build.log`):

```text
# oracle run s3 at 09bbb2cf5f3513c325347af7ce9548fc53a51a64 (2026-11-23T20:24:42+0200)
$ git -C <clone> status --porcelain
[end status]
$ go version
go version go1.27.4 windows/amd64
$ go -C go vet ./...
[exit 0]
$ go -C go test ./...
ok  	pricing	0.564s
[exit 0]
$ go -C go build -o D:/demo-s2/bin-go/pricing-09bbb2c.exe .
[exit 0]
9997312 bytes D:/demo-s2/bin-go/pricing-09bbb2c.exe
candidate started: D:/demo-s2/bin-go/pricing-09bbb2c.exe PID=89144; port 8084 owner PID=89144
stopped PID 89144
```

Oracle lock (`lock.log`; empty diff and empty status = the agent's tree did not change the oracle):

```text
$ git -C <clone> diff --stat 128c922 -- parity contracts bench .claude
[end diff]
$ git -C <clone> status --porcelain -- parity contracts bench .claude
[end status]
```

Raw outputs: `docs/evidence/PRICE-42/go-logs/3-quote-happy/` (commands are the first line of each log; `check.log` lists every failing case).
Agent runs for this slice (raw `claude -p` JSON, prompt, start/end): `runs/go/04-quote-happy.json` 

# PRICE-42 Go — SEEDED DEFECT (half-up rounding): evidence that the parity gate goes red

Verified revision: **cd7267a9c0d3e93a5e4140859b91c43009dc5f9e** (branch `PRICE-42-go-seeded-halfup`, tag `price-42-go-seeded-oracle`). Only evidence files change after it.
Recorded by the orchestrator (Claude Code, claude-opus-5-5), not by the agent under test. Oracle tools run from a separate
checkout of `128c922` (`D:\demo-s2\oracle-go`), candidate built from the verified revision to a binary outside the clone,
started with `PORT=8084`, TS reference `node dist/server.js` from the oracle checkout on `PORT=8094`.
Machine: Windows 11 Pro 10.0.26300, go1.27.4 windows/amd64, Node v24.18.0. Date: 2026-11-23 20:41 +0200.

Parity gate steps at this head (`.github/workflows/parity-go.yml`): unchanged from main (final state): npm ci, go vet, go test, build, start, unfiltered check.mjs, contract.mjs, blackbox/run.mjs. Expected at this head: RED at the corpus step (seeded).

| Check (full oracle, no filter unless stated) | Result | Exit |
|---|---|---|
| `check.mjs` (130 gating) | gating: 126/130 passed (failing tags: quote 87/91, lines 4/5, rounding 4/7, rounding-trap 2/5, half-even 1/4);RESULT: FAIL (4 gating mismatches) | [exit 1] |
| `contract.mjs` (125) | contract: 125/125 gating corpus requests conform (status-only cases excluded);RESULT: PASS | [exit 0] |
| `blackbox/run.mjs` (16) | ℹ tests 16;ℹ pass 15;ℹ fail 1 | [exit 1] |
| `diff.mjs --seed 42 --n 1000` vs TS | RESULT: FAIL (77/1000 requests differ; showing first 5) | [exit 1] |
| `diff.mjs --seed 7 --n 1000` vs TS | RESULT: FAIL (75/1000 requests differ; showing first 5) | [exit 1] |

Build and unit tests (from `build.log`):

```text
# oracle run seeded2 at cd7267a9c0d3e93a5e4140859b91c43009dc5f9e (2026-11-23T20:41:05+0200)
$ git -C <clone> status --porcelain
[end status]
$ go version
go version go1.27.4 windows/amd64
$ go -C go vet ./...
[exit 0]
$ go -C go test ./...
ok  	pricing	(cached)
[exit 0]
$ go -C go build -o D:/demo-s2/bin-go/pricing-cd7267a.exe .
[exit 0]
10016256 bytes D:/demo-s2/bin-go/pricing-cd7267a.exe
candidate started: D:/demo-s2/bin-go/pricing-cd7267a.exe PID=87988; port 8084 owner PID=87988
stopped PID 87988
```

Oracle lock (`lock.log`; empty diff and empty status = the agent's tree did not change the oracle):

```text
$ git -C <clone> diff --stat 128c922 -- parity contracts bench .claude
[end diff]
$ git -C <clone> status --porcelain -- parity contracts bench .claude
[end status]
```

Raw outputs: `docs/evidence/PRICE-42/go-logs/seeded-halfup/ (and `go-logs/seeded-halfup-58f11eb/` for the first seeded commit)` (commands are the first line of each log; `check.log` lists every failing case).
No agent run: both seeded commits are human interventions by the orchestrator.

## SEEDED — what was changed, and what went red

This is a **seeded** defect, not a natural failure. The agent under test implemented ADR-007 half-even rounding correctly the first time the calculation slice ran the parity gate (#13, parity-go run 45238179177 green, `rounding-trap` 5/5 locally). After the Go stream converged at b7bd0a2 (merged in #17), the orchestrator created this branch from `origin/main` 69f021c:

| Seeded commit | Change (human intervention) | parity-go in Actions | Tag |
|---|---|---|---|
| 58f11eb | only the tie rule of `cents()` in `go/money.go`: half-even → half-up (`c >= 0`) | [run 45240621161](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45240621161): **red at `go test`** (the agent's own unit tests `TestCentsHalfEven` and `TestQuote/trap-*-tie-even` fail); the oracle steps are skipped | `price-42-go-seeded` |
| cd7267a | only the expected values of the tie cases in `go/money_test.go` (0.5, 2.5, -0.5, -2.5) and `go/quote_test.go` (`trap-cart-discount-tie-even`, `trap-line-discount-tie-even`, `trap-line-total-tie-even`) | [run 45240838007](https://github.com/koldovsky/2026-spd-shop-pricing/actions/runs/45240838007): `go test` passes, **red at `oracle check (all cases)`**: FAIL `quote-50-lines`, `trap-cart-discount-tie-even`, `trap-line-discount-tie-even`, `trap-line-total-tie-even` | `price-42-go-seeded-oracle` |

The second commit shows what happens when unit tests and code are wrong together (what an agent could do to its own tests): the oracle, which the agent cannot edit, still goes red. Locally, from the oracle checkout at 128c922, both seeded builds give the same oracle result: corpus 126/130, contract 125/125, black-box 15/16, diff seed 42 77/1000 and seed 7 75/1000 differ. This matches the half-up negative control in `oracle.md` (126/130, 77/1000, 15/16). The trap case: 5 x SKU-1 in EUR, cart discount 1348.5; expected 1348 (half-even), the seeded build answers 1349.

The PR (#19) is labelled `SEEDED DEFECT - do not merge` (GitHub limits label names to 50 characters, so the full sentence "SEEDED DEFECT — demo of the parity gate, not to be merged" is the label description and the PR title) and is closed without merging.

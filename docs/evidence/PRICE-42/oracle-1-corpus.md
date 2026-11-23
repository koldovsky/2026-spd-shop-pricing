# PRICE-42 oracle, slice 1: golden corpus — evidence

Verified revision: **2cb601aead9c670fa719a32bb4d53612a6060001** (`PRICE-42-oracle-corpus`). Only this evidence file changes after it.
Machine: Windows 11 Pro 10.0.26300, Intel Core Ultra 9 275HX (24 logical CPUs), Node v24.18.0, git 2.55.0.windows.2. Date: 2026-11-23.

Reference service: `PORT=8082 npm start` (tsx, `src/` unchanged: `git diff 25f3e2b 2cb601a -- src` is empty).

## 1. The recorder reproduces the committed corpus

```text
$ node parity/record.mjs --base http://localhost:8082 --out <scratchpad>/corpus-rerecord.json
recorded 136 cases (130 gating, 6 quirks) from http://localhost:8082 at 2cb601aead9c670fa719a32bb4d53612a6060001
statuses: 200=77 400=14 404=16 422=24 500=5
wrote .../corpus-rerecord.json (sha256 4a7105e502fe65ff84a4ee86fdf2dab09aa2855c6c26a6d6e9606a75c572d4fe)
[exit 0]
$ node -e "<compare the cases arrays of parity/corpus/corpus.json and the re-recorded file>"
committed: { total: 136, gating: 130, quirks: 6 } recordedFrom 25f3e2b
re-recorded at 2cb601a cases identical: true
[exit 0]
```

The two files differ only in `recordedFrom` (time and SHA). Committed corpus: `parity/corpus/corpus.json`,
sha256 `0211ef856e503d898ae2f689fc9ef827f4ba128bd647f9d0ab59eac3ca4ba37a` (LF line endings, pinned by `.gitattributes`).

The 5 responses with status 500 are all non-gating quirks (`currency=toString`, `__proto__`, `constructor`,
`lines: [null]`, a body over 100 kB); the sixth quirk is `GET /catalog/` answering 200. The recorder exits 1 if a
gating case returns 5xx.

## 2. Unit tests unchanged

```text
$ npm test
 Test Files  1 passed (1)
      Tests  7 passed (7)
[exit 0]
```

## 3. Diff size

```text
$ node ../2026-spd-shop-harness/ci/diff-size.mjs --base origin/main --head HEAD --fail 400
  excl.  parity/corpus/corpus.json (linguist-generated)
::warning::358 changed lines is above 200: consider splitting
diff-size gate: OK
```

Not verified in this slice: the replayer, differential tester and benchmark (later slices of PRICE-42).

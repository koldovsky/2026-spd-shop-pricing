# Evidence — PRICE-42 PR gates in shop-pricing

- Revision: `2da297bc90851eaad561029e98f0c00cb80f82f8` (the commands below ran on this commit)
- Branch: `PRICE-42-pr-gates`
- Ran: 2026-11-23T17:29Z · Node v24.18.0 · git version 2.55.0.windows.2 · MINGW64
- Who ran it: Claude Code (claude-opus-5-5), driven by the workshop author

Gate scripts from shop-harness v1.6.0 (a checkout at tag v1.6.0 next to this repo). The trace-gate run is expected to fail only because this file does not exist yet at the revision it ran on.

## `git -C ../harness describe --tags`

```text
v1.6.0
```

Exit code: 0

## `git show --stat --format="%H %s" HEAD`

```text
2da297bc90851eaad561029e98f0c00cb80f82f8 Run the shop-harness PR gates on every PR

 .github/workflows/pr-gates.yml | 17 +++++++++++++++++
 1 file changed, 17 insertions(+)
```

Exit code: 0

## `node ../harness/ci/diff-size.mjs --base origin/main --head HEAD`

```text
17 changed line(s) in 1 file(s); 0 file(s) excluded; warn > 200, fail > 400
     17  .github/workflows/pr-gates.yml
diff-size gate: OK
```

Exit code: 0

## `node ../harness/ci/trace-gate.mjs --base origin/main --head HEAD --title "PRICE-42 PR gates" --branch PRICE-42-pr-gates --key-pattern "PRICE-[0-9]+"`

```text
key PRICE-42 (from the PR title)
1 commit(s), 1 with Assisted-by
::error::evidence file docs/evidence/PRICE-42/pr-gates.md (from 2da297b) does not exist at head
trace gate: FAIL (1 error(s))
```

Exit code: 1


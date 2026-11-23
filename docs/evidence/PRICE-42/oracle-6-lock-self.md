# PRICE-42 oracle follow-up: the lock protects itself — evidence

Verified revision: **fb7a9e6fab4051fcb6fa174e01f58520e610f55e** (`PRICE-42-oracle-lock-self`). Only this evidence file changes after it.
Machine: Windows 11 Pro 10.0.26300, Node v24.18.0. Date: 2026-11-23.

Gap found in review of #7: the hook did not cover `.claude/settings.json` or `.claude/hooks/`, so an agent could
remove the lock for its next session. Now blocked (Edit/Write/... and obvious shell writes);
`.claude/settings.local.json` and `.claude/rules/` stay editable. All 45 payloads pass (41 earlier + 4 new):

```text
$ npm run hook:test
ok   exit=0 want=0 allow-edit-claude-rules.json             Edit: .claude/rules/api-errors.md
ok   exit=0 want=0 allow-write-settings-local.json          Write: .claude/settings.local.json
ok   exit=2 want=2 block-bash-rm-own-hook.json              Bash: rm .claude/hooks/protect-oracle.mjs
ok   exit=2 want=2 block-edit-own-settings.json             Edit: .claude/settings.json
45/45 payloads behaved as expected
[exit 0]
```

Spec change: the TS p95 spread is now quoted only from recorded files (5.22 ms in `bench-ts-rerun.json`,
5.64 ms in `bench/results/ts-baseline.json`). An earlier 4.55 ms run was console output only (see `oracle-4-bench.md`)
and is no longer cited as a source.

Not verified: a live `claude -p` run against the new self-protection rules (the live check in `oracle.md` covered
Edit on `parity/`).

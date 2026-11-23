#!/usr/bin/env node
// Tests the oracle-lock hook without a live Claude Code session (hook-test pattern: pipe a saved PreToolUse
// payload into the hook, check the exit code and stderr). Files named block-*.json must exit 2 with a reason,
// allow-*.json must exit 0. Placeholders for absolute paths of this checkout:
//   __PROJECT_DIR__ (D:\...\repo)  __PROJECT_DIR_UPPER__ (D:\...\REPO)  __PROJECT_DIR_POSIX__ (D:/.../repo)  __PROJECT_DIR_MSYS__ (/d/.../repo)
// Usage: node .claude/hooks/test-protect-oracle.mjs      (exit 1 if any payload gives the wrong result)
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..", "..");
const hook = join(here, "protect-oracle.mjs");
const payloads = join(here, "test-payloads");
const posix = project.replace(/\\/g, "/");
const subst = {
  __PROJECT_DIR_UPPER__: project.toUpperCase(),
  __PROJECT_DIR_POSIX__: posix,
  __PROJECT_DIR_MSYS__: posix.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`),
  __PROJECT_DIR__: project,
};
const esc = (s) => JSON.stringify(s).slice(1, -1);

let failed = 0;
const files = readdirSync(payloads).filter((f) => f.endsWith(".json")).sort();
for (const f of files) {
  let text = readFileSync(join(payloads, f), "utf8");
  for (const [k, v] of Object.entries(subst)) text = text.split(k).join(esc(v));
  const payload = { ...JSON.parse(text), cwd: project };
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: project } });
  const want = f.startsWith("block-") ? 2 : 0;
  const ok = r.status === want && (want === 0 || r.stderr.includes("Blocked by the PRICE-42 oracle lock"));
  if (!ok) failed++;
  const what = payload.tool_input.command ?? payload.tool_input.file_path ?? payload.tool_input.notebook_path;
  console.log(`${ok ? "ok  " : "FAIL"} exit=${r.status} want=${want} ${f.padEnd(40)} ${payload.tool_name}: ${what}${r.status === 2 ? `\n       stderr: ${r.stderr.trim().split(". parity/")[0]}` : ""}`);
}
console.log(`\n${files.length - failed}/${files.length} payloads behaved as expected`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
// Golden-corpus replayer (PRICE-42). Replays parity/corpus/corpus.json against ANY base URL and diffs each
// response with the recorded one. Exit 0 only when every gating case matches.
// Exit codes: 0 all gating cases pass · 1 at least one gating mismatch · 3 target unreachable · 64 usage.
// Usage: node parity/check.mjs --base http://localhost:8082 [--corpus <file>] [--json <report.json>] [--tag <tag>] [--show 20]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeAgent, compare, describe, parseArgs, requireUrl, send } from "./lib/http.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const base = requireUrl(args, "base", "node parity/check.mjs --base <url> [--corpus <file>] [--json <file>] [--tag <tag>] [--show <n>]");
const file = typeof args.corpus === "string" ? args.corpus : join(here, "corpus", "corpus.json");
const show = Number(args.show ?? 20);
const raw = readFileSync(file);
const corpus = JSON.parse(raw.toString("utf8"));
const selected = typeof args.tag === "string" ? corpus.cases.filter((c) => c.tags.includes(args.tag)) : corpus.cases;

console.log(`parity:check target=${base}`);
console.log(`corpus ${file} sha256=${createHash("sha256").update(raw).digest("hex").slice(0, 16)}… recorded from ${corpus.recordedFrom.base} at ${corpus.recordedFrom.serviceSha.slice(0, 12)}`);

const results = [];
for (const c of selected) {
  let actual;
  try {
    actual = await send(base, c.request);
  } catch (e) {
    console.error(`\nERROR: cannot reach ${base} (${e.code ?? e.message}) on case ${c.id}. Is the service running?`);
    process.exit(3);
  }
  results.push({ id: c.id, gate: c.gate, tags: c.tags, match: c.match, note: c.note, request: c.request, diffs: compare(c.response, actual, c.match), actualStatus: actual.status });
}
closeAgent();

const gating = results.filter((r) => r.gate);
const failed = gating.filter((r) => r.diffs.length);
const quirks = results.filter((r) => !r.gate);
const quirkDiff = quirks.filter((r) => r.diffs.length);

for (const r of failed.slice(0, show)) {
  console.log(`\nFAIL ${r.id}  [${r.tags.join(", ")}]${r.note ? `\n  note: ${r.note}` : ""}`);
  console.log(`  request: ${describe(r.request)}`);
  for (const d of r.diffs) console.log(`  - ${d}`);
}
if (failed.length > show) console.log(`\n… ${failed.length - show} more failing cases (use --show N or --json)`);
for (const r of quirkDiff) console.log(`\nquirk differs (not gating) ${r.id}: ${r.diffs.join("; ")}`);

const byTag = {};
for (const r of gating) for (const t of r.tags) { byTag[t] ??= [0, 0]; byTag[t][1]++; if (!r.diffs.length) byTag[t][0]++; }
const badTags = Object.entries(byTag).filter(([, [p, n]]) => p !== n).map(([t, [p, n]]) => `${t} ${p}/${n}`);
console.log(`\ngating: ${gating.length - failed.length}/${gating.length} passed${badTags.length ? ` (failing tags: ${badTags.join(", ")})` : ""}`);
console.log(`quirks (not gating): ${quirks.length - quirkDiff.length}/${quirks.length} same as reference`);
console.log(failed.length ? `RESULT: FAIL (${failed.length} gating mismatches)` : "RESULT: PASS");

if (typeof args.json === "string") {
  writeFileSync(args.json, JSON.stringify({ target: base, corpus: file, gating: { passed: gating.length - failed.length, total: gating.length }, quirks: { same: quirks.length - quirkDiff.length, total: quirks.length }, failures: failed, quirkDiffs: quirkDiff }, null, 2) + "\n");
}
process.exit(failed.length ? 1 : 0);

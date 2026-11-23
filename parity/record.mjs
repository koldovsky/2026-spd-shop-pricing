#!/usr/bin/env node
// Golden-corpus recorder (PRICE-42). Sends every case in parity/corpus/cases.mjs to the REFERENCE service
// and writes request + response pairs to parity/corpus/corpus.json.
// Record only from the TypeScript reference service. Recording from a candidate would make the oracle agree
// with whatever the candidate does; the PreToolUse hook blocks agents from running this script.
// Usage: node parity/record.mjs --base http://localhost:8082 [--out parity/corpus/corpus.json] [--sha <git sha>]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cases from "./corpus/cases.mjs";
import { closeAgent, parseArgs, requireUrl, send, toRecorded } from "./lib/http.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const base = requireUrl(args, "base", "node parity/record.mjs --base <reference-url> [--out <file>] [--sha <sha>]");
const out = typeof args.out === "string" ? args.out : join(here, "corpus", "corpus.json");
let sha = typeof args.sha === "string" ? args.sha : null;
if (!sha) { try { sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: here, encoding: "utf8" }).trim(); } catch { sha = "unknown"; } }

const ids = new Set();
const recorded = [];
const problems = [];
for (const c of cases) {
  if (ids.has(c.id)) throw new Error(`duplicate case id ${c.id}`);
  ids.add(c.id);
  const res = await send(base, c.request);
  if (c.gate && res.status >= 500) problems.push(`${c.id}: gating case returned ${res.status}`);
  recorded.push({ ...c, response: toRecorded(res) });
}
closeAgent();

const corpus = {
  about: "PRICE-42 golden corpus: request/response pairs recorded from the TypeScript reference service. Do not edit by hand; regenerate with parity/record.mjs against the reference.",
  recordedFrom: { base, serviceSha: sha, node: process.version, recordedAt: new Date().toISOString() },
  counts: { total: recorded.length, gating: recorded.filter((c) => c.gate).length, quirks: recorded.filter((c) => !c.gate).length },
  cases: recorded,
};
const text = JSON.stringify(corpus, null, 2) + "\n";
writeFileSync(out, text);
const byStatus = {};
for (const c of recorded) byStatus[c.response.status] = (byStatus[c.response.status] ?? 0) + 1;
console.log(`recorded ${recorded.length} cases (${corpus.counts.gating} gating, ${corpus.counts.quirks} quirks) from ${base} at ${sha}`);
console.log(`statuses: ${Object.entries(byStatus).map(([s, n]) => `${s}=${n}`).join(" ")}`);
console.log(`wrote ${out} (sha256 ${createHash("sha256").update(text).digest("hex")})`);
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

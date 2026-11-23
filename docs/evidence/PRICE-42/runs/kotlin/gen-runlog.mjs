// Generates docs/evidence/PRICE-42/kotlin-run-log.md from raw JSON, times.txt, prompts and meta/iterations.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const R = "D:/demo-s2/runs-kotlin";
const meta = JSON.parse(readFileSync(`${R}/meta/iterations.json`, "utf8"));
const times = Object.fromEntries(readFileSync(`${R}/times.txt`, "utf8").trim().split("\n").map((l) => {
  const [name, ...kv] = l.split(" "); return [name, Object.fromEntries(kv.map((x) => x.split("=")))];
}));
const out = [];
out.push(`# PRICE-42 Kotlin stream — run log`, ``,
  `Orchestrator: Claude Code (claude-opus-5-5) under the 23.11 permission. Agent under test: \`claude -p\` (claude-opus-5-5), cwd = the Kotlin clone, so the repo's \`.claude/settings.json\` hook and AGENTS.md load. Raw results: \`docs/evidence/PRICE-42/runs/kotlin/NN-<slice>.json\` (unmodified except: the committed copies are scanned for the user's email and home path, and any occurrence is replaced with \`<redacted>\` (list in \`runs/kotlin/REDACTED.txt\`; the agent wrote a probe script under the user's temp folder in iteration 04)). Prompts verbatim: \`runs/kotlin/prompts/\`.`, ``);
out.push(...meta.preamble, ``);
out.push(`## Iterations`, ``);
for (const it of meta.iterations) {
  const f = `${R}/${it.id}.json`; if (!existsSync(f)) continue;
  const j = JSON.parse(readFileSync(f, "utf8")); const t = times[it.id] ?? {};
  out.push(`### ${it.id} — ${it.title}`, ``,
    `- Start ${t.start} · end ${t.end} · wall-clock ${t.wall_s} s`,
    `- \`num_turns\` ${j.num_turns} · \`total_cost_usd\` ${j.total_cost_usd} · \`duration_ms\` ${j.duration_ms} · \`is_error\` ${j.is_error} (\`${j.subtype}\`) · permission denials ${(j.permission_denials ?? []).length}`,
    `- Result: ${it.summary}`,
    `- Oracle after it (orchestrator, oracle checkout): ${it.oracle}`,
    `- Interventions: ${it.interventions}`, ``,
    `Prompt (verbatim, \`runs/kotlin/prompts/${it.id}.txt\`):`, ``, "```text", readFileSync(`${R}/prompts/${it.id}.txt`, "utf8").trimEnd(), "```", ``);
}
out.push(...meta.postamble);
writeFileSync(process.argv[2], out.join("\n") + "\n");

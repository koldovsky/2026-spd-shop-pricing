// Sums the raw claude -p results of the Kotlin stream. Usage: node sum-runs.mjs <dir with NN-*.json>
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2] ?? ".";
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.json$/.test(f)).sort();
let cost = 0, turns = 0, ms = 0, apiMs = 0;
for (const f of files) {
  const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
  cost += j.total_cost_usd; turns += j.num_turns; ms += j.duration_ms; apiMs += j.duration_api_ms;
  console.log(`${f}\tturns=${j.num_turns}\tcost_usd=${j.total_cost_usd.toFixed(4)}\tduration_ms=${j.duration_ms}\tis_error=${j.is_error}\tsubtype=${j.subtype}\tdenials=${(j.permission_denials ?? []).length}`);
}
console.log(`TOTAL iterations=${files.length} turns=${turns} cost_usd=${cost.toFixed(4)} duration_ms=${ms} (${(ms / 60000).toFixed(1)} min) duration_api_ms=${apiMs}`);

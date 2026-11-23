// Sums num_turns, total_cost_usd, duration_ms and counts is_error over the raw claude -p JSON results.
// usage: node totals.mjs <dir-with-NN-*.json>
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2];
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.json$/.test(f)).sort();
let turns = 0, cost = 0, ms = 0, errors = 0;
for (const f of files) {
  const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
  turns += j.num_turns; cost += j.total_cost_usd; ms += j.duration_ms; if (j.is_error) errors++;
  console.log(`${f}\tturns=${j.num_turns}\tcost=${j.total_cost_usd.toFixed(4)}\tduration_ms=${j.duration_ms}\tis_error=${j.is_error}\tsubtype=${j.subtype}`);
}
console.log(`TOTAL iterations=${files.length} turns=${turns} cost_usd=${cost.toFixed(4)} duration_ms=${ms} (${(ms / 60000).toFixed(1)} min) is_error=${errors}`);

// Prints the benchmark table from the JSON files in this folder (median [min-max] over 3 repeats per file).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const keys = ["rps", "p50Ms", "p95Ms", "p99Ms", "peakRssMB", "coldStartMs"];
console.log(["| run", ...keys, "non-2xx", "errors |"].join(" | "));
console.log("|" + "---|".repeat(keys.length + 3));
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const s = j.summary;
  console.log(`| ${f.replace(".json", "")} (${j.config.cmd}) | ` + keys.map((k) => `${s[k].median} [${s[k].min}–${s[k].max}]`).join(" | ") + ` | ${s.totalNon2xx} | ${s.totalErrors} |`);
}

// node add-iter.mjs <id> <title> <summary> <oracle> <interventions>
import { readFileSync, writeFileSync } from "node:fs";
const p = "D:/demo-s2/runs-kotlin/meta/iterations.json";
const m = JSON.parse(readFileSync(p, "utf8"));
const [id, title, summary, oracle, interventions] = process.argv.slice(2);
m.iterations = m.iterations.filter((x) => x.id !== id);
m.iterations.push({ id, title, summary, oracle, interventions });
writeFileSync(p, JSON.stringify(m, null, 2));

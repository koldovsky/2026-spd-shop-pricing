// node redact.mjs <dir> <email>: replaces the user's home path and email with <redacted> in NN-*.json, appends REDACTED.txt
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const [dir, email] = process.argv.slice(2);
const pats = [/[A-Za-z]:(\\|\|\/)+Users(\\|\|\/)+koldo/gi, /\/[a-z]\/Users\/koldo/gi, new RegExp(email.replace(/[.+]/g, "\$&"), "gi")];
const log = [];
for (const f of readdirSync(dir).filter((x) => /^\d\d-.*\.json$/.test(x))) {
  let s = readFileSync(`${dir}/${f}`, "utf8"); let n = 0;
  for (const p of pats) s = s.replace(p, () => (n++, "<redacted>"));
  if (n) { writeFileSync(`${dir}/${f}`, s); log.push(`${f}: ${n} occurrence(s) of the user's home path or email replaced with <redacted>`); }
  if (/Users[\/]+koldo/i.test(s) || s.toLowerCase().includes(email.toLowerCase())) { console.error("STILL SENSITIVE", f); process.exit(9); }
}
writeFileSync(`${dir}/REDACTED.txt`, log.join("\n") + (log.length ? "\n" : "none\n"));
console.log(log.join("\n") || "nothing redacted");

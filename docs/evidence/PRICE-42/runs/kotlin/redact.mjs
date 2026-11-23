// node redact.mjs <dir> <email>: replaces the user's home path (os.homedir(), any slash style) and email with
// <redacted> in NN-*.json, and lists what it replaced in REDACTED.txt.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
const [dir, email] = process.argv.slice(2);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SEP = String.raw`(?:\\\\|\\|/)+`;
const parts = homedir().split(/[\\/]+/).filter(Boolean); // e.g. ["C:", "Users", "name"]
const drive = parts[0].replace(":", "");
const rest = parts.slice(1).map(esc).join(SEP);
const pats = [
  new RegExp(`${esc(drive)}:${SEP}${rest}`, "gi"), // C:\Users\name, C:\\Users\\name, C:/Users/name
  new RegExp(`/${esc(drive)}/${parts.slice(1).map(esc).join("/")}`, "gi"), // /c/Users/name
  new RegExp(esc(email), "gi"),
];
const tail = new RegExp(`${SEP}${parts.slice(1).map(esc).join(SEP)}`, "i");
const log = [];
for (const f of readdirSync(dir).filter((x) => /^\d\d-.*\.json$/.test(x))) {
  let s = readFileSync(`${dir}/${f}`, "utf8");
  let n = 0;
  for (const p of pats) s = s.replace(p, () => (n++, "<redacted>"));
  if (n) {
    writeFileSync(`${dir}/${f}`, s);
    log.push(`${f}: ${n} occurrence(s) of the user's home path or email replaced with <redacted>`);
  }
  if (tail.test(s) || s.toLowerCase().includes(email.toLowerCase())) {
    console.error("STILL SENSITIVE", f);
    process.exit(9);
  }
}
writeFileSync(`${dir}/REDACTED.txt`, log.join("\n") + (log.length ? "\n" : "none\n"));
console.log(log.join("\n") || "nothing redacted");

#!/usr/bin/env node
// PreToolUse hook: the PRICE-42 oracle lock. Blocks agent writes into the top-level parity/, contracts/ and bench/
// folders of this repo (golden corpus, OpenAPI contract, differential/black-box tests, benchmark and its baseline).
// - Edit / Write / MultiEdit / NotebookEdit: resolves file_path / notebook_path (relative, absolute Windows,
//   forward-slash, Git Bash /d/..., any letter case, "..") against the project and blocks protected targets.
// - Bash / PowerShell: blocks OBVIOUS writes only (redirection, rm/mv/cp/tee/sed -i/Set-Content/..., --out into the
//   folders, inline node/python file writes, and any run of the corpus recorder). It is a guard rail, not a sandbox.
// The lock also protects itself: .claude/settings.json and .claude/hooks/ are blocked the same way.
// Exit 2 + stderr = blocked (Claude Code shows the reason to the agent). Exit 0 = allowed.
// owner: @koldovsky · why: an agent must not be able to change the oracle that judges it (PRICE-42) · review-by: 2027-02-19
import { appendFileSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const PROTECTED = ["parity", "contracts", "bench"];
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};

/** Lower-case, forward slashes, no \\?\ prefix, Git Bash /d/ and WSL /mnt/d/ turned into d:/ . */
function canon(p) {
  let s = String(p).replace(/^\\\\\?\\/, "").replace(/\\/g, "/");
  const msys = s.match(/^\/(?:mnt\/)?([a-zA-Z])(\/.*)?$/);
  if (msys && /^[a-zA-Z]:/.test(projectDir)) s = `${msys[1]}:${msys[2] ?? "/"}`;
  return s.toLowerCase();
}
const project = canon(resolve(projectDir)).replace(/\/+$/, "");
const cwd = input.cwd ? canon(resolve(input.cwd)) : project;

/** Protected top-level folder a file path falls into, or null. */
function protectedFolder(filePath) {
  let p = canon(filePath);
  if (!/^[a-z]:\//.test(p) && !p.startsWith("/")) p = canon(resolve(isAbsolute(input.cwd ?? "") ? input.cwd : projectDir, filePath));
  else p = canon(resolve(p));
  if (p !== project && !p.startsWith(project + "/")) return null; // outside this repo
  const rel = p.slice(project.length + 1);
  if (/^\.claude\/(settings\.json$|hooks(\/|$))/.test(rel)) return ".claude"; // the lock protects itself
  const first = rel.split("/")[0];
  return PROTECTED.includes(first) ? first : null;
}

function block(reason) {
  try { appendFileSync(join(projectDir, ".claude/hooks/protect-oracle.log"), `${new Date().toISOString()} BLOCK ${tool} ${reason}\n`); } catch { /* logging is best effort */ }
  process.stderr.write(`Blocked by the PRICE-42 oracle lock: ${reason}. parity/, contracts/ and bench/ are the oracle that judges this change; agents may run them but not change them. If the oracle is wrong, stop and ask a human (separate PR, CODEOWNERS review).\n`);
  process.exit(2);
}

// ---------------------------------------------------------------- file tools
if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const target = ti.file_path ?? ti.notebook_path;
  if (!target) process.exit(0);
  const hit = protectedFolder(target);
  if (hit) block(`${tool} on ${target} is inside ${hit}/`);
  process.exit(0);
}

// ---------------------------------------------------------------- shell tools
if (tool === "Bash" || tool === "PowerShell") {
  let cmd = canon(ti.command ?? "");
  // Absolute references to this repo become relative ("./parity/...").
  const msysProject = project.replace(/^([a-z]):/, "/$1");
  for (const p of [project, msysProject, `/mnt${msysProject}`]) cmd = cmd.split(p + "/").join("./");

  const NAME = `(?:\\./)?(${PROTECTED.join("|")}|\\.claude/settings\\.json|\\.claude/hooks)`;
  const REF = new RegExp(`(^|[\\s"'=(,<>])${NAME}(?:/|(?=[\\s"';|&)<>]|$))`);
  const refIn = (s) => REF.test(s);
  const cwdRel = cwd.startsWith(project + "/") ? cwd.slice(project.length + 1).split("/")[0] : null;

  if (/parity:record|\bnode(?:\.exe)?\s+["']?[^\s"']*record\.mjs/.test(cmd)) block("the corpus recorder rewrites parity/corpus/corpus.json (record only from the TS reference, by a human)");
  if (new RegExp(`>{1,2}\\s*["']?${NAME}/`).test(cmd)) block("shell redirection into a protected folder");
  if (new RegExp(`(?:--out|--json|--output|-o)(?:=|\\s+)["']?${NAME}/`).test(cmd)) block("an output flag points into a protected folder");

  const WRITE_VERBS = new Set(["rm", "rmdir", "mv", "touch", "mkdir", "tee", "truncate", "dd", "ln", "chmod", "chown", "install", "rsync", "unlink", "patch", "shred",
    "set-content", "add-content", "out-file", "new-item", "remove-item", "move-item", "rename-item", "clear-content", "ni", "ri", "del", "erase", "move", "ren", "rd", "sc", "ac"]);
  const COPY_VERBS = new Set(["cp", "copy", "copy-item", "xcopy", "robocopy", "cpi"]);
  const INTERPRETERS = new Set(["node", "python", "python3", "py", "perl", "ruby", "deno", "bun", "pwsh", "powershell"]);
  const SKIP = new Set(["sudo", "command", "xargs", "env", "time", "nohup", "exec", "&", "."]);
  let inProtected = cwdRel && PROTECTED.includes(cwdRel);

  for (const seg of cmd.split(/&&|\|\||[;|\n]/)) {
    const toks = (seg.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((t) => t.replace(/^["']|["']$/g, ""));
    let i = 0;
    while (i < toks.length && (SKIP.has(toks[i]) || /^[a-z_][a-z0-9_]*=/.test(toks[i]))) i++;
    const verb = (toks[i] ?? "").split("/").pop().replace(/\.exe$/, "");
    const args = toks.slice(i + 1);
    if (["cd", "pushd", "set-location", "sl", "chdir"].includes(verb)) {
      const dest = args.find((a) => !a.startsWith("-"));
      if (dest) inProtected = protectedFolder(dest) !== null || (inProtected && !dest.startsWith("/") && !/^[a-z]:/.test(dest) && !dest.startsWith(".."));
      continue;
    }
    const touches = refIn(seg) || inProtected;
    if (!touches) continue;
    if (WRITE_VERBS.has(verb)) block(`"${verb}" on a protected folder`);
    if ((verb === "sed" || verb === "perl") && args.some((a) => /^-[a-z]*i/.test(a) || a === "--in-place")) block(`in-place "${verb}" on a protected folder`);
    if (verb === "git" && /^(checkout|restore|rm|mv|clean|reset|apply|stash|am|cherry-pick|revert)$/.test(args[0] ?? "")) block(`"git ${args[0]}" on a protected folder`);
    if (verb === "find" && args.some((a) => a === "-delete" || a === "-exec" || a === "-execdir")) block(`"find -delete/-exec" on a protected folder`);
    if (COPY_VERBS.has(verb)) {
      const di = args.findIndex((a) => a === "-destination");
      const dest = di >= 0 ? args[di + 1] : args.filter((a) => !a.startsWith("-")).pop();
      if (inProtected || (dest && refIn(" " + dest))) block(`"${verb}" into a protected folder`);
    }
    if (INTERPRETERS.has(verb) && /writefile|appendfile|createwritestream|rmsync|rmdirsync|unlinksync|renamesync|copyfile|cpsync|write_text|write_bytes|shutil\.|os\.remove|open\([^)]*['"][wa]|set-content|out-file/.test(seg)) block(`inline ${verb} code writes to a protected folder`);
  }
  process.exit(0);
}

process.exit(0);

#!/usr/bin/env node
// Contract conformance check (PRICE-42). Sends every gating corpus request to ANY base URL and validates the
// response against contracts/openapi.yaml: the status code must be declared for the operation, the media type
// must match, and the JSON body must satisfy the declared schema. Run against the TS reference it proves the
// contract describes real behaviour; run against a candidate it proves conformance (parity/check.mjs is stricter).
// Exit codes: 0 conforms · 1 violations · 3 target unreachable · 64 usage.
// Usage: node parity/contract.mjs --base http://localhost:8082
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { closeAgent, describe, parseArgs, requireUrl, send } from "./lib/http.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const base = requireUrl(parseArgs(), "base", "node parity/contract.mjs --base <url>");
const spec = YAML.parse(readFileSync(join(here, "..", "contracts", "openapi.yaml"), "utf8"));
const corpus = JSON.parse(readFileSync(join(here, "corpus", "corpus.json"), "utf8"));

const deref = (s) => (s?.$ref ? deref(s.$ref.replace(/^#\//, "").split("/").reduce((o, k) => o[k], spec)) : s);

/** Minimal JSON-schema check for the keywords this contract uses. */
function validate(schema, v, path, out) {
  const s = deref(schema);
  if (!s) return;
  const t = Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v;
  if (s.type && !(s.type === t || (s.type === "number" && t === "integer"))) return void out.push(`${path}: expected ${s.type}, got ${t}`);
  if (s.enum && !s.enum.includes(v)) out.push(`${path}: ${JSON.stringify(v)} not in ${JSON.stringify(s.enum)}`);
  if (s.minimum !== undefined && v < s.minimum) out.push(`${path}: ${v} < minimum ${s.minimum}`);
  if (s.maximum !== undefined && v > s.maximum) out.push(`${path}: ${v} > maximum ${s.maximum}`);
  if (s.minLength !== undefined && typeof v === "string" && v.length < s.minLength) out.push(`${path}: shorter than ${s.minLength}`);
  if (t === "array") {
    if (s.minItems !== undefined && v.length < s.minItems) out.push(`${path}: fewer than ${s.minItems} items`);
    v.forEach((x, i) => validate(s.items, x, `${path}[${i}]`, out));
  }
  if (t === "object") {
    for (const k of s.required ?? []) if (!(k in v)) out.push(`${path}.${k}: required`);
    for (const [k, x] of Object.entries(v)) {
      if (s.properties?.[k]) validate(s.properties[k], x, `${path}.${k}`, out);
      else if (s.additionalProperties === false) out.push(`${path}.${k}: not allowed by the schema`);
    }
  }
}

function operation(method, rawPath) {
  const p = rawPath.split("?")[0];
  for (const [tpl, ops] of Object.entries(spec.paths)) {
    const re = new RegExp(`^${tpl.replace(/\{[^}]+\}/g, "[^/]+")}$`);
    if (re.test(p) && ops[method.toLowerCase()]) return { tpl, op: ops[method.toLowerCase()] };
  }
  return null;
}

console.log(`contract target=${base} spec=contracts/openapi.yaml (${spec.info.title} ${spec.info.version})`);
const gating = corpus.cases.filter((c) => c.gate && c.match !== "status");
const failures = [];
for (const c of gating) {
  const found = operation(c.request.method, c.request.path);
  if (!found) { failures.push({ c, problems: [`no operation in the contract for ${c.request.method} ${c.request.path}`] }); continue; }
  let res;
  try { res = await send(base, c.request); } catch (e) { console.error(`ERROR: cannot reach ${base} (${e.code ?? e.message})`); process.exit(3); }
  const problems = [];
  const declared = found.op.responses[String(res.status)];
  if (!declared) problems.push(`status ${res.status} is not declared for ${c.request.method} ${found.tpl} (declared: ${Object.keys(found.op.responses).join(", ")})`);
  else {
    const media = declared.content?.[res.contentType];
    if (!media) problems.push(`media type ${res.contentType || "<none>"} not declared for ${res.status}`);
    else {
      let body;
      try { body = JSON.parse(res.text); } catch { problems.push("body is not JSON"); }
      if (body !== undefined) validate(media.schema, body, "$", problems);
    }
  }
  if (problems.length) failures.push({ c, problems });
}
closeAgent();
for (const { c, problems } of failures.slice(0, 20)) {
  console.log(`\nVIOLATION ${c.id}\n  request: ${describe(c.request)}`);
  for (const p of problems) console.log(`  - ${p}`);
}
console.log(`\ncontract: ${gating.length - failures.length}/${gating.length} gating corpus requests conform (status-only cases excluded)`);
console.log(failures.length ? `RESULT: FAIL (${failures.length} violations)` : "RESULT: PASS");
process.exit(failures.length ? 1 : 0);

// Shared helpers for the PRICE-42 oracle: argument parsing, raw HTTP calls and response comparison.
// Dependency-free on purpose (node:http only), so the oracle does not depend on the service it judges.
import http from "node:http";

/** Parses `--key value` and `--flag` arguments. Values never default to a base URL. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, inline] = a.slice(2).split("=", 2);
    if (inline !== undefined) out[k] = inline;
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

/** Exits with a usage error unless the named option is a valid http(s) URL. */
export function requireUrl(args, name, usage) {
  const v = args[name];
  if (typeof v !== "string" || !/^https?:\/\/[^/]+/.test(v)) {
    process.stderr.write(`error: --${name} <url> is required (no default, so a check never silently hits the wrong service)\nusage: ${usage}\n`);
    process.exit(64);
  }
  return v.replace(/\/+$/, "");
}

const agent = new http.Agent({ keepAlive: true, maxSockets: 16 });

/**
 * Sends one request exactly as described. `req.path` is sent raw (no re-encoding).
 * `req.json` is serialised with JSON.stringify; `req.body` is sent as a raw string.
 */
export function send(base, req, timeoutMs = 10000) {
  const url = new URL(base);
  const body = req.json !== undefined ? JSON.stringify(req.json) : req.body ?? null;
  const headers = { ...(req.headers ?? {}) };
  if (body !== null) headers["content-length"] = Buffer.byteLength(body);
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const r = http.request(
      { host: url.hostname, port: url.port || 80, method: req.method, path: req.path, headers, agent, timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({
          status: res.statusCode,
          contentType: mediaType(res.headers["content-type"]),
          text: Buffer.concat(chunks).toString("utf8"),
          ms: Number(process.hrtime.bigint() - t0) / 1e6,
        }));
      },
    );
    r.on("timeout", () => r.destroy(new Error(`timeout after ${timeoutMs} ms: ${req.method} ${req.path}`)));
    r.on("error", reject);
    if (body !== null) r.write(body);
    r.end();
  });
}

export const mediaType = (ct) => (ct ?? "").split(";")[0].trim().toLowerCase();

/** Turns a raw response into the stored corpus form. */
export function toRecorded(res) {
  const out = { status: res.status, contentType: res.contentType };
  if (res.contentType === "application/json") {
    try { out.json = JSON.parse(res.text); return out; } catch { /* fall through to text */ }
  }
  out.text = res.text;
  return out;
}

/** Number literals in a JSON text (outside strings). */
function numberLiterals(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === "\\") i++; continue; }
    if (c === "-" || (c >= "0" && c <= "9")) {
      let j = i;
      while (j < text.length && /[-+0-9.eE]/.test(text[j])) j++;
      out.push(text.slice(i, j));
      i = j - 1;
    }
  }
  return out;
}

const fmt = (v) => (v === undefined ? "<missing>" : JSON.stringify(v));

function deepDiff(exp, act, path, out) {
  if (out.length >= 20) return;
  const te = Array.isArray(exp) ? "array" : exp === null ? "null" : typeof exp;
  const ta = Array.isArray(act) ? "array" : act === null ? "null" : typeof act;
  if (te !== ta) return void out.push(`${path}: expected ${te} ${fmt(exp)}, got ${ta} ${fmt(act)}`);
  if (te === "array") {
    if (exp.length !== act.length) out.push(`${path}: expected ${exp.length} items, got ${act.length}`);
    for (let i = 0; i < Math.min(exp.length, act.length); i++) deepDiff(exp[i], act[i], `${path}[${i}]`, out);
    return;
  }
  if (te === "object") {
    for (const k of Object.keys(exp)) {
      if (!(k in act)) out.push(`${path}.${k}: missing (expected ${fmt(exp[k])})`);
      else deepDiff(exp[k], act[k], `${path}.${k}`, out);
    }
    for (const k of Object.keys(act)) if (!(k in exp)) out.push(`${path}.${k}: unexpected key (got ${fmt(act[k])})`);
    return;
  }
  if (exp !== act) out.push(`${path}: expected ${fmt(exp)}, got ${fmt(act)}`);
}

/**
 * Compares an expected (recorded) response with an actual raw response.
 * match "full": status, media type, JSON body (key order ignored, array order kept), integer-only number literals.
 * match "status": status only (used for the framework's HTML 404 pages, which are not part of the contract).
 * Returns a list of human-readable differences; empty means equal.
 */
export function compare(expected, actual, match = "full") {
  const d = [];
  if (expected.status !== actual.status) d.push(`status: expected ${expected.status}, got ${actual.status}`);
  if (match === "status") return d;
  if (expected.contentType !== actual.contentType) d.push(`content-type: expected ${fmt(expected.contentType)}, got ${fmt(actual.contentType)}`);
  if (match === "error-shape") {
    let parsed;
    try { parsed = JSON.parse(actual.text); } catch { d.push(`body: expected JSON { "error": string }, got ${fmt(actual.text.slice(0, 200))}`); return d; }
    const ok = parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 1 && typeof parsed.error === "string" && parsed.error.length > 0;
    if (!ok) d.push(`body: expected exactly { "error": <non-empty string> }, got ${fmt(parsed)}`);
    return d;
  }
  if ("json" in expected) {
    let parsed;
    try { parsed = JSON.parse(actual.text); } catch { d.push(`body: expected JSON, got ${fmt(actual.text.slice(0, 200))}`); return d; }
    deepDiff(expected.json, parsed, "$", d);
    const bad = numberLiterals(actual.text).filter((n) => /[.eE]/.test(n));
    if (bad.length) d.push(`body: non-integer number literal(s) ${bad.slice(0, 5).join(", ")} (money and quantities are integer literals)`);
  } else if (expected.text !== actual.text) {
    d.push(`body: expected ${fmt(expected.text.slice(0, 200))}, got ${fmt(actual.text.slice(0, 200))}`);
  }
  return d;
}

/** One-line description of a request for reports. */
export function describe(req) {
  const body = req.json !== undefined ? JSON.stringify(req.json) : req.body;
  const ct = req.headers?.["content-type"];
  return `${req.method} ${req.path}${ct ? ` [${ct}]` : ""}${body != null ? ` ${body.length > 160 ? body.slice(0, 160) + "…" : body}` : ""}`;
}

export function closeAgent() { agent.destroy(); }

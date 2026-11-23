#!/usr/bin/env node
// PRICE-42 load benchmark. Dependency-free (node:http + worker_threads), native processes, no containers.
// Per repeat: start the server (--cmd) -> cold start (spawn to first 200 on GET /catalog) -> warm-up -> fixed
// closed-loop load (C keep-alive connections, seeded request mix) -> peak RSS of the process listening on the port
// (OS peak working set on Windows, VmHWM on Linux) -> stop the process tree. Repeats 3 times by default.
// Exit 1 if any request failed or returned non-2xx, so a broken server cannot produce a "fast" result.
//
// Usage (spawned, measures cold start and RSS):
//   node bench/run.mjs --label ts --cmd "node dist/server.js" [--port 8090] [--repeats 3] [--warmup 5] [--duration 20]
//                      [--connections 64] [--client-workers 8] [--seed 42] [--out <file.json>]
// Usage (already running server; cold start not measured, RSS only if it listens on this machine):
//   node bench/run.mjs --label x --base http://localhost:8082 [...]
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

// ---------------------------------------------------------------- load generator (worker thread)
const MIX = { catalog: 0.2, prices: 0.3, quote: 0.5 };

function buildPool(seed, size = 1000) {
  let a = seed;
  const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const SKUS = ["SKU-1", "SKU-2", "SKU-3", "SKU-4", "SKU-5"], CUR = ["EUR", "USD", "UAH"];
  const pool = [];
  for (let i = 0; i < size; i++) {
    const r = rnd();
    if (r < MIX.catalog) pool.push({ method: "GET", path: "/catalog", body: null });
    else if (r < MIX.catalog + MIX.prices) pool.push({ method: "GET", path: `/prices/${pick(SKUS)}?currency=${pick(CUR)}`, body: null });
    else {
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({ sku: pick(SKUS), quantity: 1 + Math.floor(rnd() * 100) }));
      pool.push({ method: "POST", path: "/quote", body: JSON.stringify({ currency: pick(CUR), lines }) });
    }
  }
  return pool;
}

async function loadWorker({ host, port, connections, seed, offset, warmupMs, durationMs }) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: connections });
  const pool = buildPool(seed);
  const call = (req) => new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const headers = req.body ? { "content-type": "application/json", "content-length": Buffer.byteLength(req.body) } : {};
    const r = http.request({ host, port, method: req.method, path: req.path, agent, headers }, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve({ status: res.statusCode, us: Number(process.hrtime.bigint() - t0) / 1000 }));
    });
    r.on("error", () => resolve({ status: 0, us: Number(process.hrtime.bigint() - t0) / 1000 }));
    if (req.body) r.write(req.body);
    r.end();
  });
  async function phase(ms, record) {
    const lat = [];
    let non2xx = 0, errors = 0, idx = offset;
    const end = performance.now() + ms;
    const t0 = performance.now();
    await Promise.all(Array.from({ length: connections }, async () => {
      while (performance.now() < end) {
        const res = await call(pool[idx++ % pool.length]);
        if (!record) continue;
        if (res.status === 0) errors++; else if (res.status < 200 || res.status > 299) non2xx++;
        lat.push(res.us);
      }
    }));
    return { lat, non2xx, errors, elapsedMs: performance.now() - t0 };
  }
  await phase(warmupMs, false);
  const r = await phase(durationMs, true);
  agent.destroy();
  return r;
}

// ---------------------------------------------------------------- orchestration (main thread)
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2);
    out[k] = i + 1 < argv.length && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return out;
}
const splitCmd = (s) => (s.match(/"[^"]*"|\S+/g) ?? []).map((t) => t.replace(/^"|"$/g, ""));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

function portOpen(host, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => resolve(false));
  });
}

function firstOk(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const r = http.get({ host, port, path: "/catalog", agent: false, timeout: timeoutMs }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode === 200)); });
    r.on("error", () => resolve(false));
    r.on("timeout", () => { r.destroy(); resolve(false); });
  });
}

/** PID of the process listening on the port (the real server, not a wrapper such as npm or a launcher script). */
function listenerPid(port) {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        const f = line.trim().split(/\s+/);
        if (f[0] === "TCP" && f[3] === "LISTENING" && f[1].endsWith(`:${port}`)) return Number(f[4]);
      }
    } else {
      const out = execFileSync("sh", ["-c", `ss -ltnpH 'sport = :${port}' 2>/dev/null || lsof -nP -iTCP:${port} -sTCP:LISTEN -t`], { encoding: "utf8" });
      const m = out.match(/pid=(\d+)/) ?? out.match(/^(\d+)/m);
      if (m) return Number(m[1]);
    }
  } catch { /* fall through */ }
  return null;
}

/** OS-reported peak and current resident memory of a process, in MB. */
function memoryOf(pid) {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$p = Get-Process -Id ${pid}; "$($p.PeakWorkingSet64) $($p.WorkingSet64) $($p.ProcessName)"`], { encoding: "utf8" }).trim();
      const [peak, cur, name] = out.split(/\s+/);
      return { peakRssMB: Number(peak) / 2 ** 20, rssMB: Number(cur) / 2 ** 20, processName: name, source: "Get-Process PeakWorkingSet64/WorkingSet64" };
    }
    if (process.platform === "linux") {
      const st = readFileSync(`/proc/${pid}/status`, "utf8");
      const kb = (k) => Number(st.match(new RegExp(`${k}:\\s+(\\d+)`))[1]);
      return { peakRssMB: kb("VmHWM") / 1024, rssMB: kb("VmRSS") / 1024, processName: st.match(/Name:\s+(\S+)/)[1], source: "/proc/<pid>/status VmHWM/VmRSS" };
    }
  } catch { /* fall through */ }
  return { peakRssMB: null, rssMB: null, processName: null, source: "not measured" };
}

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch { /* already gone */ }
}

function runLoad(host, port, cfg) {
  const per = Math.floor(cfg.connections / cfg.clientWorkers);
  return Promise.all(Array.from({ length: cfg.clientWorkers }, (_, w) => new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { host, port, connections: per + (w < cfg.connections % cfg.clientWorkers ? 1 : 0), seed: cfg.seed, offset: w * 137, warmupMs: cfg.warmupS * 1000, durationMs: cfg.durationS * 1000 } });
    worker.once("message", resolve);
    worker.once("error", reject);
  })));
}

function gitSha() { try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return "unknown"; } }

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const usage = 'node bench/run.mjs --label <name> (--cmd "<server command>" [--port 8090] | --base <url>) [--repeats 3] [--warmup 5] [--duration 20] [--connections 64] [--client-workers 8] [--seed 42] [--out <file>]';
  if (typeof a.label !== "string" || (typeof a.cmd !== "string") === (typeof a.base !== "string")) { console.error(`error: --label and exactly one of --cmd / --base are required\nusage: ${usage}`); process.exit(64); }
  const cfg = {
    cmd: a.cmd ?? null, base: a.base ?? null, cwd: a.cwd ?? process.cwd(),
    port: Number(a.port ?? (a.base ? new URL(a.base).port || 80 : 8090)),
    repeats: Number(a.repeats ?? 3), warmupS: Number(a.warmup ?? 5), durationS: Number(a.duration ?? 20),
    connections: Number(a.connections ?? 64), clientWorkers: Number(a["client-workers"] ?? 8), seed: Number(a.seed ?? 42),
  };
  const host = a.base ? new URL(a.base).hostname : "127.0.0.1";
  const cpus = os.cpus();
  const result = {
    label: a.label,
    startedAt: new Date().toISOString(),
    gitSha: gitSha(),
    machine: { os: `${os.type()} ${os.release()}`, platform: process.platform, arch: os.arch(), cpuModel: cpus[0]?.model.trim(), logicalCpus: cpus.length, totalMemGB: r2(os.totalmem() / 2 ** 30), freeMemGBAtStart: r2(os.freemem() / 2 ** 30), node: process.version, otherLoad: "not controlled (desktop machine; client and server share the CPU)" },
    config: { ...cfg, mix: MIX, loadModel: "closed loop: each connection sends the next request as soon as the previous response ends; keep-alive", requestPool: "1000 seeded requests (mulberry32), quotes have 1-5 lines with quantity 1..100", coldStart: cfg.cmd ? "spawn() to first HTTP 200 on GET /catalog, polled every 5 ms" : "not measured (--base)" },
    runs: [],
  };
  console.log(`bench ${a.label}: ${cfg.cmd ? `cmd="${cfg.cmd}" port=${cfg.port}` : `base=${cfg.base}`} repeats=${cfg.repeats} warmup=${cfg.warmupS}s duration=${cfg.durationS}s connections=${cfg.connections} client-workers=${cfg.clientWorkers}`);

  let failed = false;
  for (let i = 1; i <= cfg.repeats; i++) {
    let child = null, coldStartMs = null;
    if (cfg.cmd) {
      if (await portOpen(host, cfg.port)) { console.error(`error: something already listens on ${host}:${cfg.port}; stop it first (the bench must measure the process it starts)`); process.exit(2); }
      const [exe, ...argv] = splitCmd(cfg.cmd);
      const t0 = performance.now();
      child = spawn(exe, argv, { cwd: cfg.cwd, env: { ...process.env, PORT: String(cfg.port) }, stdio: "ignore", detached: process.platform !== "win32", windowsHide: true });
      let exited = false;
      child.once("exit", () => { exited = true; });
      while (!(await firstOk(host, cfg.port, 1000))) {
        if (exited) { console.error(`error: server process exited before serving (cmd: ${cfg.cmd})`); process.exit(2); }
        if (performance.now() - t0 > 120000) { console.error("error: no 200 within 120 s"); killTree(child.pid); process.exit(2); }
        await sleep(5);
      }
      coldStartMs = performance.now() - t0;
    }
    const pid = listenerPid(cfg.port);
    const parts = await runLoad(host, cfg.port, cfg);
    const mem = pid ? memoryOf(pid) : { peakRssMB: null, rssMB: null, processName: null, source: "not measured (no local listener found)" };
    if (child) {
      killTree(child.pid);
      if (pid && pid !== child.pid) killTree(pid);
      for (let k = 0; k < 200 && (await portOpen(host, cfg.port)); k++) await sleep(25);
    }
    const lat = new Float64Array(parts.reduce((n, p) => n + p.lat.length, 0));
    let o = 0;
    for (const p of parts) { lat.set(p.lat, o); o += p.lat.length; }
    lat.sort();
    const elapsed = Math.max(...parts.map((p) => p.elapsedMs)) / 1000;
    const non2xx = parts.reduce((n, p) => n + p.non2xx, 0), errors = parts.reduce((n, p) => n + p.errors, 0);
    const run = {
      repeat: i, coldStartMs: r2(coldStartMs), serverPid: pid, serverProcess: mem.processName,
      requests: lat.length, rps: r2(lat.length / elapsed), non2xx, errors,
      latencyMs: { p50: r2(pct(lat, 50) / 1000), p95: r2(pct(lat, 95) / 1000), p99: r2(pct(lat, 99) / 1000), max: r2(lat[lat.length - 1] / 1000), mean: r2(lat.reduce((s, x) => s + x, 0) / lat.length / 1000) },
      peakRssMB: r2(mem.peakRssMB), rssAfterLoadMB: r2(mem.rssMB), memorySource: mem.source,
    };
    if (non2xx || errors) failed = true;
    result.runs.push(run);
    console.log(`  run ${i}: cold=${run.coldStartMs ?? "n/a"} ms rps=${run.rps} p50=${run.latencyMs.p50} p95=${run.latencyMs.p95} p99=${run.latencyMs.p99} ms peakRSS=${run.peakRssMB ?? "n/a"} MB requests=${run.requests} non2xx=${non2xx} errors=${errors}`);
  }
  const pick = (f) => result.runs.map(f).filter((x) => x != null);
  const agg = (f) => { const xs = pick(f); return xs.length ? { median: r2(median(xs)), min: r2(Math.min(...xs)), max: r2(Math.max(...xs)) } : "not measured"; };
  result.summary = {
    note: `median / min / max over ${result.runs.length} repeats`,
    rps: agg((r) => r.rps), p50Ms: agg((r) => r.latencyMs.p50), p95Ms: agg((r) => r.latencyMs.p95), p99Ms: agg((r) => r.latencyMs.p99),
    peakRssMB: agg((r) => r.peakRssMB), coldStartMs: agg((r) => r.coldStartMs),
    totalNon2xx: result.runs.reduce((n, r) => n + r.non2xx, 0), totalErrors: result.runs.reduce((n, r) => n + r.errors, 0),
  };
  const s = result.summary;
  console.log(`summary (median of ${result.runs.length}): rps=${s.rps.median} p50=${s.p50Ms.median} p95=${s.p95Ms.median} p99=${s.p99Ms.median} ms peakRSS=${s.peakRssMB.median ?? "n/a"} MB cold=${s.coldStartMs.median ?? "n/a"} ms`);
  if (typeof a.out === "string") { writeFileSync(a.out, JSON.stringify(result, null, 2) + "\n"); console.log(`wrote ${a.out}`); }
  if (failed) { console.error("RESULT: FAIL (non-2xx responses or transport errors during load)"); process.exit(1); }
}

// Entry point (last, so every top-level const above is initialised).
if (!isMainThread) loadWorker(workerData).then((r) => parentPort.postMessage(r));
else await main();

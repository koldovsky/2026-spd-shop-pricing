#!/usr/bin/env node
// Runs the black-box HTTP suite against any base URL. Exit code is node:test's (0 = all passed).
// Usage: node parity/blackbox/run.mjs --base http://localhost:8082
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, requireUrl } from "../lib/http.mjs";

const base = requireUrl(parseArgs(), "base", "node parity/blackbox/run.mjs --base <url>");
console.log(`blackbox target=${base}`);
const file = join(dirname(fileURLToPath(import.meta.url)), "http-suite.mjs");
const r = spawnSync(process.execPath, ["--test", "--test-reporter=spec", file], { stdio: "inherit", env: { ...process.env, PARITY_BASE: base } });
process.exit(r.status ?? 1);

// Calibration target for bench/run.mjs: 8 Node processes that answer every request with a tiny fixed JSON body.
// It does no pricing work, so its RPS approximates the load generator's ceiling on this machine.
// If a candidate's RPS gets close to this number, the result is bounded by the client, not by the candidate.
// Usage: node bench/run.mjs --label client-ceiling --cmd "node bench/null-server.mjs"
import cluster from "node:cluster";
import http from "node:http";

if (cluster.isPrimary) {
  for (let i = 0; i < 8; i++) cluster.fork();
} else {
  const body = JSON.stringify([{ sku: "SKU-1", name: "x" }]);
  http.createServer((req, res) => {
    req.resume();
    req.on("end", () => { res.writeHead(200, { "content-type": "application/json" }); res.end(body); });
  }).listen(Number(process.env.PORT ?? 8090));
}

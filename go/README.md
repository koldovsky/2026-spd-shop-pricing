# shop-pricing — Go reimplementation (PRICE-42)

A Go port of the TypeScript pricing service in `src/`: `GET /catalog`, `GET /prices/{sku}`, `POST /quote`.
Standard library only (`net/http`, `encoding/json`, `math/big`), money as `*big.Rat`, half-even rounding per
ADR-007. Plan: `docs/plans/PRICE-42-go.md`. Contract: `contracts/openapi.yaml`.

Requires Go 1.27. All commands below run from the repository root; `go -C go` sets the module directory.

## Build

```
go -C go build -o pricing.exe .
```

On Linux/macOS use `-o pricing`. The binary is written to `go/` and ignored by git.

## Test

```
go -C go vet ./...
```

```
go -C go test ./...
```

## Run

Production-style start: the built binary with `PORT` set (default `8082`; `PORT` is the only setting).

PowerShell:

```
$env:PORT = "8090"; .\go\pricing.exe
```

Bash:

```
PORT=8090 ./go/pricing
```

`go -C go run .` also works for quick local runs, but deployments and benchmarks use the built binary.

## Parity oracle

With the candidate listening on port 8090 (run `npm ci` once; `contract.mjs` needs the `yaml` package):

```
node parity/check.mjs --base http://localhost:8090
node parity/contract.mjs --base http://localhost:8090
node parity/blackbox/run.mjs --base http://localhost:8090
node parity/diff/diff.mjs --a http://localhost:8082 --b http://localhost:8090 --seed 42 --n 1000
```

The diff needs the TypeScript reference (`npm run dev`, port 8082) running next to the candidate. The first three
are gating in CI (`.github/workflows/parity-go.yml`). See `parity/README.md`.

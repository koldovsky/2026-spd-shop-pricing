# PRICE-42 Kotlin — evidence: slice 6, parity (final convergence check)

- Verified revision: `c77324cb5006315babe17fda85174e934ec38d8a` (branch `PRICE-42-kotlin-parity`, working tree changes outside docs/evidence: 0)
- Oracle: read-only checkout `D:\demo-s2\oracle-kotlin` at `128c922b8c1252f3bf223113d49d93a799e4b886`, corpus sha256 `0211ef856e503d898ae2f689fc9ef827f4ba128bd647f9d0ab59eac3ca4ba37a`
- TS reference: `node dist/server.js` from the oracle checkout, PORT=8093. Candidate: `java -jar kotlin/build/libs/pricing.jar`, PORT=8083.
- Run by the orchestrator (not the agent) on 2026-11-23T20:48:53+02:00, Windows 11, openjdk version "21.0.12.1" 2026-08-18 LTS, node v24.18.0.
- Oracle files unchanged in this tree: `git diff 128c922 -- parity contracts bench .claude` -> 0 lines

## Build
```text
$ kotlin/gradlew -p kotlin clean build --console=plain
> Task :testClasses UP-TO-DATE
> Task :test
BUILD SUCCESSFUL in 2s
exit code: 0
jar: kotlin/build/libs/pricing.jar, 1869436 bytes
unit tests: 45 run, 0 failures, 0 errors, 0 skipped (JUnit XML in kotlin/build/test-results)
```

## Oracle (from the oracle checkout)

### Golden corpus
```text
$ (oracle-kotlin @ 128c922) node parity/check.mjs --base http://localhost:8083
[summary lines]
gating: 130/130 passed
quirks (not gating): 2/6 same as reference
RESULT: PASS
[last 8 lines]

quirk differs (not gating) quirk-quote-currency-constructor: status: expected 500, got 422; $.error: expected "internal error", got "unsupported currency constructor"

quirk differs (not gating) quirk-trailing-slash: status: expected 200, got 404; content-type: expected "application/json", got "text/html"; body: expected JSON, got "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET /catalog/</pre>\n</body>\n</html>\n"

gating: 130/130 passed
quirks (not gating): 2/6 same as reference
RESULT: PASS
exit code: 0
```
### Contract
```text
$ (oracle-kotlin @ 128c922) node parity/contract.mjs --base http://localhost:8083
[summary lines]
contract: 125/125 gating corpus requests conform (status-only cases excluded)
RESULT: PASS
[last 8 lines]
contract target=http://localhost:8083 spec=contracts/openapi.yaml (shop-pricing 1.0.0)

contract: 125/125 gating corpus requests conform (status-only cases excluded)
RESULT: PASS
exit code: 0
```
### Black-box
```text
$ (oracle-kotlin @ 128c922) node parity/blackbox/run.mjs --base http://localhost:8083
[summary lines]
ℹ tests 16
ℹ pass 16
ℹ fail 0
[last 8 lines]
ℹ tests 16
ℹ suites 3
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 105.8486
exit code: 0
```
### Differential, seed 42
```text
$ (oracle-kotlin @ 128c922) node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 42 --n 1000
[summary lines]
by kind (mismatches/sent): unknown-sku 0/91, valid-quote 0/419, valid-price 0/83, malformed-json 0/65, bad-currency 0/74, bad-quantity 0/98, bad-shape 0/78, content-type 0/22, bad-price-query 0/70
RESULT: PASS (0/1000 requests differ)
[last 8 lines]
parity:diff A(reference)=http://localhost:8093 B(candidate)=http://localhost:8083 seed=42 n=1000

reference statuses: 200=527 400=145 404=128 422=200
by kind (mismatches/sent): unknown-sku 0/91, valid-quote 0/419, valid-price 0/83, malformed-json 0/65, bad-currency 0/74, bad-quantity 0/98, bad-shape 0/78, content-type 0/22, bad-price-query 0/70
RESULT: PASS (0/1000 requests differ)
exit code: 0
```
### Differential, seed 7
```text
$ (oracle-kotlin @ 128c922) node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 7 --n 1000
[summary lines]
by kind (mismatches/sent): valid-quote 0/413, malformed-json 0/50, bad-shape 0/76, unknown-sku 0/73, bad-price-query 0/52, valid-price 0/92, bad-currency 0/82, bad-quantity 0/125, content-type 0/37
RESULT: PASS (0/1000 requests differ)
[last 8 lines]
parity:diff A(reference)=http://localhost:8093 B(candidate)=http://localhost:8083 seed=7 n=1000

reference statuses: 200=521 400=140 404=106 422=233
by kind (mismatches/sent): valid-quote 0/413, malformed-json 0/50, bad-shape 0/76, unknown-sku 0/73, bad-price-query 0/52, valid-price 0/92, bad-currency 0/82, bad-quantity 0/125, content-type 0/37
RESULT: PASS (0/1000 requests differ)
exit code: 0
```
### Differential, seed 20261126 (not used by the agent)
```text
$ (oracle-kotlin @ 128c922) node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 20261126 --n 1000
[summary lines]
by kind (mismatches/sent): malformed-json 0/59, bad-quantity 0/121, valid-quote 0/384, unknown-sku 0/87, bad-shape 0/73, bad-currency 0/82, valid-price 0/109, content-type 0/38, bad-price-query 0/47
RESULT: PASS (0/1000 requests differ)
[last 8 lines]
parity:diff A(reference)=http://localhost:8093 B(candidate)=http://localhost:8083 seed=20261126 n=1000

reference statuses: 200=517 400=148 404=109 422=226
by kind (mismatches/sent): malformed-json 0/59, bad-quantity 0/121, valid-quote 0/384, unknown-sku 0/87, bad-shape 0/73, bad-currency 0/82, valid-price 0/109, content-type 0/38, bad-price-query 0/47
RESULT: PASS (0/1000 requests differ)
exit code: 0
```

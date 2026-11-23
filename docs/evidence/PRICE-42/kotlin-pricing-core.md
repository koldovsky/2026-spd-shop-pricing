# PRICE-42 Kotlin — evidence: slice 2, pricing core

- Verified revision: `ace4e10d63cd3131941327ad7b295eed30d63823` (branch `PRICE-42-kotlin-pricing-core`, working tree changes outside docs/evidence: 0)
- Oracle: read-only checkout `D:\demo-s2\oracle-kotlin` at `128c922b8c1252f3bf223113d49d93a799e4b886`, corpus sha256 `0211ef856e503d898ae2f689fc9ef827f4ba128bd647f9d0ab59eac3ca4ba37a`
- TS reference: `node dist/server.js` from the oracle checkout, PORT=8093. Candidate: `java -jar kotlin/build/libs/pricing.jar`, PORT=8083.
- Run by the orchestrator (not the agent) on 2026-11-23T20:20:46+02:00, Windows 11, openjdk version "21.0.12.1" 2026-08-18 LTS, node v24.18.0.
- Oracle files unchanged in this tree: `git diff 128c922 -- parity contracts bench .claude` -> 0 lines

## Build
```text
$ kotlin/gradlew -p kotlin clean build --console=plain
> Task :testClasses UP-TO-DATE
> Task :test
BUILD SUCCESSFUL in 2s
exit code: 0
jar: kotlin/build/libs/pricing.jar, 1842489 bytes
unit tests: 19 run, 0 failures, 0 errors, 0 skipped (JUnit XML in kotlin/build/test-results)
```

## Oracle (from the oracle checkout)

### Golden corpus
```text
$ (oracle-kotlin @ 128c922) node parity/check.mjs --base http://localhost:8083
[summary lines]
gating: 6/130 passed (failing tags: happy 1/39, prices 0/33, currency:EUR 0/10, currency:USD 0/10, currency:UAH 0/10, default-currency 0/2, unknown-sku 0/10, validation-order 0/6, invalid-currency 0/8, malformed-query 0/7, quote 0/91, bulk 0/12, boundary 0/21, promo 0/4, cart-discount 0/7, lines 0/5, rounding 0/7, rounding-trap 0/5, half-even 0/4, rounding-order 0/2, json-number 0/3, invalid-quantity 0/10, invalid-input 0/9, empty 0/5, malformed-json 0/4, content-type 0/3, json-parsing 0/1)
quirks (not gating): 0/6 same as reference
RESULT: FAIL (124 gating mismatches)
[last 8 lines]

quirk differs (not gating) quirk-trailing-slash: status: expected 200, got 404; content-type: expected "application/json", got "text/html"; body: expected JSON, got "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET /catalog/</pre>\n</body>\n</html>\n"

quirk differs (not gating) quirk-oversized-body: status: expected 500, got 404; content-type: expected "application/json", got "text/html"; body: expected JSON, got "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST /quote</pre>\n</body>\n</html>\n"

gating: 6/130 passed (failing tags: happy 1/39, prices 0/33, currency:EUR 0/10, currency:USD 0/10, currency:UAH 0/10, default-currency 0/2, unknown-sku 0/10, validation-order 0/6, invalid-currency 0/8, malformed-query 0/7, quote 0/91, bulk 0/12, boundary 0/21, promo 0/4, cart-discount 0/7, lines 0/5, rounding 0/7, rounding-trap 0/5, half-even 0/4, rounding-order 0/2, json-number 0/3, invalid-quantity 0/10, invalid-input 0/9, empty 0/5, malformed-json 0/4, content-type 0/3, json-parsing 0/1)
quirks (not gating): 0/6 same as reference
RESULT: FAIL (124 gating mismatches)
exit code: 1
```
### Contract
```text
$ (oracle-kotlin @ 128c922) node parity/contract.mjs --base http://localhost:8083
[summary lines]
contract: 1/125 gating corpus requests conform (status-only cases excluded)
RESULT: FAIL (124 violations)
[last 8 lines]
  - media type text/html not declared for 404

VIOLATION prices-unknown-sku-before-currency
  request: GET /prices/SKU-9?currency=GBP
  - media type text/html not declared for 404

contract: 1/125 gating corpus requests conform (status-only cases excluded)
RESULT: FAIL (124 violations)
exit code: 1
```
### Black-box
```text
$ (oracle-kotlin @ 128c922) node parity/blackbox/run.mjs --base http://localhost:8083
[summary lines]
ℹ tests 16
ℹ pass 1
ℹ fail 15
[last 8 lines]
✖ returns 404 for an unknown SKU in a quote (0.574ms)
  SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
      at JSON.parse (<anonymous>)
      at post (file:///D:/demo-s2/oracle-kotlin/parity/blackbox/http-suite.mjs:11:177)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async TestContext.<anonymous> (file:///D:/demo-s2/oracle-kotlin/parity/blackbox/http-suite.mjs:97:15)
      at async Test.run (node:internal/test_runner/test:1332:7)
      at async Suite.processPendingSubtests (node:internal/test_runner/test:911:7)
exit code: 1
```
### Differential, seed 42
```text
$ (oracle-kotlin @ 128c922) node parity/diff/diff.mjs --a http://localhost:8093 --b http://localhost:8083 --seed 42 --n 1000
[summary lines]
by kind (mismatches/sent): unknown-sku 91/91, valid-quote 419/419, valid-price 83/83, malformed-json 65/65, bad-currency 74/74, bad-quantity 98/98, bad-shape 78/78, content-type 22/22, bad-price-query 70/70
RESULT: FAIL (1000/1000 requests differ; showing first 5)
[last 8 lines]
MISMATCH #4 (unknown-sku) A=404 B=404
  request: POST /quote [application/json] {"currency":"UAH","lines":[{"sku":"SKU-4","quantity":9},{"sku":"SKU-5","quantity":95},{"sku":"SKU-1","quantity":1},{"sku":"SKU-2","quantity":62},{"sku":"SKU-10"…
  - content-type: expected "application/json", got "text/html"
  - body: expected JSON, got "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST /quote</pre>\n</body>\n</html>\n"

reference statuses: 200=527 400=145 404=128 422=200
by kind (mismatches/sent): unknown-sku 91/91, valid-quote 419/419, valid-price 83/83, malformed-json 65/65, bad-currency 74/74, bad-quantity 98/98, bad-shape 78/78, content-type 22/22, bad-price-query 70/70
RESULT: FAIL (1000/1000 requests differ; showing first 5)
exit code: 1
```

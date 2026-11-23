#!/bin/bash
# Back-to-back benchmark of TS, Kotlin and Go, two rounds, from the pricing repo root at the given commit.
set -u
cd /d/demo-s2/pricing-go
OUT=/d/demo-s2/bench-final
git rev-parse HEAD > $OUT/sha.txt
for round in 1 2; do
  node bench/run.mjs --label ts --cmd "node dist/server.js" --out $OUT/r$round-ts.json > $OUT/r$round-ts.log 2>&1; echo "r$round ts exit $?" >> $OUT/exits.txt
  node bench/run.mjs --label kotlin --cmd "java -jar kotlin/build/libs/pricing.jar" --out $OUT/r$round-kotlin.json > $OUT/r$round-kotlin.log 2>&1; echo "r$round kotlin exit $?" >> $OUT/exits.txt
  node bench/run.mjs --label go --cmd "go/pricing.exe" --out $OUT/r$round-go.json > $OUT/r$round-go.log 2>&1; echo "r$round go exit $?" >> $OUT/exits.txt
done
echo done >> $OUT/exits.txt

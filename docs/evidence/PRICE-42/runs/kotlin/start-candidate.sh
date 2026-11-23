#!/bin/bash
# Start the built jar on 8083 detached; print the Windows PID of the listener after checking its command line.
cd /d/demo-s2/pricing-kotlin || exit 3
if netstat -ano | grep -E "TCP +0\.0\.0\.0:8083 " | grep -q LISTEN; then echo "port 8083 busy" >&2; exit 2; fi
PORT=8083 nohup java -jar D:/demo-s2/pricing-kotlin/kotlin/build/libs/pricing.jar > /d/demo-s2/runs-kotlin/cand.log 2>&1 < /dev/null &
for i in $(seq 1 120); do curl -sf -o /dev/null http://localhost:8083/catalog && break; sleep 0.5; done
WPID=$(netstat -ano | grep -E "TCP +0\.0\.0\.0:8083 " | grep LISTEN | awk '{print $5}' | head -1)
CL=$(powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=$WPID').CommandLine" | tr -d '\r')
case "$CL" in *pricing-kotlin*pricing.jar*) echo "$WPID";; *) echo "unexpected listener $WPID: $CL" >&2; exit 4;; esac

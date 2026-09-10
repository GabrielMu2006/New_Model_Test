#!/bin/bash
# Render an HTML/SVG page to PNG with headless Chrome, then kill Chrome.
# usage: render.sh <input-file> <out.png> <WxH> [virtual-time-budget-ms]
set -u
IN="$1"; OUT="$2"; SIZE="${3:-960x540}"; VTB="${4:-2500}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$PWD/_build/cp"
mkdir -p "$PROFILE"
rm -f "$OUT"
"$CHROME" --headless --disable-gpu --no-sandbox --no-first-run --no-default-browser-check \
  --disable-extensions --disable-background-networking --disable-sync --disable-features=Translate \
  --user-data-dir="$PROFILE" --virtual-time-budget="$VTB" --hide-scrollbars \
  --force-device-scale-factor=1 --screenshot="$OUT" --window-size="$SIZE" \
  "file://$IN" >/dev/null 2>&1 &
PID=$!
for i in $(seq 1 80); do [ -s "$OUT" ] && break; sleep 0.25; done
sleep 0.6
kill "$PID" 2>/dev/null
wait "$PID" 2>/dev/null
[ -s "$OUT" ] && echo "OK $OUT $(stat -f%z "$OUT") bytes" || echo "FAIL $OUT"

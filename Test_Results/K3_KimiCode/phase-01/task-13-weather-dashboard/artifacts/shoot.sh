#!/bin/bash
# Screenshot helper: headless Chrome writes the file, then hangs on exit — kill after grace period.
# usage: ./shoot.sh "<url>" <outfile> [WxH]
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="$1"; OUT="$2"; SIZE="${3:-1440,900}"
"$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars \
  --use-mock-keychain --password-store=basic --disable-extensions --disable-sync \
  --disable-background-networking --disable-component-update \
  --user-data-dir="$PWD/.chrome-profile" --window-size="$SIZE" \
  --screenshot="$PWD/$OUT" "$URL" >/dev/null 2>&1 &
PID=$!
for i in $(seq 1 30); do [ -s "$PWD/$OUT" ] && sleep 3 && break; sleep 1; done
kill $PID 2>/dev/null; wait $PID 2>/dev/null
ls -la "$PWD/$OUT"

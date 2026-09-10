#!/usr/bin/env bash
# Gate for the standalone SVG.
#
#   ./check.sh                 model + markup + rendered-pixel checks (no browser)
#   ./check.sh --with-browser   additionally runs the headless-Chrome runtime and
#                              control probes (launches a local Chrome; opt-in)
#
# The browser steps are opt-in because launching Chrome touches Chrome's own
# profile / crashpad / keychain state outside this workspace.
set -euo pipefail
cd "$(dirname "$0")"

WITH_BROWSER=0
[ "${1:-}" = "--with-browser" ] && WITH_BROWSER=1

echo "== build =="
node build.mjs

echo
echo "== kinematics / structure / assets =="
node verify.mjs

echo
echo "== rendered pixels =="
if [ "$WITH_BROWSER" = "1" ]; then
  node tools/browser.mjs shot screenshots/frozen.png "0 0 1240 920" 900 static
fi
node tools/pixels.mjs screenshots/frozen.png

if [ "$WITH_BROWSER" = "1" ]; then
  echo
  echo "== runtime probe =="
  node tools/browser.mjs probe 8000

  echo
  echo "== controls probe =="
  node tools/browser.mjs controls 20000
else
  echo
  echo "== browser probes skipped =="
  echo "   run ./check.sh --with-browser, or see evidence/browser-probes.txt"
fi

echo
echo "ALL GATES PASSED"

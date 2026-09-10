#!/bin/bash
# Reproduce every check that was run on pelican-bicycle.svg.
# Needs: python3 + Pillow, and Google Chrome for headless rendering.
set -u
cd "$(dirname "$0")/.." || exit 1
echo "================ 1. XML well-formedness + internal references ================"
python3 - <<'PY'
import xml.etree.ElementTree as ET
r = ET.parse('pelican-bicycle.svg').getroot()
ids = {e.get('id') for e in r.iter() if e.get('id')}
bad = []
for e in r.iter():
    for k in ('href', '{http://www.w3.org/1999/xlink}href'):
        v = e.get(k)
        if v and v.startswith('#') and v[1:] not in ids: bad.append(v)
    for k in ('clip-path', 'fill', 'stroke'):
        v = e.get(k) or ''
        if v.startswith('url(#') and v[5:-1] not in ids: bad.append(v)
print("  well-formed XML: OK")
print("  unresolved internal refs:", bad or "none")
PY
echo "================ 2. no external dependencies ================================"
grep -o -E 'https?://[^"'"'"' )]*' pelican-bicycle.svg | sort -u | sed 's/^/  namespace-only: /'
echo "  external file/font/image references: $(grep -c -E '<(image|font|font-face|foreignObject)|@import' pelican-bicycle.svg)"
echo "================ 3. scrolling layers + master-loop closure ==================="
python3 _build/verify2.py
echo "================ 4. drivetrain mechanics (feet on pedals) ===================="
python3 _build/verify3.py
echo "================ 5. region motion audit ======================================"
python3 _build/verify4.py
echo "================ 6. pause / resume control ==================================="
python3 _build/verify_pause.py
python3 _build/verify_resume.py

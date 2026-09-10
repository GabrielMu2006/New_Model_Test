#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render-based resume check: a page paused at load and resumed after 800 ms
must look different from a page that stays paused (the timeline really runs)."""
import os, re, subprocess
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(os.path.dirname(HERE), "pelican-bicycle.svg"), encoding="utf-8").read()
SRC = re.sub(r"<\?xml[^>]*\?>\s*", "", SRC)
base = '<!doctype html><meta charset="utf-8"><style>body{margin:0}svg{display:block}</style>' + SRC
ctrl = base + "<script>document.getElementById('pelican-svg').pauseAnimations();</script>"
resu = base + ("<script>var s=document.getElementById('pelican-svg');s.pauseAnimations();"
               "setTimeout(function(){s.unpauseAnimations();},800);</script>")

for name, html in (("ctrl", ctrl), ("resu", resu)):
    hp = os.path.join(HERE, "_p_%s.html" % name)
    open(hp, "w", encoding="utf-8").write(html)
    r = subprocess.run([os.path.join(HERE, "render.sh"), hp,
                        os.path.join(HERE, "_p_%s.png" % name), "960x540", "4000"],
                       capture_output=True, text=True)
    assert "OK" in r.stdout, r.stdout + r.stderr

a = Image.open(os.path.join(HERE, "_p_ctrl.png")).convert("RGB")
b = Image.open(os.path.join(HERE, "_p_resu.png")).convert("RGB")
d = ImageChops.difference(a, b).convert("L")
n = sum(1 for p in d.getdata() if p > 8)
print("  frame differs after resume: %d / %d px changed -> %s"
      % (n, 960 * 540, "resume works" if n > 5000 else "RESUME PROBLEM"))

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Region-by-region motion audit: every part that should move must change
between two times; parts that must stay put must not."""
import os, subprocess, sys
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))


def render(times, tag):
    hp = os.path.join(HERE, "_r_%s.html" % tag)
    subprocess.run([sys.executable, os.path.join(HERE, "one.py"), hp,
                    "0 0 960 540", "960", "540"] + [str(t) for t in times],
                   check=True, capture_output=True)
    png = os.path.join(HERE, "_r_%s.png" % tag)
    r = subprocess.run([os.path.join(HERE, "render.sh"), hp, png,
                        "960x%d" % (540 * len(times)), "3000"],
                       capture_output=True, text=True)
    assert "OK" in r.stdout, r.stdout + r.stderr
    return Image.open(png).convert("RGB")


T = [0.0, 0.35]
im = render(T, "a")
a = im.crop((0, 0, 960, 540))
b = im.crop((0, 540, 960, 1080))

REGIONS = [
    ("rear wheel spokes", (372, 352, 412, 392), "move"),
    ("front wheel spokes", (568, 352, 608, 392), "move"),
    ("crank arm", (480, 378, 508, 398), "move"),
    ("chainring teeth", (462, 370, 494, 402), "move"),
    ("chain top run", (400, 356, 470, 368), "move"),
    ("near leg", (452, 286, 500, 350), "move"),
    ("far leg", (424, 300, 460, 356), "move"),
    ("near foot", (492, 362, 520, 382), "move"),
    ("body (bob/roll)", (352, 170, 448, 258), "move"),
    ("neck + head nod", (476, 92, 536, 168), "move"),
    ("scarf ribbon", (428, 138, 486, 190), "move"),
    ("folded wing", (334, 200, 392, 250), "move"),
    ("clouds", (0, 60, 260, 180), "move"),
    ("hills", (620, 300, 940, 392), "move"),
    ("road dashes", (0, 470, 220, 492), "move"),
    ("verge tufts", (0, 402, 220, 424), "move"),
    ("sun (static)", (770, 135, 790, 150), "still"),
    ("sky gradient (static)", (100, 0, 160, 30), "still"),
]

print("region                     change%%   expectation   verdict")
bad = 0
for name, box, want in REGIONS:
    d = ImageChops.difference(a.crop(box), b.crop(box)).convert("L")
    px = list(d.getdata())
    n = sum(1 for p in px if p > 8)
    pct = 100.0 * n / len(px)
    if want == "move":
        ok = pct > 0.5
    else:
        ok = pct < 0.2
    if not ok:
        bad += 1
    print("  %-24s %6.2f    %-6s        %s" % (name, pct, want, "OK" if ok else "**FAIL**"))
print("\n%d problem(s)" % bad)

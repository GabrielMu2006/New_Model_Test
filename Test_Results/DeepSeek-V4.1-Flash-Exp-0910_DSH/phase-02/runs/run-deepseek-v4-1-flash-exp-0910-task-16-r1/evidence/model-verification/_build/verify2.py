#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Exact checks: inject coloured markers into each scrolling layer, measure
their displacement; and diff a background-free copy to prove the loop closes."""
import os, re, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(os.path.dirname(HERE), "pelican-bicycle.svg"), encoding="utf-8").read()
SRC = re.sub(r"<\?xml[^>]*\?>\s*", "", SRC)
SRC = re.sub(r"<script>.*?</script>", "", SRC, flags=re.S)


def render_page(body_html, times, out, w=960, h=540):
    cells = []
    for i, t in enumerate(times):
        cells.append('<div class="c"><div class="cap">%.3f</div>%s</div>' % (t, body_html))
    page = """<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#111}.c{position:relative;margin:0;padding:0;line-height:0}
.cap{position:absolute;left:3px;top:2px;z-index:9;color:#ff0;font:700 12px monospace}
svg{display:block}</style>%s
<script>var T=%s,S=document.querySelectorAll('svg');
for(var i=0;i<S.length;i++){S[i].pauseAnimations();S[i].setCurrentTime(T[i]);}</script>
""" % ("\n".join(cells), str(list(times)))
    hp = os.path.join(HERE, out + ".html")
    open(hp, "w", encoding="utf-8").write(page)
    png = os.path.join(HERE, out + ".png")
    r = subprocess.run([os.path.join(HERE, "render.sh"), hp, png,
                        "%dx%d" % (w, h * len(times)), "2500"], capture_output=True, text=True)
    assert "OK" in r.stdout, r.stdout + r.stderr
    return png


def find_marker(img, rgb, y0, y1, tol=40):
    """x centroid of pixels close to rgb inside the given row band"""
    px = img.load()
    xs = []
    for y in range(y0, y1):
        for x in range(img.size[0]):
            r, g, b = px[x, y][:3]
            if abs(r - rgb[0]) < tol and abs(g - rgb[1]) < tol and abs(b - rgb[2]) < tol:
                xs.append(x)
    return (sum(xs) / len(xs)) if xs else None


# ---------------------------------------------------------------- scroll test
markers = [("clouds", "40s", (255, 0, 0), 210),
           ("hills", "20s", (0, 255, 0), 260),
           ("mid", "6.25s", (0, 0, 255), 330),
           ("ground", "2s", (255, 0, 255), 500)]
body = SRC
for name, dur, rgb, y in markers:
    col = "#%02x%02x%02x" % rgb
    tile = {"clouds": "tileClouds", "hills": "tileHills", "mid": "tileMid",
            "ground": "tileGround"}[name]
    pat = re.compile(r'<use xlink:href="#%s"[^>]*x="0"/>' % tile)
    m = pat.search(body)
    assert m, "layer %s not found" % name
    body = body[:m.start()] + '<rect x="760" y="%d" width="14" height="14" fill="%s"/>' % (y, col) + body[m.start():]

times = [0.0, 0.5, 1.0]
png = render_page(body, times, "_m")
im = Image.open(png).convert("RGB")
print("== layer displacement (marker x centroid, 14px wide) ==")
print("   layer    dur      t=0      t=0.5    t=1.0    px/s measured / expected")
for name, dur, rgb, y in markers:
    xs = []
    for i in range(len(times)):
        sub = im.crop((0, i * 540, 960, (i + 1) * 540))
        xs.append(find_marker(sub, rgb, y - 2, y + 16))
    d = float(dur.rstrip("s"))
    exp = 753.98 / d
    if None in xs:
        print("   %-8s %-7s  MISSING %s" % (name, dur, xs))
        continue
    v1 = (xs[0] - xs[1]) / 0.5
    v2 = (xs[0] - xs[2]) / 1.0
    print("   %-8s %-7s %7.1f %8.1f %8.1f   %.1f / %.1f  (%.1f / %.1f)"
          % (name, dur, xs[0], xs[1], xs[2], v1, exp, v2, exp))

# ---------------------------------------------------------------- loop test
# strip the scrolling tiles so only bike + pelican + static bands remain
clean = re.sub(r'<use[^>]*#tile[^>]*/>', "", SRC)
times = [0.0, 2.0, 4.0]
png = render_page(clean, times, "_l")
im = Image.open(png).convert("RGB")
print("== loop closure without scrolling layers (t=0 vs 2.0 vs 4.0) ==")
base = im.crop((0, 0, 960, 540))
for i, t in enumerate(times[1:], 1):
    cur = im.crop((0, i * 540, 960, (i + 1) * 540))
    d = Image.merge("RGB", cur.split())
    import PIL.ImageChops as C
    diff = C.difference(base, d).convert("L")
    n = sum(1 for p in diff.getdata() if p > 8)
    print("   t=%.1f vs t=0.0 : %d differing px of 518400 (%.5f%%)" % (t, n, 100.0 * n / 518400))

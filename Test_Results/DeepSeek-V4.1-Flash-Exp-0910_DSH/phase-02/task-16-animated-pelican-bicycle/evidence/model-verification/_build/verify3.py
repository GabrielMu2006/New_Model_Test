#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mechanics checks with injected markers:
   * wheel angular speed -> tyre contact speed must equal the road speed
   * crank marker angle -> one revolution per loop
   * ankle marker minus pedal marker -> constant offset (feet never leave)"""
import os, re, subprocess, sys, math
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(os.path.dirname(HERE), "pelican-bicycle.svg"), encoding="utf-8").read()
SRC = re.sub(r"<\?xml[^>]*\?>\s*", "", SRC)
SRC = re.sub(r"<script>.*?</script>", "", SRC, flags=re.S)

M_PEDAL = (255, 0, 255)
M_ANKLE = (0, 255, 255)
M_RIM = (255, 255, 0)
M_CRANK = (255, 128, 0)


def inject(src, anchor, rect):
    i = src.index(anchor) + len(anchor)
    return src[:i] + rect + src[i:]


body = SRC
# near pedal platform group (its translate puts the group origin on the spindle)
body = inject(body, '<rect x="491" y="380" width="34" height="12" rx="5" fill="#39424b"/>',
              '<rect x="-3" y="-3" width="6" height="6" fill="#ff00ff"/>')
# near foot group (its translate puts the group origin on the ankle)
body = inject(body, '<path d="M-11.5 -7C-4.6 -11.5 9.2 -11.5 19.6 -7C28.8 -2.3 33.4 1.2 31 4.6'
                    'C28.8 8 19.6 9.2 15 5.8C13.8 10.4 6.9 11.5 2.3 8.1'
                    'C-3.5 10.4 -10.4 8.1 -12.7 3.5C-13.8 0 -12.7 -4.6 -11.5 -7Z" fill="#dd8440"/>',
              '<rect x="-3" y="-3" width="6" height="6" fill="#00ffff"/>')
# rear wheel rotating group: marker on the rim
body = inject(body, '<use xlink:href="#spokes" href="#spokes"/>',
              '<rect x="-4" y="-52" width="8" height="8" fill="#ffff00"/>')
# near crank arm end (pedal spindle in local coords)
body = inject(body, '<line x1="478" y1="386" x2="508" y2="386" stroke="#1f5f6e" '
                    'stroke-width="7" stroke-linecap="round"/>',
              '<rect x="504" y="382" width="8" height="8" fill="#ff8000"/>')

TIMES = [0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0]
cells = "".join('<div class="c">%s</div>' % body for _ in TIMES)
page = """<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#111;line-height:0}.c{margin:0;padding:0}</style>%s
<script>var T=%s,S=document.querySelectorAll('svg');
for(var i=0;i<S.length;i++){S[i].pauseAnimations();S[i].setCurrentTime(T[i]);}</script>
""" % (cells, str(TIMES))
hp = os.path.join(HERE, "_mech.html")
open(hp, "w", encoding="utf-8").write(page)
png = os.path.join(HERE, "_mech.png")
r = subprocess.run([os.path.join(HERE, "render.sh"), hp, png, "960x%d" % (540 * len(TIMES)), "4000"],
                   capture_output=True, text=True)
assert "OK" in r.stdout, r.stdout + r.stderr

im = Image.open(png).convert("RGB")


def centroid(img, rgb, tol=10):
    px = img.load()
    xs = ys = n = 0
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            r_, g_, b_ = px[x, y]
            if abs(r_ - rgb[0]) <= tol and abs(g_ - rgb[1]) <= tol and abs(b_ - rgb[2]) <= tol:
                xs += x; ys += y; n += 1
    return (xs / n, ys / n, n) if n else None


REAR = (392.0, 372.0)
BB = (478.0, 386.0)
print("frames:", len(TIMES), " page:", im.size)
rows = []
for i, t in enumerate(TIMES):
    sub = im.crop((0, i * 540, 960, (i + 1) * 540))
    ped = centroid(sub, M_PEDAL)
    ank = centroid(sub, M_ANKLE)
    rim = centroid(sub, M_RIM)
    crk = centroid(sub, M_CRANK)
    if not all((ped, ank, rim, crk)):
        print("  t=%.3f MISSING %s" % (t, [n for n, v in
              (("pedal", ped), ("ankle", ank), ("rim", rim), ("crank", crk)) if not v]))
        continue
    ang_w = math.degrees(math.atan2(rim[1] - REAR[1], rim[0] - REAR[0])) % 360
    ang_c = math.degrees(math.atan2(crk[1] - BB[1], crk[0] - BB[0])) % 360
    rows.append((t, ang_w, ang_c, ped, ank))

print("\n== crank (expect 180 deg per 0.25 s, i.e. one turn per 2 s) ==")
for i in range(1, len(rows)):
    t0, w0, c0, p0, a0 = rows[i - 1]
    t1, w1, c1, p1, a1 = rows[i]
    dc = (c1 - c0) % 360
    dw = (w1 - w0) % 360
    print("  t %.3f->%.3f  crank +%6.1f deg  wheel +%6.1f deg  ratio %.3f" %
          (t0, t1, dc, dw, (dw / dc) if dc else 0))

print("\n== wheel contact speed vs road speed ==")
for i in range(1, len(rows)):
    t0, w0, c0, p0, a0 = rows[i - 1]
    t1, w1, c1, p1, a1 = rows[i]
    dt = t1 - t0
    dw = (w1 - w0) % 360
    v = math.radians(dw) / dt * 60.0
    print("  t %.3f->%.3f  omega=%7.3f deg/s  contact speed=%7.2f px/s  (road 376.99)"
          % (t0, t1, dw / dt, v))

print("\n== ankle relative to pedal spindle (must stay ~(-2,-12)) ==")
for t, w, c, p, a in rows:
    print("  t=%.3f  ankle-pedal = (%+6.2f, %+6.2f)  |d|=%.2f" %
          (t, a[0] - p[0], a[1] - p[1], math.hypot(a[0] - p[0], a[1] - p[1])))

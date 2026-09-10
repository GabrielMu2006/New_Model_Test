#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Objective checks on rendered frames (no external deps beyond Pillow)."""
import subprocess, sys, os
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def render(t, out, w=960, h=540):
    html = os.path.join(HERE, "_v_%s.html" % out)
    subprocess.run([sys.executable, os.path.join(HERE, "one.py"), html,
                    "0 0 960 540", str(w), str(h), str(t)], check=True,
                   capture_output=True)
    png = os.path.join(HERE, "_v_%s.png" % out)
    r = subprocess.run([os.path.join(HERE, "render.sh"), html, png,
                        "%dx%d" % (w, h), "2500"], capture_output=True, text=True)
    assert "OK" in r.stdout, r.stdout + r.stderr
    return Image.open(png).convert("RGB")


def diffcount(a, b, box):
    d = ImageChops.difference(a.crop(box), b.crop(box)).convert("L")
    return sum(1 for p in d.getdata() if p > 8), box[2] - box[0], box[3] - box[1]


def best_shift(a, b, box, span=120):
    """how far did the content in `box` move left between a and b?"""
    x0, y0, x1, y1 = box
    pa = a.crop(box).convert("L")
    pb = b.crop(box).convert("L")
    wa, ha = pa.size
    ra = list(pa.getdata())
    rb = list(pb.getdata())
    best, bests = None, None
    for s in range(0, span):
        # compare a[x] with b[x-s]  => content moved left by s
        tot, cnt = 0, 0
        for y in range(0, ha, 2):
            for x in range(s + 2, wa - 2, 2):
                tot += abs(ra[y * wa + x] - rb[y * wa + x - s])
                cnt += 1
        m = tot / max(cnt, 1)
        if best is None or m < best:
            best, bests = m, s
    return bests, best


def main():
    a = render(0.0, "t0")
    b = render(2.0, "t2")
    c = render(0.5, "t05")

    print("== loop seam (t=0 vs t=2.0, one master loop) ==")
    for name, box in (("bike+pelican", (240, 60, 720, 460)),
                      ("road band", (0, 430, 960, 540))):
        n, w, h = diffcount(a, b, box)
        print("  %-13s differing px: %5d / %d  (%.4f%%)" % (name, n, w * h, 100.0 * n / (w * h)))

    print("== background scroll direction/speed ==")
    for name, box, expect in (("road (1.00x)", (0, 440, 960, 500), 377.0 * 0.5),
                              ("mid  (0.32x)", (0, 300, 960, 396), 120.6 * 0.5),
                              ("far  (0.10x)", (0, 250, 960, 300), 37.7 * 0.5)):
        s, err = best_shift(a, c, box)
        print("  %-13s moved %3d px in 0.5 s (expected ~%.1f)  err/px=%.2f"
              % (name, s, expect, err))

    print("== wheels / crank move between frames ==")
    for name, box in (("rear wheel", (330, 310, 460, 435)),
                      ("front wheel", (525, 310, 655, 435)),
                      ("crank area", (440, 350, 520, 425))):
        n, w, h = diffcount(a, c, box)
        print("  %-12s changed px: %5d / %d (%.1f%%)" % (name, n, w * h, 100.0 * n / (w * h)))


main()

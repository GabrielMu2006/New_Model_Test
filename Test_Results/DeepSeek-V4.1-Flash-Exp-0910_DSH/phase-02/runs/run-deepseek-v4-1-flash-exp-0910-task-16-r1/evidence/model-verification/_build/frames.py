#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render frozen frames of pelican-bicycle.svg into an HTML contact sheet."""
import sys, re, html

SVG = "pelican-bicycle.svg"
src = open(SVG, encoding="utf-8").read()
src = re.sub(r"<\?xml[^>]*\?>\s*", "", src)
# drop the interactive script + duplicate ids for the copies
src = re.sub(r"<script>.*?</script>", "", src, flags=re.S)


def copies(times, cell_w, cell_h, viewbox=None, extra_style=""):
    out = []
    for i, t in enumerate(times):
        body = src
        if viewbox:
            body = body.replace('viewBox="0 0 960 540"', 'viewBox="%s"' % viewbox, 1)
        body = body.replace('width="960" height="540"',
                            'width="%d" height="%d"' % (cell_w, cell_h), 1)
        out.append('<div class="cell"><div class="cap">t = %.2fs</div>%s</div>' % (t, body))
    return "\n".join(out)


mode = sys.argv[1] if len(sys.argv) > 1 else "sheet"
if mode == "sheet":
    times = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25]
    cw, ch = 460, 259
    grid = "grid-template-columns: repeat(2, 460px);"
elif mode == "sheet2":
    times = [0.0, 0.166, 0.333, 0.5, 0.666, 0.833]
    cw, ch = 460, 259
    grid = "grid-template-columns: repeat(3, 460px);"
else:  # zoom of the drivetrain / leg area
    times = [0.0, 0.5, 1.0, 1.5]
    cw, ch = 430, 360
    grid = "grid-template-columns: repeat(2, 430px);"

vb = "330 220 300 250" if mode == "zoom" else None
cells = copies(times, cw, ch, vb)

page = """<!doctype html><meta charset="utf-8">
<style>
 body{margin:0;background:#20242a;font:12px/1.4 ui-monospace,Menlo,monospace;color:#9fb}
 .grid{display:grid;%s gap:6px;padding:6px}
 .cell{position:relative;background:#111}
 .cap{position:absolute;left:4px;top:2px;z-index:5;color:#ffd479;font-weight:700;
      text-shadow:0 0 4px #000}
 svg{display:block}
</style>
<div class="grid">%s</div>
<script>
 var times = %s;
 var svgs = document.querySelectorAll('svg');
 for (var i = 0; i < svgs.length; i++) {
   svgs[i].pauseAnimations();
   svgs[i].setCurrentTime(times[i]);
 }
</script>
""" % (grid, cells, str(times))

open("_build/%s.html" % mode, "w", encoding="utf-8").write(page)
print("wrote _build/%s.html" % mode)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""one.py <out.html> <viewBox> <t> <w> <h> [<t2> ...]  -> frozen-frame HTML"""
import sys, re

out, vb, w, h = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
times = [float(x) for x in sys.argv[5:]] or [0.0]
src = open("pelican-bicycle.svg", encoding="utf-8").read()
src = re.sub(r"<\?xml[^>]*\?>\s*", "", src)
src = re.sub(r"<script>.*?</script>", "", src, flags=re.S)

cells = []
for t in times:
    body = src.replace('viewBox="0 0 960 540"', 'viewBox="%s"' % vb, 1)
    body = body.replace('width="960" height="540"',
                        'width="%s" height="%s"' % (w, h), 1)
    cells.append('<div class="cell"><div class="cap">t=%.2fs</div>%s</div>' % (t, body))

page = """<!doctype html><meta charset="utf-8">
<style>
body{margin:0;background:#1a1d21}
.cell{position:relative;margin:0;padding:0;line-height:0}
.cap{position:absolute;left:6px;top:4px;z-index:9;color:#ffd479;font:700 16px ui-monospace,monospace;text-shadow:0 0 6px #000}
svg{display:block}
</style>
%s
<script>
var T=%s, S=document.querySelectorAll('svg');
for(var i=0;i<S.length;i++){S[i].pauseAnimations();S[i].setCurrentTime(T[i]);}
</script>
""" % ("\n".join(cells), str(times))
open(out, "w", encoding="utf-8").write(page)
print("wrote", out)

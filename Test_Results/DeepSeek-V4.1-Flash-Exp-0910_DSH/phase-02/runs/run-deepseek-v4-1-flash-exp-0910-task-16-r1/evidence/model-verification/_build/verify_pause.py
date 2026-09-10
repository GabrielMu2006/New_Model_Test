#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Drive the pause/resume control in headless Chrome and dump the results."""
import os, subprocess, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(os.path.dirname(HERE), "pelican-bicycle.svg"), encoding="utf-8").read()
SRC = re.sub(r"<\?xml[^>]*\?>\s*", "", SRC)

test_js = """
<script>
(function(){
  var svg=document.getElementById('pelican-svg');
  var btn=document.getElementById('toggle-anim');
  var label=document.getElementById('toggle-label');
  var out=[];
  function snap(tag){
    out.push(tag+':paused='+svg.animationsPaused()
      +',label='+label.textContent
      +',aria='+btn.getAttribute('aria-pressed')
      +',playIcon='+(document.getElementById('icon-play').style.display||'shown')
      +',pauseIcon='+(document.getElementById('icon-pause').style.display||'shown'));
  }
  snap('initial');
  btn.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  snap('click1');
  // while paused the timeline must not advance
  var t1=svg.getCurrentTime();
  setTimeout(function(){
    var t2=svg.getCurrentTime();
    out.push('paused-clock-delta='+(t2-t1).toFixed(4));
    btn.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    snap('click2');
    setTimeout(function(){
      // NB: --dump-dom does not drive frames, so the SMIL clock does not tick
      // here; verify_resume.py proves the resume by comparing rendered frames.
      btn.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      snap('keydown-enter');
      btn.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      snap('keydown-enter2');
      document.title='RESULT '+out.join(' || ')+' END';
    },500);
  },600);
})();
</script>
"""
page = """<!doctype html><meta charset="utf-8"><title>pending</title>%s%s""" % (SRC, test_js)
hp = os.path.join(HERE, "_pause.html")
open(hp, "w", encoding="utf-8").write(page)

chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
prof = os.path.join(HERE, "cp2")
r = subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox", "--no-first-run",
                    "--disable-extensions", "--user-data-dir=" + prof,
                    "--virtual-time-budget=4000", "--dump-dom", "file://" + hp],
                   capture_output=True, text=True, timeout=90)
m = re.search(r"<title>(.*?)</title>", r.stdout, re.S)
print(m.group(1).replace(" || ", "\n  ") if m else "NO RESULT\n" + r.stdout[:500])

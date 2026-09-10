import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createServer } from '../tools/serve.mjs';
const ROOT = '/Users/gabrielmu/Documents/New_Model_Test/test-workspace/phase-02/task-20-2d-mechanical-linkage-designer';
const server = createServer(ROOT);
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
const child = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new','--disable-gpu','--no-sandbox','--disable-breakpad','--disable-crash-reporter',`--crash-dumps-dir=${profile}`,`--user-data-dir=${profile}`,'--remote-debugging-port=9777','--window-size=1440,900',`http://127.0.0.1:${port}/index.html`], {stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let list;
for (let i=0;i<60;i++){ try { const r = await fetch('http://127.0.0.1:9777/json/list'); if(r.ok){ list = await r.json(); break; } } catch {} await sleep(200); }
const page = list.find(t=>t.type==='page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=1; const pend=new Map();
ws.addEventListener('message', e=>{ const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m); pend.delete(m.id);} });
const send=(method,params={})=>new Promise(res=>{const i=id++; pend.set(i,res); ws.send(JSON.stringify({id:i,method,params}));});
const ev = async (expr) => (await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true})).result?.result?.value;
await send('Runtime.enable');
await ev(`window.__probe={down:0,move:0,up:0,wheel:0}; const c=document.getElementById('canvas'); for (const t of ['pointerdown','pointermove','pointerup','wheel','mousedown']) c.addEventListener(t, ()=>window.__probe[t==='pointerdown'?'down':t==='pointermove'?'move':t==='pointerup'?'up':'wheel']++); 'ok'`);
const cx = await ev(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}})()`);
console.log('canvas rect centre', cx);
console.log('elementFromPoint', await ev(`(()=>{const e=document.elementFromPoint(${cx.x},${cx.y}); return e?e.id||e.tagName:null})()`));
await send('Page.enable');
try { await send('Page.bringToFront'); console.log('bringToFront ok'); } catch(e){ console.log('bringToFront failed', e.error?.message); }
try { await send('Emulation.setFocusEmulationEnabled',{enabled:true}); console.log('focus emulation ok'); } catch(e){ console.log('focus emulation failed', e.error?.message); }
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'g',code:'KeyG',windowsVirtualKeyCode:71});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'g',code:'KeyG',windowsVirtualKeyCode:71});
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:cx.x,y:cx.y,buttons:0,pointerType:'mouse'});
await send('Input.dispatchMouseEvent',{type:'mousePressed',x:cx.x,y:cx.y,button:'left',buttons:1,clickCount:1});
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:cx.x+30,y:cx.y+20,button:'left',buttons:1});
await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:cx.x+30,y:cx.y+20,button:'left',buttons:0,clickCount:1});
await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:cx.x,y:cx.y,deltaX:0,deltaY:-240});
await sleep(200);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await sleep(400);
console.log(await ev(`JSON.stringify((() => {
  const W = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > W + 0.5) out.push({ tag: el.tagName, cls: (el.className||'').toString().slice(0,32), id: el.id, right: Math.round(r.right), w: Math.round(r.width), overflow: getComputedStyle(el).overflowX });
    else if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.push({ tag: el.tagName, cls: (el.className||'').toString().slice(0,32), id: el.id, scrollW: el.scrollWidth, clientW: el.clientWidth, note: 'internal' });
  }
  return { W, scrollWidth: document.documentElement.scrollWidth, offenders: out.slice(0, 12) };
})(), null, 1)`));
await send('Emulation.clearDeviceMetricsOverride');
console.log('probe', await ev('window.__probe'));
console.log('grid toggled by key?', await ev('JSON.stringify(window.linkageDesigner.state.mechanism.view.showGrid)'));
console.log('camera', await ev('JSON.stringify(window.linkageDesigner.state.camera)'));
console.log('focused?', await ev('document.hasFocus()'));
child.kill('SIGKILL'); server.close(); fs.rmSync(profile,{recursive:true,force:true});

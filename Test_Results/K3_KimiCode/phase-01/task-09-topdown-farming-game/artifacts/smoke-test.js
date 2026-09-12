// Headless smoke test for index.html game logic (no browser needed).
// Stubs the DOM, runs the game's script in a vm context, then exercises
// the core loop: hoe -> plant -> water -> grow -> harvest -> shop -> save/load.
'use strict';
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('check.js', 'utf8');

// ---- DOM stubs ----
const registry = {};
function makeEl(id){
  const el = {
    id: id || '', textContent: '', className: '', disabled: false,
    onclick: null, children: [],
    classList: {
      _s: new Set(),
      add(c){ this._s.add(c); },
      remove(c){ this._s.delete(c); },
      toggle(c, force){ if(force === undefined) force = !this._s.has(c); force ? this._s.add(c) : this._s.delete(c); },
      contains(c){ return this._s.has(c); }
    },
    appendChild(ch){ this.children.push(ch); if(ch.id) registry[ch.id] = ch; },
    blur(){}, addEventListener(){}, style: {}
  };
  // innerHTML assignment registers any id="..." found inside, like a real DOM
  Object.defineProperty(el, 'innerHTML', {
    set(html){
      this._html = html;
      const re = /id="([^"]+)"/g;
      let m;
      while((m = re.exec(html))){
        if(!registry[m[1]]) makeEl(m[1]);
      }
    },
    get(){ return this._html || ''; }
  });
  if(id) registry[id] = el;
  return el;
}
// Pre-register every static id used by the game
['game','toast','fade','shop','shop-panel','shop-gold','buy-list','sell-list',
 'btn-shop','btn-close-shop','btn-sleep','btn-save','btn-mute',
 'tool-hoe','tool-seed','tool-water','tool-harvest','seed-cur','seed-cur-btn',
 'bag','hud-money','hud-day','hud-clock','hint','shop-close-row','wrap','topbar','toolbar'
].forEach(id => makeEl(id));

const ctxProxy = new Proxy({}, {
  get(t, p){ if(!(p in t)) t[p] = function(){}; return t[p]; },
  set(t, p, v){ t[p] = v; return true; }
});
const canvasEl = registry['game'];
canvasEl.width = 800; canvasEl.height = 520;
canvasEl.getContext = () => ctxProxy;
canvasEl.getBoundingClientRect = () => ({left:0, top:0, width:800, height:520});

const canvasHandlers = {};
canvasEl.addEventListener = (ev, fn) => { canvasHandlers[ev] = fn; };

const winHandlers = {};
const store = {};
let rafCb = null;

const sandbox = {
  console,
  document: {
    getElementById: id => registry[id] || null,
    createElement: tag => makeEl('')
  },
  addEventListener: (ev, fn) => { winHandlers[ev] = fn; },
  window: { addEventListener: (ev, fn) => { winHandlers['win:' + ev] = fn; } },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  requestAnimationFrame: cb => { rafCb = cb; },
  performance, setTimeout, clearTimeout, Math, JSON
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox, {filename: 'game.js'});

// ---- assertions ----
let failures = 0;
function ok(cond, label){
  if(cond) console.log('PASS  ' + label);
  else { failures++; console.log('FAIL  ' + label); }
}
const g = code => vm.runInContext(code, sandbox);

ok(g('money') === 60, 'new game starts with 60g');
ok(g('seeds.carrot') === 5 && g('seeds.potato') === 2, 'starting seeds 5 carrot + 2 potato');
ok(g('day') === 1 && g('tiles.length') === 13 && g('tiles[0].length') === 20, 'map 20x13, day 1');

// hoe -> plant -> water
g("setTool('hoe'); useToolAt(10, 6);");
ok(g('tiles[6][10].tilled') === true, 'hoe tills grass');
g("setTool('seed'); seedSel = 0; useToolAt(10, 6);");
ok(g("tiles[6][10].crop && tiles[6][10].crop.type === 'carrot'"), 'carrot planted');
ok(g('seeds.carrot') === 4, 'seed consumed');
g("setTool('water'); useToolAt(10, 6);");
ok(g('tiles[6][10].watered') === true, 'soil watered');

// growth over days (carrot needs 2 watered days)
g('advanceDay();');
ok(g('tiles[6][10].crop.age') === 1, 'crop grew to age 1 after watered day');
ok(g('tiles[6][10].watered') === false, 'soil dries overnight');
ok(g('day') === 2, 'day advanced');
g("setTool('harvest'); useToolAt(10, 6);");
ok(g('produce.carrot') === 0, 'immature crop cannot be harvested');
ok(g('tiles[6][10].crop') !== null, 'crop still there after failed harvest');
g("setTool('water'); useToolAt(10, 6); advanceDay();");
ok(g('tiles[6][10].crop.age') === 2, 'crop mature at age 2');
g("setTool('harvest'); useToolAt(10, 6);");
ok(g('produce.carrot') === 1, 'harvest yields 1 carrot');
ok(g('tiles[6][10].crop') === null && g('tiles[6][10].tilled') === true, 'plot cleared, stays tilled');

// shop: sell produce, buy seeds
g('openShop();');
ok(g('paused') === true, 'shop pauses game');
g("document.getElementById('sell-carrot').onclick();");
ok(g('money') === 84, 'sold carrot for 24g (60+24)');
g("document.getElementById('buy-tomato').onclick();");
ok(g('seeds.tomato') === 1 && g('money') === 49, 'bought tomato seed for 35g');
g('closeShop();');
ok(g('paused') === false, 'closing shop unpauses');

// unwatered crop does not grow
g("setTool('hoe'); useToolAt(11, 6);");
g("setTool('seed'); seedSel = 1; useToolAt(11, 6);");   // potato, no water
ok(g("tiles[6][11].crop && tiles[6][11].crop.type === 'potato'"), 'potato planted');
g('advanceDay();');
ok(g('tiles[6][11].crop.age') === 0, 'unwatered crop does not grow overnight');

// keyboard targeting uses facing tile
g("player.fx = 0; player.fy = 1; const tt = targetTile(); tt && tt.ty > Math.floor(player.y/40);");
ok(g("player.fx=0;player.fy=1;targetTile().ty") > Math.floor(g('player.y')/40), 'target tile in front of player');

// save / load round trip
g('save(true);');
const moneyNow = g('money'), dayNow = g('day');
g('money = 1; day = 99;');
ok(g('load()') === true, 'load() succeeds');
ok(g('money') === moneyNow && g('day') === dayNow, 'save/load round trip restores state');

// run a few real frames (update + draw through stubs)
let t = 1000;
for(let i=0;i<5;i++){
  const cb = rafCb; rafCb = null;
  t += 16.7; cb(t);
  if(!rafCb){ failures++; console.log('FAIL  loop did not re-register rAF'); break; }
}
ok(true, 'game loop frames run without errors');

// mouse click path
canvasHandlers['mousemove']({clientX: 5 * 40 + 20, clientY: 3 * 40 + 20});
canvasHandlers['mousedown']({clientX: 5 * 40 + 20, clientY: 3 * 40 + 20});
ok(true, 'mouse move/click handled without errors');

// keyboard handler path
winHandlers['keydown']({key: '2', preventDefault(){}});
ok(g("tool") === 'seed', 'hotkey 2 selects seed tool');

console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' TEST(S) FAILED');
process.exit(failures ? 1 : 0);

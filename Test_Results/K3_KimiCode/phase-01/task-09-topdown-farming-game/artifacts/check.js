'use strict';
// ============================== Config ==============================
const TILE = 40, MAP_W = 20, MAP_H = 13;
const DAY_LEN = 180;            // real seconds per in-game day
const SAVE_KEY = 'pocket-farm-save-v1';
const CROPS = {
  carrot:  { name:'Carrot',  icon:'🥕', seedCost:10, sell:24,  growDays:2, fruit:'#f08a24', leaf:'#4e9b3a', leafDark:'#3c7a2d' },
  potato:  { name:'Potato',  icon:'🥔', seedCost:20, sell:50,  growDays:3, fruit:'#c9a35f', leaf:'#5f9e46', leafDark:'#4a7d37' },
  tomato:  { name:'Tomato',  icon:'🍅', seedCost:35, sell:85,  growDays:4, fruit:'#e23b2e', leaf:'#3f8f3f', leafDark:'#317031' },
  pumpkin: { name:'Pumpkin', icon:'🎃', seedCost:60, sell:160, growDays:6, fruit:'#e8771c', leaf:'#3e7d34', leafDark:'#2f6128' }
};
const CROP_KEYS = Object.keys(CROPS);
const TOOLS = ['hoe','seed','water','harvest'];
const MILESTONES = [500, 2000, 10000];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => v<a?a:(v>b?b:v);

// ============================== State ===============================
let tiles, player, day, timeOfDay, money, seeds, produce, tool, seedSel, muted;
let paused = false, shopOpen = false, sleeping = false, isMoving = false;
let hoverTile = null, walkCycle = 0;
const keys = {};
const reached = {};

function newGame(){
  tiles = [];
  for(let y=0; y<MAP_H; y++){
    const row = [];
    for(let x=0; x<MAP_W; x++) row.push({tilled:false, watered:false, crop:null});
    tiles.push(row);
  }
  player = {x:MAP_W*TILE/2, y:MAP_H*TILE/2, fx:0, fy:1};
  day = 1; timeOfDay = 0; money = 60; tool = 'hoe'; seedSel = 0; muted = false;
  seeds = {}; produce = {};
  CROP_KEYS.forEach(k => { seeds[k] = 0; produce[k] = 0; });
  seeds.carrot = 5; seeds.potato = 2;
}

// ============================ Save / Load ===========================
function save(silent){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      day, timeOfDay, money, seeds, produce, tiles, muted,
      px: player.x, py: player.y
    }));
    if(!silent) showToast('Game saved 💾');
  }catch(e){ /* storage unavailable — play on without saving */ }
}
function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !Array.isArray(s.tiles) || s.tiles.length !== MAP_H || s.tiles[0].length !== MAP_W) return false;
    tiles = s.tiles;
    day = s.day|0 || 1; timeOfDay = +s.timeOfDay || 0; money = s.money|0;
    seeds = Object.assign({}, s.seeds); produce = Object.assign({}, s.produce);
    CROP_KEYS.forEach(k => { seeds[k] = seeds[k]|0; produce[k] = produce[k]|0; });
    player = {x:+s.px || MAP_W*TILE/2, y:+s.py || MAP_H*TILE/2, fx:0, fy:1};
    tool = 'hoe'; seedSel = 0; muted = !!s.muted;
    return true;
  }catch(e){ return false; }
}

// ============================== Audio ===============================
let audioCtx = null;
function sfx(freq, dur, type, vol){
  if(muted) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'square'; o.frequency.value = freq || 440;
    g.gain.value = vol || 0.05;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.08));
    o.stop(audioCtx.currentTime + (dur || 0.08));
  }catch(e){}
}

// ============================= UI helpers ===========================
let toastTimer = null, lastMsg = '', lastMsgT = 0;
function showToast(text){
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function msg(text){
  const now = performance.now();
  if(text === lastMsg && now - lastMsgT < 800) return;
  lastMsg = text; lastMsgT = now;
  showToast(text);
}
function addMoney(d){
  money += d;
  for(const m of MILESTONES){
    if(money >= m && !reached[m]){ reached[m] = 1; showToast('🎉 Milestone: ' + m + 'g in the pocket!'); }
  }
}
function clockText(){
  const h = 6 + timeOfDay * 18;               // 6:00 → 24:00
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 6) * 10;
  return hh + ':' + String(mm).padStart(2, '0');
}

// ============================ Core actions ==========================
function targetTile(){
  const tx = Math.floor((player.x + player.fx * TILE * 1.05) / TILE);
  const ty = Math.floor((player.y + player.fy * TILE * 1.05) / TILE);
  if(tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return null;
  return {tx, ty};
}
function canReach(tx, ty){
  return Math.hypot(tx*TILE + TILE/2 - player.x, ty*TILE + TILE/2 - player.y) <= TILE * 2.3;
}
function useToolAt(tx, ty){
  if(paused || tx == null || tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
  const t = tiles[ty][tx];
  if(tool === 'hoe'){
    if(t.crop) return msg('A crop is growing here');
    if(t.tilled) return;
    t.tilled = true;
    sfx(150, 0.09, 'square', 0.06);
  }else if(tool === 'seed'){
    if(!t.tilled) return msg('Till the soil first (⛏️ Hoe)');
    if(t.crop) return;
    const k = CROP_KEYS[seedSel];
    if(seeds[k] <= 0) return msg('No ' + CROPS[k].name + ' seeds — press B for the shop');
    seeds[k]--;
    t.crop = {type:k, age:0};
    sfx(500, 0.07, 'triangle', 0.07);
  }else if(tool === 'water'){
    if(!t.tilled) return;
    if(t.watered) return;
    t.watered = true;
    sfx(760, 0.12, 'sine', 0.06);
  }else if(tool === 'harvest'){
    if(!t.crop) return;
    const c = CROPS[t.crop.type];
    if(t.crop.age < c.growDays) return msg('Not ready yet — water it and wait!');
    produce[t.crop.type]++;
    t.crop = null;                     // soil stays tilled for replanting
    sfx(880, 0.08, 'square', 0.05);
    setTimeout(() => sfx(1174, 0.1, 'square', 0.05), 70);
    showToast('+1 ' + c.icon + ' ' + c.name + ' — sell it in the shop');
  }
}
function setTool(t){ tool = t; }
function cycleSeed(){
  seedSel = (seedSel + 1) % CROP_KEYS.length;
  sfx(650, 0.05, 'triangle', 0.05);
}

// ============================ Day cycle =============================
function advanceDay(){
  day++;
  timeOfDay = 0;
  for(let y=0; y<MAP_H; y++){
    for(let x=0; x<MAP_W; x++){
      const t = tiles[y][x];
      if(t.crop && t.watered){
        const g = CROPS[t.crop.type].growDays;
        if(t.crop.age < g) t.crop.age++;
      }
      t.watered = false;               // soil dries overnight
    }
  }
  save(true);
}
function sleep(){
  if(sleeping) return;
  sleeping = true; paused = true;
  $('fade').classList.add('on');
  setTimeout(() => {
    advanceDay();
    $('fade').classList.remove('on');
    paused = false; sleeping = false;
    showToast('☀️ Day ' + day + ' — a fresh start!');
  }, 500);
}

// ============================== Shop ================================
function buildShop(){
  const buy = $('buy-list'), sell = $('sell-list');
  buy.innerHTML = ''; sell.innerHTML = '';
  CROP_KEYS.forEach(k => {
    const c = CROPS[k];
    const r = document.createElement('div');
    r.className = 'shop-row';
    r.innerHTML = '<span>' + c.icon + '</span><span class="nm">' + c.name +
                  ' seed <small>(' + c.growDays + 'd, sells ' + c.sell + 'g)</small></span>' +
                  '<span id="buy-have-' + k + '"></span>';
    const b = document.createElement('button');
    b.id = 'buy-' + k; b.textContent = 'Buy ' + c.seedCost + 'g';
    b.onclick = () => {
      if(money >= c.seedCost){ addMoney(-c.seedCost); seeds[k]++; sfx(600, 0.06, 'square', 0.05); refreshShop(); }
    };
    r.appendChild(b); buy.appendChild(r);

    const r2 = document.createElement('div');
    r2.className = 'shop-row';
    r2.innerHTML = '<span>' + c.icon + '</span><span class="nm">' + c.name + '</span>' +
                   '<span id="sell-have-' + k + '"></span>';
    const b1 = document.createElement('button');
    b1.id = 'sell-' + k; b1.textContent = 'Sell ' + c.sell + 'g';
    b1.onclick = () => {
      if(produce[k] > 0){ produce[k]--; addMoney(c.sell); sfx(900, 0.07, 'square', 0.05); refreshShop(); }
    };
    const b2 = document.createElement('button');
    b2.id = 'sellall-' + k; b2.textContent = 'All';
    b2.onclick = () => {
      if(produce[k] > 0){
        addMoney(produce[k] * c.sell); produce[k] = 0;
        sfx(900, 0.07, 'square', 0.05);
        setTimeout(() => sfx(1200, 0.08, 'square', 0.05), 80);
        refreshShop();
      }
    };
    r2.appendChild(b1); r2.appendChild(b2); sell.appendChild(r2);
  });
}
function refreshShop(){
  $('shop-gold').textContent = '💰 ' + money + 'g';
  CROP_KEYS.forEach(k => {
    $('buy-have-' + k).textContent = 'have ' + seeds[k];
    $('buy-' + k).disabled = money < CROPS[k].seedCost;
    $('sell-have-' + k).textContent = 'have ' + produce[k];
    $('sell-' + k).disabled = produce[k] <= 0;
    $('sellall-' + k).disabled = produce[k] <= 0;
  });
}
function openShop(){
  if(shopOpen) return;
  shopOpen = true; paused = true;
  refreshShop();
  $('shop').classList.remove('hidden');
}
function closeShop(){
  if(!shopOpen) return;
  shopOpen = false; paused = false;
  $('shop').classList.add('hidden');
}

// ============================== Input ===============================
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  keys[k] = true;
  if(k === '1') setTool('hoe');
  if(k === '2') setTool('seed');
  if(k === '3') setTool('water');
  if(k === '4') setTool('harvest');
  if(k === 'q') cycleSeed();
  if(k === 'b' && !shopOpen) openShop();
  if(k === 'escape') closeShop();
  if((k === ' ' || k === 'enter') && !shopOpen){
    const tt = targetTile();
    if(tt) useToolAt(tt.tx, tt.ty);
  }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for(const k in keys) keys[k] = false; });
window.addEventListener('beforeunload', () => save(true));

function eventTile(e){
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * canvas.width / rect.width;
  const cy = (e.clientY - rect.top) * canvas.height / rect.height;
  return {tx: Math.floor(cx / TILE), ty: Math.floor(cy / TILE)};
}
canvas.addEventListener('mousemove', e => {
  const t = eventTile(e);
  hoverTile = (t.tx >= 0 && t.ty >= 0 && t.tx < MAP_W && t.ty < MAP_H) ? t : null;
});
canvas.addEventListener('mouseleave', () => { hoverTile = null; });
canvas.addEventListener('mousedown', e => {
  if(paused) return;
  const t = eventTile(e);
  if(t.tx < 0 || t.ty < 0 || t.tx >= MAP_W || t.ty >= MAP_H) return;
  if(!canReach(t.tx, t.ty)) return msg('Too far — walk closer');
  useToolAt(t.tx, t.ty);
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if(paused || !e.touches.length) return;
  const t = eventTile(e.touches[0]);
  if(t.tx < 0 || t.ty < 0 || t.tx >= MAP_W || t.ty >= MAP_H) return;
  if(!canReach(t.tx, t.ty)) return msg('Too far — walk closer');
  useToolAt(t.tx, t.ty);
}, {passive:false});

// ============================= Rendering ============================
function hash2(x, y){
  let h = (x * 374761393 + y * 668265263) ^ (x * 1274126177);
  h = (h ^ (h >> 13)) * 1103515245;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function ell(x, y, rx, ry, col){
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function stageOf(crop){
  const g = CROPS[crop.type].growDays;
  if(crop.age >= g) return 3;
  return Math.min(2, Math.floor(crop.age / g * 3));
}
function drawTiles(){
  for(let y=0; y<MAP_H; y++){
    for(let x=0; x<MAP_W; x++){
      const t = tiles[y][x], px = x * TILE, py = y * TILE;
      ctx.fillStyle = (x + y) % 2 ? '#8abd69' : '#83b361';
      ctx.fillRect(px, py, TILE, TILE);
      for(let i=0; i<3; i++){                       // deterministic grass speckles
        const rx = hash2(x * 3 + i, y), ry = hash2(x, y * 3 + i);
        ctx.fillStyle = 'rgba(90,140,70,.5)';
        ctx.fillRect(px + 4 + rx * 30, py + 4 + ry * 30, 3, 3);
      }
      if(t.tilled){
        ctx.fillStyle = t.watered ? '#6b4527' : '#8a5a34';
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = t.watered ? '#57371f' : '#754a2b';
        for(let r=0; r<3; r++) ctx.fillRect(px + 5, py + 9 + r * 10, TILE - 10, 3);
        if(t.watered){
          ctx.fillStyle = 'rgba(120,160,220,.35)';
          for(let i=0; i<3; i++){
            const rx = hash2(x + i * 7, y), ry = hash2(x, y + i * 7);
            ctx.fillRect(px + 6 + rx * 26, py + 6 + ry * 26, 3, 2);
          }
        }
      }
    }
  }
}
function drawCrop(x, y, crop){
  const c = CROPS[crop.type], st = stageOf(crop);
  const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if(st === 0){
    ell(-4, 6, 3, 5, c.leaf); ell(4, 6, 3, 5, c.leaf);
  }else if(st === 1){
    ctx.strokeStyle = c.leafDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -4); ctx.stroke();
    ell(-6, 3, 4, 6, c.leaf); ell(6, 3, 4, 6, c.leaf); ell(0, -3, 4, 6, c.leaf);
  }else{
    ell(0, 3, 11, 8, c.leafDark);
    ell(-4, -1, 6, 6, c.leaf); ell(5, 0, 6, 6, c.leaf); ell(0, 5, 7, 5, c.leaf);
    if(st === 3){
      if(crop.type === 'pumpkin'){
        ell(0, 8, 9, 6.5, c.fruit);
        ctx.strokeStyle = '#a85410'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-3, 3); ctx.lineTo(-3, 13); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(3, 13); ctx.stroke();
      }else if(crop.type === 'carrot'){
        ell(-4, 9, 3.5, 3, c.fruit); ell(4, 9, 3.5, 3, c.fruit);
      }else{
        ell(-5, 2, 4, 4, c.fruit); ell(5, 4, 4, 4, c.fruit); ell(0, -3, 4, 4, c.fruit);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillRect(-6, 0, 2, 2); ctx.fillRect(4, 2, 2, 2);
      }
    }
  }
  ctx.restore();
}
function drawPlayer(){
  const p = player;
  const bob = isMoving ? Math.sin(walkCycle) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ell(0, 12, 9, 3.5, 'rgba(0,0,0,.25)');
  ctx.fillStyle = '#54402c';
  ctx.fillRect(-6, 4 + bob, 5, 8);
  ctx.fillRect(1, 4 - bob, 5, 8);
  ctx.fillStyle = '#3e6da8';
  ctx.fillRect(-8, -8, 16, 14);
  ctx.fillStyle = '#f2c99a';
  ctx.fillRect(-8, -8, 16, 4);
  ell(0, -14, 7, 7, '#f2c99a');
  ctx.fillStyle = '#2b2118';
  ctx.fillRect(-3 + p.fx * 2.5, -16 + p.fy * 2, 2, 2.5);
  ctx.fillRect(1.5 + p.fx * 2.5, -16 + p.fy * 2, 2, 2.5);
  ell(0, -19, 10, 4, '#d9a441');
  ctx.fillStyle = '#c8912f';
  ctx.fillRect(-6, -26, 12, 8);
  ell(0, -26, 6, 3, '#c8912f');
  ctx.restore();
}
function draw(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTiles();
  for(let y=0; y<MAP_H; y++)
    for(let x=0; x<MAP_W; x++)
      if(tiles[y][x].crop) drawCrop(x, y, tiles[y][x].crop);
  drawPlayer();

  const tt = targetTile();
  if(tt){
    ctx.strokeStyle = 'rgba(255,255,220,.75)'; ctx.lineWidth = 2;
    ctx.strokeRect(tt.tx * TILE + 2, tt.ty * TILE + 2, TILE - 4, TILE - 4);
  }
  if(hoverTile && canReach(hoverTile.tx, hoverTile.ty)){
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(hoverTile.tx * TILE, hoverTile.ty * TILE, TILE, TILE);
  }
  const night = clamp((timeOfDay - 0.72) / 0.28, 0, 1) * 0.38;
  if(night > 0){
    ctx.fillStyle = 'rgba(20,28,70,' + night.toFixed(3) + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// =============================== HUD ================================
function refreshHUD(){
  $('hud-money').textContent = '💰 ' + money + 'g';
  $('hud-day').textContent = '📅 Day ' + day;
  $('hud-clock').textContent = '🕒 ' + clockText();
  TOOLS.forEach(t => $('tool-' + t).classList.toggle('active', t === tool));
  const k = CROP_KEYS[seedSel];
  $('seed-cur').textContent = CROPS[k].icon + ' ' + CROPS[k].name + ' ×' + seeds[k];
  let bag = '';
  CROP_KEYS.forEach(k2 => { if(produce[k2] > 0) bag += CROPS[k2].icon + '×' + produce[k2] + ' '; });
  $('bag').textContent = bag ? '🧺 ' + bag : '🧺 empty';
}

// ============================= Game loop ============================
function update(dt){
  let dx = 0, dy = 0;
  if(keys['w'] || keys['arrowup']) dy -= 1;
  if(keys['s'] || keys['arrowdown']) dy += 1;
  if(keys['a'] || keys['arrowleft']) dx -= 1;
  if(keys['d'] || keys['arrowright']) dx += 1;
  isMoving = false;
  const len = Math.hypot(dx, dy);
  if(len > 0){
    dx /= len; dy /= len;
    const sp = 150;
    player.x = clamp(player.x + dx * sp * dt, 12, MAP_W * TILE - 12);
    player.y = clamp(player.y + dy * sp * dt, 16, MAP_H * TILE - 8);
    if(Math.abs(dx) > Math.abs(dy)){ player.fx = Math.sign(dx); player.fy = 0; }
    else{ player.fx = 0; player.fy = Math.sign(dy); }
    isMoving = true;
    walkCycle += dt * 10;
  }
  timeOfDay += dt / DAY_LEN;
  if(timeOfDay >= 1){
    advanceDay();
    showToast('🌙 You dozed off in the field... Day ' + day + ' begins');
  }
  refreshHUD();
}
let lastT = performance.now();
function loop(now){
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.05);
  if(!paused) update(dt);
  draw();
  requestAnimationFrame(loop);
}

// =============================== Init ===============================
function init(){
  const hadSave = load();
  if(!hadSave) newGame();
  buildShop();
  refreshHUD();

  TOOLS.forEach(t => {
    const b = $('tool-' + t);
    b.onclick = () => { setTool(t); b.blur(); };
  });
  $('seed-cur-btn').onclick = e => { cycleSeed(); e.currentTarget.blur(); };
  $('btn-shop').onclick = e => { openShop(); e.currentTarget.blur(); };
  $('btn-close-shop').onclick = () => closeShop();
  $('btn-sleep').onclick = e => { sleep(); e.currentTarget.blur(); };
  $('btn-save').onclick = e => { save(false); e.currentTarget.blur(); };
  $('btn-mute').onclick = e => {
    muted = !muted;
    $('btn-mute').textContent = muted ? '🔇' : '🔊';
    save(true);
    e.currentTarget.blur();
  };
  $('btn-mute').textContent = muted ? '🔇' : '🔊';

  if(!hadSave) showToast('Welcome! ⛏️ Till → 🌱 plant → 💧 water daily → 🧺 harvest → 🏪 sell');
  else showToast('Welcome back! Save loaded 📂');
  requestAnimationFrame(loop);
}
init();

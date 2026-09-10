// 第二轮细化探针（Muse Spark 1.3 / phase-02 / Task 16–20）。
//
// 第一轮 `evaluate.mjs` 用整页截图判断"是否在动"，对带 UI 动画的页面会误判。本轮改为：
//   ① 只对 canvas 元素截图做比对（不受页面 UI 动效干扰）；
//   ② 直接读取应用自己的读数（task-18 的 #hudTime、task-19 的 #sim-date）；
//   ③ task-17 读取各 SVG 元素的 rotate 角度差，用方向/角速度检验"啮合齿轮反向"；
//   ④ task-20 用 Store → New → Recall 检验存取往返。
// 仍然**不运行成果自带的脚本**，不改动成果文件。
//
// 运行：node evaluate-2.mjs    输出：checks-2.json

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../..');
const { chromium } = createRequire(path.join(repoRoot, 'website', 'package.json'))('playwright');
const phaseRoot = path.resolve(here, '../..');
const runsRoot = path.join(phaseRoot, 'runs');

const mime = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
function serveDirectory(directory) {
  const server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(directory, relative);
    if (!file.startsWith(path.resolve(directory) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

/** 只看 canvas 是否变化（整页 UI 动效不影响判断）。 */
async function canvasMoving(page, gapMs = 700) {
  const canvas = page.locator('canvas').first();
  if (await canvas.count() === 0) return null;
  const before = await canvas.screenshot();
  await page.waitForTimeout(gapMs);
  const after = await canvas.screenshot();
  return !before.equals(after);
}

const probes = {
  async 'task-17'(page) {
    const sample = () => page.evaluate(() => [...document.querySelectorAll('[transform]')]
      .map((node) => ({ id: node.id || null, tag: node.tagName, transform: node.getAttribute('transform') }))
      .filter((item) => /rotate\(/.test(item.transform ?? ''))
      .map((item) => ({
        key: item.id || item.tag,
        angle: Number((item.transform.match(/rotate\(\s*(-?[\d.]+)/) ?? [])[1] ?? NaN),
      }))
      .filter((item) => Number.isFinite(item.angle)));
    const first = await sample();
    await page.waitForTimeout(1500);
    const second = await sample();
    const deltas = [];
    for (const item of first) {
      const later = second.find((candidate) => candidate.key === item.key);
      if (!later) continue;
      let delta = later.angle - item.angle;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      if (Math.abs(delta) > 0.05) deltas.push({ key: item.key, deltaDegrees: Number(delta.toFixed(3)) });
    }
    return {
      rotatingElements: deltas.length,
      clockwise: deltas.filter((item) => item.deltaDegrees > 0).length,
      counterClockwise: deltas.filter((item) => item.deltaDegrees < 0).length,
      fastest: deltas.slice().sort((a, b) => Math.abs(b.deltaDegrees) - Math.abs(a.deltaDegrees)).slice(0, 6),
      slowest: deltas.slice().sort((a, b) => Math.abs(a.deltaDegrees) - Math.abs(b.deltaDegrees)).slice(0, 4),
    };
  },

  async 'task-18'(page) {
    const readTime = async () => Number(((await page.locator('#hudTime').first().textContent()) ?? '').replace(/[^\d.]/g, ''));
    const readHud = async () => ((await page.locator('#hudText').first().textContent()) ?? '').trim();
    await page.click('#btnStart');
    await page.waitForTimeout(1500);
    const runningTime = await readTime();
    await page.click('#btnPause');
    await page.waitForTimeout(250);
    const pausedA = await readTime();
    await page.waitForTimeout(800);
    const pausedB = await readTime();
    const canvasFrozenWhilePaused = await canvasMoving(page, 700);
    await page.click('#btnStep');
    await page.waitForTimeout(200);
    const afterStep = await readTime();
    await page.click('#btnStepSlow');
    await page.waitForTimeout(200);
    const afterStepSlow = await readTime();
    const hudAtPause = await readHud();
    await page.click('#btnReset');
    await page.waitForTimeout(300);
    const afterReset = await readTime();
    await page.click('#btnStart');
    const stages = [];
    for (let i = 0; i < 8; i += 1) {
      await page.waitForTimeout(1400);
      stages.push(await readHud());
    }
    return {
      runningTime, pausedA, pausedB, frozenWhilePaused: pausedA === pausedB,
      canvasFrozenWhilePaused,
      afterStep, stepDelta: Number((afterStep - pausedB).toFixed(3)),
      afterStepSlow, stepSlowDelta: Number((afterStepSlow - afterStep).toFixed(3)),
      hudAtPause, afterReset, stagesObserved: [...new Set(stages)],
    };
  },

  async 'task-19'(page) {
    const readDate = async () => Number(((await page.locator('#sim-date').first().textContent()) ?? '').replace(/[^\d.]/g, ''));
    const moving1 = await canvasMoving(page, 700);
    await page.click('#btn-pause');
    await page.waitForTimeout(250);
    const pausedMoving = await canvasMoving(page, 700);
    const pausedDateA = await readDate();
    await page.waitForTimeout(600);
    const pausedDateB = await readDate();
    await page.click('#btn-pause');
    await page.waitForTimeout(200);
    const speedBefore = await readDate();
    await page.waitForTimeout(1000);
    const speedAfter = await readDate();
    const slowRate = speedAfter - speedBefore;
    await page.evaluate(() => {
      const slider = document.querySelector('input[type="range"]');
      if (!slider) return;
      slider.value = String(Number(slider.max || 5));
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const fastBefore = await readDate();
    await page.waitForTimeout(1000);
    const fastAfter = await readDate();
    return {
      canvasMovingWhileRunning: moving1,
      canvasMovingWhilePaused: pausedMoving,
      pausedClockFrozen: pausedDateA === pausedDateB,
      pausedDateA, pausedDateB,
      rateAtDefaultSpeedPerSecond: Number(slowRate.toFixed(2)),
      rateAtMaxSpeedPerSecond: Number((fastAfter - fastBefore).toFixed(2)),
    };
  },

  async 'task-20'(page) {
    const shots = {};
    await page.click('#btnExFour');
    await page.waitForTimeout(400);
    await page.click('#btnPlay');
    const playingMoving = await canvasMoving(page, 800);
    await page.click('#btnPlay');
    await page.waitForTimeout(250);
    const pausedMoving = await canvasMoving(page, 700);
    await page.click('#btnStep');
    await page.waitForTimeout(250);
    const stepMoved = await canvasMoving(page, 300);
    await page.click('#btnExSlider');
    await page.waitForTimeout(400);
    await page.click('#btnPlay');
    const sliderMoving = await canvasMoving(page, 800);
    await page.click('#btnPlay');
    // Store → New → Recall 往返
    await page.click('#btnExFour');
    await page.waitForTimeout(400);
    const canvas = page.locator('canvas').first();
    shots.stored = await canvas.screenshot();
    await page.click('#btnSlotSave');
    await page.click('#btnNew');
    await page.waitForTimeout(400);
    shots.cleared = await canvas.screenshot();
    await page.click('#btnSlotLoad');
    await page.waitForTimeout(400);
    shots.recalled = await canvas.screenshot();
    return {
      fourBarPlayingMoving: playingMoving,
      pausedCanvasFrozen: pausedMoving === false,
      stepChangedCanvas: stepMoved,
      crankSliderMoving: sliderMoving,
      clearActuallyChangedView: !shots.stored.equals(shots.cleared),
      recallRestoredStoredView: shots.stored.equals(shots.recalled),
    };
  },
};

const runs = [
  { id: 'task-17', dir: 'run-muse-spark-1-3-xhigh-task-17-r1', entry: 'index.html' },
  { id: 'task-18', dir: 'run-muse-spark-1-3-xhigh-task-18-r1', entry: 'index.html' },
  { id: 'task-19', dir: 'run-muse-spark-1-3-xhigh-task-19-r1', entry: 'index.html' },
  { id: 'task-20', dir: 'run-muse-spark-1-3-xhigh-task-20-r1', entry: 'index.html' },
];

const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), note: '第二轮细化探针：canvas 级比对 + 应用读数 + 存取往返', runs: {} };
try {
  for (const run of runs) {
    const { server, port } = await serveDirectory(path.join(runsRoot, run.dir, 'artifacts'));
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(`console: ${message.text()}`));
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    let observations = {}; let failure = null;
    try {
      await page.goto(`http://127.0.0.1:${port}/${run.entry}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(1000);
      observations = await probes[run.id](page);
    } catch (error) {
      failure = String(error?.message ?? error);
    }
    report.runs[run.id] = { runId: run.dir, consoleErrors: errors, observations, probeFailure: failure };
    console.log(`${run.id}: ${failure ? `FAILED ${failure}` : 'ok'}`);
    await page.close();
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(here, 'checks-2.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('wrote checks-2.json');

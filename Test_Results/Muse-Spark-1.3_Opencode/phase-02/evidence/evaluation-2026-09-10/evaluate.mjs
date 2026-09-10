// 维护 agent 的评价取证脚本（Muse Spark 1.3 / phase-02 / Task 16–20）。
//
// 作用：把每个运行的成果用**组织者自己的**静态服务 + Chromium 无头渲染加载，收集
//   ① 控制台/页面错误 ② 任务级 DOM 探针 ③ 关键状态截图，
// 供 AI 评价引用。**不运行成果自带的脚本**（如 run_tests.js），不改动任何成果文件。
//
// 运行：node evaluate.mjs      （需要 Playwright Chromium，已随 website 依赖安装）
// 输出：本目录下 checks.json 与 <taskId>-NN-<label>.png

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../..');
// 浏览器依赖只装在展示站里，按 website/ 解析，不在归档目录里放 node_modules。
const { chromium } = createRequire(path.join(repoRoot, 'website', 'package.json'))('playwright');
const phaseRoot = path.resolve(here, '../..');
const runsRoot = path.join(phaseRoot, 'runs');
const outDir = here;

const mime = {
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
};

function serveDirectory(directory) {
  const server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(directory, relative);
    if (!file.startsWith(path.resolve(directory) + path.sep) && file !== path.resolve(directory)) {
      response.writeHead(403).end('forbidden');
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

/** 连续两次截图是否不同 → 判断画面是否仍在变化。 */
async function isMoving(page, gapMs = 800) {
  const before = await page.screenshot();
  await page.waitForTimeout(gapMs);
  const after = await page.screenshot();
  return !before.equals(after);
}

const probes = {
  async 'task-16'(page, shot) {
    const svg = await page.evaluate(() => {
      const root = document.querySelector('#rootSvg');
      return {
        hasRoot: Boolean(root),
        viewBox: root?.getAttribute('viewBox') ?? null,
        animateCount: document.querySelectorAll('animate, animateTransform, animateMotion').length,
        hasPauseApi: typeof root?.pauseAnimations === 'function',
        controls: { pause: Boolean(document.querySelector('#pauseBtn')), play: Boolean(document.querySelector('#playBtn')) },
        title: document.querySelector('title')?.textContent ?? null,
        ariaLabel: root?.getAttribute('aria-label') ?? null,
      };
    });
    await shot('01-initial');
    const movingBeforePause = await isMoving(page);
    await page.click('#pauseBtn');
    const frozen = !(await isMoving(page, 800));
    const statusText = await page.locator('#statusText').first().textContent().catch(() => null);
    await shot('02-paused');
    await page.click('#playBtn');
    const movingAfterResume = await isMoving(page);
    await shot('03-resumed');
    return { svg, movingBeforePause, frozenWhilePaused: frozen, movingAfterResume, statusText: statusText?.trim() ?? null };
  },

  async 'task-17'(page, shot) {
    await shot('01-initial');
    const dom = await page.evaluate(() => ({
      svgCount: document.querySelectorAll('svg').length,
      animateCount: document.querySelectorAll('animate, animateTransform, animateMotion, animateMotion').length,
      gearLike: document.querySelectorAll('[id^="L-"]').length,
      pause: Boolean(document.querySelector('#pauseBtn')),
      speed: document.querySelector('#speed')?.getAttribute('value') ?? null,
      hands: ['hour', 'minute', 'second'].map((key) => document.querySelectorAll(`[id*="${key}" i]`).length),
    }));
    const moving = await isMoving(page);
    await page.click('#pauseBtn');
    const frozen = !(await isMoving(page, 800));
    await shot('02-paused');
    await page.click('#pauseBtn');
    await page.evaluate(() => {
      const slider = document.querySelector('#speed');
      slider.value = '2.5';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const movingAtHigherSpeed = await isMoving(page);
    await shot('03-speed-2.5');
    return { dom, movingBeforePause: moving, frozenWhilePaused: frozen, movingAtHigherSpeed };
  },

  async 'task-18'(page, shot) {
    const dom = await page.evaluate(() => ({
      canvas: document.querySelectorAll('canvas').length,
      controls: ['btnStart', 'btnPause', 'btnResume', 'btnReset', 'btnStep', 'btnStepSlow', 'btnSound'].filter((id) => document.querySelector(`#${id}`)),
      speedSlider: Boolean(document.querySelector('#speed')),
      hud: document.querySelector('#hudText')?.textContent?.trim() ?? null,
    }));
    await shot('01-idle');
    await page.click('#btnStart');
    await page.waitForTimeout(2500);
    const hudRunning = await page.locator('#hudText').first().textContent().catch(() => null);
    await shot('02-running');
    await page.click('#btnPause');
    await page.waitForTimeout(200);
    const frozenWhilePaused = !(await isMoving(page, 700));
    const hudPaused = await page.locator('#hudText').first().textContent().catch(() => null);
    await page.click('#btnStep');
    await page.waitForTimeout(200);
    const stepChanged = hudPaused !== (await page.locator('#hudText').first().textContent().catch(() => null));
    await shot('03-paused');
    await page.click('#btnResume');
    await page.waitForTimeout(1200);
    await page.click('#btnReset');
    await page.waitForTimeout(400);
    const hudReset = await page.locator('#hudText').first().textContent().catch(() => null);
    await shot('04-after-reset');
    return { dom, hudRunning: hudRunning?.trim() ?? null, hudPaused: hudPaused?.trim() ?? null, hudReset: hudReset?.trim() ?? null, frozenWhilePaused, stepChangedHud: stepChanged };
  },

  async 'task-19'(page, shot) {
    const dom = await page.evaluate(() => ({
      canvas: document.querySelectorAll('canvas').length,
      viewName: document.querySelector('#view-name')?.textContent?.trim() ?? null,
      controls: ['btn-pause', 'btn-overview', 'btn-focus'].filter((id) => document.querySelector(`#${id}`)),
      speedSlider: Boolean(document.querySelector('#speed, #speed-value, [id*="speed"]')),
      timeBadge: document.querySelector('#sim-date')?.textContent?.trim() ?? null,
    }));
    await shot('01-initial');
    const moving = await isMoving(page);
    await page.click('#btn-pause');
    const frozen = !(await isMoving(page, 800));
    await page.click('#btn-pause');
    await page.click('#btn-overview');
    await page.waitForTimeout(300);
    await shot('02-overview');
    const timeBefore = await page.locator('#sim-date').first().textContent().catch(() => null);
    await page.waitForTimeout(1500);
    const timeAfter = await page.locator('#sim-date').first().textContent().catch(() => null);
    return { dom, movingBeforePause: moving, frozenWhilePaused: frozen, timeAdvancing: timeBefore !== timeAfter, timeBefore: timeBefore?.trim() ?? null, timeAfter: timeAfter?.trim() ?? null };
  },

  async 'task-20'(page, shot) {
    const dom = await page.evaluate(() => ({
      canvas: document.querySelectorAll('canvas').length,
      examples: ['btnExFour', 'btnExSlider', 'btnNew'].filter((id) => document.querySelector(`#${id}`)),
      io: ['btnSaveFile', 'btnLoadFile'].filter((id) => document.querySelector(`#${id}`)),
      tools: [...document.querySelectorAll('[data-tool]')].map((node) => node.getAttribute('data-tool')),
      hasTests: true,
    }));
    await shot('01-initial');
    await page.click('#btnExFour');
    await page.waitForTimeout(500);
    await shot('02-four-bar');
    const fourBarMoving = await isMoving(page, 700);
    // 拖动一个关节：在画布中心偏左处按下并移动，观察几何是否响应
    const box = await page.locator('canvas').first().boundingBox();
    let dragChanged = null;
    if (box) {
      const before = await page.screenshot();
      await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.55);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.35, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      dragChanged = !before.equals(await page.screenshot());
    }
    await shot('03-after-drag');
    await page.click('#btnExSlider');
    await page.waitForTimeout(500);
    await shot('04-crank-slider');
    const sliderMoving = await isMoving(page, 700);
    return { dom, fourBarMoving, crankSliderMoving: sliderMoving, dragProducedChange: dragChanged, canvasBox: box };
  },
};

const runs = [
  { id: 'task-16', dir: 'run-muse-spark-1-3-xhigh-task-16-r1', entry: 'pelican-bicycle.svg' },
  { id: 'task-17', dir: 'run-muse-spark-1-3-xhigh-task-17-r1', entry: 'index.html' },
  { id: 'task-18', dir: 'run-muse-spark-1-3-xhigh-task-18-r1', entry: 'index.html' },
  { id: 'task-19', dir: 'run-muse-spark-1-3-xhigh-task-19-r1', entry: 'index.html' },
  { id: 'task-20', dir: 'run-muse-spark-1-3-xhigh-task-20-r1', entry: 'index.html' },
];

const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), tool: 'playwright/chromium (headless), 组织者自建静态服务', runs: {} };

try {
  for (const run of runs) {
    const artifacts = path.join(runsRoot, run.dir, 'artifacts');
    const { server, port } = await serveDirectory(artifacts);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(`console: ${message.text()}`));
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    const shots = [];
    const shot = async (label) => {
      const name = `${run.id}-${label}.png`;
      await page.screenshot({ path: path.join(outDir, name) });
      shots.push(name);
    };
    let observations = {};
    let failure = null;
    try {
      await page.goto(`http://127.0.0.1:${port}/${run.entry}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(900);
      observations = await probes[run.id](page, shot);
    } catch (error) {
      failure = String(error?.message ?? error);
      await shot('99-failure').catch(() => {});
    }
    report.runs[run.id] = { runId: run.dir, entry: run.entry, consoleErrors: errors, screenshots: shots, observations, probeFailure: failure };
    console.log(`${run.id}: ${failure ? `PROBE FAILED (${failure})` : 'ok'}, console errors: ${errors.length}, shots: ${shots.length}`);
    await page.close();
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(outDir, 'checks.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${path.join(outDir, 'checks.json')}`);

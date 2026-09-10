// 第三轮补测：① task-19 暂停时的变化量（区分"模拟真停"与"仅星空闪烁"）
//              ② task-20 单步是否真的改变了几何（步进前后比对，而非步进后是否持续变化）
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../..');
const { chromium } = createRequire(path.join(repoRoot, 'website', 'package.json'))('playwright');
const runsRoot = path.join(path.resolve(here, '../..'), 'runs');
const mime = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css' };
const serve = (dir) => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(dir, rel);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
});
// 在页面内用 getImageData 直接量化"两次采样之间有多少像素变了"
const canvasDiff = (page, gapMs) => page.evaluate(async (gap) => {
  const c = document.querySelector('canvas'); const ctx = c.getContext('2d');
  const grab = () => ctx.getImageData(0, 0, c.width, c.height).data;
  const a = grab(); await new Promise((r) => setTimeout(r, gap)); const b = grab();
  let changed = 0; const step = 4 * 7; // 抽样：每 7 个像素比一次
  for (let i = 0; i < a.length; i += step) {
    if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) changed += 1;
  }
  return { changedRatio: Number((changed / (a.length / step)).toFixed(4)), width: c.width, height: c.height };
}, gapMs);
const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), runs: {} };
try {
  // ---- task-19 ----
  {
    const { server, port } = await serve(path.join(runsRoot, 'run-muse-spark-1-3-xhigh-task-19-r1/artifacts'));
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(1200);
    const running = await canvasDiff(page, 900);
    await page.click('#btn-pause'); await page.waitForTimeout(400);
    const paused = await canvasDiff(page, 900);
    const pausedLong = await canvasDiff(page, 2500);
    report.runs['task-19'] = { runningChangedRatio: running.changedRatio, pausedChangedRatio: paused.changedRatio, pausedChangedRatioLong: pausedLong.changedRatio, canvas: `${running.width}x${running.height}` };
    await page.close(); await new Promise((r) => server.close(r));
  }
  // ---- task-20 ----
  {
    const { server, port } = await serve(path.join(runsRoot, 'run-muse-spark-1-3-xhigh-task-20-r1/artifacts'));
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(900);
    await page.click('#btnExFour'); await page.waitForTimeout(400);
    await page.click('#btnPlay'); await page.waitForTimeout(600);
    await page.click('#btnPlay'); await page.waitForTimeout(500); // 暂停
    const pausedIdle = await canvasDiff(page, 700);
    const canvas = page.locator('canvas').first();
    const beforeStep = await canvas.screenshot();
    await page.click('#btnStep'); await page.waitForTimeout(350);
    const afterStep = await canvas.screenshot();
    const afterAnother = await canvas.screenshot();
    report.runs['task-20'] = {
      pausedIdleChangedRatio: pausedIdle.changedRatio,
      singleStepChangedGeometry: !beforeStep.equals(afterStep),
      stableAfterStep: afterStep.equals(afterAnother),
    };
    await page.close(); await new Promise((r) => server.close(r));
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(here, 'checks-3.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.runs, null, 1));

// 第四轮补测（仅 task-20）：沿运动周期采样关节坐标，独立复算关节间距离是否恒定。
// 依据：应用自身的「JOINTS」表与 #errOut 读数；本脚本不运行成果自带测试，不改动成果。
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../..');
const { chromium } = createRequire(path.join(repoRoot, 'website', 'package.json'))('playwright');
const artifacts = path.join(path.resolve(here, '../..'), 'runs/run-muse-spark-1-3-xhigh-task-20-r1/artifacts');
const serve = (dir) => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(dir, rel);
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
});
const { server, port } = await serve(artifacts);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(900);
await page.click('#btnExFour');
await page.waitForTimeout(300);
await page.click('#btnPlay');
const readJoints = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('#jointTable tbody tr')];
  return rows.map((row) => {
    const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent.trim());
    return { name: cells[0], x: Number(cells[2]), y: Number(cells[3]) };
  }).filter((j) => Number.isFinite(j.x) && Number.isFinite(j.y));
});
const readErr = () => page.locator('#errOut').first().textContent().catch(() => null);
const samples = []; const errorsObserved = [];
for (let i = 0; i < 14; i += 1) {
  samples.push(await readJoints());
  errorsObserved.push((await readErr())?.trim() ?? null);
  await page.waitForTimeout(400);
}
await page.click('#btnExSlider');
await page.waitForTimeout(300);
await page.click('#btnPlay');
for (let i = 0; i < 8; i += 1) { samples.push(await readJoints()); await page.waitForTimeout(400); }
// 复算：每个关节对的欧氏距离在全程的极差
const names = samples[0].map((j) => j.name);
const stats = {};
for (let a = 0; a < names.length; a += 1) for (let b = a + 1; b < names.length; b += 1) {
  const distances = samples.filter((s) => s[a] && s[b]).map((s) => Math.hypot(s[a].x - s[b].x, s[a].y - s[b].y));
  if (!distances.length) continue;
  stats[`${names[a]}-${names[b]}`] = { min: Number(Math.min(...distances).toFixed(3)), max: Number(Math.max(...distances).toFixed(3)), range: Number((Math.max(...distances) - Math.min(...distances)).toFixed(3)) };
}
await browser.close(); await new Promise((r) => server.close(r));
const out = { generatedAt: new Date().toISOString(), samples: samples.length, jointNames: names, pairRanges: stats, solverErrorReadout: [...new Set(errorsObserved)], pageErrors: errors };
fs.writeFileSync(path.join(here, 'checks-4.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 1).slice(0, 1800));

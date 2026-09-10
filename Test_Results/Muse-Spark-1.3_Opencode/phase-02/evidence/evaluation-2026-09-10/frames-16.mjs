// task-16 逐帧取样：在未暂停状态下取 4 帧，供视觉核对"脚是否踩在踏板上"。
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../..');
const { chromium } = createRequire(path.join(repoRoot, 'website', 'package.json'))('playwright');
const dir = path.join(path.resolve(here, '../..'), 'runs/run-muse-spark-1-3-xhigh-task-16-r1/artifacts');
const server = http.createServer((req, res) => {
  const file = path.resolve(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'pelican-bicycle.svg');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': 'image/svg+xml' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
await page.goto(`http://127.0.0.1:${port}/pelican-bicycle.svg`, { waitUntil: 'load' });
await page.waitForTimeout(1200);
for (const [i, label] of ['a-frame1', 'b-frame2', 'c-frame3', 'd-frame4'].entries()) {
  await page.screenshot({ path: path.join(here, `task-16-${label}.png`) });
  await page.waitForTimeout(520);
}
await browser.close(); await new Promise((r) => server.close(r));
console.log('captured 4 frames');

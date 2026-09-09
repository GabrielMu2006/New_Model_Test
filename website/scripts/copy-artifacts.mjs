import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteRoot, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/catalog.json'), 'utf8'));
const outputRoot = path.join(siteRoot, 'public/artifacts');
fs.rmSync(outputRoot, { recursive: true, force: true });
for (const run of catalog.runs) {
  for (const relative of run.artifact.files) {
    if (relative.includes('..') || path.isAbsolute(relative)) throw new Error(`Unsafe artifact path: ${relative}`);
    const source = path.resolve(repoRoot, run.artifact.sourcePath, relative);
    const allowedRoot = path.resolve(repoRoot, run.artifact.sourcePath);
    if (!source.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`Artifact escapes source: ${source}`);
    if (!fs.existsSync(source)) throw new Error(`Missing artifact: ${source}`);
    const destination = path.join(outputRoot, run.id, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}
console.log(`Copied explicit assets for ${catalog.runs.length} runs.`);

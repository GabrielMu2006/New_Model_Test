import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, '..');
const repoRoot = path.resolve(siteRoot, '..');
const archiveRoot = 'DeepSeek-V4.1-Flash-Exp-0910_DSH';
const archiveCommit = '5776d3a1d94dc4b04d83fa94d482e04478fd4076';
const promptPath = '15_TEST_PROMPTS_BILINGUAL.md';
const metricsPath = `${archiveRoot}/Reviews/DeepSeek-V4.1-Flash-Exp-0910-任务评测复盘.md`;
const humanPath = `${archiveRoot}/Reviews/Personal_Review.md`;
const aiPath = `${archiveRoot}/Reviews/15-任务完成质量评估.md`;

const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const promptsText = read(promptPath);
const metricsText = read(metricsPath);
const humanText = read(humanPath);
const aiText = read(aiPath);

function lineRange(text, needle, block) {
  const start = text.slice(0, text.indexOf(needle)).split('\n').length;
  const count = block.split('\n').length;
  return `${start}-${start + count - 1}`;
}

function subsection(section, heading, nextHeading) {
  const start = section.indexOf(heading);
  if (start < 0) return '';
  const contentStart = start + heading.length;
  const end = nextHeading ? section.indexOf(nextHeading, contentStart) : section.length;
  return section.slice(contentStart, end < 0 ? section.length : end).trim();
}

function stripFence(value) {
  const match = value.match(/^```(?:\w+)?\n([\s\S]*?)\n```/);
  return (match ? match[1] : value).trim();
}

function bilingualParagraph(value) {
  const zh = value.match(/\*\*中文：\*\*\s*([\s\S]*?)(?=\n\n\*\*English:|$)/)?.[1]?.trim() ?? '';
  const en = value.match(/\*\*English:\*\*\s*([\s\S]*)$/)?.[1]?.trim() ?? '';
  return { zh, en };
}

function bilingualList(value) {
  const rows = [...value.matchAll(/^- \*\*(中文|English)：?\*\*\s*(.*)$/gm)];
  return {
    zh: rows.filter((row) => row[1] === '中文').map((row) => row[2].trim()),
    en: rows.filter((row) => row[1] === 'English').map((row) => row[2].trim()),
  };
}

const taskSections = [...promptsText.matchAll(/^## Task (\d{2}) · (.*?) \/ (.*?)\n([\s\S]*?)(?=^## Task|^## 总体|(?![\s\S]))/gm)];
if (taskSections.length !== 15) throw new Error(`Expected 15 prompt sections, found ${taskSections.length}`);

const categories = ['website', 'svg-illustration', 'svg-clock', 'svg-clock', 'svg-illustration', 'svg-illustration', 'svg-illustration', 'game', 'game', 'creative-tool', 'productivity-tool', 'utility', 'data-dashboard', 'website', 'productivity-tool'];
const sessionIds = ['89716f93', '0e1e035d', '17e6215c', '17e6215c', '4a0d64ce', '4a0d64ce', '4a0d64ce', '2579bde9', '28e77186', 'da8df324', '2d2be5e2', 'f87c54e3', '31de8e10', '214420b0', 'b25a11c4'];
const continuationTurns = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0];
const folders = [
  'task-01-aevum-luxury-watch-landing-page', 'task-02-pelican-on-bicycle', 'task-03-analog-clock-6-25',
  'task-04-analog-clock-11-52-30', 'task-05-bicycle-rider', 'task-06-scissors-cutting-paper',
  'task-07-pushing-wheelbarrow', 'task-08-breakout-game', 'task-09-topdown-farming-game',
  'task-10-pixel-art-editor', 'task-11-floor-plan-editor', 'task-12-calculator',
  'task-13-weather-dashboard', 'task-14-bank-website', 'task-15-book-tracker',
];
const artifactFiles = [
  ['index.html'], ['pelican-on-bicycle.svg'], ['clock-625.svg'], ['clock-11-52-30.svg'], ['bicycle_rider.svg'],
  ['scissors_cutting_paper.svg'], ['pushing_wheelbarrow.svg'], ['index.html'], ['index.html'], ['index.html'],
  ['index.html', 'app.js', 'geometry.js', 'screenshot.png'],
  ['index.html', 'styles.css', 'app.js', 'calc-engine.js', 'screenshot.png'],
  ['index.html', 'styles.css', 'js/api.js', 'js/app.js', 'js/charts.js', 'js/effects.js', 'js/icons.js', 'js/weather.js', 'screenshot.png'],
  ['index.html', 'personal.html', 'business.html', 'loans.html', 'rates.html', 'security.html', 'help.html', 'login.html', 'open-account.html', 'robots.txt', 'site.webmanifest', 'assets/css/site.css', 'assets/favicon.svg', 'assets/js/site.js', 'assets/js/finance.js', 'assets/js/calculators.js', 'assets/js/forms.js', 'assets/js/rates.js', 'assets/js/login.js', 'assets/js/apply.js'],
  ['index.html', 'styles.css', 'app.js', 'book-engine.js', 'screenshot.png'],
];
const entries = ['index.html', 'pelican-on-bicycle.svg', 'clock-625.svg', 'clock-11-52-30.svg', 'bicycle_rider.svg', 'scissors_cutting_paper.svg', 'pushing_wheelbarrow.svg', 'index.html', 'index.html', 'index.html', 'index.html', 'index.html', 'index.html', 'index.html', 'index.html'];
const humanTranslations = [
  'Overall it fits a premium luxury brand site. Some watch details need work, but the customization feature is impressive and the overall finish is very high.',
  'Basically fine, although this version appears to be static rather than animated.', 'No issues.', 'No issues.',
  'No issues, except there is an unexplained “7” in the image.', 'The scissors and hand both look strange.',
  'It clearly feels like pushing, but the person and cart structures look strange, and the wheel is misplaced.',
  'The core functionality is fully implemented.', 'All functionality is implemented. The UI could improve, but the overall result is good.',
  'The basic functionality is implemented, but there is a bug if the canvas size is not selected on the first use.',
  'The basic functionality is implemented; the UI is unattractive.', 'The functionality is implemented; the UI is unattractive.',
  'The result is very good, but the light theme looks poor. The dark theme is attractive and the functionality is complete.',
  'The core functionality is complete and the UI style is good.', 'The functionality is complete and the UI style is good.',
];

const metricRows = new Map();
for (const row of metricsText.split('\n').filter((line) => /^\| task-\d{2} \|/.test(line))) {
  const cells = row.split('|').slice(1, -1).map((cell) => cell.replaceAll('**', '').trim());
  if (cells.length !== 12) continue;
  const id = cells[0];
  const duration = cells[4];
  const minutes = Number(duration.match(/(\d+)分/)?.[1] ?? 0);
  const seconds = Number(duration.match(/(\d+)秒/)?.[1] ?? 0);
  const number = (index) => Number(cells[index].replaceAll(',', ''));
  metricRows.set(id, { durationLabel: duration, durationSeconds: minutes * 60 + seconds, apiCalls: number(5), toolCalls: number(6), failures: number(7), inputTokens: number(8), outputTokens: number(9), cacheReadTokens: number(10), totalTokens: number(11) });
}

const humanDetails = new Map();
for (const match of humanText.matchAll(/^### T(\d+) ·[^\n]*\n\n> ([^\n]+)/gm)) humanDetails.set(`task-${match[1].padStart(2, '0')}`, match[2].trim());
const humanSummary = new Map();
for (const row of humanText.split('\n').filter((line) => /^\| T\d+ \|/.test(line))) {
  const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
  humanSummary.set(`task-${cells[0].slice(1).padStart(2, '0')}`, cells[3]);
}
const aiSections = new Map();
for (const match of aiText.matchAll(/^### Task (\d{2}) · (.*?) — (\d+) \/ 100\n\n\*\*结论：([^*]+)。\*\*\n\n([\s\S]*?)(?=^### Task|^## 五)/gm)) {
  aiSections.set(`task-${match[1]}`, { title: match[2], score: Number(match[3]), verdict: match[4].trim(), body: match[5].trim() });
}

const tasks = [];
const runs = [];
const reviews = [];
for (const [index, match] of taskSections.entries()) {
  const number = match[1];
  const id = `task-${number}`;
  const section = match[0];
  const promptOriginal = stripFence(subsection(section, '### 原始 Prompt / Original Prompt', '### 中文译文 / Chinese Translation'));
  const promptTranslation = stripFence(subsection(section, '### 中文译文 / Chinese Translation', '### 理论成果 / Expected Outcome'));
  const expectedOutcome = bilingualParagraph(subsection(section, '### 理论成果 / Expected Outcome', '### 检验内容 / Verification'));
  const verification = bilingualList(subsection(section, '### 检验内容 / Verification'));
  const sourcePath = `${archiveRoot}/${folders[index]}`;
  const sourceNeedle = `## Task ${number} ·`;
  const metrics = metricRows.get(id);
  if (!metrics) throw new Error(`Missing metrics for ${id}`);
  const artifactType = index >= 1 && index <= 6 ? 'svg' : 'html';
  const runId = `run-deepseek-v4-1-flash-exp-0910-${id}-r1`;
  const cover = artifactType === 'html' ? (artifactFiles[index].includes('screenshot.png') ? `artifacts/${runId}/screenshot.png` : `covers/${runId}.png`) : null;
  tasks.push({ id, version: 1, phaseId: 'phase-01', title: { zh: match[2].trim(), en: match[3].trim() }, category: categories[index], promptOriginal, promptTranslation, expectedOutcome, verification, source: { path: promptPath, lines: lineRange(promptsText, sourceNeedle, section) } });
  runs.push({
    id: runId, modelId: 'deepseek-v4-1-flash-exp-0910', taskId: id, taskVersion: 1,
    environment: { harness: 'DSH', sessionId: sessionIds[index], continuationTurns: continuationTurns[index] }, metrics,
    artifact: { type: artifactType, entry: entries[index], files: artifactFiles[index], sourcePath, archiveCommit, cover, preview: { lazy: artifactType === 'html', sandbox: artifactType === 'html' ? 'allow-scripts allow-downloads allow-forms' : null, note: id === 'task-13' ? 'Live weather requests may be unavailable; the artifact includes cached and offline fallbacks.' : artifactType === 'html' ? 'Embedded storage and downloads can be restricted by browser sandboxing; use the standalone view for full behavior.' : null } },
    source: { path: metricsPath, lines: '54-70' },
  });
  const humanTextValue = humanDetails.get(id) ?? '';
  reviews.push({ id: `review-human-${id}-r1`, runId, type: 'human', authorLabel: 'Personal Review', date: null, conclusion: { zh: humanSummary.get(id) ?? '', en: humanTranslations[index] }, body: { zh: humanTextValue, en: humanTranslations[index] }, score: null, source: { path: humanPath, lines: lineRange(humanText, `### T${index + 1} ·`, `### T${index + 1} ·`) } });
  const ai = aiSections.get(id);
  if (!ai) throw new Error(`Missing AI assessment for ${id}`);
  reviews.push({ id: `review-ai-${id}-r1`, runId, type: 'ai', authorLabel: '15-task completion quality assessment', date: '2026-09-09', conclusion: { zh: ai.verdict, en: `AI assessment: ${ai.verdict} (translated label).` }, body: { zh: ai.body, en: 'The detailed historical AI assessment is retained in Chinese at the source link.' }, score: ai.score, scoreMethod: 'Weighted rubric defined in the cited historical AI report; not an independent score produced by this website.', source: { path: aiPath, lines: lineRange(aiText, `### Task ${number} ·`, `### Task ${number} ·`) } });
}

const phase = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/phases/phase-01.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/models/deepseek-v4-1-flash-exp-0910.json'), 'utf8'));
const catalog = {
  schemaVersion: 1,
  generatedAt: null,
  archiveCommit,
  repository: 'https://github.com/GabrielMu2006/New_Model_Test',
  phases: [phase], models: [model], tasks, runs, reviews,
  batchMetrics: { totalTasks: 15, sessions: 12, durationSeconds: 8282, apiCalls: 693, toolCalls: 735, failures: 42, inputTokens: 334670, outputTokens: 1072534, cacheReadTokens: 63042176, totalTokens: 64449380, costCny: 9.3, source: { path: metricsPath, lines: '10-25' } },
  historicalAssessment: { score: 93.6, coreSuccess: '15/15', source: { path: aiPath, lines: '7-16,209-211' }, disclaimer: 'Quoted from the historical AI assessment; not independently proven or recomputed by this website.' },
};

fs.writeFileSync(path.join(siteRoot, 'data/catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Imported ${tasks.length} tasks, ${runs.length} runs, and ${reviews.length} reviews.`);

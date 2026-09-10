// 归档 Markdown 的共享解析助手：被各批次适配器复用，避免解析逻辑漂移。

/**
 * 1-based 起始行 + 块长度 → "start-end" 行号区间，用于源码定位。
 * 找不到 needle 时必须抛错：静默回落到文件末尾会生成一个「存在但指错位置」的源码链接，
 * 这类错误既不会被链接检查发现，也不会有任何报错提示。
 */
export function lineRange(text, needle, block) {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`lineRange: needle not found in source: ${JSON.stringify(needle.slice(0, 60))}`);
  const start = text.slice(0, index).split('\n').length;
  const count = block.split('\n').length;
  return `${start}-${start + count - 1}`;
}

/** 截取 heading 到 nextHeading 之间的内容（不含标题本身）。 */
export function subsection(section, heading, nextHeading) {
  const start = section.indexOf(heading);
  if (start < 0) return '';
  const contentStart = start + heading.length;
  const end = nextHeading ? section.indexOf(nextHeading, contentStart) : section.length;
  return section.slice(contentStart, end < 0 ? section.length : end).trim();
}

/** 去掉 ```text 围栏，返回逐字内容。 */
export function stripFence(value) {
  const trimmed = String(value).trim();
  const match = trimmed.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
  return (match ? match[1] : trimmed).trim();
}

/** 解析 "**中文：** … \n\n **English:** …" 段落。 */
export function bilingualParagraph(value) {
  const zh = value.match(/\*\*中文：\*\*\s*([\s\S]*?)(?=\n\n\*\*English:|$)/)?.[1]?.trim() ?? '';
  const en = value.match(/\*\*English:\*\*\s*([\s\S]*)$/)?.[1]?.trim() ?? '';
  return { zh, en };
}

/** 解析双语列表项；中文行用全角冒号，英文行用半角冒号，两者都接受。 */
export function bilingualList(value) {
  const rows = [...value.matchAll(/^- \*\*(中文|English)\s*[:：]\s*\*\*\s*(.*)$/gm)];
  return {
    zh: rows.filter((row) => row[1] === '中文').map((row) => row[2].trim()),
    en: rows.filter((row) => row[1] === 'English').map((row) => row[2].trim()),
  };
}

/** 把 Markdown 表格行切成单元格（去掉首尾空列与 ** 强调）。 */
export function tableCells(line, { stripBold = false } = {}) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => (stripBold ? cell.replaceAll('**', '') : cell).trim());
}

/** "2分13秒" / "50秒" → 秒数。 */
export function durationToSeconds(label) {
  const minutes = Number(label.match(/(\d+)\s*分/)?.[1] ?? 0);
  const seconds = Number(label.match(/(\d+)\s*秒/)?.[1] ?? 0);
  return minutes * 60 + seconds;
}

// 评价正文的 Markdown 渲染：只支持归档里实际出现的子集，且先转义再解析。
//
// 为什么不用现成库：本仓库依赖面刻意保持最小（Astro + TS + Playwright），
// 而评价正文只需要 段落 / 列表 / 粗体 / 斜体 / 行内代码 / 链接 / 引用 / 标题。
// 安全前提：所有原始文本先做 HTML 转义，再套用 Markdown 变换；链接只允许 http(s)、mailto 与相对路径。

const escapeHtml = (value: string) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const safeUrl = (url: string) => /^(https?:\/\/|mailto:|\/|\.\/|#)/i.test(url.trim()) && !/^javascript:/i.test(url.trim());

/** 行内元素：行内代码 → 转义 → 链接 → 粗体 → 斜体 → 还原代码。 */
function renderInline(text: string): string {
  const codes: string[] = [];
  let working = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  working = escapeHtml(working);
  working = working.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => (
    safeUrl(url) ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : match
  ));
  working = working.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  working = working.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return working.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codes[Number(index)] ?? '');
}

/** 块级渲染：标题、引用、无序/有序列表、分隔线、段落。 */
export function renderMarkdown(source: string): string {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) { flushParagraph(); index += 1; continue; }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushParagraph(); blocks.push('<hr>'); index += 1; continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length + 3, 6);
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1; continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote>${renderInline(quote.join(' '))}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+/);
    if (unordered) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    paragraph.push(line.trim());
    index += 1;
  }

  flushParagraph();
  return blocks.join('\n');
}

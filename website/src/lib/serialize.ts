// 页面数据岛（<script type="application/json">）的序列化助手。
//
// 为什么单独成文件：本模块不依赖 Astro 环境（`import.meta.env`），因此可以在
// Node 原生测试里直接导入并断言转义行为。

/**
 * 把值序列化进 <script type="application/json"> 前必须转义 `<`、`>`、`&` 与行分隔符：
 * 题目与评价属于被评测的数据，其中若出现 `</script>` 会提前结束数据岛
 * （页面脚本解析失败，最坏情况是注入）。转义后 JSON.parse 仍可 100% 还原原文。
 */
export const jsonIsland = (value: unknown) => JSON.stringify(value)
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('&', '\\u0026')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029');

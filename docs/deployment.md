# 部署 / Deployment

公开站点：https://gabrielmu2006.github.io/New_Model_Test/

`website-check.yml` 在 PR 与相关推送中只执行展示站的数据校验、类型检查、逻辑测试和静态构建；不会运行归档模型产物中的脚本。`website-deploy.yml` 仅在 `main` 的相关路径变化或手动触发时，以 `contents: read`、`pages: write`、`id-token: write` 部署 `website/dist`。

重新发布：在 Actions 中运行 “Deploy evaluation website”，或向 `main` 推送相关变更。恢复旧版：对目标提交执行 `git revert` 并推送，由同一工作流产生新的 Pages 部署；GitHub Pages 的历史 deployment 记录可用于确认版本。

实现依据：[Astro GitHub Pages 官方指南](https://docs.astro.build/en/guides/deploy/github/)与 [GitHub 自定义 Pages workflow 文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

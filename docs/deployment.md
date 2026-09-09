# 部署与回退

生产站点：https://vibetest.gabrielmu2006.cn/。使用 GitHub Pages Actions、Astro 静态输出，base 为 /，CNAME 为 vibetest.gabrielmu2006.cn。个人主站 https://gabrielmu2006.cn/ 独立维护。

## 自动发布

用户已授权相关更新检查通过后自动发布。website-check.yml 对 PR/非 main 分支验证；website-deploy.yml 在 main 的 website、PROMPT、Test_Results、docs、README、AGENTS 或网站工作流变化时执行校验、测试、构建和发布。PR 不授予部署权限，部署使用 contents: read、pages: write、id-token: write。

在 website/ 中运行数据导入/校验、check、test、build；涉及路径、资源、交互或接入时运行 test:e2e。只提交本次相关改动。推送后等待正确提交对应的 Actions 成功，确认公网实际内容，不能只看旧缓存页面的 HTTP 200。

## 保留回退点

至少保留**当前线上版本之前的一个已知可用版本**。发布前由维护 agent 核对上次成功 workflow、实际部署源码和公网记录，为该源码提交创建远端不可变标签，命名 website-rollback-YYYYMMDD-短SHA。若上次为手动 source_ref 回退，workflow 的 headSha 可能属于控制工作流而非实际部署源码，必须查 checkout 日志/发布记录确认。

最近一次已成功部署且公网验证通过的版本（每次发布前滚动更新）：
- 源码 SHA：405a957（Muse 档案入库后的展示站版本）
- 成功 Actions：34337020609
- 回退标签：website-rollback-20260909-405a957
- 更早的可用回退点：`website-rollback-20260909-dba1c39`、`website-rollback-20260909-09b10d4`（均已公网验证通过）。

标签只追加不强制覆盖；不删除唯一可用回退点。构建包保留 30 天仅辅助诊断，永久 Git 提交、标签和锁文件是重建依据。依赖源长期不可用时可能阻碍重建；需要更长期离线保障时另行保存验证过的发布包。

## 回退操作

工作流增加 source_ref 输入：留空发布当前版本，填写已验证的提交 SHA 或标签则用当前工作流构建该版本。无需更改 main 的 Git 历史或 DNS。

在仓库根目录执行一次回退，例如：

```bash
gh workflow run website-deploy.yml --repo GabrielMu2006/New_Model_Test --ref main -f source_ref=website-rollback-20260909-09b10d4
gh run list --repo GabrielMu2006/New_Model_Test --workflow website-deploy.yml --limit 5
```

用上一步返回的本次 run ID 执行 `gh run watch RUN_ID --repo GabrielMu2006/New_Model_Test --exit-status`。RUN_ID 是待替换参数，不能照抄。也可在 GitHub Actions 的 “Deploy evaluation website” → “Run workflow” 中填写 source_ref。

确认回退任务排在任何正在运行的部署之后；本仓库 Pages 并发组为串行。恢复期间不要继续推送触发另一次部署，避免恢复后又被覆盖。核验根页、中英文、任务/对比深链、代表性成果、邮箱和主站链接及 HTTPS，再记录恢复时间、源 SHA、workflow run。

回退仅更换公开网站，main 仍可能含错误。随后修复回归或针对相关提交执行 git revert（合并/多提交须审查目标及顺序），验证后自动推送发布；不执行 reset --hard 或 force-push。发布前测试失败不部署；发布后出现核心回归时可按既有恢复授权使用已确认回退点，并告知用户结果。

## 参考

[GitHub Pages 自定义 workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)；[Astro GitHub Pages 指南](https://docs.astro.build/en/guides/deploy/github/)。

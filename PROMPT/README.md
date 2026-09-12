# 模型测试提示词

只存模型测试题、题目版本与允许输入；网站启动指令、建站计划及维护规范位于 `../docs/`。

- [第一阶段：15 道双语测试题](Phase1_TEST_PROMPTS_BILINGUAL.md)
- [第二阶段：30 道高级纯创造双语测试题（Task 16–45）](PHASE2_30_ADVANCED_CREATION_PROMPTS_BILINGUAL.md)——Task 16–20 已由 DeepSeek-V4.1-Flash 与 Muse Spark 1.3 跑完并归档（见 `../Test_Results/`），Task 21–45 尚未运行。

新阶段题目使用带阶段标识的文件名（如 Phase2_…），有配套输入时可使用阶段子目录；保留现有文件名。原始 Prompt 不覆写，需求变化必须版本化。被测环境只接收本轮逐字原题和预先允许的资源，不能把整份包含理论成果/后补验收建议的文档默认当作模型输入。测试流程见 `../docs/testing-protocol.md`。

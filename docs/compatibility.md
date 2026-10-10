# Compatibility — DSH 版本线兼容声明

dsh-agent-team-plus 对 DeepSeek Harness 版本线的兼容承诺与已验证范围。

## 已钉定的上游版本

vendor 源码钉在 `@deepseek-ai/dsh-experimental-agent-team` / `dsh-experimental-tool-agent-team` / `dsh-tool-skill` / `dsh-skill` **0.2.0-rc.2**（MIT）。VENDOR-NOTES.md 逐包记录改动面；其余文件与上游字节一致。

## 已验证环境

| 项 | 值 |
|---|---|
| 宿主 | DSH Desktop 2.0.17（desktop profile，compatibility 壳模式）|
| 插件运行时 | cordis 4.x（宿主 vendored）|
| Agent preset | standard preset（preset-standard，含官方 tool-skill 挂载）|
| 验证日期 | 2026-10-09 ~ 10-10 |
| 回归矩阵 | 7/8 实测通过，1/8（重投语义）依赖官方邮箱机制未强行复现 |

## 兼容承诺

- **0.2.0-rc.x 线**：本插件的目标线。上游补丁版本（rc.3 等）发布后，按官方 changelog 逐条对照持久日志 schema（`team/member` 快照、`team/message` 事件、subagent descriptor）后升级 vendor。
- **持久日志兼容**：member 快照新增的 `model`/`toolFilter`/`skills` 字段全部 optional——旧版本（含官方原版）产生的 Team 日志在本插件下照常回放；本插件产生的日志字段在官方原版下回放会因 strict schema 拒绝（`additionalProperties`），**不要**在关闭本插件后让官方插件接管本插件创建的 Team。
- **client bundle**：依赖宿主 shell 的 `shell.overlay` slot 与 `dsh.client.inject` 的 uiSession/uiConversation/uiLayout 包面。宿主 client 包面重命名会使 GUI 面板静默失效（server 侧功能不受影响）。

## 已知脆弱点（升级宿主时先核对）

1. **Agent preset 组装方式**：队员的 skill 工具来自 Lead 的 preset（preset-standard 挂官方 tool-skill）。官方若改变 preset 结构或 tool-skill 挂载方式，S3 的 none 档（toolFilter deny）不受影响，list 档 guard 也不受影响，但 catalog 表现需复查。
2. **webServer.fetch 注册表**：roster HTTP API 走宿主 webServer 服务的 register 接口（exact/prefix 路由）。该接口形状变化会使名册面板 404（server 工具层不受影响）。
3. **tools.guard / tools.restrict 语义**：per-member 工具过滤依赖官方 tools registry 的 scope-chain restriction 与 guard 语义（0.2.0-rc.2 实测）。变化会波及 S3/S2 过滤。
4. **subagent descriptor schema**：toolFilter/model/reasoningEffort 的持久化依赖 descriptor 的 CONTINUABLE_DESCRIPTOR_KEYS 白名单（0.2.0-rc.2）。上游扩充键集合不影响本插件；收紧则会拒绝重放。

## 明确不支持

- DSH 0.1.x 及更早（无 agentPresets 平面）
- 非 desktop/web profile 的 headless 组合未测（server 层理论可用；client 面板依赖浏览器壳）

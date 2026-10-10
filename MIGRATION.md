# MIGRATION — 迁移到 dsh-agent-team-plus

从 dsh-subagent-library 或官方 Agent Teams 迁移到 dsh-agent-team-plus 的对照说明。

## 从 dsh-subagent-library（MaRi23333）迁移

### 概念对照

| dsh-subagent-library | dsh-agent-team-plus |
|---|---|
| 具名条目（subagent 定义） | 名册条目（`~/.dsh/agent-team-plus/*.yaml`） |
| delegate 工具 | `spawn_teammate_plus({ from: "<条目名>" })` |
| 条目内 model/persona | 条目内 model/reasoningEffort/description（人设即 description） |
| 工具过滤 | `tools.deny`（deny 列表语义） |
| relay 桥接（非真互发） | 官方持久邮箱真圆桌（队员间直发，A↔B 不经 Lead） |

### 迁移步骤

1. 把每个 subagent-library 条目改写成一个名册 YAML（字段对照见上表；工具白名单需翻转为 deny 列表——本插件用 deny 语义）
2. 保存到 `~/.dsh/agent-team-plus/<name>.yaml`
3. 关闭 dsh-subagent-library 插件
4. 会话中用 `spawn_teammate_plus({ from: ... })` 替代 delegate

### 能力差异

- 新增：逐队员 reasoningEffort、skill 白名单（all/none/名单）、名册 GUI 编辑器、名册热生效
- 缺失：dsh-subagent-library 若有本插件未覆盖的字段（如自动触发器），迁移时需另行安排

## 从官方 Agent Teams 迁移

### 概念对照

| 官方 Agent Teams | dsh-agent-team-plus |
|---|---|
| `spawn_teammate` | `spawn_teammate_plus` |
| 队员一律用 Lead 的模型 | 队员模型由名册条目指定 |
| 无 per-member 配置 | 名册条目（model/reasoningEffort/skills/tools.deny） |
| `from` 花名册（roster 条目实例化） | 保留同款语义，条目源换成 `~/.dsh/agent-team-plus/*.yaml` |

### 迁移步骤

1. 安装本插件（bundle patch 会自动 disable 官方 `agent-team`/`tool-agent-team`/`ui-agent-team` 行）
2. 把原来的 from 花名册条目改写成名册 YAML（原条目里没有的 model/skills/tools 字段可留空，行为与官方一致）
3. 工具名变化：`spawn_teammate` → `spawn_teammate_plus`；`send_message`/`wait_agent`/`list_agents`/`team_task_*`/`interrupt_agent` 全部不变
4. 队员的持久会话不迁移——旧官方 Team 的历史在新插件里不可续（成员身份是新 Team）；完成中的任务请在官方插件下收尾后再切换

### 不变的部分

持久邮箱真圆桌、任务板（team_task_*）、步骤边界注入（Steer）、冷恢复——全部与官方一致（vendor 未改）。

## 从旧版 dsh-agent-team-plus 升级

- 名册 YAML 兼容：只增字段不改语义（新增 `tools.deny`；`skills` 的 all/none/名单语义不变）
- 持久 Team 日志兼容：member 快照 schema 新增的 `toolFilter`/`skills`/`model` 字段均为 optional，旧日志照常回放
- 升级后建议重启宿主一次，让 client bundle 重新组合

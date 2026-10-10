# dsh-agent-team-plus

Per-member configurable Agent Teams for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — give every teammate its own model, reasoning effort, skill allowlist, and tool restrictions, while keeping the official durable-mailbox roundtable fully intact.

Vendored and extended from `@deepseek-ai` Agent Teams 0.2.0-rc.2 (MIT, see [LICENSES.md](LICENSES.md)).

## Why

The built-in Agent Teams spawns every teammate on the Lead's own model with no per-member configuration. dsh-agent-team-plus adds a human-authored roster as the single source of truth:

- **Per-member model & reasoning effort** — e.g. run a cheap flash model for scouts and the flagship for planners
- **Skill allowlist per member** — `all`, `none`, or an explicit list
- **Tool deny list per member** — e.g. a read-only scout with `write`/`edit` denied
- **Roster as the only source of truth** — teammates are instantiated from `~/.dsh/agent-team-plus/*.yaml`; the GUI panel is a graphical editor that writes back to the same YAML

Security boundary (D7): `model`/`reasoning_effort` can ONLY come from roster entries or team sheets (human-authored). `spawn_teammate_plus` offers no inline model parameters — the Lead (a model) can never appoint a bigger model as its own teammate on its own authority.

## Install

From source:

```
dsh plugin --profile <your-profile> add <path-to-this-repo>
```

Then restart DSH. Disable the official Agent Teams plugin (`agent-team` / `tool-agent-team` / `ui-agent-team`) — this plugin disables them in its bundle patch automatically when installed alongside.

Requirements: DSH 0.2.x (pinned upstream: 0.2.0-rc.2), Node.js >= 20.

## Roster entries

One YAML file per member under `~/.dsh/agent-team-plus/` (`.yaml` or `.yml`, a file may contain a list of entries):

```yaml
name: scout                      # required, lower-kebab-case, not "lead"
description: 侦察型队员，快速扫读，不写文件   # required, <= 200 chars
context: fresh                   # fresh | fork (default fresh)
model: glm-5.3-flash             # optional; omit = inherit Lead
reasoningEffort: low             # minimal | low | medium | high; omit = inherit
skills: none                     # all | none | list of names (below)
tools:                           # optional deny list
  deny:
    - write
    - edit
```

List-mode skills:

```yaml
skills:
  - ponytail
  - dsh-plugin-guide
```

Edits take effect on the next spawned member — no restart needed (mtime cache).

## Usage

Ask the Lead to spawn from the roster:

```
spawn_teammate_plus({ from: "scout", prompt: "..." })
```

`from` cannot be combined with `name`/`description`. Inline spawn (name + description, no model route) still works for ad-hoc teammates.

### GUI roster panel

The client bundle adds a 👍 Team+ button that opens the roster panel: create, edit, and delete entries; every save writes a roster YAML file. The panel also lists the host's skills for list-mode checkboxes.

## Architecture notes

- The vendored runtime passes `model`/`reasoningEffort` through `spawnAdmitted` into `startContinuable` agentOptions (single-point patch, F10).
- Tool restrictions ride the official per-child `toolFilter` (`subagents.startContinuable(request.toolFilter)`), persisted in the subagent descriptor — deny lists survive cold resume automatically.
- List-mode skill policy is persisted in the member journal record (`member.skills`) and enforced by a per-member `tools.guard` bound in the member's own scope; it is restored on cold resume.
- skills:none denies the `skill` tool itself; the official tool-skill's visibility-matched catalog then mutes the durable catalog automatically.
- Known ceiling: in list mode the injected skill catalog still shows all skills (the official catalog pre-step lives on the host plane); enforcement is by guard + spawn-prompt note.

## Regression matrix (all run on a real desktop profile)

1. Three heterogeneous members → `list_agents` echoes per-member model ✅
2. A↔B three-round peer messaging without Lead relay (journal `team/message/queued` sender/target evidence) ✅
3. Running-member step-boundary injection; inactive wake-up ✅
4. Kill host mid-flight → cold resume restores roster fields/toolFilter; redelivery semantics inherited from the official mailbox (unmodified by this vendor) ⚠️
5. skill=none member has no skill tool & empty catalog; list member loads only listed skills ✅
6. tools.deny member loses write/edit entirely ✅
7. Roster YAML hot-reload (edit → next spawn picks it up, no restart) ✅
8. Full functionality with the official team plugin disabled ✅

## License

MIT — see [LICENSE](LICENSE). Vendored upstream files keep their `@deepseek-ai` copyright headers; [LICENSES.md](LICENSES.md) lists the vendored packages and versions.

## Docs

- [MIGRATION.md](MIGRATION.md) — moving from dsh-subagent-library or the official team plugin
- [docs/compatibility.md](docs/compatibility.md) — DSH version-line compatibility statement
- 开发计划（唯一权威文档，中文）位于仓库工作区的《dsh-agent-team-plus 开发计划.md》

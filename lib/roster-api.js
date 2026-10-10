// dsh-agent-team-plus: roster HTTP API over the connection fetch registry (S4).
// GET    /api/agent-team-plus/roster           -> { entries: [...] }
// PUT    /api/agent-team-plus/roster/<name>    -> save one entry (body = entry JSON)
// DELETE /api/agent-team-plus/roster/<name>    -> delete one entry file
// All writes go through roster-file.js so validation and mtime cache stay in one place.
import { readRoster, ROSTER_DIR } from "./roster-file.js";
import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const MEMBER_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function entryToWire(entry) {
  return {
    name: entry.name,
    description: entry.description,
    context: entry.context,
    model: entry.model,
    reasoningEffort: entry.reasoningEffort,
    skills: entry.skills,
    sourceFile: entry.sourceFile,
  };
}

function yamlFor(data) {
  const lines = [];
  lines.push(`name: ${data.name}`);
  if (data.description) lines.push(`description: ${data.description}`);
  lines.push(`context: ${data.context ?? "fresh"}`);
  if (data.model) lines.push(`model: ${data.model}`);
  if (data.reasoningEffort) lines.push(`reasoningEffort: ${data.reasoningEffort}`);
  if (data.skills === "all" || data.skills === "none") {
    lines.push(`skills: ${data.skills}`);
  } else if (Array.isArray(data.skills) && data.skills.length > 0) {
    lines.push("skills:");
    for (const s of data.skills) lines.push(`  - ${s}`);
  }
  return lines.join("\n") + "\n";
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function registerRosterApi(ctx) {
  const disposers = [];
  const webServer = ctx.webServer;
  if (webServer === undefined || webServer.register === undefined) {
    throw new Error("dsh-agent-team-plus: webServer service unavailable for roster api");
  }
  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const readBodyJson = (req) => new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => { try { resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")) } catch (e) { rejectBody(e) } });
    req.on("error", rejectBody);
  });
  // GET 列表
  disposers.push(webServer.register({
    kind: "exact", path: "/api/agent-team-plus/roster",
    handler: async (req, res) => {
      try { const roster = await readRoster(); json(res, 200, { entries: [...roster.values()].map(entryToWire) }) }
      catch (e) { json(res, 500, { error: String(e?.message ?? e) }) }
    }
  }));
  // GET skill 名单 —— scope 取一个 join 了 Agent preset 的 live agent（preset 的
  // skill-filesystem 在其 scope 链上；host 平面的 skill-filesystem row 被 web-app
  // patch 禁用，不传 scope 会得到空集）。pickAgent 按优先级选：有 preset 的 >
  // 任一 agent。cwd 用该 agent 的会话工作目录（workspace 级 skill 才能被发现）。
  const pickAgent = () => {
    const all = ctx.agents?.list?.() ?? [];
    const presets = ctx.agentPresets;
    const joined = all.filter((a) => presets?.composedPreset?.(a.ctx) !== undefined);
    if (joined.length > 0) return joined[joined.length - 1];
    return all[all.length - 1];
  };
  disposers.push(webServer.register({
    kind: "exact", path: "/api/agent-team-plus/skills",
    handler: async (req, res) => {
      try {
        const agent = pickAgent();
        const cwd = agent?.session?.header?.cwd ?? process.cwd();
        const snapshot = await ctx.skills.snapshot({ cwd, scope: agent });
        json(res, 200, { names: (snapshot.skills ?? []).map((s) => s.name).filter(Boolean).sort(), count: (snapshot.skills ?? []).length })
      } catch (e) { json(res, 500, { error: String(e?.message ?? e) }) }
    }
  }));
  // GET 模型目录 —— 遍历已注册 providers × listModels（与 Lead 同一 llm registry）
  disposers.push(webServer.register({
    kind: "exact", path: "/api/agent-team-plus/models",
    handler: async (req, res) => {
      try {
        const out = [];
        if (typeof ctx.llm?.listProviders === "function") {
          for (const provider of ctx.llm.listProviders()) {
            try {
              const models = await ctx.llm.listModels(provider.id);
              for (const m of models) out.push({ provider: m.provider ?? provider.id, id: m.id, name: m.name });
            } catch { /* provider offline: skip */ }
          }
        }
        json(res, 200, { models: out });
      } catch (e) { json(res, 500, { error: String(e?.message ?? e) }) }
    }
  }));
  // GET 会话内 Team 实时状态（list_agents 同源数据）
  disposers.push(webServer.register({
    kind: "exact", path: "/api/agent-team-plus/team",
    handler: async (req, res) => {
      try {
        if (typeof ctx.agentTeams?.list !== "function") { json(res, 200, { members: [] }); return }
        const lead = ctx.agents.list().find((a) => ctx.agentTeams.tryMembership?.(a)?.role === "lead");
        if (lead === undefined) { json(res, 200, { members: [] }); return }
        const members = ctx.agentTeams.list(ctx.agentTeams.tryMembership(lead));
        json(res, 200, { members });
      } catch (e) { json(res, 500, { error: String(e?.message ?? e) }) }
    }
  }));
  // PUT / DELETE 带参数段：用 prefix 路由解析
  disposers.push(webServer.register({
    kind: "prefix", path: "/api/agent-team-plus/roster/",
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://x");
        const name = decodeURIComponent(url.pathname.slice("/api/agent-team-plus/roster/".length));
        if (!MEMBER_NAME.test(name) || name === "lead") { json(res, 400, { error: "invalid name" }); return }
        if (req.method === "PUT") {
          const data = await readBodyJson(req);
          data.name = name;
          const dir = resolve(ROSTER_DIR);
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, `${name}.yaml`), yamlFor(data), "utf8");
          json(res, 200, { ok: true, file: join(dir, `${name}.yaml`) });
          return;
        }
        if (req.method === "DELETE") {
          const file = join(resolve(ROSTER_DIR), `${name}.yaml`);
          await unlink(file).catch(() => undefined);
          json(res, 200, { ok: true });
          return;
        }
        json(res, 405, { error: "method not allowed" });
      } catch (e) { json(res, 500, { error: String(e?.message ?? e) }) }
    }
  }));
  return () => { for (const d of disposers) d(); };
}
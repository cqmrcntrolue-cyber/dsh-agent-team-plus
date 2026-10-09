// dsh-agent-team-plus: roster HTTP API over the connection fetch registry (S4).
// GET    /api/agent-team-plus/roster           -> { entries: [...] }
// PUT    /api/agent-team-plus/roster/<name>    -> save one entry (body = entry JSON)
// DELETE /api/agent-team-plus/roster/<name>    -> delete one entry file
// All writes go through roster-file.js so validation and mtime cache stay in one place.
import { readRoster, ROSTER_DIR } from "../../lib/roster-file.js";
import { registerMemberSkills, unregisterMemberSkills } from "../../lib/member-skills.js";
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
  const disposeSkills = ctx.connection.fetch.register({
    path: "/api/agent-team-plus/skills",
    methods: ["GET"],
    async fetch() {
      const snapshot = await ctx.skills.snapshot({ cwd: process.cwd() });
      const names = (snapshot.skills ?? []).filter((s) => s.name !== undefined).map((s) => s.name).sort();
      return Response.json({ names });
    },
  });
  const base = "/api/agent-team-plus/roster";
  const disposeList = ctx.connection.fetch.register({
    path: base,
    methods: ["GET"],
    async fetch() {
      const roster = await readRoster();
      return Response.json({ entries: [...roster.values()].map(entryToWire) });
    },
  });
  const disposePut = ctx.connection.fetch.register({
    path: base + "/:name",
    methods: ["PUT"],
    async fetch(request) {
      const url = new URL(request.url);
      const name = decodeURIComponent(url.pathname.slice(base.length + 1));
      if (!MEMBER_NAME.test(name) || name === "lead") return Response.json({ error: "invalid name" }, { status: 400 });
      const data = await readBody(request);
      data.name = name;
      const dir = resolve(ROSTER_DIR);
      await mkdir(dir, { recursive: true });
      const file = join(dir, `${name}.yaml`);
      await writeFile(file, yamlFor(data), "utf8");
      return Response.json({ ok: true, file });
    },
  });
  const disposeDelete = ctx.connection.fetch.register({
    path: base + "/:name",
    methods: ["DELETE"],
    async fetch(request) {
      const url = new URL(request.url);
      const name = decodeURIComponent(url.pathname.slice(base.length + 1));
      if (!MEMBER_NAME.test(name)) return Response.json({ error: "invalid name" }, { status: 400 });
      const file = join(resolve(ROSTER_DIR), `${name}.yaml`);
      await unlink(file).catch(() => undefined);
      return Response.json({ ok: true });
    },
  });
  return () => { disposeSkills(); disposeList(); disposePut(); disposeDelete(); };
}
// dsh-agent-team-plus roster reader (S2-1, D4).
// Reads per-member YAML entries from <DSH home>/agent-team-plus/*.yaml with an
// mtime cache so edits take effect on the next spawn without a restart (regression #7).
// Model fields come ONLY from roster entries / team sheets (D7): the model
// never flows from the Lead's own choice.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { parse } from "yaml";

export const ROSTER_DIR = join(homedir(), ".dsh", "agent-team-plus");

const MEMBER_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EFFORTS = new Set(["minimal", "low", "medium", "high"]);

/**
 * One resolved roster entry. `model`/`reasoningEffort` are undefined when the
 * entry delegates to the global defaults.
 */
export class RosterEntry {
	constructor(data, sourceFile) {
		this.name = data.name;
		this.description = data.description ?? "";
		this.prompt = data.prompt ?? "";
		this.context = data.context === "fork" ? "fork" : "fresh";
		this.model = data.model;
		// dsh-agent-team-plus (S4c): optional provider that owns `model` —
		// disambiguates same-named models across providers.
		this.modelProvider = data.modelProvider;
		this.reasoningEffort = data.reasoningEffort;
		this.skills = data.skills; // undefined = inherit default; "all"/"none"/string[]
		this.tools = data.tools; // { deny: string[] } | undefined
		this.sourceFile = sourceFile;
	}
}

const cache = new Map(); // absolute file -> { mtimeMs, entries }

function fail(file, message) {
	throw new Error(`dsh-agent-team-plus: roster entry ${file}: ${message}`);
}

/** Parse and validate one roster YAML file into 0..n entries. */
function parseRosterFile(file, text) {
	const doc = parse(text);
	const list = Array.isArray(doc) ? doc : [doc];
	const entries = [];
	for (const item of list) {
		if (item === null || item === undefined) continue;
		if (typeof item !== "object" || Array.isArray(item)) fail(file, "entry must be a mapping");
		const name = item.name;
		if (typeof name !== "string" || !MEMBER_NAME.test(name) || name.length > 64 || name === "lead") {
			fail(file, `invalid member name ${JSON.stringify(name)} (lower-kebab-case, <=64, not "lead")`);
		}
		if (item.description !== undefined && (typeof item.description !== "string" || item.description.length > 200)) {
			fail(file, "description must be a string of at most 200 characters");
		}
		if (item.context !== undefined && item.context !== "fresh" && item.context !== "fork") fail(file, "context must be fresh|fork");
		if (item.model !== undefined && (typeof item.model !== "string" || item.model.length === 0 || item.model.length > 200)) fail(file, "model must be a non-empty string");
		if (item.modelProvider !== undefined && (typeof item.modelProvider !== "string" || item.modelProvider.length === 0 || item.modelProvider.length > 200)) fail(file, "modelProvider must be a non-empty string");
		if (item.reasoningEffort !== undefined && !EFFORTS.has(item.reasoningEffort)) fail(file, `reasoningEffort must be one of ${[...EFFORTS].join("|")}`);
		if (item.skills !== undefined && item.skills !== "all" && item.skills !== "none" && !Array.isArray(item.skills)) fail(file, "skills must be all|none|string[]");
		if (item.tools !== undefined && (typeof item.tools !== "object" || item.tools === null || Array.isArray(item.tools))) fail(file, "tools must be a mapping like { deny: [write] }");
		entries.push(new RosterEntry(item, file));
	}
	return entries;
}

/**
 * Read every valid roster entry. Files with a changed mtime are re-parsed;
 * invalid files are skipped with a console warning rather than breaking spawns.
 * @returns {Promise<Map<string, RosterEntry>>} name -> entry (first file wins on duplicate names)
 */
export async function readRoster() {
	const out = new Map();
	let files;
	try {
		files = await readdir(ROSTER_DIR);
	} catch {
		return out; // no roster dir yet: empty roster is a valid state
	}
	for (const file of files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))) {
		const abs = resolve(ROSTER_DIR, file);
		let mtimeMs;
		try {
			mtimeMs = (await stat(abs)).mtimeMs;
		} catch {
			continue;
		}
		const hit = cache.get(abs);
		let entries;
		if (hit && hit.mtimeMs === mtimeMs) {
			entries = hit.entries;
		} else {
			try {
				entries = parseRosterFile(file, await readFile(abs, "utf8"));
			} catch (error) {
				console.warn(String(error.message ?? error));
				cache.delete(abs);
				continue;
			}
			cache.set(abs, { mtimeMs, entries });
		}
		for (const entry of entries) if (!out.has(entry.name)) out.set(entry.name, entry);
	}
	return out;
}

/**
 * Build the runtime spawn request fields from a roster entry. These are the
 * only sanctioned sources of model/reasoningEffort (D7).
 */
export function entryToSpawnFields(entry) {
	return {
		name: entry.name,
		description: entry.description,
		...(entry.model !== undefined ? { model: entry.model } : {}),
		...(entry.modelProvider !== undefined ? { modelProvider: entry.modelProvider } : {}),
		...(entry.reasoningEffort !== undefined ? { reasoningEffort: entry.reasoningEffort } : {}),
	};
}

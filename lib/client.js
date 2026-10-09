window.__ModuleLoader__.load({ id: "@dsh-community/dsh-agent-team-plus", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
const react = __toESM(require("react"));

//#region src/client/index.ts
const inject = [
	"slots",
	"layout",
	"sessions",
	"uiConversation",
	"uiSession"
];
const ACCENT = "#38bdf8";
const PANEL_BG = "#1e293b";
const LINE = "#334155";
const TEXT = "#e2e8f0";
const DIM = "#94a3b8";
async function api(path, method, body) {
	const res = await fetch(`/api/agent-team-plus/roster${path}`, {
		method,
		headers: body !== void 0 ? { "content-type": "application/json" } : void 0,
		body: body !== void 0 ? JSON.stringify(body) : void 0
	});
	if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}`);
	return res.json();
}
function yamlFor(data) {
	const lines = [`name: ${data.name}`];
	if (data.description) lines.push(`description: ${data.description}`);
	lines.push(`context: ${data.context ?? "fresh"}`);
	if (data.model) lines.push(`model: ${data.model}`);
	if (data.reasoningEffort) lines.push(`reasoningEffort: ${data.reasoningEffort}`);
	if (data.skills === "all" || data.skills === "none") lines.push(`skills: ${data.skills}`);
	else if (Array.isArray(data.skills) && data.skills.length > 0) {
		lines.push("skills:");
		for (const s of data.skills) lines.push(`  - ${s}`);
	}
	return lines.join("\n") + "\n";
}
/** 名册管理面板 */
function RosterPanel(props) {
	const { onClose, skills } = props;
	const [entries, setEntries] = React.useState(null);
	const [editing, setEditing] = React.useState(null);
	const [error, setError] = React.useState(void 0);
	const [busy, setBusy] = React.useState(false);
	const refresh = React.useCallback(() => {
		api("").then((r) => setEntries(r.entries)).catch((e) => setError(String(e.message)));
	}, []);
	React.useEffect(refresh, [refresh]);
	const save = async () => {
		if (!editing) return;
		setBusy(true);
		setError(void 0);
		try {
			if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(editing.name) || editing.name === "lead") throw new Error("name 必须是 lower-kebab-case 且不叫 lead");
			await api(`/${encodeURIComponent(editing.name)}`, "PUT", editing);
			setEditing(null);
			refresh();
		} catch (e) {
			setError(String(e.message));
		} finally {
			setBusy(false);
		}
	};
	const remove = async (name) => {
		setBusy(true);
		try {
			await api(`/${encodeURIComponent(name)}`, "DELETE");
			refresh();
		} catch (e) {
			setError(String(e.message));
		} finally {
			setBusy(false);
		}
	};
	const field = (label, node) => (0, react.createElement)("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: 4,
		flex: 1,
		minWidth: 160
	} }, (0, react.createElement)("label", { style: {
		fontSize: 11,
		color: DIM
	} }, label), node);
	const input = (value, onChange, opts = {}) => (0, react.createElement)("input", {
		value,
		onChange: (e) => onChange(e.target.value),
		style: {
			background: "#24334a",
			border: `1px solid ${LINE}`,
			borderRadius: 6,
			color: TEXT,
			padding: "6px 10px",
			fontSize: 13
		},
		...opts
	});
	const select = (value, onChange, options) => (0, react.createElement)("select", {
		value,
		onChange: (e) => onChange(e.target.value),
		style: {
			background: "#24334a",
			border: `1px solid ${LINE}`,
			borderRadius: 6,
			color: TEXT,
			padding: "6px 10px",
			fontSize: 13
		}
	}, ...options.map((o) => (0, react.createElement)("option", {
		value: o.value,
		key: o.value
	}, o.label)));
	const skillCheckboxes = (0, react.createElement)("div", { style: {
		display: "grid",
		gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
		gap: 4,
		maxHeight: 160,
		overflowY: "auto"
	} }, ...skills.map((s) => (0, react.createElement)("label", {
		key: s,
		style: {
			display: "flex",
			gap: 6,
			alignItems: "center",
			fontSize: 12,
			background: "#24334a",
			border: `1px solid ${LINE}`,
			borderRadius: 6,
			padding: "4px 8px"
		}
	}, (0, react.createElement)("input", {
		type: "checkbox",
		checked: Array.isArray(editing.skills) && editing.skills.includes(s),
		onChange: (e) => {
			const cur = Array.isArray(editing.skills) ? [...editing.skills] : [];
			if (e.target.checked) cur.push(s);
			else cur.splice(cur.indexOf(s), 1);
			setEditing({
				...editing,
				skills: cur
			});
		}
	}), s)));
	const btn = (label, onClick, primary = false) => (0, react.createElement)("button", {
		onClick,
		disabled: busy,
		style: {
			padding: "6px 16px",
			borderRadius: 6,
			border: primary ? "none" : `1px solid ${LINE}`,
			background: primary ? ACCENT : "transparent",
			color: primary ? "#0b1220" : DIM,
			cursor: "pointer",
			fontSize: 12,
			fontWeight: primary ? 600 : 400
		}
	}, label);
	return (0, react.createElement)("div", { style: {
		position: "fixed",
		top: 0,
		right: 0,
		bottom: 0,
		width: 460,
		background: PANEL_BG,
		borderLeft: `1px solid ${LINE}`,
		zIndex: 2147483e3,
		display: "flex",
		flexDirection: "column",
		color: TEXT,
		fontFamily: "inherit",
		overflowY: "auto",
		padding: 16
	} }, (0, react.createElement)("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		marginBottom: 14
	} }, (0, react.createElement)("span", { style: {
		fontSize: 15,
		fontWeight: 600,
		flex: 1
	} }, "👥 Agent Team+ 名册"), (0, react.createElement)("button", {
		onClick: onClose,
		style: {
			border: "none",
			background: "transparent",
			color: DIM,
			cursor: "pointer",
			fontSize: 15
		}
	}, "✕")), error !== void 0 && (0, react.createElement)("div", { style: {
		background: "#3b1d1d",
		border: "1px solid #7f1d1d",
		color: "#fca5a5",
		borderRadius: 6,
		padding: "6px 10px",
		fontSize: 12,
		marginBottom: 10
	} }, error), editing === null && btn("＋ 新建队员", () => setEditing({
		name: "",
		description: "",
		context: "fresh",
		model: "",
		reasoningEffort: "",
		skills: "all"
	}), true), editing !== null && (0, react.createElement)("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: 10,
		border: `1px solid ${LINE}`,
		borderRadius: 8,
		padding: 12
	} }, field("name（lower-kebab-case，创建后不可改）", input(editing.name, (v) => setEditing({
		...editing,
		name: v.trim()
	}), { placeholder: "code-reviewer" })), field("description", input(editing.description, (v) => setEditing({
		...editing,
		description: v
	}))), (0, react.createElement)("div", { style: {
		display: "flex",
		gap: 8
	} }, field("model（留空=继承 Lead）", input(editing.model, (v) => setEditing({
		...editing,
		model: v
	}), { placeholder: "如 glm-5.3-flash" })), field("context", select(editing.context, (v) => setEditing({
		...editing,
		context: v
	}), [{
		value: "fresh",
		label: "fresh"
	}, {
		value: "fork",
		label: "fork"
	}]))), field("reasoning effort", select(editing.reasoningEffort || "", (v) => setEditing({
		...editing,
		reasoningEffort: v || void 0
	}), [
		{
			value: "",
			label: "继承"
		},
		{
			value: "minimal",
			label: "minimal"
		},
		{
			value: "low",
			label: "low"
		},
		{
			value: "medium",
			label: "medium"
		},
		{
			value: "high",
			label: "high"
		}
	])), field("skill 档位", select(Array.isArray(editing.skills) ? "list" : editing.skills, (v) => setEditing({
		...editing,
		skills: v === "list" ? [] : v
	}), [
		{
			value: "all",
			label: "all（全部可用）"
		},
		{
			value: "none",
			label: "none（无 skill）"
		},
		{
			value: "list",
			label: "名单（勾选）"
		}
	])), Array.isArray(editing.skills) && (skills.length > 0 ? skillCheckboxes : (0, react.createElement)("div", { style: {
		fontSize: 11,
		color: DIM
	} }, "本机未发现可勾选的 skill")), (0, react.createElement)("div", { style: {
		display: "flex",
		gap: 8,
		marginTop: 4
	} }, btn("保存到名册", save, true), btn("取消", () => setEditing(null))), (0, react.createElement)("pre", { style: {
		background: "#0b1220",
		borderRadius: 6,
		padding: 8,
		fontSize: 11,
		color: "#a5d6ff",
		whiteSpace: "pre-wrap",
		margin: 0
	} }, yamlFor(editing))), (0, react.createElement)("div", { style: {
		marginTop: 14,
		display: "flex",
		flexDirection: "column",
		gap: 6
	} }, ...entries === null ? [(0, react.createElement)("div", { style: {
		color: DIM,
		fontSize: 12
	} }, "加载中…")] : entries.length === 0 ? [(0, react.createElement)("div", { style: {
		color: DIM,
		fontSize: 12
	} }, "名册为空——点上面\"新建队员\"创建第一个条目")] : entries.map((e) => (0, react.createElement)("div", {
		key: e.name,
		style: {
			display: "flex",
			alignItems: "center",
			gap: 8,
			background: "#24334a",
			border: `1px solid ${LINE}`,
			borderRadius: 8,
			padding: "8px 12px"
		}
	}, (0, react.createElement)("div", { style: { flex: 1 } }, (0, react.createElement)("div", { style: {
		fontSize: 13,
		fontWeight: 600
	} }, e.name), (0, react.createElement)("div", { style: {
		fontSize: 11,
		color: DIM
	} }, e.description ?? ""), (0, react.createElement)("div", { style: {
		fontSize: 10,
		color: ACCENT
	} }, [
		e.model ?? "继承 Lead",
		e.context,
		`skills: ${e.skills === void 0 ? "默认" : e.skills === "all" ? "all" : e.skills === "none" ? "none" : `名单(${e.skills.length})`}`
	].join(" · "))), (0, react.createElement)("button", {
		onClick: () => setEditing({
			name: e.name,
			description: e.description ?? "",
			context: e.context ?? "fresh",
			model: e.model ?? "",
			reasoningEffort: e.reasoningEffort,
			skills: e.skills ?? "all"
		}),
		style: {
			border: `1px solid ${LINE}`,
			background: "transparent",
			color: DIM,
			borderRadius: 6,
			padding: "4px 10px",
			cursor: "pointer",
			fontSize: 11
		}
	}, "编辑"), (0, react.createElement)("button", {
		onClick: () => remove(e.name),
		style: {
			border: `1px solid ${LINE}`,
			background: "transparent",
			color: "#f87171",
			borderRadius: 6,
			padding: "4px 10px",
			cursor: "pointer",
			fontSize: 11
		}
	}, "删除")))));
}
/** 入口：shell.overlay 挂按钮（与 office 同层） */
function apply(ctx) {
	ctx.slots.inject("shell.overlay", () => {
		ctx.slots.register({
			name: "shell.overlay",
			id: "agent-team-plus-roster",
			order: 51
		}, ({ layout }) => {
			const [open, setOpen] = React.useState(false);
			const [skills, setSkills] = React.useState([]);
			React.useEffect(() => {
				if (!open) return;
				fetch("/api/agent-team-plus/skills").then((r) => r.json()).then((r) => setSkills(r.names ?? [])).catch(() => setSkills([]));
			}, [open]);
			return (0, react.createElement)("div", {}, (0, react.createElement)("button", {
				onClick: () => setOpen(!open),
				title: "Agent Team+ 名册管理",
				style: {
					position: "fixed",
					top: 108,
					right: 12,
					zIndex: 2147482999,
					width: 36,
					height: 36,
					borderRadius: 10,
					border: "none",
					background: open ? ACCENT : "rgba(255,255,255,0.92)",
					color: open ? "#0b1220" : "#475569",
					cursor: "pointer",
					fontSize: 16,
					boxShadow: "0 2px 10px rgba(0,0,0,0.14)"
				}
			}, "👥"), open && (0, react.createElement)(RosterPanel, {
				onClose: () => setOpen(false),
				skills
			}));
		});
	});
}

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map
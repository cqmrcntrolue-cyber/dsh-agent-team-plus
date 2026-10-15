/**
 * dsh-agent-team-plus client 半（S4b）：名册 + 团队阵容 双 tab 面板。
 * - shell.overlay 挂入口按钮（空白新会话也可用）
 * - tab 名册：条目列表 + 创建/编辑表单（model=宿主模型目录可勾选下拉、
 *   skills=复选框、tools.deny=复选框；保存写回 ~/.dsh/agent-team-plus/*.yaml）
 * - tab 团队阵容：会话内 Team 实时视图（5 秒轮询 /api/agent-team-plus/team）
 * - 数据经 host 半注册的 /api/agent-team-plus/* 路由（同源 + 浏览器认证）
 */
import { createElement, useState, useEffect } from 'react'
import * as React from 'react'

const inject = ['slots', 'layout', 'sessions', 'uiConversation', 'uiSession']

const ACCENT = '#38bdf8'
const PANEL_BG = '#1e293b'
const LINE = '#334155'
const TEXT = '#e2e8f0'
const DIM = '#94a3b8'

const DENYABLE_TOOLS = ['write', 'edit', 'pwsh', 'bash', 'web', 'browser', 'present', 'todo']

async function api(path, method, body) {
  const res = await fetch(`/api/agent-team-plus${path}`, {
    method: method ?? 'GET',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method ?? 'GET'} ${path}: HTTP ${res.status}`)
  return res.json()
}

function yamlFor(data) {
  const lines = [`name: ${data.name}`]
  if (data.description) lines.push(`description: ${data.description}`)
  lines.push(`context: ${data.context ?? 'fresh'}`)
  if (data.model) {
    lines.push(`model: ${data.model}`)
    if (data.modelProvider) lines.push(`modelProvider: ${data.modelProvider}`)
  }
  if (data.reasoningEffort) lines.push(`reasoningEffort: ${data.reasoningEffort}`)
  if (data.skills === 'all' || data.skills === 'none') {
    lines.push(`skills: ${data.skills}`)
  } else if (Array.isArray(data.skills) && data.skills.length > 0) {
    lines.push('skills:')
    for (const s of data.skills) lines.push(`  - ${s}`)
  }
  if (Array.isArray(data.tools?.deny) && data.tools.deny.length > 0) {
    lines.push('tools:')
    lines.push('  deny:')
    for (const t of data.tools.deny) lines.push(`    - ${t}`)
  }
  return lines.join('\n') + '\n'
}

/* ---------- 通用小控件 ---------- */

const inputStyle = {
  background: '#24334a', border: `1px solid ${LINE}`, borderRadius: 6,
  color: TEXT, padding: '6px 10px', fontSize: 13,
}

function Field(label, node, flex = 1) {
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, flex, minWidth: 160 } },
    createElement('label', { style: { fontSize: 11, color: DIM } }, label),
    node)
}

function TextInput(value, onChange, opts = {}) {
  return createElement('input', {
    value, onChange: (e) => onChange(e.target.value), style: inputStyle, ...opts,
  })
}

function Select(value, onChange, options) {
  // 防御：宿主二次渲染等场景 options 可能缺省——空下拉好过整个 slot 崩掉
  const list = options ?? []
  return createElement('select', { value, onChange: (e) => onChange(e.target.value), style: inputStyle },
    ...list.map((o) => createElement('option', { value: o.value, key: o.value ?? o.label }, o.label ?? o.value)))
}

function Btn(label, onClick, primary = false, disabled = false) {
  return createElement('button', {
    onClick, disabled,
    style: {
      padding: '6px 16px', borderRadius: 6,
      border: primary ? 'none' : `1px solid ${LINE}`,
      background: primary ? ACCENT : 'transparent',
      color: primary ? '#0b1220' : DIM,
      cursor: disabled ? 'default' : 'pointer', fontSize: 12,
      fontWeight: primary ? 600 : 400, opacity: disabled ? 0.5 : 1,
    },
  }, label)
}

function ChipGroup(all, selected, onToggle, emptyHint) {
  const list = all ?? []
  if (list.length === 0) return createElement('div', { style: { fontSize: 11, color: DIM } }, emptyHint)
  const sel = selected ?? []
  return createElement('div', {
    style: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
      gap: 4, maxHeight: 170, overflowY: 'auto',
    },
  }, ...list.map((item) => {
    const on = sel.includes(item)
    return createElement('label', {
      key: item,
      style: {
        display: 'flex', gap: 6, alignItems: 'center', fontSize: 12,
        background: on ? '#1d3a5f' : '#24334a',
        border: `1px solid ${on ? ACCENT : LINE}`, borderRadius: 6, padding: '4px 8px',
        cursor: 'pointer',
      },
    },
      createElement('input', { type: 'checkbox', checked: on, onChange: () => onToggle(item) }),
      createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item))
  }))
}

function ErrorBar(error) {
  if (error === undefined) return null
  return createElement('div', {
    style: {
      background: '#3b1d1d', border: '1px solid #7f1d1d', color: '#fca5a5',
      borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 10,
    },
  }, error)
}

/* ---------- tab 名册（含创建/编辑表单） ---------- */

function RosterPanel(props) {
  // 解构兜底：宿主 slot 二次渲染等场景下 props 可能不完整
  const { skills = [], models = [], reload = () => {} } = props ?? {}
  const [entries, setEntries] = useState(null)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(undefined)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    api('/roster').then((r) => setEntries(r.entries)).catch((e) => setError(String(e.message)))
  }
  useEffect(refresh, [])

  const save = async () => {
    if (!editing) return
    setBusy(true); setError(undefined)
    try {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(editing.name) || editing.name === 'lead')
        throw new Error('name 必须是 lower-kebab-case 且不叫 lead')
      await api(`/roster/${encodeURIComponent(editing.name)}`, 'PUT', editing)
      setEditing(null); refresh(); reload()
    } catch (e) { setError(String(e.message)) } finally { setBusy(false) }
  }
  const remove = async (name) => {
    setBusy(true)
    try { await api(`/roster/${encodeURIComponent(name)}`, 'DELETE'); refresh(); reload() }
    catch (e) { setError(String(e.message)) } finally { setBusy(false) }
  }

  // value 用 provider|id 组合键——不同 provider 存在同名模型，纯 id 会让
  // select 永远命中第一个 provider（用户实测 bug）。保存时拆回两个字段。
  // models 可能未加载/接口失败（undefined），必须兜底为空数组。
  const modelOptions = [
    { value: '', label: '继承 Lead' },
    ...(models ?? []).map((m) => ({ value: `${m.provider}|${m.id}`, label: `${m.name}（${m.provider}）` })),
  ]

  if (editing !== null) {
    const skillList = Array.isArray(editing.skills) ? editing.skills : []
    const denied = Array.isArray(editing.tools?.deny) ? editing.tools.deny : []
    const toggleSkill = (s) => setEditing({
      ...editing,
      skills: skillList.includes(s) ? skillList.filter((x) => x !== s) : [...skillList, s],
    })
    const toggleDeny = (t) => {
      const next = denied.includes(t) ? denied.filter((x) => x !== t) : [...denied, t]
      setEditing({ ...editing, tools: next.length > 0 ? { deny: next } : undefined })
    }
    return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${LINE}`, borderRadius: 8, padding: 12 } },
      ErrorBar(error),
      Field('name（lower-kebab-case，创建后不可改）',
        TextInput(editing.name, (v) => setEditing({ ...editing, name: v.trim() }), { placeholder: 'code-reviewer' })),
      Field('description（队员人设一句话）',
        TextInput(editing.description ?? '', (v) => setEditing({ ...editing, description: v }))),
      createElement('div', { style: { display: 'flex', gap: 8 } },
        Field('model（宿主模型目录；空=继承 Lead）',
          Select(editing.model ? `${editing.modelProvider ?? ''}|${editing.model}` : '', (v) => {
            if (v === '') return setEditing({ ...editing, model: undefined, modelProvider: undefined })
            const sep = v.indexOf('|')
            const pickedProvider = v.slice(0, sep), pickedId = v.slice(sep + 1)
            setEditing({ ...editing, model: pickedId, modelProvider: pickedProvider })
          }), modelOptions),
        Field('context', Select(editing.context ?? 'fresh', (v) => setEditing({ ...editing, context: v }),
          [{ value: 'fresh', label: 'fresh' }, { value: 'fork', label: 'fork' }]))),
      createElement('div', { style: { display: 'flex', gap: 8 } },
        Field('reasoning effort', Select(editing.reasoningEffort ?? '', (v) => setEditing({ ...editing, reasoningEffort: v || undefined }), [
          { value: '', label: '继承' }, { value: 'minimal', label: 'minimal' }, { value: 'low', label: 'low' },
          { value: 'medium', label: 'medium' }, { value: 'high', label: 'high' }])),
        Field('skill 档位', Select(Array.isArray(editing.skills) ? 'list' : (editing.skills ?? 'all'), (v) => setEditing({ ...editing, skills: v === 'list' ? [] : v }), [
          { value: 'all', label: 'all（全部可用）' }, { value: 'none', label: 'none（无 skill）' }, { value: 'list', label: '名单（勾选）' }]))),
      Array.isArray(editing.skills) && ChipGroup(skills, skillList, toggleSkill, '本机未发现可勾选的 skill'),
      createElement('div', {},
        createElement('div', { style: { fontSize: 11, color: DIM, marginBottom: 4 } }, 'tools.deny（禁用的工具，按需勾选）'),
        ChipGroup(DENYABLE_TOOLS, denied, toggleDeny, '—')),
      createElement('div', { style: { display: 'flex', gap: 8, marginTop: 4 } },
        Btn('保存到名册', save, true, busy),
        Btn('取消', () => setEditing(null))),
      createElement('pre', {
        style: {
          background: '#0b1220', borderRadius: 6, padding: 8, fontSize: 11,
          color: '#a5d6ff', whiteSpace: 'pre-wrap', margin: 0,
        },
      }, yamlFor(editing)))
  }

  const listBody = entries === null
    ? createElement('div', { style: { color: DIM, fontSize: 12 } }, '加载中…')
    : entries.length === 0
      ? createElement('div', { style: { color: DIM, fontSize: 12 } }, '名册为空——点上面"新建队员"创建第一个条目')
      : createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        ...entries.map((e) => createElement('div', {
          key: e.name,
          style: {
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#24334a', border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 12px',
          },
        },
          createElement('div', { style: { flex: 1 } },
            createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, e.name),
            createElement('div', { style: { fontSize: 11, color: DIM } }, e.description ?? ''),
            createElement('div', { style: { fontSize: 10, color: ACCENT } },
              [
                e.model ? (e.modelProvider ? `${e.model}（${e.modelProvider}）` : e.model) : '继承 Lead',
                e.context ?? 'fresh',
                e.skills === undefined ? 'skills: 默认' : e.skills === 'all' ? 'skills: all' : e.skills === 'none' ? 'skills: none' : `skills: 名单(${e.skills.length})`,
                Array.isArray(e.tools?.deny) && e.tools.deny.length > 0 ? `deny: ${e.tools.deny.join('/')}` : '',
              ].filter(Boolean).join(' · '))),
          Btn('编辑', () => setEditing({
            name: e.name, description: e.description ?? '', context: e.context ?? 'fresh',
            model: e.model ?? '', modelProvider: e.modelProvider ?? '', reasoningEffort: e.reasoningEffort,
            skills: e.skills ?? 'all', tools: e.tools,
          })),
          Btn('删除', () => remove(e.name)))))
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
    ErrorBar(error),
    createElement('div', { style: { display: 'flex', alignItems: 'center', marginBottom: 6 } },
      createElement('div', { style: { flex: 1, fontSize: 11, color: DIM } },
        '名册条目保存于 ~/.dsh/agent-team-plus/*.yaml（唯一真源）；Lead 用 spawn_teammate_plus({from: "名字"}) 实例化'),
      Btn('＋ 新建队员', () => setEditing({ name: '', description: '', context: 'fresh', skills: 'all' }), true)),
    listBody)
}

/* ---------- tab 团队阵容（会话内实时视图） ---------- */
function LineupPanel() {  const [members, setMembers] = useState(null)
  const [error, setError] = useState(undefined)
  const refresh = () => {
    api('/team').then((r) => setMembers(r.members)).catch((e) => setError(String(e.message)))
  }
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [])
  const statusColor = { running: '#4ade80', inactive: DIM, provisioning: '#facc15', failed: '#f87171' }
  const listBody = members === null
    ? createElement('div', { style: { color: DIM, fontSize: 12 } }, '加载中…')
    : members.length === 0
      ? createElement('div', { style: { color: DIM, fontSize: 12 } }, '本会话尚未组建 Team')
      : createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        ...members.map((m, i) => createElement('div', {
          key: m.target ?? m.name ?? i,
          style: {
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#24334a', border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 12px',
          },
        },
          createElement('div', { style: { flex: 1 } },
            createElement('div', { style: { fontSize: 13, fontWeight: 600 } },
              m.target ?? m.name ?? '?',
              createElement('span', {
                style: { fontSize: 10, color: statusColor[m.status] ?? DIM, marginLeft: 8 },
              }, m.role === 'lead' ? 'LEAD' : (m.status ?? ''))),
            createElement('div', { style: { fontSize: 11, color: DIM } }, m.description ?? ''),
            createElement('div', { style: { fontSize: 10, color: ACCENT } },
              [
                m.model ? (m.modelProvider ? `${m.model}（${m.modelProvider}）` : m.model) : (m.role === 'lead' ? '' : '继承 Lead'),
                m.context,
                Array.isArray(m.toolFilter?.deny) && m.toolFilter.deny.length > 0 ? `deny: ${m.toolFilter.deny.join('/')}` : '',
                Array.isArray(m.skills) ? `skills: 名单(${m.skills.length})` : '',
              ].filter(Boolean).join(' · '))))))
  return createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
    createElement('div', { style: { fontSize: 11, color: DIM, marginBottom: 6 } },
      '当前会话的 Team 实时视图（5 秒自动刷新）。队员由 Lead 用 spawn_teammate_plus 组建——面板不直接组建，避免绕过名册权限边界。'),
    ErrorBar(error),
    listBody)
}

/* ---------- 根面板（tabs） ---------- */

function PanelRoot(props) {
  const { onClose } = props
  const [tab, setTab] = useState('roster')
  const [skills, setSkills] = useState([])
  const [models, setModels] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    fetch('/api/agent-team-plus/skills').then((r) => r.json()).then((r) => setSkills(r.names ?? [])).catch(() => setSkills([]))
    fetch('/api/agent-team-plus/models').then((r) => r.json()).then((r) => setModels(r.models ?? [])).catch(() => setModels([]))
  }, [reloadKey])
  const tabBtn = (id, label) => createElement('button', {
    onClick: () => setTab(id),
    style: {
      padding: '6px 18px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
      background: tab === id ? ACCENT : 'transparent',
      color: tab === id ? '#0b1220' : DIM, fontWeight: tab === id ? 600 : 400,
    },
  }, label)
  return createElement('div', {
    style: {
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
      background: PANEL_BG, borderLeft: `1px solid ${LINE}`, zIndex: 2147483000,
      display: 'flex', flexDirection: 'column', color: TEXT, fontFamily: 'inherit', padding: 16,
    },
  },
    createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 } },
      createElement('span', { style: { fontSize: 15, fontWeight: 600, flex: 1 } }, '👥 Agent Team+'),
      createElement('button', {
        onClick: onClose,
        style: { border: 'none', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 15 },
      }, '✕')),
    createElement('div', { style: { display: 'flex', gap: 4, background: '#0b1220', borderRadius: 8, padding: 4, marginBottom: 12 } },
      tabBtn('roster', '名册'),
      tabBtn('lineup', '团队阵容')),
    createElement('div', { style: { flex: 1, overflowY: 'auto' } },
      tab === 'roster'
        ? createElement(RosterPanel, { skills, models, reload: () => setReloadKey((k) => k + 1) })
        : createElement(LineupPanel)))
}

/* ---------- 错误边界：渲染异常不炸整个 slot ---------- */

class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error !== null) {
      return createElement('div', { style: { padding: 12, color: '#fca5a5', fontSize: 12 } },
        createElement('div', { style: { fontWeight: 600, marginBottom: 6 } }, 'Agent Team+ 面板渲染出错'),
        createElement('pre', {
          style: { background: '#0b1220', borderRadius: 6, padding: 8, whiteSpace: 'pre-wrap', fontSize: 11 },
        }, String(this.state.error?.stack ?? this.state.error)))
    }
    return this.props.children
  }
}

/** 入口：shell.overlay 挂按钮 */
function apply(ctx) {
  ctx.slots.inject('shell.overlay', () => {
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'agent-team-plus-roster',
      order: 51,
    }, () => {
      const [open, setOpen] = useState(false)
      return createElement('div', {},
        createElement('button', {
          onClick: () => setOpen(!open),
          title: 'Agent Team+',
          style: {
            position: 'fixed', top: 108, right: 12, zIndex: 2147482999,
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: open ? ACCENT : 'rgba(255,255,255,0.92)',
            color: open ? '#0b1220' : '#475569',
            cursor: 'pointer', fontSize: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
          },
        }, '👥'),
        open && createElement(PanelErrorBoundary, {},
          createElement(PanelRoot, { onClose: () => setOpen(false) })))
    })
  })
}

export { apply, inject }

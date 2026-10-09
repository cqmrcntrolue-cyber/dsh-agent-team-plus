// dsh-agent-team-plus: per-member skill allowlist registry (S3).
// The vendored agent-team runtime registers each member's skill policy at
// spawn time; the vendored tool-skill reads it in agent/pre-step and in the
// skill tool execute to filter the catalog and get(). Agents not in the
// registry (the Lead, ordinary sessions) keep the unfiltered behavior.
const policies = new Map(); // agentId -> { mode: 'all' | 'none' | 'list', list?: Set<string> }

export function registerMemberSkills(agentId, policy) {
	if (agentId === undefined || agentId === null) return
	policies.set(String(agentId), policy)
}

export function unregisterMemberSkills(agentId) {
	if (agentId === undefined || agentId === null) return
	policies.delete(String(agentId))
}

/** Resolve the skill policy for one agent; undefined = unfiltered. */
export function memberSkillsFor(agent) {
	if (agent === undefined || agent === null) return undefined
	const id = agent.id !== undefined && agent.id !== null ? String(agent.id) : undefined
	if (id === undefined) return undefined
	return policies.get(id)
}

/** Whether one skill passes a member's policy. undefined policy = pass. */
export function skillAllowedFor(agent, skillName) {
	const policy = memberSkillsFor(agent)
	if (policy === undefined) return true
	if (policy.mode === 'none') return false
	if (policy.mode === 'all') return true
	return policy.list?.has(skillName) === true
}

/** Filter an array of skill summaries by the agent's policy. */
export function filterSkillsFor(agent, skills) {
	const policy = memberSkillsFor(agent)
	if (policy === undefined) return skills
	return skills.filter((s) => skillAllowedFor(agent, s.name))
}

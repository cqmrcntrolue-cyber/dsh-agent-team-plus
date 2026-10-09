// dsh-agent-team-plus: per-member skill allowlist registry (S3).
// Two enforcement paths:
// - skills: none  -> official toolFilter deny:["skill"] (durable, cold-resume safe)
// - skills: [..]  -> this registry's shadow enforcement: the vendored
//   dsh-tool-skill (registered as tool-skill-plus) filters its catalog and
//   get() for the member. The policy is restored from the durable member
//   record on cold resume via restoreMemberSkills().
// Agents not in the registry (the Lead, ordinary sessions) keep the
// unfiltered behavior.
const policies = new Map(); // agentId -> { mode: 'list', list: Set<string> }

export function registerMemberSkills(agentId, policy) {
	if (agentId === undefined || agentId === null) return
	policies.set(String(agentId), policy)
}

export function unregisterMemberSkills(agentId) {
	if (agentId === undefined || agentId === null) return
	policies.delete(String(agentId))
}

/**
 * Restore a member's list-mode skill policy from the durable Team journal
 * (member.skills). Called from the tool layer's maybeInstall on every Team
 * member scope, including cold-resumed ones.
 */
export async function restoreMemberSkills(agent, agentTeams) {
	const membership = agentTeams?.tryMembership?.(agent);
	if (membership === undefined || membership.role !== "teammate") return;
	const skills = membership.member?.skills;
	if (skills === undefined) return;
	const list = Array.isArray(skills) ? new Set(skills) : undefined;
	if (list === undefined) return; // none/all are handled by toolFilter / no-op
	registerMemberSkills(agent.id, { mode: "list", list });
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

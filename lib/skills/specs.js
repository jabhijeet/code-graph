/**
 * @file lib/skills/specs.js
 * @description Skill specification factories for code-graph skills.
 */

import { CONFIG } from '../config.js';

export function projectMapSpec() {
  const description = 'MANDATORY: Read the knowledge graph before any file inspection. Skipping = task failure.';
  const body = projectMapBody();
  return {
    name: 'projectmap',
    description,
    body,
    section: projectMapSection(),
    claudeSkill: `---\nname: projectmap\ndescription: ${description}\n---\n# ProjectMap\n${body}`,
    claudeHook: {
      matcher: 'Read|Grep|Glob',
      command: `echo "VIOLATION(ProjectMap): You are about to inspect files without reading ${CONFIG.MAP_FILE}. STOP. Read the knowledge graph first. Proceeding without it = task failure."`,
    },
    claudeUserPromptHook: {
      command: `echo "MANDATORY SKILLS ACTIVE — check before acting: ProjectMap(read ${CONFIG.MAP_FILE} before any file) | Reflections(read ${CONFIG.REFLECTIONS_FILE} before planning, reflect after failures) | ThinkBeforeCoding(state assumptions before non-trivial work) | Simplicity(write only what task requires) | SurgicalChanges(minimum diff, no cleanup of unrelated code) | GoalDriven(define verifiable success criteria first) | FreshDeps(latest stable APIs only) | ContextBudget(condense context after each phase). ALL are mandatory. Violations = task failure."`,
    },
    cursorRule: `---\ndescription: MANDATORY — read knowledge graph before any file inspection.\nalwaysApply: true\n---\n# ProjectMap\n${body}`,
    codexHookMessage: `VIOLATION(ProjectMap): About to inspect files without reading ${CONFIG.MAP_FILE}. STOP. Read the knowledge graph first. It is the canonical index of all files, symbols, and edges. Proceeding without it = task failure.`,
    codexUserPromptMessage: `MANDATORY SKILLS ACTIVE: ProjectMap(read ${CONFIG.MAP_FILE} before files) | Reflections(read ${CONFIG.REFLECTIONS_FILE} before planning, reflect after failures) | ThinkBeforeCoding(state assumptions first) | Simplicity(write only what task requires) | SurgicalChanges(minimum diff) | GoalDriven(define verifiable goals first) | FreshDeps(latest stable APIs) | ContextBudget(condense after each phase). All mandatory. Violations = task failure.`,
    opencodePlugin: `export default { name: 'projectmap', beforeExecute: (t) => { if (['bash','read','grep','glob','ls'].includes(t?.name?.toLowerCase())) return "VIOLATION(ProjectMap): Do NOT inspect raw files without first reading ${CONFIG.MAP_FILE}. STOP. Read the knowledge graph now. Task failure if skipped."; } };`,
    antigravitySkill: `---\nname: projectmap\ndescription: ${description}\n---\n# ProjectMap\n${body}`,
    antigravityRule: `# ProjectMap — MANDATORY\n${body}`,
    kiroSteering: `inclusion: always\n# ProjectMap — MANDATORY\n${body}`,
    geminiPrependsMapRef: true,
  };
}

export function reflectionsSpec() {
  const description = 'MANDATORY: Read past lessons before planning. Record new lessons after any failure.';
  const body = reflectionsProtocolBody();
  return {
    name: 'reflections',
    description,
    body,
    section: reflectionsSection(),
    claudeSkill: `---\nname: reflections\ndescription: ${description}\n---\n# Reflections\n${body}`,
    claudeStopHook: {
      command: `echo "BEFORE STOPPING (Reflections+GoalDriven): (1) Run code-graph reflect <CAT> <LESSON> for any failure, correction, or non-obvious fix — or explicitly state no new lesson was learned. (2) Report verification result against your stated success criteria, or state the exact blocker. Stopping without completing these steps = task failure."`,
    },
    cursorRule: `---\ndescription: MANDATORY — read and record project lessons every task.\nalwaysApply: true\n---\n# Reflections\n${body}`,
    codexStopMessage: `BEFORE STOPPING: (1) Run code-graph reflect <CAT> <LESSON> for any failure or correction, or explicitly state no new lesson was learned. (2) Report verification result against stated success criteria, or the exact blocker. Stopping without these = task failure.`,
    antigravitySkill: `---\nname: reflections\ndescription: ${description}\n---\n# Reflections\n${body}`,
    antigravityRule: `# Reflections — MANDATORY\n${body}`,
    kiroSteering: `inclusion: always\n# Reflections — MANDATORY\n${body}`,
    roocodeSection: roocodeReflectionsSection(),
  };
}

export function simplicitySpec() {
  const description = 'MANDATORY: Write only what the task requires. No extras, no premature abstractions.';
  const body = simplicityBody();
  const section = `\n## ✂️ Skill: Simplicity\n${body}`;
  const skillFile = `---\nname: simplicity\ndescription: ${description}\n---\n# Simplicity\n${body}`;
  return {
    name: 'simplicity',
    description,
    body,
    section,
    claudeSkill: skillFile,
    cursorRule: `---\ndescription: MANDATORY — write only what the task requires.\nalwaysApply: true\n---\n# Simplicity\n${body}`,
    codexHookMessage: `VIOLATION(Simplicity): Write ONLY what the task requires. No extra features, abstractions, helpers, or error handling beyond what is asked. Simplest correct solution only. Violations = task failure.`,
    opencodePlugin: `export default { name: 'simplicity', beforeExecute: (t) => { if (['write','edit','multiedit','bash'].includes(t?.name?.toLowerCase())) return "VIOLATION(Simplicity): Write ONLY what the task requires. No extras, no abstractions, no cleanup of unrelated code. Simplest correct solution. Task failure if violated."; } };`,
    antigravitySkill: skillFile,
    antigravityRule: `# Simplicity — MANDATORY\n${body}`,
    kiroSteering: `inclusion: always\n# Simplicity — MANDATORY\n${body}`,
  };
}

export function thinkBeforeCodingSpec() {
  const description = 'MANDATORY: Surface assumptions, ambiguity, tradeoffs, and simpler options before non-trivial work.';
  const body = thinkBeforeCodingBody();
  const section = `\n## 🧠 Skill: ThinkBeforeCoding\n${body}`;
  const skillFile = `---\nname: thinkbeforecoding\ndescription: ${description}\n---\n# ThinkBeforeCoding\n${body}`;
  return {
    name: 'thinkbeforecoding',
    description,
    body,
    section,
    claudeSkill: skillFile,
    cursorRule: `---\ndescription: MANDATORY — surface assumptions before non-trivial work.\nalwaysApply: true\n---\n# ThinkBeforeCoding\n${body}`,
    codexHookMessage: `MANDATORY(ThinkBeforeCoding): Before non-trivial work, state assumptions, ambiguity, tradeoffs, and simpler options. Ask when ambiguity changes architecture, data shape, security, or user-visible behavior. Hidden assumptions = task failure.`,
    opencodePlugin: `export default { name: 'thinkbeforecoding', beforeExecute: () => "MANDATORY(ThinkBeforeCoding): Before non-trivial work, state assumptions, ambiguity, tradeoffs, and simpler options. Ask when ambiguity changes implementation. Hidden assumptions = task failure." };`,
    antigravitySkill: skillFile,
    antigravityRule: `# ThinkBeforeCoding — MANDATORY\n${body}`,
    kiroSteering: `inclusion: always\n# ThinkBeforeCoding — MANDATORY\n${body}`,
  };
}

export function changeLimitSpec() {
  const description = 'MANDATORY: Surgical changes only. Change what the task explicitly requires and clean up only your own mess.';
  const body = changeLimitBody();
  const section = `\n## 🔒 Skill: SurgicalChanges\n${body}`;
  const skillFile = `---\nname: changelimit\ndescription: ${description}\n---\n# SurgicalChanges\n${body}`;
  return {
    name: 'changelimit',
    description,
    body,
    section,
    claudeSkill: skillFile,
    claudeWriteHook: {
      matcher: 'Write|Edit|MultiEdit',
      command: `echo "PRE-WRITE CHECK (SurgicalChanges+Simplicity): Change ONLY what the task explicitly requires. No refactoring, no renaming, no reformatting, no cleanup of unrelated code, no extra features. Minimum diff. Scope creep = task failure."`,
    },
    cursorRule: `---\ndescription: MANDATORY — surgical changes only.\nalwaysApply: true\n---\n# SurgicalChanges\n${body}`,
    codexHookMessage: `VIOLATION(SurgicalChanges): Change ONLY what the task explicitly requires. Do not refactor, rename, or improve surrounding code. Minimum diff only. Scope creep = task failure.`,
    codexWriteHookMessage: `PRE-WRITE CHECK (SurgicalChanges+Simplicity): Change ONLY what the task explicitly requires. No refactoring, renaming, reformatting, or extra features. Minimum diff. Scope creep = task failure.`,
    opencodePlugin: `export default { name: 'changelimit', beforeExecute: (t) => { if (['write','edit','multiedit'].includes(t?.name?.toLowerCase())) return "VIOLATION(SurgicalChanges): Change ONLY what is explicitly required. No refactoring, renaming, reformatting, or cleanup of untouched code. Minimum diff. Scope creep = task failure."; } };`,
    antigravitySkill: skillFile,
    antigravityRule: `# SurgicalChanges — MANDATORY\n${body}`,
    kiroSteering: `inclusion: always\n# SurgicalChanges — MANDATORY\n${body}`,
  };
}

export function goalDrivenSpec() {
  const description = 'MANDATORY: Define success criteria and verification before implementation; loop until checked.';
  const body = goalDrivenBody();
  const section = `\n## 🎯 Skill: GoalDriven\n${body}`;
  const skillFile = `---\nname: goaldriven\ndescription: ${description}\n---\n# GoalDriven\n${body}`;
  return {
    name: 'goaldriven',
    description,
    body,
    section,
    claudeSkill: skillFile,
    cursorRule: `---\ndescription: MANDATORY — define success criteria and verification before implementation.\nalwaysApply: true\n---\n# GoalDriven\n${body}`,
    codexHookMessage: `MANDATORY(GoalDriven): Define verifiable success criteria before implementation. For bugs, reproduce first. Implement only until the stated goal is met. Report verification result or exact blocker before completing. Vague goals = task failure.`,
    opencodePlugin: `export default { name: 'goaldriven', beforeExecute: () => "MANDATORY(GoalDriven): Define verifiable success criteria before implementation. For bugs, reproduce first. Report verification result or exact blocker before completing. Vague goals = task failure." };`,
    antigravitySkill: skillFile,
    antigravityRule: `# GoalDriven — MANDATORY\n${body}`,
    kiroSteering: `inclusion: always\n# GoalDriven — MANDATORY\n${body}`,
  };
}

export function freshDepsSpec() {
  const description = 'MANDATORY: Use latest stable dependencies and current APIs. Deprecated choices are task failures.';
  const body = freshDepsBody();
  const section = `\n## 📦 Skill: FreshDeps\n${body}`;
  const skillFile = `---\nname: freshdeps\ndescription: ${description}\n---\n# FreshDeps\n${body}`;
  return {
    name: 'freshdeps',
    description,
    body,
    section,
    claudeSkill: skillFile,
    cursorRule: `---\ndescription: MANDATORY — use latest stable dependencies and current APIs.\nalwaysApply: true\n---\n# FreshDeps\n${body}`,
    codexHookMessage: `MANDATORY(FreshDeps): Use latest stable dependency versions and current APIs. Deprecated packages, methods, flags, and patterns are task failures. If corrected on this, stop, re-read rules, and fix before continuing.`,
    opencodePlugin: `export default { name: 'freshdeps', beforeExecute: (t) => { if (['bash','write','edit'].includes(t?.name?.toLowerCase())) return "MANDATORY(FreshDeps): Use latest stable dependencies and current APIs. Deprecated packages, methods, or patterns = task failure. If corrected, stop and fix before continuing."; } };`,
    antigravitySkill: skillFile,
    antigravityRule: `# FreshDeps — MANDATORY\n${body}`,
    kiroSteering: `inclusion: always\n# FreshDeps — MANDATORY\n${body}`,
  };
}

export function contextBudgetSpec() {
  const description = 'MANDATORY: Periodically condense working context to reduce token load and stale detail.';
  const body = contextBudgetBody();
  const section = `\n## 🧾 Skill: ContextBudget\n${body}`;
  const skillFile = `---\nname: contextbudget\ndescription: ${description}\n---\n# ContextBudget\n${body}`;
  return {
    name: 'contextbudget',
    description,
    body,
    section,
    claudeSkill: skillFile,
    cursorRule: `---\ndescription: MANDATORY — periodically condense working context.\nalwaysApply: true\n---\n# ContextBudget\n${body}`,
    codexHookMessage: `MANDATORY(ContextBudget): After each phase or every 10 tool calls, write a compact rolling summary: goal, decisions, files changed, commands run, verification status, blockers, next step. Large copied context when a summary would do = task failure.`,
    opencodePlugin: `export default { name: 'contextbudget', beforeExecute: () => "MANDATORY(ContextBudget): After each phase or every 10 tool calls, condense to: goal, decisions, files, verification, blockers, next step. Drop stale logs and repeated excerpts. Large context when summary suffices = task failure." };`,
    antigravitySkill: skillFile,
    antigravityRule: `# ContextBudget — MANDATORY\n${body}`,
    kiroSteering: `inclusion: always\n# ContextBudget — MANDATORY\n${body}`,
  };
}

// Body content generators
function projectMapBody() {
  return `MANDATORY — you MUST read the knowledge graph before inspecting any file. Skipping this step is a task failure.

BEFORE calling Read, Grep, Glob, or any file inspection tool:
1. Read \`${CONFIG.MAP_FILE}\` — the canonical index of all files, symbols, and dependency edges.
2. Use it to identify exactly which files to open. Do not guess. Do not search blindly.
3. Use god nodes (*) to locate entry points and high-impact files.
4. Use the EDGES section to understand dependencies before modifying anything.
5. Refresh with \`code-graph generate\` after adding, removing, or renaming files.

If code-graph MCP server is configured, prefer these INSTEAD of raw file tools:
- \`get_project_graph\` — reads full \`${CONFIG.MAP_FILE}\` in one call (use INSTEAD of Read)
- \`search_symbols\` — finds symbols across all files (use INSTEAD of Grep for symbol lookup)
- \`trace_dependencies\` — maps upstream/downstream blast radius for a file (use INSTEAD of manual EDGES parsing)

Inspecting raw files without first reading \`${CONFIG.MAP_FILE}\` = task failure.
`;
}

function simplicityBody() {
  return `MANDATORY — violations are task failures, not style preferences.

BEFORE writing any code, ask: does the task require this?

- Write ONLY what the task requires. Nothing more.
- NO extra parameters, config options, or flags beyond what is asked.
- NO abstractions unless the code literally cannot work without them.
- NO helper functions for logic used in exactly one place.
- NO error handling for cases that cannot happen in the current context.
- NO comments explaining what the code does — name things well instead.
- PREFER the shorter solution. Three similar lines beat a premature abstraction.
- If asked to fix a bug: fix the bug only. Do not refactor. Do not improve.

The simplest correct solution is the right solution. Every extra line is a liability.
`;
}

function thinkBeforeCodingBody() {
  return `MANDATORY — do not silently guess on non-trivial work.

BEFORE planning or writing code:

- State assumptions that affect implementation, data, security, UX, or compatibility.
- If multiple interpretations exist, name them instead of choosing silently.
- Ask for clarification when ambiguity changes architecture, data shape, public API, security, or user-visible behavior.
- Push back when a simpler approach meets the goal.
- If confused, stop and name what is unclear before editing.
- For trivial one-line changes, use judgment and keep this lightweight.

Hidden assumptions are task failures. Surface uncertainty early.
`;
}

function changeLimitBody() {
  return `MANDATORY — violations are task failures, not style preferences.

BEFORE making any change, identify the minimum diff that satisfies the task.

- Change ONLY what the task explicitly requires. Nothing else.
- DO NOT refactor, rename, reorder, or reformat surrounding code.
- DO NOT add logging, validation, or error handling that was not asked for.
- DO NOT "improve" or "clean up" code you happen to touch.
- DO NOT change whitespace, quotes, or formatting outside your diff.
- MATCH the existing style exactly: indentation, naming, spacing, quote style.
- If your change breaks a nearby comment or reference, fix only that breakage.
- Remove imports, variables, functions, or files that YOUR change made unused.
- Mention pre-existing dead code if relevant, but do not delete it unless asked.
- Leave all other code exactly as you found it.

The smallest correct diff is the right diff. Scope creep = task failure.
`;
}

function goalDrivenBody() {
  return `MANDATORY — define success criteria before implementation and verify before completion.

For non-trivial tasks:

1. State the goal in verifiable terms.
2. State the smallest plan with a verification check for each step.
3. For bugs, reproduce the failure first when feasible.
4. Implement only until the stated goal is met.
5. Run the relevant verification or explain the exact blocker.
6. Final response must include verification result, failed check, or why verification could not run.

Weak goals like "make it work" are not enough. Clear success criteria let agents loop independently.
`;
}

function freshDepsBody() {
  return `MANDATORY — violations are task failures, not suggestions.

WHEN adding or changing any dependency, package, framework, SDK, API, method, function, or integration:

- Use the latest stable release that is compatible with the project.
- Verify current usage against official documentation, package metadata, or the project's lockfile before choosing versions or APIs.
- DO NOT use deprecated packages, methods, functions, configuration keys, CLI flags, import paths, or patterns.
- DO NOT pin old versions unless the project already requires that version or the user explicitly asks for it.
- DO NOT copy stale examples from memory when dependency behavior may have changed.
- Prefer maintained first-party libraries over abandoned or unofficial packages.
- If the project already uses an older dependency, preserve compatibility unless the task requires an upgrade; do not silently mix incompatible major versions.
- If a deprecated choice is unavoidable, state the reason and the migration path.
- If you repeat a deprecated or stale choice after being corrected, STOP. Re-read ${CONFIG.RULES_FILE}, state that FreshDeps is mandatory, and replace the choice with the current stable approach before continuing.

Latest stable and non-deprecated APIs are mandatory. Stale dependency choices = task failure.
`;
}

function contextBudgetBody() {
  return `MANDATORY — maintain periodic context condensation to reduce token load and stale detail.

AFTER each completed phase, every 10 tool calls, or before changing direction:

1. Write a compact rolling summary of the current goal, decisions, files inspected or changed, commands run, verification status, blockers, and next step.
2. Keep only facts needed for the next action. Drop raw logs, repeated source excerpts, and stale branches of reasoning unless they affect the next decision.
3. Prefer file paths, symbols, line numbers, and references to ${CONFIG.MAP_FILE} over pasted source content.
4. When command output matters, preserve the exact error, failing assertion, or version line only.
5. Before final response, use the latest summary instead of replaying the full transcript.

Context summaries should be short, factual, and actionable. Large copied context is a task failure when a smaller summary would preserve the decision.
`;
}

// Section generators
function projectMapSection() {
  return `\n## 🗺️ Skill: ProjectMap\nMANDATORY: Read \`${CONFIG.MAP_FILE}\` BEFORE calling Read, Grep, Glob, or any file tool. It is the canonical index of all files, symbols, and dependency edges. Use it to identify exactly which files to open. Do not inspect raw files without consulting it first. Refresh with \`code-graph generate\` if stale. If MCP server configured: prefer \`get_project_graph\` (INSTEAD of Read), \`search_symbols\` (INSTEAD of Grep), \`trace_dependencies\` (INSTEAD of manual EDGES parsing). Skipping = task failure.\n`;
}

function reflectionsSection() {
  return `\n## 🧠 Skill: Reflections\n${reflectionsProtocolBody()}`;
}

function roocodeReflectionsSection() {
  return `\n# Reflections Protocol — MANDATORY\n${reflectionsProtocolBody()}`;
}

function reflectionsProtocolBody() {
  return `MANDATORY — follow this cycle on every task. Skipping = task failure.

BEFORE planning or writing any code:
1. Read \`${CONFIG.REFLECTIONS_FILE}\` — apply every matching lesson as a hard constraint.
2. Read \`${CONFIG.RULES_FILE}\` — follow the protocol exactly.
3. If a lesson matches the current file, tool, OS, or failure mode: state explicitly how it changes your approach.

AFTER any failure, correction, or non-obvious fix:
- Run \`code-graph reflect <CATEGORY> <LESSON>\` with a concise, reusable lesson.
- You MUST either record a new lesson or explicitly state that none was learned.
- Do NOT mark a task complete without completing this step.

If code-graph MCP server is configured, prefer these INSTEAD of the CLI and direct file reads:
- \`get_reflections\` — reads \`${CONFIG.REFLECTIONS_FILE}\` (use INSTEAD of Read on the file)
- \`add_reflection\` — records a lesson (use INSTEAD of \`code-graph reflect\` CLI)

The goal: no agent repeats a mistake already recorded in \`${CONFIG.REFLECTIONS_FILE}\`.
`;
}

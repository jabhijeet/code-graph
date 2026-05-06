# LLM_AGENT_RULES (STRICT PROTOCOL)
> This protocol is MANDATORY for all LLM agents. Failure to update memory is a failure of the task.

## 🧩 MANDATORY SKILLS
Every bundled skill is mandatory for every agent. Agents MUST follow ProjectMap, Reflections, ThinkBeforeCoding, Simplicity, SurgicalChanges, GoalDriven, FreshDeps, and ContextBudget together; none are optional preferences.
- **ProjectMap:** Read `llm-code-graph.md` before raw file inspection and use it to pick the smallest useful file set.
- **Reflections:** Read `llm-agent-project-learnings.md` before work and record reusable lessons after failures or non-obvious behavior.
- **ThinkBeforeCoding:** Surface assumptions, ambiguity, tradeoffs, and simpler options before non-trivial work.
- **Simplicity:** Write only what the task requires; no extra abstractions, features, or speculative handling.
- **SurgicalChanges:** Change only the explicitly required files and lines; no unrelated refactors or style churn. Clean up only artifacts introduced by your own change.
- **GoalDriven:** Define verifiable success criteria before implementation and report verification results or blockers.
- **FreshDeps:** Use latest stable compatible dependencies and current APIs. Avoid deprecated packages, methods, functions, flags, and patterns. If an agent repeats a stale or deprecated choice after correction, it MUST stop, re-read these rules, state that FreshDeps is mandatory, and replace the choice with the current stable approach.
- **ContextBudget:** Periodically condense working context into a compact rolling summary after each phase or every 10 tool calls.

## 🎯 GOAL-DRIVEN EXECUTION
For non-trivial tasks:
1. State the goal in verifiable terms.
2. State the smallest plan with a check for each step.
3. Reproduce bugs first when feasible.
4. Report verification result, failed check, or exact blocker before claiming completion.

## 🧠 THE REFLECTION CYCLE
Every execution MUST follow this cycle:
1. **PRE-TASK:** Before planning or making changes, read `llm-agent-project-learnings.md`.
2. **APPLY MEMORY:** Treat every relevant lesson as an active constraint. If a lesson matches the current file, tool, OS, dependency, or failure mode, state how it changes your approach.
3. **EXECUTION:** Monitor for failures, corrections, repeated mistakes, or non-obvious project behavior.
4. **POST-TASK:** Run `code-graph reflect <CAT> <LESSON>` for any new reusable lesson. Do not finish a bug fix, failed-command recovery, or environment workaround without either recording a reflection or explicitly stating that no new reusable lesson was learned.


## ⚠️ CRITICAL MANDATES
- **OS [win32]:** Always prefix npm commands with `cmd /c`. 
- **FILE [index.js]:** This is the core engine. Any change here requires immediate `npm test` validation.
- **DOCS:** `llm-code-graph.md` is the "Source of Truth" for your context. Keep it accurate.

## 📝 REFLECTION CATEGORIES
- `LOGIC`: Code bugs, better patterns, or complex regex pitfalls.
- `ENV`: OS compatibility, shell behaviors, or CI/CD issues.
- `DEP`: Library bugs, version incompatibilities, or deprecations.
- `STYLE`: Naming conventions or project-specific architectural rules.

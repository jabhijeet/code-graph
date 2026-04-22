# LLM_AGENT_RULES (STRICT PROTOCOL)
> This protocol is MANDATORY for all LLM agents. Failure to update memory is a failure of the task.
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

# AGENT OPERATIONAL PROTOCOL (STRICT)
> This protocol is MANDATORY for all LLM agents. Failure to update memory is a failure of the task.

## 🧠 THE REFLECTION CYCLE
Every execution MUST follow this cycle:
1. **PRE-TASK:** Read `PROJECT_REFLECTIONS.md` to identify existing pitfalls (OS, Deps, Logic).
2. **EXECUTION:** Monitor for any "Learned Moments":
   - **Task Failures:** Identify the root cause (e.g., "Win32 shell restrictions").
   - **Sub-optimal Logic:** Identify better abstractions (e.g., "Prefer fsp over fs").
   - **Environment Issues:** Identify missing dependencies or OS incompatibilities.
3. **POST-TASK:** Immediately run `code-graph reflect <CAT> <LESSON>` for any discovery. 
   - **DO NOT** wait for the user to ask. 
   - **DO NOT** commit until `llm-code-graph.md` is regenerated.

## ⚠️ CRITICAL MANDATES
- **OS [win32]:** Always prefix npm commands with `cmd /c`. 
- **FILE [index.js]:** This is the core engine. Any change here requires immediate `npm test` validation.
- **DOCS:** `llm-code-graph.md` is the "Source of Truth" for your context. Keep it accurate.

## 📝 REFLECTION CATEGORIES
- `LOGIC`: Code bugs, better patterns, or complex regex pitfalls.
- `ENV`: OS compatibility, shell behaviors, or CI/CD issues.
- `DEP`: Library bugs, version incompatibilities, or deprecations.
- `STYLE`: Naming conventions or project-specific architectural rules.

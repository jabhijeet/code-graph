# LLM_AGENT_RULES (STRICT PROTOCOL)
> This protocol is MANDATORY for all LLM agents. Failure to update memory is a failure of the task.
## 🧠 THE REFLECTION CYCLE
Every execution MUST follow this cycle:
1. **PRE-TASK:** Read `llm-agent-project-learnings.md` to identify existing pitfalls.
2. **EXECUTION:** Monitor for "Learned Moments" (failures, unexpected behaviors, or non-obvious fixes).
3. **POST-TASK:** If a significant lesson was learned, run \`code-graph reflect <CAT> <LESSON>\`. 
   - **NOTE:** Routine, expected changes do not require reflections. Focus on high-signal context.


## ⚠️ CRITICAL MANDATES
- **OS [win32]:** Always prefix npm commands with `cmd /c`. 
- **FILE [index.js]:** This is the core engine. Any change here requires immediate `npm test` validation.
- **DOCS:** `llm-code-graph.md` is the "Source of Truth" for your context. Keep it accurate.

## 📝 REFLECTION CATEGORIES
- `LOGIC`: Code bugs, better patterns, or complex regex pitfalls.
- `ENV`: OS compatibility, shell behaviors, or CI/CD issues.
- `DEP`: Library bugs, version incompatibilities, or deprecations.
- `STYLE`: Naming conventions or project-specific architectural rules.

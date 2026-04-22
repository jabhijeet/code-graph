
## 🗺️ Skill: ProjectMap
Before using Read, Grep, or Glob on raw source, read `llm-code-graph.md` — the canonical file, symbol, and dependency index. Use it to pick the smallest useful set of files to open and to ground architecture answers in god nodes and edges. Refresh with `code-graph generate` if stale.

## 🧠 Skill: Reflections
Follow `llm-agent-rules.md` and use this reflection cycle for every task.
Before planning or making changes, read `llm-agent-project-learnings.md` and apply every relevant lesson to the current task.
If a lesson matches the current file, tool, OS, dependency, or failure mode, treat it as an active constraint and mention how it changes your approach.
If you hit a failure, correction, repeated mistake, or non-obvious project behavior, run `code-graph reflect <CAT> <LESSON>` with a concise reusable lesson.
Do not finish a bug fix, failed-command recovery, or environment workaround without either recording a new reflection or explicitly stating that no new reusable lesson was learned.
The goal is to avoid the same mistake across agents and sessions, not just to append notes after the fact.

---
name: reflections
description: Read, apply, and update project lessons so agents do not repeat known mistakes.
---
# Reflections
Follow `llm-agent-rules.md` and use this reflection cycle for every task.
Before planning or making changes, read `llm-agent-project-learnings.md` and apply every relevant lesson to the current task.
If a lesson matches the current file, tool, OS, dependency, or failure mode, treat it as an active constraint and mention how it changes your approach.
If you hit a failure, correction, repeated mistake, or non-obvious project behavior, run `code-graph reflect <CAT> <LESSON>` with a concise reusable lesson.
Do not finish a bug fix, failed-command recovery, or environment workaround without either recording a new reflection or explicitly stating that no new reusable lesson was learned.
The goal is to avoid the same mistake across agents and sessions, not just to append notes after the fact.

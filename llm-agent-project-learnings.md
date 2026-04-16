# LLM_AGENT_PROJECT_LEARNINGS
> LLM AGENT MEMORY: READ BEFORE STARTING TASKS. UPDATE ON FAILURES.

## ⚠️ CRITICAL PITFALLS
- [OS: win32] PowerShell script execution is disabled by default; use `cmd /c npm` for all npm commands to ensure compatibility.
- [LOGIC: index.js] `extractSymbolsAndInheritance` regex matches itself if TODO/FIXME strings are present in the code; ensure filters are in place.

## 📦 DEPENDENCIES & ENVIRONMENT
- [DEP: chokidar] Watcher should be debounced by at least 500ms to avoid race conditions during rapid file saves.

## ✅ BEST PRACTICES
- [STYLE] Always include dependency counts (↑N ↓M) in `llm-code-graph.md` to help prioritize architectural understanding.

- [TOOLING: 2026-04-15] Added reflect command to simplify LLM memory updates.
- [TOOLING: 2026-04-16] Upgraded to v3.0.0: Unified agent renaming (llm-agent-*) and added `install-skills` for automated platform integration (Claude, Cursor, Gemini, etc.).
- [TOOLING: 2026-04-16] Upgraded to v3.1.0: Segregated skills into `projectmap` and `reflections`, enabling selective installation and standardizing on `install-skills` command.
- [TOOLING: 2026-04-16] Upgraded to v3.2.0: "Universal Agent OS" release. Restored full surgical integration for Antigravity, Kiro, Codex, and OpenCode. Implemented segregated skill hooks for platforms that support them.
- [TOOLING: 2026-04-16] Upgraded to v3.2.1: Exhaustive documentation of platform-specific installation details and integration table synchronization.
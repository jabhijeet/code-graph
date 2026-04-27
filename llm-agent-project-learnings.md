# LLM_AGENT_PROJECT_LEARNINGS
> LLM AGENT MEMORY: READ BEFORE STARTING TASKS. UPDATE ON FAILURES.

## ⚠️ CRITICAL PITFALLS
- [OS: win32] PowerShell script execution is disabled by default; use `cmd /c npm` for all npm commands to ensure compatibility.
- [LOGIC: index.js] `extractSymbolsAndInheritance` regex matches itself if TODO/FIXME strings are present in the code; ensure filters are in place.

## 📦 DEPENDENCIES & ENVIRONMENT
- [DEP: chokidar] Watcher should be debounced by at least 500ms to avoid race conditions during rapid file saves.

## ✅ BEST PRACTICES
- [STYLE] Always include dependency counts (↑N ↓M) in `llm-code-graph.md` to help prioritize architectural understanding.
- [LOGIC-INJECTEDFAKE] line1 line2 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
- [LOGIC] line1 line2 test-lesson-unique-xyz
- [SKILL] Installed Codex skills require YAML frontmatter delimited by ---; a plain Markdown SKILL.md will be skipped as invalid.
- [VERSION] When bumping package metadata, also update CONFIG.VERSION because CLI banners and MCP serverInfo use the runtime constant rather than package.json.
- [ENV] Windows sandbox setup can fail before PowerShell runs; retry required reads with approved escalation instead of assuming command failure.
- [LOGIC] Shared reflection prompt text must mention llm-agent-rules.md because platform audit expects Cursor reflections rules to retain the rules-file link.
- [LOGIC] When changing generated skill prompt bodies, add the previous generated section text to upgrade cleanup or reinstall may duplicate prompt blocks.
- [BUG] installMCPServer in AgentManager wrote .mcp.json to project root on install-agent, causing Claude Code to prompt MCP installation in every project. Fix: removed all MCP registration methods; agent install now only creates the platform subagent file.
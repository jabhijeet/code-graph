# CODE_GRAPH_MAP
> MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
> PROTOCOL: Follow llm-agent-rules.md | MEMORY: See llm-agent-project-learnings.md
> Legend: [CORE] Entry Point, (↑N) Outgoing Deps, (↓M) Incoming Dependents
> Notation: syms: [Name [Signature/Context]], desc: File Summary, [TAG: Context]

- [CORE] index.js (↑8 ↓1) [TODO: |FIXME|BUG|DEPRECATED):?\s*(.*)/i,, bug: s or complex regex pitfalls., bug: s or version deprecations., bug: ,"] | desc: !usrbinenv node
  - syms: [CONFIG [=], CodeParser [--- Core Services --- Handles extraction of symbols, edges, and metadata from source code.], ProjectInitializer [Scaffolds the initial agent-agnostic rule and reflection files.], ProjectMapper [Manages the project mapping and file generation.], ReflectionManager [Manages project reflections and lessons learned.], SUPPORTED_EXTENSIONS [: [], SkillManager [Manages platform-specific skills and agent integrations.], add [(context ? `${display} [${context}]` : display)], appendToFile [('CLAUDE.md', section)], execute [(platform, action)], extract [(content)], init [(cwd)], install [|uninstall]')], installAntigravity [()], installClaude [()], installCodex [()], installCopilot [()], installCursor [()], installGemini [()], installGenericAgent [(p)], installGitHook [(cwd)], installKiro [()], installOpenCode [()], installVSCode [()], main [|app|server|cli)\./i.test(path.basename(relPath))], processFile [(fullPath, relPath)], removeFile [('CLAUDE.md')], uninstall []')], walk [(dir, ig)], writeFile [(path.join(this.cwd, CONFIG.MAP_FILE)], writeJson [('.claude/settings.json', { hooks: { preToolUse: [{ tools: ['glob', 'grep'], message: `code-graph: Knowledge graph exists. Read ${CONFIG.MAP_FILE} before searching raw files.` }] } })]]
- [CORE] test/index.test.js (↑10 ↓0) | desc: 
  - syms: []

## GRAPH EDGES
[index.js] -> [imports] -> [bash]
[index.js] -> [imports] -> [chokidar]
[index.js] -> [imports] -> [fs]
[index.js] -> [imports] -> [ignore]
[index.js] -> [imports] -> [os]
[index.js] -> [imports] -> [path]
[index.js] -> [imports] -> [symbols]
[index.js] -> [imports] -> [url]
[test/index.test.js] -> [imports] -> [assert]
[test/index.test.js] -> [imports] -> [fs]
[test/index.test.js] -> [imports] -> [header.h]
[test/index.test.js] -> [imports] -> [index.js]
[test/index.test.js] -> [imports] -> [node]
[test/index.test.js] -> [imports] -> [other-module]
[test/index.test.js] -> [imports] -> [path]
[test/index.test.js] -> [imports] -> [test/local-file]
[test/index.test.js] -> [imports] -> [test]
[test/index.test.js] -> [imports] -> [url]
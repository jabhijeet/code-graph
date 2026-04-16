# CODE_GRAPH_MAP
> MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
> PROTOCOL: Follow llm-agent-rules.md | MEMORY: See llm-agent-project-learnings.md
> Legend: [CORE] Entry Point, (↑N) Outgoing Deps, (↓M) Incoming Dependents
> Notation: syms: [Name [Signature/Context]], desc: File Summary, [TAG: Context]

- [CORE] index.js (↑7 ↓1) [TODO: |FIXME|BUG|DEPRECATED):?\s*(.*)/i,, bug: s or complex regex pitfalls., bug: s or version deprecations., bug: fix or failure.\n`;, bug: ,"] | desc: !usrbinenv node
  - syms: [CONFIG [=], CodeParser [--- Core Services --- Handles extraction of symbols, edges, and metadata from source code.], ProjectInitializer [Scaffolds the initial agent-agnostic rule and reflection files.], ProjectMapper [Manages the project mapping and file generation.], ReflectionManager [Manages project reflections and lessons learned.], SUPPORTED_EXTENSIONS [: [], SkillManager [Manages platform-specific skills and agent integrations.], add [(context ? `${display} [${context}]` : display)], appendToFile [('CLAUDE.md', section)], execute [(platform, action, skill)], extract [(content)], init [(cwd)], install [-skills <platform> [projectmap|reflections]')], installGitHook [(cwd)], installGlobalSkill [('gemini', 'projectmap', skillContent)], installProjectMap [(p)], installReflections [(p)], main [|app|server|cli)\./i.test(path.basename(relPath))], processFile [(fullPath, relPath)], removeFile [('.cursor/rules/projectmap.mdc')], uninstall [-skills') await this.uninstall(p, s)], walk [(dir, ig)], writeFile [(path.join(this.cwd, CONFIG.MAP_FILE)], writeJson [('.claude/settings.json', { hooks: { preToolUse: [{ tools: ['glob', 'grep'], message: `Skill(ProjectMap)]]
- [CORE] test/index.test.js (↑10 ↓0) | desc: 
  - syms: []

## GRAPH EDGES
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
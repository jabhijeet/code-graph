# CODE_GRAPH
MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
PROTOCOL: Follow llm-agent-rules.md
MEMORY: See llm-agent-project-learnings.md

> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *index.js (11↑ 1↓) | d: !usrbinenv node
  - s: [installGitHook [(cwd)], main [()], printHelp [--- CLI ---]]
- *test/index.test.js (10↑ 0↓) | d: Contains 1 symbols.
  - s: [doSomething [()]]
- lib/config.js (0↑ 6↓) | d: Contains 4 symbols.
  - s: [CONFIG [@file libconfig.js @description Constants, configuration, and shared utilities.], REGEX [=], SUPPORTED_EXTENSIONS [: [], escapeRegex [(str)]]
- lib/parser.js (4↑ 2↓) | d: Contains 6 symbols.
  - s: [CodeParser, extract [(content)], extractEdges [(noComments)], extractSymbols [(content, cleanContent)], extractTags [(noCodeLiterals)], findSymbolContext [(original, name)]]
- lib/agents.js (4↑ 1↓) | d: Contains 10 symbols.
  - s: [AgentManager, execute [(platform, action)], install [-agent <platform>')], installAntigravityAgent [()], installGeminiAgent [()], installGenericPersona [()], installKiroAgent [()], installMCPServer [()], removeFile [('mcp-server-code-graph.json')], uninstall [-agent') await this.uninstall(p)]]
- lib/initializer.js (3↑ 1↓) | d: Contains 2 symbols.
  - s: [ProjectInitializer, init [(cwd)]]
- lib/mapper.js (6↑ 1↓) | d: Contains 7 symbols.
  - s: [ProjectMapper, generate [()], getIgnores [(dir, baseIg)], processEdges [(relPath, edges, inheritance)], processFile [(fullPath, relPath)], resolveExtension [(resolved)], walk [(dir, ig)]]
- lib/reflections.js (3↑ 1↓) | d: Contains 2 symbols.
  - s: [ReflectionManager, add [(category, lesson)]]
- lib/skills.js (4↑ 1↓) | d: Contains 11 symbols.
  - s: [SkillManager, appendToFile [('CLAUDE.md', section)], execute [(platform, action, skill)], install [-skills <platform> [projectmap|reflections]')], installGlobalSkill [('gemini', 'projectmap', geminiSkill)], installProjectMap [(p)], installReflections [(p)], removeFile [('.cursor/rules/projectmap.mdc')], uninstall [-skills') await this.uninstall(p, s)], writeFile [('.cursor/rules/projectmap.mdc', `---\ndescription: Use knowledge graph for navigation.\nalwaysApply: true\n---\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` to locate core logic and dependencies.\n`)], writeJson [('.claude/settings.json', { hooks: { preToolUse: [{ tools: ['glob', 'grep'], message: `Skill(ProjectMap)]]

## EDGES
[index.js] -> [lib/agents.js, lib/config.js, lib/initializer.js, lib/mapper.js, lib/parser.js, lib/reflections.js, lib/skills.js, chokidar, fs, path, url]
[lib/agents.js] -> [fs, os, path, url]
[lib/initializer.js] -> [lib/config.js, fs, path]
[lib/mapper.js] -> [lib/config.js, lib/parser.js, fs, ignore, path, targets]
[lib/parser.js] -> [lib/config.js, deps, symbols, tags]
[lib/reflections.js] -> [lib/config.js, fs, path]
[lib/skills.js] -> [lib/config.js, fs, os, path]
[test/index.test.js] -> [index.js, test/local-file, assert, fs, header.h, node, other-module, path, test, url]
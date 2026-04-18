# CODE_GRAPH
MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
PROTOCOL: Follow llm-agent-rules.md
MEMORY: See llm-agent-project-learnings.md

> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *index.js (12↑ 0↓) | d: @file index.js @description CLI entry point for code-graph-llm. Compact, languag
  - s: [installGitHook [(cwd)], main [()], printHelp [--- CLI ---]]
- *test/index.test.js (11↑ 0↓) | d: Contains 1 symbols.
  - s: [doSomething [()]]
- lib/config.js (0↑ 9↓) | d: @file lib/config.js @description Constants, configuration, and shared utilities.
  - s: [CONFIG [@file lib/config.js @description Constants, configuration, and shared utilities. /], REGEX [=], SUPPORTED_EXTENSIONS [= CONFIG.SUPPORTED_EXTENSIONS], SUPPORTED_PLATFORMS [= Object.freeze([], escapeRegex [(str)], isValidPlatform [(p)], stripDangerousKeys [(value)]]
- lib/agents.js (5↑ 2↓) | d: @file lib/agents.js @description Manages sub-agent registrations and orchestrato
  - s: [AgentManager, execute [(platform, action)], install [(p)], installGeminiAgent [()], installMCPServer [(relPath)], removeFile [(filename)], uninstall [(p)]]
- lib/initializer.js (3↑ 2↓) | d: @file lib/initializer.js @description Scaffolds the initial agent-agnostic rule 
  - s: [ProjectInitializer, init [(cwd)]]
- lib/mapper.js (5↑ 2↓) | d: @file lib/mapper.js @description Manages the project mapping and file generation
  - s: [ProjectMapper, generate [()], getIgnores [(dir, baseIg)], processEdges [(relPath, edges, inheritance)], processFile [(fullPath, relPath)], resolveExtension [(target)], walk [(dir, ig, depth = 0)]]
- lib/parser.js (1↑ 2↓) | d: @file lib/parser.js @description Handles extraction of symbols, edges, and metad
  - s: [CodeParser, extract [(content)], extractEdges [(clean)], extractSymbols [(original, clean)], extractTags [(content)], findSymbolContext [(content, name)]]
- lib/skills.js (4↑ 2↓) | d: @file lib/skills.js @description Manages platform-specific skills and agent inte
  - s: [SkillManager, appendToFile [(filename, content)], execute [(platform, action, skill)], install [(p, s)], installGlobalSkill [(platform, skillName, content)], installProjectMap [(p)], installReflections [(p)], removeFile [(filename)], removeFileIfEmpty [(filename)], removeFromFile [(filename, content)], removeJsonArrayValue [(filename, key, value)], removeJsonHookEntry [(filename, shouldRemove)], uninstall [(p, s)], writeFile [(filename, content)], writeJson [(filename, data)]]
- lib/mcp.js (3↑ 1↓) | d: @file lib/mcp.js @description Minimal stdio MCP server for code-graph. /
  - s: [callTool [(message, defaultCwd)], handleMessage [(message, defaultCwd)], readMessage [(buffer)], send [(message)], startMCPServer [(defaultCwd = process.cwd()]]
- lib/reflections.js (3↑ 1↓) | d: @file lib/reflections.js @description Manages project reflections and lessons le
  - s: [ReflectionManager, add [(category, lesson)]]
- test/platform-audit.js (6↑ 0↓) | d: Platform integration audit script. Tests install-skills + install-agent for ever
  - s: [check [(label, condition, detail)], fileExists [(p)], readFile [(p)]]

## EDGES
[index.js] -> [lib/agents.js, lib/config.js, lib/initializer.js, lib/mapper.js, lib/mcp.js, lib/parser.js, lib/reflections.js, lib/skills.js, chokidar, fs, path, url]
[lib/agents.js] -> [lib/config.js, fs, os, path, url]
[lib/initializer.js] -> [lib/config.js, fs, path]
[lib/mapper.js] -> [lib/config.js, lib/parser.js, fs, ignore, path]
[lib/mcp.js] -> [lib/config.js, lib/initializer.js, lib/mapper.js]
[lib/parser.js] -> [lib/config.js]
[lib/reflections.js] -> [lib/config.js, fs, path]
[lib/skills.js] -> [lib/config.js, fs, os, path]
[test/index.test.js] -> [test/foo, test/local-file, test/side-effect, header.h, node:assert, node:fs, node:path, node:test, other-module, react, url]
[test/platform-audit.js] -> [lib/agents.js, lib/config.js, lib/skills.js, fs, os, path]
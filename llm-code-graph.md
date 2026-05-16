# CODE_GRAPH
MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
PROTOCOL: Follow llm-agent-rules.md
MEMORY: See llm-agent-project-learnings.md

> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *index.js (11↑ 0↓) | d: @file index.js @description CLI entry point for code-graph-llm. Compact, languag
  - s: [installGitHook [(cwd)], main [()], printHelp [--- CLI ---]]
- *test/index.test.js (11↑ 0↓) | d: Contains 1 symbols.
  - s: [doSomething [()]]
- lib/config.js (0↑ 12↓) | d: @file lib/config.js @description Constants, configuration, and shared utilities.
  - s: [CONFIG [@file lib/config.js @description Constants, configuration, and shared utilities. /], PLATFORM_GLOBAL_PATHS [Maps platform names with non-standard global skills dirs to their path segments (relative to home). Platforms not listed here use the default: ~/.{platform}/skills/], REGEX [=], SUPPORTED_EXTENSIONS [= CONFIG.SUPPORTED_EXTENSIONS], SUPPORTED_PLATFORMS [= Object.freeze([], escapeRegex [(str)], isValidPlatform [(p)], stripDangerousKeys [(value)]]
- lib/install-log.js (1↑ 3↓) | d: @file lib/install-log.js @description Shared install logging helpers. /
  - s: [logInstallTarget [(fullPath)]]
- lib/reflections.js (3↑ 3↓) | d: @file lib/reflections.js @description Manages project reflections and lessons le
  - s: [ReflectionManager]
- lib/agents.js (6↑ 2↓) | d: @file lib/agents.js @description Manages sub-agent registrations and orchestrato
  - s: [AgentManager, execute [(platform, action)], install [(p)], installAntigravityAgent [()], installClaudeSubagent [()], installGeminiAgent [()], installGenericPersona [()], installKiroAgent [()], removeFile [(filename)], uninstall [(p)], writeClaudeAgent [(name, description, body)]]
- lib/mapper.js (5↑ 2↓) | d: @file lib/mapper.js @description Manages the project mapping and file generation
  - s: [ProjectMapper, generate [()], getIgnores [(dir, baseIg)], processEdges [(relPath, edges, inheritance)], processFile [(fullPath, relPath)], processFileWithTimeout [(fullPath, relPath)], resolveExtension [(target)], walk [(dir, ig, depth = 0)]]
- lib/parser.js (1↑ 2↓) | d: @file lib/parser.js @description Handles extraction of symbols, edges, and metad
  - s: [CodeParser, extract [(content)], extractEdges [(clean)], extractSymbols [(original, clean)], extractTags [(content)], findSymbolContext [(content, name)]]
- lib/initializer.js (3↑ 1↓) | d: @file lib/initializer.js @description Scaffolds the initial agent-agnostic rule 
  - s: [ProjectInitializer, init [(cwd)]]
- lib/skills/core.js (6↑ 1↓) | d: @file lib/skills/core.js @description Core SkillManager implementation with spli
  - s: [SkillManager, appendToFile [File helper methods], execute [(platform, action, skill, isGlobal = false)], install [(p, s, isGlobal = false)], installSkill [(p, spec, isGlobal = false)], removeFile [(filename)], removeFileIfEmpty [(filename)], removeFromFile [(filename, content)], removeJsonArrayValue [(filename, key, value)], removeJsonHookEntry [(filename, shouldRemove)], removeLegacySkills [(p)], removeOldChangeLimitPrompts [()], removeOldReflectionsPrompts [()], removeSkillArtifacts [(p, name, section, spec = {})], uninstall [(p, s, isGlobal = false)], writeFile [(filename, content)], writeJson [(filename, data)]]
- lib/skills/platforms.js (5↑ 1↓) | d: @file lib/skills/platforms.js @description Platform-specific skill installation 
  - s: [function [Get the global skills directory for a platform. /], globalSkillsDir [Get the global skills directory for a platform. /], installGlobalSkill [Install a skill at the global (user-level) scope for a given platform. /], installProjectSkill [Project-level install dispatcher. Routes to the correct platform handler. /]]
- lib/mcp-server.js (8↑ 0↓) | d: @file lib/mcp-server.js @description MCP stdio server exposing code-graph tools 
  - s: [function [handleGenerateGraph(], handleAddReflection [({ category, lesson, project_path })], handleGenerateGraph [({ project_path })], handleGetFileSymbols [({ file_path, project_path })], handleGetReflections [({ project_path, category })], handleSearchGraph [({ query, project_path })], startMcpServer [── Server entry point ────────────────────────────────────────────────────────], validateProjectPath [── Tool handlers ─────────────────────────────────────────────────────────────]]
- lib/skills/specs.js (1↑ 0↓) [bug: s, reproduce first. Report verification result or,Deprecated: packages, methods, or patterns = task failure. If,deprecated: packages, methods, functions, configuration keys,,deprecated: choice is unavoidable, state the reason and the mi,deprecated: or stale choice after being corrected, STOP. Re-re,deprecated: APIs are mandatory. Stale dependency choices = tas] | d: @file lib/skills/specs.js @description Skill specification factories for code-gr
  - s: [changeLimitBody [()], changeLimitSpec [()], contextBudgetSpec [()], freshDepsBody [()], freshDepsSpec [()], goalDrivenBody [()], goalDrivenSpec [()], projectMapBody [Body content generators], projectMapSpec [()], reflectionsProtocolBody [()], reflectionsSection [()], reflectionsSpec [()], roocodeReflectionsSection [()], simplicityBody [()], simplicitySpec [()], thinkBeforeCodingBody [()], thinkBeforeCodingSpec [()]]
- test/mcp-server.test.js (6↑ 0↓) | d: 
  - s: []
- test/platform-audit.js (6↑ 0↓) | d: Platform integration audit script. Tests install-skills + install-agent for ever
  - s: [check [(label, condition, detail)], fileExists [(p)], readFile [(p)]]

## EDGES
[index.js] -> [lib/agents.js, lib/config.js, lib/initializer.js, lib/mapper.js, lib/parser.js, lib/reflections.js, lib/skills/core.js, chokidar, fs, path, url]
[lib/agents.js] -> [lib/config.js, lib/install-log.js, fs, llm-code-graph.md, os, path]
[lib/initializer.js] -> [lib/config.js, fs, path]
[lib/install-log.js] -> [lib/config.js]
[lib/mapper.js] -> [lib/config.js, lib/parser.js, fs, ignore, path]
[lib/mcp-server.js] -> [lib/config.js, lib/mapper.js, lib/reflections.js, @modelcontextprotocol/sdk/server/index.js, @modelcontextprotocol/sdk/server/stdio.js, @modelcontextprotocol/sdk/types.js, fs, path]
[lib/parser.js] -> [lib/config.js]
[lib/reflections.js] -> [lib/config.js, fs, path]
[lib/skills/core.js] -> [lib/config.js, lib/install-log.js, lib/skills/platforms.js, fs, os, path]
[lib/skills/platforms.js] -> [lib/config.js, lib/install-log.js, fs, os, path]
[lib/skills/specs.js] -> [lib/config.js]
[test/index.test.js] -> [test/foo, test/local-file, test/side-effect, header.h, node:assert, node:fs, node:path, node:test, other-module, react, url]
[test/mcp-server.test.js] -> [lib/reflections.js, node:assert/strict, node:fs/promises, node:os, node:path, node:test]
[test/platform-audit.js] -> [lib/agents.js, lib/config.js, lib/skills.js, fs, os, path]
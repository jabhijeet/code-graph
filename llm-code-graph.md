# CODE_GRAPH
MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
PROTOCOL: Follow llm-agent-rules.md
MEMORY: See llm-agent-project-learnings.md
TOKENS: ~2949 (est.)

> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *index.js (14↑ 1↓) | d: @file index.js @description CLI entry point for code-graph-llm. Compact, languag
  - s: [installGitHook [(cwd)], isIgnored [= (p, stats) =>], main [()], printHelp [--- CLI ---], regenerate [= async () =>], startWatcher [(cwd, mapperOptions = {})], stopWatcher [()]]
- lib/config.js (0↑ 14↓) | d: @file lib/config.js @description Constants, configuration, and shared utilities.
  - s: [CONFIG [@file lib/config.js @description Constants, configuration, and shared utilities. /], PLATFORM_GLOBAL_PATHS [Maps platform names with non-standard global skills dirs to their path segments (relative to home). Platforms not listed here use the default: ~/.{platform}/skills/], REGEX [=], SUPPORTED_EXTENSIONS [= CONFIG.SUPPORTED_EXTENSIONS], SUPPORTED_PLATFORMS [= Object.freeze([], escapeRegex [(str)], isValidPlatform [(p)], stripDangerousKeys [(value)]]
- lib/parser.js (1↑ 4↓) | d: @file lib/parser.js @description Handles extraction of symbols, edges, and metad
  - s: [CodeParser, describeAt [Describe the symbol whose name starts at `pos`: the comment block above it, else its signature.], extract [(content)], extractEdges [(clean)], extractSymbols [(original, clean)], extractTags [(content)], findSymbolContext [(content, name)], splitSymbol [Split a formatted symbol `name [context]` into its parts.], strip [(content, { strings, comments })], stripJsonComments [Remove // and /* *\/ comments from JSONC (tsconfig.json) without touching string contents.]]
- lib/install-log.js (1↑ 3↓) | d: @file lib/install-log.js @description Shared install logging helpers. /
  - s: [logInstallTarget [(fullPath)]]
- lib/mapper.js (6↑ 3↓) | d: @file lib/mapper.js @description Manages the project mapping and file generation
  - s: [ProjectMapper, _elapsed [()], build [Scan the project and return the rendered outputs without writing them.], check [Compare freshly built outputs against the files on disk. @returns {Promise<{ upToDate: boolean, stale: string[] }>} /], compactList [(items, limit)], constructor [maxTokens: trim lowest-ranked files from the markdown map to fit this estimated budget. useCache: reuse parse results for files whose mtime and size are unchanged. /], extractFileDesc [(content, symCount)], formatJson [Machine-readable graph for MCP tools and other consumers; uncapped, unlike the markdown map.], formatOutput [(t = ()], generate [()], getIgnores [(dir, baseIg)], groupEdges [()], importLine [= (src) => `[$], isFile [(relPath)], loadCache [()], loadPathAliases [Read `compilerOptions.paths` from tsconfig.json / jsconfig.json at the project root.], parseContent [Pure parse step; its result is what the incremental cache stores. Uses tree-sitter when a grammar exists for the extension, otherwise the regex parser. /], processEdges [(relPath, edges, inheritance)], processFile [(fullPath, relPath)], processFileWithTimeout [(fullPath, relPath)], resolveCandidate [(base)], resolveImport [Map an import specifier to a project-relative file path; external packages are returned unchanged.], saveCache [()], t [= () => `+$], ... +1 more]
- lib/reflections.js (3↑ 3↓) | d: @file lib/reflections.js @description Manages project reflections and lessons le
  - s: [ReflectionManager, add [@returns {Promise<{ status: 'added' | 'duplicate' | 'invalid' | 'error', entry?: string, message?: string }>} /]]
- lib/treesitter.js (6↑ 3↓) | d: @file lib/treesitter.js @description Syntax-tree extraction of symbols, edges, i
  - s: [GRAMMAR_BY_EXTENSION [File extension -> grammar bundled with @vscode/tree-sitter-wasm.], TreeSitterParser [── Engine ────────────────────────────────────────────────────────────────────], _loadLanguage [(grammar)], _loadRuntime [()], byName [heritage: node type -> function returning parent type names prefix:   optional decoration shown before the name (e.g. Java annotations)], childOfType [= (node, ...types) => named(node).find(c => types.includes(c.type)) ?? null], collect [(root, content, rules)], declaratorName [Descend C/C++ declarators (`int *f(int)`, `A::m`) to the declared name node.], extract [@returns {Promise<{symbols: string[], inheritance: {child: string, parent: string}[], edges: string[], tags: string[]} | null>} null when no grammar is available, so the caller can fall back to regex. /], field [── Node helpers ──────────────────────────────────────────────────────────────], functionPrototype [= (node) =>], heritageFrom [= (...types) => (node) => named(node)], javaAnnotation [(node)], named [The runtime types child arrays as (Node | null)[].], phpInclude [= (node) => [stringValue(childOfType(node, 'string', 'encapsed_string'))]], pythonRelative [`from ..pkg.mod import x` -> `../pkg/mod`; `from . import x` -> `./x`.], stringValue [Text of a string literal node without its quotes.], supports [True when a bundled grammar exists for this extension (it may still fail to load).], typeNames [(node)], withBody [= (node) => (field(node, 'body') ? field(node, 'name') : null)]]
- lib/agents.js (5↑ 2↓) | d: @file lib/agents.js @description Manages sub-agent registrations and orchestrato
  - s: [AgentManager, constructor [(cwd)], execute [(platform, action)], install [(p)], installAntigravityAgent [()], installClaudeSubagent [()], installGeminiAgent [()], installGenericPersona [()], installKiroAgent [()], removeFile [(filename)], uninstall [(p)], writeClaudeAgent [(name, description, body)]]
- lib/mcp-server.js (9↑ 2↓) | d: @file lib/mcp-server.js @description MCP stdio server exposing code-graph tools 
  - s: [graphNotFound [(project_path)], handleAddReflection [({ category, lesson, project_path })], handleGenerateGraph [({ project_path })], handleGetDependents [({ file_path, project_path, depth })], handleGetFileSymbols [({ file_path, project_path })], handleGetProjectGraph [({ project_path })], handleGetReflections [({ project_path, category })], handleSearchGraph [({ query, project_path })], handleSearchSymbols [({ query, project_path, type })], handleTraceDependencies [({ file_path, project_path })], loadGraph [Load the project graph, preferring the JSON sidecar. Throws ENOENT when neither file exists.], mcpError [(error_type, message, { retryable = false, suggested_action = null } = {})], normalizeFile [= (file_path) => String(file_path ?? '').replace(/\\/g, '/')], parseMarkdownGraph [Parse a markdown map (written by versions without the JSON sidecar) into the JSON graph shape.], splitTopLevel [── Graph loading ───────────────────────────────────────────────────────────── Split on commas that are not nested inside [] or ().], startMcpServer [── Server entry point ────────────────────────────────────────────────────────], validateProjectPath [── Tool handlers ─────────────────────────────────────────────────────────────], withGraph [Shared wrapper: validate the path, load the graph, map missing-graph and unexpected errors.], withTimeout [(fn, ms)]]
- lib/skills/core.js (7↑ 2↓) | d: @file lib/skills/core.js @description Core SkillManager implementation with spli
  - s: [SkillManager, appendToFile [File helper methods], constructor [(cwd)], execute [(platform, action, skill, isGlobal = false)], install [(p, s, isGlobal = false)], installSkill [(p, spec, isGlobal = false)], legacySection [(legacy)], mergeArrayValues [(existing, incoming)], mergeHooks [(existing, incoming)], projectMapSection [Section generators (needed for uninstall)], reflectionsProtocolBody [()], removeFile [(filename)], removeFileIfEmpty [(filename)], removeFromFile [(filename, content)], removeJsonArrayValue [(filename, key, value)], removeJsonHookEntry [(filename, shouldRemove)], removeLegacySkills [(p)], removeOldChangeLimitPrompts [()], removeOldReflectionsPrompts [()], removeSkillArtifacts [(p, name, section, spec = {})], roocodeReflectionsSection [()], uninstall [(p, s, isGlobal = false)], writeFile [(filename, content)], writeJson [(filename, data)]]
- lib/initializer.js (3↑ 1↓) | d: @file lib/initializer.js @description Scaffolds the initial agent-agnostic rule 
  - s: [ProjectInitializer, init [(cwd)]]
- lib/skills/platforms.js (5↑ 1↓) | d: @file lib/skills/platforms.js @description Platform-specific skill installation 
  - s: [globalSkillsDir [Get the global skills directory for a platform. /], installGlobalSkill [Install a skill at the global (user-level) scope for a given platform. /], installProjectSkill [Project-level install dispatcher. Routes to the correct platform handler. /]]
- lib/skills/specs.js (1↑ 1↓) | d: @file lib/skills/specs.js @description Skill specification factories for code-gr
  - s: [changeLimitBody [()], changeLimitSpec [()], contextBudgetBody [()], contextBudgetSpec [()], freshDepsBody [()], freshDepsSpec [()], goalDrivenBody [()], goalDrivenSpec [()], projectMapBody [Body content generators], projectMapSection [Section generators], projectMapSpec [()], reflectionsProtocolBody [()], reflectionsSection [()], reflectionsSpec [()], roocodeReflectionsSection [()], simplicityBody [()], simplicitySpec [()], thinkBeforeCodingBody [()], thinkBeforeCodingSpec [()]]
- test/index.test.js (8↑ 0↓) | d: Contains 4 symbols.
  - s: [makeTempProject [--- Mapper features: JSON sidecar, cache, check, budget, resolution ---], quiet [(fn)], readAllFiles [= (dir) =>], withTempCwd [Reflection tests run inside a temp cwd: test files execute in parallel processes, and backing up / restoring the repo's real learnings file races and leaks test entries into it.]]
- test/mcp-server.test.js (8↑ 0↓) | d: Contains 2 symbols.
  - s: [assertMcpError [Helper: assert result is a structured MCP error with the given error_type], send [= (msg) => child.stdin.write(JSON.stringify(msg) + '\n')]]
- test/platform-audit.js (6↑ 0↓) | d: Platform integration audit script. Tests install-skills + install-agent for ever
  - s: [check [(label, condition, detail)], fileExists [(p)], readFile [(p)]]
- test/treesitter.test.js (8↑ 0↓) | d: Contains 1 symbols.
  - s: [names [= (result) => result.symbols.map(s => s.split(' [')[0])]]

## EDGES
[index.js] -> [lib/agents.js, lib/config.js, lib/initializer.js, lib/mapper.js, lib/mcp-server.js, lib/parser.js, lib/reflections.js, lib/skills/core.js, lib/treesitter.js, chokidar, fs, ignore, path, url]
[lib/agents.js] -> [lib/config.js, lib/install-log.js, fs, os, path]
[lib/initializer.js] -> [lib/config.js, fs, path]
[lib/install-log.js] -> [lib/config.js]
[lib/mapper.js] -> [lib/config.js, lib/parser.js, lib/treesitter.js, fs, ignore, path]
[lib/mcp-server.js] -> [lib/config.js, lib/mapper.js, lib/parser.js, lib/reflections.js, @modelcontextprotocol/sdk/server/index.js, @modelcontextprotocol/sdk/server/stdio.js, @modelcontextprotocol/sdk/types.js, fs, path]
[lib/parser.js] -> [lib/config.js]
[lib/reflections.js] -> [lib/config.js, fs, path]
[lib/skills/core.js] -> [lib/config.js, lib/install-log.js, lib/skills/platforms.js, lib/skills/specs.js, fs, os, path]
[lib/skills/platforms.js] -> [lib/config.js, lib/install-log.js, fs, os, path]
[lib/skills/specs.js] -> [lib/config.js]
[lib/treesitter.js] -> [lib/config.js, lib/parser.js, @vscode/tree-sitter-wasm, fs, module, path]
[test/index.test.js] -> [index.js, node:assert, node:child_process, node:fs, node:os, node:path, node:test, url]
[test/mcp-server.test.js] -> [lib/mcp-server.js, lib/reflections.js, node:assert/strict, node:child_process, node:fs/promises, node:os, node:path, node:test]
[test/platform-audit.js] -> [lib/agents.js, lib/config.js, lib/skills/core.js, fs, os, path]
[test/treesitter.test.js] -> [lib/config.js, lib/mapper.js, lib/treesitter.js, node:assert/strict, node:fs, node:os, node:path, node:test]
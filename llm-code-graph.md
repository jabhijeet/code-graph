# CODE_GRAPH_MAP
> MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
> PROTOCOL: Follow AGENT_RULES.md | MEMORY: See PROJECT_REFLECTIONS.md
> Legend: [CORE] Entry Point, (↑N) Outgoing Deps, (↓M) Incoming Dependents
> Notation: syms: [Name [Signature/Context]], desc: File Summary, [TAG: Context]

- [CORE] index.js (↑6 ↓1) [TODO: |FIXME|BUG|DEPRECATED):?\s*(.*)/i,, bug: ."\nfi`;] | desc: !usrbinenv node
  - syms: [CONFIG [=], CodeParser [--- Core Services --- Handles extraction of symbols, edges, and metadata from source code.], ProjectMapper [Manages the project mapping and file generation.], ReflectionManager [Manages project reflections and lessons learned.], SUPPORTED_EXTENSIONS [: [], add [(context ? `${display} [${context}]` : display)], extract [(content)], installGitHook [(cwd)], main [|app|server|cli)\./i.test(path.basename(relPath))], processFile [(fullPath, relPath)], startWatcher [(cwd)], walk [(dir, ig)]]
- [CORE] test/index.test.js (↑10 ↓0) | desc: 
  - syms: []

## GRAPH EDGES
[index.js] -> [imports] -> [chokidar]
[index.js] -> [imports] -> [fs]
[index.js] -> [imports] -> [ignore]
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
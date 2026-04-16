# TODO: Code-Graph Improvements

## P0 - Critical
- [x] **Fix Regex Injection** — `CodeParser.findSymbolContext` interpolates unescaped symbol names into `new RegExp()`. Add regex escaping.
- [x] **Fix Garbled Graph Output** — `extractTags` runs on raw content including code, so regex patterns in source match the TAGS regex. Strip code literals instead.

## P1 - Important
- [x] **Fix `writeJson` Hook Overwrite** — `preToolUse` arrays get replaced instead of merged. Concatenate and deduplicate array entries.
- [x] **Fix Silent Error Swallowing** — JSON parse failures and global skill installs silently catch errors. Add warnings.
- [x] **Fix Fragile Entry Point Guard** — `endsWith('index.js')` matches any index.js. Compare resolved paths.

## P2 - Quality
- [x] **Fix README Duplication** — Lines 252-255 are duplicated.
- [x] **Normalize Sync/Async I/O** — Mixed `fs.existsSync` and `fsp.*` in async contexts. Standardize.
- [x] **Expand Test Coverage** — Added 11 new tests (21 total): regex escaping, tag extraction, writeJson merge, CLI commands, error paths.

## P3 - Maintenance
- [x] **Add `--help` Flag** — CLI has `--version` but no `--help`. Add comprehensive help text.
- [x] **Module Split** — Split 776-line monolith into `lib/` modules: config, parser, mapper, reflections, initializer, skills, agents.
- [x] **Gitignore Generated Files** — Add `llm-code-graph.md` to `.gitignore`.

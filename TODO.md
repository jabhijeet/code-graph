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

## v4.2.0 - Security & Production Hardening
- [x] **Path Traversal** — Platform name `/../../etc` traversed out of home via `` `.${platform}` `` template construction in `installGlobalSkill`. Added `SUPPORTED_PLATFORMS` whitelist + `isValidPlatform` regex guard.
- [x] **Prototype Pollution** — `writeJson` did `{...JSON.parse(...)}` on attacker-controllable files. Added `stripDangerousKeys` and applied to both existing and incoming payloads.
- [x] **Symlink Escape** — Walker followed symlinks to files, allowing escape outside `cwd` and potential loops. Now skips `isSymbolicLink()` entries.
- [x] **Resource Exhaustion** — `processFile` read any size. Now checks `fsp.stat` and skips files above `CONFIG.MAX_FILE_BYTES` (5 MB). Walker capped at `CONFIG.MAX_WALK_DEPTH` (32).
- [x] **Reflection Injection** — `category` / `lesson` could contain newlines to inject fake bracketed entries. Sanitized both inputs with length caps.
- [x] **Immutable Config** — `CONFIG`, `SUPPORTED_EXTENSIONS`, `DEFAULT_IGNORES` now `Object.freeze`-d.
- [x] **Graceful Errors** — `walk` handles `EACCES`/`EPERM` with warning; relative-path escape guard added.

## v4.1.0 - Quality & Integration
- [x] **Parser: Prefer Declaration Sites** — `findSymbolContext` picked first textual occurrence, capturing call-site args or string literals as signatures. Now prefers keyword-prefixed declarations.
- [x] **Parser: Shebang Handling** — `extractFileDesc` destroyed `#!/usr/bin/env node` into garbage and stripped `/` from path references. Now skips shebangs and strips only leading comment markers.
- [x] **Claude Hook Format** — `.claude/settings.json` used legacy `preToolUse` + `{tools,message}` shape. Updated to modern `PreToolUse` + `matcher` + `hooks:[{type,command}]`.
- [x] **MCP Discovery** — MCP server config wrote `mcp-server-code-graph.json` in cwd (never loaded). Now writes `.mcp.json` (Claude) and `.cursor/mcp.json` (Cursor) with merge semantics.
- [x] **Platform List Drift** — Removed dead `openclaw`, `droid`, `trae-cn` references from `index.js` platforms array.
- [x] **Auto-Init on Generate** — `generate` now bootstraps rule/reflection files if missing.
- [x] **Platform Audit** — Added 75 integration checks across 12 platforms.

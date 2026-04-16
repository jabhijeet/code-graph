# RELEASE NOTES

### v4.0.0 (2026-04-16)
- **Breaking: Modular Architecture** — Split monolithic `index.js` (776 lines) into 7 modules under `lib/`. All public exports (`CodeParser`, `ProjectMapper`, `ReflectionManager`, `SkillManager`, `AgentManager`, `ProjectInitializer`, `CONFIG`) remain available from `index.js` via re-exports, but direct imports from internal paths will break.
- **Security:** Fixed regex injection in `CodeParser.findSymbolContext` — symbol names with regex metacharacters (e.g., `$`, `+`) are now escaped before interpolation.
- **Fix (Graph Output):** Tag extraction no longer matches regex patterns embedded in source code. Strips string/regex literals while preserving comments where `TODO`/`FIXME` tags live.
- **Fix (Hook Merge):** `writeJson` now appends new hook entries to existing arrays instead of overwriting. Deduplicates by `message` field.
- **Fix (Error Handling):** JSON parse failures and global skill install errors now emit warnings instead of being silently swallowed.
- **Fix (Entry Point):** CLI guard uses `path.resolve()` comparison instead of fragile `endsWith('index.js')`.
- **Fix (README):** Removed duplicated Implementation Details lines.
- **CLI:** Added `--help` / `-h` flag with full command, flag, and platform reference.
- **Quality:** Converted all synchronous `fs` calls to async `fsp` equivalents. Removed `fs` sync import entirely.
- **Tests:** Expanded from 10 to 21 tests covering regex safety, tag extraction, hook merging, CLI commands, and error paths.
- **Docs:** Updated README with project structure, pipeline details, and v4 changelog.

### v3.5.4 (2026-04-16)
- **Fix (Roo Code):** Final correction for persistent Markdown injection into `.roomodes` (YAML).
- **Stability:** Consolidated all instructions into `.roorules` and `.clinerules`.
- **Maintenance:** Synchronized version across all metadata files.

### v3.5.3 (2026-04-16)
- **Fix (Roo Code):** Completely removed Markdown injection into `.roomodes` (YAML) across all skill installations.
- **Fix (Roo Code):** Unified global instructions into `.roorules` and `.clinerules` for reliable rule propagation.
- **CLI:** Added `--version` / `-v` command for better troubleshooting and stale installation detection.
- **CLI:** Added versioned headers to `generate` command output.

### v3.5.2 (2026-04-16)
- **Fix (Roo Code):** Removed incorrect Markdown appends to `.roomodes` (YAML) to prevent syntax errors.
- **Fix (Roo Code):** Switched to `.roorules` for global instructions, ensuring compatibility with Roo's hierarchical rule system.

### v3.5.1 (2026-04-16)
- **Fix (Gemini CLI):** Modernized integration with YAML frontmatter for global skills and agents.
- **Fix (Gemini CLI):** Transitioned from unsupported tool hooks to standard `GEMINI.md` Memory Import syntax (`@import`).
- **Fix (Roo Code):** Restored missing `.roomodes` synchronization for mode-agnostic rules.
- **Stability:** Improved `writeJson` to perform deep-merging of `hooks`, preventing configuration overwrites.
- **Tests:** Aligned `ProjectMapper` header with test suite expectations.

### v3.4.1 (2026-04-16)
- **Docs:** Synchronized NPM installation documentation.
- **Docs:** Reconciled platform integration tables for consistency across all 15+ supported platforms.

### v3.4.0 (2026-04-16)
- **Hyper-Condensed Context:** Minified project map and reflection outputs (30-50% token reduction).
- **Architecture:** Implemented edge grouping and metadata stripping for extreme density.
- **Maintenance:** Refactored defensive uninstallation for global and local data.

### v3.3.0 (2026-04-16)
- **Active Agent Orchestration:** Added `install-agent` for explicit delegation to Code-Graph specialists.
- **Automation:** Unified `install` commands and automated `preuninstall` cleanup logic.
- **Tooling:** Model Context Protocol (MCP) support for Claude and Cursor.

### v3.2.1 (2026-04-16)
- **Docs:** Exhaustive documentation of platform-specific installation details.
- **Registry:** Integration table synchronization.

### v3.2.0 (2026-04-16)
- **Universal Agent OS:** Restored full surgical integration for Antigravity, Kiro, Codex, and OpenCode.
- **Interceptors:** Implemented segregated skill hooks for platforms that support them.

### v3.1.0 (2026-04-16)
- **Selective Skills:** Segregated skills into `projectmap` and `reflections`.
- **Command:** Standardized on `install-skills` command.

### v3.0.0 (2026-04-16)
- **Unified Naming:** Major refactor to `llm-agent-*` naming convention.
- **Integration:** Automated platform integration for Claude, Cursor, Gemini, etc.

### v2.1.x
- **Memory:** Initial implementation of `reflect` command and lesson persistence.

# RELEASE NOTES

### v3.5.3 (2026-04-16)
- **Fix (Roo Code):** Completely removed Markdown injection into `.roomodes` (YAML) across all skill installations.
- **Fix (Roo Code):** Unified global instructions into `.roorules` and `.clinerules` for reliable rule propagation.

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

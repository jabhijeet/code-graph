# TODO: Project Improvement Plan

This file tracks practical improvements for `code-graph-llm` after the v4.6.0 ProjectMap/Reflections split. Each item is written as implementation steps so an agent or maintainer can pick it up without rediscovering the project shape.

## P0 - Correctness And Data Integrity

### 1. Prevent generated files and temp test directories from polluting maps

Problem: `ProjectMapper.walk()` relies on `CONFIG.DEFAULT_IGNORES` plus `.gitignore`, but generated agent files, local temp test directories, and integration artifacts can still be mapped if they are not ignored by the host project.

Steps:
1. Audit current generated artifacts: `llm-code-graph.md`, `llm-agent-project-learnings.md`, `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `.claude/`, `.codex/`, `.agent/`, `.kiro/`, `.cursor/`, `.opencode/`, `.github/copilot-instructions.md`, and `temp_*`.
2. Decide which files should be map inputs and which are installation outputs.
3. Update `CONFIG.DEFAULT_IGNORES` in `lib/config.js` for outputs that should never be indexed by default.
4. Add mapper tests that create representative generated files and assert they are skipped.
5. Regenerate `llm-code-graph.md` and confirm only source/test files remain unless explicitly intended.

Verify:
```bash
cmd /c npm test
node index.js generate
```

### 2. Harden path handling for user-provided MCP `cwd`

Problem: `lib/mcp.js` accepts a `cwd` argument from tool calls and passes it directly to `ProjectInitializer` and `ProjectMapper`. That is useful, but it needs explicit safety semantics.

Steps:
1. Define whether MCP should allow any local path or only paths under the install-time `defaultCwd`.
2. If restricted, resolve both paths and reject traversal outside the allowed root.
3. If unrestricted, document that the MCP server maps local paths the host process can read.
4. Return structured JSON-RPC errors for invalid or unreadable paths.
5. Add unit tests for valid cwd, missing cwd, and disallowed cwd behavior.

Verify:
```bash
cmd /c npm test
```

### 3. Make parser extraction resilient across more languages

Problem: `CodeParser` is intentionally regex-based and compact, but it can miss common declarations or confuse syntax in modern codebases.

Steps:
1. Add fixture-style tests for Python classes/functions, Go methods/interfaces, Rust impl/functions, Java/Kotlin classes, C# classes, Dart widgets, and TypeScript arrow exports.
2. Mark each expected symbol and edge explicitly in tests before changing parser logic.
3. Improve `REGEX.SYMBOLS` and `extractEdges()` in small language-focused patches.
4. Keep false-positive tests for UI call sites such as `SizedBox(...)` and JSX component usage.
5. Add comments only where a regex is non-obvious.

Verify:
```bash
cmd /c npm test
```

## P1 - Tests And Release Confidence

### 4. Convert `test/platform-audit.js` into an npm script

Problem: The platform audit exists but is not part of `npm test`, so release validation can miss platform drift.

Steps:
1. Add a script such as `"test:platforms": "node test/platform-audit.js"` to `package.json`.
2. Add a combined script such as `"test:all": "npm test && npm run test:platforms"`.
3. On Windows, run through `cmd /c npm run test:all`.
4. Update README release instructions to mention the new command.
5. Consider making platform audit use a temp directory under `os.tmpdir()` instead of `D:/tmp/cg-test`.

Verify:
```bash
cmd /c npm run test:all
```

### 5. Add CLI integration tests with isolated working directories

Problem: Current CLI tests run commands from the repository root. More behavior should be verified in throwaway projects.

Steps:
1. Create test helpers that make and clean temporary project directories.
2. Test `node index.js init`, `generate`, `reflect`, `install-skills`, `uninstall-skills`, `install-agent`, and `uninstall-agent`.
3. Assert files are created, merged, and removed without damaging pre-existing user content.
4. Capture stdout/stderr and assert helpful errors for missing platform, invalid skill, and unknown command.
5. Keep cleanup in `finally` blocks so failed tests do not leave temp directories.

Verify:
```bash
cmd /c npm test
```

### 6. Add a release consistency check

Problem: Version information exists in both `package.json` and `CONFIG.VERSION`; past project learnings call out drift risk.

Steps:
1. Add a test that reads `package.json` and asserts `package.version === CONFIG.VERSION`.
2. Add README or release-note instructions that version bumps must update both locations.
3. Consider adding a small `node` script for release validation if the checks grow.

Verify:
```bash
cmd /c npm test
```

## P2 - Architecture And Maintainability

### 7. Split platform specs from installer mechanics

Problem: `lib/skills.js` contains platform dispatch, skill content, cleanup rules, JSON merge helpers, and global install behavior in one large class.

Steps:
1. Extract ProjectMap and Reflections skill specs into a new module, for example `lib/skill-specs.js`.
2. Keep `SkillManager` responsible for file operations and platform dispatch only.
3. Move legacy skill metadata into the same specs module or a small `lib/legacy-skills.js`.
4. Update imports and tests without changing generated output.
5. Run platform audit and compare generated files before and after the refactor.

Verify:
```bash
cmd /c npm test
node test/platform-audit.js
```

### 8. Add reusable JSON merge utilities

Problem: JSON merge logic appears in skill and agent installation paths with slightly different semantics.

Steps:
1. Create a helper module for safe JSON read, dangerous-key stripping, deep object merge, hook-array dedupe, and empty-object cleanup.
2. Replace `SkillManager.writeJson()`, `removeJsonArrayValue()`, `removeJsonHookEntry()`, and MCP config merging with shared helpers.
3. Preserve existing behavior with tests before changing implementation.
4. Add tests for malformed JSON, arrays, primitive top-level JSON, duplicate hooks, and prototype pollution.

Verify:
```bash
cmd /c npm test
```

### 9. Improve map output stability

Problem: Stable output matters because agents and humans diff `llm-code-graph.md`. Some ordering and truncation behavior is implicit.

Steps:
1. Document output ordering in `ProjectMapper.formatOutput()`.
2. Add tests for node sorting, edge sorting, tag sorting, symbol sorting, and description truncation.
3. Consider including skipped-file counts or warnings outside the map file so map diffs remain source-focused.
4. Ensure output remains compact enough for LLM context.

Verify:
```bash
cmd /c npm test
node index.js generate
```

## P3 - User Experience

### 10. Improve CLI error messages and exit codes

Problem: Several command handlers print errors but do not necessarily set a failing exit code for invalid usage.

Steps:
1. Decide the exit-code contract: invalid usage should return `1`, successful no-op should return `0`.
2. Make `SkillManager.execute()` and `AgentManager.execute()` return status or throw typed errors instead of only printing.
3. Update `index.js` to set `process.exitCode` consistently.
4. Add CLI tests for invalid platform, invalid skill, missing platform, and unknown command.
5. Update help text if command behavior changes.

Verify:
```bash
cmd /c npm test
```

### 11. Add a `doctor` command

Problem: Users need a quick way to know whether the project map, rules, reflections, hooks, and installed platform artifacts are healthy.

Steps:
1. Define checks: required files exist, map is not empty, version is consistent, platform artifacts parse as JSON/Markdown, and MCP config points to `index.js mcp`.
2. Implement `code-graph doctor [platform]`.
3. Print concise pass/fail output with next-step commands.
4. Add tests with healthy and broken temp projects.
5. Document in README Quick Start.

Verify:
```bash
cmd /c npm test
node index.js doctor
```

### 12. Improve README accuracy around hooks

Problem: README text can drift from current installer behavior, especially platform hook names and matchers.

Steps:
1. Compare README platform details against `lib/skills.js` and `lib/agents.js`.
2. Update hook descriptions for Claude, Codex, Gemini, and OpenCode to match current files.
3. Add a short maintenance note: update README when changing platform specs.
4. Consider testing key README snippets if drift keeps recurring.

Verify:
```bash
cmd /c npm test
```

## P4 - Features

### 13. Add freshness detection for `llm-code-graph.md`

Problem: The ProjectMap skill tells agents to refresh the map if stale, but the tool does not expose a direct stale/not-stale check.

Steps:
1. Record a generated timestamp or source fingerprint in the map header.
2. Add `code-graph status` or include freshness in `doctor`.
3. Compare source file mtimes or hashes against map generation time.
4. Keep the header compact so it does not bloat agent context.
5. Add tests for fresh, stale, and missing map states.

Verify:
```bash
cmd /c npm test
node index.js generate
```

### 14. Add optional JSON output

Problem: The Markdown map is optimized for humans and agents, but integrations may need structured graph data.

Steps:
1. Design a compact schema with `files`, `symbols`, `tags`, `edges`, and `metadata`.
2. Add `code-graph generate --json` or `code-graph export-json`.
3. Reuse `ProjectMapper` data structures instead of reparsing the Markdown output.
4. Add schema tests for stable keys and edge representation.
5. Document that Markdown remains the default agent-facing output.

Verify:
```bash
cmd /c npm test
node index.js generate --json
```

### 15. Add configurable extension and ignore settings

Problem: Supported extensions and default ignores are hard-coded in `CONFIG`, which keeps the tool simple but limits project-specific tuning.

Steps:
1. Design a small config file, for example `.code-graph.json`.
2. Support additive `extensions` and `ignore` entries first; avoid replacing safe defaults unless explicitly needed.
3. Validate config shape and reject dangerous values.
4. Add tests for missing config, valid config, invalid JSON, and custom extension mapping.
5. Document examples in README.

Verify:
```bash
cmd /c npm test
node index.js generate
```

## Ongoing Maintenance Checklist

Before merging any future implementation:
1. Read `llm-code-graph.md` and `llm-agent-project-learnings.md`.
2. Add or update tests before changing behavior.
3. Run `cmd /c npm test`.
4. Run `node test/platform-audit.js` after installer, agent, platform, or docs changes.
5. Run `node index.js generate` after structural source changes.
6. Update `README.md` and `RELEASE_NOTES.md` for user-facing changes.
7. Run `code-graph reflect <CATEGORY> <LESSON>` after a bug fix or non-obvious failure.

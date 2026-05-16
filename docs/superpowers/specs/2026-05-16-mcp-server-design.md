# MCP Server Design — code-graph-llm

**Date:** 2026-05-16
**Version:** 4.19.0+
**Status:** Approved

---

## Overview

Expose code-graph as an MCP server so agents in other projects can call its tools over stdio. Any Claude Code project adds a one-liner to `.mcp.json` and immediately gains live access to graph generation, symbol lookup, graph search, and reflection management — without copying files or running separate installs.

---

## Architecture

```
index.js  ──(code-graph mcp)──▶  lib/mcp-server.js
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                   ▼
             ProjectMapper      ReflectionManager     CodeParser
             (generate)         (add/read)            (symbols)
                    │                  │                   │
                    └──────────────────┴───────────────────┘
                                       │
                              llm-code-graph.md
                         llm-agent-project-learnings.md
```

**Transport:** `StdioServerTransport` from `@modelcontextprotocol/sdk`. Claude Code spawns `code-graph mcp` as a child process and owns the pipe. No port, no daemon, no auth required.

**New files:**
- `lib/mcp-server.js` — MCP server implementation (~150 lines)

**Modified files:**
- `index.js` — add `mcp` command branch
- `package.json` — add `@modelcontextprotocol/sdk` dependency

**No new abstractions.** MCP is a protocol layer over existing classes.

---

## Tools

All tools accept `project_path` so the server can operate on any directory, not just its own cwd.

### `generate_graph`
Runs the project mapper and writes `llm-code-graph.md`.

**Input:**
```json
{ "project_path": "/absolute/path/to/project" }
```
**Output:** `{ "success": true, "files_scanned": 42, "map_file": "llm-code-graph.md" }`

**Implementation:** `new ProjectMapper(project_path).generate()`

---

### `get_file_symbols`
Returns the symbol list for a specific file from the existing graph (no re-parse).

**Input:**
```json
{ "file_path": "lib/parser.js", "project_path": "/absolute/path" }
```
**Output:** `{ "file": "lib/parser.js", "symbols": ["CodeParser", "extract", "extractEdges", ...] }`

**Implementation:** Read `llm-code-graph.md`, find entry matching `file_path`, parse `s: [...]`.

---

### `search_graph`
Full-text search across file paths, symbol names, and descriptions in the graph.

**Input:**
```json
{ "query": "reflect", "project_path": "/absolute/path" }
```
**Output:** Array of `{ file, symbols, description, relevance_score }` sorted by match count.

**Implementation:** Read `llm-code-graph.md`, scan each entry for `query` in path + `s:` + `d:` fields.

---

### `add_reflection`
Appends a lesson to `llm-agent-project-learnings.md`.

**Input:**
```json
{ "category": "LOGIC", "lesson": "extractSymbols regex matches itself if FIXME present", "project_path": "/absolute/path" }
```
**Output:** `{ "success": true, "entry": "[LOGIC] extractSymbols regex matches itself if FIXME present" }`

**Implementation:** Extend `ReflectionManager.add(category, lesson, cwd?)` to accept an optional `cwd` parameter (defaults to `process.cwd()`). MCP layer passes `project_path` as `cwd`. `process.chdir()` must not be used — unsafe in a persistent server process.

---

### `get_reflections`
Returns all lessons, optionally filtered by category.

**Input:**
```json
{ "project_path": "/absolute/path", "category": "LOGIC" }
```
(`category` is optional — omit to return all)

**Output:** `{ "total": 12, "lessons": [{ "category": "LOGIC", "text": "..." }, ...] }`

**Implementation:** Read `llm-agent-project-learnings.md`, parse `- [CATEGORY] lesson` lines.

---

## Error Handling

- `project_path` does not exist → return `{ "error": "project_path not found: /bad/path" }` (never throw)
- `llm-code-graph.md` missing → return `{ "error": "No graph found. Run generate_graph first." }`
- `generate_graph` fails mid-scan → return partial result with `{ "error": "...", "files_scanned": N }`
- All tool handlers wrapped in try/catch — MCP server must not crash on bad input

---

## Integration

**`.mcp.json` for any consuming project (local install):**
```json
{
  "mcpServers": {
    "code-graph": {
      "command": "node",
      "args": ["/absolute/path/to/code-graph/index.js", "mcp"]
    }
  }
}
```

**Global install:**
```json
{
  "mcpServers": {
    "code-graph": {
      "command": "code-graph",
      "args": ["mcp"]
    }
  }
}
```

`code-graph install-agent claude` should auto-generate the correct block for the active install type.

---

## Testing

- Unit: mock `ProjectMapper`, `ReflectionManager` — test each tool handler's input/output contract
- Integration: spawn the server via stdio, call each tool with a real test project directory, assert outputs
- Error cases: missing `project_path`, missing graph file, malformed input

---

## Out of Scope

- HTTP/SSE transport (can be added later as `code-graph serve`)
- Authentication
- Streaming responses for large graphs
- Watch mode / live updates via MCP

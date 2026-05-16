# code-graph MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MCP stdio server so any Claude Code project can call code-graph tools (generate, query symbols, search, reflect) over the MCP protocol via `code-graph mcp`.

**Architecture:** `lib/mcp-server.js` exports five async handler functions and a `startMcpServer()` entry point. Handlers wrap existing `ProjectMapper`, `ReflectionManager`, and `fsp` directly. `index.js` gets a `mcp` case in its switch. Transport is `StdioServerTransport` — Claude Code spawns the process, owns the pipe. No port, no daemon.

**Tech Stack:** Node.js ESM, `@modelcontextprotocol/sdk` (stdio), existing `ProjectMapper` / `ReflectionManager` classes.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `@modelcontextprotocol/sdk` dependency |
| `lib/reflections.js` | Modify | `ReflectionManager.add(cat, lesson, cwd?)` — optional cwd param |
| `lib/mcp-server.js` | Create | 5 tool handlers + `startMcpServer()` |
| `index.js` | Modify | Add `case 'mcp':` to switch at line 131 |
| `test/mcp-server.test.js` | Create | Tests for all 5 handlers + ReflectionManager cwd |

---

## Task 1: Add SDK dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the SDK**

Run: `npm install @modelcontextprotocol/sdk`

Expected: package added to `dependencies` in `package.json`, `node_modules/@modelcontextprotocol/sdk` exists.

- [ ] **Step 2: Verify ESM import resolves**

Run:
```
node -e "import('@modelcontextprotocol/sdk/server/index.js').then(m => console.log('ok:', Object.keys(m))).catch(e => console.error('FAIL:', e.message))"
```

Expected: prints `ok:` with `Server` in the list. If it prints `FAIL`, check the installed version's export paths with `node_modules/@modelcontextprotocol/sdk/package.json`.

- [ ] **Step 3: Commit**

```
git add package.json package-lock.json
git commit -m "chore: add @modelcontextprotocol/sdk dependency"
```

---

## Task 2: Extend ReflectionManager.add to accept cwd

**Files:**
- Modify: `lib/reflections.js` lines 11 and 25
- Create: `test/mcp-server.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/mcp-server.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ReflectionManager } from '../lib/reflections.js';

test('ReflectionManager.add writes to explicit cwd', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  await ReflectionManager.add('LOGIC', 'explicit cwd lesson', dir);
  const content = await readFile(join(dir, 'llm-agent-project-learnings.md'), 'utf8');
  assert.ok(content.includes('[LOGIC] explicit cwd lesson'), 'lesson not found in file');
});

test('ReflectionManager.add still works without cwd (backward compat)', async () => {
  // just verifies no crash — writes to process.cwd() which is fine in test context
  await assert.doesNotReject(() => ReflectionManager.add('STYLE', 'backward compat test'));
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `node --test test/mcp-server.test.js`

Expected: first test FAILs — `add` writes to `process.cwd()`, not `dir`.

- [ ] **Step 3: Modify lib/reflections.js**

Change line 11 (method signature):
```javascript
// Before:
static async add(category, lesson) {

// After:
static async add(category, lesson, cwd = process.cwd()) {
```

Change line 25 (file path):
```javascript
// Before:
const filePath = path.join(process.cwd(), CONFIG.REFLECTIONS_FILE);

// After:
const filePath = path.join(cwd, CONFIG.REFLECTIONS_FILE);
```

- [ ] **Step 4: Run test to confirm pass**

Run: `node --test test/mcp-server.test.js`

Expected: both tests PASS.

- [ ] **Step 5: Run full suite — confirm no regression**

Run: `npm test`

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```
git add lib/reflections.js test/mcp-server.test.js
git commit -m "feat: ReflectionManager.add accepts optional cwd parameter"
```

---

## Task 3: Create lib/mcp-server.js with tool handlers

**Files:**
- Create: `lib/mcp-server.js`
- Modify: `test/mcp-server.test.js`

- [ ] **Step 1: Write failing tests for all 5 handlers**

Append to `test/mcp-server.test.js`:

```javascript
import {
  handleGenerateGraph,
  handleGetFileSymbols,
  handleSearchGraph,
  handleAddReflection,
  handleGetReflections
} from '../lib/mcp-server.js';

const PROJECT = process.cwd(); // D:\Projects\code-graph when run from project root

// generate_graph
test('handleGenerateGraph returns success with file count', async () => {
  const result = await handleGenerateGraph({ project_path: PROJECT });
  assert.strictEqual(result.success, true, JSON.stringify(result));
  assert.ok(typeof result.files_scanned === 'number' && result.files_scanned > 0);
  assert.strictEqual(result.map_file, 'llm-code-graph.md');
});

test('handleGenerateGraph returns error for nonexistent path', async () => {
  const result = await handleGenerateGraph({ project_path: '/nonexistent/xyz_12345' });
  assert.ok(result.error, 'expected error field');
});

// get_file_symbols
test('handleGetFileSymbols returns symbols for lib/reflections.js', async () => {
  const result = await handleGetFileSymbols({ file_path: 'lib/reflections.js', project_path: PROJECT });
  assert.ok(Array.isArray(result.symbols), JSON.stringify(result));
  assert.ok(result.symbols.length > 0);
  assert.ok(result.symbols.some(s => s.includes('ReflectionManager')));
});

test('handleGetFileSymbols returns error for unknown file', async () => {
  const result = await handleGetFileSymbols({ file_path: 'lib/does-not-exist.js', project_path: PROJECT });
  assert.ok(result.error, 'expected error field');
});

// search_graph
test('handleSearchGraph finds results for "reflect"', async () => {
  const result = await handleSearchGraph({ query: 'reflect', project_path: PROJECT });
  assert.ok(Array.isArray(result.results), JSON.stringify(result));
  assert.ok(result.results.length > 0);
  assert.ok(result.results[0].file);
});

test('handleSearchGraph returns empty array for no match', async () => {
  const result = await handleSearchGraph({ query: 'xyzzy_nomatch_99999', project_path: PROJECT });
  assert.ok(Array.isArray(result.results));
  assert.strictEqual(result.results.length, 0);
});

// add_reflection
test('handleAddReflection writes lesson to temp dir', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  const result = await handleAddReflection({ category: 'STYLE', lesson: 'mcp handler test', project_path: dir });
  assert.strictEqual(result.success, true, JSON.stringify(result));
  assert.ok(result.entry.includes('STYLE'));
  assert.ok(result.entry.includes('mcp handler test'));
});

// get_reflections
test('handleGetReflections returns all lessons', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  await ReflectionManager.add('ENV', 'lesson one', dir);
  await ReflectionManager.add('LOGIC', 'lesson two', dir);
  const result = await handleGetReflections({ project_path: dir });
  assert.strictEqual(result.total, 2);
  assert.strictEqual(result.lessons.length, 2);
});

test('handleGetReflections filters by category', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  await ReflectionManager.add('ENV', 'env lesson', dir);
  await ReflectionManager.add('LOGIC', 'logic lesson', dir);
  const result = await handleGetReflections({ project_path: dir, category: 'ENV' });
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.lessons[0].category, 'ENV');
  assert.strictEqual(result.lessons[0].text, 'env lesson');
});

test('handleGetReflections returns empty for missing file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  const result = await handleGetReflections({ project_path: dir });
  assert.strictEqual(result.total, 0);
  assert.deepStrictEqual(result.lessons, []);
});
```

- [ ] **Step 2: Run to confirm failure (module missing)**

Run: `node --test test/mcp-server.test.js`

Expected: FAIL — `Cannot find module '../lib/mcp-server.js'`

- [ ] **Step 3: Create lib/mcp-server.js with handlers**

Create `lib/mcp-server.js`:

```javascript
/**
 * @file lib/mcp-server.js
 * @description MCP stdio server exposing code-graph tools to external agents.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CONFIG } from './config.js';
import { ProjectMapper } from './mapper.js';
import { ReflectionManager } from './reflections.js';

// ── Tool handlers ─────────────────────────────────────────────────────────────

export async function handleGenerateGraph({ project_path }) {
  try {
    const mapper = new ProjectMapper(project_path);
    await mapper.generate();
    const content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    const files_scanned = (content.match(/^- /gm) ?? []).length;
    return { success: true, files_scanned, map_file: CONFIG.MAP_FILE };
  } catch (err) {
    return { error: err.message };
  }
}

export async function handleGetFileSymbols({ file_path, project_path }) {
  try {
    const content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    let inEntry = false;
    for (const line of content.split('\n')) {
      if (!inEntry && line.startsWith('- ') && line.includes(file_path)) {
        inEntry = true;
        continue;
      }
      if (inEntry) {
        if (line.includes('s: [')) {
          const match = line.match(/s:\s*\[([^\]]+)\]/);
          if (!match) return { file: file_path, symbols: [] };
          const symbols = match[1].split(',').map(s => s.trim().split(' ')[0]).filter(Boolean);
          return { file: file_path, symbols };
        }
        if (line.startsWith('- ') && !line.startsWith('  ')) break;
      }
    }
    return { error: `File not found in graph: ${file_path}. Run generate_graph first.` };
  } catch (err) {
    if (err.code === 'ENOENT') return { error: 'No graph found. Run generate_graph first.' };
    return { error: err.message };
  }
}

export async function handleSearchGraph({ query, project_path }) {
  try {
    const content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    const lower = query.toLowerCase();
    const results = [];
    let current = null;

    for (const line of content.split('\n')) {
      if (line.startsWith('- ') && !line.startsWith('  ')) {
        if (current?.score > 0) results.push(current);
        const fileMatch = line.match(/^- \*?([^\s(|]+)/);
        const descMatch = line.match(/d:\s*(.+)/);
        current = {
          file: fileMatch?.[1]?.trim() ?? '',
          description: descMatch?.[1]?.trim() ?? '',
          symbols: [],
          score: line.toLowerCase().includes(lower) ? 1 : 0
        };
      } else if (current && line.includes('s: [')) {
        const match = line.match(/s:\s*\[([^\]]+)\]/);
        if (match) {
          current.symbols = match[1].split(',').map(s => s.trim().split(' ')[0]).filter(Boolean);
          for (const sym of current.symbols) {
            if (sym.toLowerCase().includes(lower)) current.score++;
          }
          if (line.toLowerCase().includes(lower)) current.score++;
        }
      }
    }
    if (current?.score > 0) results.push(current);
    return { query, results: results.sort((a, b) => b.score - a.score) };
  } catch (err) {
    if (err.code === 'ENOENT') return { error: 'No graph found. Run generate_graph first.' };
    return { error: err.message };
  }
}

export async function handleAddReflection({ category, lesson, project_path }) {
  try {
    await ReflectionManager.add(category, lesson, project_path);
    const cat = String(category ?? 'GENERAL').replace(/[^\w-]/g, '').slice(0, 20).toUpperCase() || 'GENERAL';
    return { success: true, entry: `[${cat}] ${lesson}` };
  } catch (err) {
    return { error: err.message };
  }
}

export async function handleGetReflections({ project_path, category }) {
  try {
    let content;
    try {
      content = await fsp.readFile(path.join(project_path, CONFIG.REFLECTIONS_FILE), 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return { total: 0, lessons: [] };
      throw e;
    }
    const lessons = [];
    for (const line of content.split('\n')) {
      const match = line.match(/^- \[([^\]]+)\]\s+(.+)/);
      if (!match) continue;
      const [, cat, text] = match;
      if (!category || cat.toUpperCase() === category.toUpperCase()) {
        lessons.push({ category: cat, text: text.trim() });
      }
    }
    return { total: lessons.length, lessons };
  } catch (err) {
    return { error: err.message };
  }
}

// ── MCP tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'generate_graph',
    description: 'Build or refresh llm-code-graph.md for a project directory.',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: { type: 'string', description: 'Absolute path to the project directory' }
      },
      required: ['project_path']
    }
  },
  {
    name: 'get_file_symbols',
    description: 'Return the symbol list for a file from the existing graph (no re-parse).',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Relative file path as in the graph (e.g. lib/parser.js)' },
        project_path: { type: 'string', description: 'Absolute path to the project directory' }
      },
      required: ['file_path', 'project_path']
    }
  },
  {
    name: 'search_graph',
    description: 'Search file paths, symbol names, and descriptions in the project graph.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        project_path: { type: 'string', description: 'Absolute path to the project directory' }
      },
      required: ['query', 'project_path']
    }
  },
  {
    name: 'add_reflection',
    description: 'Append a lesson to llm-agent-project-learnings.md.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'LOGIC | ENV | DEP | STYLE | VERSION | SKILL | BUG' },
        lesson: { type: 'string', description: 'Lesson text (max 500 chars)' },
        project_path: { type: 'string', description: 'Absolute path to the project directory' }
      },
      required: ['category', 'lesson', 'project_path']
    }
  },
  {
    name: 'get_reflections',
    description: 'Return lessons from llm-agent-project-learnings.md, optionally filtered by category.',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: { type: 'string', description: 'Absolute path to the project directory' },
        category: { type: 'string', description: 'Optional filter: LOGIC | ENV | DEP | STYLE | VERSION | SKILL | BUG' }
      },
      required: ['project_path']
    }
  }
];

const HANDLERS = {
  generate_graph:   handleGenerateGraph,
  get_file_symbols: handleGetFileSymbols,
  search_graph:     handleSearchGraph,
  add_reflection:   handleAddReflection,
  get_reflections:  handleGetReflections
};

// ── Server entry point ────────────────────────────────────────────────────────

export async function startMcpServer() {
  const server = new Server(
    { name: 'code-graph', version: CONFIG.VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = HANDLERS[name];
    if (!handler) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }] };
    }
    try {
      const result = await handler(args ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 4: Run tests**

Run: `node --test test/mcp-server.test.js`

Expected: all tests PASS.

If `handleGenerateGraph` test fails with a path error, verify `process.cwd()` is `D:\Projects\code-graph` when running from the project root. The `PROJECT` constant in the test uses `process.cwd()`.

- [ ] **Step 5: Run full suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add lib/mcp-server.js test/mcp-server.test.js
git commit -m "feat: add MCP server with 5 tools (generate, symbols, search, reflect)"
```

---

## Task 4: Wire mcp command in index.js

**Files:**
- Modify: `index.js` lines 127–131 (before `default:`)

- [ ] **Step 1: Add the mcp case to the switch**

In `index.js`, insert before `default:` at line 131:

```javascript
      case 'mcp':
        // lazy import — only loads MCP SDK when command is used
        { const { startMcpServer } = await import('./lib/mcp-server.js');
          await startMcpServer(); }
        break;
```

Also add `mcp` to the help text in `printHelp()`. After the `watch` line (~line 35), add:

```
  mcp                                   Start MCP stdio server (for Claude Code integration)
```

- [ ] **Step 2: Smoke-test the server starts**

Run: `node index.js mcp`

Expected: process hangs waiting on stdin — MCP server is running. Press `Ctrl+C`. No crash or import error on startup.

- [ ] **Step 3: Run full suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add index.js
git commit -m "feat: add 'mcp' command to CLI — starts MCP stdio server"
```

---

## Task 5: Document .mcp.json integration

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add MCP server section to README**

Find the section in `README.md` that covers installation/usage. Add after the existing integration section:

```markdown
## MCP Server (Claude Code integration)

Any Claude Code project can connect to code-graph as an MCP tool server.

Add to your project's `.mcp.json`:

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

Or if using a local dev install:

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

### Available tools

| Tool | Description |
|------|-------------|
| `generate_graph` | Build/refresh `llm-code-graph.md` for any project path |
| `get_file_symbols` | Return symbols for a specific file from the graph |
| `search_graph` | Search file paths, symbols, and descriptions |
| `add_reflection` | Append a lesson to `llm-agent-project-learnings.md` |
| `get_reflections` | Return all lessons, optionally filtered by category |

All tools accept `project_path` (absolute path) so one running server can serve multiple projects.
```

- [ ] **Step 2: Commit**

```
git add README.md
git commit -m "docs: add MCP server setup and tool reference to README"
```

---

## Self-Review

**Spec coverage check:**
- `generate_graph` → Task 3 handler + Task 3 test ✓
- `get_file_symbols` → Task 3 handler + Task 3 test ✓
- `search_graph` → Task 3 handler + Task 3 test ✓
- `add_reflection` → Task 3 handler + Task 3 test ✓ (uses extended ReflectionManager from Task 2)
- `get_reflections` → Task 3 handler + Task 3 test ✓
- `code-graph mcp` CLI command → Task 4 ✓
- `.mcp.json` integration → Task 5 ✓
- `ReflectionManager.add(cwd?)` → Task 2 ✓
- Error handling (missing path, missing graph) → Task 3 handler try/catch + tests ✓

**Placeholder scan:** None found.

**Type consistency:**
- `handleGenerateGraph`, `handleGetFileSymbols`, `handleSearchGraph`, `handleAddReflection`, `handleGetReflections` — names consistent between export, `HANDLERS` map, and test imports ✓
- `ReflectionManager.add(category, lesson, cwd?)` — signature consistent between Task 2 definition and Task 3 usage in `handleAddReflection` and `handleGetReflections` tests ✓
- `CONFIG.MAP_FILE` and `CONFIG.REFLECTIONS_FILE` used throughout — both defined in `lib/config.js` ✓

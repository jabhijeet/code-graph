import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ReflectionManager } from '../lib/reflections.js';
import {
  handleGenerateGraph,
  handleGetFileSymbols,
  handleSearchGraph,
  handleAddReflection,
  handleGetReflections,
  handleGetProjectGraph,
  handleSearchSymbols,
  handleTraceDependencies,
  handleGetDependents,
} from '../lib/mcp-server.js';

// Helper: assert result is a structured MCP error with the given error_type
function assertMcpError(result, error_type) {
  assert.ok(result._mcpError, `expected _mcpError sentinel, got: ${JSON.stringify(result)}`);
  assert.strictEqual(result.error_type, error_type);
  assert.ok(typeof result.message === 'string' && result.message.length > 0);
}

const REFLECTIONS_FILE = 'llm-agent-project-learnings.md';

test('ReflectionManager.add writes to explicit cwd', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  try {
    await ReflectionManager.add('LOGIC', 'explicit cwd lesson', dir);
    const content = await readFile(join(dir, REFLECTIONS_FILE), 'utf8');
    assert.ok(content.includes('[LOGIC] explicit cwd lesson'), 'lesson not found in file');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('ReflectionManager.add defaults cwd to process.cwd() (backward compat)', async () => {
  // chdir into a temp dir: test files run in parallel processes, so touching the repo's
  // real learnings file races with other tests and leaks entries into it.
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-cwd-'));
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    await ReflectionManager.add('STYLE', 'backward compat test');
    const content = await readFile(join(dir, REFLECTIONS_FILE), 'utf8');
    assert.ok(content.includes('[STYLE] backward compat test'), 'lesson not written to process.cwd()');
  } finally {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  }
});

// Minimal synthetic graph content used for symbol/search tests
const FIXTURE_GRAPH = `# CODE_GRAPH
> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *lib/reflections.js (3↑ 1↓) | d: Manages project reflections and lessons learned.
  - s: [ReflectionManager, add [(category)]]
- lib/parser.js (1↑ 2↓) | d: Handles extraction of symbols and metadata.
  - s: [CodeParser, extract [(content)]]

## EDGES
[lib/reflections.js] -> [lib/config.js]
`;

// generate_graph — uses a real temp project so the mapper runs on actual files
test('handleGenerateGraph returns success with file count', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-gen-'));
  try {
    await writeFile(join(dir, 'package.json'), '{"name":"fixture","version":"1.0.0"}');
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'sample.js'), 'export function hello() { return 42; }');
    const result = await handleGenerateGraph({ project_path: dir });
    assert.strictEqual(result.success, true, JSON.stringify(result));
    assert.ok(typeof result.files_scanned === 'number' && result.files_scanned > 0);
    assert.strictEqual(result.map_file, 'llm-code-graph.md');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleGenerateGraph returns INVALID_PATH for nonexistent path', async () => {
  const result = await handleGenerateGraph({ project_path: join(tmpdir(), 'cg-nonexistent-' + Date.now()) });
  assertMcpError(result, 'INVALID_PATH');
});

// get_file_symbols — uses synthetic graph fixture, no live project dependency
test('handleGetFileSymbols returns symbols for lib/reflections.js', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-sym-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH);
    const result = await handleGetFileSymbols({ file_path: 'lib/reflections.js', project_path: dir });
    assert.ok(Array.isArray(result.symbols), JSON.stringify(result));
    assert.ok(result.symbols.length > 0);
    assert.ok(result.symbols.some(s => s.includes('ReflectionManager')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleGetFileSymbols returns structured error for unknown file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-sym-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH);
    const result = await handleGetFileSymbols({ file_path: 'lib/does-not-exist.js', project_path: dir });
    assertMcpError(result, 'FILE_NOT_IN_GRAPH');
    assert.strictEqual(result.retryable, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// search_graph — uses synthetic graph fixture
test('handleSearchGraph finds results for "reflect"', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-srch-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH);
    const result = await handleSearchGraph({ query: 'reflect', project_path: dir });
    assert.ok(Array.isArray(result.results), JSON.stringify(result));
    assert.ok(result.results.length > 0);
    assert.ok(result.results[0].file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleSearchGraph returns empty array for no match', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-srch-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH);
    const result = await handleSearchGraph({ query: 'xyzzy_nomatch_99999', project_path: dir });
    assert.ok(Array.isArray(result.results));
    assert.strictEqual(result.results.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// add_reflection
test('handleAddReflection writes lesson to temp dir', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  try {
    const result = await handleAddReflection({ category: 'STYLE', lesson: 'mcp handler test', project_path: dir });
    assert.strictEqual(result.success, true, JSON.stringify(result));
    assert.ok(result.entry.includes('STYLE'));
    assert.ok(result.entry.includes('mcp handler test'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// get_reflections
test('handleGetReflections returns all lessons', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  try {
    await ReflectionManager.add('ENV', 'lesson one', dir);
    await ReflectionManager.add('LOGIC', 'lesson two', dir);
    const result = await handleGetReflections({ project_path: dir });
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.lessons.length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleGetReflections filters by category', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  try {
    await ReflectionManager.add('ENV', 'env lesson', dir);
    await ReflectionManager.add('LOGIC', 'logic lesson', dir);
    const result = await handleGetReflections({ project_path: dir, category: 'ENV' });
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.lessons[0].category, 'ENV');
    assert.strictEqual(result.lessons[0].text, 'env lesson');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleGetReflections returns empty for missing file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-'));
  try {
    const result = await handleGetReflections({ project_path: dir });
    assert.strictEqual(result.total, 0);
    assert.deepStrictEqual(result.lessons, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── INVALID_PATH errors (shared across all handlers) ────────────────────────

test('handlers return INVALID_PATH for relative project_path', async () => {
  const result = await handleGetProjectGraph({ project_path: 'relative/path' });
  assertMcpError(result, 'INVALID_PATH');
});

test('handlers return INVALID_PATH for null project_path', async () => {
  const result = await handleSearchSymbols({ query: 'foo', project_path: null });
  assertMcpError(result, 'INVALID_PATH');
});

// ── Fixture with edges for dependency tracing ────────────────────────────────

const FIXTURE_GRAPH_EDGES = `# CODE_GRAPH
> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *lib/reflections.js (3↑ 1↓) | d: Manages project reflections and lessons learned.
  - s: [ReflectionManager, add [(category)]]
- lib/parser.js (1↑ 2↓) | d: Handles extraction of symbols and metadata.
  - s: [CodeParser, extract [(content)]]
- lib/config.js (0↑ 3↓) | d: Constants and config.
  - s: [CONFIG]

## EDGES
[lib/parser.js] -> [lib/config.js, lib/reflections.js]
[lib/reflections.js] -> [lib/config.js]
`;

// ── handleGetProjectGraph ────────────────────────────────────────────────────

test('handleGetProjectGraph returns raw graph content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-gpg-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH_EDGES);
    const result = await handleGetProjectGraph({ project_path: dir });
    assert.strictEqual(typeof result, 'string', 'expected raw string');
    assert.ok(result.includes('CODE_GRAPH'));
    assert.ok(result.includes('EDGES'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleGetProjectGraph returns GRAPH_NOT_FOUND when file missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-gpg-'));
  try {
    const result = await handleGetProjectGraph({ project_path: dir });
    assertMcpError(result, 'GRAPH_NOT_FOUND');
    assert.strictEqual(result.retryable, false);
    assert.ok(result.suggested_action);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleGetProjectGraph returns INVALID_PATH for null project_path', async () => {
  const result = await handleGetProjectGraph({ project_path: null });
  assertMcpError(result, 'INVALID_PATH');
});

// ── handleSearchSymbols ──────────────────────────────────────────────────────

test('handleSearchSymbols finds matching symbols', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-ss-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH_EDGES);
    const result = await handleSearchSymbols({ query: 'reflection', project_path: dir });
    assert.ok(Array.isArray(result.results), JSON.stringify(result));
    assert.ok(result.results.length > 0);
    assert.ok(result.results[0].file);
    assert.ok(Array.isArray(result.results[0].symbols));
    assert.strictEqual(result.total, result.results.length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleSearchSymbols returns empty results for no match', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-ss-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH_EDGES);
    const result = await handleSearchSymbols({ query: 'xyzzy_nomatch_99999', project_path: dir });
    assert.ok(Array.isArray(result.results));
    assert.strictEqual(result.total, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleSearchSymbols returns GRAPH_NOT_FOUND when graph missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-ss-'));
  try {
    const result = await handleSearchSymbols({ query: 'anything', project_path: dir });
    assertMcpError(result, 'GRAPH_NOT_FOUND');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── handleTraceDependencies ──────────────────────────────────────────────────

test('handleTraceDependencies returns outgoing and incoming deps', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-td-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH_EDGES);
    // lib/reflections.js imports config.js (outgoing) and is imported by parser.js (incoming)
    const result = await handleTraceDependencies({ file_path: 'lib/reflections.js', project_path: dir });
    assert.ok(Array.isArray(result.outgoing), JSON.stringify(result));
    assert.ok(Array.isArray(result.incoming));
    assert.ok(result.outgoing.some(d => d.file === 'lib/config.js'));
    assert.ok(result.incoming.some(d => d.file === 'lib/parser.js'));
    assert.strictEqual(result.blast_radius, result.incoming.length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleTraceDependencies returns empty arrays for file with no edges', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-td-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH_EDGES);
    const result = await handleTraceDependencies({ file_path: 'lib/unknown-file.js', project_path: dir });
    assert.deepStrictEqual(result.outgoing, []);
    assert.deepStrictEqual(result.incoming, []);
    assert.strictEqual(result.blast_radius, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleTraceDependencies returns GRAPH_NOT_FOUND when graph missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-td-'));
  try {
    const result = await handleTraceDependencies({ file_path: 'lib/any.js', project_path: dir });
    assertMcpError(result, 'GRAPH_NOT_FOUND');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleTraceDependencies normalizes Windows backslash paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-td-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH_EDGES);
    // Pass backslash path — should normalize to forward slash and still match
    const result = await handleTraceDependencies({ file_path: 'lib\\reflections.js', project_path: dir });
    assert.ok(result.outgoing.some(d => d.file === 'lib/config.js'), JSON.stringify(result));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Regression: symbol lists whose contexts contain brackets and commas ─────

const FIXTURE_GRAPH_RICH = `# CODE_GRAPH
TOKENS: ~100 (est.)

> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *index.js (2↑ 0↓) | d: CLI entry.
  - s: [installGitHook [(cwd)], main [()], execute [(platform, action)], printHelp [--- CLI ---], ... +3 more]

## EDGES
[index.js] -> [lib/a.js]
`;

test('markdown fallback parses every symbol even when contexts contain [] and commas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-rich-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH_RICH);
    const result = await handleGetFileSymbols({ file_path: 'index.js', project_path: dir });
    assert.deepEqual(result.symbols, ['installGitHook', 'main', 'execute', 'printHelp']);
    const search = await handleSearchSymbols({ query: 'print', project_path: dir });
    assert.deepEqual(search.results[0].symbols, ['printHelp']);
    const noise = await handleSearchSymbols({ query: 'action)', project_path: dir });
    assert.equal(noise.total, 0, 'context fragments must not appear as symbols');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handlers prefer llm-code-graph.json over markdown', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-json-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH_RICH);
    await writeFile(join(dir, 'llm-code-graph.json'), JSON.stringify({
      version: 'x',
      files: [{ path: 'only/in/json.js', core: false, out: 0, in: 0, desc: '', symbols: [{ name: 'jsonOnly', context: '' }], tags: [] }],
      imports: {},
      inheritance: []
    }));
    const result = await handleSearchSymbols({ query: 'jsonOnly', project_path: dir });
    assert.equal(result.total, 1);
    assert.equal(result.results[0].file, 'only/in/json.js');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generated JSON map round-trips through MCP handlers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-rt-'));
  try {
    await mkdir(join(dir, 'lib'));
    await writeFile(join(dir, 'lib', 'config.js'), 'export const CONFIG = {};\nexport function helper(a, b) {}');
    await writeFile(join(dir, 'lib', 'parser.js'), "import { CONFIG } from './config.js';\nexport class Parser {}");
    await writeFile(join(dir, 'index.js'), "import { Parser } from './lib/parser.js';\nexport async function main() {}");
    const gen = await handleGenerateGraph({ project_path: dir });
    assert.equal(gen.success, true, JSON.stringify(gen));
    assert.equal(gen.files_scanned, 3);

    const syms = await handleGetFileSymbols({ file_path: 'lib/config.js', project_path: dir });
    assert.deepEqual(syms.symbols.sort(), ['CONFIG', 'helper']);
    const mainSyms = await handleGetFileSymbols({ file_path: 'index.js', project_path: dir });
    assert.ok(!mainSyms.symbols.includes('function'), 'export async function must not yield a "function" symbol');

    const deps = await handleGetDependents({ file_path: 'lib/config.js', project_path: dir });
    assert.deepEqual(deps.dependents, [
      { file: 'lib/parser.js', distance: 1 },
      { file: 'index.js', distance: 2 }
    ]);
    const shallow = await handleGetDependents({ file_path: 'lib/config.js', project_path: dir, depth: 1 });
    assert.deepEqual(shallow.dependents.map(d => d.file), ['lib/parser.js']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleGetDependents handles import cycles', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-cyc-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), `# CODE_GRAPH\n\n- a.js (1↑ 1↓) | d: \n  - s: []\n- b.js (1↑ 1↓) | d: \n  - s: []\n\n## EDGES\n[a.js] -> [b.js]\n[b.js] -> [a.js]\n`);
    const result = await handleGetDependents({ file_path: 'a.js', project_path: dir, depth: 10 });
    assert.deepEqual(result.dependents, [{ file: 'b.js', distance: 1 }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handlers return INVALID_PATH when project_path is a file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-file-'));
  try {
    const filePath = join(dir, 'not-a-dir.txt');
    await writeFile(filePath, 'x');
    assertMcpError(await handleGenerateGraph({ project_path: filePath }), 'INVALID_PATH');
    assertMcpError(await handleSearchGraph({ query: 'x', project_path: filePath }), 'INVALID_PATH');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('handleAddReflection reports duplicates and rejects empty lessons', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-dup-'));
  try {
    const first = await handleAddReflection({ category: 'LOGIC', lesson: 'same lesson', project_path: dir });
    assert.equal(first.duplicate, false);
    const second = await handleAddReflection({ category: 'LOGIC', lesson: 'same lesson', project_path: dir });
    assert.equal(second.success, true);
    assert.equal(second.duplicate, true);
    assertMcpError(await handleAddReflection({ category: 'LOGIC', lesson: '   ', project_path: dir }), 'INVALID_INPUT');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ── Regression: stdout must carry only JSON-RPC frames ───────────────────────

test('MCP stdio server keeps generate_graph logs off stdout', async () => {
  const { spawn } = await import('node:child_process');
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-stdio-'));
  await writeFile(join(dir, 'a.js'), 'function a() {}');
  const child = spawn(process.execPath, [join(process.cwd(), 'index.js'), 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    let stdout = '';
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no response; stdout so far: ${stdout}`)), 20000);
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        if (stdout.includes('"id":2') && stdout.endsWith('\n')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'generate_graph', arguments: { project_path: dir } } });
    await response;

    const lines = stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line), `non-JSON line on stdout: ${line}`);
    }
    const reply = lines.map(l => JSON.parse(l)).find(m => m.id === 2);
    assert.ok(!reply.result.isError, JSON.stringify(reply));
  } finally {
    child.kill();
    await rm(dir, { recursive: true, force: true });
  }
});

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
  handleGetReflections
} from '../lib/mcp-server.js';

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
  const filePath = join(process.cwd(), REFLECTIONS_FILE);
  let backup = null;
  try {
    backup = await readFile(filePath, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  try {
    await ReflectionManager.add('STYLE', 'backward compat test');
    const content = await readFile(filePath, 'utf8');
    assert.ok(content.includes('[STYLE] backward compat test'), 'lesson not written to process.cwd()');
  } finally {
    if (backup !== null) {
      await writeFile(filePath, backup);
    } else {
      await unlink(filePath).catch(() => {});
    }
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

test('handleGenerateGraph returns error for nonexistent path', async () => {
  const result = await handleGenerateGraph({ project_path: join(tmpdir(), 'cg-nonexistent-' + Date.now()) });
  assert.ok(result.error, 'expected error field');
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

test('handleGetFileSymbols returns error for unknown file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-mcp-sym-'));
  try {
    await writeFile(join(dir, 'llm-code-graph.md'), FIXTURE_GRAPH);
    const result = await handleGetFileSymbols({ file_path: 'lib/does-not-exist.js', project_path: dir });
    assert.ok(result.error, 'expected error field');
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

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
import { CodeParser } from './parser.js';
import { ProjectMapper } from './mapper.js';
import { ReflectionManager } from './reflections.js';

const MAX_DEPENDENT_DEPTH = 10;

// ── Graph loading ─────────────────────────────────────────────────────────────

/** Split on commas that are not nested inside [] or (). */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '[' || ch === '(') depth++;
    else if ((ch === ']' || ch === ')') && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Parse a markdown map (written by versions without the JSON sidecar) into the JSON graph shape. */
export function parseMarkdownGraph(content) {
  const graph = { files: [], imports: {}, inheritance: [] };
  const [nodesPart, edgesPart = ''] = content.split('\n## EDGES');
  let current = null;

  for (const line of nodesPart.split('\n')) {
    if (line.startsWith('- ')) {
      const m = line.match(/^- (\*?)(.+?) \((\d+)↑ (\d+)↓\)(?: \[(.*)\])? \| d: ?(.*)$/);
      current = m
        ? { path: m[2], core: m[1] === '*', out: Number(m[3]), in: Number(m[4]), desc: m[6].trim(), symbols: [], tags: m[5] ? m[5].split(',') : [] }
        : { path: line.slice(2).split(/\s/)[0].replace(/^\*/, ''), core: false, out: 0, in: 0, desc: '', symbols: [], tags: [] };
      graph.files.push(current);
    } else if (current) {
      const s = line.match(/^\s+- s: \[(.*)\]\s*$/);
      if (s) {
        current.symbols = splitTopLevel(s[1])
          .filter(sym => sym && !/^\.\.\. \+\d+ more$/.test(sym))
          .map(sym => CodeParser.splitSymbol(sym));
      }
    }
  }

  for (const line of edgesPart.split('\n')) {
    const inh = line.match(/^\[(.+?)\] -> \[inherits\] -> \[(.+?)\]$/);
    if (inh) {
      graph.inheritance.push({ child: inh[1], parent: inh[2] });
      continue;
    }
    const imp = line.match(/^\[(.+?)\] -> \[(.*)\]$/);
    if (imp) graph.imports[imp[1]] = imp[2].split(',').map(t => t.trim()).filter(Boolean);
  }
  return graph;
}

/** Load the project graph, preferring the JSON sidecar. Throws ENOENT when neither file exists. */
async function loadGraph(project_path) {
  try {
    const data = JSON.parse(await fsp.readFile(path.join(project_path, CONFIG.MAP_JSON_FILE), 'utf8'));
    if (Array.isArray(data?.files)) return { imports: {}, inheritance: [], ...data };
  } catch (e) {
    if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
  }
  return parseMarkdownGraph(await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8'));
}

function graphNotFound(project_path) {
  return mcpError('GRAPH_NOT_FOUND', `Graph file not found at ${path.join(project_path, CONFIG.MAP_FILE)}`, { retryable: false, suggested_action: 'Run `code-graph generate` to build the graph first' });
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function validateProjectPath(project_path) {
  if (!project_path || typeof project_path !== 'string') return 'project_path is required';
  if (project_path.includes('\0')) return 'project_path contains invalid characters';
  if (!path.isAbsolute(project_path)) return 'project_path must be an absolute path';
  try {
    if (!(await fsp.stat(project_path)).isDirectory()) return 'project_path is not a directory';
  } catch {
    return 'project_path does not exist';
  }
  return null;
}

function mcpError(error_type, message, { retryable = false, suggested_action = null } = {}) {
  return { _mcpError: true, error_type, message, retryable, ...(suggested_action && { suggested_action }) };
}

function withTimeout(fn, ms) {
  let timer;
  return Promise.race([
    fn(),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject({ _mcpError: true, error_type: 'TOOL_TIMEOUT', message: `Operation exceeded ${ms}ms`, retryable: true, retry_after_seconds: 5 }), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Shared wrapper: validate the path, load the graph, map missing-graph and unexpected errors. */
async function withGraph(project_path, fn) {
  try {
    const pathErr = await validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    return fn(await loadGraph(project_path));
  } catch (err) {
    if (err.code === 'ENOENT') return graphNotFound(project_path);
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

const normalizeFile = (file_path) => String(file_path ?? '').replace(/\\/g, '/');

export async function handleGetProjectGraph({ project_path }) {
  try {
    const pathErr = await validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    return await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8'); // raw string — caller must not JSON.stringify
  } catch (err) {
    if (err.code === 'ENOENT') return graphNotFound(project_path);
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleSearchSymbols({ query, project_path, type }) {
  return withGraph(project_path, (graph) => {
    const lower = String(query ?? '').toLowerCase();
    const results = [];
    for (const f of graph.files) {
      const matched = f.symbols.map(s => s.name).filter(name => name.toLowerCase().includes(lower));
      if (matched.length > 0) results.push({ file: f.path, description: f.desc, symbols: matched });
    }
    return { query, type: type ?? 'all', results, total: results.length };
  });
}

export async function handleTraceDependencies({ file_path, project_path }) {
  return withGraph(project_path, (graph) => {
    const normalized = normalizeFile(file_path);
    const outgoing = (graph.imports[normalized] ?? []).map(t => ({ file: t, relation: 'imports' }));
    const incoming = Object.entries(graph.imports)
      .filter(([, targets]) => targets.includes(normalized))
      .map(([src]) => ({ file: src, relation: 'imports' }));
    for (const { child, parent } of graph.inheritance) {
      if (child === normalized) outgoing.push({ file: parent, relation: 'inherits' });
      if (parent === normalized) incoming.push({ file: child, relation: 'inherits' });
    }
    return { file: normalized, outgoing, incoming, blast_radius: incoming.length };
  });
}

export async function handleGetDependents({ file_path, project_path, depth }) {
  return withGraph(project_path, (graph) => {
    const normalized = normalizeFile(file_path);
    const maxDepth = Math.min(Math.max(Number.parseInt(depth ?? 3, 10) || 3, 1), MAX_DEPENDENT_DEPTH);

    const importers = {};
    for (const [src, targets] of Object.entries(graph.imports)) {
      for (const t of targets) (importers[t] ??= []).push(src);
    }

    const seen = new Map([[normalized, 0]]);
    let frontier = [normalized];
    for (let distance = 1; distance <= maxDepth && frontier.length; distance++) {
      const next = [];
      for (const file of frontier) {
        for (const src of importers[file] ?? []) {
          if (seen.has(src)) continue;
          seen.set(src, distance);
          next.push(src);
        }
      }
      frontier = next;
    }
    seen.delete(normalized);
    const dependents = [...seen].map(([file, distance]) => ({ file, distance }))
      .sort((a, b) => a.distance - b.distance || (a.file < b.file ? -1 : 1));
    return { file: normalized, depth: maxDepth, dependents, total: dependents.length };
  });
}

export async function handleGenerateGraph({ project_path }) {
  try {
    const pathErr = await validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    if (path.parse(path.resolve(project_path)).root === path.resolve(project_path)) {
      return mcpError('INVALID_PATH', 'Refusing to scan a filesystem root; pass a project directory');
    }
    const mapper = new ProjectMapper(project_path);
    await mapper.generate();
    return { success: true, files_scanned: mapper.files.length, map_file: CONFIG.MAP_FILE, json_file: CONFIG.MAP_JSON_FILE };
  } catch (err) {
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleGetFileSymbols({ file_path, project_path }) {
  return withGraph(project_path, (graph) => {
    const normalized = normalizeFile(file_path);
    const file = graph.files.find(f => f.path === normalized);
    if (!file) return mcpError('FILE_NOT_IN_GRAPH', `File not found in graph: ${file_path}`, { retryable: true, suggested_action: 'Run `code-graph generate` to refresh the graph, then retry' });
    return { file: file_path, symbols: file.symbols.map(s => s.name) };
  });
}

export async function handleSearchGraph({ query, project_path }) {
  return withGraph(project_path, (graph) => {
    const lower = String(query ?? '').toLowerCase();
    const results = [];
    for (const f of graph.files) {
      const symbols = f.symbols.map(s => s.name);
      const header = `${f.path} ${f.desc} ${(f.tags ?? []).join(' ')}`.toLowerCase();
      const score = (header.includes(lower) ? 1 : 0) + symbols.filter(s => s.toLowerCase().includes(lower)).length;
      if (score > 0) results.push({ file: f.path, description: f.desc, symbols, score });
    }
    return { query, results: results.sort((a, b) => b.score - a.score) };
  });
}

export async function handleAddReflection({ category, lesson, project_path }) {
  try {
    const pathErr = await validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    const result = await ReflectionManager.add(category, lesson, project_path);
    if (result.status === 'invalid') return mcpError('INVALID_INPUT', result.message);
    if (result.status === 'error') return mcpError('INTERNAL_ERROR', result.message);
    return { success: true, duplicate: result.status === 'duplicate', entry: result.entry.replace(/^- /, '') };
  } catch (err) {
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleGetReflections({ project_path, category }) {
  try {
    const pathErr = await validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
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
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

// ── MCP tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_project_graph',
    description: 'Read the full llm-code-graph.md for a project. Use INSTEAD of Read/Grep when exploring structure or understanding dependencies.',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: { type: 'string', description: 'Absolute path to the project directory' }
      },
      required: ['project_path']
    }
  },
  {
    name: 'search_symbols',
    description: 'Search for symbol names (functions, classes, variables) across the project graph. Returns matching symbols and their files.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol name or partial name (case-insensitive)' },
        project_path: { type: 'string', description: 'Absolute path to the project directory' },
        type: { type: 'string', enum: ['function', 'class', 'variable', 'all'], description: 'Symbol type filter (informational — graph does not store type metadata)' }
      },
      required: ['query', 'project_path']
    }
  },
  {
    name: 'trace_dependencies',
    description: 'Trace incoming and outgoing dependencies for a file. Use before editing to understand blast radius.',
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
    name: 'get_dependents',
    description: 'List files that import a file directly or transitively, with their distance. Use to find the full blast radius of a change.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Relative file path as in the graph (e.g. lib/config.js)' },
        project_path: { type: 'string', description: 'Absolute path to the project directory' },
        depth: { type: 'integer', minimum: 1, maximum: MAX_DEPENDENT_DEPTH, description: 'Maximum import hops to follow (default 3)' }
      },
      required: ['file_path', 'project_path']
    }
  },
  {
    name: 'generate_graph',
    description: 'Build or refresh llm-code-graph.md (and llm-code-graph.json) for a project directory.',
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
  get_project_graph:   handleGetProjectGraph,
  search_symbols:      handleSearchSymbols,
  trace_dependencies:  handleTraceDependencies,
  get_dependents:      handleGetDependents,
  generate_graph:      handleGenerateGraph,
  get_file_symbols:    handleGetFileSymbols,
  search_graph:        handleSearchGraph,
  add_reflection:      handleAddReflection,
  get_reflections:     handleGetReflections,
};

// ── Server entry point ────────────────────────────────────────────────────────

export async function startMcpServer() {
  // stdout carries JSON-RPC frames. The mapper and reflection code log progress with console.log,
  // which would corrupt the protocol stream, so all console output goes to stderr in this process.
  console.log = console.error;
  console.info = console.error;
  console.debug = console.error;

  const server = new Server(
    { name: 'code-graph', version: CONFIG.VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = HANDLERS[name];
    if (!handler) {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error_type: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}`, retryable: false }) }] };
    }
    const timeoutMs = name === 'generate_graph' ? 300_000 : 30_000;
    try {
      const result = await withTimeout(() => handler(args ?? {}), timeoutMs);
      if (result?._mcpError) {
        const { _mcpError, ...errData } = result;
        return { isError: true, content: [{ type: 'text', text: JSON.stringify(errData) }] };
      }
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      if (err?._mcpError) {
        const { _mcpError, ...errData } = err;
        return { isError: true, content: [{ type: 'text', text: JSON.stringify(errData) }] };
      }
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error_type: 'INTERNAL_ERROR', message: err.message ?? String(err), retryable: false }) }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

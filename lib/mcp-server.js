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

function validateProjectPath(project_path) {
  if (!project_path) return 'project_path is required';
  if (project_path.includes('\0')) return 'project_path contains invalid characters';
  if (!path.isAbsolute(project_path)) return 'project_path must be an absolute path';
  return null;
}

function mcpError(error_type, message, { retryable = false, suggested_action = null } = {}) {
  return { _mcpError: true, error_type, message, retryable, ...(suggested_action && { suggested_action }) };
}

function withTimeout(fn, ms) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject({ _mcpError: true, error_type: 'TOOL_TIMEOUT', message: `Operation exceeded ${ms}ms`, retryable: true, retry_after_seconds: 5 }), ms)
    ),
  ]);
}

export async function handleGetProjectGraph({ project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    const content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    return content; // raw string — caller must not JSON.stringify
  } catch (err) {
    if (err.code === 'ENOENT') return mcpError('GRAPH_NOT_FOUND', `Graph file not found at ${path.join(project_path, CONFIG.MAP_FILE)}`, { retryable: false, suggested_action: 'Run `code-graph generate` to build the graph first' });
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleSearchSymbols({ query, project_path, type }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    const content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    const lower = query.toLowerCase();
    const results = [];
    let current = null;

    for (const line of content.split('\n')) {
      if (line.startsWith('## EDGES')) break;
      if (line.startsWith('- ') && !line.startsWith('  ')) {
        const fileMatch = line.match(/^- \*?([^\s(|]+)/);
        const descMatch = line.match(/d:\s*(.+)/);
        current = { file: fileMatch?.[1]?.trim() ?? '', description: descMatch?.[1]?.trim() ?? '', symbols: [] };
      } else if (current && line.includes('s: [')) {
        const match = line.match(/s:\s*\[([^\]]+)\]/);
        if (match) {
          const matched = match[1].split(',').map(s => s.trim().split(' ')[0]).filter(s => s && s.toLowerCase().includes(lower));
          if (matched.length > 0) results.push({ file: current.file, description: current.description, symbols: matched });
        }
        current = null;
      }
    }
    return { query, type: type ?? 'all', results, total: results.length };
  } catch (err) {
    if (err.code === 'ENOENT') return mcpError('GRAPH_NOT_FOUND', `Graph file not found at ${path.join(project_path, CONFIG.MAP_FILE)}`, { retryable: false, suggested_action: 'Run `code-graph generate` to build the graph first' });
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleTraceDependencies({ file_path, project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    let content;
    try {
      content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return mcpError('GRAPH_NOT_FOUND', `Graph file not found at ${path.join(project_path, CONFIG.MAP_FILE)}`, { retryable: false, suggested_action: 'Run `code-graph generate` to build the graph first' });
      throw e;
    }
    const edgesSection = content.split('## EDGES')[1] ?? '';
    const normalized = file_path.replace(/\\/g, '/');
    const outgoing = [];
    const incoming = [];

    for (const line of edgesSection.split('\n')) {
      if (!line.trim() || !line.includes('->')) continue;
      const inheritMatch = line.match(/^\[(.+?)\] -> \[inherits\] -> \[(.+?)\]$/);
      if (inheritMatch) {
        if (inheritMatch[1] === normalized) outgoing.push({ file: inheritMatch[2], relation: 'inherits' });
        if (inheritMatch[2] === normalized) incoming.push({ file: inheritMatch[1], relation: 'inherits' });
        continue;
      }
      const importMatch = line.match(/^\[(.+?)\] -> \[(.+)\]$/);
      if (importMatch) {
        const targets = importMatch[2].split(',').map(t => t.trim());
        if (importMatch[1] === normalized) targets.forEach(t => outgoing.push({ file: t, relation: 'imports' }));
        if (targets.includes(normalized)) incoming.push({ file: importMatch[1], relation: 'imports' });
      }
    }
    return { file: normalized, outgoing, incoming, blast_radius: incoming.length };
  } catch (err) {
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleGenerateGraph({ project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    const mapper = new ProjectMapper(project_path);
    await mapper.generate();
    const content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    const files_scanned = (content.match(/^- \S/gm) ?? []).length;
    return { success: true, files_scanned, map_file: CONFIG.MAP_FILE };
  } catch (err) {
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleGetFileSymbols({ file_path, project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    const content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    let inEntry = false;
    for (const line of content.split('\n')) {
      if (!inEntry && line.startsWith('- ') && line.match(new RegExp(`(?:^|\\s)\\*?${file_path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|\\(|$)`))) {
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
        if (line.startsWith('- ') && !line.startsWith('  ')) {
          return { file: file_path, symbols: [] };
        }
      }
    }
    if (inEntry) return { file: file_path, symbols: [] };
    return mcpError('FILE_NOT_IN_GRAPH', `File not found in graph: ${file_path}`, { retryable: true, suggested_action: 'Run `code-graph generate` to refresh the graph, then retry' });
  } catch (err) {
    if (err.code === 'ENOENT') return mcpError('GRAPH_NOT_FOUND', `Graph file not found at ${path.join(project_path, CONFIG.MAP_FILE)}`, { retryable: false, suggested_action: 'Run `code-graph generate` to build the graph first' });
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleSearchGraph({ query, project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
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
        }
      }
    }
    if (current?.score > 0) results.push(current);
    return { query, results: results.sort((a, b) => b.score - a.score) };
  } catch (err) {
    if (err.code === 'ENOENT') return mcpError('GRAPH_NOT_FOUND', `Graph file not found at ${path.join(project_path, CONFIG.MAP_FILE)}`, { retryable: false, suggested_action: 'Run `code-graph generate` to build the graph first' });
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleAddReflection({ category, lesson, project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return mcpError('INVALID_PATH', pathErr);
    const cat = String(category ?? 'GENERAL').replace(/[^\w-]/g, '').slice(0, 20).toUpperCase() || 'GENERAL';
    const cleanLesson = String(lesson).replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
    if (!cleanLesson) return mcpError('INVALID_INPUT', 'lesson cannot be empty after sanitization');
    await ReflectionManager.add(cat, cleanLesson, project_path);
    return { success: true, entry: `[${cat}] ${cleanLesson}` };
  } catch (err) {
    return mcpError('INTERNAL_ERROR', err.message);
  }
}

export async function handleGetReflections({ project_path, category }) {
  try {
    const pathErr = validateProjectPath(project_path);
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
  get_project_graph:   handleGetProjectGraph,
  search_symbols:      handleSearchSymbols,
  trace_dependencies:  handleTraceDependencies,
  generate_graph:      handleGenerateGraph,
  get_file_symbols:    handleGetFileSymbols,
  search_graph:        handleSearchGraph,
  add_reflection:      handleAddReflection,
  get_reflections:     handleGetReflections,
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

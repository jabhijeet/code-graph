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

export async function handleGenerateGraph({ project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return { error: pathErr };
    const mapper = new ProjectMapper(project_path);
    await mapper.generate();
    const content = await fsp.readFile(path.join(project_path, CONFIG.MAP_FILE), 'utf8');
    const files_scanned = (content.match(/^- \S/gm) ?? []).length;
    return { success: true, files_scanned, map_file: CONFIG.MAP_FILE };
  } catch (err) {
    return { error: err.message };
  }
}

export async function handleGetFileSymbols({ file_path, project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return { error: pathErr };
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
        // New top-level entry started — file was found but has no symbols
        if (line.startsWith('- ') && !line.startsWith('  ')) {
          return { file: file_path, symbols: [] };
        }
      }
    }
    // End of file reached
    if (inEntry) return { file: file_path, symbols: [] };
    return { error: `File not found in graph: ${file_path}. Run generate_graph first.` };
  } catch (err) {
    if (err.code === 'ENOENT') return { error: 'No graph found. Run generate_graph first.' };
    return { error: err.message };
  }
}

export async function handleSearchGraph({ query, project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return { error: pathErr };
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
    if (err.code === 'ENOENT') return { error: 'No graph found. Run generate_graph first.' };
    return { error: err.message };
  }
}

export async function handleAddReflection({ category, lesson, project_path }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return { error: pathErr };
    const cat = String(category ?? 'GENERAL').replace(/[^\w-]/g, '').slice(0, 20).toUpperCase() || 'GENERAL';
    const cleanLesson = String(lesson).replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
    if (!cleanLesson) return { error: 'lesson cannot be empty' };
    // ReflectionManager.add handles dedup and sanitization internally
    await ReflectionManager.add(cat, cleanLesson, project_path);
    return { success: true, entry: `[${cat}] ${cleanLesson}` };
  } catch (err) {
    return { error: err.message };
  }
}

export async function handleGetReflections({ project_path, category }) {
  try {
    const pathErr = validateProjectPath(project_path);
    if (pathErr) return { error: pathErr };
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

/**
 * @file lib/mapper.js
 * @description Manages the project mapping and file generation.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import ignore from 'ignore';
import { CONFIG } from './config.js';
import { CodeParser } from './parser.js';

export class ProjectMapper {
  constructor(cwd) {
    this.cwd = cwd;
    this.files = [];
    this.allEdges = [];
    this.incomingEdges = {};
  }

  async getIgnores(dir, baseIg) {
    const ig = ignore().add(baseIg);
    const ignorePath = path.join(dir, CONFIG.IGNORE_FILE);
    try {
      const content = await fsp.readFile(ignorePath, 'utf8');
      ig.add(content);
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn(`[Code-Graph] Warning: unreadable ${ignorePath}: ${e.message}`);
    }
    return ig;
  }

  async walk(dir, ig, depth = 0) {
    if (depth > CONFIG.MAX_WALK_DEPTH) {
      console.warn(`[Code-Graph] Max walk depth reached, skipping: ${path.relative(this.cwd, dir)}`);
      return;
    }

    if (depth <= 1) {
      const label = path.relative(this.cwd, dir) || '.';
      console.log(`[Code-Graph] Scanning: ${label}`);
    }

    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'EACCES' || e.code === 'EPERM') {
        console.warn(`[Code-Graph] Skipping unreadable dir: ${dir}`);
        return;
      }
      throw e;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(this.cwd, fullPath).replace(/\\/g, '/');
      if (relPath.startsWith('..')) continue;
      const checkPath = entry.isDirectory() ? `${relPath}/` : relPath;

      if (ig.ignores(checkPath)) continue;

      if (entry.isDirectory()) {
        await this.walk(fullPath, await this.getIgnores(fullPath, ig), depth + 1);
      } else if (entry.isFile() && CONFIG.SUPPORTED_EXTENSIONS.includes(path.extname(entry.name))) {
        await this.processFile(fullPath, relPath);
      }
    }
  }

  async processFile(fullPath, relPath) {
    let stats;
    try {
      stats = await fsp.stat(fullPath);
    } catch (e) {
      console.warn(`[Code-Graph] Skipping unreadable file ${relPath}: ${e.message}`);
      return;
    }
    if (stats.size > CONFIG.MAX_FILE_BYTES) {
      console.warn(`[Code-Graph] Skipping large file (${stats.size} bytes): ${relPath}`);
      return;
    }

    let content;
    try {
      content = await fsp.readFile(fullPath, 'utf8');
    } catch (e) {
      console.warn(`[Code-Graph] Failed to read ${relPath}: ${e.message}`);
      return;
    }

    const { symbols, inheritance, edges, tags } = CodeParser.extract(content);

    const isCore = /^(index|main|app|server|cli)\./i.test(path.basename(relPath));
    const fileObj = { path: relPath, symbols, tags, isCore, outCount: edges.length, desc: this.extractFileDesc(content, symbols.length) };

    this.files.push(fileObj);
    if (this.files.length % 25 === 0) {
      console.log(`[Code-Graph] Processed ${this.files.length} files...`);
    }
    await this.processEdges(relPath, edges, inheritance);
  }

  extractFileDesc(content, symCount) {
    const lines = content.split('\n').slice(0, 15);
    let desc = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { if (desc) break; else continue; }
      if (trimmed.startsWith('#!')) continue;
      if (/^(\/\/|\/\*|\*|#|"""?)/.test(trimmed)) {
        const clean = trimmed
          .replace(/^(?:\/\/+|\/\*+|\*+|#+|"""?)\s?/, '')
          .replace(/\*+\/\s*$/, '')
          .trim();
        if (clean) desc += clean + ' ';
      } else if (desc) break;
    }
    return desc.trim() || (symCount > 0 ? `Contains ${symCount} symbols.` : '');
  }

  async processEdges(relPath, edges, inheritance) {
    for (const dep of edges) {
      let target = dep;
      if (dep.startsWith('.')) {
        const resolved = path.normalize(path.join(path.dirname(relPath), dep)).replace(/\\/g, '/');
        target = await this.resolveExtension(resolved);
      }
      this.allEdges.push(`[${relPath}] -> [imports] -> [${target}]`);
      this.incomingEdges[target] = (this.incomingEdges[target] || 0) + 1;
    }
    inheritance.forEach(inh => this.allEdges.push(`[${inh.child}] -> [inherits] -> [${inh.parent}]`));
  }

  async resolveExtension(target) {
    if (path.extname(target)) return target;
    for (const ext of CONFIG.SUPPORTED_EXTENSIONS) {
      try {
        await fsp.access(path.join(this.cwd, target + ext));
        return target + ext;
      } catch (e) {
        // File doesn't exist with this extension, try next
      }
    }
    return target;
  }

  async generate() {
    const start = Date.now();
    const t = () => `+${((Date.now() - start) / 1000).toFixed(1)}s`;
    console.log(`[Code-Graph v${CONFIG.VERSION}] Starting map generation...`);
    console.log(`[Code-Graph] Root: ${this.cwd}`);

    await this.walk(this.cwd, await this.getIgnores(this.cwd, CONFIG.DEFAULT_IGNORES));

    console.log(`[Code-Graph] Scan complete (${t()}): ${this.files.length} files, ${this.allEdges.length} edges found.`);

    console.log(`[Code-Graph] Sorting ${this.files.length} files by importance...`);
    this.files.sort((a, b) => (b.isCore - a.isCore) || ((this.incomingEdges[b.path] || 0) - (this.incomingEdges[a.path] || 0)));
    console.log(`[Code-Graph] Sort complete (${t()}).`);

    console.log(`[Code-Graph] Formatting nodes...`);
    const output = this.formatOutput(t);
    console.log(`[Code-Graph] Format complete (${t()}): ${output.length} chars.`);

    console.log(`[Code-Graph] Writing ${CONFIG.MAP_FILE}...`);
    await fsp.writeFile(path.join(this.cwd, CONFIG.MAP_FILE), output);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[Code-Graph] Done in ${elapsed}s — ${CONFIG.MAP_FILE} updated (${this.files.length} files, ${this.allEdges.length} edges).`);
  }

  formatOutput(t = () => '') {
    const header = `# CODE_GRAPH\nMISSION: COMPACT PROJECT MAP FOR LLM AGENTS.\nPROTOCOL: Follow llm-agent-rules.md\nMEMORY: See llm-agent-project-learnings.md\n\n> Legend: * core, (↑out ↓in deps), s: symbols, d: desc\n\n`;

    console.log(`[Code-Graph] Building node list (${this.files.length} files)...`);
    const nodes = this.files.map(f => {
      const inCount = this.incomingEdges[f.path] || 0;
      const tags = this.compactList(f.tags, CONFIG.MAX_TAGS_PER_FILE);
      const symbols = this.compactList(f.symbols, CONFIG.MAX_SYMBOLS_PER_FILE);
      const tagText = tags.length ? ` [${tags.join(',')}]` : '';
      return `- ${f.isCore ? '*' : ''}${f.path} (${f.outCount}↑ ${inCount}↓)${tagText} | d: ${f.desc.substring(0, CONFIG.MAX_DESC_CHARS)}\n  - s: [${symbols.join(', ')}]`;
    }).join('\n');
    console.log(`[Code-Graph] Nodes built (${t()}).`);

    console.log(`[Code-Graph] Grouping ${this.allEdges.length} edges...`);
    const groupedEdges = {};
    const inheritanceEdges = [];
    this.allEdges.forEach(e => {
      const match = e.match(/\[(.*?)\] -> \[imports\] -> \[(.*?)\]/);
      if (match) {
        const [_, src, target] = match;
        if (!groupedEdges[src]) groupedEdges[src] = new Set();
        groupedEdges[src].add(target);
        return;
      }
      const inheritance = e.match(/\[(.*?)\] -> \[inherits\] -> \[(.*?)\]/);
      if (inheritance) {
        inheritanceEdges.push(`[${inheritance[1]}] -> [inherits] -> [${inheritance[2]}]`);
      }
    });
    console.log(`[Code-Graph] Edges grouped: ${Object.keys(groupedEdges).length} import sources, ${inheritanceEdges.length} inheritance (${t()}).`);

    console.log(`[Code-Graph] Sorting edge lines...`);
    const edgeLines = [
      ...Object.entries(groupedEdges).map(([src, targets]) => `[${src}] -> [${Array.from(targets).join(', ')}]`),
      ...inheritanceEdges
    ].sort();
    console.log(`[Code-Graph] Edge lines sorted: ${edgeLines.length} total (${t()}).`);

    const edges = edgeLines.length
      ? `\n\n## EDGES\n${edgeLines.join('\n')}`
      : '';

    return header + nodes + edges;
  }

  compactList(items, limit) {
    if (!Array.isArray(items) || items.length <= limit) return items || [];
    return [...items.slice(0, limit), `... +${items.length - limit} more`];
  }
}

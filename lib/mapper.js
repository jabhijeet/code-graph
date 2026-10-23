/**
 * @file lib/mapper.js
 * @description Manages the project mapping and file generation.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import ignore from 'ignore';
import { CONFIG } from './config.js';
import { CodeParser } from './parser.js';
import { TreeSitterParser } from './treesitter.js';

const CORE_FILE = /^(index|main|app|server|cli)\.[^.]+$/i;
// Source written as `./x.js` may live on disk as `./x.ts` (TS ESM convention).
const TS_SWAPS = { '.js': ['.ts', '.tsx'], '.jsx': ['.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };

export class ProjectMapper {
  /**
   * @param {string} cwd Project root.
   * @param {{ maxTokens?: number, useCache?: boolean }} [options]
   *   maxTokens: trim lowest-ranked files from the markdown map to fit this estimated budget.
   *   useCache: reuse parse results for files whose mtime and size are unchanged.
   */
  constructor(cwd, { maxTokens = 0, useCache = true } = {}) {
    this.cwd = cwd;
    this.maxTokens = maxTokens;
    this.useCache = useCache;
    this.files = [];
    this.allEdges = [];
    this.incomingEdges = {};
    this._extCache = new Map();
    this.FILE_TIMEOUT_MS = 5000;
    this._scanStart = null;
    this._skipped = [];
    this._abandoned = new Set();
    this._cache = {};
    this._nextCache = {};
    this._pathAliases = [];
  }

  _elapsed() {
    if (!this._scanStart) return '';
    return ` +${((Date.now() - this._scanStart) / 1000).toFixed(1)}s`;
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
      console.log(`[Code-Graph] Scanning: ${label}${this._elapsed()}`);
    } else if (depth <= 4) {
      const indent = '  '.repeat(depth - 1);
      const label = path.relative(this.cwd, dir) || '.';
      console.log(`[Code-Graph] Scanning: ${indent}${label}${this._elapsed()}`);
    }

    let entries;
    try {
      const readdirTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('READDIR_TIMEOUT')), 8000)
      );
      entries = await Promise.race([fsp.readdir(dir, { withFileTypes: true }), readdirTimeout]);
    } catch (e) {
      if (e.message === 'READDIR_TIMEOUT') {
        const rel = path.relative(this.cwd, dir);
        console.error(`[Code-Graph] ERROR: readdir timeout (>8s)${this._elapsed()}, skipping dir: ${rel}`);
        this._skipped.push({ reason: 'readdir-timeout', path: rel });
        return;
      }
      if (e.code === 'EACCES' || e.code === 'EPERM') {
        console.error(`[Code-Graph] ERROR: permission denied, skipping dir: ${dir}`);
        this._skipped.push({ reason: 'permission', path: dir });
        return;
      }
      console.error(`[Code-Graph] ERROR: unexpected error reading dir: ${dir} — ${e.message}`);
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
      } else if (entry.isFile() && CONFIG.SUPPORTED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        await this.processFileWithTimeout(fullPath, relPath);
      }
    }
  }

  async processFileWithTimeout(fullPath, relPath) {
    console.log(`[Code-Graph] Processing: ${relPath}${this._elapsed()}`);
    let timeoutTimer;
    const tickIntervalMs = 2000;
    const tickers = [];

    const timeout = new Promise((_, reject) => {
      timeoutTimer = setTimeout(() => reject(new Error('FILE_TIMEOUT')), this.FILE_TIMEOUT_MS);
      for (let ms = tickIntervalMs; ms < this.FILE_TIMEOUT_MS; ms += tickIntervalMs) {
        tickers.push(setTimeout(() => {
          console.warn(`[Code-Graph] Still processing (${ms / 1000}s)${this._elapsed()}: ${relPath}`);
        }, ms));
      }
    });
    try {
      await Promise.race([this.processFile(fullPath, relPath), timeout]);
    } catch (e) {
      if (e.message === 'FILE_TIMEOUT') {
        // The losing processFile() keeps running; mark it so its late result is discarded.
        this._abandoned.add(relPath);
        console.error(`[Code-Graph] ERROR: file timeout (>${this.FILE_TIMEOUT_MS}ms)${this._elapsed()}, skipping: ${relPath}`);
        this._skipped.push({ reason: 'file-timeout', path: relPath });
      } else {
        console.error(`[Code-Graph] ERROR: exception processing ${relPath} — ${e.message}`);
        this._skipped.push({ reason: 'exception', path: relPath, error: e.message });
        throw e;
      }
    } finally {
      clearTimeout(timeoutTimer);
      tickers.forEach(t => clearTimeout(t));
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
      console.error(`[Code-Graph] ERROR: skipping oversized file (${Math.round(stats.size / 1024)}KB): ${relPath}`);
      this._skipped.push({ reason: 'oversized', path: relPath });
      return;
    }

    const cached = this._cache[relPath];
    let result;
    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      result = cached.result;
    } else {
      let content;
      try {
        content = await fsp.readFile(fullPath, 'utf8');
      } catch (e) {
        console.warn(`[Code-Graph] Failed to read ${relPath}: ${e.message}`);
        return;
      }
      result = await this.parseContent(content, relPath);
    }
    if (this._abandoned.has(relPath)) return;

    this._nextCache[relPath] = { mtimeMs: stats.mtimeMs, size: stats.size, result };
    if (result.noParse) {
      console.error(`[Code-Graph] WARNING: skipping parse on large file (>${Math.round(CONFIG.MAX_PARSE_BYTES / 1024)}KB): ${relPath}`);
      this._skipped.push({ reason: 'large-no-parse', path: relPath });
    }

    const isCore = CORE_FILE.test(path.basename(relPath));
    this.files.push({ path: relPath, symbols: result.symbols, tags: result.tags, isCore, outCount: result.edges.length, desc: result.desc, parser: result.parser });
    if (this.files.length % 25 === 0) {
      console.log(`[Code-Graph] Processed ${this.files.length} files...`);
    }
    await this.processEdges(relPath, result.edges, result.inheritance);
  }

  /**
   * Pure parse step; its result is what the incremental cache stores.
   * Uses tree-sitter when a grammar exists for the extension, otherwise the regex parser.
   */
  async parseContent(content, relPath) {
    if (content.length > CONFIG.MAX_PARSE_BYTES) {
      return { symbols: [], inheritance: [], edges: [], tags: [], desc: this.extractFileDesc(content, 0), noParse: true, parser: 'none' };
    }
    const parseStart = Date.now();
    const tree = await TreeSitterParser.extract(content, path.extname(relPath));
    const { symbols, inheritance, edges, tags } = tree ?? CodeParser.extract(content);
    const parseMs = Date.now() - parseStart;
    if (parseMs > 2000) {
      console.warn(`[Code-Graph] Slow parse (${parseMs}ms): ${relPath}`);
    }
    return { symbols, inheritance, edges, tags, desc: this.extractFileDesc(content, symbols.length), parser: tree ? 'tree-sitter' : 'regex' };
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
      const target = await this.resolveImport(relPath, dep);
      this.allEdges.push(`[${relPath}] -> [imports] -> [${target}]`);
      this.incomingEdges[target] = (this.incomingEdges[target] || 0) + 1;
    }
    inheritance.forEach(inh => this.allEdges.push(`[${inh.child}] -> [inherits] -> [${inh.parent}]`));
  }

  /** Map an import specifier to a project-relative file path; external packages are returned unchanged. */
  async resolveImport(fromRel, dep) {
    if (dep.startsWith('.')) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), dep));
      return (await this.resolveCandidate(base)).path;
    }
    for (const alias of this._pathAliases) {
      const star = alias.matches(dep);
      if (star === null) continue;
      for (const target of alias.targets) {
        const resolved = await this.resolveCandidate(target.replace('*', star));
        if (resolved.exists) return resolved.path;
      }
    }
    return dep;
  }

  async resolveCandidate(base) {
    if (this._extCache.has(base)) return this._extCache.get(base);
    const ext = path.extname(base);
    const candidates = [
      base,
      ...(TS_SWAPS[ext.toLowerCase()] || []).map(e => base.slice(0, -ext.length) + e),
      ...CONFIG.SUPPORTED_EXTENSIONS.map(e => base + e),
      ...CONFIG.SUPPORTED_EXTENSIONS.map(e => `${base}/index${e}`)
    ];
    let result = { path: base, exists: false };
    for (const candidate of candidates) {
      if (await this.isFile(candidate)) {
        result = { path: candidate, exists: true };
        break;
      }
    }
    this._extCache.set(base, result);
    return result;
  }

  async isFile(relPath) {
    try {
      return (await fsp.stat(path.join(this.cwd, relPath))).isFile();
    } catch {
      return false;
    }
  }

  /** Read `compilerOptions.paths` from tsconfig.json / jsconfig.json at the project root. */
  async loadPathAliases() {
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      let raw;
      try {
        raw = await fsp.readFile(path.join(this.cwd, name), 'utf8');
      } catch {
        continue;
      }
      let options;
      try {
        const json = CodeParser.stripJsonComments(raw).replace(/,(\s*[}\]])/g, '$1');
        options = JSON.parse(json).compilerOptions ?? {};
      } catch (e) {
        console.warn(`[Code-Graph] Warning: could not parse ${name} for path aliases: ${e.message}`);
        return [];
      }
      const baseUrl = options.baseUrl ?? '.';
      return Object.entries(options.paths ?? {}).map(([pattern, targets]) => {
        const [prefix, suffix = ''] = pattern.split('*');
        const hasStar = pattern.includes('*');
        return {
          matches: (spec) => {
            if (!hasStar) return spec === pattern ? '' : null;
            if (!spec.startsWith(prefix) || !spec.endsWith(suffix) || spec.length < prefix.length + suffix.length) return null;
            return spec.slice(prefix.length, spec.length - suffix.length);
          },
          targets: (Array.isArray(targets) ? targets : []).map(t => path.posix.normalize(path.posix.join(baseUrl.replace(/\\/g, '/'), t)))
        };
      });
    }
    return [];
  }

  async loadCache() {
    if (!this.useCache) return {};
    try {
      const data = JSON.parse(await fsp.readFile(path.join(this.cwd, CONFIG.CACHE_FILE), 'utf8'));
      // Parser output changes between releases, so a cache from another version is discarded.
      return data?.version === CONFIG.VERSION && data.files && typeof data.files === 'object' ? data.files : {};
    } catch {
      return {};
    }
  }

  async saveCache() {
    if (!this.useCache) return;
    try {
      await fsp.writeFile(path.join(this.cwd, CONFIG.CACHE_FILE), JSON.stringify({ version: CONFIG.VERSION, files: this._nextCache }));
    } catch (e) {
      console.warn(`[Code-Graph] Warning: could not write ${CONFIG.CACHE_FILE}: ${e.message}`);
    }
  }

  /** Scan the project and return the rendered outputs without writing them. */
  async build() {
    const start = Date.now();
    this._scanStart = start;
    const t = () => `+${((Date.now() - start) / 1000).toFixed(1)}s`;
    console.log(`[Code-Graph v${CONFIG.VERSION}] Starting map generation...`);
    console.log(`[Code-Graph] Root: ${this.cwd}`);

    this._cache = await this.loadCache();
    this._pathAliases = await this.loadPathAliases();

    const heartbeat = setInterval(() => {
      console.log(`[Code-Graph] Still scanning... (${t()}, ${this.files.length} files so far)`);
    }, 5000);

    try {
      await this.walk(this.cwd, await this.getIgnores(this.cwd, CONFIG.DEFAULT_IGNORES));
    } finally {
      clearInterval(heartbeat);
    }

    console.log(`[Code-Graph] Scan complete (${t()}): ${this.files.length} files, ${this.allEdges.length} edges found.`);
    const byParser = this.files.reduce((acc, f) => ({ ...acc, [f.parser]: (acc[f.parser] || 0) + 1 }), {});
    console.log(`[Code-Graph] Parsers: ${byParser['tree-sitter'] || 0} tree-sitter, ${byParser.regex || 0} regex, ${byParser.none || 0} unparsed.`);

    console.log(`[Code-Graph] Sorting ${this.files.length} files by importance...`);
    // Path tiebreak keeps output independent of readdir order, so `check` and diffs are stable.
    this.files.sort((a, b) =>
      (b.isCore - a.isCore)
      || ((this.incomingEdges[b.path] || 0) - (this.incomingEdges[a.path] || 0))
      || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    console.log(`[Code-Graph] Sort complete (${t()}).`);

    console.log(`[Code-Graph] Formatting nodes...`);
    const markdown = this.formatOutput(t);
    const json = this.formatJson();
    console.log(`[Code-Graph] Format complete (${t()}): ${markdown.length} chars.`);

    if (this._skipped.length > 0) {
      console.error(`[Code-Graph] WARNINGS: ${this._skipped.length} file(s) skipped:`);
      for (const s of this._skipped) {
        const detail = s.error ? ` (${s.error})` : '';
        console.error(`  [${s.reason}] ${s.path}${detail}`);
      }
    }
    return { markdown, json, elapsed: ((Date.now() - start) / 1000).toFixed(1) };
  }

  async generate() {
    const { markdown, json, elapsed } = await this.build();

    console.log(`[Code-Graph] Writing ${CONFIG.MAP_FILE} and ${CONFIG.MAP_JSON_FILE}...`);
    await fsp.writeFile(path.join(this.cwd, CONFIG.MAP_FILE), markdown);
    await fsp.writeFile(path.join(this.cwd, CONFIG.MAP_JSON_FILE), json);
    await this.saveCache();

    console.log(`[Code-Graph] Done in ${elapsed}s — ${CONFIG.MAP_FILE} updated (${this.files.length} files, ${this.allEdges.length} edges).`);
  }

  /**
   * Compare freshly built outputs against the files on disk.
   * @returns {Promise<{ upToDate: boolean, stale: string[] }>}
   */
  async check() {
    const { markdown, json } = await this.build();
    const stale = [];
    for (const [file, expected] of [[CONFIG.MAP_FILE, markdown], [CONFIG.MAP_JSON_FILE, json]]) {
      let actual = null;
      try {
        actual = await fsp.readFile(path.join(this.cwd, file), 'utf8');
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      // git autocrlf may rewrite line endings on checkout; that is not staleness.
      if (actual === null || actual.replace(/\r\n/g, '\n') !== expected) stale.push(file);
    }
    await this.saveCache();
    return { upToDate: stale.length === 0, stale };
  }

  groupEdges() {
    const imports = {};
    const inheritance = [];
    this.allEdges.forEach(e => {
      const match = e.match(/^\[(.*?)\] -> \[imports\] -> \[(.*?)\]$/);
      if (match) {
        const [, src, target] = match;
        if (!imports[src]) imports[src] = new Set();
        imports[src].add(target);
        return;
      }
      const inh = e.match(/^\[(.*?)\] -> \[inherits\] -> \[(.*?)\]$/);
      if (inh) inheritance.push({ child: inh[1], parent: inh[2] });
    });
    return { imports, inheritance };
  }

  formatOutput(t = () => '') {
    const header = `# CODE_GRAPH\nMISSION: COMPACT PROJECT MAP FOR LLM AGENTS.\nPROTOCOL: Follow llm-agent-rules.md\nMEMORY: See llm-agent-project-learnings.md\n`;
    const legend = `\n> Legend: * core, (↑out ↓in deps), s: symbols, d: desc\n\n`;

    console.log(`[Code-Graph] Building node list (${this.files.length} files)...`);
    const nodes = this.files.map(f => {
      const inCount = this.incomingEdges[f.path] || 0;
      const tags = this.compactList(f.tags, CONFIG.MAX_TAGS_PER_FILE);
      const symbols = this.compactList(f.symbols, CONFIG.MAX_SYMBOLS_PER_FILE);
      const tagText = tags.length ? ` [${tags.join(',')}]` : '';
      return `- ${f.isCore ? '*' : ''}${f.path} (${f.outCount}↑ ${inCount}↓)${tagText} | d: ${f.desc.substring(0, CONFIG.MAX_DESC_CHARS)}\n  - s: [${symbols.join(', ')}]`;
    });
    console.log(`[Code-Graph] Nodes built (${t()}).`);

    console.log(`[Code-Graph] Grouping ${this.allEdges.length} edges...`);
    const { imports, inheritance } = this.groupEdges();
    const importLine = (src) => `[${src}] -> [${Array.from(imports[src]).join(', ')}]`;
    const inheritLines = inheritance.map(i => `[${i.child}] -> [inherits] -> [${i.parent}]`);
    console.log(`[Code-Graph] Edges grouped: ${Object.keys(imports).length} import sources, ${inheritLines.length} inheritance (${t()}).`);

    // Token budget: keep files in importance order (with their import line) until the estimate is exceeded.
    let keptNodes = nodes;
    let keptSources = Object.keys(imports);
    let keptInherit = inheritLines;
    let omitted = 0;
    if (this.maxTokens > 0) {
      let budget = this.maxTokens * 4 - header.length - legend.length - 200;
      keptNodes = [];
      keptSources = [];
      for (let i = 0; i < this.files.length; i++) {
        const src = this.files[i].path;
        const cost = nodes[i].length + 1 + (imports[src] ? importLine(src).length + 1 : 0);
        if (cost > budget) break;
        budget -= cost;
        keptNodes.push(nodes[i]);
        if (imports[src]) keptSources.push(src);
      }
      omitted = this.files.length - keptNodes.length;
      keptInherit = [];
      for (const line of inheritLines) {
        if (line.length + 1 > budget) break;
        budget -= line.length + 1;
        keptInherit.push(line);
      }
    }

    console.log(`[Code-Graph] Sorting edge lines...`);
    const edgeLines = [...keptSources.map(importLine), ...keptInherit].sort();
    console.log(`[Code-Graph] Edge lines sorted: ${edgeLines.length} total (${t()}).`);

    const omittedNote = omitted > 0 ? `\n\n> OMITTED: ${omitted} lower-ranked file(s) to fit --max-tokens ${this.maxTokens}. Full data: ${CONFIG.MAP_JSON_FILE}` : '';
    const edges = edgeLines.length ? `\n\n## EDGES\n${edgeLines.join('\n')}` : '';
    const body = keptNodes.join('\n') + omittedNote + edges;
    const tokens = Math.ceil((header.length + legend.length + body.length + 20) / 4);

    return `${header}TOKENS: ~${tokens} (est.)\n${legend}${body}`;
  }

  /** Machine-readable graph for MCP tools and other consumers; uncapped, unlike the markdown map. */
  formatJson() {
    const { imports, inheritance } = this.groupEdges();
    const data = {
      version: CONFIG.VERSION,
      files: this.files.map(f => ({
        path: f.path,
        core: f.isCore,
        out: f.outCount,
        in: this.incomingEdges[f.path] || 0,
        desc: f.desc,
        parser: f.parser,
        symbols: f.symbols.map(s => CodeParser.splitSymbol(s)),
        tags: f.tags
      })),
      imports: Object.fromEntries(Object.keys(imports).sort().map(src => [src, Array.from(imports[src])])),
      inheritance: inheritance
        .map(i => ({ ...i, key: `${i.child}\0${i.parent}` }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map(({ child, parent }) => ({ child, parent }))
    };
    return JSON.stringify(data, null, 2) + '\n';
  }

  compactList(items, limit) {
    if (!Array.isArray(items) || items.length <= limit) return items || [];
    return [...items.slice(0, limit), `... +${items.length - limit} more`];
  }
}

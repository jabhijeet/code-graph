#!/usr/bin/env node

/**
 * @file index.js
 * @description Compact, language-agnostic codebase mapper for LLM token efficiency.
 * Features: Symbol extraction, dependency mapping, reflection logging, and git hooks.
 */

import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import ignore from 'ignore';

// --- Constants & Configuration ---

const __filename = fileURLToPath(import.meta.url);
export const CONFIG = {
  IGNORE_FILE: '.gitignore',
  MAP_FILE: 'llm-code-graph.md',
  REFLECTIONS_FILE: 'PROJECT_REFLECTIONS.md',
  RULES_FILE: 'AGENT_RULES.md',
  SUPPORTED_EXTENSIONS: [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', 
    '.cpp', '.c', '.h', '.hpp', '.cc', '.rb', '.php', '.swift', 
    '.kt', '.cs', '.dart', '.scala', '.m', '.mm'
  ],
  DEFAULT_IGNORES: [
    '.git/', 'node_modules/', 'package-lock.json', '.idea/', 
    'build/', 'dist/', 'bin/', 'obj/', '.dart_tool/', '.pub-cache/', '.pub/'
  ]
};

export const SUPPORTED_EXTENSIONS = CONFIG.SUPPORTED_EXTENSIONS;

const REGEX = {
  SYMBOLS: [
    // Types, Classes, Interfaces with Inheritance
    /\b(?:class|interface|type|struct|enum|protocol|extension|trait|module|namespace|object)\s+([a-zA-Z_]\w*)(?:[^\n\S]*(?:extends|implements|:|(?:\())[^\n\S]*([a-zA-Z_]\w*(?:[^\n\S]*,\s*[a-zA-Z_]\w*)*)\)?)?/g,
    // Functions
    /\b(?:function|def|fn|func|fun|method|procedure|sub|routine)\s+([a-zA-Z_]\w*)/g,
    // Method/Var Declarations (C-style, Java)
    /\b(?:void|async|public|private|protected|static|final|native|synchronized|abstract|transient|volatile)\s+(?:[\w<>[\]]+\s+)?([a-zA-Z_]\w*)(?=\s*\([^)]*\)\s*(?:\{|=>|;|=))/g,
    // Annotations
    /(@[a-zA-Z_]\w*(?:\([^)]*\))?)\s*(?:(?:public|private|protected|static|final|abstract|class|interface|enum|void|[\w<>[\]]+)\s+)+([a-zA-Z_]\w*)/g,
    // Exports
    /\bexport\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum|async|val)\s+([a-zA-Z_]\w*)/g
  ],
  EDGES: [
    /\b(?:import|from|include|require|using)\s*(?:[\(\s])\s*['"]?([@\w\.\/\-]+)['"]?/g,
    /#include\s+[<"]([\w\.\/\-]+)[>"]/g
  ],
  TAGS: /\b(TODO|FIXME|BUG|DEPRECATED):?\s*(.*)/i,
  KEYWORDS: new Set(['if', 'for', 'while', 'switch', 'return', 'await', 'yield', 'const', 'new', 'let', 'var', 'class', 'void', 'public', 'private', 'protected'])
};

// --- Core Services ---

/**
 * Handles extraction of symbols, edges, and metadata from source code.
 */
class CodeParser {
  static extract(content) {
    const noComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const cleanContent = noComments.replace(/['"`](?:\\.|[^'"`])*['"`]/g, ''); // Remove strings for symbol extraction

    const { symbols, inheritance } = this.extractSymbols(content, cleanContent);
    const edges = this.extractEdges(noComments); // Edges need strings (import paths)
    const tags = this.extractTags(content);

    return { symbols, inheritance, edges, tags };
  }

  static extractSymbols(original, clean) {
    const symbols = new Set();
    const inheritance = [];

    for (const regex of REGEX.SYMBOLS) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(clean)) !== null) {
        let name = match[1];
        let annotation = name.startsWith('@') ? name : '';
        if (annotation) name = match[2] || '';
        
        if (!name || REGEX.KEYWORDS.has(name)) continue;

        if (!annotation && match[2]) {
          match[2].split(',').forEach(p => inheritance.push({ child: name, parent: p.trim() }));
        }

        const context = this.findSymbolContext(original, name);
        const display = annotation ? `${annotation} ${name}` : name;
        symbols.add(context ? `${display} [${context}]` : display);
      }
    }
    return { symbols: Array.from(symbols).sort(), inheritance };
  }

  static findSymbolContext(content, name) {
    const pos = content.search(new RegExp(`\\b${name}\\b`));
    if (pos === -1) return '';

    const linesBefore = content.substring(0, pos).split('\n');
    let comment = '';
    for (let i = linesBefore.length - 2; i >= 0; i--) {
      const line = linesBefore[i].trim();
      if (/^(\/\/|\*|"""|#|\/\*)/.test(line)) {
        const clean = line.replace(/[\/*#"]/g, '').trim();
        if (clean) comment = clean + (comment ? ' ' + comment : '');
        if (comment.length > 100) break;
      } else if (line !== '' && !line.startsWith('@')) break;
    }

    if (!comment) {
      const remaining = content.substring(pos + name.length);
      const sigMatch = remaining.match(/^\s*(\([^)]*\)|[^\n{;]*)/);
      return sigMatch?.[1].trim() || '';
    }
    return comment;
  }

  static extractEdges(clean) {
    const deps = new Set();
    for (const regex of REGEX.EDGES) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(clean)) !== null) {
        if (match[1] && match[1].length > 1) deps.add(match[1]);
      }
    }
    return Array.from(deps).sort();
  }

  static extractTags(content) {
    const tags = new Set();
    content.split('\n').forEach(line => {
      const match = line.match(REGEX.TAGS);
      if (match) tags.add(`${match[1]}: ${match[2].substring(0, 50).trim()}`);
    });
    return Array.from(tags);
  }
}

/**
 * Manages the project mapping and file generation.
 */
class ProjectMapper {
  constructor(cwd) {
    this.cwd = cwd;
    this.files = [];
    this.allEdges = [];
    this.incomingEdges = {};
  }

  getIgnores(dir, baseIg) {
    const ig = ignore().add(baseIg);
    const ignorePath = path.join(dir, CONFIG.IGNORE_FILE);
    if (fs.existsSync(ignorePath)) {
      ig.add(fs.readFileSync(ignorePath, 'utf8'));
    }
    return ig;
  }

  async walk(dir, ig) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(this.cwd, fullPath).replace(/\\/g, '/');
      const checkPath = entry.isDirectory() ? `${relPath}/` : relPath;

      if (ig.ignores(checkPath)) continue;

      if (entry.isDirectory()) {
        await this.walk(fullPath, this.getIgnores(fullPath, ig));
      } else if (CONFIG.SUPPORTED_EXTENSIONS.includes(path.extname(entry.name))) {
        await this.processFile(fullPath, relPath);
      }
    }
  }

  async processFile(fullPath, relPath) {
    const content = await fsp.readFile(fullPath, 'utf8');
    const { symbols, inheritance, edges, tags } = CodeParser.extract(content);

    const isCore = /^(index|main|app|server|cli)\./i.test(path.basename(relPath));
    const fileObj = { path: relPath, symbols, tags, isCore, outCount: edges.length, desc: this.extractFileDesc(content, symbols.length) };
    
    this.files.push(fileObj);
    this.processEdges(relPath, edges, inheritance);
  }

  extractFileDesc(content, symCount) {
    const lines = content.split('\n').slice(0, 10);
    let desc = '';
    for (const line of lines) {
      if (/^(\/\/|#|\/\*)/.test(line.trim())) desc += line.replace(/[\/*#]/g, '').trim() + ' ';
      else if (desc) break;
    }
    return desc.trim() || (symCount > 0 ? `Contains ${symCount} symbols.` : '');
  }

  processEdges(relPath, edges, inheritance) {
    edges.forEach(dep => {
      let target = dep;
      if (dep.startsWith('.')) {
        const resolved = path.normalize(path.join(path.dirname(relPath), dep)).replace(/\\/g, '/');
        target = this.resolveExtension(resolved);
      }
      this.allEdges.push(`[${relPath}] -> [imports] -> [${target}]`);
      this.incomingEdges[target] = (this.incomingEdges[target] || 0) + 1;
    });
    inheritance.forEach(inh => this.allEdges.push(`[${inh.child}] -> [inherits] -> [${inh.parent}]`));
  }

  resolveExtension(target) {
    if (path.extname(target)) return target;
    for (const ext of CONFIG.SUPPORTED_EXTENSIONS) {
      if (fs.existsSync(path.join(this.cwd, target + ext))) return target + ext;
    }
    return target;
  }

  async generate() {
    console.log(`[Code-Graph] Mapping ${this.cwd}...`);
    await this.walk(this.cwd, this.getIgnores(this.cwd, CONFIG.DEFAULT_IGNORES));

    this.files.sort((a, b) => (b.isCore - a.isCore) || ((this.incomingEdges[b.path] || 0) - (this.incomingEdges[a.path] || 0)));

    const output = this.formatOutput();
    await fsp.writeFile(path.join(this.cwd, CONFIG.MAP_FILE), output);
    console.log(`[Code-Graph] Updated ${CONFIG.MAP_FILE}`);
  }

  formatOutput() {
    const header = `# CODE_GRAPH_MAP\n> MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.\n> PROTOCOL: Follow AGENT_RULES.md | MEMORY: See PROJECT_REFLECTIONS.md\n> Legend: [CORE] Entry Point, (↑N) Outgoing Deps, (↓M) Incoming Dependents\n> Notation: syms: [Name [Signature/Context]], desc: File Summary, [TAG: Context]\n\n`;
    const nodes = this.files.map(f => {
      const inCount = this.incomingEdges[f.path] || 0;
      const tags = f.tags.length ? ` [${f.tags.join(', ')}]` : '';
      return `- ${f.isCore ? '[CORE] ' : ''}${f.path} (↑${f.outCount} ↓${inCount})${tags} | desc: ${f.desc.substring(0, 100)}\n  - syms: [${f.symbols.join(', ')}]`;
    }).join('\n');
    const edges = this.allEdges.length ? `\n\n## GRAPH EDGES\n${Array.from(new Set(this.allEdges)).sort().join('\n')}` : '';
    return header + nodes + edges;
  }
}

/**
 * Manages project reflections and lessons learned.
 */
class ReflectionManager {
  static async add(category, lesson) {
    if (!lesson) return console.error('[Code-Graph] Usage: reflect <cat> <lesson>');
    
    const filePath = path.join(process.cwd(), CONFIG.REFLECTIONS_FILE);
    const header = `# PROJECT_REFLECTIONS & LESSONS LEARNED\n> LLM AGENT MEMORY: READ BEFORE STARTING TASKS. UPDATE ON FAILURES.\n`;
    const entry = `- [${category.toUpperCase()}: ${new Date().toISOString().split('T')[0]}] ${lesson}`;

    try {
      let content = fs.existsSync(filePath) ? await fsp.readFile(filePath, 'utf8') : header;
      if (!fs.existsSync(filePath)) await fsp.writeFile(filePath, header);

      if (content.toLowerCase().includes(lesson.toLowerCase().trim())) {
        return console.log('[Code-Graph] Reflection already exists.');
      }

      await fsp.appendFile(filePath, `\n${entry}`);
      console.log(`[Code-Graph] Recorded reflection: ${lesson}`);
    } catch (err) {
      console.error(`[Code-Graph] Reflection failed: ${err.message}`);
    }
  }
}

/**
 * Scaffolds the initial agent-agnostic rule and reflection files.
 */
class ProjectInitializer {
  static async init(cwd) {
    const rulesPath = path.join(cwd, CONFIG.RULES_FILE);
    const reflectPath = path.join(cwd, CONFIG.REFLECTIONS_FILE);

    const rulesContent = `# AGENT OPERATIONAL PROTOCOL (STRICT)
> This protocol is MANDATORY for all LLM agents. Failure to update memory is a failure of the task.

## 🧠 THE REFLECTION CYCLE
1. **PRE-TASK:** Read \`${CONFIG.REFLECTIONS_FILE}\` to identify existing pitfalls.
2. **EXECUTION:** Monitor for "Learned Moments" (failures, corrections, or discoveries).
3. **POST-TASK:** Immediately run \`code-graph reflect <CAT> <LESSON>\` for any discovery. 

## 📝 REFLECTION CATEGORIES
- \`LOGIC\`: Code bugs or complex regex pitfalls.
- \`ENV\`: OS compatibility or shell behaviors.
- \`DEP\`: Library bugs or version deprecations.
- \`STYLE\`: Project-specific architectural rules.
`;

    const reflectContent = `# PROJECT_REFLECTIONS & LESSONS LEARNED\n> LLM AGENT MEMORY: READ BEFORE STARTING TASKS. UPDATE ON FAILURES.\n`;

    try {
      if (!fs.existsSync(rulesPath)) {
        await fsp.writeFile(rulesPath, rulesContent);
        console.log(`[Code-Graph] Initialized ${CONFIG.RULES_FILE}`);
      }
      if (!fs.existsSync(reflectPath)) {
        await fsp.writeFile(reflectPath, reflectContent);
        console.log(`[Code-Graph] Initialized ${CONFIG.REFLECTIONS_FILE}`);
      }
    } catch (err) {
      console.error(`[Code-Graph] Initialization failed: ${err.message}`);
    }
  }
}

// --- CLI Entry Point ---

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const cwd = process.cwd();

  try {
    switch (command || 'generate') {
      case 'generate':
        await new ProjectMapper(cwd).generate();
        break;
      case 'init':
        await ProjectInitializer.init(cwd);
        break;
      case 'reflect':
        await ReflectionManager.add(args[0], args.slice(1).join(' '));
        break;
      case 'install-hook':
        await ProjectInitializer.init(cwd);
        await installGitHook(cwd);
        break;
      case 'watch':
        startWatcher(cwd);
        break;
      default:
        console.log('Usage: code-graph [generate|init|reflect|install-hook|watch]');
    }
  } catch (err) {
    console.error(`[Code-Graph] Critical Error: ${err.message}`);
    process.exit(1);
  }
}

async function installGitHook(cwd) {
  const hookPath = path.join(cwd, '.git', 'hooks', 'pre-commit');
  if (!fs.existsSync(path.dirname(hookPath))) return console.error('[Code-Graph] No .git directory found.');

  const content = `#!/bin/sh
# Code-Graph Advisory: Map Sync & Reflection Reminder
echo "[Code-Graph] Validating commit..."

# 1. Regenerate Map
node "${__filename}" generate
git add "${CONFIG.MAP_FILE}"

# 2. Reflection Advisory
# Notify if code changed but reflections didn't (Soft Nudge)
CODE_CHANGES=$(git diff --cached --name-only | grep -E "\\.(${CONFIG.SUPPORTED_EXTENSIONS.map(e => e.slice(1)).join('|')})$")
REFLECT_CHANGES=$(git diff --cached --name-only | grep "${CONFIG.REFLECTIONS_FILE}")

if [ ! -z "$CODE_CHANGES" ] && [ -z "$REFLECT_CHANGES" ]; then
  echo "--------------------------------------------------------"
  echo "ℹ️  [Code-Graph] ADVISORY: Reflection Check"
  echo "Significant code changes detected without a reflection."
  echo "If you learned something new or fixed a non-obvious bug,"
  echo "run 'code-graph reflect LOGIC <lesson>' before committing."
  echo "--------------------------------------------------------"
fi
`;
  await fsp.writeFile(hookPath, content, { mode: 0o755 });
  console.log('[Code-Graph] Pre-commit Advisory installed (Soft Enforcement).');
}

function startWatcher(cwd) {
  console.log(`[Code-Graph] Watching ${cwd}...`);
  let timer;
  chokidar.watch(cwd, { ignoreInitial: true, ignored: [/node_modules/, /\.git/, new RegExp(CONFIG.MAP_FILE)] })
    .on('all', () => {
      clearTimeout(timer);
      timer = setTimeout(() => new ProjectMapper(cwd).generate(), 1000);
    });
}

if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('index.js'))) {
  main();
}

export { CodeParser, ProjectMapper, ReflectionManager };

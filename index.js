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
import os from 'os';
import chokidar from 'chokidar';
import ignore from 'ignore';

// --- Constants & Configuration ---

const __filename = fileURLToPath(import.meta.url);
export const CONFIG = {
  IGNORE_FILE: '.gitignore',
  MAP_FILE: 'llm-code-graph.md',
  REFLECTIONS_FILE: 'llm-agent-project-learnings.md',
  RULES_FILE: 'llm-agent-rules.md',
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
    const header = `# CODE_GRAPH\nMISSION: COMPACT PROJECT MAP FOR LLM AGENTS.\nPROTOCOL: Follow llm-agent-rules.md\nMEMORY: See llm-agent-project-learnings.md\n\n> Legend: * core, (↑out ↓in deps), s: symbols, d: desc\n\n`;
    const nodes = this.files.map(f => {
      const inCount = this.incomingEdges[f.path] || 0;
      const tags = f.tags.length ? ` [${f.tags.join(',')}]` : '';
      return `- ${f.isCore ? '*' : ''}${f.path} (${f.outCount}↑ ${inCount}↓)${tags} | d: ${f.desc.substring(0, 80)}\n  - s: [${f.symbols.join(', ')}]`;
    }).join('\n');

    // Group edges by source for density
    const groupedEdges = {};
    this.allEdges.forEach(e => {
      const match = e.match(/\[(.*?)\] -> \[imports\] -> \[(.*?)\]/);
      if (match) {
        const [_, src, target] = match;
        if (!groupedEdges[src]) groupedEdges[src] = new Set();
        groupedEdges[src].add(target);
      }
    });

    const edges = Object.keys(groupedEdges).length 
      ? `\n\n## EDGES\n${Object.entries(groupedEdges).map(([src, targets]) => `[${src}] -> [${Array.from(targets).join(', ')}]`).sort().join('\n')}`
      : '';
    
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
    const header = `# LLM_LEARNINGS\n> READ BEFORE TASKS. UPDATE ON FAILURES.\n`;
    const entry = `- [${category.toUpperCase()}] ${lesson}`;

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

    const rulesContent = `# LLM_AGENT_RULES (STRICT PROTOCOL)
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

    const reflectContent = `# LLM_AGENT_PROJECT_LEARNINGS\n> LLM AGENT MEMORY: READ BEFORE STARTING TASKS. UPDATE ON FAILURES.\n`;

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

/**
 * Manages platform-specific skills and agent integrations.
 */
class SkillManager {
  constructor(cwd) {
    this.cwd = cwd;
    this.home = os.homedir();
  }

  async execute(platform, action, skill) {
    if (!platform) return console.error('[Code-Graph] Platform required. Usage: code-graph install-skills <platform> [projectmap|reflections]');
    const p = platform.toLowerCase();
    const act = (action || 'install-skills').toLowerCase();
    const s = (skill || 'all').toLowerCase();

    if (act === 'install-skills') await this.install(p, s);
    else if (act === 'uninstall-skills') await this.uninstall(p, s);
    else console.error(`[Code-Graph] Unknown action: ${act}. Use install-skills or uninstall-skills.`);
  }

  async install(p, s) {
    console.log(`[Code-Graph] Running install-skills (${s}) for ${p}...`);
    try {
      if (s === 'all' || s === 'projectmap') await this.installProjectMap(p);
      if (s === 'all' || s === 'reflections') await this.installReflections(p);
      console.log(`[Code-Graph] Successfully completed install-skills for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] install-skills failed for ${p}: ${err.message}`);
    }
  }

  async installProjectMap(p) {
    const section = `\n## 🗺️ Skill: ProjectMap\nBefore answering architecture questions, read \`${CONFIG.MAP_FILE}\` for god nodes and structural context. This ensures high-level awareness before searching raw files.\n`;
    const skillContent = `# ProjectMap Skill\nUse \`${CONFIG.MAP_FILE}\` for project navigation and architectural awareness.\n`;

    switch (p) {
      case 'claude':
        await this.appendToFile('CLAUDE.md', section);
        await this.writeJson('.claude/settings.json', { hooks: { preToolUse: [{ tools: ['glob', 'grep'], message: `Skill(ProjectMap): Knowledge graph exists. Read ${CONFIG.MAP_FILE} before searching raw files.` }] } });
        break;
      case 'cursor':
        await this.writeFile('.cursor/rules/projectmap.mdc', `---\ndescription: Use knowledge graph for navigation.\nalwaysApply: true\n---\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` to locate core logic and dependencies.\n`);
        break;
      case 'gemini':
        const geminiSkill = `---\nname: projectmap\ndescription: Use knowledge graph for navigation.\n---\n${skillContent}`;
        await this.installGlobalSkill('gemini', 'projectmap', geminiSkill);
        await this.appendToFile('GEMINI.md', `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${section}`);
        break;
      case 'codex':
        await this.appendToFile('AGENTS.md', section);
        await this.writeJson('.codex/hooks.json', { hooks: { preToolUse: [{ tools: ['bash'], message: `Skill(ProjectMap): Read ${CONFIG.MAP_FILE} for architectural context.` }] } });
        break;
      case 'opencode':
        await this.appendToFile('AGENTS.md', section);
        await this.writeFile('.opencode/plugins/projectmap.js', `export default { name: 'projectmap', beforeExecute: (t) => { if (t.name === 'bash') return "Read ${CONFIG.MAP_FILE} for god nodes."; } };`);
        await this.writeJson('opencode.json', { plugins: ['./.opencode/plugins/projectmap.js'] });
        break;
      case 'antigravity':
        await this.writeFile('.agent/rules/projectmap.md', `# ProjectMap\nAlways read \`${CONFIG.MAP_FILE}\`.\n`);
        await this.writeFile('.agent/workflows/projectmap.md', `# ProjectMap Workflow\nRegisters /projectmap to refresh graph.\n`);
        break;
      case 'kiro':
        await this.installGlobalSkill('kiro', 'projectmap', skillContent);
        await this.writeFile('.kiro/steering/projectmap.md', `inclusion: always\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\`.\n`);
        break;
      case 'intellij':
        await this.appendToFile('AGENTS.md', section);
        break;
      case 'copilot':
        await this.installGlobalSkill('copilot', 'projectmap', skillContent);
        break;
      case 'vscode':
        await this.appendToFile('.github/copilot-instructions.md', section);
        break;
      case 'roocode':
        await this.appendToFile('.clinerules', section);
        await this.appendToFile('.roorules', section);
        break;
      default:
        await this.appendToFile('AGENTS.md', section);
        await this.installGlobalSkill(p, 'projectmap', skillContent);
    }
  }

  async installReflections(p) {
    const section = `\n## 🧠 Skill: Reflections\nFollow the reflection cycle: Read \`${CONFIG.REFLECTIONS_FILE}\` for past lessons and run \`code-graph reflect\` after any bug fix or failure.\n`;
    const skillContent = `# Reflections Skill\nUse \`${CONFIG.REFLECTIONS_FILE}\` to persist and retrieve project-specific lessons and environment quirks.\n`;

    switch (p) {
      case 'claude':
        await this.appendToFile('CLAUDE.md', section);
        break;
      case 'cursor':
        await this.writeFile('.cursor/rules/reflections.mdc', `---\ndescription: Mandatory reflection cycle.\nalwaysApply: true\n---\n# Reflections\nFollow \`${CONFIG.RULES_FILE}\`. Update \`${CONFIG.REFLECTIONS_FILE}\` after every fix.\n`);
        break;
      case 'gemini':
        const geminiReflect = `---\nname: reflections\ndescription: Mandatory reflection cycle.\n---\n${skillContent}`;
        await this.installGlobalSkill('gemini', 'reflections', geminiReflect);
        await this.appendToFile('GEMINI.md', section);
        break;
      case 'antigravity':
        await this.writeFile('.agent/rules/reflections.md', `# Reflections\nFollow the reflection cycle in \`${CONFIG.RULES_FILE}\`.\n`);
        break;
      case 'kiro':
        await this.installGlobalSkill('kiro', 'reflections', skillContent);
        break;
      case 'copilot':
        await this.installGlobalSkill('copilot', 'reflections', skillContent);
        break;
      case 'vscode':
        await this.appendToFile('.github/copilot-instructions.md', section);
        break;
      case 'roocode':
        const rules = `\n# Reflections Protocol\nStrictly follow the reflection cycle in \`${CONFIG.RULES_FILE}\`. Persist lessons to \`${CONFIG.REFLECTIONS_FILE}\`.\n`;
        await this.appendToFile('.clinerules', rules);
        await this.appendToFile('.roorules', rules);
        break;
      default:
        await this.appendToFile('AGENTS.md', section);
        await this.installGlobalSkill(p, 'reflections', skillContent);
    }
  }

  async installGlobalSkill(platform, skillName, content) {
    const skillPath = path.join(this.home, `.${platform}`, 'skills', skillName, 'SKILL.md');
    try {
      await fsp.mkdir(path.dirname(skillPath), { recursive: true });
      await fsp.writeFile(skillPath, content);
    } catch (e) {
      // Ignore errors for platforms that don't support global skills
    }
  }

  async uninstall(p, s) {
    console.log(`[Code-Graph] Running uninstall-skills (${s}) for ${p}...`);
    try {
      const skillsDir = (platform) => path.join(this.home, `.${platform}`, 'skills');

      if (s === 'all' || s === 'projectmap') {
        await this.removeFile('.cursor/rules/projectmap.mdc');
        await this.removeFile('.agent/rules/projectmap.md');
        await this.removeFile('.agent/workflows/projectmap.md');
        await this.removeFile('.kiro/steering/projectmap.md');
        await this.removeFile('.opencode/plugins/projectmap.js');
        await fsp.rm(path.join(skillsDir(p), 'projectmap'), { recursive: true, force: true });
      }
      
      if (s === 'all' || s === 'reflections') {
        await this.removeFile('.cursor/rules/reflections.mdc');
        await this.removeFile('.agent/rules/reflections.md');
        await fsp.rm(path.join(skillsDir(p), 'reflections'), { recursive: true, force: true });
      }

      if (s === 'all') {
        const filesToRemove = [
          'CLAUDE.md', 'GEMINI.md', 'AGENTS.md', '.clinerules', '.roomodes', '.roorules',
          '.github/copilot-instructions.md', 'opencode.json'
        ];
        for (const f of filesToRemove) await this.removeFile(f);
        
        // Defensive folder cleanup
        const folders = ['.claude', '.gemini', '.codex', '.opencode', '.agent', '.kiro'];
        for (const f of folders) {
          const fullPath = path.join(this.cwd, f);
          if (fs.existsSync(fullPath) && (await fsp.readdir(fullPath)).length === 0) {
            await fsp.rmdir(fullPath);
          }
        }
      }
      
      console.log(`[Code-Graph] Successfully completed uninstall-skills for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] uninstall-skills failed for ${p}: ${err.message}`);
    }
  }

  async appendToFile(filename, content) {
    const fullPath = path.join(this.cwd, filename);
    if (fs.existsSync(fullPath)) {
      const existing = await fsp.readFile(fullPath, 'utf8');
      if (!existing.includes(content.trim())) await fsp.appendFile(fullPath, content);
    } else {
      await fsp.writeFile(fullPath, content);
    }
  }

  async writeFile(filename, content) {
    const fullPath = path.join(this.cwd, filename);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, content);
  }

  async writeJson(filename, data) {
    const fullPath = path.join(this.cwd, filename);
    let existing = {};
    if (fs.existsSync(fullPath)) {
      try { existing = JSON.parse(await fsp.readFile(fullPath, 'utf8')); } catch (e) {}
    }
    
    const merged = { ...existing };
    for (const key in data) {
      if (key === 'hooks' && typeof data[key] === 'object' && typeof existing[key] === 'object') {
        merged[key] = { ...existing[key], ...data[key] };
      } else {
        merged[key] = data[key];
      }
    }
    await this.writeFile(filename, JSON.stringify(merged, null, 2));
  }

  async removeFile(filename) {
    const fullPath = path.join(this.cwd, filename);
    if (fs.existsSync(fullPath)) await fsp.unlink(fullPath);
  }
}

/**
 * Manages sub-agent registrations and orchestrator integrations.
 */
class AgentManager {
  constructor(cwd) {
    this.cwd = cwd;
    this.home = os.homedir();
  }

  async execute(platform, action) {
    if (!platform) return console.error('[Code-Graph] Platform required. Usage: code-graph install-agent <platform>');
    const p = platform.toLowerCase();
    const act = (action || 'install-agent').toLowerCase();

    if (act === 'install-agent') await this.install(p);
    else if (act === 'uninstall-agent') await this.uninstall(p);
    else console.error(`[Code-Graph] Unknown action: ${act}. Use install-agent or uninstall-agent.`);
  }

  async install(p) {
    console.log(`[Code-Graph] Registering code-graph as sub-agent for ${p}...`);
    try {
      switch (p) {
        case 'gemini': await this.installGeminiAgent(); break;
        case 'claude':
        case 'cursor': 
          await this.installMCPServer(); 
          break;
        case 'kiro': await this.installKiroAgent(); break;
        case 'antigravity': await this.installAntigravityAgent(); break;
        default:
          await this.installGenericPersona();
      }
      console.log(`[Code-Graph] Successfully registered sub-agent for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] Agent registration failed for ${p}: ${err.message}`);
    }
  }

  async uninstall(p) {
    console.log(`[Code-Graph] Removing sub-agent for ${p}...`);
    try {
      switch (p) {
        case 'gemini': 
          await fsp.rm(path.join(this.home, '.gemini', 'subagents', 'code-graph'), { recursive: true, force: true }); 
          await fsp.rm(path.join(this.home, '.gemini', 'agents', 'code-graph.md'), { force: true });
          break;
        case 'claude':
        case 'cursor': await this.removeFile('mcp-server-code-graph.json'); break;
        case 'kiro': await fsp.rm(path.join(this.home, '.kiro', 'agents', 'code-graph'), { recursive: true, force: true }); break;
        case 'antigravity': await fsp.rm(path.join(this.home, '.agent', 'subagents', 'code-graph'), { recursive: true, force: true }); break;
        default: await this.removeFile('.code-graph-agent.md');
      }
      
      // Defensive folder cleanup for global paths
      const globalFolders = [
        path.join(this.home, '.gemini', 'subagents'),
        path.join(this.home, '.kiro', 'agents'),
        path.join(this.home, '.agent', 'subagents')
      ];
      for (const f of globalFolders) {
        if (fs.existsSync(f) && (await fsp.readdir(f)).length === 0) await fsp.rmdir(f);
      }

      console.log(`[Code-Graph] Successfully removed sub-agent for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] Agent removal failed: ${err.message}`);
    }
  }

  async removeFile(filename) {
    const fullPath = path.join(this.cwd, filename);
    if (fs.existsSync(fullPath)) await fsp.unlink(fullPath);
  }

  async installGeminiAgent() {
    const agentFile = path.join(this.home, '.gemini', 'agents', 'code-graph.md');
    await fsp.mkdir(path.dirname(agentFile), { recursive: true });
    const content = `---\nname: code-graph\ndescription: Specialized analyst for codebase mapping and memory persistence.\n---\n# Code-Graph Agent\nRole: Specialized analyst for codebase mapping and memory persistence.\nCapabilities: Can run \`code-graph generate\` to refresh the project map and \`code-graph reflect\` to save lessons.\nUsage: Delegate architectural or environmental analysis to this agent.\n`;
    await fsp.writeFile(agentFile, content);
  }

  async installMCPServer() {
    const config = {
      mcpServers: {
        "code-graph": {
          command: "node",
          args: [fileURLToPath(import.meta.url), "generate"],
          description: "Generates a compact codebase map for LLM context optimization."
        }
      }
    };
    await fsp.writeFile(path.join(this.cwd, 'mcp-server-code-graph.json'), JSON.stringify(config, null, 2));
  }

  async installKiroAgent() {
    const agentDir = path.join(this.home, '.kiro', 'agents', 'code-graph');
    await fsp.mkdir(agentDir, { recursive: true });
    await fsp.writeFile(path.join(agentDir, 'AGENT.md'), `# Code-Graph\nSpecialist in project structure and navigation.\n`);
  }

  async installAntigravityAgent() {
    const agentDir = path.join(this.home, '.agent', 'subagents', 'code-graph');
    await fsp.mkdir(agentDir, { recursive: true });
    await fsp.writeFile(path.join(agentDir, 'AGENT.md'), `# Code-Graph Sub-Agent\nHandles structural mapping and reflection.\n`);
  }

  async installGenericPersona() {
    const content = `# SYSTEM PROMPT: Code-Graph Persona\nYour role is now to act as the Code-Graph Specialist. \n1. Use \`llm-code-graph.md\` to provide architectural overviews.\n2. Strictly follow the protocol in \`llm-agent-rules.md\`.\n3. Always suggest a \`code-graph reflect\` entry after resolving a non-obvious issue.\n`;
    await fsp.writeFile(path.join(this.cwd, '.code-graph-agent.md'), content);
  }
}

// --- CLI Entry Point ---

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const cwd = process.cwd();

  try {
    const platforms = ['claude', 'codex', 'opencode', 'cursor', 'gemini', 'aider', 'openclaw', 'droid', 'trae', 'trae-cn', 'hermes', 'kiro', 'antigravity', 'copilot', 'vscode', 'roocode', 'intellij'];
    
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
      case 'install-skills':
        await new SkillManager(cwd).execute(args[0], 'install-skills', args[1]);
        break;
      case 'uninstall-skills':
        await new SkillManager(cwd).execute(args[0], 'uninstall-skills', args[1]);
        break;
      case 'install-agent':
        await new AgentManager(cwd).execute(args[0], 'install-agent');
        break;
      case 'uninstall-agent':
        await new AgentManager(cwd).execute(args[0], 'uninstall-agent');
        break;
      case 'install':
        await new SkillManager(cwd).execute(args[0], 'install-skills');
        await new AgentManager(cwd).execute(args[0], 'install-agent');
        break;
      case 'uninstall':
        await new SkillManager(cwd).execute(args[0], 'uninstall-skills');
        await new AgentManager(cwd).execute(args[0], 'uninstall-agent');
        break;
      case 'uninstall-all':
        console.log('[Code-Graph] Performing full cleanup...');
        for (const p of platforms) {
          await new SkillManager(cwd).execute(p, 'uninstall-skills');
          await new AgentManager(cwd).execute(p, 'uninstall-agent');
        }
        break;
      case 'watch':
        startWatcher(cwd);
        break;
      default:
        if (platforms.includes(command?.toLowerCase())) {
          await new SkillManager(cwd).execute(command, args[0], args[1]);
        } else {
          console.log('Usage: code-graph [generate|init|reflect|install-hook|watch|install-skills <platform> [install|uninstall] [projectmap|reflections]]');
        }
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

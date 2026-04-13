#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import ignore from 'ignore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IGNORE_FILE = '.gitignore';
const DEFAULT_MAP_FILE = 'llm-code-graph.md';

const SYMBOL_REGEXES = [
  // Types, Classes, Interfaces, and Containers (Universal)
  /\b(?:class|interface|type|struct|enum|protocol|extension|trait|module|namespace|object)\s+([a-zA-Z_]\w*)/g,
  
  // Explicit Function Keywords (JS, Python, Go, Rust, Ruby, PHP, Swift, Kotlin, Dart)
  /\b(?:function|def|fn|func|fun|method|procedure|sub|routine)\s+([a-zA-Z_]\w*)/g,
  
  // C-style / Java / C# / TypeScript Method Patterns
  // Matches: ReturnType Name(...) or AccessModifier Name(...)
  /\b(?:void|async|public|private|protected|static|virtual|override|readonly|int|float|double|char|bool|string|val|var|let|const|final)\s+([a-zA-Z_]\w*)(?=\s*\(|(?:\s*:\s*\w+)?\s*=>)/g,
  
  // Exported symbols (JS/TS specific but captures named exports)
  /\bexport\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum|async|val)\s+([a-zA-Z_]\w*)/g,
  
  // Ruby: def name, class Name, module Name (defs covered by Explicit Function Keywords)
  
  // PHP: class Name, interface Name, trait Name, function Name
  
  // Swift: func name, class Name, struct Name, protocol Name, extension Name
  
  // Dart: class Name, void name, var name (void/var covered by C-style pattern)
];

const SUPPORTED_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', 
  '.py', '.go', '.rs', '.java', 
  '.cpp', '.c', '.h', '.hpp', '.cc',
  '.rb', '.php', '.swift', '.kt', 
  '.cs', '.dart', '.scala', '.m', '.mm'
];

function getIgnores(cwd) {
  const ig = ignore().add(['.git', 'node_modules', DEFAULT_MAP_FILE, 'package-lock.json']);
  const ignorePath = path.join(cwd, IGNORE_FILE);
  if (fs.existsSync(ignorePath)) {
    ig.add(fs.readFileSync(ignorePath, 'utf8'));
  }
  return ig;
}

function extractSymbols(content) {
  const symbols = [];
  for (const regex of SYMBOL_REGEXES) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        const symbolName = match[1];
        if (['if', 'for', 'while', 'switch', 'return', 'await', 'yield'].includes(symbolName)) continue;

        // 1. Extract preceding comment/docstring
        const linesBefore = content.substring(0, match.index).split('\n');
        let comment = '';
        for (let i = linesBefore.length - 1; i >= 0; i--) {
          const line = linesBefore[i].trim();
          if (line.startsWith('//') || line.startsWith('*') || line.startsWith('"""') || line.startsWith('#')) {
            const clean = line.replace(/[\/*#"]/g, '').trim();
            if (clean) comment = clean + (comment ? ' ' + comment : '');
            if (comment.length > 80) break; 
          } else if (line === '' && comment === '') {
            continue;
          } else {
            break;
          }
        }

        // 2. Backup: Extract Signature (Parameters/Type) if no comment
        let context = comment;
        if (!context) {
          const remainingLine = content.substring(match.index + match[0].length).split('\n')[0];
          const sigMatch = remainingLine.match(/^[^:{;]*/);
          if (sigMatch && sigMatch[0].trim()) {
            context = sigMatch[0].trim();
          }
        }
        
        symbols.push(context ? `${symbolName} [${context}]` : symbolName);
      }
    }
  }
  return Array.from(new Set(symbols)).sort();
}

async function generate(cwd = process.cwd()) {
  const ig = getIgnores(cwd);
  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      let relativePath = path.relative(cwd, fullPath);
      const normalizedPath = relativePath.replace(/\\/g, '/');
      const checkPath = entry.isDirectory() ? `${normalizedPath}/` : normalizedPath;

      if (ig.ignores(checkPath)) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // Extract file-level description
          const firstLines = content.split('\n').slice(0, 5);
          let fileDesc = '';
          for (const line of firstLines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
              fileDesc += trimmed.replace(/[\/*#]/g, '').trim() + ' ';
            }
          }

          const symbols = extractSymbols(content);
          
          // Backup: If no file description, provide a summary
          if (!fileDesc.trim() && symbols.length > 0) {
            fileDesc = `Contains ${symbols.length} symbols.`;
          }

          files.push({ path: normalizedPath, desc: fileDesc.trim(), symbols });
        } else {
           files.push({ path: normalizedPath, desc: '', symbols: [] });
        }
      }
    }
  }

  walk(cwd);

  const output = files.map(f => {
    const descStr = f.desc ? ` | desc: ${f.desc.substring(0, 100)}` : '';
    const symStr = f.symbols.length > 0 ? `\n  - syms: [${f.symbols.join(', ')}]` : '';
    return `- ${f.path}${descStr}${symStr}`;
  }).join('\n');

  const header = `# CODE_GRAPH_MAP\n> LLM_ONLY: DO NOT EDIT. COMPACT PROJECT MAP.\n\n`;
  fs.writeFileSync(path.join(cwd, DEFAULT_MAP_FILE), header + output);
  console.log(`[Code-Graph] Updated ${DEFAULT_MAP_FILE}`);
}

function watch(cwd = process.cwd()) {
  console.log(`[Code-Graph] Watching for changes in ${cwd}...`);
  const ig = getIgnores(cwd);
  
  const watcher = chokidar.watch(cwd, {
    ignored: (p) => {
        const rel = path.relative(cwd, p);
        return rel && ig.ignores(rel);
    },
    persistent: true,
    ignoreInitial: true
  });

  let timeout;
  const debouncedGenerate = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => generate(cwd), 500);
  };

  watcher.on('all', (event, path) => {
    console.log(`[Code-Graph] Change detected: ${event} on ${path}`);
    debouncedGenerate();
  });
}

function installHook(cwd = process.cwd()) {
  const hooksDir = path.join(cwd, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    console.error('[Code-Graph] No .git directory found. Cannot install hook.');
    return;
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const hookContent = `#!/bin/sh\n# Code-Graph pre-commit hook\nnode "${__filename}" generate\ngit add "${DEFAULT_MAP_FILE}"\n`;

  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
  console.log('[Code-Graph] Installed pre-commit hook.');
}

const args = process.argv.slice(2);
const command = args[0] || 'generate';

if (command === 'generate') {
  generate();
} else if (command === 'watch') {
  watch();
} else if (command === 'install-hook') {
  installHook();
} else {
  console.log('Usage: code-graph [generate|watch|install-hook]');
}

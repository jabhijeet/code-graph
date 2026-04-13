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
  // Types, Classes, Interfaces (Universal)
  /\b(?:class|interface|type|struct|enum|protocol|extension|trait|module|namespace|object)\s+([a-zA-Z_]\w*)/g,
  
  // Explicit Function Keywords
  /\b(?:function|def|fn|func|fun|method|procedure|sub|routine)\s+([a-zA-Z_]\w*)/g,
  
  // Method/Var Declarations (C-style, Java, C#, TS, Dart)
  // Refined to require a variable/function name followed by a declaration signal
  /\b(?:void|async|public|private|protected|static|virtual|override|readonly|int|float|double|char|bool|string|val|var|let|final)\s+([a-zA-Z_]\w*)(?=\s*(?:\([^)]*\)|[a-zA-Z_]\w*)\s*(?:\{|=>|;|=))/g,
  
  // Exported symbols
  /\bexport\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum|async|val)\s+([a-zA-Z_]\w*)/g
];

export const SUPPORTED_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', 
  '.cpp', '.c', '.h', '.hpp', '.cc', '.rb', '.php', '.swift', 
  '.kt', '.cs', '.dart', '.scala', '.m', '.mm'
];

export function getIgnores(cwd, additionalLines = []) {
  const ig = ignore().add([
    '.git/', 'node_modules/', DEFAULT_MAP_FILE, 'package-lock.json', 
    '.idea/', 'build/', 'dist/', 'bin/', 'obj/', '.dart_tool/', '.pub-cache/', '.pub/'
  ]);
  const ignorePath = path.join(cwd, IGNORE_FILE);
  if (fs.existsSync(ignorePath)) {
    ig.add(fs.readFileSync(ignorePath, 'utf8'));
  }
  if (additionalLines.length > 0) {
    ig.add(additionalLines);
  }
  return ig;
}

export function extractSymbols(content) {
  const symbols = [];
  for (const regex of SYMBOL_REGEXES) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        const symbolName = match[1];
        if (['if', 'for', 'while', 'switch', 'return', 'await', 'yield', 'const', 'new'].includes(symbolName)) continue;

        const linesBefore = content.substring(0, match.index).split('\n');
        let comment = '';
        for (let i = linesBefore.length - 1; i >= 0; i--) {
          const line = linesBefore[i].trim();
          if (line.startsWith('//') || line.startsWith('*') || line.startsWith('"""') || line.startsWith('#')) {
            const clean = line.replace(/[\/*#"]/g, '').trim();
            if (clean) comment = clean + (comment ? ' ' + comment : '');
            if (comment.length > 80) break; 
          } else if (line === '' && comment === '') continue;
          else break;
        }

        let context = comment;
        if (!context) {
          const remainingLine = content.substring(match.index + match[0].length);
          const sigMatch = remainingLine.match(/^\s*(\([^)]*\)|[^\n{;]*)/);
          if (sigMatch && sigMatch[1].trim()) {
            context = sigMatch[1].trim();
          }
        }
        
        symbols.push(context ? `${symbolName} [${context}]` : symbolName);
      }
    }
  }
  return Array.from(new Set(symbols)).sort();
}

async function generate(cwd = process.cwd()) {
  const files = [];

  function walk(dir, ig) {
    // Check for local .gitignore and create a new scoped ignore object if found
    let localIg = ig;
    const localIgnorePath = path.join(dir, IGNORE_FILE);
    if (fs.existsSync(localIgnorePath) && dir !== cwd) {
      const content = fs.readFileSync(localIgnorePath, 'utf8');
      const lines = content.split('\n').map(line => {
          line = line.trim();
          if (!line || line.startsWith('#')) return null;
          // Rules in sub-gitignore are relative to that directory
          const relDir = path.relative(cwd, dir).replace(/\\/g, '/');
          return relDir ? `${relDir}/${line}` : line;
      }).filter(Boolean);
      localIg = ignore().add(ig).add(lines);
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(cwd, fullPath);
      const normalizedPath = relativePath.replace(/\\/g, '/');
      const isDirectory = entry.isDirectory();
      const checkPath = isDirectory ? `${normalizedPath}/` : normalizedPath;

      if (localIg.ignores(checkPath)) continue;

      if (isDirectory) {
        walk(fullPath, localIg);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const firstLines = content.split('\n').slice(0, 5);
          let fileDesc = '';
          for (const line of firstLines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
              fileDesc += trimmed.replace(/[\/*#]/g, '').trim() + ' ';
            }
          }
          const symbols = extractSymbols(content);
          if (!fileDesc.trim() && symbols.length > 0) fileDesc = `Contains ${symbols.length} symbols.`;
          files.push({ path: normalizedPath, desc: fileDesc.trim(), symbols });
        }
      }
    }
  }

  walk(cwd, getIgnores(cwd));

  const output = files.map(f => {
    const descStr = f.desc ? ` | desc: ${f.desc.substring(0, 100)}` : '';
    const symStr = f.symbols.length > 0 ? `\n  - syms: [${f.symbols.join(', ')}]` : '';
    return `- ${f.path}${descStr}${symStr}`;
  }).join('\n');

  const header = `# CODE_GRAPH_MAP\n> LLM_ONLY: DO NOT EDIT. COMPACT PROJECT MAP.\n\n`;
  fs.writeFileSync(path.join(cwd, DEFAULT_MAP_FILE), header + output);
  console.log(`[Code-Graph] Updated ${DEFAULT_MAP_FILE}`);
}

export { generate };

export function watch(cwd = process.cwd()) {
  console.log(`[Code-Graph] Watching for changes in ${cwd}...`);
  let timeout;
  const debouncedGenerate = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => generate(cwd), 500);
  };

  const watcher = chokidar.watch(cwd, {
    ignored: (p) => {
        if (p === cwd) return false;
        // Watcher ignore is harder for recursive .gitignore without complexity
        // We rely on the generate() call to skip them during walk
        return false; 
    },
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('all', (event, path) => {
    debouncedGenerate();
  });
}

export function installHook(cwd = process.cwd()) {
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

if (process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('index.js'))) {
  const args = process.argv.slice(2);
  const command = args[0] || 'generate';
  if (command === 'generate') generate();
  else if (command === 'watch') watch();
  else if (command === 'install-hook') installHook();
  else console.log('Usage: code-graph [generate|watch|install-hook]');
}

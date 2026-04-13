#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import ignore from 'ignore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IGNORE_FILE = '.gitignore';
const DEFAULT_MAP_FILE = 'GEMINI.md';

const SYMBOL_REGEXES = [
  /\b(?:class|interface|type|struct|enum)\s+([a-zA-Z_]\w*)/g,
  /\b(?:function|def|fn|func|void|fun)\s+([a-zA-Z_]\w*)/g,
  /\bconst\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g, // Arrow functions
  /\bexport\s+(?:const|let|var|function|class|type|interface|enum)\s+([a-zA-Z_]\w*)/g
];

function getIgnores(cwd) {
  const ig = ignore().add(['.git', 'node_modules', DEFAULT_MAP_FILE]);
  const ignorePath = path.join(cwd, IGNORE_FILE);
  if (fs.existsSync(ignorePath)) {
    ig.add(fs.readFileSync(ignorePath, 'utf8'));
  }
  return ig;
}

function extractSymbols(content) {
  const symbols = new Set();
  for (const regex of SYMBOL_REGEXES) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) symbols.add(match[1]);
    }
  }
  return Array.from(symbols).sort();
}

async function generate(cwd = process.cwd()) {
  const ig = getIgnores(cwd);
  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(cwd, fullPath);

      if (ig.ignores(relativePath)) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (['.js', '.ts', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.rb', '.php', '.swift', '.kt'].includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const symbols = extractSymbols(content);
          files.push({ path: relativePath, symbols });
        } else {
           files.push({ path: relativePath, symbols: [] });
        }
      }
    }
  }

  walk(cwd);

  const output = files.map(f => {
    const symStr = f.symbols.length > 0 ? `|syms:[${f.symbols.join(',')}]` : '';
    return `- ${f.path}${symStr}`;
  }).join('\n');

  const header = `# GEMINI_CODE_MAP\n> LLM_ONLY: DO NOT EDIT. COMPACT PROJECT MAP.\n\n`;
  fs.writeFileSync(path.join(cwd, DEFAULT_MAP_FILE), header + output);
  console.log(`[gemini-helper] Updated ${DEFAULT_MAP_FILE}`);
}

function watch(cwd = process.cwd()) {
  console.log(`[gemini-helper] Watching for changes in ${cwd}...`);
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
    console.log(`[gemini-helper] Change detected: ${event} on ${path}`);
    debouncedGenerate();
  });
}

function installHook(cwd = process.cwd()) {
  const hooksDir = path.join(cwd, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    console.error('[gemini-helper] No .git directory found. Cannot install hook.');
    return;
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const hookContent = `#!/bin/sh\n# gemini-helper pre-commit hook\nnode "${__filename}" generate\ngit add "${DEFAULT_MAP_FILE}"\n`;

  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
  console.log('[gemini-helper] Installed pre-commit hook.');
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
  console.log('Usage: gemini-helper [generate|watch|install-hook]');
}

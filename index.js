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
  // Types, Classes, Interfaces (Universal) with Inheritance support
  /\b(?:class|interface|type|struct|enum|protocol|extension|trait|module|namespace|object)\s+([a-zA-Z_]\w*)(?:[^\n\S]*(?:extends|implements|:|(?:\())[^\n\S]*([a-zA-Z_]\w*(?:[^\n\S]*,\s*[a-zA-Z_]\w*)*)\)?)?/g,

  // Explicit Function Keywords
  /\b(?:function|def|fn|func|fun|method|procedure|sub|routine)\s+([a-zA-Z_]\w*)/g,

  // Method/Var Declarations (Java, Spring Boot, C-style)
  // Captures: public String askAi(String question), void realFunction()
  /\b(?:void|async|public|private|protected|static|final|native|synchronized|abstract|transient|volatile)\s+(?:[\w<>[\]]+\s+)?([a-zA-Z_]\w*)(?=\s*\([^)]*\)\s*(?:\{|=>|;|=))/g,

  // Spring/Java/Dart Annotations (Captures the annotation name as a prefix)
  /(@[a-zA-Z_]\w*(?:\([^)]*\))?)\s*(?:(?:public|private|protected|static|final|abstract|class|interface|enum|void|[\w<>[\]]+)\s+)+([a-zA-Z_]\w*)/g,

  // Exported symbols
  /\bexport\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum|async|val)\s+([a-zA-Z_]\w*)/g
];


const EDGE_REGEXES = [
  // Imports/Includes (JS, TS, Python, Go, Rust, C++, Java, Dart)
  /\b(?:import|from|include|require|using)\s*(?:[\(\s])\s*['"]?([@\w\.\/\-]+)['"]?/g,
  // C-style includes
  /#include\s+[<"]([\w\.\/\-]+)[>"]/g
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

export function extractSymbolsAndInheritance(content) {
  const symbols = [];
  const inheritance = [];
  
  // Create a version of content without comments AND strings to find symbols accurately
  const cleanContent = content
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    .replace(/['"`](?:\\.|[^'"`])*['"`]/g, '');

  for (const regex of SYMBOL_REGEXES) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(cleanContent)) !== null) {
      if (match[1]) {
        // Handle the Annotation regex separately (it has 2 groups)
        let symbolName = match[1];
        let annotation = '';
        
        if (symbolName.startsWith('@')) {
          annotation = symbolName;
          symbolName = match[2] || '';
          if (!symbolName) continue;
        }

        if (['if', 'for', 'while', 'switch', 'return', 'await', 'yield', 'const', 'new', 'let', 'var', 'class', 'void', 'public', 'private', 'protected'].includes(symbolName)) continue;

        // Capture inheritance if present (match[2] only for non-annotation regex)
        if (!annotation && match[2]) {
          const parents = match[2].split(',').map(p => p.trim());
          parents.forEach(parent => {
            inheritance.push({ child: symbolName, parent });
          });
        }

        // To find the comment, we need to find the position in the ORIGINAL content
        const escapedName = symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const posRegex = new RegExp(`\\b${escapedName}\\b`, 'g');
        let posMatch = posRegex.exec(content);
        if (!posMatch) continue;

        const linesBefore = content.substring(0, posMatch.index).split('\n');
        let comment = '';
        // Skip the current line where the symbol is defined
        for (let i = linesBefore.length - 2; i >= 0; i--) {
          const line = linesBefore[i].trim();
          if (line.startsWith('//') || line.startsWith('*') || line.startsWith('"""') || line.startsWith('#') || line.startsWith('/*')) {
            const clean = line.replace(/[\/*#"]/g, '').trim();
            if (clean) comment = clean + (comment ? ' ' + comment : '');
            if (comment.length > 100) break; 
          } else if (line === '' && comment === '') continue;
          else if (line.startsWith('@')) continue; // Skip annotations in comment search
          else break;
        }

        let context = comment;
        if (!context) {
          const remainingLine = content.substring(posMatch.index + symbolName.length);
          const sigMatch = remainingLine.match(/^\s*(\([^)]*\)|[^\n{;]*)/);
          if (sigMatch && sigMatch[1].trim()) {
            context = sigMatch[1].trim();
          }
        }
        
        const displaySymbol = annotation ? `${annotation} ${symbolName}` : symbolName;
        symbols.push(context ? `${displaySymbol} [${context}]` : displaySymbol);
      }
    }
  }
  return { 
    symbols: Array.from(new Set(symbols)).sort(),
    inheritance: Array.from(new Set(inheritance.map(JSON.stringify))).map(JSON.parse)
  };
}

export function extractEdges(content) {
  const dependencies = new Set();
  const noComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  for (const regex of EDGE_REGEXES) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(noComments)) !== null) {
      if (match[1]) {
        const dep = match[1];
        // Filter out obvious noise, common library names, or keywords
        if (dep.length > 1 && !['style', 'react', 'vue', 'flutter', 'new', 'const', 'let', 'var', 'dependencies', 'from', 'import'].includes(dep.toLowerCase())) {
          dependencies.add(dep);
        }
      }
    }
  }
  return Array.from(dependencies).sort();
}

async function generate(cwd = process.cwd()) {
  const files = [];
  const allEdges = [];
  const incomingEdges = {}; // Map of projectPath -> count of incoming edges

  function walk(dir, ig) {
    let localIg = ig;
    const localIgnorePath = path.join(dir, IGNORE_FILE);
    if (fs.existsSync(localIgnorePath) && dir !== cwd) {
      const content = fs.readFileSync(localIgnorePath, 'utf8');
      const lines = content.split('\n').map(line => {
          line = line.trim();
          if (!line || line.startsWith('#')) return null;
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
          
          // Extract file-level description and tags
          const lines = content.split('\n');
          let fileDesc = '';
          const tags = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Surface actionable tags
            const tagMatch = line.match(/\b(TODO|FIXME|BUG|DEPRECATED):?\s*(.*)/i);
            if (tagMatch) {
              tags.push(`${tagMatch[1]}: ${tagMatch[2].substring(0, 50).trim()}`);
            }
            
            if (i < 10) {
              if (line.startsWith('#!') || line === '') continue;
              if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*')) {
                fileDesc += line.replace(/[\/*#]/g, '').trim() + ' ';
              } else if (fileDesc) {
                // Stop if we hit non-comment code
                break;
              }
            }
          }

          const { symbols, inheritance } = extractSymbolsAndInheritance(content);
          const dependencies = extractEdges(content);
          
          if (!fileDesc.trim() && symbols.length > 0) fileDesc = `Contains ${symbols.length} symbols.`;
          
          // Identify core entry points
          const isCore = /^(index|main|app|server|cli)\.(js|ts|py|go|rs|java|cpp)$/i.test(entry.name);
          
          const fileObj = { 
            path: normalizedPath, 
            desc: fileDesc.trim(), 
            symbols, 
            tags: Array.from(new Set(tags)),
            isCore,
            outCount: dependencies.length
          };
          files.push(fileObj);
          
          // Collect Edges and track incoming
          dependencies.forEach(dep => {
            let target = dep;
            if (dep.startsWith('.')) {
              // Resolve relative path to project-relative
              const resolved = path.normalize(path.join(path.dirname(normalizedPath), dep));
              target = resolved.replace(/\\/g, '/');
              // Basic extension guesser
              if (!path.extname(target)) {
                for (const ex of SUPPORTED_EXTENSIONS) {
                  if (fs.existsSync(path.join(cwd, target + ex))) {
                    target += ex;
                    break;
                  }
                }
              }
            }
            allEdges.push(`[${normalizedPath}] -> [imports] -> [${target}]`);
            incomingEdges[target] = (incomingEdges[target] || 0) + 1;
          });
          inheritance.forEach(inh => {
            allEdges.push(`[${inh.child}] -> [inherits] -> [${inh.parent}]`);
          });
        }
      }
    }
  }

  walk(cwd, getIgnores(cwd));

  // Sort: Core files first, then by incoming edges (importance)
  files.sort((a, b) => {
    if (a.isCore && !b.isCore) return -1;
    if (!a.isCore && b.isCore) return 1;
    const inA = incomingEdges[a.path] || 0;
    const inB = incomingEdges[b.path] || 0;
    return inB - inA;
  });

  const nodesOutput = files.map(f => {
    const inCount = incomingEdges[f.path] || 0;
    const coreMark = f.isCore ? '[CORE] ' : '';
    const stats = `(↑${f.outCount} ↓${inCount})`;
    const tagStr = f.tags.length > 0 ? ` [${f.tags.join(', ')}]` : '';
    const descStr = f.desc ? ` | desc: ${f.desc.substring(0, 100)}` : '';
    const symStr = f.symbols.length > 0 ? `\n  - syms: [${f.symbols.join(', ')}]` : '';
    return `- ${coreMark}${f.path} ${stats}${tagStr}${descStr}${symStr}`;
  }).join('\n');

  const edgesOutput = allEdges.length > 0 
    ? `\n\n## GRAPH EDGES\n${Array.from(new Set(allEdges)).sort().join('\n')}` 
    : '';

  const header = `# CODE_GRAPH_MAP\n> LLM_ONLY: DO NOT EDIT. COMPACT PROJECT MAP.\n> Legend: [CORE] Entry Point, (↑N) Outgoing Deps, (↓M) Incoming Dependents\n> Notation: syms: [Name [Signature/Context]], desc: File Summary, [TAG: Context] Actionable items\n\n`;
  fs.writeFileSync(path.join(cwd, DEFAULT_MAP_FILE), header + nodesOutput + edgesOutput);
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

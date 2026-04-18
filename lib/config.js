/**
 * @file lib/config.js
 * @description Constants, configuration, and shared utilities.
 */

export const CONFIG = Object.freeze({
  VERSION: '4.3.0',
  IGNORE_FILE: '.gitignore',
  MAP_FILE: 'llm-code-graph.md',
  REFLECTIONS_FILE: 'llm-agent-project-learnings.md',
  RULES_FILE: 'llm-agent-rules.md',
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_WALK_DEPTH: 32,
  SUPPORTED_EXTENSIONS: Object.freeze([
    '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java',
    '.cpp', '.c', '.h', '.hpp', '.cc', '.rb', '.php', '.swift',
    '.kt', '.cs', '.dart', '.scala', '.m', '.mm'
  ]),
  DEFAULT_IGNORES: Object.freeze([
    '.git/', 'node_modules/', 'package-lock.json', '.idea/',
    'build/', 'dist/', 'bin/', 'obj/', '.dart_tool/', '.pub-cache/', '.pub/'
  ])
});

export const SUPPORTED_EXTENSIONS = CONFIG.SUPPORTED_EXTENSIONS;

export const SUPPORTED_PLATFORMS = Object.freeze([
  'claude', 'cursor', 'gemini', 'codex', 'opencode', 'roocode',
  'kiro', 'antigravity', 'copilot', 'vscode', 'intellij',
  'aider', 'trae', 'hermes', 'generic'
]);

export function isValidPlatform(p) {
  return typeof p === 'string'
    && /^[a-z0-9_-]{1,32}$/i.test(p)
    && SUPPORTED_PLATFORMS.includes(p.toLowerCase());
}

export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripDangerousKeys(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripDangerousKeys);
  const clean = {};
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = stripDangerousKeys(value[key]);
  }
  return clean;
}

export const REGEX = {
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

/**
 * @file lib/config.js
 * @description Constants, configuration, and shared utilities.
 */

export const CONFIG = Object.freeze({
  VERSION: '4.10.0',
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
  // Original platforms
  'claude', 'cursor', 'gemini', 'codex', 'opencode', 'roocode',
  'kiro', 'antigravity', 'copilot', 'vscode', 'intellij',
  'aider', 'trae', 'hermes', 'generic',
  // Extended agent support
  'aider-desk', 'amp', 'augment', 'bob', 'openclaw', 'cline', 'warp',
  'codearts-agent', 'codebuddy', 'codemaker', 'codestudio', 'command-code',
  'continue', 'cortex', 'crush', 'deepagents', 'devin', 'droid',
  'firebender', 'forgecode', 'gemini-cli', 'github-copilot', 'goose',
  'junie', 'iflow-cli', 'kilo', 'kimi-cli', 'kiro-cli', 'kode',
  'mcpjam', 'mistral-vibe', 'mux', 'openhands', 'pi', 'qoder',
  'qwen-code', 'replit', 'rovodev', 'roo', 'tabnine-cli', 'trae-cn',
  'universal', 'windsurf', 'zencoder', 'neovate', 'pochi', 'adal',
]);

// Maps platform names with non-standard global skills dirs to their path segments (relative to home).
// Platforms not listed here use the default: ~/.{platform}/skills/
export const PLATFORM_GLOBAL_PATHS = Object.freeze({
  'amp':            ['.config', 'agents', 'skills'],
  'cline':          ['.agents', 'skills'],
  'codearts-agent': ['.codeartsdoer', 'skills'],
  'command-code':   ['.commandcode', 'skills'],
  'cortex':         ['.snowflake', 'cortex', 'skills'],
  'crush':          ['.config', 'crush', 'skills'],
  'deepagents':     ['.deepagents', 'agent', 'skills'],
  'devin':          ['.config', 'devin', 'skills'],
  'droid':          ['.factory', 'skills'],
  'forgecode':      ['.forge', 'skills'],
  'gemini-cli':     ['.gemini', 'skills'],
  'github-copilot': ['.copilot', 'skills'],
  'goose':          ['.config', 'goose', 'skills'],
  'iflow-cli':      ['.iflow', 'skills'],
  'kilo':           ['.kilocode', 'skills'],
  'kimi-cli':       ['.config', 'agents', 'skills'],
  'kiro-cli':       ['.kiro', 'skills'],
  'mistral-vibe':   ['.vibe', 'skills'],
  'opencode':       ['.config', 'opencode', 'skills'],
  'pi':             ['.pi', 'agent', 'skills'],
  'qwen-code':      ['.qwen', 'skills'],
  'replit':         ['.config', 'agents', 'skills'],
  'tabnine-cli':    ['.tabnine', 'agent', 'skills'],
  'trae-cn':        ['.trae-cn', 'skills'],
  'universal':      ['.config', 'agents', 'skills'],
  'warp':           ['.agents', 'skills'],
  'windsurf':       ['.codeium', 'windsurf', 'skills'],
});

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

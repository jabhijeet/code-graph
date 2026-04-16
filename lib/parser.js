/**
 * @file lib/parser.js
 * @description Handles extraction of symbols, edges, and metadata from source code.
 */

import { REGEX, escapeRegex } from './config.js';

export class CodeParser {
  static extract(content) {
    const noComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const cleanContent = noComments.replace(/['"`](?:\\.|[^'"`])*['"`]/g, '');
    // For tags: strip strings and regex literals but keep comments (since TODO/FIXME live in comments)
    const noCodeLiterals = content.replace(/['"`](?:\\.|[^'"`])*['"`]/g, '').replace(/\/(?![/*])(?:\\.|[^/\n])+\/[gimsuy]*/g, '');

    const { symbols, inheritance } = this.extractSymbols(content, cleanContent);
    const edges = this.extractEdges(noComments);
    const tags = this.extractTags(noCodeLiterals);

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
    const pos = content.search(new RegExp(`\\b${escapeRegex(name)}\\b`));
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

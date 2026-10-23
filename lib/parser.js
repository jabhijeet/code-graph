/**
 * @file lib/parser.js
 * @description Handles extraction of symbols, edges, and metadata from source code.
 */

import { REGEX, escapeRegex } from './config.js';

// Strings and comments must be matched in one left-to-right pass: stripping comments first
// turns the `//` in 'https://x' into a comment, and a quote class like ['"`] lets "it's" close early.
// '...' and "..." stop at a newline so a stray apostrophe (e.g. Rust lifetimes) cannot swallow code.
// Regex literals count as strings; they are only recognised after a token that can precede an
// expression, so `a / b / c` stays division.
const LITERALS_AND_COMMENTS = new RegExp([
  String.raw`(?<=(?:^|[(,=:\[!&|?{};+\-*%<>~^]|\breturn)\s*)\/(?![*\/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^\/\\\n\[])+\/[a-z]*`,
  String.raw`'(?:\\.|[^'\\\n])*'`,
  String.raw`"(?:\\.|[^"\\\n])*"`,
  String.raw`\x60(?:\\[\s\S]|[^\x60\\])*\x60`,
  String.raw`\/\*[\s\S]*?\*\/`,
  String.raw`\/\/[^\n]*`
].join('|'), 'gm');

// No space after '#': Python comments such as "# if x" must stay comments.
const PREPROCESSOR = /^#(?:include|import|define|undef|if|ifdef|ifndef|elif|else|endif|pragma|error|warning|line)\b/;

function strip(content, { strings, comments }) {
  return content.replace(LITERALS_AND_COMMENTS, (m) => {
    const isComment = m.startsWith('//') || m.startsWith('/*');
    return (isComment ? comments : strings) ? '' : m;
  });
}

export class CodeParser {
  static extract(content) {
    const noComments = strip(content, { strings: false, comments: true });
    const cleanContent = strip(content, { strings: true, comments: true });
    // For tags: strip strings and regex literals but keep comments (tag markers live in comments)
    const noCodeLiterals = strip(content, { strings: true, comments: false });

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
    const escaped = escapeRegex(name);

    // Prefer declaration sites over call sites
    const declPattern = new RegExp(
      `\\b(?:function|def|fn|func|fun|method|class|interface|type|struct|enum|protocol|extension|trait|module|namespace|object|const|let|var|static|async|public|private|protected|void|final|abstract|export(?:\\s+default)?|get|set)\\s+(?:[\\w<>\\[\\],\\s]*?\\s)?${escaped}\\b`
    );
    const declMatch = content.match(declPattern);
    let pos;
    if (declMatch) {
      pos = declMatch.index + declMatch[0].lastIndexOf(name);
    } else {
      pos = content.search(new RegExp(`\\b${escaped}\\b`));
    }
    if (pos === -1) return '';
    return this.describeAt(content, pos, name);
  }

  /** Describe the symbol whose name starts at `pos`: the comment block above it, else its signature. */
  static describeAt(content, pos, name) {
    const linesBefore = content.substring(0, pos).split('\n');
    let comment = '';
    for (let i = linesBefore.length - 2; i >= 0; i--) {
      const line = linesBefore[i].trim();
      // C preprocessor lines start with '#' but are code, not comments.
      if (PREPROCESSOR.test(line)) break;
      if (/^(\/\/|\*|"""|#|\/\*)/.test(line)) {
        const clean = line
          .replace(/^(?:\/\/+|\/\*+|\*+|#+|"""?)\s?/, '')
          .replace(/\*+\/\s*$/, '')
          .trim();
        if (clean) comment = clean + (comment ? ' ' + comment : '');
        if (comment.length > 100) break;
      } else if (line !== '' && !line.startsWith('@')) break;
    }

    if (!comment) {
      const remaining = content.substring(pos + name.length);
      // Same line only: a bare declaration (`def m`) must not borrow the next line as its signature.
      const sigMatch = remaining.match(/^[^\S\n]*(\([^)\n]{0,80}\)|[^\n{;]{0,80})/);
      return sigMatch?.[1].replace(/\s+/g, ' ').trim() || '';
    }
    return comment;
  }

  static extractEdges(clean) {
    const deps = new Set();
    const edgePatterns = [
      /\bimport\s+[^'";\n]*?\s+from\s*['"]([^'"]+)['"]/g,
      /\bimport\s*['"]([^'"]+)['"]/g,
      /\bfrom\s+([@\w.\/-]+)\s+import\b/g,
      /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /\binclude\s*['"]([^'"]+)['"]/g,
      /#include\s+[<"]([\w\.\/\-]+)[>"]/g,
      /\busing\s+([@\w.\/-]+)\b/g
    ];

    for (const regex of edgePatterns) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(clean)) !== null) {
        if (match[1] && match[1].length > 1) deps.add(match[1]);
      }
    }
    return Array.from(deps).sort();
  }

  /** Split a formatted symbol `name [context]` into its parts. */
  static splitSymbol(symbol) {
    const idx = symbol.indexOf(' [');
    if (idx === -1 || !symbol.endsWith(']')) return { name: symbol, context: '' };
    return { name: symbol.slice(0, idx), context: symbol.slice(idx + 2, -1) };
  }

  /** Remove // and /* *\/ comments from JSONC (tsconfig.json) without touching string contents. */
  static stripJsonComments(content) {
    return strip(content, { strings: false, comments: true });
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

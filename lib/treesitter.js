/**
 * @file lib/treesitter.js
 * @description Syntax-tree extraction of symbols, edges, inheritance and tags via tree-sitter (WASM).
 * Produces the same shape as CodeParser.extract; callers fall back to regex when this returns null.
 */

import { promises as fsp } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { REGEX } from './config.js';
import { CodeParser } from './parser.js';

const require = createRequire(import.meta.url);

/** File extension -> grammar bundled with @vscode/tree-sitter-wasm. */
export const GRAMMAR_BY_EXTENSION = Object.freeze({
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'tsx',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java', '.cs': 'c-sharp',
  '.c': 'cpp', '.h': 'cpp', '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
  '.php': 'php', '.rb': 'ruby', '.sh': 'bash'
});

// ── Node helpers ──────────────────────────────────────────────────────────────

const field = (node, name) => node.childForFieldName(name);
// The runtime types child arrays as (Node | null)[].
const named = (node) => node.namedChildren.filter(Boolean);
const childOfType = (node, ...types) => named(node).find(c => types.includes(c.type)) ?? null;

/** Text of a string literal node without its quotes. */
function stringValue(node) {
  if (!node) return null;
  const content = named(node).find(c => /(string_fragment|string_content|_literal_content)$/.test(c.type));
  if (content) return content.text;
  const raw = node.text;
  return /^(['"`]).*\1$/s.test(raw) ? raw.slice(1, -1) : raw;
}

// Leaf-ish type references collected as inheritance parents.
const TYPE_NAME_NODES = new Set([
  'identifier', 'type_identifier', 'constant', 'name', 'member_expression', 'attribute',
  'scoped_identifier', 'scoped_type_identifier', 'qualified_name', 'qualified_identifier',
  'scope_resolution', 'nested_type_identifier'
]);
// Subtrees that hold generic arguments, keyword args or access modifiers rather than parent types.
const TYPE_NAME_SKIP = new Set([
  'type_arguments', 'type_parameters', 'type_argument_list', 'template_argument_list',
  'keyword_argument', 'access_specifier', 'arguments', 'annotation_argument_list'
]);

function typeNames(node) {
  if (!node) return [];
  if (TYPE_NAME_NODES.has(node.type)) return [node.text];
  if (TYPE_NAME_SKIP.has(node.type)) return [];
  return named(node).flatMap(typeNames);
}

const heritageFrom = (...types) => (node) => named(node)
  .filter(c => types.includes(c.type))
  .flatMap(typeNames);

/** Descend C/C++ declarators (`int *f(int)`, `A::m`) to the declared name node. */
function declaratorName(node) {
  let current = node;
  while (current) {
    if (['identifier', 'field_identifier', 'type_identifier', 'destructor_name', 'operator_name'].includes(current.type)) return current;
    if (current.type === 'qualified_identifier') {
      current = field(current, 'name');
      continue;
    }
    current = field(current, 'declarator');
  }
  return null;
}

// ── Language rules ────────────────────────────────────────────────────────────
// defs:     node type -> function returning the name node (or null to skip)
// imports:  node type -> function returning import specifiers
// heritage: node type -> function returning parent type names
// prefix:   optional decoration shown before the name (e.g. Java annotations)

const byName = (node) => field(node, 'name');

const JS_FUNCTION_VALUES = new Set(['arrow_function', 'function_expression', 'function', 'generator_function', 'class']);

const ECMASCRIPT = {
  defs: {
    function_declaration: byName,
    generator_function_declaration: byName,
    class_declaration: byName,
    abstract_class_declaration: byName,
    method_definition: byName,
    interface_declaration: byName,
    type_alias_declaration: byName,
    enum_declaration: byName,
    variable_declarator: (node) => {
      const name = field(node, 'name');
      if (name?.type !== 'identifier') return null;
      const exported = node.parent?.parent?.type === 'export_statement';
      return exported || JS_FUNCTION_VALUES.has(field(node, 'value')?.type) ? name : null;
    },
    public_field_definition: (node) => (JS_FUNCTION_VALUES.has(field(node, 'value')?.type) ? field(node, 'name') : null),
    field_definition: (node) => (JS_FUNCTION_VALUES.has(field(node, 'value')?.type) ? field(node, 'property') : null)
  },
  imports: {
    import_statement: (node) => [stringValue(field(node, 'source'))],
    export_statement: (node) => [stringValue(field(node, 'source'))],
    call_expression: (node) => {
      const fn = field(node, 'function');
      if (!fn || !(fn.type === 'import' || (fn.type === 'identifier' && fn.text === 'require'))) return [];
      const args = field(node, 'arguments');
      const first = args ? named(args)[0] : null;
      return first?.type === 'string' ? [stringValue(first)] : [];
    }
  },
  heritage: {
    class_declaration: heritageFrom('class_heritage'),
    abstract_class_declaration: heritageFrom('class_heritage'),
    interface_declaration: heritageFrom('extends_type_clause')
  }
};

/** `from ..pkg.mod import x` -> `../pkg/mod`; `from . import x` -> `./x`. */
function pythonRelative(prefixDots, modulePath) {
  const up = prefixDots.length > 1 ? '../'.repeat(prefixDots.length - 1) : './';
  return up + modulePath.replace(/\./g, '/');
}

const PYTHON = {
  defs: { function_definition: byName, class_definition: byName },
  imports: {
    import_statement: (node) => named(node).map(c => (c.type === 'aliased_import' ? field(c, 'name') : c)?.text),
    import_from_statement: (node) => {
      const mod = field(node, 'module_name');
      if (!mod) return [];
      if (mod.type !== 'relative_import') return [mod.text];
      const dots = childOfType(mod, 'import_prefix')?.text ?? '.';
      const dotted = childOfType(mod, 'dotted_name');
      if (dotted) return [pythonRelative(dots, dotted.text)];
      // `from . import a, b` imports sibling modules a and b.
      return node.childrenForFieldName('name').filter(Boolean)
        .map(n => pythonRelative(dots, (n.type === 'aliased_import' ? field(n, 'name') : n).text));
    }
  },
  heritage: { class_definition: (node) => typeNames(field(node, 'superclasses')) }
};

const GO = {
  defs: { function_declaration: byName, method_declaration: byName, type_spec: byName },
  imports: { import_spec: (node) => [stringValue(field(node, 'path'))] },
  heritage: {}
};

const RUST = {
  defs: {
    function_item: byName, function_signature_item: byName, struct_item: byName, enum_item: byName,
    union_item: byName, trait_item: byName, type_item: byName, mod_item: byName, macro_definition: byName
  },
  imports: { use_declaration: (node) => [field(node, 'argument')?.text.replace(/\s+/g, '')] },
  heritage: { trait_item: (node) => typeNames(field(node, 'bounds')) },
  // `impl Trait for Type` records Type -> Trait without declaring a new symbol.
  extraInheritance: {
    impl_item: (node) => {
      const trait = field(node, 'trait');
      const child = typeNames(field(node, 'type'))[0];
      return trait && child ? typeNames(trait).map(parent => ({ child, parent })) : [];
    }
  }
};

function javaAnnotation(node) {
  const ann = childOfType(childOfType(node, 'modifiers') ?? node, 'marker_annotation', 'annotation');
  if (!ann) return '';
  const name = field(ann, 'name')?.text ?? '';
  return ann.type === 'annotation' ? `@${name}()` : `@${name}`;
}

const JAVA = {
  defs: {
    class_declaration: byName, interface_declaration: byName, enum_declaration: byName,
    record_declaration: byName, annotation_type_declaration: byName, method_declaration: byName
  },
  imports: { import_declaration: (node) => [childOfType(node, 'scoped_identifier', 'identifier')?.text] },
  heritage: {
    class_declaration: heritageFrom('superclass', 'super_interfaces'),
    interface_declaration: heritageFrom('extends_interfaces'),
    record_declaration: heritageFrom('super_interfaces'),
    enum_declaration: heritageFrom('super_interfaces')
  },
  prefix: javaAnnotation
};

const CSHARP = {
  defs: {
    class_declaration: byName, interface_declaration: byName, struct_declaration: byName,
    enum_declaration: byName, record_declaration: byName, method_declaration: byName,
    namespace_declaration: byName, file_scoped_namespace_declaration: byName, delegate_declaration: byName
  },
  imports: {
    using_directive: (node) => {
      const names = named(node).filter(c => ['qualified_name', 'identifier'].includes(c.type));
      return [names[names.length - 1]?.text];
    }
  },
  heritage: Object.fromEntries(
    ['class_declaration', 'interface_declaration', 'struct_declaration', 'record_declaration']
      .map(t => [t, heritageFrom('base_list')])
  )
};

const withBody = (node) => (field(node, 'body') ? field(node, 'name') : null);
const functionPrototype = (node) => {
  const decl = field(node, 'declarator');
  return decl?.type === 'function_declarator' ? declaratorName(decl) : null;
};

const CPP = {
  defs: {
    function_definition: (node) => declaratorName(field(node, 'declarator')),
    declaration: functionPrototype,
    field_declaration: functionPrototype,
    class_specifier: withBody, struct_specifier: withBody, union_specifier: withBody, enum_specifier: withBody,
    namespace_definition: byName
  },
  imports: {
    preproc_include: (node) => {
      const p = field(node, 'path');
      if (!p) return [];
      return [p.type === 'system_lib_string' ? p.text.slice(1, -1) : stringValue(p)];
    }
  },
  heritage: { class_specifier: heritageFrom('base_class_clause'), struct_specifier: heritageFrom('base_class_clause') }
};

const phpInclude = (node) => [stringValue(childOfType(node, 'string', 'encapsed_string'))];

const PHP = {
  defs: {
    function_definition: byName, class_declaration: byName, interface_declaration: byName,
    trait_declaration: byName, enum_declaration: byName, method_declaration: byName
  },
  imports: {
    namespace_use_clause: (node) => [childOfType(node, 'qualified_name', 'name')?.text],
    include_expression: phpInclude, include_once_expression: phpInclude,
    require_expression: phpInclude, require_once_expression: phpInclude
  },
  heritage: {
    class_declaration: heritageFrom('base_clause', 'class_interface_clause'),
    interface_declaration: heritageFrom('base_clause')
  }
};

const RUBY = {
  defs: { method: byName, singleton_method: byName, class: byName, module: byName },
  imports: {
    call: (node) => {
      const method = field(node, 'method')?.text;
      if (!['require', 'require_relative', 'load'].includes(method)) return [];
      const spec = stringValue(childOfType(field(node, 'arguments') ?? node, 'string'));
      if (!spec) return [];
      return [method === 'require_relative' && !spec.startsWith('.') ? `./${spec}` : spec];
    }
  },
  heritage: { class: (node) => typeNames(field(node, 'superclass')) }
};

const BASH = {
  defs: { function_definition: byName },
  imports: {
    command: (node) => {
      const cmd = field(node, 'name')?.text;
      return cmd === 'source' || cmd === '.' ? [field(node, 'argument')?.text] : [];
    }
  },
  heritage: {}
};

const RULES = {
  javascript: ECMASCRIPT, typescript: ECMASCRIPT, tsx: ECMASCRIPT,
  python: PYTHON, go: GO, rust: RUST, java: JAVA, 'c-sharp': CSHARP, cpp: CPP, php: PHP, ruby: RUBY, bash: BASH
};

// ── Engine ────────────────────────────────────────────────────────────────────

export class TreeSitterParser {
  static _runtime = null;      // Promise<{ Parser, Language, wasmDir } | null>
  static _languages = new Map(); // grammar -> Promise<Language | null>

  static async _loadRuntime() {
    this._runtime ??= (async () => {
      try {
        const mainPath = require.resolve('@vscode/tree-sitter-wasm');
        const wasmDir = path.dirname(mainPath);
        const { Parser, Language } = require('@vscode/tree-sitter-wasm');
        await Parser.init({ locateFile: (file) => path.join(wasmDir, file) });
        return { Parser, Language, wasmDir };
      } catch (e) {
        console.warn(`[Code-Graph] tree-sitter unavailable, using regex parser: ${e.message}`);
        return null;
      }
    })();
    return this._runtime;
  }

  static async _loadLanguage(grammar) {
    if (!this._languages.has(grammar)) {
      this._languages.set(grammar, (async () => {
        const runtime = await this._loadRuntime();
        if (!runtime) return null;
        try {
          const bytes = await fsp.readFile(path.join(runtime.wasmDir, `tree-sitter-${grammar}.wasm`));
          return await runtime.Language.load(bytes);
        } catch (e) {
          console.warn(`[Code-Graph] tree-sitter grammar "${grammar}" failed to load, using regex: ${e.message}`);
          return null;
        }
      })());
    }
    return this._languages.get(grammar);
  }

  /** True when a bundled grammar exists for this extension (it may still fail to load). */
  static supports(ext) {
    return Object.hasOwn(GRAMMAR_BY_EXTENSION, String(ext).toLowerCase());
  }

  /**
   * Parse `content` with the grammar for `ext`.
   * @returns {Promise<{symbols: string[], inheritance: {child: string, parent: string}[], edges: string[], tags: string[]} | null>}
   *   null when no grammar is available, so the caller can fall back to regex.
   */
  static async extract(content, ext) {
    const grammar = GRAMMAR_BY_EXTENSION[String(ext).toLowerCase()];
    if (!grammar) return null;
    const language = await this._loadLanguage(grammar);
    if (!language) return null;

    const runtime = await this._runtime;
    const parser = new runtime.Parser();
    let tree = null;
    try {
      parser.setLanguage(language);
      tree = parser.parse(content);
      if (!tree) return null;
      return this.collect(tree.rootNode, content, RULES[grammar]);
    } finally {
      tree?.delete();
      parser.delete();
    }
  }

  static collect(root, content, rules) {
    const symbols = new Set();
    const inheritance = [];
    const edges = new Set();
    const comments = [];

    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      const type = node.type;

      if (type.includes('comment')) {
        comments.push(node.text);
        continue;
      }

      const nameNode = rules.defs[type]?.(node);
      const name = nameNode?.text;
      if (name && !REGEX.KEYWORDS.has(name)) {
        const prefix = rules.prefix?.(node);
        const display = prefix ? `${prefix} ${name}` : name;
        const context = CodeParser.describeAt(content, nameNode.startIndex, name);
        symbols.add(context ? `${display} [${context}]` : display);
        for (const parent of rules.heritage[type]?.(node) ?? []) inheritance.push({ child: name, parent });
      }
      for (const pair of rules.extraInheritance?.[type]?.(node) ?? []) inheritance.push(pair);
      for (const spec of rules.imports[type]?.(node) ?? []) {
        if (spec && spec.length > 1) edges.add(spec);
      }

      for (let i = node.namedChildCount - 1; i >= 0; i--) {
        const child = node.namedChild(i);
        if (child) stack.push(child);
      }
    }

    return {
      symbols: Array.from(symbols).sort(),
      inheritance,
      edges: Array.from(edges).sort(),
      tags: CodeParser.extractTags(comments.join('\n'))
    };
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TreeSitterParser, GRAMMAR_BY_EXTENSION } from '../lib/treesitter.js';
import { ProjectMapper } from '../lib/mapper.js';
import { CONFIG } from '../lib/config.js';

const names = (result) => result.symbols.map(s => s.split(' [')[0]);

test('every grammar-mapped extension is a supported extension', () => {
  for (const ext of Object.keys(GRAMMAR_BY_EXTENSION)) {
    assert.ok(CONFIG.SUPPORTED_EXTENSIONS.includes(ext), `${ext} mapped to a grammar but not scanned`);
  }
});

test('returns null for extensions without a bundled grammar', async () => {
  assert.equal(await TreeSitterParser.extract('fun x() {}', '.kt'), null);
  assert.equal(TreeSitterParser.supports('.kt'), false);
  assert.equal(TreeSitterParser.supports('.TS'), true);
});

test('JavaScript: declarations, exports, imports, heritage, comment tags', async () => {
  const code = [
    "import a from './a.js';",
    "const lib = require('lib-name');",
    "export * from './re';",
    "const lazy = import('./lazy');",
    '// TODO: tidy up',
    'export class Foo extends Bar { method() {} }',
    'export const VALUE = 1;',
    'const handler = () => 1;',
    'const notASymbol = 3;',
    "const s = 'export function fake() {}';",
    'function plain(x) {}'
  ].join('\n');
  const r = await TreeSitterParser.extract(code, '.js');
  assert.deepEqual(names(r).sort(), ['Foo', 'VALUE', 'handler', 'method', 'plain']);
  assert.deepEqual(r.edges, ['./a.js', './lazy', './re', 'lib-name']);
  assert.deepEqual(r.inheritance, [{ child: 'Foo', parent: 'Bar' }]);
  assert.deepEqual(r.tags, ['TODO: tidy up']);
});

test('TypeScript: interfaces, types, enums, extends + implements', async () => {
  const code = 'export interface I extends J {}\nexport class K extends L implements M, N { private p(): void {} }\ntype T = string;\nenum E { A }';
  const r = await TreeSitterParser.extract(code, '.ts');
  assert.deepEqual(names(r).sort(), ['E', 'I', 'K', 'T', 'p']);
  assert.deepEqual(r.inheritance, [
    { child: 'I', parent: 'J' }, { child: 'K', parent: 'L' }, { child: 'K', parent: 'M' }, { child: 'K', parent: 'N' }
  ]);
});

test('TSX parses JSX without losing symbols', async () => {
  const r = await TreeSitterParser.extract('export function App() { return <div className="x">hi</div>; }', '.tsx');
  assert.deepEqual(names(r), ['App']);
});

test('Python: relative imports become paths; keyword args are not parents', async () => {
  const code = 'from .models import X\nfrom ..pkg.mod import Y\nfrom . import sib\nimport os\nclass A(B, mod.C, metaclass=M):\n    def m(self): pass';
  const r = await TreeSitterParser.extract(code, '.py');
  assert.deepEqual(names(r).sort(), ['A', 'm']);
  assert.deepEqual(r.edges, ['../pkg/mod', './models', './sib', 'os']);
  assert.deepEqual(r.inheritance, [{ child: 'A', parent: 'B' }, { child: 'A', parent: 'mod.C' }]);
});

test('Go, Rust, Java, C#, C/C++, PHP, Ruby, Bash extract names, imports and parents', async () => {
  const cases = [
    ['.go', 'package main\nimport "fmt"\ntype S struct{}\nfunc F() {}\nfunc (s S) M() {}', ['F', 'M', 'S'], ['fmt'], []],
    ['.rs', 'use crate::foo::Bar;\nstruct S;\ntrait T {}\nimpl T for S { fn m(&self) {} }', ['S', 'T', 'm'], ['crate::foo::Bar'], [{ child: 'S', parent: 'T' }]],
    ['.java', 'import a.b.C;\npublic class X extends Y<Z> implements W { public void run() {} }', ['X', 'run'], ['a.b.C'], [{ child: 'X', parent: 'Y' }, { child: 'X', parent: 'W' }]],
    ['.cs', 'using System.Text;\nnamespace N { public class A : B { public void M() {} } }', ['A', 'M', 'N'], ['System.Text'], [{ child: 'A', parent: 'B' }]],
    ['.h', '#include "h.h"\n#include <vector>\nint proto(int a);\nclass A : public B<int> {};\nstruct Fwd;', ['A', 'proto'], ['h.h', 'vector'], [{ child: 'A', parent: 'B' }]],
    ['.cpp', 'int f(int x) { return x; }\nvoid A::m() {}', ['f', 'm'], [], []],
    ['.php', "<?php\nuse App\\Models\\User;\nrequire_once 'x.php';\nclass A extends B { function m() {} }", ['A', 'm'], ['App\\Models\\User', 'x.php'], [{ child: 'A', parent: 'B' }]],
    ['.rb', "require 'json'\nrequire_relative 'lib/x'\nclass A < B\n  def m; end\nend", ['A', 'm'], ['./lib/x', 'json'], [{ child: 'A', parent: 'B' }]],
    ['.sh', 'source ./lib.sh\nfoo() { echo; }', ['foo'], ['./lib.sh'], []]
  ];
  for (const [ext, code, expectedNames, expectedEdges, expectedInheritance] of cases) {
    const r = await TreeSitterParser.extract(code, ext);
    assert.deepEqual(names(r).sort(), expectedNames, `${ext} symbols`);
    assert.deepEqual(r.edges, expectedEdges, `${ext} edges`);
    assert.deepEqual(r.inheritance, expectedInheritance, `${ext} inheritance`);
  }
});

test('Java annotations prefix the symbol like the regex parser', async () => {
  const r = await TreeSitterParser.extract('@RestController\npublic class C { @GetMapping("/t") public String hello() { return ""; } }', '.java');
  assert.ok(r.symbols.some(s => s.startsWith('@RestController C')), JSON.stringify(r.symbols));
  assert.ok(r.symbols.some(s => s.startsWith('@GetMapping() hello')), JSON.stringify(r.symbols));
});

test('context: doc comment preferred; #include is not a comment; signature stays on its line', async () => {
  const js = await TreeSitterParser.extract('/** Adds numbers. */\nfunction add(a, b) {}', '.js');
  assert.deepEqual(js.symbols, ['add [Adds numbers.]']);
  const c = await TreeSitterParser.extract('#include <stdio.h>\nint proto(int a);', '.c');
  assert.deepEqual(c.symbols, ['proto [(int a)]']);
  const rb = await TreeSitterParser.extract('module M\n  class A\n  end\nend', '.rb');
  assert.ok(rb.symbols.includes('M'), JSON.stringify(rb.symbols));
});

test('ProjectMapper uses tree-sitter where a grammar exists and regex elsewhere', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ts-map-'));
  const origLog = console.log;
  console.log = () => {};
  try {
    fs.mkdirSync(path.join(dir, 'pkg'));
    fs.writeFileSync(path.join(dir, 'pkg', '__init__.py'), '');
    fs.writeFileSync(path.join(dir, 'pkg', 'models.py'), 'class Model:\n    pass');
    fs.writeFileSync(path.join(dir, 'pkg', 'views.py'), 'from .models import Model\nclass View(Model):\n    pass');
    fs.writeFileSync(path.join(dir, 'App.kt'), 'fun main() {}');
    await new ProjectMapper(dir).generate();

    const json = JSON.parse(fs.readFileSync(path.join(dir, CONFIG.MAP_JSON_FILE), 'utf8'));
    const byPath = Object.fromEntries(json.files.map(f => [f.path, f]));
    assert.equal(byPath['pkg/views.py'].parser, 'tree-sitter');
    assert.equal(byPath['App.kt'].parser, 'regex');
    assert.deepEqual(json.imports['pkg/views.py'], ['pkg/models.py'], 'python relative import resolves to the file');
    assert.equal(byPath['pkg/models.py'].in, 1);
    assert.ok(json.inheritance.some(i => i.child === 'View' && i.parent === 'Model'));
  } finally {
    console.log = origLog;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { 
  extractSymbolsAndInheritance,
  extractEdges,
  getIgnores, 
  SUPPORTED_EXTENSIONS,
  generate
} from '../index.js';

test('extractSymbols - JS/TS Docstrings', () => {
  const code = `
    /**
     * This is a test function
     */
    function testFunc(a, b) {}
  `;
  const { symbols } = extractSymbolsAndInheritance(code);
  assert.ok(symbols.some(s => s.includes('testFunc') && s.includes('This is a test function')));
});

test('extractSymbols - Signature Fallback', () => {
  const code = `
    function noDocFunc(arg1: string, arg2: number) {
      return true;
    }
  `;
  const { symbols } = extractSymbolsAndInheritance(code);
  // Matches "noDocFunc [ (arg1: string, arg2: number)]"
  assert.ok(symbols.some(s => s.includes('noDocFunc') && s.includes('arg1: string, arg2: number')));
});

test('extractSymbols - Flutter/Dart Noise Reduction', () => {
  const code = `
    const SizedBox(height: 10);
    void realFunction() {}
  `;
  const { symbols } = extractSymbolsAndInheritance(code);
  assert.ok(symbols.some(s => s.includes('realFunction')));
  assert.ok(!symbols.some(s => s.includes('SizedBox')));
});

test('extractInheritance - Class relationships', () => {
  const code = `
    class AdminUser extends BaseUser {}
    interface IRepository implements IBase {}
    class MyWidget : StatelessWidget {}
  `;
  const { inheritance } = extractSymbolsAndInheritance(code);
  assert.ok(inheritance.some(i => i.child === 'AdminUser' && i.parent === 'BaseUser'));
  assert.ok(inheritance.some(i => i.child === 'IRepository' && i.parent === 'IBase'));
  assert.ok(inheritance.some(i => i.child === 'MyWidget' && i.parent === 'StatelessWidget'));
});

test('extractEdges - Imports and includes', () => {
  const code = `
    import { something } from './local-file';
    const other = require('other-module');
    #include "header.h"
  `;
  const edges = extractEdges(code);
  assert.ok(edges.includes('./local-file'));
  assert.ok(edges.includes('other-module'));
  assert.ok(edges.includes('header.h'));
});

test('extractSymbols - Java/Spring Annotations', () => {
  const code = `
    @RestController
    public class MyController {
        @GetMapping("/test")
        public String hello() { return "hi"; }
    }
  `;
  const { symbols } = extractSymbolsAndInheritance(code);
  assert.ok(symbols.some(s => s.includes('@RestController MyController')));
  // Note: Strings are stripped during extraction to avoid false positives
  assert.ok(symbols.some(s => s.includes('@GetMapping() hello')));
});

test('getIgnores - Default Patterns', () => {
  const ig = getIgnores(process.cwd());
  assert.strictEqual(ig.ignores('.git/'), true);
  assert.strictEqual(ig.ignores('node_modules/'), true);
  assert.strictEqual(ig.ignores('.idea/'), true);
  assert.strictEqual(ig.ignores('.dart_tool/'), true);
});

test('Recursive Ignore Simulation (Logic Check)', async () => {
  const tempDir = path.join(process.cwd(), 'temp_test_dir');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);
  
  const subDir = path.join(tempDir, 'subdir');
  fs.mkdirSync(subDir);
  
  // Create a file that should be ignored by subdir/.gitignore
  fs.writeFileSync(path.join(subDir, 'ignored.js'), 'function ignored() {}');
  fs.writeFileSync(path.join(subDir, 'included.js'), 'function included() {}');
  fs.writeFileSync(path.join(subDir, '.gitignore'), 'ignored.js');
  
  await generate(tempDir);
  
  const mapPath = path.join(tempDir, 'llm-code-graph.md');
  const mapContent = fs.readFileSync(mapPath, 'utf8');
  
  assert.ok(mapContent.includes('included.js'));
  assert.ok(!mapContent.includes('ignored.js'));
  
  fs.rmSync(tempDir, { recursive: true });
});

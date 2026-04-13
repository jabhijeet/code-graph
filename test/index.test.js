import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { 
  extractSymbols, 
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
  const symbols = extractSymbols(code);
  assert.ok(symbols.some(s => s.includes('testFunc') && s.includes('This is a test function')));
});

test('extractSymbols - Signature Fallback', () => {
  const code = `
    function noDocFunc(arg1: string, arg2: number) {
      return true;
    }
  `;
  const symbols = extractSymbols(code);
  // Matches "noDocFunc [(arg1: string, arg2: number)]"
  assert.ok(symbols.some(s => s.includes('noDocFunc') && s.includes('arg1: string, arg2: number')));
});

test('extractSymbols - Flutter/Dart Noise Reduction', () => {
  const code = `
    const SizedBox(height: 10);
    void realFunction() {}
  `;
  const symbols = extractSymbols(code);
  assert.ok(symbols.some(s => s.includes('realFunction')));
  assert.ok(!symbols.some(s => s.includes('SizedBox')));
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

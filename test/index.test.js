import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { 
  CodeParser,
  ProjectMapper,
  ReflectionManager,
  SUPPORTED_EXTENSIONS,
  CONFIG
} from '../index.js';

test('extractSymbols - JS/TS Docstrings', () => {
  const code = `
    /**
     * This is a test function
     */
    function testFunc(a, b) {}
  `;
  const { symbols } = CodeParser.extract(code);
  assert.ok(symbols.some(s => s.includes('testFunc') && s.includes('This is a test function')));
});

test('extractSymbols - Signature Fallback', () => {
  const code = `
    function noDocFunc(arg1: string, arg2: number) {
      return true;
    }
  `;
  const { symbols } = CodeParser.extract(code);
  assert.ok(symbols.some(s => s.includes('noDocFunc') && s.includes('arg1: string, arg2: number')));
});

test('extractSymbols - Flutter/Dart Noise Reduction', () => {
  const code = `
    const SizedBox(height: 10);
    void realFunction() {}
  `;
  const { symbols } = CodeParser.extract(code);
  assert.ok(symbols.some(s => s.includes('realFunction')));
  assert.ok(!symbols.some(s => s.includes('SizedBox')));
});

test('extractInheritance - Class relationships', () => {
  const code = `
    class AdminUser extends BaseUser {}
    interface IRepository implements IBase {}
    class MyWidget : StatelessWidget {}
  `;
  const { inheritance } = CodeParser.extract(code);
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
  const { edges } = CodeParser.extract(code);
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
  const { symbols } = CodeParser.extract(code);
  assert.ok(symbols.some(s => s.includes('@RestController MyController')));
  assert.ok(symbols.some(s => s.includes('@GetMapping() hello')));
});

test('getIgnores - Default Patterns', () => {
  const mapper = new ProjectMapper(process.cwd());
  const ig = mapper.getIgnores(process.cwd(), CONFIG.DEFAULT_IGNORES);
  assert.strictEqual(ig.ignores('.git/'), true);
  assert.strictEqual(ig.ignores('node_modules/'), true);
  assert.strictEqual(ig.ignores('.idea/'), true);
  assert.strictEqual(ig.ignores('.dart_tool/'), true);
});

test('ReflectionManager - Add and Deduplicate', async () => {
  const tempReflectFile = path.join(process.cwd(), CONFIG.REFLECTIONS_FILE);
  const backupExists = fs.existsSync(tempReflectFile);
  let backupContent = '';
  if (backupExists) backupContent = fs.readFileSync(tempReflectFile, 'utf8');

  // Test Initial Add
  const lesson = "Unique test lesson for reflection";
  await ReflectionManager.add('TEST', lesson);
  const content = fs.readFileSync(tempReflectFile, 'utf8');
  assert.ok(content.includes(lesson));

  // Test Deduplication
  const logSpy = [];
  const originalLog = console.log;
  console.log = (msg) => logSpy.push(msg);
  
  await ReflectionManager.add('TEST', lesson);
  
  console.log = originalLog;
  assert.ok(logSpy.includes('[Code-Graph] Reflection already exists.'));

  // Restore
  if (backupExists) fs.writeFileSync(tempReflectFile, backupContent);
  else fs.unlinkSync(tempReflectFile);
});

test('ProjectMapper - Format Output Header', () => {
  const mapper = new ProjectMapper(process.cwd());
  mapper.files = [{ path: 'test.js', symbols: [], tags: [], isCore: true, outCount: 0, desc: 'test' }];
  const output = mapper.formatOutput();
  
  assert.ok(output.includes('MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.'));
  assert.ok(output.includes('PROTOCOL: Follow llm-agent-rules.md'));
  assert.ok(output.includes('MEMORY: See llm-agent-project-learnings.md'));
});

test('Recursive Ignore Simulation (Logic Check)', async () => {
  const tempDir = path.join(process.cwd(), 'temp_test_dir');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);
  
  const subDir = path.join(tempDir, 'subdir');
  fs.mkdirSync(subDir);
  
  fs.writeFileSync(path.join(subDir, 'ignored.js'), 'function ignored() {}');
  fs.writeFileSync(path.join(subDir, 'included.js'), 'function included() {}');
  fs.writeFileSync(path.join(subDir, '.gitignore'), 'ignored.js');
  
  await new ProjectMapper(tempDir).generate();
  
  const mapPath = path.join(tempDir, CONFIG.MAP_FILE);
  const mapContent = fs.readFileSync(mapPath, 'utf8');
  
  assert.ok(mapContent.includes('included.js'));
  assert.ok(!mapContent.includes('ignored.js'));
  
  fs.rmSync(tempDir, { recursive: true });
});

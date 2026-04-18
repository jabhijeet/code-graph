import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import {
  CodeParser,
  ProjectMapper,
  ReflectionManager,
  SkillManager,
  AgentManager,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_PLATFORMS,
  CONFIG,
  isValidPlatform,
  stripDangerousKeys
} from '../index.js';

// --- CodeParser Tests ---

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

// --- Regex Injection Safety ---

test('extractSymbols - Handles special regex characters in symbol names', () => {
  const code = `
    function $special() {}
    function normal_func() {}
  `;
  // Should not throw even with $ in function name
  const { symbols } = CodeParser.extract(code);
  assert.ok(symbols.some(s => s.includes('normal_func')));
});

test('findSymbolContext - Safe with regex metacharacters', () => {
  const code = `// A helper\nfunction test$func() {}`;
  // Should not throw - the $ would break unescaped regex
  const context = CodeParser.findSymbolContext(code, 'test$func');
  assert.strictEqual(typeof context, 'string');
});

// --- Tag Extraction (Garbled Output Fix) ---

test('extractTags - Does not match regex patterns in source code', () => {
  const code = `
    // This is real source code containing regex
    const TAGS = /\\b(TODO|FIXME|BUG|DEPRECATED):?\\s*(.*)/i;
    function doSomething() {}
  `;
  const { tags } = CodeParser.extract(code);
  // The regex definition itself should NOT produce tag entries
  // because comments are stripped first
  assert.ok(!tags.some(t => t.includes('DEPRECATED):?')));
});

test('extractTags - Still captures real TODO comments', () => {
  const code = `
    // TODO: Fix this later
    function doSomething() {}
  `;
  const { tags } = CodeParser.extract(code);
  assert.ok(tags.some(t => t.includes('TODO') && t.includes('Fix this later')));
});

// --- ProjectMapper Tests ---

test('getIgnores - Default Patterns', async () => {
  const mapper = new ProjectMapper(process.cwd());
  const ig = await mapper.getIgnores(process.cwd(), CONFIG.DEFAULT_IGNORES);
  assert.strictEqual(ig.ignores('.git/'), true);
  assert.strictEqual(ig.ignores('node_modules/'), true);
  assert.strictEqual(ig.ignores('.idea/'), true);
  assert.strictEqual(ig.ignores('.dart_tool/'), true);
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

// --- ReflectionManager Tests ---

test('ReflectionManager - Add and Deduplicate', async () => {
  const tempReflectFile = path.join(process.cwd(), CONFIG.REFLECTIONS_FILE);
  const backupExists = fs.existsSync(tempReflectFile);
  let backupContent = '';
  if (backupExists) backupContent = fs.readFileSync(tempReflectFile, 'utf8');

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

test('ReflectionManager - Missing lesson shows error', async () => {
  const errSpy = [];
  const originalErr = console.error;
  console.error = (msg) => errSpy.push(msg);

  await ReflectionManager.add('TEST', '');

  console.error = originalErr;
  assert.ok(errSpy.some(m => m.includes('Usage: reflect')));
});

// --- SkillManager Tests ---

test('SkillManager - writeJson merges hooks without overwriting', async () => {
  const tempDir = path.join(process.cwd(), 'temp_test_writejson');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  const sm = new SkillManager(tempDir);

  // Write initial hooks
  await sm.writeJson('test-settings.json', {
    hooks: {
      preToolUse: [{ tools: ['grep'], message: 'Existing hook message' }]
    }
  });

  // Write new hooks — should append, not overwrite
  await sm.writeJson('test-settings.json', {
    hooks: {
      preToolUse: [{ tools: ['glob'], message: 'New hook message' }]
    }
  });

  const result = JSON.parse(fs.readFileSync(path.join(tempDir, 'test-settings.json'), 'utf8'));
  assert.strictEqual(result.hooks.preToolUse.length, 2);
  assert.ok(result.hooks.preToolUse.some(h => h.message === 'Existing hook message'));
  assert.ok(result.hooks.preToolUse.some(h => h.message === 'New hook message'));

  fs.rmSync(tempDir, { recursive: true });
});

test('SkillManager - writeJson deduplicates identical hooks', async () => {
  const tempDir = path.join(process.cwd(), 'temp_test_dedup');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  const sm = new SkillManager(tempDir);

  await sm.writeJson('test-settings.json', {
    hooks: { preToolUse: [{ tools: ['grep'], message: 'Same message' }] }
  });

  await sm.writeJson('test-settings.json', {
    hooks: { preToolUse: [{ tools: ['grep'], message: 'Same message' }] }
  });

  const result = JSON.parse(fs.readFileSync(path.join(tempDir, 'test-settings.json'), 'utf8'));
  assert.strictEqual(result.hooks.preToolUse.length, 1);

  fs.rmSync(tempDir, { recursive: true });
});

// --- CLI Tests ---

test('CLI --version prints version', async () => {
  const { execSync } = await import('node:child_process');
  const output = execSync('node index.js --version', { cwd: process.cwd(), encoding: 'utf8' });
  assert.ok(output.includes(`code-graph-llm v${CONFIG.VERSION}`));
});

test('CLI -v prints version', async () => {
  const { execSync } = await import('node:child_process');
  const output = execSync('node index.js -v', { cwd: process.cwd(), encoding: 'utf8' });
  assert.ok(output.includes(`code-graph-llm v${CONFIG.VERSION}`));
});

test('CLI --help prints usage', async () => {
  const { execSync } = await import('node:child_process');
  const output = execSync('node index.js --help', { cwd: process.cwd(), encoding: 'utf8' });
  assert.ok(output.includes('Usage:'));
  assert.ok(output.includes('generate'));
  assert.ok(output.includes('install-skills'));
});

test('CLI unknown command prints usage', async () => {
  const { execSync } = await import('node:child_process');
  const output = execSync('node index.js unknown-cmd-xyz', { cwd: process.cwd(), encoding: 'utf8' });
  assert.ok(output.includes('Usage:'));
});

// --- Security Tests ---

test('isValidPlatform accepts whitelisted platforms', () => {
  for (const p of SUPPORTED_PLATFORMS) assert.ok(isValidPlatform(p), `${p} should be valid`);
});

test('isValidPlatform rejects path traversal attempts', () => {
  const attacks = ['/../../etc', '..', '../foo', '/etc', 'claude/../etc',
    '\\..\\etc', 'claude;rm', 'claude\n', '', null, undefined, 42, {}, 'a'.repeat(33)];
  for (const a of attacks) assert.strictEqual(isValidPlatform(a), false, `${JSON.stringify(a)} should be rejected`);
});

test('SkillManager rejects invalid platform without writing files', async () => {
  const tempDir = path.join(process.cwd(), 'temp_sec_skills');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  const errs = [];
  const origErr = console.error;
  console.error = (m) => errs.push(m);

  await new SkillManager(tempDir).execute('/../../etc', 'install-skills');

  console.error = origErr;
  assert.ok(errs.some(m => m.includes('Unsupported platform')));
  assert.strictEqual(fs.readdirSync(tempDir).length, 0, 'no files should be written');

  fs.rmSync(tempDir, { recursive: true });
});

test('AgentManager rejects invalid platform', async () => {
  const tempDir = path.join(process.cwd(), 'temp_sec_agents');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  const errs = [];
  const origErr = console.error;
  console.error = (m) => errs.push(m);

  await new AgentManager(tempDir).execute('/../../etc', 'install-agent');

  console.error = origErr;
  assert.ok(errs.some(m => m.includes('Unsupported platform')));
  assert.strictEqual(fs.readdirSync(tempDir).length, 0);

  fs.rmSync(tempDir, { recursive: true });
});

test('stripDangerousKeys removes prototype pollution vectors', () => {
  const malicious = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"evil":1},"safe":"ok"}');
  const clean = stripDangerousKeys(malicious);
  assert.strictEqual(clean.safe, 'ok');
  assert.strictEqual(clean.__proto__.polluted, undefined);
  assert.strictEqual(clean.constructor, Object);
  assert.strictEqual({}.polluted, undefined);
});

test('writeJson does not pollute prototype from malicious existing file', async () => {
  const tempDir = path.join(process.cwd(), 'temp_sec_proto');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  fs.writeFileSync(path.join(tempDir, 'evil.json'),
    '{"__proto__":{"polluted":"yes"},"mcpServers":{"old":{"cmd":"x"}}}');

  const sm = new SkillManager(tempDir);
  await sm.writeJson('evil.json', { mcpServers: { new: { cmd: 'y' } } });

  assert.strictEqual({}.polluted, undefined, 'Object.prototype must not be polluted');
  const result = JSON.parse(fs.readFileSync(path.join(tempDir, 'evil.json'), 'utf8'));
  assert.ok(result.mcpServers.new);

  fs.rmSync(tempDir, { recursive: true });
});

test('ReflectionManager sanitizes newlines and long input', async () => {
  const tempFile = path.join(process.cwd(), CONFIG.REFLECTIONS_FILE);
  const backup = fs.existsSync(tempFile) ? fs.readFileSync(tempFile, 'utf8') : null;
  fs.writeFileSync(tempFile, '# LLM_LEARNINGS\n');

  const uniq = 'sanitize-test-' + Date.now();
  await ReflectionManager.add('LOGIC', `line1\nline2 ${uniq} ` + 'x'.repeat(600));
  let content = fs.readFileSync(tempFile, 'utf8');

  const entryLines = content.split('\n').filter(l => l.startsWith('- ['));
  assert.strictEqual(entryLines.length, 1, 'should produce exactly one entry');
  assert.ok(entryLines[0].startsWith('- [LOGIC]'));
  assert.ok(entryLines[0].includes(uniq));
  assert.ok(entryLines[0].length < 600, 'lesson must be length-capped');

  await ReflectionManager.add('BAD\n- [INJECTED] fake', 'another lesson ' + uniq + '-2');
  content = fs.readFileSync(tempFile, 'utf8');
  assert.ok(!content.split('\n').some(l => l.startsWith('- [INJECTED]')),
    'newline in category must not inject new bracketed entries');

  if (backup) fs.writeFileSync(tempFile, backup);
  else fs.unlinkSync(tempFile);
});

test('ProjectMapper skips files exceeding MAX_FILE_BYTES', async () => {
  const tempDir = path.join(process.cwd(), 'temp_sec_size');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  const bigPath = path.join(tempDir, 'huge.js');
  fs.writeFileSync(bigPath, 'x'.repeat(CONFIG.MAX_FILE_BYTES + 100));
  fs.writeFileSync(path.join(tempDir, 'small.js'), 'function ok() {}');

  const warns = [];
  const origWarn = console.warn;
  console.warn = (m) => warns.push(m);

  await new ProjectMapper(tempDir).generate();

  console.warn = origWarn;
  const map = fs.readFileSync(path.join(tempDir, CONFIG.MAP_FILE), 'utf8');
  assert.ok(!map.includes('huge.js'), 'oversized file must be skipped');
  assert.ok(map.includes('small.js'), 'normal file must be included');
  assert.ok(warns.some(w => w.includes('Skipping large file')));

  fs.rmSync(tempDir, { recursive: true });
});

test('ProjectMapper skips symbolic links during walk', async () => {
  const tempDir = path.join(process.cwd(), 'temp_sec_sym');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);
  fs.writeFileSync(path.join(tempDir, 'real.js'), 'function real() {}');

  const outside = path.join(process.cwd(), 'temp_sec_sym_outside.js');
  fs.writeFileSync(outside, 'function outside() {}');
  let symlinkOk = false;
  try {
    fs.symlinkSync(outside, path.join(tempDir, 'link.js'));
    symlinkOk = true;
  } catch (e) { /* privilege-required on some Windows */ }

  if (symlinkOk) {
    await new ProjectMapper(tempDir).generate();
    const map = fs.readFileSync(path.join(tempDir, CONFIG.MAP_FILE), 'utf8');
    assert.ok(map.includes('real.js'));
    assert.ok(!map.includes('link.js'), 'symlinks must not be followed');
  }

  fs.rmSync(tempDir, { recursive: true });
  fs.unlinkSync(outside);
});

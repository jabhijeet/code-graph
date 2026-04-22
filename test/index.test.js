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

test('extractEdges - Default imports do not create binding-name dependencies', () => {
  const code = `
    import React from 'react';
    import foo, { bar } from './foo';
    import './side-effect';
  `;
  const { edges } = CodeParser.extract(code);
  assert.deepStrictEqual(edges, ['./foo', './side-effect', 'react']);
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

test('ProjectMapper - Format Output Includes Inheritance Edges', () => {
  const mapper = new ProjectMapper(process.cwd());
  mapper.allEdges = ['[AdminUser] -> [inherits] -> [BaseUser]'];

  const output = mapper.formatOutput();

  assert.ok(output.includes('[AdminUser] -> [inherits] -> [BaseUser]'));
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

test('SkillManager - uninstall preserves user-owned instruction files', async () => {
  const tempDir = path.join(process.cwd(), 'temp_test_uninstall_preserve');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  const agentsPath = path.join(tempDir, 'AGENTS.md');
  fs.writeFileSync(agentsPath, '# Existing Project Instructions\nKeep this line.\n');

  const sm = new SkillManager(tempDir);
  await sm.install('codex', 'all');
  await sm.uninstall('codex', 'all');

  const content = fs.readFileSync(agentsPath, 'utf8');
  assert.ok(content.includes('Keep this line.'));
  assert.ok(!content.includes('Skill: ProjectMap'));
  assert.ok(!content.includes('Skill: Reflections'));

  fs.rmSync(tempDir, { recursive: true });
});

test('SkillManager - reflections prompt forces pre-task memory application', async () => {
  const tempDir = path.join(process.cwd(), 'temp_test_reflections_prompt');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  const sm = new SkillManager(tempDir);
  await sm.install('codex', 'reflections');

  const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
  assert.ok(content.includes('Before planning or making changes'));
  assert.ok(content.includes('apply every relevant lesson'));
  assert.ok(content.includes('same mistake'));
  assert.ok(content.includes('Do not finish'));

  fs.rmSync(tempDir, { recursive: true });
});

test('SkillManager - reinstall replaces old weak reflections prompt', async () => {
  const tempDir = path.join(process.cwd(), 'temp_test_reflections_upgrade');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  const oldPrompt = '\n## 🧠 Skill: Reflections\nFollow the reflection cycle: Read `llm-agent-project-learnings.md` for past lessons and run `code-graph reflect` after any bug fix or failure.\n';
  const intermediatePrompt = '\n## 🧠 Skill: Reflections\nBefore planning or making changes, read `llm-agent-project-learnings.md` and apply every relevant lesson to the current task.\nIf a lesson matches the current file, tool, OS, dependency, or failure mode, treat it as an active constraint and mention how it changes your approach.\nIf you hit a failure, correction, repeated mistake, or non-obvious project behavior, run `code-graph reflect <CAT> <LESSON>` with a concise reusable lesson.\nDo not finish a bug fix, failed-command recovery, or environment workaround without either recording a new reflection or explicitly stating that no new reusable lesson was learned.\nThe goal is to avoid the same mistake across agents and sessions, not just to append notes after the fact.\n';
  fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Existing Project Instructions\n' + oldPrompt + intermediatePrompt);

  const sm = new SkillManager(tempDir);
  await sm.install('codex', 'reflections');

  const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
  assert.ok(content.includes('# Existing Project Instructions'));
  assert.strictEqual(content.includes(oldPrompt.trim()), false);
  assert.strictEqual(content.includes(intermediatePrompt.trim()), false);
  assert.strictEqual((content.match(/Skill: Reflections/g) || []).length, 1);
  assert.ok(content.includes('apply every relevant lesson'));
  assert.ok(content.includes(CONFIG.RULES_FILE));

  fs.rmSync(tempDir, { recursive: true });
});

test('AgentManager - Claude MCP config points to stdio server mode', async () => {
  const tempDir = path.join(process.cwd(), 'temp_test_mcp_config');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDir);

  await new AgentManager(tempDir).install('claude');

  const data = JSON.parse(fs.readFileSync(path.join(tempDir, '.mcp.json'), 'utf8'));
  assert.strictEqual(data.mcpServers['code-graph'].command, 'node');
  assert.ok(data.mcpServers['code-graph'].args.includes('mcp'));
  assert.ok(!data.mcpServers['code-graph'].args.includes('generate'));

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

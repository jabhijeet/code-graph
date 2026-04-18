/**
 * Platform integration audit script.
 * Tests install-skills + install-agent for every platform,
 * then validates files, content, and structure.
 */
import { SkillManager } from '../lib/skills.js';
import { AgentManager } from '../lib/agents.js';
import { CONFIG } from '../lib/config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const baseDir = path.resolve('D:/tmp/cg-test');
const home = os.homedir();
const issues = [];
let passCount = 0;

function check(label, condition, detail) {
  if (!condition) {
    issues.push('[FAIL] ' + label + (detail ? ': ' + detail : ''));
  } else {
    passCount++;
  }
}

function fileExists(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const expectations = {
  claude: {
    localFiles: [
      'CLAUDE.md',
      '.claude/settings.json',
      '.claude/skills/projectmap/SKILL.md',
      '.claude/skills/reflections/SKILL.md',
      '.claude/agents/code-graph.md',
      '.mcp.json'
    ],
    globalFiles: [],
    skillChecks: [
      { file: 'CLAUDE.md', contains: ['ProjectMap', 'Reflections', CONFIG.MAP_FILE, CONFIG.REFLECTIONS_FILE] },
      { file: '.claude/skills/projectmap/SKILL.md', contains: ['name: projectmap', 'description:', CONFIG.MAP_FILE] },
      { file: '.claude/skills/reflections/SKILL.md', contains: ['name: reflections', 'description:', CONFIG.REFLECTIONS_FILE] },
      { file: '.claude/settings.json', json: true, check: (d) => {
        const entry = d.hooks?.PreToolUse?.[0];
        return entry && entry.matcher && Array.isArray(entry.hooks) && entry.hooks[0]?.type === 'command';
      }},
      { file: '.mcp.json', json: true, check: (d) => d.mcpServers?.['code-graph']?.args?.[0]?.endsWith('index.js') }
    ],
    agentCheck: {
      file: '.claude/agents/code-graph.md',
      contains: ['name: code-graph', 'description:', 'tools:', 'code-graph generate']
    }
  },
  cursor: {
    localFiles: ['.cursor/rules/projectmap.mdc', '.cursor/rules/reflections.mdc', '.cursor/mcp.json'],
    globalFiles: [],
    skillChecks: [
      { file: '.cursor/rules/projectmap.mdc', contains: ['alwaysApply: true', CONFIG.MAP_FILE] },
      { file: '.cursor/rules/reflections.mdc', contains: ['alwaysApply: true', CONFIG.RULES_FILE] }
    ],
    agentCheck: {
      file: '.cursor/mcp.json', json: true,
      check: (d) => d.mcpServers?.['code-graph'] != null
    }
  },
  gemini: {
    localFiles: ['GEMINI.md'],
    globalFiles: ['.gemini/skills/projectmap/SKILL.md', '.gemini/skills/reflections/SKILL.md', '.gemini/agents/code-graph.md'],
    skillChecks: [
      { file: 'GEMINI.md', contains: ['ProjectMap', '@./' + CONFIG.MAP_FILE, 'Reflections'] }
    ],
    agentCheck: {
      globalFile: '.gemini/agents/code-graph.md',
      contains: ['name: code-graph', 'code-graph generate']
    }
  },
  codex: {
    localFiles: ['AGENTS.md', '.codex/hooks.json'],
    globalFiles: [],
    skillChecks: [
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections'] },
      { file: '.codex/hooks.json', json: true, check: (d) => d.hooks?.preToolUse?.length > 0 }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  opencode: {
    localFiles: ['AGENTS.md', '.opencode/plugins/projectmap.js', 'opencode.json'],
    globalFiles: [],
    skillChecks: [
      { file: 'AGENTS.md', contains: ['ProjectMap'] },
      { file: '.opencode/plugins/projectmap.js', contains: ['projectmap'] },
      { file: 'opencode.json', json: true, check: (d) => Array.isArray(d.plugins) }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  antigravity: {
    localFiles: [
      '.agent/skills/projectmap/SKILL.md',
      '.agent/skills/reflections/SKILL.md',
      '.agent/rules/projectmap.md',
      '.agent/rules/reflections.md',
      'AGENTS.md',
      'GEMINI.md'
    ],
    globalFiles: [
      '.gemini/antigravity/skills/code-graph/SKILL.md',
      '.gemini/antigravity/mcp_config.json'
    ],
    skillChecks: [
      { file: '.agent/skills/projectmap/SKILL.md', contains: ['name: projectmap', 'description:', CONFIG.MAP_FILE] },
      { file: '.agent/skills/reflections/SKILL.md', contains: ['name: reflections', 'description:', CONFIG.REFLECTIONS_FILE] },
      { file: '.agent/rules/projectmap.md', contains: [CONFIG.MAP_FILE] },
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections'] },
      { file: 'GEMINI.md', contains: ['ProjectMap', '@./' + CONFIG.MAP_FILE] }
    ],
    agentCheck: {
      globalFile: '.gemini/antigravity/skills/code-graph/SKILL.md',
      contains: ['name: code-graph', 'description:', 'code-graph generate']
    }
  },
  kiro: {
    localFiles: ['.kiro/steering/projectmap.md'],
    globalFiles: ['.kiro/skills/projectmap/SKILL.md', '.kiro/skills/reflections/SKILL.md', '.kiro/agents/code-graph/AGENT.md'],
    skillChecks: [
      { file: '.kiro/steering/projectmap.md', contains: [CONFIG.MAP_FILE] }
    ],
    agentCheck: {
      globalFile: '.kiro/agents/code-graph/AGENT.md',
      contains: ['Code-Graph']
    }
  },
  intellij: {
    localFiles: ['AGENTS.md'],
    globalFiles: [],
    skillChecks: [
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  copilot: {
    localFiles: [],
    globalFiles: ['.copilot/skills/projectmap/SKILL.md', '.copilot/skills/reflections/SKILL.md'],
    skillChecks: [],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  vscode: {
    localFiles: ['.github/copilot-instructions.md'],
    globalFiles: [],
    skillChecks: [
      { file: '.github/copilot-instructions.md', contains: ['ProjectMap', 'Reflections'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  roocode: {
    localFiles: ['.clinerules', '.roorules'],
    globalFiles: [],
    skillChecks: [
      { file: '.clinerules', contains: ['ProjectMap', 'Reflections'] },
      { file: '.roorules', contains: ['ProjectMap', 'Reflections'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  aider: {
    localFiles: ['AGENTS.md'],
    globalFiles: ['.aider/skills/projectmap/SKILL.md', '.aider/skills/reflections/SKILL.md'],
    skillChecks: [
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  }
};

// Suppress console.log from the modules
const origLog = console.log;
const origWarn = console.warn;
console.log = () => {};
console.warn = () => {};

for (const [platform, expect] of Object.entries(expectations)) {
  const pDir = path.join(baseDir, platform);
  fs.rmSync(pDir, { recursive: true, force: true });
  fs.mkdirSync(pDir, { recursive: true });

  // INSTALL
  const sm = new SkillManager(pDir);
  try { await sm.install(platform, 'all'); }
  catch(e) { issues.push('[FAIL] ' + platform + ' skill install threw: ' + e.message); }

  const am = new AgentManager(pDir);
  try { await am.install(platform); }
  catch(e) { issues.push('[FAIL] ' + platform + ' agent install threw: ' + e.message); }

  // CHECK LOCAL FILES
  for (const f of expect.localFiles) {
    check(platform + ' local: ' + f, fileExists(path.join(pDir, f)), 'file not created');
  }

  // CHECK GLOBAL FILES
  for (const f of expect.globalFiles) {
    check(platform + ' global: ~/' + f, fileExists(path.join(home, f)), 'file not created');
  }

  // CHECK SKILL CONTENT
  for (const sc of expect.skillChecks) {
    const fp = path.join(pDir, sc.file);
    const content = readFile(fp);
    if (!content) {
      issues.push('[FAIL] ' + platform + ' skill content: ' + sc.file + ' not readable');
      continue;
    }
    if (sc.contains) {
      for (const s of sc.contains) {
        check(platform + ' ' + sc.file + ' contains "' + s + '"', content.includes(s), 'missing');
      }
    }
    if (sc.json) {
      try {
        const data = JSON.parse(content);
        if (sc.check) check(platform + ' ' + sc.file + ' json check', sc.check(data), 'structure invalid');
      } catch(e) {
        issues.push('[FAIL] ' + platform + ' ' + sc.file + ' invalid JSON');
      }
    }
  }

  // CHECK AGENT
  const ac = expect.agentCheck;
  if (ac) {
    const fp = ac.globalFile ? path.join(home, ac.globalFile) : path.join(pDir, ac.file);
    const content = readFile(fp);
    if (!content) {
      issues.push('[FAIL] ' + platform + ' agent: ' + (ac.globalFile || ac.file) + ' not readable');
    } else {
      if (ac.contains) {
        for (const s of ac.contains) {
          check(platform + ' agent contains "' + s + '"', content.includes(s), 'missing in ' + (ac.globalFile || ac.file));
        }
      }
      if (ac.json) {
        try {
          const data = JSON.parse(content);
          if (ac.check) check(platform + ' agent json check', ac.check(data), 'structure invalid');
        } catch(e) {
          issues.push('[FAIL] ' + platform + ' agent invalid JSON');
        }
      }
    }
  }
}

// Restore console
console.log = origLog;
console.warn = origWarn;

console.log('');
console.log('=== PLATFORM AUDIT RESULTS ===');
console.log('Platforms tested: ' + Object.keys(expectations).length);
console.log('Checks passed: ' + passCount);
console.log('Issues found: ' + issues.length);
console.log('');

if (issues.length > 0) {
  for (const i of issues) console.log(i);
} else {
  console.log('ALL PLATFORMS PASS');
}

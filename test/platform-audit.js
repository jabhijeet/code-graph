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
      '.claude/skills/thinkbeforecoding/SKILL.md',
      '.claude/skills/goaldriven/SKILL.md',
      '.claude/skills/changelimit/SKILL.md',
      '.claude/skills/contextbudget/SKILL.md',
      '.claude/agents/code-graph.md',
      '.claude/agents/code-graph-locator.md',
      '.claude/agents/code-graph-tracer.md',
      '.claude/agents/code-graph-reviewer.md'
    ],
    globalFiles: [],
    skillChecks: [
      { file: 'CLAUDE.md', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'GoalDriven', 'SurgicalChanges', 'ContextBudget', CONFIG.MAP_FILE, CONFIG.REFLECTIONS_FILE] },
      { file: 'CLAUDE.md', absent: ['RepoContext'] },
      { file: '.claude/skills/projectmap/SKILL.md', contains: ['name: projectmap', 'description:', CONFIG.MAP_FILE] },
      { file: '.claude/skills/reflections/SKILL.md', contains: ['name: reflections', 'description:', CONFIG.REFLECTIONS_FILE] },
      { file: '.claude/skills/thinkbeforecoding/SKILL.md', contains: ['name: thinkbeforecoding', 'State assumptions'] },
      { file: '.claude/skills/goaldriven/SKILL.md', contains: ['name: goaldriven', 'verifiable terms'] },
      { file: '.claude/skills/changelimit/SKILL.md', contains: ['name: changelimit', 'SurgicalChanges'] },
      { file: '.claude/skills/contextbudget/SKILL.md', contains: ['name: contextbudget', 'description:', 'compact rolling summary'] },
      { file: '.claude/settings.json', json: true, check: (d) => {
        const entry = d.hooks?.PreToolUse?.[0];
        if (!entry || !Array.isArray(entry.hooks) || entry.hooks[0]?.type !== 'command') return false;
        return /Read/.test(entry.matcher) && /Grep/.test(entry.matcher) && /Glob/.test(entry.matcher);
      }}
    ],
    agentCheck: {
      file: '.claude/agents/code-graph.md',
      contains: ['name: code-graph', 'description:', 'tools:', 'code-graph generate']
    }
  },
  cursor: {
    localFiles: [
      '.cursor/rules/projectmap.mdc',
      '.cursor/rules/reflections.mdc',
      '.cursor/rules/thinkbeforecoding.mdc',
      '.cursor/rules/simplicity.mdc',
      '.cursor/rules/changelimit.mdc',
      '.cursor/rules/goaldriven.mdc',
      '.cursor/rules/freshdeps.mdc',
      '.cursor/rules/contextbudget.mdc'
    ],
    globalFiles: [],
    skillChecks: [
      { file: '.cursor/rules/projectmap.mdc', contains: ['alwaysApply: true', CONFIG.MAP_FILE] },
      { file: '.cursor/rules/reflections.mdc', contains: ['alwaysApply: true', CONFIG.RULES_FILE] },
      { file: '.cursor/rules/thinkbeforecoding.mdc', contains: ['alwaysApply: true', 'ThinkBeforeCoding'] },
      { file: '.cursor/rules/simplicity.mdc', contains: ['alwaysApply: true', 'Simplicity'] },
      { file: '.cursor/rules/changelimit.mdc', contains: ['alwaysApply: true', 'SurgicalChanges'] },
      { file: '.cursor/rules/goaldriven.mdc', contains: ['alwaysApply: true', 'GoalDriven'] },
      { file: '.cursor/rules/freshdeps.mdc', contains: ['alwaysApply: true', 'FreshDeps'] },
      { file: '.cursor/rules/contextbudget.mdc', contains: ['alwaysApply: true', 'ContextBudget'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  gemini: {
    localFiles: ['GEMINI.md'],
    globalFiles: ['.gemini/agents/code-graph.md'],
    skillChecks: [
      { file: 'GEMINI.md', contains: ['ProjectMap', '@./' + CONFIG.MAP_FILE, 'Reflections', 'ThinkBeforeCoding', 'Simplicity', 'SurgicalChanges', 'GoalDriven', 'FreshDeps', 'ContextBudget'] }
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
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'GoalDriven', 'SurgicalChanges', 'ContextBudget'] },
      { file: 'AGENTS.md', absent: ['RepoContext'] },
      { file: '.codex/hooks.json', json: true, check: (d) => d.codex_hooks === true && d.hooks?.PreToolUse?.length > 0 }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  opencode: {
    localFiles: ['AGENTS.md', '.opencode/plugins/projectmap.js', '.opencode/plugins/thinkbeforecoding.js', '.opencode/plugins/goaldriven.js', '.opencode/plugins/contextbudget.js', 'opencode.json'],
    globalFiles: [],
    skillChecks: [
      { file: 'AGENTS.md', contains: ['ProjectMap', 'ThinkBeforeCoding', 'GoalDriven', 'ContextBudget'] },
      { file: 'AGENTS.md', absent: ['RepoContext'] },
      { file: '.opencode/plugins/projectmap.js', contains: ['projectmap'] },
      { file: '.opencode/plugins/thinkbeforecoding.js', contains: ['thinkbeforecoding'] },
      { file: '.opencode/plugins/goaldriven.js', contains: ['goaldriven'] },
      { file: '.opencode/plugins/contextbudget.js', contains: ['contextbudget'] },
      { file: 'opencode.json', json: true, check: (d) => Array.isArray(d.plugins) }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  antigravity: {
    localFiles: [
      '.agent/skills/projectmap/SKILL.md',
      '.agent/skills/reflections/SKILL.md',
      '.agent/skills/thinkbeforecoding/SKILL.md',
      '.agent/skills/simplicity/SKILL.md',
      '.agent/skills/changelimit/SKILL.md',
      '.agent/skills/goaldriven/SKILL.md',
      '.agent/skills/freshdeps/SKILL.md',
      '.agent/skills/contextbudget/SKILL.md',
      '.agent/rules/projectmap.md',
      '.agent/rules/reflections.md',
      '.agent/rules/thinkbeforecoding.md',
      '.agent/rules/simplicity.md',
      '.agent/rules/changelimit.md',
      '.agent/rules/goaldriven.md',
      '.agent/rules/freshdeps.md',
      '.agent/rules/contextbudget.md',
      'AGENTS.md',
      'GEMINI.md'
    ],
    globalFiles: ['.gemini/antigravity/skills/code-graph/SKILL.md'],
    skillChecks: [
      { file: '.agent/skills/projectmap/SKILL.md', contains: ['name: projectmap', 'description:', CONFIG.MAP_FILE] },
      { file: '.agent/skills/reflections/SKILL.md', contains: ['name: reflections', 'description:', CONFIG.REFLECTIONS_FILE] },
      { file: '.agent/skills/thinkbeforecoding/SKILL.md', contains: ['name: thinkbeforecoding', 'State assumptions'] },
      { file: '.agent/skills/simplicity/SKILL.md', contains: ['name: simplicity', 'Simplicity'] },
      { file: '.agent/skills/changelimit/SKILL.md', contains: ['name: changelimit', 'SurgicalChanges'] },
      { file: '.agent/skills/goaldriven/SKILL.md', contains: ['name: goaldriven', 'verifiable terms'] },
      { file: '.agent/skills/freshdeps/SKILL.md', contains: ['name: freshdeps', 'latest stable compatible dependencies'] },
      { file: '.agent/skills/contextbudget/SKILL.md', contains: ['name: contextbudget', 'description:', 'compact rolling summary'] },
      { file: '.agent/rules/projectmap.md', contains: [CONFIG.MAP_FILE] },
      { file: '.agent/rules/thinkbeforecoding.md', contains: ['ThinkBeforeCoding'] },
      { file: '.agent/rules/changelimit.md', contains: ['SurgicalChanges'] },
      { file: '.agent/rules/goaldriven.md', contains: ['GoalDriven'] },
      { file: '.agent/rules/freshdeps.md', contains: ['FreshDeps'] },
      { file: '.agent/rules/contextbudget.md', contains: ['ContextBudget'] },
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'Simplicity', 'SurgicalChanges', 'GoalDriven', 'FreshDeps', 'ContextBudget'] },
      { file: 'AGENTS.md', absent: ['RepoContext'] },
      { file: 'GEMINI.md', contains: ['ProjectMap', '@./' + CONFIG.MAP_FILE, 'SurgicalChanges', 'GoalDriven'] }
    ],
    agentCheck: {
      globalFile: '.gemini/antigravity/skills/code-graph/SKILL.md',
      contains: ['name: code-graph', 'description:', 'code-graph generate']
    }
  },
  kiro: {
    localFiles: [
      '.kiro/steering/projectmap.md',
      '.kiro/steering/reflections.md',
      '.kiro/steering/thinkbeforecoding.md',
      '.kiro/steering/simplicity.md',
      '.kiro/steering/changelimit.md',
      '.kiro/steering/goaldriven.md',
      '.kiro/steering/freshdeps.md',
      '.kiro/steering/contextbudget.md'
    ],
    globalFiles: ['.kiro/agents/code-graph/AGENT.md'],
    skillChecks: [
      { file: '.kiro/steering/projectmap.md', contains: [CONFIG.MAP_FILE] },
      { file: '.kiro/steering/reflections.md', contains: ['Reflections'] },
      { file: '.kiro/steering/thinkbeforecoding.md', contains: ['ThinkBeforeCoding'] },
      { file: '.kiro/steering/simplicity.md', contains: ['Simplicity'] },
      { file: '.kiro/steering/changelimit.md', contains: ['SurgicalChanges'] },
      { file: '.kiro/steering/goaldriven.md', contains: ['GoalDriven'] },
      { file: '.kiro/steering/freshdeps.md', contains: ['FreshDeps'] },
      { file: '.kiro/steering/contextbudget.md', contains: ['ContextBudget'] }
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
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'GoalDriven', 'ContextBudget'] },
      { file: 'AGENTS.md', absent: ['RepoContext'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  copilot: {
    localFiles: ['AGENTS.md'],
    globalFiles: [],
    skillChecks: [
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'Simplicity', 'SurgicalChanges', 'GoalDriven', 'FreshDeps', 'ContextBudget'] },
      { file: 'AGENTS.md', absent: ['RepoContext'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  vscode: {
    localFiles: ['.github/copilot-instructions.md'],
    globalFiles: [],
    skillChecks: [
      { file: '.github/copilot-instructions.md', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'GoalDriven', 'ContextBudget'] },
      { file: '.github/copilot-instructions.md', absent: ['RepoContext'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  roocode: {
    localFiles: ['.clinerules', '.roorules'],
    globalFiles: [],
    skillChecks: [
      { file: '.clinerules', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'GoalDriven', 'ContextBudget'] },
      { file: '.clinerules', absent: ['RepoContext'] },
      { file: '.roorules', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'GoalDriven', 'ContextBudget'] },
      { file: '.roorules', absent: ['RepoContext'] }
    ],
    agentCheck: { file: '.code-graph-agent.md', contains: ['Code-Graph Specialist'] }
  },
  aider: {
    localFiles: ['AGENTS.md'],
    globalFiles: [],
    skillChecks: [
      { file: 'AGENTS.md', contains: ['ProjectMap', 'Reflections', 'ThinkBeforeCoding', 'Simplicity', 'SurgicalChanges', 'GoalDriven', 'FreshDeps', 'ContextBudget'] },
      { file: 'AGENTS.md', absent: ['RepoContext'] }
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
    if (sc.absent) {
      for (const s of sc.absent) {
        check(platform + ' ' + sc.file + ' must not contain "' + s + '"', !content.includes(s), 'still present');
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

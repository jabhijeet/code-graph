/**
 * @file lib/skills/platforms.js
 * @description Platform-specific skill installation logic.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG, PLATFORM_GLOBAL_PATHS } from '../config.js';
import { logInstallTarget } from '../install-log.js';

/**
 * Get the global skills directory for a platform.
 */
export function globalSkillsDir(platform, skillName = '') {
  const custom = PLATFORM_GLOBAL_PATHS[platform];
  const baseDir = custom
    ? path.join(os.homedir(), ...custom)
    : path.join(os.homedir(), `.${platform}`, 'skills');
  return {
    dir: path.join(baseDir, skillName),
    skillPath: path.join(baseDir, skillName, 'SKILL.md')
  };
}

/**
 * Install a skill at the global (user-level) scope for a given platform.
 */
export async function installGlobalSkill(platform, skillName, description, body) {
  const { dir, skillPath } = globalSkillsDir(platform, skillName);
  const frontmatter = `---\nname: ${skillName}\ndescription: ${description}\n---\n`;
  const content = body && body.startsWith('---') ? body : `${frontmatter}${body || ''}`;
  try {
    // Wipe any stale artifacts from a prior install so the new version starts from scratch.
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(skillPath, content);
    logInstallTarget(skillPath);
  } catch (e) {
    console.warn(`[Code-Graph] Warning: Could not install global skill for ${platform}/${skillName}: ${e.message}`);
  }
}

/**
 * Project-level install dispatcher. Routes to the correct platform handler.
 */
export async function installProjectSkill(p, spec, cwd, fileHelpers) {
  const { name, section, body } = spec;
  const { appendToFile, writeFile, writeJson, removeJsonHookEntry } = fileHelpers;

  switch (p) {
    case 'claude':
      if (section) await appendToFile('CLAUDE.md', section);
      if (spec.claudeSkill) await writeFile(`.claude/skills/${name}/SKILL.md`, spec.claudeSkill);
      if (spec.claudeHook) {
        await writeJson('.claude/settings.json', {
          hooks: {
            PreToolUse: [{
              matcher: spec.claudeHook.matcher,
              hooks: [{ type: 'command', command: spec.claudeHook.command }]
            }]
          }
        });
      }
      break;
    case 'cursor':
      if (spec.cursorRule) await writeFile(`.cursor/rules/${name}.mdc`, spec.cursorRule);
      break;
    case 'gemini':
      if (section) {
        const content = spec.geminiPrependsMapRef
          ? `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${section}`
          : section;
        await appendToFile('GEMINI.md', content);
      }
      break;
    case 'codex':
      if (section) await appendToFile('AGENTS.md', section);
      if (spec.codexHookMessage) {
        await removeJsonHookEntry('.codex/hooks.json', entry =>
          JSON.stringify(entry).includes(spec.codexHookMessage));
        await writeJson('.codex/hooks.json', {
          codex_hooks: true,
          hooks: {
            PreToolUse: [{
              matcher: 'Bash',
              hooks: [{ type: 'command', command: `echo "${spec.codexHookMessage}"` }]
            }]
          }
        });
      }
      break;
    case 'opencode':
      if (section) await appendToFile('AGENTS.md', section);
      if (spec.opencodePlugin) {
        const pluginPath = `.opencode/plugins/${name}.js`;
        await writeFile(pluginPath, spec.opencodePlugin);
        await writeJson('opencode.json', { plugins: [`./${pluginPath}`] });
      }
      break;
    case 'antigravity':
      if (spec.antigravitySkill) await writeFile(`.agent/skills/${name}/SKILL.md`, spec.antigravitySkill);
      if (spec.antigravityRule) await writeFile(`.agent/rules/${name}.md`, spec.antigravityRule);
      if (section) {
        await appendToFile('AGENTS.md', section);
        const geminiContent = spec.geminiPrependsMapRef
          ? `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${section}`
          : section;
        await appendToFile('GEMINI.md', geminiContent);
      }
      break;
    case 'kiro':
      if (spec.kiroSteering) await writeFile(`.kiro/steering/${name}.md`, spec.kiroSteering);
      break;
    case 'copilot':
      if (section) await appendToFile('AGENTS.md', section);
      break;
    case 'vscode':
      if (section) await appendToFile('.github/copilot-instructions.md', section);
      break;
    case 'roocode': {
      const rooSection = spec.roocodeSection || section;
      if (rooSection) {
        await appendToFile('.clinerules', rooSection);
        await appendToFile('.roorules', rooSection);
      }
      break;
    }
    case 'intellij':
      if (section) await appendToFile('AGENTS.md', section);
      break;
    default:
      if (section) await appendToFile('AGENTS.md', section);
  }
}

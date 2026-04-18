/**
 * @file lib/skills.js
 * @description Manages platform-specific skills and agent integrations.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG, SUPPORTED_PLATFORMS, isValidPlatform, stripDangerousKeys } from './config.js';

const VALID_SKILLS = new Set(['all', 'projectmap', 'reflections']);

export class SkillManager {
  constructor(cwd) {
    this.cwd = cwd;
    this.home = os.homedir();
  }

  async execute(platform, action, skill) {
    if (!platform) return console.error('[Code-Graph] Platform required. Usage: code-graph install-skills <platform> [projectmap|reflections]');
    if (!isValidPlatform(platform)) {
      return console.error(`[Code-Graph] Unsupported platform: ${platform}. Valid: ${SUPPORTED_PLATFORMS.join(', ')}`);
    }
    const p = platform.toLowerCase();
    const act = (action || 'install-skills').toLowerCase();
    const s = (skill || 'all').toLowerCase();

    if (!VALID_SKILLS.has(s)) {
      return console.error(`[Code-Graph] Unknown skill: ${skill}. Valid: projectmap, reflections, all`);
    }

    if (act === 'install-skills') await this.install(p, s);
    else if (act === 'uninstall-skills') await this.uninstall(p, s);
    else console.error(`[Code-Graph] Unknown action: ${act}. Use install-skills or uninstall-skills.`);
  }

  async install(p, s) {
    console.log(`[Code-Graph] Running install-skills (${s}) for ${p}...`);
    try {
      if (s === 'all' || s === 'projectmap') await this.installProjectMap(p);
      if (s === 'all' || s === 'reflections') await this.installReflections(p);
      console.log(`[Code-Graph] Successfully completed install-skills for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] install-skills failed for ${p}: ${err.message}`);
    }
  }

  async installProjectMap(p) {
    const section = this.projectMapSection();
    const description = 'Use the project knowledge graph for navigation and architectural awareness.';
    const body = `# ProjectMap Skill\nUse \`${CONFIG.MAP_FILE}\` for project navigation and architectural awareness.\n`;

    switch (p) {
      case 'claude':
        await this.appendToFile('CLAUDE.md', section);
        await this.writeFile('.claude/skills/projectmap/SKILL.md', `---\nname: projectmap\ndescription: ${description}\n---\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` for architectural context and god nodes before searching raw files. Refresh with \`code-graph generate\` if stale.\n`);
        await this.writeJson('.claude/settings.json', {
          hooks: {
            PreToolUse: [{
              matcher: 'Grep|Glob',
              hooks: [{
                type: 'command',
                command: `echo "Skill(ProjectMap): Knowledge graph exists. Read ${CONFIG.MAP_FILE} before searching raw files."`
              }]
            }]
          }
        });
        break;
      case 'cursor':
        await this.writeFile('.cursor/rules/projectmap.mdc', `---\ndescription: Use knowledge graph for navigation.\nalwaysApply: true\n---\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` to locate core logic and dependencies.\n`);
        break;
      case 'gemini':
        await this.installGlobalSkill('gemini', 'projectmap', description, body);
        await this.appendToFile('GEMINI.md', `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${section}`);
        break;
      case 'codex':
        await this.appendToFile('AGENTS.md', section);
        await this.writeJson('.codex/hooks.json', { hooks: { preToolUse: [{ tools: ['bash'], message: `Skill(ProjectMap): Read ${CONFIG.MAP_FILE} for architectural context.` }] } });
        break;
      case 'opencode':
        await this.appendToFile('AGENTS.md', section);
        await this.writeFile('.opencode/plugins/projectmap.js', `export default { name: 'projectmap', beforeExecute: (t) => { if (t.name === 'bash') return "Read ${CONFIG.MAP_FILE} for god nodes."; } };`);
        await this.writeJson('opencode.json', { plugins: ['./.opencode/plugins/projectmap.js'] });
        break;
      case 'antigravity':
        await this.writeFile('.agent/skills/projectmap/SKILL.md', `---\nname: projectmap\ndescription: ${description}\n---\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` before searching raw files for architectural context.\n`);
        await this.writeFile('.agent/rules/projectmap.md', `# ProjectMap\nAlways read \`${CONFIG.MAP_FILE}\` for architectural context before searching raw files.\n`);
        await this.appendToFile('AGENTS.md', section);
        await this.appendToFile('GEMINI.md', `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${section}`);
        break;
      case 'kiro':
        await this.installGlobalSkill('kiro', 'projectmap', description, body);
        await this.writeFile('.kiro/steering/projectmap.md', `inclusion: always\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\`.\n`);
        break;
      case 'intellij':
        await this.appendToFile('AGENTS.md', section);
        break;
      case 'copilot':
        await this.installGlobalSkill('copilot', 'projectmap', description, body);
        break;
      case 'vscode':
        await this.appendToFile('.github/copilot-instructions.md', section);
        break;
      case 'roocode':
        await this.appendToFile('.clinerules', section);
        await this.appendToFile('.roorules', section);
        break;
      default:
        await this.appendToFile('AGENTS.md', section);
        await this.installGlobalSkill(p, 'projectmap', description, body);
    }
  }

  async installReflections(p) {
    const section = this.reflectionsSection();
    const description = 'Persist and retrieve project-specific lessons and environment quirks. Follow the reflection cycle after any bug fix or failure.';
    const body = `# Reflections Skill\nUse \`${CONFIG.REFLECTIONS_FILE}\` to persist and retrieve project-specific lessons and environment quirks.\n`;

    switch (p) {
      case 'claude':
        await this.appendToFile('CLAUDE.md', section);
        await this.writeFile('.claude/skills/reflections/SKILL.md', `---\nname: reflections\ndescription: ${description}\n---\n# Reflections\nFollow the reflection cycle in \`${CONFIG.RULES_FILE}\`. Before answering, read \`${CONFIG.REFLECTIONS_FILE}\` for past lessons. After resolving a non-obvious issue, record a lesson via \`code-graph reflect <category> <lesson>\`.\n`);
        break;
      case 'cursor':
        await this.writeFile('.cursor/rules/reflections.mdc', `---\ndescription: Mandatory reflection cycle.\nalwaysApply: true\n---\n# Reflections\nFollow \`${CONFIG.RULES_FILE}\`. Update \`${CONFIG.REFLECTIONS_FILE}\` after every fix.\n`);
        break;
      case 'gemini':
        await this.installGlobalSkill('gemini', 'reflections', description, body);
        await this.appendToFile('GEMINI.md', section);
        break;
      case 'antigravity':
        await this.writeFile('.agent/skills/reflections/SKILL.md', `---\nname: reflections\ndescription: ${description}\n---\n# Reflections\nFollow the reflection cycle in \`${CONFIG.RULES_FILE}\`. Persist lessons to \`${CONFIG.REFLECTIONS_FILE}\`.\n`);
        await this.writeFile('.agent/rules/reflections.md', `# Reflections\nFollow the reflection cycle in \`${CONFIG.RULES_FILE}\`.\n`);
        await this.appendToFile('AGENTS.md', section);
        await this.appendToFile('GEMINI.md', section);
        break;
      case 'kiro':
        await this.installGlobalSkill('kiro', 'reflections', description, body);
        break;
      case 'copilot':
        await this.installGlobalSkill('copilot', 'reflections', description, body);
        break;
      case 'vscode':
        await this.appendToFile('.github/copilot-instructions.md', section);
        break;
      case 'roocode':
        const rules = `\n# Reflections Protocol\nStrictly follow the reflection cycle in \`${CONFIG.RULES_FILE}\`. Persist lessons to \`${CONFIG.REFLECTIONS_FILE}\`.\n`;
        await this.appendToFile('.clinerules', rules);
        await this.appendToFile('.roorules', rules);
        break;
      default:
        await this.appendToFile('AGENTS.md', section);
        await this.installGlobalSkill(p, 'reflections', description, body);
    }
  }

  async installGlobalSkill(platform, skillName, description, body) {
    const skillDir = path.join(this.home, `.${platform}`, 'skills', skillName);
    const skillPath = path.join(skillDir, 'SKILL.md');
    const frontmatter = `---\nname: ${skillName}\ndescription: ${description}\n---\n`;
    const content = body && body.startsWith('---') ? body : `${frontmatter}${body || ''}`;
    try {
      // Wipe any stale artifacts from a prior install so the new version starts from scratch.
      await fsp.rm(skillDir, { recursive: true, force: true });
      await fsp.mkdir(skillDir, { recursive: true });
      await fsp.writeFile(skillPath, content);
    } catch (e) {
      console.warn(`[Code-Graph] Warning: Could not install global skill for ${platform}/${skillName}: ${e.message}`);
    }
  }

  async uninstall(p, s) {
    console.log(`[Code-Graph] Running uninstall-skills (${s}) for ${p}...`);
    try {
      const skillsDir = (platform) => path.join(this.home, `.${platform}`, 'skills');

      if (s === 'all' || s === 'projectmap') {
        await this.removeFromFile('CLAUDE.md', this.projectMapSection());
        await this.removeFromFile('GEMINI.md', `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${this.projectMapSection()}`);
        await this.removeFromFile('AGENTS.md', this.projectMapSection());
        await this.removeFromFile('.github/copilot-instructions.md', this.projectMapSection());
        await this.removeFromFile('.clinerules', this.projectMapSection());
        await this.removeFromFile('.roorules', this.projectMapSection());
        await fsp.rm(path.join(this.cwd, '.claude', 'skills', 'projectmap'), { recursive: true, force: true });
        await this.removeFile('.cursor/rules/projectmap.mdc');
        await this.removeFile('.agent/rules/projectmap.md');
        await this.removeFile('.agent/workflows/projectmap.md');
        await fsp.rm(path.join(this.cwd, '.agent', 'skills', 'projectmap'), { recursive: true, force: true });
        await this.removeFile('.kiro/steering/projectmap.md');
        await this.removeFile('.opencode/plugins/projectmap.js');
        await this.removeJsonHookEntry('.claude/settings.json', entry =>
          JSON.stringify(entry).includes('Skill(ProjectMap)'));
        await this.removeJsonHookEntry('.codex/hooks.json', entry =>
          entry?.message?.includes('Skill(ProjectMap)'));
        await this.removeJsonArrayValue('opencode.json', 'plugins', './.opencode/plugins/projectmap.js');
        await fsp.rm(path.join(skillsDir(p), 'projectmap'), { recursive: true, force: true });
      }

      if (s === 'all' || s === 'reflections') {
        await this.removeFromFile('CLAUDE.md', this.reflectionsSection());
        await this.removeFromFile('GEMINI.md', this.reflectionsSection());
        await this.removeFromFile('AGENTS.md', this.reflectionsSection());
        await this.removeFromFile('.github/copilot-instructions.md', this.reflectionsSection());
        await this.removeFromFile('.clinerules', this.roocodeReflectionsSection());
        await this.removeFromFile('.roorules', this.roocodeReflectionsSection());
        await fsp.rm(path.join(this.cwd, '.claude', 'skills', 'reflections'), { recursive: true, force: true });
        await this.removeFile('.cursor/rules/reflections.mdc');
        await this.removeFile('.agent/rules/reflections.md');
        await fsp.rm(path.join(this.cwd, '.agent', 'skills', 'reflections'), { recursive: true, force: true });
        await fsp.rm(path.join(skillsDir(p), 'reflections'), { recursive: true, force: true });
      }

      if (s === 'all') {
        await this.removeFileIfEmpty('CLAUDE.md');
        await this.removeFileIfEmpty('GEMINI.md');
        await this.removeFileIfEmpty('AGENTS.md');
        await this.removeFileIfEmpty('.clinerules');
        await this.removeFileIfEmpty('.roomodes');
        await this.removeFileIfEmpty('.roorules');
        await this.removeFileIfEmpty('.github/copilot-instructions.md');
        await this.removeFileIfEmpty('opencode.json');

        // Defensive folder cleanup
        const folders = ['.claude', '.gemini', '.codex', '.opencode', '.agent', '.kiro'];
        for (const f of folders) {
          const fullPath = path.join(this.cwd, f);
          try {
            const entries = await fsp.readdir(fullPath);
            if (entries.length === 0) await fsp.rmdir(fullPath);
          } catch (e) { /* directory doesn't exist */ }
        }
      }

      console.log(`[Code-Graph] Successfully completed uninstall-skills for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] uninstall-skills failed for ${p}: ${err.message}`);
    }
  }

  async appendToFile(filename, content) {
    const fullPath = path.join(this.cwd, filename);
    try {
      const existing = await fsp.readFile(fullPath, 'utf8');
      if (!existing.includes(content.trim())) await fsp.appendFile(fullPath, content);
    } catch (e) {
      if (e.code === 'ENOENT') {
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, content);
      }
      else throw e;
    }
  }

  projectMapSection() {
    return `\n## 🗺️ Skill: ProjectMap\nBefore answering architecture questions, read \`${CONFIG.MAP_FILE}\` for god nodes and structural context. This ensures high-level awareness before searching raw files.\n`;
  }

  reflectionsSection() {
    return `\n## 🧠 Skill: Reflections\nFollow the reflection cycle: Read \`${CONFIG.REFLECTIONS_FILE}\` for past lessons and run \`code-graph reflect\` after any bug fix or failure.\n`;
  }

  roocodeReflectionsSection() {
    return `\n# Reflections Protocol\nStrictly follow the reflection cycle in \`${CONFIG.RULES_FILE}\`. Persist lessons to \`${CONFIG.REFLECTIONS_FILE}\`.\n`;
  }

  async writeFile(filename, content) {
    const fullPath = path.join(this.cwd, filename);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, content);
  }

  async writeJson(filename, data) {
    const fullPath = path.join(this.cwd, filename);
    let existing = {};
    try {
      existing = stripDangerousKeys(JSON.parse(await fsp.readFile(fullPath, 'utf8')));
      if (existing === null || typeof existing !== 'object' || Array.isArray(existing)) existing = {};
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`[Code-Graph] Warning: Failed to parse ${filename}, overwriting: ${e.message}`);
      }
    }

    const merged = { ...existing };
    for (const key of Object.keys(data)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (key === 'hooks' && data[key] && typeof data[key] === 'object'
          && existing[key] && typeof existing[key] === 'object') {
        merged[key] = this.mergeHooks(existing[key], data[key]);
      } else {
        merged[key] = data[key];
      }
    }
    await this.writeFile(filename, JSON.stringify(merged, null, 2));
  }

  mergeHooks(existing, incoming) {
    const merged = { ...existing };
    for (const hookType in incoming) {
      if (Array.isArray(incoming[hookType]) && Array.isArray(existing[hookType])) {
        const combined = [...existing[hookType]];
        for (const entry of incoming[hookType]) {
          const key = JSON.stringify(entry);
          const isDuplicate = combined.some(e => JSON.stringify(e) === key
            || (e && entry && e.message && e.message === entry.message));
          if (!isDuplicate) combined.push(entry);
        }
        merged[hookType] = combined;
      } else {
        merged[hookType] = incoming[hookType];
      }
    }
    return merged;
  }

  async removeFile(filename) {
    try {
      await fsp.unlink(path.join(this.cwd, filename));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async removeFromFile(filename, content) {
    const fullPath = path.join(this.cwd, filename);
    try {
      const existing = await fsp.readFile(fullPath, 'utf8');
      const updated = existing.split(content).join('');
      if (updated !== existing) await fsp.writeFile(fullPath, updated);
      await this.removeFileIfEmpty(filename);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async removeFileIfEmpty(filename) {
    const fullPath = path.join(this.cwd, filename);
    try {
      const content = await fsp.readFile(fullPath, 'utf8');
      if (content.trim() === '') await fsp.unlink(fullPath);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async removeJsonArrayValue(filename, key, value) {
    const fullPath = path.join(this.cwd, filename);
    try {
      const data = JSON.parse(await fsp.readFile(fullPath, 'utf8'));
      if (Array.isArray(data[key])) data[key] = data[key].filter(v => v !== value);
      if (Array.isArray(data[key]) && data[key].length === 0) delete data[key];
      if (Object.keys(data).length === 0) await fsp.unlink(fullPath);
      else await fsp.writeFile(fullPath, JSON.stringify(data, null, 2));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async removeJsonHookEntry(filename, shouldRemove) {
    const fullPath = path.join(this.cwd, filename);
    try {
      const data = JSON.parse(await fsp.readFile(fullPath, 'utf8'));
      if (!data.hooks || typeof data.hooks !== 'object') return;

      for (const hookType of Object.keys(data.hooks)) {
        if (!Array.isArray(data.hooks[hookType])) continue;
        data.hooks[hookType] = data.hooks[hookType].filter(entry => !shouldRemove(entry));
        if (data.hooks[hookType].length === 0) delete data.hooks[hookType];
      }
      if (Object.keys(data.hooks).length === 0) delete data.hooks;
      if (Object.keys(data).length === 0) await fsp.unlink(fullPath);
      else await fsp.writeFile(fullPath, JSON.stringify(data, null, 2));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}

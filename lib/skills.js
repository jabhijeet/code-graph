/**
 * @file lib/skills.js
 * @description Manages platform-specific skills and agent integrations.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG, SUPPORTED_PLATFORMS, isValidPlatform, stripDangerousKeys } from './config.js';

const VALID_SKILLS = new Set(['all', 'projectmap', 'reflections']);

// Skills that were merged or removed. Install and uninstall always wipe their
// artifacts so upgrading users land on a clean state without manual cleanup.
const LEGACY_SKILL_NAMES = ['repocontext'];
const OLD_REFLECTIONS_SECTIONS = Object.freeze([
  `\n## 🧠 Skill: Reflections\nFollow the reflection cycle: Read \`${CONFIG.REFLECTIONS_FILE}\` for past lessons and run \`code-graph reflect\` after any bug fix or failure.\n`,
  `\n# Reflections Protocol\nStrictly follow the reflection cycle in \`${CONFIG.RULES_FILE}\`. Persist lessons to \`${CONFIG.REFLECTIONS_FILE}\`.\n`,
  `\n## 🧠 Skill: Reflections\nBefore planning or making changes, read \`${CONFIG.REFLECTIONS_FILE}\` and apply every relevant lesson to the current task.\nIf a lesson matches the current file, tool, OS, dependency, or failure mode, treat it as an active constraint and mention how it changes your approach.\nIf you hit a failure, correction, repeated mistake, or non-obvious project behavior, run \`code-graph reflect <CAT> <LESSON>\` with a concise reusable lesson.\nDo not finish a bug fix, failed-command recovery, or environment workaround without either recording a new reflection or explicitly stating that no new reusable lesson was learned.\nThe goal is to avoid the same mistake across agents and sessions, not just to append notes after the fact.\n`,
  `\n# Reflections Protocol\nBefore planning or making changes, read \`${CONFIG.REFLECTIONS_FILE}\` and apply every relevant lesson to the current task.\nIf a lesson matches the current file, tool, OS, dependency, or failure mode, treat it as an active constraint and mention how it changes your approach.\nIf you hit a failure, correction, repeated mistake, or non-obvious project behavior, run \`code-graph reflect <CAT> <LESSON>\` with a concise reusable lesson.\nDo not finish a bug fix, failed-command recovery, or environment workaround without either recording a new reflection or explicitly stating that no new reusable lesson was learned.\nThe goal is to avoid the same mistake across agents and sessions, not just to append notes after the fact.\n`,
]);

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
      // Always remove legacy artifacts first so upgraders get a clean state.
      await this.removeLegacySkills(p);
      if (s === 'all' || s === 'projectmap') await this.installSkill(p, this.projectMapSpec());
      if (s === 'all' || s === 'reflections') {
        await this.removeOldReflectionsPrompts();
        await this.installSkill(p, this.reflectionsSpec());
      }
      console.log(`[Code-Graph] Successfully completed install-skills for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] install-skills failed for ${p}: ${err.message}`);
    }
  }

  /**
   * Platform-dispatcher driven by a per-skill spec.
   * Each spec declares which artifacts apply; platforms pick what's relevant.
   */
  async installSkill(p, spec) {
    const { name, section, description, body } = spec;
    switch (p) {
      case 'claude':
        if (section) await this.appendToFile('CLAUDE.md', section);
        if (spec.claudeSkill) await this.writeFile(`.claude/skills/${name}/SKILL.md`, spec.claudeSkill);
        if (spec.claudeHook) {
          await this.writeJson('.claude/settings.json', {
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
        if (spec.cursorRule) await this.writeFile(`.cursor/rules/${name}.mdc`, spec.cursorRule);
        break;
      case 'gemini':
        await this.installGlobalSkill('gemini', name, description, body);
        if (section) {
          const content = spec.geminiPrependsMapRef
            ? `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${section}`
            : section;
          await this.appendToFile('GEMINI.md', content);
        }
        break;
      case 'codex':
        if (section) await this.appendToFile('AGENTS.md', section);
        if (spec.codexHookMessage) {
          await this.writeJson('.codex/hooks.json', {
            hooks: { preToolUse: [{ tools: ['bash'], message: spec.codexHookMessage }] }
          });
        }
        break;
      case 'opencode':
        if (section) await this.appendToFile('AGENTS.md', section);
        if (spec.opencodePlugin) {
          const pluginPath = `.opencode/plugins/${name}.js`;
          await this.writeFile(pluginPath, spec.opencodePlugin);
          await this.writeJson('opencode.json', { plugins: [`./${pluginPath}`] });
        }
        break;
      case 'antigravity':
        if (spec.antigravitySkill) await this.writeFile(`.agent/skills/${name}/SKILL.md`, spec.antigravitySkill);
        if (spec.antigravityRule) await this.writeFile(`.agent/rules/${name}.md`, spec.antigravityRule);
        if (section) {
          await this.appendToFile('AGENTS.md', section);
          const geminiContent = spec.geminiPrependsMapRef
            ? `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${section}`
            : section;
          await this.appendToFile('GEMINI.md', geminiContent);
        }
        break;
      case 'kiro':
        await this.installGlobalSkill('kiro', name, description, body);
        if (spec.kiroSteering) await this.writeFile(`.kiro/steering/${name}.md`, spec.kiroSteering);
        break;
      case 'copilot':
        await this.installGlobalSkill('copilot', name, description, body);
        break;
      case 'vscode':
        if (section) await this.appendToFile('.github/copilot-instructions.md', section);
        break;
      case 'roocode': {
        const rooSection = spec.roocodeSection || section;
        if (rooSection) {
          await this.appendToFile('.clinerules', rooSection);
          await this.appendToFile('.roorules', rooSection);
        }
        break;
      }
      case 'intellij':
        if (section) await this.appendToFile('AGENTS.md', section);
        break;
      default:
        if (section) await this.appendToFile('AGENTS.md', section);
        await this.installGlobalSkill(p, name, description, body);
    }
  }

  projectMapSpec() {
    const description = 'Use the project knowledge graph as the primary index before any raw-file inspection.';
    const body = `# ProjectMap Skill\nRead \`${CONFIG.MAP_FILE}\` before using Read, Grep, or Glob on raw source. It indexes files, symbols, and dependency edges.\n`;
    return {
      name: 'projectmap',
      description,
      body,
      section: this.projectMapSection(),
      claudeSkill: `---\nname: projectmap\ndescription: ${description}\n---\n# ProjectMap\nBefore using Read, Grep, or Glob on raw source, read \`${CONFIG.MAP_FILE}\` — the canonical file, symbol, and dependency index. Use it to pick the smallest useful set of files to open and to ground architecture answers in god nodes and edges. Refresh with \`code-graph generate\` if stale.\n`,
      claudeHook: {
        matcher: 'Read|Grep|Glob',
        command: `echo "Skill(ProjectMap): Knowledge graph exists. Read ${CONFIG.MAP_FILE} before inspecting raw files."`,
      },
      cursorRule: `---\ndescription: Use project map before inspecting raw files.\nalwaysApply: true\n---\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` to locate files, symbols, and dependencies before opening source files.\n`,
      codexHookMessage: `Skill(ProjectMap): Read ${CONFIG.MAP_FILE} before inspecting raw files.`,
      opencodePlugin: `export default { name: 'projectmap', beforeExecute: (t) => { if (t.name === 'bash') return "Read ${CONFIG.MAP_FILE} for god nodes and file index."; } };`,
      antigravitySkill: `---\nname: projectmap\ndescription: ${description}\n---\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` before inspecting raw files. It's the canonical index of files, symbols, and dependency edges.\n`,
      antigravityRule: `# ProjectMap\nAlways read \`${CONFIG.MAP_FILE}\` before inspecting raw files.\n`,
      kiroSteering: `inclusion: always\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` before inspecting raw files.\n`,
      geminiPrependsMapRef: true,
    };
  }

  reflectionsSpec() {
    const description = 'Read, apply, and update project lessons so agents do not repeat known mistakes.';
    const body = `# Reflections Skill\n${this.reflectionsProtocolBody()}`;
    return {
      name: 'reflections',
      description,
      body,
      section: this.reflectionsSection(),
      claudeSkill: `---\nname: reflections\ndescription: ${description}\n---\n# Reflections\n${this.reflectionsProtocolBody()}`,
      cursorRule: `---\ndescription: Mandatory reflection cycle.\nalwaysApply: true\n---\n# Reflections\n${this.reflectionsProtocolBody()}`,
      antigravitySkill: `---\nname: reflections\ndescription: ${description}\n---\n# Reflections\n${this.reflectionsProtocolBody()}`,
      antigravityRule: `# Reflections\n${this.reflectionsProtocolBody()}`,
      roocodeSection: this.roocodeReflectionsSection(),
    };
  }

  projectMapSection() {
    return `\n## 🗺️ Skill: ProjectMap\nBefore using Read, Grep, or Glob on raw source, read \`${CONFIG.MAP_FILE}\` — the canonical file, symbol, and dependency index. Use it to pick the smallest useful set of files to open and to ground architecture answers in god nodes and edges. Refresh with \`code-graph generate\` if stale.\n`;
  }

  reflectionsSection() {
    return `\n## 🧠 Skill: Reflections\n${this.reflectionsProtocolBody()}`;
  }

  roocodeReflectionsSection() {
    return `\n# Reflections Protocol\n${this.reflectionsProtocolBody()}`;
  }

  reflectionsProtocolBody() {
    return `Follow \`${CONFIG.RULES_FILE}\` and use this reflection cycle for every task.\nBefore planning or making changes, read \`${CONFIG.REFLECTIONS_FILE}\` and apply every relevant lesson to the current task.\nIf a lesson matches the current file, tool, OS, dependency, or failure mode, treat it as an active constraint and mention how it changes your approach.\nIf you hit a failure, correction, repeated mistake, or non-obvious project behavior, run \`code-graph reflect <CAT> <LESSON>\` with a concise reusable lesson.\nDo not finish a bug fix, failed-command recovery, or environment workaround without either recording a new reflection or explicitly stating that no new reusable lesson was learned.\nThe goal is to avoid the same mistake across agents and sessions, not just to append notes after the fact.\n`;
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

      // Legacy artifacts are always cleaned so 'all' and targeted uninstalls both leave a clean state.
      await this.removeLegacySkills(p);

      if (s === 'all' || s === 'projectmap') {
        await this.removeSkillArtifacts(p, 'projectmap', this.projectMapSection());
        // ProjectMap's Gemini section is prefixed with a ProjectMap file reference; strip that too.
        await this.removeFromFile('GEMINI.md', `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${this.projectMapSection()}`);
        await this.removeFile('.opencode/plugins/projectmap.js');
        await this.removeJsonHookEntry('.claude/settings.json', entry =>
          JSON.stringify(entry).includes('Skill(ProjectMap)'));
        await this.removeJsonHookEntry('.codex/hooks.json', entry =>
          entry?.message?.includes('Skill(ProjectMap)'));
        await this.removeJsonArrayValue('opencode.json', 'plugins', './.opencode/plugins/projectmap.js');
        await fsp.rm(path.join(skillsDir(p), 'projectmap'), { recursive: true, force: true });
      }

      if (s === 'all' || s === 'reflections') {
        await this.removeOldReflectionsPrompts();
        await this.removeSkillArtifacts(p, 'reflections', this.reflectionsSection());
        // Roocode uses its own Reflections phrasing.
        await this.removeFromFile('.clinerules', this.roocodeReflectionsSection());
        await this.removeFromFile('.roorules', this.roocodeReflectionsSection());
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

  async removeOldReflectionsPrompts() {
    const files = [
      'CLAUDE.md',
      'GEMINI.md',
      'AGENTS.md',
      '.github/copilot-instructions.md',
      '.clinerules',
      '.roorules',
    ];
    for (const file of files) {
      for (const section of OLD_REFLECTIONS_SECTIONS) {
        await this.removeFromFile(file, section);
      }
    }
  }

  // Remove all artifacts that installSkill creates across platforms for a given skill name + section.
  // Safe to call regardless of which platform originally installed it.
  async removeSkillArtifacts(p, name, section) {
    await this.removeFromFile('CLAUDE.md', section);
    await this.removeFromFile('GEMINI.md', section);
    await this.removeFromFile('AGENTS.md', section);
    await this.removeFromFile('.github/copilot-instructions.md', section);
    await this.removeFromFile('.clinerules', section);
    await this.removeFromFile('.roorules', section);
    await fsp.rm(path.join(this.cwd, '.claude', 'skills', name), { recursive: true, force: true });
    await this.removeFile(`.cursor/rules/${name}.mdc`);
    await this.removeFile(`.agent/rules/${name}.md`);
    await this.removeFile(`.agent/workflows/${name}.md`);
    await fsp.rm(path.join(this.cwd, '.agent', 'skills', name), { recursive: true, force: true });
    await this.removeFile(`.kiro/steering/${name}.md`);
  }

  async removeLegacySkills(p) {
    const skillsDir = (platform) => path.join(this.home, `.${platform}`, 'skills');
    for (const legacy of LEGACY_SKILL_NAMES) {
      const section = this.legacySection(legacy);
      if (section) {
        await this.removeFromFile('CLAUDE.md', section);
        await this.removeFromFile('GEMINI.md', section);
        await this.removeFromFile('AGENTS.md', section);
        await this.removeFromFile('.github/copilot-instructions.md', section);
        await this.removeFromFile('.clinerules', section);
        await this.removeFromFile('.roorules', section);
      }
      await fsp.rm(path.join(this.cwd, '.claude', 'skills', legacy), { recursive: true, force: true });
      await this.removeFile(`.cursor/rules/${legacy}.mdc`);
      await this.removeFile(`.agent/rules/${legacy}.md`);
      await fsp.rm(path.join(this.cwd, '.agent', 'skills', legacy), { recursive: true, force: true });
      await this.removeFile(`.kiro/steering/${legacy}.md`);
      await fsp.rm(path.join(skillsDir(p), legacy), { recursive: true, force: true });
    }
  }

  // Exact section text that previous versions wrote for each retired skill.
  // Kept here so upgrade cleanup can match and strip them verbatim.
  legacySection(legacy) {
    if (legacy === 'repocontext') {
      return `\n## 🔎 Skill: RepoContext\nWhen you need to understand raw files quickly, read \`${CONFIG.MAP_FILE}\` first as a compact file index. Use it to identify likely files, symbols, and dependency edges before opening source files.\n`;
    }
    return null;
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

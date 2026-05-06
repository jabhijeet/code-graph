/**
 * @file lib/skills/core.js
 * @description Core SkillManager implementation with split modules.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG, SUPPORTED_PLATFORMS, PLATFORM_GLOBAL_PATHS, isValidPlatform, stripDangerousKeys } from '../config.js';
import { logInstallTarget } from '../install-log.js';
import { 
  projectMapSpec, reflectionsSpec, simplicitySpec, thinkBeforeCodingSpec, 
  changeLimitSpec, goalDrivenSpec, freshDepsSpec, contextBudgetSpec 
} from './specs.js';
import { installGlobalSkill, installProjectSkill, globalSkillsDir } from './platforms.js';

const VALID_SKILLS = new Set([
  'all', 'projectmap', 'reflections', 'thinkbeforecoding', 'simplicity', 
  'changelimit', 'surgicalchanges', 'goaldriven', 'freshdeps', 'contextbudget'
]);

const LEGACY_SKILL_NAMES = ['repocontext'];

const OLD_REFLECTIONS_SECTIONS = Object.freeze([
  `\n## 🧠 Skill: Reflections\nFollow the reflection cycle: Read \`${CONFIG.REFLECTIONS_FILE}\` for past lessons and run \`code-graph reflect\` after any bug fix or failure.\n`,
  `\n# Reflections Protocol\nStrictly follow the reflection cycle in \`${CONFIG.RULES_FILE}\`. Persist lessons to \`${CONFIG.REFLECTIONS_FILE}\`.\n`,
  `\n## 🧠 Skill: Reflections\nBefore planning or making changes, read \`${CONFIG.REFLECTIONS_FILE}\` and apply every relevant lesson to the current task.\nIf a lesson matches the current file, tool, OS, dependency, or failure mode, treat it as an active constraint and mention how it changes your approach.\nIf you hit a failure, correction, repeated mistake, or non-obvious project behavior, run \`code-graph reflect <CAT> <LESSON>\` with a concise reusable lesson.\nDo not finish a bug fix, failed-command recovery, or environment workaround without either recording a new reflection or explicitly stating that no new reusable lesson was learned.\nThe goal is to avoid the same mistake across agents and sessions, not just to append notes after the fact.\n`,
  `\n# Reflections Protocol\nBefore planning or making changes, read \`${CONFIG.REFLECTIONS_FILE}\` and apply every relevant lesson to the current task.\nIf a lesson matches the current file, tool, OS, dependency, or failure mode, state explicitly how it changes your approach.\nIf you hit a failure, correction, repeated mistake, or non-obvious project behavior, run \`code-graph reflect <CAT> <LESSON>\` with a concise reusable lesson.\nDo not finish a bug fix, failed-command recovery, or environment workaround without either recording a new reflection or explicitly stating that none was learned.\nThe goal is to avoid the same mistake across agents and sessions, not just to append notes after the fact.\n`
]);

const OLD_CHANGE_LIMIT_SECTIONS = Object.freeze([
  `\n## 🔒 Skill: ChangeLimit\nMANDATORY — violations are task failures, not style preferences.\n\nBEFORE making any change, identify the minimum diff that satisfies the task.\n\n- Change ONLY what the task explicitly requires. Nothing else.\n- DO NOT refactor, rename, reorder, or reformat surrounding code.\n- DO NOT add logging, validation, or error handling that was not asked for.\n- DO NOT "improve" or "clean up" code you happen to touch.\n- DO NOT change whitespace, quotes, or formatting outside your diff.\n- MATCH the existing style exactly: indentation, naming, spacing, quote style.\n- If your change breaks a nearby comment or reference, fix only that breakage.\n- Leave all other code exactly as you found it.\n\nThe smallest correct diff is the right diff. Scope creep = task failure.\n`
]);

export class SkillManager {
  constructor(cwd) {
    this.cwd = cwd;
    this.home = os.homedir();
  }

  async execute(platform, action, skill, isGlobal = false) {
    if (!platform) return console.error('[Code-Graph] Platform required. Usage: code-graph install-skills <platform> [projectmap|reflections|thinkbeforecoding|simplicity|changelimit|surgicalchanges|goaldriven|freshdeps|contextbudget] [-g]');
    if (!isValidPlatform(platform)) {
      return console.error(`[Code-Graph] Unsupported platform: ${platform}. Valid: ${SUPPORTED_PLATFORMS.join(', ')}`);
    }
    const p = platform.toLowerCase();
    const act = (action || 'install-skills').toLowerCase();
    const s = (skill || 'all').toLowerCase();

    if (!VALID_SKILLS.has(s)) {
      return console.error(`[Code-Graph] Unknown skill: ${skill}. Valid: projectmap, reflections, thinkbeforecoding, simplicity, changelimit, surgicalchanges, goaldriven, freshdeps, contextbudget, all`);
    }

    if (act === 'install-skills') await this.install(p, s, isGlobal);
    else if (act === 'uninstall-skills') await this.uninstall(p, s, isGlobal);
    else console.error(`[Code-Graph] Unknown action: ${act}. Use install-skills or uninstall-skills.`);
  }

  async install(p, s, isGlobal = false) {
    const scope = isGlobal ? 'global' : 'project';
    console.log(`[Code-Graph] Running install-skills (${s}) for ${p} [${scope}]...`);
    try {
      await this.removeLegacySkills(p);
      if (s === 'all' || s === 'projectmap') await this.installSkill(p, projectMapSpec(), isGlobal);
      if (s === 'all' || s === 'reflections') {
        await this.removeOldReflectionsPrompts();
        await this.installSkill(p, reflectionsSpec(), isGlobal);
      }
      if (s === 'all' || s === 'thinkbeforecoding') await this.installSkill(p, thinkBeforeCodingSpec(), isGlobal);
      if (s === 'all' || s === 'simplicity') await this.installSkill(p, simplicitySpec(), isGlobal);
      if (s === 'all' || s === 'changelimit' || s === 'surgicalchanges') {
        await this.removeOldChangeLimitPrompts();
        await this.installSkill(p, changeLimitSpec(), isGlobal);
      }
      if (s === 'all' || s === 'goaldriven') await this.installSkill(p, goalDrivenSpec(), isGlobal);
      if (s === 'all' || s === 'freshdeps') await this.installSkill(p, freshDepsSpec(), isGlobal);
      if (s === 'all' || s === 'contextbudget') await this.installSkill(p, contextBudgetSpec(), isGlobal);
      console.log(`[Code-Graph] Successfully completed install-skills for ${p} [${scope}].`);
    } catch (err) {
      console.error(`[Code-Graph] install-skills failed for ${p}: ${err.message}`);
    }
  }

  async installSkill(p, spec, isGlobal = false) {
    const { name, section, description, body } = spec;

    if (isGlobal) {
      switch (p) {
        case 'claude':
          await installGlobalSkill('claude', name, description, spec.claudeSkill || body);
          break;
        case 'gemini':
        case 'gemini-cli':
          await installGlobalSkill('gemini', name, description, body);
          break;
        case 'kiro':
        case 'kiro-cli':
          await installGlobalSkill('kiro', name, description, body);
          break;
        case 'copilot':
        case 'github-copilot':
          await installGlobalSkill('copilot', name, description, body);
          break;
        case 'antigravity':
          if (spec.antigravitySkill) await installGlobalSkill('antigravity', name, description, spec.antigravitySkill);
          break;
        default:
          await installGlobalSkill(p, name, description, body);
      }
      return;
    }

    // Project-level install
    const fileHelpers = {
      appendToFile: (...args) => this.appendToFile(...args),
      writeFile: (...args) => this.writeFile(...args),
      writeJson: (...args) => this.writeJson(...args),
      removeJsonHookEntry: (...args) => this.removeJsonHookEntry(...args)
    };
    await installProjectSkill(p, spec, this.cwd, fileHelpers);
  }

  async uninstall(p, s, isGlobal = false) {
    const scope = isGlobal ? 'global' : 'project';
    console.log(`[Code-Graph] Running uninstall-skills (${s}) for ${p} [${scope}]...`);
    try {
      await this.removeLegacySkills(p);

      if (isGlobal) {
        if (s === 'all' || s === 'projectmap') {
          await fsp.rm(globalSkillsDir(p, 'projectmap').dir, { recursive: true, force: true });
        }
        if (s === 'all' || s === 'reflections') {
          await fsp.rm(globalSkillsDir(p, 'reflections').dir, { recursive: true, force: true });
        }
        if (s === 'all' || s === 'thinkbeforecoding') {
          await fsp.rm(globalSkillsDir(p, 'thinkbeforecoding').dir, { recursive: true, force: true });
        }
        if (s === 'all' || s === 'simplicity') {
          await fsp.rm(globalSkillsDir(p, 'simplicity').dir, { recursive: true, force: true });
        }
        if (s === 'all' || s === 'changelimit' || s === 'surgicalchanges') {
          await fsp.rm(globalSkillsDir(p, 'changelimit').dir, { recursive: true, force: true });
        }
        if (s === 'all' || s === 'goaldriven') {
          await fsp.rm(globalSkillsDir(p, 'goaldriven').dir, { recursive: true, force: true });
        }
        if (s === 'all' || s === 'freshdeps') {
          await fsp.rm(globalSkillsDir(p, 'freshdeps').dir, { recursive: true, force: true });
        }
        if (s === 'all' || s === 'contextbudget') {
          await fsp.rm(globalSkillsDir(p, 'contextbudget').dir, { recursive: true, force: true });
        }
      } else {
        if (s === 'all' || s === 'projectmap') {
          const spec = projectMapSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
          await this.removeFromFile('GEMINI.md', `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${this.projectMapSection()}`);
          await this.removeJsonHookEntry('.claude/settings.json', entry =>
            JSON.stringify(entry).includes('Skill(ProjectMap)') ||
            JSON.stringify(entry).includes('MANDATORY SKILLS ACTIVE'));
          await this.removeJsonHookEntry('.codex/hooks.json', entry =>
            JSON.stringify(entry).includes('MANDATORY SKILLS ACTIVE:'));
        }

        if (s === 'all' || s === 'reflections') {
          await this.removeOldReflectionsPrompts();
          await this.removeSkillArtifacts(p, 'reflections', reflectionsSpec().section, reflectionsSpec());
          await this.removeFromFile('.clinerules', this.roocodeReflectionsSection());
          await this.removeFromFile('.roorules', this.roocodeReflectionsSection());
          await this.removeJsonHookEntry('.claude/settings.json', entry =>
            JSON.stringify(entry).includes('BEFORE STOPPING'));
          await this.removeJsonHookEntry('.codex/hooks.json', entry =>
            JSON.stringify(entry).includes('BEFORE STOPPING:'));
        }
        if (s === 'all' || s === 'thinkbeforecoding') {
          const spec = thinkBeforeCodingSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
        }
        if (s === 'all' || s === 'simplicity') {
          const spec = simplicitySpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
        }
        if (s === 'all' || s === 'changelimit' || s === 'surgicalchanges') {
          const spec = changeLimitSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
          await this.removeJsonHookEntry('.claude/settings.json', entry =>
            JSON.stringify(entry).includes('PRE-WRITE CHECK'));
          await this.removeJsonHookEntry('.codex/hooks.json', entry =>
            JSON.stringify(entry).includes('PRE-WRITE CHECK'));
        }
        if (s === 'all' || s === 'goaldriven') {
          const spec = goalDrivenSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
        }
        if (s === 'all' || s === 'freshdeps') {
          const spec = freshDepsSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
        }
        if (s === 'all' || s === 'contextbudget') {
          const spec = contextBudgetSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
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

          const folders = ['.claude', '.gemini', '.codex', '.opencode', '.agent', '.kiro'];
          for (const f of folders) {
            const fullPath = path.join(this.cwd, f);
            try {
              const entries = await fsp.readdir(fullPath);
              if (entries.length === 0) await fsp.rmdir(fullPath);
            } catch (e) { /* directory doesn't exist */ }
          }
        }
      }

      console.log(`[Code-Graph] Successfully completed uninstall-skills for ${p} [${scope}].`);
    } catch (err) {
      console.error(`[Code-Graph] uninstall-skills failed for ${p}: ${err.message}`);
    }
  }

  async removeOldReflectionsPrompts() {
    const files = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', '.github/copilot-instructions.md', '.clinerules', '.roorules'];
    for (const file of files) {
      for (const section of OLD_REFLECTIONS_SECTIONS) {
        await this.removeFromFile(file, section);
      }
    }
  }

  async removeOldChangeLimitPrompts() {
    const files = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', '.github/copilot-instructions.md', '.clinerules', '.roorules'];
    for (const file of files) {
      for (const section of OLD_CHANGE_LIMIT_SECTIONS) {
        await this.removeFromFile(file, section);
      }
    }
  }

  async removeSkillArtifacts(p, name, section, spec = {}) {
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
    if (spec.codexHookMessage) {
      await this.removeJsonHookEntry('.codex/hooks.json', entry =>
        JSON.stringify(entry).includes(spec.codexHookMessage));
    }
    if (spec.codexWriteHookMessage) {
      await this.removeJsonHookEntry('.codex/hooks.json', entry =>
        JSON.stringify(entry).includes(spec.codexWriteHookMessage));
    }
    if (spec.claudeHook) {
      await this.removeJsonHookEntry('.claude/settings.json', entry =>
        JSON.stringify(entry).includes(spec.claudeHook.command));
    }
    if (spec.claudeWriteHook) {
      await this.removeJsonHookEntry('.claude/settings.json', entry =>
        JSON.stringify(entry).includes(spec.claudeWriteHook.command));
    }
    if (spec.opencodePlugin) {
      const pluginPath = `.opencode/plugins/${name}.js`;
      await this.removeFile(pluginPath);
      await this.removeJsonArrayValue('opencode.json', 'plugins', `./${pluginPath}`);
    }
  }

  async removeLegacySkills(p) {
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
      await fsp.rm(globalSkillsDir(p, legacy).dir, { recursive: true, force: true });
    }
  }

  legacySection(legacy) {
    if (legacy === 'repocontext') {
      return `\n## 🔎 Skill: RepoContext\nWhen you need to understand raw files quickly, read \`${CONFIG.MAP_FILE}\` first as a compact file index. Use it to identify likely files, symbols, and dependency edges before opening source files.\n`;
    }
    return null;
  }

  // Section generators (needed for uninstall)
  projectMapSection() {
    return `\n## 🗺️ Skill: ProjectMap\nMANDATORY: Read \`${CONFIG.MAP_FILE}\` BEFORE calling Read, Grep, Glob, or any file tool. It is the canonical index of all files, symbols, and dependency edges. Use it to identify exactly which files to open. Do not inspect raw files without consulting it first. Refresh with \`code-graph generate\` if stale. Skipping = task failure.\n`;
  }

  roocodeReflectionsSection() {
    return `\n# Reflections Protocol — MANDATORY\n${this.reflectionsProtocolBody()}`;
  }

  reflectionsProtocolBody() {
    return `MANDATORY — follow this cycle on every task. Skipping = task failure.\n\nBEFORE planning or writing any code:\n1. Read \`${CONFIG.REFLECTIONS_FILE}\` — apply every matching lesson as a hard constraint.\n2. Read \`${CONFIG.RULES_FILE}\` — follow the protocol exactly.\n3. If a lesson matches the current file, tool, OS, or failure mode: state explicitly how it changes your approach.\n\nAFTER any failure, correction, or non-obvious fix:\n- Run \`code-graph reflect <CATEGORY> <LESSON>\` with a concise, reusable lesson.\n- You MUST either record a new lesson or explicitly state that none was learned.\n- Do NOT mark a task complete without completing this step.\n\nThe goal: no agent repeats a mistake already recorded in \`${CONFIG.REFLECTIONS_FILE}\`.\n`;
  }

  // File helper methods
  async appendToFile(filename, content) {
    const fullPath = path.join(this.cwd, filename);
    try {
      const existing = await fsp.readFile(fullPath, 'utf8');
      if (!existing.includes(content.trim())) await fsp.appendFile(fullPath, content);
      logInstallTarget(fullPath);
    } catch (e) {
      if (e.code === 'ENOENT') {
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, content);
        logInstallTarget(fullPath);
      }
      else throw e;
    }
  }

  async writeFile(filename, content) {
    const fullPath = path.join(this.cwd, filename);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, content);
    logInstallTarget(fullPath);
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
      } else if (Array.isArray(data[key]) && Array.isArray(existing[key])) {
        merged[key] = this.mergeArrayValues(existing[key], data[key]);
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

  mergeArrayValues(existing, incoming) {
    const merged = [...existing];
    for (const value of incoming) {
      const key = JSON.stringify(value);
      const isDuplicate = merged.some(entry => JSON.stringify(entry) === key);
      if (!isDuplicate) merged.push(value);
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
      if (!data.hooks) delete data.codex_hooks;
      if (Object.keys(data).length === 0) await fsp.unlink(fullPath);
      else await fsp.writeFile(fullPath, JSON.stringify(data, null, 2));
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn(`[Code-Graph] Warning: Failed to update ${filename}: ${e.message}`);
    }
  }
}

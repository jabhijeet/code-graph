/**
 * @file lib/skills.js
 * @description Manages platform-specific skills and agent integrations.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG, SUPPORTED_PLATFORMS, PLATFORM_GLOBAL_PATHS, isValidPlatform, stripDangerousKeys } from './config.js';

const VALID_SKILLS = new Set(['all', 'projectmap', 'reflections', 'simplicity', 'changelimit', 'freshdeps', 'contextbudget']);

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

  async execute(platform, action, skill, isGlobal = false) {
    if (!platform) return console.error('[Code-Graph] Platform required. Usage: code-graph install-skills <platform> [projectmap|reflections|simplicity|changelimit|freshdeps|contextbudget] [-g]');
    if (!isValidPlatform(platform)) {
      return console.error(`[Code-Graph] Unsupported platform: ${platform}. Valid: ${SUPPORTED_PLATFORMS.join(', ')}`);
    }
    const p = platform.toLowerCase();
    const act = (action || 'install-skills').toLowerCase();
    const s = (skill || 'all').toLowerCase();

    if (!VALID_SKILLS.has(s)) {
      return console.error(`[Code-Graph] Unknown skill: ${skill}. Valid: projectmap, reflections, simplicity, changelimit, freshdeps, contextbudget, all`);
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
      if (s === 'all' || s === 'projectmap') await this.installSkill(p, this.projectMapSpec(), isGlobal);
      if (s === 'all' || s === 'reflections') {
        await this.removeOldReflectionsPrompts();
        await this.installSkill(p, this.reflectionsSpec(), isGlobal);
      }
      if (s === 'all' || s === 'simplicity') await this.installSkill(p, this.simplicitySpec(), isGlobal);
      if (s === 'all' || s === 'changelimit') await this.installSkill(p, this.changeLimitSpec(), isGlobal);
      if (s === 'all' || s === 'freshdeps') await this.installSkill(p, this.freshDepsSpec(), isGlobal);
      if (s === 'all' || s === 'contextbudget') await this.installSkill(p, this.contextBudgetSpec(), isGlobal);
      console.log(`[Code-Graph] Successfully completed install-skills for ${p} [${scope}].`);
    } catch (err) {
      console.error(`[Code-Graph] install-skills failed for ${p}: ${err.message}`);
    }
  }

  // Platform-dispatcher driven by a per-skill spec.
  // isGlobal=true  → write to ~/.<platform>/skills/ only (no project files touched)
  // isGlobal=false → write to project files only (no global dirs touched)
  async installSkill(p, spec, isGlobal = false) {
    const { name, section, description, body } = spec;

    if (isGlobal) {
      // Global install: write skill file to the agent's user-level skills dir.
      // Platforms with a dedicated global dir use it; others fall back to ~/.{p}/skills/.
      switch (p) {
        case 'claude':
          await this.installGlobalSkill('claude', name, description, spec.claudeSkill || body);
          break;
        case 'gemini':
        case 'gemini-cli':
          await this.installGlobalSkill('gemini', name, description, body);
          break;
        case 'kiro':
        case 'kiro-cli':
          await this.installGlobalSkill('kiro', name, description, body);
          break;
        case 'copilot':
        case 'github-copilot':
          await this.installGlobalSkill('copilot', name, description, body);
          break;
        case 'antigravity':
          if (spec.antigravitySkill) await this.installGlobalSkill('antigravity', name, description, spec.antigravitySkill);
          break;
        default:
          await this.installGlobalSkill(p, name, description, body);
      }
      return;
    }

    // Project-level install
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
        if (spec.kiroSteering) await this.writeFile(`.kiro/steering/${name}.md`, spec.kiroSteering);
        break;
      case 'copilot':
        // copilot has no meaningful project-level file; use AGENTS.md as fallback
        if (section) await this.appendToFile('AGENTS.md', section);
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
    }
  }

  projectMapSpec() {
    const description = 'MANDATORY: Read the knowledge graph before any file inspection. Skipping = task failure.';
    const body = this.projectMapBody();
    return {
      name: 'projectmap',
      description,
      body,
      section: this.projectMapSection(),
      claudeSkill: `---\nname: projectmap\ndescription: ${description}\n---\n# ProjectMap\n${body}`,
      claudeHook: {
        matcher: 'Read|Grep|Glob',
        command: `echo "MANDATORY(ProjectMap): You MUST read ${CONFIG.MAP_FILE} before inspecting any raw file. Skipping this step is a task failure."`,
      },
      cursorRule: `---\ndescription: MANDATORY — read knowledge graph before any file inspection.\nalwaysApply: true\n---\n# ProjectMap\n${body}`,
      codexHookMessage: `MANDATORY(ProjectMap): You MUST read ${CONFIG.MAP_FILE} before calling any file tool. It is the canonical index of all files, symbols, and edges.`,
      opencodePlugin: `export default { name: 'projectmap', beforeExecute: (t) => { if (['bash','read','grep','glob'].includes(t.name?.toLowerCase())) return "MANDATORY: Read ${CONFIG.MAP_FILE} FIRST. Do not inspect raw files without consulting the knowledge graph."; } };`,
      antigravitySkill: `---\nname: projectmap\ndescription: ${description}\n---\n# ProjectMap\n${body}`,
      antigravityRule: `# ProjectMap — MANDATORY\n${body}`,
      kiroSteering: `inclusion: always\n# ProjectMap — MANDATORY\n${body}`,
      geminiPrependsMapRef: true,
    };
  }

  reflectionsSpec() {
    const description = 'MANDATORY: Read past lessons before planning. Record new lessons after any failure.';
    const body = this.reflectionsProtocolBody();
    return {
      name: 'reflections',
      description,
      body,
      section: this.reflectionsSection(),
      claudeSkill: `---\nname: reflections\ndescription: ${description}\n---\n# Reflections\n${body}`,
      cursorRule: `---\ndescription: MANDATORY — read and record project lessons every task.\nalwaysApply: true\n---\n# Reflections\n${body}`,
      antigravitySkill: `---\nname: reflections\ndescription: ${description}\n---\n# Reflections\n${body}`,
      antigravityRule: `# Reflections — MANDATORY\n${body}`,
      kiroSteering: `inclusion: always\n# Reflections — MANDATORY\n${body}`,
      roocodeSection: this.roocodeReflectionsSection(),
    };
  }

  simplicitySpec() {
    const description = 'MANDATORY: Write only what the task requires. No extras, no premature abstractions.';
    const body = this.simplicityBody();
    const section = `\n## ✂️ Skill: Simplicity\n${body}`;
    const skillFile = `---\nname: simplicity\ndescription: ${description}\n---\n# Simplicity\n${body}`;
    return {
      name: 'simplicity',
      description,
      body,
      section,
      claudeSkill: skillFile,
      cursorRule: `---\ndescription: MANDATORY — write only what the task requires.\nalwaysApply: true\n---\n# Simplicity\n${body}`,
      codexHookMessage: `MANDATORY(Simplicity): Write only what the task requires. No extra features, no abstractions, no helpers beyond what is asked.`,
      opencodePlugin: `export default { name: 'simplicity', beforeExecute: () => "MANDATORY: Write ONLY what the task requires. No extra parameters, abstractions, or helpers. Simplest correct solution only." };`,
      antigravitySkill: skillFile,
      antigravityRule: `# Simplicity — MANDATORY\n${body}`,
      kiroSteering: `inclusion: always\n# Simplicity — MANDATORY\n${body}`,
    };
  }

  changeLimitSpec() {
    const description = 'MANDATORY: Change only what the task explicitly requires. No scope creep.';
    const body = this.changeLimitBody();
    const section = `\n## 🔒 Skill: ChangeLimit\n${body}`;
    const skillFile = `---\nname: changelimit\ndescription: ${description}\n---\n# ChangeLimit\n${body}`;
    return {
      name: 'changelimit',
      description,
      body,
      section,
      claudeSkill: skillFile,
      cursorRule: `---\ndescription: MANDATORY — change only what the task explicitly requires.\nalwaysApply: true\n---\n# ChangeLimit\n${body}`,
      codexHookMessage: `MANDATORY(ChangeLimit): Change ONLY what the task explicitly requires. Do not refactor, rename, or improve surrounding code.`,
      opencodePlugin: `export default { name: 'changelimit', beforeExecute: () => "MANDATORY: Change ONLY what is explicitly required. No refactoring, no style fixes, no improvements to untouched code." };`,
      antigravitySkill: skillFile,
      antigravityRule: `# ChangeLimit — MANDATORY\n${body}`,
      kiroSteering: `inclusion: always\n# ChangeLimit — MANDATORY\n${body}`,
    };
  }

  freshDepsSpec() {
    const description = 'MANDATORY: Use latest stable dependencies and current APIs. Deprecated choices are task failures.';
    const body = this.freshDepsBody();
    const section = `\n## 📦 Skill: FreshDeps\n${body}`;
    const skillFile = `---\nname: freshdeps\ndescription: ${description}\n---\n# FreshDeps\n${body}`;
    return {
      name: 'freshdeps',
      description,
      body,
      section,
      claudeSkill: skillFile,
      cursorRule: `---\ndescription: MANDATORY — use latest stable dependencies and current APIs.\nalwaysApply: true\n---\n# FreshDeps\n${body}`,
      codexHookMessage: `MANDATORY(FreshDeps): Use latest stable dependency/library versions and current APIs. Do not add deprecated packages, methods, functions, or patterns.`,
      opencodePlugin: `export default { name: 'freshdeps', beforeExecute: () => "MANDATORY: Use latest stable dependencies and current APIs. Deprecated packages, methods, functions, and patterns are task failures. If corrected, stop and follow the rules." };`,
      antigravitySkill: skillFile,
      antigravityRule: `# FreshDeps — MANDATORY\n${body}`,
      kiroSteering: `inclusion: always\n# FreshDeps — MANDATORY\n${body}`,
    };
  }

  contextBudgetSpec() {
    const description = 'MANDATORY: Periodically condense working context to reduce token load and stale detail.';
    const body = this.contextBudgetBody();
    const section = `\n## 🧾 Skill: ContextBudget\n${body}`;
    const skillFile = `---\nname: contextbudget\ndescription: ${description}\n---\n# ContextBudget\n${body}`;
    return {
      name: 'contextbudget',
      description,
      body,
      section,
      claudeSkill: skillFile,
      cursorRule: `---\ndescription: MANDATORY — periodically condense working context.\nalwaysApply: true\n---\n# ContextBudget\n${body}`,
      codexHookMessage: `MANDATORY(ContextBudget): Keep a compact rolling summary. After each phase or every 10 tool calls, condense goal, decisions, files, verification, blockers, and next step.`,
      opencodePlugin: `export default { name: 'contextbudget', beforeExecute: () => "MANDATORY: Maintain a compact rolling summary. After each phase or every 10 tool calls, keep only goal, decisions, files, verification, blockers, and next step." };`,
      antigravitySkill: skillFile,
      antigravityRule: `# ContextBudget — MANDATORY\n${body}`,
      kiroSteering: `inclusion: always\n# ContextBudget — MANDATORY\n${body}`,
    };
  }

  projectMapBody() {
    return `MANDATORY — you MUST read the knowledge graph before inspecting any file. Skipping this step is a task failure.

BEFORE calling Read, Grep, Glob, or any file inspection tool:
1. Read \`${CONFIG.MAP_FILE}\` — the canonical index of all files, symbols, and dependency edges.
2. Use it to identify exactly which files to open. Do not guess. Do not search blindly.
3. Use god nodes (*) to locate entry points and high-impact files.
4. Use the EDGES section to understand dependencies before modifying anything.
5. Refresh with \`code-graph generate\` after adding, removing, or renaming files.

Inspecting raw files without first reading \`${CONFIG.MAP_FILE}\` = task failure.
`;
  }

  simplicityBody() {
    return `MANDATORY — violations are task failures, not style preferences.

BEFORE writing any code, ask: does the task require this?

- Write ONLY what the task requires. Nothing more.
- NO extra parameters, config options, or flags beyond what is asked.
- NO abstractions unless the code literally cannot work without them.
- NO helper functions for logic used in exactly one place.
- NO error handling for cases that cannot happen in the current context.
- NO comments explaining what the code does — name things well instead.
- PREFER the shorter solution. Three similar lines beat a premature abstraction.
- If asked to fix a bug: fix the bug only. Do not refactor. Do not improve.

The simplest correct solution is the right solution. Every extra line is a liability.
`;
  }

  changeLimitBody() {
    return `MANDATORY — violations are task failures, not style preferences.

BEFORE making any change, identify the minimum diff that satisfies the task.

- Change ONLY what the task explicitly requires. Nothing else.
- DO NOT refactor, rename, reorder, or reformat surrounding code.
- DO NOT add logging, validation, or error handling that was not asked for.
- DO NOT "improve" or "clean up" code you happen to touch.
- DO NOT change whitespace, quotes, or formatting outside your diff.
- MATCH the existing style exactly: indentation, naming, spacing, quote style.
- If your change breaks a nearby comment or reference, fix only that breakage.
- Leave all other code exactly as you found it.

The smallest correct diff is the right diff. Scope creep = task failure.
`;
  }

  freshDepsBody() {
    return `MANDATORY — violations are task failures, not suggestions.

WHEN adding or changing any dependency, package, framework, SDK, API, method, function, or integration:

- Use the latest stable release that is compatible with the project.
- Verify current usage against official documentation, package metadata, or the project's lockfile before choosing versions or APIs.
- DO NOT use deprecated packages, methods, functions, configuration keys, CLI flags, import paths, or patterns.
- DO NOT pin old versions unless the project already requires that version or the user explicitly asks for it.
- DO NOT copy stale examples from memory when dependency behavior may have changed.
- Prefer maintained first-party libraries over abandoned or unofficial packages.
- If the project already uses an older dependency, preserve compatibility unless the task requires an upgrade; do not silently mix incompatible major versions.
- If a deprecated choice is unavoidable, state the reason and the migration path.
- If you repeat a deprecated or stale choice after being corrected, STOP. Re-read ${CONFIG.RULES_FILE}, state that FreshDeps is mandatory, and replace the choice with the current stable approach before continuing.

Latest stable and non-deprecated APIs are mandatory. Stale dependency choices = task failure.
`;
  }

  contextBudgetBody() {
    return `MANDATORY — maintain periodic context condensation to reduce token load and stale detail.

AFTER each completed phase, every 10 tool calls, or before changing direction:

1. Write a compact rolling summary of the current goal, decisions, files inspected or changed, commands run, verification status, blockers, and next step.
2. Keep only facts needed for the next action. Drop raw logs, repeated source excerpts, and stale branches of reasoning unless they affect the next decision.
3. Prefer file paths, symbols, line numbers, and references to ${CONFIG.MAP_FILE} over pasted source content.
4. When command output matters, preserve the exact error, failing assertion, or version line only.
5. Before final response, use the latest summary instead of replaying the full transcript.

Context summaries should be short, factual, and actionable. Large copied context is a task failure when a smaller summary would preserve the decision.
`;
  }

  projectMapSection() {
    return `\n## 🗺️ Skill: ProjectMap\nMANDATORY: Read \`${CONFIG.MAP_FILE}\` BEFORE calling Read, Grep, Glob, or any file tool. It is the canonical index of all files, symbols, and dependency edges. Use it to identify exactly which files to open. Do not inspect raw files without consulting it first. Refresh with \`code-graph generate\` if stale. Skipping = task failure.\n`;
  }

  reflectionsSection() {
    return `\n## 🧠 Skill: Reflections\n${this.reflectionsProtocolBody()}`;
  }

  roocodeReflectionsSection() {
    return `\n# Reflections Protocol — MANDATORY\n${this.reflectionsProtocolBody()}`;
  }

  reflectionsProtocolBody() {
    return `MANDATORY — follow this cycle on every task. Skipping = task failure.

BEFORE planning or writing any code:
1. Read \`${CONFIG.REFLECTIONS_FILE}\` — apply every matching lesson as a hard constraint.
2. Read \`${CONFIG.RULES_FILE}\` — follow the protocol exactly.
3. If a lesson matches the current file, tool, OS, or failure mode: state explicitly how it changes your approach.

AFTER any failure, correction, or non-obvious fix:
- Run \`code-graph reflect <CATEGORY> <LESSON>\` with a concise, reusable lesson.
- You MUST either record a new lesson or explicitly state that none was learned.
- Do NOT mark a task complete without completing this step.

The goal: no agent repeats a mistake already recorded in \`${CONFIG.REFLECTIONS_FILE}\`.
`;
  }

  globalSkillsDir(platform) {
    const custom = PLATFORM_GLOBAL_PATHS[platform];
    return custom
      ? path.join(this.home, ...custom)
      : path.join(this.home, `.${platform}`, 'skills');
  }

  async installGlobalSkill(platform, skillName, description, body) {
    const skillDir = path.join(this.globalSkillsDir(platform), skillName);
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

  async uninstall(p, s, isGlobal = false) {
    const scope = isGlobal ? 'global' : 'project';
    console.log(`[Code-Graph] Running uninstall-skills (${s}) for ${p} [${scope}]...`);
    try {
      await this.removeLegacySkills(p);

      if (isGlobal) {
        if (s === 'all' || s === 'projectmap') {
          await fsp.rm(path.join(this.globalSkillsDir(p), 'projectmap'), { recursive: true, force: true });
        }
        if (s === 'all' || s === 'reflections') {
          await fsp.rm(path.join(this.globalSkillsDir(p), 'reflections'), { recursive: true, force: true });
        }
        if (s === 'all' || s === 'simplicity') {
          await fsp.rm(path.join(this.globalSkillsDir(p), 'simplicity'), { recursive: true, force: true });
        }
        if (s === 'all' || s === 'changelimit') {
          await fsp.rm(path.join(this.globalSkillsDir(p), 'changelimit'), { recursive: true, force: true });
        }
        if (s === 'all' || s === 'freshdeps') {
          await fsp.rm(path.join(this.globalSkillsDir(p), 'freshdeps'), { recursive: true, force: true });
        }
        if (s === 'all' || s === 'contextbudget') {
          await fsp.rm(path.join(this.globalSkillsDir(p), 'contextbudget'), { recursive: true, force: true });
        }
      } else {
        if (s === 'all' || s === 'projectmap') {
          const spec = this.projectMapSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
          await this.removeFromFile('GEMINI.md', `\n# Code-Graph ProjectMap\n@./${CONFIG.MAP_FILE}\n${this.projectMapSection()}`);
          await this.removeJsonHookEntry('.claude/settings.json', entry =>
            JSON.stringify(entry).includes('Skill(ProjectMap)'));
        }

        if (s === 'all' || s === 'reflections') {
          await this.removeOldReflectionsPrompts();
          await this.removeSkillArtifacts(p, 'reflections', this.reflectionsSection());
          await this.removeFromFile('.clinerules', this.roocodeReflectionsSection());
          await this.removeFromFile('.roorules', this.roocodeReflectionsSection());
        }
        if (s === 'all' || s === 'simplicity') {
          const spec = this.simplicitySpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
        }
        if (s === 'all' || s === 'changelimit') {
          const spec = this.changeLimitSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
        }
        if (s === 'all' || s === 'freshdeps') {
          const spec = this.freshDepsSpec();
          await this.removeSkillArtifacts(p, spec.name, spec.section, spec);
        }
        if (s === 'all' || s === 'contextbudget') {
          const spec = this.contextBudgetSpec();
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
        entry?.message === spec.codexHookMessage);
    }
    if (spec.opencodePlugin) {
      const pluginPath = `.opencode/plugins/${name}.js`;
      await this.removeFile(pluginPath);
      await this.removeJsonArrayValue('opencode.json', 'plugins', `./${pluginPath}`);
    }
  }

  async removeLegacySkills(p) {
    const skillsDir = (platform) => this.globalSkillsDir(platform);
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
      if (Object.keys(data).length === 0) await fsp.unlink(fullPath);
      else await fsp.writeFile(fullPath, JSON.stringify(data, null, 2));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}

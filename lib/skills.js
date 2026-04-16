/**
 * @file lib/skills.js
 * @description Manages platform-specific skills and agent integrations.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG } from './config.js';

export class SkillManager {
  constructor(cwd) {
    this.cwd = cwd;
    this.home = os.homedir();
  }

  async execute(platform, action, skill) {
    if (!platform) return console.error('[Code-Graph] Platform required. Usage: code-graph install-skills <platform> [projectmap|reflections]');
    const p = platform.toLowerCase();
    const act = (action || 'install-skills').toLowerCase();
    const s = (skill || 'all').toLowerCase();

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
    const section = `\n## 🗺️ Skill: ProjectMap\nBefore answering architecture questions, read \`${CONFIG.MAP_FILE}\` for god nodes and structural context. This ensures high-level awareness before searching raw files.\n`;
    const skillContent = `# ProjectMap Skill\nUse \`${CONFIG.MAP_FILE}\` for project navigation and architectural awareness.\n`;

    switch (p) {
      case 'claude':
        await this.appendToFile('CLAUDE.md', section);
        await this.writeJson('.claude/settings.json', { hooks: { preToolUse: [{ tools: ['glob', 'grep'], message: `Skill(ProjectMap): Knowledge graph exists. Read ${CONFIG.MAP_FILE} before searching raw files.` }] } });
        break;
      case 'cursor':
        await this.writeFile('.cursor/rules/projectmap.mdc', `---\ndescription: Use knowledge graph for navigation.\nalwaysApply: true\n---\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\` to locate core logic and dependencies.\n`);
        break;
      case 'gemini':
        const geminiSkill = `---\nname: projectmap\ndescription: Use knowledge graph for navigation.\n---\n${skillContent}`;
        await this.installGlobalSkill('gemini', 'projectmap', geminiSkill);
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
        await this.writeFile('.agent/rules/projectmap.md', `# ProjectMap\nAlways read \`${CONFIG.MAP_FILE}\`.\n`);
        await this.writeFile('.agent/workflows/projectmap.md', `# ProjectMap Workflow\nRegisters /projectmap to refresh graph.\n`);
        break;
      case 'kiro':
        await this.installGlobalSkill('kiro', 'projectmap', skillContent);
        await this.writeFile('.kiro/steering/projectmap.md', `inclusion: always\n# ProjectMap\nRead \`${CONFIG.MAP_FILE}\`.\n`);
        break;
      case 'intellij':
        await this.appendToFile('AGENTS.md', section);
        break;
      case 'copilot':
        await this.installGlobalSkill('copilot', 'projectmap', skillContent);
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
        await this.installGlobalSkill(p, 'projectmap', skillContent);
    }
  }

  async installReflections(p) {
    const section = `\n## 🧠 Skill: Reflections\nFollow the reflection cycle: Read \`${CONFIG.REFLECTIONS_FILE}\` for past lessons and run \`code-graph reflect\` after any bug fix or failure.\n`;
    const skillContent = `# Reflections Skill\nUse \`${CONFIG.REFLECTIONS_FILE}\` to persist and retrieve project-specific lessons and environment quirks.\n`;

    switch (p) {
      case 'claude':
        await this.appendToFile('CLAUDE.md', section);
        break;
      case 'cursor':
        await this.writeFile('.cursor/rules/reflections.mdc', `---\ndescription: Mandatory reflection cycle.\nalwaysApply: true\n---\n# Reflections\nFollow \`${CONFIG.RULES_FILE}\`. Update \`${CONFIG.REFLECTIONS_FILE}\` after every fix.\n`);
        break;
      case 'gemini':
        const geminiReflect = `---\nname: reflections\ndescription: Mandatory reflection cycle.\n---\n${skillContent}`;
        await this.installGlobalSkill('gemini', 'reflections', geminiReflect);
        await this.appendToFile('GEMINI.md', section);
        break;
      case 'antigravity':
        await this.writeFile('.agent/rules/reflections.md', `# Reflections\nFollow the reflection cycle in \`${CONFIG.RULES_FILE}\`.\n`);
        break;
      case 'kiro':
        await this.installGlobalSkill('kiro', 'reflections', skillContent);
        break;
      case 'copilot':
        await this.installGlobalSkill('copilot', 'reflections', skillContent);
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
        await this.installGlobalSkill(p, 'reflections', skillContent);
    }
  }

  async installGlobalSkill(platform, skillName, content) {
    const skillPath = path.join(this.home, `.${platform}`, 'skills', skillName, 'SKILL.md');
    try {
      await fsp.mkdir(path.dirname(skillPath), { recursive: true });
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
        await this.removeFile('.cursor/rules/projectmap.mdc');
        await this.removeFile('.agent/rules/projectmap.md');
        await this.removeFile('.agent/workflows/projectmap.md');
        await this.removeFile('.kiro/steering/projectmap.md');
        await this.removeFile('.opencode/plugins/projectmap.js');
        await fsp.rm(path.join(skillsDir(p), 'projectmap'), { recursive: true, force: true });
      }

      if (s === 'all' || s === 'reflections') {
        await this.removeFile('.cursor/rules/reflections.mdc');
        await this.removeFile('.agent/rules/reflections.md');
        await fsp.rm(path.join(skillsDir(p), 'reflections'), { recursive: true, force: true });
      }

      if (s === 'all') {
        const filesToRemove = [
          'CLAUDE.md', 'GEMINI.md', 'AGENTS.md', '.clinerules', '.roomodes', '.roorules',
          '.github/copilot-instructions.md', 'opencode.json'
        ];
        for (const f of filesToRemove) await this.removeFile(f);

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
      if (e.code === 'ENOENT') await fsp.writeFile(fullPath, content);
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
      existing = JSON.parse(await fsp.readFile(fullPath, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`[Code-Graph] Warning: Failed to parse ${filename}, overwriting: ${e.message}`);
      }
    }

    const merged = { ...existing };
    for (const key in data) {
      if (key === 'hooks' && typeof data[key] === 'object' && typeof existing[key] === 'object') {
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
          const isDuplicate = combined.some(e => e.message === entry.message);
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
}

/**
 * @file lib/agents.js
 * @description Manages sub-agent registrations and orchestrator integrations.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { SUPPORTED_PLATFORMS, isValidPlatform } from './config.js';

export class AgentManager {
  constructor(cwd) {
    this.cwd = cwd;
    this.home = os.homedir();
  }

  async execute(platform, action) {
    if (!platform) return console.error('[Code-Graph] Platform required. Usage: code-graph install-agent <platform>');
    if (!isValidPlatform(platform)) {
      return console.error(`[Code-Graph] Unsupported platform: ${platform}. Valid: ${SUPPORTED_PLATFORMS.join(', ')}`);
    }
    const p = platform.toLowerCase();
    const act = (action || 'install-agent').toLowerCase();

    if (act === 'install-agent') await this.install(p);
    else if (act === 'uninstall-agent') await this.uninstall(p);
    else console.error(`[Code-Graph] Unknown action: ${act}. Use install-agent or uninstall-agent.`);
  }

  async install(p) {
    console.log(`[Code-Graph] Registering code-graph as sub-agent for ${p}...`);
    try {
      switch (p) {
        case 'gemini': await this.installGeminiAgent(); break;
        case 'claude': await this.installClaudeSubagent(); break;
        case 'kiro': await this.installKiroAgent(); break;
        case 'antigravity': await this.installAntigravityAgent(); break;
        default:
          await this.installGenericPersona();
      }
      console.log(`[Code-Graph] Successfully registered sub-agent for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] Agent registration failed for ${p}: ${err.message}`);
    }
  }

  async uninstall(p) {
    console.log(`[Code-Graph] Removing sub-agent for ${p}...`);
    try {
      switch (p) {
        case 'gemini':
          await fsp.rm(path.join(this.home, '.gemini', 'subagents', 'code-graph'), { recursive: true, force: true });
          await fsp.rm(path.join(this.home, '.gemini', 'agents', 'code-graph.md'), { force: true });
          break;
        case 'claude':
          await this.removeFile('.mcp.json');
          await this.removeFile('mcp-server-code-graph.json');
          await this.removeFile('.claude/agents/code-graph.md');
          break;
        case 'kiro': await fsp.rm(path.join(this.home, '.kiro', 'agents', 'code-graph'), { recursive: true, force: true }); break;
        case 'antigravity':
          await fsp.rm(path.join(this.home, '.gemini', 'antigravity', 'skills', 'code-graph'), { recursive: true, force: true });
          // Legacy path cleanup
          await fsp.rm(path.join(this.home, '.agent', 'subagents', 'code-graph'), { recursive: true, force: true });
          break;
        default: await this.removeFile('.code-graph-agent.md');
      }

      // Defensive folder cleanup for global paths
      const globalFolders = [
        path.join(this.home, '.gemini', 'subagents'),
        path.join(this.home, '.kiro', 'agents'),
        path.join(this.home, '.agent', 'subagents')
      ];
      for (const f of globalFolders) {
        try {
          const entries = await fsp.readdir(f);
          if (entries.length === 0) await fsp.rmdir(f);
        } catch (e) { /* directory doesn't exist */ }
      }

      console.log(`[Code-Graph] Successfully removed sub-agent for ${p}.`);
    } catch (err) {
      console.error(`[Code-Graph] Agent removal failed: ${err.message}`);
    }
  }

  async removeFile(filename) {
    try {
      await fsp.unlink(path.join(this.cwd, filename));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async installGeminiAgent() {
    const agentFile = path.join(this.home, '.gemini', 'agents', 'code-graph.md');
    await fsp.mkdir(path.dirname(agentFile), { recursive: true });
    const content = `---\nname: code-graph\ndescription: Specialized analyst for codebase mapping and memory persistence.\n---\n# Code-Graph Agent\nRole: Specialized analyst for codebase mapping and memory persistence.\nBefore planning, read \`llm-agent-project-learnings.md\` and apply every relevant lesson as an active constraint.\nCapabilities: Can run \`code-graph generate\` to refresh the project map and \`code-graph reflect\` to save concise reusable lessons after failures, corrections, or non-obvious discoveries.\nUsage: Delegate architectural or environmental analysis to this agent.\n`;
    await fsp.writeFile(agentFile, content);
  }

  async installClaudeSubagent() {
    const agentPath = path.join(this.cwd, '.claude', 'agents', 'code-graph.md');
    const content = `---\nname: code-graph\ndescription: Codebase mapping and memory specialist. Delegate here for architectural overviews, refreshing the project map with \`code-graph generate\`, or persisting non-obvious lessons via \`code-graph reflect\`.\ntools: Read, Grep, Glob, Bash\nmodel: inherit\n---\nYou are the Code-Graph Specialist.\n\nResponsibilities:\n1. Before searching raw files, read \`llm-code-graph.md\` for god nodes and structural context.\n2. Before planning or making changes, read \`llm-agent-project-learnings.md\` and apply every relevant lesson as an active constraint.\n3. If a lesson matches the current file, tool, OS, dependency, or failure mode, mention how it changes your approach.\n4. If the map looks stale or missing, run \`code-graph generate\` to refresh it.\n5. After a failure, correction, repeated mistake, or non-obvious discovery, record a concise reusable lesson via \`code-graph reflect <category> <one-sentence lesson>\`.\n6. Return a concise summary to the main conversation, not raw exploration output.\n`;
    await fsp.mkdir(path.dirname(agentPath), { recursive: true });
    await fsp.writeFile(agentPath, content);
  }

  async installKiroAgent() {
    const agentDir = path.join(this.home, '.kiro', 'agents', 'code-graph');
    await fsp.mkdir(agentDir, { recursive: true });
    await fsp.writeFile(path.join(agentDir, 'AGENT.md'), `# Code-Graph\nSpecialist in project structure and navigation.\n`);
  }

  async installAntigravityAgent() {
    // Legacy path cleanup — older versions wrote here, but Antigravity doesn't read ~/.agent/.
    await fsp.rm(path.join(this.home, '.agent', 'subagents', 'code-graph'), { recursive: true, force: true });

    // Global skill recognized by Antigravity (user scope across projects).
    const skillDir = path.join(this.home, '.gemini', 'antigravity', 'skills', 'code-graph');
    await fsp.rm(skillDir, { recursive: true, force: true });
    await fsp.mkdir(skillDir, { recursive: true });
    const skillContent = `---\nname: code-graph\ndescription: Specialized analyst for codebase mapping and memory persistence. Use \`code-graph generate\` to refresh the project map and \`code-graph reflect\` to save lessons.\n---\n# Code-Graph Agent\nRole: Specialized analyst for codebase mapping and memory persistence.\nBefore planning, read \`llm-agent-project-learnings.md\` and apply every relevant lesson as an active constraint.\nCapabilities: Run \`code-graph generate\` to refresh the project map and \`code-graph reflect\` to persist lessons after failures, corrections, repeated mistakes, or non-obvious discoveries.\nUsage: Delegate architectural or environmental analysis here.\n`;
    await fsp.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

  }

  async installGenericPersona() {
    const content = `# SYSTEM PROMPT: Code-Graph Persona\nYour role is now to act as the Code-Graph Specialist. \n1. Use \`llm-code-graph.md\` to provide architectural overviews.\n2. Before planning, read \`llm-agent-project-learnings.md\` and apply every relevant lesson as an active constraint.\n3. Strictly follow the protocol in \`llm-agent-rules.md\`.\n4. After a failure, correction, repeated mistake, or non-obvious discovery, record a concise reusable lesson with \`code-graph reflect <CAT> <LESSON>\`.\n`;
    await fsp.writeFile(path.join(this.cwd, '.code-graph-agent.md'), content);
  }
}

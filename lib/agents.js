/**
 * @file lib/agents.js
 * @description Manages sub-agent registrations and orchestrator integrations.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { SUPPORTED_PLATFORMS, isValidPlatform } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __entryPoint = path.resolve(path.dirname(__filename), '..', 'index.js');

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
        case 'claude': await this.installMCPServer('.mcp.json'); break;
        case 'cursor': await this.installMCPServer('.cursor/mcp.json'); break;
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
        case 'claude': await this.removeMCPServer('.mcp.json'); break;
        case 'cursor': await this.removeMCPServer('.cursor/mcp.json'); break;
        case 'kiro': await fsp.rm(path.join(this.home, '.kiro', 'agents', 'code-graph'), { recursive: true, force: true }); break;
        case 'antigravity': await fsp.rm(path.join(this.home, '.agent', 'subagents', 'code-graph'), { recursive: true, force: true }); break;
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
    const content = `---\nname: code-graph\ndescription: Specialized analyst for codebase mapping and memory persistence.\n---\n# Code-Graph Agent\nRole: Specialized analyst for codebase mapping and memory persistence.\nCapabilities: Can run \`code-graph generate\` to refresh the project map and \`code-graph reflect\` to save lessons.\nUsage: Delegate architectural or environmental analysis to this agent.\n`;
    await fsp.writeFile(agentFile, content);
  }

  async installMCPServer(relPath) {
    const target = path.join(this.cwd, relPath);
    const entry = {
      command: "node",
      args: [__entryPoint, "mcp", this.cwd],
      description: "MCP server exposing code-graph tools for LLM context optimization."
    };

    let existing = {};
    try {
      existing = JSON.parse(await fsp.readFile(target, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`[Code-Graph] Warning: couldn't parse ${relPath}, overwriting: ${e.message}`);
      }
    }

    const merged = {
      ...existing,
      mcpServers: { ...(existing.mcpServers || {}), "code-graph": entry }
    };

    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, JSON.stringify(merged, null, 2));
  }

  async removeMCPServer(relPath) {
    const target = path.join(this.cwd, relPath);
    try {
      const data = JSON.parse(await fsp.readFile(target, 'utf8'));
      if (data.mcpServers && data.mcpServers['code-graph']) {
        delete data.mcpServers['code-graph'];
        if (Object.keys(data.mcpServers).length === 0) delete data.mcpServers;
      }
      if (Object.keys(data).length === 0) {
        await fsp.unlink(target);
      } else {
        await fsp.writeFile(target, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      if (e.code !== 'ENOENT') { /* ignore */ }
    }
    // Legacy cleanup
    await this.removeFile('mcp-server-code-graph.json');
  }

  async installKiroAgent() {
    const agentDir = path.join(this.home, '.kiro', 'agents', 'code-graph');
    await fsp.mkdir(agentDir, { recursive: true });
    await fsp.writeFile(path.join(agentDir, 'AGENT.md'), `# Code-Graph\nSpecialist in project structure and navigation.\n`);
  }

  async installAntigravityAgent() {
    const agentDir = path.join(this.home, '.agent', 'subagents', 'code-graph');
    await fsp.mkdir(agentDir, { recursive: true });
    await fsp.writeFile(path.join(agentDir, 'AGENT.md'), `# Code-Graph Sub-Agent\nHandles structural mapping and reflection.\n`);
  }

  async installGenericPersona() {
    const content = `# SYSTEM PROMPT: Code-Graph Persona\nYour role is now to act as the Code-Graph Specialist. \n1. Use \`llm-code-graph.md\` to provide architectural overviews.\n2. Strictly follow the protocol in \`llm-agent-rules.md\`.\n3. Always suggest a \`code-graph reflect\` entry after resolving a non-obvious issue.\n`;
    await fsp.writeFile(path.join(this.cwd, '.code-graph-agent.md'), content);
  }
}

/**
 * @file lib/agents.js
 * @description Manages sub-agent registrations and orchestrator integrations.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { SUPPORTED_PLATFORMS, isValidPlatform } from './config.js';
import { logInstallTarget } from './install-log.js';

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
          await this.removeFile('.claude/agents/code-graph.md');
          await this.removeFile('.claude/agents/code-graph-locator.md');
          await this.removeFile('.claude/agents/code-graph-tracer.md');
          await this.removeFile('.claude/agents/code-graph-reviewer.md');
          break;
        case 'kiro': await fsp.rm(path.join(this.home, '.kiro', 'agents', 'code-graph'), { recursive: true, force: true }); break;
        case 'antigravity':
          await fsp.rm(path.join(this.home, '.gemini', 'antigravity', 'skills', 'code-graph'), { recursive: true, force: true });
          // Legacy paths
          await fsp.rm(path.join(this.home, '.antigravity', 'skills', 'code-graph'), { recursive: true, force: true });
          await fsp.rm(path.join(this.home, '.agent', 'subagents', 'code-graph'), { recursive: true, force: true });
          break;
        default: await this.removeFile('.code-graph-agent.md');
      }

      // Defensive folder cleanup — remove parent dirs if left empty after uninstall
      const globalFolders = [
        path.join(this.home, '.gemini', 'subagents'),
        path.join(this.home, '.kiro', 'agents'),
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
    const content = `---\nname: code-graph\ndescription: Use INSTEAD of reading source files for architectural overviews, finding relevant files, refreshing the map (code-graph generate), or persisting lessons after failures (code-graph reflect). Reads llm-code-graph.md and llm-agent-project-learnings.md without consuming source-file context budget.\n---\n# Code-Graph Agent\n\nUse INSTEAD of reading source files when:\n- You need an architectural overview or project structure question answered\n- You want to find relevant files before exploring source\n- You need to refresh the project map after adding/removing files\n- You need to persist a lesson after a failure or non-obvious discovery\n\nProtocol:\n1. Before inspecting any source file, read \`llm-code-graph.md\` — canonical index of all files, symbols, and edges.\n2. Before planning, read \`llm-agent-project-learnings.md\` — apply every matching lesson as an active constraint.\n3. If the map looks stale or missing, run \`code-graph generate\` to refresh it.\n4. After a failure, correction, or non-obvious discovery, run \`code-graph reflect <category> <one-sentence lesson>\`.\n5. Return concise summaries only — no raw source dumps.\n`;
    await fsp.writeFile(agentFile, content);
    logInstallTarget(agentFile);
  }

  async installClaudeSubagent() {
    const agents = {
      'code-graph': {
        description: 'Use INSTEAD of reading source files when you need an architectural overview, want to understand project structure, need to refresh the map (code-graph generate), or persist a lesson after a failure or non-obvious discovery (code-graph reflect). Reads llm-code-graph.md and llm-agent-project-learnings.md without burning source-file context budget.',
        body: `You are the Code-Graph Specialist.\n\nResponsibilities:\n1. Before searching raw files, read \`llm-code-graph.md\` for god nodes and structural context.\n2. Before planning or making changes, read \`llm-agent-project-learnings.md\` and apply every relevant lesson as an active constraint.\n3. If a lesson matches the current file, tool, OS, dependency, or failure mode, mention how it changes your approach.\n4. If the map looks stale or missing, run \`code-graph generate\` to refresh it.\n5. After a failure, correction, repeated mistake, or non-obvious discovery, record a concise reusable lesson via \`code-graph reflect <category> <one-sentence lesson>\`.\n6. Return a concise summary to the main conversation, not raw exploration output.\n`
      },
      'code-graph-locator': {
        description: 'Use INSTEAD of Read/Grep when finding which files are relevant before touching source. Queries llm-code-graph.md to return the smallest useful file set, saving context budget. Trigger: "which files relate to X", "where is Y defined", "what should I read before changing Z".',
        body: `Use \`llm-code-graph.md\` first. Return compact outputs only:\n- relevant files\n- symbols\n- why each file matters\n- raw files still worth opening\nDo not implement changes. Do not paste source.\n`
      },
      'code-graph-tracer': {
        description: 'Use INSTEAD of manual import tracing when assessing change impact. Reads the EDGES section of llm-code-graph.md to map upstream/downstream blast radius before you edit. Trigger: "what depends on X", "what breaks if I change Y", "trace the call path to Z".',
        body: `Use the EDGES section in \`llm-code-graph.md\` first. Return compact outputs only:\n- dependency path\n- upstream/downstream impact\n- likely risk files\n- missing edges if map appears stale\nDo not implement changes. Do not paste source.\n`
      },
      'code-graph-reviewer': {
        description: 'Use AFTER making changes to verify Code-Graph protocol compliance — not for general code review. Checks map freshness, missing reflections, scope creep, dependency staleness. Trigger: "check code-graph protocol", "is the map stale", "did I miss any reflections".',
        body: `Review for Code-Graph protocol gaps. Return compact outputs only:\n- stale or missing \`llm-code-graph.md\` update\n- missing reflection after failure or non-obvious behavior\n- scope creep against Simplicity and SurgicalChanges\n- dependency freshness concern\nDo not repeat generic code review unless it affects these protocol checks.\n`
      }
    };

    for (const [name, spec] of Object.entries(agents)) {
      await this.writeClaudeAgent(name, spec.description, spec.body);
    }
  }

  async writeClaudeAgent(name, description, body) {
    const agentPath = path.join(this.cwd, '.claude', 'agents', `${name}.md`);
    const content = `---\nname: ${name}\ndescription: ${description}\ntools: Read, Grep, Glob, Bash\nmodel: inherit\n---\n${body}`;
    await fsp.mkdir(path.dirname(agentPath), { recursive: true });
    await fsp.writeFile(agentPath, content);
    logInstallTarget(agentPath);
  }

  async installKiroAgent() {
    const agentDir = path.join(this.home, '.kiro', 'agents', 'code-graph');
    await fsp.mkdir(agentDir, { recursive: true });
    const agentFile = path.join(agentDir, 'AGENT.md');
    await fsp.writeFile(agentFile, `# Code-Graph — Project Map and Memory Specialist\n\nUse INSTEAD of reading source files for:\n- Architectural overviews and project structure questions\n- Finding relevant files before exploring source (reads llm-code-graph.md)\n- Refreshing the project map after adding/removing files (code-graph generate)\n- Persisting lessons after failures or non-obvious discoveries (code-graph reflect)\n\nProtocol:\n1. Before inspecting any source file, read \`llm-code-graph.md\` — canonical index of all files, symbols, and edges.\n2. Before planning, read \`llm-agent-project-learnings.md\` — apply every matching lesson as an active constraint.\n3. If map is stale or missing, run \`code-graph generate\`.\n4. After failure, correction, or non-obvious discovery: run \`code-graph reflect <category> <lesson>\`.\n5. Return compact summaries only — no raw source dumps.\n`);
    logInstallTarget(agentFile);
  }

  async installAntigravityAgent() {
    // Legacy path cleanup — older versions wrote to ~/.agent/.
    await fsp.rm(path.join(this.home, '.agent', 'subagents', 'code-graph'), { recursive: true, force: true });

    // Official path: ~/.gemini/antigravity/skills/ (per vercel-labs/skills).
    const skillDir = path.join(this.home, '.gemini', 'antigravity', 'skills', 'code-graph');
    await fsp.rm(skillDir, { recursive: true, force: true });
    await fsp.mkdir(skillDir, { recursive: true });
    const skillContent = `---\nname: code-graph\ndescription: Use INSTEAD of reading source files for architectural overviews, finding relevant files, refreshing the map (code-graph generate), or persisting lessons after failures (code-graph reflect). Reads llm-code-graph.md and llm-agent-project-learnings.md without consuming source-file context budget.\n---\n# Code-Graph Agent\n\nUse INSTEAD of reading source files when:\n- You need an architectural overview or project structure question answered\n- You want to find relevant files before exploring source\n- You need to refresh the project map after adding/removing files\n- You need to persist a lesson after a failure or non-obvious discovery\n\nProtocol:\n1. Before inspecting any source file, read \`llm-code-graph.md\` — canonical index of all files, symbols, and edges.\n2. Before planning, read \`llm-agent-project-learnings.md\` — apply every matching lesson as an active constraint.\n3. If the map looks stale or missing, run \`code-graph generate\` to refresh it.\n4. After a failure, correction, or non-obvious discovery, run \`code-graph reflect <category> <one-sentence lesson>\`.\n5. Return concise summaries only — no raw source dumps.\n`;
    const skillPath = path.join(skillDir, 'SKILL.md');
    await fsp.writeFile(skillPath, skillContent);
    logInstallTarget(skillPath);

  }

  async installGenericPersona() {
    const content = `# SYSTEM PROMPT: Code-Graph Personas\nUse these roles when your agent supports delegation. Return compact outputs and avoid raw source dumps.\n\n## code-graph\nUse INSTEAD of reading source files for architectural overviews, project structure questions, refreshing the map, or persisting lessons after failures.\n1. Use \`llm-code-graph.md\` for structure without burning source-file context.\n2. Before planning, read \`llm-agent-project-learnings.md\` and apply every relevant lesson as an active constraint.\n3. Strictly follow the protocol in \`llm-agent-rules.md\`.\n4. After a failure, correction, repeated mistake, or non-obvious discovery, record a concise reusable lesson with \`code-graph reflect <CAT> <LESSON>\`.\n\n## code-graph-locator\nUse INSTEAD of Read/Grep when finding relevant files before exploring source. Trigger: "which files relate to X", "where is Y defined", "what should I read before changing Z". Return files, symbols, reasons, and raw files worth opening. Do not implement.\n\n## code-graph-tracer\nUse INSTEAD of manual import tracing when assessing change impact. Trigger: "what depends on X", "what breaks if I change Y". Trace from the EDGES section. Return path, upstream/downstream impact, risk files, stale-map gaps. Do not implement.\n\n## code-graph-reviewer\nUse AFTER making changes to check Code-Graph protocol compliance — not for general code review. Trigger: "check code-graph protocol", "is the map stale", "did I miss reflections". Check: stale map, missing reflections, scope creep, dependency freshness.\n`;
    const personaPath = path.join(this.cwd, '.code-graph-agent.md');
    await fsp.writeFile(personaPath, content);
    logInstallTarget(personaPath);
  }
}

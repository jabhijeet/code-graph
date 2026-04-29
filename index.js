#!/usr/bin/env node

/**
 * @file index.js
 * @description CLI entry point for code-graph-llm.
 * Compact, language-agnostic codebase mapper for LLM token efficiency.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

import { CONFIG, SUPPORTED_EXTENSIONS, SUPPORTED_PLATFORMS, escapeRegex, isValidPlatform } from './lib/config.js';
import { CodeParser } from './lib/parser.js';
import { ProjectMapper } from './lib/mapper.js';
import { ReflectionManager } from './lib/reflections.js';
import { ProjectInitializer } from './lib/initializer.js';
import { SkillManager } from './lib/skills.js';
import { AgentManager } from './lib/agents.js';
import { startMCPServer } from './lib/mcp.js';

const __filename = fileURLToPath(import.meta.url);

// --- CLI ---

function printHelp() {
  console.log(`code-graph-llm v${CONFIG.VERSION} — Compact codebase mapper for LLM agents.

Usage: code-graph <command> [options]

Commands:
  generate                              Build the project map (default)
  init                                  Scaffold rule and reflection files
  reflect <category> <lesson>           Record a project lesson
  watch                                 Watch for changes and auto-regenerate

  install [-g] <platform>                    Install skills + agent for a platform
  uninstall [-g] <platform>                  Remove skills + agent for a platform
  install-skills [-g] <platform> [skill]     Install skills (projectmap|reflections|simplicity|changelimit|freshdeps|contextbudget)
  uninstall-skills [-g] <platform> [skill]   Remove skills (projectmap|reflections|simplicity|changelimit|freshdeps|contextbudget)
  install-agent <platform>              Register as sub-agent
  uninstall-agent <platform>            Remove sub-agent registration
  uninstall-all                         Remove all platform integrations

  install-hook                          Install git pre-commit hook

Flags:
  -g, --global                          Install to user home dir (all projects)
                                        Default installs to current project only
  --version, -v                         Print version
  --help, -h                            Print this help

Platforms (original):
  claude, cursor, gemini, codex, opencode, roocode, kiro,
  antigravity, copilot, vscode, intellij, aider, trae, hermes, generic

Platforms (extended — 53 agents total):
  aider-desk, amp, augment, bob, openclaw, cline, warp, codearts-agent,
  codebuddy, codemaker, codestudio, command-code, continue, cortex, crush,
  deepagents, devin, droid, firebender, forgecode, gemini-cli, github-copilot,
  goose, junie, iflow-cli, kilo, kimi-cli, kiro-cli, kode, mcpjam,
  mistral-vibe, mux, openhands, pi, qoder, qwen-code, replit, rovodev, roo,
  tabnine-cli, trae-cn, universal, windsurf, zencoder, neovate, pochi, adal`);
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const isGlobal = rawArgs.includes('-g') || rawArgs.includes('--global');
  const filteredArgs = rawArgs.filter(a => a !== '-g' && a !== '--global');
  const [command, ...args] = filteredArgs;
  const cwd = process.cwd();

  try {
    const platforms = SUPPORTED_PLATFORMS;

    switch (command || 'generate') {
      case '--help':
      case '-h':
      case 'help':
        printHelp();
        break;
      case '--version':
      case '-v':
        console.log(`code-graph-llm v${CONFIG.VERSION}`);
        break;
      case 'generate':
        await ProjectInitializer.init(cwd);
        await new ProjectMapper(cwd).generate();
        break;
      case 'init':
        await ProjectInitializer.init(cwd);
        break;
      case 'reflect':
        await ReflectionManager.add(args[0], args.slice(1).join(' '));
        break;
      case 'install-hook':
        await ProjectInitializer.init(cwd);
        await installGitHook(cwd);
        break;
      case 'install-skills':
        await new SkillManager(cwd).execute(args[0], 'install-skills', args[1], isGlobal);
        break;
      case 'uninstall-skills':
        await new SkillManager(cwd).execute(args[0], 'uninstall-skills', args[1], isGlobal);
        break;
      case 'install-agent':
        await new AgentManager(cwd).execute(args[0], 'install-agent');
        break;
      case 'uninstall-agent':
        await new AgentManager(cwd).execute(args[0], 'uninstall-agent');
        break;
      case 'install':
        await new SkillManager(cwd).execute(args[0], 'install-skills', undefined, isGlobal);
        await new AgentManager(cwd).execute(args[0], 'install-agent');
        break;
      case 'uninstall':
        await new SkillManager(cwd).execute(args[0], 'uninstall-skills', undefined, isGlobal);
        await new AgentManager(cwd).execute(args[0], 'uninstall-agent');
        break;
      case 'uninstall-all':
        console.log('[Code-Graph] Performing full cleanup...');
        for (const p of platforms) {
          await new SkillManager(cwd).execute(p, 'uninstall-skills', undefined, isGlobal);
          await new AgentManager(cwd).execute(p, 'uninstall-agent');
        }
        break;
      case 'watch':
        startWatcher(cwd);
        break;
      case 'mcp':
        startMCPServer(args[0] || cwd);
        break;
      default:
        if (platforms.includes(command?.toLowerCase())) {
          await new SkillManager(cwd).execute(command, args[0], args[1], isGlobal);
        } else {
          printHelp();
        }
    }
  } catch (err) {
    console.error(`[Code-Graph] Critical Error: ${err.message}`);
    process.exit(1);
  }
}

async function installGitHook(cwd) {
  const hookPath = path.join(cwd, '.git', 'hooks', 'pre-commit');
  try {
    await fsp.access(path.dirname(hookPath));
  } catch (e) {
    return console.error('[Code-Graph] No .git directory found.');
  }

  const content = `#!/bin/sh
# Code-Graph Advisory: Map Sync & Reflection Reminder
echo "[Code-Graph] Validating commit..."

# 1. Regenerate Map
node "${__filename}" generate
git add "${CONFIG.MAP_FILE}"

# 2. Reflection Advisory
# Notify if code changed but reflections didn't (Soft Nudge)
CODE_CHANGES=$(git diff --cached --name-only | grep -E "\\.(${CONFIG.SUPPORTED_EXTENSIONS.map(e => e.slice(1)).join('|')})$")
REFLECT_CHANGES=$(git diff --cached --name-only | grep "${CONFIG.REFLECTIONS_FILE}")

if [ ! -z "$CODE_CHANGES" ] && [ -z "$REFLECT_CHANGES" ]; then
  echo "--------------------------------------------------------"
  echo "ℹ️  [Code-Graph] ADVISORY: Reflection Check"
  echo "Significant code changes detected without a reflection."
  echo "If you learned something new or fixed a non-obvious bug,"
  echo "run 'code-graph reflect LOGIC <lesson>' before committing."
  echo "--------------------------------------------------------"
fi
`;
  await fsp.writeFile(hookPath, content, { mode: 0o755 });
  console.log('[Code-Graph] Pre-commit Advisory installed (Soft Enforcement).');
}

function startWatcher(cwd) {
  console.log(`[Code-Graph] Watching ${cwd}...`);
  let timer;
  chokidar.watch(cwd, { ignoreInitial: true, ignored: [/node_modules/, /\.git/, new RegExp(CONFIG.MAP_FILE)] })
    .on('all', () => {
      clearTimeout(timer);
      timer = setTimeout(() => new ProjectMapper(cwd).generate(), 1000);
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main();
}

// Re-export all public APIs for library consumers
export { CONFIG, SUPPORTED_EXTENSIONS, SUPPORTED_PLATFORMS, escapeRegex, isValidPlatform, stripDangerousKeys } from './lib/config.js';
export { CodeParser } from './lib/parser.js';
export { ProjectMapper } from './lib/mapper.js';
export { ReflectionManager } from './lib/reflections.js';
export { ProjectInitializer } from './lib/initializer.js';
export { SkillManager } from './lib/skills.js';
export { AgentManager } from './lib/agents.js';

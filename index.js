#!/usr/bin/env node

/**
 * @file index.js
 * @description CLI entry point for code-graph-llm.
 * Compact, language-agnostic codebase mapper for LLM token efficiency.
 */

import { promises as fsp, readFileSync, realpathSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import ignore from 'ignore';

import { CONFIG, SUPPORTED_EXTENSIONS, SUPPORTED_PLATFORMS, escapeRegex, isValidPlatform } from './lib/config.js';
import { CodeParser } from './lib/parser.js';
import { ProjectMapper } from './lib/mapper.js';
import { ReflectionManager } from './lib/reflections.js';
import { ProjectInitializer } from './lib/initializer.js';
import { SkillManager } from './lib/skills/core.js';
import { AgentManager } from './lib/agents.js';

const __filename = fileURLToPath(import.meta.url);
const PACKAGE_NAME = 'code-graph-llm';

// --- CLI ---

function printHelp() {
  console.log(`code-graph-llm v${CONFIG.VERSION} — Compact codebase mapper for LLM agents.

Usage: code-graph <command> [options]

Commands:
  generate [--max-tokens N]             Build the project map (default)
  check [--max-tokens N]                Exit 1 if the map is stale (for CI)
  init                                  Scaffold rule and reflection files
  reflect <category> <lesson>           Record a project lesson
  watch                                 Watch for changes and auto-regenerate
  mcp                                   Start MCP stdio server (for Claude Code integration)

  install [-g] <platform>                    Install skills + agent for a platform
  uninstall [-g] <platform>                  Remove skills + agent for a platform
  install-skills [-g] <platform> [skill]     Install skills (projectmap|reflections|thinkbeforecoding|simplicity|changelimit|surgicalchanges|goaldriven|freshdeps|contextbudget)
  uninstall-skills [-g] <platform> [skill]   Remove skills (projectmap|reflections|thinkbeforecoding|simplicity|changelimit|surgicalchanges|goaldriven|freshdeps|contextbudget)
  install-agent <platform>              Register as sub-agent
  uninstall-agent <platform>            Remove sub-agent registration
  uninstall-all                         Remove all platform integrations

  install-hook                          Install git pre-commit hook

Flags:
  -g, --global                          Install to user home dir (all projects)
                                        Default installs to current project only
  --max-tokens N                        Trim lowest-ranked files from the markdown map
                                        to fit ~N tokens (JSON map stays complete)
  --no-cache                            Re-parse every file (ignore ${CONFIG.CACHE_FILE})
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
  const useCache = !rawArgs.includes('--no-cache');
  const maxTokensIdx = rawArgs.indexOf('--max-tokens');
  const maxTokensArg = maxTokensIdx === -1 ? null : rawArgs[maxTokensIdx + 1];
  const filteredArgs = rawArgs.filter((a, i) =>
    a !== '-g' && a !== '--global' && a !== '--no-cache'
    && !(maxTokensIdx !== -1 && (i === maxTokensIdx || i === maxTokensIdx + 1)));
  const [command, ...args] = filteredArgs;
  const cwd = process.cwd();

  try {
    const platforms = SUPPORTED_PLATFORMS;
    const maxTokens = maxTokensArg === null ? 0 : Number.parseInt(maxTokensArg, 10);
    if (maxTokensArg !== null && !(maxTokens > 0)) {
      throw new Error(`--max-tokens expects a positive integer, got "${maxTokensArg ?? ''}"`);
    }
    const mapperOptions = { maxTokens, useCache };

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
        await new ProjectMapper(cwd, mapperOptions).generate();
        break;
      case 'check': {
        const { upToDate, stale } = await new ProjectMapper(cwd, mapperOptions).check();
        if (upToDate) {
          console.log('[Code-Graph] Map is up to date.');
        } else {
          console.error(`[Code-Graph] Map is stale: ${stale.join(', ')}. Run 'code-graph generate'.`);
          process.exitCode = 1;
        }
        break;
      }
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
        startWatcher(cwd, mapperOptions);
        break;
      case 'mcp': {
        const { startMcpServer } = await import('./lib/mcp-server.js');
        await startMcpServer();
        break;
      }

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

export async function installGitHook(cwd) {
  const hookPath = path.join(cwd, '.git', 'hooks', 'pre-commit');
  try {
    await fsp.access(path.dirname(hookPath));
  } catch (e) {
    return console.error('[Code-Graph] No .git directory found.');
  }

  const blockStart = '# BEGIN CODE-GRAPH';
  const blockEnd = '# END CODE-GRAPH';
  // Forward slashes: the hook runs under sh (Git Bash on Windows).
  const cliPath = __filename.replace(/\\/g, '/');
  const managedBlock = `${blockStart}
# Code-Graph Advisory: Map Sync & Reflection Reminder
echo "[Code-Graph] Validating commit..."

# 1. Regenerate Map (the install-time path may vanish, e.g. a cleared npx cache)
CG_STATUS=failed
if [ -f "${cliPath}" ]; then
  node "${cliPath}" generate >/dev/null && CG_STATUS=ok
elif command -v code-graph >/dev/null 2>&1; then
  code-graph generate >/dev/null && CG_STATUS=ok
elif command -v npx >/dev/null 2>&1; then
  npx --yes ${PACKAGE_NAME}@latest generate >/dev/null && CG_STATUS=ok
else
  CG_STATUS=missing
fi
if [ "$CG_STATUS" = ok ]; then
  git add "${CONFIG.MAP_FILE}" "${CONFIG.MAP_JSON_FILE}"
elif [ "$CG_STATUS" = missing ]; then
  echo "[Code-Graph] code-graph not found; skipping map regeneration."
else
  echo "[Code-Graph] Map generation failed; map not staged."
fi

# 2. Reflection Advisory
# Notify if code changed but reflections didn't (Soft Nudge)
CODE_CHANGES=$(git diff --cached --name-only | grep -E "\\.(${CONFIG.SUPPORTED_EXTENSIONS.map(e => e.slice(1)).join('|')})$")
REFLECT_CHANGES=$(git diff --cached --name-only | grep -F "${CONFIG.REFLECTIONS_FILE}")

if [ ! -z "$CODE_CHANGES" ] && [ -z "$REFLECT_CHANGES" ]; then
  echo "--------------------------------------------------------"
  echo "ℹ️  [Code-Graph] ADVISORY: Reflection Check"
  echo "Significant code changes detected without a reflection."
  echo "If you learned something new or fixed a non-obvious bug,"
  echo "run 'code-graph reflect LOGIC <lesson>' before committing."
  echo "--------------------------------------------------------"
fi
${blockEnd}
`;

  let content = '#!/bin/sh\n';
  try {
    const existing = await fsp.readFile(hookPath, 'utf8');
    if (existing.includes(blockStart) && existing.includes(blockEnd)) {
      content = existing.replace(
        new RegExp(`${escapeRegex(blockStart)}[\\s\\S]*?${escapeRegex(blockEnd)}\\n?`),
        `${managedBlock}\n`
      );
    } else if (existing.trim()) {
      const normalized = existing.endsWith('\n') ? existing : `${existing}\n`;
      content = `${normalized}\n${managedBlock}`;
    } else {
      content = `#!/bin/sh\n\n${managedBlock}`;
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    content = `#!/bin/sh\n\n${managedBlock}`;
  }

  await fsp.writeFile(hookPath, content, { mode: 0o755 });
  console.log('[Code-Graph] Pre-commit Advisory installed (Soft Enforcement).');
}

let activeWatcher = null;

export function startWatcher(cwd, mapperOptions = {}) {
  console.log(`[Code-Graph] Watching ${cwd}...`);
  const ig = ignore().add(CONFIG.DEFAULT_IGNORES);
  try {
    ig.add(readFileSync(path.join(cwd, CONFIG.IGNORE_FILE), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn(`[Code-Graph] Warning: unreadable ${CONFIG.IGNORE_FILE}: ${e.message}`);
  }
  const isIgnored = (p, stats) => {
    const rel = path.relative(cwd, p).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..')) return false;
    return ig.ignores(stats?.isDirectory() ? `${rel}/` : rel);
  };

  let timer;
  let running = false;
  let pending = false;
  const regenerate = async () => {
    // Serialize runs: a change during a long scan triggers exactly one follow-up run.
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      await new ProjectMapper(cwd, mapperOptions).generate();
    } catch (err) {
      console.error(`[Code-Graph] Regeneration failed: ${err.message}`);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        regenerate();
      }
    }
  };

  const watcher = chokidar.watch(cwd, { ignoreInitial: true, ignored: isIgnored })
    .on('all', (event, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!event.endsWith('Dir') && !CONFIG.SUPPORTED_EXTENSIONS.includes(ext)) return;
      clearTimeout(timer);
      timer = setTimeout(regenerate, 1000);
    })
    .on('error', (err) => {
      console.error(`[Code-Graph] Watcher error: ${err.message}`);
    });
  activeWatcher = watcher;
  return watcher;
}

export function stopWatcher() {
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
    console.log('[Code-Graph] Watcher stopped.');
  }
}

if (process.argv[1] && realpathSync(path.resolve(process.argv[1])) === realpathSync(path.resolve(__filename))) {
  main();
}

// Re-export all public APIs for library consumers
export { CONFIG, SUPPORTED_EXTENSIONS, SUPPORTED_PLATFORMS, escapeRegex, isValidPlatform, stripDangerousKeys } from './lib/config.js';
export { CodeParser } from './lib/parser.js';
export { TreeSitterParser, GRAMMAR_BY_EXTENSION } from './lib/treesitter.js';
export { ProjectMapper } from './lib/mapper.js';
export { ReflectionManager } from './lib/reflections.js';
export { ProjectInitializer } from './lib/initializer.js';
export { SkillManager } from './lib/skills/core.js';
export { AgentManager } from './lib/agents.js';

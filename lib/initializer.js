/**
 * @file lib/initializer.js
 * @description Scaffolds the initial agent-agnostic rule and reflection files.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

export class ProjectInitializer {
  static async init(cwd) {
    const rulesPath = path.join(cwd, CONFIG.RULES_FILE);
    const reflectPath = path.join(cwd, CONFIG.REFLECTIONS_FILE);

    const rulesContent = `# LLM_AGENT_RULES (STRICT PROTOCOL)
> This protocol is MANDATORY for all LLM agents. Failure to update memory is a failure of the task.

## 🧩 MANDATORY SKILLS
Every bundled skill is mandatory for every agent. Agents MUST follow ProjectMap, Reflections, Simplicity, ChangeLimit, FreshDeps, and ContextBudget together; none are optional preferences.
- **ProjectMap:** Read \`${CONFIG.MAP_FILE}\` before raw file inspection and use it to pick the smallest useful file set.
- **Reflections:** Read \`${CONFIG.REFLECTIONS_FILE}\` before work and record reusable lessons after failures or non-obvious behavior.
- **Simplicity:** Write only what the task requires; no extra abstractions, features, or speculative handling.
- **ChangeLimit:** Change only the explicitly required files and lines; no unrelated refactors or style churn.
- **FreshDeps:** Use latest stable compatible dependencies and current APIs. Avoid deprecated packages, methods, functions, flags, and patterns. If an agent repeats a stale or deprecated choice after correction, it MUST stop, re-read these rules, state that FreshDeps is mandatory, and replace the choice with the current stable approach.
- **ContextBudget:** Periodically condense working context into a compact rolling summary after each phase or every 10 tool calls.

## 🧠 THE REFLECTION CYCLE
1. **PRE-TASK:** Before planning or making changes, read \`${CONFIG.REFLECTIONS_FILE}\`.
2. **APPLY MEMORY:** Treat every relevant lesson as an active constraint. If a lesson matches the current file, tool, OS, dependency, or failure mode, state how it changes your approach.
3. **EXECUTION:** Monitor for failures, corrections, repeated mistakes, or non-obvious project behavior.
4. **POST-TASK:** Run \`code-graph reflect <CAT> <LESSON>\` for any new reusable lesson. Do not finish a bug fix, failed-command recovery, or environment workaround without either recording a reflection or explicitly stating that no new reusable lesson was learned.

## 📝 REFLECTION CATEGORIES
- \`LOGIC\`: Code bugs or complex regex pitfalls.
- \`ENV\`: OS compatibility or shell behaviors.
- \`DEP\`: Library bugs or version deprecations.
- \`STYLE\`: Project-specific architectural rules.
`;

    const reflectContent = `# LLM_AGENT_PROJECT_LEARNINGS\n> LLM AGENT MEMORY: READ BEFORE STARTING TASKS. UPDATE ON FAILURES.\n`;

    try {
      try {
        await fsp.access(rulesPath);
      } catch (e) {
        await fsp.writeFile(rulesPath, rulesContent);
        console.log(`[Code-Graph] Initialized ${CONFIG.RULES_FILE}`);
      }
      try {
        await fsp.access(reflectPath);
      } catch (e) {
        await fsp.writeFile(reflectPath, reflectContent);
        console.log(`[Code-Graph] Initialized ${CONFIG.REFLECTIONS_FILE}`);
      }
    } catch (err) {
      console.error(`[Code-Graph] Initialization failed: ${err.message}`);
    }
  }
}

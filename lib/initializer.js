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

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
1. **PRE-TASK:** Read \`${CONFIG.REFLECTIONS_FILE}\` to identify existing pitfalls.
2. **EXECUTION:** Monitor for "Learned Moments" (failures, corrections, or discoveries).
3. **POST-TASK:** Immediately run \`code-graph reflect <CAT> <LESSON>\` for any discovery.

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

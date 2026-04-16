/**
 * @file lib/reflections.js
 * @description Manages project reflections and lessons learned.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

export class ReflectionManager {
  static async add(category, lesson) {
    if (!lesson) return console.error('[Code-Graph] Usage: reflect <cat> <lesson>');

    const filePath = path.join(process.cwd(), CONFIG.REFLECTIONS_FILE);
    const header = `# LLM_LEARNINGS\n> READ BEFORE TASKS. UPDATE ON FAILURES.\n`;
    const entry = `- [${category.toUpperCase()}] ${lesson}`;

    try {
      let content;
      try {
        content = await fsp.readFile(filePath, 'utf8');
      } catch (e) {
        if (e.code === 'ENOENT') {
          await fsp.writeFile(filePath, header);
          content = header;
        } else throw e;
      }

      if (content.toLowerCase().includes(lesson.toLowerCase().trim())) {
        return console.log('[Code-Graph] Reflection already exists.');
      }

      await fsp.appendFile(filePath, `\n${entry}`);
      console.log(`[Code-Graph] Recorded reflection: ${lesson}`);
    } catch (err) {
      console.error(`[Code-Graph] Reflection failed: ${err.message}`);
    }
  }
}

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

    const cleanCategory = String(category || 'GENERAL')
      .replace(/[^\w-]/g, '')
      .slice(0, 20)
      .toUpperCase() || 'GENERAL';
    const cleanLesson = String(lesson)
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 500);

    if (!cleanLesson) return console.error('[Code-Graph] Lesson cannot be empty after sanitization.');

    const filePath = path.join(process.cwd(), CONFIG.REFLECTIONS_FILE);
    const header = `# LLM_LEARNINGS\n> READ BEFORE TASKS. UPDATE ON FAILURES.\n`;
    const entry = `- [${cleanCategory}] ${cleanLesson}`;

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

      if (content.toLowerCase().includes(cleanLesson.toLowerCase())) {
        return console.log('[Code-Graph] Reflection already exists.');
      }

      await fsp.appendFile(filePath, `\n${entry}`);
      console.log(`[Code-Graph] Recorded reflection: ${cleanLesson}`);
    } catch (err) {
      console.error(`[Code-Graph] Reflection failed: ${err.message}`);
    }
  }
}

/**
 * @file lib/reflections.js
 * @description Manages project reflections and lessons learned.
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

export class ReflectionManager {
  /**
   * Append a lesson unless the same lesson text is already recorded.
   * @returns {Promise<{ status: 'added' | 'duplicate' | 'invalid' | 'error', entry?: string, message?: string }>}
   */
  static async add(category, lesson, cwd = process.cwd()) {
    if (!lesson) {
      console.error('[Code-Graph] Usage: reflect <cat> <lesson>');
      return { status: 'invalid', message: 'lesson is required' };
    }

    const cleanCategory = String(category || 'GENERAL')
      .replace(/[^\w-]/g, '')
      .slice(0, 20)
      .toUpperCase() || 'GENERAL';
    const cleanLesson = String(lesson)
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 500);

    if (!cleanLesson) {
      console.error('[Code-Graph] Lesson cannot be empty after sanitization.');
      return { status: 'invalid', message: 'lesson cannot be empty after sanitization' };
    }

    const filePath = path.join(cwd, CONFIG.REFLECTIONS_FILE);
    const entry = `- [${cleanCategory}] ${cleanLesson}`;

    try {
      let content;
      try {
        content = await fsp.readFile(filePath, 'utf8');
      } catch (e) {
        if (e.code === 'ENOENT') {
          await fsp.writeFile(filePath, CONFIG.REFLECTIONS_HEADER);
          content = CONFIG.REFLECTIONS_HEADER;
        } else throw e;
      }

      // Compare whole lesson texts: a substring check would reject "test" whenever any lesson mentions it.
      const wanted = cleanLesson.toLowerCase();
      const exists = content.split('\n').some(line => {
        const match = line.match(/^- \[[^\]]*\]\s+(.+)$/);
        return match && match[1].trim().toLowerCase() === wanted;
      });
      if (exists) {
        console.log('[Code-Graph] Reflection already exists.');
        return { status: 'duplicate', entry };
      }

      await fsp.appendFile(filePath, `\n${entry}`);
      console.log(`[Code-Graph] Recorded reflection: ${cleanLesson}`);
      return { status: 'added', entry };
    } catch (err) {
      console.error(`[Code-Graph] Reflection failed: ${err.message}`);
      return { status: 'error', message: err.message };
    }
  }
}

/**
 * @file lib/install-log.js
 * @description Shared install logging helpers.
 */

import { CONFIG } from './config.js';

export function logInstallTarget(fullPath) {
  console.log(`[Code-Graph v${CONFIG.VERSION}] Installed/updated: ${fullPath}`);
}

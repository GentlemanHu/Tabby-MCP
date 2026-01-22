/**
 * Plugin version - Single source of truth
 * This file is auto-generated or manually updated during release
 * 
 * Import this anywhere you need the version:
 * import { PLUGIN_VERSION } from '../version';
 */

// Read from package.json at build time (webpack bundles this)
import packageJson from '../package.json';

export const PLUGIN_VERSION = packageJson.version;
export const PLUGIN_NAME = packageJson.name;

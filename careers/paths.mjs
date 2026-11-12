import { fileURLToPath } from 'node:url';
import { join, relative, resolve, isAbsolute } from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DATA_DIR = join(ROOT, '01_行情收集', 'official-careers');
export const DB_PATH = join(DATA_DIR, 'careers.sqlite');
export const CONTROL_PATH = join(DATA_DIR, 'control.sqlite');
export const RAW_DIR = join(DATA_DIR, 'raw');
export const REPORT_DIR = join(DATA_DIR, 'reports');

export function repoRelative(path) {
  const result = relative(ROOT, path);
  if (result.startsWith('..') || isAbsolute(result)) throw new Error('Path escapes repository');
  return result.split('\\').join('/');
}

export function evidenceAbsolute(path) {
  if (isAbsolute(path)) throw new Error('Evidence paths must be repository-relative');
  const result = resolve(ROOT, path);
  if (!result.startsWith(DATA_DIR + '/')) throw new Error('Evidence path escapes official-careers namespace');
  return result;
}

export function assertId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}$/.test(value)) {
    throw new Error('Invalid identifier');
  }
  return value;
}

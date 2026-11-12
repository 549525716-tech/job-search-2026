import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function main(args) {
  const { values, positionals } = parseArgs({ args, strict: true, options: {
    batch: { type: 'string' }, output: { type: 'string' },
  } });
  if (positionals.length || !values.batch || !values.output) throw new Error('resume:build requires --batch JSON --output DIR');
  const python = process.env.CAREERS_DOCUMENT_PYTHON ?? join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
  const result = spawnSync(python, [fileURLToPath(new URL('./resume_tailor.py', import.meta.url)), '--batch', values.batch, '--output', values.output], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Resume build failed');
  return JSON.parse(result.stdout);
}

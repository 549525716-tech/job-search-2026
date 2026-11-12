import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const candidates = [
  process.env.CAREERS_NODE,
  process.execPath,
  join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'),
].filter(Boolean);

let runtime;
for (const executable of [...new Set(candidates)]) {
  if (!existsSync(executable)) continue;
  const check = spawnSync(executable, ['-e', 'process.stdout.write(process.versions.node)'], {
    encoding: 'utf8', timeout: 5000, env: { ...process.env, NODE_OPTIONS: '' },
  });
  if (check.status === 0 && Number(check.stdout.split('.')[0]) >= 24) {
    runtime = executable;
    break;
  }
}

if (!runtime) {
  console.error('Careers requires Node.js 24+. Set CAREERS_NODE to a Node 24+ executable. No global runtime was changed.');
  process.exit(1);
}

const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const tests = fileURLToPath(new URL('./tests/', import.meta.url));
const args = process.argv[2] === 'test'
  ? ['--test', ...readdirSync(tests).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => join(tests, name))]
  : process.argv[2] === 'visual' ? [join(tests, 'visual.mjs')] : [cli, ...process.argv.slice(2)];
const result = spawnSync(runtime, args, { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

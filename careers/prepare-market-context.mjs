import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, sep, join } from 'node:path';
import { DATA_DIR, ROOT, repoRelative } from './paths.mjs';
import { loadMatchContext } from './matching.mjs';

const directory = resolve(ROOT, process.argv[2] ?? '');
if (!directory.startsWith(resolve(DATA_DIR, 'research') + sep)) throw new Error('RESEARCH_CHILD_DIRECTORY_REQUIRED');
const context = await loadMatchContext();
const snapshot = { schema_version: 1, prepared_at: new Date().toISOString(),
  facts: context.facts, preferences: context.preferences, career_strategy: context.career_strategy,
  profile_hash: context.profile_hash, preferences_hash: context.preferences_hash,
  rules_hash: context.rules_hash, base_resume_hash: context.base_resume_hash,
  scope: 'User-reported personal facts and current preferences, not inferred from market JD; no applications authorized' };
await mkdir(directory, { recursive: true });
await writeFile(join(directory, 'context.json'), JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ path: repoRelative(join(directory, 'context.json')),
  facts: snapshot.facts.evidence.length, known_attributes: snapshot.facts.attributes, model_calls: 0 }) + '\n');

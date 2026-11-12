import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../cli.mjs';

test('sweep rebuild requires explicit input and cannot send its input option to collector', async () => {
  await assert.rejects(main(['sweep:report']), /requires --input/);
  await assert.rejects(main(['collect', '--input', 'anything']), /requires sweep:report/);
  await assert.rejects(main(['sweep:report', '--input', '../../outside']), /escapes/);
  const help = await main(['--help']);
  assert(help.commands.some((command) => command.startsWith('sweep:report')));
});

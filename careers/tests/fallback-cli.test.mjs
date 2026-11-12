import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../cli.mjs';

test('fallback CLI requires explicit nonempty scope and does not accept legacy flags',async()=>{
  for(const args of [['fallback'],['fallback','--companies',''],['fallback','--companies','bailian-ai,'],['fallback','--companies','bailian-ai','--all'],['fallback','--companies','bailian-ai','extra']]) {
    await assert.rejects(main(args));
  }
});

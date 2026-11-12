import test from 'node:test';
import assert from 'node:assert/strict';
import { persist, persistSync } from '../persistence.mjs';
import { EvidenceHTTP } from '../http.mjs';
import { collect } from '../collector.mjs';

test('persistence wrappers retain stage and original cause for unknown sync and async errors', async () => {
  const cause=Object.assign(new Error('test storage failure'),{code:'UNKNOWN_STORAGE_ERROR'});
  const check=error=>error.code==='COLLECTION_PERSISTENCE_FAILED' && error.cause===cause
    && error.persistence_stage==='test_write' && error.cause_code===cause.code;
  assert.throws(()=>persistSync('test_write',()=>{throw cause;}),check);
  await assert.rejects(persist('test_write',async()=>{throw cause;}),check);
});

test('actual evidence directory failure is tagged before any network request', async () => {
  let requests=0;
  const http=new EvidenceHTTP({runId:'qa-persistence',sourceId:'qa-persistence',allowedHosts:['example.com'],
    lease:{beforeRequest(){requests++;throw new Error('must not request');}}});
  http.rawDir='/dev/null';
  await assert.rejects(http.request('https://example.com/','qa'),error=>error.code==='COLLECTION_PERSISTENCE_FAILED'
    && error.persistence_stage==='raw_evidence_directory');
  assert.equal(requests,0);
});

test('actual database directory failure is tagged before collection begins', async () => {
  let openedHTTP=false;
  await assert.rejects(collect({companyId:'bailian-ai',dataDir:'/dev/null',collectionLease:{},
    dependencies:{httpFactory(){openedHTTP=true;throw new Error('must not request');}}}),
  error=>error.code==='COLLECTION_PERSISTENCE_FAILED' && error.persistence_stage==='database_open');
  assert.equal(openedHTTP,false);
});

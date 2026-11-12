import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { browserAccessGate } from '../providers/public-browser.mjs';

// Literal regression excerpt from MiniMax native job 7675996052562921778.
const jdExcerpt = '\u6700\u7ec8\u901a\u8fc7\u9884\u8bad\u7ec3\u5b9e\u9a8c\u5b8c\u6210\u6a21\u578b\u6548\u679c\u9a8c\u8bc1';
const evidence = new URL('../../01_\u884c\u60c5\u6536\u96c6/official-careers/raw/minimax-85d3f00e-3d1a-478b-94e0-6466ad029e5e/browser-public-060.body', import.meta.url);

test('real JD model-effect validation is not an access gate', () => {
  assert.equal(browserAccessGate(jdExcerpt), false);
});

test('saved real MiniMax JD remains readable without any browser or network', { skip: !existsSync(evidence) }, () => {
  const bytes = readFileSync(evidence);
  const receipt = JSON.parse(readFileSync(new URL('browser-public-060.response.json', evidence), 'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  const job = JSON.parse(bytes).data.job_post_list.find((record) => record.id === '7675996052562921778');
  assert(job.description.includes(jdExcerpt));
  assert.equal(browserAccessGate([job.title, job.description, job.requirement].filter(Boolean).join('\n')), false);
});

const gates = [
  ['security verification', '\u8bf7\u5b8c\u6210\u5b89\u5168\u9a8c\u8bc1'],
  ['login required', '\u8bf7\u5148\u767b\u5f55'],
  ['login required to view jobs', '\u767b\u5f55\u540e\u624d\u80fd\u67e5\u770b\u804c\u4f4d'],
  ['drag slider', '\u62d6\u52a8\u6ed1\u5757'],
  ['drag the right-side slider', '\u8bf7\u62d6\u52a8\u53f3\u4fa7\u6ed1\u5757'],
  ['human verification', 'verify you are human'],
  ['human verification with article', 'Verify that you are a human'],
  ['explicit CAPTCHA prompt', 'Please complete the CAPTCHA'],
  ['image verification code', '\u8bf7\u8f93\u5165\u56fe\u5f62\u9a8c\u8bc1\u7801'],
  ['sign-in required to continue', 'Sign in to continue'],
];
for (const [label, text] of gates) {
  test(`stop on ${label}`, () => assert.equal(browserAccessGate(text), true));
}

test('ordinary login and sign-in buttons are not access gates', () => {
  for (const text of ['\u767b\u5f55', 'Login', 'Sign in', '\u804c\u4f4d\nMiniMax\u6821\u62db\n\u767b\u5f55']) {
    assert.equal(browserAccessGate(text), false);
  }
});

test('a public JD does not override a simultaneous real access gate', () => {
  for (const [, gate] of gates) assert.equal(browserAccessGate(`${jdExcerpt}\n${gate}`), true);
});

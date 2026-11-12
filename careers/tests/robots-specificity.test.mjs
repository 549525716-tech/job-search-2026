import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, robotsDecision } from '../robots.mjs';

test('percent-encoded unreserved Allow cannot outrank a longer canonical Disallow', () => {
  const policy = parseRobots('User-agent: *\nDisallow: /private/reports\nAllow: /%70%72%69%76%61%74%65');
  for (const path of ['/private/reports', '/private/reports/2026', '/%70rivate/reports']) {
    const result = robotsDecision(policy, `https://example.test${path}`);
    assert.equal(result.allowed, false);
    assert.equal(result.matched_rule.path, '/private/reports');
  }
});

test('equal canonical specificity still prefers Allow regardless of percent encoding', () => {
  const encoded = '/%70%72%69%76%61%74%65';
  for (const rules of [`Disallow: ${encoded}\nAllow: /private`, `Allow: ${encoded}\nDisallow: /private`]) {
    assert.equal(robotsDecision(parseRobots(`User-agent: *\n${rules}`), 'https://example.test/private').allowed, true);
  }
});

test('percent-encoded reserved slash remains distinct from a path separator', () => {
  const policy = parseRobots('User-agent: *\nDisallow: /private%2Freports\nAllow: /private/');
  assert.equal(robotsDecision(policy, 'https://example.test/private%2freports').allowed, false);
  assert.equal(robotsDecision(policy, 'https://example.test/private/reports').allowed, true);
});

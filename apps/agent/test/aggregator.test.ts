import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Aggregator } from '../src/aggregator';

test('accumulates counts, splits active vs idle, picks the top app, records counts only', () => {
  const t0 = Date.UTC(2026, 0, 1, 9, 0, 0);
  const agg = new Aggregator({ windowSeconds: 60, idleThresholdSeconds: 60 }, t0);
  // 50 active seconds in VS Code with input, then 10 idle seconds
  for (let i = 0; i < 50; i++) agg.tick({ mouse: 2, keyboard: 1, idleSeconds: 0, app: 'Code.exe' }, 1000);
  for (let i = 0; i < 10; i++) agg.tick({ mouse: 0, keyboard: 0, idleSeconds: 120, app: 'Code.exe' }, 1000);
  assert.equal(agg.isComplete(t0 + 60000), true);
  const s = agg.flush(t0 + 60000)!;
  assert.equal(s.activeSeconds, 50);
  assert.equal(s.idleSeconds, 10);
  assert.equal(s.mouseEvents, 100);
  assert.equal(s.keyboardEvents, 50);
  assert.equal(s.foregroundApp, 'Code.exe');
  assert.equal(s.windowStart, new Date(t0).toISOString());
  // sample shape carries no content fields at all
  assert.deepEqual(Object.keys(s).sort(), ['activeSeconds','foregroundApp','foregroundDomain','idleSeconds','keyboardEvents','mouseEvents','windowEnd','windowStart'].sort());
});

test('top app is the most-focused while active; idle time is not attributed to any app', () => {
  const agg = new Aggregator({ windowSeconds: 60, idleThresholdSeconds: 60 }, 0);
  for (let i = 0; i < 10; i++) agg.tick({ mouse: 1, keyboard: 0, idleSeconds: 0, app: 'Slack' }, 1000);
  for (let i = 0; i < 30; i++) agg.tick({ mouse: 1, keyboard: 0, idleSeconds: 0, app: 'Code.exe' }, 1000);
  for (let i = 0; i < 20; i++) agg.tick({ mouse: 0, keyboard: 0, idleSeconds: 300, app: 'Code.exe' }, 1000);
  const s = agg.flush(60000)!;
  assert.equal(s.foregroundApp, 'Code.exe');
  assert.equal(s.activeSeconds, 40);
  assert.equal(s.idleSeconds, 20);
});

test('an empty window produces no sample and the aggregator resets between windows', () => {
  const agg = new Aggregator({ windowSeconds: 10, idleThresholdSeconds: 60 }, 0);
  assert.equal(agg.flush(10000), null);
  agg.tick({ mouse: 5, keyboard: 0, idleSeconds: 0, app: 'X' }, 1000);
  const s1 = agg.flush(20000)!;
  assert.equal(s1.mouseEvents, 5);
  // next window starts clean
  const s2 = agg.flush(30000);
  assert.equal(s2, null);
});

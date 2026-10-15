import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SampleQueue } from '../src/queue';

const s = (n: number) => ({ windowStart: new Date(n).toISOString(), windowEnd: new Date(n + 1000).toISOString(), activeSeconds: 1, idleSeconds: 0, mouseEvents: n, keyboardEvents: 0 });

test('enqueue/peek/ack is FIFO and survives a restart; outages keep data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'q-'));
  const path = join(dir, 'queue.json');
  const q = new SampleQueue(path);
  for (let i = 1; i <= 5; i++) q.enqueue(s(i));
  assert.equal(q.size(), 5);
  const batch = q.peek(3);
  assert.deepEqual(batch.map((x) => x.mouseEvents), [1, 2, 3]);
  // a reload (simulated restart) sees the same unsent items — nothing lost offline
  const q2 = new SampleQueue(path);
  assert.equal(q2.size(), 5);
  q2.ack(3); // server accepted the first 3
  assert.equal(q2.size(), 2);
  assert.deepEqual(q2.peek(5).map((x) => x.mouseEvents), [4, 5]);
  rmSync(dir, { recursive: true, force: true });
});

test('caps size by dropping the oldest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'q-'));
  const q = new SampleQueue(join(dir, 'q.json'), 3);
  for (let i = 1; i <= 6; i++) q.enqueue(s(i));
  assert.equal(q.size(), 3);
  assert.deepEqual(q.peek(3).map((x) => x.mouseEvents), [4, 5, 6]);
  rmSync(dir, { recursive: true, force: true });
});

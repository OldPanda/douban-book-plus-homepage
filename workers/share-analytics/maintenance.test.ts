import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { test, type TestContext } from 'node:test'
import { deleteExpiredData } from './maintenance.ts'

const setup = (t: TestContext) => {
  const db = new DatabaseSync(':memory:')
  const migrations = new URL('../../migrations/', import.meta.url)
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, migrations), 'utf8'))
  }
  t.after(() => db.close())
  const env = { DB: {
    prepare: (sql: string) => ({ bind: (timestamp: string) => ({ sql, timestamp }) }),
    batch: async (statements: Array<{ sql: string; timestamp: string }>) => {
      db.exec('BEGIN')
      try {
        const results = statements.map(({ sql, timestamp }) => db.prepare(sql).run(timestamp))
        db.exec('COMMIT')
        return results
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  } } as unknown as Parameters<typeof deleteExpiredData>[0]
  const insertResponse = (timestamp: string) => db.prepare(`INSERT INTO uninstall_responses
    (submitted_at, extension_version, reason) VALUES (?, '1.0.0', 'rarely_used')`).run(timestamp)
  return { db, env, insertResponse }
}

test('retention deletes old and next-day-expiring responses, preserving newer responses and feedback', async t => {
  const { db, env, insertResponse } = setup(t)
  const timestamps = ['2023-01-01 00:00:00', '2024-10-06 03:17:00',
    '2024-10-07 03:17:00', '2024-10-07 03:17:01', '2026-10-06 03:17:00']
  timestamps.forEach(insertResponse)
  db.exec(`INSERT INTO homepage_feedback (request_id, payload_hash, title, message, created_at)
    VALUES ('test-receipt', 'test-hash', 'Test', 'Private feedback', '2023-01-01 00:00:00')`)
  const quotaBefore = db.prepare('SELECT * FROM uninstall_ingest_quota').all()
  const now = new Date('2026-10-06T03:17:00Z')
  await deleteExpiredData(env, now)
  assert.deepEqual(db.prepare('SELECT submitted_at FROM uninstall_responses ORDER BY submitted_at').all()
    .map(row => row.submitted_at), timestamps.slice(3))
  assert.equal(db.prepare('SELECT count(*) AS n FROM homepage_feedback').get()?.n, 1)
  assert.deepEqual(db.prepare('SELECT * FROM uninstall_ingest_quota').all(), quotaBefore)
  await deleteExpiredData(env, now)
  assert.equal(db.prepare('SELECT count(*) AS n FROM uninstall_responses').get()?.n, 2)
  const plan = db.prepare('EXPLAIN QUERY PLAN DELETE FROM uninstall_responses WHERE submitted_at <= ?')
    .all('2024-10-07 03:17:00')
  assert.ok(plan.some(row => String(row.detail).includes('uninstall_responses_submitted_at_idx')))
})

test('retention works across a leap day without deleting later responses', async t => {
  const { db, env, insertResponse } = setup(t)
  insertResponse('2024-02-29 03:17:00')
  insertResponse('2024-03-01 03:17:00')
  insertResponse('2024-03-01 03:17:01')
  await deleteExpiredData(env, new Date('2026-02-28T03:17:00Z'))
  assert.deepEqual(db.prepare('SELECT submitted_at FROM uninstall_responses').all()
    .map(row => row.submitted_at), ['2024-03-01 03:17:01'])
})

test('analytics cleanup still removes eight-day-old receipts and quotas, retaining aggregate counts', async t => {
  const { db, env } = setup(t)
  for (const [index, day] of ['2026-09-27', '2026-09-28', '2026-09-29'].entries()) {
    db.prepare(`INSERT INTO share_analytics_receipts
      (receipt_hash, event_day, event_name, source, event_count, received_day)
      VALUES (?, ?, 'share_opened', 'extension', 1, ?)`).run(String(index).repeat(64), day, day)
  }
  db.exec('DELETE FROM share_analytics_ingest_quota')
  for (const day of ['2026-09-27', '2026-09-28', '2026-09-29']) {
    db.prepare("INSERT INTO share_analytics_ingest_quota VALUES (?, 'extension', 1, 1)").run(day)
  }
  await deleteExpiredData(env, new Date('2026-10-06T03:17:00Z'))
  assert.deepEqual(db.prepare('SELECT received_day FROM share_analytics_receipts').all()
    .map(row => row.received_day), ['2026-09-29'])
  assert.deepEqual(db.prepare('SELECT quota_day FROM share_analytics_ingest_quota').all()
    .map(row => row.quota_day), ['2026-09-29'])
  assert.equal(db.prepare('SELECT sum(event_count) AS n FROM share_analytics_daily').get()?.n, 3)
})

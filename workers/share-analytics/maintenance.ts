export const SHARE_ANALYTICS_CLEANUP_CRON = '17 3 * * *'

export const deleteExpiredReceipts = async (env: Pick<Env, 'DB'>): Promise<void> => {
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM share_analytics_receipts WHERE received_day <= date('now', '-8 days')",
    ),
    env.DB.prepare(
      "DELETE FROM share_analytics_ingest_quota WHERE quota_day <= date('now', '-8 days')",
    ),
  ])
}

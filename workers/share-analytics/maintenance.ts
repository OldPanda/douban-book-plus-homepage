export const SHARE_ANALYTICS_CLEANUP_CRON = '17 3 * * *'

export const deleteExpiredData = async (env: Pick<Env, 'DB'>, now = new Date()): Promise<void> => {
  const timestamp = now.toISOString()
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM share_analytics_receipts WHERE received_day <= date(?, '-8 days')",
    ).bind(timestamp),
    env.DB.prepare(
      "DELETE FROM share_analytics_ingest_quota WHERE quota_day <= date(?, '-8 days')",
    ).bind(timestamp),
    // Remove responses reaching 24 months before the next daily run as well.
    // This may delete up to one day early rather than exceed the retention cap.
    env.DB.prepare(
      "DELETE FROM uninstall_responses WHERE submitted_at <= datetime(?, '+1 day', '-24 months')",
    ).bind(timestamp),
  ])
}

type FormScope = 'homepage-feedback' | 'uninstall-survey'

/** Atomic, fixed UTC-minute limits supported by Pages' existing D1 binding. */
export const limitPublicForm = async (
  db: D1Database,
  request: Request,
  scope: FormScope,
  now = Date.now(),
): Promise<boolean> => {
  const windowStart = Math.floor(now / 60_000) * 60
  // Keep the preceding window briefly so in-flight requests crossing the minute
  // boundary cannot recreate a counter that cleanup just deleted.
  await db.prepare('DELETE FROM public_form_rate_limits WHERE window_start < ?')
    .bind(windowStart - 60).run()

  const address = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown-client'
  const digest = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(`${scope}:${windowStart}:${address}`))
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  // The sum of admitted client attempts is the shared allowance. Check both
  // limits and increment only an admitted client in ONE atomic SQL statement:
  // rejected clients cannot exhaust everyone else's allowance, and concurrent
  // requests cannot overrun the global cap or create unbounded client rows.
  // Ignore the old implementation's global row until normal expiry removes it.
  const row = await db.prepare(`INSERT INTO public_form_rate_limits
    (scope, client_key, window_start, request_count)
    SELECT ?, ?, ?, 1
    WHERE (SELECT COALESCE(SUM(request_count), 0) FROM public_form_rate_limits
      WHERE scope = ? AND window_start = ? AND client_key <> 'global') < 30
    ON CONFLICT(scope, client_key, window_start) DO UPDATE SET request_count = request_count + 1
    WHERE request_count < 3 RETURNING request_count`)
    .bind(scope, key, windowStart, scope, windowStart).first<{ request_count: number }>()
  return row !== null
}

type FormScope = 'homepage-feedback' | 'uninstall-survey'

// Secret bindings are supplied by Pages, never by public Wrangler vars.
export type PublicFormEnv = Pick<Env, 'DB'> & { PUBLIC_FORM_HMAC_SECRET?: string }

export const validPublicFormSecret = (value: unknown): value is string =>
  typeof value === 'string' && value.length === 64 && /^[0-9a-f]{64}$/i.test(value)

/** Atomic, fixed UTC-minute limits supported by Pages' existing D1 binding. */
export const limitPublicForm = async (
  db: D1Database,
  request: Request,
  scope: FormScope,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> => {
  // Fail before any database access. Never fall back to a public digest or a
  // per-isolate random key, which would leak addresses or bypass shared limits.
  if (!validPublicFormSecret(secret)) throw new Error('Public form limiter unavailable')
  const windowStart = Math.floor(now / 60_000) * 60
  const secretBytes = Uint8Array.from(secret.match(/../g)!, byte => parseInt(byte, 16))
  const signingKey = await crypto.subtle.importKey('raw', secretBytes,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const address = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown-client'
  const digest = await crypto.subtle.sign('HMAC', signingKey,
    new TextEncoder().encode(`${scope}:${windowStart}:${address}`))
  const key = 'hmac-sha256:v1:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')

  // Keep the preceding window briefly so in-flight requests crossing the minute
  // boundary cannot recreate a counter that cleanup just deleted.
  await db.prepare('DELETE FROM public_form_rate_limits WHERE window_start < ?')
    .bind(windowStart - 60).run()

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

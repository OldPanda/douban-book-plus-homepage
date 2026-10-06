export interface TurnstileEnv {
  TURNSTILE_SECRET?: string
  TURNSTILE_HOSTNAMES?: string
  FEEDBACK_ORIGIN?: string
}

type VerificationFailure = 'configuration_error' | 'invalid_token' | 'upstream_http_error'
  | 'invalid_response' | 'secret_rejected' | 'expired_or_duplicate' | 'token_rejected'
  | 'verification_rejected' | 'action_mismatch' | 'hostname_mismatch' | 'upstream_failure'

const rejectVerification = (reason: VerificationFailure): false => {
  // Only fixed categories: never include secrets, tokens, request data, or raw errors.
  console.warn(JSON.stringify({ event: 'feedback_turnstile_rejected', reason }))
  return false
}

// This same-origin form accepts exactly its deployment's hostname. Even an
// accidentally broadened production allowlist must not admit localhost tokens.
export const feedbackHostname = (env: TurnstileEnv): string | null => {
  try {
    const origin = new URL(env.FEEDBACK_ORIGIN ?? '')
    const hostnames = (env.TURNSTILE_HOSTNAMES ?? '').split(',').map(host => host.trim()).filter(Boolean)
    if (!['https:', 'http:'].includes(origin.protocol) || origin.origin !== env.FEEDBACK_ORIGIN
      || hostnames.length !== 1 || hostnames[0] !== origin.hostname) return null
    return origin.hostname
  } catch { return null }
}

export const verifyFeedbackTurnstile = async (
  token: unknown,
  env: TurnstileEnv,
  fetcher: typeof fetch = fetch,
): Promise<boolean> => {
  const hostname = feedbackHostname(env)
  if (!hostname || !env.TURNSTILE_SECRET?.trim()) return rejectVerification('configuration_error')
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) return rejectVerification('invalid_token')
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // Workers rejects redirect: 'error'. Manual + !ok still rejects redirects.
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
    })
    if (!response.ok) return rejectVerification('upstream_http_error')
    const result: unknown = await response.json()
    if (!result || typeof result !== 'object' || Array.isArray(result)) return rejectVerification('invalid_response')
    const validation = result as Record<string, unknown>
    if (validation.success !== true) {
      const codes = Array.isArray(validation['error-codes']) ? validation['error-codes'] : []
      if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) return rejectVerification('secret_rejected')
      if (codes.includes('timeout-or-duplicate')) return rejectVerification('expired_or_duplicate')
      if (codes.includes('invalid-input-response') || codes.includes('missing-input-response')) return rejectVerification('token_rejected')
      return rejectVerification('verification_rejected')
    }
    if (validation.action !== 'feedback') return rejectVerification('action_mismatch')
    if (validation.hostname !== hostname) return rejectVerification('hostname_mismatch')
    return true
  } catch {
    // Never log the token, secret, upstream response, or raw error.
    return rejectVerification('upstream_failure')
  }
}

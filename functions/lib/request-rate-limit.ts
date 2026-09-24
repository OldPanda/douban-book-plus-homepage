const utcDay = (date: Date): string => date.toISOString().slice(0, 10)

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Produces a short-lived, pseudonymous rate-limit key without logging or
 * persisting the request IP. Cloudflare sets CF-Connecting-IP in production;
 * the fallback deliberately groups non-Cloudflare/local requests together.
 */
export const dailyClientRateLimitKey = async (
  request: Request,
  scope: string,
  now = new Date(),
): Promise<string> => {
  const clientAddress = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown-client'
  return sha256(`${scope}:${utcDay(now)}:${clientAddress}`)
}

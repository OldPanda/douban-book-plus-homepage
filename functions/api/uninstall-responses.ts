import { parseUninstallSubmission } from '../lib/uninstall-survey.ts'
import { readJsonBody, RequestTooLargeError } from '../lib/json-body.ts'
import { dailyClientRateLimitKey } from '../lib/request-rate-limit.ts'

const jsonResponse = (body: object, status: number, extraHeaders: HeadersInit = {}): Response =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  })

const isSameOrigin = (request: Request): boolean => {
  const origin = request.headers.get('Origin')
  return origin !== null && origin === new URL(request.url).origin
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isSameOrigin(context.request)) {
    return jsonResponse({ message: 'Forbidden' }, 403)
  }

  try {
    const clientKey = await dailyClientRateLimitKey(context.request, 'uninstall-survey')
    const clientLimit = await context.env.SURVEY_CLIENT_RATE_LIMITER.limit({ key: clientKey })
    if (!clientLimit.success) {
      console.warn(JSON.stringify({ event: 'uninstall_survey_rate_limited', scope: 'client' }))
      return jsonResponse({ message: 'Too many requests' }, 429, { 'Retry-After': '60' })
    }

    const globalLimit = await context.env.SURVEY_GLOBAL_RATE_LIMITER.limit({
      key: 'uninstall-survey',
    })
    if (!globalLimit.success) {
      console.warn(JSON.stringify({ event: 'uninstall_survey_rate_limited', scope: 'global' }))
      return jsonResponse({ message: 'Too many requests' }, 429, { 'Retry-After': '60' })
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'uninstall_survey_rate_limit_failed',
        error: error instanceof Error ? error.message : 'unknown',
      }),
    )
    return jsonResponse({ message: 'Unable to accept response' }, 503, { 'Retry-After': '60' })
  }

  const contentType = context.request.headers.get('Content-Type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ message: 'Content-Type must be application/json' }, 415)
  }

  let rawSubmission: unknown
  try {
    rawSubmission = await readJsonBody(context.request)
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return jsonResponse({ message: 'Request is too large' }, 413)
    }
    return jsonResponse({ message: 'Invalid JSON' }, 400)
  }

  const submission = parseUninstallSubmission(rawSubmission)
  if (submission === null) {
    return jsonResponse({ message: 'Invalid survey response' }, 400)
  }

  // Silently accept bot submissions caught by the hidden field without
  // storing them or revealing the filtering rule.
  if (submission.website !== '') {
    return jsonResponse({ saved: true }, 201)
  }

  try {
    await context.env.DB.prepare(
      `INSERT INTO uninstall_responses (
        extension_version,
        reason,
        improvement,
        additional_feedback
      ) VALUES (?, ?, ?, ?)`,
    )
      .bind(
        submission.extensionVersion,
        submission.reason,
        submission.improvement,
        submission.additionalFeedback,
      )
      .run()
  } catch (error) {
    if (error instanceof Error && error.message.includes('uninstall response quota exceeded')) {
      console.warn(JSON.stringify({ event: 'uninstall_survey_daily_quota_reached' }))
      return jsonResponse({ message: 'Daily response limit reached' }, 429, {
        'Retry-After': '3600',
      })
    }
    console.error(
      JSON.stringify({
        event: 'uninstall_survey_storage_failed',
        error: error instanceof Error ? error.message : 'unknown',
      }),
    )
    return jsonResponse({ message: 'Unable to save response' }, 500)
  }

  return jsonResponse({ saved: true }, 201)
}

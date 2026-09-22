import {
  parseUninstallSubmission,
} from '../lib/uninstall-survey'
import { readJsonBody, RequestTooLargeError } from '../lib/json-body'

const jsonResponse = (body: object, status: number): Response =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
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

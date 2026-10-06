import { readJsonBody, RequestTooLargeError } from '../lib/json-body.ts'
import { limitPublicForm } from '../lib/public-form-rate-limit.ts'
import { verifyFeedbackTurnstile } from '../lib/turnstile.ts'
import { createFeedbackIssue, feedbackEnabled, feedbackHash, parseFeedback, type FeedbackEnv } from '../lib/feedback.ts'

const json = (body: object, status = 200): Response => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(status === 429 ? { 'Retry-After': '60' } : {}) },
})

export const onRequestGet: PagesFunction<FeedbackEnv> = ({ env, request }) =>
  json({ enabled: feedbackEnabled(env) && new URL(request.url).origin === env.FEEDBACK_ORIGIN })

export const onRequestPost: PagesFunction<FeedbackEnv> = async ({ request, env }) => {
  if (!feedbackEnabled(env)) return json({ code: 'unavailable' }, 503)
  if (request.headers.get('Origin') !== env.FEEDBACK_ORIGIN
    || new URL(request.url).origin !== env.FEEDBACK_ORIGIN) return json({ code: 'forbidden' }, 403)
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ code: 'invalid_content_type' }, 415)
  }
  try {
    if (!await limitPublicForm(env.DB, request, 'homepage-feedback', env.PUBLIC_FORM_HMAC_SECRET)) {
      return json({ code: 'rate_limited' }, 429)
    }
  } catch {
    return json({ code: 'unavailable' }, 503)
  }
  let value: unknown
  try { value = await readJsonBody(request, 16_384) } catch (error) {
    return json({ code: 'invalid_request' }, error instanceof RequestTooLargeError ? 413 : 400)
  }
  const submission = parseFeedback(value)
  if (!submission) return json({ code: 'invalid_submission' }, 400)
  // Verify every attempt, including retries of an existing receipt. Tokens never
  // enter persistence or issue content, and replay cannot bypass this gate.
  if (!await verifyFeedbackTurnstile((value as Record<string, unknown>)['cf-turnstile-response'], env)) {
    return json({ code: 'verification_failed' }, 403)
  }
  if (submission.website) return json({ accepted: true, reference: submission.requestId }, 202)

  const hash = await feedbackHash(submission)
  try {
    await env.DB.prepare(`INSERT INTO homepage_feedback (request_id, payload_hash, title, message)
      VALUES (?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING`)
      .bind(submission.requestId, hash, submission.title, submission.message).run()
    const row = await env.DB.prepare('SELECT payload_hash, state FROM homepage_feedback WHERE request_id = ?')
      .bind(submission.requestId).first<{ payload_hash: string; state: string }>()
    if (!row) throw new Error('missing receipt')
    if (row.payload_hash !== hash) return json({ code: 'request_conflict' }, 409)
    if (row.state === 'delivered') return json({ accepted: true, reference: submission.requestId }, 200)

    // One caller owns delivery. Retries never repeat an in-flight or ambiguous GitHub POST.
    const claim = await env.DB.prepare(`UPDATE homepage_feedback SET state = 'delivering', updated_at = datetime('now')
      WHERE request_id = ? AND state IN ('pending', 'failed') RETURNING request_id`)
      .bind(submission.requestId).first<{ request_id: string }>()
    if (!claim) return json({ accepted: true, pending: true, reference: submission.requestId }, 202)

    const delivery = await createFeedbackIssue(submission, env.FEEDBACK_GITHUB_TOKEN!, env.FEEDBACK_GITHUB_REPOSITORY!)
    try {
      await env.DB.prepare(`UPDATE homepage_feedback SET state = ?, issue_number = ?, updated_at = datetime('now')
        WHERE request_id = ?`).bind(delivery.state,
        delivery.state === 'delivered' ? delivery.issueNumber : null, submission.requestId).run()
    } catch {
      // The durable 'delivering' record remains for operator reconciliation. Do not POST again.
      console.error(JSON.stringify({ event: 'feedback_receipt_update_failed' }))
    }
    return json({ accepted: true, pending: delivery.state !== 'delivered', reference: submission.requestId },
      delivery.state === 'delivered' ? 201 : 202)
  } catch (error) {
    if (error instanceof Error && error.message.includes('homepage feedback quota exceeded')) {
      return json({ code: 'daily_limit' }, 429)
    }
    console.error(JSON.stringify({ event: 'feedback_storage_failed' }))
    return json({ code: 'unavailable' }, 503)
  }
}

export const onRequest: PagesFunction<FeedbackEnv> = () =>
  new Response(null, { status: 405, headers: { Allow: 'GET, POST', 'Cache-Control': 'no-store' } })

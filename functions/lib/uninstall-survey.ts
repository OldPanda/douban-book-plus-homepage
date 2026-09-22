export const SURVEY_REASONS = [
  'expectations',
  'hard_to_use',
  'feature_failed',
  'rarely_used',
  'privacy_concerns',
  'found_alternative',
  'other',
] as const

export type SurveyReason = (typeof SURVEY_REASONS)[number]

export interface UninstallSubmission {
  reason: SurveyReason
  improvement: string
  additionalFeedback: string
  extensionVersion: string
  website: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizedText = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() : null

const isSurveyReason = (value: string): value is SurveyReason =>
  SURVEY_REASONS.some((reason) => reason === value)

export const parseUninstallSubmission = (value: unknown): UninstallSubmission | null => {
  if (!isRecord(value)) return null

  const reason = normalizedText(value.reason)
  const improvement = normalizedText(value.improvement)
  const additionalFeedback = normalizedText(value.additionalFeedback)
  const suppliedVersion = normalizedText(value.extensionVersion)
  const website = normalizedText(value.website)

  if (
    reason === null ||
    !isSurveyReason(reason) ||
    improvement === null ||
    improvement.length > 1500 ||
    additionalFeedback === null ||
    additionalFeedback.length > 3000 ||
    website === null
  ) {
    return null
  }

  const extensionVersion =
    suppliedVersion && /^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(suppliedVersion)
      ? suppliedVersion
      : 'unknown'

  return { reason, improvement, additionalFeedback, extensionVersion, website }
}

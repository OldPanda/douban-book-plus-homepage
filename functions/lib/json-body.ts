export const DEFAULT_MAX_REQUEST_BYTES = 8192

export class RequestTooLargeError extends Error {}

export const readJsonBody = async (
  request: Request,
  maxBytes = DEFAULT_MAX_REQUEST_BYTES,
): Promise<unknown> => {
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestTooLargeError()
  }

  if (request.body === null) return null

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value === undefined) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new RequestTooLargeError()
    }
    chunks.push(value)
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return JSON.parse(new TextDecoder().decode(body)) as unknown
}

type ApiResult = {
  status?: string
  message?: string
  error?: string
  [key: string]: unknown
}

const defaultApiUrl = "https://api.nxgate.com.br"

export async function nxgatePost<T extends ApiResult>(
  path: "/v2/cobranca" | "/v2/consultar",
  payload: Record<string, unknown>,
  idempotencyKey?: string,
) {
  const apiKey = process.env.NXGATE_API_KEY
  if (!apiKey) throw new Error("NXGATE_API_KEY não está configurada.")

  const apiUrl = (process.env.NXGATE_API_URL || defaultApiUrl).replace(/\/+$/, "")
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ ...payload, api_key: apiKey }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  })

  let result: T
  try {
    result = (await response.json()) as T
  } catch {
    throw new Error(`NXGATE respondeu com HTTP ${response.status} e conteúdo inválido.`)
  }

  if (!response.ok || result.status === "error") {
    throw new Error(
      result.error || result.message || `NXGATE respondeu com HTTP ${response.status}.`,
    )
  }

  return result
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    let details: Record<string, string[]> | undefined
    try {
      const body = await response.json()
      if (body?.error) message = body.error
      if (body?.details) details = body.details
    } catch {
      // ignore non-JSON errors
    }
    throw new ApiError(message, response.status, details)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  })

  if (!response.ok) {
    let message = `Upload failed (${response.status})`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // ignore non-JSON errors
    }
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`/api${path}`, { credentials: 'include' })

  if (!response.ok) {
    let message = `Download failed (${response.status})`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

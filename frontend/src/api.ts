export type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createApiFetch(token?: string | null): ApiFetch {
  return (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

export async function readApiError(
  response: Response,
  fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.',
): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === 'string') return payload.detail;
    if (Array.isArray(payload?.detail)) {
      return payload.detail
        .map((item: { msg?: string }) => item?.msg)
        .filter(Boolean)
        .join(', ') || fallback;
    }
  } catch {
    // Non-JSON error responses use the user-friendly fallback.
  }
  return fallback;
}

export async function downloadResponse(response: Response, fallbackName: string) {
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
  const filename = filenameMatch
    ? decodeURIComponent(filenameMatch[1].replace(/\"/g, '').trim())
    : fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

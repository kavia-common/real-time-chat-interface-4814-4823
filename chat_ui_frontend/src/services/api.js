const base =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_BACKEND_URL ||
  '';

/**
 * PUBLIC_INTERFACE
 * getHistory fetches initial chat messages if an API base is configured.
 * Returns [] on failure or when no API is configured.
 */
export async function getHistory() {
  if (!base) return [];
  const url = base.replace(/\/+$/, '') + '/history';
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Expect array of {id, role, text, createdAt}
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.messages)) return data.messages;
    return [];
  } catch (_e) {
    return [];
  }
}

/**
 * PUBLIC_INTERFACE
 * healthcheck performs a basic GET to verify backend availability, if configured.
 */
export async function healthcheck() {
  if (!base) return { ok: true, skipped: true };
  const path = process.env.REACT_APP_HEALTHCHECK_PATH || '/health';
  const url = base.replace(/\/+$/, '') + path;
  try {
    const res = await fetch(url, { credentials: 'include' });
    return { ok: res.ok };
  } catch (_e) {
    return { ok: false };
  }
}

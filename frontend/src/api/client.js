const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN_KEY = 'ch_token';

export class ApiError extends Error {
  constructor({ code = 'REQUEST_FAILED', message = 'The request failed.', fields = [] }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fields = fields;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      cache: 'no-store',
      ...options,
      headers,
    });
  } catch {
    throw new ApiError({ code: 'NETWORK_ERROR', message: 'Unable to reach the server. Check your connection and retry.' });
  }

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 401) {
    setToken(null);
    localStorage.removeItem('ch_user');
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }

  if (!response.ok) {
    const error = body?.error;
    throw new ApiError({
      code: error?.code || 'REQUEST_FAILED',
      message: error?.message || `Request failed (${response.status}).`,
      fields: Array.isArray(error?.fields) ? error.fields : [],
    });
  }

  if (!body || !Object.hasOwn(body, 'data') || !Object.hasOwn(body, 'meta')) {
    throw new ApiError({ code: 'INVALID_RESPONSE', message: 'The server returned an invalid response.' });
  }
  return { data: body.data, meta: body.meta };
}

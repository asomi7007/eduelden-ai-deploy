const BASE = '/api/dashboard';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function apiClient(path, options = {}) {
  const token = sessionStorage.getItem('admin_token');
  const { method = 'GET', body, params } = options;

  let url = `${BASE}${path}`;
  if (params) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) search.set(k, v);
    });
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['X-Admin-Token'] = token;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    sessionStorage.removeItem('admin_token');
    window.location.href = '/login';
    throw new ApiError('인증이 만료되었습니다.', 401);
  }

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new ApiError(json.error || `요청 실패 (${res.status})`, res.status);
  }

  return json.data;
}

// Convenience methods
export const api = {
  get: (path, params) => apiClient(path, { method: 'GET', params }),
  post: (path, body) => apiClient(path, { method: 'POST', body }),
};

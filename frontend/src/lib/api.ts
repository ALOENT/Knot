import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
});

// ─── Request interceptor: timing ───
api.interceptors.request.use((config) => {
  (config as any)._startTime = Date.now();
  return config;
});

// ─── Response interceptor: clean 401 handling ───
api.interceptors.response.use(
  (res) => {
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - ((res.config as any)._startTime || 0);
      console.debug(`[API] ${res.config.method?.toUpperCase()} ${res.config.url} — ${duration}ms`);
    }
    return res;
  },
  (error) => {
    // On 401 — redirect to login immediately (no refresh endpoint exists)
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined'
    ) {
      const path = window.location.pathname;
      // Don't redirect if already on auth pages
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        window.location.href = '/login';
        return new Promise(() => {}); // Hang the promise to prevent further processing
      }
    }

    return Promise.reject(error);
  },
);

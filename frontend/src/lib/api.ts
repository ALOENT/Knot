import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// ─── Request interceptor: attach CSRF / timing ───
api.interceptors.request.use((config) => {
  // Tag each request with a start time for latency tracking
  (config as any)._startTime = Date.now();
  return config;
});

// ─── Response interceptor: session recovery & meaningful errors ───
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (v: any) => void;
  reject: (e: any) => void;
}> = [];

const processQueue = (error: any) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(undefined);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => {
    // Log latency in dev
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - ((res.config as any)._startTime || 0);
      console.debug(`[API] ${res.config.method?.toUpperCase()} ${res.config.url} — ${duration}ms`);
    }
    return res;
  },
  async (error) => {
    const originalRequest = error.config;

    // 401 — attempt silent session recovery once
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      typeof window !== 'undefined'
    ) {
      // If we're on auth pages, don't retry
      if (window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/register')) {
        return Promise.reject(error);
      }

      // Explicitly reject if the original request was itself a refresh call
      // to avoid deadlocking the interceptor queue.
      if (originalRequest.url === '/auth/refresh') {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        originalRequest._retry = true;
        // Queue subsequent 401s while a refresh is in flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the session
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Session truly expired — redirect
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

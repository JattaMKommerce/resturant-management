import axios from 'axios';

/**
 * Resolve KOT & Offline API base URL.
 * Automatically aligns with VITE_API_BASE_URL in production without requiring separate configuration.
 */
function resolveKotBaseUrl() {
  if (import.meta.env.VITE_KOT_API_BASE_URL) {
    return import.meta.env.VITE_KOT_API_BASE_URL.replace(/\/+$/, '');
  }
  const mainApi = import.meta.env.VITE_API_BASE_URL;
  if (mainApi) {
    const origin = mainApi.replace(/\/api\/v1\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/api\/?$/, '');
    return `${origin}/api`;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    return 'https://jattamkommerce.com/api';
  }
  return 'https://jattamkommerce.com/api';
}

const api = axios.create({
  baseURL: resolveKotBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hotel_token') || localStorage.getItem('hms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['x-authorization'] = `Bearer ${token}`;
      config.headers['x-access-token'] = token;
    }

    // Attach active restaurant slug if on an admin route
    if (typeof window !== 'undefined' && window.location) {
      const match = window.location.pathname.match(/\/admin\/([a-zA-Z0-9_-]+)/);
      const ignored = ['offline', 'history', 'wallet', 'subscription', 'accommodation', 'unclaimed', 'login'];
      if (match && match[1] && !ignored.includes(match[1])) {
        config.headers['x-restaurant-slug'] = match[1];
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;

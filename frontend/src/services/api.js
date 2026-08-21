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
    // If mainApi is 'https://backend.railway.app/api/v1', strip /v1 and append /api
    const origin = mainApi.replace(/\/api\/v1\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/api\/?$/, '');
    return `${origin}/api`;
  }
  // Development fallback
  return 'http://localhost:5000/api';
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
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('hotel_token');
      localStorage.removeItem('hms_token');
      localStorage.removeItem('hotel_user');
      localStorage.removeItem('hotel_admin_restaurant');
    }
    const message = error.response?.data?.message || error.message || 'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;

import axios from 'axios';

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5000/api/v1';
    }
    return `${window.location.origin}/api/v1`;
  }
  return 'https://jattamkommerce.com/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for HttpOnly guest identity cookies
});

// Request Interceptor: Attach JWT Bearer token if available & properly handle FormData
api.interceptors.request.use(
  (config) => {
    let token = localStorage.getItem('hotel_token');

    // Token isolation: If on customer storefront or customer API call, use customer token
    const isCustomerRoute = (typeof window !== 'undefined' && window.location && window.location.pathname.startsWith('/restaurant/')) ||
      config.url?.includes('/customer/') ||
      config.url?.includes('/auth/customer/') ||
      config.url?.includes('/wallet/customer/') ||
      config.url?.includes('/guest/');
    const isExplicitAdminCall = config.url?.includes('/admin/') || config.url?.includes('/superadmin/') || config.url?.includes('/driver/') || config.url?.includes('/waiter/') || config.url?.includes('/kitchen/');

    if (isCustomerRoute && !isExplicitAdminCall) {
      const custToken = localStorage.getItem('hotel_customer_token');
      if (custToken) token = custToken;
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['x-authorization'] = `Bearer ${token}`;
      config.headers['x-access-token'] = token;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
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

// Response Interceptor: Handle auth & subscription expired errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem('hotel_token');
        localStorage.removeItem('hotel_user');
      } else if (
        error.response.status === 403 &&
        (error.response.data?.code === 'SUBSCRIPTION_EXPIRED' || error.response.data?.code === 'SUBSCRIPTION_REQUIRED')
      ) {
        // Broadcast subscription expiration to UI
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hms_subscription_blocked', { detail: error.response.data }));
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

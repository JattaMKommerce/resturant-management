// Backend origin for files served from /uploads (same rule the storefront and wizard use).
export const API_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '') ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? ''
    : 'http://localhost:5000');

export function getMediaUrl(url, fallback = null) {
  if (!url) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** Returns an error message, or null when the file is fine to upload. */
export function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Please upload a JPG, PNG, or WebP image.';
  if (file.size > 5 * 1024 * 1024) return 'Image is too large (max 5MB). Please choose a smaller image.';
  return null;
}

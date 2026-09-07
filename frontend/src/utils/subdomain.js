/**
 * Utility helper for dynamic subdomain resolution & URL formatting
 * Supports ₹99/mo Custom Subdomain Add-on & 5-8 char Random Alphanumeric Slugs
 */

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'admin', 'api', 'localhost', 'mail', 'cpanel', 'webmail',
  'staging', 'dev', 'test', 'demo', 'shop', 'store'
]);

/**
 * Generate random mixed-case alphanumeric string (caps + small letters + digits)
 */
export function generateRandomSlug(length = 7) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Extract active subdomain slug from browser hostname
 * Works for both localhost (e.g. aK8xP2qZ.localhost:5173) and production (aK8xP2qZ.jattamkommerce.com)
 */
export function getSubdomainSlug(hostname = (typeof window !== 'undefined' ? window.location.hostname : '')) {
  if (!hostname) return null;

  const parts = hostname.toLowerCase().split('.');

  // Handle localhost (e.g. grandpalace.localhost)
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    const sub = parts[0];
    if (!RESERVED_SUBDOMAINS.has(sub)) return sub;
    return null;
  }

  // Handle standard domain (e.g. grandpalace.jattamkommerce.com -> parts = ['grandpalace', 'jattamkommerce', 'com'])
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!RESERVED_SUBDOMAINS.has(sub)) return sub;
  }

  return null;
}

/**
 * Build primary public storefront URL for a restaurant based on custom subdomain subscription status
 */
export function getRestaurantPublicUrl(restaurant, path = '') {
  if (!restaurant) return '/';

  const activeSlug = restaurant.slug || restaurant.custom_subdomain_slug || restaurant.random_slug || 'restaurant';

  if (typeof window === 'undefined') {
    return `https://jattamkommerce.com/restaurant/${activeSlug}${path}`;
  }

  const host = window.location.host; // e.g. jattamkommerce.com or localhost:5173
  const protocol = window.location.protocol; // e.g. https:

  // Standard fallback path URL
  return `${protocol}//${host}/restaurant/${activeSlug}${path}`;
}

/**
 * Format displayed slug label
 */
export function getDisplayedSlugDetails(restaurant) {
  if (!restaurant) return { activeSlug: '', isCustom: false, label: '' };

  const activeSlug = restaurant.slug || restaurant.custom_subdomain_slug || restaurant.random_slug || 'restaurant';

  return {
    activeSlug,
    isCustom: true,
    randomSlug: restaurant.random_slug || activeSlug,
    customSlug: restaurant.custom_subdomain_slug || restaurant.slug,
    label: '⭐ Active Storefront Website'
  };
}

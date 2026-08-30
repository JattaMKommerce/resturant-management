const { query } = require('../config/db');

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'admin', 'api', 'localhost', 'mail', 'cpanel', 'webmail',
  'staging', 'dev', 'test', 'demo', 'shop', 'store'
]);

/**
 * Tenant Subdomain Resolver Middleware
 * Automatically attaches resolved restaurant to req.tenantRestaurant when accessed via subdomain
 */
async function tenantResolver(req, res, next) {
  try {
    const rawHost = req.headers['x-forwarded-host'] || req.headers.host || '';
    const host = rawHost.split(':')[0].toLowerCase();
    const parts = host.split('.');

    let subdomain = null;
    if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
      subdomain = parts[0];
    } else if (parts.length >= 3) {
      subdomain = parts[0];
    }

    if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
      // Find restaurant matching custom_subdomain_slug (if custom_subdomain_enabled=1), random_slug, or fallback slug
      const restaurants = await query(
        `SELECT id, name, slug, random_slug, custom_subdomain_enabled, custom_subdomain_slug, status
         FROM restaurants
         WHERE (custom_subdomain_enabled = 1 AND LOWER(custom_subdomain_slug) = ?)
            OR LOWER(random_slug) = ?
            OR LOWER(slug) = ?
         LIMIT 1`,
        [subdomain, subdomain, subdomain]
      );

      if (restaurants.length > 0) {
        req.tenantRestaurant = restaurants[0];
        req.subdomainSlug = subdomain;
      }
    }
  } catch (err) {
    console.warn('[TENANT RESOLVER] Notice:', err.message);
  } finally {
    next();
  }
}

module.exports = {
  tenantResolver
};

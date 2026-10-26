/*
 * CORS helpers. Allowed origins come from the ALLOWED_ORIGINS input:
 * a comma-separated list where "*" matches within one host label,
 * e.g. https://*--midwives--bhasakatech.aem.page
 */

function toRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/.]*');
  return new RegExp(`^${escaped}$`);
}

/**
 * @returns {string|null} the origin when it is allowed, otherwise null
 */
function getAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return null;
  const patterns = String(allowedOrigins || '').split(',').map((p) => p.trim()).filter(Boolean);
  return patterns.some((p) => toRegExp(p).test(origin)) ? origin : null;
}

/**
 * I/O Runtime already adds "Access-Control-Allow-Origin: *" to every web action
 * response and merges it with any value the action sets ("*,https://..."), which
 * browsers reject. So the action does not set it: origins are enforced server-side
 * by getAllowedOrigin (403 for other sites) and only the expose list is added here.
 * "Vary: Origin" keeps the Runtime gateway cache from serving a response cached
 * for an allowed site to a site that should get 403.
 * @returns {Object} CORS response headers
 */
function corsHeaders(allowedOrigin, exposeHeaders = []) {
  const headers = { Vary: 'Origin' };
  if (allowedOrigin && exposeHeaders.length) {
    headers['Access-Control-Expose-Headers'] = exposeHeaders.join(', ');
  }
  return headers;
}

module.exports = { getAllowedOrigin, corsHeaders };

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
 * @returns {Object} CORS response headers, empty when no origin is allowed
 */
function corsHeaders(allowedOrigin, exposeHeaders = []) {
  if (!allowedOrigin) return {};
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    Vary: 'Origin',
  };
  if (exposeHeaders.length) headers['Access-Control-Expose-Headers'] = exposeHeaders.join(', ');
  return headers;
}

module.exports = { getAllowedOrigin, corsHeaders };

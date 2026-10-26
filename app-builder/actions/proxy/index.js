/*
 * Generic API proxy (Adobe App Builder web action).
 *
 *   GET {action-url}/{api}?{params}     e.g. .../web/midwives/proxy/users?page=2
 *
 * Looks up {api} in apis.js, reads its upstream URL and credentials from the
 * action inputs (App Builder environment variables), forwards only the allowed
 * query parameters, authenticates upstream (static token or basic, see
 * lib/auth.js) and returns the upstream JSON unchanged, plus the headers the
 * API is allowed to expose. Secrets never reach the browser.
 *
 * Shared inputs:
 *   ALLOWED_ORIGINS  sites allowed to call the proxy (see lib/cors.js)
 */

const apis = require('./apis.js');
const { getAllowedOrigin, corsHeaders } = require('../lib/cors.js');
const { readParams } = require('../lib/params.js');
const { respond, errorResponse } = require('../lib/response.js');
const { getAuthHeaders, requiredInputs } = require('../lib/auth.js');

const TIMEOUT_MS = 10000;

/**
 * API name from the path (/proxy/users) or, as a fallback, the "api" query parameter.
 */
function getApiName(params) {
  const fromPath = String(params.__ow_path || '').replace(/^\/+|\/+$/g, '');
  return fromPath || String(params.api || '');
}

function getApi(name) {
  return Object.hasOwn(apis, name) ? apis[name] : null;
}

function buildUpstreamRequest(api, params) {
  const url = new URL(params[api.urlEnv]);
  if (url.protocol !== 'https:') throw new Error(`${api.urlEnv} must be an https URL`);
  Object.entries(readParams(params, api.params))
    .forEach(([key, value]) => url.searchParams.set(key, value));
  return { url, headers: { Accept: 'application/json', ...getAuthHeaders(api, params) } };
}

function pickHeaders(upstreamHeaders, names = []) {
  return Object.fromEntries(names
    .filter((name) => upstreamHeaders.has(name))
    .map((name) => [name, upstreamHeaders.get(name)]));
}

async function main(params) {
  const origin = params.__ow_headers?.origin;
  const allowedOrigin = getAllowedOrigin(origin, params.ALLOWED_ORIGINS);
  // browsers always send Origin on cross-site requests; reject other sites
  if (origin && !allowedOrigin) return errorResponse(403, 'origin_not_allowed', 'Origin not allowed');

  const name = getApiName(params);
  const api = getApi(name);
  const cors = corsHeaders(allowedOrigin, api?.exposeHeaders);
  if (!api) return errorResponse(404, 'unknown_api', `Unknown API "${name}"`, cors);

  const method = String(params.__ow_method || 'get').toUpperCase();
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' },
    };
  }
  if (method !== 'GET') return errorResponse(405, 'method_not_allowed', 'Only GET is supported', cors);

  const missing = [api.urlEnv, ...requiredInputs(api)].filter((input) => !params[input]);
  if (missing.length) {
    console.error(`[${name}] not configured: ${missing.join(', ')}`);
    return errorResponse(500, 'not_configured', 'Service not configured', cors);
  }

  let request;
  try {
    request = buildUpstreamRequest(api, params);
  } catch (e) {
    console.error(`[${name}] invalid configuration: ${e.message}`);
    return errorResponse(500, 'not_configured', 'Service not configured', cors);
  }

  try {
    const resp = await fetch(request.url, {
      headers: request.headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.error(`[${name}] upstream responded ${resp.status}`);
      return errorResponse(502, 'upstream_error', 'Upstream service error', cors);
    }
    const data = await resp.json();
    return respond(200, data, {
      ...cors,
      ...pickHeaders(resp.headers, api.exposeHeaders),
      // "private": only the visitor's browser caches it; the shared Runtime gateway cache
      // would otherwise serve this response to other origins without the origin check
      'Cache-Control': api.cacheSeconds ? `private, max-age=${api.cacheSeconds}` : 'no-store',
    });
  } catch (e) {
    console.error(`[${name}] upstream request failed: ${e.message}`);
    return e.name === 'TimeoutError'
      ? errorResponse(504, 'upstream_timeout', 'Upstream service timed out', cors)
      : errorResponse(502, 'upstream_error', 'Upstream service error', cors);
  }
}

exports.main = main;

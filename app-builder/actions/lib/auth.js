/*
 * Upstream authentication for the proxy. Two modes, chosen per API in proxy/apis.js:
 *
 *   static token   tokenEnv (+ optional authHeader / authScheme)
 *                  the token input is sent as-is on every request
 *
 *   basic          auth: { type: 'basic', usernameEnv, passwordEnv }
 *                  username/password inputs sent on every request (HTTP Basic auth)
 *
 * Usernames, passwords and tokens are never logged or returned to the browser.
 */

/**
 * @returns {string[]} names of the auth inputs an API needs
 */
function requiredInputs(api) {
  if (api.auth?.type === 'basic') return [api.auth.usernameEnv, api.auth.passwordEnv];
  return [];
}

/**
 * Headers that authenticate one upstream request.
 * @param {Object} api registry entry
 * @param {Object} params action params (inputs included)
 * @returns {Object} headers to add, empty when the API needs no auth
 */
function getAuthHeaders(api, params) {
  if (api.auth?.type === 'basic') {
    const credentials = `${params[api.auth.usernameEnv]}:${params[api.auth.passwordEnv]}`;
    return { Authorization: `Basic ${Buffer.from(credentials).toString('base64')}` };
  }
  const token = api.tokenEnv ? params[api.tokenEnv] : undefined;
  if (!token) return {};
  const scheme = api.authScheme === undefined ? 'Bearer' : api.authScheme;
  return { [api.authHeader || 'Authorization']: scheme ? `${scheme} ${token}` : token };
}

module.exports = { getAuthHeaders, requiredInputs };

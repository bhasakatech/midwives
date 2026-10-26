/*
 * API registry for the proxy action. One entry per API, called as
 *   GET {action-url}/{name}?{params}
 *
 * Entry fields:
 *   urlEnv         (required) action input holding the upstream URL
 *   tokenEnv       (optional) action input holding a secret token, sent upstream only
 *   authHeader     (optional) header for the token, default "Authorization"
 *   authScheme     (optional) token prefix, default "Bearer"; null sends the bare token
 *   params         (optional) query parameters forwarded upstream; anything else is dropped
 *                    { type: 'int', default, min, max }
 *                    { type: 'enum', values: [...], default }
 *                    { type: 'string', maxLength, pattern, default }
 *                  invalid values fall back to the default, or are dropped when there is none
 *   exposeHeaders  (optional) upstream response headers passed back to the browser
 *   cacheSeconds   (optional) browser/CDN cache time for successful responses, default 0
 *
 * Every urlEnv/tokenEnv must also be declared under the action's inputs in app.config.yaml.
 */
module.exports = {
  users: {
    urlEnv: 'USERS_API_URL',
    tokenEnv: 'USERS_API_TOKEN',
    params: {
      page: { type: 'int', default: 1, min: 1 },
      per_page: {
        type: 'int', default: 20, min: 1, max: 100,
      },
    },
    exposeHeaders: ['x-pagination-total', 'x-pagination-pages', 'x-pagination-page', 'x-pagination-limit'],
    cacheSeconds: 60,
  },
};

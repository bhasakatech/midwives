# Midwives App Builder actions

Server-side actions for the Edge Delivery site. Not served by EDS (`app-builder/*` is in `.hlxignore`).

## `proxy` action

One generic, read-only proxy for every external API the site uses, public or private. Upstream URLs, tokens,
usernames and passwords are App Builder environment variables, so they never reach the browser. The upstream
JSON is returned unchanged.

```
GET https://<namespace>.adobeioruntime.net/api/v1/web/midwives/proxy/<api>?<params>
```

| Part | Where |
|---|---|
| Registered APIs, allowed params, auth type, cache time | `actions/proxy/apis.js` |
| Upstream URLs, tokens, usernames, passwords | `.env` → `app.config.yaml` inputs |
| Upstream authentication headers | `actions/lib/auth.js` |
| Allowed websites (CORS) | `ALLOWED_ORIGINS` in `.env` |

### Response format

Success: the upstream JSON body, plus the headers listed in the API's `exposeHeaders`.

Errors always look like this:

```json
{ "error": { "status": 404, "code": "unknown_api", "message": "Unknown API \"foo\"" } }
```

| Status | Code | When |
|---|---|---|
| 403 | `origin_not_allowed` | Called from a site not in `ALLOWED_ORIGINS` |
| 404 | `unknown_api` | API name not in `apis.js` |
| 405 | `method_not_allowed` | Anything other than GET |
| 500 | `not_configured` | A required input is missing, or a URL is invalid or not https |
| 502 | `upstream_error` | Upstream failed or returned an error (including 401 for wrong credentials) |
| 504 | `upstream_timeout` | Upstream took longer than 10 s |

### Registered APIs

| API | Path | Auth | Inputs | Params |
|---|---|---|---|---|
| basic-auth-test | `/proxy/basic-auth-test` | basic (Postman Echo) | `BASIC_TEST_API_URL`, `BASIC_TEST_USERNAME`, `BASIC_TEST_PASSWORD` | none |
| users | `/proxy/users` | none, or static token | `USERS_API_URL`, `USERS_API_TOKEN` (optional) | `page`, `per_page` (max 100) |

`basic-auth-test` is used by the `api-status` block (site config key `basicAuthTestUrl`), `users` by the `users`
block (site config key `usersApiUrl`).

### Private APIs

Two ways to authenticate upstream, set per API in `apis.js`:

- **Static token / API key**: `tokenEnv: 'X_API_TOKEN'`, sent as `Authorization: Bearer <token>`.
  Use `authHeader: 'x-api-key', authScheme: null` for APIs that want a bare key in another header.
- **Basic (username + password)**: `auth: { type: 'basic', usernameEnv, passwordEnv }`, sent as
  `Authorization: Basic ...` on every request.

## Adding a new API

Example: a `products` API.

1. **Register it** in `actions/proxy/apis.js`:
   ```js
   products: {
     urlEnv: 'PRODUCTS_API_URL',
     tokenEnv: 'PRODUCTS_API_TOKEN',
     params: {
       category: { type: 'enum', values: ['shoes', 'bags'] },
       limit: { type: 'int', default: 10, min: 1, max: 50 },
     },
     cacheSeconds: 300,
   },
   ```
   For a private API, use `tokenEnv` or `auth` (see Private APIs).
2. **Declare its inputs** in `app.config.yaml` under `proxy.inputs`:
   ```yaml
   PRODUCTS_API_URL: $PRODUCTS_API_URL
   PRODUCTS_API_TOKEN: $PRODUCTS_API_TOKEN
   ```
   Required: only declared inputs are protected by `final`, so an undeclared one could be sent by a caller.
3. **Set the values** in `.env` (and `.env.example` without secrets):
   ```
   PRODUCTS_API_URL=https://api.example.com/v1/products
   PRODUCTS_API_TOKEN=...
   ```
4. **Deploy**: `aio app deploy`
5. **Use it on the site**: add a variable to the site's public configuration, e.g.
   `public.custom.productsApiUrl = https://<namespace>.adobeioruntime.net/api/v1/web/midwives/proxy/products`,
   and read it in the block with `getSiteConfigValue('productsApiUrl')` from `scripts/scripts.js`.

## Setup and deploy

```sh
npm install -g @adobe/aio-cli
aio login
cd app-builder
aio app use            # pick org > project > workspace (Stage / Production); writes .env and .aio
                       # then add the lines from .env.example to .env
aio app deploy         # prints the action URL
```

Use one App Builder workspace per environment (Stage, Production), each with its own `.env`.

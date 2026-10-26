/*
 * Response helpers. Every response is JSON; errors share one shape:
 *   { "error": { "status": 404, "code": "unknown_api", "message": "..." } }
 */

function respond(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, code, message, headers = {}) {
  return respond(statusCode, { error: { status: statusCode, code, message } }, {
    'Cache-Control': 'no-store',
    ...headers,
  });
}

module.exports = { respond, errorResponse };

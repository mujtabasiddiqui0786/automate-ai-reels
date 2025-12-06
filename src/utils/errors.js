/**
 * Structured error helpers for consistent API responses.
 */

/**
 * Create a structured error object.
 * @param {string} code - Short error code (e.g., 'YOUTUBE_UPLOAD_FAILED')
 * @param {string} message - Human-friendly message
 * @param {object} [details] - Additional details (statusCode, reason, etc.)
 * @returns {{code:string, message:string, details?:object}}
 */
function createError(code, message, details) {
  const err = { code, message };
  if (details) err.details = details;
  return err;
}

/**
 * Send an HTTP error response with structured payload.
 * @param {http.ServerResponse} res
 * @param {object|string} error - structured error or message
 * @param {number} [statusCode=500]
 */
function sendErrorResponse(res, error, statusCode = 500) {
  const payload = typeof error === 'string'
    ? { error: { code: 'GENERIC_ERROR', message: error } }
    : { error };

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload, null, 2));
}

module.exports = {
  createError,
  sendErrorResponse
};


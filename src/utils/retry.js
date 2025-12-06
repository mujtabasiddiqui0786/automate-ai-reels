/**
 * Generic retry helper with exponential backoff.
 * Usage:
 *   await withRetry(async (attempt) => { ... }, { retries: 3, baseDelayMs: 1000 });
 */

/**
 * Sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 * @param {Function} fn - async function receiving attempt number (0-based)
 * @param {Object} options
 * @param {number} [options.retries=3] - total attempts (including first)
 * @param {number} [options.baseDelayMs=1000] - initial delay in ms
 * @returns {Promise<*>} result of fn
 * @throws last error after exhausting retries
 */
async function withRetry(fn, options = {}) {
  const retries = options.retries != null ? options.retries : 3;
  const baseDelayMs = options.baseDelayMs != null ? options.baseDelayMs : 1000;

  let attempt = 0;
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      attempt += 1;
      if (attempt > retries) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

module.exports = {
  withRetry,
  sleep
};


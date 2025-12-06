/**
 * Simple structured logging utilities.
 * Logs are written as JSON lines to logs/app.log and, if jobId is provided,
 * also to logs/job-{jobId}.log.
 */
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.cwd(), 'logs');
const APP_LOG = path.join(LOGS_DIR, 'app.log');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function writeLog(filePath, entry) {
  ensureLogsDir();
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(filePath, line, 'utf8');
}

function buildEntry(level, context, message, extra) {
  const base = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message
  };
  if (extra && typeof extra === 'object') {
    return { ...base, ...extra };
  }
  return base;
}

/**
 * Log an informational message.
 * @param {string} context - Logical context (e.g., 'server', 'upload:youtube')
 * @param {string} message - Message to log
 * @param {object} [extra] - Additional fields; include jobId to log per job
 */
function logInfo(context, message, extra) {
  const entry = buildEntry('info', context, message, extra);
  writeLog(APP_LOG, entry);
  if (extra && extra.jobId) {
    const jobLog = path.join(LOGS_DIR, `job-${extra.jobId}.log`);
    writeLog(jobLog, entry);
  }
}

/**
 * Log an error message.
 * @param {string} context - Logical context (e.g., 'server', 'upload:youtube')
 * @param {string} message - Error description
 * @param {object} [extra] - Additional fields; include jobId to log per job
 */
function logError(context, message, extra) {
  const entry = buildEntry('error', context, message, extra);
  writeLog(APP_LOG, entry);
  if (extra && extra.jobId) {
    const jobLog = path.join(LOGS_DIR, `job-${extra.jobId}.log`);
    writeLog(jobLog, entry);
  }
}

module.exports = {
  logInfo,
  logError,
  LOGS_DIR
};


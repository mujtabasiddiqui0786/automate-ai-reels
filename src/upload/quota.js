/**
 * Simple JSON-based quota tracking for daily upload limits.
 * Stores counts in quotas.json at project root.
 */
const fs = require('fs');
const path = require('path');

const QUOTAS_FILE = path.join(process.cwd(), 'quotas.json');

function todayDateString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDefaultQuota() {
  return {
    lastReset: todayDateString(),
    uploadsToday: 0
  };
}

function readQuotas() {
  if (!fs.existsSync(QUOTAS_FILE)) {
    return {
      youtube: getDefaultQuota(),
      instagram: getDefaultQuota(),
      tiktok: getDefaultQuota()
    };
  }
  try {
    const raw = fs.readFileSync(QUOTAS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data;
  } catch {
    return {
      youtube: getDefaultQuota(),
      instagram: getDefaultQuota(),
      tiktok: getDefaultQuota()
    };
  }
}

function writeQuotas(quotas) {
  fs.writeFileSync(QUOTAS_FILE, JSON.stringify(quotas, null, 2), 'utf8');
}

function resetIfNewDay(quota) {
  const today = todayDateString();
  if (quota.lastReset !== today) {
    quota.lastReset = today;
    quota.uploadsToday = 0;
  }
}

function getMaxPerDay(platform) {
  const envMap = {
    youtube: process.env.YOUTUBE_MAX_UPLOADS_PER_DAY,
    instagram: process.env.IG_MAX_UPLOADS_PER_DAY,
    tiktok: process.env.TIKTOK_MAX_UPLOADS_PER_DAY
  };
  const value = envMap[platform];
  if (!value) return Infinity;
  const num = parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : Infinity;
}

/**
 * Check quota for a platform and increment if allowed.
 * Throws an error if quota exceeded.
 * @param {'youtube'|'instagram'|'tiktok'} platform
 */
function checkQuotaAndIncrement(platform) {
  const quotas = readQuotas();
  if (!quotas[platform]) {
    quotas[platform] = getDefaultQuota();
  }
  const quota = quotas[platform];
  resetIfNewDay(quota);

  const maxPerDay = getMaxPerDay(platform);
  if (quota.uploadsToday >= maxPerDay) {
    const err = new Error('Daily upload quota exceeded');
    err.code = 'QUOTA_EXCEEDED';
    err.details = {
      platform,
      maxPerDay,
      uploadsToday: quota.uploadsToday
    };
    throw err;
  }

  quota.uploadsToday += 1;
  quotas[platform] = quota;
  writeQuotas(quotas);
  return quota;
}

module.exports = {
  checkQuotaAndIncrement,
  QUOTAS_FILE
};


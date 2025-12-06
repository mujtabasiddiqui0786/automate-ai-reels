/**
 * Configuration module for reading and validating environment variables
 * @module config
 */

const fs = require('fs');
const path = require('path');

/**
 * Loads and validates configuration from environment variables
 * @returns {Object} Configuration object with all required settings
 */
function loadConfig() {
  const config = {
    // YouTube API credentials
    youtube: {
      clientId: process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
      refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
      enabled: !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN)
    },

    // Instagram Graph API credentials
    instagram: {
      appId: process.env.IG_APP_ID || '',
      appSecret: process.env.IG_APP_SECRET || '',
      accessToken: process.env.IG_ACCESS_TOKEN || '',
      userId: process.env.IG_USER_ID || '',
      enabled: !!(process.env.IG_APP_ID && process.env.IG_APP_SECRET && process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID)
    },

    // TikTok API credentials
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY || '',
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      accessToken: process.env.TIKTOK_ACCESS_TOKEN || '',
      enabled: !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_ACCESS_TOKEN)
    },

    // File paths
    paths: {
      baseVideoDir: process.env.BASE_VIDEO_DIR || path.join(process.cwd(), 'assets', 'base_loops'),
      outputVideoDir: process.env.OUTPUT_VIDEO_DIR || path.join(process.cwd(), 'videos', 'output'),
      tiktokExportDir: path.join(process.cwd(), 'exports', 'tiktok'),
      staticBaseUrl: process.env.STATIC_BASE_URL || 'http://localhost:3000'
    },

    // AI / Gemini
    ai: {
      enabled: process.env.USE_AI_GENERATION === 'true',
      provider: process.env.AI_PROVIDER || 'gemini',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      promptCacheSize: parseInt(process.env.AI_PROMPT_CACHE_SIZE || '20', 10)
    },

    // Server configuration
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.HOST || '0.0.0.0'
    }
  };

  // Ensure directories exist
  ensureDirectoryExists(config.paths.baseVideoDir);
  ensureDirectoryExists(config.paths.outputVideoDir);
  ensureDirectoryExists(config.paths.tiktokExportDir);

  return config;
}

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (error) {
    console.error(`Failed to create directory ${dirPath}:`, error.message);
    throw error;
  }
}

/**
 * Validates that required configuration is present
 * @param {Object} config - Configuration object to validate
 * @throws {Error} If critical configuration is missing
 */
function validateConfig(config) {
  const errors = [];

  // Check if at least one platform is configured
  if (!config.youtube.enabled && !config.instagram.enabled && !config.tiktok.enabled) {
    console.warn('Warning: No platform credentials configured. Uploads will be limited.');
  }

  // Validate paths
  if (!fs.existsSync(config.paths.baseVideoDir)) {
    errors.push(`Base video directory does not exist: ${config.paths.baseVideoDir}`);
  }

  return errors;
}

const config = loadConfig();
const validationErrors = validateConfig(config);

if (validationErrors.length > 0) {
  console.warn('Configuration validation warnings:');
  validationErrors.forEach(error => console.warn(`  - ${error}`));
}

module.exports = config;


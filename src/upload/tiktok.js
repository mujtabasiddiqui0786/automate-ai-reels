/**
 * TikTok API integration for uploading videos
 * Falls back to local export if API credentials are not configured
 * @module upload/tiktok
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { checkQuotaAndIncrement } = require('./quota');

/**
 * Uploads video to TikTok using the TikTok Posting API
 * TODO: Implement full TikTok Posting API flow when API documentation is available
 * The TikTok Posting API typically requires:
 * 1. Initialize upload (get upload URL)
 * 2. Upload video file
 * 3. Publish video with metadata
 * 
 * @param {string} filePath - Path to video file
 * @param {Object} options - Upload options
 * @param {string} options.caption - Caption for the video
 * @returns {Promise<Object>} Object containing success, videoId, and shareUrl
 * @throws {Error} If upload fails
 */
async function uploadVideoToTikTok(filePath, options = {}) {
  const { caption } = options;

  if (!config.tiktok.enabled) {
    throw new Error('TikTok API credentials not configured. Use exportToTikTok instead.');
  }

  // TODO: Implement TikTok Posting API upload flow
  // This is a placeholder implementation
  // Refer to TikTok Developer Documentation for the actual API endpoints:
  // https://developers.tiktok.com/doc/tiktok-api-v2-post-video/
  
  // Example flow (needs to be implemented based on actual API):
  // 1. Get access token (if using OAuth)
  // 2. Initialize upload session
  // 3. Upload video file in chunks
  // 4. Publish video with metadata (caption, privacy settings, etc.)

  throw new Error('TikTok API upload not yet implemented. Please use exportToTikTok for now, or implement the TikTok Posting API based on official documentation.');
}

/**
 * Exports video file to local TikTok export directory
 * Used when TikTok API is not configured
 * @param {string} filePath - Path to video file
 * @param {Object} options - Export options
 * @param {string} [options.caption] - Caption (saved as .txt file alongside video)
 * @returns {Promise<Object>} Object containing success and localPath
 * @throws {Error} If export fails
 */
async function exportToTikTok(filePath, options = {}) {
  const { caption } = options;

  if (!fs.existsSync(filePath)) {
    throw new Error(`Video file not found: ${filePath}`);
  }

  // Ensure export directory exists
  if (!fs.existsSync(config.paths.tiktokExportDir)) {
    fs.mkdirSync(config.paths.tiktokExportDir, { recursive: true });
  }

  // Generate export filename
  const filename = path.basename(filePath);
  const exportPath = path.join(config.paths.tiktokExportDir, filename);

  // Copy file to export directory
  try {
    fs.copyFileSync(filePath, exportPath);
  } catch (error) {
    throw new Error(`Failed to copy file to TikTok export directory: ${error.message}`);
  }

  // Save caption as .txt file if provided
  if (caption) {
    const captionPath = exportPath.replace(/\.[^/.]+$/, '.txt');
    try {
      fs.writeFileSync(captionPath, caption, 'utf8');
    } catch (error) {
      console.warn(`Failed to save caption file: ${error.message}`);
    }
  }

  return {
    success: true,
    localPath: exportPath,
    message: 'Video exported to TikTok directory. Upload manually or configure TikTok API credentials.'
  };
}

/**
 * Main function to upload or export video to TikTok
 * Automatically falls back to local export if API is not configured
 * @param {string} filePath - Path to video file
 * @param {Object} options - Upload/export options
 * @param {string} options.caption - Caption for the video
 * @returns {Promise<Object>} Object containing success and result details
 * @throws {Error} If upload/export fails
 */
async function uploadTikTok(filePath, options = {}) {
  const { caption } = options;

  if (!caption) {
    throw new Error('Caption is required for TikTok video');
  }

  // Quota guard
  checkQuotaAndIncrement('tiktok');

  if (config.tiktok.enabled) {
    try {
      // Try to upload via API
      return await uploadVideoToTikTok(filePath, options);
    } catch (error) {
      // If API upload fails and it's a "not implemented" error, fall back to export
      if (error.message.includes('not yet implemented')) {
        console.warn('TikTok API upload not implemented, falling back to local export');
        return await exportToTikTok(filePath, options);
      }
      // Otherwise, re-throw the error
      throw error;
    }
  } else {
    // API not configured, use local export
    return await exportToTikTok(filePath, options);
  }
}

module.exports = {
  uploadTikTok,
  uploadVideoToTikTok,
  exportToTikTok
};


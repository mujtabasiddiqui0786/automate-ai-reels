/**
 * Instagram Graph API integration for uploading Reels
 * @module upload/instagram
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Uploads video file to Instagram and returns the video URL
 * For Instagram Reels, we need to upload the video first, then create a container
 * @param {string} filePath - Path to video file
 * @param {string} staticBaseUrl - Base URL for serving the video file
 * @returns {Promise<string>} Public URL of the uploaded video
 * @throws {Error} If upload fails
 */
async function uploadVideoFile(filePath, staticBaseUrl) {
  // Instagram Graph API requires the video to be accessible via HTTPS URL
  // If we have a static server, use that URL
  // Otherwise, we need to upload to a temporary location first
  
  // For now, we'll assume the video is already accessible via staticBaseUrl
  // The actual file should be served by the static server
  const filename = path.basename(filePath);
  const videoUrl = `${staticBaseUrl}/videos/${filename}`;
  
  // In a production setup, you might want to upload to a CDN or storage service
  // For now, we assume the static server is configured to serve files from videos/output/
  return videoUrl;
}

/**
 * Creates an Instagram Reel container (step 1 of 2-step upload process)
 * @param {string} videoUrl - Public HTTPS URL of the video
 * @param {string} caption - Caption for the Reel
 * @returns {Promise<string>} Container ID
 * @throws {Error} If container creation fails
 */
async function createReelContainer(videoUrl, caption) {
  return new Promise((resolve, reject) => {
    if (!config.instagram.accessToken || !config.instagram.userId) {
      reject(new Error('Instagram credentials not configured'));
      return;
    }

    const postData = JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption,
      share_to_feed: true // Also share to main feed
    });

    const options = {
      hostname: 'graph.instagram.com',
      port: 443,
      path: `/v18.0/${config.instagram.userId}/media?access_token=${config.instagram.accessToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            if (response.id) {
              resolve(response.id);
            } else {
              reject(new Error('No container ID in response'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse container response: ${error.message}`));
          }
        } else {
          reject(new Error(`Container creation failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Container creation request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Container creation request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Checks the status of an Instagram media container
 * @param {string} containerId - Container ID to check
 * @returns {Promise<Object>} Status object with status and creation_id
 * @throws {Error} If status check fails
 */
async function checkContainerStatus(containerId) {
  return new Promise((resolve, reject) => {
    if (!config.instagram.accessToken) {
      reject(new Error('Instagram access token not configured'));
      return;
    }

    const options = {
      hostname: 'graph.instagram.com',
      port: 443,
      path: `/v18.0/${containerId}?fields=status_code,status&access_token=${config.instagram.accessToken}`,
      method: 'GET',
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse status response: ${error.message}`));
          }
        } else {
          reject(new Error(`Status check failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Status check request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Status check request timed out'));
    });

    req.end();
  });
}

/**
 * Waits for Instagram container to be ready (status_code === 'FINISHED')
 * @param {string} containerId - Container ID to wait for
 * @param {number} maxWaitTime - Maximum time to wait in milliseconds (default: 300000 = 5 minutes)
 * @param {number} checkInterval - Interval between checks in milliseconds (default: 5000 = 5 seconds)
 * @returns {Promise<void>} Resolves when container is ready
 * @throws {Error} If container fails or timeout is reached
 */
async function waitForContainerReady(containerId, maxWaitTime = 300000, checkInterval = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await checkContainerStatus(containerId);
      
      if (status.status_code === 'FINISHED') {
        return; // Container is ready
      } else if (status.status_code === 'ERROR') {
        throw new Error(`Container processing failed: ${status.status || 'Unknown error'}`);
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      // If it's a status check error, wait and retry
      // If it's a different error, throw it
      if (error.message.includes('Status check')) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Container did not become ready within ${maxWaitTime}ms`);
}

/**
 * Publishes an Instagram Reel from a container (step 2 of 2-step upload process)
 * @param {string} containerId - Container ID from createReelContainer
 * @returns {Promise<Object>} Object containing reelId and permalink
 * @throws {Error} If publishing fails
 */
async function publishReel(containerId) {
  return new Promise((resolve, reject) => {
    if (!config.instagram.accessToken || !config.instagram.userId) {
      reject(new Error('Instagram credentials not configured'));
      return;
    }

    const postData = JSON.stringify({
      creation_id: containerId
    });

    const options = {
      hostname: 'graph.instagram.com',
      port: 443,
      path: `/v18.0/${config.instagram.userId}/media_publish?access_token=${config.instagram.accessToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            if (response.id) {
              resolve({
                reelId: response.id,
                permalink: `https://www.instagram.com/reel/${response.id}/`
              });
            } else {
              reject(new Error('No reel ID in response'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse publish response: ${error.message}`));
          }
        } else {
          reject(new Error(`Publishing failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Publishing request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Publishing request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Main function to upload a Reel to Instagram
 * Handles the complete 2-step process: container creation → publishing
 * @param {string} filePath - Path to video file
 * @param {Object} options - Upload options
 * @param {string} options.caption - Caption for the Reel
 * @param {string} [options.staticBaseUrl] - Base URL for serving video (defaults to config)
 * @returns {Promise<Object>} Object containing success, reelId, and permalink
 * @throws {Error} If upload fails
 */
async function uploadReel(filePath, options = {}) {
  const {
    caption,
    staticBaseUrl = config.paths.staticBaseUrl
  } = options;

  if (!caption) {
    throw new Error('Caption is required for Instagram Reel');
  }

  // Step 1: Get video URL (assume it's served by static server)
  const videoUrl = await uploadVideoFile(filePath, staticBaseUrl);

  // Step 2: Create container
  const containerId = await createReelContainer(videoUrl, caption);

  // Step 3: Wait for container to be ready
  await waitForContainerReady(containerId);

  // Step 4: Publish the Reel
  const result = await publishReel(containerId);

  return {
    success: true,
    ...result
  };
}

module.exports = {
  uploadReel,
  createReelContainer,
  publishReel,
  checkContainerStatus,
  waitForContainerReady
};


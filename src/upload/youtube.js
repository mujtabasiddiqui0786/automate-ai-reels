/**
 * YouTube Data API v3 integration for uploading videos
 * @module upload/youtube
 */

const https = require('https');
const fs = require('fs');
const querystring = require('querystring');
const config = require('../config');
const { withRetry } = require('../utils/retry');
const { checkQuotaAndIncrement } = require('./quota');

/**
 * Gets a new access token from refresh token using OAuth 2.0
 * @returns {Promise<string>} Access token
 * @throws {Error} If token refresh fails
 */
async function getAccessTokenFromRefreshToken() {
  return withRetry(() => new Promise((resolve, reject) => {
    if (!config.youtube.clientId || !config.youtube.clientSecret || !config.youtube.refreshToken) {
      reject(new Error('YouTube OAuth credentials not configured'));
      return;
    }

    const postData = querystring.stringify({
      client_id: config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
      refresh_token: config.youtube.refreshToken,
      grant_type: 'refresh_token'
    });

    const options = {
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
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
            if (response.access_token) {
              resolve(response.access_token);
            } else {
              reject(new Error('No access token in response'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse token response: ${error.message}`));
          }
        } else {
          reject(new Error(`Token refresh failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Token refresh request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Token refresh request timed out'));
    });

    req.write(postData);
    req.end();
  }), { retries: 2, baseDelayMs: 1000 });
}

/**
 * Initiates a resumable upload session with YouTube
 * @param {string} accessToken - OAuth access token
 * @param {Object} metadata - Video metadata
 * @param {string} metadata.title - Video title
 * @param {string} metadata.description - Video description
 * @param {string[]} metadata.tags - Video tags
 * @returns {Promise<string>} Upload URL for resumable upload
 * @throws {Error} If upload initiation fails
 */
async function initiateResumableUpload(accessToken, metadata) {
  return withRetry(() => new Promise((resolve, reject) => {
    // YouTube API requires video metadata in JSON format
    const videoMetadata = {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags || [],
        categoryId: '22', // People & Blogs category (can be changed)
        defaultLanguage: 'en',
        defaultAudioLanguage: 'en'
      },
      status: {
        privacyStatus: 'public', // Can be 'private', 'unlisted', or 'public'
        selfDeclaredMadeForKids: false
      }
    };

    // For YouTube Shorts, we need to set contentDetails
    videoMetadata.contentDetails = {
      duration: 'PT30S', // ISO 8601 duration format (approximate)
      definition: 'hd',
      dimension: 'vertical',
      caption: 'false'
    };

    // YouTube Shorts detection: if video is vertical and short, it's a Short
    // The API will automatically detect it, but we can hint with metadata
    const metadataString = JSON.stringify(videoMetadata);

    const options = {
      hostname: 'www.googleapis.com',
      port: 443,
      path: '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,contentDetails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(metadataString),
        'X-Upload-Content-Type': 'video/*',
        'X-Upload-Content-Length': '0' // Will be set when we know file size
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
          // Get upload URL from Location header
          const uploadUrl = res.headers.location;
          if (uploadUrl) {
            resolve(uploadUrl);
          } else {
            reject(new Error('No upload URL in response headers'));
          }
        } else {
          reject(new Error(`Upload initiation failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Upload initiation request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Upload initiation request timed out'));
    });

    req.write(metadataString);
    req.end();
  }), { retries: 2, baseDelayMs: 1000 });
}

/**
 * Uploads video file to YouTube using resumable upload protocol
 * @param {string} filePath - Path to video file
 * @param {Object} metadata - Video metadata
 * @param {string} metadata.title - Video title
 * @param {string} metadata.description - Video description
 * @param {string[]} metadata.tags - Video tags
 * @returns {Promise<Object>} Object containing videoId
 * @throws {Error} If upload fails
 */
async function uploadVideoToYouTube(filePath, metadata) {
  // Quota guard
  checkQuotaAndIncrement('youtube');

  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`Video file not found: ${filePath}`);
  }

  // Get access token
  const accessToken = await getAccessTokenFromRefreshToken();

  // Initiate resumable upload
  const uploadUrl = await initiateResumableUpload(accessToken, metadata);

  // Get file stats
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  // Upload file in chunks (for large files) or all at once
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const chunkSize = 256 * 1024; // 256 KB chunks
    let uploadedBytes = 0;
    let videoId = null;

    function sendChunkAttempt(startByte) {
      return new Promise((resolveChunk, rejectChunk) => {
        const endByte = Math.min(startByte + chunkSize - 1, fileSize - 1);
        const contentLength = endByte - startByte + 1;

        // Parse upload URL
        const url = new URL(uploadUrl);
        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: 'PUT',
          headers: {
            'Content-Type': 'video/*',
            'Content-Length': contentLength.toString(),
            'Content-Range': `bytes ${startByte}-${endByte}/${fileSize}`
          },
          timeout: 300000 // 5 minutes per chunk
        };

        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
              try {
                const response = JSON.parse(data);
                videoId = response.id;
                return resolveChunk({ done: true, videoId });
              } catch (error) {
                if (res.headers.location) {
                  const match = res.headers.location.match(/[?&]id=([^&]+)/);
                  if (match) {
                    videoId = match[1];
                    return resolveChunk({ done: true, videoId });
                  }
                }
                return resolveChunk({ done: true, videoId: 'unknown' });
              }
            } else if (res.statusCode === 308) {
              const rangeHeader = res.headers.range;
              if (rangeHeader) {
                const match = rangeHeader.match(/bytes=0-(\\d+)/);
                if (match) {
                  uploadedBytes = parseInt(match[1], 10) + 1;
                  return resolveChunk({ done: false, nextStart: uploadedBytes });
                }
              }
              uploadedBytes = endByte + 1;
              if (uploadedBytes < fileSize) {
                return resolveChunk({ done: false, nextStart: uploadedBytes });
              }
              return rejectChunk(new Error('Upload incomplete but no more data to send'));
            } else {
              rejectChunk(new Error(`Upload failed with status ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          rejectChunk(new Error(`Upload request failed: ${error.message}`));
        });

        req.on('timeout', () => {
          req.destroy();
          rejectChunk(new Error('Upload request timed out'));
        });

        const chunkStream = fs.createReadStream(filePath, {
          start: startByte,
          end: endByte
        });

        chunkStream.on('data', (chunk) => {
          req.write(chunk);
        });

        chunkStream.on('end', () => {
          req.end();
        });

        chunkStream.on('error', (error) => {
          req.destroy();
          rejectChunk(new Error(`File read error: ${error.message}`));
        });
      });
    }

    function uploadChunk(startByte) {
      return withRetry(() => sendChunkAttempt(startByte), { retries: 2, baseDelayMs: 1000 })
        .then((result) => {
          if (result.done) {
            resolve({ videoId, videoUrl: `https://www.youtube.com/watch?v=${videoId}` });
          } else if (result.nextStart != null) {
            return uploadChunk(result.nextStart);
          }
          return null;
        })
        .catch((err) => reject(err));
    }

    // Start upload from beginning
    uploadChunk(0);
  });
}

module.exports = {
  getAccessTokenFromRefreshToken,
  uploadVideoToYouTube
};


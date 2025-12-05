/**
 * Main HTTP server for the automate-reels backend
 * Provides REST API endpoints for n8n integration
 * @module server
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { generateLoop } = require('./video/generator');
const { generateMetadata } = require('./metadata/generator');
const { uploadVideoToYouTube } = require('./upload/youtube');
const { uploadReel } = require('./upload/instagram');
const { uploadTikTok } = require('./upload/tiktok');

/**
 * Parses JSON request body
 * @param {http.IncomingMessage} req - HTTP request object
 * @returns {Promise<Object>} Parsed JSON object
 */
function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        if (body) {
          resolve(JSON.parse(body));
        } else {
          resolve({});
        }
      } catch (error) {
        reject(new Error(`Invalid JSON: ${error.message}`));
      }
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });
  });
}

/**
 * Sends JSON response
 * @param {http.ServerResponse} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} data - Data to send as JSON
 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Sends error response
 * @param {http.ServerResponse} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 */
function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, {
    success: false,
    error: message
  });
}

/**
 * Handles CORS preflight requests
 * @param {http.ServerResponse} res - HTTP response object
 */
function handleCORS(res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}

/**
 * Serves static video files
 * @param {http.ServerResponse} res - HTTP response object
 * @param {string} filePath - Path to file to serve
 */
function serveStaticFile(res, filePath) {
  // Security: ensure file is within output directory
  const normalizedPath = path.normalize(filePath);
  const outputDir = path.normalize(config.paths.outputVideoDir);
  
  if (!normalizedPath.startsWith(outputDir)) {
    sendError(res, 403, 'Access denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendError(res, 404, 'File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.mp4' ? 'video/mp4' :
                        ext === '.mov' ? 'video/quicktime' :
                        ext === '.webm' ? 'video/webm' :
                        'application/octet-stream';

    const stream = fs.createReadStream(filePath);
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*'
    });

    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) {
        sendError(res, 500, 'Error reading file');
      }
    });
  });
}

/**
 * Handles POST /generate endpoint
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} body - Request body
 */
async function handleGenerate(res, body) {
  try {
    const {
      style = 'default',
      durationSeconds = 25,
      seed = Date.now()
    } = body;

    // Generate video
    const videoResult = await generateLoop({
      style,
      durationSeconds,
      seed
    });

    // Generate metadata
    const metadata = generateMetadata({
      style,
      seed,
      colorProfile: 'vibrant'
    });

    sendJSON(res, 200, {
      filePath: videoResult.filePath,
      publicUrl: videoResult.publicUrl,
      meta: videoResult.meta,
      titles: metadata
    });
  } catch (error) {
    console.error('Generate error:', error);
    sendError(res, 500, error.message || 'Failed to generate video');
  }
}

/**
 * Handles POST /upload/youtube endpoint
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} body - Request body
 */
async function handleUploadYouTube(res, body) {
  try {
    const { filePath, title, description, tags } = body;

    if (!filePath) {
      sendError(res, 400, 'filePath is required');
      return;
    }

    if (!title) {
      sendError(res, 400, 'title is required');
      return;
    }

    const result = await uploadVideoToYouTube(filePath, {
      title,
      description: description || '',
      tags: tags || []
    });

    sendJSON(res, 200, {
      success: true,
      videoId: result.videoId,
      videoUrl: result.videoUrl
    });
  } catch (error) {
    console.error('YouTube upload error:', error);
    sendError(res, 500, error.message || 'Failed to upload to YouTube');
  }
}

/**
 * Handles POST /upload/instagram endpoint
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} body - Request body
 */
async function handleUploadInstagram(res, body) {
  try {
    const { filePath, caption } = body;

    if (!filePath) {
      sendError(res, 400, 'filePath is required');
      return;
    }

    if (!caption) {
      sendError(res, 400, 'caption is required');
      return;
    }

    const result = await uploadReel(filePath, {
      caption,
      staticBaseUrl: config.paths.staticBaseUrl
    });

    sendJSON(res, 200, result);
  } catch (error) {
    console.error('Instagram upload error:', error);
    sendError(res, 500, error.message || 'Failed to upload to Instagram');
  }
}

/**
 * Handles POST /upload/tiktok endpoint
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} body - Request body
 */
async function handleUploadTikTok(res, body) {
  try {
    const { filePath, caption } = body;

    if (!filePath) {
      sendError(res, 400, 'filePath is required');
      return;
    }

    if (!caption) {
      sendError(res, 400, 'caption is required');
      return;
    }

    const result = await uploadTikTok(filePath, {
      caption
    });

    sendJSON(res, 200, result);
  } catch (error) {
    console.error('TikTok upload error:', error);
    sendError(res, 500, error.message || 'Failed to upload to TikTok');
  }
}

/**
 * Main request handler
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 */
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    handleCORS(res);
    return;
  }

  // Route: GET /videos/*
  if (method === 'GET' && pathname.startsWith('/videos/')) {
    const filename = pathname.replace('/videos/', '');
    const filePath = path.join(config.paths.outputVideoDir, filename);
    serveStaticFile(res, filePath);
    return;
  }

  // Route: POST /generate
  if (method === 'POST' && pathname === '/generate') {
    try {
      const body = await parseJSONBody(req);
      await handleGenerate(res, body);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: POST /upload/youtube
  if (method === 'POST' && pathname === '/upload/youtube') {
    try {
      const body = await parseJSONBody(req);
      await handleUploadYouTube(res, body);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: POST /upload/instagram
  if (method === 'POST' && pathname === '/upload/instagram') {
    try {
      const body = await parseJSONBody(req);
      await handleUploadInstagram(res, body);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: POST /upload/tiktok
  if (method === 'POST' && pathname === '/upload/tiktok') {
    try {
      const body = await parseJSONBody(req);
      await handleUploadTikTok(res, body);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: GET /health (health check endpoint)
  if (method === 'GET' && pathname === '/health') {
    sendJSON(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // 404 for all other routes
  sendError(res, 404, 'Endpoint not found');
}

/**
 * Starts the HTTP server
 */
function startServer() {
  const server = http.createServer(handleRequest);

  server.listen(config.server.port, config.server.host, () => {
    console.log(`Server running at http://${config.server.host}:${config.server.port}`);
    console.log(`Static files served from: ${config.paths.outputVideoDir}`);
    console.log(`Static base URL: ${config.paths.staticBaseUrl}`);
    console.log('\nAvailable endpoints:');
    console.log('  POST /generate - Generate a new loop video');
    console.log('  POST /upload/youtube - Upload video to YouTube');
    console.log('  POST /upload/instagram - Upload video to Instagram Reels');
    console.log('  POST /upload/tiktok - Upload/export video to TikTok');
    console.log('  GET /videos/* - Serve static video files');
    console.log('  GET /health - Health check');
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  handleRequest
};


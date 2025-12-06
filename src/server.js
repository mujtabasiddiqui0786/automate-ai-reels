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
const { createError, sendErrorResponse } = require('./utils/errors');
const { createJob, updateJobStatus, appendJobStep, getJob } = require('./jobs/store');
const { LOGS_DIR } = require('./utils/log');

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
 * Handle GET /jobs/:id
 */
function handleGetJob(res, jobId) {
  const job = getJob(jobId);
  if (!job) {
    sendError(res, 404, 'Job not found', 'JOB_NOT_FOUND');
    return;
  }
  sendJSON(res, 200, job);
}

/**
 * Handle GET /jobs/:id/log
 */
function handleGetJobLog(res, jobId) {
  const logPath = path.join(LOGS_DIR, `job-${jobId}.log`);
  if (!fs.existsSync(logPath)) {
    sendError(res, 404, 'Job log not found', 'JOB_LOG_NOT_FOUND');
    return;
  }
  const content = fs.readFileSync(logPath, 'utf8');
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(content);
}

/**
 * Cleanup old files based on retention days.
 */
function cleanupFiles(dir, retentionDays) {
  if (!fs.existsSync(dir)) return { removed: 0 };
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry === '.gitkeep') continue;
    const fullPath = path.join(dir, entry);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isFile() && stats.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
        removed += 1;
      }
    } catch {
      // ignore errors
    }
  }
  return { removed };
}

async function handleCleanup(res, body) {
  const token = body && body.token;
  if (!process.env.MAINTENANCE_TOKEN || token !== process.env.MAINTENANCE_TOKEN) {
    sendError(res, 403, 'Forbidden', 'UNAUTHORIZED');
    return;
  }

  const retentionDays = parseInt(process.env.VIDEO_RETENTION_DAYS || '30', 10);
  const outputs = [];
  outputs.push(cleanupFiles(config.paths.outputVideoDir, retentionDays));
  outputs.push(cleanupFiles(path.join(process.cwd(), 'videos', 'thumbnails'), retentionDays));
  outputs.push(cleanupFiles(path.join(process.cwd(), 'exports', 'tiktok'), retentionDays));

  sendJSON(res, 200, {
    success: true,
    retentionDays,
    outputs
  });
}

/**
 * Fire-and-forget callback to external URL when a job finishes.
 */
function sendCallback(callbackUrl, payload) {
  if (!callbackUrl) return;
  try {
    const parsed = url.parse(callbackUrl);
    const data = JSON.stringify(payload);
    const isHttps = parsed.protocol === 'https:';
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.path || '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 5000
    };
    const req = (isHttps ? https : http).request(opts, () => {});
    req.on('error', () => {});
    req.on('timeout', () => req.destroy());
    req.write(data);
    req.end();
  } catch (err) {
    console.error('Callback error:', err.message);
  }
}

/**
 * Pipeline: generate + uploads
 */
async function handlePipelineGenerateUpload(res, body) {
  const job = createJob('pipeline', body);
  updateJobStatus(job.id, { status: 'running' });

  const results = {};
  const { generation = {}, platforms = {}, metadata: metaInput = {}, callbackUrl } = body;

  try {
    appendJobStep(job.id, { name: 'generateLoop', status: 'running' });
    const videoResult = await generateLoop({
      style: generation.style || 'default',
      durationSeconds: generation.durationSeconds || 25,
      seed: generation.seed || Date.now(),
      perfectLoop: !!generation.perfectLoop,
      fadeAudio: !!generation.fadeAudio
    });
    results.video = videoResult;
    appendJobStep(job.id, { name: 'generateLoop', status: 'success', finishedAt: new Date().toISOString() });

    const metadata = generateMetadata({
      style: generation.style || 'default',
      seed: generation.seed || Date.now(),
      theme: metaInput.theme,
      keywords: metaInput.keywords,
      variants: metaInput.variants
    });
    results.metadata = metadata;

    if (platforms.youtube && platforms.youtube.enabled) {
      appendJobStep(job.id, { name: 'uploadYouTube', status: 'running' });
      const ytTitle = platforms.youtube.titleOverride || metadata.youtubeTitle;
      const ytResult = await uploadVideoToYouTube(videoResult.filePath, {
        title: ytTitle,
        description: metadata.youtubeDescription,
        tags: metadata.youtubeTags
      });
      results.youtube = ytResult;
      appendJobStep(job.id, { name: 'uploadYouTube', status: 'success', finishedAt: new Date().toISOString() });
    }

    if (platforms.instagram && platforms.instagram.enabled) {
      appendJobStep(job.id, { name: 'uploadInstagram', status: 'running' });
      const igResult = await uploadReel(videoResult.filePath, {
        caption: metadata.instagramCaption,
        staticBaseUrl: config.paths.staticBaseUrl
      });
      results.instagram = igResult;
      appendJobStep(job.id, { name: 'uploadInstagram', status: 'success', finishedAt: new Date().toISOString() });
    }

    if (platforms.tiktok && platforms.tiktok.enabled) {
      appendJobStep(job.id, { name: 'uploadTikTok', status: 'running' });
      const ttResult = await uploadTikTok(videoResult.filePath, {
        caption: metadata.tiktokCaption
      });
      results.tiktok = ttResult;
      appendJobStep(job.id, { name: 'uploadTikTok', status: 'success', finishedAt: new Date().toISOString() });
    }

    updateJobStatus(job.id, { status: 'success', output: results });
    sendCallback(callbackUrl, { jobId: job.id, status: 'success', output: results });

    sendJSON(res, 200, {
      jobId: job.id,
      status: 'success',
      output: results
    });
  } catch (error) {
    console.error('Pipeline error:', error);
    appendJobStep(job.id, { name: 'pipeline', status: 'error', error: error.message, finishedAt: new Date().toISOString() });
    updateJobStatus(job.id, { status: 'error', error: { message: error.message, stack: error.stack } });
    sendCallback(body.callbackUrl, { jobId: job.id, status: 'error', error: { message: error.message } });
    sendErrorResponse(res, createError('PIPELINE_FAILED', error.message || 'Pipeline failed', error.details), 500);
  }
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
function sendError(res, statusCode, message, code = 'GENERIC_ERROR', details) {
  sendErrorResponse(res, createError(code, message, details), statusCode);
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
function serveStaticFile(res, filePath, baseDir = config.paths.outputVideoDir) {
  // Security: ensure file is within output directory
  const normalizedPath = path.normalize(filePath);
  const outputDir = path.normalize(baseDir);
  
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
                      ext === '.jpg' ? 'image/jpeg' :
                      ext === '.jpeg' ? 'image/jpeg' :
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
async function handleGenerate(res, body, trackJob) {
  let job = null;
  try {
    const {
      style = 'default',
      durationSeconds = 25,
      seed = Date.now(),
      perfectLoop = false,
      fadeAudio = false
    } = body;

    if (trackJob) {
      job = createJob('generate', body);
      updateJobStatus(job.id, { status: 'running' });
    }

    // Generate video
    const videoResult = await generateLoop({
      style,
      durationSeconds,
      seed,
      perfectLoop,
      fadeAudio
    });

    // Generate metadata
    const metadata = generateMetadata({
      style,
      seed,
      colorProfile: 'vibrant',
      theme: body.theme,
      keywords: body.keywords,
      variants: body.variants
    });

    if (job) {
      updateJobStatus(job.id, {
        status: 'success',
        output: {
          filePath: videoResult.filePath,
          publicUrl: videoResult.publicUrl,
          thumbnailUrl: videoResult.thumbnailUrl,
          meta: videoResult.meta,
          titles: metadata
        }
      });
    }

    sendJSON(res, 200, {
      jobId: job ? job.id : undefined,
      filePath: videoResult.filePath,
      publicUrl: videoResult.publicUrl,
      thumbnailUrl: videoResult.thumbnailUrl,
      meta: videoResult.meta,
      titles: metadata
    });
  } catch (error) {
    console.error('Generate error:', error);
    if (job) {
      updateJobStatus(job.id, {
        status: 'error',
        error: { message: error.message, stack: error.stack }
      });
    }
    sendErrorResponse(res, createError('GENERATE_FAILED', error.message || 'Failed to generate video'), 500);
  }
}

/**
 * Handles POST /upload/youtube endpoint
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} body - Request body
 */
async function handleUploadYouTube(res, body, trackJob) {
  let job = null;
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

    if (trackJob) {
      job = createJob('upload', body);
      updateJobStatus(job.id, { status: 'running' });
      appendJobStep(job.id, { name: 'uploadYouTube', status: 'running' });
    }

    const result = await uploadVideoToYouTube(filePath, {
      title,
      description: description || '',
      tags: tags || []
    });

    if (job) {
      appendJobStep(job.id, { name: 'uploadYouTube', status: 'success', finishedAt: new Date().toISOString() });
      updateJobStatus(job.id, { status: 'success', output: result });
    }

    sendJSON(res, 200, {
      jobId: job ? job.id : undefined,
      success: true,
      videoId: result.videoId,
      videoUrl: result.videoUrl
    });
  } catch (error) {
    console.error('YouTube upload error:', error);
    if (job) {
      appendJobStep(job.id, { name: 'uploadYouTube', status: 'error', error: error.message, finishedAt: new Date().toISOString() });
      updateJobStatus(job.id, { status: 'error', error: { message: error.message, stack: error.stack } });
    }
    sendErrorResponse(res, createError('YOUTUBE_UPLOAD_FAILED', error.message || 'Failed to upload to YouTube', error.details), 500);
  }
}

/**
 * Handles POST /upload/instagram endpoint
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} body - Request body
 */
async function handleUploadInstagram(res, body, trackJob) {
  let job = null;
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

    if (trackJob) {
      job = createJob('upload', body);
      updateJobStatus(job.id, { status: 'running' });
      appendJobStep(job.id, { name: 'uploadInstagram', status: 'running' });
    }

    const result = await uploadReel(filePath, {
      caption,
      staticBaseUrl: config.paths.staticBaseUrl
    });

    if (job) {
      appendJobStep(job.id, { name: 'uploadInstagram', status: 'success', finishedAt: new Date().toISOString() });
      updateJobStatus(job.id, { status: 'success', output: result });
    }

    sendJSON(res, 200, result);
  } catch (error) {
    console.error('Instagram upload error:', error);
    if (job) {
      appendJobStep(job.id, { name: 'uploadInstagram', status: 'error', error: error.message, finishedAt: new Date().toISOString() });
      updateJobStatus(job.id, { status: 'error', error: { message: error.message, stack: error.stack } });
    }
    sendErrorResponse(res, createError('INSTAGRAM_UPLOAD_FAILED', error.message || 'Failed to upload to Instagram', error.details), 500);
  }
}

/**
 * Handles POST /upload/tiktok endpoint
 * @param {http.ServerResponse} res - HTTP response object
 * @param {Object} body - Request body
 */
async function handleUploadTikTok(res, body, trackJob) {
  let job = null;
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

    if (trackJob) {
      job = createJob('upload', body);
      updateJobStatus(job.id, { status: 'running' });
      appendJobStep(job.id, { name: 'uploadTikTok', status: 'running' });
    }

    const result = await uploadTikTok(filePath, {
      caption
    });

    if (job) {
      appendJobStep(job.id, { name: 'uploadTikTok', status: 'success', finishedAt: new Date().toISOString() });
      updateJobStatus(job.id, { status: 'success', output: result });
    }

    sendJSON(res, 200, result);
  } catch (error) {
    console.error('TikTok upload error:', error);
    if (job) {
      appendJobStep(job.id, { name: 'uploadTikTok', status: 'error', error: error.message, finishedAt: new Date().toISOString() });
      updateJobStatus(job.id, { status: 'error', error: { message: error.message, stack: error.stack } });
    }
    sendErrorResponse(res, createError('TIKTOK_UPLOAD_FAILED', error.message || 'Failed to upload to TikTok', error.details), 500);
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

  // Route: GET /thumbnails/*
  if (method === 'GET' && pathname.startsWith('/thumbnails/')) {
    const filename = pathname.replace('/thumbnails/', '');
    const thumbDir = path.join(process.cwd(), 'videos', 'thumbnails');
    const filePath = path.join(thumbDir, filename);
    serveStaticFile(res, filePath, thumbDir);
    return;
  }

  // Route: GET /jobs/:id or /jobs/:id/log
  if (method === 'GET' && pathname.startsWith('/jobs/')) {
    const parts = pathname.split('/').filter(Boolean); // ['jobs', ':id', 'log'?]
    const jobId = parts[1];
    if (!jobId) {
      sendError(res, 400, 'Job ID required', 'JOB_ID_REQUIRED');
      return;
    }
    if (parts[2] === 'log') {
      handleGetJobLog(res, jobId);
    } else {
      handleGetJob(res, jobId);
    }
    return;
  }

  // Route: POST /generate
  if (method === 'POST' && pathname === '/generate') {
    try {
      const body = await parseJSONBody(req);
      const trackJob = parsedUrl.query && parsedUrl.query.track === 'true' || body.trackJob;
      await handleGenerate(res, body, trackJob);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: POST /upload/youtube
  if (method === 'POST' && pathname === '/upload/youtube') {
    try {
      const body = await parseJSONBody(req);
      const trackJob = parsedUrl.query && parsedUrl.query.track === 'true' || body.trackJob;
      await handleUploadYouTube(res, body, trackJob);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: POST /upload/instagram
  if (method === 'POST' && pathname === '/upload/instagram') {
    try {
      const body = await parseJSONBody(req);
      const trackJob = parsedUrl.query && parsedUrl.query.track === 'true' || body.trackJob;
      await handleUploadInstagram(res, body, trackJob);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: POST /upload/tiktok
  if (method === 'POST' && pathname === '/upload/tiktok') {
    try {
      const body = await parseJSONBody(req);
      const trackJob = parsedUrl.query && parsedUrl.query.track === 'true' || body.trackJob;
      await handleUploadTikTok(res, body, trackJob);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: POST /pipeline/generate-upload
  if (method === 'POST' && pathname === '/pipeline/generate-upload') {
    try {
      const body = await parseJSONBody(req);
      await handlePipelineGenerateUpload(res, body);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: POST /maintenance/cleanup
  if (method === 'POST' && pathname === '/maintenance/cleanup') {
    try {
      const body = await parseJSONBody(req);
      await handleCleanup(res, body);
    } catch (error) {
      sendError(res, 400, error.message || 'Invalid request');
    }
    return;
  }

  // Route: GET /health (health check endpoint)
  if (method === 'GET' && pathname === '/health') {
    const ffmpegAvailable = (() => {
      try {
        const { spawnSync } = require('child_process');
        const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
        return result.status === 0;
      } catch {
        return false;
      }
    })();

    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      ffmpeg: { available: ffmpegAvailable },
      youtube: { configured: config.youtube.enabled },
      instagram: { configured: config.instagram.enabled },
      tiktok: { configured: config.tiktok.enabled },
      storage: {
        videosOutputExists: fs.existsSync(config.paths.outputVideoDir),
        assetsBaseLoopsExists: fs.existsSync(config.paths.baseVideoDir),
        thumbnailsDirExists: fs.existsSync(path.join(process.cwd(), 'videos', 'thumbnails'))
      }
    };

    sendJSON(res, 200, status);
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


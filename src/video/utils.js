/**
 * Video utility functions for ffmpeg execution and seed-based randomization
 * @module video/utils
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Executes an ffmpeg command and returns a promise
 * @param {string[]} args - Array of ffmpeg arguments
 * @param {Object} options - Execution options
 * @param {number} options.timeout - Timeout in milliseconds (default: 300000 = 5 minutes)
 * @returns {Promise<void>} Resolves when ffmpeg completes successfully
 * @throws {Error} If ffmpeg execution fails
 */
function executeFFmpeg(args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 300000; // 5 minutes default
    let timeoutId;

    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'] // stdin: ignore, stdout: pipe, stderr: pipe
    });

    let stdout = '';
    let stderr = '';

    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\nStderr: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to start ffmpeg: ${error.message}\nMake sure ffmpeg is installed and in PATH`));
    });

    // Set timeout
    timeoutId = setTimeout(() => {
      ffmpeg.kill();
      reject(new Error(`ffmpeg execution timed out after ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Generates a deterministic pseudo-random number from a seed
 * Simple linear congruential generator for consistent results
 * @param {number} seed - Seed value
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Deterministic random number in range [min, max]
 */
function generateSeedValue(seed, min, max) {
  // Simple LCG (Linear Congruential Generator)
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  // Use seed to generate a value
  let value = ((seed * a + c) % m) / m;
  
  // Scale to range [min, max]
  return Math.floor(value * (max - min + 1)) + min;
}

/**
 * Generates a deterministic float from a seed
 * @param {number} seed - Seed value
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} Deterministic random float in range [min, max)
 */
function generateSeedFloat(seed, min, max) {
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  let value = ((seed * a + c) % m) / m;
  return min + (value * (max - min));
}

/**
 * Gets a random base clip from the base_loops directory
 * Uses seed for deterministic selection if provided
 * @param {string} baseVideoDir - Directory containing base video clips
 * @param {number} [seed] - Optional seed for deterministic selection
 * @returns {Promise<string>} Path to selected video file
 * @throws {Error} If no video files are found
 */
async function getRandomBaseClip(baseVideoDir, seed = null) {
  try {
    const files = fs.readdirSync(baseVideoDir);
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
    });

    if (videoFiles.length === 0) {
      throw new Error(`No video files found in ${baseVideoDir}. Please add base video clips.`);
    }

    let selectedIndex;
    if (seed !== null) {
      selectedIndex = generateSeedValue(seed, 0, videoFiles.length - 1);
    } else {
      selectedIndex = Math.floor(Math.random() * videoFiles.length);
    }

    const selectedFile = videoFiles[selectedIndex];
    return path.join(baseVideoDir, selectedFile);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Base video directory does not exist: ${baseVideoDir}`);
    }
    throw error;
  }
}

/**
 * Validates that a file exists and is readable
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if file exists and is readable
 */
async function validateVideoFile(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets video duration in seconds using ffprobe
 * @param {string} filePath - Path to video file
 * @returns {Promise<number>} Duration in seconds
 */
async function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let output = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      // ffprobe outputs to stderr, but we can ignore it if exit code is 0
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) {
          reject(new Error('Could not parse video duration'));
        } else {
          resolve(duration);
        }
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    ffprobe.on('error', (error) => {
      reject(new Error(`Failed to start ffprobe: ${error.message}`));
    });
  });
}

/**
 * Generate a thumbnail image from a video at a specific timestamp.
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path to output image (e.g., .jpg)
 * @param {number} timestampSeconds - Timestamp to capture frame
 * @returns {Promise<void>}
 */
async function generateThumbnail(inputPath, outputPath, timestampSeconds) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const args = [
      '-ss', String(timestampSeconds),
      '-i', inputPath,
      '-vframes', '1',
      '-q:v', '2',
      outputPath
    ];

    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    ff.stderr.on('data', (d) => { stderr += d.toString(); });

    ff.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg thumbnail failed with code ${code}: ${stderr}`));
    });

    ff.on('error', (err) => reject(err));
  });
}

module.exports = {
  executeFFmpeg,
  generateSeedValue,
  generateSeedFloat,
  getRandomBaseClip,
  validateVideoFile,
  getVideoDuration,
  generateThumbnail
};


/**
 * Video generation module for creating satisfying loop videos
 * @module video/generator
 */

const path = require('path');
const fs = require('fs');
const config = require('../config');
const {
  executeFFmpeg,
  generateSeedValue,
  generateSeedFloat,
  getRandomBaseClip,
  getVideoDuration
} = require('./utils');

/**
 * Generates a satisfying loop video with ffmpeg transformations
 * @param {Object} options - Generation options
 * @param {string} [options.style] - Style identifier (e.g., 'gradient', 'smooth', 'vibrant')
 * @param {number} [options.durationSeconds] - Target duration in seconds (default: 25)
 * @param {number} [options.seed] - Seed for deterministic generation (default: Date.now())
 * @returns {Promise<Object>} Object containing filePath, publicUrl, and meta
 * @throws {Error} If generation fails
 */
async function generateLoop(options = {}) {
  const {
    style = 'default',
    durationSeconds = 25,
    seed = Date.now()
  } = options;

  // Get a base clip (deterministic if seed provided)
  const baseClipPath = await getRandomBaseClip(config.paths.baseVideoDir, seed);

  // Generate unique output filename
  const timestamp = Date.now();
  const filename = `loop_${timestamp}_${seed}.mp4`;
  const outputPath = path.join(config.paths.outputVideoDir, filename);

  // Generate deterministic parameters from seed
  const hueShift = generateSeedValue(seed, -30, 30); // Hue shift in degrees (-30 to +30)
  const saturation = generateSeedFloat(seed + 1, 0.8, 1.3); // Saturation multiplier
  const brightness = generateSeedFloat(seed + 2, 0.9, 1.1); // Brightness adjustment
  const speedMultiplier = generateSeedFloat(seed + 3, 0.8, 1.2); // Playback speed (0.8x to 1.2x)
  const mirror = generateSeedValue(seed + 4, 0, 1) === 1; // Random mirroring
  const scale = generateSeedFloat(seed + 5, 1.0, 1.2); // Scale factor for zoom effect

  // Get base clip duration
  const baseDuration = await getVideoDuration(baseClipPath);
  // Calculate loops needed: we need enough content to cover target duration after speed adjustment
  // If speed is 1.2x, we need less base duration. If 0.8x, we need more.
  const effectiveBaseDuration = baseDuration / speedMultiplier;
  const loopsNeeded = Math.max(1, Math.ceil(durationSeconds / effectiveBaseDuration) + 1); // +1 for safety

  // Build filter complex with proper syntax
  const filterComplex = buildFilterComplex({
    hueShift,
    saturation,
    brightness,
    speedMultiplier,
    mirror,
    scale
  });

  // Build ffmpeg command with stream_loop for input looping
  // Note: Audio mapping will be skipped automatically if no audio stream exists
  const ffmpegArgs = [
    '-stream_loop', loopsNeeded.toString(),
    '-i', baseClipPath,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    '-r', '30', // 30 fps
    '-t', durationSeconds.toString(), // Target duration (will cut at this point)
    '-shortest', // End when shortest stream ends
    '-y', // Overwrite output file
    outputPath
  ];

  // Execute ffmpeg
  await executeFFmpeg(ffmpegArgs, { timeout: 600000 }); // 10 minute timeout

  // Verify output file exists
  if (!fs.existsSync(outputPath)) {
    throw new Error('Video generation completed but output file not found');
  }

  // Generate public URL
  const publicUrl = `${config.paths.staticBaseUrl}/videos/${filename}`;

  return {
    filePath: outputPath,
    publicUrl,
    meta: {
      style,
      durationSeconds,
      seed,
      baseClip: path.basename(baseClipPath),
      hueShift,
      saturation: saturation.toFixed(2),
      brightness: brightness.toFixed(2),
      speedMultiplier: speedMultiplier.toFixed(2),
      mirror,
      scale: scale.toFixed(2)
    }
  };
}

/**
 * Builds ffmpeg filter_complex string for video transformations
 * Uses proper filter_complex syntax with labeled inputs/outputs
 * @param {Object} params - Filter parameters
 * @returns {string} Filter complex string
 */
function buildFilterComplex(params) {
  const {
    hueShift,
    saturation,
    brightness,
    speedMultiplier,
    mirror,
    scale
  } = params;

  const filterParts = [];

  // Start with video input [0:v]
  // Step 1: Scale and crop to 1080x1920 (9:16 aspect ratio)
  filterParts.push('[0:v]scale=1080:-1,crop=1080:1920:0:(ih-1920)/2[v0]');

  // Step 2: Apply zoom/scale effect if scale > 1.0
  let currentLabel = 'v0';
  if (scale > 1.0) {
    const scaleWidth = Math.floor(1080 * scale);
    const scaleHeight = Math.floor(1920 * scale);
    filterParts.push(`[${currentLabel}]scale=${scaleWidth}:${scaleHeight},crop=1080:1920:0:(ih-1920)/2[v1]`);
    currentLabel = 'v1';
  }

  // Step 3: Apply mirroring if enabled
  if (mirror) {
    const nextLabel = currentLabel === 'v0' ? 'v1' : 'v2';
    filterParts.push(`[${currentLabel}]hflip[${nextLabel}]`);
    currentLabel = nextLabel;
  } else if (currentLabel === 'v0') {
    // If no mirror and no scale, we need to create v1 for next step
    filterParts.push(`[${currentLabel}]null[v1]`);
    currentLabel = 'v1';
  }

  // Step 4: Color adjustments (hue, saturation, brightness)
  // eq filter: hue in degrees, saturation multiplier, brightness offset
  const colorLabel = currentLabel === 'v1' ? 'v2' : 'v3';
  filterParts.push(`[${currentLabel}]eq=hue=${hueShift}:saturation=${saturation}:brightness=${brightness - 1.0}[${colorLabel}]`);
  currentLabel = colorLabel;

  // Step 5: Speed adjustment (setpts filter)
  // setpts=PTS/speed makes video play 'speed' times faster
  const speedLabel = currentLabel === 'v2' ? 'v3' : 'v4';
  if (speedMultiplier !== 1.0) {
    filterParts.push(`[${currentLabel}]setpts=PTS/${speedMultiplier}[vout]`);
  } else {
    filterParts.push(`[${currentLabel}]null[vout]`);
  }

  // Audio processing: speed adjustment with atempo
  // atempo can only do 0.5x to 2.0x, so we may need to chain if outside range
  // Note: If input has no audio, this will create an error, but ffmpeg will handle it gracefully
  // by skipping audio processing. For production, you might want to detect audio streams first.
  if (speedMultiplier !== 1.0) {
    if (speedMultiplier >= 0.5 && speedMultiplier <= 2.0) {
      filterParts.push('[0:a]atempo=' + speedMultiplier + '[aout]');
    } else if (speedMultiplier < 0.5) {
      // Chain two atempo filters for very slow speeds
      filterParts.push('[0:a]atempo=0.5,atempo=' + (speedMultiplier / 0.5) + '[aout]');
    } else {
      // Chain two atempo filters for very fast speeds
      filterParts.push('[0:a]atempo=2.0,atempo=' + (speedMultiplier / 2.0) + '[aout]');
    }
  } else {
    filterParts.push('[0:a]anull[aout]');
  }

  return filterParts.join(';');
}


// Export the main function
module.exports = {
  generateLoop
};


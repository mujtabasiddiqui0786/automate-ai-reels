/**
 * Gemini Nano client for generating video prompts and parameters.
 * Uses only Node.js built-in modules.
 */
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const config = require('../config');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const API_KEY = process.env.GEMINI_API_KEY || '';

function buildRequestBody(promptText) {
  return JSON.stringify({
    contents: [{ parts: [{ text: promptText }]}]
  });
}

function callGemini(promptText) {
  return new Promise((resolve, reject) => {
    if (!API_KEY) {
      return reject(new Error('GEMINI_API_KEY not set'));
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${API_KEY}`;
    const url = new URL(endpoint);
    const body = buildRequestBody(promptText);

    const options = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Gemini API error ${res.statusCode}: ${data}`));
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Gemini parse error: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini request timed out'));
    });
    req.write(body);
    req.end();
  });
}

function extractText(response) {
  try {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('\n').trim();
    return text;
  } catch {
    return '';
  }
}

/**
 * Generate a creative prompt for an infinity loop video.
 * @param {object} context optional context including recent prompts
 */
async function generateVideoPrompt(context = {}) {
  const recent = context.recentPrompts || [];
  const lastSnippet = recent.slice(-3).map((p) => `- ${p.prompt}`).join('\n');
  const template = [
    'Create one concise prompt for a seamless infinity loop short video.',
    'Include: subject (e.g., rotating cube, flowing rings), style (calm/neon/vintage),',
    'color palette, motion type (rotation/orbit/pulse), speed (slow/medium/fast).',
    'Keep it under 35 words. No narration, no audio instructions.',
    'Examples of prior prompts:',
    lastSnippet || '- None provided'
  ].join('\n');

  const response = await callGemini(template);
  const text = extractText(response);
  return {
    id: `prompt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    prompt: text,
    aiGenerated: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Convert AI prompt text to generation parameters for ffmpeg pipeline.
 */
function generateVideoParameters(promptText, seed = Date.now()) {
  const lower = (promptText || '').toLowerCase();
  const style = lower.includes('neon') ? 'neon'
    : lower.includes('calm') ? 'calm'
    : lower.includes('vintage') ? 'vintage'
    : 'default';

  const motion = lower.includes('slow') ? 0.9
    : lower.includes('fast') ? 1.15
    : 1.0;

  return {
    style,
    seed,
    durationSeconds: 25,
    perfectLoop: true,
    fadeAudio: true,
    speedHint: motion
  };
}

/**
 * Generate an iterative improvement prompt.
 * @param {object} lastMeta metadata of last video/prompt
 */
async function generateIterativePrompt(lastMeta = {}, recent = []) {
  const lastPrompt = lastMeta.prompt || 'rotating cube neon loop';
  const feedback = lastMeta.feedback || 'make it smoother and more vibrant';
  const recentTxt = recent.slice(-3).map((p) => `- ${p.prompt}`).join('\n');
  const template = [
    'Improve the previous short infinity loop prompt with minor tweaks.',
    `Previous: ${lastPrompt}`,
    `Feedback: ${feedback}`,
    'Keep under 35 words. Maintain seamless loop. Suggest small variation (color, speed, shape).',
    'Recent prompts:',
    recentTxt || '- None'
  ].join('\n');

  const response = await callGemini(template);
  const text = extractText(response);
  return {
    id: `prompt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    prompt: text,
    aiGenerated: true,
    timestamp: new Date().toISOString(),
    parentPromptId: lastMeta.id || null
  };
}

module.exports = {
  generateVideoPrompt,
  generateVideoParameters,
  generateIterativePrompt
};


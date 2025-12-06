const BASE_TEMPLATE = [
  'Create one concise prompt for a seamless, satisfying infinity loop short video.',
  'Include: subject (geometric shapes like cube/rings), style (calm/neon/vintage/default),',
  'color palette, motion type (rotation/orbit/pulse), and speed (slow/medium/fast).',
  'Keep under 35 words. No narration.'
].join(' ');

const IMPROVE_TEMPLATE = (previous, feedback) => [
  'Improve the previous infinity loop prompt with small tweaks (color, speed, shape).',
  `Previous: ${previous}`,
  `Feedback: ${feedback || 'make it smoother and more vibrant'}`,
  'Keep under 35 words.'
].join(' ');

module.exports = {
  BASE_TEMPLATE,
  IMPROVE_TEMPLATE
};


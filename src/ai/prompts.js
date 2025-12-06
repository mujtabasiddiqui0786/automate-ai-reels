const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROMPTS_FILE = path.join(process.cwd(), 'prompts.json');

function ensureFile() {
  if (!fs.existsSync(PROMPTS_FILE)) {
    fs.writeFileSync(PROMPTS_FILE, JSON.stringify({ prompts: [] }, null, 2), 'utf8');
  }
}

function loadPrompts() {
  ensureFile();
  try {
    const raw = fs.readFileSync(PROMPTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.prompts || [];
  } catch {
    return [];
  }
}

function saveAll(prompts) {
  fs.writeFileSync(PROMPTS_FILE, JSON.stringify({ prompts }, null, 2), 'utf8');
}

function savePrompt(prompt, metadata = {}) {
  const prompts = loadPrompts();
  const entry = {
    id: prompt.id || `prompt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    prompt: prompt.prompt || '',
    aiGenerated: !!prompt.aiGenerated,
    timestamp: prompt.timestamp || new Date().toISOString(),
    parameters: prompt.parameters || {},
    meta: metadata.meta || {},
    status: metadata.status || 'new',
    parentPromptId: prompt.parentPromptId || null,
    iterations: prompt.iterations || 1
  };
  prompts.push(entry);
  saveAll(prompts);
  return entry;
}

function getRecentPrompts(limit = 5) {
  const prompts = loadPrompts();
  return prompts.slice(-limit);
}

function getUnusedVariations() {
  const prompts = loadPrompts();
  return prompts.filter((p) => p.status !== 'used');
}

function markPromptUsed(promptId, metadata = {}) {
  const prompts = loadPrompts();
  const idx = prompts.findIndex((p) => p.id === promptId);
  if (idx === -1) return null;
  prompts[idx].status = 'used';
  prompts[idx].convertedToVideo = metadata;
  saveAll(prompts);
  return prompts[idx];
}

module.exports = {
  PROMPTS_FILE,
  loadPrompts,
  savePrompt,
  getRecentPrompts,
  getUnusedVariations,
  markPromptUsed
};


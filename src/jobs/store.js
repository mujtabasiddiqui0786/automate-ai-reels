/**
 * File-based job store for tracking long-running operations.
 * Jobs are stored as JSON files in the project-level jobs/ directory.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const JOBS_DIR = path.join(process.cwd(), 'jobs');

/**
 * Ensure the jobs directory exists.
 */
function ensureJobsDir() {
  if (!fs.existsSync(JOBS_DIR)) {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
  }
}

/**
 * Generate a job ID using timestamp + random bytes.
 * @returns {string}
 */
function generateJobId() {
  const ts = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(3).toString('hex');
  return `${ts}-${rand}`;
}

/**
 * Read a job file by ID.
 * @param {string} id
 * @returns {object|null}
 */
function readJob(id) {
  ensureJobsDir();
  const filePath = path.join(JOBS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read job file:', err.message);
    return null;
  }
}

/**
 * Write a job file to disk.
 * @param {object} job
 */
function writeJob(job) {
  ensureJobsDir();
  const filePath = path.join(JOBS_DIR, `${job.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2), 'utf8');
}

/**
 * Create a new job with initial status.
 * @param {'generate'|'upload'|'pipeline'} type
 * @param {object} input
 * @returns {object} job
 */
function createJob(type, input = {}) {
  ensureJobsDir();
  const now = new Date().toISOString();
  const job = {
    id: generateJobId(),
    type,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    input,
    steps: []
  };
  writeJob(job);
  return job;
}

/**
 * Update job status and patch fields.
 * @param {string} id
 * @param {object} patch
 * @returns {object|null} updated job or null if missing
 */
function updateJobStatus(id, patch = {}) {
  const job = readJob(id);
  if (!job) return null;
  const now = new Date().toISOString();
  const merged = {
    ...job,
    ...patch,
    updatedAt: now
  };
  // If steps provided, replace; otherwise keep existing.
  if (patch.steps) {
    merged.steps = patch.steps;
  }
  writeJob(merged);
  return merged;
}

/**
 * Append or update a job step by name.
 * @param {string} id
 * @param {object} stepPatch - {name, status, startedAt, finishedAt, error}
 * @returns {object|null} updated job or null if missing
 */
function appendJobStep(id, stepPatch = {}) {
  if (!stepPatch.name) {
    throw new Error('stepPatch.name is required');
  }
  const job = readJob(id);
  if (!job) return null;
  const now = new Date().toISOString();
  const steps = Array.isArray(job.steps) ? job.steps.slice() : [];
  const existingIndex = steps.findIndex((s) => s.name === stepPatch.name);

  if (existingIndex >= 0) {
    const existing = steps[existingIndex];
    steps[existingIndex] = {
      ...existing,
      ...stepPatch,
      updatedAt: now,
      startedAt: stepPatch.startedAt || existing.startedAt || now,
      finishedAt: stepPatch.finishedAt || existing.finishedAt
    };
  } else {
    steps.push({
      name: stepPatch.name,
      status: stepPatch.status || 'pending',
      startedAt: stepPatch.startedAt || now,
      finishedAt: stepPatch.finishedAt,
      error: stepPatch.error
    });
  }

  job.steps = steps;
  job.updatedAt = now;
  writeJob(job);
  return job;
}

/**
 * Get a job by ID.
 * @param {string} id
 * @returns {object|null}
 */
function getJob(id) {
  return readJob(id);
}

module.exports = {
  createJob,
  updateJobStatus,
  appendJobStep,
  getJob,
  JOBS_DIR
};


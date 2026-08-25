const crypto = require('crypto');
const { classifyTask } = require('./aiService');

const jobsMap = new Map();
const idempotencyMap = new Map();
const jobQueue = [];
let isWorkerRunning = false;

const MAX_JOB_RETRIES = 3;

/**
 * Enqueue a slow AI task classification job
 */
function enqueueJob(payload, options = {}) {
  const { text, forceMock } = payload || {};
  const idempotencyKey = options.idempotencyKey || null;

  // 1. Idempotency Check
  if (idempotencyKey && idempotencyMap.has(idempotencyKey)) {
    const existingJobId = idempotencyMap.get(idempotencyKey);
    const existingJob = jobsMap.get(existingJobId);
    if (existingJob) {
      return { job: existingJob, isDuplicate: true };
    }
  }

  // 2. Generate unique Job ID
  const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const job = {
    jobId,
    type: 'AI_TASK_CLASSIFICATION',
    payload: { text, forceMock },
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    attempts: 0,
    maxAttempts: MAX_JOB_RETRIES,
    result: null,
    error: null,
    idempotencyKey,
    statusUrl: `/jobs/${jobId}`,
  };

  jobsMap.set(jobId, job);
  if (idempotencyKey) {
    idempotencyMap.set(idempotencyKey, jobId);
  }

  jobQueue.push(jobId);

  // Trigger worker asynchronously on next event loop tick
  setImmediate(processQueue);

  return { job, isDuplicate: false };
}

/**
 * Background worker processing loop
 */
async function processQueue() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  while (jobQueue.length > 0) {
    const jobId = jobQueue.shift();
    const job = jobsMap.get(jobId);
    if (!job) continue;

    job.status = 'processing';
    if (!job.startedAt) job.startedAt = new Date().toISOString();
    job.attempts++;

    try {
      if (!job.payload || !job.payload.text || typeof job.payload.text !== 'string' || job.payload.text.trim() === '') {
        throw new Error('Input text is required');
      }

      const classificationResult = await classifyTask(job.payload.text, { forceMock: job.payload.forceMock ?? true });
      
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = classificationResult;
      job.error = null;
    } catch (err) {
      const isPermanentError = err.message === 'Input text is required';

      if (!isPermanentError && job.attempts < job.maxAttempts) {
        console.warn(`[Worker] Job ${jobId} failed attempt ${job.attempts}. Retrying with exponential backoff...`);
        await new Promise((r) => setTimeout(r, Math.pow(2, job.attempts) * 100));
        jobQueue.push(jobId);
      } else {
        console.error(`[Worker Alert] Job ${jobId} permanently failed: ${err.message}`);
        job.status = 'failed';
        job.completedAt = new Date().toISOString();
        job.error = err.message;
      }
    }
  }

  isWorkerRunning = false;
}

function getJob(jobId) {
  return jobsMap.get(jobId) || null;
}

function getAllJobs() {
  return Array.from(jobsMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  enqueueJob,
  getJob,
  getAllJobs,
  processQueue,
};

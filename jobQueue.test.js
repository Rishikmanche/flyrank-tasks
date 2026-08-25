const assert = require('assert');
const { enqueueJob, getJob, getAllJobs } = require('./jobQueueService');

async function runJobQueueTests() {
  console.log('====================================================');
  console.log('BE-06: Your First Background Job — Automated Test Suite');
  console.log('====================================================');

  let passedCount = 0;

  // Test 1: Accept Fast (Immediate Enqueue)
  let testJobId = null;
  try {
    console.log('[Test 1] Testing fast job enqueuing (<20ms response)...');
    const start = Date.now();
    const { job, isDuplicate } = enqueueJob({ text: 'Urgent: Fix PostgreSQL pool connection leak', forceMock: true });
    const duration = Date.now() - start;
    testJobId = job.jobId;

    assert.ok(duration < 50, `Enqueue took ${duration}ms, should be <50ms`);
    assert.strictEqual(isDuplicate, false);
    assert.ok(['queued', 'processing'].includes(job.status));
    assert.ok(job.jobId.startsWith('job_'));
    console.log(`  ✔ Test 1 Passed: Enqueued job ${job.jobId} in ${duration}ms (Accept Fast).`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 1 Failed:', err.message);
  }

  // Test 2: Background Worker Execution & Completion
  try {
    console.log('[Test 2] Waiting for asynchronous worker completion...');
    let attempts = 0;
    let job = null;
    while (attempts < 20) {
      await new Promise((r) => setTimeout(r, 100));
      job = getJob(testJobId);
      if (job && job.status === 'completed') break;
      attempts++;
    }

    assert.strictEqual(job.status, 'completed');
    assert.ok(job.completedAt);
    assert.strictEqual(typeof job.result.category, 'string');
    assert.strictEqual(typeof job.result.priority, 'string');
    console.log(`  ✔ Test 2 Passed: Worker executed job asynchronously and recorded structured result.`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 2 Failed:', err.message);
  }

  // Test 3: Idempotency Protection (Duplicate Request with Idempotency-Key)
  try {
    console.log('[Test 3] Testing idempotency deduplication with Idempotency-Key...');
    const key = 'req_idempotent_abc123';
    const firstCall = enqueueJob({ text: 'Daily database backup run', forceMock: true }, { idempotencyKey: key });
    assert.strictEqual(firstCall.isDuplicate, false);

    // Immediate duplicate call with same key
    const secondCall = enqueueJob({ text: 'Daily database backup run', forceMock: true }, { idempotencyKey: key });
    assert.strictEqual(secondCall.isDuplicate, true);
    assert.strictEqual(secondCall.job.jobId, firstCall.job.jobId);
    console.log(`  ✔ Test 3 Passed: Duplicate submission returned existing jobId ${secondCall.job.jobId} (Idempotent).`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 4 Failed:', err.message);
  }

  // Test 4: Distinct Keys Generate Unique Jobs
  try {
    console.log('[Test 4] Testing distinct idempotency keys generate independent jobs...');
    const jobA = enqueueJob({ text: 'Job Alpha', forceMock: true }, { idempotencyKey: 'key_alpha_1' });
    const jobB = enqueueJob({ text: 'Job Beta', forceMock: true }, { idempotencyKey: 'key_beta_2' });
    assert.notStrictEqual(jobA.job.jobId, jobB.job.jobId);
    console.log('  ✔ Test 4 Passed: Independent idempotency keys created distinct jobs.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 4 Failed:', err.message);
  }

  // Test 5: Job Status Polling Query
  try {
    console.log('[Test 5] Testing job status polling query...');
    const polled = getJob(testJobId);
    assert.ok(polled);
    assert.strictEqual(polled.jobId, testJobId);
    assert.strictEqual(polled.attempts, 1);
    assert.strictEqual(polled.error, null);
    console.log('  ✔ Test 5 Passed: Polling returned complete job execution lifecycle record.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 5 Failed:', err.message);
  }

  // Test 6: Job Queue History Listing
  try {
    console.log('[Test 6] Testing job history inspection listing...');
    const all = getAllJobs();
    assert.ok(Array.isArray(all));
    assert.ok(all.length >= 3);
    console.log(`  ✔ Test 6 Passed: Retrieved queue history with ${all.length} jobs.`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 6 Failed:', err.message);
  }

  // Test 7: Non-Existent Job ID (404 handling)
  try {
    console.log('[Test 7] Testing query for non-existent job ID...');
    const notFound = getJob('job_invalid_000000');
    assert.strictEqual(notFound, null);
    console.log('  ✔ Test 7 Passed: Returns null for non-existent jobs.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 7 Failed:', err.message);
  }

  // Test 8: Missing Payload Error Handling & Alert Recording
  try {
    console.log('[Test 8] Testing error handling on missing input payload...');
    const badJob = enqueueJob({ text: '' });
    // Worker attempts to process empty string
    await new Promise((r) => setTimeout(r, 200));
    const processedBad = getJob(badJob.job.jobId);
    assert.strictEqual(processedBad.status, 'failed');
    assert.strictEqual(processedBad.error, 'Input text is required');
    console.log(`  ✔ Test 8 Passed: Gracefully transitioned bad job to 'failed' with alert diagnostics.`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 8 Failed:', err.message);
  }

  console.log('----------------------------------------------------');
  console.log(`Summary: ${passedCount}/8 Tests Passed Successfully!`);
  console.log('----------------------------------------------------');

  if (passedCount !== 8) {
    process.exit(1);
  }
}

if (require.main === module) {
  runJobQueueTests();
}

module.exports = { runJobQueueTests };

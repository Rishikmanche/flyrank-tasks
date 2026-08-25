const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  aggregateReportData,
  createReportJob,
  getJob,
  getAllJobs,
  REPORTS_DIR,
} = require('./pdfReportService');

async function runPdfTests() {
  console.log('====================================================');
  console.log('BE-08: PDF Report Generator — Automated Test Suite');
  console.log('====================================================');

  let passedCount = 0;

  // Test 1: Data Aggregation
  try {
    console.log('[Test 1] Testing data aggregation logic...');
    const data = await aggregateReportData(null);
    assert.strictEqual(typeof data.total, 'number');
    assert.strictEqual(typeof data.completed, 'number');
    assert.strictEqual(typeof data.completionRate, 'number');
    assert.ok(data.tasks.length > 0);
    assert.ok(data.total >= data.completed);
    console.log(`  ✔ Test 1 Passed: Aggregated ${data.total} tasks (${data.completionRate}% completion rate).`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 1 Failed:', err.message);
  }

  // Test 2: Background Job Creation (Asynchronous enqueuing)
  let testJobId = null;
  try {
    console.log('[Test 2] Testing asynchronous background job enqueuing...');
    const job = createReportJob(null);
    testJobId = job.jobId;
    assert.ok(job.jobId.startsWith('rep_'));
    assert.strictEqual(job.status, 'queued');
    assert.ok(job.downloadUrl.includes(job.jobId));
    console.log(`  ✔ Test 2 Passed: Queued job ${job.jobId} instantly without blocking.`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 2 Failed:', err.message);
  }

  // Test 3: Background Worker Processing Completion
  try {
    console.log('[Test 3] Waiting for background PDF generation worker...');
    // Wait up to 2 seconds for worker completion
    let attempts = 0;
    let completedJob = null;
    while (attempts < 20) {
      await new Promise((r) => setTimeout(r, 100));
      completedJob = getJob(testJobId);
      if (completedJob && completedJob.status === 'completed') break;
      attempts++;
    }

    assert.strictEqual(completedJob.status, 'completed');
    assert.ok(completedJob.completedAt);
    assert.ok(completedJob.fileSize);
    console.log(`  ✔ Test 3 Passed: Background worker completed PDF generation (${completedJob.fileSize}).`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 3 Failed:', err.message);
  }

  // Test 4: PDF Artifact File Verification on Disk
  try {
    console.log('[Test 4] Verifying generated PDF artifact file on disk...');
    const job = getJob(testJobId);
    assert.ok(fs.existsSync(job.filePath));
    const stats = fs.statSync(job.filePath);
    assert.ok(stats.size > 1000, `PDF size ${stats.size} bytes should be > 1KB`);
    console.log(`  ✔ Test 4 Passed: PDF file exists at ${path.basename(job.filePath)} (${stats.size} bytes).`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 4 Failed:', err.message);
  }

  // Test 5: Magic Bytes Validation (%PDF-1.3 / %PDF-1.4)
  try {
    console.log('[Test 5] Checking PDF binary magic header bytes...');
    const job = getJob(testJobId);
    const buffer = fs.readFileSync(job.filePath);
    const header = buffer.toString('utf8', 0, 5);
    assert.strictEqual(header, '%PDF-', 'File must start with %PDF- magic bytes');
    console.log(`  ✔ Test 5 Passed: Valid PDF binary magic bytes verified (${header}).`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 5 Failed:', err.message);
  }

  // Test 6: Job Polling API Retrieval
  try {
    console.log('[Test 6] Testing job status polling query...');
    const polledJob = getJob(testJobId);
    assert.strictEqual(polledJob.jobId, testJobId);
    assert.strictEqual(polledJob.status, 'completed');
    assert.strictEqual(polledJob.error, null);
    console.log('  ✔ Test 6 Passed: Job status query returned complete metadata.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 6 Failed:', err.message);
  }

  // Test 7: Historical Report Jobs Listing
  try {
    console.log('[Test 7] Testing report job history listing...');
    const allJobs = getAllJobs();
    assert.ok(Array.isArray(allJobs));
    assert.ok(allJobs.length >= 1);
    assert.strictEqual(allJobs[0].jobId, testJobId);
    console.log(`  ✔ Test 7 Passed: Report history lists ${allJobs.length} job(s).`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 7 Failed:', err.message);
  }

  // Test 8: Non-Existent Job ID Handling (404 Not Found)
  try {
    console.log('[Test 8] Testing non-existent job ID rejection...');
    const nonExistent = getJob('rep_invalid_999999');
    assert.strictEqual(nonExistent, null);
    console.log('  ✔ Test 8 Passed: Non-existent job query returns null cleanly.');
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
  runPdfTests();
}

module.exports = { runPdfTests };

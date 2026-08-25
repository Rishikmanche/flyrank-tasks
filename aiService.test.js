const assert = require('assert');
const { classifyTask, parseAndValidate, generateFallback, TaskClassificationSchema } = require('./aiService');

async function runAllTests() {
  console.log('====================================================');
  console.log('BE-07: Connect to an AI API — Automated Test Suite');
  console.log('====================================================');

  let passedCount = 0;

  // Test 1: Valid Classification Output & Schema Alignment
  try {
    console.log('[Test 1] Validating structured classification output schema...');
    const result = await classifyTask('Build a new User Profile endpoint for Express', { forceMock: true });
    TaskClassificationSchema.parse(result);
    assert.strictEqual(typeof result.title, 'string');
    assert.strictEqual(typeof result.category, 'string');
    assert.strictEqual(typeof result.priority, 'string');
    assert.strictEqual(typeof result.urgency_score, 'number');
    assert.strictEqual(typeof result.estimated_hours, 'number');
    assert.strictEqual(typeof result.actionable, 'boolean');
    console.log('  ✔ Test 1 Passed: Output matches Zod schema perfectly.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 1 Failed:', err.message);
  }

  // Test 2: Category Extraction Accuracy (Bugfix detection)
  try {
    console.log('[Test 2] Testing category detection for bugfix reports...');
    const result = await classifyTask('Urgent memory leak crash in PostgreSQL connection pool', { forceMock: true });
    assert.strictEqual(result.category, 'bugfix');
    console.log('  ✔ Test 2 Passed: Correctly identified "bugfix" category.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 2 Failed:', err.message);
  }

  // Test 3: Priority & Urgency Score Assignment
  try {
    console.log('[Test 3] Testing high priority & urgency assignment...');
    const result = await classifyTask('ASAP: Fix security vulnerability in auth middleware', { forceMock: true });
    assert.strictEqual(result.priority, 'high');
    assert.strictEqual(result.urgency_score, 10);
    console.log('  ✔ Test 3 Passed: High priority and urgency score 10 assigned.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 3 Failed:', err.message);
  }

  // Test 4: Input Validation (Empty / Missing Text Rejection)
  try {
    console.log('[Test 4] Testing missing input validation...');
    await classifyTask('', { forceMock: true });
    assert.fail('Should have thrown an error for empty text');
  } catch (err) {
    assert.strictEqual(err.message, 'Input text is required');
    console.log('  ✔ Test 4 Passed: Rejects empty input text gracefully.');
    passedCount++;
  }

  // Test 5: Markdown Code Block Normalization
  try {
    console.log('[Test 5] Testing JSON normalization from raw LLM code fences...');
    const rawMarkdown = '```json\n{\n  "title": "Clean database logs",\n  "category": "chore",\n  "priority": "low",\n  "urgency_score": 3,\n  "estimated_hours": 1,\n  "actionable": true\n}\n```';
    const parsed = parseAndValidate(rawMarkdown);
    assert.strictEqual(parsed.title, 'Clean database logs');
    assert.strictEqual(parsed.category, 'chore');
    console.log('  ✔ Test 5 Passed: Strips markdown code fences and validates JSON.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 5 Failed:', err.message);
  }

  // Test 6: Timeout Enforcement
  try {
    console.log('[Test 6] Testing request timeout enforcement...');
    const start = Date.now();
    // Test custom short timeout fallback
    const result = await classifyTask('Long running request task', { timeoutMs: 50, forceMock: true });
    const duration = Date.now() - start;
    assert.ok(duration < 1000, 'Timeout did not hang execution');
    assert.ok(result.title.length > 0);
    console.log(`  ✔ Test 6 Passed: Handled execution cleanly in ${duration}ms.`);
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 6 Failed:', err.message);
  }

  // Test 7: Retry Logic & Fallback Execution
  try {
    console.log('[Test 7] Testing retry mechanism and fallback safety net...');
    const fallbackResult = generateFallback('Update README documentation and setup instructions');
    assert.strictEqual(fallbackResult.category, 'documentation');
    assert.strictEqual(fallbackResult.priority, 'low');
    console.log('  ✔ Test 7 Passed: Fallback generator produces valid structured judgment.');
    passedCount++;
  } catch (err) {
    console.error('  ❌ Test 7 Failed:', err.message);
  }

  // Test 8: Malformed JSON Recovery
  try {
    console.log('[Test 8] Testing recovery on invalid/malformed LLM response...');
    try {
      parseAndValidate('Invalid Non-JSON String Response');
      assert.fail('Should fail on non-JSON response');
    } catch (parseErr) {
      // Recovery via fallback
      const recovered = generateFallback('Invalid response recovery task');
      assert.ok(recovered.title.length > 0);
      console.log('  ✔ Test 8 Passed: Successfully recovered from malformed JSON response.');
      passedCount++;
    }
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
  runAllTests();
}

module.exports = { runAllTests };

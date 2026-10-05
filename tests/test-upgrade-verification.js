/**
 * Complete Upgrade Verification Test Suite
 * Tests SSRF protection, profile verification, duplicate prevention,
 * sync diff calculation, admin global search, and AI Agent action cards.
 */

const assert = require('assert');
const linkVerifierService = require('../src/domains/social-profiles/services/linkVerifierService');
const socialProfileService = require('../src/domains/social-profiles/services/socialProfileService');
const multiPlatformSyncService = require('../src/domains/social-profiles/services/multiPlatformSyncService');
const adminSearchService = require('../src/domains/admin/services/adminSearchService');
const aiAgentService = require('../src/domains/ai/services/aiAgentService');

async function runTests() {
  console.log('\n======================================================');
  console.log(' RUNNING COMPLETE UPGRADE VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // 1. SSRF Protection Tests
  console.log('1. SSRF Security & Protection Tests:');

  await test('SSRF: Blocks localhost and 127.0.0.1 requests', async () => {
    const resLocalhost = await linkVerifierService.verify('http://localhost:3000/admin', 'Custom');
    assert.strictEqual(resLocalhost.status, 'NOT_VERIFIED');
    assert.strictEqual(resLocalhost.isSsrfBlocked, true);

    const resLoopback = await linkVerifierService.verify('http://127.0.0.1:8080', 'Custom');
    assert.strictEqual(resLoopback.status, 'NOT_VERIFIED');
    assert.strictEqual(resLoopback.isSsrfBlocked, true);
  });

  await test('SSRF: Blocks cloud metadata IP (169.254.169.254)', async () => {
    const resMetadata = await linkVerifierService.verify('http://169.254.169.254/latest/meta-data/', 'Custom');
    assert.strictEqual(resMetadata.status, 'NOT_VERIFIED');
    assert.strictEqual(resMetadata.isSsrfBlocked, true);
  });

  await test('SSRF: Blocks private RFC 1918 IP addresses (10.0.0.1, 192.168.1.1)', async () => {
    const resPrivate10 = await linkVerifierService.verify('http://10.0.0.1:8080/internal', 'Custom');
    assert.strictEqual(resPrivate10.status, 'NOT_VERIFIED');
    assert.strictEqual(resPrivate10.isSsrfBlocked, true);

    const resPrivate192 = await linkVerifierService.verify('http://192.168.1.1/router', 'Custom');
    assert.strictEqual(resPrivate192.status, 'NOT_VERIFIED');
    assert.strictEqual(resPrivate192.isSsrfBlocked, true);
  });

  // 2. Duplicate Profile Prevention Tests
  console.log('\n2. Duplicate Profile Prevention Tests:');

  await test('Social Profiles: Normalizes profile URLs correctly', () => {
    const norm1 = socialProfileService.normalizeProfileUrl('https://www.github.com/harsha895155/');
    const norm2 = socialProfileService.normalizeProfileUrl('http://github.com/harsha895155');
    assert.strictEqual(norm1, 'https://github.com/harsha895155');
    assert.strictEqual(norm2, 'https://github.com/harsha895155');
  });

  await test('Social Profiles: Rejects duplicate platform URL additions', async () => {
    let duplicateCaught = false;
    try {
      await socialProfileService.addPlatform({
        name: 'GitHub',
        platform: 'GitHub',
        url: 'https://github.com/harsha895155',
        username: 'harsha895155'
      });
    } catch (err) {
      if (err.message.includes('already connected') || err.message.includes('Duplicate') || err.message.includes('already exists')) {
        duplicateCaught = true;
      }
    }
    assert.ok(duplicateCaught, 'Expected duplicate error when adding already configured GitHub profile');
  });

  // 3. Multi-Platform Sync Service & Diff Computation Tests
  console.log('\n3. Multi-Platform Sync & Diff Computation Tests:');

  await test('Sync Engine: Computes Added, Changed, Removed, and Unchanged fields', () => {
    const oldData = {
      problemsSolved: 300,
      ranking: 'Top 25%',
      deprecatedField: 'oldVal',
      retainedField: 'same'
    };

    const newData = {
      problemsSolved: 350,
      ranking: 'Top 18%',
      retainedField: 'same',
      newBadge: '50-Day Streak'
    };

    const diff = multiPlatformSyncService.computeDiff(oldData, newData);
    assert.ok(diff.hasChanges, 'Expected diff to flag changes');
    assert.strictEqual(diff.added.length, 1);
    assert.strictEqual(diff.added[0].field, 'newBadge');
    assert.strictEqual(diff.changed.length, 2);
    assert.strictEqual(diff.removed.length, 1);
    assert.strictEqual(diff.removed[0].field, 'deprecatedField');
    assert.strictEqual(diff.unchanged.length, 1);
    assert.strictEqual(diff.unchanged[0].field, 'retainedField');
  });

  // 4. Admin Global Search Service Tests
  console.log('\n4. Admin Global Search Service Tests:');

  await test('Admin Search: Finds profiles, projects, certificates, and skills by keyword', () => {
    const resultsGitHub = adminSearchService.search('GitHub');
    assert.ok(resultsGitHub.totalMatches > 0, 'Expected to find GitHub entries');
    assert.ok(resultsGitHub.categories['External Profiles'].length > 0, 'Expected External Profiles category matches');

    const resultsPython = adminSearchService.search('Python');
    assert.ok(resultsPython.totalMatches > 0, 'Expected to find Python in skills or projects');

    const resultsNLP = adminSearchService.search('Natural Language Processing');
    assert.ok(resultsNLP.totalMatches > 0, 'Expected to find NLP certification or skills');
  });

  // 5. AI Agent Natural Language Commands & Action Cards Tests
  console.log('\n5. AI Agent Natural Language & Action Card Tests:');

  await test('AI Agent: Handles "How many problems have I solved?" with verified breakdown', async () => {
    const res = await aiAgentService.processUserMessage({ message: 'How many problems have I solved?' });
    assert.ok(res.reply.includes('problems') && (res.reply.includes('350') || res.reply.includes('37') || res.reply.includes('solved')), 'Expected response to mention problems solved');
    assert.ok(res.reply.includes('Easy') && res.reply.includes('Medium') && res.reply.includes('Hard'), 'Expected difficulty breakdown');
  });

  await test('AI Agent: Handles "Verify my LeetCode profile" and returns structured actionCard', async () => {
    const res = await aiAgentService.processUserMessage({ message: 'Verify my LeetCode profile' });
    assert.ok(res.actionCard, 'Expected actionCard in response');
    assert.strictEqual(res.actionCard.type, 'profile_verification');
    assert.ok(res.actionCard.actions.length > 0, 'Expected interactive actions in card');
  });

  await test('AI Agent: Handles "Check my GitHub changes" and returns repository sync actionCard', async () => {
    const res = await aiAgentService.processUserMessage({ message: 'Check my GitHub changes' });
    assert.ok(res.actionCard, 'Expected actionCard in response');
    assert.strictEqual(res.actionCard.type, 'github_sync');
    assert.ok(res.reply.includes('GitHub Synchronization Complete'));
  });

  console.log('\n======================================================');
  console.log(` UPGRADE TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

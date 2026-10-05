/**
 * Test Suite for Private Portfolio Management System
 * Validates authentication, database, document extraction, approval workflow,
 * publishing, rollback, and API security.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../src/infrastructure/database/db');
const authService = require('../src/domains/authentication/services/authService');
const documentExtractor = require('../src/domains/documents/processors/documentExtractor');
const diffEngine = require('../src/domains/documents/processors/diffEngine');
const approvalService = require('../src/domains/admin/services/approvalService');
const profileService = require('../src/domains/profile/services/profileService');
const githubSyncService = require('../src/domains/social-profiles/services/githubSyncService');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(`    Error: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(`    Error: ${err.message}`);
    failedTests++;
  }
}

async function main() {
  console.log('\n==================================================');
  console.log(' RUNNING PRIVATE PORTFOLIO MANAGEMENT TEST SUITE');
  console.log('==================================================\n');

  console.log('1. Database & Schema Tests:');
  runTest('Database initializes and collections exist', () => {
    assert(db.get('admin'), 'admin collection exists');
    assert(db.get('published'), 'published collection exists');
    assert(db.get('draft'), 'draft collection exists');
    assert(Array.isArray(db.get('pendingChanges')), 'pendingChanges is array');
    assert(Array.isArray(db.get('documents')), 'documents is array');
  });

  runTest('Published profile has candidate name', () => {
    const pub = db.get('published');
    assert(pub.name.includes('Harshavardhan Reddy'), 'Candidate name matches');
    assert(pub.projects.length >= 4, 'Projects are populated');
    assert(pub.certifications.length >= 10, 'Certifications are populated');
  });

  console.log('\n2. Authentication & Security Tests:');
  await runAsyncTest('Login with correct credentials succeeds', async () => {
    const user = await authService.verifyCredentials('admin', config.auth.adminPassword);
    assert(user !== null, 'User should be authenticated');
    assert.strictEqual(user.username, 'admin');

    const token = authService.generateToken(user);
    assert(token && token.length > 20, 'JWT token generated');

    const decoded = authService.verifyToken(token);
    assert(decoded && decoded.username === 'admin', 'JWT token decoded successfully');
  });

  await runAsyncTest('Login with invalid credentials returns null', async () => {
    const user = await authService.verifyCredentials('admin', 'wrong_password_xyz');
    assert.strictEqual(user, null, 'Invalid password must return null');
  });

  runTest('Invalid or forged JWT token is rejected', () => {
    const decoded = authService.verifyToken('invalid.token.here');
    assert.strictEqual(decoded, null, 'Forged token must return null');
  });

  console.log('\n3. Document Text Extraction & Diff Engine:');
  await runAsyncTest('Extracts information from existing PDF certificate', async () => {
    const samplePdf = fs.existsSync(path.resolve(__dirname, '../storage/media/NOC26CS45S145150024704536444.pdf'))
      ? path.resolve(__dirname, '../storage/media/NOC26CS45S145150024704536444.pdf')
      : path.resolve(__dirname, '../NOC26CS45S145150024704536444.pdf');
    if (fs.existsSync(samplePdf)) {
      const result = await documentExtractor.extract(samplePdf, '.pdf');
      assert.strictEqual(result.success, true, 'Extraction succeeds');
      assert(result.extracted, 'Entities extracted');
      assert(result.extracted.detectedSkills.length > 0 || result.docType === 'Certification', 'Skills or cert detected');
    } else {
      console.log('    (Sample PDF NOC26CS45S145150024704536444.pdf not present, skipping physical PDF test)');
    }
  });

  runTest('Diff engine detects new skills not in current profile', () => {
    const currentProfile = {
      skills: [
        { category: 'Languages', items: ['Java', 'Python'] }
      ]
    };
    const extractedData = {
      docType: 'Resume',
      extracted: {
        detectedSkills: ['Java', 'Python', 'Rust', 'Docker', 'Kubernetes']
      }
    };
    const docRecord = { id: 'doc_1', originalName: 'TestResume.pdf' };
    const diffs = diffEngine.compareDocumentToProfile(extractedData, currentProfile, docRecord);
    assert(diffs.length > 0, 'New skills detected');
    assert(diffs[0].meta.newSkills.includes('Rust'), 'Rust identified as new');
    assert(diffs[0].meta.newSkills.includes('Docker'), 'Docker identified as new');
  });

  runTest('Diff engine detects new GitHub repository', () => {
    const currentProfile = {
      projects: [
        { title: 'AirGuard', github: 'https://github.com/harsha895155/AirGuard' }
      ]
    };
    const repo = {
      name: 'CloudShield',
      description: 'Distributed network firewall system',
      language: 'Go',
      html_url: 'https://github.com/harsha895155/CloudShield',
      stargazers_count: 12
    };
    const diff = diffEngine.compareGitHubRepo(repo, currentProfile);
    assert(diff !== null, 'New repository detected');
    assert.strictEqual(diff.meta.title, 'CloudShield');
  });

  console.log('\n4. Review & Approval Workflow Tests:');
  runTest('Pending change can be created and approved', () => {
    const change = db.addPendingChange({
      category: 'Skills',
      field: 'skills',
      label: 'New Skill Detected',
      oldValue: 'None',
      detectedValue: 'TypeScript',
      source: 'Test Doc',
      meta: { newSkills: ['TypeScript'] }
    });

    assert(change.id, 'Change has ID');
    assert.strictEqual(change.status, 'pending');

    const result = approvalService.approveChange(change.id, null, 'admin_test');
    assert.strictEqual(result.success, true);

    const draft = db.get('draft');
    const skillsList = draft.skills.flatMap(g => g.items || []);
    assert(skillsList.includes('TypeScript'), 'TypeScript was merged into draft skills');
  });

  runTest('Pending change can be rejected', () => {
    const change = db.addPendingChange({
      category: 'Skills',
      field: 'skills',
      label: 'Irrelevant Skill',
      oldValue: 'None',
      detectedValue: 'Fortran',
      source: 'Test Doc'
    });

    const result = approvalService.rejectChange(change.id, 'Not relevant', 'admin_test');
    assert.strictEqual(result.success, true);

    const allChanges = db.getAllChanges();
    const updated = allChanges.find(c => c.id === change.id);
    assert.strictEqual(updated.status, 'rejected');
  });

  console.log('\n5. Publishing, Snapshots & Rollback Tests:');
  runTest('Publishing draft creates snapshot and updates profile.js', () => {
    const pubResult = profileService.publishDraft('admin_test');
    assert(pubResult.snapshotName, 'Snapshot was created');
    assert(fs.existsSync(config.paths.profileJs), 'profile.js exists');

    const profileJsContent = fs.readFileSync(config.paths.profileJs, 'utf-8');
    assert(profileJsContent.includes('const PROFILE ='), 'profile.js has PROFILE constant');

    // Test rollback
    const rollbackResult = profileService.rollback(pubResult.snapshotName, 'admin_test');
    assert(rollbackResult.name, 'Rollback restored profile');
  });

  console.log('\n==================================================');
  console.log(` TEST SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log('==================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error', err);
  process.exit(1);
});

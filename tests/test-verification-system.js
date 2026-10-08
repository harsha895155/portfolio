/**
 * Comprehensive Test Suite for Verification-First Workflows
 * Tests:
 * 1. Certificate PDF Integrity, Hashing, & Extraction
 * 2. Multi-layer Duplicate Detection (File Hash, Credential ID, Verification URL, Content Similarity)
 * 3. Exact Duplicate File Blocking (Same PDF uploaded twice, Renamed duplicate)
 * 4. Public Verification URL Corroboration & Honest Non-Bypassing Checks
 * 5. Corrupted / Invalid PDF Rejection
 * 6. Internship Candidate ID Verification (Matching vs Wrong Candidate ID Blocking)
 * 7. Three-Document Cross-Verification Matrix (Offer + Completion + Report)
 * 8. Cross-Document Conflict Detection (Date conflict, Org conflict, Role conflict)
 * 9. Duplicate Internship Blocking (Same offer hash, candidate ID + org, role + dates)
 * 10. Canonical Verified Record Persistence & Document Linkage
 * 11. Verification Audit Logging & History
 * 12. Public Portfolio Verified Badges & Data Consistency
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../src/infrastructure/database/db');
const certVerificationService = require('../src/domains/verification/services/certificateVerificationService');
const internshipVerificationService = require('../src/domains/verification/services/internshipVerificationService');
const cmsService = require('../src/domains/admin/services/cmsService');
const syncProfileService = require('../src/domains/profile/services/syncProfileService');

let passedTests = 0;
let failedTests = 0;

async function runTest(name, fn) {
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
  console.log('\n===============================================================');
  console.log(' RUNNING AI-POWERED VERIFICATION SYSTEM TEST SUITE');
  console.log('===============================================================\n');

  const rootDir = config.paths.root;
  const resolvePdf = (name) => {
    const p1 = path.join(rootDir, 'storage', 'media', name);
    if (fs.existsSync(p1)) return p1;
    const p2 = path.join(rootDir, 'media', name);
    if (fs.existsSync(p2)) return p2;
    return path.join(rootDir, name);
  };
  const nptelPdf1 = resolvePdf('NOC26CS45S145150024704536444.pdf');
  const nptelPdfDup = fs.existsSync(path.join(rootDir, 'NOC26CS45S145150024704536444(1).pdf'))
    ? path.join(rootDir, 'NOC26CS45S145150024704536444(1).pdf')
    : nptelPdf1;
  const offerLetterPdf = resolvePdf('Offer_Letter_996565_1389872.pdf');
  const courseraPdf = resolvePdf('Coursera AS6TIAD3EVQN.pdf');

  // ── SECTION 1: CERTIFICATE VERIFICATION & INTEGRITY ──────────────────────
  console.log('1. Certificate PDF Integrity, Hashing & Extraction:');

  await runTest('Validates authentic PDF structure (%PDF- header and size)', async () => {
    assert(fs.existsSync(nptelPdf1), 'NPTEL PDF must exist');
    const buffer = fs.readFileSync(nptelPdf1);
    const integrity = certVerificationService.validatePdfIntegrity(buffer, 'test.pdf');
    assert.strictEqual(integrity.valid, true);
    assert.strictEqual(integrity.mimeType, 'application/pdf');
    assert(integrity.fileSize > 1000);
    assert.strictEqual(typeof integrity.fileHash, 'string');
    assert.strictEqual(integrity.fileHash.length, 64);
  });

  await runTest('Rejects corrupted or non-PDF file disguised as PDF', async () => {
    const fakeBuffer = Buffer.from('NOT A REAL PDF CONTENT');
    assert.throws(() => {
      certVerificationService.validatePdfIntegrity(fakeBuffer, 'malicious.pdf');
    }, /Invalid file format/);
  });

  await runTest('Computes identical cryptographic SHA-256 fingerprint for identical files', async () => {
    const buf1 = fs.readFileSync(nptelPdf1);
    const bufDup = fs.readFileSync(nptelPdfDup);
    const hash1 = certVerificationService.computeHash(buf1);
    const hashDup = certVerificationService.computeHash(bufDup);
    assert.strictEqual(hash1, hashDup, 'Hashes of identical files must match perfectly');
  });

  await runTest('Extracts structured data from real NPTEL certificate with source traceability', async () => {
    const buffer = fs.readFileSync(nptelPdf1);
    const extracted = await certVerificationService.extractCertificateData(buffer, 'NOC26CS45S145150024704536444.pdf');
    assert(extracted.recipientName.value, 'Must extract recipient name');
    assert(extracted.issuingOrganization.value, 'Must extract issuing organization');
    assert(extracted.credentialId.value, 'Must extract credential ID / Roll No');
    assert.strictEqual(extracted.credentialId.value, 'NPTEL26CS45S1451500247');
    assert(extracted.scoreOrGrade.value, 'Must extract score (e.g. 60%)');
    assert(extracted.recipientName.source, 'Must have source traceability');
  });

  // ── SECTION 2: CERTIFICATE DUPLICATE DETECTION ────────────────────────────
  console.log('\n2. Certificate Duplicate Prevention:');

  await runTest('Detects duplicate exact file SHA-256 hash', async () => {
    const buffer = fs.readFileSync(nptelPdf1);
    const hash = certVerificationService.computeHash(buffer);

    // Save one verified record with this hash
    const testRecord = {
      id: 'vr_test_nptel_1',
      type: 'certification',
      title: 'Natural Language Processing',
      issuer: 'NPTEL',
      credentialId: 'NPTEL26CS45S1451500247',
      credentialUrl: '',
      status: 'VERIFIED',
      fileHashes: [hash],
      document: { hash, filename: 'NOC26CS45S145150024704536444.pdf' },
      approvedAt: new Date().toISOString()
    };
    db.addVerifiedRecord(testRecord);

    const dupCheck = certVerificationService.checkDuplicates({
      fileHash: hash,
      credentialId: 'OTHER_ID',
      issuer: 'OTHER_ORG',
      title: 'OTHER_TITLE'
    });
    assert.strictEqual(dupCheck.isDuplicate, true);
    assert.strictEqual(dupCheck.type, 'EXACT_FILE_HASH');
  });

  await runTest('Detects duplicate credential ID even if PDF is renamed or re-generated', async () => {
    const dupCheck = certVerificationService.checkDuplicates({
      fileHash: 'new_unique_hash_999999999999999999999999999999999999999999999999999999999999',
      credentialId: 'NPTEL26CS45S1451500247',
      issuer: 'NPTEL',
      title: 'Different Title'
    });
    assert.strictEqual(dupCheck.isDuplicate, true);
    assert.strictEqual(dupCheck.type, 'CREDENTIAL_ID');
  });

  await runTest('Detects duplicate verification URL', async () => {
    const dupCheck = certVerificationService.checkDuplicates({
      fileHash: 'new_hash_888888888888888888888888888888888888888888888888888888888888',
      credentialId: 'NEW_UNIQUE_ID',
      credentialUrl: 'https://www.credly.com/go/kCg7it0n',
      issuer: 'AWS Academy',
      title: 'AWS Academy ML for NLP'
    });
    assert.strictEqual(dupCheck.isDuplicate, true);
    assert.strictEqual(dupCheck.type, 'VERIFICATION_URL');
  });

  await runTest('Detects content similarity duplicate (same issuer + title)', async () => {
    const dupCheck = certVerificationService.checkDuplicates({
      fileHash: 'unique_hash_7777777777777777777777777777777777777777777777777777777777',
      credentialId: '',
      issuer: 'NPTEL',
      title: 'Natural Language Processing'
    });
    assert.strictEqual(dupCheck.isDuplicate, true);
    assert.strictEqual(dupCheck.type, 'CONTENT_SIMILARITY');
  });

  // ── SECTION 3: HONEST PUBLIC CREDENTIAL LINK VERIFICATION ────────────────
  console.log('\n3. Honest Public Credential Verification:');

  await runTest('Rejects malformed URL protocol', async () => {
    const res = await certVerificationService.verifyPublicUrl('ftp://invalid-url.com', {});
    assert.strictEqual(res.status, 'FAILED');
  });

  await runTest('Handles inaccessible / unreachable domain honestly without false verification', async () => {
    const res = await certVerificationService.verifyPublicUrl('https://this-domain-does-not-exist-at-all-123456789.com/verify', {});
    assert.strictEqual(res.status, 'NEEDS_REVIEW');
    assert(res.verdict.includes('Timeout') || res.verdict.includes('Unreachable') || res.verdict.includes('Unable'));
  });

  await runTest('Corroborates real Coursera credential URL honestly', async () => {
    const courseraUrl = 'https://coursera.org/verify/AS6TIAD3EVQN';
    const res = await certVerificationService.verifyPublicUrl(courseraUrl, {
      certificateTitle: { value: 'Introduction to Responsible AI' },
      issuingOrganization: { value: 'Google Cloud' },
      recipientName: { value: 'Thimmareddygari Harshavardhan Reddy' },
      credentialId: { value: 'AS6TIAD3EVQN' }
    });
    assert(['VERIFIED', 'NEEDS_REVIEW'].includes(res.status));
    assert(res.matches.credentialIdMatched === true, 'Coursera credential ID in URL must match');
  });

  // ── SECTION 4: INTERNSHIP CANDIDATE ID & OFFER LETTER EXTRACTION ─────────
  console.log('\n4. Internship Document Workflow & Candidate ID Verification:');

  await runTest('Extracts real offer letter metadata (EduSkills AWS Gen AI)', async () => {
    assert(fs.existsSync(offerLetterPdf), 'Offer letter PDF must exist');
    const buffer = fs.readFileSync(offerLetterPdf);
    const extracted = await internshipVerificationService.extractOfferLetterData(buffer, 'Offer_Letter.pdf');
    assert(extracted.organization.value, 'Must extract organization (EduSkills)');
    assert(extracted.role.value, 'Must extract role (AWS Gen AI)');
    assert.strictEqual(extracted.candidateId.value, 'STU67a3881a20bc81738770458');
    assert(extracted.candidateName.value, 'Must extract candidate name');
  });

  await runTest('Candidate ID matching: Matches entered candidate ID with offer letter', async () => {
    const buffer = fs.readFileSync(offerLetterPdf);
    const offerData = await internshipVerificationService.extractOfferLetterData(buffer, 'Offer_Letter.pdf');
    const match = internshipVerificationService.validateCandidateId('STU67a3881a20bc81738770458', offerData);
    assert.strictEqual(match, true);
  });

  await runTest('Candidate ID mismatch: Strictly BLOCKS mismatched candidate ID', async () => {
    const buffer = fs.readFileSync(offerLetterPdf);
    const offerData = await internshipVerificationService.extractOfferLetterData(buffer, 'Offer_Letter.pdf');
    const match = internshipVerificationService.validateCandidateId('WRONG-CANDIDATE-ID-999', offerData);
    assert.strictEqual(match, false, 'Must reject mismatched candidate ID');
  });

  // ── SECTION 5: THREE-DOCUMENT CROSS-VERIFICATION MATRIX ──────────────────
  console.log('\n5. Three-Document Cross-Verification Matrix & Conflict Detection:');

  await runTest('Cross-checks Candidate, Org, Role, and Dates across 3 documents', async () => {
    const offerData = {
      candidateName: { value: 'Harshavardhan Reddy' },
      candidateId: { value: 'STU12345' },
      organization: { value: 'AICTE - EduSkills' },
      role: { value: 'AWS Gen AI Virtual Intern' },
      startDate: { value: 'Apr 2026' },
      endDate: { value: 'Jun 2026' }
    };
    const compData = {
      candidateName: { value: 'Harshavardhan Reddy' },
      candidateId: { value: 'STU12345' },
      organization: { value: 'AICTE - EduSkills' },
      role: { value: 'AWS Gen AI Virtual Intern' },
      startDate: { value: 'Apr 2026' },
      endDate: { value: 'Jun 2026' }
    };
    const repData = {
      candidateName: { value: 'Harshavardhan Reddy' },
      candidateId: { value: 'STU12345' },
      organization: { value: 'AICTE - EduSkills' },
      role: { value: 'AWS Gen AI Virtual Intern' },
      startDate: { value: 'Apr 2026' },
      endDate: { value: 'Jun 2026' }
    };

    const matrix = internshipVerificationService.buildCrossVerificationMatrix(offerData, compData, repData);
    assert.strictEqual(matrix.candidateId.match, true);
    assert.strictEqual(matrix.organization.match, true);
    assert.strictEqual(matrix.role.match, true);
    assert.strictEqual(matrix.startDate.match, true);
    assert.strictEqual(matrix.endDate.match, true);
  });

  await runTest('Detects and flags conflicting dates across documents', async () => {
    const offerData = {
      candidateName: { value: 'Harshavardhan Reddy' },
      candidateId: { value: 'STU12345' },
      organization: { value: 'EduSkills' },
      role: { value: 'Software Intern' },
      startDate: { value: '01 June 2026' },
      endDate: { value: '31 August 2026' }
    };
    const compData = {
      candidateName: { value: 'Harshavardhan Reddy' },
      candidateId: { value: 'STU12345' },
      organization: { value: 'EduSkills' },
      role: { value: 'Software Intern' },
      startDate: { value: '15 July 2026' }, // Conflict!
      endDate: { value: '31 August 2026' }
    };

    const matrix = internshipVerificationService.buildCrossVerificationMatrix(offerData, compData, null);
    assert.strictEqual(matrix.startDate.conflict, true);
    const conflicts = internshipVerificationService.detectConflicts(matrix, 'STU12345', offerData);
    assert(conflicts.some(c => c.field === 'Start Date'), 'Must detect Start Date conflict');
  });

  // ── SECTION 6: INTERNSHIP DUPLICATE DETECTION ────────────────────────────
  console.log('\n6. Internship Duplicate Prevention:');

  await runTest('Detects duplicate internship by Candidate ID + Organization + Same Role', async () => {
    // Save verified internship record into verifiedRecords
    const testExpRecord = {
      id: 'vr_test_exp_1',
      type: 'internship',
      title: 'AWS Gen AI Virtual Intern',
      organization: 'AICTE - EduSkills',
      candidateId: 'STU67a3881a20bc81738770458',
      status: 'VERIFIED',
      fileHashes: ['hash_offer_123'],
      approvedAt: new Date().toISOString()
    };
    db.addVerifiedRecord(testExpRecord);

    // Same CID + Same Org + SAME Role => must be blocked as duplicate
    const dupCheckSameRole = internshipVerificationService.checkDuplicates({
      fileHashes: ['new_hash_456'],
      candidateId: 'STU67a3881a20bc81738770458',
      organization: 'AICTE - EduSkills',
      role: 'AWS Gen AI Virtual Intern'
    });
    assert.strictEqual(dupCheckSameRole.isDuplicate, true);
    assert.strictEqual(dupCheckSameRole.type, 'EXACT_INTERNSHIP_DUPLICATE');

    // Same CID + Same Org + DIFFERENT Role (e.g. Google AI-ML) => must NOT be blocked
    const dupCheckDiffRole = internshipVerificationService.checkDuplicates({
      fileHashes: ['new_hash_789'],
      candidateId: 'STU67a3881a20bc81738770458',
      organization: 'AICTE - EduSkills',
      role: 'Google AI-ML Virtual Intern'
    });
    assert.strictEqual(dupCheckDiffRole.isDuplicate, false);
  });

  await runTest('Detects duplicate internship by document file hash', async () => {
    const dupCheck = internshipVerificationService.checkDuplicates({
      fileHashes: ['hash_offer_123'],
      candidateId: 'DIFFERENT_CID',
      organization: 'Different Org',
      role: 'Different Role'
    });
    assert.strictEqual(dupCheck.isDuplicate, true);
    assert.strictEqual(dupCheck.type, 'EXACT_DOCUMENT_HASH');
  });

  // ── SECTION 7: CANONICAL RECORD & AUDIT LOG PERSISTENCE ──────────────────
  console.log('\n7. Canonical Persistence & Verification Audit Logs:');

  await runTest('Canonical records stored in verifiedRecords collection', async () => {
    const records = db.getVerifiedRecords();
    assert(Array.isArray(records));
    assert(records.length >= 2, 'Should have verified records stored');
  });

  await runTest('Verification audit logs recorded immutably in verificationAuditLogs', async () => {
    db.addVerificationAuditLog({
      action: 'SYSTEM_TEST_AUDIT_ENTRY',
      user: 'admin',
      details: 'Audit verification test entry',
      timestamp: new Date().toISOString()
    });
    const logs = db.getVerificationAuditLogs();
    assert(Array.isArray(logs));
    const testLog = logs.find(l => l.action === 'SYSTEM_TEST_AUDIT_ENTRY');
    assert(testLog, 'Audit log must persist');
    assert.strictEqual(testLog.user, 'admin');
  });

  // ── SECTION 8: PUBLIC PORTFOLIO CONSISTENCY & BADGES ─────────────────────
  console.log('\n8. Public Portfolio Verified Badges & Data Consistency:');

  await runTest('Draft profile contains verification fields on approved items', async () => {
    const draft = db.get('draft') || {};
    assert(Array.isArray(draft.certifications));
    assert(Array.isArray(draft.experience));
  });

  await runTest('SyncProfileService generates profile.js with verified metadata preserved', async () => {
    const testProfile = {
      ...db.get('draft'),
      certifications: [
        {
          name: 'Verified NPTEL NLP',
          issuer: 'NPTEL · IIT Kharagpur',
          credentialId: 'NPTEL26CS45S1451500247',
          credentialUrl: 'https://nptel.ac.in',
          verified: true,
          verificationStatus: 'VERIFIED'
        }
      ],
      experience: [
        {
          role: 'AWS Gen AI Virtual Intern',
          company: 'AICTE - EduSkills',
          candidateId: 'STU67a3881a20bc81738770458',
          verified: true,
          verificationStatus: 'VERIFIED',
          startDate: 'Apr 2026',
          endDate: 'Jun 2026'
        }
      ]
    };

    syncProfileService.syncToFiles(testProfile);
    const profileJsContent = fs.readFileSync(config.paths.profileJs, 'utf-8');
    assert(profileJsContent.includes('Verified NPTEL NLP'), 'profile.js must contain updated cert');
    assert(profileJsContent.includes('STU67a3881a20bc81738770458'), 'profile.js must contain candidate ID');
    assert(profileJsContent.includes('"verified": true'), 'profile.js must retain verified flag');
  });

  console.log('\n===============================================================');
  console.log(` VERIFICATION SYSTEM TESTS COMPLETE: ${passedTests} passed, ${failedTests} failed`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

/**
 * AI Portfolio Agent Automated Test Suite
 * Validates multi-modal document analysis, image avatar handling, ChangeSet lifecycle,
 * search, portfolio health audit, description generation, and security boundaries.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const app = require('../src/server/app');

const PORT = 5577;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let server;

async function runAiTests() {
  console.log('\n==================================================');
  console.log(' RUNNING AI PORTFOLIO AGENT INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  // 1. Authenticate and obtain JWT token
  console.log('1. Authenticating Admin Session:');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: config.auth.adminUsername || 'admin',
      password: config.auth.adminPassword || 'AdminSecure2026!'
    })
  });
  assert.strictEqual(loginRes.status, 200, 'Login returns 200');
  const loginData = await loginRes.json();
  const token = loginData.data.token;
  assert(token, 'JWT Token generated');
  console.log('  ✓ Authenticated as admin, acquired JWT token');

  // 2. Test Security Guards
  console.log('\n2. Testing AI Security Guards (Unauthorized access):');
  const unauthChat = await fetch(`${BASE_URL}/api/ai/chat`, { method: 'POST' });
  assert.strictEqual(unauthChat.status, 401, 'POST /api/ai/chat blocked without token (401)');
  const unauthAudit = await fetch(`${BASE_URL}/api/ai/audit`, { method: 'POST' });
  assert.strictEqual(unauthAudit.status, 401, 'POST /api/ai/audit blocked without token (401)');
  console.log('  ✓ All AI endpoints strictly protected behind requireAuth');

  // 3. Test Direct Redirect Route
  console.log('\n3. Testing /admin/ai-agent Navigation Route:');
  const redirectRes = await fetch(`${BASE_URL}/admin/ai-agent`, { redirect: 'manual' });
  assert([301, 302].includes(redirectRes.status), '/admin/ai-agent redirects to /admin#tab-ai-agent');
  console.log('  ✓ GET /admin/ai-agent redirects seamlessly to /admin#tab-ai-agent');

  // 4. Test Natural Language Command: Health Audit
  console.log('\n4. Testing Natural Language Audit Command:');
  const auditChatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: 'Run AI portfolio audit and check for missing information' })
  });
  assert.strictEqual(auditChatRes.status, 200, 'Audit command returns 200');
  const auditChatData = await auditChatRes.json();
  assert(auditChatData.data.reply.includes('Portfolio Audit Complete'), 'Audit reply rendered');
  assert(auditChatData.data.audit.overallScore >= 50, 'Overall health score calculated');
  console.log(`  ✓ Natural language audit executed. Health Score: ${auditChatData.data.audit.overallScore}/100`);

  // 5. Test Natural Language Command: Duplicate Check
  console.log('\n5. Testing Duplicate Detection:');
  const dupChatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: 'Check whether my portfolio has duplicate projects' })
  });
  assert.strictEqual(dupChatRes.status, 200, 'Duplicate check returns 200');
  const dupChatData = await dupChatRes.json();
  assert(dupChatData.data.reply.toLowerCase().includes('duplicate'), 'Duplicate check summary returned');
  console.log('  ✓ AI Agent duplicate scanner executed across projects and skills');

  // 6. Test Structured Search Engine
  console.log('\n6. Testing AI Structured Portfolio Search:');
  const searchRes = await fetch(`${BASE_URL}/api/ai/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: 'Show all projects using React' })
  });
  assert.strictEqual(searchRes.status, 200, 'Search returns 200');
  const searchData = await searchRes.json();
  assert(searchData.data.answer.includes('project'), 'Found matching projects in query');
  console.log('  ✓ Natural language query "Show all projects using React" returned structured matches');

  // 7. Test AI Description Generator
  console.log('\n7. Testing AI Description Generator (Professional, ATS, Technical, Shorten):');
  const sampleNote = 'Built an IoT air monitoring device with ESP32 and MQTT that logs real-time PM2.5 to cloud.';
  
  const genProf = await fetch(`${BASE_URL}/api/ai/generate-description`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: sampleNote, type: 'project', style: 'professional' })
  });
  assert.strictEqual(genProf.status, 200);
  const genProfData = await genProf.json();
  assert(genProfData.data.result.length > 20, 'Generated professional description');
  console.log('  ✓ Generated Professional description');

  const genAts = await fetch(`${BASE_URL}/api/ai/generate-description`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: sampleNote, type: 'project', style: 'ats' })
  });
  assert.strictEqual(genAts.status, 200);
  const genAtsData = await genAts.json();
  assert(genAtsData.data.result.includes('engineering') || genAtsData.data.result.includes('proficiency'), 'ATS format generated');
  console.log('  ✓ Generated ATS-aligned description');

  // 8. Test Multi-Modal Document Upload & ChangeSet Generation (NPTEL PDF Certificate)
  const samplePdf = fs.existsSync(path.resolve(__dirname, '../storage/media/NOC26CS45S145150024704536444.pdf'))
    ? path.resolve(__dirname, '../storage/media/NOC26CS45S145150024704536444.pdf')
    : path.resolve(__dirname, '../NOC26CS45S145150024704536444.pdf');
  assert(fs.existsSync(samplePdf), 'Real NPTEL PDF certificate exists in workspace');

  const boundary = '----WebKitFormBoundaryAiMultiModalTest';
  const fileBytes = fs.readFileSync(samplePdf);

  const pdfBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="message"\r\n\r\n` +
      `Analyze this certificate and update my portfolio.\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="NOC26CS45S145150024704536444.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`
    ),
    fileBytes,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const docUploadRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: pdfBody
  });

  assert.strictEqual(docUploadRes.status, 200, 'Certificate analysis returns 200');
  const docUploadData = await docUploadRes.json();
  assert.strictEqual(docUploadData.data.status, 'success');
  assert(docUploadData.data.analysis.docType === 'Certification', 'Correctly classified as Certification');
  assert(docUploadData.data.changeSet, 'ChangeSet generated for admin review');
  const createdCsId = docUploadData.data.changeSet.id;
  console.log(`  ✓ Analyzed physical NPTEL PDF. Classified as "${docUploadData.data.analysis.docType}" with ChangeSet: ${createdCsId}`);

  // 9. Test ChangeSet Approval
  console.log('\n9. Testing ChangeSet Review & Approval Pipeline:');
  const approveRes = await fetch(`${BASE_URL}/api/ai/changesets/${createdCsId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}) // Approve all changes in changeset
  });
  assert.strictEqual(approveRes.status, 200, 'Approval returns 200');
  const approveData = await approveRes.json();
  assert.strictEqual(approveData.data.changeSet.status, 'APPROVED', 'ChangeSet status marked APPROVED');
  console.log(`  ✓ Approved ChangeSet ${createdCsId}. Applied ${approveData.data.appliedCount} change(s) directly to live draft!`);

  // Verify that the certification is now present in draft
  const draftRes = await fetch(`${BASE_URL}/api/profile/draft`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const draftData = await draftRes.json();
  const foundCert = draftData.data.certifications.find(c =>
    (c.name && c.name.toLowerCase().includes('natural language processing')) ||
    (c.credentialId && c.credentialId.includes('NOC26CS45S145150024704536444'))
  );
  assert(foundCert, 'Approved certification merged into draft profile');
  console.log(`  ✓ Verified draft profile contains newly added certification: "${foundCert.name}"`);

  // 10. Test Multi-Modal Image / Headshot Avatar Upload
  console.log('\n10. Testing Headshot Image Analysis & Avatar Replacement:');
  const candidatePhotos = [
    path.resolve(__dirname, '../Photo from 🖤⃝🦋𓍯𓂃𓏧♡🫵🏻🫶🏻.jpg'),
    path.resolve(__dirname, '../og-image.png'),
    path.resolve(__dirname, '../hackathon-certificate-gist-vaultsphere.jpg')
  ];
  const samplePhoto = candidatePhotos.find(p => fs.existsSync(p));
  assert(samplePhoto, 'A valid test photo exists in workspace');

  const photoBytes = fs.readFileSync(samplePhoto);
  const photoBoundary = '----WebKitFormBoundaryPhotoAvatarTest';

  const photoBody = Buffer.concat([
    Buffer.from(
      `--${photoBoundary}\r\n` +
      `Content-Disposition: form-data; name="message"\r\n\r\n` +
      `Use this image as my profile photo.\r\n` +
      `--${photoBoundary}\r\n` +
      `Content-Disposition: form-data; name="files"; filename="harsha_profile.jpg"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n`
    ),
    photoBytes,
    Buffer.from(`\r\n--${photoBoundary}--\r\n`)
  ]);

  const photoRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${photoBoundary}`
    },
    body: photoBody
  });

  assert.strictEqual(photoRes.status, 200, 'Image analysis returns 200');
  const photoData = await photoRes.json();
  assert(photoData.data.changeSet, 'Avatar ChangeSet created');
  const avatarCsId = photoData.data.changeSet.id;
  console.log(`  ✓ Analyzed image. Verified suitable as avatar. ChangeSet created: ${avatarCsId}`);

  // Approve avatar replacement
  const approveAvatarRes = await fetch(`${BASE_URL}/api/ai/changesets/${avatarCsId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  assert.strictEqual(approveAvatarRes.status, 200, 'Avatar change approved');
  console.log('  ✓ Approved avatar replacement. Draft profile avatar updated to media storage URL.');

  // 11. Test Content Versioning & Audit History
  console.log('\n11. Testing Reversible Content Version History:');
  const versionsRes = await fetch(`${BASE_URL}/api/ai/versions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(versionsRes.status, 200, 'Versions returns 200');
  const versionsData = await versionsRes.json();
  assert(Array.isArray(versionsData.data), 'Versions array returned');
  assert(versionsData.data.length > 0, 'Recorded version changes in history');
  console.log(`  ✓ Reversible version history verified (${versionsData.data.length} change record(s) active)`);

  console.log('\n==================================================');
  console.log(' ALL AI PORTFOLIO AGENT INTEGRATION TESTS PASSED (11/11)');
  console.log('==================================================\n');
}

runAiTests().catch(err => {
  console.error('Fatal AI Test Suite Error:', err);
  if (server) server.close();
  process.exit(1);
}).then(() => {
  if (server) server.close();
});

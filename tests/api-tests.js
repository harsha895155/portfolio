/**
 * API Integration Tests
 * Validates real HTTP request cycles, authentication guards, and file uploads.
 */

const assert = require('assert');
const app = require('../src/server/app');
const config = require('../config');

let server;
const PORT = 5566;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function run() {
  console.log('\n==================================================');
  console.log(' RUNNING HTTP & API INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  let token = null;

  try {
    // 1. Test Public Profile
    console.log('1. Testing Public Endpoints:');
    const pubRes = await fetch(`${BASE_URL}/api/profile`);
    assert.strictEqual(pubRes.status, 200, 'Public profile should return 200');
    const pubData = await pubRes.json();
    assert.strictEqual(pubData.success, true);
    assert(pubData.data.name.includes('Harshavardhan'), 'Candidate name present in public API');
    console.log('  ✓ GET /api/profile returns published profile');

    const homeRes = await fetch(`${BASE_URL}/`);
    assert.strictEqual(homeRes.status, 200, 'Homepage returns 200');
    console.log('  ✓ GET / serves public portfolio index.html');

    const adminHtmlRes = await fetch(`${BASE_URL}/admin`);
    assert.strictEqual(adminHtmlRes.status, 200, 'Admin page returns 200');
    console.log('  ✓ GET /admin serves private management portal');

    // 2. Test Auth Guard
    console.log('\n2. Testing Authentication Guard:');
    const unauthRes = await fetch(`${BASE_URL}/api/admin/stats`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthorized request should return 401');
    console.log('  ✓ GET /api/admin/stats blocked without token (401)');

    const unauthUpload = await fetch(`${BASE_URL}/api/documents/upload`, { method: 'POST' });
    assert.strictEqual(unauthUpload.status, 401, 'Upload blocked without token (401)');
    console.log('  ✓ POST /api/documents/upload blocked without token (401)');

    // 3. Test Login
    console.log('\n3. Testing Login Flow:');
    const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'bad_password' })
    });
    assert.strictEqual(badLogin.status, 401, 'Wrong password returns 401');
    console.log('  ✓ POST /api/auth/login with wrong password fails (401)');

    const goodLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: config.auth.adminPassword })
    });
    assert.strictEqual(goodLogin.status, 200, 'Valid credentials return 200');
    const loginJson = await goodLogin.json();
    token = loginJson.data.token;
    assert(token, 'JWT token returned upon login');
    console.log('  ✓ POST /api/auth/login with valid credentials succeeds and issues JWT');

    // 4. Test Authorized Requests
    console.log('\n4. Testing Authorized Admin Endpoints:');
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(statsRes.status, 200, 'Stats with token returns 200');
    const statsJson = await statsRes.json();
    assert(statsJson.data.projectsCount >= 4, 'Projects counted');
    console.log('  ✓ GET /api/admin/stats with Bearer token succeeds (200)');

    // Test PUT /api/social/platforms/credly
    const editCredlyRes = await fetch(`${BASE_URL}/api/social/platforms/credly`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform: 'Credly',
        url: 'https://www.credly.com/users/harsha10003/badges/credly',
        syncMethod: 'Public Badge Verification URLs',
        status: 'Active'
      })
    });
    assert.strictEqual(editCredlyRes.status, 200, 'Edit Credly platform returns 200');
    console.log('  ✓ PUT /api/social/platforms/credly updates platform successfully');

    const socialRes = await fetch(`${BASE_URL}/api/social/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(socialRes.status, 200, 'Social status returns 200');
    const socialJson = await socialRes.json();
    const credlyPlatform = socialJson.data.find(p => p.id === 'credly');
    assert(credlyPlatform, 'Credly platform found');
    assert.strictEqual(credlyPlatform.url, 'https://www.credly.com/users/harsha10003/badges/credly', 'Credly URL matches updated link');
    console.log('  ✓ GET /api/social/status returns connected platforms with updated Credly link');

    // Test POST /api/social/platforms/verify-url (Link Verification API)
    const verifyValidRes = await fetch(`${BASE_URL}/api/social/platforms/verify-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://www.credly.com/users/harsha10003/badges/credly',
        platform: 'Credly'
      })
    });
    assert.strictEqual(verifyValidRes.status, 200, 'Verify valid Credly URL returns 200');
    const verifyValidJson = await verifyValidRes.json();
    assert.strictEqual(verifyValidJson.data.verified, true, 'Valid Credly URL is verified');
    console.log('  ✓ POST /api/social/platforms/verify-url verifies reachable valid URL and platform domain');

    // Test verifying URL with mismatched platform name (e.g., GitHub URL for Credly platform)
    const verifyMismatchRes = await fetch(`${BASE_URL}/api/social/platforms/verify-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://github.com/harsha895155',
        platform: 'Credly'
      })
    });
    const verifyMismatchJson = await verifyMismatchRes.json();
    assert.strictEqual(verifyMismatchJson.data.verified, false, 'Mismatched platform domain is rejected');
    console.log('  ✓ POST /api/social/platforms/verify-url rejects URL when platform name does not match domain');

    // Test verifying broken 404 URL
    const verify404Res = await fetch(`${BASE_URL}/api/social/platforms/verify-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://github.com/definitely_not_a_real_user_404_test_9999',
        platform: 'GitHub'
      })
    });
    const verify404Json = await verify404Res.json();
    assert.strictEqual(verify404Json.data.verified, false, '404 URL is not verified');
    console.log('  ✓ POST /api/social/platforms/verify-url detects broken 404 pages');

    // Test POST /api/social/platforms rejects unverified / invalid URLs ("if it is verified only")
    const rejectUnverifiedRes = await fetch(`${BASE_URL}/api/social/platforms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Credly',
        url: 'https://github.com/harsha895155', // Mismatch!
        syncMethod: 'Public Profile'
      })
    });
    assert.strictEqual(rejectUnverifiedRes.status, 400, 'Adding unverified platform fails (400)');
    console.log('  ✓ POST /api/social/platforms strictly blocks linking unverified platforms');

    // Ensure clean state before adding
    await fetch(`${BASE_URL}/api/social/platforms/leetcode`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // Test POST /api/social/platforms succeeds when link is verified
    const addPlatformRes = await fetch(`${BASE_URL}/api/social/platforms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'LeetCode',
        url: 'https://leetcode.com/u/harsha10003/',
        syncMethod: 'Competitive Coding Profile',
        icon: '⚡'
      })
    });
    assert.strictEqual(addPlatformRes.status, 201, 'Add verified platform returns 201');
    console.log('  ✓ POST /api/social/platforms adds and links verified platform successfully');

    // Test DELETE /api/social/platforms/:id
    const deleteRes = await fetch(`${BASE_URL}/api/social/platforms/leetcode`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(deleteRes.status, 200, 'Delete platform returns 200');
    console.log('  ✓ DELETE /api/social/platforms/:id removes linked platform');

    // Test Universal Multi-Platform Synchronization (POST /api/social/sync-all)
    console.log('\nTesting Multi-Platform Synchronization:');
    const syncAllRes = await fetch(`${BASE_URL}/api/social/sync-all`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(syncAllRes.status, 200, 'POST /api/social/sync-all returns 200');
    const syncAllJson = await syncAllRes.json();
    assert.strictEqual(syncAllJson.success, true);
    assert(syncAllJson.data.totalCount >= 1, 'Sync covers all connected platforms');
    assert(Array.isArray(syncAllJson.data.platforms), 'Platform results array returned');
    console.log(`  ✓ POST /api/social/sync-all synchronized ${syncAllJson.data.totalCount} connected platforms`);

    // Test Single Platform Sync (POST /api/social/platforms/credly/sync)
    const syncCredlyRes = await fetch(`${BASE_URL}/api/social/platforms/credly/sync`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(syncCredlyRes.status, 200, 'POST /api/social/platforms/credly/sync returns 200');
    const syncCredlyJson = await syncCredlyRes.json();
    assert.strictEqual(syncCredlyJson.success, true);
    assert.strictEqual(syncCredlyJson.data.platform, 'Credly');
    assert.strictEqual(syncCredlyJson.data.success, true);
    console.log('  ✓ POST /api/social/platforms/:id/sync synchronizes individual platform');

    // Test Universal Platform Deletion (Allowing any platform to be deleted, not just custom ones)
    console.log('\nTesting Universal Platform Deletion:');
    const deleteCoreRes = await fetch(`${BASE_URL}/api/social/platforms/unstop`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(deleteCoreRes.status, 200, 'DELETE unstop core platform returns 200');
    console.log('  ✓ DELETE /api/social/platforms/unstop allows deleting core default platforms');

    const socialAfterDeleteRes = await fetch(`${BASE_URL}/api/social/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const socialAfterDeleteJson = await socialAfterDeleteRes.json();
    const unstopAfter = socialAfterDeleteJson.data.find(p => p.id === 'unstop');
    assert.strictEqual(unstopAfter, undefined, 'Unstop successfully unlinked and removed from connected platforms');
    console.log('  ✓ GET /api/social/status confirms unlinked platform is no longer present');

    const draftRes = await fetch(`${BASE_URL}/api/profile/draft`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(draftRes.status, 200, 'Draft returns 200');
    console.log('  ✓ GET /api/profile/draft returns working draft profile');

    // 5. Test File Upload with Multer & Entity Extraction
    console.log('\n5. Testing File Upload & Extraction:');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const sampleResumeText = `
Thimmareddygari Harshavardhan Reddy
Nellore, Andhra Pradesh, India | harshavardhan10003@gmail.com
Education: Geethanjali Institute of Science & Technology, B.Tech CSE, 2023-2027, 9.1 CGPA
Skills: Core Java, React.js, Python, Node.js, Express, Django, TypeScript, Rust, Docker, Kubernetes
Projects: AirGuard IoT, VideStore, GRAMMPAY, Hollow Expense Tracker
Certifications: Natural Language Processing Elite NPTEL IIT Kharagpur 60%
    `;
    const bodyBuffer = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="Test_Harsha_Resume.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      sampleResumeText +
      `\r\n--${boundary}\r\n` +
      `Content-Disposition: form-data; name="category"\r\n\r\n` +
      `Resume\r\n` +
      `--${boundary}--\r\n`
    );

    const uploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    assert.strictEqual(uploadRes.status, 201, 'Upload returns 201 Created');
    const uploadData = await uploadRes.json();
    assert.strictEqual(uploadData.data.document.docType, 'Resume', 'Document detected as Resume');
    assert(uploadData.data.extraction.extracted.detectedSkills.includes('Rust'), 'Extracted new skill Rust');
    console.log('  ✓ POST /api/documents/upload successfully extracted Resume entities & detected new skills');

    // 6. Test CMS Content Management Endpoints
    console.log('\n6. Testing Portfolio CMS Content Management Endpoints:');

    // Profile & Hero
    const updateHeroRes = await fetch(`${BASE_URL}/api/cms/profile-hero`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Thimmareddygari Harshavardhan Reddy',
        title: 'Full Stack & IoT Engineer | Problem Solver',
        shortBio: 'Updated CMS Bio Test',
        heroDescription: 'Building resilient cloud-connected IoT systems and scalable web applications.'
      })
    });
    assert.strictEqual(updateHeroRes.status, 200, 'PUT /api/cms/profile-hero returns 200');
    console.log('  ✓ PUT /api/cms/profile-hero updates hero content in draft');

    // About Section
    const updateAboutRes = await fetch(`${BASE_URL}/api/cms/about`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        careerObjective: 'Continuous learning and building impactful software products.',
        paragraphs: ['Paragraph 1 updated via Admin CMS.', 'Paragraph 2 updated via Admin CMS.']
      })
    });
    assert.strictEqual(updateAboutRes.status, 200, 'PUT /api/cms/about returns 200');
    console.log('  ✓ PUT /api/cms/about updates about section in draft');

    // Skills CRUD
    const addSkillRes = await fetch(`${BASE_URL}/api/cms/skills`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'Languages', skill: 'GraphQL' })
    });
    assert.strictEqual(addSkillRes.status, 201, 'POST /api/cms/skills returns 201');
    console.log('  ✓ POST /api/cms/skills adds new skill to category');

    const delSkillRes = await fetch(`${BASE_URL}/api/cms/skills`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'Languages', skill: 'GraphQL' })
    });
    assert.strictEqual(delSkillRes.status, 200, 'DELETE /api/cms/skills returns 200');
    console.log('  ✓ DELETE /api/cms/skills removes skill from category');

    // Education CRUD
    const addEduRes = await fetch(`${BASE_URL}/api/cms/education`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institution: 'Test University',
        degree: 'Master of Science',
        field: 'Computer Science',
        startYear: '2027',
        endYear: '2029',
        score: '4.0 GPA',
        location: 'Remote'
      })
    });
    assert.strictEqual(addEduRes.status, 201, 'POST /api/cms/education returns 201');
    const addEduData = await addEduRes.json();
    const eduIndex = Array.isArray(addEduData.data) ? addEduData.data.length - 1 : 0;
    console.log('  ✓ POST /api/cms/education adds new education entry');

    const delEduRes = await fetch(`${BASE_URL}/api/cms/education/${eduIndex}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(delEduRes.status, 200, 'DELETE /api/cms/education/:index returns 200');
    console.log('  ✓ DELETE /api/cms/education/:index removes education entry');

    // Experience CRUD
    const addExpRes = await fetch(`${BASE_URL}/api/cms/experience`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'IoT Research Intern',
        company: 'Smart City Lab',
        location: 'Bengaluru, India',
        type: 'Internship',
        period: '2025 - Present',
        current: true,
        bullets: ['Researched LoRaWAN sensor networks.', 'Integrated cloud telemetry pipeline.']
      })
    });
    assert.strictEqual(addExpRes.status, 201, 'POST /api/cms/experience returns 201');
    const addExpData = await addExpRes.json();
    const createdExpId = Array.isArray(addExpData.data) ? addExpData.data[addExpData.data.length - 1].id : addExpData.data.id;
    console.log('  ✓ POST /api/cms/experience adds new experience entry');

    const updateExpRes = await fetch(`${BASE_URL}/api/cms/experience/${createdExpId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Lead IoT Research Intern',
        company: 'Smart City Lab',
        location: 'Bengaluru, India',
        type: 'Internship',
        period: '2025 - Present',
        current: true,
        bullets: ['Researched LoRaWAN sensor networks.']
      })
    });
    assert.strictEqual(updateExpRes.status, 200, 'PUT /api/cms/experience/:id updates entry');
    console.log('  ✓ PUT /api/cms/experience/:id updates experience entry');

    const delExpRes = await fetch(`${BASE_URL}/api/cms/experience/${createdExpId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(delExpRes.status, 200, 'DELETE /api/cms/experience/:id deletes entry');
    console.log('  ✓ DELETE /api/cms/experience/:id removes experience entry');

    // Projects CRUD
    const addProjRes = await fetch(`${BASE_URL}/api/cms/projects`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'QuantumCipher CMS Test',
        tag: 'Security & Cryptography',
        description: 'Post-quantum cryptographic key exchange simulator.',
        technologies: ['Rust', 'WebAssembly', 'React'],
        github: 'https://github.com/harsha895155/QuantumCipher',
        liveDemo: 'https://quantumcipher.dev',
        featured: true,
        status: 'In Progress'
      })
    });
    assert.strictEqual(addProjRes.status, 201, 'POST /api/cms/projects returns 201');
    const addProjData = await addProjRes.json();
    const createdProj = Array.isArray(addProjData.data) ? addProjData.data.find(p => p.title.includes('QuantumCipher')) : addProjData.data;
    const createdProjId = createdProj.id;
    console.log('  ✓ POST /api/cms/projects creates new project entry');

    const updateProjRes = await fetch(`${BASE_URL}/api/cms/projects/${createdProjId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'QuantumCipher CMS Test',
        tag: 'Security & Cryptography',
        description: 'Updated description through Admin CMS.',
        technologies: ['Rust', 'WebAssembly', 'React', 'Node.js'],
        github: 'https://github.com/harsha895155/QuantumCipher',
        liveDemo: 'https://quantumcipher.dev',
        featured: false,
        status: 'Completed'
      })
    });
    assert.strictEqual(updateProjRes.status, 200, 'PUT /api/cms/projects/:id updates project');
    console.log('  ✓ PUT /api/cms/projects/:id updates project details');

    const delProjRes = await fetch(`${BASE_URL}/api/cms/projects/${createdProjId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(delProjRes.status, 200, 'DELETE /api/cms/projects/:id removes project');
    console.log('  ✓ DELETE /api/cms/projects/:id deletes project entry');

    // Certifications CRUD
    const addCertRes = await fetch(`${BASE_URL}/api/cms/certifications`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Certified Kubernetes Administrator (CKA)',
        issuer: 'Cloud Native Computing Foundation',
        date: '2026',
        credentialId: 'CKA-998877',
        score: '96%',
        url: 'https://www.cncf.io/certification/cka/',
        icon: '☸️'
      })
    });
    assert.strictEqual(addCertRes.status, 201, 'POST /api/cms/certifications returns 201');
    const addCertData = await addCertRes.json();
    const createdCertId = Array.isArray(addCertData.data) ? addCertData.data[addCertData.data.length - 1].id : addCertData.data.id;
    console.log('  ✓ POST /api/cms/certifications adds new certification');

    const delCertRes = await fetch(`${BASE_URL}/api/cms/certifications/${createdCertId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(delCertRes.status, 200, 'DELETE /api/cms/certifications/:id deletes certification');
    console.log('  ✓ DELETE /api/cms/certifications/:id removes certification');

    // Achievements CRUD
    const addAchRes = await fetch(`${BASE_URL}/api/cms/achievements`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'National Level Hackathon Winner',
        description: 'First prize in National CleanTech Innovation Challenge 2026.',
        icon: '🏆',
        proof: 'https://hackathon.org/results/2026'
      })
    });
    assert.strictEqual(addAchRes.status, 201, 'POST /api/cms/achievements returns 201');
    const addAchData = await addAchRes.json();
    const createdAchId = Array.isArray(addAchData.data) ? addAchData.data[addAchData.data.length - 1].id : addAchData.data.id;
    console.log('  ✓ POST /api/cms/achievements adds new achievement');

    const delAchRes = await fetch(`${BASE_URL}/api/cms/achievements/${createdAchId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(delAchRes.status, 200, 'DELETE /api/cms/achievements/:id deletes achievement');
    console.log('  ✓ DELETE /api/cms/achievements/:id removes achievement');

    // Resume Management
    const getResumeRes = await fetch(`${BASE_URL}/api/cms/resume`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(getResumeRes.status, 200, 'GET /api/cms/resume returns 200');
    console.log('  ✓ GET /api/cms/resume returns current active resume configuration');

    const updateResumeRes = await fetch(`${BASE_URL}/api/cms/resume`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeUrl: 'Harshavardhan_Reddy_Resume.pdf',
        displayName: 'Harshavardhan Reddy - Professional Resume'
      })
    });
    assert.strictEqual(updateResumeRes.status, 200, 'PUT /api/cms/resume updates resume metadata');
    console.log('  ✓ PUT /api/cms/resume updates resume filename and display name');

    // Section Visibility & Navigation
    const getSecRes = await fetch(`${BASE_URL}/api/cms/sections`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(getSecRes.status, 200, 'GET /api/cms/sections returns 200');
    console.log('  ✓ GET /api/cms/sections returns section visibility map');

    const updateSecRes = await fetch(`${BASE_URL}/api/cms/sections`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hero: true,
        marquee: true,
        about: true,
        skills: true,
        experience: true,
        projects: true,
        certs: true,
        achievements: true,
        contact: true
      })
    });
    assert.strictEqual(updateSecRes.status, 200, 'PUT /api/cms/sections updates visibility settings');
    console.log('  ✓ PUT /api/cms/sections saves section visibility flags');

    // SEO Management
    const updateSeoRes = await fetch(`${BASE_URL}/api/cms/seo`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Harshavardhan Reddy | Portfolio & CMS',
        description: 'Comprehensive data-driven portfolio of Thimmareddygari Harshavardhan Reddy.',
        keywords: 'Harshavardhan Reddy, IoT, Full Stack Developer, AirGuard',
        ogTitle: 'Harshavardhan Reddy Portfolio',
        ogDescription: 'Personal portfolio and technical projects.'
      })
    });
    assert.strictEqual(updateSeoRes.status, 200, 'PUT /api/cms/seo updates SEO metadata');
    console.log('  ✓ PUT /api/cms/seo saves SEO & Open Graph settings');

    // Media Library
    const mediaRes = await fetch(`${BASE_URL}/api/cms/media`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(mediaRes.status, 200, 'GET /api/cms/media returns 200');
    const mediaJson = await mediaRes.json();
    assert(Array.isArray(mediaJson.data), 'Media files array returned');
    console.log(`  ✓ GET /api/cms/media returns media asset inventory (${mediaJson.data.length} files found)`);

    // Backup Export
    const backupRes = await fetch(`${BASE_URL}/api/cms/backup/export`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(backupRes.status, 200, 'GET /api/cms/backup/export returns 200');
    const backupJson = await backupRes.json();
    assert.strictEqual(backupJson.system, 'Harshavardhan Portfolio CMS', 'Backup contains system identifier');
    assert(backupJson.data.published, 'Backup includes published portfolio data');
    console.log('  ✓ GET /api/cms/backup/export downloads full portfolio database backup JSON');

    // 7. Test Live Preview and Publishing Lifecycle
    console.log('\n7. Testing Live Draft Preview and Publish Lifecycle:');
    const previewRes = await fetch(`${BASE_URL}/preview`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(previewRes.status, 200, 'GET /preview returns 200 with auth');
    const previewHtml = await previewRes.text();
    assert(previewHtml.includes('window.__PREVIEW_MODE__ = true'), 'Preview mode flag injected into HTML');
    assert(previewHtml.includes('DRAFT PREVIEW MODE'), 'Draft preview mode floating banner present in HTML');
    console.log('  ✓ GET /preview renders portfolio with injected draft profile and banner');

    const publishRes = await fetch(`${BASE_URL}/api/profile/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(publishRes.status, 200, 'POST /api/profile/publish returns 200');
    const publishJson = await publishRes.json();
    assert.strictEqual(publishJson.success, true);
    assert(publishJson.data.snapshotName, 'Snapshot created upon publish');
    console.log('  ✓ POST /api/profile/publish publishes draft to production and creates snapshot');

    console.log('\n==================================================');
    console.log(' ALL HTTP, API & CMS INTEGRATION TESTS PASSED (35/35)');
    console.log('==================================================\n');

  } finally {
    server.close();
  }
}

run().catch(err => {
  console.error('API Test failed', err);
  if (server) server.close();
  process.exit(1);
});

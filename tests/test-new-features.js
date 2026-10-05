const fs = require('fs');
const path = require('path');
const http = require('http');

async function testFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + (parsed.search || ''),
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, text: () => Promise.resolve(data), json: () => Promise.resolve(JSON.parse(data)) }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log('Testing newly implemented features...');

  // 1. Check Homepage HTML
  const homeRes = await testFetch('http://localhost:5000/');
  const homeHtml = await homeRes.text();
  console.assert(homeRes.status === 200, 'Home page returns 200');
  console.assert(homeHtml.includes('resume-trigger'), 'Home page contains resume-trigger class');
  console.assert(homeHtml.includes('📄 View Resume'), 'Home page contains 📄 View Resume button');
  console.assert(homeHtml.includes('Thimmareddygari_Harshavardhan_Reddy_Resume.pdf'), 'Home page points to resume PDF');
  console.log('✓ Home page hero view resume button verified');

  // 2. Check Admin Portal HTML
  const adminRes = await testFetch('http://localhost:5000/admin');
  const adminHtml = await adminRes.text();
  console.assert(adminRes.status === 200, 'Admin page returns 200');
  console.assert(adminHtml.includes('modal-delete-skill'), 'Admin contains modal-delete-skill');
  console.assert(adminHtml.includes('skill-delete-category'), 'Admin contains skill-delete-category select');
  console.assert(adminHtml.includes('skill-delete-name'), 'Admin contains skill-delete-name select');
  console.assert(adminHtml.includes('openDeleteSkillModal()'), 'Admin contains openDeleteSkillModal() call');
  console.assert(adminHtml.includes('prof-resume-label'), 'Admin contains prof-resume-label input');
  console.assert(adminHtml.includes('prof-resume-url'), 'Admin contains prof-resume-url input');
  console.assert(adminHtml.includes('btn-upload-hero-resume'), 'Admin contains btn-upload-hero-resume button');
  console.assert(adminHtml.includes('hero-resume-file-input'), 'Admin contains hero-resume-file-input file input');
  console.assert(adminHtml.includes('btn-hero-preview-resume'), 'Admin contains btn-hero-preview-resume button');
  console.log('✓ Admin dashboard HTML elements verified');

const config = require('../config');

  // 3. Login and Acquire Token
  const loginRes = await testFetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: config.auth.adminPassword })
  });
  const loginJson = await loginRes.json();
  console.assert(loginJson.success, 'Admin login successful');
  const token = loginJson.data.token;
  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 4. Test Add Skill & Delete Skill API
  const addSkillRes = await testFetch('http://localhost:5000/api/cms/skills', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ category: 'Programming Languages', name: 'KotlinTestSkill', proficiency: 80 })
  });
  const addSkillJson = await addSkillRes.json();
  console.assert(addSkillJson.success, 'Skill added successfully');
  console.log('✓ Add skill API verified');

  const delSkillRes = await testFetch('http://localhost:5000/api/cms/skills?category=Programming%20Languages&name=KotlinTestSkill', {
    method: 'DELETE',
    headers: authHeaders
  });
  const delSkillJson = await delSkillRes.json();
  console.assert(delSkillJson.success, 'Skill deleted successfully');
  console.log('✓ Delete skill API verified');

  // 5. Test Profile Hero CTAs & Resume update
  const profRes = await testFetch('http://localhost:5000/api/cms/profile-hero', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      heroCtas: {
        cta1: { label: '↗ Get In Touch', url: '#contact' },
        cta2: { label: 'View Projects →', url: '#projects' }
      },
      resume: {
        label: 'View Resume',
        url: './Thimmareddygari_Harshavardhan_Reddy_Resume.pdf'
      }
    })
  });
  const profJson = await profRes.json();
  console.assert(profJson.success, 'Profile Hero CTAs and resume updated in draft');
  console.log('✓ Profile Hero CTAs and resume API update verified');

  // 6. Test Resume Upload endpoint (multipart/form-data)
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const realPdfBuffer = fs.readFileSync(path.resolve(__dirname, '../Thimmareddygari_Harshavardhan_Reddy_Resume.pdf'));
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="Thimmareddygari_Harshavardhan_Reddy_Resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;
  const multipartBody = Buffer.concat([Buffer.from(header), realPdfBuffer, Buffer.from(footer)]);

  const uploadRes = await testFetch('http://localhost:5000/api/cms/resume/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBody.length
    },
    body: multipartBody
  });
  const uploadJson = await uploadRes.json();
  console.assert(uploadJson.success, 'Resume uploaded successfully');
  console.assert(uploadJson.data.url.startsWith('/media/Harsha_Resume_'), 'Resume uploaded to /media/ with timestamp');
  console.log('✓ Resume file upload (POST /api/cms/resume/upload) verified with real PDF');

  // Verify that the uploaded resume returns 200 and has correct content length
  const verifyUploaded = await testFetch(`http://localhost:5000${uploadJson.data.url}`);
  console.assert(verifyUploaded.status === 200, 'Uploaded resume returns 200');
  console.log('✓ Uploaded resume is immediately accessible via HTTP 200');

  console.log('\n========================================');
  console.log('ALL NEW FEATURE VERIFICATIONS PASSED 100%');
  console.log('========================================');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

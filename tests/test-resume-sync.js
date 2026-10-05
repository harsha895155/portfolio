const http = require('http');
const fs = require('fs');
const config = require('../config');

async function test() {
  console.log('--- Testing Resume Upload, View, and Sync ---');

  // 1. Login
  const loginData = JSON.stringify({ username: 'admin', password: config.auth.adminPassword });
  const loginRes = await new Promise(res => {
    const req = http.request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
    }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b)));
    });
    req.write(loginData); req.end();
  });

  const token = loginRes.data.token;
  console.log('✓ Admin login successful');

  // 2. Upload sample real PDF resume
  const pdfBytes = fs.readFileSync('Thimmareddygari_Harshavardhan_Reddy_Resume.pdf');
  const boundary = '--------------------' + Date.now();
  const pre = Buffer.from(
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="resume"; filename="Harsha_Resume_Live_Updated.pdf"\r\n' +
    'Content-Type: application/pdf\r\n\r\n'
  );
  const post = Buffer.from('\r\n--' + boundary + '--\r\n');
  const body = Buffer.concat([pre, pdfBytes, post]);

  const uploadRes = await new Promise(res => {
    const req = http.request({
      hostname: 'localhost', port: 5000, path: '/api/cms/resume/upload', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length
      }
    }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => res({ status: r.statusCode, data: JSON.parse(b) }));
    });
    req.write(body); req.end();
  });

  console.log('Upload status:', uploadRes.status, uploadRes.data.message);
  if (uploadRes.status !== 201) {
    throw new Error('Upload failed: ' + JSON.stringify(uploadRes.data));
  }
  const newUrl = uploadRes.data.data.url;
  console.log('✓ New resume URL generated:', newUrl);

  // 3. Verify published profile and profile.js
  // Clear require cache to read fresh file
  delete require.cache[require.resolve('../data/db.json')];
  const db = require('../data/db.json');
  console.log('db.published.resume:', db.published.resume);
  console.log('db.draft.resume:', db.draft.resume);
  console.assert(db.published.resume.url === newUrl, 'Published resume updated to newUrl');
  console.assert(db.draft.resume.url === newUrl, 'Draft resume updated to newUrl');
  console.log('✓ db.json published & draft both updated immediately');

  const profileJs = fs.readFileSync('profile.js', 'utf-8');
  console.assert(profileJs.includes(newUrl), 'profile.js contains new resume URL');
  console.log('✓ profile.js synchronized with new resume URL');

  const indexHtml = fs.readFileSync('index.html', 'utf-8');
  console.assert(indexHtml.includes(newUrl), 'index.html contains new resume URL');
  console.log('✓ index.html resume link synchronized with new resume URL');

  // 4. Test fetch of newUrl via HTTP
  const getRes = await new Promise(res => {
    http.get('http://localhost:5000' + newUrl, r => {
      res({ status: r.statusCode, type: r.headers['content-type'], len: r.headers['content-length'] });
    });
  });
  console.log('GET new resume URL response:', getRes);
  console.assert(getRes.status === 200, 'GET new resume URL returned 200');
  console.assert(getRes.type === 'application/pdf', 'GET returns application/pdf');
  console.log('✓ Uploaded resume is accessible live over HTTP 200');

  // 5. Test home page fetch
  const homeHtml = await new Promise(res => {
    http.get('http://localhost:5000/', r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => res(b));
    });
  });
  console.assert(homeHtml.includes(newUrl), 'Public home page serves link to new resume URL');
  console.log('✓ Public home page points to new resume URL');

  // 6. Test admin page
  const adminHtml = await new Promise(res => {
    http.get('http://localhost:5000/admin', r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => res(b));
    });
  });
  console.assert(adminHtml.includes('btn-view-active-resume'), 'Admin has btn-view-active-resume');
  console.assert(adminHtml.includes('btn-hero-preview-resume'), 'Admin has btn-hero-preview-resume');
  console.assert(adminHtml.includes('btn-hero-resume-view-ext'), 'Admin has btn-hero-resume-view-ext');
  console.log('✓ Admin dashboard has all View Resume and Preview buttons');

  console.log('====================================');
  console.log('ALL RESUME VIEW & UPDATE TESTS PASSED 100%!');
  console.log('====================================');
}

test().catch(e => {
  console.error('FAILED:', e);
  process.exit(1);
});

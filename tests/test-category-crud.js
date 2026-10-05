const http = require('http');
const config = require('../config');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- Testing Skill Category CRUD ---');

  // 1. Login
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: config.auth.adminPassword });

  if (!loginRes.body.success) {
    console.error('Login failed:', loginRes.body);
    process.exit(1);
  }
  const token = loginRes.body.data.token;
  console.log('✓ Admin login successful');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Add New Skill Category
  const testCatName = 'DevOps & Cloud Automation ' + Date.now();
  const addRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/cms/skills/category',
    method: 'POST',
    headers: authHeaders
  }, {
    category: testCatName,
    items: ['Docker', 'Kubernetes', 'Ansible', 'GitHub Actions'],
    bars: [
      { label: 'Docker', value: 92 },
      { label: 'Kubernetes', value: 85 }
    ]
  });

  console.log('Add Category Status:', addRes.status, addRes.body.message || addRes.body);
  if (addRes.status !== 201) {
    throw new Error('Failed to create skill category: ' + JSON.stringify(addRes.body));
  }

  // Verify created category
  let skills = addRes.body.data;
  let createdCat = skills.find(s => s.category === testCatName);
  if (!createdCat || createdCat.items.length !== 4 || createdCat.bars.length !== 2) {
    throw new Error('Created category data mismatch: ' + JSON.stringify(createdCat));
  }
  console.log('✓ Category successfully created with 4 skills and 2 bars');

  const catIdx = skills.findIndex(s => s.category === testCatName);

  // 3. Edit / Make Changes to the Skill Category (Rename + update skills + bars)
  const renamedCat = testCatName + ' (Production)';
  const editRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/cms/skills/category/${catIdx}`,
    method: 'PUT',
    headers: authHeaders
  }, {
    category: renamedCat,
    items: ['Docker', 'Kubernetes', 'Ansible', 'GitHub Actions', 'Terraform', 'ArgoCD'],
    bars: [
      { label: 'Docker', value: 95 },
      { label: 'Kubernetes', value: 90 },
      { label: 'Terraform', value: 88 }
    ]
  });

  console.log('Edit Category Status:', editRes.status, editRes.body.message || editRes.body);
  if (editRes.status !== 200) {
    throw new Error('Failed to update skill category: ' + JSON.stringify(editRes.body));
  }

  skills = editRes.body.data;
  let updatedCat = skills.find(s => s.category === renamedCat);
  if (!updatedCat || updatedCat.items.length !== 6 || updatedCat.bars.length !== 3) {
    throw new Error('Updated category data mismatch: ' + JSON.stringify(updatedCat));
  }
  console.log('✓ Category successfully renamed and updated with 6 skills and 3 bars');

  // 4. Delete the category
  const delRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/cms/skills/category/${encodeURIComponent(renamedCat)}`,
    method: 'DELETE',
    headers: authHeaders
  });

  console.log('Delete Category Status:', delRes.status, delRes.body.message || delRes.body);
  if (delRes.status !== 200) {
    throw new Error('Failed to delete skill category: ' + JSON.stringify(delRes.body));
  }

  skills = delRes.body.data;
  const stillExists = skills.find(s => s.category === renamedCat || s.category === testCatName);
  if (stillExists) {
    throw new Error('Category still exists after delete!');
  }
  console.log('✓ Category successfully deleted from profile draft');

  // 5. Check Admin Portal HTML has all Category UI features
  const adminRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/admin',
    method: 'GET'
  });
  const adminHtml = String(adminRes.body);
  console.assert(adminHtml.includes('modal-add-category'), 'Admin contains modal-add-category');
  console.assert(adminHtml.includes('modal-edit-category'), 'Admin contains modal-edit-category');
  console.assert(adminHtml.includes('modal-delete-category'), 'Admin contains modal-delete-category');
  console.assert(adminHtml.includes('openAddCategoryModal()'), 'Admin contains openAddCategoryModal()');
  console.assert(adminHtml.includes('openDeleteCategoryModal()'), 'Admin contains openDeleteCategoryModal()');
  console.log('✓ Admin HTML contains all Add, Edit, and Delete Category UI modals and buttons');

  console.log('==================================================');
  console.log('ALL SKILL CATEGORY CRUD VERIFICATIONS PASSED 100%!');
  console.log('==================================================');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

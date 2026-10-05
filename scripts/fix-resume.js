const fs = require('fs');
const path = require('path');

const srcPdf = path.resolve(__dirname, '../Thimmareddygari_Harshavardhan_Reddy_Resume.pdf');
const mediaDir = path.resolve(__dirname, '../storage/media');
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

const targets = [
  'Harsha_Resume_1791125507509.pdf',
  'Harsha_Resume_1791171427193.pdf',
  'Harsha_Resume_1791171536236.pdf',
  'Harsha_Resume_1791171699991.pdf',
  'Harsha_Resume_1791171832917.pdf',
  'Harsha_Resume_Latest.pdf',
  'Thimmareddygari_Harshavardhan_Reddy_Resume.pdf'
];

targets.forEach(t => {
  fs.copyFileSync(srcPdf, path.join(mediaDir, t));
  console.log('Copied to media:', t);
});

// Update data/db.json
const dbPath = path.resolve(__dirname, '../data/db.json');
if (fs.existsSync(dbPath)) {
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const resumeObj = {
    url: '/Thimmareddygari_Harshavardhan_Reddy_Resume.pdf',
    label: 'Download Resume',
    updatedAt: new Date().toISOString()
  };
  if (dbData.draft) dbData.draft.resume = resumeObj;
  if (dbData.published) dbData.published.resume = resumeObj;
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  console.log('Updated db.json draft and published resume');
}

// Update profile.js
const profilePath = path.resolve(__dirname, '../profile.js');
if (fs.existsSync(profilePath)) {
  let content = fs.readFileSync(profilePath, 'utf8');
  content = content.replace(/"resume":\s*\{[\s\S]*?\}/, `"resume": {\n    "url": "/Thimmareddygari_Harshavardhan_Reddy_Resume.pdf",\n    "label": "Download Resume",\n    "updatedAt": "${new Date().toISOString()}"\n  }`);
  fs.writeFileSync(profilePath, content, 'utf8');
  console.log('Updated profile.js resume');
}

console.log('Fix completed successfully.');

/**
 * Express Application Setup
 * Configures middleware, security headers, routing, and error handlers.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('../../config');
const upload = require('../infrastructure/storage/multerConfig');
const responseHelper = require('../shared/utils/responseHelper');
const logger = require('../shared/utils/logger');

const fs = require('fs');
const db = require('../infrastructure/database/db');

// Controllers & Middlewares
const { requireAuth } = require('../domains/authentication/middleware/authMiddleware');
const authController = require('../domains/authentication/controllers/authController');
const profileController = require('../domains/profile/controllers/profileController');
const documentController = require('../domains/documents/controllers/documentController');
const socialController = require('../domains/social-profiles/controllers/socialController');
const adminController = require('../domains/admin/controllers/adminController');
const cmsController = require('../domains/admin/controllers/cmsController');
const aiController = require('../domains/ai/controllers/aiController');
const verificationController = require('../domains/verification/controllers/verificationController');

const app = express();

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── AUTHENTICATION ROUTES ───────────────────────────────────────────────────
app.post('/api/auth/login', authController.login);
app.post('/api/auth/logout', authController.logout);
app.get('/api/auth/me', requireAuth, authController.me);
app.post('/api/auth/change-password', requireAuth, authController.changePassword);

// ─── PUBLIC PROFILE ROUTE ────────────────────────────────────────────────────
app.get('/api/profile', profileController.getPublished);

// ─── PRIVATE PROFILE MANAGEMENT ROUTES ───────────────────────────────────────
app.get('/api/profile/draft', requireAuth, profileController.getDraft);
app.put('/api/profile/draft', requireAuth, profileController.updateDraft);
app.post('/api/profile/publish', requireAuth, profileController.publish);
app.post('/api/profile/rollback', requireAuth, profileController.rollback);

// ─── PRIVATE DOCUMENT MANAGEMENT ROUTES ─────────────────────────────────────
app.post('/api/documents/upload', requireAuth, upload.single('file'), documentController.upload);
app.get('/api/documents', requireAuth, documentController.list);
app.get('/api/documents/:id', requireAuth, documentController.getById);
app.get('/api/documents/:id/view', documentController.view);
app.get('/api/documents/:id/download', documentController.download);
app.delete('/api/documents/:id', requireAuth, documentController.delete);

// ─── PRIVATE SOCIAL INTEGRATION ROUTES ──────────────────────────────────────
app.get('/api/social/status', requireAuth, socialController.getStatus);
app.get('/api/social/providers', requireAuth, socialController.getProviderCapabilities);
app.post('/api/social/github/sync', requireAuth, socialController.syncGitHub);
app.post('/api/social/github/import-repo', requireAuth, socialController.importGitHubRepo);
app.put('/api/social/links', requireAuth, socialController.updateLinks);
app.post('/api/social/sync-all', requireAuth, socialController.syncAllPlatforms);
app.post('/api/social/platforms/:id/sync', requireAuth, socialController.syncPlatform);
app.post('/api/social/platforms/verify-url', requireAuth, socialController.verifyPlatformUrl);
app.post('/api/social/platforms', requireAuth, socialController.addPlatform);
app.put('/api/social/platforms/:id', requireAuth, socialController.updatePlatform);
app.delete('/api/social/platforms/:id', requireAuth, socialController.removePlatform);


// ─── PRIVATE ADMIN DASHBOARD & APPROVAL ROUTES ──────────────────────────────
app.get('/api/admin/stats', requireAuth, adminController.getDashboardStats);
app.get('/api/admin/pending', requireAuth, adminController.getPendingChanges);
app.post('/api/admin/pending/:id/approve', requireAuth, adminController.approveChange);
app.post('/api/admin/pending/:id/reject', requireAuth, adminController.rejectChange);
app.post('/api/admin/pending/:id/ignore', requireAuth, adminController.ignoreChange);
app.post('/api/admin/pending/approve-all', requireAuth, adminController.approveAll);
app.post('/api/admin/pending/reject-all', requireAuth, adminController.rejectAll);
app.get('/api/admin/history', requireAuth, adminController.getAuditHistory);
app.get('/api/admin/history/snapshots/:filename', requireAuth, adminController.getSnapshot);
app.post('/api/admin/history/snapshots', requireAuth, adminController.createSnapshot);
app.delete('/api/admin/history/snapshots/:filename', requireAuth, adminController.deleteSnapshot);
app.get('/api/admin/search', requireAuth, adminController.globalSearch);

// ─── PRIVATE CMS CONTENT MANAGEMENT ROUTES ─────────────────────────────────
app.put('/api/cms/profile-hero', requireAuth, cmsController.updateProfileHero);
app.put('/api/cms/about', requireAuth, cmsController.updateAbout);

// Skills CRUD
app.get('/api/cms/skills', requireAuth, cmsController.getSkills);
app.post('/api/cms/skills', requireAuth, cmsController.addSkill);
app.post('/api/cms/skills/category', requireAuth, cmsController.addSkillCategory);
app.put('/api/cms/skills/category/:index', requireAuth, cmsController.updateSkillCategory);
app.put('/api/cms/skills/:index', requireAuth, cmsController.updateSkillCategory);
app.delete('/api/cms/skills/category/:identifier', requireAuth, cmsController.deleteSkillCategory);
app.delete('/api/cms/skills/category', requireAuth, cmsController.deleteSkillCategory);
app.delete('/api/cms/skills', requireAuth, cmsController.deleteSkill);

// Education CRUD
app.get('/api/cms/education', requireAuth, cmsController.getEducation);
app.post('/api/cms/education', requireAuth, cmsController.addEducation);
app.put('/api/cms/education/:index', requireAuth, cmsController.updateEducation);
app.delete('/api/cms/education/:index', requireAuth, cmsController.deleteEducation);

// Experience & Internships CRUD
app.get('/api/cms/experience', requireAuth, cmsController.getExperience);
app.post('/api/cms/experience', requireAuth, cmsController.addExperience);
app.put('/api/cms/experience/:id', requireAuth, cmsController.updateExperience);
app.delete('/api/cms/experience/:id', requireAuth, cmsController.deleteExperience);

// Projects CMS CRUD
app.get('/api/cms/projects', requireAuth, cmsController.getProjects);
app.post('/api/cms/projects', requireAuth, cmsController.addProject);
app.put('/api/cms/projects/:id', requireAuth, cmsController.updateProject);
app.delete('/api/cms/projects/:id', requireAuth, cmsController.deleteProject);

// Certifications CRUD
app.get('/api/cms/certifications', requireAuth, cmsController.getCertifications);
app.post('/api/cms/certifications', requireAuth, cmsController.addCertification);
app.put('/api/cms/certifications/:id', requireAuth, cmsController.updateCertification);
app.delete('/api/cms/certifications/:id', requireAuth, cmsController.deleteCertification);

// Achievements CRUD
app.get('/api/cms/achievements', requireAuth, cmsController.getAchievements);
app.post('/api/cms/achievements', requireAuth, cmsController.addAchievement);
app.put('/api/cms/achievements/:id', requireAuth, cmsController.updateAchievement);
app.delete('/api/cms/achievements/:id', requireAuth, cmsController.deleteAchievement);

// Resume Management
app.get('/api/cms/resume', requireAuth, cmsController.getResume);
app.put('/api/cms/resume', requireAuth, cmsController.updateResume);
app.post('/api/cms/resume/upload', requireAuth, upload.single('resume'), cmsController.uploadResumeFile);

// Section Visibility & Navigation
app.get('/api/cms/sections', requireAuth, cmsController.getSections);
app.put('/api/cms/sections', requireAuth, cmsController.updateSections);

// SEO & Meta
app.get('/api/cms/seo', requireAuth, cmsController.getSeo);
app.put('/api/cms/seo', requireAuth, cmsController.updateSeo);

// Media Library
const mediaUpload = upload.fields([{ name: 'media', maxCount: 1 }, { name: 'file', maxCount: 1 }]);
app.get('/api/cms/media', requireAuth, cmsController.listMedia);
app.get('/api/media', requireAuth, cmsController.listMedia);
app.post('/api/cms/media/upload', requireAuth, mediaUpload, cmsController.uploadMediaFile);
app.post('/api/media/upload', requireAuth, mediaUpload, cmsController.uploadMediaFile);
app.delete('/api/cms/media/:filename', requireAuth, cmsController.deleteMedia);
app.delete('/api/media/:filename', requireAuth, cmsController.deleteMedia);

// Backup & Restore
app.get('/api/cms/backup/export', requireAuth, cmsController.exportBackup);
app.post('/api/cms/backup/restore', requireAuth, cmsController.restoreBackup);

// Competitive & Coding Profiles CRUD + Telemetry
app.get('/api/cms/coding-profiles', requireAuth, cmsController.getCodingProfiles);
app.post('/api/cms/coding-profiles', requireAuth, cmsController.addCodingProfile);
app.put('/api/cms/coding-profiles/:id', requireAuth, cmsController.updateCodingProfile);
app.delete('/api/cms/coding-profiles/:id', requireAuth, cmsController.deleteCodingProfile);
app.put('/api/cms/telemetry-stats', requireAuth, cmsController.updateTelemetry);
app.get('/api/cms/fetch-platform-stats', requireAuth, cmsController.fetchPlatformStats);

// ─── PRIVATE AI PORTFOLIO AGENT ROUTES ──────────────────────────────────────
app.post('/api/ai/chat', requireAuth, upload.array('files', 5), aiController.chat);
app.get('/api/ai/conversations', requireAuth, aiController.getConversations);
app.delete('/api/ai/conversations', requireAuth, aiController.clearConversations);
app.get('/api/ai/changesets', requireAuth, aiController.getChangeSets);
app.get('/api/ai/changesets/:id', requireAuth, aiController.getChangeSetById);
app.post('/api/ai/changesets/:id/approve', requireAuth, aiController.approveChangeSet);
app.post('/api/ai/changesets/:id/reject', requireAuth, aiController.rejectChangeSet);
app.post('/api/ai/audit', requireAuth, aiController.runAudit);
app.get('/api/ai/audit/latest', requireAuth, aiController.getLatestAudit);
app.post('/api/ai/search', requireAuth, aiController.search);
app.post('/api/ai/generate-description', requireAuth, aiController.generateDescription);
app.get('/api/ai/duplicates', requireAuth, aiController.findDuplicates);
app.get('/api/ai/versions', requireAuth, aiController.getContentVersions);

// ─── PRIVATE VERIFICATION-FIRST CREDENTIAL & INTERNSHIP ROUTES ─────────────
const verificationUpload = upload.fields([
  { name: 'certificate', maxCount: 1 },
  { name: 'offerLetter', maxCount: 1 },
  { name: 'completionCert', maxCount: 1 },
  { name: 'internshipReport', maxCount: 1 }
]);

app.post('/api/verification/certificates/verify', requireAuth, upload.single('certificate'), verificationController.verifyCertificate);
app.post('/api/verification/certificates/save', requireAuth, upload.single('certificate'), verificationController.saveVerifiedCertificate);
app.post('/api/verification/internships/verify', requireAuth, verificationUpload, verificationController.verifyInternship);
app.post('/api/verification/internships/save', requireAuth, verificationUpload, verificationController.saveVerifiedInternship);
app.post('/api/verification/internships/extract-candidate-id', requireAuth, upload.single('offerLetter'), verificationController.extractCandidateId);
app.get('/api/verification/records', requireAuth, verificationController.listVerifiedRecords);
app.get('/api/verification/audit-log', requireAuth, verificationController.getAuditLog);

// ─── PRIVATE ADMIN PORTAL WEB PAGE ──────────────────────────────────────────
// Route is unlisted in public portfolio, protected on frontend & backend
app.get('/admin', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.resolve(__dirname, '../domains/admin/views/adminDashboard.html'));
});

// Dedicated AI Agent route directly accessible by admin
app.get('/admin/ai-agent', (req, res) => {
  res.redirect('/admin#tab-ai-agent');
});

// ─── LIVE DRAFT PREVIEW ──────────────────────────────────────────────────────
app.get('/preview', requireAuth, (req, res) => {
  const indexPath = config.paths.indexHtml;
  let html = fs.readFileSync(indexPath, 'utf-8');
  const draft = db.get('draft') || {};
  const injection = `
    <script>
      window.__PREVIEW_MODE__ = true;
      window.PROFILE = ${JSON.stringify(draft)};
    </script>
    <div id="draft-preview-banner" style="position: fixed; bottom: 20px; right: 20px; z-index: 999999; background: linear-gradient(135deg, #d4a843, #f5d47a); color: #06060e; padding: 10px 20px; border-radius: 30px; font-weight: 700; font-family: 'DM Sans', sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 14px; border: 1px solid rgba(255,255,255,0.4);">
      <span style="display: flex; align-items: center; gap: 6px;"><span>👁️</span> <strong>DRAFT PREVIEW MODE</strong></span>
      <a href="/admin" style="background: #06060e; color: #fff; padding: 5px 12px; border-radius: 14px; font-size: 11px; text-decoration: none; font-weight: 600;">Return to Admin Console</a>
    </div>
  `;
  html = html.replace('</body>', `${injection}</body>`);
  res.send(html);
});

// Serve media storage files
app.use('/media', express.static(path.resolve(__dirname, '../../storage/media')));

// Serve admin static assets (css, js) with no-cache so updates reflect immediately
app.use('/admin-assets', express.static(path.resolve(__dirname, '../domains/admin/views'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// ─── SERVE PUBLIC PORTFOLIO STATIC FILES ─────────────────────────────────────
app.use(express.static(config.paths.root, {
  index: 'index.html',
  maxAge: config.isDev ? 0 : '1h'
}));

// Fallback to 404.html for non-existent static assets
app.use((req, res) => {
  if (req.accepts('html')) {
    const errorPage = path.join(config.paths.root, '404.html');
    return res.status(404).sendFile(errorPage);
  }
  return responseHelper.notFound(res, 'Route not found');
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled express error', err);
  if (err.message && err.message.includes('File type')) {
    return responseHelper.badRequest(res, err.message);
  }
  return responseHelper.error(res, err.message || 'Server error occurred');
});

module.exports = app;

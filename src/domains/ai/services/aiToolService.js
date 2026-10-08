/**
 * AI Controlled Tool / Action Service
 * Executes validated actions, prepares change sets, and enforces safety boundaries.
 */

const fs = require('fs');
const path = require('path');
const db = require('../../../infrastructure/database/db');
const cmsService = require('../../admin/services/cmsService');
const profileService = require('../../profile/services/profileService');
const { AIProviderFactory } = require('../providers/aiProvider');
const logger = require('../../../shared/utils/logger');
const config = require('../../../../config');

class AIToolService {
  constructor() {
    this.provider = AIProviderFactory.getProvider();
  }

  // 1. Document & Text Analysis
  async analyzeDocument({ filePath, filename, mimeType, textContent }) {
    let text = textContent || '';
    let base64Data = null;

    if (filePath && fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        base64Data = fs.readFileSync(filePath).toString('base64');
      } else if (ext === '.pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          text = pdfData.text || '';
          base64Data = dataBuffer.toString('base64');
        } catch (e) {
          logger.warn(`Could not extract PDF text for ${filename}, passing raw stream`, e);
          base64Data = fs.readFileSync(filePath).toString('base64');
        }
      } else {
        try {
          text = fs.readFileSync(filePath, 'utf-8');
        } catch (e) {
          text = '';
        }
      }
    }

    return this.provider.analyzeDocument({
      text,
      mimeType: mimeType || 'application/pdf',
      filename: filename || (filePath ? path.basename(filePath) : 'document'),
      base64Data
    });
  }

  // 2. Classify Document
  async classifyDocument({ text, filename }) {
    const analysis = await this.provider.analyzeDocument({ text, filename });
    return {
      docType: analysis.docType || 'Other',
      category: analysis.category || 'General',
      confidence: analysis.confidence || 0.8
    };
  }

  // 3. Extract Document Data
  async extractDocumentData({ text, docType }) {
    const analysis = await this.provider.analyzeDocument({ text });
    return analysis.extracted || {};
  }

  // 4. Generate & Rewrite Descriptions
  async generateDescription({ text, context = '', style = 'professional' }) {
    if (!text || text.trim().length < 3) {
      return 'Insufficient information to generate this accurately.';
    }

    const prompt = `Context: ${context}\nGenerate a ${style} description based on:\n${text}`;
    return this.provider.generateText({
      prompt,
      systemPrompt: 'You are a professional technical portfolio writer. Never invent facts. Base the description strictly on the provided input.'
    });
  }

  // 5. Analyze Image
  async analyzeImage({ filePath, filename, mimeType }) {
    let base64Data = null;
    if (filePath && fs.existsSync(filePath)) {
      base64Data = fs.readFileSync(filePath).toString('base64');
    }
    return this.provider.analyzeImage({
      base64Data,
      mimeType: mimeType || 'image/jpeg',
      filename: filename || (filePath ? path.basename(filePath) : 'image.jpg')
    });
  }

  // 6. Upload Media to Secure Storage
  async uploadMedia({ sourcePath, originalName, category = 'General' }) {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error('Valid source media file path is required');
    }
    const ext = path.extname(sourcePath) || (originalName ? path.extname(originalName) : '.jpg');
    cmsService.ensureMediaDir();
    const targetDir = cmsService.mediaDir;

    const targetPath = path.join(targetDir, safeName);
    fs.copyFileSync(sourcePath, targetPath);

    return {
      filename: safeName,
      originalName: originalName || path.basename(sourcePath),
      url: `/media/${safeName}`,
      category
    };
  }

  // 7. Set Avatar
  async setAvatar({ imageUrl, altText = 'Harshavardhan Reddy Profile Photo' }, user = 'ai_agent') {
    if (!imageUrl) throw new Error('Image URL is required to set avatar');
    const draft = db.get('draft') || {};
    const oldAvatar = draft.avatar || 'Photo from 🖤⃝🦋𓍯𓂃𓏧♡🫵🏻🫶🏻.jpg';

    draft.avatar = imageUrl;
    draft.avatarAlt = altText;
    db.set('draft', draft);

    db.addContentVersion({
      entity: 'profile',
      entityId: 'avatar',
      field: 'avatar',
      oldValue: oldAvatar,
      newValue: imageUrl,
      changeSource: 'AI Agent'
    });

    db.addHistory({
      field: 'profile_avatar',
      oldValue: oldAvatar,
      newValue: imageUrl,
      source: 'AI Agent Avatar Update',
      status: 'Draft Updated',
      approvedBy: user
    });

    return { success: true, avatar: imageUrl, previous: oldAvatar };
  }

  // 8. Projects Management Tools
  async createProject(projectData, user = 'ai_agent') {
    return cmsService.addProject(projectData, user);
  }

  async updateProject(id, projectData, user = 'ai_agent') {
    return cmsService.updateProject(id, projectData, user);
  }

  // 9. Certifications Management Tools
  async createCertification(certData, user = 'ai_agent') {
    return cmsService.addCertification(certData, user);
  }

  async updateCertification(id, certData, user = 'ai_agent') {
    return cmsService.updateCertification(id, certData, user);
  }

  // 10. Experience & Internships Tools
  async createExperience(expData, user = 'ai_agent') {
    return cmsService.addExperience(expData, user);
  }

  async updateExperience(id, expData, user = 'ai_agent') {
    return cmsService.updateExperience(id, expData, user);
  }

  // 11. Profile, About, Skills & Education Tools
  async updateProfile(profileData, user = 'ai_agent') {
    return cmsService.updateProfileHero(profileData, user);
  }

  async updateSkills(category, skill, proficiency, user = 'ai_agent') {
    return cmsService.addSkill({ category, skill, proficiency }, user);
  }

  async updateEducation(eduData, user = 'ai_agent') {
    return cmsService.addEducation(eduData, user);
  }

  async updateAchievements(achData, user = 'ai_agent') {
    return cmsService.addAchievement(achData, user);
  }

  async updateSEO(seoData, user = 'ai_agent') {
    return cmsService.updateSeo(seoData, user);
  }

  // 12. Search Portfolio
  searchPortfolio(query) {
    const qLower = (query || '').toLowerCase().trim();
    const draft = db.get('draft') || {};
    const results = {
      projects: [],
      skills: [],
      certifications: [],
      experience: [],
      education: []
    };

    if (!qLower) return results;

    // Search Projects
    (draft.projects || []).forEach(p => {
      const match = (p.title && p.title.toLowerCase().includes(qLower)) ||
        (p.description && p.description.toLowerCase().includes(qLower)) ||
        (Array.isArray(p.technologies) && p.technologies.some(t => t.toLowerCase().includes(qLower)));
      if (match) results.projects.push(p);
    });

    // Search Skills
    (draft.skills || []).forEach(cat => {
      const matchingItems = (cat.items || []).filter(item => item.toLowerCase().includes(qLower));
      if (matchingItems.length > 0 || (cat.category && cat.category.toLowerCase().includes(qLower))) {
        results.skills.push({ category: cat.category, matchedItems: matchingItems });
      }
    });

    // Search Certifications
    (draft.certifications || []).forEach(c => {
      const match = (c.name && c.name.toLowerCase().includes(qLower)) ||
        (c.issuer && c.issuer.toLowerCase().includes(qLower)) ||
        (c.credentialId && c.credentialId.toLowerCase().includes(qLower));
      if (match) results.certifications.push(c);
    });

    // Search Experience
    (draft.experience || []).forEach(e => {
      const match = (e.role && e.role.toLowerCase().includes(qLower)) ||
        (e.company && e.company.toLowerCase().includes(qLower)) ||
        (Array.isArray(e.responsibilities) && e.responsibilities.some(r => r.toLowerCase().includes(qLower)));
      if (match) results.experience.push(e);
    });

    return results;
  }

  // 13. Find Duplicates
  findDuplicates() {
    const draft = db.get('draft') || {};
    const duplicates = [];

    // Check Duplicate Projects
    const projectTitles = {};
    (draft.projects || []).forEach(p => {
      const key = (p.title || '').toLowerCase().trim();
      if (!key) return;
      if (projectTitles[key]) {
        duplicates.push({ section: 'Projects', item: p.title, detail: `Duplicate project title "${p.title}"` });
      } else {
        projectTitles[key] = true;
      }
    });

    // Check Duplicate Skills
    const skillSet = {};
    (draft.skills || []).forEach(cat => {
      (cat.items || []).forEach(skill => {
        const key = skill.toLowerCase().trim();
        if (skillSet[key]) {
          duplicates.push({ section: 'Skills', item: skill, detail: `Skill "${skill}" exists in multiple categories` });
        } else {
          skillSet[key] = cat.category;
        }
      });
    });

    // Check Duplicate Certifications
    const certNames = {};
    (draft.certifications || []).forEach(c => {
      const key = (c.name || '').toLowerCase().trim();
      if (!key) return;
      if (certNames[key]) {
        duplicates.push({ section: 'Certifications', item: c.name, detail: `Duplicate certification "${c.name}"` });
      } else {
        certNames[key] = true;
      }
    });

    return duplicates;
  }

  // 14. Compare Resume with Portfolio
  compareDocuments({ resumeData, currentProfile }) {
    const profile = currentProfile || db.get('draft') || {};
    const resumeSkills = resumeData.skills || [];
    const currentSkills = (profile.skills || []).flatMap(g => g.items || []).map(s => s.toLowerCase());

    const newSkills = resumeSkills.filter(s => !currentSkills.includes(s.toLowerCase()));
    const existingSkills = resumeSkills.filter(s => currentSkills.includes(s.toLowerCase()));

    // Projects comparison
    const resumeProjects = resumeData.projects || [];
    const currentProjectTitles = (profile.projects || []).map(p => (p.title || '').toLowerCase());
    const newProjects = resumeProjects.filter(p => !currentProjectTitles.includes((p.title || p).toLowerCase()));

    return {
      newInformation: {
        skills: newSkills,
        projects: newProjects
      },
      duplicateInformation: {
        skills: existingSkills
      },
      missingInformation: {
        headline: !profile.title ? 'Professional headline is missing' : null,
        objective: !(profile.about && profile.about.careerObjective) ? 'Career objective is missing' : null
      }
    };
  }

  // 15. Create ChangeSet
  createChangeSet({ changes = [], sourceDocument = 'Manual Request', reasoning = '' }) {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new Error('ChangeSet must contain at least one proposed change');
    }

    const changeSet = {
      id: `cs_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sourceDocument,
      reasoning: reasoning || 'AI proposed portfolio updates based on analyzed content.',
      affectedSections: Array.from(new Set(changes.map(c => c.section))),
      changes: changes.map((c, idx) => ({
        id: `chg_${Date.now()}_${idx}`,
        section: c.section,
        field: c.field || 'entry',
        label: c.label || `${c.section} update`,
        oldValue: c.oldValue !== undefined ? c.oldValue : 'None',
        proposedValue: c.proposedValue !== undefined ? c.proposedValue : c.payload,
        status: 'PENDING_REVIEW',
        payload: c.payload
      })),
      status: 'PENDING_REVIEW'
    };

    return db.addAiChangeSet(changeSet);
  }

  // 16. Preview Changes
  previewChanges(changeSetId) {
    const cs = db.getAiChangeSet(changeSetId);
    if (!cs) throw new Error(`ChangeSet "${changeSetId}" not found`);
    return {
      id: cs.id,
      sourceDocument: cs.sourceDocument,
      reasoning: cs.reasoning,
      status: cs.status,
      changes: cs.changes
    };
  }

  // 17. Approve and Apply ChangeSet
  async approveChangeSet(changeSetId, selectedChangeIds = null, user = 'admin') {
    const cs = db.getAiChangeSet(changeSetId);
    if (!cs) throw new Error(`ChangeSet "${changeSetId}" not found`);

    const appliedChanges = [];
    for (const change of cs.changes) {
      if (selectedChangeIds && !selectedChangeIds.includes(change.id)) {
        continue;
      }

      try {
        await this.applySingleChange(change, user);
        change.status = 'APPROVED';
        appliedChanges.push(change.id);
      } catch (err) {
        logger.error(`Error applying change ${change.id}`, err);
        change.status = 'ERROR';
        change.error = err.message;
      }
    }

    const allApproved = cs.changes.every(c => c.status === 'APPROVED');
    const anyApproved = cs.changes.some(c => c.status === 'APPROVED');
    cs.status = allApproved ? 'APPROVED' : (anyApproved ? 'PARTIALLY_APPROVED' : 'REJECTED');
    cs.reviewedAt = new Date().toISOString();
    cs.approvedBy = user;

    db.updateAiChangeSet(changeSetId, cs);
    return { success: true, changeSet: cs, appliedCount: appliedChanges.length };
  }

  // 18. Reject ChangeSet
  rejectChangeSet(changeSetId, reason = 'Rejected by administrator', user = 'admin') {
    const cs = db.getAiChangeSet(changeSetId);
    if (!cs) throw new Error(`ChangeSet "${changeSetId}" not found`);

    cs.status = 'REJECTED';
    cs.rejectionReason = reason;
    cs.reviewedAt = new Date().toISOString();
    cs.approvedBy = user;
    cs.changes.forEach(c => { c.status = 'REJECTED'; });

    db.updateAiChangeSet(changeSetId, cs);
    return { success: true, changeSet: cs };
  }

  // Apply single change helper
  async applySingleChange(change, user = 'admin') {
    const { section, payload } = change;
    const p = payload || change.proposedValue;

    switch (section.toLowerCase()) {
      case 'certifications':
        if (p.id) {
          cmsService.updateCertification(p.id, p, user);
        } else {
          cmsService.addCertification(p, user);
        }
        break;

      case 'projects':
        if (p.id) {
          cmsService.updateProject(p.id, p, user);
        } else {
          cmsService.addProject(p, user);
        }
        break;

      case 'skills':
        if (Array.isArray(p.skills)) {
          p.skills.forEach(skill => {
            cmsService.addSkill({ category: p.category || 'Languages', skill }, user);
          });
        } else if (p.skill || p.name) {
          cmsService.addSkill(p, user);
        }
        break;

      case 'experience':
        if (p.id) {
          cmsService.updateExperience(p.id, p, user);
        } else {
          cmsService.addExperience(p, user);
        }
        break;

      case 'education':
        cmsService.addEducation(p, user);
        break;

      case 'achievements':
        if (p.id) {
          cmsService.updateAchievement(p.id, p, user);
        } else {
          cmsService.addAchievement(p, user);
        }
        break;

      case 'avatar':
      case 'profile_avatar':
        await this.setAvatar({ imageUrl: p.url || p.avatar || p, altText: p.altText }, user);
        break;

      case 'profile':
      case 'hero':
        cmsService.updateProfileHero(p, user);
        break;

      case 'about':
        cmsService.updateAbout(p, user);
        break;

      case 'seo':
        cmsService.updateSeo(p, user);
        break;

      case 'resume':
        if (p.filename || p.url) {
          cmsService.updateResume({
            resumeUrl: p.url || p.filename,
            displayName: p.displayName || 'Active Resume'
          }, user);
        }
        break;

      default:
        logger.warn(`Unknown section "${section}" in single change execution`);
    }
  }

  // 19. Publish Changes
  publishChanges(user = 'admin') {
    return profileService.publishDraft(user);
  }

  // 20. Rollback Changes
  rollbackChanges(snapshotName, user = 'admin') {
    return profileService.rollback(snapshotName, user);
  }
}

module.exports = new AIToolService();

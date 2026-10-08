/**
 * CMS Service
 * Handles full CRUD operations across all portfolio domains:
 * Projects, Skills, Experience, Education, Certifications, Achievements,
 * Resume, Media Library, Section Visibility, SEO, and Backups.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../../../../config');
const db = require('../../../infrastructure/database/db');
const syncProfileService = require('../../profile/services/syncProfileService');
const logger = require('../../../shared/utils/logger');

class CmsService {
  constructor() {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.isServerless = isServerless;
    this.bundledMediaDir = path.resolve(__dirname, '../../../../storage/media');
    this.mediaDir = isServerless ? '/tmp/storage/media' : this.bundledMediaDir;
    this.ensureMediaDir();
  }

  ensureMediaDir() {
    try {
      if (!fs.existsSync(this.mediaDir)) {
        fs.mkdirSync(this.mediaDir, { recursive: true });
      }
    } catch (e) {
      logger.warn('Could not ensure mediaDir:', e.message);
    }
  }

  /* ── Helper: Save Draft & Log History & Sync Live ── */
  saveDraftAndLog(field, oldValue, newValue, actionDescription, approvedBy = 'admin') {
    // 1. Keep draft and published in sync so all admin edits display immediately on portfolio
    const draft = db.get('draft') || {};
    db.set('draft', draft);
    db.set('published', JSON.parse(JSON.stringify(draft)));
    db.save();

    // 2. Synchronize to profile.js and index.html
    try {
      syncProfileService.syncToFiles(draft);
    } catch (e) {
      logger.warn(`Could not sync to profile.js/index.html: ${e.message}`);
    }

    db.addHistory({
      field,
      oldValue: typeof oldValue === 'object' ? JSON.stringify(oldValue).slice(0, 100) : String(oldValue || 'None'),
      newValue: typeof newValue === 'object' ? JSON.stringify(newValue).slice(0, 100) : String(newValue || 'Updated'),
      source: 'Admin CMS',
      status: 'Published Live',
      approvedBy
    });
    logger.info(`[CMS] ${actionDescription} by ${approvedBy} and synchronized live`);
  }

  /* ── 1. Profile & Hero ── */
  updateProfileHero(data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    const oldName = draft.name;

    if (data.name !== undefined) draft.name = data.name.trim();
    if (data.shortName !== undefined) draft.shortName = data.shortName.trim();
    if (data.nickname !== undefined) draft.nickname = data.nickname.trim();
    if (data.headline !== undefined) draft.headline = data.headline.trim();
    if (data.heroTag !== undefined) draft.heroTag = data.heroTag.trim();
    if (data.heroDesc !== undefined) draft.heroDesc = data.heroDesc.trim();
    if (data.pageTitle !== undefined) draft.pageTitle = data.pageTitle.trim();
    if (data.profileImage !== undefined) draft.profileImage = data.profileImage.trim();

    if (data.contact) {
      draft.contact = draft.contact || {};
      if (data.contact.email !== undefined) draft.contact.email = data.contact.email.trim();
      if (data.contact.phone !== undefined) draft.contact.phone = data.contact.phone.trim();
      if (data.contact.location !== undefined) draft.contact.location = data.contact.location.trim();
      if (data.contact.availability !== undefined) draft.contact.availability = data.contact.availability.trim();
    }

    if (Array.isArray(data.heroStats)) {
      draft.heroStats = data.heroStats;
    }
    if (Array.isArray(data.heroTags)) {
      draft.heroTags = data.heroTags;
    }
    if (Array.isArray(data.marqueeItems)) {
      draft.marqueeItems = data.marqueeItems;
    }
    if (data.heroCtas) {
      draft.heroCtas = draft.heroCtas || {};
      if (data.heroCtas.cta1) {
        draft.heroCtas.cta1 = {
          label: String(data.heroCtas.cta1.label || '').trim(),
          url: String(data.heroCtas.cta1.url || '').trim()
        };
      }
      if (data.heroCtas.cta2) {
        draft.heroCtas.cta2 = {
          label: String(data.heroCtas.cta2.label || '').trim(),
          url: String(data.heroCtas.cta2.url || '').trim()
        };
      }
    }
    if (data.resume) {
      draft.resume = draft.resume || {};
      if (data.resume.url) draft.resume.url = String(data.resume.url).trim();
      if (data.resume.label) draft.resume.label = String(data.resume.label).trim();
      draft.resume.updatedAt = new Date().toISOString();

      // Also update published profile and synchronize live files
      const published = db.get('published');
      if (published) {
        published.resume = { ...draft.resume };
        db.set('published', published);
        try {
          syncProfileService.syncToFiles(published);
        } catch (e) {
          logger.error('Failed to sync updated resume to profile.js', e);
        }
      }
    }

    db.set('draft', draft);
    this.saveDraftAndLog('profile_hero', oldName, draft.name, 'Updated Profile & Hero details', approvedBy);
    return draft;
  }

  /* ── 2. About Section ── */
  updateAbout(data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    if (Array.isArray(data.about)) {
      draft.about = data.about.map(p => typeof p === 'string' ? p.trim() : p);
    }
    if (data.careerObjective !== undefined) draft.careerObjective = data.careerObjective.trim();
    if (data.aboutImage !== undefined) draft.aboutImage = data.aboutImage.trim();

    db.set('draft', draft);
    this.saveDraftAndLog('about_section', 'Prior About', `${draft.about.length} paragraphs`, 'Updated About Section', approvedBy);
    return draft.about;
  }

  /* ── 3. Skills Management ── */
  getSkills() {
    const draft = db.get('draft') || {};
    return draft.skills || [];
  }

  addSkill({ category, name, skill, proficiency, icon }, approvedBy = 'admin') {
    const skillName = (name || skill || '').trim();
    if (!skillName) throw new Error('Skill name is required');
    if (!category || !category.trim()) throw new Error('Skill category is required');

    const draft = db.get('draft') || {};
    draft.skills = draft.skills || [];

    const catName = category.trim();
    let group = draft.skills.find(g => g.category.toLowerCase() === catName.toLowerCase());

    if (!group) {
      group = { category: catName, items: [], bars: [] };
      draft.skills.push(group);
    }

    group.items = group.items || [];
    if (!group.items.includes(skillName)) {
      group.items.push(skillName);
    }

    if (proficiency && !isNaN(proficiency)) {
      group.bars = group.bars || [];
      const val = Math.min(100, Math.max(1, parseInt(proficiency, 10)));
      const existingBarIdx = group.bars.findIndex(b => b.label.toLowerCase() === skillName.toLowerCase());
      if (existingBarIdx !== -1) {
        group.bars[existingBarIdx].value = val;
      } else {
        group.bars.push({ label: skillName, value: val });
      }
    }

    db.set('draft', draft);
    this.saveDraftAndLog('skill_add', 'None', `${catName}: ${skillName}`, `Added skill "${skillName}" to ${catName}`, approvedBy);
    return draft.skills;
  }

  addSkillCategory(categoryData, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.skills = draft.skills || [];

    const categoryName = (categoryData.category || '').trim();
    if (!categoryName) throw new Error('Category name is required');

    const existing = draft.skills.find(g => g.category.toLowerCase() === categoryName.toLowerCase());
    if (existing) throw new Error(`Category "${categoryName}" already exists`);

    let items = [];
    if (Array.isArray(categoryData.items)) {
      items = categoryData.items.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof categoryData.items === 'string') {
      items = categoryData.items.split(',').map(s => s.trim()).filter(Boolean);
    }

    let bars = [];
    if (Array.isArray(categoryData.bars)) {
      bars = categoryData.bars.map(b => ({
        label: String(b.label || '').trim(),
        value: Math.min(100, Math.max(1, parseInt(b.value || 80, 10)))
      })).filter(b => b.label);
    }

    const newCategory = {
      category: categoryName,
      items,
      bars
    };

    draft.skills.push(newCategory);
    db.set('draft', draft);
    this.saveDraftAndLog('skill_category_add', 'None', categoryName, `Added skill category "${categoryName}"`, approvedBy);
    return draft.skills;
  }

  updateSkillCategory(index, groupData, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.skills = draft.skills || [];

    let idx = -1;
    if (typeof index === 'number' || (!isNaN(Number(index)) && String(index).trim() !== '')) {
      const parsed = parseInt(index, 10);
      if (parsed >= 0 && parsed < draft.skills.length) idx = parsed;
    }
    if (idx === -1 && typeof index === 'string') {
      idx = draft.skills.findIndex(g => g.category.toLowerCase() === index.trim().toLowerCase());
    }

    if (idx === -1) {
      throw new Error(`Skill category "${index}" not found`);
    }

    let items = draft.skills[idx].items || [];
    if (Array.isArray(groupData.items)) {
      items = groupData.items.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof groupData.items === 'string') {
      items = groupData.items.split(',').map(s => s.trim()).filter(Boolean);
    }

    let bars = draft.skills[idx].bars || [];
    if (Array.isArray(groupData.bars)) {
      bars = groupData.bars.map(b => ({
        label: String(b.label || '').trim(),
        value: Math.min(100, Math.max(1, parseInt(b.value || 80, 10)))
      })).filter(b => b.label);
    }

    const oldCategory = draft.skills[idx].category;
    const newCategoryName = (groupData.category && groupData.category.trim()) ? groupData.category.trim() : oldCategory;

    if (newCategoryName.toLowerCase() !== oldCategory.toLowerCase()) {
      const dup = draft.skills.find((g, i) => i !== idx && g.category.toLowerCase() === newCategoryName.toLowerCase());
      if (dup) throw new Error(`Category "${newCategoryName}" already exists`);
    }

    draft.skills[idx] = {
      ...draft.skills[idx],
      category: newCategoryName,
      items,
      bars
    };

    db.set('draft', draft);
    this.saveDraftAndLog('skill_category_update', oldCategory, newCategoryName, `Updated skill category "${newCategoryName}"`, approvedBy);
    return draft.skills;
  }

  deleteSkillCategory(identifier, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.skills = draft.skills || [];

    let index = -1;
    if (typeof identifier === 'number' || (!isNaN(Number(identifier)) && String(identifier).trim() !== '')) {
      const idx = parseInt(identifier, 10);
      if (idx >= 0 && idx < draft.skills.length) index = idx;
    }

    if (index === -1 && typeof identifier === 'string') {
      index = draft.skills.findIndex(g => g.category.toLowerCase() === identifier.trim().toLowerCase());
    }

    if (index === -1) throw new Error(`Skill category "${identifier}" not found`);

    const removed = draft.skills.splice(index, 1)[0];
    db.set('draft', draft);
    this.saveDraftAndLog('skill_category_delete', removed.category, 'Removed', `Deleted skill category "${removed.category}"`, approvedBy);
    return draft.skills;
  }

  deleteSkill(categoryName, skillName, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.skills = draft.skills || [];

    const group = draft.skills.find(g => g.category.toLowerCase() === categoryName.toLowerCase());
    if (!group) throw new Error(`Category "${categoryName}" not found`);

    group.items = (group.items || []).filter(item => item.toLowerCase() !== skillName.toLowerCase());
    if (group.bars) {
      group.bars = group.bars.filter(b => b.label.toLowerCase() !== skillName.toLowerCase());
    }

    db.set('draft', draft);
    this.saveDraftAndLog('skill_delete', skillName, 'Removed', `Deleted skill "${skillName}" from ${categoryName}`, approvedBy);
    return draft.skills;
  }

  /* ── 4. Education Management ── */
  getEducation() {
    const draft = db.get('draft') || {};
    return draft.education || [];
  }

  addEducation(eduData, approvedBy = 'admin') {
    if (!eduData.institution || !eduData.institution.trim()) throw new Error('Institution name is required');
    if (!eduData.degree || !eduData.degree.trim()) throw new Error('Degree is required');

    const draft = db.get('draft') || {};
    draft.education = draft.education || [];

    const item = {
      institution: eduData.institution.trim(),
      degree: eduData.degree.trim(),
      field: (eduData.field || '').trim(),
      startYear: String(eduData.startYear || ''),
      endYear: String(eduData.endYear || ''),
      cgpa: String(eduData.cgpa || ''),
      score: String(eduData.score || ''),
      rollNo: String(eduData.rollNo || ''),
      affiliation: (eduData.affiliation || '').trim(),
      location: (eduData.location || '').trim()
    };

    draft.education.push(item);
    db.set('draft', draft);
    this.saveDraftAndLog('education_add', 'None', item.institution, `Added education entry at ${item.institution}`, approvedBy);
    return draft.education;
  }

  updateEducation(index, eduData, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.education = draft.education || [];

    if (index < 0 || index >= draft.education.length) {
      throw new Error(`Education entry at index ${index} not found`);
    }

    draft.education[index] = {
      ...draft.education[index],
      institution: eduData.institution !== undefined ? eduData.institution.trim() : draft.education[index].institution,
      degree: eduData.degree !== undefined ? eduData.degree.trim() : draft.education[index].degree,
      field: eduData.field !== undefined ? eduData.field.trim() : draft.education[index].field,
      startYear: eduData.startYear !== undefined ? String(eduData.startYear) : draft.education[index].startYear,
      endYear: eduData.endYear !== undefined ? String(eduData.endYear) : draft.education[index].endYear,
      cgpa: eduData.cgpa !== undefined ? String(eduData.cgpa) : draft.education[index].cgpa,
      score: eduData.score !== undefined ? String(eduData.score) : draft.education[index].score,
      rollNo: eduData.rollNo !== undefined ? String(eduData.rollNo) : draft.education[index].rollNo,
      affiliation: eduData.affiliation !== undefined ? eduData.affiliation.trim() : draft.education[index].affiliation,
      location: eduData.location !== undefined ? eduData.location.trim() : draft.education[index].location
    };

    db.set('draft', draft);
    this.saveDraftAndLog('education_update', 'Index ' + index, draft.education[index].institution, `Updated education entry at ${draft.education[index].institution}`, approvedBy);
    return draft.education;
  }

  deleteEducation(index, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.education = draft.education || [];

    if (index < 0 || index >= draft.education.length) {
      throw new Error(`Education entry at index ${index} not found`);
    }

    const removed = draft.education.splice(index, 1)[0];
    db.set('draft', draft);
    this.saveDraftAndLog('education_delete', removed.institution, 'Removed', `Deleted education entry at ${removed.institution}`, approvedBy);
    return draft.education;
  }

  /* ── 5. Experience & Internships ── */
  getExperience() {
    const draft = db.get('draft') || {};
    return draft.experience || [];
  }

  addExperience(data, approvedBy = 'admin') {
    if (!data.role || !data.role.trim()) throw new Error('Role / Position title is required');
    if (!data.company || !data.company.trim()) throw new Error('Company / Organization is required');

    const draft = db.get('draft') || {};
    draft.experience = draft.experience || [];

    const id = data.id || `exp_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    const responsibilities = Array.isArray(data.responsibilities) 
      ? data.responsibilities.filter(r => r && r.trim().length > 0)
      : (typeof data.responsibilities === 'string' ? data.responsibilities.split('\n').filter(r => r.trim().length > 0) : []);

    const item = {
      id,
      role: data.role.trim(),
      company: data.company.trim(),
      companyUrl: (data.companyUrl || '').trim(),
      employmentType: (data.employmentType || 'Internship').trim(),
      location: (data.location || 'Remote').trim(),
      startDate: String(data.startDate || '').trim(),
      endDate: String(data.endDate || '').trim(),
      current: Boolean(data.current),
      responsibilities
    };

    draft.experience.push(item);
    db.set('draft', draft);
    this.saveDraftAndLog('experience_add', 'None', `${item.role} at ${item.company}`, `Added experience: ${item.role} at ${item.company}`, approvedBy);
    return draft.experience;
  }

  updateExperience(id, data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.experience = draft.experience || [];

    const index = draft.experience.findIndex(e => e.id === id);
    if (index === -1) throw new Error(`Experience with ID "${id}" not found`);

    let responsibilities = draft.experience[index].responsibilities;
    if (data.responsibilities !== undefined) {
      responsibilities = Array.isArray(data.responsibilities)
        ? data.responsibilities.filter(r => r && r.trim().length > 0)
        : data.responsibilities.split('\n').filter(r => r.trim().length > 0);
    }

    draft.experience[index] = {
      ...draft.experience[index],
      role: data.role !== undefined ? data.role.trim() : draft.experience[index].role,
      company: data.company !== undefined ? data.company.trim() : draft.experience[index].company,
      companyUrl: data.companyUrl !== undefined ? data.companyUrl.trim() : draft.experience[index].companyUrl,
      employmentType: data.employmentType !== undefined ? data.employmentType.trim() : draft.experience[index].employmentType,
      location: data.location !== undefined ? data.location.trim() : draft.experience[index].location,
      startDate: data.startDate !== undefined ? String(data.startDate).trim() : draft.experience[index].startDate,
      endDate: data.endDate !== undefined ? String(data.endDate).trim() : draft.experience[index].endDate,
      current: data.current !== undefined ? Boolean(data.current) : draft.experience[index].current,
      responsibilities
    };

    db.set('draft', draft);
    this.saveDraftAndLog('experience_update', id, `${draft.experience[index].role} at ${draft.experience[index].company}`, `Updated experience: ${draft.experience[index].role}`, approvedBy);
    return draft.experience;
  }

  deleteExperience(id, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.experience = draft.experience || [];
    const published = db.get('published') || {};
    published.experience = published.experience || [];

    const index = draft.experience.findIndex(e => e.id === id);
    let removed = null;
    if (index !== -1) {
      removed = draft.experience.splice(index, 1)[0];
    }

    const pubIndex = published.experience.findIndex(e => e.id === id);
    if (pubIndex !== -1) {
      if (!removed) removed = published.experience[pubIndex];
      published.experience.splice(pubIndex, 1);
      db.set('published', published);
    }

    if (!removed) throw new Error(`Experience with ID "${id}" not found`);

    // Prune verifiedRecords so re-uploading documents or re-adding is never blocked
    const verifiedRecords = db.get('verifiedRecords') || [];
    const remainingVR = verifiedRecords.filter(r => {
      if (r.entityId && r.entityId === id) return false;
      if (r.type === 'internship' && r.title === removed.role && (r.organization === removed.company || !r.organization)) return false;
      return true;
    });
    db.set('verifiedRecords', remainingVR);

    // Prune documents collection
    const documents = db.get('documents') || [];
    const remainingDocs = documents.filter(d => d.entityId !== id);
    db.set('documents', remainingDocs);

    db.set('draft', draft);
    this.saveDraftAndLog('experience_delete', `${removed.role} at ${removed.company}`, 'Removed', `Deleted experience: ${removed.role}`, approvedBy);
    return draft.experience;
  }

  /* ── 6. Projects CMS ── */
  getProjects() {
    const draft = db.get('draft') || {};
    return draft.projects || [];
  }

  addProject(data, approvedBy = 'admin') {
    if (!data.title || !data.title.trim()) throw new Error('Project title is required');

    const draft = db.get('draft') || {};
    draft.projects = draft.projects || [];

    const id = data.id || data.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30) || `proj_${Date.now()}`;
    const technologies = Array.isArray(data.technologies)
      ? data.technologies
      : (typeof data.technologies === 'string' ? data.technologies.split(',').map(t => t.trim()).filter(Boolean) : []);

    const project = {
      id,
      title: data.title.trim(),
      tag: (data.tag || 'Full-Stack Project').trim(),
      description: (data.description || '').trim(),
      technologies,
      bgClass: data.bgClass || 'bg-pattern-2',
      featured: Boolean(data.featured),
      status: data.status || 'Completed',
      github: (data.github || '').trim(),
      githubLabel: (data.githubLabel || '↗ GitHub Code').trim(),
      liveDemo: (data.liveDemo || '').trim(),
      caseStudy: (data.caseStudy || '').trim(),
      isHackathon: Boolean(data.isHackathon),
      certFile: (data.certFile || '').trim(),
      challenges: (data.challenges || '').trim(),
      solution: (data.solution || '').trim(),
      results: (data.results || '').trim(),
      caseStudyContent: (data.caseStudyContent || '').trim()
    };

    // Filter out if existing id
    draft.projects = draft.projects.filter(p => p.id !== id);
    draft.projects.push(project);

    db.set('draft', draft);
    this.saveDraftAndLog('project_add', 'None', project.title, `Added project "${project.title}"`, approvedBy);
    return draft.projects;
  }

  updateProject(id, data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.projects = draft.projects || [];

    const index = draft.projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error(`Project with ID "${id}" not found`);

    let technologies = draft.projects[index].technologies;
    if (data.technologies !== undefined) {
      technologies = Array.isArray(data.technologies)
        ? data.technologies
        : data.technologies.split(',').map(t => t.trim()).filter(Boolean);
    }

    draft.projects[index] = {
      ...draft.projects[index],
      title: data.title !== undefined ? data.title.trim() : draft.projects[index].title,
      tag: data.tag !== undefined ? data.tag.trim() : draft.projects[index].tag,
      description: data.description !== undefined ? data.description.trim() : draft.projects[index].description,
      technologies,
      bgClass: data.bgClass !== undefined ? data.bgClass : draft.projects[index].bgClass,
      featured: data.featured !== undefined ? Boolean(data.featured) : draft.projects[index].featured,
      status: data.status !== undefined ? data.status : (draft.projects[index].status || 'Completed'),
      github: data.github !== undefined ? data.github.trim() : draft.projects[index].github,
      githubLabel: data.githubLabel !== undefined ? data.githubLabel.trim() : draft.projects[index].githubLabel,
      liveDemo: data.liveDemo !== undefined ? data.liveDemo.trim() : draft.projects[index].liveDemo,
      caseStudy: data.caseStudy !== undefined ? data.caseStudy.trim() : draft.projects[index].caseStudy,
      isHackathon: data.isHackathon !== undefined ? Boolean(data.isHackathon) : draft.projects[index].isHackathon,
      certFile: data.certFile !== undefined ? data.certFile.trim() : draft.projects[index].certFile,
      challenges: data.challenges !== undefined ? data.challenges.trim() : (draft.projects[index].challenges || ''),
      solution: data.solution !== undefined ? data.solution.trim() : (draft.projects[index].solution || ''),
      results: data.results !== undefined ? data.results.trim() : (draft.projects[index].results || ''),
      caseStudyContent: data.caseStudyContent !== undefined ? data.caseStudyContent.trim() : (draft.projects[index].caseStudyContent || '')
    };

    db.set('draft', draft);
    this.saveDraftAndLog('project_update', id, draft.projects[index].title, `Updated project "${draft.projects[index].title}"`, approvedBy);
    return draft.projects;
  }

  deleteProject(id, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.projects = draft.projects || [];

    const index = draft.projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error(`Project with ID "${id}" not found`);

    const removed = draft.projects.splice(index, 1)[0];
    db.set('draft', draft);
    this.saveDraftAndLog('project_delete', removed.title, 'Removed', `Deleted project "${removed.title}"`, approvedBy);
    return draft.projects;
  }

  /* ── 7. Certifications ── */
  getCertifications() {
    const draft = db.get('draft') || {};
    return draft.certifications || [];
  }

  addCertification(data, approvedBy = 'admin') {
    if (!data.name || !data.name.trim()) throw new Error('Certification name is required');
    if (!data.issuer || !data.issuer.trim()) throw new Error('Issuer / Organization is required');

    const draft = db.get('draft') || {};
    draft.certifications = draft.certifications || [];

    const id = data.id || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30) || `cert_${Date.now()}`;
    const cert = {
      id,
      name: data.name.trim(),
      issuer: data.issuer.trim(),
      date: (data.date || '').trim(),
      icon: data.icon || '🏅',
      credentialUrl: (data.credentialUrl || '').trim(),
      credentialId: (data.credentialId || '').trim(),
      score: (data.score || '').trim(),
      bgClass: data.bgClass || 'bg-pattern-1'
    };

    draft.certifications = draft.certifications.filter(c => c.id !== id);
    draft.certifications.push(cert);

    db.set('draft', draft);
    this.saveDraftAndLog('cert_add', 'None', cert.name, `Added certification "${cert.name}"`, approvedBy);
    return draft.certifications;
  }

  updateCertification(id, data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.certifications = draft.certifications || [];

    const index = draft.certifications.findIndex(c => c.id === id);
    if (index === -1) throw new Error(`Certification with ID "${id}" not found`);

    draft.certifications[index] = {
      ...draft.certifications[index],
      name: data.name !== undefined ? data.name.trim() : draft.certifications[index].name,
      issuer: data.issuer !== undefined ? data.issuer.trim() : draft.certifications[index].issuer,
      date: data.date !== undefined ? data.date.trim() : draft.certifications[index].date,
      icon: data.icon !== undefined ? data.icon : draft.certifications[index].icon,
      credentialUrl: data.credentialUrl !== undefined ? data.credentialUrl.trim() : draft.certifications[index].credentialUrl,
      credentialId: data.credentialId !== undefined ? data.credentialId.trim() : draft.certifications[index].credentialId,
      score: data.score !== undefined ? data.score.trim() : draft.certifications[index].score,
      bgClass: data.bgClass !== undefined ? data.bgClass : draft.certifications[index].bgClass
    };

    db.set('draft', draft);
    this.saveDraftAndLog('cert_update', id, draft.certifications[index].name, `Updated certification "${draft.certifications[index].name}"`, approvedBy);
    return draft.certifications;
  }

  deleteCertification(id, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.certifications = draft.certifications || [];
    const published = db.get('published') || {};
    published.certifications = published.certifications || [];

    const index = draft.certifications.findIndex(c => c.id === id);
    let removed = null;
    if (index !== -1) {
      removed = draft.certifications.splice(index, 1)[0];
    }

    const pubIndex = published.certifications.findIndex(c => c.id === id);
    if (pubIndex !== -1) {
      if (!removed) removed = published.certifications[pubIndex];
      published.certifications.splice(pubIndex, 1);
      db.set('published', published);
    }

    if (!removed) throw new Error(`Certification with ID "${id}" not found`);

    // Prune verifiedRecords
    const verifiedRecords = db.get('verifiedRecords') || [];
    const remainingVR = verifiedRecords.filter(r => {
      if (r.entityId && r.entityId === id) return false;
      if (r.type === 'certification' && (r.title === removed.name || (r.credentialId && r.credentialId === removed.credentialId))) return false;
      return true;
    });
    db.set('verifiedRecords', remainingVR);

    // Prune documents collection
    const documents = db.get('documents') || [];
    const remainingDocs = documents.filter(d => d.entityId !== id);
    db.set('documents', remainingDocs);

    db.set('draft', draft);
    this.saveDraftAndLog('cert_delete', removed.name, 'Removed', `Deleted certification "${removed.name}"`, approvedBy);
    return draft.certifications;
  }

  /* ── 8. Achievements ── */
  getAchievements() {
    const draft = db.get('draft') || {};
    return draft.achievements || [];
  }

  addAchievement(data, approvedBy = 'admin') {
    if (!data.title || !data.title.trim()) throw new Error('Achievement title is required');

    const draft = db.get('draft') || {};
    draft.achievements = draft.achievements || [];

    const id = data.id || data.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30) || `achv_${Date.now()}`;
    const achv = {
      id,
      title: data.title.trim(),
      description: (data.description || '').trim(),
      icon: data.icon || '🏆',
      certFile: (data.certFile || '').trim(),
      bgClass: data.bgClass || 'bg-pattern-3'
    };

    draft.achievements = draft.achievements.filter(a => a.id !== id);
    draft.achievements.push(achv);

    db.set('draft', draft);
    this.saveDraftAndLog('achievement_add', 'None', achv.title, `Added achievement "${achv.title}"`, approvedBy);
    return draft.achievements;
  }

  updateAchievement(id, data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.achievements = draft.achievements || [];

    const index = draft.achievements.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Achievement with ID "${id}" not found`);

    draft.achievements[index] = {
      ...draft.achievements[index],
      title: data.title !== undefined ? data.title.trim() : draft.achievements[index].title,
      description: data.description !== undefined ? data.description.trim() : draft.achievements[index].description,
      icon: data.icon !== undefined ? data.icon : draft.achievements[index].icon,
      certFile: data.certFile !== undefined ? data.certFile.trim() : draft.achievements[index].certFile,
      bgClass: data.bgClass !== undefined ? data.bgClass : draft.achievements[index].bgClass
    };

    db.set('draft', draft);
    this.saveDraftAndLog('achievement_update', id, draft.achievements[index].title, `Updated achievement "${draft.achievements[index].title}"`, approvedBy);
    return draft.achievements;
  }

  deleteAchievement(id, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.achievements = draft.achievements || [];

    const index = draft.achievements.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Achievement with ID "${id}" not found`);

    const removed = draft.achievements.splice(index, 1)[0];
    db.set('draft', draft);
    this.saveDraftAndLog('achievement_delete', removed.title, 'Removed', `Deleted achievement "${removed.title}"`, approvedBy);
    return draft.achievements;
  }

  /* ── 9. Resume Management ── */
  getResume() {
    const draft = db.get('draft') || {};
    return draft.resume || { url: './Thimmareddygari_Harshavardhan_Reddy_Resume.pdf', label: 'View Resume' };
  }

  updateResume(data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.resume = draft.resume || {};

    if (data.url) draft.resume.url = data.url.trim();
    if (data.label) draft.resume.label = data.label.trim();
    draft.resume.updatedAt = new Date().toISOString();

    db.set('draft', draft);
    this.saveDraftAndLog('resume_update', 'Resume Link', draft.resume.url, `Updated active resume link to ${draft.resume.url}`, approvedBy);

    // Also update published profile and synchronize profile.js and index.html so it takes effect live immediately!
    const published = db.get('published');
    if (published) {
      published.resume = {
        url: draft.resume.url,
        label: draft.resume.label || '📄 View Resume',
        updatedAt: draft.resume.updatedAt
      };
      db.set('published', published);
      try {
        syncProfileService.syncToFiles(published);
      } catch (e) {
        logger.error('Failed to sync updated resume to profile.js', e);
      }
    }

    return draft.resume;
  }

  /* ── 10. Section Visibility & Navigation ── */
  getSections() {
    const draft = db.get('draft') || {};
    return draft.sectionVisibility || {
      hero: true,
      marquee: true,
      about: true,
      skills: true,
      experience: true,
      projects: true,
      certs: true,
      achievements: true,
      contact: true
    };
  }

  updateSections(visibilityMap, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.sectionVisibility = { ...(draft.sectionVisibility || {}), ...visibilityMap };
    db.set('draft', draft);
    this.saveDraftAndLog('section_visibility', 'Prior Visibility', JSON.stringify(draft.sectionVisibility), 'Updated section visibility settings', approvedBy);
    return draft.sectionVisibility;
  }

  /* ── 11. SEO & Structured Data ── */
  getSeo() {
    const draft = db.get('draft') || {};
    return {
      pageTitle: draft.pageTitle || '',
      seo: draft.seo || {},
      jsonLd: draft.jsonLd || {}
    };
  }

  updateSeo(data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    if (data.pageTitle !== undefined) draft.pageTitle = data.pageTitle.trim();
    draft.seo = { ...(draft.seo || {}), ...(data.seo || {}) };

    db.set('draft', draft);
    this.saveDraftAndLog('seo_update', 'Prior SEO', draft.pageTitle, 'Updated SEO & Meta parameters', approvedBy);
    return { pageTitle: draft.pageTitle, seo: draft.seo };
  }

  /* ── 12. Media Library with Section Folders & Deduplication ── */
  getFileHash(filePathOrBuffer) {
    try {
      const buf = Buffer.isBuffer(filePathOrBuffer)
        ? filePathOrBuffer
        : fs.readFileSync(filePathOrBuffer);
      return crypto.createHash('sha256').update(buf).digest('hex');
    } catch (e) {
      return null;
    }
  }

  classifyMediaSection(filename, ext = '') {
    const f = filename.toLowerCase();
    const e = (ext || path.extname(filename)).toLowerCase();

    // 1. Resumes
    if (f.includes('resume') || f.includes('cv')) {
      return { folder: 'resumes', folderLabel: 'Resumes', icon: '📄', color: '#f0c96a' };
    }

    // 2. Experience & Offer Letters
    if (
      f.includes('offer') ||
      f.includes('congratulations') ||
      f.includes('joining') ||
      f.includes('visiting certificate') ||
      f.includes('bics') ||
      f.includes('recommendation')
    ) {
      return { folder: 'experience', folderLabel: 'Experience & Offers', icon: '💼', color: '#60a5fa' };
    }

    // 3. Certificates & Internships
    if (
      f.includes('cert') ||
      f.includes('coursera') ||
      f.includes('nptel') ||
      f.includes('noc26') ||
      f.includes('hackathon') ||
      f.includes('aptitude') ||
      f.includes('training') ||
      f.includes('learning') ||
      f.includes('intelligence') ||
      f.includes('quantum') ||
      f.includes('resolution') ||
      f.includes('springboard') ||
      f.includes('eduskills') ||
      f.includes('scanned') ||
      f.includes('python fullstack') ||
      f.startsWith('doc-2026')
    ) {
      return { folder: 'certificates', folderLabel: 'Certificates & Internships', icon: '📜', color: '#34d399' };
    }

    // 4. Profile & Photos
    if (
      f.includes('photo') ||
      f.includes('avatar') ||
      f.includes('headshot') ||
      f.includes('og-image') ||
      f.includes('profile') ||
      f.includes('favicon') ||
      f.includes('face')
    ) {
      return { folder: 'profile', folderLabel: 'Profile & Photos', icon: '👤', color: '#c084fc' };
    }

    // 5. Projects & Media
    if (
      f.includes('project') ||
      f.includes('screenshot') ||
      f.includes('diagram') ||
      f.includes('architecture') ||
      f.includes('airguard') ||
      f.includes('videstore') ||
      f.includes('hollow') ||
      f.includes('grammpay')
    ) {
      return { folder: 'projects', folderLabel: 'Projects & Media', icon: '💻', color: '#38bdf8' };
    }

    // 6. Documents & Extracts
    return { folder: 'documents', folderLabel: 'Documents & Extracts', icon: '📁', color: '#94a3b8' };
  }

  formatMediaDisplayName(filename) {
    let clean = filename
      .replace(/\.[^.]+$/, '')
      .replace(/^doc_\d+_[a-z0-9]+_/i, '')
      .replace(/^media_\d+_[a-z0-9]+_/i, '')
      .replace(/^Harsha_Resume_\d+/i, 'Harsha Active Resume')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (/NOC26CS45/i.test(filename)) return 'NPTEL NLP Elite Certificate (IIT Kharagpur)';
    if (/DOC-20260323-WA0007/i.test(filename)) return 'IIT Bombay Java Training Certificate (85%)';
    if (/DOC-20260323-WA0008/i.test(filename)) return 'IIT Bombay PostgreSQL Certificate (90%)';
    if (/DOC-20260426-WA0002/i.test(filename)) return 'AWS Gen AI Virtual Internship (Grade-O Outstanding)';
    if (/DOC-20260505-WA0012/i.test(filename)) return 'APSCHE AWS Gen AI Certificate (120 Hours)';
    if (/hackathon/i.test(filename)) return 'National Hackathon Certificate (VaultSphere)';
    if (/Python Fullstack/i.test(filename)) return 'Python Full Stack Virtual Internship (Grade-O)';
    if (/BICS/i.test(filename)) return 'BICS Global Enterprise Industrial Visit Certificate';
    if (/Coursera AS6TIAD3EVQN/i.test(filename)) return 'Coursera — Intro to Large Language Models';
    if (/Coursera Q2TKBQ0LW3WE/i.test(filename)) return 'Coursera — Intro to Responsible AI';
    if (/Coursera QT5BESYQBKGF/i.test(filename)) return 'Coursera — Intro to Generative AI';
    if (/Quantum/i.test(filename)) return 'NPTEL — Intro to Quantum Computing & Qiskit';
    if (/Offer_Letter/i.test(filename)) return 'Web Development Internship Offer Letter';
    if (/Gmail.*Offer/i.test(filename)) return 'Web Development Internship Selection Email';

    return clean || filename;
  }

  listMedia(filterFolder = null) {
    this.ensureMediaDir();

    const scanDirs = [this.mediaDir];
    if (this.isServerless && fs.existsSync(this.bundledMediaDir)) {
      scanDirs.push(this.bundledMediaDir);
    }

    const seenHashes = new Map();
    const uniqueList = [];
    let duplicatesPrevented = 0;

    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) continue;
      let files = [];
      try {
        files = fs.readdirSync(dir);
      } catch (e) {
        continue;
      }

      for (const file of files) {
        if (file.startsWith('.')) continue;
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile()) continue;

          const hash = this.getFileHash(fullPath);
          if (!hash) continue;

          // Deduplication: prevent identical files from showing twice
          if (seenHashes.has(hash)) {
            duplicatesPrevented++;
            continue;
          }

          seenHashes.set(hash, file);

          const ext = path.extname(file).toLowerCase();
          let category = 'Document';
          if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
            category = 'Image';
          } else if (ext === '.pdf') {
            category = 'PDF';
          }

          const sec = this.classifyMediaSection(file, ext);
          const displayName = this.formatMediaDisplayName(file);

          uniqueList.push({
            filename: file,
            displayName,
            folder: sec.folder,
            folderLabel: sec.folderLabel,
            folderIcon: sec.icon,
            folderColor: sec.color,
            url: `/media/${encodeURIComponent(file)}`,
            sizeBytes: stat.size,
            category,
            contentHash: hash,
            uploadedAt: stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString()
          });
        } catch (err) {
          logger.error(`Error processing media file ${file}:`, err);
        }
      }
    }

    // Sort newest first
    uniqueList.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    const folderDef = [
      { id: 'all', label: 'All Files', icon: '📁', count: uniqueList.length },
      { id: 'resumes', label: 'Resumes', icon: '📄', count: uniqueList.filter(f => f.folder === 'resumes').length },
      { id: 'certificates', label: 'Certificates & Internships', icon: '📜', count: uniqueList.filter(f => f.folder === 'certificates').length },
      { id: 'experience', label: 'Experience & Offers', icon: '💼', count: uniqueList.filter(f => f.folder === 'experience').length },
      { id: 'profile', label: 'Profile & Photos', icon: '👤', count: uniqueList.filter(f => f.folder === 'profile').length },
      { id: 'projects', label: 'Projects & Media', icon: '💻', count: uniqueList.filter(f => f.folder === 'projects').length },
      { id: 'documents', label: 'Documents & Extracts', icon: '📁', count: uniqueList.filter(f => f.folder === 'documents').length }
    ];

    let filtered = uniqueList;
    if (filterFolder && filterFolder !== 'all') {
      filtered = uniqueList.filter(f => f.folder === filterFolder);
    }

    return {
      data: filtered,
      folders: folderDef,
      stats: {
        totalFiles: uniqueList.length,
        totalSizeBytes: uniqueList.reduce((acc, f) => acc + f.sizeBytes, 0),
        duplicatesPrevented
      }
    };
  }

  uploadMedia({ fileBuffer, originalName, targetFolder = null, approvedBy = 'admin' }) {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new Error('Valid file buffer is required');
    }

    this.ensureMediaDir();

    const newHash = this.getFileHash(fileBuffer);

    // 1. Deduplication Check: Look for existing file with identical hash
    const existingFiles = fs.readdirSync(this.mediaDir);
    for (const f of existingFiles) {
      if (f.startsWith('.')) continue;
      const full = path.join(this.mediaDir, f);
      try {
        if (fs.statSync(full).isFile()) {
          const h = this.getFileHash(full);
          if (h && h === newHash) {
            const ext = path.extname(f).toLowerCase();
            const sec = this.classifyMediaSection(f, ext);
            logger.info(`[CMS Media Deduplication] File "${originalName}" is identical to existing "${f}"`);
            return {
              filename: f,
              displayName: this.formatMediaDisplayName(f),
              url: `/media/${encodeURIComponent(f)}`,
              sizeBytes: fileBuffer.length,
              category: ext === '.pdf' ? 'PDF' : ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? 'Image' : 'Document',
              folder: sec.folder,
              folderLabel: sec.folderLabel,
              folderIcon: sec.icon,
              isDuplicate: true,
              message: `File already exists in Media Library as "${f}" in folder [${sec.folderLabel}]. Duplicate prevented.`
            };
          }
        }
      } catch (e) {}
    }

    // 2. New unique file
    const cleanOriginal = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const lowerOrig = cleanOriginal.toLowerCase();
    let folderPrefix = '';
    if (targetFolder === 'resumes' && !lowerOrig.includes('resume') && !lowerOrig.includes('cv')) {
      folderPrefix = 'resume_';
    } else if (targetFolder === 'certificates' && !lowerOrig.includes('cert') && !lowerOrig.includes('nptel')) {
      folderPrefix = 'cert_';
    } else if (targetFolder === 'experience' && !lowerOrig.includes('offer') && !lowerOrig.includes('exp')) {
      folderPrefix = 'exp_';
    } else if (targetFolder === 'profile' && !lowerOrig.includes('profile') && !lowerOrig.includes('photo')) {
      folderPrefix = 'profile_';
    } else if (targetFolder === 'projects' && !lowerOrig.includes('project')) {
      folderPrefix = 'project_';
    } else if (targetFolder === 'documents' && !lowerOrig.includes('doc')) {
      folderPrefix = 'doc_';
    }

    const filename = `${Date.now()}_${folderPrefix}${cleanOriginal}`;
    const destPath = path.join(this.mediaDir, filename);
    fs.writeFileSync(destPath, fileBuffer);

    const ext = path.extname(filename).toLowerCase();
    const sec = this.classifyMediaSection(filename, ext);

    this.saveDraftAndLog('media_upload', 'None', filename, `Uploaded new media file "${filename}" to [${sec.folderLabel}]`, approvedBy);

    return {
      filename,
      displayName: this.formatMediaDisplayName(filename),
      url: `/media/${encodeURIComponent(filename)}`,
      sizeBytes: fileBuffer.length,
      category: ext === '.pdf' ? 'PDF' : ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? 'Image' : 'Document',
      folder: sec.folder,
      folderLabel: sec.folderLabel,
      folderIcon: sec.icon,
      isDuplicate: false,
      message: 'Media file uploaded successfully'
    };
  }

  deleteMedia(filename, approvedBy = 'admin') {
    const safeName = path.basename(filename);
    const fullPath = path.join(this.mediaDir, safeName);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Media file "${safeName}" not found`);
    }

    fs.unlinkSync(fullPath);
    this.saveDraftAndLog('media_delete', safeName, 'Deleted', `Deleted media asset ${safeName}`, approvedBy);
    return { filename: safeName, deleted: true };
  }

  /* ── 13. Backup & Restore ── */
  exportFullBackup() {
    const rawDb = db.read();
    return {
      system: 'Harshavardhan Portfolio CMS',
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      data: rawDb,
      database: rawDb
    };
  }

  restoreFullBackup(backupData, approvedBy = 'admin') {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Invalid backup file format');
    }

    const payload = backupData.database || backupData.data || backupData;
    if (!payload.published && !payload.draft) {
      throw new Error('Backup does not contain valid published or draft portfolio collections');
    }

    // 1. Create a safety snapshot first
    const priorSnapshot = db.createBackupSnapshot();

    // 2. Restore collections
    if (payload.published) db.set('published', payload.published);
    if (payload.draft) db.set('draft', payload.draft);
    if (payload.settings) db.set('settings', payload.settings);

    // 3. Sync to files
    syncProfileService.syncToFiles(db.get('published') || db.get('draft'));

    this.saveDraftAndLog('backup_restore', priorSnapshot, 'Full Restore', 'Restored entire portfolio from backup JSON', approvedBy);
    return {
      success: true,
      priorSnapshot,
      restoredAt: new Date().toISOString()
    };
  }

  /* ── 14. Competitive Programming & Coding Profiles ── */
  getCodingProfiles() {
    const draft = db.get('draft') || {};
    const published = db.get('published') || {};
    const profiles = draft.codingProfiles || published.codingProfiles || [];
    const telemetry = draft.telemetry || published.telemetry || {
      problemsSolved: '350+',
      activeProfiles: '9+',
      verified: '100%',
      openSourceRepos: '24+'
    };
    return { profiles, telemetry };
  }

  addCodingProfile(data, approvedBy = 'admin') {
    if (!data.platform) throw new Error('Platform name is required');
    const draft = db.get('draft') || {};
    draft.codingProfiles = draft.codingProfiles || (db.get('published')?.codingProfiles || []);
    
    let id = (data.id || data.platform.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();
    const existingIndex = draft.codingProfiles.findIndex(p => 
      (p.id && p.id.toLowerCase() === id.toLowerCase()) || 
      (p.platform && p.platform.toLowerCase() === data.platform.trim().toLowerCase())
    );
    if (existingIndex !== -1) {
      const existingId = draft.codingProfiles[existingIndex].id;
      return this.updateCodingProfile(existingId, data, approvedBy);
    }

    const url = data.url || data.profileUrl || '';
    const solved = data.problemsSolved !== undefined && data.problemsSolved !== null && data.problemsSolved !== '' 
      ? parseInt(data.problemsSolved, 10) 
      : (data.totalSolved !== undefined && data.totalSolved !== null && data.totalSolved !== '' ? parseInt(data.totalSolved, 10) : undefined);

    const newProfile = {
      id,
      platform: data.platform.trim(),
      icon: data.icon || '🌐',
      url: url,
      profileUrl: url,
      username: data.username ? data.username.trim() : '',
      verified: data.verified !== undefined ? Boolean(data.verified) : true,
      verificationMethod: data.verificationMethod ? data.verificationMethod.trim() : 'Verified Profile Link',
      status: data.status || 'Active',
      totalSolved: solved,
      problemsSolved: solved,
      easySolved: data.easySolved !== undefined && data.easySolved !== '' ? parseInt(data.easySolved, 10) : undefined,
      mediumSolved: data.mediumSolved !== undefined && data.mediumSolved !== '' ? parseInt(data.mediumSolved, 10) : undefined,
      hardSolved: data.hardSolved !== undefined && data.hardSolved !== '' ? parseInt(data.hardSolved, 10) : undefined,
      ranking: data.ranking ? String(data.ranking).trim() : undefined,
      acceptanceRate: data.acceptanceRate ? String(data.acceptanceRate).trim() : undefined,
      rating: data.rating !== undefined && data.rating !== '' ? parseInt(data.rating, 10) : undefined,
      maxRating: data.maxRating !== undefined && data.maxRating !== '' ? String(data.maxRating).trim() : undefined,
      rank: data.rank ? String(data.rank).trim() : undefined,
      division: data.division ? String(data.division).trim() : undefined,
      badges: data.badges || undefined,
      publicRepos: data.publicRepos !== undefined && data.publicRepos !== '' ? parseInt(data.publicRepos, 10) : undefined,
      stars: data.stars !== undefined && data.stars !== '' ? parseInt(data.stars, 10) : undefined,
      forks: data.forks !== undefined && data.forks !== '' ? parseInt(data.forks, 10) : undefined,
      network: data.network ? String(data.network).trim() : undefined,
      achievements: data.achievements ? String(data.achievements).trim() : undefined
    };

    Object.keys(newProfile).forEach(k => newProfile[k] === undefined && delete newProfile[k]);

    draft.codingProfiles.push(newProfile);
    db.set('draft', draft);
    this._syncCodingProfilesLive(draft.codingProfiles);

    this.saveDraftAndLog('codingProfiles', null, newProfile.platform, `Added coding profile: ${newProfile.platform}`, approvedBy);
    return newProfile;
  }

  updateCodingProfile(id, data, approvedBy = 'admin') {
    if (!id) throw new Error('Profile id is required');
    const draft = db.get('draft') || {};
    draft.codingProfiles = draft.codingProfiles || (db.get('published')?.codingProfiles || []);
    
    const idx = draft.codingProfiles.findIndex(p => p.id && p.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) {
      throw new Error(`Profile with id "${id}" not found`);
    }

    const current = draft.codingProfiles[idx];
    const url = data.url || data.profileUrl || current.url || current.profileUrl || '';
    const solved = data.problemsSolved !== undefined && data.problemsSolved !== null && data.problemsSolved !== '' 
      ? parseInt(data.problemsSolved, 10) 
      : (data.totalSolved !== undefined && data.totalSolved !== null && data.totalSolved !== '' ? parseInt(data.totalSolved, 10) : current.totalSolved);

    const updated = {
      ...current,
      ...data,
      id: current.id,
      url: url,
      profileUrl: url,
      totalSolved: solved,
      problemsSolved: solved
    };

    draft.codingProfiles[idx] = updated;
    db.set('draft', draft);
    this._syncCodingProfilesLive(draft.codingProfiles);

    this.saveDraftAndLog('codingProfiles', current.platform, updated.platform, `Updated coding profile: ${updated.platform}`, approvedBy);
    return updated;
  }

  deleteCodingProfile(id, approvedBy = 'admin') {
    if (!id) throw new Error('Profile id is required');
    const draft = db.get('draft') || {};
    draft.codingProfiles = draft.codingProfiles || (db.get('published')?.codingProfiles || []);

    const idx = draft.codingProfiles.findIndex(p => p.id === id);
    if (idx === -1) {
      throw new Error(`Profile with id "${id}" not found`);
    }

    const removed = draft.codingProfiles.splice(idx, 1)[0];
    db.set('draft', draft);
    this._syncCodingProfilesLive(draft.codingProfiles);

    this.saveDraftAndLog('codingProfiles', removed.platform, null, `Deleted coding profile: ${removed.platform}`, approvedBy);
    return { id, deleted: true };
  }

  updateTelemetry(data, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    draft.telemetry = draft.telemetry || (db.get('published')?.telemetry || {});
    draft.telemetry = {
      ...draft.telemetry,
      problemsSolved: data.problemsSolved || draft.telemetry.problemsSolved || '350+',
      activeProfiles: data.activeProfiles || draft.telemetry.activeProfiles || '9+',
      verified: data.verified || draft.telemetry.verified || '100%',
      openSourceRepos: data.openSourceRepos || draft.telemetry.openSourceRepos || '24+'
    };
    db.set('draft', draft);
    this._syncTelemetryLive(draft.telemetry);

    this.saveDraftAndLog('telemetry', null, draft.telemetry, 'Updated telemetry stats', approvedBy);
    return draft.telemetry;
  }

  _syncCodingProfilesLive(codingProfiles) {
    try {
      const published = db.get('published') || {};
      published.codingProfiles = Array.isArray(codingProfiles) ? [...codingProfiles] : [];
      db.set('published', published);
      syncProfileService.syncToFiles(published);
    } catch (e) {
      logger.error('Failed to sync coding profiles live to profile.js', e);
    }
  }

  _syncTelemetryLive(telemetry) {
    try {
      const published = db.get('published') || {};
      published.telemetry = { ...telemetry };
      db.set('published', published);
      syncProfileService.syncToFiles(published);
    } catch (e) {
      logger.error('Failed to sync telemetry live to profile.js', e);
    }
  }
}

module.exports = new CmsService();

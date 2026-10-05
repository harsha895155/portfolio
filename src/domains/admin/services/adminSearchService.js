/**
 * Admin Global Search Service
 * Searches comprehensively across all CMS content, documents, external profiles,
 * coding statistics, AI conversation threads, and audit history.
 */

const db = require('../../../infrastructure/database/db');
const socialProfileService = require('../../social-profiles/services/socialProfileService');

class AdminSearchService {
  search(query = '') {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return {
        query: '',
        totalResults: 0,
        results: {
          externalProfiles: [],
          projects: [],
          certifications: [],
          experience: [],
          skills: [],
          education: [],
          achievements: [],
          documents: [],
          aiConversations: [],
          history: []
        }
      };
    }

    const draft = db.get('draft') || {};
    const published = db.get('published') || {};
    const profile = draft.name ? draft : published;
    const documents = db.get('documents') || [];
    const conversations = db.get('aiConversations') || [];
    const history = db.get('history') || [];
    const platforms = socialProfileService.getPlatformsStatus();

    const results = {
      externalProfiles: [],
      projects: [],
      certifications: [],
      experience: [],
      skills: [],
      education: [],
      achievements: [],
      documents: [],
      aiConversations: [],
      history: []
    };

    // 1. External & Coding Profiles
    for (const p of platforms) {
      const match = (p.platform && p.platform.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.url && p.url.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.syncMethod && p.syncMethod.toLowerCase().includes(q)) ||
        (p.profileData && JSON.stringify(p.profileData).toLowerCase().includes(q));

      if (match) {
        results.externalProfiles.push({
          id: p.id,
          title: p.platform,
          subtitle: p.url || 'Configured integration',
          badge: p.status,
          tab: 'tab-social',
          data: p
        });
      }
    }

    // 2. Projects
    (profile.projects || []).forEach(proj => {
      const match = (proj.title && proj.title.toLowerCase().includes(q)) ||
        (proj.description && proj.description.toLowerCase().includes(q)) ||
        (proj.tag && proj.tag.toLowerCase().includes(q)) ||
        (Array.isArray(proj.technologies) && proj.technologies.some(t => t.toLowerCase().includes(q))) ||
        (proj.github && proj.github.toLowerCase().includes(q));

      if (match) {
        results.projects.push({
          id: proj.id,
          title: proj.title,
          subtitle: proj.tag || 'Project',
          details: proj.description ? proj.description.slice(0, 120) + '...' : '',
          tab: 'tab-projects',
          data: proj
        });
      }
    });

    // 3. Certifications
    (profile.certifications || []).forEach(cert => {
      const match = (cert.name && cert.name.toLowerCase().includes(q)) ||
        (cert.issuer && cert.issuer.toLowerCase().includes(q)) ||
        (cert.credentialId && cert.credentialId.toLowerCase().includes(q)) ||
        (cert.skills && cert.skills.toLowerCase().includes(q)) ||
        (cert.url && cert.url.toLowerCase().includes(q));

      if (match) {
        results.certifications.push({
          id: cert.id || cert.name,
          title: cert.name,
          subtitle: `${cert.issuer || 'Issuer'} · ${cert.date || ''}`,
          badge: cert.credentialId ? `ID: ${cert.credentialId}` : 'Verified',
          tab: 'tab-certs',
          data: cert
        });
      }
    });

    // 4. Experience & Internships
    (profile.experience || []).forEach(exp => {
      const match = (exp.role && exp.role.toLowerCase().includes(q)) ||
        (exp.company && exp.company.toLowerCase().includes(q)) ||
        (exp.type && exp.type.toLowerCase().includes(q)) ||
        (Array.isArray(exp.responsibilities) && exp.responsibilities.some(r => r.toLowerCase().includes(q)));

      if (match) {
        results.experience.push({
          id: exp.id || exp.role,
          title: exp.role,
          subtitle: `${exp.company} (${exp.type || 'Experience'})`,
          tab: 'tab-experience',
          data: exp
        });
      }
    });

    // 5. Skills
    (profile.skills || []).forEach(cat => {
      const catMatch = cat.category && cat.category.toLowerCase().includes(q);
      const matchingItems = (cat.items || []).filter(item => item.toLowerCase().includes(q));

      if (catMatch || matchingItems.length > 0) {
        results.skills.push({
          id: cat.category,
          title: cat.category,
          subtitle: matchingItems.length > 0 ? `Matched: ${matchingItems.join(', ')}` : 'Skill category',
          tab: 'tab-skills',
          data: cat
        });
      }
    });

    // 6. Education
    (profile.education || []).forEach(edu => {
      const match = (edu.degree && edu.degree.toLowerCase().includes(q)) ||
        (edu.institution && edu.institution.toLowerCase().includes(q)) ||
        (edu.field && edu.field.toLowerCase().includes(q));

      if (match) {
        results.education.push({
          id: edu.degree,
          title: edu.degree,
          subtitle: edu.institution,
          badge: edu.score || edu.year,
          tab: 'tab-education',
          data: edu
        });
      }
    });

    // 7. Achievements
    (profile.achievements || []).forEach(ach => {
      const match = (ach.title && ach.title.toLowerCase().includes(q)) ||
        (ach.description && ach.description.toLowerCase().includes(q)) ||
        (ach.category && ach.category.toLowerCase().includes(q));

      if (match) {
        results.achievements.push({
          id: ach.id || ach.title,
          title: ach.title,
          subtitle: ach.description ? ach.description.slice(0, 100) + '...' : 'Achievement',
          tab: 'tab-achievements',
          data: ach
        });
      }
    });

    // 8. Documents
    documents.forEach(doc => {
      const match = (doc.originalName && doc.originalName.toLowerCase().includes(q)) ||
        (doc.docType && doc.docType.toLowerCase().includes(q)) ||
        (doc.extractedText && doc.extractedText.toLowerCase().includes(q));

      if (match) {
        results.documents.push({
          id: doc.id,
          title: doc.originalName,
          subtitle: `${doc.docType || 'Document'} (${doc.fileType || ''})`,
          tab: 'tab-documents',
          data: doc
        });
      }
    });

    // 9. AI Conversations
    conversations.forEach((msg, idx) => {
      if (msg.content && msg.content.toLowerCase().includes(q)) {
        results.aiConversations.push({
          id: `conv_${idx}`,
          title: msg.role === 'user' ? 'User Question' : 'AI Assistant Reply',
          subtitle: msg.content.slice(0, 120) + '...',
          timestamp: msg.timestamp,
          tab: 'tab-ai-agent'
        });
      }
    });

    // 10. Audit & Sync History
    history.forEach((h, idx) => {
      const match = (h.field && h.field.toLowerCase().includes(q)) ||
        (h.newValue && String(h.newValue).toLowerCase().includes(q)) ||
        (h.source && h.source.toLowerCase().includes(q));

      if (match) {
        results.history.push({
          id: `hist_${idx}`,
          title: h.source || 'Audit Entry',
          subtitle: `${h.field}: ${String(h.newValue).slice(0, 80)}`,
          timestamp: h.timestamp,
          tab: 'tab-history'
        });
      }
    });

    const totalResults = Object.values(results).reduce((acc, arr) => acc + arr.length, 0);

    const categories = {
      'External Profiles': results.externalProfiles,
      'Projects': results.projects,
      'Certificates': results.certifications,
      'Work Experience': results.experience,
      'Skills': results.skills,
      'Education': results.education,
      'Achievements': results.achievements,
      'Uploaded Documents': results.documents,
      'AI Conversations': results.aiConversations,
      'Audit History': results.history
    };

    return {
      query: q,
      totalResults,
      totalMatches: totalResults,
      results,
      categories
    };
  }
}

module.exports = new AdminSearchService();

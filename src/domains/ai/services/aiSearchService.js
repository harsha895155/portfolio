/**
 * AI Structured Natural Language Search Engine
 * Interrogates portfolio collections and provides precise, contextual answers.
 */

const db = require('../../../infrastructure/database/db');
const { AIProviderFactory } = require('../providers/aiProvider');

class AISearchService {
  constructor() {
    this.provider = AIProviderFactory.getProvider();
  }

  async search(query) {
    const qLower = (query || '').toLowerCase().trim();
    const draft = db.get('draft') || {};

    if (!qLower) {
      return { answer: 'Please provide a search query or question.', matches: [] };
    }

    // 1. Check for specific question patterns

    // "Which certifications are missing credential IDs?"
    if (qLower.includes('missing') && (qLower.includes('credential') || qLower.includes('id'))) {
      const certs = (draft.certifications || []).filter(c => !c.credentialId || c.credentialId.trim().length === 0);
      return {
        query,
        answer: certs.length > 0
          ? `Found ${certs.length} certification(s) without a credential ID:\n${certs.map(c => `• ${c.name} (${c.issuer || 'Unknown issuer'})`).join('\n')}`
          : 'All certifications currently have credential IDs specified.',
        matches: certs
      };
    }

    // "Show all projects using <technology>" or "projects with <tech>"
    const techMatch = qLower.match(/projects?\s+(?:using|with|in)\s+([a-z0-9.#+ -]+)/i) ||
      qLower.match(/show\s+(?:all\s+)?([a-z0-9.#+ -]+)\s+projects/i);
    if (techMatch) {
      const tech = techMatch[1].trim().toLowerCase();
      const matchedProjects = (draft.projects || []).filter(p => {
        return (Array.isArray(p.technologies) && p.technologies.some(t => t.toLowerCase().includes(tech))) ||
          (p.description && p.description.toLowerCase().includes(tech)) ||
          (p.title && p.title.toLowerCase().includes(tech));
      });
      return {
        query,
        answer: matchedProjects.length > 0
          ? `Found ${matchedProjects.length} project(s) utilizing "${tech}":\n${matchedProjects.map(p => `• **${p.title}** (${p.tag || 'Project'}) - Tech: ${(p.technologies || []).join(', ')}`).join('\n')}`
          : `No projects found utilizing "${tech}".`,
        matches: matchedProjects
      };
    }

    // "Where is my <cert> certificate?"
    if (qLower.includes('certificate') || qLower.includes('cert')) {
      const keywords = qLower.replace(/(where|is|my|show|find|the|certificate|cert)/g, '').trim();
      const matchedCerts = (draft.certifications || []).filter(c => {
        return (c.name && c.name.toLowerCase().includes(keywords)) ||
          (c.issuer && c.issuer.toLowerCase().includes(keywords));
      });

      if (matchedCerts.length > 0) {
        return {
          query,
          answer: `Found ${matchedCerts.length} matching certification(s):\n${matchedCerts.map(c => `• **${c.name}** issued by ${c.issuer || 'N/A'} (Date: ${c.date || 'N/A'}, ID: ${c.credentialId || 'None'})`).join('\n')}`,
          matches: matchedCerts
        };
      }
    }

    // "Which sections have empty descriptions?"
    if (qLower.includes('empty') && qLower.includes('description')) {
      const emptyItems = [];
      (draft.projects || []).forEach(p => {
        if (!p.description || p.description.trim().length === 0) {
          emptyItems.push(`Project: ${p.title}`);
        }
      });
      (draft.certifications || []).forEach(c => {
        if (!c.description || c.description.trim().length === 0) {
          emptyItems.push(`Certification: ${c.name}`);
        }
      });
      return {
        query,
        answer: emptyItems.length > 0
          ? `Identified ${emptyItems.length} items with empty descriptions:\n${emptyItems.map(i => `• ${i}`).join('\n')}`
          : 'Great! All projects and certifications have non-empty descriptions.',
        matches: emptyItems
      };
    }

    // General fallback: Full search over all portfolio collections
    const results = [];
    (draft.projects || []).forEach(p => {
      if (JSON.stringify(p).toLowerCase().includes(qLower)) {
        results.push({ section: 'Projects', title: p.title, detail: p.description });
      }
    });
    (draft.skills || []).forEach(cat => {
      if (JSON.stringify(cat).toLowerCase().includes(qLower)) {
        results.push({ section: 'Skills', title: cat.category, detail: (cat.items || []).join(', ') });
      }
    });
    (draft.certifications || []).forEach(c => {
      if (JSON.stringify(c).toLowerCase().includes(qLower)) {
        results.push({ section: 'Certifications', title: c.name, detail: c.issuer });
      }
    });

    return {
      query,
      answer: results.length > 0
        ? `Found ${results.length} item(s) matching "${query}":\n${results.map(r => `• **[${r.section}] ${r.title}**: ${r.detail ? r.detail.slice(0, 100) : ''}`).join('\n')}`
        : `No direct matches found for "${query}" across portfolio sections.`,
      matches: results
    };
  }
}

module.exports = new AISearchService();

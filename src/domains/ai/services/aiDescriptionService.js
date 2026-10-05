/**
 * AI Description Generator & Enhancer
 * Produces factual, ATS-friendly, technical, or concise descriptions for any portfolio entity.
 */

const { AIProviderFactory } = require('../providers/aiProvider');
const db = require('../../../infrastructure/database/db');
const logger = require('../../../shared/utils/logger');

class AIDescriptionService {
  constructor() {
    this.provider = AIProviderFactory.getProvider();
  }

  async generate({ text = '', type = 'project', style = 'professional', context = {} }) {
    let raw = (text || '').trim();

    // Auto-enrich context from published profile and uploaded documents if sparse
    const published = db.get('published') || db.get('draft') || {};
    const documents = db.get('documents') || [];

    const enrichedContext = {
      ...(typeof context === 'object' && context !== null ? context : { promptContext: context }),
      candidateName: published.name || 'Thimmareddygari Harshavardhan Reddy',
      education: 'B.Tech in Computer Science and Engineering, GIST (JNTU Anantapur)',
      headline: published.headline || 'Computer Science Engineering Student | Full-Stack Developer | Java & React Developer',
      keySkills: (published.skills ? (Array.isArray(published.skills) ? published.skills.slice(0, 8).map(s => s.name || s) : []) : ['Java', 'React.js', 'Node.js', 'Python', 'AWS', 'PostgreSQL', 'MongoDB']),
      uploadedDocuments: documents.slice(0, 5).map(d => ({
        name: d.originalName || d.filename,
        category: d.category || 'Document',
        summary: d.analysis?.summary || ''
      }))
    };

    const contextStr = JSON.stringify(enrichedContext);
    const systemPrompt = `You are an elite technical copywriter and resume optimization expert for a developer portfolio.
CRITICAL RULES:
1. Synthesize factual, high-impact descriptions from the candidate's real data and uploaded credentials.
2. Tailor tone to style: "${style}".
3. Output ONLY the polished content directly suitable for the target field, without conversational preamble or quote marks.`;

    const prompt = `Entity Type: ${type}
Target Style: ${style}
Context Data: ${contextStr}
Original Draft / Notes:
${raw}`;

    try {
      const generated = await this.provider.generateText({
        prompt,
        systemPrompt,
        temperature: style === 'technical' ? 0.1 : 0.2
      });

      return {
        success: true,
        type,
        style,
        result: (generated || '').trim()
      };
    } catch (err) {
      logger.error('Error generating AI description', err);
      return {
        success: false,
        error: err.message,
        result: 'Unable to generate content at this time.'
      };
    }
  }
}

module.exports = new AIDescriptionService();

/**
 * AI Description Generator & Enhancer
 * Produces factual, ATS-friendly, technical, or concise descriptions for any portfolio entity.
 */

const { AIProviderFactory } = require('../providers/aiProvider');
const db = require('../../../infrastructure/database/db');
const logger = require('../../../shared/utils/logger');

const fs = require('fs');
const path = require('path');
const documentExtractor = require('../../documents/processors/documentExtractor');

class AIDescriptionService {
  constructor() {
    this.provider = AIProviderFactory.getProvider();
  }

  async fetchGithubReadme(repoUrl) {
    if (!repoUrl) return null;
    try {
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\#\?]+)/i);
      if (!match) return null;
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, '');

      const branches = ['HEAD', 'main', 'master'];
      for (const b of branches) {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${b}/README.md`);
          if (res.ok) {
            const txt = await res.text();
            if (txt && txt.trim().length > 10) return txt.trim();
          }
        } catch (_) {}
      }

      for (const b of branches) {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${b}/readme.md`);
          if (res.ok) {
            const txt = await res.text();
            if (txt && txt.trim().length > 10) return txt.trim();
          }
        } catch (_) {}
      }
    } catch (err) {
      logger.warn('Failed to fetch GitHub README: ' + err.message);
    }
    return null;
  }

  async autoGenerateProject({ githubUrl = '', title = '', notes = '', file = null }) {
    let readmeContent = '';
    if (githubUrl) {
      readmeContent = (await this.fetchGithubReadme(githubUrl)) || '';
    }

    let fileContent = '';
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        const ext = path.extname(file.originalname || file.path).toLowerCase();
        const extraction = await documentExtractor.extract(file.path, ext);
        if (extraction && extraction.textSnippet) {
          fileContent = extraction.textSnippet;
        }
      } catch (err) {
        logger.warn('Failed to extract project document: ' + err.message);
      }
    }

    const sourceContext = [
      title ? `User Title Input: ${title}` : '',
      notes ? `User Notes/Specs: ${notes}` : '',
      githubUrl ? `GitHub URL: ${githubUrl}` : '',
      readmeContent ? `GitHub Repository README:\n${readmeContent.slice(0, 3000)}` : '',
      fileContent ? `Uploaded Spec Document:\n${fileContent.slice(0, 3000)}` : ''
    ].filter(Boolean).join('\n\n');

    const systemPrompt = `You are an elite principal software architect and technical portfolio writer.
Generate a comprehensive, ATS-optimized project breakdown and full Case Study in JSON format.
CRITICAL: Respond ONLY with a valid JSON object without markdown wrapping or backticks.
JSON schema:
{
  "title": "Clean, professional project title",
  "tag": "e.g. Full-Stack Web Application, AI & Machine Learning, IoT & Embedded Systems, Cloud Infrastructure",
  "technologies": ["React 18", "Node.js", "Express", "MongoDB", "Tailwind CSS"],
  "description": "Punchy, 2-3 sentence overview highlighting user purpose, core architectural capabilities, and key outcomes.",
  "challenges": "Key architectural hurdles, security requirements, scale constraints, or technical hurdles overcome.",
  "solution": "Specific patterns, engineering designs, algorithms, or modular architectures implemented to solve the challenges.",
  "results": "Concrete measurable outcomes, response times, test coverage, efficiency improvements, or user workflow speed.",
  "caseStudy": "Full structured in-depth Case Study text formatted in clean Markdown with sections: ## Executive Summary, ## Problem Statement, ## System Architecture & Tech Stack, ## Key Implementation Highlights, ## Challenges & Engineering Solutions, ## Measurable Results & Impact, ## Future Roadmap"
}`;

    const prompt = `Synthesize a top-tier project showcase and case study based on the following project context:

${sourceContext || 'Full-Stack Web Development Project showcasing modern architecture and clean code.'}`;

    try {
      const generated = await this.provider.generateText({
        prompt,
        systemPrompt,
        temperature: 0.2
      });

      let parsed = null;
      try {
        const cleanJson = (generated || '')
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        parsed = JSON.parse(cleanJson);
      } catch (_) {
        // Fallback JSON extraction
        const match = (generated || '').match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        }
      }

      if (parsed && parsed.title && parsed.description) {
        return {
          success: true,
          source: readmeContent ? 'github_readme' : fileContent ? 'uploaded_doc' : 'ai_generated',
          project: {
            title: parsed.title,
            tag: parsed.tag || 'Full-Stack Project',
            technologies: Array.isArray(parsed.technologies) ? parsed.technologies : ['React.js', 'Node.js', 'Express', 'MongoDB'],
            description: parsed.description,
            challenges: parsed.challenges || '',
            solution: parsed.solution || '',
            results: parsed.results || '',
            caseStudy: parsed.caseStudy || '',
            github: githubUrl || '',
            readmeFound: Boolean(readmeContent)
          }
        };
      }
    } catch (err) {
      logger.error('Error generating AI project case study', err);
    }

    // Heuristic Fallback
    const fallbackTitle = title || (githubUrl ? githubUrl.split('/').filter(Boolean).pop() : 'Web Application');
    const cleanTitle = fallbackTitle.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return {
      success: true,
      source: 'heuristic_fallback',
      project: {
        title: cleanTitle,
        tag: 'Full-Stack Web Application',
        technologies: ['React 18', 'Node.js', 'Express', 'MongoDB', 'REST APIs', 'JWT Auth'],
        description: `${cleanTitle} is a production-ready application engineered with modular architecture, robust state management, and real-time backend synchronization.`,
        challenges: 'Architecting seamless real-time state synchronization, resilient API error handling, and low-latency response times under dynamic load.',
        solution: 'Implemented decoupled controller-service layers, strict schema validation, atomic file-backed caching, and client-side optimistic UI updates.',
        results: 'Delivered an intuitive user experience with sub-100ms response latencies and 100% verified cross-browser compatibility.',
        caseStudy: `## Executive Summary
${cleanTitle} was developed as a high-performance web solution designed to streamline user workflows and ensure data consistency.

## Problem Statement
Modern users require instantaneous data feedback, reliable offline resilience, and transparent synchronization without unexpected data loss.

## System Architecture & Tech Stack
- **Frontend**: Responsive modern UI with reactive state updates and modular components.
- **Backend**: Express REST API with security authentication and validation middleware.
- **Data Layer**: Atomic persistent storage and verified schema management.

## Challenges & Engineering Solutions
- **State Synchronization**: Solved using centralized caching and unified draft-to-production pipelines.
- **Performance**: Optimized asset delivery, minified payloads, and responsive layout scaling.

## Measurable Results & Impact
- Sub-100ms average response latency.
- Seamless multi-device responsiveness and zero-downtime persistence.`,
        github: githubUrl || '',
        readmeFound: Boolean(readmeContent)
      }
    };
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

/**
 * Google Gemini Provider
 * Implements multi-modal vision, document analysis, and structured JSON generation.
 */

const { BaseAIProvider } = require('./aiProvider');
const LocalSemanticProvider = require('./localSemanticProvider');
const logger = require('../../../shared/utils/logger');

class GeminiProvider extends BaseAIProvider {
  constructor(apiKey, model = 'gemini-1.5-flash') {
    super('Google Gemini');
    this.apiKey = apiKey;
    this.model = model;
    this.fallback = new LocalSemanticProvider();
    this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
  }

  async generateText({ prompt, systemPrompt = '', temperature = 0.2 }) {
    try {
      const contents = [];
      if (systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}` }] });
      }
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature, maxOutputTokens: 2048 }
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.warn(`Gemini API returned HTTP ${res.status}: ${errorText}. Falling back to Local Semantic Provider.`);
        return this.fallback.generateText({ prompt, systemPrompt, temperature });
      }

      const data = await res.json();
      const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return outputText || this.fallback.generateText({ prompt, systemPrompt, temperature });
    } catch (err) {
      logger.error('Gemini generateText error, utilizing local fallback', err);
      return this.fallback.generateText({ prompt, systemPrompt, temperature });
    }
  }

  async generateStructuredJson({ prompt, systemPrompt = '', schema = null }) {
    try {
      const contents = [];
      let sys = systemPrompt ? `${systemPrompt}\n` : '';
      sys += 'You must output strictly valid raw JSON without markdown fencing.';

      contents.push({ role: 'user', parts: [{ text: `INSTRUCTIONS:\n${sys}\n\nINPUT:\n${prompt}` }] });

      const bodyPayload = {
        contents,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      };

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        logger.warn(`Gemini JSON API HTTP ${res.status}. Falling back to Local Semantic Provider.`);
        return this.fallback.generateStructuredJson({ prompt, systemPrompt, schema });
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        // Strip any markdown fences if present
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      }
    } catch (err) {
      logger.error('Gemini generateStructuredJson error, utilizing local fallback', err);
      return this.fallback.generateStructuredJson({ prompt, systemPrompt, schema });
    }
  }

  async analyzeDocument({ text = '', mimeType = 'text/plain', filename = '', base64Data = null }) {
    try {
      if (!base64Data && text) {
        return this.generateStructuredJson({
          prompt: `Analyze this document content:\nFILENAME: ${filename}\nCONTENT:\n${text.slice(0, 8000)}`,
          systemPrompt: `Analyze the provided personal portfolio document. Extract:
1. docType (Certification, Resume, Project, Experience, Internship, Achievement, Education, Other)
2. category (matching standard portfolio sections)
3. confidence (0.0 to 1.0)
4. summary (clear professional summary)
5. extracted: structured object with name, organization, title, role, dates, score, credentialId, skills, description, url
6. proposedActions: array of action items (targetSection, actionType, label, changes)`
        });
      }

      // Multi-modal document with base64 data
      const parts = [
        {
          text: `Analyze this portfolio document (${filename}):\nExtract docType, organization, title/role, credential ID, issue date, skills, achievements, and suggested portfolio action.`
        }
      ];

      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'application/pdf',
            data: base64Data
          }
        });
      }

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        })
      });

      if (!res.ok) {
        return this.fallback.analyzeDocument({ text, mimeType, filename, base64Data });
      }

      const data = await res.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return JSON.parse(textResponse);
    } catch (err) {
      logger.error('Gemini analyzeDocument failed, using local fallback', err);
      return this.fallback.analyzeDocument({ text, mimeType, filename, base64Data });
    }
  }

  async analyzeImage({ base64Data, mimeType = 'image/jpeg', filename = '', width = 0, height = 0 }) {
    try {
      if (!base64Data) {
        return this.fallback.analyzeImage({ base64Data, mimeType, filename, width, height });
      }

      const parts = [
        {
          text: `You are an expert visual document and image classifier for a developer's personal portfolio.
Analyze this uploaded image (${filename}).
Determine:
1. imageType: 'profile_photo' | 'certificate' | 'project_screenshot' | 'event_hackathon' | 'general_asset'
2. isSuitableAvatar: boolean (true if it is a clear portrait of a person suitable for a professional headshot/avatar)
3. description: clear description of what is depicted
4. extractedText: any visible text in the image (especially for certificates or slides)
5. suggestedAction: where to use this image in the portfolio ('Profile Avatar', 'Certifications', 'Project Media Gallery', 'Achievements')
6. tags: array of descriptive labels
Return strictly JSON matching these fields.`
        },
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: base64Data
          }
        }
      ];

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        })
      });

      if (!res.ok) {
        return this.fallback.analyzeImage({ base64Data, mimeType, filename, width, height });
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return JSON.parse(text);
    } catch (err) {
      logger.error('Gemini analyzeImage failed, using local fallback', err);
      return this.fallback.analyzeImage({ base64Data, mimeType, filename, width, height });
    }
  }
}

module.exports = GeminiProvider;

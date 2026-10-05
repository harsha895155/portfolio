/**
 * OpenAI Provider
 * Implements chat completions and vision analysis via OpenAI API.
 */

const { BaseAIProvider } = require('./aiProvider');
const LocalSemanticProvider = require('./localSemanticProvider');
const logger = require('../../../shared/utils/logger');

class OpenAiProvider extends BaseAIProvider {
  constructor(apiKey, model = 'gpt-4o-mini') {
    super('OpenAI');
    this.apiKey = apiKey;
    this.model = model;
    this.fallback = new LocalSemanticProvider();
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
  }

  async generateText({ prompt, systemPrompt = '', temperature = 0.2 }) {
    try {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature
        })
      });

      if (!res.ok) {
        logger.warn(`OpenAI API returned HTTP ${res.status}. Falling back to Local Semantic Provider.`);
        return this.fallback.generateText({ prompt, systemPrompt, temperature });
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || this.fallback.generateText({ prompt, systemPrompt, temperature });
    } catch (err) {
      logger.error('OpenAI generateText error, using fallback', err);
      return this.fallback.generateText({ prompt, systemPrompt, temperature });
    }
  }

  async generateStructuredJson({ prompt, systemPrompt = '', schema = null }) {
    try {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: `${systemPrompt}\nOutput valid JSON.` });
      messages.push({ role: 'user', content: prompt });

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          response_format: { type: 'json_object' }
        })
      });

      if (!res.ok) {
        return this.fallback.generateStructuredJson({ prompt, systemPrompt, schema });
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '{}';
      return JSON.parse(text);
    } catch (err) {
      logger.error('OpenAI JSON generation failed, using fallback', err);
      return this.fallback.generateStructuredJson({ prompt, systemPrompt, schema });
    }
  }

  async analyzeDocument({ text = '', mimeType = 'text/plain', filename = '', base64Data = null }) {
    return this.fallback.analyzeDocument({ text, mimeType, filename, base64Data });
  }

  async analyzeImage({ base64Data, mimeType = 'image/jpeg', filename = '', width = 0, height = 0 }) {
    return this.fallback.analyzeImage({ base64Data, mimeType, filename, width, height });
  }
}

module.exports = OpenAiProvider;

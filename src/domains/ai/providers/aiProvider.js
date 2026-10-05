/**
 * AI Provider Base Interface & Factory
 * Provides unified contract for LLM and Semantic Vision/Text providers.
 */

const logger = require('../../../shared/utils/logger');
const config = require('../../../../config');

class BaseAIProvider {
  constructor(name) {
    this.name = name;
  }

  async generateText({ prompt, systemPrompt = '', temperature = 0.2 }) {
    throw new Error('generateText must be implemented by subclass');
  }

  async generateStructuredJson({ prompt, systemPrompt = '', schema = null }) {
    throw new Error('generateStructuredJson must be implemented by subclass');
  }

  async analyzeDocument({ text = '', mimeType = 'text/plain', filename = '', base64Data = null }) {
    throw new Error('analyzeDocument must be implemented by subclass');
  }

  async analyzeImage({ base64Data, mimeType = 'image/jpeg', filename = '', width = 0, height = 0 }) {
    throw new Error('analyzeImage must be implemented by subclass');
  }
}

class AIProviderFactory {
  static getProvider() {
    const providerName = (config.ai.provider || 'gemini').toLowerCase();

    // Lazy load providers to avoid circular dependencies
    const GeminiProvider = require('./geminiProvider');
    const OpenAiProvider = require('./openAiProvider');
    const LocalSemanticProvider = require('./localSemanticProvider');

    if (providerName === 'gemini' && config.ai.geminiApiKey) {
      return new GeminiProvider(config.ai.geminiApiKey, config.ai.geminiModel);
    }

    if (providerName === 'openai' && config.ai.openaiApiKey) {
      return new OpenAiProvider(config.ai.openaiApiKey, config.ai.openaiModel);
    }

    // Default to the high-accuracy built-in semantic engine
    return new LocalSemanticProvider();
  }
}

module.exports = {
  BaseAIProvider,
  AIProviderFactory
};

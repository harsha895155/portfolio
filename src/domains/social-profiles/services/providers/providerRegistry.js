/**
 * Provider Registry
 * Central registry that maps platform keys to their adapter implementations.
 * Provides unified interface: detectProvider(), verifyProfile(), fetchProfile().
 */
const logger = require('../../../../shared/utils/logger');

// Register all providers
const providers = {};

function register(provider) {
  providers[provider.key] = provider;
}

try { register(require('./leetCodeProvider')); } catch (e) { logger.warn('leetCodeProvider load failed', e); }
try { register(require('./codeChefProvider')); } catch (e) { logger.warn('codeChefProvider load failed', e); }
try { register(require('./hackerRankProvider')); } catch (e) { logger.warn('hackerRankProvider load failed', e); }
try { register(require('./codeforcesProvider')); } catch (e) { logger.warn('codeforcesProvider load failed', e); }
try { register(require('./kaggleProvider')); } catch (e) { logger.warn('kaggleProvider load failed', e); }
try { register(require('./linkedInProvider')); } catch (e) { logger.warn('linkedInProvider load failed', e); }
try { register(require('./unstopProvider')); } catch (e) { logger.warn('unstopProvider load failed', e); }

const registry = {
  /**
   * Get provider by platform key (e.g. 'leetcode', 'codeforces').
   */
  getProvider(key) {
    return providers[(key || '').toLowerCase().trim()] || null;
  },

  /**
   * Detect provider from a URL by checking domain matching.
   */
  detectFromUrl(url) {
    if (!url) return null;
    try {
      const { hostname } = new URL(url.startsWith('http') ? url : `https://${url}`);
      const h = hostname.toLowerCase();
      for (const [, p] of Object.entries(providers)) {
        // Simple domain check: if hostname contains the provider key
        if (h.includes(p.key.replace('_', '')) || h.includes(p.name.toLowerCase().replace(/\s/g, ''))) {
          return p;
        }
      }
    } catch (e) {}
    return null;
  },

  /**
   * List all registered providers and their capabilities.
   */
  listAll() {
    return Object.values(providers).map(p => ({
      key: p.key,
      name: p.name,
      supportsAutoSync: p.supportsAutoSync,
      dataFields: p.dataFields
    }));
  },

  /**
   * Unified verifyProfile across any registered platform.
   */
  async verifyProfile(key, url) {
    const p = this.getProvider(key) || this.detectFromUrl(url);
    if (!p) {
      // Fall through to generic link verifier (caller handles this)
      return null;
    }
    return await p.verifyProfile(url);
  },

  /**
   * Unified fetchProfile across any registered platform.
   */
  async fetchProfile(key, usernameOrUrl) {
    const p = this.getProvider(key);
    if (!p) return null;
    return await p.fetchProfile(usernameOrUrl);
  }
};

module.exports = registry;

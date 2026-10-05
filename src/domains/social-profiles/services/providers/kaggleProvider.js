/**
 * Kaggle Provider
 * No official public Kaggle API for profile stats without authentication.
 * Provides URL verification and reports capabilities honestly.
 */
const BaseProvider = require('./baseProvider');
const logger = require('../../../../shared/utils/logger');

class KaggleProvider extends BaseProvider {
  get name() { return 'Kaggle'; }
  get key() { return 'kaggle'; }
  get supportsAutoSync() { return false; }
  get dataFields() { return ['username', 'profileUrl']; }

  extractUsername(url) {
    if (!url) return null;
    const m = url.match(/kaggle\.com\/([^/?#]+)/i);
    return m ? m[1] : null;
  }

  async verifyProfile(url) {
    const username = this.extractUsername(url);
    if (!username) {
      return { verified: false, reason: 'Could not extract Kaggle username from URL (expected: kaggle.com/username).' };
    }
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow'
      });
      const verified = res.status < 400 || [401, 403, 429].includes(res.status);
      return {
        verified,
        reason: verified ? `Kaggle profile URL is reachable for @${username}` : `Kaggle profile not found (HTTP ${res.status})`,
        username
      };
    } catch (err) {
      return { verified: false, reason: `Could not verify Kaggle profile: ${err.message}` };
    }
  }

  async fetchProfile(usernameOrUrl) {
    return this._unavailable(
      'Kaggle does not provide a public API for profile statistics without API key authentication (kaggle.json). ' +
      'Profile URL has been verified. For detailed competition rankings and notebook data, use the Kaggle CLI with your API key.'
    );
  }
}

module.exports = new KaggleProvider();

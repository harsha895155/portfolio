/**
 * Unstop Provider
 * Unstop has no official public API for third-party profile data access.
 * Provides URL verification and reports capabilities honestly.
 */
const BaseProvider = require('./baseProvider');

class UnstopProvider extends BaseProvider {
  get name() { return 'Unstop'; }
  get key() { return 'unstop'; }
  get supportsAutoSync() { return false; }
  get dataFields() { return ['profileUrl']; }

  extractUsername(url) {
    if (!url) return null;
    const m = url.match(/unstop\.com\/@?([^/?#]+)/i);
    return m ? m[1] : null;
  }

  async verifyProfile(url) {
    if (!url || !url.includes('unstop.com')) {
      return { verified: false, reason: 'URL must be an Unstop profile link (unstop.com/@username).' };
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
        reason: verified ? 'Unstop profile URL is active and reachable.' : `Unstop profile returned HTTP ${res.status}.`
      };
    } catch (err) {
      return { verified: false, reason: `Could not verify Unstop profile: ${err.message}` };
    }
  }

  async fetchProfile(usernameOrUrl) {
    return this._unavailable(
      'Unstop does not provide a public API for profile statistics. ' +
      'Profile URL is linked and verified. Upload hackathon/competition certificates directly to sync achievements.'
    );
  }
}

module.exports = new UnstopProvider();

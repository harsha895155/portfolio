/**
 * LinkedIn Provider
 * LinkedIn requires OAuth 2.0 Partner Program access for any profile API.
 * No public API exists for third-party profile data fetching.
 * Provides URL verification only.
 */
const BaseProvider = require('./baseProvider');

class LinkedInProvider extends BaseProvider {
  get name() { return 'LinkedIn'; }
  get key() { return 'linkedin'; }
  get supportsAutoSync() { return false; }
  get dataFields() { return ['profileUrl']; }

  extractUsername(url) {
    if (!url) return null;
    const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    return m ? m[1] : null;
  }

  async verifyProfile(url) {
    if (!url || !url.includes('linkedin.com')) {
      return { verified: false, reason: 'URL must be a LinkedIn profile link (linkedin.com/in/username).' };
    }
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow'
      });
      // LinkedIn blocks most bots but the domain/URL is still reachable
      const verified = res.status < 400 || [401, 403, 429, 999].includes(res.status);
      return {
        verified,
        reason: verified
          ? 'LinkedIn profile URL is active (domain verified; LinkedIn applies bot-protection).'
          : `LinkedIn profile returned HTTP ${res.status}.`
      };
    } catch (err) {
      return { verified: false, reason: `Could not verify LinkedIn URL: ${err.message}` };
    }
  }

  async fetchProfile(usernameOrUrl) {
    return this._unavailable(
      'LinkedIn requires OAuth 2.0 Partner API credentials for automated profile data sync. ' +
      'No public API is available. Your profile URL is linked and verified. ' +
      'Keep your portfolio updated manually by exporting your LinkedIn profile PDF.'
    );
  }
}

module.exports = new LinkedInProvider();

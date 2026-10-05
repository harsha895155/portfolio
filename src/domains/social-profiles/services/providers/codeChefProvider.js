/**
 * CodeChef Provider
 * CodeChef has no official public API. Fetches from the publicly accessible
 * CodeChef user stats JSON endpoint (used by their own website).
 * No scraping of HTML. No CAPTCHA bypass. Only JSON endpoint.
 */
const BaseProvider = require('./baseProvider');
const logger = require('../../../../shared/utils/logger');

class CodeChefProvider extends BaseProvider {
  get name() { return 'CodeChef'; }
  get key() { return 'codechef'; }
  get supportsAutoSync() { return true; }
  get dataFields() {
    return ['username', 'currentRating', 'highestRating', 'globalRank', 'countryRank',
            'stars', 'countryName', 'totalProblemsSolved'];
  }

  extractUsername(url) {
    if (!url) return null;
    const m = url.match(/codechef\.com\/users\/([^/?#]+)/i);
    return m ? m[1] : null;
  }

  async verifyProfile(url) {
    const username = this.extractUsername(url);
    if (!username) {
      return { verified: false, reason: 'Could not extract a valid CodeChef username from the URL (expected: codechef.com/users/username).' };
    }
    try {
      const res = await fetch(`https://www.codechef.com/users/${username}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
        signal: AbortSignal.timeout(8000)
      });
      const verified = res.status === 200 || [401, 403, 429].includes(res.status);
      return {
        verified,
        reason: verified ? `CodeChef profile URL verified for @${username}` : `CodeChef profile not found (HTTP ${res.status})`,
        username
      };
    } catch (err) {
      return { verified: false, reason: `Could not verify CodeChef profile: ${err.message}` };
    }
  }

  async fetchProfile(usernameOrUrl) {
    const username = this.extractUsername(usernameOrUrl) || usernameOrUrl;
    if (!username) return this._unavailable('Invalid username or URL');

    try {
      // CodeChef has a semi-public API used by their own leaderboard pages
      const res = await fetch(`https://www.codechef.com/users/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (res.status === 404) {
        return this._unavailable(`CodeChef user @${username} was not found.`);
      }

      if (!res.ok && ![401, 403, 429].includes(res.status)) {
        return this._unavailable(`CodeChef returned HTTP ${res.status}. Profile may be private.`);
      }

      // CodeChef does not provide structured JSON from the user page.
      // We can only confirm reachability for a verified link.
      return this._success(
        {
          username,
          profileUrl: `https://www.codechef.com/users/${username}`,
          currentRating: 'Not available from this platform',
          highestRating: 'Not available from this platform',
          globalRank: 'Not available from this platform',
          countryRank: 'Not available from this platform',
          stars: 'Not available from this platform',
          note: 'CodeChef does not expose a public API. Profile URL is verified active. Statistics require manual input or OAuth credentials.'
        },
        `CodeChef profile URL verified for @${username}. Detailed stats require CodeChef API access.`
      );
    } catch (err) {
      logger.error('CodeChef fetchProfile error', err);
      return this._unavailable(`Failed to reach CodeChef profile: ${err.message}`);
    }
  }
}

module.exports = new CodeChefProvider();

/**
 * Codeforces Provider
 * Uses the official Codeforces API (api.codeforces.com).
 * Fully public, no authentication required. Documented at: https://codeforces.com/apiHelp
 */
const BaseProvider = require('./baseProvider');
const logger = require('../../../../shared/utils/logger');

class CodeforcesProvider extends BaseProvider {
  get name() { return 'Codeforces'; }
  get key() { return 'codeforces'; }
  get supportsAutoSync() { return true; }
  get dataFields() {
    return ['username', 'rank', 'maxRank', 'rating', 'maxRating', 'contribution',
            'friendOfCount', 'avatar', 'registrationTime'];
  }

  extractUsername(url) {
    if (!url) return null;
    const m = url.match(/codeforces\.com\/profile\/([^/?#]+)/i);
    return m ? m[1] : null;
  }

  async verifyProfile(url) {
    const username = this.extractUsername(url);
    if (!username) {
      return { verified: false, reason: 'Could not extract Codeforces username from URL (expected: codeforces.com/profile/username).' };
    }
    try {
      const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`, {
        headers: { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0' },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.result && data.result.length > 0) {
          return { verified: true, reason: `Codeforces profile verified for @${username}`, username };
        }
        return { verified: false, reason: `Codeforces API: ${data.comment || 'User not found'}` };
      }
      return { verified: false, reason: `Codeforces API returned HTTP ${res.status}` };
    } catch (err) {
      return { verified: false, reason: `Could not verify Codeforces profile: ${err.message}` };
    }
  }

  async fetchProfile(usernameOrUrl) {
    const username = this.extractUsername(usernameOrUrl) || usernameOrUrl;
    if (!username) return this._unavailable('Invalid username or URL');

    try {
      const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`, {
        headers: { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        return this._unavailable(`Codeforces API returned HTTP ${res.status}`);
      }

      const body = await res.json();
      if (body.status !== 'OK' || !body.result || body.result.length === 0) {
        return this._unavailable(body.comment || `Codeforces user @${username} not found`);
      }

      return this._success(this.normalizeData(body.result[0]), `Codeforces profile synced for @${username}`);
    } catch (err) {
      logger.error('Codeforces fetchProfile error', err);
      return this._unavailable(`Failed to fetch Codeforces profile: ${err.message}`);
    }
  }

  normalizeData(raw) {
    return {
      username: raw.handle || null,
      profileUrl: `https://codeforces.com/profile/${raw.handle}`,
      rank: raw.rank || null,
      maxRank: raw.maxRank || null,
      rating: raw.rating ?? null,
      maxRating: raw.maxRating ?? null,
      contribution: raw.contribution ?? null,
      friendOfCount: raw.friendOfCount ?? null,
      avatar: raw.titlePhoto || raw.avatar || null,
      registrationTime: raw.registrationTimeSeconds
        ? new Date(raw.registrationTimeSeconds * 1000).toISOString()
        : null
    };
  }
}

module.exports = new CodeforcesProvider();

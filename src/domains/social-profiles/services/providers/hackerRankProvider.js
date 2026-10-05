/**
 * HackerRank Provider
 * HackerRank exposes a public profile API endpoint for badge/certificate data.
 * Uses the official public stats endpoint. No login required.
 */
const BaseProvider = require('./baseProvider');
const logger = require('../../../../shared/utils/logger');

class HackerRankProvider extends BaseProvider {
  get name() { return 'HackerRank'; }
  get key() { return 'hackerrank'; }
  get supportsAutoSync() { return true; }
  get dataFields() {
    return ['username', 'badges', 'certificates', 'skills', 'followersCount'];
  }

  extractUsername(url) {
    if (!url) return null;
    const m = url.match(/hackerrank\.com\/(?:profile\/)?([^/?#]+)/i);
    return m ? m[1] : null;
  }

  async verifyProfile(url) {
    const username = this.extractUsername(url);
    if (!username) {
      return { verified: false, reason: 'Could not extract a valid HackerRank username from URL.' };
    }
    try {
      const apiRes = await fetch(`https://www.hackerrank.com/rest/contests/master/hackers/${username}/profile`, {
        headers: { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (apiRes.ok) {
        return { verified: true, reason: `HackerRank profile verified for @${username}`, username };
      }
      const pageRes = await fetch(`https://www.hackerrank.com/profile/${username}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });
      const verified = pageRes.status < 400 || [401, 403, 429].includes(pageRes.status);
      return {
        verified,
        reason: verified ? `HackerRank profile URL verified for @${username}` : `HackerRank profile not found (HTTP ${pageRes.status})`,
        username
      };
    } catch (err) {
      return { verified: false, reason: `Could not verify HackerRank profile: ${err.message}` };
    }
  }

  async fetchProfile(usernameOrUrl) {
    const username = this.extractUsername(usernameOrUrl) || usernameOrUrl;
    if (!username) return this._unavailable('Invalid username or URL');

    try {
      const [profileRes, badgesRes] = await Promise.allSettled([
        fetch(`https://www.hackerrank.com/rest/contests/master/hackers/${username}/profile`, {
          headers: { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0', Accept: 'application/json' },
          signal: AbortSignal.timeout(10000)
        }),
        fetch(`https://www.hackerrank.com/rest/hackers/${username}/badges`, {
          headers: { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0', Accept: 'application/json' },
          signal: AbortSignal.timeout(10000)
        })
      ]);

      let profileData = null;
      let badgesData = null;

      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const body = await profileRes.value.json();
        profileData = body.model || body;
      }
      if (badgesRes.status === 'fulfilled' && badgesRes.value.ok) {
        const body = await badgesRes.value.json();
        badgesData = body.models || [];
      }

      if (!profileData && !badgesData) {
        return this._unavailable(`HackerRank public API did not return data for @${username}. The API may have changed or the profile is private.`);
      }

      return this._success(this.normalizeData({ username, profileData, badgesData }), `HackerRank profile synced for @${username}`);
    } catch (err) {
      logger.error('HackerRank fetchProfile error', err);
      return this._unavailable(`Failed to fetch HackerRank profile: ${err.message}`);
    }
  }

  normalizeData({ username, profileData, badgesData }) {
    const badges = Array.isArray(badgesData)
      ? badgesData.map(b => ({ name: b.display_name || b.badge_name, stars: b.stars }))
      : null;

    return {
      username,
      profileUrl: `https://www.hackerrank.com/profile/${username}`,
      followersCount: profileData ? (profileData.followers_count ?? null) : null,
      skills: profileData ? (profileData.skills || null) : null,
      badges: badges,
      badgeCount: badges ? badges.length : null
    };
  }
}

module.exports = new HackerRankProvider();

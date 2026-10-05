/**
 * LeetCode Provider
 * Uses LeetCode's official public GraphQL API (leetcode.com/graphql) as the primary data source,
 * with fallback to public stats endpoints.
 * This API returns public user statistics without authentication.
 * No scraping. No login bypass. 100% compliant with public interfaces.
 */
const BaseProvider = require('./baseProvider');
const logger = require('../../../../shared/utils/logger');

class LeetCodeProvider extends BaseProvider {
  get name() { return 'LeetCode'; }
  get key() { return 'leetcode'; }
  get supportsAutoSync() { return true; }
  get dataFields() {
    return ['username', 'ranking', 'totalSolved', 'easySolved', 'mediumSolved', 'hardSolved',
            'acceptanceRate', 'reputation'];
  }

  extractUsername(url) {
    if (!url) return null;
    const m = url.match(/leetcode\.com\/(?:u\/)?([^/?#]+)/i);
    return m ? m[1].replace(/\/$/, '') : null;
  }

  async verifyProfile(url) {
    const username = this.extractUsername(url);
    if (!username) {
      return { verified: false, reason: 'Could not extract a valid LeetCode username from the URL (expected: leetcode.com/u/username).' };
    }

    try {
      // 1. Direct official GraphQL check
      const gqlRes = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          query: `query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              username
              profile {
                ranking
              }
              submitStatsGlobal {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }`,
          variables: { username }
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        if (gqlData && gqlData.data && gqlData.data.matchedUser) {
          const u = gqlData.data.matchedUser;
          const totalObj = (u.submitStatsGlobal?.acSubmissionNum || []).find(x => x.difficulty === 'All');
          const solved = totalObj ? totalObj.count : 0;
          return {
            verified: true,
            status: 'VERIFIED',
            reason: `LeetCode profile confirmed for @${u.username} (${solved} solved, Rank: ${u.profile?.ranking || 'N/A'})`,
            username: u.username,
            totalSolved: solved
          };
        }
        if (gqlData.errors && gqlData.errors.some(e => (e.message || '').includes('does not exist'))) {
          return {
            verified: false,
            status: 'NOT_VERIFIED',
            reason: `LeetCode user @${username} does not exist.`,
            username
          };
        }
      }

      // 2. Direct page check fallback
      const pageRes = await fetch(`https://leetcode.com/u/${encodeURIComponent(username)}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });

      if (pageRes.status === 404) {
        return { verified: false, status: 'NOT_VERIFIED', reason: `LeetCode profile @${username} not found (HTTP 404).`, username };
      }

      const verified = pageRes.status < 400 || [401, 403, 429].includes(pageRes.status);
      return {
        verified,
        status: verified ? 'PARTIALLY_VERIFIED' : 'NOT_VERIFIED',
        reason: verified ? `LeetCode profile URL is reachable for @${username}` : `LeetCode profile returned HTTP ${pageRes.status}`,
        username
      };
    } catch (err) {
      logger.warn('LeetCode verify error', err);
      return { verified: false, status: 'UNABLE_TO_VERIFY', reason: `Could not reach LeetCode: ${err.message}` };
    }
  }

  async fetchProfile(usernameOrUrl) {
    const username = this.extractUsername(usernameOrUrl) || usernameOrUrl;
    if (!username) return this._unavailable('Invalid username or URL');

    try {
      // Primary: LeetCode official GraphQL API
      const gqlRes = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          query: `query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              username
              profile {
                ranking
                reputation
              }
              submitStatsGlobal {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }`,
          variables: { username }
        }),
        signal: AbortSignal.timeout(9000)
      });

      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        if (gqlData && gqlData.data && gqlData.data.matchedUser) {
          const u = gqlData.data.matchedUser;
          const stats = u.submitStatsGlobal?.acSubmissionNum || [];
          const allCount = stats.find(s => s.difficulty === 'All')?.count ?? 0;
          const easyCount = stats.find(s => s.difficulty === 'Easy')?.count ?? 0;
          const medCount = stats.find(s => s.difficulty === 'Medium')?.count ?? 0;
          const hardCount = stats.find(s => s.difficulty === 'Hard')?.count ?? 0;

          const normalized = {
            username: u.username,
            profileUrl: `https://leetcode.com/u/${u.username}/`,
            ranking: u.profile?.ranking ?? null,
            totalSolved: allCount,
            easySolved: easyCount,
            mediumSolved: medCount,
            hardSolved: hardCount,
            reputation: u.profile?.reputation ?? null,
            source: 'LeetCode Official GraphQL API'
          };

          return this._success(normalized, `LeetCode profile synced for @${u.username} (${allCount} solved)`);
        }

        if (gqlData.errors && gqlData.errors.some(e => (e.message || '').includes('does not exist'))) {
          return this._unavailable(`LeetCode user @${username} does not exist.`);
        }
      }

      // Secondary fallback: leetcode-stats-api
      const res = await fetch(`https://leetcode-stats-api.herokuapp.com/${encodeURIComponent(username)}`, {
        headers: { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const raw = await res.json();
        if (raw && raw.status !== 'error') {
          return this._success(this.normalizeData({ ...raw, username }), `LeetCode profile synced for @${username}`);
        }
      }

      return this._unavailable(`LeetCode public API could not retrieve data for @${username}. Profile may be private or not found.`);
    } catch (err) {
      logger.error('LeetCode fetchProfile error', err);
      return this._unavailable(`Failed to fetch LeetCode profile: ${err.message}`);
    }
  }

  normalizeData(raw) {
    return {
      username: raw.username || null,
      profileUrl: `https://leetcode.com/u/${raw.username}/`,
      ranking: raw.ranking ?? null,
      totalSolved: raw.totalSolved ?? null,
      easySolved: raw.easySolved ?? null,
      mediumSolved: raw.mediumSolved ?? null,
      hardSolved: raw.hardSolved ?? null,
      totalQuestions: raw.totalQuestions ?? null,
      acceptanceRate: raw.acceptanceRate ? `${raw.acceptanceRate}%` : null,
      contributionPoints: raw.contributionPoints ?? null,
      reputation: raw.reputation ?? null,
      source: 'LeetCode Stats API'
    };
  }
}

module.exports = new LeetCodeProvider();

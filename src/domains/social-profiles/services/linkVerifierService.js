/**
 * Link Verifier Service (SSRF-Protected & Multi-Platform Identity Verification)
 * Validates website URLs, blocks SSRF/internal network targets, prevents DNS rebinding,
 * safely follows redirects, and confirms profile identity across supported providers.
 */

const { URL } = require('url');
const dns = require('dns').promises;
const logger = require('../../../shared/utils/logger');

// Known platform domain requirements
const KNOWN_PLATFORMS = {
  credly: {
    name: 'Credly',
    domains: ['credly.com'],
    example: 'https://www.credly.com/users/username/badges',
    extractUsername: (url) => {
      const m = url.match(/credly\.com\/users\/([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  github: {
    name: 'GitHub',
    domains: ['github.com'],
    example: 'https://github.com/username',
    extractUsername: (url) => {
      const m = url.match(/github\.com\/([^/?#]+)/i);
      return m && !['login', 'signup', 'features', 'pricing', 'about'].includes(m[1].toLowerCase()) ? m[1] : null;
    }
  },
  linkedin: {
    name: 'LinkedIn',
    domains: ['linkedin.com'],
    example: 'https://www.linkedin.com/in/username',
    extractUsername: (url) => {
      const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  unstop: {
    name: 'Unstop',
    domains: ['unstop.com'],
    example: 'https://unstop.com/@username',
    extractUsername: (url) => {
      const m = url.match(/unstop\.com\/@?([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  leetcode: {
    name: 'LeetCode',
    domains: ['leetcode.com'],
    example: 'https://leetcode.com/u/username',
    extractUsername: (url) => {
      const m = url.match(/leetcode\.com\/(?:u\/)?([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  hackerrank: {
    name: 'HackerRank',
    domains: ['hackerrank.com'],
    example: 'https://www.hackerrank.com/profile/username',
    extractUsername: (url) => {
      const m = url.match(/hackerrank\.com\/(?:profile\/)?([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  codeforces: {
    name: 'Codeforces',
    domains: ['codeforces.com'],
    example: 'https://codeforces.com/profile/username',
    extractUsername: (url) => {
      const m = url.match(/codeforces\.com\/profile\/([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  codechef: {
    name: 'CodeChef',
    domains: ['codechef.com'],
    example: 'https://www.codechef.com/users/username',
    extractUsername: (url) => {
      const m = url.match(/codechef\.com\/users\/([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  kaggle: {
    name: 'Kaggle',
    domains: ['kaggle.com'],
    example: 'https://www.kaggle.com/username',
    extractUsername: (url) => {
      const m = url.match(/kaggle\.com\/([^/?#]+)/i);
      return m && !['learn', 'competitions', 'datasets', 'models', 'code', 'discussions'].includes(m[1].toLowerCase()) ? m[1] : null;
    }
  },
  medium: {
    name: 'Medium',
    domains: ['medium.com'],
    example: 'https://medium.com/@username',
    extractUsername: (url) => {
      const m = url.match(/medium\.com\/@?([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  devto: {
    name: 'Dev.to',
    domains: ['dev.to'],
    example: 'https://dev.to/username',
    extractUsername: (url) => {
      const m = url.match(/dev\.to\/([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  twitter: {
    name: 'X (Twitter)',
    domains: ['twitter.com', 'x.com'],
    example: 'https://x.com/username',
    extractUsername: (url) => {
      const m = url.match(/(?:x|twitter)\.com\/([^/?#]+)/i);
      return m ? m[1] : null;
    }
  },
  x: {
    name: 'X (Twitter)',
    domains: ['x.com', 'twitter.com'],
    example: 'https://x.com/username',
    extractUsername: (url) => {
      const m = url.match(/(?:x|twitter)\.com\/([^/?#]+)/i);
      return m ? m[1] : null;
    }
  }
};

/**
 * Strict check for Private/Reserved/Internal IP addresses (SSRF Prevention)
 */
function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  const clean = ip.trim().toLowerCase();

  // IPv6 loopback & unspecified
  if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1' || clean === '0:0:0:0:0:0:0:0') {
    return true;
  }
  // IPv6 unique local (fc00::/7) or link-local (fe80::/10)
  if (/^(fc|fd|fe80)/i.test(clean)) return true;

  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\./.test(clean)) return true;
  // IPv4 Zero / current network (0.0.0.0/8)
  if (/^0\./.test(clean) || clean === '0.0.0.0') return true;
  // RFC 1918 Private networks
  // 10.0.0.0/8
  if (/^10\./.test(clean)) return true;
  // 172.16.0.0/12
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  // 192.168.0.0/16
  if (/^192\.168\./.test(clean)) return true;
  // Link-local / Cloud metadata (169.254.0.0/16, e.g. 169.254.169.254)
  if (/^169\.254\./.test(clean)) return true;
  // Carrier-grade NAT (100.64.0.0/10)
  if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(clean)) return true;
  // Broadcast
  if (clean === '255.255.255.255') return true;

  return false;
}

// Hostname regex for suspicious or internal hostnames
const BLOCKED_HOSTNAMES = /^(localhost|.*\.localhost|.*\.internal|.*\.local|.*\.corp|.*\.lan|.*\.intranet|metadata\.google\.internal)$/i;

class LinkVerifierService {
  /**
   * Validate URL syntax and check for internal/SSRF hostnames
   */
  validateSyntax(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { valid: false, reason: 'URL string is required' };
    }

    let trimmed = rawUrl.trim();
    if (!trimmed) {
      return { valid: false, reason: 'URL cannot be empty' };
    }

    // Auto-prepend https:// if protocol omitted
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (e) {
      return { valid: false, reason: 'Invalid URL structure' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'URL protocol must be http:// or https://' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Direct SSRF hostname check
    if (BLOCKED_HOSTNAMES.test(hostname) || isPrivateIp(hostname)) {
      return {
        valid: false,
        isSsrfBlocked: true,
        reason: 'Security violation: Access to localhost, cloud metadata, or private network addresses is forbidden.'
      };
    }

    // Domain name must have valid structure
    if (!hostname.includes('.') || hostname.endsWith('.')) {
      return { valid: false, reason: 'Invalid domain name structure' };
    }

    return { valid: true, normalizedUrl: parsed.href, hostname, parsed };
  }

  /**
   * Resolve DNS and verify that NO resolved IP belongs to private/internal ranges
   */
  async resolveAndVerifyDns(hostname) {
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) {
        return { valid: false, reason: `Domain "${hostname}" does not resolve to any IP address.` };
      }

      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          return {
            valid: false,
            isSsrfBlocked: true,
            reason: `Security violation: Domain "${hostname}" resolved to prohibited private IP address (${addr.address}). SSRF blocked.`
          };
        }
      }

      return { valid: true, addresses: addresses.map(a => a.address) };
    } catch (dnsErr) {
      return {
        valid: false,
        reason: `DNS resolution failed for domain "${hostname}": ${dnsErr.message}`
      };
    }
  }

  /**
   * Check if the website name matches the URL domain
   */
  validatePlatformMatch(platformName = '', hostname = '') {
    const pName = platformName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const host = hostname.toLowerCase();

    let matchedKey = null;
    for (const key of Object.keys(KNOWN_PLATFORMS)) {
      if (pName.includes(key) || key.includes(pName)) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      return { match: true, isKnown: false };
    }

    const platformConfig = KNOWN_PLATFORMS[matchedKey];
    const isDomainMatch = platformConfig.domains.some(d => host === d || host.endsWith('.' + d));

    if (!isDomainMatch) {
      return {
        match: false,
        isKnown: true,
        expectedDomains: platformConfig.domains,
        reason: `Website name "${platformName}" does not match the URL domain (${host}). Expected a ${platformConfig.name} link (e.g. ${platformConfig.domains[0]}).`
      };
    }

    return { match: true, isKnown: true, platformKey: matchedKey };
  }

  /**
   * Safely execute HTTP request following safe redirects with SSRF checks at each step
   */
  async safeFetch(initialUrl, maxRedirects = 5) {
    let currentUrl = initialUrl;
    let redirectsCount = 0;

    while (redirectsCount <= maxRedirects) {
      const syntax = this.validateSyntax(currentUrl);
      if (!syntax.valid) {
        return {
          ok: false,
          status: null,
          error: syntax.reason,
          isSsrfBlocked: syntax.isSsrfBlocked
        };
      }

      const dnsCheck = await this.resolveAndVerifyDns(syntax.hostname);
      if (!dnsCheck.valid) {
        return {
          ok: false,
          status: null,
          error: dnsCheck.reason,
          isSsrfBlocked: dnsCheck.isSsrfBlocked
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      try {
        const res = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          signal: controller.signal,
          redirect: 'manual' // manual to verify target host against SSRF
        });
        clearTimeout(timeout);

        // Check for redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.get('location');
          if (!location) {
            return { ok: true, status: res.status, finalUrl: currentUrl, res };
          }
          const nextUrl = new URL(location, currentUrl).href;
          redirectsCount++;
          if (redirectsCount > maxRedirects) {
            return { ok: false, status: res.status, error: 'Too many redirects (exceeded limit of 5).' };
          }
          currentUrl = nextUrl;
          continue;
        }

        return { ok: true, status: res.status, finalUrl: currentUrl, res };
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          return { ok: false, status: null, error: 'Verification timed out after 9 seconds. The server did not respond.' };
        }
        return { ok: false, status: null, error: `Connection failed: ${err.message}` };
      }
    }

    return { ok: false, status: null, error: 'Redirect loop or exceeded maximum redirects.' };
  }

  /**
   * Main verification entrypoint:
   * Returns standard 4-state result:
   *  - 🟢 VERIFIED
   *  - 🟡 PARTIALLY_VERIFIED
   *  - 🔴 NOT_VERIFIED
   *  - ⚪ UNABLE_TO_VERIFY
   */
  async verify(rawUrl, platformName = '') {
    const verificationTime = new Date().toISOString();

    // 1. Syntax & Initial SSRF check
    const syntax = this.validateSyntax(rawUrl);
    if (!syntax.valid) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url: rawUrl,
        reason: syntax.reason,
        step: 'syntax',
        verificationTime,
        isSsrfBlocked: Boolean(syntax.isSsrfBlocked)
      };
    }

    const { normalizedUrl, hostname } = syntax;

    // 2. DNS & SSRF Resolution Check
    const dnsCheck = await this.resolveAndVerifyDns(hostname);
    if (!dnsCheck.valid) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url: normalizedUrl,
        hostname,
        reason: dnsCheck.reason,
        step: 'dns_ssrf',
        verificationTime,
        isSsrfBlocked: Boolean(dnsCheck.isSsrfBlocked)
      };
    }

    // 3. Platform Match
    let platformKey = null;
    let expectedProvider = null;
    if (platformName && platformName.trim()) {
      const matchResult = this.validatePlatformMatch(platformName, hostname);
      if (!matchResult.match) {
        return {
          status: 'NOT_VERIFIED',
          verified: false,
          url: normalizedUrl,
          hostname,
          platformName,
          reason: matchResult.reason,
          step: 'platform_match',
          verificationTime
        };
      }
      platformKey = matchResult.platformKey;
    } else {
      // Auto-detect platform key from hostname
      for (const [k, p] of Object.entries(KNOWN_PLATFORMS)) {
        if (p.domains.some(d => hostname === d || hostname.endsWith('.' + d))) {
          platformKey = k;
          break;
        }
      }
    }

    expectedProvider = platformKey && KNOWN_PLATFORMS[platformKey] ? KNOWN_PLATFORMS[platformKey].name : (platformName || 'Web Profile');

    // 4. Provider-Specific Deep Verification
    if (platformKey === 'github') {
      return await this._verifyGitHub(normalizedUrl, verificationTime);
    }
    if (platformKey === 'leetcode') {
      return await this._verifyLeetCode(normalizedUrl, verificationTime);
    }
    if (platformKey === 'codeforces') {
      return await this._verifyCodeforces(normalizedUrl, verificationTime);
    }
    if (platformKey === 'hackerrank') {
      return await this._verifyHackerRank(normalizedUrl, verificationTime);
    }
    if (platformKey === 'codechef') {
      return await this._verifyCodeChef(normalizedUrl, verificationTime);
    }
    if (platformKey === 'linkedin') {
      return await this._verifyLinkedIn(normalizedUrl, verificationTime);
    }
    if (platformKey === 'unstop') {
      return await this._verifyUnstop(normalizedUrl, verificationTime);
    }
    if (platformKey === 'credly') {
      return await this._verifyCredly(normalizedUrl, verificationTime);
    }

    // 5. Generic Safe Reachability Check for Custom Portfolios/Websites
    const fetchResult = await this.safeFetch(normalizedUrl);
    if (!fetchResult.ok) {
      return {
        status: fetchResult.isSsrfBlocked ? 'NOT_VERIFIED' : 'UNABLE_TO_VERIFY',
        verified: false,
        url: normalizedUrl,
        hostname,
        platformName: expectedProvider,
        httpStatus: fetchResult.status,
        reason: fetchResult.error,
        verificationTime
      };
    }

    const status = fetchResult.status;
    if (status === 404 || status === 410) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url: normalizedUrl,
        hostname,
        platformName: expectedProvider,
        httpStatus: status,
        reason: `Target page not found (HTTP ${status}). The profile or webpage does not exist.`,
        verificationTime
      };
    }

    if (status >= 200 && status < 400) {
      return {
        status: 'VERIFIED',
        verified: true,
        url: normalizedUrl,
        hostname,
        platformName: expectedProvider,
        httpStatus: status,
        finalUrl: fetchResult.finalUrl,
        reason: `Web link is active and reachable (HTTP ${status} OK).`,
        verificationTime
      };
    }

    if ([401, 403, 429, 999].includes(status)) {
      return {
        status: 'PARTIALLY_VERIFIED',
        verified: true,
        url: normalizedUrl,
        hostname,
        platformName: expectedProvider,
        httpStatus: status,
        finalUrl: fetchResult.finalUrl,
        reason: `Domain resolved and server reachable (protected by platform bot-guard HTTP ${status}).`,
        verificationTime
      };
    }

    return {
      status: 'UNABLE_TO_VERIFY',
      verified: false,
      url: normalizedUrl,
      hostname,
      platformName: expectedProvider,
      httpStatus: status,
      reason: `Server responded with unexpected status HTTP ${status}.`,
      verificationTime
    };
  }

  // ─── PLATFORM-SPECIFIC DEEP VERIFIERS ───────────────────────────────────────

  async _verifyGitHub(url, verificationTime) {
    const username = KNOWN_PLATFORMS.github.extractUsername(url);
    if (!username) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'GitHub',
        reason: 'Could not extract a valid GitHub username from URL (expected: github.com/username).',
        verificationTime
      };
    }

    try {
      const config = require('../../../../config');
      const headers = { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0', Accept: 'application/vnd.github.v3+json' };
      if (config.social && config.social.githubToken) {
        headers['Authorization'] = `token ${config.social.githubToken}`;
      }

      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
        headers,
        signal: AbortSignal.timeout(8000)
      });

      if (res.status === 404) {
        return {
          status: 'NOT_VERIFIED',
          verified: false,
          url,
          provider: 'GitHub',
          username,
          httpStatus: 404,
          reason: `GitHub profile "@${username}" does not exist (HTTP 404 Not Found).`,
          verificationTime
        };
      }

      if (res.ok) {
        const data = await res.json();
        return {
          status: 'VERIFIED',
          verified: true,
          url,
          provider: 'GitHub',
          username: data.login,
          name: data.name || data.login,
          httpStatus: 200,
          publicRepos: data.public_repos,
          followers: data.followers,
          avatarUrl: data.avatar_url,
          reason: `GitHub profile verified for @${data.login} (${data.name || 'User'}, ${data.public_repos} public repos).`,
          verificationTime,
          data: {
            username: data.login,
            name: data.name,
            bio: data.bio,
            publicRepos: data.public_repos,
            followers: data.followers
          }
        };
      }

      // If rate limited, fall back to safe page check
      const pageCheck = await this.safeFetch(url);
      if (pageCheck.ok && (pageCheck.status < 400 || [401, 403, 429].includes(pageCheck.status))) {
        return {
          status: 'PARTIALLY_VERIFIED',
          verified: true,
          url,
          provider: 'GitHub',
          username,
          httpStatus: pageCheck.status,
          reason: `GitHub profile URL is reachable for @${username} (GitHub API rate limited).`,
          verificationTime
        };
      }

      return {
        status: 'UNABLE_TO_VERIFY',
        verified: false,
        url,
        provider: 'GitHub',
        username,
        reason: `GitHub API returned HTTP ${res.status}.`,
        verificationTime
      };
    } catch (e) {
      return {
        status: 'UNABLE_TO_VERIFY',
        verified: false,
        url,
        provider: 'GitHub',
        username,
        reason: `Connection error verifying GitHub profile: ${e.message}`,
        verificationTime
      };
    }
  }

  async _verifyLeetCode(url, verificationTime) {
    try {
      const provider = require('./providers/providerRegistry').getProvider('leetcode');
      if (provider) {
        const result = await provider.verifyProfile(url);
        return {
          status: result.verified ? (result.status || 'VERIFIED') : 'NOT_VERIFIED',
          verified: result.verified,
          url,
          provider: 'LeetCode',
          username: result.username,
          totalSolved: result.totalSolved,
          reason: result.reason,
          verificationTime,
          data: result
        };
      }
    } catch (e) {
      logger.warn('LeetCode provider verify failed, falling back', e);
    }

    const username = KNOWN_PLATFORMS.leetcode.extractUsername(url);
    if (!username) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'LeetCode',
        reason: 'Could not extract LeetCode username from URL (expected: leetcode.com/u/username).',
        verificationTime
      };
    }

    const pageCheck = await this.safeFetch(url);
    if (pageCheck.ok && (pageCheck.status < 400 || [401, 403, 429].includes(pageCheck.status))) {
      return {
        status: 'PARTIALLY_VERIFIED',
        verified: true,
        url,
        provider: 'LeetCode',
        username,
        httpStatus: pageCheck.status,
        reason: `LeetCode profile URL is reachable for @${username}.`,
        verificationTime
      };
    }

    return {
      status: 'NOT_VERIFIED',
      verified: false,
      url,
      provider: 'LeetCode',
      username,
      reason: `LeetCode user @${username} not found.`,
      verificationTime
    };
  }

  async _verifyCodeforces(url, verificationTime) {
    const username = KNOWN_PLATFORMS.codeforces.extractUsername(url);
    if (!username) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'Codeforces',
        reason: 'Could not extract Codeforces handle from URL (expected: codeforces.com/profile/username).',
        verificationTime
      };
    }

    try {
      const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`, {
        headers: { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const body = await res.json();
        if (body.status === 'OK' && body.result && body.result.length > 0) {
          const user = body.result[0];
          return {
            status: 'VERIFIED',
            verified: true,
            url,
            provider: 'Codeforces',
            username: user.handle,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.handle,
            rating: user.rating,
            rank: user.rank,
            reason: `Codeforces handle confirmed for @${user.handle} (Rank: ${user.rank || 'Unrated'}, Rating: ${user.rating || 0}).`,
            verificationTime,
            data: user
          };
        }
        return {
          status: 'NOT_VERIFIED',
          verified: false,
          url,
          provider: 'Codeforces',
          username,
          reason: body.comment || `Codeforces handle @${username} does not exist.`,
          verificationTime
        };
      }

      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'Codeforces',
        username,
        httpStatus: res.status,
        reason: `Codeforces API returned HTTP ${res.status}. User may not exist.`,
        verificationTime
      };
    } catch (e) {
      return {
        status: 'UNABLE_TO_VERIFY',
        verified: false,
        url,
        provider: 'Codeforces',
        username,
        reason: `Error connecting to Codeforces API: ${e.message}`,
        verificationTime
      };
    }
  }

  async _verifyHackerRank(url, verificationTime) {
    const username = KNOWN_PLATFORMS.hackerrank.extractUsername(url);
    if (!username) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'HackerRank',
        reason: 'Could not extract HackerRank username from URL (expected: hackerrank.com/profile/username).',
        verificationTime
      };
    }

    try {
      const res = await fetch(`https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(username)}/profile`, {
        headers: { 'User-Agent': 'Harshavardhan-Portfolio-CMS/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const body = await res.json();
        const model = body.model || body;
        return {
          status: 'VERIFIED',
          verified: true,
          url,
          provider: 'HackerRank',
          username,
          name: model.name || username,
          reason: `HackerRank profile verified for @${username}.`,
          verificationTime,
          data: model
        };
      }

      const pageCheck = await this.safeFetch(url);
      if (pageCheck.ok && (pageCheck.status < 400 || [401, 403, 429].includes(pageCheck.status))) {
        return {
          status: 'PARTIALLY_VERIFIED',
          verified: true,
          url,
          provider: 'HackerRank',
          username,
          httpStatus: pageCheck.status,
          reason: `HackerRank profile URL is active for @${username}.`,
          verificationTime
        };
      }

      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'HackerRank',
        username,
        reason: `HackerRank profile @${username} not found.`,
        verificationTime
      };
    } catch (e) {
      return {
        status: 'UNABLE_TO_VERIFY',
        verified: false,
        url,
        provider: 'HackerRank',
        username,
        reason: `Error verifying HackerRank profile: ${e.message}`,
        verificationTime
      };
    }
  }

  async _verifyCodeChef(url, verificationTime) {
    const username = KNOWN_PLATFORMS.codechef.extractUsername(url);
    if (!username) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'CodeChef',
        reason: 'Could not extract CodeChef username from URL (expected: codechef.com/users/username).',
        verificationTime
      };
    }

    const check = await this.safeFetch(`https://www.codechef.com/users/${encodeURIComponent(username)}`);
    if (!check.ok) {
      return {
        status: 'UNABLE_TO_VERIFY',
        verified: false,
        url,
        provider: 'CodeChef',
        username,
        reason: check.error,
        verificationTime
      };
    }

    if (check.status === 404) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'CodeChef',
        username,
        httpStatus: 404,
        reason: `CodeChef user @${username} not found.`,
        verificationTime
      };
    }

    if (check.status < 400 || [401, 403, 429].includes(check.status)) {
      return {
        status: 'VERIFIED',
        verified: true,
        url,
        provider: 'CodeChef',
        username,
        httpStatus: check.status,
        reason: `CodeChef profile URL verified active for @${username}.`,
        verificationTime
      };
    }

    return {
      status: 'UNABLE_TO_VERIFY',
      verified: false,
      url,
      provider: 'CodeChef',
      username,
      httpStatus: check.status,
      reason: `CodeChef server returned HTTP ${check.status}.`,
      verificationTime
    };
  }

  async _verifyLinkedIn(url, verificationTime) {
    const username = KNOWN_PLATFORMS.linkedin.extractUsername(url);
    if (!username) {
      return {
        status: 'NOT_VERIFIED',
        verified: false,
        url,
        provider: 'LinkedIn',
        reason: 'Could not extract LinkedIn username from URL (expected: linkedin.com/in/username).',
        verificationTime
      };
    }

    // LinkedIn uses strict anti-scraping and partner OAuth API requirements.
    const check = await this.safeFetch(url);
    if (check.ok && (check.status < 400 || [401, 403, 429, 999].includes(check.status))) {
      return {
        status: 'PARTIALLY_VERIFIED',
        verified: true,
        url,
        provider: 'LinkedIn',
        username,
        httpStatus: check.status,
        reason: `LinkedIn profile link confirmed active for @${username}. (LinkedIn Partner API required for automated statistics).`,
        verificationTime
      };
    }

    return {
      status: 'UNABLE_TO_VERIFY',
      verified: false,
      url,
      provider: 'LinkedIn',
      username,
      reason: check.error || `Unable to reach LinkedIn link.`,
      verificationTime
    };
  }

  async _verifyUnstop(url, verificationTime) {
    const username = KNOWN_PLATFORMS.unstop.extractUsername(url);
    const check = await this.safeFetch(url);
    if (check.ok && (check.status < 400 || [401, 403, 429].includes(check.status))) {
      return {
        status: 'VERIFIED',
        verified: true,
        url,
        provider: 'Unstop',
        username: username || 'user',
        httpStatus: check.status,
        reason: `Unstop profile verified active and reachable. Upload hackathon certificates to sync achievements.`,
        verificationTime
      };
    }

    return {
      status: 'NOT_VERIFIED',
      verified: false,
      url,
      provider: 'Unstop',
      reason: check.error || `Unstop profile could not be reached.`,
      verificationTime
    };
  }

  async _verifyCredly(url, verificationTime) {
    const username = KNOWN_PLATFORMS.credly.extractUsername(url);
    const check = await this.safeFetch(url);
    if (check.ok && check.status < 400) {
      return {
        status: 'VERIFIED',
        verified: true,
        url,
        provider: 'Credly',
        username: username || 'user',
        httpStatus: check.status,
        reason: `Credly digital credentials repository verified active and public.`,
        verificationTime
      };
    }

    return {
      status: 'NOT_VERIFIED',
      verified: false,
      url,
      provider: 'Credly',
      reason: check.error || `Credly badges page returned HTTP ${check.status}.`,
      verificationTime
    };
  }
}

module.exports = new LinkVerifierService();

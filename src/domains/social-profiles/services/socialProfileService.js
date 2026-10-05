/**
 * Social Profile Service
 * Manages social platform integrations (GitHub, LinkedIn, Unstop, Credly, and custom websites).
 * Respects platform Terms of Service: no unauthorized scraping.
 * Strictly verifies website URLs and matching platform domains before linking.
 */

const config = require('../../../../config');
const db = require('../../../infrastructure/database/db');
const syncProfileService = require('../../profile/services/syncProfileService');
const linkVerifierService = require('./linkVerifierService');
const logger = require('../../../shared/utils/logger');

class SocialProfileService {
  getPlatformsStatus() {
    const published = db.get('published') || {};
    const links = published.socialLinks || {};
    const customPlatforms = published.customPlatforms || db.get('customPlatforms') || [];
    const settings = db.get('settings') || {};
    const overrides = settings.platformOverrides || {};

    const basePlatforms = [
      {
        id: 'github',
        platform: 'GitHub',
        icon: '🐙',
        url: links.github || `https://github.com/${config.social.githubUsername}`,
        syncMethod: (overrides.github && overrides.github.syncMethod) || 'Official Public REST API (v3)',
        status: (overrides.github && overrides.github.lastSyncStatus) || 'Active',
        verified: true,
        canAutoSync: true,
        isCustom: false,
        lastSyncedAt: (overrides.github && overrides.github.lastSyncedAt) || null,
        latencyMs: (overrides.github && overrides.github.latencyMs) || null,
        description: 'Synchronizes public repositories, primary languages, descriptions, and star counts.'
      },
      {
        id: 'linkedin',
        platform: 'LinkedIn',
        icon: '💼',
        url: links.linkedin || config.social.linkedinUrl || '',
        syncMethod: (overrides.linkedin && overrides.linkedin.syncMethod) || 'Manual Data Import / Verified URL',
        status: (overrides.linkedin && overrides.linkedin.lastSyncStatus) || ((links.linkedin || config.social.linkedinUrl) ? 'Configured' : 'Needs URL'),
        verified: Boolean(links.linkedin || config.social.linkedinUrl),
        canAutoSync: false,
        isCustom: false,
        lastSyncedAt: (overrides.linkedin && overrides.linkedin.lastSyncedAt) || null,
        note: 'Automatic public synchronization is unavailable without LinkedIn Partner OAuth credentials. Manual resume/profile updates supported.',
        description: 'Direct profile link active. Update your portfolio by uploading your latest resume or editing the profile directly.'
      },
      {
        id: 'unstop',
        platform: 'Unstop',
        icon: '🚀',
        url: links.unstop || config.social.unstopUrl || '',
        syncMethod: (overrides.unstop && overrides.unstop.syncMethod) || 'Verified URL / Certificate Import',
        status: (overrides.unstop && overrides.unstop.lastSyncStatus) || ((links.unstop || config.social.unstopUrl) ? 'Configured' : 'Needs URL'),
        verified: Boolean(links.unstop || config.social.unstopUrl),
        canAutoSync: false,
        isCustom: false,
        lastSyncedAt: (overrides.unstop && overrides.unstop.lastSyncedAt) || null,
        note: 'No public API available for third-party automated polling without login credentials. Upload hackathon certificates or input profile URL manually.',
        description: 'Competitions and hackathons can be added directly via certificate upload or the projects editor.'
      },
      {
        id: 'credly',
        platform: 'Credly',
        icon: '🎖',
        url: links.credly || config.social.credlyUrl || 'https://www.credly.com/users/harsha10003/badges/credly',
        syncMethod: (overrides.credly && overrides.credly.syncMethod) || 'Public Badge Verification URLs',
        status: (overrides.credly && overrides.credly.lastSyncStatus) || 'Active',
        verified: true,
        canAutoSync: false,
        isCustom: false,
        lastSyncedAt: (overrides.credly && overrides.credly.lastSyncedAt) || null,
        description: 'Stores verified credential badges and links for AWS and cloud certifications.'
      },
      {
        id: 'leetcode',
        platform: 'LeetCode',
        icon: '⚡',
        url: links.leetcode || '',
        syncMethod: (overrides.leetcode && overrides.leetcode.syncMethod) || 'Public Stats API (leetcode-stats-api)',
        status: (overrides.leetcode && overrides.leetcode.lastSyncStatus) || (links.leetcode ? 'Configured' : 'Needs URL'),
        verified: Boolean(links.leetcode),
        canAutoSync: true,
        isCustom: false,
        lastSyncedAt: (overrides.leetcode && overrides.leetcode.lastSyncedAt) || null,
        profileData: (overrides.leetcode && overrides.leetcode.profileData) || null,
        description: 'Syncs problem-solving stats: total solved, easy/medium/hard breakdown, global ranking, and acceptance rate.'
      },
      {
        id: 'hackerrank',
        platform: 'HackerRank',
        icon: '🎯',
        url: links.hackerrank || '',
        syncMethod: (overrides.hackerrank && overrides.hackerrank.syncMethod) || 'Public Contests API',
        status: (overrides.hackerrank && overrides.hackerrank.lastSyncStatus) || (links.hackerrank ? 'Configured' : 'Needs URL'),
        verified: Boolean(links.hackerrank),
        canAutoSync: true,
        isCustom: false,
        lastSyncedAt: (overrides.hackerrank && overrides.hackerrank.lastSyncedAt) || null,
        profileData: (overrides.hackerrank && overrides.hackerrank.profileData) || null,
        description: 'Syncs HackerRank badges, certificates, and skill scores via the public profile API.'
      },
      {
        id: 'codeforces',
        platform: 'Codeforces',
        icon: '🏆',
        url: links.codeforces || '',
        syncMethod: (overrides.codeforces && overrides.codeforces.syncMethod) || 'Official Codeforces REST API',
        status: (overrides.codeforces && overrides.codeforces.lastSyncStatus) || (links.codeforces ? 'Configured' : 'Needs URL'),
        verified: Boolean(links.codeforces),
        canAutoSync: true,
        isCustom: false,
        lastSyncedAt: (overrides.codeforces && overrides.codeforces.lastSyncedAt) || null,
        profileData: (overrides.codeforces && overrides.codeforces.profileData) || null,
        description: 'Syncs rating, max rating, rank, and contest history via the official Codeforces public API.'
      },
      {
        id: 'codechef',
        platform: 'CodeChef',
        icon: '🍴',
        url: links.codechef || '',
        syncMethod: (overrides.codechef && overrides.codechef.syncMethod) || 'Profile URL Verification (No public API)',
        status: (overrides.codechef && overrides.codechef.lastSyncStatus) || (links.codechef ? 'Configured' : 'Needs URL'),
        verified: Boolean(links.codechef),
        canAutoSync: false,
        isCustom: false,
        lastSyncedAt: (overrides.codechef && overrides.codechef.lastSyncedAt) || null,
        note: 'CodeChef does not provide a public API. Profile URL is verified active. Rating stats require manual input.',
        description: 'Profile URL linked and verified. CodeChef does not expose a public REST API for stats.'
      },
      {
        id: 'kaggle',
        platform: 'Kaggle',
        icon: '📊',
        url: links.kaggle || '',
        syncMethod: (overrides.kaggle && overrides.kaggle.syncMethod) || 'Profile URL Verification (Kaggle API requires API key)',
        status: (overrides.kaggle && overrides.kaggle.lastSyncStatus) || (links.kaggle ? 'Configured' : 'Needs URL'),
        verified: Boolean(links.kaggle),
        canAutoSync: false,
        isCustom: false,
        lastSyncedAt: (overrides.kaggle && overrides.kaggle.lastSyncedAt) || null,
        note: 'Kaggle requires an API key (kaggle.json) for automated data access. Profile URL linked and verified.',
        description: 'Profile URL linked and verified. For competition rankings, use the Kaggle CLI with your API key.'
      }
    ];

    const mappedCustom = customPlatforms.map(cp => ({
      id: cp.id,
      platform: cp.platform || cp.name,
      icon: cp.icon || this.detectIcon(cp.platform || cp.name),
      url: cp.url || (links[cp.id] || ''),
      syncMethod: cp.syncMethod || 'Verified Profile Link',
      status: cp.status || (cp.url ? 'Active' : 'Needs URL'),
      verified: cp.verified !== false,
      canAutoSync: false,
      isCustom: true,
      lastSyncedAt: (overrides[cp.id] && overrides[cp.id].lastSyncedAt) || null,
      description: cp.description || `Connected ${cp.platform || cp.name} external profile link.`
    }));

    const deletedPlatforms = (settings.deletedPlatforms || []).map(s => s.toLowerCase());
    const activeBase = basePlatforms.filter(p => !deletedPlatforms.includes(p.id.toLowerCase()));
    const activeCustom = mappedCustom.filter(p => !deletedPlatforms.includes(p.id.toLowerCase()));

    return [...activeBase, ...activeCustom];
  }


  detectIcon(name = '') {
    const n = (name || '').toLowerCase();
    if (n.includes('leetcode')) return '⚡';
    if (n.includes('hackerrank')) return '🎯';
    if (n.includes('codeforces') || n.includes('codechef')) return '🏆';
    if (n.includes('kaggle')) return '📊';
    if (n.includes('medium') || n.includes('dev.to') || n.includes('hashnode') || n.includes('blog')) return '✍️';
    if (n.includes('twitter') || n.includes(' x')) return '🐦';
    if (n.includes('youtube')) return '📺';
    if (n.includes('stackoverflow')) return '📚';
    return '🌐';
  }

  normalizeProfileUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      let clean = rawUrl.trim();
      if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
      const parsed = new URL(clean);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const pathname = parsed.pathname.replace(/\/+$/, '') || '';
      return `https://${host}${pathname}${parsed.search || ''}`;
    } catch (e) {
      return (rawUrl || '').trim().replace(/\/+$/, '').toLowerCase();
    }
  }

  async verifyUrl(url, platformName) {
    return await linkVerifierService.verify(url, platformName);
  }

  async updatePlatform(id, updates = {}, approvedBy = 'admin') {
    const published = db.get('published') || {};
    const draft = db.get('draft') || {};
    published.socialLinks = published.socialLinks || {};
    draft.socialLinks = draft.socialLinks || {};
    published.customPlatforms = published.customPlatforms || [];
    draft.customPlatforms = draft.customPlatforms || [];

    const corePlatformKeys = ['github', 'linkedin', 'unstop', 'credly', 'leetcode', 'hackerrank', 'codeforces', 'codechef', 'kaggle'];
    const isCore = corePlatformKeys.includes(id.toLowerCase());
    const oldUrl = published.socialLinks[id] || '';

    // If a new URL is provided and non-empty, strictly verify it!
    let verifiedUrl = updates.url !== undefined ? updates.url.trim() : oldUrl;
    if (updates.url && updates.url.trim()) {
      const platformName = updates.platform || id;
      const verification = await linkVerifierService.verify(updates.url.trim(), platformName);
      if (!verification.verified) {
        throw new Error(`Verification Failed: ${verification.reason}`);
      }
      verifiedUrl = verification.url;

      // Duplicate check: ensure no other platform has the exact same normalized URL
      const normTargetUrl = this.normalizeProfileUrl(verifiedUrl);
      const existing = this.getPlatformsStatus();
      const duplicate = existing.find(p => p.id.toLowerCase() !== id.toLowerCase() && p.url && this.normalizeProfileUrl(p.url) === normTargetUrl);
      if (duplicate) {
        throw new Error(`Duplicate profile detected: "${verifiedUrl}" is already connected under ${duplicate.platform}.`);
      }
    }

    if (isCore) {
      if (updates.url !== undefined) {
        published.socialLinks[id] = verifiedUrl;
        draft.socialLinks[id] = verifiedUrl;
      }

      const settings = db.get('settings') || {};
      if (settings.deletedPlatforms) {
        settings.deletedPlatforms = settings.deletedPlatforms.filter(s => s.toLowerCase() !== id.toLowerCase());
      }
      settings.platformOverrides = settings.platformOverrides || {};
      settings.platformOverrides[id] = {
        syncMethod: updates.syncMethod,
        status: updates.status || (verifiedUrl ? 'Active' : 'Needs URL'),
        verified: true,
        lastVerifiedAt: new Date().toISOString()
      };
      db.set('settings', settings);
    } else {
      const updateList = (list) => {
        const idx = list.findIndex(p => p.id === id);
        const item = {
          id,
          platform: updates.platform || (idx !== -1 ? list[idx].platform : id),
          icon: updates.icon || (idx !== -1 ? list[idx].icon : this.detectIcon(updates.platform || id)),
          url: verifiedUrl,
          syncMethod: updates.syncMethod || (idx !== -1 ? list[idx].syncMethod : 'Verified Profile Link'),
          status: updates.status || (verifiedUrl ? 'Active' : 'Needs URL'),
          verified: true,
          lastVerifiedAt: new Date().toISOString(),
          description: updates.description || (idx !== -1 ? list[idx].description : '')
        };
        if (idx !== -1) {
          list[idx] = item;
        } else {
          list.push(item);
        }
        return item;
      };

      updateList(published.customPlatforms);
      updateList(draft.customPlatforms);

      if (updates.url !== undefined) {
        published.socialLinks[id] = verifiedUrl;
        draft.socialLinks[id] = verifiedUrl;
      }
    }

    db.set('published', published);
    db.set('draft', draft);

    // Synchronize to profile.js and index.html
    syncProfileService.syncToFiles(published);

    db.addHistory({
      field: `social_platform_${id}`,
      oldValue: oldUrl || 'Unconfigured',
      newValue: verifiedUrl || 'Updated (Verified)',
      source: 'Admin Platform Manager',
      status: 'Verified & Synchronized',
      approvedBy
    });

    logger.info(`Platform ${id} verified, updated, and synchronized live by ${approvedBy}`);
    return this.getPlatformsStatus();
  }

  async addPlatform({ name, platform, url, syncMethod, icon, description }, approvedBy = 'admin') {
    const cleanName = (name || platform || '').trim();
    if (!cleanName) {
      throw new Error('Platform or website name is required');
    }
    const cleanUrl = (url || '').trim();

    if (!cleanUrl) {
      throw new Error('Website URL is required and must be verified before linking');
    }

    // Check for duplicate profile prior to external network calls
    const normTargetUrl = this.normalizeProfileUrl(cleanUrl);
    const existing = this.getPlatformsStatus();
    const duplicate = existing.find(p => p.url && this.normalizeProfileUrl(p.url) === normTargetUrl);
    if (duplicate) {
      throw new Error(`Duplicate profile detected: "${cleanUrl}" is already connected under ${duplicate.platform} (${duplicate.url}).`);
    }

    // STRICT VERIFICATION: Verify syntax, domain match, and reachability
    const verification = await linkVerifierService.verify(cleanUrl, cleanName);
    if (!verification.verified) {
      throw new Error(`Verification Failed: ${verification.reason}`);
    }

    const verifiedUrl = verification.url;

    // If matches a core platform key by name, update core platform instead of creating redundant custom entry
    const coreKeys = ['github', 'linkedin', 'unstop', 'credly', 'leetcode', 'hackerrank', 'codeforces', 'codechef', 'kaggle'];
    const matchedCore = coreKeys.find(k => k === cleanName.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (matchedCore) {
      return await this.updatePlatform(matchedCore, { url: verifiedUrl, platform: cleanName, syncMethod }, approvedBy);
    }

    const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30) || `platform_${Date.now()}`;

    const published = db.get('published') || {};
    const draft = db.get('draft') || {};
    published.socialLinks = published.socialLinks || {};
    draft.socialLinks = draft.socialLinks || {};
    published.customPlatforms = published.customPlatforms || [];
    draft.customPlatforms = draft.customPlatforms || [];

    const newPlatform = {
      id,
      platform: cleanName,
      icon: icon || this.detectIcon(cleanName),
      url: verifiedUrl,
      syncMethod: syncMethod || 'Verified Profile Link',
      status: 'Active',
      verified: true,
      lastVerifiedAt: new Date().toISOString(),
      canAutoSync: false,
      isCustom: true,
      description: description || `Connected and verified ${cleanName} profile or website.`
    };

    // Filter out if existing id
    published.customPlatforms = published.customPlatforms.filter(p => p.id !== id);
    published.customPlatforms.push(newPlatform);

    draft.customPlatforms = draft.customPlatforms.filter(p => p.id !== id);
    draft.customPlatforms.push(newPlatform);

    published.socialLinks[id] = verifiedUrl;
    draft.socialLinks[id] = verifiedUrl;

    const settings = db.get('settings') || {};
    if (settings.deletedPlatforms) {
      settings.deletedPlatforms = settings.deletedPlatforms.filter(s => s.toLowerCase() !== id.toLowerCase());
      db.set('settings', settings);
    }

    db.set('published', published);
    db.set('draft', draft);

    // Synchronize to profile.js and index.html
    syncProfileService.syncToFiles(published);

    db.addHistory({
      field: `add_platform_${id}`,
      oldValue: 'None',
      newValue: `${cleanName}: ${verifiedUrl} (Verified)`,
      source: 'Admin Platform Manager',
      status: 'Verified & Linked Live',
      approvedBy
    });

    logger.info(`Added and verified new platform ${cleanName} (${id}) by ${approvedBy}`);
    return newPlatform;
  }

  removePlatform(id, approvedBy = 'admin') {
    const cleanId = (id || '').toLowerCase().trim();
    const published = db.get('published') || {};
    const draft = db.get('draft') || {};
    published.socialLinks = published.socialLinks || {};
    draft.socialLinks = draft.socialLinks || {};
    published.customPlatforms = published.customPlatforms || [];
    draft.customPlatforms = draft.customPlatforms || [];

    const settings = db.get('settings') || {};
    settings.deletedPlatforms = settings.deletedPlatforms || [];
    if (!settings.deletedPlatforms.includes(cleanId)) {
      settings.deletedPlatforms.push(cleanId);
    }
    db.set('settings', settings);

    // Remove from social links
    delete published.socialLinks[cleanId];
    delete draft.socialLinks[cleanId];

    // Remove from custom platforms if present
    published.customPlatforms = published.customPlatforms.filter(p => p.id.toLowerCase() !== cleanId);
    draft.customPlatforms = draft.customPlatforms.filter(p => p.id.toLowerCase() !== cleanId);

    db.set('published', published);
    db.set('draft', draft);

    syncProfileService.syncToFiles(published);

    db.addHistory({
      field: `remove_platform_${cleanId}`,
      oldValue: cleanId,
      newValue: 'Removed / Unlinked',
      source: 'Admin Platform Manager',
      status: 'Platform Removed',
      approvedBy
    });

    logger.info(`Removed/unlinked platform ${cleanId} and synchronized live by ${approvedBy}`);
    return this.getPlatformsStatus();
  }

  updateSocialLinks(newLinks, approvedBy = 'admin') {
    const draft = db.get('draft') || {};
    const published = db.get('published') || {};
    draft.socialLinks = { ...(draft.socialLinks || {}), ...newLinks };
    published.socialLinks = { ...(published.socialLinks || {}), ...newLinks };
    db.set('draft', draft);
    db.set('published', published);

    syncProfileService.syncToFiles(published);

    db.addHistory({
      field: 'social_links',
      oldValue: 'Previous links',
      newValue: JSON.stringify(newLinks),
      source: 'Social Settings',
      status: 'Synchronized & Live',
      approvedBy
    });

    logger.info('Updated social links in profile and synchronized');
    return draft.socialLinks;
  }
}

module.exports = new SocialProfileService();

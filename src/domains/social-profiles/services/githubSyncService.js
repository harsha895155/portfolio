/**
 * GitHub Public API Integration Service
 * Fetches publicly accessible user profile and repositories without scraping.
 */

const config = require('../../../../config');
const diffEngine = require('../../documents/processors/diffEngine');
const db = require('../../../infrastructure/database/db');
const logger = require('../../../shared/utils/logger');

class GitHubSyncService {
  async fetchUserProfile(username) {
    const user = username || config.social.githubUsername;
    const url = `https://api.github.com/users/${user}`;
    const headers = {
      'User-Agent': 'Harshavardhan-Portfolio-CMS',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (config.social.githubToken) {
      headers['Authorization'] = `token ${config.social.githubToken}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  }

  async fetchUserRepos(username) {
    const user = username || config.social.githubUsername;
    const url = `https://api.github.com/users/${user}/repos?sort=updated&per_page=30`;
    const headers = {
      'User-Agent': 'Harshavardhan-Portfolio-CMS',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (config.social.githubToken) {
      headers['Authorization'] = `token ${config.social.githubToken}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}: ${res.statusText}`);
    }
    const repos = await res.json();
    return Array.isArray(repos) ? repos : [];
  }

  async syncAndDetectNewRepositories() {
    try {
      const user = config.social.githubUsername;
      const [profile, repos] = await Promise.all([
        this.fetchUserProfile(user).catch(err => { logger.warn('GitHub profile fetch error', err); return null; }),
        this.fetchUserRepos(user)
      ]);

      const currentProfile = db.get('published') || {};
      const newChanges = [];

      for (const repo of repos) {
        if (repo.fork) continue; // Skip forked repositories by default
        const change = diffEngine.compareGitHubRepo(repo, currentProfile);
        if (change) {
          // Check if already in pending changes
          const existingPending = db.get('pendingChanges') || [];
          const duplicate = existingPending.find(p => p.meta && p.meta.github === repo.html_url);
          if (!duplicate) {
            const saved = db.addPendingChange(change);
            newChanges.push(saved);
          }
        }
      }

      logger.info(`GitHub sync completed for ${user}. ${newChanges.length} new repositories found.`);

      return {
        success: true,
        user,
        publicReposCount: profile ? profile.public_repos : repos.length,
        followers: profile ? profile.followers : 0,
        repositories: repos.map(r => ({
          name: r.name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          url: r.html_url,
          homepage: r.homepage,
          updatedAt: r.updated_at
        })),
        newDetectedProjects: newChanges
      };
    } catch (err) {
      logger.error('Error during GitHub synchronization', err);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = new GitHubSyncService();

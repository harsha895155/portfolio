/**
 * Sync Profile Service
 * Generates the clean, commented profile.js file from the current published profile
 * and synchronizes static SEO meta tags and JSON-LD in index.html.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../../../config');
const logger = require('../../../shared/utils/logger');

class SyncProfileService {
  syncToFiles(profileData) {
    try {
      this.writeProfileJs(profileData);
      this.syncIndexHtml(profileData);
      logger.info('Synchronized published profile to profile.js and index.html');
      return true;
    } catch (err) {
      logger.error('Failed to sync profile to files', err);
      throw err;
    }
  }

  _safeWriteFileSync(filePath, content) {
    let attempts = 0;
    while (attempts < 5) {
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return;
      } catch (err) {
        if (err.code === 'EROFS') {
          logger.warn(`Serverless read-only filesystem; skipped disk sync for ${filePath}`);
          return;
        }
        if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempts < 4) {
          attempts++;
          const waitTill = new Date().getTime() + 100;
          while (new Date().getTime() < waitTill) {}
        } else {
          throw err;
        }
      }
    }
  }

  writeProfileJs(profile) {
    const filePath = config.paths.profileJs;
    const content = `/**
 * PORTFOLIO PROFILE -- SINGLE SOURCE OF TRUTH
 * Automatically synchronized by the Private Portfolio Management System.
 * Last Published: ${new Date().toISOString()}
 */

const PROFILE = ${JSON.stringify(profile, null, 2)};

if (typeof window !== 'undefined') {
  window.PROFILE = PROFILE;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROFILE;
}
`;
    this._safeWriteFileSync(filePath, content);
  }

  syncIndexHtml(profile) {
    const indexPath = config.paths.indexHtml;
    if (!fs.existsSync(indexPath)) return;

    let html = fs.readFileSync(indexPath, 'utf-8');

    // Update document title if present
    if (profile.pageTitle) {
      html = html.replace(/<title>.*?<\/title>/i, `<title>${this.escapeHtml(profile.pageTitle)}</title>`);
    }

    // Update meta description
    if (profile.seo && profile.seo.description) {
      html = html.replace(
        /<meta name="description" content=".*?">/i,
        `<meta name="description" content="${this.escapeHtml(profile.seo.description)}">`
      );
    }

    // Update meta keywords
    if (profile.seo && profile.seo.keywords) {
      html = html.replace(
        /<meta name="keywords" content=".*?">/i,
        `<meta name="keywords" content="${this.escapeHtml(profile.seo.keywords)}">`
      );
    }

    // Update Google Site Verification
    if (profile.seo && profile.seo.googleSiteVerification) {
      if (html.includes('google-site-verification')) {
        html = html.replace(
          /<meta name="google-site-verification" content=".*?">/i,
          `<meta name="google-site-verification" content="${this.escapeHtml(profile.seo.googleSiteVerification)}">`
        );
      }
    }

    // Update social links (Credly, LinkedIn, GitHub) in index.html
    if (profile.socialLinks) {
      if (profile.socialLinks.credly) {
        html = html.replace(
          /href="https:\/\/www\.credly\.com\/users\/[^"]*"/g,
          `href="${this.escapeHtml(profile.socialLinks.credly)}"`
        );
        html = html.replace(
          /"https:\/\/www\.credly\.com\/users\/[^"]*"/g,
          `"${this.escapeHtml(profile.socialLinks.credly)}"`
        );
      }
      if (profile.socialLinks.linkedin) {
        html = html.replace(
          /href="https:\/\/www\.linkedin\.com\/in\/[^"]*"/g,
          `href="${this.escapeHtml(profile.socialLinks.linkedin)}"`
        );
      }
      if (profile.socialLinks.github) {
        html = html.replace(
          /href="https:\/\/github\.com\/[^"]*"/g,
          `href="${this.escapeHtml(profile.socialLinks.github)}"`
        );
      }
    }

    // Update resume link and label in index.html
    if (profile.resume && profile.resume.url) {
      const resumeUrl = profile.resume.url;
      const resumeLabel = profile.resume.label || '📄 View Resume';
      html = html.replace(
        /(<a[^>]*class="[^"]*resume-trigger[^"]*"[^>]*href=")[^"]*(")/i,
        `$1${this.escapeHtml(resumeUrl)}$2`
      );
      html = html.replace(
        /(<a[^>]*class="[^"]*resume-trigger[^"]*"[^>]*data-href=")[^"]*(")/i,
        `$1${this.escapeHtml(resumeUrl)}$2`
      );
      html = html.replace(
        /(<a[^>]*class="[^"]*resume-trigger[^"]*"[^>]*>)(.*?)(<\/a>)/i,
        `$1${this.escapeHtml(resumeLabel.startsWith('📄') ? resumeLabel : '📄 ' + resumeLabel)}$3`
      );
    }

    this._safeWriteFileSync(indexPath, html);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = new SyncProfileService();

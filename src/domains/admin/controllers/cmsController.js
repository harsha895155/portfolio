/**
 * CMS Controller
 * Exposes RESTful endpoints for comprehensive portfolio content management
 */

const path = require('path');
const fs = require('fs');
const cmsService = require('../services/cmsService');
const responseHelper = require('../../../shared/utils/responseHelper');
const logger = require('../../../shared/utils/logger');
const config = require('../../../../config');

const cmsController = {
  /* ── 1. Profile & Hero ── */
  updateProfileHero: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const updated = cmsService.updateProfileHero(req.body, user);
      return responseHelper.success(res, updated, 'Profile and hero updated in draft');
    } catch (err) {
      logger.error('Error updating profile & hero', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 2. About Section ── */
  updateAbout: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const updated = cmsService.updateAbout(req.body, user);
      return responseHelper.success(res, updated, 'About section updated in draft');
    } catch (err) {
      logger.error('Error updating about section', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 3. Skills CRUD ── */
  getSkills: (req, res) => {
    try {
      const skills = cmsService.getSkills();
      return responseHelper.success(res, skills, 'Skills retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  addSkill: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const skills = cmsService.addSkill(req.body, user);
      return responseHelper.created(res, skills, 'Skill added to draft');
    } catch (err) {
      logger.error('Error adding skill', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  addSkillCategory: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const skills = cmsService.addSkillCategory(req.body, user);
      return responseHelper.created(res, skills, 'Skill category added to draft');
    } catch (err) {
      logger.error('Error adding skill category', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  updateSkillCategory: (req, res) => {
    try {
      const index = req.params.index !== undefined ? req.params.index : req.params.identifier;
      const user = req.user ? req.user.username : 'admin';
      const skills = cmsService.updateSkillCategory(index, req.body, user);
      return responseHelper.success(res, skills, 'Skill category updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteSkillCategory: (req, res) => {
    try {
      const identifier = req.params.identifier !== undefined
        ? req.params.identifier
        : (req.query.category || req.query.identifier || (req.body && (req.body.category || req.body.identifier)) || '');
      if (identifier === '' || identifier === undefined || identifier === null) {
        return responseHelper.badRequest(res, 'Category name or index is required to delete category');
      }
      const user = req.user ? req.user.username : 'admin';
      const skills = cmsService.deleteSkillCategory(identifier, user);
      return responseHelper.success(res, skills, 'Skill category deleted');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteSkill: (req, res) => {
    try {
      const category = (req.query.category || (req.body && req.body.category) || '').trim();
      const name = (req.query.name || req.query.skill || (req.body && (req.body.name || req.body.skill)) || '').trim();
      if (!category || !name) {
        return responseHelper.badRequest(res, 'Both category and name (or skill) are required to delete a skill');
      }
      const user = req.user ? req.user.username : 'admin';
      const skills = cmsService.deleteSkill(category, name, user);
      return responseHelper.success(res, skills, `Skill "${name}" deleted`);
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 4. Education CRUD ── */
  getEducation: (req, res) => {
    try {
      const education = cmsService.getEducation();
      return responseHelper.success(res, education, 'Education entries retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  addEducation: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const education = cmsService.addEducation(req.body, user);
      return responseHelper.created(res, education, 'Education added to draft');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  updateEducation: (req, res) => {
    try {
      const index = parseInt(req.params.index, 10);
      const user = req.user ? req.user.username : 'admin';
      const education = cmsService.updateEducation(index, req.body, user);
      return responseHelper.success(res, education, 'Education updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteEducation: (req, res) => {
    try {
      const index = parseInt(req.params.index, 10);
      const user = req.user ? req.user.username : 'admin';
      const education = cmsService.deleteEducation(index, user);
      return responseHelper.success(res, education, 'Education entry deleted');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 5. Experience CRUD ── */
  getExperience: (req, res) => {
    try {
      const experience = cmsService.getExperience();
      return responseHelper.success(res, experience, 'Experience entries retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  addExperience: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const experience = cmsService.addExperience(req.body, user);
      return responseHelper.created(res, experience, 'Experience added to draft');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  updateExperience: (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const experience = cmsService.updateExperience(id, req.body, user);
      return responseHelper.success(res, experience, 'Experience updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteExperience: (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const experience = cmsService.deleteExperience(id, user);
      return responseHelper.success(res, experience, 'Experience entry deleted');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 6. Projects CMS CRUD ── */
  getProjects: (req, res) => {
    try {
      const projects = cmsService.getProjects();
      return responseHelper.success(res, projects, 'Projects retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  addProject: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const projects = cmsService.addProject(req.body, user);
      return responseHelper.created(res, projects, 'Project added to draft');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  updateProject: (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const projects = cmsService.updateProject(id, req.body, user);
      return responseHelper.success(res, projects, 'Project updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteProject: (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const projects = cmsService.deleteProject(id, user);
      return responseHelper.success(res, projects, 'Project deleted');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 7. Certifications CRUD ── */
  getCertifications: (req, res) => {
    try {
      const certs = cmsService.getCertifications();
      return responseHelper.success(res, certs, 'Certifications retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  addCertification: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const certs = cmsService.addCertification(req.body, user);
      return responseHelper.created(res, certs, 'Certification added to draft');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  updateCertification: (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const certs = cmsService.updateCertification(id, req.body, user);
      return responseHelper.success(res, certs, 'Certification updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteCertification: (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const certs = cmsService.deleteCertification(id, user);
      return responseHelper.success(res, certs, 'Certification deleted');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 8. Achievements CRUD ── */
  getAchievements: (req, res) => {
    try {
      const achvs = cmsService.getAchievements();
      return responseHelper.success(res, achvs, 'Achievements retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  addAchievement: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const achvs = cmsService.addAchievement(req.body, user);
      return responseHelper.created(res, achvs, 'Achievement added to draft');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  updateAchievement: (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const achvs = cmsService.updateAchievement(id, req.body, user);
      return responseHelper.success(res, achvs, 'Achievement updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteAchievement: (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const achvs = cmsService.deleteAchievement(id, user);
      return responseHelper.success(res, achvs, 'Achievement deleted');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 9. Resume Management ── */
  getResume: (req, res) => {
    try {
      const resume = cmsService.getResume();
      return responseHelper.success(res, resume, 'Resume info retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  updateResume: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const resume = cmsService.updateResume(req.body, user);
      return responseHelper.success(res, resume, 'Resume settings updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  uploadResumeFile: (req, res) => {
    try {
      if (!req.file) {
        return responseHelper.badRequest(res, 'No resume file uploaded');
      }

      const mediaDir = cmsService.mediaDir;
      const newHash = cmsService.getFileHash(req.file.buffer);

      let filename = null;
      if (fs.existsSync(mediaDir)) {
        const files = fs.readdirSync(mediaDir);
        for (const f of files) {
          const full = path.join(mediaDir, f);
          try {
            if (fs.statSync(full).isFile() && cmsService.getFileHash(full) === newHash) {
              filename = f;
              break;
            }
          } catch (e) {}
        }
      }

      if (!filename) {
        filename = `Harsha_Resume_${Date.now()}${path.extname(req.file.originalname)}`;
        const destPath = path.join(mediaDir, filename);
        fs.writeFileSync(destPath, req.file.buffer);
      }

      const resumeUrl = `/media/${filename}`;
      const user = req.user ? req.user.username : 'admin';
      const label = (req.body && req.body.label) ? req.body.label.trim() : '📄 View Resume';
      const resume = cmsService.updateResume({ url: resumeUrl, label }, user);

      // Also copy to root standard resume file so public standard links continue working seamlessly
      const rootResumePath = path.join(config.paths.root, 'Thimmareddygari_Harshavardhan_Reddy_Resume.pdf');
      if (path.extname(filename).toLowerCase() === '.pdf') {
        fs.writeFileSync(rootResumePath, req.file.buffer);
      }

      return responseHelper.created(res, { resume, filename, url: resumeUrl }, 'Resume uploaded and set as active');
    } catch (err) {
      logger.error('Error uploading resume', err);
      return responseHelper.error(res, err.message);
    }
  },

  /* ── 10. Section Visibility ── */
  getSections: (req, res) => {
    try {
      const sections = cmsService.getSections();
      return responseHelper.success(res, sections, 'Section visibility retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  updateSections: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const sections = cmsService.updateSections(req.body, user);
      return responseHelper.success(res, sections, 'Section visibility updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 11. SEO & Meta ── */
  getSeo: (req, res) => {
    try {
      const seo = cmsService.getSeo();
      return responseHelper.success(res, seo, 'SEO info retrieved');
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  updateSeo: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const seo = cmsService.updateSeo(req.body, user);
      return responseHelper.success(res, seo, 'SEO parameters updated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 12. Media Library ── */
  listMedia: (req, res) => {
    try {
      const folder = req.query.folder || null;
      const media = cmsService.listMedia(folder);
      return res.status(200).json({
        success: true,
        data: media.data,
        folders: media.folders,
        stats: media.stats,
        message: 'Media library listed'
      });
    } catch (err) {
      return responseHelper.error(res, err.message);
    }
  },

  uploadMediaFile: (req, res) => {
    try {
      const file = req.file || (req.files && (req.files['media']?.[0] || req.files['file']?.[0] || (Array.isArray(req.files) ? req.files[0] : Object.values(req.files)[0]?.[0])));
      if (!file) {
        return responseHelper.badRequest(res, 'No media file provided');
      }

      const user = req.user ? req.user.username : 'admin';
      const targetFolder = req.body.folder || null;
      const result = cmsService.uploadMedia({
        fileBuffer: file.buffer,
        originalName: file.originalname,
        targetFolder,
        approvedBy: user
      });

      if (result.isDuplicate) {
        return res.status(200).json({
          success: true,
          data: result,
          isDuplicate: true,
          message: result.message
        });
      }

      return res.status(201).json({
        success: true,
        data: result,
        isDuplicate: false,
        message: 'Media file uploaded successfully'
      });
    } catch (err) {
      logger.error('Error uploading media', err);
      return responseHelper.error(res, err.message);
    }
  },

  deleteMedia: (req, res) => {
    try {
      const { filename } = req.params;
      const user = req.user ? req.user.username : 'admin';
      const result = cmsService.deleteMedia(filename, user);
      return responseHelper.success(res, result, 'Media file deleted');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 13. Backup & Restore ── */
  exportBackup: (req, res) => {
    try {
      const backup = cmsService.exportFullBackup();
      const filename = `harsha_portfolio_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      return res.send(JSON.stringify(backup, null, 2));
    } catch (err) {
      logger.error('Error exporting backup', err);
      return responseHelper.error(res, 'Failed to export backup');
    }
  },

  restoreBackup: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      let backupData = req.body;
      if (typeof backupData === 'string') {
        backupData = JSON.parse(backupData);
      }
      const result = cmsService.restoreFullBackup(backupData, user);
      return responseHelper.success(res, result, 'Portfolio restored from backup JSON successfully!');
    } catch (err) {
      logger.error('Error restoring backup', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 14. Competitive & Coding Profiles ── */
  getCodingProfiles: (req, res) => {
    try {
      const data = cmsService.getCodingProfiles();
      return responseHelper.success(res, data, 'Coding profiles retrieved');
    } catch (err) {
      logger.error('Error fetching coding profiles', err);
      return responseHelper.error(res, 'Failed to fetch coding profiles');
    }
  },

  addCodingProfile: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const created = cmsService.addCodingProfile(req.body, user);
      return responseHelper.created(res, created, 'Coding profile added to draft');
    } catch (err) {
      logger.error('Error adding coding profile', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  updateCodingProfile: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const updated = cmsService.updateCodingProfile(req.params.id, req.body, user);
      return responseHelper.success(res, updated, 'Coding profile updated in draft');
    } catch (err) {
      logger.error('Error updating coding profile', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteCodingProfile: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const result = cmsService.deleteCodingProfile(req.params.id, user);
      return responseHelper.success(res, result, 'Coding profile removed from draft');
    } catch (err) {
      logger.error('Error deleting coding profile', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  updateTelemetry: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const updated = cmsService.updateTelemetry(req.body, user);
      return responseHelper.success(res, updated, 'Telemetry stats updated in draft');
    } catch (err) {
      logger.error('Error updating telemetry', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  /* ── 15. Live Platform Stats Fetcher ── */
  fetchPlatformStats: async (req, res) => {
    const { platform, username } = req.query;
    if (!platform || !username) {
      return responseHelper.badRequest(res, 'platform and username are required');
    }
    const platformLower = platform.toLowerCase().trim();
    const http = require('https');

    const fetchJSON = (url, headers = {}) => new Promise((resolve, reject) => {
      const opts = new URL(url);
      const options = {
        hostname: opts.hostname,
        path: opts.pathname + opts.search,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 Portfolio-Admin/2.0', ...headers }
      };
      const req2 = http.request(options, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid JSON response')); }
        });
      });
      req2.on('error', reject);
      req2.setTimeout(8000, () => { req2.destroy(); reject(new Error('Request timed out')); });
      req2.end();
    });

    const fetchPost = (url, body, headers = {}) => new Promise((resolve, reject) => {
      const opts = new URL(url);
      const bodyStr = JSON.stringify(body);
      const options = {
        hostname: opts.hostname,
        path: opts.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), 'User-Agent': 'Mozilla/5.0 Portfolio-Admin/2.0', ...headers }
      };
      const req2 = http.request(options, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid JSON response')); }
        });
      });
      req2.on('error', reject);
      req2.setTimeout(10000, () => { req2.destroy(); reject(new Error('Request timed out')); });
      req2.write(bodyStr);
      req2.end();
    });

    try {
      let stats = {};

      if (platformLower.includes('leetcode')) {
        // LeetCode public GraphQL API
        const query = {
          query: `query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              submitStats: submitStatsGlobal {
                acSubmissionNum { difficulty count }
              }
              profile { ranking }
              badges { id name }
            }
            userContestRanking(username: $username) {
              rating
              globalRanking
              topPercentage
              badge { name }
            }
          }`,
          variables: { username }
        };
        const data = await fetchPost('https://leetcode.com/graphql', query, { Referer: 'https://leetcode.com' });
        const u = data?.data?.matchedUser;
        const contest = data?.data?.userContestRanking;
        if (u) {
          const ac = u.submitStats?.acSubmissionNum || [];
          const easy = ac.find(x => x.difficulty === 'Easy')?.count || 0;
          const med = ac.find(x => x.difficulty === 'Medium')?.count || 0;
          const hard = ac.find(x => x.difficulty === 'Hard')?.count || 0;
          const total = easy + med + hard;
          const ratingVal = contest?.rating ? Math.round(contest.rating) : '';
          const maxRatingVal = contest?.topPercentage ? `Top ${contest.topPercentage}%` : (contest?.badge?.name || '');
          const rankingVal = contest?.globalRanking ? `Rank #${contest.globalRanking}` : (u.profile?.ranking ? `Rank #${u.profile.ranking}` : '');
          const badgesVal = u.badges?.length ? `${u.badges.length} Badges` : '';

          stats = {
            problemsSolved: total,
            rating: ratingVal,
            maxRating: maxRatingVal,
            easySolved: easy,
            mediumSolved: med,
            hardSolved: hard,
            ranking: rankingVal,
            badges: badgesVal
          };
        }
      } else if (platformLower.includes('github')) {
        const data = await fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`, { Accept: 'application/vnd.github.v3+json' });
        if (data.login) {
          stats = {
            problemsSolved: data.public_repos || 0,
            badges: data.followers ? `${data.followers} Followers · ${data.following} Following` : '',
            ranking: data.company || data.location || ''
          };
        }
      } else if (platformLower.includes('codeforces')) {
        const data = await fetchJSON(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`);
        if (data.status === 'OK' && data.result?.[0]) {
          const u = data.result[0];
          stats = {
            rating: u.rating || 0,
            maxRating: u.maxRating ? `Max ${u.maxRating} (${u.maxRank || ''})` : '',
            ranking: u.rank || '',
            badges: u.contribution ? `Contribution: ${u.contribution}` : ''
          };
        }
      } else if (platformLower.includes('hackerrank')) {
        // HackerRank public profile API
        const data = await fetchJSON(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/profile`);
        if (data?.model) {
          const m = data.model;
          stats = {
            problemsSolved: m.solved_challenges || 0,
            ranking: m.country ? `Country: ${m.country}` : '',
            badges: m.badges_count ? `${m.badges_count} Badges` : ''
          };
        }
      } else if (platformLower.includes('codechef')) {
        // CodeChef unofficial
        const data = await fetchJSON(`https://www.codechef.com/users/${encodeURIComponent(username)}`);
        stats = { ranking: 'Manual entry required for CodeChef' };
      }

      if (Object.keys(stats).length === 0) {
        return responseHelper.success(res, { stats: {}, message: `No auto-fetch support for "${platform}" yet. Please fill metrics manually.` }, 'No data');
      }
      return responseHelper.success(res, { stats }, `Live stats fetched for ${platform}`);
    } catch (err) {
      logger.error('Error fetching platform stats', err);
      return responseHelper.badRequest(res, `Could not fetch live data: ${err.message}. Please fill metrics manually.`);
    }
  }
};

module.exports = cmsController;

/**
 * AI Portfolio Audit & Health Scorer
 * Inspects all portfolio sections, calculates category scores, flags deficiencies,
 * and provides one-click AI fix plans.
 */

const db = require('../../../infrastructure/database/db');

class AIAuditService {
  runAudit() {
    const draft = db.get('draft') || {};
    const issues = [];

    let seoScore = 100;
    let contentScore = 100;
    let projectsScore = 100;
    let profileScore = 100;
    let accessibilityScore = 100;
    let mediaScore = 100;

    // 1. Profile Audit
    if (!draft.name || draft.name.trim().length < 5) {
      profileScore -= 30;
      issues.push({
        id: 'iss_profile_name',
        section: 'Profile',
        category: 'profile',
        severity: 'critical',
        title: 'Missing Full Candidate Name',
        description: 'Candidate name is missing or too short.',
        recommendation: 'Specify your full professional name.',
        fixAction: { section: 'profile', field: 'name', proposedValue: 'Thimmareddygari Harshavardhan Reddy' }
      });
    }

    if (!draft.title || draft.title.trim().length < 10) {
      profileScore -= 20;
      issues.push({
        id: 'iss_profile_title',
        section: 'Profile',
        category: 'profile',
        severity: 'warning',
        title: 'Weak Professional Headline',
        description: 'Professional title should highlight primary engineering domains.',
        recommendation: 'Update headline to reflect full-stack and IoT expertise.',
        fixAction: { section: 'profile', field: 'title', proposedValue: 'Full Stack Developer & IoT Engineer | Problem Solver' }
      });
    }

    if (!draft.avatar) {
      mediaScore -= 25;
      issues.push({
        id: 'iss_avatar_missing',
        section: 'Media & Avatar',
        category: 'media',
        severity: 'warning',
        title: 'Missing Profile Photo / Avatar',
        recommendation: 'Upload a clear professional headshot.',
        fixAction: { section: 'avatar', field: 'avatar', proposedValue: 'Photo from 🖤⃝🦋𓍯𓂃𓏧♡🫵🏻🫶🏻.jpg' }
      });
    }

    // 2. About Section Audit
    if (!draft.about || !draft.about.careerObjective || draft.about.careerObjective.length < 20) {
      contentScore -= 15;
      issues.push({
        id: 'iss_about_objective',
        section: 'About',
        category: 'content',
        severity: 'warning',
        title: 'Missing Career Objective',
        description: 'Career objective section is empty or brief.',
        recommendation: 'Add a concise, future-focused career objective statement.',
        fixAction: { section: 'about', field: 'careerObjective', proposedValue: 'Aspiring software engineer focused on building robust, high-performance web applications and cloud-connected IoT solutions.' }
      });
    }

    if (!draft.about || !Array.isArray(draft.about.paragraphs) || draft.about.paragraphs.length === 0) {
      contentScore -= 15;
      issues.push({
        id: 'iss_about_paragraphs',
        section: 'About',
        category: 'content',
        severity: 'warning',
        title: 'Incomplete Biography',
        description: 'No detailed about paragraphs found.',
        recommendation: 'Add structured biography describing academic highlights and engineering passions.',
        fixAction: { section: 'about', field: 'paragraphs', proposedValue: ['Computer Science and Engineering student with strong fundamentals in algorithms, full-stack development, and IoT sensor systems.'] }
      });
    }

    // 3. Projects Audit
    const projects = draft.projects || [];
    if (projects.length === 0) {
      projectsScore -= 50;
      issues.push({
        id: 'iss_projects_empty',
        section: 'Projects',
        category: 'projects',
        severity: 'critical',
        title: 'No Projects Published',
        description: 'Portfolio lacks project showcase entries.',
        recommendation: 'Add at least 3 highlighted software or IoT projects.'
      });
    } else {
      projects.forEach((p, idx) => {
        if (!p.description || p.description.length < 30) {
          projectsScore -= 5;
          issues.push({
            id: `iss_proj_desc_${idx}`,
            section: 'Projects',
            category: 'projects',
            severity: 'info',
            title: `Short Description for "${p.title}"`,
            description: `Project "${p.title}" description is fewer than 30 characters.`,
            recommendation: 'Expand with problem solved, architecture, and engineering impact.',
            fixAction: {
              section: 'projects',
              field: 'description',
              projectId: p.id,
              proposedValue: `${p.title} is an engineered solution developed with ${(p.technologies || []).join(', ') || 'modern stacks'} focusing on reliability and scalability.`
            }
          });
        }

        if (!p.github && !p.liveDemo) {
          projectsScore -= 5;
          issues.push({
            id: `iss_proj_links_${idx}`,
            section: 'Projects',
            category: 'projects',
            severity: 'info',
            title: `Missing Code/Demo Link for "${p.title}"`,
            description: `Project "${p.title}" has neither GitHub URL nor live demo URL.`,
            recommendation: 'Provide source code repository link.'
          });
        }
      });
    }

    // 4. Skills Audit
    const skills = draft.skills || [];
    const totalSkills = skills.flatMap(g => g.items || []).length;
    if (totalSkills < 8) {
      contentScore -= 10;
      issues.push({
        id: 'iss_skills_sparse',
        section: 'Skills',
        category: 'content',
        severity: 'info',
        title: 'Low Skill Count',
        description: `Only ${totalSkills} skills listed.`,
        recommendation: 'Add core competencies across Frontend, Backend, Tools, and Core CS.'
      });
    }

    // 5. SEO Audit
    const seo = draft.seo || {};
    if (!seo.description || seo.description.length < 50) {
      seoScore -= 20;
      issues.push({
        id: 'iss_seo_desc',
        section: 'SEO & Meta',
        category: 'seo',
        severity: 'warning',
        title: 'Meta Description Too Short',
        description: 'Search engines prefer meta descriptions between 80 and 160 characters.',
        recommendation: 'Generate an ATS and search-optimized summary for Google search snippets.',
        fixAction: {
          section: 'seo',
          field: 'description',
          proposedValue: 'Explore the personal portfolio of Thimmareddygari Harshavardhan Reddy, showcasing full-stack projects, IoT innovations, certifications, and technical skills.'
        }
      });
    }

    if (!seo.keywords || seo.keywords.length < 10) {
      seoScore -= 10;
      issues.push({
        id: 'iss_seo_keywords',
        section: 'SEO & Meta',
        category: 'seo',
        severity: 'info',
        title: 'Missing Relevant Keywords',
        recommendation: 'Add high-intent keywords like "Harshavardhan Reddy", "Full Stack Developer", "IoT AirGuard".',
        fixAction: {
          section: 'seo',
          field: 'keywords',
          proposedValue: 'Harshavardhan Reddy, Full Stack Developer, IoT Engineer, AirGuard, React, Node.js, Python, SWAYAM NPTEL'
        }
      });
    }

    // 6. Resume Audit
    const resume = draft.resume || {};
    if (!resume.url && !draft.resumeUrl) {
      accessibilityScore -= 25;
      issues.push({
        id: 'iss_resume_missing',
        section: 'Resume',
        category: 'accessibility',
        severity: 'warning',
        title: 'Active Resume Not Configured',
        description: 'Public "Download Resume" buttons point to fallback paths.',
        recommendation: 'Upload and set an active resume in the Resume Manager.'
      });
    }

    // Clamp scores
    seoScore = Math.max(40, Math.min(100, seoScore));
    contentScore = Math.max(40, Math.min(100, contentScore));
    projectsScore = Math.max(40, Math.min(100, projectsScore));
    profileScore = Math.max(40, Math.min(100, profileScore));
    accessibilityScore = Math.max(40, Math.min(100, accessibilityScore));
    mediaScore = Math.max(40, Math.min(100, mediaScore));

    const overallScore = Math.round(
      (seoScore * 0.2) +
      (contentScore * 0.2) +
      (projectsScore * 0.25) +
      (profileScore * 0.15) +
      (accessibilityScore * 0.1) +
      (mediaScore * 0.1)
    );

    const auditRecord = {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      overallScore,
      scores: {
        seo: seoScore,
        content: contentScore,
        projects: projectsScore,
        profile: profileScore,
        accessibility: accessibilityScore,
        media: mediaScore
      },
      issuesCount: issues.length,
      issues
    };

    db.addAiAudit(auditRecord);
    return auditRecord;
  }
}

module.exports = new AIAuditService();

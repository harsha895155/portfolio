/**
 * Diff & Comparison Engine
 * Detects discrepancies and new information between external sources
 * (uploaded documents, GitHub API) and the current portfolio profile.
 */

class DiffEngine {
  compareDocumentToProfile(extractedData, currentProfile, documentRecord) {
    const changes = [];
    const docSource = `Document: ${documentRecord.originalName} (${extractedData.docType})`;

    const entities = extractedData.extracted || {};

    // 1. Check for New Skills
    if (entities.detectedSkills && entities.detectedSkills.length > 0) {
      // Collect all current skills
      const currentSkills = new Set();
      if (currentProfile.skills) {
        currentProfile.skills.forEach(group => {
          (group.items || []).forEach(s => currentSkills.add(s.toLowerCase()));
        });
      }

      const newSkills = entities.detectedSkills.filter(s => !currentSkills.has(s.toLowerCase()));
      if (newSkills.length > 0) {
        changes.push({
          category: 'Skills',
          field: 'skills',
          label: 'New Skills Detected',
          oldValue: 'Not in current profile',
          detectedValue: newSkills.join(', '),
          source: docSource,
          documentId: documentRecord.id,
          meta: { newSkills }
        });
      }
    }

    // 2. Check for Certification
    if (extractedData.docType === 'Certification' || extractedData.docType === 'Hackathon Certificate') {
      const existingCerts = currentProfile.certifications || [];
      const title = entities.title || documentRecord.originalName.replace(/\.[^/.]+$/, '');
      const found = existingCerts.find(c => c.name.toLowerCase().includes(title.toLowerCase()));

      if (!found) {
        changes.push({
          category: 'Certifications',
          field: 'certifications',
          label: 'New Certification Found',
          oldValue: 'Not listed',
          detectedValue: `${title} by ${entities.issuer || 'Issuer'} (${entities.gradeOrScore || entities.credentialId || 'Verified'})`,
          source: docSource,
          documentId: documentRecord.id,
          meta: {
            name: title,
            issuer: entities.issuer || 'Official Issuer',
            date: entities.date || new Date().getFullYear().toString(),
            credentialId: entities.credentialId || '',
            score: entities.gradeOrScore || ''
          }
        });
      }
    }

    // 3. Check for Experience / Internship
    if (extractedData.docType === 'Internship Offer') {
      const existingExp = currentProfile.experience || [];
      const found = existingExp.find(e => e.company.toLowerCase().includes((entities.issuer || '').toLowerCase()));
      if (!found && entities.issuer) {
        changes.push({
          category: 'Experience',
          field: 'experience',
          label: 'New Internship Detected',
          oldValue: 'Not listed',
          detectedValue: `Internship at ${entities.issuer}`,
          source: docSource,
          documentId: documentRecord.id,
          meta: {
            role: 'Web Development Intern',
            company: entities.issuer,
            date: entities.date || ''
          }
        });
      }
    }

    return changes;
  }

  compareGitHubRepo(repo, currentProfile) {
    const existingProjects = currentProfile.projects || [];
    const found = existingProjects.find(p =>
      (p.github && p.github.toLowerCase().includes(repo.name.toLowerCase())) ||
      (p.title && p.title.toLowerCase().includes(repo.name.toLowerCase()))
    );

    if (!found) {
      return {
        category: 'Projects',
        field: 'projects',
        label: `New GitHub Repository: ${repo.name}`,
        oldValue: 'Not featured in portfolio',
        detectedValue: `${repo.name} — ${repo.description || 'GitHub Repository'} (Language: ${repo.language || 'Code'}, Stars: ${repo.stargazers_count})`,
        source: 'GitHub Public API',
        meta: {
          id: repo.name.toLowerCase(),
          title: repo.name,
          description: repo.description || 'Public GitHub open-source project',
          technologies: [repo.language].filter(Boolean),
          github: repo.html_url,
          liveDemo: repo.homepage || '',
          stars: repo.stargazers_count
        }
      };
    }
    return null;
  }
}

module.exports = new DiffEngine();

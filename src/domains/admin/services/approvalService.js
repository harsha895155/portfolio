/**
 * Approval & Workflow Service
 * Handles merging approved detected changes into the working draft profile.
 */

const db = require('../../../infrastructure/database/db');
const logger = require('../../../shared/utils/logger');

class ApprovalService {
  approveChange(changeId, editOverrides = null, approvedBy = 'admin') {
    const changes = db.get('pendingChanges') || [];
    const change = changes.find(c => c.id === changeId);
    if (!change) {
      throw new Error(`Change record ${changeId} not found`);
    }

    const draft = db.get('draft') || {};

    // Apply the change to draft according to category
    if (change.category === 'Skills') {
      const skillsToAdd = editOverrides && editOverrides.newSkills
        ? editOverrides.newSkills
        : (change.meta && change.meta.newSkills ? change.meta.newSkills : [change.detectedValue]);

      draft.skills = draft.skills || [];
      // Put them into the first relevant group or 'Core CS Competencies'
      if (draft.skills.length > 0) {
        const group = draft.skills[0];
        group.items = Array.from(new Set([...(group.items || []), ...skillsToAdd]));
      }
    } else if (change.category === 'Certifications') {
      const meta = (editOverrides && editOverrides.meta) || change.meta || {};
      const newCert = {
        id: 'cert-' + Date.now().toString(36),
        name: meta.name || change.label,
        issuer: meta.issuer || 'Official Issuer',
        date: meta.date || new Date().getFullYear().toString(),
        icon: '📜',
        credentialUrl: meta.credentialUrl || '',
        credentialId: meta.credentialId || '',
        score: meta.score || '',
        bgClass: 'bg-pattern-1'
      };
      draft.certifications = draft.certifications || [];
      draft.certifications.unshift(newCert);
    } else if (change.category === 'Projects') {
      const meta = (editOverrides && editOverrides.meta) || change.meta || {};
      const newProj = {
        id: meta.id || 'proj-' + Date.now().toString(36),
        title: meta.title || change.label,
        tag: meta.tag || 'Project',
        description: meta.description || change.detectedValue,
        technologies: meta.technologies || ['JavaScript'],
        bgClass: 'bg-pattern-2',
        featured: false,
        github: meta.github || '',
        liveDemo: meta.liveDemo || ''
      };
      draft.projects = draft.projects || [];
      draft.projects.push(newProj);
    } else if (change.category === 'Experience') {
      const meta = (editOverrides && editOverrides.meta) || change.meta || {};
      const newExp = {
        id: 'exp-' + Date.now().toString(36),
        role: meta.role || 'Intern',
        company: meta.company || change.detectedValue,
        companyUrl: '',
        employmentType: 'Internship',
        location: 'Remote',
        startDate: meta.date || '2026',
        endDate: '',
        current: false,
        responsibilities: [
          'Performance-evaluated professional deliverables and technical tasks.'
        ]
      };
      draft.experience = draft.experience || [];
      draft.experience.unshift(newExp);
    }

    // Save updated draft
    db.set('draft', draft);

    // Update change status
    db.updatePendingChange(changeId, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString()
    });

    // Record audit trail
    db.addHistory({
      field: change.field || change.category,
      oldValue: change.oldValue,
      newValue: editOverrides ? JSON.stringify(editOverrides) : change.detectedValue,
      source: change.source,
      status: 'Approved & Merged to Draft',
      approvedBy
    });

    logger.info(`Change ${changeId} approved by ${approvedBy}`);
    return { success: true, changeId };
  }

  rejectChange(changeId, reason = 'Rejected by admin', rejectedBy = 'admin') {
    const updated = db.updatePendingChange(changeId, {
      status: 'rejected',
      rejectedBy,
      rejectedReason: reason,
      rejectedAt: new Date().toISOString()
    });

    if (!updated) {
      throw new Error(`Change ${changeId} not found`);
    }

    db.addHistory({
      field: updated.field || updated.category,
      oldValue: updated.oldValue,
      newValue: updated.detectedValue,
      source: updated.source,
      status: 'Rejected',
      approvedBy: rejectedBy
    });

    logger.info(`Change ${changeId} rejected by ${rejectedBy}`);
    return { success: true, changeId };
  }

  ignoreChange(changeId) {
    const updated = db.updatePendingChange(changeId, {
      status: 'ignored',
      ignoredAt: new Date().toISOString()
    });
    if (!updated) {
      throw new Error(`Change ${changeId} not found`);
    }
    return { success: true, changeId };
  }

  approveAll(approvedBy = 'admin') {
    const pending = db.getPendingChanges();
    const results = [];
    for (const item of pending) {
      try {
        const res = this.approveChange(item.id, null, approvedBy);
        results.push(res);
      } catch (e) {
        logger.error(`Error approving change ${item.id}`, e);
      }
    }
    return results;
  }

  rejectAll(rejectedBy = 'admin') {
    const pending = db.getPendingChanges();
    const results = [];
    for (const item of pending) {
      try {
        const res = this.rejectChange(item.id, 'Bulk rejection', rejectedBy);
        results.push(res);
      } catch (e) {
        logger.error(`Error rejecting change ${item.id}`, e);
      }
    }
    return results;
  }
}

module.exports = new ApprovalService();

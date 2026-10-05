/**
 * File-based JSON Database Engine
 * Provides persistent, atomic storage for portfolio profiles, drafts,
 * pending changes, document metadata, audit history, and admin settings.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../../../config');
const logger = require('../../shared/utils/logger');

class Database {
  constructor() {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (isServerless) {
      this.dataDir = '/tmp/data';
      this.historyDir = '/tmp/data/history';
      this.dbPath = '/tmp/data/db.json';
    } else {
      this.dbPath = config.paths.dbFile;
      this.dataDir = config.paths.data;
      this.historyDir = config.paths.historyDir;
    }
    this.data = null;
    this.init();
  }

  init() {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.historyDir)) {
        fs.mkdirSync(this.historyDir, { recursive: true });
      }

      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        this.data = JSON.parse(raw);
      } else if (fs.existsSync(config.paths.dbFile)) {
        const raw = fs.readFileSync(config.paths.dbFile, 'utf-8');
        this.data = JSON.parse(raw);
        try { this.save(); } catch (e) {}
      } else {
        this.data = this.createInitialData();
        try { this.save(); } catch (e) {}
      }

      // Ensure all collections exist
      const requiredCollections = [
        'admin', 'published', 'draft', 'pendingChanges', 'documents',
        'history', 'settings', 'aiConversations', 'aiChangeSets', 'aiAudits', 'contentVersions',
        'verifiedRecords', 'verificationAuditLogs'
      ];
      let updated = false;
      for (const col of requiredCollections) {
        if (!this.data[col]) {
          const isArray = ['pendingChanges', 'documents', 'history', 'aiConversations', 'aiChangeSets', 'aiAudits', 'contentVersions', 'verifiedRecords', 'verificationAuditLogs'].includes(col);
          this.data[col] = isArray ? [] : {};
          updated = true;
        }
      }
      if (updated) this.save();

      logger.info('Database initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize database, building default schema', err);
      this.data = this.createInitialData();
      this.save();
    }
  }

  createInitialData() {
    // Read initial profile from profile.js if available
    let initialProfile = {};
    try {
      if (fs.existsSync(config.paths.profileJs)) {
        // Load PROFILE
        initialProfile = require(config.paths.profileJs);
      }
    } catch (e) {
      logger.warn('Could not load profile.js for initial seed, using defaults');
    }

    const salt = bcrypt.genSaltSync(config.auth.saltRounds);
    const passwordHash = bcrypt.hashSync(config.auth.adminPassword, salt);

    return {
      admin: {
        username: config.auth.adminUsername,
        passwordHash: passwordHash,
        updatedAt: new Date().toISOString()
      },
      published: JSON.parse(JSON.stringify(initialProfile)),
      draft: JSON.parse(JSON.stringify(initialProfile)),
      pendingChanges: [],
      documents: [],
      history: [
        {
          id: 'init-1',
          timestamp: new Date().toISOString(),
          field: 'initial_setup',
          oldValue: null,
          newValue: 'Portfolio profile initialized',
          source: 'System Initialization',
          status: 'Published',
          approvedBy: 'admin'
        }
      ],
      settings: {
        lastPublishedAt: new Date().toISOString(),
        lastSyncCheckAt: new Date().toISOString(),
        githubSyncEnabled: true,
        autoSyncIntervalHours: 24,
        sourcePriority: ['Manual Admin', 'Approved Resume', 'Approved Documents', 'GitHub API']
      }
    };
  }

  save() {
    try {
      const payload = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(this.dbPath, payload, 'utf-8');
    } catch (err) {
      if (err.code === 'EROFS') {
        logger.warn('Serverless read-only filesystem detected, maintaining state in-memory');
        return;
      }
      logger.error('Failed to write database file', err);
      if (process.env.VERCEL) return;
      throw err;
    }
  }

  // Generic Getters & Setters
  read() {
    return this.data;
  }

  get(collection) {
    return this.data[collection];
  }

  set(collection, value) {
    this.data[collection] = value;
    this.save();
    return this.data[collection];
  }

  // Document Operations
  addDocument(doc) {
    this.data.documents.unshift(doc);
    this.save();
    return doc;
  }

  getDocument(id) {
    if (!id) return null;
    const cleanId = String(id).trim();
    // 1. Direct match in documents collection
    let found = this.data.documents.find(d =>
      d.id === cleanId ||
      d.diskFilename === cleanId ||
      d.originalName === cleanId ||
      (d.originalName && d.originalName.toLowerCase() === cleanId.toLowerCase()) ||
      (d.diskFilename && d.diskFilename.toLowerCase() === cleanId.toLowerCase())
    );
    if (found) return found;

    // 2. Search in associatedDocuments in experience records (draft & published)
    const expLists = [
      ...(this.data.draft?.experience || []),
      ...(this.data.published?.experience || [])
    ];
    for (const exp of expLists) {
      if (Array.isArray(exp.associatedDocuments)) {
        const match = exp.associatedDocuments.find(d =>
          d.id === cleanId ||
          d.diskFilename === cleanId ||
          d.originalName === cleanId ||
          (d.originalName && d.originalName.toLowerCase() === cleanId.toLowerCase())
        );
        if (match) {
          return {
            id: match.id || cleanId,
            diskFilename: match.diskFilename || cleanId,
            originalName: match.originalName || cleanId,
            mimeType: 'application/pdf',
            docType: match.type || 'Internship Document'
          };
        }
      }
    }

    // 3. Search in verifiedRecords collection
    const verifiedRecs = this.data.verifiedRecords || [];
    for (const vr of verifiedRecs) {
      if (Array.isArray(vr.documents)) {
        const match = vr.documents.find(d =>
          d.id === cleanId ||
          d.diskFilename === cleanId ||
          d.originalName === cleanId
        );
        if (match) {
          return {
            id: match.id || cleanId,
            diskFilename: match.diskFilename || cleanId,
            originalName: match.originalName || cleanId,
            mimeType: 'application/pdf',
            docType: 'Verified Record Document'
          };
        }
      }
    }

    return null;
  }

  updateDocument(id, updates) {
    const idx = this.data.documents.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.data.documents[idx] = { ...this.data.documents[idx], ...updates, updatedAt: new Date().toISOString() };
      this.save();
      return this.data.documents[idx];
    }
    return null;
  }

  removeDocument(id) {
    const idx = this.data.documents.findIndex(d => d.id === id);
    if (idx !== -1) {
      const removed = this.data.documents.splice(idx, 1)[0];
      this.save();
      return removed;
    }
    return null;
  }

  // Pending Changes Operations
  addPendingChange(change) {
    const newChange = {
      id: 'chg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      detectedAt: new Date().toISOString(),
      status: 'pending', // 'pending' | 'approved' | 'rejected' | 'ignored'
      ...change
    };
    this.data.pendingChanges.unshift(newChange);
    this.save();
    return newChange;
  }

  getPendingChanges() {
    return this.data.pendingChanges.filter(c => c.status === 'pending');
  }

  getAllChanges() {
    return this.data.pendingChanges;
  }

  updatePendingChange(id, updates) {
    const idx = this.data.pendingChanges.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.data.pendingChanges[idx] = { ...this.data.pendingChanges[idx], ...updates, updatedAt: new Date().toISOString() };
      this.save();
      return this.data.pendingChanges[idx];
    }
    return null;
  }

  // History / Audit Trail
  addHistory(entry) {
    const record = {
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.data.history.unshift(record);
    // Keep last 100 history items
    if (this.data.history.length > 100) {
      this.data.history = this.data.history.slice(0, 100);
    }
    this.save();
    return record;
  }

  createBackupSnapshot() {
    try {
      const snapshotName = `snapshot_${Date.now()}.json`;
      const snapshotPath = path.join(this.historyDir, snapshotName);
      fs.writeFileSync(snapshotPath, JSON.stringify(this.data.published, null, 2), 'utf-8');
      return snapshotName;
    } catch (e) {
      logger.warn('Could not write backup snapshot to disk:', e.message);
      return `snapshot_mem_${Date.now()}.json`;
    }
  }

  // ─── AI PORTFOLIO AGENT OPERATIONS ──────────────────────────────────────────

  // AI Conversations
  addAiConversation(message) {
    if (!this.data.aiConversations) this.data.aiConversations = [];
    const record = {
      id: message.id || 'aimsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...message
    };
    this.data.aiConversations.push(record);
    if (this.data.aiConversations.length > 200) {
      this.data.aiConversations = this.data.aiConversations.slice(-200);
    }
    this.save();
    return record;
  }

  getAiConversations() {
    return this.data.aiConversations || [];
  }

  clearAiConversations() {
    this.data.aiConversations = [];
    this.save();
    return [];
  }

  // AI ChangeSets
  addAiChangeSet(changeSet) {
    if (!this.data.aiChangeSets) this.data.aiChangeSets = [];
    const record = {
      id: changeSet.id || 'cs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString(),
      status: changeSet.status || 'PENDING_REVIEW',
      ...changeSet
    };
    this.data.aiChangeSets.unshift(record);
    if (this.data.aiChangeSets.length > 100) {
      this.data.aiChangeSets = this.data.aiChangeSets.slice(0, 100);
    }
    this.save();
    return record;
  }

  getAiChangeSets() {
    return this.data.aiChangeSets || [];
  }

  getAiChangeSet(id) {
    return (this.data.aiChangeSets || []).find(cs => cs.id === id);
  }

  updateAiChangeSet(id, updates) {
    const idx = (this.data.aiChangeSets || []).findIndex(cs => cs.id === id);
    if (idx !== -1) {
      this.data.aiChangeSets[idx] = {
        ...this.data.aiChangeSets[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this.data.aiChangeSets[idx];
    }
    return null;
  }

  // AI Audits
  addAiAudit(audit) {
    if (!this.data.aiAudits) this.data.aiAudits = [];
    const record = {
      id: audit.id || 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...audit
    };
    this.data.aiAudits.unshift(record);
    if (this.data.aiAudits.length > 20) {
      this.data.aiAudits = this.data.aiAudits.slice(0, 20);
    }
    this.save();
    return record;
  }

  getLatestAiAudit() {
    return (this.data.aiAudits && this.data.aiAudits.length > 0) ? this.data.aiAudits[0] : null;
  }

  // Content Versioning
  addContentVersion(version) {
    if (!this.data.contentVersions) this.data.contentVersions = [];
    const record = {
      id: version.id || 'ver_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...version
    };
    this.data.contentVersions.unshift(record);
    if (this.data.contentVersions.length > 150) {
      this.data.contentVersions = this.data.contentVersions.slice(0, 150);
    }
    this.save();
    return record;
  }

  getContentVersions(entity = null) {
    const versions = this.data.contentVersions || [];
    if (entity) {
      return versions.filter(v => v.entity === entity);
    }
    return versions;
  }

  // Canonical Verified Records
  addVerifiedRecord(record) {
    if (!this.data.verifiedRecords) this.data.verifiedRecords = [];
    const item = {
      id: record.id || 'vr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      ...record
    };
    // Replace if existing id
    this.data.verifiedRecords = this.data.verifiedRecords.filter(r => r.id !== item.id);
    this.data.verifiedRecords.unshift(item);
    this.save();
    return item;
  }

  getVerifiedRecords(type = null) {
    const records = this.data.verifiedRecords || [];
    if (type) {
      return records.filter(r => r.type === type);
    }
    return records;
  }

  // Verification Audit Logging
  addVerificationAuditLog(log) {
    if (!this.data.verificationAuditLogs) this.data.verificationAuditLogs = [];
    const entry = {
      id: 'val_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      ...log
    };
    this.data.verificationAuditLogs.unshift(entry);
    if (this.data.verificationAuditLogs.length > 300) {
      this.data.verificationAuditLogs = this.data.verificationAuditLogs.slice(0, 300);
    }
    this.save();
    return entry;
  }

  getVerificationAuditLogs() {
    return this.data.verificationAuditLogs || [];
  }
}

// Singleton database instance
const db = new Database();
module.exports = db;

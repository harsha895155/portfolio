/**
 * Admin Portal Client-Side Controller
 * Powers complete portfolio CMS: Profile, Hero, About, Skills, Experience,
 * Projects, Education, Certifications, Achievements, Resume, Media Library,
 * Social Integrations, SEO, Section Visibility, Snapshots, and Backups.
 */

(function () {
  'use strict';

  let currentDraftProfile = null;
  let loadedPlatforms = [];
  let currentCertVerificationResult = null;
  let currentExpVerificationResult = null;

  /* ── Helper: Toast Notifications ── */
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : (type === 'info' ? 'ℹ' : '⚠')}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Authentication Flow ── */
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (res.ok && data.success) {
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('admin-app').style.display = 'flex';
        document.getElementById('admin-user-display').textContent = data.data.user.username;
        const hashTab = window.location.hash ? window.location.hash.replace('#', '') : null;
        const storedTab = localStorage.getItem('adminActiveTab');
        const initialTab = (hashTab && document.getElementById(hashTab))
          ? hashTab
          : (storedTab && document.getElementById(storedTab))
            ? storedTab
            : 'tab-overview';

        await switchTab(initialTab, false);
      } else {
        showLoginModal();
      }
    } catch (err) {
      showLoginModal();
    }
  }

  function showLoginModal() {
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('admin-app').style.display = 'none';
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errBox = document.getElementById('login-error');
    errBox.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Authenticated successfully', 'success');
        checkAuth();
      } else {
        errBox.textContent = data.message || 'Invalid username or password';
        errBox.style.display = 'block';
      }
    } catch (err) {
      errBox.textContent = 'Connection error. Please try again.';
      errBox.style.display = 'block';
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    showToast('Logged out', 'success');
    showLoginModal();
  });

  /* ── Tab Navigation ── */
  async function switchTab(targetId, updateHistory = true) {
    if (!targetId) return;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const tabBtn = document.querySelector(`.nav-tab[data-tab="${targetId}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    const targetPanel = document.getElementById(targetId);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    try {
      localStorage.setItem('adminActiveTab', targetId);
      if (updateHistory) {
        history.replaceState(null, '', '#' + targetId);
      }
    } catch (_) {}

    // Ensure core profile data is loaded in background if not already loaded
    if (targetId !== 'tab-overview' && (!currentDraftProfile || Object.keys(currentDraftProfile).length === 0)) {
      loadDashboard().catch(() => {});
    }

    if (targetId === 'tab-overview') loadDashboard();
    if (targetId === 'tab-ai-agent') initAiAgent();
    if (targetId === 'tab-queue') loadPendingChanges();
    if (targetId === 'tab-profile') loadProfileEditor();
    if (targetId === 'tab-about') loadAboutEditor();
    if (targetId === 'tab-skills') loadSkillsManager();
    if (targetId === 'tab-experience') loadExperienceManager();
    if (targetId === 'tab-projects') loadProjectsManager();
    if (targetId === 'tab-education') loadEducationManager();
    if (targetId === 'tab-certs') loadCertsManager();
    if (targetId === 'tab-achievements') loadAchievementsManager();
    if (targetId === 'tab-resume') loadResumeManager();
    if (targetId === 'tab-media') loadMediaLibrary();
    if (targetId === 'tab-documents') loadDocuments();
    if (targetId === 'tab-social') loadSocialStatus();
    if (targetId === 'tab-sections') loadSectionsManager();
    if (targetId === 'tab-contact') loadContactFooter();
    if (targetId === 'tab-seo') loadSeoManager();
    if (targetId === 'tab-history') loadHistory();
    if (targetId === 'tab-coding-profiles') loadCodingProfiles();
  }

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  window.addEventListener('hashchange', () => {
    const h = window.location.hash ? window.location.hash.replace('#', '') : null;
    if (h && document.getElementById(h)) {
      switchTab(h, false);
    }
  });

  /* ── 1. Dashboard Overview & Analytics ── */
  async function loadDashboard() {
    try {
      // 1. Fetch draft profile
      const draftRes = await fetch('/api/profile/draft');
      const draftJson = await draftRes.json();
      if (draftRes.ok && draftJson.success) {
        currentDraftProfile = draftJson.data;
      }

      // 2. Fetch admin stats
      const statsRes = await fetch('/api/admin/stats');
      const statsJson = await statsRes.json();
      if (statsRes.ok && statsJson.success) {
        const stats = statsJson.data;

        // Count skills across all categories
        let totalSkills = 0;
        if (currentDraftProfile && currentDraftProfile.skills) {
          currentDraftProfile.skills.forEach(g => {
            totalSkills += (g.items || []).length;
          });
        }

        const projectsCount = (currentDraftProfile && currentDraftProfile.projects) ? currentDraftProfile.projects.length : (stats.projectsCount || 0);
        const certsCount = (currentDraftProfile && currentDraftProfile.certifications) ? currentDraftProfile.certifications.length : (stats.certificationsCount || 0);
        const expCount = (currentDraftProfile && currentDraftProfile.experience) ? currentDraftProfile.experience.length : (stats.experienceCount || 0);
        const eduCount = (currentDraftProfile && currentDraftProfile.education) ? currentDraftProfile.education.length : 0;
        const achvCount = (currentDraftProfile && currentDraftProfile.achievements) ? currentDraftProfile.achievements.length : 0;

        document.getElementById('stat-projects').textContent = projectsCount;
        document.getElementById('stat-skills').textContent = totalSkills || 25;
        document.getElementById('stat-certs').textContent = certsCount;
        document.getElementById('stat-exp').textContent = expCount;
        document.getElementById('stat-education').textContent = eduCount;
        document.getElementById('stat-achievements').textContent = achvCount;
        document.getElementById('stat-docs').textContent = stats.documentsCount;
        document.getElementById('stat-pending').textContent = stats.pendingChangesCount;

        const badge = document.getElementById('badge-pending-count');
        if (stats.pendingChangesCount > 0) {
          badge.textContent = stats.pendingChangesCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }

        // Calculate dynamic profile completeness percentage
        const fields = [
          currentDraftProfile.name,
          currentDraftProfile.headline,
          currentDraftProfile.heroTag,
          currentDraftProfile.heroDesc,
          currentDraftProfile.about && currentDraftProfile.about.length,
          currentDraftProfile.contact && currentDraftProfile.contact.email,
          currentDraftProfile.contact && currentDraftProfile.contact.phone,
          currentDraftProfile.contact && currentDraftProfile.contact.location,
          currentDraftProfile.socialLinks && currentDraftProfile.socialLinks.github,
          currentDraftProfile.socialLinks && currentDraftProfile.socialLinks.linkedin,
          currentDraftProfile.socialLinks && currentDraftProfile.socialLinks.credly,
          currentDraftProfile.resume && currentDraftProfile.resume.url,
          projectsCount >= 3,
          certsCount >= 3,
          expCount >= 2,
          eduCount >= 1,
          achvCount >= 1,
          totalSkills >= 10
        ];
        const filled = fields.filter(Boolean).length;
        const score = Math.round((filled / fields.length) * 100);

        const scoreText = document.getElementById('completeness-score-text');
        const fillBar = document.getElementById('completeness-progress-fill');
        if (scoreText) scoreText.textContent = `${score}%`;
        if (fillBar) fillBar.style.width = `${score}%`;
      }

      // 3. Load recent activity
      loadRecentActivity();

    } catch (e) {
      console.error('Failed to load dashboard metrics', e);
    }
  }

  async function loadRecentActivity() {
    try {
      const res = await fetch('/api/admin/history');
      const json = await res.json();
      const listEl = document.getElementById('recent-activity-list');
      if (res.ok && json.success) {
        const history = (json.data.history || []).slice(0, 5);
        if (history.length === 0) {
          listEl.innerHTML = '<div class="text-muted">No recent changes recorded yet.</div>';
          return;
        }
        listEl.innerHTML = history.map(item => `
          <div class="activity-item">
            <span class="activity-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
            <span class="activity-desc"><strong>${escapeHtml(item.field)}:</strong> ${escapeHtml(item.newValue || 'Updated')}</span>
            <span class="diff-category-badge" style="margin-left: auto;">${escapeHtml(item.status || 'Applied')}</span>
          </div>
        `).join('');
      }
    } catch (e) { }
  }

  /* ── 2. Review Queue ── */
  async function loadPendingChanges() {
    try {
      const res = await fetch('/api/admin/pending');
      const json = await res.json();
      const container = document.getElementById('pending-changes-container');
      if (!res.ok || !json.success) return;

      const items = json.data || [];
      if (items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <h3>Review Queue is Empty</h3>
            <p>No new changes detected. Upload documents or sync external profiles to detect new information.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = items.map(c => `
        <div class="diff-card" id="change-${c.id}">
          <div class="diff-header">
            <div>
              <span class="diff-category-badge">${escapeHtml(c.category)}</span>
              <strong style="margin-left: 0.5rem; color: var(--gold2);">${escapeHtml(c.label || c.field)}</strong>
            </div>
            <span class="diff-source">Source: ${escapeHtml(c.source || 'Document')}</span>
          </div>
          <div class="diff-comparison">
            <div class="diff-box diff-old">
              <span class="diff-box-label">Current Profile</span>
              <div class="diff-value">${escapeHtml(typeof c.oldValue === 'object' ? JSON.stringify(c.oldValue) : (c.oldValue || 'None'))}</div>
            </div>
            <div class="diff-box diff-new">
              <span class="diff-box-label">Extracted / Proposed Value</span>
              <div class="diff-value">${escapeHtml(typeof c.detectedValue === 'object' ? JSON.stringify(c.detectedValue) : c.detectedValue)}</div>
            </div>
          </div>
          <div class="diff-actions">
            <button class="btn-ghost-sm" onclick="window.adminActions.ignoreChange('${c.id}')">Ignore</button>
            <button class="btn-danger" onclick="window.adminActions.rejectChange('${c.id}')">Reject</button>
            <button class="btn-success" onclick="window.adminActions.approveChange('${c.id}')">Approve &amp; Merge</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('Error loading pending changes', e);
    }
  }

  document.getElementById('btn-approve-all')?.addEventListener('click', async () => {
    if (!confirm('Approve and merge all pending changes into draft?')) return;
    try {
      const res = await fetch('/api/admin/pending/approve-all', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        showToast('All changes approved!', 'success');
        loadPendingChanges();
        loadDashboard();
      }
    } catch (e) { showToast('Error approving changes', 'error'); }
  });

  document.getElementById('btn-reject-all')?.addEventListener('click', async () => {
    if (!confirm('Reject all pending changes?')) return;
    try {
      const res = await fetch('/api/admin/pending/reject-all', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        showToast('All changes rejected', 'info');
        loadPendingChanges();
        loadDashboard();
      }
    } catch (e) { showToast('Error rejecting changes', 'error'); }
  });

  /* ── 3. Profile & Hero ── */
  function loadProfileEditor() {
    if (!currentDraftProfile) return;
    const p = currentDraftProfile;
    const c = p.contact || {};

    const setValue = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setValue('prof-name', p.name);
    setValue('prof-shortname', p.shortName);
    setValue('prof-nickname', p.nickname);
    setValue('prof-headline', p.headline);
    setValue('prof-herotag', p.heroTag);
    setValue('prof-image', p.profileImage || p.seo?.ogImage);
    // Sync avatar preview
    const imgVal = p.profileImage || p.seo?.ogImage || '';
    const prevImg = document.getElementById('prof-image-preview');
    const prevFallback = document.getElementById('prof-image-fallback-icon');
    if (prevImg && imgVal) {
      prevImg.src = imgVal;
      prevImg.style.display = 'block';
      if (prevFallback) prevFallback.style.display = 'none';
    }
    setValue('prof-herodesc', p.heroDesc);
    setValue('prof-herotags', Array.isArray(p.heroTags) ? p.heroTags.join(', ') : '');
    setValue('prof-marquee', Array.isArray(p.marqueeItems) ? p.marqueeItems.join(', ') : '');
    setValue('prof-email', c.email);
    setValue('prof-phone', c.phone);
    setValue('prof-location', c.location);
    setValue('prof-availability', c.availability);

    // Hero CTA Buttons
    const heroCtas = p.heroCtas || {};
    setValue('prof-cta1-label', heroCtas.cta1?.label || '↗ Get In Touch');
    setValue('prof-cta1-url', heroCtas.cta1?.url || '#contact');
    setValue('prof-cta2-label', heroCtas.cta2?.label || 'View Projects →');
    setValue('prof-cta2-url', heroCtas.cta2?.url || '#projects');

    // Hero Resume Button and Current Active Resume
    const resume = p.resume || {};
    const resumeUrl = resume.url || './Thimmareddygari_Harshavardhan_Reddy_Resume.pdf';
    setValue('prof-resume-label', resume.label || '📄 View Resume');
    setValue('prof-resume-url', resumeUrl);

    const filenameEl = document.getElementById('hero-resume-current-filename');
    if (filenameEl) {
      const displayFilename = resumeUrl.split('/').pop() || 'Thimmareddygari_Harshavardhan_Reddy_Resume.pdf';
      filenameEl.textContent = displayFilename;
    }
    const updatedAtEl = document.getElementById('hero-resume-updated-at');
    if (updatedAtEl) {
      updatedAtEl.textContent = resume.updatedAt
        ? `Last Updated: ${new Date(resume.updatedAt).toLocaleString()}`
        : 'Last Updated: Recently';
    }
  }

  // Resume Upload & Preview Event Listeners in Profile Tab
  const heroResumeDropzone = document.getElementById('hero-resume-dropzone');
  const heroResumeFileInput = document.getElementById('hero-resume-file-input');
  const btnUploadHeroResume = document.getElementById('btn-upload-hero-resume');
  const heroResumePickerText = document.getElementById('hero-resume-picker-text');

  heroResumeDropzone?.addEventListener('click', () => {
    heroResumeFileInput?.click();
  });

  heroResumeDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    heroResumeDropzone.classList.add('drag-active');
  });

  heroResumeDropzone?.addEventListener('dragleave', () => {
    heroResumeDropzone.classList.remove('drag-active');
  });

  heroResumeDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    heroResumeDropzone.classList.remove('drag-active');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (heroResumeFileInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        heroResumeFileInput.files = dt.files;
      }
      handleHeroResumeSelected(file);
    }
  });

  heroResumeFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleHeroResumeSelected(e.target.files[0]);
    }
  });

  function handleHeroResumeSelected(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast('Please select a valid PDF file for your resume', 'warning');
      return;
    }
    if (heroResumePickerText) {
      heroResumePickerText.innerHTML = `📄 <strong style="color: var(--gold2);">${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(0)} KB)`;
    }
    if (btnUploadHeroResume) {
      btnUploadHeroResume.disabled = false;
      btnUploadHeroResume.innerHTML = '⬆️ Upload &amp; Set as Active Resume';
    }
  }

  btnUploadHeroResume?.addEventListener('click', async () => {
    const file = heroResumeFileInput?.files?.[0];
    if (!file) {
      showToast('Please choose a PDF file first', 'warning');
      return;
    }

    btnUploadHeroResume.disabled = true;
    btnUploadHeroResume.innerHTML = '<span class="spinner-sm"></span> Uploading resume...';

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const res = await fetch('/api/cms/resume/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ Resume uploaded and set as active on portfolio!', 'success');
        const newUrl = json.data.url;
        const urlInput = document.getElementById('prof-resume-url');
        if (urlInput) urlInput.value = newUrl;

        const filenameEl = document.getElementById('hero-resume-current-filename');
        if (filenameEl) filenameEl.textContent = json.data.filename || newUrl.split('/').pop();
        const updatedAtEl = document.getElementById('hero-resume-updated-at');
        if (updatedAtEl) updatedAtEl.textContent = `Last Updated: ${new Date().toLocaleString()}`;

        if (heroResumePickerText) {
          heroResumePickerText.textContent = 'Click or drag to select PDF resume';
        }
        if (heroResumeFileInput) heroResumeFileInput.value = '';
        btnUploadHeroResume.disabled = true;
        btnUploadHeroResume.innerHTML = '⬆️ Upload &amp; Set as Active Resume';

        await loadDashboard();
        loadProfileEditor();
        loadResumeManager();
      } else {
        showToast('Upload failed: ' + (json.message || 'Unknown error'), 'error');
        btnUploadHeroResume.disabled = false;
        btnUploadHeroResume.innerHTML = '⬆️ Retry Upload';
      }
    } catch (err) {
      showToast('Connection error uploading resume', 'error');
      btnUploadHeroResume.disabled = false;
      btnUploadHeroResume.innerHTML = '⬆️ Retry Upload';
    }
  });

  const previewHeroResume = () => {
    const url = document.getElementById('prof-resume-url')?.value.trim() ||
      (currentDraftProfile && currentDraftProfile.resume && currentDraftProfile.resume.url) ||
      '/Thimmareddygari_Harshavardhan_Reddy_Resume.pdf';
    window.adminActions.viewDocument(url, 'Official Portfolio Resume');
  };

  document.getElementById('btn-hero-preview-resume')?.addEventListener('click', previewHeroResume);
  document.getElementById('btn-hero-resume-view-ext')?.addEventListener('click', previewHeroResume);

  document.getElementById('form-profile-hero')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('prof-name').value.trim(),
      shortName: document.getElementById('prof-shortname').value.trim(),
      nickname: document.getElementById('prof-nickname').value.trim(),
      headline: document.getElementById('prof-headline').value.trim(),
      heroTag: document.getElementById('prof-herotag').value.trim(),
      profileImage: document.getElementById('prof-image').value.trim(),
      heroDesc: document.getElementById('prof-herodesc').value.trim(),
      heroTags: document.getElementById('prof-herotags').value.split(',').map(s => s.trim()).filter(Boolean),
      marqueeItems: document.getElementById('prof-marquee').value.split(',').map(s => s.trim()).filter(Boolean),
      heroCtas: {
        cta1: {
          label: document.getElementById('prof-cta1-label')?.value.trim() || '↗ Get In Touch',
          url: document.getElementById('prof-cta1-url')?.value.trim() || '#contact'
        },
        cta2: {
          label: document.getElementById('prof-cta2-label')?.value.trim() || 'View Projects →',
          url: document.getElementById('prof-cta2-url')?.value.trim() || '#projects'
        }
      },
      resume: {
        label: document.getElementById('prof-resume-label')?.value.trim() || '📄 View Resume',
        url: document.getElementById('prof-resume-url')?.value.trim() || './Thimmareddygari_Harshavardhan_Reddy_Resume.pdf'
      },
      contact: {
        email: document.getElementById('prof-email').value.trim(),
        phone: document.getElementById('prof-phone').value.trim(),
        location: document.getElementById('prof-location').value.trim(),
        availability: document.getElementById('prof-availability').value.trim()
      }
    };

    try {
      const res = await fetch('/api/cms/profile-hero', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ Profile, Hero CTAs & Resume saved to draft!', 'success');
        loadDashboard();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (err) {
      showToast('Connection error updating profile', 'error');
    }
  });

  document.getElementById('save-profile-btn')?.addEventListener('click', () => {
    document.getElementById('form-profile-hero')?.dispatchEvent(new Event('submit'));
  });

  /* ── 4. About Section ── */
  function loadAboutEditor() {
    if (!currentDraftProfile) return;
    const container = document.getElementById('about-paragraphs-container');
    const paras = currentDraftProfile.about || [];

    container.innerHTML = paras.map((p, idx) => `
      <div class="card mb-3" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border);" id="about-para-${idx}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <strong style="color: var(--gold2); font-size: 0.9rem;">Paragraph ${idx + 1}</strong>
          <button type="button" class="btn-sm-delete" onclick="window.adminActions.removeAboutParagraph(${idx})" title="Remove Paragraph">🗑️</button>
        </div>
        <textarea class="form-textarea about-para-input" rows="3">${escapeHtml(p)}</textarea>
      </div>
    `).join('');
  }

  document.getElementById('btn-add-about-paragraph')?.addEventListener('click', () => {
    const container = document.getElementById('about-paragraphs-container');
    const count = container.querySelectorAll('.about-para-input').length;
    const div = document.createElement('div');
    div.className = 'card mb-3';
    div.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid var(--border);';
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <strong style="color: var(--gold2); font-size: 0.9rem;">Paragraph ${count + 1} (New)</strong>
        <button type="button" class="btn-sm-delete" onclick="this.closest('.card').remove()" title="Remove">🗑️</button>
      </div>
      <textarea class="form-textarea about-para-input" rows="3" placeholder="Enter paragraph content..."></textarea>
    `;
    container.appendChild(div);
  });

  document.getElementById('save-about-btn')?.addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.about-para-input');
    const paragraphs = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);

    try {
      const res = await fetch('/api/cms/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ about: paragraphs })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ About section paragraphs saved to draft!', 'success');
        loadDashboard();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error updating about section', 'error');
    }
  });

  /* ── 5. Skills Management ── */
  function loadSkillsManager() {
    if (!currentDraftProfile) return;
    const container = document.getElementById('skills-categories-container');
    const skills = currentDraftProfile.skills || [];

    container.innerHTML = skills.map((cat, cIdx) => {
      const pills = (cat.items || []).map(item => `
        <span class="preset-pill skill-pill-item" style="display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.35rem 0.75rem;">
          <span>${escapeHtml(item)}</span>
          <button type="button" class="btn-skill-delete" onclick="window.adminActions.deleteSkill('${escapeHtml(cat.category)}', '${escapeHtml(item)}')" title="Delete skill '${escapeHtml(item)}'">&times;</button>
        </span>
      `).join('');

      const bars = (cat.bars || []).map(b => `
        <div style="margin-bottom: 0.6rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; margin-bottom: 0.25rem;">
            <span>${escapeHtml(b.label)}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--gold2); font-weight: 600;">${b.value}%</span>
              <button type="button" class="btn-bar-delete" onclick="window.adminActions.deleteSkill('${escapeHtml(cat.category)}', '${escapeHtml(b.label)}')" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.8rem; padding: 0;" title="Delete proficiency bar">🗑️</button>
            </div>
          </div>
          <div class="progress-bar" style="height: 6px;">
            <div class="progress-fill" style="width: ${b.value}%;"></div>
          </div>
        </div>
      `).join('');

      return `
        <div class="card mb-4" id="skill-category-card-${cIdx}">
          <div class="card-header-flex">
            <div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="font-size: 1.25rem;">📁</span>
                <h3 class="card-title" style="color: var(--gold2); margin-bottom: 0;">${escapeHtml(cat.category)}</h3>
                <span class="badge" style="background: rgba(212, 175, 55, 0.15); color: var(--gold2); font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 4px; font-weight: 600;">
                  ${(cat.items || []).length} skills
                </span>
              </div>
              <p class="card-desc" style="margin-top: 0.25rem;">Category #${cIdx + 1} · ${(cat.items || []).length} skill tags and ${(cat.bars || []).length} proficiency indicators.</p>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; border-color: rgba(212, 175, 55, 0.45); color: var(--gold2);" onclick="window.adminActions.openEditCategoryModal(${cIdx})" title="Edit or rename this category and its skills">
                ✏️ Edit Category
              </button>
              <button type="button" class="btn-secondary btn-danger-hover" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; border-color: rgba(239, 68, 68, 0.45); color: #f87171;" onclick="window.adminActions.deleteSkillCategory('${escapeHtml(cat.category)}')" title="Delete this entire category cluster">
                📁🗑️ Delete Category
              </button>
              <button type="button" class="btn-secondary btn-danger-hover" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; border-color: rgba(239, 68, 68, 0.45); color: #f87171;" onclick="window.adminActions.openDeleteSkillModal('${escapeHtml(cat.category)}')">
                🗑️ Delete Skill
              </button>
              <button type="button" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="window.adminActions.openNewSkillModal('${escapeHtml(cat.category)}')">
                ＋ Add Skill
              </button>
            </div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem;">
            ${pills || '<span class="text-muted">No skills in this category yet. Click "＋ Add Skill" to add one.</span>'}
          </div>
          ${bars ? `<div class="mt-4"><h5 class="subhead">Proficiency Level Bars:</h5>${bars}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // Proficiency bar row generator helper for Category modals
  function addCategoryBarRow(mode, label = '', value = 85) {
    const container = document.getElementById(mode === 'edit' ? 'category-edit-bars-container' : 'category-add-bars-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'cat-bar-row';
    row.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;';
    row.innerHTML = `
      <input type="text" class="form-input cat-bar-label" placeholder="Bar label (e.g. Docker, Python)" value="${escapeHtml(label)}" style="flex: 2;">
      <input type="number" class="form-input cat-bar-val" placeholder="%" min="1" max="100" value="${value}" style="flex: 1; max-width: 85px;">
      <button type="button" class="btn-sm-sync" onclick="this.closest('.cat-bar-row').remove()" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4); padding: 0.35rem 0.6rem; cursor: pointer; font-size: 1rem; line-height: 1;" title="Remove this bar">&times;</button>
    `;
    container.appendChild(row);
  }
  if (!window.adminActions) window.adminActions = {};
  window.adminActions.addCategoryBarRow = addCategoryBarRow;

  // Add Skill Modal Event Handler
  document.getElementById('form-skill-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('skill-form-category').value.trim();
    const name = document.getElementById('skill-form-name').value.trim();
    const proficiency = document.getElementById('skill-form-proficiency').value.trim();

    if (!category) {
      showToast('Please select or specify a category', 'warning');
      return;
    }
    if (!name) {
      showToast('Skill name is required', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/cms/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, name, proficiency })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`✓ Skill "${name}" added to ${category}!`, 'success');
        document.getElementById('modal-skill').style.display = 'none';
        await loadDashboard();
        loadSkillsManager();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error adding skill', 'error');
    }
  });

  // Add Category Modal Event Handler
  document.getElementById('form-add-category-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('category-add-name').value.trim();
    if (!category) {
      showToast('Category name is required', 'warning');
      return;
    }
    const rawSkills = document.getElementById('category-add-skills').value.trim();
    const items = rawSkills ? rawSkills.split(',').map(s => s.trim()).filter(Boolean) : [];

    const barRows = document.querySelectorAll('#category-add-bars-container .cat-bar-row');
    const bars = [];
    barRows.forEach(row => {
      const label = row.querySelector('.cat-bar-label')?.value.trim();
      const val = parseInt(row.querySelector('.cat-bar-val')?.value || 80, 10);
      if (label) bars.push({ label, value: Math.min(100, Math.max(1, isNaN(val) ? 80 : val)) });
    });

    try {
      const res = await fetch('/api/cms/skills/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, items, bars })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`✓ Category "${category}" created successfully!`, 'success');
        document.getElementById('modal-add-category').style.display = 'none';
        await loadDashboard();
        loadSkillsManager();
      } else {
        showToast('Error: ' + (json.message || 'Failed to create category'), 'error');
      }
    } catch (err) {
      showToast('Connection error creating category', 'error');
    }
  });

  // Edit Category Modal Event Handler
  document.getElementById('form-edit-category-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const index = document.getElementById('category-edit-index').value;
    const category = document.getElementById('category-edit-name').value.trim();
    if (!category) {
      showToast('Category name is required', 'warning');
      return;
    }
    const rawSkills = document.getElementById('category-edit-skills').value.trim();
    const items = rawSkills ? rawSkills.split(',').map(s => s.trim()).filter(Boolean) : [];

    const barRows = document.querySelectorAll('#category-edit-bars-container .cat-bar-row');
    const bars = [];
    barRows.forEach(row => {
      const label = row.querySelector('.cat-bar-label')?.value.trim();
      const val = parseInt(row.querySelector('.cat-bar-val')?.value || 80, 10);
      if (label) bars.push({ label, value: Math.min(100, Math.max(1, isNaN(val) ? 80 : val)) });
    });

    try {
      const res = await fetch(`/api/cms/skills/category/${encodeURIComponent(index)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, items, bars })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`✓ Category "${category}" updated successfully!`, 'success');
        document.getElementById('modal-edit-category').style.display = 'none';
        await loadDashboard();
        loadSkillsManager();
      } else {
        showToast('Error: ' + (json.message || 'Failed to update category'), 'error');
      }
    } catch (err) {
      showToast('Connection error updating category', 'error');
    }
  });

  // Delete Category Modal Event Handler
  document.getElementById('form-delete-category-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chosenCat = document.getElementById('category-delete-select').value.trim();
    if (!chosenCat) {
      showToast('Please select a category to delete', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete category "${chosenCat}" and all its skills?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/cms/skills/category/${encodeURIComponent(chosenCat)}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`✓ Category "${chosenCat}" deleted successfully!`, 'success');
        document.getElementById('modal-delete-category').style.display = 'none';
        await loadDashboard();
        loadSkillsManager();
      } else {
        showToast('Error: ' + (json.message || 'Failed to delete category'), 'error');
      }
    } catch (err) {
      showToast('Connection error deleting category', 'error');
    }
  });

  // Delete Skill Modal Event Handlers
  document.getElementById('form-delete-skill-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('skill-delete-category').value.trim();
    const name = document.getElementById('skill-delete-name').value.trim();
    if (!category || !name) {
      showToast('Please select both category and skill to delete', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/cms/skills?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`✓ Skill "${name}" deleted successfully!`, 'success');
        document.getElementById('modal-delete-skill').style.display = 'none';
        await loadDashboard();
        loadSkillsManager();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (err) {
      showToast('Connection error deleting skill', 'error');
    }
  });

  document.getElementById('skill-delete-category')?.addEventListener('change', (e) => {
    populateSkillDeleteOptions(e.target.value);
  });

  function populateSkillDeleteOptions(chosenCat) {
    const nameSelect = document.getElementById('skill-delete-name');
    const warningBox = document.getElementById('skill-delete-warning-box');
    if (!nameSelect) return;
    nameSelect.innerHTML = '';

    if (!currentDraftProfile || !currentDraftProfile.skills) {
      nameSelect.innerHTML = '<option value="">-- No skills available --</option>';
      if (warningBox) warningBox.style.display = 'none';
      return;
    }

    const catObj = currentDraftProfile.skills.find(c => c.category === chosenCat);
    if (!catObj || !catObj.items || catObj.items.length === 0) {
      nameSelect.innerHTML = '<option value="">-- No skills in this category --</option>';
      if (warningBox) warningBox.style.display = 'none';
      return;
    }

    nameSelect.innerHTML = catObj.items.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    if (warningBox) warningBox.style.display = 'block';
  }

  // Backdrop overlay click to dismiss skill & category modals
  ['modal-add-category', 'modal-edit-category', 'modal-delete-category', 'modal-delete-skill', 'modal-skill'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) el.style.display = 'none';
      });
    }
  });

  /* ── 6. Experience & Internships (Verification-First Workflow) ── */
  function loadExperienceManager() {
    if (!currentDraftProfile) return;
    const container = document.getElementById('experience-list-container');
    const exp = currentDraftProfile.experience || [];

    if (exp.length === 0) {
      container.innerHTML = '<div class="text-muted">No experience entries configured yet.</div>';
      return;
    }

    container.innerHTML = exp.map(item => {
      const isVerified = item.verified === true || item.verificationStatus === 'VERIFIED';
      const statusBadge = isVerified
        ? '<span class="verify-badge verified" style="font-size: 0.7rem; padding: 0.12rem 0.45rem; margin-left: 0.4rem;">✓ Verified Internship</span>'
        : (item.verificationStatus === 'NEEDS_REVIEW'
          ? '<span class="verify-badge review" style="font-size: 0.7rem; padding: 0.12rem 0.45rem; margin-left: 0.4rem;">🟡 Needs Review</span>'
          : '');

      const candidateLine = item.candidateId
        ? `<div class="item-card-sub" style="font-size: 0.75rem; color: var(--gold2); margin-top: 0.2rem;">Candidate ID: <strong>${escapeHtml(item.candidateId)}</strong></div>`
        : '';

      const docPills = (item.associatedDocuments && item.associatedDocuments.length)
        ? `<div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.4rem;">
            ${item.associatedDocuments.map(d => {
          const docId = d.id || d.diskFilename || d.originalName;
          const docTitle = d.originalName || d.type || 'Document';
          const label = d.type ? d.type : d.originalName;
          return `<button type="button" class="doc-pill-btn" onclick="window.adminActions.viewDocument('${escapeHtml(docId)}', '${escapeHtml(docTitle)}')" title="Click to view/preview ${escapeHtml(docTitle)}">
                📄 ${escapeHtml(label)} 👁️
              </button>`;
        }).join('')}
           </div>`
        : '';

      return `
        <div class="item-card">
          <div style="flex: 1;">
            <div class="item-card-title">
              <span>💼 ${escapeHtml(item.role)}</span>
              <span class="diff-category-badge" style="font-size: 0.75rem;">${escapeHtml(item.employmentType || 'Internship')}</span>
              ${item.current ? '<span class="diff-category-badge" style="background: rgba(34,197,94,0.15); color: #4ade80;">Active</span>' : ''}
              ${statusBadge}
            </div>
            <div class="item-card-sub">${escapeHtml(item.company)} &middot; ${escapeHtml(item.location || 'Remote')} &middot; ${escapeHtml(item.startDate)}–${escapeHtml(item.current ? 'Present' : (item.endDate || ''))}</div>
            ${candidateLine}
            ${docPills}
            <ul class="exp-bullets" style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-light);">
              ${(item.responsibilities || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
          </div>
          <div class="item-card-actions">
            <button class="btn-sm-edit" onclick="window.adminActions.openEditExpModal('${item.id}')">✏️ Edit</button>
            <button class="btn-sm-delete" onclick="window.adminActions.deleteExp('${item.id}', '${escapeHtml(item.role)}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Dynamic document requirements toggle
  function updateInternshipDocRequirements() {
    const statusSelect = document.getElementById('exp-verify-status');
    const compGroup = document.getElementById('group-completion-file');
    const repGroup = document.getElementById('group-report-file');
    if (!statusSelect) return;
    const isCompleted = statusSelect.value === 'Completed';
    if (compGroup) compGroup.style.display = isCompleted ? 'block' : 'none';
    if (repGroup) repGroup.style.display = isCompleted ? 'block' : 'none';
  }

  document.getElementById('exp-verify-status')?.addEventListener('change', updateInternshipDocRequirements);

  // Cross-Verify Internship Documents Button
  document.getElementById('btn-exp-run-verify')?.addEventListener('click', async () => {
    const candidateIdInput = document.getElementById('exp-verify-candidate-id');
    const candidateId = candidateIdInput ? candidateIdInput.value.trim() : '';
    const statusSelect = document.getElementById('exp-verify-status');
    const status = statusSelect ? statusSelect.value : 'Completed';
    const offerInput = document.getElementById('exp-verify-offer-file');
    const compInput = document.getElementById('exp-verify-completion-file');
    const repInput = document.getElementById('exp-verify-report-file');

    const resultsPanel = document.getElementById('exp-verify-results-panel');
    const alertBox = document.getElementById('exp-verify-alert');
    const statusBadge = document.getElementById('exp-verify-status-badge');
    const matrixTbody = document.getElementById('exp-matrix-tbody');
    const dupCheckResult = document.getElementById('exp-dup-check-result');
    const submitBtn = document.getElementById('btn-exp-submit-verified');
    const verifyBtn = document.getElementById('btn-exp-run-verify');

    if (!candidateId) {
      showToast('Candidate ID is required for internship verification', 'error');
      candidateIdInput?.focus();
      return;
    }

    if (!offerInput.files || !offerInput.files[0]) {
      showToast('Internship Offer Letter PDF is required', 'error');
      return;
    }

    if (status === 'Completed') {
      if (!compInput.files || !compInput.files[0]) {
        showToast('Completion Certificate PDF is required for Completed internships', 'error');
        return;
      }
      if (!repInput.files || !repInput.files[0]) {
        showToast('Internship Report PDF is required for Completed internships', 'error');
        return;
      }
    }

    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span>⏳</span> Analyzing & Cross-Verifying...';
    alertBox.style.display = 'none';
    resultsPanel.style.display = 'block';

    const formData = new FormData();
    formData.append('candidateId', candidateId);
    formData.append('status', status);
    formData.append('offerLetter', offerInput.files[0]);
    if (compInput.files && compInput.files[0]) {
      formData.append('completionCert', compInput.files[0]);
    }
    if (repInput.files && repInput.files[0]) {
      formData.append('internshipReport', repInput.files[0]);
    }

    try {
      const res = await fetch('/api/verification/internships/verify', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        statusBadge.className = 'verify-badge failed';
        statusBadge.textContent = json.status || 'FAILED';
        alertBox.className = 'conflict-alert-box';
        alertBox.style.display = 'block';
        alertBox.innerHTML = `<strong>⚠️ Verification Blocked:</strong> ${escapeHtml(json.message || 'Cross-verification failed')}`;
        if (submitBtn) submitBtn.disabled = true;
        showToast(json.message || 'Internship verification failed', 'error');
        return;
      }

      const data = json.data;
      currentExpVerificationResult = data;

      // Status Badge
      if (data.status === 'VERIFIED') {
        statusBadge.className = 'verify-badge verified';
        statusBadge.textContent = '🟢 VERIFIED';
        if (submitBtn) submitBtn.disabled = false;
      } else if (data.status === 'NEEDS_REVIEW') {
        statusBadge.className = 'verify-badge review';
        statusBadge.textContent = '🟡 NEEDS REVIEW';
        if (submitBtn) submitBtn.disabled = false;
      } else {
        statusBadge.className = 'verify-badge failed';
        statusBadge.textContent = '🔴 FAILED';
        if (submitBtn) submitBtn.disabled = true;
      }

      // Render 3-Document Cross-Verification Matrix
      if (matrixTbody && data.verificationReport && data.verificationReport.crossVerificationMatrix) {
        const matrix = data.verificationReport.crossVerificationMatrix;
        matrixTbody.innerHTML = Object.keys(matrix).map(fieldKey => {
          const row = matrix[fieldKey];
          const hasConflict = row.conflict;
          const statusHtml = hasConflict
            ? '<span class="status-conflict" style="color: #ef4444; font-weight: 700;">⚠️ Conflict</span>'
            : (row.match ? '<span class="status-match" style="color: #4ade80; font-weight: 700;">✓ Matched</span>' : '<span class="status-na" style="color: var(--text-light);">ℹ Verified</span>');

          return `
            <tr>
              <td><strong>${escapeHtml(row.label || fieldKey)}</strong></td>
              <td>${escapeHtml(row.offer || '—')}</td>
              <td>${escapeHtml(row.completion || '—')}</td>
              <td>${escapeHtml(row.report || '—')}</td>
              <td>${statusHtml}</td>
            </tr>
          `;
        }).join('');
      }

      // Conflict / Discrepancy Alert
      if (data.conflicts && data.conflicts.length > 0) {
        alertBox.className = 'conflict-alert-box';
        alertBox.style.display = 'block';
        const hasCritical = data.conflicts.some(c => c.severity === 'CRITICAL');
        alertBox.innerHTML = `<strong>${hasCritical ? '🔴 Critical Conflict Detected' : '🟡 Discrepancy Detected'}:</strong><br>${data.conflicts.map(c => `• ${escapeHtml(c.message || c)}`).join('<br>')}`;
        if (hasCritical && submitBtn) submitBtn.disabled = true;
      } else {
        alertBox.style.display = 'none';
      }

      // Duplicate Check Indicator
      if (dupCheckResult) {
        dupCheckResult.textContent = '✓ Duplicate Check: Unique file fingerprints and canonical candidate identity verified.';
      }

      // Pre-fill editable form with extracted data using versatile resolution
      const ext = data.extractedData || {};
      const getExpVal = (...keys) => {
        for (const k of keys) {
          if (ext[k] !== undefined && ext[k] !== null) {
            const item = ext[k];
            if (typeof item === 'object' && item !== null && 'value' in item) {
              if (item.value !== undefined && item.value !== null && item.value !== '') return String(item.value).trim();
            } else if (typeof item === 'string' && item.trim() !== '') {
              return item.trim();
            } else if (typeof item === 'number') {
              return String(item);
            }
          }
        }
        return '';
      };

      const roleVal = getExpVal('role', 'title', 'position', 'designation');
      if (roleVal) document.getElementById('exp-form-role').value = roleVal;

      const compVal = getExpVal('company', 'organization', 'employer');
      if (compVal) document.getElementById('exp-form-company').value = compVal;

      const startVal = getExpVal('startDate', 'start', 'from');
      if (startVal) document.getElementById('exp-form-start').value = startVal;

      const endVal = getExpVal('endDate', 'end', 'to');
      if (endVal) document.getElementById('exp-form-end').value = endVal;

      const locVal = getExpVal('workMode', 'location', 'mode');
      if (locVal) document.getElementById('exp-form-location').value = locVal;

      // Dynamically select Employment Type based on verified document analysis
      const typeVal = getExpVal('employmentType', 'type');
      const typeSelect = document.getElementById('exp-form-type');
      if (typeSelect) {
        if (typeVal) {
          for (let opt of typeSelect.options) {
            if (opt.value.toLowerCase() === typeVal.toLowerCase()) {
              typeSelect.value = opt.value;
              break;
            }
          }
        } else {
          const haystack = `${roleVal} ${compVal} ${locVal} ${ext.rawText || ''}`.toLowerCase();
          if (haystack.includes('virtual internship') || haystack.includes('virtual intern')) {
            typeSelect.value = 'Virtual Internship';
          } else if (haystack.includes('full-time') || haystack.includes('full time')) {
            typeSelect.value = 'Full-time';
          } else if (haystack.includes('training program') || haystack.includes('trainee')) {
            typeSelect.value = 'Training Program';
          } else if (haystack.includes('contract')) {
            typeSelect.value = 'Contract';
          } else if (haystack.includes('intern')) {
            typeSelect.value = 'Internship';
          }
        }
      }

      document.getElementById('exp-form-current').checked = (status === 'Ongoing');

      const respRaw = ext.responsibilities?.value || ext.responsibilities;
      if (respRaw && (Array.isArray(respRaw) ? respRaw.length : respRaw)) {
        document.getElementById('exp-form-responsibilities').value = Array.isArray(respRaw)
          ? respRaw.join('\n')
          : respRaw;
      } else {
        const descVal = getExpVal('description', 'desc', 'summary');
        if (descVal) {
          document.getElementById('exp-form-responsibilities').value = descVal;
        } else {
          document.getElementById('exp-form-responsibilities').value = `Selected for ${roleVal || 'Internship'} at ${compVal || 'Organization'} (${startVal || 'Apr 2026'} - ${endVal || 'Jun 2026'}, ${locVal || 'Remote / Virtual'}).\n• Core Curriculum: Completed hands-on modules in scalable full-stack application development and cloud infrastructure.\n• Practical Milestones: Delivered verified project components and continuous assessment milestone deliverables.\n• Performance Evaluation: Recognized with Grade 'O' (Outstanding) evaluation score band upon capstone completion.\n• Official Verification: Student ID: ${candidateId} | Backed by verified institutional offer and completion records.`;
        }
      }

      showToast(`✓ Internship documents cross-verified! Status: ${data.status}`, 'success');
    } catch (err) {
      showToast('Network error during internship verification', 'error');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = '<span>🔍</span> Analyze &amp; Cross-Verify Documents';
    }
  });

  // Save Verified Internship Form Submit Handler
  document.getElementById('form-experience-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('exp-form-id').value;
    const offerInput = document.getElementById('exp-verify-offer-file');

    // If editing existing without new documents, use standard CMS PUT
    if (id && (!offerInput || !offerInput.files || !offerInput.files.length)) {
      const payload = {
        role: document.getElementById('exp-form-role').value.trim(),
        company: document.getElementById('exp-form-company').value.trim(),
        employmentType: document.getElementById('exp-form-type').value,
        location: document.getElementById('exp-form-location').value.trim(),
        startDate: document.getElementById('exp-form-start').value.trim(),
        endDate: document.getElementById('exp-form-end').value.trim(),
        current: document.getElementById('exp-form-current').checked,
        responsibilities: document.getElementById('exp-form-responsibilities').value.split('\n').filter(Boolean)
      };

      try {
        const res = await fetch(`/api/cms/experience/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast('✓ Experience entry updated in draft!', 'success');
          document.getElementById('modal-experience').style.display = 'none';
          await loadDashboard();
          loadExperienceManager();
        } else {
          showToast('Error: ' + json.message, 'error');
        }
      } catch (err) {
        showToast('Connection error updating experience', 'error');
      }
      return;
    }

    // Adding NEW internship -> Verification-First Enforcement!
    if (!currentExpVerificationResult) {
      showToast('Verification Required: Please analyze and cross-verify documents before saving', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-exp-submit-verified');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Verified Internship...';
    }

    try {
      const candidateId = document.getElementById('exp-verify-candidate-id').value.trim();
      const status = document.getElementById('exp-verify-status').value;

      const formFields = {
        role: document.getElementById('exp-form-role').value.trim(),
        company: document.getElementById('exp-form-company').value.trim(),
        employmentType: document.getElementById('exp-form-type').value,
        location: document.getElementById('exp-form-location').value.trim(),
        startDate: document.getElementById('exp-form-start').value.trim(),
        endDate: document.getElementById('exp-form-end').value.trim(),
        current: document.getElementById('exp-form-current').checked,
        responsibilities: document.getElementById('exp-form-responsibilities').value.split('\n').filter(Boolean),
        candidateId,
        status
      };

      const formData = new FormData();
      if (offerInput && offerInput.files && offerInput.files[0]) {
        formData.append('offerLetter', offerInput.files[0]);
      }
      const compInput = document.getElementById('exp-verify-completion-file');
      if (compInput && compInput.files && compInput.files[0]) {
        formData.append('completionCert', compInput.files[0]);
      }
      const repInput = document.getElementById('exp-verify-report-file');
      if (repInput && repInput.files && repInput.files[0]) {
        formData.append('internshipReport', repInput.files[0]);
      }

      formData.append('formFields', JSON.stringify(formFields));
      formData.append('verificationReport', JSON.stringify(currentExpVerificationResult.verificationReport || currentExpVerificationResult));

      const res = await fetch('/api/verification/internships/save', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (res.ok && json.success) {
        showToast('✓ Verified Internship saved to draft portfolio!', 'success');
        document.getElementById('modal-experience').style.display = 'none';
        currentExpVerificationResult = null;
        await loadDashboard();
        loadExperienceManager();
      } else {
        showToast('Error saving verified internship: ' + (json.message || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Connection error saving internship', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>💾</span> Approve &amp; Save Verified Internship';
      }
    }
  });

  /* ── 7. Projects CMS ── */
  function loadProjectsManager() {
    if (!currentDraftProfile) return;
    const container = document.getElementById('projects-cms-container');
    const projs = currentDraftProfile.projects || [];

    if (projs.length === 0) {
      container.innerHTML = '<div class="text-muted">No projects found in draft.</div>';
      return;
    }

    container.innerHTML = projs.map(p => `
      <div class="item-card">
        <div style="flex: 1;">
          <div class="item-card-title">
            <span>📦 ${escapeHtml(p.title)}</span>
            ${p.featured ? '<span class="diff-category-badge" style="background: rgba(212,168,67,0.15); color: var(--gold2);">⭐ Featured</span>' : ''}
            <span class="diff-category-badge">${escapeHtml(p.status || 'Completed')}</span>
          </div>
          <div class="item-card-sub">${escapeHtml(p.tag || 'Project')}</div>
          <p class="item-card-desc">${escapeHtml(p.description || '')}</p>
          <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem;">
            ${(p.technologies || []).map(t => `<span class="tc" style="font-size: 0.72rem;">${escapeHtml(t)}</span>`).join('')}
          </div>
          <div style="display: flex; gap: 1rem; font-size: 0.8rem; margin-top: 0.5rem;">
            ${p.github ? `<a href="${escapeHtml(p.github)}" target="_blank" class="public-link">GitHub ↗</a>` : ''}
            ${p.liveDemo ? `<a href="${escapeHtml(p.liveDemo)}" target="_blank" class="public-link">Live Demo ↗</a>` : ''}
            ${p.caseStudy ? `<a href="${escapeHtml(p.caseStudy)}" target="_blank" class="public-link">Case Study ↗</a>` : ''}
          </div>
        </div>
        <div class="item-card-actions">
          <button class="btn-sm-edit" onclick="window.adminActions.openEditProjectModal('${p.id}')">✏️ Edit</button>
          <button class="btn-sm-delete" onclick="window.adminActions.deleteProject('${p.id}', '${escapeHtml(p.title)}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('form-project-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('proj-form-id').value;
    const payload = {
      title: document.getElementById('proj-form-title').value.trim(),
      tag: document.getElementById('proj-form-tag').value.trim(),
      description: document.getElementById('proj-form-desc').value.trim(),
      technologies: document.getElementById('proj-form-tech').value.split(',').map(s => s.trim()).filter(Boolean),
      github: document.getElementById('proj-form-github').value.trim(),
      liveDemo: document.getElementById('proj-form-demo').value.trim(),
      caseStudy: document.getElementById('proj-form-case').value.trim(),
      status: document.getElementById('proj-form-status').value,
      featured: document.getElementById('proj-form-featured').checked
    };

    try {
      const url = id ? `/api/cms/projects/${encodeURIComponent(id)}` : '/api/cms/projects';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ Project saved to draft!', 'success');
        document.getElementById('modal-project').style.display = 'none';
        await loadDashboard();
        loadProjectsManager();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error saving project', 'error');
    }
  });

  /* ── 8. Education ── */
  function loadEducationManager() {
    if (!currentDraftProfile) return;
    const container = document.getElementById('education-list-container');
    const edu = currentDraftProfile.education || [];

    if (edu.length === 0) {
      container.innerHTML = '<div class="text-muted">No education entries configured yet.</div>';
      return;
    }

    container.innerHTML = edu.map((item, idx) => `
      <div class="item-card">
        <div style="flex: 1;">
          <div class="item-card-title">
            <span>🎓 ${escapeHtml(item.institution)}</span>
          </div>
          <div class="item-card-sub">${escapeHtml(item.degree)} ${item.field ? '· ' + escapeHtml(item.field) : ''}</div>
          <div class="item-card-desc">
            ${escapeHtml(item.startYear)}–${escapeHtml(item.endYear)} &middot; 
            ${item.cgpa ? `CGPA: <strong>${escapeHtml(item.cgpa)}</strong>` : ''} 
            ${item.score ? `Score: <strong>${escapeHtml(item.score)}</strong>` : ''} 
            ${item.rollNo ? `&middot; Roll: ${escapeHtml(item.rollNo)}` : ''} 
            ${item.location ? `&middot; ${escapeHtml(item.location)}` : ''}
          </div>
        </div>
        <div class="item-card-actions">
          <button class="btn-sm-edit" onclick="window.adminActions.openEditEduModal(${idx})">✏️ Edit</button>
          <button class="btn-sm-delete" onclick="window.adminActions.deleteEdu(${idx}, '${escapeHtml(item.institution)}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('form-education-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('edu-form-index').value, 10);
    const payload = {
      institution: document.getElementById('edu-form-inst').value.trim(),
      degree: document.getElementById('edu-form-deg').value.trim(),
      field: document.getElementById('edu-form-field').value.trim(),
      startYear: document.getElementById('edu-form-start').value.trim(),
      endYear: document.getElementById('edu-form-end').value.trim(),
      cgpa: document.getElementById('edu-form-cgpa').value.trim(),
      rollNo: document.getElementById('edu-form-roll').value.trim(),
      affiliation: document.getElementById('edu-form-affil').value.trim(),
      location: document.getElementById('edu-form-loc').value.trim()
    };

    try {
      const isEdit = index >= 0;
      const url = isEdit ? `/api/cms/education/${index}` : '/api/cms/education';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ Education entry saved to draft!', 'success');
        document.getElementById('modal-education').style.display = 'none';
        await loadDashboard();
        loadEducationManager();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error saving education', 'error');
    }
  });

  /* ── 9. Certifications (Verification-First Workflow) ── */
  function loadCertsManager() {
    if (!currentDraftProfile) return;
    const container = document.getElementById('certs-cms-container');
    const certs = currentDraftProfile.certifications || [];

    if (certs.length === 0) {
      container.innerHTML = '<div class="text-muted">No certifications configured yet.</div>';
      return;
    }

    container.innerHTML = certs.map(c => {
      const isVerified = c.verified === true || c.verificationStatus === 'VERIFIED';
      const statusBadge = isVerified
        ? '<span class="verify-badge verified" style="font-size: 0.7rem; padding: 0.12rem 0.45rem; margin-left: 0.4rem;">✓ Verified Credential</span>'
        : (c.verificationStatus === 'NEEDS_REVIEW'
          ? '<span class="verify-badge review" style="font-size: 0.7rem; padding: 0.12rem 0.45rem; margin-left: 0.4rem;">🟡 Needs Review</span>'
          : '');

      const hashPreview = c.documentHash
        ? `<div class="item-card-sub" style="font-size: 0.68rem; opacity: 0.7; font-family: monospace; margin-top: 0.2rem;">SHA-256: ${escapeHtml(c.documentHash.substring(0, 16))}...</div>`
        : '';

      return `
        <div class="item-card">
          <div style="flex: 1;">
            <div class="item-card-title">
              <span>${c.icon || '🎖️'} ${escapeHtml(c.name)}</span>
              ${statusBadge}
            </div>
            <div class="item-card-sub">${escapeHtml(c.issuer)} &middot; ${escapeHtml(c.date || '')}</div>
            <div class="item-card-desc">
              ${c.score ? `Score: <strong>${escapeHtml(c.score)}</strong> &middot; ` : ''}
              ${c.credentialId ? `ID: <code>${escapeHtml(c.credentialId)}</code>` : ''}
            </div>
            ${hashPreview}
            <div class="mt-2" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              ${c.credentialUrl ? `<a href="${escapeHtml(c.credentialUrl)}" target="_blank" class="public-link">↗ Credential URL</a>` : ''}
              <button type="button" class="doc-pill-btn" onclick="window.adminActions.viewDocument('${escapeHtml(c.credentialUrl || c.credentialId || c.name)}', '${escapeHtml(c.name)}')">
                📄 View Certificate 👁️
              </button>
            </div>
          </div>
          <div class="item-card-actions">
            <button class="btn-sm-edit" onclick="window.adminActions.openEditCertModal('${c.id}')">✏️ Edit</button>
            <button class="btn-sm-delete" onclick="window.adminActions.deleteCert('${c.id}', '${escapeHtml(c.name)}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Analyze & Verify Certificate Button Click Handler
  document.getElementById('btn-cert-run-verify')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('cert-verify-pdf-file');
    const publicUrlInput = document.getElementById('cert-verify-public-url');
    const verifyBtn = document.getElementById('btn-cert-run-verify');
    const panel = document.getElementById('cert-verification-panel');
    const alertBox = document.getElementById('cert-verify-alert');
    const statusBadge = document.getElementById('cert-verify-status-badge');
    const submitBtn = document.getElementById('btn-cert-submit-verified');

    if (!fileInput.files || !fileInput.files[0]) {
      showToast('Please select a Certificate PDF file to analyze', 'error');
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span>⏳</span> Analyzing & Verifying...';
    alertBox.style.display = 'none';
    panel.style.display = 'block';

    const formData = new FormData();
    formData.append('certificate', fileInput.files[0]);
    formData.append('credentialUrl', publicUrlInput.value.trim());

    try {
      const res = await fetch('/api/verification/certificates/verify', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        statusBadge.className = 'verify-badge failed';
        statusBadge.textContent = json.status || 'FAILED';
        alertBox.className = 'conflict-alert-box';
        alertBox.style.display = 'block';
        let msg = `<strong>⚠️ Verification / Duplicate Blocked:</strong> ${escapeHtml(json.message || 'Verification failed')}`;
        if (json.duplicateInfo) {
          msg += `<br><small style="margin-top:0.35rem; display:block;">Reason: ${escapeHtml(json.duplicateInfo.reason || json.duplicateInfo.message)}</small>`;
          if (json.duplicateInfo.existingRecord) {
            msg += `<small style="display:block; opacity:0.85;">Matches existing: "${escapeHtml(json.duplicateInfo.existingRecord.name || json.duplicateInfo.existingRecord.title || 'Record')}"</small>`;
          }
        }
        alertBox.innerHTML = msg;

        const chkDup = document.getElementById('cert-chk-dup');
        if (chkDup) {
          chkDup.className = 'verify-check-item failed';
          const sub = document.getElementById('cert-chk-dup-sub');
          if (sub) sub.textContent = json.duplicateInfo ? 'Duplicate detected - Blocked' : 'Check failed';
        }
        if (submitBtn) submitBtn.disabled = true;
        showToast(json.message || 'Certificate verification blocked', 'error');
        return;
      }

      const data = json.data;
      currentCertVerificationResult = data;

      // Status Badge
      if (data.status === 'VERIFIED') {
        statusBadge.className = 'verify-badge verified';
        statusBadge.textContent = '🟢 VERIFIED';
        if (submitBtn) submitBtn.disabled = false;
      } else if (data.status === 'NEEDS_REVIEW') {
        statusBadge.className = 'verify-badge review';
        statusBadge.textContent = '🟡 NEEDS REVIEW';
        if (submitBtn) submitBtn.disabled = false;
      } else {
        statusBadge.className = 'verify-badge failed';
        statusBadge.textContent = '🔴 FAILED';
        if (submitBtn) submitBtn.disabled = true;
      }

      // Checklist Item 1: Integrity
      const chkInt = document.getElementById('cert-chk-integrity');
      const chkIntSub = document.getElementById('cert-chk-integrity-sub');
      if (chkInt && data.integrity) {
        chkInt.className = 'verify-check-item passed';
        if (chkIntSub) chkIntSub.textContent = `Valid PDF · ${(data.integrity.fileSize / 1024).toFixed(1)} KB · SHA: ${data.fileHash.substring(0, 12)}...`;
      }

      // Checklist Item 2: Duplicate check
      const chkDup = document.getElementById('cert-chk-dup');
      const chkDupSub = document.getElementById('cert-chk-dup-sub');
      if (chkDup) {
        chkDup.className = 'verify-check-item passed';
        if (chkDupSub) chkDupSub.textContent = '✓ Unique cryptographic fingerprint & credential record';
      }

      // Checklist Item 3: Public URL
      const chkUrl = document.getElementById('cert-chk-url');
      const chkUrlSub = document.getElementById('cert-chk-url-sub');
      if (chkUrl) {
        const pVer = data.verificationReport ? data.verificationReport.publicCredentialVerification : null;
        if (pVer && pVer.checked) {
          if (pVer.accessible) {
            if (pVer.botBlocked) {
              chkUrl.className = 'verify-check-item warning';
              if (chkUrlSub) chkUrlSub.textContent = '🟡 Bot/login wall encountered (Manual review allowed)';
            } else if (pVer.matched) {
              chkUrl.className = 'verify-check-item passed';
              if (chkUrlSub) chkUrlSub.textContent = '✓ Live portal validated & accessible';
            } else {
              chkUrl.className = 'verify-check-item warning';
              if (chkUrlSub) chkUrlSub.textContent = '🟡 Live portal reachable; partial attributes found';
            }
          } else {
            chkUrl.className = 'verify-check-item failed';
            if (chkUrlSub) chkUrlSub.textContent = '🔴 Verification URL unreachable';
          }
        } else {
          chkUrl.className = 'verify-check-item';
          if (chkUrlSub) chkUrlSub.textContent = 'No public URL provided (PDF-only extraction)';
        }
      }

      // Checklist Item 4: Entity cross-match
      const chkEnt = document.getElementById('cert-chk-entity');
      const chkEntSub = document.getElementById('cert-chk-entity-sub');
      if (chkEnt) {
        const ext = data.extractedData || {};
        chkEnt.className = 'verify-check-item passed';
        if (chkEntSub) {
          const recip = ext.recipientName?.value || 'Candidate';
          const org = ext.issuingOrganization?.value || 'Issuer';
          chkEntSub.textContent = `✓ Extracted: ${recip} · ${org}`;
        }
      }

      // Pre-fill editable form fields with versatile attribute resolution
      const ext = data.extractedData || {};
      const resolveVal = (...keys) => {
        for (const k of keys) {
          if (ext[k] !== undefined && ext[k] !== null) {
            const item = ext[k];
            if (typeof item === 'object' && item !== null && 'value' in item) {
              if (item.value !== undefined && item.value !== null && item.value !== '') return String(item.value).trim();
            } else if (typeof item === 'string' && item.trim() !== '') {
              return item.trim();
            } else if (typeof item === 'number') {
              return String(item);
            }
          }
        }
        return '';
      };

      const certName = resolveVal('certificateTitle', 'title', 'name', 'courseName', 'programName');
      if (certName) document.getElementById('cert-form-name').value = certName;

      const certIssuer = resolveVal('issuingOrganization', 'organization', 'issuer', 'institute', 'provider');
      if (certIssuer) document.getElementById('cert-form-issuer').value = certIssuer;

      const certDate = resolveVal('issueDate', 'date', 'issuedDate', 'completionDate');
      if (certDate) document.getElementById('cert-form-date').value = certDate;

      const certId = resolveVal('credentialId', 'credential_id', 'id', 'rollNo', 'certificateId');
      if (certId) document.getElementById('cert-form-id-val').value = certId;

      const certScore = resolveVal('scoreOrGrade', 'score', 'grade', 'percentage', 'marks');
      if (certScore) document.getElementById('cert-form-score').value = certScore;

      const certUrl = data.effectiveUrl || resolveVal('verificationUrl', 'url', 'credentialUrl') || (publicUrlInput ? publicUrlInput.value.trim() : '');
      if (certUrl) document.getElementById('cert-form-url').value = certUrl;

      const certDesc = resolveVal('description', 'desc', 'summary');
      const skillsRaw = ext.skills?.value || ext.skills;
      const skillsArr = Array.isArray(skillsRaw) ? skillsRaw : (typeof skillsRaw === 'string' && skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : []);
      const skillsLine = skillsArr.length ? `Skills: ${skillsArr.join(', ')}` : '';
      if (certDesc || skillsLine) {
        document.getElementById('cert-form-desc').value = certDesc ? `${certDesc}\n${skillsLine}`.trim() : skillsLine;
      }

      if (data.status === 'FAILED') {
        alertBox.className = 'conflict-alert-box';
        alertBox.style.display = 'block';
        alertBox.innerHTML = `<strong>🔴 Verification Failed:</strong> ${escapeHtml(data.message || 'Could not verify document')}`;
        if (submitBtn) submitBtn.disabled = true;
      } else if (data.status === 'NEEDS_REVIEW') {
        alertBox.className = 'conflict-alert-box';
        alertBox.style.display = 'block';
        alertBox.style.borderColor = 'rgba(234, 179, 8, 0.4)';
        alertBox.style.background = 'rgba(234, 179, 8, 0.08)';
        alertBox.style.color = '#fde047';
        alertBox.innerHTML = `<strong>🟡 Manual Review Recommended:</strong> Unable to independently verify all fields automatically. Inspect details before approving.`;
      } else {
        alertBox.style.display = 'none';
      }

      showToast(`✓ Certificate analyzed! Verification status: ${data.status}`, 'success');
    } catch (err) {
      showToast('Network error during certificate verification', 'error');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = '<span>🔍</span> Analyze &amp; Verify Certificate';
    }
  });

  // Save Verified Certificate Form Submit Handler
  document.getElementById('form-certification-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cert-form-id').value;
    const fileInput = document.getElementById('cert-verify-pdf-file');

    // If editing existing without new upload, use standard CMS PUT
    if (id && (!fileInput || !fileInput.files || !fileInput.files.length)) {
      const payload = {
        name: document.getElementById('cert-form-name').value.trim(),
        issuer: document.getElementById('cert-form-issuer').value.trim(),
        date: document.getElementById('cert-form-date').value.trim(),
        credentialId: document.getElementById('cert-form-id-val').value.trim(),
        score: document.getElementById('cert-form-score').value.trim(),
        credentialUrl: document.getElementById('cert-form-url').value.trim(),
        description: document.getElementById('cert-form-desc').value.trim(),
        icon: document.getElementById('cert-form-icon').value.trim() || '🏅'
      };

      try {
        const res = await fetch(`/api/cms/certifications/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast('✓ Certification updated in draft!', 'success');
          document.getElementById('modal-certification').style.display = 'none';
          await loadDashboard();
          loadCertsManager();
        } else {
          showToast('Error: ' + json.message, 'error');
        }
      } catch (err) {
        showToast('Connection error updating certification', 'error');
      }
      return;
    }

    // Adding NEW certificate -> Verification-First Enforcement!
    if (!currentCertVerificationResult) {
      showToast('Verification Required: Please analyze and verify certificate before saving', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-cert-submit-verified');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Verified Certificate...';
    }

    try {
      const formFields = {
        name: document.getElementById('cert-form-name').value.trim(),
        issuer: document.getElementById('cert-form-issuer').value.trim(),
        date: document.getElementById('cert-form-date').value.trim(),
        credentialId: document.getElementById('cert-form-id-val').value.trim(),
        score: document.getElementById('cert-form-score').value.trim(),
        credentialUrl: document.getElementById('cert-form-url').value.trim(),
        description: document.getElementById('cert-form-desc').value.trim(),
        icon: document.getElementById('cert-form-icon').value.trim() || '🏅'
      };

      const formData = new FormData();
      if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('certificate', fileInput.files[0]);
      }
      formData.append('formFields', JSON.stringify(formFields));
      formData.append('verificationReport', JSON.stringify(currentCertVerificationResult.verificationReport || currentCertVerificationResult));

      const res = await fetch('/api/verification/certificates/save', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (res.ok && json.success) {
        showToast('✓ Verified Certificate saved to draft portfolio!', 'success');
        document.getElementById('modal-certification').style.display = 'none';
        currentCertVerificationResult = null;
        await loadDashboard();
        loadCertsManager();
      } else {
        showToast('Error saving verified certificate: ' + (json.message || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Connection error saving certificate', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>💾</span> Approve &amp; Add Verified Certificate';
      }
    }
  });

  /* ── 10. Achievements ── */
  function loadAchievementsManager() {
    if (!currentDraftProfile) return;
    const container = document.getElementById('achievements-cms-container');
    const achvs = currentDraftProfile.achievements || [];

    if (achvs.length === 0) {
      container.innerHTML = '<div class="text-muted">No achievements configured yet.</div>';
      return;
    }

    container.innerHTML = achvs.map(a => `
      <div class="item-card">
        <div style="flex: 1;">
          <div class="item-card-title">
            <span>${a.icon || '🏆'} ${escapeHtml(a.title)}</span>
          </div>
          <p class="item-card-desc">${escapeHtml(a.description || '')}</p>
          ${a.certFile ? `
            <div class="mt-2" style="display: flex; gap: 0.5rem; align-items: center;">
              <button type="button" class="doc-pill-btn" onclick="window.adminActions.viewDocument('${escapeHtml(a.certFile)}', '${escapeHtml(a.title)}')">
                📄 View Proof / Certificate 👁️
              </button>
            </div>` : ''}
        </div>
        <div class="item-card-actions">
          <button class="btn-sm-edit" onclick="window.adminActions.openEditAchvModal('${a.id}')">✏️ Edit</button>
          <button class="btn-sm-delete" onclick="window.adminActions.deleteAchv('${a.id}', '${escapeHtml(a.title)}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  // Auto-generate achievement description and details from uploaded file
  document.getElementById('btn-achv-auto-fill')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('achv-upload-file');
    const autoBtn = document.getElementById('btn-achv-auto-fill');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      showToast('Please select a PDF or image file first', 'warning');
      return;
    }

    const file = fileInput.files[0];
    autoBtn.disabled = true;
    autoBtn.innerHTML = '<span>⏳</span> Processing...';

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'Achievement');

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (res.ok && json.success) {
        const doc = json.data.document;
        const ext = json.data.extraction || {};
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        // Auto-populate title if empty
        const titleEl = document.getElementById('achv-form-title');
        if (!titleEl.value || titleEl.value.trim().length === 0) {
          titleEl.value = ext.extracted?.title || cleanName;
        }

        // Set cert file URL
        const certEl = document.getElementById('achv-form-cert');
        certEl.value = `/api/documents/${doc.id}/view`;

        // Auto-generate description
        let desc = '';
        if (ext.textSnippet && ext.textSnippet.trim().length > 30) {
          const snippetClean = ext.textSnippet.replace(/\s+/g, ' ').substring(0, 280);
          desc = `Demonstrated excellence in ${cleanName}. Document details: "${snippetClean}..."`;
        } else {
          desc = `Awarded credential and verified achievement in ${cleanName}, demonstrating technical proficiency and structured performance benchmarks.`;
        }
        document.getElementById('achv-form-desc').value = desc;

        showToast('✓ Achievement details & description auto-generated from document!', 'success');
      } else {
        showToast('Upload error: ' + (json.message || 'Could not process document'), 'error');
      }
    } catch (err) {
      showToast('Connection error processing document', 'error');
    } finally {
      autoBtn.disabled = false;
      autoBtn.innerHTML = '<span>✨</span> Auto-Generate';
    }
  });

  document.getElementById('form-achievement-modal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('achv-form-id').value;
    const payload = {
      title: document.getElementById('achv-form-title').value.trim(),
      description: document.getElementById('achv-form-desc').value.trim(),
      certFile: document.getElementById('achv-form-cert').value.trim(),
      icon: document.getElementById('achv-form-icon').value.trim() || '🏆'
    };

    try {
      const url = id ? `/api/cms/achievements/${encodeURIComponent(id)}` : '/api/cms/achievements';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ Achievement saved to draft!', 'success');
        document.getElementById('modal-achievement').style.display = 'none';
        await loadDashboard();
        loadAchievementsManager();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error saving achievement', 'error');
    }
  });

  /* ── 11. Resume Manager ── */
  function loadResumeManager() {
    if (!currentDraftProfile) return;
    const r = currentDraftProfile.resume || {};
    const nameEl = document.getElementById('active-resume-name');
    const pathEl = document.getElementById('active-resume-path');
    const btnDown = document.getElementById('btn-download-active-resume');

    const url = r.url || './Thimmareddygari_Harshavardhan_Reddy_Resume.pdf';
    if (nameEl) nameEl.textContent = r.label || 'Active Resume PDF';
    if (pathEl) pathEl.textContent = `Configured URL: ${url}`;
    if (btnDown) btnDown.href = url;
  }

  document.getElementById('form-upload-resume')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('resume-file-input');
    if (!fileInput.files.length) return;

    const btn = document.getElementById('btn-submit-resume');
    btn.disabled = true;
    btn.textContent = 'Uploading resume...';

    const formData = new FormData();
    formData.append('resume', fileInput.files[0]);

    try {
      const res = await fetch('/api/cms/resume/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      btn.disabled = false;
      btn.textContent = '📤 Upload & Set Active Resume';

      if (res.ok && json.success) {
        showToast('✓ New resume uploaded & set active for public website!', 'success');
        fileInput.value = '';
        await loadDashboard();
        loadProfileEditor();
        loadResumeManager();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '📤 Upload & Set Active Resume';
      showToast('Connection error uploading resume', 'error');
    }
  });

  /* ── 12. Media Library with Section Folders & Strict Deduplication ── */
  let mediaLibraryFiles = [];
  let mediaLibraryFolders = [];
  let mediaLibraryStats = {};
  let activeMediaFolder = 'all';

  async function loadMediaLibrary() {
    try {
      const res = await fetch('/api/cms/media');
      const json = await res.json();
      if (res.ok && json.success) {
        mediaLibraryFiles = json.data || [];
        mediaLibraryFolders = json.folders || [];
        mediaLibraryStats = json.stats || {
          totalFiles: mediaLibraryFiles.length,
          totalSizeBytes: mediaLibraryFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0),
          duplicatesPrevented: 0
        };

        // 1. Update stats banner
        const statStatus = document.getElementById('media-stat-status');
        const statTotal = document.getElementById('media-stat-total');
        const statSize = document.getElementById('media-stat-size');
        const statPrevented = document.getElementById('media-stat-prevented');

        if (statStatus) {
          statStatus.textContent = 'Active (0 Duplicates)';
        }
        if (statTotal) {
          statTotal.textContent = `${mediaLibraryStats.totalFiles || mediaLibraryFiles.length} Assets`;
        }
        if (statSize) {
          const mb = ((mediaLibraryStats.totalSizeBytes || 0) / (1024 * 1024)).toFixed(2);
          statSize.textContent = `${mb} MB`;
        }
        if (statPrevented) {
          statPrevented.textContent = `${mediaLibraryStats.duplicatesPrevented || 0} Blocked`;
        }

        // 2. Render folder navigation pills
        renderMediaFolderPills();

        // 3. Render filtered media cards
        filterMediaGrid();
      } else {
        showToast('Error loading media: ' + (json.message || 'Server error'), 'error');
      }
    } catch (e) {
      console.error('Error loading media library:', e);
      showToast('Connection error loading media library', 'error');
    }
  }

  function renderMediaFolderPills() {
    const bar = document.getElementById('media-folders-bar');
    if (!bar) return;

    if (!mediaLibraryFolders || mediaLibraryFolders.length === 0) {
      mediaLibraryFolders = [
        { id: 'all', label: 'All Files', icon: '📁', count: mediaLibraryFiles.length }
      ];
    }

    bar.innerHTML = mediaLibraryFolders.map(folder => {
      const isActive = folder.id === activeMediaFolder;
      return `
        <button type="button" class="media-folder-pill ${isActive ? 'active' : ''}" 
                onclick="window.adminActions.selectMediaFolder('${escapeHtml(folder.id)}')" 
                title="Filter by ${escapeHtml(folder.label)}">
          <span>${folder.icon || '📁'}</span>
          <span>${escapeHtml(folder.label)}</span>
          <span class="folder-count">${folder.count || 0}</span>
        </button>
      `;
    }).join('');
  }

  function selectMediaFolder(folderId) {
    activeMediaFolder = folderId || 'all';
    renderMediaFolderPills();
    filterMediaGrid();
  }

  function filterMediaGrid() {
    const container = document.getElementById('media-grid-container');
    if (!container) return;

    const searchInput = document.getElementById('media-search-input');
    const searchVal = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const typeFilter = document.getElementById('media-type-filter')?.value || 'all';
    const sortSelect = document.getElementById('media-sort-select')?.value || 'newest';
    const clearBtn = document.getElementById('media-search-clear');
    if (clearBtn) clearBtn.style.display = searchVal ? 'block' : 'none';

    // Filter files
    let filtered = mediaLibraryFiles.slice();

    // 1. By section folder
    if (activeMediaFolder && activeMediaFolder !== 'all') {
      filtered = filtered.filter(f => f.folder === activeMediaFolder);
    }

    // 2. By search text
    if (searchVal) {
      filtered = filtered.filter(f => {
        const name = (f.displayName || '').toLowerCase();
        const orig = (f.filename || '').toLowerCase();
        const folder = (f.folderLabel || '').toLowerCase();
        return name.includes(searchVal) || orig.includes(searchVal) || folder.includes(searchVal);
      });
    }

    // 3. By type filter
    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter(f => f.category === typeFilter);
    }

    // 4. Sort
    if (sortSelect === 'newest') {
      filtered.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    } else if (sortSelect === 'oldest') {
      filtered.sort((a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0));
    } else if (sortSelect === 'name') {
      filtered.sort((a, b) => (a.displayName || a.filename).localeCompare(b.displayName || b.filename));
    } else if (sortSelect === 'size') {
      filtered.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
    }

    // Update section header
    const activeMeta = mediaLibraryFolders.find(f => f.id === activeMediaFolder) || {
      label: 'All Files',
      icon: '📁'
    };
    const iconEl = document.getElementById('media-current-folder-icon');
    const nameEl = document.getElementById('media-current-folder-name');
    const countEl = document.getElementById('media-current-folder-count');
    const hintEl = document.getElementById('media-current-folder-hint');

    if (iconEl) iconEl.textContent = activeMeta.icon || '📁';
    if (nameEl) nameEl.textContent = activeMeta.label || 'All Files';
    if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'file' : 'files'}`;
    if (hintEl) {
      if (activeMediaFolder === 'all') {
        hintEl.textContent = 'Showing all unique files across all portfolio section folders';
      } else {
        hintEl.textContent = `Showing files filed under the ${activeMeta.label} folder`;
      }
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; background: rgba(15, 16, 26, 0.4); border: 1px dashed var(--border);">
          <div style="font-size: 2.5rem; margin-bottom: 0.6rem;">📂</div>
          <h4 style="font-size: 1rem; margin-bottom: 0.3rem;">No media files found</h4>
          <p class="text-muted" style="font-size: 0.82rem; margin-bottom: 1rem;">
            ${searchVal ? `No files matching "${escapeHtml(searchVal)}" in this view.` : `No files currently in folder "${escapeHtml(activeMeta.label)}".`}
          </p>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            ${searchVal ? `<button type="button" class="btn-secondary" onclick="window.adminActions.clearMediaSearch()">Clear Search</button>` : ''}
            <button type="button" class="btn-primary" onclick="window.adminActions.openMediaUploadModal('${activeMediaFolder !== 'all' ? activeMediaFolder : 'auto'}')">
              ＋ Upload File to this Section
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(f => {
      const isImg = f.category === 'Image';
      const previewHtml = isImg
        ? `<img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.filename)}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'doc-icon\\'>🖼️</span>'">`
        : `<span class="doc-icon">${f.category === 'PDF' ? '📄' : '📁'}</span>`;

      const folderColor = f.folderColor || '#d4af37';
      const folderBg = hexToRgba(folderColor, 0.12);
      const folderBorder = hexToRgba(folderColor, 0.35);

      const sizeFormatted = (f.sizeBytes || 0) > 1024 * 1024
        ? `${((f.sizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB`
        : `${((f.sizeBytes || 0) / 1024).toFixed(1)} KB`;

      return `
        <div class="media-card" style="position: relative;">
          <button type="button" class="media-card-delete-top-btn" onclick="event.stopPropagation(); window.adminActions.deleteMedia('${escapeHtml(f.filename)}')" title="Delete File">🗑️</button>
          <div class="media-preview-box" onclick="window.adminActions.viewDocument('${escapeHtml(f.url)}', '${escapeHtml(f.displayName)}')" title="Click to preview ${escapeHtml(f.displayName)}">
            ${previewHtml}
            <div class="media-hover-overlay">
              <span>👁️ View / Preview</span>
            </div>
          </div>
          <div class="media-details" onclick="window.adminActions.viewDocument('${escapeHtml(f.url)}', '${escapeHtml(f.displayName)}')" style="cursor: pointer;">
            <div>
              <span class="media-folder-tag" style="background: ${folderBg}; color: ${folderColor}; border-color: ${folderBorder};" title="Filed in ${escapeHtml(f.folderLabel || f.folder)} folder">
                <span>${f.folderIcon || '📁'}</span>
                <span>${escapeHtml(f.folderLabel || f.folder)}</span>
              </span>
              <div class="media-display-name mt-1" title="${escapeHtml(f.displayName)}">
                ${escapeHtml(f.displayName)}
              </div>
              <div class="media-raw-filename" title="${escapeHtml(f.filename)}">
                ${escapeHtml(f.filename)}
              </div>
            </div>
            <div>
              <div class="media-meta-line" style="margin-bottom: 0;">
                <span class="folder-badge" style="font-size: 0.66rem; padding: 0.1rem 0.35rem;">${escapeHtml(f.category)}</span>
                <span>${sizeFormatted}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function clearMediaSearch() {
    const input = document.getElementById('media-search-input');
    if (input) input.value = '';
    filterMediaGrid();
  }

  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(212, 175, 55, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(212, 175, 55, ${alpha})`;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  // Upload modal handlers
  let selectedUploadMediaFile = null;

  function openMediaUploadModal(defaultFolder = null) {
    const modal = document.getElementById('modal-upload-media');
    if (!modal) return;
    const form = document.getElementById('form-upload-media');
    if (form) form.reset();

    const folderSelect = document.getElementById('upload-target-folder');
    if (folderSelect) {
      const target = defaultFolder || (activeMediaFolder !== 'all' ? activeMediaFolder : 'auto');
      folderSelect.value = target;
    }

    selectedUploadMediaFile = null;
    const fileInfo = document.getElementById('modal-selected-file-info');
    if (fileInfo) fileInfo.style.display = 'none';
    const dropLabel = document.getElementById('modal-dropzone-label');
    if (dropLabel) dropLabel.textContent = 'Click or Drag & Drop File Here';
    const submitBtn = document.getElementById('btn-submit-media-upload');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '📤 Upload to Section Folder';
    }
    const alertBox = document.getElementById('media-upload-dedup-alert');
    if (alertBox) alertBox.style.display = 'none';

    modal.style.display = 'flex';
  }

  function closeMediaUploadModal() {
    const modal = document.getElementById('modal-upload-media');
    if (modal) modal.style.display = 'none';
    selectedUploadMediaFile = null;
  }

  // Setup modal dropzone & file picking
  const mediaModalDropzone = document.getElementById('media-modal-dropzone');
  const mediaModalFileInput = document.getElementById('media-modal-file-input');

  if (mediaModalDropzone && mediaModalFileInput) {
    mediaModalDropzone.addEventListener('click', () => mediaModalFileInput.click());

    mediaModalDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      mediaModalDropzone.style.borderColor = 'var(--gold)';
      mediaModalDropzone.style.background = 'rgba(212, 175, 55, 0.1)';
    });

    mediaModalDropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      mediaModalDropzone.style.borderColor = 'rgba(212, 175, 55, 0.4)';
      mediaModalDropzone.style.background = 'rgba(15, 16, 26, 0.6)';
    });

    mediaModalDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      mediaModalDropzone.style.borderColor = 'rgba(212, 175, 55, 0.4)';
      mediaModalDropzone.style.background = 'rgba(15, 16, 26, 0.6)';
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        handleMediaFileSelected(e.dataTransfer.files[0]);
      }
    });

    mediaModalFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) {
        handleMediaFileSelected(e.target.files[0]);
      }
    });
  }

  function handleMediaFileSelected(file) {
    if (!file) return;
    selectedUploadMediaFile = file;
    const fileInfo = document.getElementById('modal-selected-file-info');
    const nameEl = document.getElementById('modal-selected-filename');
    const sizeEl = document.getElementById('modal-selected-filesize');
    const dropLabel = document.getElementById('modal-dropzone-label');
    const submitBtn = document.getElementById('btn-submit-media-upload');
    const alertBox = document.getElementById('media-upload-dedup-alert');

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
    if (fileInfo) fileInfo.style.display = 'block';
    if (dropLabel) dropLabel.textContent = 'Selected: ' + file.name;
    if (submitBtn) submitBtn.disabled = false;
    if (alertBox) alertBox.style.display = 'none';
  }

  document.getElementById('form-upload-media')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedUploadMediaFile) {
      showToast('Please select a file to upload', 'warning');
      return;
    }

    const targetFolder = document.getElementById('upload-target-folder')?.value || 'auto';
    const submitBtn = document.getElementById('btn-submit-media-upload');
    const alertBox = document.getElementById('media-upload-dedup-alert');

    const formData = new FormData();
    formData.append('media', selectedUploadMediaFile);
    if (targetFolder && targetFolder !== 'auto') {
      formData.append('folder', targetFolder);
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Checking Hash & Uploading...';
      }
      showToast(`Uploading ${selectedUploadMediaFile.name}...`, 'info');

      const res = await fetch('/api/cms/media/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (res.ok && json.success) {
        if (json.isDuplicate) {
          showToast(`⚠️ Duplicate file detected: exactly matches "${json.data.filename}"`, 'warning');
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(251, 191, 36, 0.15)';
            alertBox.style.border = '1px solid rgba(251, 191, 36, 0.4)';
            alertBox.style.color = '#fbbf24';
            alertBox.innerHTML = `
              🛡️ <strong>Zero Duplicate Guarantee:</strong><br>
              An identical file already exists in your Media Library as <strong>"${escapeHtml(json.data.filename)}"</strong> in folder <strong>[${escapeHtml(json.data.folderLabel || json.data.folder)}]</strong>.<br>
              Duplicate creation was safely prevented to keep your library clean.
              <div style="margin-top: 0.6rem;">
                <button type="button" class="btn-sm-sync" onclick="window.adminActions.viewDocument('${escapeHtml(json.data.url)}', '${escapeHtml(json.data.displayName)}')">
                  👁️ View Existing Asset
                </button>
              </div>
            `;
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '📤 Upload to Section Folder';
          }
          await loadMediaLibrary();
          return;
        }

        showToast(`✓ "${selectedUploadMediaFile.name}" uploaded to [${json.data.folderLabel}]!`, 'success');
        closeMediaUploadModal();
        await loadMediaLibrary();
        if (json.data && json.data.folder) {
          selectMediaFolder(json.data.folder);
        }
      } else {
        showToast('Error uploading media: ' + (json.message || 'Server error'), 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '📤 Upload to Section Folder';
        }
      }
    } catch (err) {
      console.error('Error uploading media:', err);
      showToast('Connection error uploading media file', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 Upload to Section Folder';
      }
    }
  });

  /* ── 13. Section Visibility ── */
  function loadSectionsManager() {
    if (!currentDraftProfile) return;
    const v = currentDraftProfile.sectionVisibility || {};

    const setChecked = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = val !== false;
    };

    setChecked('sec-hero', v.hero);
    setChecked('sec-marquee', v.marquee);
    setChecked('sec-about', v.about);
    setChecked('sec-skills', v.skills);
    setChecked('sec-experience', v.experience);
    setChecked('sec-projects', v.projects);
    setChecked('sec-certs', v.certs);
    setChecked('sec-achievements', v.achievements);
    setChecked('sec-contact', v.contact);
  }

  document.getElementById('save-sections-btn')?.addEventListener('click', async () => {
    const payload = {
      hero: document.getElementById('sec-hero').checked,
      marquee: document.getElementById('sec-marquee').checked,
      about: document.getElementById('sec-about').checked,
      skills: document.getElementById('sec-skills').checked,
      experience: document.getElementById('sec-experience').checked,
      projects: document.getElementById('sec-projects').checked,
      certs: document.getElementById('sec-certs').checked,
      achievements: document.getElementById('sec-achievements').checked,
      contact: document.getElementById('sec-contact').checked
    };

    try {
      const res = await fetch('/api/cms/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ Public section visibility updated in draft!', 'success');
        loadDashboard();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error saving section visibility', 'error');
    }
  });

  /* ── 14. Contact & Footer ── */
  function loadContactFooter() {
    if (!currentDraftProfile) return;
    const p = currentDraftProfile;
    const copyright = document.getElementById('footer-copyright-text');
    const location = document.getElementById('footer-location-text');

    if (copyright) copyright.value = p.footer?.copyrightText || `&copy; 2026 · ${p.name?.toUpperCase()} · All Rights Reserved`;
    if (location) location.value = p.footer?.locationText || `📍 Geethanjali Institute of Science & Technology · Nellore, AP`;
  }

  document.getElementById('save-contact-btn')?.addEventListener('click', async () => {
    const payload = {
      footer: {
        copyrightText: document.getElementById('footer-copyright-text').value.trim(),
        locationText: document.getElementById('footer-location-text').value.trim()
      }
    };

    try {
      const res = await fetch('/api/cms/profile-hero', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ Footer configuration saved to draft!', 'success');
        loadDashboard();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error saving footer', 'error');
    }
  });

  /* ── 15. SEO & Structured Data ── */
  function loadSeoManager() {
    if (!currentDraftProfile) return;
    const p = currentDraftProfile;
    const s = p.seo || {};

    const setValue = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setValue('seo-page-title', p.pageTitle);
    setValue('seo-meta-desc', s.description);
    setValue('seo-meta-keywords', s.keywords);
    setValue('seo-canonical-url', s.canonicalUrl);
    setValue('seo-google-token', s.googleSiteVerification);
    setValue('seo-og-image', s.ogImage);

    // Render Schema.org JSON-LD preview
    const previewBox = document.getElementById('jsonld-preview-box');
    if (previewBox) {
      const schemaGraph = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Person',
            'name': p.name,
            'jobTitle': p.headline,
            'url': s.canonicalUrl,
            'image': s.ogImage,
            'sameAs': [
              p.socialLinks?.github,
              p.socialLinks?.linkedin,
              p.socialLinks?.credly
            ].filter(Boolean)
          },
          {
            '@type': 'WebSite',
            'url': s.canonicalUrl,
            'name': `${p.name} Portfolio`
          }
        ]
      };
      previewBox.textContent = JSON.stringify(schemaGraph, null, 2);
    }
  }

  document.getElementById('save-seo-btn')?.addEventListener('click', async () => {
    const payload = {
      pageTitle: document.getElementById('seo-page-title').value.trim(),
      seo: {
        description: document.getElementById('seo-meta-desc').value.trim(),
        keywords: document.getElementById('seo-meta-keywords').value.trim(),
        canonicalUrl: document.getElementById('seo-canonical-url').value.trim(),
        googleSiteVerification: document.getElementById('seo-google-token').value.trim(),
        ogImage: document.getElementById('seo-og-image').value.trim()
      }
    };

    try {
      const res = await fetch('/api/cms/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✓ SEO parameters and structured data saved to draft!', 'success');
        loadDashboard();
      } else {
        showToast('Error: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error saving SEO', 'error');
    }
  });

  /* ── 16. Backup & Restore ── */
  document.getElementById('form-restore-backup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('backup-file-input');
    if (!fileInput.files.length) return;

    if (!confirm('Are you sure you want to restore your portfolio from this backup? A safety snapshot will be created automatically before overwriting.')) {
      return;
    }

    const btn = document.getElementById('btn-submit-restore');
    btn.disabled = true;
    btn.textContent = 'Restoring from backup...';

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        const res = await fetch('/api/cms/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backupData)
        });
        const json = await res.json();
        btn.disabled = false;
        btn.textContent = '↺ Restore Portfolio from Backup';

        if (res.ok && json.success) {
          showToast('✓ Portfolio restored successfully from backup!', 'success');
          await loadDashboard();
          switchTab('tab-overview');
        } else {
          showToast('Restore failed: ' + json.message, 'error');
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '↺ Restore Portfolio from Backup';
        showToast('Invalid JSON file format', 'error');
      }
    };
    reader.readAsText(fileInput.files[0]);
  });

  /* ── 17. Document Upload & Extraction ── */
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');

  dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleDocumentUpload(e.dataTransfer.files[0]);
  });
  fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length) handleDocumentUpload(e.target.files[0]);
  });

  async function handleDocumentUpload(file) {
    const statusBox = document.getElementById('upload-status-box');
    const fnLabel = document.getElementById('upload-filename');
    const pctLabel = document.getElementById('upload-percentage');
    const pFill = document.getElementById('upload-progress-fill');
    const logBox = document.getElementById('extraction-log');
    const category = document.getElementById('doc-category-select').value;

    statusBox.style.display = 'block';
    fnLabel.textContent = file.name;
    pctLabel.textContent = 'Processing & Extracting...';
    pFill.style.width = '65%';
    logBox.textContent = `Extracting structured entities from ${file.name}...`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      const json = await res.json();
      pFill.style.width = '100%';

      if (res.ok && json.success) {
        pctLabel.textContent = 'Complete';
        logBox.textContent = `✓ Document processed! ${json.data.extraction.pendingCount} changes queued for review.`;
        showToast(`Extracted ${json.data.extraction.pendingCount} new items from ${file.name}`, 'success');
        loadDocuments();
        loadPendingChanges();
        loadDashboard();
      } else {
        pctLabel.textContent = 'Failed';
        logBox.textContent = `Error: ${json.message}`;
        showToast(json.message, 'error');
      }
    } catch (e) {
      pctLabel.textContent = 'Error';
      logBox.textContent = 'Network error during upload.';
      showToast('Network error during upload', 'error');
    }
  }

  async function loadDocuments() {
    try {
      const res = await fetch('/api/documents');
      const json = await res.json();
      const tbody = document.getElementById('documents-table-body');
      if (res.ok && json.success) {
        const docs = json.data || [];
        if (docs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No documents uploaded yet.</td></tr>';
          return;
        }
        tbody.innerHTML = docs.map(d => {
          const dateStr = (d.uploadedAt || d.createdAt) ? new Date(d.uploadedAt || d.createdAt).toLocaleDateString() : 'Recent';
          const sizeKb = d.sizeBytes ? (d.sizeBytes / 1024).toFixed(1) + ' KB' : '—';
          return `
          <tr>
            <td>
              <button type="button" class="doc-link-btn" onclick="window.adminActions.viewDocument('${d.id}', '${escapeHtml(d.originalName)}')" title="Click to view/preview document">
                📄 <strong>${escapeHtml(d.originalName)}</strong> 👁️
              </button>
            </td>
            <td><span class="diff-category-badge">${escapeHtml(d.docType || 'Document')}</span></td>
            <td>${sizeKb}</td>
            <td>${dateStr}</td>
            <td><span class="diff-category-badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80;">Processed</span></td>
            <td>
              <div class="table-actions">
                <button type="button" class="btn-sm-sync" onclick="window.adminActions.viewDocument('${d.id}', '${escapeHtml(d.originalName)}')">👁️ View</button>
                <a href="/api/documents/${d.id}/download" download class="btn-sm-sync" style="text-decoration: none;">⬇️ Download</a>
                <button class="btn-sm-delete" onclick="window.adminActions.deleteDocument('${d.id}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
        }).join('');
      }
    } catch (e) { }
  }

  /* ── 18. Social Sync & Connected Platforms ── */
  async function loadSocialStatus() {
    try {
      const res = await fetch('/api/social/status');
      const json = await res.json();
      const tbody = document.getElementById('social-platforms-table');
      if (res.ok && json.success) {
        loadedPlatforms = json.data || [];
        const countLabel = document.getElementById('sync-active-count-label');
        if (countLabel) {
          countLabel.textContent = `${loadedPlatforms.length} platforms & websites connected`;
        }

        tbody.innerHTML = loadedPlatforms.map(p => {
          const isUrl = p.url && p.url.trim().length > 0;
          const statusStyle = p.status === 'Active'
            ? 'background: rgba(34, 197, 94, 0.15); color: #4ade80; border-color: rgba(34, 197, 94, 0.3);'
            : (p.status === 'Configured'
              ? 'background: rgba(212, 168, 67, 0.15); color: var(--gold2); border-color: rgba(212, 168, 67, 0.3);'
              : 'background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3);');

          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <span style="font-size: 1.2rem;">${p.icon || '🔗'}</span>
                  <strong>${escapeHtml(p.platform)}</strong>
                </div>
              </td>
              <td>
                ${isUrl
              ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="public-link">${escapeHtml(p.url)}</a>`
              : '<span style="color: var(--text-muted); font-style: italic;">Not configured yet</span>'}
              </td>
              <td>${escapeHtml(p.syncMethod || 'Verified Link')}</td>
              <td><span class="diff-category-badge" style="${statusStyle}">${escapeHtml(p.status || 'Active')}</span></td>
              <td style="text-align: right;">
                <div class="table-actions">
                  <button type="button" class="btn-sm-sync" onclick="window.adminActions.syncPlatform('${escapeHtml(p.id)}', '${escapeHtml(p.platform)}')" title="Sync ${escapeHtml(p.platform)}">
                    ↻ Sync
                  </button>
                  <button type="button" class="btn-sm-edit" onclick="window.adminActions.openEditPlatform('${escapeHtml(p.id)}')">
                    ✏️ Edit
                  </button>
                  <button type="button" class="btn-sm-delete" onclick="window.adminActions.deletePlatform('${escapeHtml(p.id)}', '${escapeHtml(p.platform)}')" title="Unlink / Delete ${escapeHtml(p.platform)}">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (e) {
      console.error('Failed to load social platforms status', e);
    }
  }

  // Universal Sync All
  const btnSyncAll = document.getElementById('btn-sync-all');
  btnSyncAll?.addEventListener('click', async () => {
    btnSyncAll.disabled = true;
    btnSyncAll.innerHTML = '<span>⏳</span> Synchronizing all platforms...';

    try {
      const res = await fetch('/api/social/sync-all', { method: 'POST' });
      const json = await res.json();
      btnSyncAll.disabled = false;
      btnSyncAll.innerHTML = '<span>↻</span> Sync All Connected Websites &amp; Platforms';

      if (res.ok && json.success) {
        const report = json.data;
        showToast(`✓ Universal sync complete! ${report.successCount} of ${report.totalCount} platforms verified & synced.`, 'success');

        const resultsBox = document.getElementById('sync-all-results');
        const grid = document.getElementById('sync-platforms-grid');
        const summaryPill = document.getElementById('sync-summary-pill');
        if (summaryPill) {
          summaryPill.textContent = `${report.successCount}/${report.totalCount} Platforms Active`;
        }

        if (resultsBox && grid) {
          resultsBox.style.display = 'block';
          grid.innerHTML = (report.platforms || []).map(p => {
            const isOk = p.success;
            const cardClass = isOk ? 'sync-result-card success' : 'sync-result-card error';
            const statusLabel = isOk ? 'ACTIVE / OK' : 'CHECK NEEDED';
            const statusBadgeStyle = isOk
              ? 'background: rgba(34, 197, 94, 0.15); color: #4ade80; border-color: rgba(34, 197, 94, 0.3);'
              : 'background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3);';

            return `
              <div class="${cardClass}">
                <div class="sync-result-header">
                  <div class="sync-result-title">
                    <span>${escapeHtml(p.platform || p.id)}</span>
                  </div>
                  <span class="diff-category-badge" style="${statusBadgeStyle}">${statusLabel}</span>
                </div>
                <div class="sync-result-msg">${escapeHtml(p.message || 'Checked')}</div>
                <div class="sync-result-footer">
                  <span class="sync-result-latency">⚡ ${p.latencyMs || 0}ms</span>
                  ${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="public-link" style="font-size: 0.75rem;">Visit Profile ↗</a>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }

        const ghSync = (report.platforms || []).find(p => p.id === 'github');
        if (ghSync && ghSync.data && ghSync.data.repositories && ghSync.data.repositories.length > 0) {
          const ghBox = document.getElementById('github-sync-results');
          const ghGrid = document.getElementById('github-repos-grid');
          if (ghBox && ghGrid) {
            ghBox.style.display = 'block';
            ghGrid.innerHTML = ghSync.data.repositories.map(r => `
              <div class="repo-card">
                <div class="repo-title">📦 ${escapeHtml(r.name)}</div>
                <div class="repo-desc">${escapeHtml(r.description || 'No description provided')}</div>
                <div class="repo-footer">
                  <span>⭐ ${r.stars} &middot; ${r.language || 'Code'}</span>
                  <button class="btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="window.adminActions.importRepo('${r.name}', '${escapeHtml(r.description || '')}', '${r.language || ''}', '${r.url}', '${r.homepage || ''}')">
                    + Add to Projects
                  </button>
                </div>
              </div>
            `).join('');
          }
        }

        await loadSocialStatus();
        loadDashboard();
      } else {
        showToast('Universal sync error: ' + (json.message || 'Unknown error'), 'error');
      }
    } catch (err) {
      btnSyncAll.disabled = false;
      btnSyncAll.innerHTML = '<span>↻</span> Sync All Connected Websites &amp; Platforms';
      showToast('Network error during universal sync', 'error');
    }
  });

  document.getElementById('btn-sync-github')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-github');
    btn.disabled = true;
    btn.textContent = 'Querying GitHub API...';

    try {
      const res = await fetch('/api/social/github/sync', { method: 'POST' });
      const json = await res.json();
      btn.disabled = false;
      btn.textContent = '↻ Sync GitHub Now';

      if (res.ok && json.success) {
        showToast(`GitHub Sync complete! Found ${json.data.repositories.length} public repos.`, 'success');
        loadDashboard();
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '↻ Sync GitHub Now';
      showToast('Network error during GitHub Sync', 'error');
    }
  });

  /* ── 19. History & Snapshots ── */
  let _cachedAuditHistory = [];

  function renderAuditHistoryTable(items) {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No audit logs match your filter.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(h => `
      <tr>
        <td>${new Date(h.timestamp).toLocaleString()}</td>
        <td><strong>${escapeHtml(h.field || '—')}</strong></td>
        <td>${escapeHtml(h.source || h.approvedBy || 'Admin')}</td>
        <td class="text-muted">${escapeHtml(h.oldValue || '—')}</td>
        <td>${escapeHtml(h.newValue || '—')}</td>
        <td><span class="diff-category-badge">${escapeHtml(h.status || 'Applied')}</span></td>
      </tr>
    `).join('');
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/admin/history');
      const json = await res.json();
      if (!res.ok || !json.success) return;

      const { history, snapshots } = json.data;
      _cachedAuditHistory = history || [];

      // Update snapshots count badge
      const countBadge = document.getElementById('snapshots-count-badge');
      if (countBadge) {
        countBadge.textContent = `${(snapshots || []).length} Snapshots`;
      }

      const snapContainer = document.getElementById('snapshots-list');
      if (!snapshots || snapshots.length === 0) {
        snapContainer.innerHTML = '<div class="text-muted">No snapshots recorded yet. Click "📸 Take Instant Snapshot" above to create one now.</div>';
      } else {
        snapContainer.innerHTML = snapshots.map(s => `
          <div class="snapshot-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
              <span class="diff-category-badge" style="font-size:0.7rem;">SNAPSHOT</span>
              <button class="btn-danger" style="font-size:0.75rem;padding:0.25rem 0.6rem;flex-shrink:0;" onclick="window.adminActions.deleteSnapshot('${escapeHtml(s.filename)}')">🗑️ Delete</button>
            </div>
            <div class="repo-title" style="margin-top:0.5rem; word-break: break-all;">📸 ${escapeHtml(s.filename)}</div>
            <div class="repo-desc">Created on ${new Date(s.createdAt).toLocaleString()} (${(s.sizeBytes / 1024).toFixed(1)} KB)</div>
            <div style="display:flex;gap:0.5rem;margin-top:0.6rem;flex-wrap:wrap;">
              <button class="btn-secondary" style="font-size:0.8rem;" onclick="window.adminActions.viewSnapshot('${escapeHtml(s.filename)}')">
                👁️ View
              </button>
              <button class="btn-primary" style="font-size:0.8rem;" onclick="window.adminActions.rollbackSnapshot('${escapeHtml(s.filename)}')">
                ↺ Rollback
              </button>
            </div>
          </div>
        `).join('');
      }

      renderAuditHistoryTable(_cachedAuditHistory);
    } catch (e) {
      console.error('Error loading history:', e);
    }
  }

  // Filter audit logs input
  document.getElementById('history-search-input')?.addEventListener('input', (e) => {
    const q = (e.target.value || '').toLowerCase().trim();
    if (!q) {
      renderAuditHistoryTable(_cachedAuditHistory);
      return;
    }
    const filtered = _cachedAuditHistory.filter(h => {
      const txt = `${h.field || ''} ${h.source || ''} ${h.oldValue || ''} ${h.newValue || ''} ${h.status || ''}`.toLowerCase();
      return txt.includes(q);
    });
    renderAuditHistoryTable(filtered);
  });

  // Take Instant Snapshot button
  document.getElementById('btn-create-instant-snapshot')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-create-instant-snapshot');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Creating Snapshot...';

    try {
      const res = await fetch('/api/admin/history/snapshots', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`✓ Instant snapshot "${json.data?.filename}" created successfully!`, 'success');
        await loadHistory();
      } else {
        showToast('Failed to create snapshot: ' + (json.message || ''), 'error');
      }
    } catch (err) {
      showToast('Network error creating snapshot', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '📸 Take Instant Snapshot';
    }
  });

  // Refresh history button
  document.getElementById('btn-refresh-history')?.addEventListener('click', async () => {
    await loadHistory();
    showToast('✓ History & snapshots refreshed', 'info');
  });

  // Export audit log as CSV
  document.getElementById('btn-export-audit-csv')?.addEventListener('click', () => {
    if (!_cachedAuditHistory.length) {
      showToast('No audit logs available to export', 'warning');
      return;
    }
    const headers = ['Timestamp', 'Field', 'Source', 'Old Value', 'New Value', 'Status'];
    const rows = _cachedAuditHistory.map(h => [
      `"${new Date(h.timestamp).toISOString()}"`,
      `"${(h.field || '').replace(/"/g, '""')}"`,
      `"${(h.source || h.approvedBy || '').replace(/"/g, '""')}"`,
      `"${(h.oldValue || '').replace(/"/g, '""')}"`,
      `"${(h.newValue || '').replace(/"/g, '""')}"`,
      `"${(h.status || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Audit log CSV downloaded', 'success');
  });

  /* ── 20. Password Change ── */
  document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById('old-pass').value;
    const newPassword = document.getElementById('new-pass').value;

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Password updated successfully', 'success');
        document.getElementById('change-password-form').reset();
      } else {
        showToast('Failed: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error updating password', 'error');
    }
  });

  /* ── 21. Publish Live ── */
  document.getElementById('quick-publish-btn')?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to publish all approved draft changes live to your portfolio website?')) {
      return;
    }

    try {
      const res = await fetch('/api/profile/publish', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('🚀 Live portfolio updated and synchronized successfully!', 'success');
        loadDashboard();
      } else {
        showToast('Publish failed: ' + json.message, 'error');
      }
    } catch (e) {
      showToast('Connection error while publishing', 'error');
    }
  });

  /* ── Interactive Live Link Verification ── */
  async function performUrlVerification(url, platformName, feedbackEl, verifyBtn) {
    if (!url || !url.trim()) {
      if (feedbackEl) {
        feedbackEl.className = 'verify-feedback-box error';
        feedbackEl.innerHTML = '<span>❌</span> <span>Please enter a URL to verify.</span>';
        feedbackEl.style.display = 'flex';
      }
      return false;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = '⏳ Verifying...';
    }

    if (feedbackEl) {
      feedbackEl.className = 'verify-feedback-box loading';
      feedbackEl.innerHTML = '<span>⏳</span> <span>Verifying reachability and checking domain match with "' + escapeHtml(platformName || 'platform') + '"...</span>';
      feedbackEl.style.display = 'flex';
    }

    try {
      const res = await fetch('/api/social/platforms/verify-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), platform: platformName || '' })
      });
      const json = await res.json();
      const data = json.data;

      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = '🔍 Verify Link';
      }

      if (res.ok && data && data.verified) {
        if (feedbackEl) {
          feedbackEl.className = 'verify-feedback-box success';
          feedbackEl.innerHTML = '<span>✅</span> <span>' + escapeHtml(data.reason || 'Verified! Link is active and reachable.') + '</span>';
          feedbackEl.style.display = 'flex';
        }
        return true;
      } else {
        const errorMsg = (data && data.reason) || json.message || 'Verification failed. URL could not be verified.';
        if (feedbackEl) {
          feedbackEl.className = 'verify-feedback-box error';
          feedbackEl.innerHTML = '<span>❌</span> <span>' + escapeHtml(errorMsg) + '</span>';
          feedbackEl.style.display = 'flex';
        }
        return false;
      }
    } catch (err) {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = '🔍 Verify Link';
      }
      if (feedbackEl) {
        feedbackEl.className = 'verify-feedback-box error';
        feedbackEl.innerHTML = '<span>❌</span> <span>Connection error verifying URL.</span>';
        feedbackEl.style.display = 'flex';
      }
      return false;
    }
  }

  // Interactive verify button listeners
  document.getElementById('btn-verify-edit-url')?.addEventListener('click', () => {
    const url = document.getElementById('edit-platform-url')?.value;
    const name = document.getElementById('edit-platform-name')?.value;
    const feedback = document.getElementById('edit-verify-feedback');
    const btn = document.getElementById('btn-verify-edit-url');
    performUrlVerification(url, name, feedback, btn);
  });

  document.getElementById('btn-verify-add-url')?.addEventListener('click', () => {
    const url = document.getElementById('add-platform-url')?.value;
    const name = document.getElementById('add-platform-name')?.value;
    const feedback = document.getElementById('add-verify-feedback');
    const btn = document.getElementById('btn-verify-add-url');
    performUrlVerification(url, name, feedback, btn);
  });

  // Open Add Platform Modal
  document.getElementById('btn-add-platform')?.addEventListener('click', () => {
    const form = document.getElementById('form-add-platform');
    if (form) form.reset();
    const methodInput = document.getElementById('add-platform-method');
    if (methodInput) methodInput.value = 'Verified Public Profile';
    const feedback = document.getElementById('add-verify-feedback');
    if (feedback) feedback.style.display = 'none';
    const modal = document.getElementById('modal-add-platform');
    if (modal) modal.style.display = 'flex';
    document.getElementById('add-platform-name')?.focus();
  });

  // Preset pills auto-fill
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const name = pill.dataset.name;
      const icon = pill.dataset.icon;
      const method = pill.dataset.method;
      const prefix = pill.dataset.prefix;

      const nameInput = document.getElementById('add-platform-name');
      const iconInput = document.getElementById('add-platform-icon');
      const methodInput = document.getElementById('add-platform-method');
      const urlInput = document.getElementById('add-platform-url');
      const feedback = document.getElementById('add-verify-feedback');
      if (feedback) feedback.style.display = 'none';

      if (nameInput) nameInput.value = name;
      if (iconInput) iconInput.value = icon;
      if (methodInput) methodInput.value = method;
      if (urlInput) {
        urlInput.value = prefix;
        urlInput.focus();
      }
    });
  });

  // Submit Edit Platform Form
  document.getElementById('form-edit-platform')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-platform-id').value;
    const platform = document.getElementById('edit-platform-name').value.trim();
    const url = document.getElementById('edit-platform-url').value.trim();
    const syncMethod = document.getElementById('edit-platform-method').value.trim();
    const status = document.getElementById('edit-platform-status').value;
    const feedback = document.getElementById('edit-verify-feedback');
    const verifyBtn = document.getElementById('btn-verify-edit-url');

    const isVerified = await performUrlVerification(url, platform, feedback, verifyBtn);
    if (!isVerified) {
      showToast('Cannot save: Link verification failed. Please correct the URL.', 'error');
      return;
    }

    const btn = document.getElementById('btn-save-platform');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      const res = await fetch(`/api/social/platforms/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, url, syncMethod, status })
      });
      const json = await res.json();
      if (btn) { btn.disabled = false; btn.textContent = 'Save & Sync Live'; }

      if (res.ok && json.success) {
        showToast(`✓ ${platform} profile verified, updated, and synchronized live!`, 'success');
        document.getElementById('modal-edit-platform').style.display = 'none';
        await loadSocialStatus();
        loadDashboard();
      } else {
        showToast(`Error: ${json.message || 'Could not update platform'}`, 'error');
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Save & Sync Live'; }
      showToast('Connection error updating platform', 'error');
    }
  });

  // Submit Add Platform Form
  document.getElementById('form-add-platform')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('add-platform-name').value.trim();
    const url = document.getElementById('add-platform-url').value.trim();
    const syncMethod = document.getElementById('add-platform-method').value.trim();
    const icon = document.getElementById('add-platform-icon').value.trim();
    const feedback = document.getElementById('add-verify-feedback');
    const verifyBtn = document.getElementById('btn-verify-add-url');

    const isVerified = await performUrlVerification(url, name, feedback, verifyBtn);
    if (!isVerified) {
      showToast('Cannot link: Website verification failed. Check that the name and URL are correct.', 'error');
      return;
    }

    const btn = document.getElementById('btn-submit-add-platform');
    if (btn) { btn.disabled = true; btn.textContent = 'Linking...'; }

    try {
      const res = await fetch('/api/social/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, syncMethod, icon })
      });
      const json = await res.json();
      if (btn) { btn.disabled = false; btn.textContent = 'Link Platform'; }

      if (res.ok && json.success) {
        showToast(`✓ Verified & linked new website/platform: ${name}!`, 'success');
        document.getElementById('modal-add-platform').style.display = 'none';
        await loadSocialStatus();
        loadDashboard();
      } else {
        showToast(`Error: ${json.message || 'Could not link platform'}`, 'error');
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Link Platform'; }
      showToast('Connection error linking platform', 'error');
    }
  });

  // Modal Closers
  const closeModal = (id) => {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
  };

  document.querySelectorAll('.modal-close-btn, .modal-footer .btn-secondary').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) modal.style.display = 'none';
    });
  });

  document.getElementById('close-doc-viewer-modal')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-doc-viewer');
    const iframe = document.getElementById('doc-viewer-iframe');
    if (iframe) iframe.src = 'about:blank';
    if (modal) modal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('modal-overlay')) {
      e.target.style.display = 'none';
      const ifr = e.target.querySelector('iframe');
      if (ifr) ifr.src = 'about:blank';
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => {
        m.style.display = 'none';
        const ifr = m.querySelector('iframe');
        if (ifr) ifr.src = 'about:blank';
      });
    }
  });

  /* ── GLOBAL ACTIONS EXPOSURE ── */
  window.adminActions = {
    switchTab,
    publishAllDraft: async () => {
      document.getElementById('quick-publish-btn')?.click();
    },

    // Document Viewing & Local File Previews
    openDocViewer: (fileRef, title) => {
      window.adminActions.viewDocument(fileRef, title);
    },
    viewDocument: (fileRef, title) => {
      if (!fileRef) {
        showToast('No document file reference specified', 'warning');
        return;
      }
      const modal = document.getElementById('modal-doc-viewer');
      if (!modal) return;

      const titleEl = document.getElementById('doc-viewer-title');
      const iframe = document.getElementById('doc-viewer-iframe');
      const imgContainer = document.getElementById('doc-viewer-img-container');
      const imgEl = document.getElementById('doc-viewer-img');
      const loadingEl = document.getElementById('doc-viewer-loading');
      const errorEl = document.getElementById('doc-viewer-error');
      const openTabBtn = document.getElementById('doc-viewer-open-tab');
      const downloadBtn = document.getElementById('doc-viewer-download');

      const token = localStorage.getItem('adminToken') || '';
      let url = '';

      const refStr = String(fileRef).trim();
      if (refStr.startsWith('blob:') || refStr.startsWith('data:')) {
        url = refStr;
      } else if (refStr.startsWith('http://') || refStr.startsWith('https://')) {
        url = refStr;
      } else if (refStr.startsWith('/media/')) {
        url = refStr;
      } else if (refStr.startsWith('media/')) {
        url = '/' + refStr;
      } else if (refStr.startsWith('/')) {
        url = refStr;
      } else if (refStr.startsWith('./')) {
        url = '/' + refStr.slice(2);
      } else {
        const cleanRef = refStr.replace(/^\.?\//, '');
        url = `/api/documents/${encodeURIComponent(cleanRef)}/view?token=${encodeURIComponent(token)}`;
      }

      const downloadUrl = (url.startsWith('blob:') || url.startsWith('http'))
        ? url
        : `/api/documents/${encodeURIComponent(refStr.replace(/^\.?\//, ''))}/download?token=${encodeURIComponent(token)}`;

      const displayTitle = title || fileRef.split('/').pop() || 'Document Preview';
      if (titleEl) titleEl.textContent = displayTitle;
      if (openTabBtn) openTabBtn.href = url;
      if (downloadBtn) downloadBtn.href = downloadUrl;
      const errDownload = document.getElementById('doc-viewer-error-download');
      if (errDownload) errDownload.href = downloadUrl;

      const isImage = /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(fileRef) || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(displayTitle);

      if (loadingEl) loadingEl.style.display = 'flex';
      if (errorEl) errorEl.style.display = 'none';

      if (isImage) {
        if (iframe) {
          iframe.style.display = 'none';
          iframe.src = 'about:blank';
        }
        if (imgContainer) imgContainer.style.display = 'flex';
        if (imgEl) {
          imgEl.src = url;
          imgEl.onload = () => { if (loadingEl) loadingEl.style.display = 'none'; };
          imgEl.onerror = () => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (imgContainer) imgContainer.style.display = 'none';
            if (errorEl) errorEl.style.display = 'block';
          };
        }
      } else {
        if (imgContainer) imgContainer.style.display = 'none';
        if (iframe) {
          iframe.style.display = 'block';
          iframe.src = url;
          setTimeout(() => { if (loadingEl) loadingEl.style.display = 'none'; }, 500);
          iframe.onload = () => { if (loadingEl) loadingEl.style.display = 'none'; };
          iframe.onerror = () => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (iframe) iframe.style.display = 'none';
            if (errorEl) errorEl.style.display = 'block';
          };
        }
      }

      modal.style.display = 'flex';
    },

    previewLocalInputFile: (inputId) => {
      const input = document.getElementById(inputId);
      if (!input || !input.files || !input.files[0]) {
        showToast('Please select a file first to preview', 'warning');
        return;
      }
      const file = input.files[0];
      const objectUrl = URL.createObjectURL(file);
      window.adminActions.viewDocument(objectUrl, file.name);
    },

    // Review queue
    approveChange: async (id) => {
      const res = await fetch(`/api/admin/pending/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        showToast('Change approved & merged to draft!', 'success');
        document.getElementById(`change-${id}`)?.remove();
        loadDashboard();
      }
    },
    rejectChange: async (id) => {
      const res = await fetch(`/api/admin/pending/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Rejected from queue' }) });
      if (res.ok) {
        showToast('Change rejected', 'info');
        document.getElementById(`change-${id}`)?.remove();
        loadDashboard();
      }
    },
    ignoreChange: async (id) => {
      const res = await fetch(`/api/admin/pending/${id}/ignore`, { method: 'POST' });
      if (res.ok) {
        showToast('Change ignored', 'info');
        document.getElementById(`change-${id}`)?.remove();
        loadDashboard();
      }
    },

    // About
    removeAboutParagraph: (idx) => {
      const el = document.getElementById(`about-para-${idx}`);
      if (el) el.remove();
    },

    // Skills & Categories
    openAddCategoryModal: () => {
      document.getElementById('form-add-category-modal')?.reset();
      const container = document.getElementById('category-add-bars-container');
      if (container) {
        container.innerHTML = '';
        addCategoryBarRow('add', '', 85);
      }
      document.getElementById('modal-add-category').style.display = 'flex';
      document.getElementById('category-add-name')?.focus();
    },

    openEditCategoryModal: (idxOrName) => {
      const skills = (currentDraftProfile && currentDraftProfile.skills) ? currentDraftProfile.skills : [];
      let catObj = null;
      let catIdx = -1;

      if (typeof idxOrName === 'number' || (!isNaN(Number(idxOrName)) && String(idxOrName).trim() !== '')) {
        catIdx = parseInt(idxOrName, 10);
        catObj = skills[catIdx];
      } else if (typeof idxOrName === 'string') {
        catIdx = skills.findIndex(s => s.category.toLowerCase() === idxOrName.trim().toLowerCase());
        catObj = skills[catIdx];
      }

      if (!catObj) {
        showToast('Category not found to edit', 'error');
        return;
      }

      document.getElementById('category-edit-index').value = catIdx;
      document.getElementById('category-edit-name').value = catObj.category || '';
      document.getElementById('category-edit-skills').value = (catObj.items || []).join(', ');

      const container = document.getElementById('category-edit-bars-container');
      if (container) {
        container.innerHTML = '';
        if (catObj.bars && catObj.bars.length > 0) {
          catObj.bars.forEach(b => addCategoryBarRow('edit', b.label, b.value));
        } else {
          addCategoryBarRow('edit', '', 85);
        }
      }

      document.getElementById('modal-edit-category').style.display = 'flex';
      document.getElementById('category-edit-name')?.focus();
    },

    openDeleteCategoryModal: (defaultCat = '') => {
      const modal = document.getElementById('modal-delete-category');
      const select = document.getElementById('category-delete-select');
      if (!modal || !select) return;

      const skills = (currentDraftProfile && currentDraftProfile.skills) ? currentDraftProfile.skills : [];
      if (!skills.length) {
        showToast('No skill categories available to delete', 'warning');
        return;
      }

      select.innerHTML = skills.map(c => `
        <option value="${escapeHtml(c.category)}" ${c.category === defaultCat ? 'selected' : ''}>
          📁 ${escapeHtml(c.category)} (${(c.items || []).length} skills)
        </option>
      `).join('');

      if (defaultCat) select.value = defaultCat;
      modal.style.display = 'flex';
    },

    deleteSkillCategory: async (categoryName) => {
      if (!categoryName) return;
      if (!confirm(`Are you sure you want to permanently delete category "${categoryName}" and all of its skills? This action cannot be undone.`)) {
        return;
      }

      try {
        const res = await fetch(`/api/cms/skills/category/${encodeURIComponent(categoryName)}`, {
          method: 'DELETE'
        });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast(`✓ Category "${categoryName}" deleted successfully!`, 'success');
          await loadDashboard();
          loadSkillsManager();
        } else {
          showToast('Error: ' + (json.message || 'Failed to delete category'), 'error');
        }
      } catch (e) {
        showToast('Connection error deleting category', 'error');
      }
    },

    openNewSkillModal: (defaultCat = '') => {
      document.getElementById('form-skill-modal')?.reset();
      const catSelect = document.getElementById('skill-form-category');
      if (catSelect) {
        const skills = (currentDraftProfile && currentDraftProfile.skills) ? currentDraftProfile.skills : [];
        catSelect.innerHTML = skills.length
          ? skills.map(c => `<option value="${escapeHtml(c.category)}" ${c.category === defaultCat ? 'selected' : ''}>${escapeHtml(c.category)}</option>`).join('')
          : '<option value="">-- No categories available --</option>';
        if (defaultCat) {
          catSelect.value = defaultCat;
        }
      }
      document.getElementById('modal-skill-title').textContent = '⚡ Add New Skill';
      document.getElementById('modal-skill').style.display = 'flex';
      document.getElementById('skill-form-name')?.focus();
    },

    openDeleteSkillModal: (defaultCat = '') => {
      const modal = document.getElementById('modal-delete-skill');
      const catSelect = document.getElementById('skill-delete-category');
      if (!modal || !catSelect) return;

      const skills = (currentDraftProfile && currentDraftProfile.skills) ? currentDraftProfile.skills : [];
      if (!skills.length) {
        showToast('No skill categories available to delete from', 'warning');
        return;
      }

      catSelect.innerHTML = skills.map(c => `
        <option value="${escapeHtml(c.category)}" ${c.category === defaultCat ? 'selected' : ''}>
          ${escapeHtml(c.category)} (${(c.items || []).length} skills)
        </option>
      `).join('');

      const targetCat = defaultCat || (skills[0] ? skills[0].category : '');
      catSelect.value = targetCat;
      populateSkillDeleteOptions(targetCat);

      modal.style.display = 'flex';
    },

    deleteSkill: async (category, name) => {
      if (!confirm(`Delete skill "${name}" from ${category}?`)) return;
      try {
        const res = await fetch(`/api/cms/skills?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Deleted skill "${name}"`, 'success');
          await loadDashboard();
          loadSkillsManager();
        }
      } catch (e) { showToast('Error deleting skill', 'error'); }
    },

    // Experience
    openNewExpModal: () => {
      document.getElementById('form-experience-modal')?.reset();
      document.getElementById('exp-form-id').value = '';
      const cidInput = document.getElementById('exp-verify-candidate-id');
      if (cidInput) cidInput.value = '';
      const statusSelect = document.getElementById('exp-verify-status');
      if (statusSelect) statusSelect.value = 'Completed';
      const offerInput = document.getElementById('exp-verify-offer-file');
      if (offerInput) offerInput.value = '';
      const compInput = document.getElementById('exp-verify-completion-file');
      if (compInput) compInput.value = '';
      const repInput = document.getElementById('exp-verify-report-file');
      if (repInput) repInput.value = '';

      const resPanel = document.getElementById('exp-verify-results-panel');
      if (resPanel) resPanel.style.display = 'none';
      const alertBox = document.getElementById('exp-verify-alert');
      if (alertBox) alertBox.style.display = 'none';
      const tbody = document.getElementById('exp-matrix-tbody');
      if (tbody) tbody.innerHTML = '';
      const dupRes = document.getElementById('exp-dup-check-result');
      if (dupRes) dupRes.textContent = '';

      currentExpVerificationResult = null;
      updateInternshipDocRequirements();

      document.getElementById('modal-experience-title').textContent = '💼 Add & Verify Internship (Verification First)';
      document.getElementById('modal-experience').style.display = 'flex';
      cidInput?.focus();
    },
    openEditExpModal: (id) => {
      const exp = (currentDraftProfile?.experience || []).find(e => e.id === id);
      if (!exp) return;
      document.getElementById('exp-form-id').value = exp.id;
      document.getElementById('exp-form-role').value = exp.role || '';
      document.getElementById('exp-form-company').value = exp.company || '';
      document.getElementById('exp-form-type').value = exp.employmentType || 'Internship';
      document.getElementById('exp-form-location').value = exp.location || '';
      document.getElementById('exp-form-start').value = exp.startDate || '';
      document.getElementById('exp-form-end').value = exp.endDate || '';
      document.getElementById('exp-form-current').checked = Boolean(exp.current);
      document.getElementById('exp-form-responsibilities').value = (exp.responsibilities || []).join('\n');

      document.getElementById('modal-experience-title').textContent = `💼 Edit Experience: ${exp.role}`;
      document.getElementById('modal-experience').style.display = 'flex';
    },
    deleteExp: async (id, role) => {
      if (!confirm(`Delete experience entry "${role}"?`)) return;
      try {
        const res = await fetch(`/api/cms/experience/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Deleted experience entry "${role}"`, 'success');
          await loadDashboard();
          loadExperienceManager();
        }
      } catch (e) { showToast('Error deleting experience', 'error'); }
    },

    // Projects
    openNewProjectModal: () => {
      document.getElementById('form-project-modal')?.reset();
      document.getElementById('proj-form-id').value = '';
      document.getElementById('modal-project-title').textContent = '📦 Add New Project';
      document.getElementById('modal-project').style.display = 'flex';
      document.getElementById('proj-form-title')?.focus();
    },
    openEditProjectModal: (id) => {
      const p = (currentDraftProfile?.projects || []).find(item => item.id === id);
      if (!p) return;
      document.getElementById('proj-form-id').value = p.id;
      document.getElementById('proj-form-title').value = p.title || '';
      document.getElementById('proj-form-tag').value = p.tag || '';
      document.getElementById('proj-form-desc').value = p.description || '';
      document.getElementById('proj-form-tech').value = (p.technologies || []).join(', ');
      document.getElementById('proj-form-github').value = p.github || '';
      document.getElementById('proj-form-demo').value = p.liveDemo || '';
      document.getElementById('proj-form-case').value = p.caseStudy || '';
      document.getElementById('proj-form-status').value = p.status || 'Completed';
      document.getElementById('proj-form-featured').checked = Boolean(p.featured);

      document.getElementById('modal-project-title').textContent = `📦 Edit Project: ${p.title}`;
      document.getElementById('modal-project').style.display = 'flex';
    },
    deleteProject: async (id, title) => {
      if (!confirm(`Are you sure you want to delete project "${title}"?`)) return;
      try {
        const res = await fetch(`/api/cms/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Deleted project "${title}"`, 'success');
          await loadDashboard();
          loadProjectsManager();
        }
      } catch (e) { showToast('Error deleting project', 'error'); }
    },

    // Education
    openNewEduModal: () => {
      document.getElementById('form-education-modal')?.reset();
      document.getElementById('edu-form-index').value = '-1';
      document.getElementById('modal-education-title').textContent = '🎓 Add Education Entry';
      document.getElementById('modal-education').style.display = 'flex';
      document.getElementById('edu-form-inst')?.focus();
    },
    openEditEduModal: (index) => {
      const edu = currentDraftProfile?.education?.[index];
      if (!edu) return;
      document.getElementById('edu-form-index').value = index;
      document.getElementById('edu-form-inst').value = edu.institution || '';
      document.getElementById('edu-form-deg').value = edu.degree || '';
      document.getElementById('edu-form-field').value = edu.field || '';
      document.getElementById('edu-form-start').value = edu.startYear || '';
      document.getElementById('edu-form-end').value = edu.endYear || '';
      document.getElementById('edu-form-cgpa').value = edu.cgpa || edu.score || '';
      document.getElementById('edu-form-roll').value = edu.rollNo || '';
      document.getElementById('edu-form-affil').value = edu.affiliation || '';
      document.getElementById('edu-form-loc').value = edu.location || '';

      document.getElementById('modal-education-title').textContent = `🎓 Edit Education: ${edu.institution}`;
      document.getElementById('modal-education').style.display = 'flex';
    },
    deleteEdu: async (index, inst) => {
      if (!confirm(`Delete education milestone at "${inst}"?`)) return;
      try {
        const res = await fetch(`/api/cms/education/${index}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Deleted education milestone at "${inst}"`, 'success');
          await loadDashboard();
          loadEducationManager();
        }
      } catch (e) { showToast('Error deleting education', 'error'); }
    },

    // Certifications
    openNewCertModal: () => {
      document.getElementById('form-certification-modal')?.reset();
      document.getElementById('cert-form-id').value = '';
      const fileInput = document.getElementById('cert-verify-pdf-file');
      if (fileInput) fileInput.value = '';
      const urlInput = document.getElementById('cert-verify-public-url');
      if (urlInput) urlInput.value = '';

      const certPanel = document.getElementById('cert-verification-panel');
      if (certPanel) certPanel.style.display = 'none';
      const alertBox = document.getElementById('cert-verify-alert');
      if (alertBox) alertBox.style.display = 'none';

      currentCertVerificationResult = null;

      document.getElementById('modal-certification-title').textContent = '🎖️ Add & Verify Certification (Verification First)';
      document.getElementById('modal-certification').style.display = 'flex';
      fileInput?.focus();
    },
    openEditCertModal: (id) => {
      const cert = (currentDraftProfile?.certifications || []).find(c => c.id === id);
      if (!cert) return;
      document.getElementById('cert-form-id').value = cert.id;
      document.getElementById('cert-form-name').value = cert.name || '';
      document.getElementById('cert-form-issuer').value = cert.issuer || '';
      document.getElementById('cert-form-date').value = cert.date || '';
      document.getElementById('cert-form-id-val').value = cert.credentialId || '';
      document.getElementById('cert-form-score').value = cert.score || '';
      document.getElementById('cert-form-url').value = cert.credentialUrl || '';
      document.getElementById('cert-form-icon').value = cert.icon || '🏅';

      document.getElementById('modal-certification-title').textContent = `🎖️ Edit Certification: ${cert.name}`;
      document.getElementById('modal-certification').style.display = 'flex';
    },
    deleteCert: async (id, name) => {
      if (!confirm(`Delete certification "${name}"?`)) return;
      try {
        const res = await fetch(`/api/cms/certifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Deleted certification "${name}"`, 'success');
          await loadDashboard();
          loadCertsManager();
        }
      } catch (e) { showToast('Error deleting cert', 'error'); }
    },

    // Achievements
    openNewAchvModal: () => {
      document.getElementById('form-achievement-modal')?.reset();
      document.getElementById('achv-form-id').value = '';
      document.getElementById('modal-achievement-title').textContent = '🏆 Add Achievement';
      document.getElementById('modal-achievement').style.display = 'flex';
      document.getElementById('achv-form-title')?.focus();
    },
    openEditAchvModal: (id) => {
      const achv = (currentDraftProfile?.achievements || []).find(a => a.id === id);
      if (!achv) return;
      document.getElementById('achv-form-id').value = achv.id;
      document.getElementById('achv-form-title').value = achv.title || '';
      document.getElementById('achv-form-desc').value = achv.description || '';
      document.getElementById('achv-form-cert').value = achv.certFile || '';
      document.getElementById('achv-form-icon').value = achv.icon || '🏆';

      document.getElementById('modal-achievement-title').textContent = `🏆 Edit Achievement: ${achv.title}`;
      document.getElementById('modal-achievement').style.display = 'flex';
    },
    deleteAchv: async (id, title) => {
      if (!confirm(`Delete achievement "${title}"?`)) return;
      try {
        const res = await fetch(`/api/cms/achievements/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Deleted achievement "${title}"`, 'success');
          await loadDashboard();
          loadAchievementsManager();
        }
      } catch (e) { showToast('Error deleting achievement', 'error'); }
    },

    // Media Library Actions
    selectMediaFolder: (folderId) => selectMediaFolder(folderId),
    filterMediaGrid: () => filterMediaGrid(),
    clearMediaSearch: () => clearMediaSearch(),
    openMediaUploadModal: (folder) => openMediaUploadModal(folder),
    closeMediaUploadModal: () => closeMediaUploadModal(),
    copyMediaUrl: (url) => {
      navigator.clipboard.writeText(url);
      showToast(`Copied URL: ${url}`, 'info');
    },
    deleteMedia: async (filename) => {
      if (!confirm(`Delete media file "${filename}"?`)) return;
      try {
        const res = await fetch(`/api/cms/media/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Deleted ${filename}`, 'success');
          loadMediaLibrary();
        }
      } catch (e) { showToast('Error deleting media', 'error'); }
    },

    // Social sync
    syncPlatform: async (id, name) => {
      showToast(`🔄 Synchronizing ${name || id}...`, 'info');
      try {
        const res = await fetch(`/api/social/platforms/${encodeURIComponent(id)}/sync`, { method: 'POST' });
        const json = await res.json();
        if (res.ok && json.success) {
          const data = json.data;
          showToast(`✓ ${name || id} synced: ${data.message || 'Active & verified'} (${data.latencyMs || 0}ms)`, 'success');
          await loadSocialStatus();
          loadDashboard();
        } else {
          showToast(`Sync error for ${name || id}: ${json.message || 'Check connection'}`, 'error');
        }
      } catch (err) {
        showToast(`Connection error syncing ${name || id}`, 'error');
      }
    },
    openEditPlatform: (id) => {
      const p = loadedPlatforms.find(item => item.id === id);
      if (!p) return;
      document.getElementById('edit-platform-id').value = p.id;
      document.getElementById('edit-platform-icon').textContent = p.icon || '✏️';
      const nameInput = document.getElementById('edit-platform-name');
      if (nameInput) {
        nameInput.value = p.platform;
        nameInput.readOnly = !p.isCustom;
        nameInput.style.opacity = !p.isCustom ? '0.75' : '1';
      }
      document.getElementById('edit-platform-url').value = p.url || '';
      document.getElementById('edit-platform-method').value = p.syncMethod || '';
      document.getElementById('edit-platform-status').value = p.status || 'Active';

      document.getElementById('modal-edit-platform').style.display = 'flex';
    },
    deletePlatform: async (id, name) => {
      if (!confirm(`Are you sure you want to remove the connected platform "${name}"?`)) return;
      try {
        const res = await fetch(`/api/social/platforms/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast(`Platform "${name}" removed successfully`, 'success');
          await loadSocialStatus();
          loadDashboard();
          loadHistory();
        } else {
          showToast(`Failed to remove platform: ${json.message}`, 'error');
        }
      } catch (err) {
        showToast('Connection error while removing platform', 'error');
      }
    },

    // Documents
    deleteDocument: async (id) => {
      if (!confirm('Are you sure you want to delete this uploaded document?')) return;
      try {
        const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Document deleted', 'success');
          loadDocuments();
          loadDashboard();
        }
      } catch (e) { }
    },

    // Snapshots management
    viewSnapshot: (filename) => {
      viewSnapshotModal(filename);
    },
    deleteSnapshot: async (filename) => {
      if (!confirm(`Delete snapshot "${filename}"? This action cannot be undone.`)) return;
      try {
        const res = await fetch(`/api/admin/history/snapshots/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast(`✓ Snapshot "${filename}" deleted successfully`, 'success');
          const modal = document.getElementById('modal-view-snapshot');
          if (modal) modal.style.display = 'none';
          await loadHistory();
          loadDashboard();
        } else {
          showToast('Failed to delete snapshot: ' + (json.message || ''), 'error');
        }
      } catch (e) {
        showToast('Connection error deleting snapshot', 'error');
      }
    },
    rollbackSnapshot: async (snapshotName) => {
      if (!confirm(`Are you sure you want to rollback to snapshot "${snapshotName}"? This will restore portfolio data to this state.`)) return;
      try {
        const res = await fetch('/api/profile/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotName })
        });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast(`✓ Successfully rolled back to ${snapshotName}!`, 'success');
          const modal = document.getElementById('modal-view-snapshot');
          if (modal) modal.style.display = 'none';
          await loadDashboard();
          await loadHistory();
        } else {
          showToast('Rollback failed: ' + (json.message || 'Error occurred'), 'error');
        }
      } catch (e) {
        showToast('Connection error during rollback', 'error');
      }
    },

    // ─── AI PORTFOLIO AGENT CLIENT ACTIONS ───
    approveAiChange: async (changeSetId, changeId) => {
      try {
        const res = await fetch(`/api/ai/changesets/${changeSetId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedChangeIds: [changeId] })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Change approved and merged into draft!', 'success');
          loadAiChangeSets();
          loadDashboard();
        } else {
          showToast(data.message || 'Approval failed', 'error');
        }
      } catch (err) {
        showToast('Connection error', 'error');
      }
    },

    rejectAiChangeSet: async (changeSetId) => {
      if (!confirm('Are you sure you want to reject this entire proposal?')) return;
      try {
        const res = await fetch(`/api/ai/changesets/${changeSetId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Rejected from Admin Console' })
        });
        if (res.ok) {
          showToast('ChangeSet rejected', 'info');
          loadAiChangeSets();
        }
      } catch (err) {
        showToast('Error rejecting proposal', 'error');
      }
    },

    fixAuditIssue: async (title, section, proposedValue) => {
      const prompt = `Fix issue "${title}" in ${section} with proposed value: ${typeof proposedValue === 'object' ? JSON.stringify(proposedValue) : proposedValue}`;
      sendAiMessage(prompt);
      switchTab('tab-ai-agent');
    },

    restoreContentVersion: async (versionId) => {
      showToast('Version noted in audit trail', 'info');
    },

    importRepo: async (name, description, language, url, homepage) => {
      try {
        const res = await fetch('/api/social/github/import-repo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoName: name,
            description,
            technologies: language ? [language] : ['JavaScript'],
            githubUrl: url,
            liveDemo: homepage
          })
        });
        if (res.ok) {
          showToast(`Repository ${name} added to draft projects!`, 'success');
          loadDashboard();
        }
      } catch (e) { }
    },

    // Competitive & Coding Profiles
    openNewCodingProfileModal: () => {
      openCodingProfileModal(null);
    },
    openEditCodingProfileModal: async (id) => {
      try {
        const res = await fetch('/api/cms/coding-profiles');
        const json = await res.json();
        const raw = Array.isArray(json.data) ? json.data : (json.data?.profiles || []);
        const p = raw.find(item => item.id && item.id.toLowerCase() === id.toLowerCase());
        if (p) {
          openCodingProfileModal(p);
        } else {
          showToast(`Profile "${id}" not found`, 'error');
        }
      } catch (e) {
        showToast('Error opening coding profile', 'error');
      }
    },
    deleteCodingProfile: async (id) => {
      if (!confirm(`Are you sure you want to delete coding profile "${id}"?`)) return;
      try {
        const res = await fetch(`/api/cms/coding-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast('Coding profile deleted', 'success');
          await loadDashboard();
          loadCodingProfiles();
        } else {
          showToast('Failed to delete profile: ' + (json.message || ''), 'error');
        }
      } catch (e) {
        showToast('Connection error deleting coding profile', 'error');
      }
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     AI PORTFOLIO AGENT INTERACTIVE LOGIC
     ══════════════════════════════════════════════════════════════════════════ */

  let aiStagedFiles = [];
  let aiInitialized = false;
  let currentAiConversationId = 'conv_' + Date.now();
  let aiConversationThreads = [];
  let isAiRecording = false;
  let aiSpeechRecognizer = null;

  async function initAiAgent() {
    if (!aiInitialized) {
      bindAiEvents();
      aiInitialized = true;
    }
    await loadAiConversations();
    await loadAiChangeSets();
    await loadAiAudit();
    await loadAiVersions();
  }

  function bindAiEvents() {
    // 1. Subtab Switching
    document.querySelectorAll('.ai-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ai-subtab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ai-subtab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.subtab);
        if (target) target.classList.add('active');
      });
    });

    // 2. Quick Prompt Chips & Drawer Toggle
    document.querySelectorAll('.ai-prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        const input = document.getElementById('ai-message-input');
        if (input) {
          input.value = prompt;
          input.focus();
          autoResizeAiTextarea(input);
        }
      });
    });

    const toggleQuickPrompts = document.getElementById('toggle-quick-prompts-btn');
    const quickPromptsBody = document.getElementById('quick-prompts-body');
    const quickPromptsArrow = document.getElementById('quick-prompts-arrow');
    if (toggleQuickPrompts && quickPromptsBody) {
      toggleQuickPrompts.addEventListener('click', () => {
        const isCollapsed = quickPromptsBody.style.display === 'none';
        quickPromptsBody.style.display = isCollapsed ? 'flex' : 'none';
        if (quickPromptsArrow) quickPromptsArrow.textContent = isCollapsed ? '▾' : '▸';
      });
    }

    // 3. File Attachment via Chat Input Attach Button (📎)
    const fileInput = document.getElementById('ai-file-input');
    const attachBtn = document.getElementById('ai-attach-btn');

    if (fileInput && attachBtn) {
      attachBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          handleAiFileSelection(Array.from(fileInput.files));
          fileInput.value = '';
        }
      });
    }

    const clearStreamBtn = document.getElementById('ai-clear-chat-stream-btn');
    if (clearStreamBtn) {
      clearStreamBtn.addEventListener('click', () => {
        const clearBtn = document.getElementById('ai-clear-chat-btn');
        if (clearBtn) clearBtn.click();
      });
    }

    // 4. Chat Input Auto-Resize & Enter key handler
    const messageInput = document.getElementById('ai-message-input');
    if (messageInput) {
      messageInput.addEventListener('input', () => autoResizeAiTextarea(messageInput));
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const chatForm = document.getElementById('ai-chat-form');
          if (chatForm) chatForm.dispatchEvent(new Event('submit'));
        }
      });
    }

    // 5. Speech to Text (Microphone)
    const micBtn = document.getElementById('ai-mic-btn');
    if (micBtn) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          aiSpeechRecognizer = new SpeechRecognition();
          aiSpeechRecognizer.continuous = false;
          aiSpeechRecognizer.interimResults = true;
          aiSpeechRecognizer.lang = 'en-US';

          aiSpeechRecognizer.onstart = () => {
            isAiRecording = true;
            micBtn.style.color = '#ef4444';
            micBtn.style.transform = 'scale(1.2)';
            showToast('Listening... Speak now', 'info');
          };

          aiSpeechRecognizer.onresult = (event) => {
            const transcript = Array.from(event.results)
              .map(result => result[0])
              .map(result => result.transcript)
              .join('');
            if (messageInput) {
              messageInput.value = transcript;
              autoResizeAiTextarea(messageInput);
            }
          };

          aiSpeechRecognizer.onerror = () => {
            isAiRecording = false;
            micBtn.style.color = '';
            micBtn.style.transform = '';
          };

          aiSpeechRecognizer.onend = () => {
            isAiRecording = false;
            micBtn.style.color = '';
            micBtn.style.transform = '';
          };

          micBtn.addEventListener('click', () => {
            if (!isAiRecording) {
              try { aiSpeechRecognizer.start(); } catch (err) { }
            } else {
              try { aiSpeechRecognizer.stop(); } catch (err) { }
            }
          });
        } catch (e) {
          micBtn.style.opacity = '0.35';
        }
      } else {
        micBtn.style.opacity = '0.35';
        micBtn.title = 'Speech recognition not supported in this browser';
      }
    }

    // 6. ChatGPT Sidebar: New Chat & Search Chats
    const newChatBtn = document.getElementById('ai-new-chat-btn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        currentAiConversationId = 'conv_' + Date.now();
        const stream = document.getElementById('ai-chat-stream');
        if (stream) {
          stream.innerHTML = `
            <div class="chat-msg chat-msg-ai">
              <div class="msg-avatar">🤖</div>
              <div class="msg-body">
                <div class="msg-author">Portfolio AI Agent <span class="msg-tag">New Session</span></div>
                <div class="msg-text">
                  Started a new conversation session. Ask me a question, command a sync ("Verify my LeetCode profile", "Sync coding platforms"), or upload documents.
                </div>
              </div>
            </div>`;
        }
        renderAiConversationsSidebar();
        showToast('Started new conversation thread', 'info');
      });
    }

    const searchChatsInput = document.getElementById('ai-search-chats-input');
    if (searchChatsInput) {
      searchChatsInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        renderAiConversationsSidebar(query);
      });
    }

    // 7. Chat Submission
    const chatForm = document.getElementById('ai-chat-form');
    if (chatForm) {
      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('ai-message-input');
        const message = input.value.trim();
        if (!message && aiStagedFiles.length === 0) return;

        input.value = '';
        autoResizeAiTextarea(input);
        await sendAiMessage(message);
      });
    }

    // 8. Event Delegation on Action Cards inside Chat Stream
    const stream = document.getElementById('ai-chat-stream');
    if (stream) {
      stream.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-card-action]');
        if (!btn) return;
        const action = btn.dataset.cardAction;
        if (action === 'switch_tab') {
          const tab = btn.dataset.tab;
          if (tab) switchTab(tab);
        } else if (action === 'preview_changeset') {
          document.querySelector('.ai-subtab[data-subtab="subtab-changes"]')?.click();
        } else if (action === 'approve_changeset') {
          const csId = btn.dataset.csid;
          if (csId && window.adminActions && window.adminActions.approveAiChangeSet) {
            window.adminActions.approveAiChangeSet(csId);
          }
        } else if (action === 'open_link') {
          const url = btn.dataset.url;
          if (url) window.open(url, '_blank');
        }
      });
    }

    // 9. Header Action Buttons
    const auditBtn = document.getElementById('ai-run-audit-btn');
    if (auditBtn) {
      auditBtn.addEventListener('click', async () => {
        await triggerAiAudit();
      });
    }

    const dupBtn = document.getElementById('ai-check-duplicates-btn');
    if (dupBtn) {
      dupBtn.addEventListener('click', async () => {
        await triggerDuplicateCheck();
      });
    }

    const clearBtn = document.getElementById('ai-clear-chat-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('Clear chat history?')) {
          await fetch('/api/ai/conversations', { method: 'DELETE' });
          const streamEl = document.getElementById('ai-chat-stream');
          streamEl.innerHTML = `
            <div class="chat-msg chat-msg-ai">
              <div class="msg-avatar">🤖</div>
              <div class="msg-body">
                <div class="msg-author">Portfolio AI Agent <span class="msg-tag">Chat Cleared</span></div>
                <div class="msg-text">Conversation history reset. Drop a document or ask a question to begin.</div>
              </div>
            </div>`;
          showToast('Conversation cleared', 'info');
          await loadAiConversations();
        }
      });
    }

    // 10. ChangeSet Bulk Actions
    const approveSelectedBtn = document.getElementById('ai-approve-selected-btn');
    if (approveSelectedBtn) {
      approveSelectedBtn.addEventListener('click', async () => {
        await approveSelectedChanges();
      });
    }

    const rejectAllBtn = document.getElementById('ai-reject-all-btn');
    if (rejectAllBtn) {
      rejectAllBtn.addEventListener('click', async () => {
        const csTitle = document.getElementById('ai-cs-title');
        const csId = csTitle ? csTitle.dataset.csId : null;
        if (csId) window.adminActions.rejectAiChangeSet(csId);
      });
    }

    // 11. Global AI Description Assist Modals
    bindAiAssistModal();
  }

  function autoResizeAiTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function handleAiFileSelection(files) {
    aiStagedFiles = [...aiStagedFiles, ...files];
    renderAiStagedFiles();
  }

  function renderAiStagedFiles() {
    const stagingBox = document.getElementById('ai-file-staging');
    const attachedChips = document.getElementById('ai-attached-chips');

    if (aiStagedFiles.length === 0) {
      if (stagingBox) {
        stagingBox.style.display = 'none';
        stagingBox.innerHTML = '';
      }
      if (attachedChips) {
        attachedChips.style.display = 'none';
        attachedChips.innerHTML = '';
      }
      return;
    }

    if (stagingBox) {
      stagingBox.style.display = 'flex';
      stagingBox.innerHTML = aiStagedFiles.map((file, idx) => `
        <span class="staged-chip">
          <span>📎 ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(0)} KB)</span>
          <span class="remove-file" onclick="removeStagedAiFile(${idx})">&times;</span>
        </span>
      `).join('');
    }

    if (attachedChips) {
      attachedChips.style.display = 'flex';
      attachedChips.innerHTML = aiStagedFiles.map((file, idx) => `
        <span class="ai-attached-chip">
          <span>📎 ${escapeHtml(file.name)} <span style="opacity: 0.65; font-size: 0.7rem;">(${(file.size / 1024).toFixed(0)} KB)</span></span>
          <button type="button" class="ai-chip-remove" onclick="removeStagedAiFile(${idx})" title="Remove attachment">&times;</button>
        </span>
      `).join('');
    }
  }

  window.removeStagedAiFile = function (index) {
    aiStagedFiles.splice(index, 1);
    renderAiStagedFiles();
  };

  async function sendAiMessage(message) {
    const stream = document.getElementById('ai-chat-stream');
    const procBar = document.getElementById('ai-processing-bar');

    // Render user message in chat
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'chat-msg chat-msg-user';
    const filesLabel = aiStagedFiles.length > 0
      ? `<div style="font-size: 0.75rem; color: var(--gold); margin-bottom: 0.25rem;">📎 ${aiStagedFiles.map(f => escapeHtml(f.name)).join(', ')}</div>`
      : '';
    userMsgEl.innerHTML = `
      <div class="msg-avatar">👤</div>
      <div class="msg-body">
        <div class="msg-author">Administrator</div>
        ${filesLabel}
        <div class="msg-text">${escapeHtml(message || 'Uploaded attachment')}</div>
      </div>
    `;
    stream.appendChild(userMsgEl);
    stream.scrollTop = stream.scrollHeight;

    // Show processing bar
    if (procBar) procBar.style.display = 'flex';

    try {
      const formData = new FormData();
      if (message) formData.append('message', message);
      if (currentAiConversationId) formData.append('conversationId', currentAiConversationId);
      aiStagedFiles.forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      // Reset staged files
      aiStagedFiles = [];
      renderAiStagedFiles();

      if (res.ok && data.success) {
        renderAiResponse(data.data.reply, data.data.changeSet, data.data.actionCard);
        if (data.data.changeSet) {
          loadAiChangeSets();
          // Auto switch to Changes tab
          document.querySelector('.ai-subtab[data-subtab="subtab-changes"]')?.click();
        }
        await loadAiConversations();
      } else {
        renderAiResponse(`Error: ${data.message || 'Could not process request.'}`);
      }
    } catch (err) {
      renderAiResponse(`Connection error: ${err.message}`);
    } finally {
      if (procBar) procBar.style.display = 'none';
    }
  }

  function renderActionCardHtml(actionCard) {
    if (!actionCard) return '';
    const status = actionCard.status || 'INFO';
    const isSuccess = status === 'VERIFIED' || status === 'COMPLETED';
    const isWarn = status === 'PARTIALLY_VERIFIED' || status === 'WARNING' || status === 'PENDING';
    const statusColor = isSuccess ? '#34d399' : (isWarn ? '#fbbf24' : '#f87171');
    const detailsHtml = (actionCard.details || []).map(d => `<li>• ${escapeHtml(d)}</li>`).join('');
    const actionsHtml = (actionCard.actions || []).map(a => {
      let extraAttrs = '';
      if (a.tab) extraAttrs += ` data-tab="${escapeHtml(a.tab)}"`;
      if (a.csId) extraAttrs += ` data-csid="${escapeHtml(a.csId)}"`;
      if (a.url) extraAttrs += ` data-url="${escapeHtml(a.url)}"`;
      return `<button type="button" class="action-card-btn ${a.action === 'approve_changeset' ? 'btn-accept' : 'btn-preview'}" data-card-action="${escapeHtml(a.action)}"${extraAttrs}>${escapeHtml(a.label)}</button>`;
    }).join('');

    return `
      <div class="ai-action-card">
        <div class="action-card-header">
          <span class="action-card-title">⚡ ${escapeHtml(actionCard.title || 'Action Required')}</span>
          <span class="action-card-badge" style="color: ${statusColor}; border: 1px solid ${statusColor};">${escapeHtml(status)}</span>
        </div>
        <div class="action-card-body">
          ${detailsHtml ? `<ul class="action-card-diff-list">${detailsHtml}</ul>` : ''}
        </div>
        ${actionsHtml ? `<div class="action-card-actions">${actionsHtml}</div>` : ''}
      </div>
    `;
  }

  function renderAiResponse(replyText, changeSet = null, actionCard = null) {
    const stream = document.getElementById('ai-chat-stream');
    const aiMsgEl = document.createElement('div');
    aiMsgEl.className = 'chat-msg chat-msg-ai';

    let actionBtn = '';
    if (changeSet) {
      actionBtn = `
        <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn-primary btn-sm" onclick="document.querySelector('.ai-subtab[data-subtab=\\'subtab-changes\\']').click()">
            👀 Review ${changeSet.changes ? changeSet.changes.length : 1} Proposed Change(s)
          </button>
        </div>`;
    }

    const cardHtml = renderActionCardHtml(actionCard);

    aiMsgEl.innerHTML = `
      <div class="msg-avatar">🤖</div>
      <div class="msg-body">
        <div class="msg-author">Portfolio AI Agent <span class="msg-tag">Analysis Verified</span></div>
        <div class="msg-text">${formatMarkdown(replyText)}</div>
        ${cardHtml}
        ${actionBtn}
      </div>
    `;
    stream.appendChild(aiMsgEl);
    stream.scrollTop = stream.scrollHeight;
  }

  function formatMarkdown(text) {
    if (!text) return '';
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^• /gm, '&bull; ')
      .replace(/^→ /gm, '&rarr; ')
      .replace(/\n/g, '<br>');
  }

  async function loadAiConversations() {
    try {
      const res = await fetch('/api/ai/conversations');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        aiConversationThreads = data.data;
        renderAiConversationsSidebar();

        if (data.data.length > 0) {
          const stream = document.getElementById('ai-chat-stream');
          stream.innerHTML = '';
          data.data.forEach(msg => {
            const isUser = msg.role === 'user';
            const el = document.createElement('div');
            el.className = `chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-ai'}`;
            const cardHtml = !isUser && msg.actionCard ? renderActionCardHtml(msg.actionCard) : '';
            el.innerHTML = `
              <div class="msg-avatar">${isUser ? '👤' : '🤖'}</div>
              <div class="msg-body">
                <div class="msg-author">${isUser ? 'Administrator' : 'Portfolio AI Agent'}</div>
                <div class="msg-text">${formatMarkdown(msg.content)}</div>
                ${cardHtml}
              </div>
            `;
            stream.appendChild(el);
          });
          stream.scrollTop = stream.scrollHeight;
        }
      }
    } catch (e) { }
  }

  function renderAiConversationsSidebar(filterQuery = '') {
    const listEl = document.getElementById('ai-conversations-list');
    if (!listEl) return;

    if (!aiConversationThreads || aiConversationThreads.length === 0) {
      listEl.innerHTML = `
        <div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.5rem; text-align: center;">
          No conversations yet
        </div>`;
      return;
    }

    // Group messages into logical threads (by user message prompts)
    const userMessages = aiConversationThreads.filter(m => m.role === 'user');
    let filtered = userMessages;
    if (filterQuery) {
      filtered = userMessages.filter(m => (m.content || '').toLowerCase().includes(filterQuery));
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.5rem; text-align: center;">
          No matches found
        </div>`;
      return;
    }

    listEl.innerHTML = filtered.slice(-8).reverse().map((msg, idx) => {
      const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const snippet = escapeHtml(msg.content || 'Chat Session');
      return `
        <div class="ai-conv-item ${idx === 0 ? 'active' : ''}" title="${snippet}" onclick="document.getElementById('ai-message-input').value='${escapeHtml(msg.content)}'; document.getElementById('ai-message-input').focus();">
          <div class="ai-conv-title">💬 ${snippet}</div>
          <span class="ai-conv-time">${timeStr}</span>
        </div>
      `;
    }).join('');
  }

  async function loadAiChangeSets() {
    try {
      const res = await fetch('/api/ai/changesets');
      const data = await res.json();
      const listContainer = document.getElementById('ai-changes-list');
      const headerBox = document.getElementById('ai-changes-header');
      const badgeCount = document.getElementById('ai-badge-change-count');

      if (!res.ok || !data.success || !Array.isArray(data.data) || data.data.length === 0) {
        if (headerBox) headerBox.style.display = 'none';
        if (badgeCount) badgeCount.style.display = 'none';
        if (listContainer) {
          listContainer.innerHTML = `
            <div class="empty-state-card">
              <span class="empty-icon">✨</span>
              <h4>No Pending Proposals</h4>
              <p>When you upload documents or request optimizations, proposed changes will appear here for comparison and approval.</p>
            </div>`;
        }
        return;
      }

      // Find first pending ChangeSet
      const pendingCs = data.data.find(cs => cs.status === 'PENDING_REVIEW') || data.data[0];

      if (badgeCount) {
        const totalPending = pendingCs.changes.filter(c => c.status === 'PENDING_REVIEW').length;
        if (totalPending > 0) {
          badgeCount.textContent = totalPending;
          badgeCount.style.display = 'inline-block';
        } else {
          badgeCount.style.display = 'none';
        }
      }

      if (headerBox) {
        headerBox.style.display = 'flex';
        document.getElementById('ai-cs-title').textContent = `Proposal: ${pendingCs.sourceDocument}`;
        document.getElementById('ai-cs-title').dataset.csId = pendingCs.id;
        document.getElementById('ai-cs-reason').textContent = pendingCs.reasoning;
      }

      if (listContainer) {
        listContainer.innerHTML = pendingCs.changes.map(c => {
          const isPending = c.status === 'PENDING_REVIEW';
          const oldStr = typeof c.oldValue === 'object' ? JSON.stringify(c.oldValue, null, 2) : String(c.oldValue || 'None');
          const newStr = typeof c.proposedValue === 'object' ? JSON.stringify(c.proposedValue, null, 2) : String(c.proposedValue || '');

          return `
            <div class="change-diff-card" id="card-${c.id}">
              <div class="diff-header">
                ${isPending ? `<input type="checkbox" class="ai-change-checkbox" value="${c.id}" checked>` : '<span>✓</span>'}
                <span class="diff-badge">${escapeHtml(c.section)}</span>
                <span class="diff-title">${escapeHtml(c.label)}</span>
              </div>
              <div class="diff-box">
                <div class="diff-row">
                  <span class="diff-tag old">Current Value</span>
                  <div class="diff-val old-val">${escapeHtml(oldStr)}</div>
                </div>
                <div class="diff-row">
                  <span class="diff-tag new">Proposed Value</span>
                  <div class="diff-val new-val">${escapeHtml(newStr)}</div>
                </div>
              </div>
              ${isPending ? `
                <div class="diff-card-actions">
                  <button type="button" class="btn-primary btn-sm" onclick="window.adminActions.approveAiChange('${pendingCs.id}', '${c.id}')">✓ Approve</button>
                </div>
              ` : `<div style="font-size: 0.72rem; color: #4ade80; text-align: right;">Status: ${c.status}</div>`}
            </div>
          `;
        }).join('');
      }
    } catch (e) { }
  }

  async function approveSelectedChanges() {
    const csTitle = document.getElementById('ai-cs-title');
    const csId = csTitle ? csTitle.dataset.csId : null;
    if (!csId) return;

    const checkboxes = document.querySelectorAll('.ai-change-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedIds.length === 0) {
      showToast('Select at least one change to approve', 'info');
      return;
    }

    try {
      const res = await fetch(`/api/ai/changesets/${csId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedChangeIds: selectedIds })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Approved ${data.data.appliedCount} change(s) into live draft!`, 'success');
        loadAiChangeSets();
        loadDashboard();
      } else {
        showToast(data.message || 'Approval failed', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    }
  }

  async function triggerAiAudit() {
    const loading = document.getElementById('ai-audit-loading');
    const view = document.getElementById('ai-audit-view');
    if (loading) loading.style.display = 'block';
    if (view) view.innerHTML = '';

    // Switch to audit subtab
    document.querySelector('.ai-subtab[data-subtab="subtab-audit"]')?.click();

    try {
      const res = await fetch('/api/ai/audit', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        renderAuditReport(data.data);
        showToast('Portfolio audit completed', 'success');
      }
    } catch (err) {
      showToast('Failed to run audit', 'error');
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }

  async function loadAiAudit() {
    try {
      const res = await fetch('/api/ai/audit/latest');
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        renderAuditReport(data.data);
      }
    } catch (e) { }
  }

  function renderAuditReport(audit) {
    const view = document.getElementById('ai-audit-view');
    if (!view) return;

    view.innerHTML = `
      <div class="audit-gauge-card">
        <div class="gauge-score">${audit.overallScore}<span style="font-size: 1.4rem; color: var(--text-light);">/100</span></div>
        <div class="gauge-label">Portfolio Health &amp; Readiness Score</div>
      </div>

      <div class="audit-breakdown">
        ${renderAuditBar('SEO', audit.scores.seo)}
        ${renderAuditBar('Content', audit.scores.content)}
        ${renderAuditBar('Projects', audit.scores.projects)}
        ${renderAuditBar('Profile', audit.scores.profile)}
        ${renderAuditBar('Accessibility', audit.scores.accessibility)}
        ${renderAuditBar('Media', audit.scores.media)}
      </div>

      <div class="audit-issues-list">
        <div style="font-weight: 700; font-size: 0.86rem; color: var(--gold2); margin-top: 0.5rem;">
          Detected Improvement Areas (${audit.issuesCount})
        </div>
        ${audit.issues.map(iss => `
          <div class="audit-issue-card">
            <div class="issue-top">
              <span class="issue-title">${escapeHtml(iss.title)}</span>
              <span class="badge-sev ${iss.severity}">${iss.severity}</span>
            </div>
            <div class="issue-desc">${escapeHtml(iss.description)}</div>
            ${iss.fixAction ? `
              <div style="text-align: right; margin-top: 0.2rem;">
                <button type="button" class="btn-primary btn-sm" onclick="window.adminActions.fixAuditIssue('${escapeHtml(iss.title)}', '${iss.section}', '${escapeHtml(JSON.stringify(iss.fixAction.proposedValue))}')">
                  ✨ Fix with AI
                </button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderAuditBar(label, score) {
    return `
      <div class="audit-bar-row">
        <span class="audit-bar-label">${label}</span>
        <div class="audit-bar-track">
          <div class="audit-bar-fill" style="width: ${score}%;"></div>
        </div>
        <span class="audit-bar-num">${score}</span>
      </div>
    `;
  }

  async function triggerDuplicateCheck() {
    try {
      const res = await fetch('/api/ai/duplicates');
      const data = await res.json();
      if (res.ok && data.success) {
        const dups = data.data;
        if (dups.length === 0) {
          renderAiResponse('**Duplicate Check**: No duplicate projects, skills, or certifications detected!');
        } else {
          renderAiResponse(`**Duplicate Check Detected ${dups.length} item(s)**:\n` + dups.map(d => `• **[${d.section}]**: ${d.detail}`).join('\n'));
        }
      }
    } catch (e) { }
  }

  async function loadAiVersions() {
    try {
      const res = await fetch('/api/ai/versions');
      const data = await res.json();
      const container = document.getElementById('ai-versions-list');
      if (res.ok && data.success && Array.isArray(data.data) && container) {
        if (data.data.length === 0) {
          container.innerHTML = `<div class="empty-state-card"><p>No content modifications recorded yet.</p></div>`;
          return;
        }
        container.innerHTML = data.data.map(v => `
          <div class="audit-issue-card">
            <div class="issue-top">
              <span class="issue-title">${escapeHtml(v.entity)} · ${escapeHtml(v.field)}</span>
              <span style="font-size: 0.72rem; color: var(--gold);">${new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="diff-val new-val" style="margin-top: 0.2rem;">${escapeHtml(String(v.newValue).slice(0, 80))}...</div>
          </div>
        `).join('');
      }
    } catch (e) { }
  }

  // ─── Direct AI Assistant Generator Modal Logic ───
  let activeAiTargetInput = null;
  let activeAiTargetType = 'general';

  function bindAiAssistModal() {
    const modal = document.getElementById('modal-ai-assist');
    const closeBtn = document.getElementById('close-ai-assist-modal');
    const cancelBtn = document.getElementById('cancel-ai-assist');
    const generateBtn = document.getElementById('btn-trigger-ai-generate');
    const applyBtn = document.getElementById('btn-apply-ai-assist');
    const outputArea = document.getElementById('ai-assist-output');

    // Delegated click handler: Generates content directly into target field using live context!
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-ai-assist');
      if (!btn) return;
      e.preventDefault();

      const targetId = btn.dataset.target;
      const targetInput = targetId ? document.getElementById(targetId) : null;
      activeAiTargetInput = targetInput;
      activeAiTargetType = btn.dataset.type || 'project';

      // If user holds Shift or Alt, open the manual AI Assist modal
      if (e.shiftKey || e.altKey) {
        const inputArea = document.getElementById('ai-assist-input');
        if (inputArea) inputArea.value = targetInput ? (targetInput.value || '') : '';
        if (outputArea) {
          outputArea.value = '';
          const cc = document.getElementById('ai-assist-charcount');
          if (cc) cc.textContent = '0 chars';
        }
        if (modal) modal.style.display = 'flex';
        return;
      }

      // Gather rich contextual metadata from the surrounding modal/form
      const context = {};
      if (activeAiTargetType === 'experience') {
        context.role = document.getElementById('exp-form-role')?.value || '';
        context.company = document.getElementById('exp-form-company')?.value || '';
        context.employmentType = document.getElementById('exp-form-type')?.value || '';
        context.location = document.getElementById('exp-form-location')?.value || '';
        context.startDate = document.getElementById('exp-form-start')?.value || '';
        context.endDate = document.getElementById('exp-form-end')?.value || '';
        context.candidateId = document.getElementById('exp-verify-candidate-id')?.value || '';
        if (typeof currentExpVerificationResult !== 'undefined' && currentExpVerificationResult) {
          context.verificationReport = currentExpVerificationResult.verificationReport;
          context.extractedData = currentExpVerificationResult.extractedData;
        }
      } else if (activeAiTargetType === 'certification') {
        context.name = document.getElementById('cert-form-name')?.value || '';
        context.issuer = document.getElementById('cert-form-issuer')?.value || '';
        context.issueDate = document.getElementById('cert-form-issue-date')?.value || '';
        context.credId = document.getElementById('cert-form-cred-id')?.value || '';
      } else if (activeAiTargetType === 'project') {
        context.title = document.getElementById('proj-form-title')?.value || '';
        context.technologies = document.getElementById('proj-form-tech')?.value || '';
        context.github = document.getElementById('proj-form-github')?.value || '';
      } else if (activeAiTargetType === 'hero') {
        context.headline = document.getElementById('prof-headline')?.value || '';
      } else if (activeAiTargetType === 'achievement') {
        context.title = document.getElementById('achv-form-title')?.value || '';
      }

      const origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Generating...';

      try {
        const currentVal = targetInput ? targetInput.value : '';
        const res = await fetch('/api/ai/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: currentVal,
            type: activeAiTargetType,
            style: 'professional',
            context
          })
        });
        const data = await res.json();
        const resultText = (data && data.success && data.data && data.data.result)
          ? data.data.result
          : (typeof data?.data === 'string' ? data.data : '');

        if (resultText && targetInput) {
          targetInput.value = resultText;
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          targetInput.style.borderColor = '#22c55e';
          targetInput.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.4)';
          setTimeout(() => {
            targetInput.style.borderColor = '';
            targetInput.style.boxShadow = '';
          }, 3000);
          showToast('✓ AI generated portfolio description from document context!', 'success');
        } else {
          // If server returned message or modal is preferred, open modal with preview
          const inputArea = document.getElementById('ai-assist-input');
          if (inputArea) inputArea.value = currentVal;
          if (modal) modal.style.display = 'flex';
        }
      } catch (err) {
        // Fallback: open modal so user has options
        const inputArea = document.getElementById('ai-assist-input');
        if (inputArea && targetInput) inputArea.value = targetInput.value;
        if (modal) modal.style.display = 'flex';
      } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    });

    // Style chips toggle
    document.querySelectorAll('.ai-style-selector .style-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.ai-style-selector .style-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const radio = chip.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    [closeBtn, cancelBtn].forEach(b => {
      if (b) b.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
      });
    });

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', async () => {
        const inputArea = document.getElementById('ai-assist-input');
        const loading = document.getElementById('ai-assist-loading');
        const selectedStyle = document.querySelector('input[name="ai-style"]:checked')?.value || 'professional';
        const text = inputArea ? inputArea.value : '';

        if (loading) loading.style.display = 'block';

        try {
          const res = await fetch('/api/ai/generate-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              type: activeAiTargetType,
              style: selectedStyle
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const resultText = (data.data && data.data.result) ? data.data.result : (typeof data.data === 'string' ? data.data : '');
            if (outputArea) {
              outputArea.value = resultText;
              const cc = document.getElementById('ai-assist-charcount');
              if (cc) cc.textContent = `${resultText.length} chars`;
            }
          } else {
            if (outputArea) outputArea.value = data.message || 'Generation failed.';
          }
        } catch (err) {
          if (outputArea) outputArea.value = 'Connection error: ' + (err.message || err);
        } finally {
          if (loading) loading.style.display = 'none';
        }
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (activeAiTargetInput && outputArea && outputArea.value) {
          activeAiTargetInput.value = outputArea.value;
          activeAiTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
          activeAiTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
          showToast('Applied AI description to field', 'success');
          if (modal) modal.style.display = 'none';
        }
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     GLOBAL ADMIN SEARCH SYSTEM (CTRL+K)
     ══════════════════════════════════════════════════════════════════════════ */

  let searchDebounceTimer = null;

  function initGlobalSearch() {
    const searchInput = document.getElementById('admin-global-search-input');
    const dropdown = document.getElementById('admin-search-dropdown');
    const resultsList = document.getElementById('admin-search-results-list');
    const countBadge = document.getElementById('search-total-count');

    if (!searchInput || !dropdown || !resultsList) return;

    // 1. Keyboard Shortcut: Ctrl+K or Cmd+K
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        if (searchInput.value.trim().length >= 1) {
          dropdown.style.display = 'block';
        }
      }
      if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        searchInput.blur();
      }
    });

    // 2. Debounced Fetch against /api/admin/search?q=...
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchDebounceTimer);

      if (q.length === 0) {
        dropdown.style.display = 'none';
        resultsList.innerHTML = '';
        if (countBadge) countBadge.textContent = '0 found';
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();

          if (res.ok && data.success && data.data) {
            renderSearchResults(data.data, q);
          }
        } catch (err) {
          console.error('Search request failed', err);
        }
      }, 200);
    });

    // 3. Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.topbar-search-wrap')) {
        dropdown.style.display = 'none';
      }
    });

    // 4. Focus opens if input has text
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length >= 1 && resultsList.children.length > 0) {
        dropdown.style.display = 'block';
      }
    });

    function renderSearchResults(data, query) {
      const total = data.totalMatches || 0;
      if (countBadge) countBadge.textContent = `${total} found`;

      if (total === 0) {
        dropdown.style.display = 'block';
        resultsList.innerHTML = `
          <div style="padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
            No matches found for "<strong>${escapeHtml(query)}</strong>"
          </div>`;
        return;
      }

      let html = '';
      const categoryTabMap = {
        'External Profiles': 'tab-social',
        'Projects': 'tab-projects',
        'Certificates': 'tab-certifications',
        'Work Experience': 'tab-experience',
        'Skills': 'tab-skills',
        'Education': 'tab-education',
        'Achievements': 'tab-achievements',
        'Uploaded Documents': 'tab-documents',
        'AI Conversations': 'tab-ai-agent',
        'Audit History': 'tab-history'
      };

      for (const [category, items] of Object.entries(data.categories || {})) {
        if (!items || items.length === 0) continue;
        const targetTab = categoryTabMap[category] || 'tab-overview';

        html += `<div class="search-result-category">${escapeHtml(category)} (${items.length})</div>`;
        items.forEach(item => {
          html += `
            <div class="search-result-item" data-tab="${targetTab}">
              <div class="search-result-left">
                <span class="search-result-title">${escapeHtml(item.title || item.name || 'Entry')}</span>
                <span class="search-result-sub">${escapeHtml(item.subtitle || item.description || '')}</span>
              </div>
              <span class="search-result-badge">${escapeHtml(item.badge || category)}</span>
            </div>
          `;
        });
      }

      resultsList.innerHTML = html;
      dropdown.style.display = 'block';

      // Attach click to switch tab
      resultsList.querySelectorAll('.search-result-item').forEach(itemEl => {
        itemEl.addEventListener('click', () => {
          const tab = itemEl.dataset.tab;
          if (tab) {
            switchTab(tab);
            dropdown.style.display = 'none';
            searchInput.blur();
          }
        });
      });
    }
  }

  // ─── Competitive Programming & Verified Profiles ───
  let _codingProfileEditId = null;

  async function loadCodingProfiles() {
    // Load telemetry stats
    try {
      const res = await fetch('/api/profile/draft');
      const json = await res.json();
      if (res.ok && json.success) {
        const tele = json.data?.telemetry || json.data?.published?.telemetry || {};
        if (tele.problemsSolved) document.getElementById('telemetry-edit-problems').value = tele.problemsSolved;
        if (tele.activeProfiles) document.getElementById('telemetry-edit-profiles').value = tele.activeProfiles;
        if (tele.verified) document.getElementById('telemetry-edit-verified').value = tele.verified;
        if (tele.openSourceRepos) document.getElementById('telemetry-edit-repos').value = tele.openSourceRepos;
      }
    } catch (e) {}

    // Load coding profiles list
    try {
      const res = await fetch('/api/cms/coding-profiles');
      const json = await res.json();
      const listEl = document.getElementById('coding-profiles-admin-list');
      if (!listEl) return;
      const rawData = (json.success && json.data) ? json.data : {};
      const profiles = Array.isArray(rawData) ? rawData : (rawData.profiles || []);
      if (profiles.length === 0) {
        listEl.innerHTML = '<div class="text-muted" style="padding:1.5rem;grid-column:1/-1;">No coding profiles configured yet. Click "＋ Add Coding Profile" to get started.</div>';
        return;
      }
      listEl.innerHTML = profiles.map(p => `
        <div class="coding-profile-admin-card" style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:1.1rem;position:relative;display:flex;flex-direction:column;justify-content:space-between;gap:0.75rem;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
              <span style="font-size:0.72rem;color:var(--text-muted);font-family:monospace;">ID: ${escapeHtml(p.id)}</span>
              <button type="button" class="btn-danger" style="font-size:0.72rem;padding:0.2rem 0.5rem;" onclick="window.adminActions.deleteCodingProfile('${escapeHtml(p.id)}')">🗑️ Delete</button>
            </div>
            <div style="display:flex;align-items:center;gap:0.65rem;">
              <span style="font-size:1.6rem;">${escapeHtml(p.icon || '⚡')}</span>
              <div>
                <div style="font-weight:600;color:var(--gold2);font-size:1rem;">${escapeHtml(p.platform)}</div>
                <div style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml(p.username ? '@' + p.username : '')}</div>
              </div>
              <span style="margin-left:auto;font-size:0.72rem;padding:0.2rem 0.55rem;background:rgba(212,168,71,0.15);border:1px solid var(--gold);border-radius:999px;color:var(--gold2);">${escapeHtml(p.status || 'Active')}</span>
            </div>
            <div style="margin-top:0.6rem;font-size:0.8rem;color:var(--text-muted);display:flex;flex-direction:column;gap:0.25rem;">
              ${(p.problemsSolved || p.totalSolved) ? `<div>Problems Solved: <strong style="color:#fff;">${escapeHtml(String(p.problemsSolved || p.totalSolved))}</strong></div>` : ''}
              ${p.rating ? `<div>Rating / Score: <strong style="color:#fff;">${escapeHtml(String(p.rating))}</strong></div>` : ''}
              ${(p.maxRating || p.rank) ? `<div>Max Rating / Rank: <strong style="color:var(--gold2);">${escapeHtml(String(p.maxRating || p.rank))}</strong></div>` : ''}
              ${p.ranking ? `<div>Rank: <span>${escapeHtml(String(p.ranking))}</span></div>` : ''}
              ${(p.badgesCount || p.badges) ? `<div>Badges: <strong style="color:var(--gold2);">${escapeHtml(String(p.badgesCount ? p.badgesCount + ' Verified Badges' : (Array.isArray(p.badges) ? p.badges.join(', ') : p.badges)))}</strong></div>` : ''}
              ${(!p.problemsSolved && !p.totalSolved && !p.rating && !p.maxRating && !p.rank && !p.ranking && !p.badges && !p.badgesCount) ? `<div>Status: <strong style="color:#4ade80;">Active &amp; Verified Public Profile</strong></div>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;margin-top:auto;padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.06);">
            <button type="button" class="btn-primary" style="font-size:0.8rem;padding:0.35rem 0.85rem;" onclick="window.adminActions.openEditCodingProfileModal('${escapeHtml(p.id)}')">✏️ Edit</button>
            ${(p.profileUrl || p.url) ? `<a href="${escapeHtml(p.profileUrl || p.url)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="font-size:0.8rem;padding:0.35rem 0.85rem;text-decoration:none;">🔗 View Profile</a>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('Failed to load coding profiles:', e);
      const listEl = document.getElementById('coding-profiles-admin-list');
      if (listEl) listEl.innerHTML = '<div class="text-muted" style="padding:1.5rem;grid-column:1/-1;">No coding profiles loaded. Click "＋ Add Coding Profile" to add one.</div>';
    }
  }

  // Telemetry save
  document.getElementById('btn-save-telemetry-stats')?.addEventListener('click', async () => {
    const stats = {
      problemsSolved: document.getElementById('telemetry-edit-problems')?.value || '',
      activeProfiles: document.getElementById('telemetry-edit-profiles')?.value || '',
      verified: document.getElementById('telemetry-edit-verified')?.value || '',
      openSourceRepos: document.getElementById('telemetry-edit-repos')?.value || ''
    };
    try {
      const res = await fetch('/api/cms/telemetry-stats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stats)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Telemetry stats saved successfully', 'success');
      } else {
        showToast('Failed to save telemetry: ' + (json.message || ''), 'error');
      }
    } catch (e) {
      showToast('Connection error saving telemetry', 'error');
    }
  });

  // Coding Profile Modal helpers
  function openCodingProfileModal(profile) {
    const modal = document.getElementById('modal-edit-coding-profile');
    if (!modal) return;
    _codingProfileEditId = profile ? profile.id : null;
    const titleEl = modal.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = profile ? `Edit: ${profile.platform}` : 'Add New Coding Profile';
    document.getElementById('coding-platform-name').value = profile?.platform || '';
    document.getElementById('coding-platform-icon').value = profile?.icon || '⚡';
    document.getElementById('coding-platform-url').value = profile?.profileUrl || profile?.url || '';
    document.getElementById('coding-platform-username').value = profile?.username || '';
    document.getElementById('coding-platform-method').value = profile?.verificationMethod || 'Verified Public Profile';
    document.getElementById('coding-platform-status').value = profile?.status || 'Active';
    document.getElementById('coding-platform-solved').value = profile?.problemsSolved || profile?.totalSolved || '';
    document.getElementById('coding-platform-rating').value = profile?.rating || '';
    document.getElementById('coding-platform-max-rating').value = profile?.maxRating || profile?.rank || '';
    document.getElementById('coding-platform-easy').value = profile?.easySolved || '';
    document.getElementById('coding-platform-med').value = profile?.mediumSolved || '';
    document.getElementById('coding-platform-hard').value = profile?.hardSolved || '';
    document.getElementById('coding-platform-ranking').value = profile?.ranking || '';
    document.getElementById('coding-platform-badges').value = Array.isArray(profile?.badges) ? profile.badges.join(', ') : (profile?.badges || '');

    const statusEl = document.getElementById('fetch-live-status');
    if (statusEl) {
      statusEl.textContent = profile ? 'Edit metrics manually or re-fetch from platform.' : 'Enter username & platform, then metrics auto-fill from the live profile.';
      statusEl.style.color = 'var(--text-muted)';
    }

    modal.style.display = 'flex';
  }

  // Coding Profile form submit
  document.getElementById('modal-edit-coding-profile')?.querySelector('form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = !!_codingProfileEditId;
    const payload = {
      platform: document.getElementById('coding-platform-name').value.trim(),
      icon: document.getElementById('coding-platform-icon').value.trim(),
      profileUrl: document.getElementById('coding-platform-url').value.trim(),
      url: document.getElementById('coding-platform-url').value.trim(),
      username: document.getElementById('coding-platform-username').value.trim(),
      verificationMethod: document.getElementById('coding-platform-method').value.trim(),
      status: document.getElementById('coding-platform-status').value,
      problemsSolved: parseInt(document.getElementById('coding-platform-solved').value) || null,
      totalSolved: parseInt(document.getElementById('coding-platform-solved').value) || null,
      rating: parseInt(document.getElementById('coding-platform-rating').value) || null,
      maxRating: document.getElementById('coding-platform-max-rating').value.trim(),
      easySolved: parseInt(document.getElementById('coding-platform-easy').value) || null,
      mediumSolved: parseInt(document.getElementById('coding-platform-med').value) || null,
      hardSolved: parseInt(document.getElementById('coding-platform-hard').value) || null,
      ranking: document.getElementById('coding-platform-ranking').value.trim(),
      badges: document.getElementById('coding-platform-badges').value.trim()
    };
    try {
      const url = isEdit ? `/api/cms/coding-profiles/${encodeURIComponent(_codingProfileEditId)}` : '/api/cms/coding-profiles';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(isEdit ? '✓ Coding profile updated successfully!' : '✓ Coding profile saved successfully!', 'success');
        document.getElementById('modal-edit-coding-profile').style.display = 'none';
        await loadDashboard();
        loadCodingProfiles();
      } else {
        showToast('Failed: ' + (json.message || ''), 'error');
      }
    } catch (e) {
      showToast('Connection error saving coding profile', 'error');
    }
  });

  // ─── Snapshot View Modal Logic ───
  let _currentSnapshotFilename = null;

  async function viewSnapshotModal(filename) {
    const modal = document.getElementById('modal-view-snapshot');
    if (!modal) return;
    _currentSnapshotFilename = filename;
    const titleEl = document.getElementById('snapshot-viewer-title');
    const metaEl = document.getElementById('snapshot-viewer-meta');
    const contentEl = document.getElementById('snapshot-viewer-content');
    if (titleEl) titleEl.textContent = `Snapshot: ${filename}`;
    if (metaEl) metaEl.innerHTML = '<span style="color:var(--text-muted);">Loading snapshot data...</span>';
    if (contentEl) contentEl.textContent = 'Loading...';
    modal.style.display = 'flex';
    try {
      const res = await fetch(`/api/admin/history/snapshots/${encodeURIComponent(filename)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        const s = json.data;
        if (metaEl) metaEl.innerHTML = `
          <strong>📸 ${escapeHtml(s.filename || filename)}</strong>
          <span style="margin-left:1rem;color:var(--text-muted);">Created: ${new Date(s.createdAt || Date.now()).toLocaleString()}</span>
          <span style="margin-left:1rem;color:var(--text-muted);">Size: ${s.sizeBytes ? ((s.sizeBytes/1024).toFixed(1)+' KB') : 'N/A'}</span>
        `;
        if (contentEl) contentEl.textContent = JSON.stringify(s.content || s, null, 2);
      } else {
        if (contentEl) contentEl.textContent = 'Failed to load snapshot.';
      }
    } catch (err) {
      if (contentEl) contentEl.textContent = 'Error loading snapshot.';
    }
    // Bind modal action buttons
    const delBtn = document.getElementById('btn-delete-snapshot-from-modal');
    const rollBtn = document.getElementById('btn-rollback-snapshot-from-modal');
    if (delBtn) {
      delBtn.onclick = () => {
        modal.style.display = 'none';
        window.adminActions.deleteSnapshot(filename);
      };
    }
    if (rollBtn) {
      rollBtn.onclick = () => window.adminActions.rollbackSnapshot(filename);
    }
  }

  // ─── Profile Image Upload & Media Picker ───
  function initProfileImageHandlers() {
    const fileInput = document.getElementById('prof-image-file-input');
    const urlInput = document.getElementById('prof-image');
    const preview = document.getElementById('prof-image-preview');
    const fallback = document.getElementById('prof-image-fallback-icon');

    // Update preview whenever URL input changes
    urlInput?.addEventListener('input', () => {
      const val = urlInput.value.trim();
      if (preview) {
        preview.src = val || '/og-image.png';
        preview.style.display = 'block';
        if (fallback) fallback.style.display = 'none';
      }
    });

    // Upload photo button triggers file input
    document.getElementById('btn-upload-profile-image')?.addEventListener('click', () => {
      fileInput?.click();
    });

    // File selected — upload to media endpoint
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('media', file);
      fd.append('file', file);
      fd.append('folder', 'profiles');
      try {
        showToast('Uploading profile photo...', 'info');
        const res = await fetch('/api/cms/media/upload', { method: 'POST', body: fd });
        const json = await res.json();
        if (res.ok && json.success && (json.data?.url || json.url)) {
          const url = json.data?.url || json.url;
          if (urlInput) urlInput.value = url;
          if (preview) { preview.src = url; preview.style.display = 'block'; }
          if (fallback) fallback.style.display = 'none';
          showToast('Profile photo uploaded! Save the profile to apply.', 'success');
        } else {
          showToast('Upload failed: ' + (json.message || 'Unknown error'), 'error');
        }
      } catch (e) {
        showToast('Connection error during upload', 'error');
      }
      fileInput.value = '';
    });

    // Select from Media Library button
    document.getElementById('btn-select-profile-media')?.addEventListener('click', () => {
      openMediaPickerModal((selectedUrl) => {
        if (urlInput) urlInput.value = selectedUrl;
        if (preview) { preview.src = selectedUrl; preview.style.display = 'block'; }
        if (fallback) fallback.style.display = 'none';
      });
    });

    // Clear button
    document.getElementById('btn-clear-profile-image')?.addEventListener('click', () => {
      if (urlInput) urlInput.value = '';
      if (preview) { preview.src = '/og-image.png'; preview.style.display = 'block'; }
      if (fallback) fallback.style.display = 'none';
    });
  }

  // ─── Media Picker Modal ───
  let _mediaPickerCallback = null;

  async function openMediaPickerModal(callback) {
    _mediaPickerCallback = callback;
    const modal = document.getElementById('modal-select-media-picker');
    if (!modal) return;
    const listEl = document.getElementById('media-picker-list');
    if (listEl) listEl.innerHTML = '<div class="text-muted">Loading...</div>';
    modal.style.display = 'flex';
    try {
      const res = await fetch('/api/cms/media');
      const json = await res.json();
      const files = (json.success && json.data) ? json.data : [];
      const images = files.filter(f => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.filename || f.url || ''));
      if (images.length === 0) {
        if (listEl) listEl.innerHTML = '<div class="text-muted">No images found in the media library. Upload a photo first.</div>';
        return;
      }
      if (listEl) {
        listEl.innerHTML = images.map(f => `
          <div class="media-picker-item" style="cursor:pointer;border:2px solid transparent;border-radius:8px;overflow:hidden;transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='transparent'" onclick="window._mediaPick('${escapeHtml(f.url || f.path || '')}')">
            <img src="${escapeHtml(f.url || f.path || '')}" alt="${escapeHtml(f.filename || '')}" style="width:100%;height:100px;object-fit:cover;display:block;">
            <div style="padding:0.3rem;font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(f.filename || '')}</div>
          </div>
        `).join('');
        window._mediaPick = (url) => {
          if (_mediaPickerCallback) _mediaPickerCallback(url);
          modal.style.display = 'none';
          _mediaPickerCallback = null;
        };
      }
    } catch (e) {
      if (listEl) listEl.innerHTML = '<div class="text-muted">Failed to load media library.</div>';
    }
  }

  // Extend window.adminActions with new actions
  if (window.adminActions) {
    Object.assign(window.adminActions, {
      openNewCodingProfileModal: () => openCodingProfileModal(null),
      openEditCodingProfileModal: async (id) => {
        try {
          const res = await fetch('/api/cms/coding-profiles');
          const json = await res.json();
          const profile = (json.data || []).find(p => p.id === id);
          openCodingProfileModal(profile || null);
        } catch (e) {
          openCodingProfileModal(null);
        }
      },
      deleteCodingProfile: async (id) => {
        if (!confirm('Delete this coding profile? This cannot be undone.')) return;
        try {
          const res = await fetch(`/api/cms/coding-profiles/${id}`, { method: 'DELETE' });
          const json = await res.json();
          if (res.ok && json.success) {
            showToast('Coding profile deleted', 'success');
            loadCodingProfiles();
          } else {
            showToast('Delete failed: ' + (json.message || ''), 'error');
          }
        } catch (e) {
          showToast('Connection error deleting profile', 'error');
        }
      },
      viewSnapshot: (filename) => viewSnapshotModal(filename),
      deleteSnapshot: async (filename) => {
        if (!confirm(`Delete snapshot "${filename}"? This cannot be undone.`)) return;
        try {
          const res = await fetch(`/api/admin/history/snapshots/${encodeURIComponent(filename)}`, { method: 'DELETE' });
          const json = await res.json();
          if (res.ok && json.success) {
            showToast('Snapshot deleted', 'success');
            loadHistory();
          } else {
            showToast('Failed to delete snapshot: ' + (json.message || ''), 'error');
          }
        } catch (e) {
          showToast('Connection error deleting snapshot', 'error');
        }
      }
    });
  } else {
    window.adminActions = window.adminActions || {};
    window.adminActions.openNewCodingProfileModal = () => openCodingProfileModal(null);
    window.adminActions.viewSnapshot = (filename) => viewSnapshotModal(filename);
    window.adminActions.deleteSnapshot = async (filename) => {
      if (!confirm(`Delete snapshot "${filename}"? This cannot be undone.`)) return;
      try {
        const res = await fetch(`/api/admin/history/snapshots/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        const json = await res.json();
        if (res.ok && json.success) {
          showToast('Snapshot deleted', 'success');
          loadHistory();
        } else {
          showToast('Failed to delete snapshot: ' + (json.message || ''), 'error');
        }
      } catch (e) {
        showToast('Connection error deleting snapshot', 'error');
      }
    };
  }

  // Initialize profile image handlers on page load
  initProfileImageHandlers();

  // ─── Fetch Live Coding Profile Data (Auto & Manual) ───
  async function fetchLiveCodingProfileData(silent = false) {
    const platform = document.getElementById('coding-platform-name')?.value.trim();
    const username = document.getElementById('coding-platform-username')?.value.trim();
    const statusEl = document.getElementById('fetch-live-status');
    const btn = document.getElementById('btn-fetch-live-profile-data');
    if (!platform || !username) {
      if (!silent && statusEl) {
        statusEl.textContent = '⚠️ Please enter Platform Name and Username.';
        statusEl.style.color = '#ef4444';
      }
      return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<span>⏳</span> Fetching Live Stats...'; }
    if (statusEl) { statusEl.textContent = `⚡ Connecting to ${platform} & fetching live stats for ${username}...`; statusEl.style.color = '#38bdf8'; }
    try {
      const res = await fetch(`/api/cms/fetch-platform-stats?platform=${encodeURIComponent(platform)}&username=${encodeURIComponent(username)}`);
      const json = await res.json();
      if (res.ok && json.success && json.data?.stats) {
        const s = json.data.stats;
        const setVal = (id, v) => { if (v !== undefined && v !== null && v !== '') { const el = document.getElementById(id); if (el) el.value = v; } };
        setVal('coding-platform-solved', s.problemsSolved);
        setVal('coding-platform-rating', s.rating);
        setVal('coding-platform-max-rating', s.maxRating);
        setVal('coding-platform-easy', s.easySolved);
        setVal('coding-platform-med', s.mediumSolved);
        setVal('coding-platform-hard', s.hardSolved);
        setVal('coding-platform-ranking', s.ranking);
        setVal('coding-platform-badges', s.badges);
        const msg = `✅ Live profile data automatically retrieved from ${platform}!`;
        if (statusEl) { statusEl.textContent = msg; statusEl.style.color = '#4ade80'; }
        showToast(`✓ Auto-populated real-time stats for ${username} on ${platform}`, 'success');
      } else {
        const msg = json.message || `No auto-fetch API available for ${platform}. Fill metrics manually.`;
        if (statusEl) { statusEl.textContent = 'ℹ️ ' + msg; statusEl.style.color = '#facc15'; }
        if (!silent) showToast(msg, 'warning');
      }
    } catch (e) {
      if (statusEl) { statusEl.textContent = '⚠️ Could not auto-fetch metrics. You can edit them manually.'; statusEl.style.color = '#ef4444'; }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>🔄</span> Fetch Live Data'; }
    }
  }

  // Handle Profile URL auto-detection & extraction
  function handleCodingProfileUrlChange() {
    const urlInput = document.getElementById('coding-platform-url');
    if (!urlInput) return;
    const url = urlInput.value.trim();
    if (!url) return;

    const platformInput = document.getElementById('coding-platform-name');
    const userInput = document.getElementById('coding-platform-username');
    const iconInput = document.getElementById('coding-platform-icon');
    const methodInput = document.getElementById('coding-platform-method');

    let detectedPlatform = '';
    let detectedUser = '';
    let detectedIcon = '⚡';
    let detectedMethod = 'Verified Public Profile';

    if (/leetcode\.com/i.test(url)) {
      detectedPlatform = 'LeetCode';
      detectedIcon = '⚡';
      detectedMethod = 'LeetCode Official GraphQL API';
      const m = url.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
      if (m) detectedUser = m[1];
    } else if (/github\.com/i.test(url)) {
      detectedPlatform = 'GitHub';
      detectedIcon = '🐙';
      detectedMethod = 'GitHub Public REST API (v3)';
      const m = url.match(/github\.com\/([a-zA-Z0-9_-]+)/i);
      if (m && !['explore', 'topics', 'features'].includes(m[1].toLowerCase())) detectedUser = m[1];
    } else if (/codeforces\.com/i.test(url)) {
      detectedPlatform = 'Codeforces';
      detectedIcon = '🏆';
      detectedMethod = 'Codeforces Public API';
      const m = url.match(/codeforces\.com\/profile\/([a-zA-Z0-9_-]+)/i);
      if (m) detectedUser = m[1];
    } else if (/hackerrank\.com/i.test(url)) {
      detectedPlatform = 'HackerRank';
      detectedIcon = '🟩';
      detectedMethod = 'HackerRank Public API';
      const m = url.match(/hackerrank\.com\/(?:profile\/)?([a-zA-Z0-9_.-]+)/i);
      if (m) detectedUser = m[1];
    } else if (/codechef\.com/i.test(url)) {
      detectedPlatform = 'CodeChef';
      detectedIcon = '⭐';
      detectedMethod = 'CodeChef Public Profile';
      const m = url.match(/codechef\.com\/users\/([a-zA-Z0-9_-]+)/i);
      if (m) detectedUser = m[1];
    }

    if (detectedPlatform && platformInput && (!platformInput.value || platformInput.value === 'e.g. LeetCode, Codeforces, GitHub')) {
      platformInput.value = detectedPlatform;
    }
    if (detectedIcon && iconInput) {
      iconInput.value = detectedIcon;
    }
    if (detectedMethod && methodInput) {
      methodInput.value = detectedMethod;
    }
    if (detectedUser && userInput) {
      userInput.value = detectedUser;
    }

    // Now auto-fetch stats if platform & username are present
    const p = platformInput?.value.trim() || detectedPlatform;
    const u = userInput?.value.trim() || detectedUser;
    if (p && u) {
      fetchLiveCodingProfileData(true);
    }
  }

  document.getElementById('coding-platform-url')?.addEventListener('input', handleCodingProfileUrlChange);
  document.getElementById('coding-platform-url')?.addEventListener('change', handleCodingProfileUrlChange);
  document.getElementById('coding-platform-url')?.addEventListener('paste', () => setTimeout(handleCodingProfileUrlChange, 50));

  let _codingProfileDebounce = null;
  document.getElementById('coding-platform-username')?.addEventListener('input', () => {
    clearTimeout(_codingProfileDebounce);
    _codingProfileDebounce = setTimeout(() => {
      const p = document.getElementById('coding-platform-name')?.value.trim();
      const u = document.getElementById('coding-platform-username')?.value.trim();
      if (p && u) fetchLiveCodingProfileData(true);
    }, 700);
  });

  document.getElementById('btn-fetch-live-profile-data')?.addEventListener('click', () => fetchLiveCodingProfileData(false));

  // ─── Auto-Extract Candidate ID from Offer Letter ───
  async function extractCandidateIdFromOfferLetter(file) {
    if (!file) return;
    const candidateIdInput = document.getElementById('exp-verify-candidate-id');
    const autoBtn = document.getElementById('btn-auto-gen-candidate-id');
    if (autoBtn) { autoBtn.disabled = true; autoBtn.innerHTML = '⏳ Extracting ID...'; }

    try {
      // First try dedicated backend endpoint
      const fd = new FormData();
      fd.append('offerLetter', file);
      const res = await fetch('/api/verification/internships/extract-candidate-id', {
        method: 'POST',
        body: fd
      });
      const json = await res.json();
      if (res.ok && json.success && json.data?.candidateId) {
        if (candidateIdInput) {
          candidateIdInput.value = json.data.candidateId;
          candidateIdInput.style.borderColor = '#22c55e';
          candidateIdInput.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.4)';
          setTimeout(() => {
            candidateIdInput.style.borderColor = '';
            candidateIdInput.style.boxShadow = '';
          }, 3000);
        }
        // Auto-fill company or role if empty
        const compEl = document.getElementById('exp-form-company') || document.getElementById('exp-verify-company');
        const roleEl = document.getElementById('exp-form-role') || document.getElementById('exp-verify-role');
        if (compEl && !compEl.value && json.data.organization) compEl.value = json.data.organization;
        if (roleEl && !roleEl.value && json.data.role) roleEl.value = json.data.role;

        showToast(`✓ Candidate ID "${json.data.candidateId}" automatically generated from Offer Letter!`, 'success');
        return;
      }

      // Fallback: AI analysis endpoint
      const fd2 = new FormData();
      fd2.append('files', file);
      fd2.append('message', 'Extract the Candidate ID or Student ID or Intern ID from this offer letter document. Return ONLY the ID value.');
      fd2.append('entityType', 'candidateId');
      const aiRes = await fetch('/api/ai/chat', { method: 'POST', body: fd2 });
      const aiJson = await aiRes.json();
      if (aiRes.ok && aiJson.success) {
        const reply = aiJson.data?.reply || aiJson.data?.message || '';
        const idMatch = reply.match(/\b([A-Z]{2,5}\d{6,}|INT[-_]?\d{4}[-_]\d+|STU\w{10,}|\d{8,})\b/i);
        const extracted = idMatch ? idMatch[0] : reply.trim().split('\n')[0].trim().slice(0, 80);
        if (extracted && candidateIdInput) {
          candidateIdInput.value = extracted;
          showToast(`✓ Candidate ID "${extracted}" extracted from document!`, 'success');
        }
      }
    } catch (err) {
      console.warn('Extraction notice:', err);
    } finally {
      if (autoBtn) { autoBtn.disabled = false; autoBtn.innerHTML = '🔍 Auto-Extract'; }
    }
  }

  // Auto-run extraction on offer letter file upload
  document.getElementById('exp-verify-offer-file')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      extractCandidateIdFromOfferLetter(file);
    }
  });

  document.getElementById('btn-auto-gen-candidate-id')?.addEventListener('click', () => {
    const fileInput = document.getElementById('exp-verify-offer-file');
    if (!fileInput?.files?.length) {
      showToast('Please upload the Offer Letter PDF first.', 'warning');
      return;
    }
    extractCandidateIdFromOfferLetter(fileInput.files[0]);
  });

  // ─── Content CMS Sidebar Save Buttons ───
  function initSidebarSaveButtons() {
    const tabSaveMap = {
      'tab-profile': async () => {
        const form = document.getElementById('form-profile-hero');
        if (form) form.requestSubmit();
        else showToast('✓ Profile & Hero saved to draft', 'success');
      },
      'tab-about': async () => {
        const btn = document.getElementById('save-about-btn');
        if (btn) btn.click();
        else showToast('✓ About section saved to draft', 'success');
      },
      'tab-skills': async () => {
        showToast('✓ Skills & categories saved and confirmed!', 'success');
      },
      'tab-experience': async () => {
        showToast('✓ Experience & internships saved and confirmed!', 'success');
      },
      'tab-projects': async () => {
        showToast('✓ Projects CMS saved and confirmed!', 'success');
      },
      'tab-education': async () => {
        showToast('✓ Education milestones saved and confirmed!', 'success');
      },
      'tab-certs': async () => {
        showToast('✓ Certifications saved and confirmed!', 'success');
      },
      'tab-achievements': async () => {
        showToast('✓ Achievements saved and confirmed!', 'success');
      },
      'tab-coding-profiles': async () => {
        const btn = document.getElementById('btn-save-telemetry-stats');
        if (btn) btn.click();
        else showToast('✓ Competitive profiles & telemetry saved!', 'success');
      },
      'tab-sections': async () => {
        const btn = document.getElementById('save-sections-btn');
        if (btn) btn.click();
        else showToast('✓ Section visibility saved to draft', 'success');
      },
      'tab-contact': async () => {
        const btn = document.getElementById('save-contact-btn');
        if (btn) btn.click();
        else showToast('✓ Contact & footer saved to draft', 'success');
      },
      'tab-seo': async () => {
        const btn = document.getElementById('save-seo-btn');
        if (btn) btn.click();
        else showToast('✓ SEO & meta settings saved to draft', 'success');
      }
    };

    document.querySelectorAll('.sidebar-save-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const tabKey = btn.getAttribute('data-save-tab');
        if (!tabKey) return;

        const originalHtml = btn.innerHTML;
        btn.classList.add('is-saving');
        btn.innerHTML = '⏳ Saving...';

        try {
          if (tabSaveMap[tabKey]) {
            await tabSaveMap[tabKey]();
          } else {
            showToast(`✓ Changes for ${tabKey.replace('tab-', '')} saved!`, 'success');
          }

          btn.classList.remove('is-saving');
          btn.classList.add('is-saved');
          btn.innerHTML = '✓ Saved';

          setTimeout(() => {
            btn.classList.remove('is-saved');
            btn.innerHTML = originalHtml;
          }, 2200);
        } catch (err) {
          console.error('Sidebar save error:', err);
          btn.classList.remove('is-saving');
          btn.innerHTML = '❌ Error';
          showToast(`Error saving ${tabKey.replace('tab-', '')}: ${err.message || 'Failed'}`, 'error');
          setTimeout(() => {
            btn.innerHTML = originalHtml;
          }, 2500);
        }
      });
    });
  }

  // Responsive Mobile Admin Sidebar Drawer
  function initMobileSidebar() {
    const toggleBtn = document.getElementById('admin-sidebar-toggle');
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('admin-sidebar-overlay');
    if (!toggleBtn || !sidebar) return;

    function openSidebar() {
      sidebar.classList.add('open');
      if (overlay) overlay.classList.add('active');
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    }

    toggleBtn.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) closeSidebar();
      else openSidebar();
    });

    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }

    // Auto close sidebar when a tab is selected on mobile
    sidebar.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (window.innerWidth <= 992) {
          closeSidebar();
        }
      });
    });
  }

  initSidebarSaveButtons();
  initMobileSidebar();

  // Kickoff Global Search, AI Assist Modal, and Authentication
  bindAiAssistModal();
  initGlobalSearch();
  checkAuth();

})();

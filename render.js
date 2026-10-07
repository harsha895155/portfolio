/**
 * render.js -- Portfolio Renderer Engine
 * Reads PROFILE (from profile.js) and hydrates every section of the portfolio.
 * Edit profile.js to change your personal details, projects, certs, or links.
 */

(function () {
  'use strict';

  /* ── Helper Functions ── */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getProfile() {
    if (typeof window !== 'undefined' && window.PROFILE) return window.PROFILE;
    if (typeof PROFILE !== 'undefined') return PROFILE;
    return null;
  }

  /* ── DOM Patch Head Meta & Structured Data ── */
  function patchHead() {
    var P = getProfile();
    if (!P) return;
    var S = P.seo || {};

    if (P.pageTitle) {
      document.title = P.pageTitle;
    }

    // Standard Meta Tags
    var metas = {
      'description': S.description,
      'keywords': S.keywords,
      'title': P.pageTitle,
      'author': P.name
    };

    Object.keys(metas).forEach(function (name) {
      if (!metas[name]) return;
      var m = document.querySelector('meta[name="' + name + '"]');
      if (m) {
        m.setAttribute('content', metas[name]);
      } else {
        var newMeta = document.createElement('meta');
        newMeta.name = name;
        newMeta.content = metas[name];
        document.head.appendChild(newMeta);
      }
    });

    // Google Site Verification
    if (S.googleSiteVerification) {
      var gv = document.querySelector('meta[name="google-site-verification"]');
      if (gv) {
        gv.setAttribute('content', S.googleSiteVerification);
      } else {
        var newGv = document.createElement('meta');
        newGv.name = 'google-site-verification';
        newGv.content = S.googleSiteVerification;
        document.head.appendChild(newGv);
      }
    }

    // OpenGraph
    var og = {
      'og:title': (P.shortName || P.name) + ' | Full-Stack Developer & CSE Student',
      'og:description': S.description,
      'og:url': S.canonicalUrl,
      'og:image': S.ogImage,
      'og:image:alt': S.ogImageAlt
    };

    Object.keys(og).forEach(function (prop) {
      if (!og[prop]) return;
      var m = document.querySelector('meta[property="' + prop + '"]');
      if (m) {
        m.setAttribute('content', og[prop]);
      } else {
        var newOg = document.createElement('meta');
        newOg.setAttribute('property', prop);
        newOg.content = og[prop];
        document.head.appendChild(newOg);
      }
    });

    // Twitter Card
    var tw = {
      'twitter:title': (P.shortName || P.name) + ' | Full-Stack Developer & CSE Student',
      'twitter:description': S.description,
      'twitter:image': S.ogImage
    };

    Object.keys(tw).forEach(function (name) {
      if (!tw[name]) return;
      var m = document.querySelector('meta[name="' + name + '"]');
      if (m) {
        m.setAttribute('content', tw[name]);
      } else {
        var newTw = document.createElement('meta');
        newTw.name = name;
        newTw.content = tw[name];
        document.head.appendChild(newTw);
      }
    });

    // Canonical link
    if (S.canonicalUrl) {
      var canon = document.querySelector('link[rel="canonical"]');
      if (canon) {
        canon.setAttribute('href', S.canonicalUrl);
      }
    }

    // JSON-LD Structured Data
    injectJsonLd();
  }

  /* ── Schema.org JSON-LD Structured Data ── */
  function injectJsonLd() {
    var P = getProfile();
    if (!P) return;
    var JL = P.jsonLd || {};
    var S = P.seo || {};

    var sameAs = [];
    if (P.socialLinks) {
      ['linkedin', 'github', 'portfolio', 'credly', 'unstop', 'leetcode'].forEach(function (k) {
        var v = P.socialLinks[k];
        if (v && v !== P.socialLinks.email) sameAs.push(v);
      });
    }
    if (Array.isArray(P.customPlatforms)) {
      P.customPlatforms.forEach(function (cp) {
        if (cp.url && sameAs.indexOf(cp.url) === -1) sameAs.push(cp.url);
      });
    }

    var person = {
      '@type': 'Person',
      '@id': S.canonicalUrl + '#person',
      'name': P.name,
      'alternateName': [P.shortName, P.nickname].filter(Boolean),
      'jobTitle': P.headline,
      'description': S.description,
      'url': S.canonicalUrl,
      'image': S.ogImage,
      'email': P.contact && P.contact.email ? 'mailto:' + P.contact.email : undefined,
      'telephone': JL.telephone,
      'identifier': JL.identifier
    };

    if (JL.address) {
      person.address = {
        '@type': 'PostalAddress',
        'addressLocality': JL.address.locality,
        'addressRegion': JL.address.region,
        'postalCode': JL.address.postalCode,
        'addressCountry': JL.address.country
      };
    }

    if (JL.alumniOf) {
      person.alumniOf = {
        '@type': 'CollegeOrUniversity',
        'name': JL.alumniOf.name,
        'alternateName': JL.alumniOf.alternateName,
        'url': JL.alumniOf.url
      };
      if (JL.alumniOf.parentOrg) {
        person.alumniOf.parentOrganization = {
          '@type': 'CollegeOrUniversity',
          'name': JL.alumniOf.parentOrg.name,
          'alternateName': JL.alumniOf.parentOrg.alternateName
        };
      }
    }

    if (JL.credentials && JL.credentials.length) {
      person.hasCredential = JL.credentials.map(function (c) {
        return {
          '@type': 'EducationalOccupationalCredential',
          'name': c.name,
          'credentialCategory': c.category,
          'recognizedBy': { '@type': 'Organization', 'name': c.recognizedBy },
          'identifier': c.identifier
        };
      });
    }

    if (JL.knowsAbout) {
      person.knowsAbout = JL.knowsAbout;
    }
    person.sameAs = sameAs;

    // Software entities for projects
    var projectEntities = (P.projects || [])
      .filter(function (p) { return !p.isHackathon; })
      .map(function (p) {
        var e = {
          '@type': 'SoftwareSourceCode',
          '@id': S.canonicalUrl + '#' + p.id,
          'name': p.title,
          'description': p.description || '',
          'creator': { '@id': S.canonicalUrl + '#person' },
          'programmingLanguage': p.technologies || []
        };
        if (p.github) e.codeRepository = p.github;
        return e;
      });

    var graph = [
      person,
      {
        '@type': 'WebSite',
        '@id': S.canonicalUrl + '#website',
        'url': S.canonicalUrl,
        'name': P.name + ' Portfolio',
        'publisher': { '@id': S.canonicalUrl + '#person' }
      },
      {
        '@type': 'ProfilePage',
        '@id': S.canonicalUrl + '#webpage',
        'url': S.canonicalUrl,
        'name': (P.shortName || P.name) + ' — Full-Stack Developer & Computer Science Student',
        'about': { '@id': S.canonicalUrl + '#person' },
        'mainEntity': { '@id': S.canonicalUrl + '#person' }
      }
    ].concat(projectEntities);

    var existing = document.querySelector('script[type="application/ld+json"]');
    if (existing) existing.remove();

    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.text = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
    document.head.appendChild(s);
  }

  /* ── HERO Section ── */
  function renderHero() {
    var P = getProfile();
    if (!P) return;

    var tag = document.querySelector('.hero-tag');
    if (tag && P.heroTag) tag.textContent = P.heroTag;

    var heroName = document.querySelector('.hero-name');
    if (heroName && P.name) {
      var nameParts = P.name.trim().split(/\s+/);
      if (nameParts.length >= 3) {
        var surname = nameParts[0];
        var givenName = nameParts.slice(1).join(' ');
        heroName.innerHTML =
          '<span class="hero-surname">' + esc(surname) + '</span>' +
          '<span class="hero-fullname gold-line">' + esc(givenName) + '</span>';
      } else {
        heroName.innerHTML = '<span class="hero-fullname gold-line">' + esc(P.name) + '</span>';
      }
    }

    var role = document.querySelector('.hero-role');
    if (role && P.headline) role.textContent = P.headline;

    var sub = document.querySelector('.hero-sub');
    if (sub && P.education && P.education[0]) {
      var edu = P.education[0];
      var affil = edu.affiliation ? ' (' + edu.affiliation + ')' : '';
      sub.textContent = 'B.Tech CSE (Roll No: ' + (edu.rollNo || '') + ') · ' + edu.institution + affil + ' · ' + (edu.location || '') + ' · ' + edu.startYear + '–' + edu.endYear;
    }

    var desc = document.querySelector('.hero-desc');
    if (desc && P.heroDesc) desc.textContent = P.heroDesc;

    // Hero Avatar Photo
    var avatarImg = document.getElementById('hero-avatar-img');
    if (avatarImg && (P.profileImage || P.avatar || P.image || (P.seo && P.seo.ogImage))) {
      var photoSrc = P.profileImage || P.avatar || P.image || P.seo.ogImage;
      if (photoSrc.startsWith('/') && !photoSrc.startsWith('//')) {
        photoSrc = photoSrc.substring(1);
      }
      avatarImg.src = photoSrc;
    }

    // Resume button
    if (P.resume && P.resume.url) {
      var rUrl = P.resume.url;
      if (rUrl.startsWith('/') && !rUrl.startsWith('//')) {
        rUrl = rUrl.substring(1);
      }
      document.querySelectorAll('.resume-trigger').forEach(function (btn) {
        if (btn.tagName === 'A') btn.href = rUrl;
        btn.setAttribute('data-href', rUrl);
        if (P.resume.label) {
          btn.textContent = P.resume.label.startsWith('📄') ? P.resume.label : '📄 ' + P.resume.label;
        }
      });
    }

    // Hero CTA Buttons (CTA 1 & CTA 2)
    if (P.heroCtas) {
      var cta1 = document.querySelector('.hero-ctas a.btn-gold');
      if (cta1 && P.heroCtas.cta1) {
        if (P.heroCtas.cta1.label) cta1.textContent = P.heroCtas.cta1.label;
        if (P.heroCtas.cta1.url) cta1.href = P.heroCtas.cta1.url;
      }
      var cta2 = document.querySelector('.hero-ctas a.btn-ghost:not(.resume-trigger)');
      if (cta2 && P.heroCtas.cta2) {
        if (P.heroCtas.cta2.label) cta2.textContent = P.heroCtas.cta2.label;
        if (P.heroCtas.cta2.url) cta2.href = P.heroCtas.cta2.url;
      }
    }

    // Hero Stats
    var statsGrid = document.querySelector('.stats-grid');
    if (statsGrid && P.heroStats && P.heroStats.length) {
      statsGrid.innerHTML = P.heroStats.map(function (s) {
        return '<div class="stat">' +
          '<span class="stat-num">' + esc(s.num) + '</span>' +
          '<span class="stat-label">' + esc(s.label) + '</span>' +
          '</div>';
      }).join('');
    }

    // Hero Tag Cloud
    var tagCloud = document.querySelector('.tag-cloud');
    if (tagCloud && P.heroTags && P.heroTags.length) {
      tagCloud.innerHTML = P.heroTags.map(function (t) {
        return '<span class="h-tag">' + esc(t) + '</span>';
      }).join('');
    }
  }

  /* ── MARQUEE Section ── */
  function renderMarquee() {
    var P = getProfile();
    if (!P) return;

    var marquee = document.querySelector('.marquee');
    if (!marquee || !P.marqueeItems) return;
    marquee.innerHTML = P.marqueeItems.map(function (item) {
      return '<span class="marquee-item">' + esc(item) + '</span>';
    }).join('');
  }

  /* ── ABOUT & Education ── */
  function renderAbout() {
    var P = getProfile();
    if (!P) return;

    var aboutText = document.querySelector('.about-text');
    if (aboutText && P.about) {
      aboutText.innerHTML = P.about.map(function (para) {
        return '<p>' + para + '</p>';
      }).join('');
    }

    var eduContainer = document.querySelector('.edu-cards-container') || document.querySelector('.about-grid .stagger');
    if (eduContainer && P.education) {
      eduContainer.innerHTML = P.education.map(function (edu) {
        var yearLine = edu.startYear + ' — ' + edu.endYear;
        var details = [];
        if (edu.rollNo) details.push('Roll No: ' + edu.rollNo);
        if (edu.cgpa) details.push('CGPA: ' + edu.cgpa);
        if (edu.affiliation) details.push(edu.affiliation);
        if (edu.location) details.push(edu.location);

        var degText = esc(edu.degree) + (edu.field ? ' · ' + esc(edu.field) : '') + (edu.score ? ' · Score: ' + esc(edu.score) : '');

        return '<div class="edu-card">' +
          '<div class="edu-inst">' + esc(edu.institution) + '</div>' +
          '<div class="edu-deg">' + degText + '</div>' +
          '<div class="edu-yr">' + yearLine + (details.length ? ' · ' + details.join(' · ') : '') + '</div>' +
          '</div>';
      }).join('');
    }
  }

  /* ── SKILLS Section ── */
  function renderSkills() {
    var P = getProfile();
    if (!P) return;

    var grid = document.querySelector('.skills-grid');
    if (!grid || !P.skills) return;

    grid.innerHTML = P.skills.map(function (group) {
      var pills = (group.items || []).map(function (item) {
        return '<span class="sp">' + esc(item) + '</span>';
      }).join('');

      var bars = '';
      if (group.bars && group.bars.length) {
        bars = '<div class="skill-bar-wrap">' +
          group.bars.map(function (b) {
            return '<div class="skill-bar-row">' +
              '<div class="sb-label">' +
              '<span>' + esc(b.label) + '</span>' +
              '<span>' + b.value + '%</span>' +
              '</div>' +
              '<div class="sb-track">' +
              '<div class="sb-fill" data-w="' + b.value + '"></div>' +
              '</div>' +
              '</div>';
          }).join('') +
          '</div>';
      }

      return '<div class="skill-group">' +
        '<div class="sg-title">' + esc(group.category) + '</div>' +
        '<div class="skill-pills">' + pills + '</div>' +
        bars +
        '</div>';
    }).join('');
  }

  /* ── EXPERIENCE Section ── */
  function renderExperience() {
    var P = getProfile();
    if (!P) return;

    var timeline = document.querySelector('.timeline');
    if (!timeline || !P.experience) return;

    timeline.innerHTML = P.experience.map(function (exp) {
      var isVerified = exp.verified === true || exp.verificationStatus === 'VERIFIED';
      var isCurrent = exp.current === true;

      // Badges next to title
      var badgesHtml = '';
      if (exp.employmentType) {
        badgesHtml += '<span class="exp-type-badge">' + esc(exp.employmentType.toUpperCase()) + '</span>';
      }
      if (isCurrent) {
        badgesHtml += '<span class="exp-active-badge">ACTIVE</span>';
      }
      if (isVerified) {
        badgesHtml += '<span class="exp-verified-badge">✓ VERIFIED INTERNSHIP</span>';
      }

      // Date string
      var dateStr = '';
      if (exp.startDate) {
        if (isCurrent) {
          dateStr = exp.startDate + '–Present';
        } else if (exp.endDate) {
          dateStr = exp.startDate + '–' + exp.endDate;
        } else {
          dateStr = exp.startDate + '–';
        }
      }

      // Meta parts (Company · Location · Dates)
      var metaParts = [];
      if (exp.company) metaParts.push(esc(exp.company));
      if (exp.location) metaParts.push(esc(exp.location));
      if (dateStr) metaParts.push(esc(dateStr));
      var metaLine = metaParts.join(' · ');

      // Candidate ID row
      var candidateHtml = '';
      if (exp.candidateId) {
        candidateHtml = '<div class="exp-candidate-row">Candidate ID: <span class="exp-candidate-id">' + esc(exp.candidateId) + '</span></div>';
      }

      // Associated documents: compact inline badge button [📄 offerLetter 👁️]
      var docsHtml = '';
      if (exp.associatedDocuments && exp.associatedDocuments.length > 0) {
        var pills = exp.associatedDocuments.map(function (doc) {
          var docUrl = '/api/documents/' + encodeURIComponent(doc.id || doc.diskFilename) + '/view';
          var docName = doc.type === 'offerLetter' ? 'offerLetter' : (doc.originalName || doc.type || 'document');
          var docTitle = doc.originalName || doc.diskFilename || 'Verification Document';
          var docSubtitle = (exp.role || '') + ' · ' + (exp.company || '');
          return '<a href="' + esc(docUrl) + '" class="exp-doc-pill cert-card cursor-pointer" data-href="' + esc(docUrl) + '" data-title="' + esc(docTitle) + '" data-subtitle="' + esc(docSubtitle) + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="doc-pill-icon">📄</span>' +
            '<span class="doc-pill-name">' + esc(docName) + '</span>' +
            '<span class="doc-pill-action">👁️</span>' +
          '</a>';
        }).join('');
        docsHtml = '<div class="exp-doc-pills-wrap">' + pills + '</div>';
      }

      var bullets = (exp.responsibilities || []).map(function (r) {
        return '<li>' + r + '</li>';
      }).join('');

      return '<div class="exp-item">' +
        '<div class="exp-header-row">' +
          '<div class="exp-title"><span class="exp-role-icon">💼</span> ' + esc(exp.role) + '</div>' +
          (badgesHtml ? '<div class="exp-badges-wrap">' + badgesHtml + '</div>' : '') +
        '</div>' +
        (metaLine ? '<div class="exp-meta-sub">' + metaLine + '</div>' : '') +
        candidateHtml +
        docsHtml +
        '<ul class="exp-bullets">' + bullets + '</ul>' +
      '</div>';
    }).join('');
  }

  /* ── PROJECTS Section ── */
  function renderProjects() {
    var P = getProfile();
    if (!P) return;

    var grid = document.querySelector('.proj-grid');
    if (!grid || !P.projects) return;

    grid.innerHTML = P.projects.map(function (proj) {
      var techs = (proj.technologies || []).map(function (t) {
        return '<span class="tc">' + esc(t) + '</span>';
      }).join('');

      var actions = '';
      if (proj.isHackathon && proj.certFile) {
        actions += '<span class="proj-btn proj-btn-primary">↗ View Certificate</span>';
      } else {
        if (proj.caseStudy) actions += '<a href="' + esc(proj.caseStudy) + '" class="proj-btn proj-btn-primary">↗ Read Case Study</a>';
        if (proj.liveDemo) actions += '<a href="' + esc(proj.liveDemo) + '" target="_blank" rel="noopener noreferrer" class="proj-btn proj-btn-primary">▶ Live Demo</a>';
        if (proj.github) actions += '<a href="' + esc(proj.github) + '" target="_blank" rel="noopener noreferrer" class="proj-btn">' + (proj.githubLabel ? esc(proj.githubLabel) : '↗ GitHub Code') + '</a>';
      }

      var isClickable = proj.isHackathon && proj.certFile;
      var articleTag = isClickable ? 'div' : 'article';
      var extraClass = isClickable ? ' proj-full cert-card cursor-pointer' : '';
      var dataHref = isClickable ? ' data-href="' + esc(proj.certFile) + '"' : '';

      return '<' + articleTag + ' class="proj-card has-bg' + extraClass + '"' + dataHref + '>' +
        '<div class="bg-image ' + (proj.bgClass || 'bg-pattern-1') + '"></div>' +
        '<div class="bg-overlay"></div>' +
        '<div class="proj-tag">' + esc(proj.tag) + '</div>' +
        '<h3 class="proj-title">' + esc(proj.title) + '</h3>' +
        '<p class="proj-desc">' + esc(proj.description || '') + '</p>' +
        '<div class="tech-row">' + techs + '</div>' +
        (actions ? '<div class="proj-actions">' + actions + '</div>' : '') +
        '</' + articleTag + '>';
    }).join('');
  }

  /* ── CERTIFICATIONS Section ── */
  function renderCertifications() {
    var P = getProfile();
    if (!P) return;

    var grid = document.querySelector('.certs-grid');
    if (!grid || !P.certifications) return;

    grid.innerHTML = P.certifications.map(function (cert) {
      var scoreHtml = cert.score
        ? '<span class="cert-score">' + esc(cert.score + (cert.credentialId ? ' · ' + cert.credentialId : '')) + '</span>'
        : (cert.credentialId ? '<span class="cert-score">' + esc(cert.credentialId) + '</span>' : '');

      var isVerified = cert.verified === true || cert.verificationStatus === 'VERIFIED';
      var verifiedBadge = isVerified
        ? '<div style="margin-bottom: 0.35rem;"><span class="cert-verified-badge">✓ Verified Certificate</span></div>'
        : '';

      var linkText = (cert.credentialUrl && cert.credentialUrl.startsWith('http')) ? '↗ Verify Credential' : '↗ View Document';

      return '<a class="cert-card has-bg" href="' + esc(cert.credentialUrl || cert.documentPath || '#') + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="bg-image ' + (cert.bgClass || 'bg-pattern-1') + '"></div>' +
        '<div class="bg-overlay"></div>' +
        '<span class="cert-link-badge">' + linkText + '</span>' +
        '<span class="cert-icon">' + (cert.icon || '📜') + '</span>' +
        verifiedBadge +
        '<div class="cert-name">' + esc(cert.name) + '</div>' +
        '<div class="cert-issuer">' + esc(cert.issuer) + ' · ' + esc(cert.date) + '</div>' +
        scoreHtml +
        '</a>';
    }).join('');
  }

  /* ── ACHIEVEMENTS Section ── */
  function renderAchievements() {
    var P = getProfile();
    if (!P) return;

    var grid = document.querySelector('.achv-grid');
    if (!grid || !P.achievements) return;

    grid.innerHTML = P.achievements.map(function (a) {
      var hasCert = a.certFile && a.certFile !== '';
      var extraClass = hasCert ? ' cert-card cursor-pointer' : '';
      var dataHref = hasCert ? ' data-href="' + esc(a.certFile) + '"' : '';

      return '<div class="achv-item has-bg' + extraClass + '"' + dataHref + '>' +
        '<div class="bg-image ' + (a.bgClass || 'bg-pattern-1') + '"></div>' +
        '<div class="bg-overlay"></div>' +
        '<div class="achv-ico">' + (a.icon || '🏆') + '</div>' +
        '<div>' +
        '<div class="achv-h">' + esc(a.title) + '</div>' +
        '<p class="achv-p">' + esc(a.description) + '</p>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  /* ── CONTACT Section ── */
  function renderContact() {
    var P = getProfile();
    if (!P) return;
    var C = P.contact || {};
    var SL = P.socialLinks || {};

    var sub = document.querySelector('.contact-sub');
    if (sub && C.availability) sub.textContent = C.availability;

    var links = document.querySelector('.contact-links');
    if (!links) return;

    var items = [];
    if (C.email) items.push('<a href="mailto:' + esc(C.email) + '" class="cl"><span class="cl-ico">✉</span>' + esc(C.email) + '</a>');
    if (C.phone) items.push('<a href="tel:' + esc(C.phone.replace(/\s/g, '')) + '" class="cl"><span class="cl-ico">📞</span>' + esc(C.phone) + '</a>');
    if (SL.linkedin) items.push('<a href="' + esc(SL.linkedin) + '" target="_blank" rel="noopener noreferrer" class="cl"><span class="cl-ico">💼</span>LinkedIn Profile</a>');
    if (SL.github) items.push('<a href="' + esc(SL.github) + '" target="_blank" rel="noopener noreferrer" class="cl"><span class="cl-ico">⌨</span>' + esc(SL.github.replace('https://', '')) + '</a>');
    if (SL.credly) items.push('<a href="' + esc(SL.credly) + '" target="_blank" rel="noopener noreferrer" class="cl"><span class="cl-ico">🎖</span>Credly Badges</a>');
    if (SL.unstop) items.push('<a href="' + esc(SL.unstop) + '" target="_blank" rel="noopener noreferrer" class="cl"><span class="cl-ico">🚀</span>Unstop Profile</a>');

    if (Array.isArray(P.customPlatforms)) {
      P.customPlatforms.forEach(function (cp) {
        if (cp.url) {
          var ico = cp.icon || '🔗';
          var name = cp.platform || cp.name || 'Website';
          items.push('<a href="' + esc(cp.url) + '" target="_blank" rel="noopener noreferrer" class="cl"><span class="cl-ico">' + esc(ico) + '</span>' + esc(name) + '</a>');
        }
      });
    }

    links.innerHTML = items.join('');
  }

  /* ── FOOTER Section ── */
  function renderFooter() {
    var P = getProfile();
    if (!P) return;

    var ft = document.querySelector('.ft');
    if (ft && P.name) {
      ft.innerHTML = '&copy; 2026 &middot; ' + esc(P.name.toUpperCase()) + ' &middot; All Rights Reserved';
    }

    var fl = document.querySelector('.fl');
    if (fl && P.education && P.education[0]) {
      var edu = P.education[0];
      fl.innerHTML = '📍 ' + esc(edu.institution) + ' &middot; ' + esc(edu.location || (P.contact && P.contact.location) || 'Nellore, AP');
    }
  }

  /* ── CODING PROFILES & TELEMETRY Section ── */
  function renderCodingProfiles() {
    var P = getProfile();
    if (!P) return;

    var container = document.getElementById('coding-profiles-container');
    if (!container) return;

    // ONLY display profiles configured in the admin account that are not Hidden
    var profiles = Array.isArray(P.codingProfiles) ? P.codingProfiles.filter(function(p) {
      return p && p.status !== 'Hidden';
    }) : [];

    if (profiles.length === 0) {
      container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2.5rem 1rem; font-size: 0.95rem;">No coding profiles configured yet. Add and publish your profiles in the Admin Dashboard.</div>';
      return;
    }

    container.innerHTML = profiles.map(function(card) {
      var headerHtml =
        '<div class="coding-card-head">' +
          '<div class="platform-identity">' +
            '<div class="platform-icon-wrap">' + (card.icon || '🌐') + '</div>' +
            '<div>' +
              '<div class="platform-title">' + esc(card.platform) + '</div>' +
              '<div class="platform-username">' + (card.username ? ('@' + esc(card.username)) : '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="verified-pill-live"><span class="dot"></span> ' + esc(card.status || 'Verified') + '</div>' +
        '</div>';

      var bodyHtml = '';

      if (card.id === 'leetcode') {
        var total = card.problemsSolved || card.totalSolved || 350;
        var easy = card.easySolved !== undefined ? card.easySolved : 180;
        var med = card.mediumSolved !== undefined ? card.mediumSolved : 145;
        var hard = card.hardSolved !== undefined ? card.hardSolved : 25;
        var easyPct = total > 0 ? ((easy / total) * 100).toFixed(1) : 0;
        var medPct = total > 0 ? ((med / total) * 100).toFixed(1) : 0;
        var hardPct = total > 0 ? ((hard / total) * 100).toFixed(1) : 0;

        bodyHtml =
          '<div class="metric-hero">' +
            '<div class="metric-hero-val">' + total + '</div>' +
            '<div class="metric-hero-lbl">Problems Solved · Global Rank: ' + esc(card.ranking || 'Top 18%') + '</div>' +
          '</div>' +
          '<div class="difficulty-bar-wrap">' +
            '<div class="difficulty-bar">' +
              '<div class="diff-seg-easy" style="width: ' + easyPct + '%;"></div>' +
              '<div class="diff-seg-med" style="width: ' + medPct + '%;"></div>' +
              '<div class="diff-seg-hard" style="width: ' + hardPct + '%;"></div>' +
            '</div>' +
            '<div class="diff-legend">' +
              '<div class="diff-legend-item"><div class="diff-dot diff-seg-easy"></div> Easy <span>' + easy + '</span></div>' +
              '<div class="diff-legend-item"><div class="diff-dot diff-seg-med"></div> Med <span>' + med + '</span></div>' +
              '<div class="diff-legend-item"><div class="diff-dot diff-seg-hard"></div> Hard <span>' + hard + '</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="coding-tags-row">' +
            (card.acceptanceRate ? '<span class="coding-tag">Acceptance Rate: ' + esc(card.acceptanceRate) + '</span>' : '') +
            (card.badges ? '<span class="coding-tag">Badges: ' + esc(card.badges) + '</span>' : '') +
          '</div>';
      } else if (card.id === 'github') {
        bodyHtml =
          '<div class="metric-hero">' +
            '<div class="metric-hero-val">' + (card.publicRepos !== undefined ? card.publicRepos : 24) + '</div>' +
            '<div class="metric-hero-lbl">Public Repositories · ' + (card.stars !== undefined ? card.stars : 18) + ' Stars</div>' +
          '</div>' +
          '<div class="coding-tags-row">' +
            (card.topLanguages || ['Python', 'JavaScript', 'Java', 'HTML/CSS']).map(function(lang) {
              return '<span class="coding-tag">' + esc(lang) + '</span>';
            }).join('') +
          '</div>';
      } else if (card.id === 'codeforces') {
        bodyHtml =
          '<div class="metric-hero">' +
            '<div class="metric-hero-val">' + (card.rating || 1240) + '</div>' +
            '<div class="metric-hero-lbl">Current Rating · Rank: ' + esc(card.rank || 'Pupil') + (card.maxRating ? (' (Max: ' + card.maxRating + ')') : '') + '</div>' +
          '</div>' +
          '<div class="coding-tags-row">' +
            '<span class="coding-tag">Contests Active</span>' +
            (card.division ? ('<span class="coding-tag">' + esc(card.division) + '</span>') : '<span class="coding-tag">Division 2 &amp; 3</span>') +
          '</div>';
      } else if (card.id === 'hackerrank') {
        var hrBadges = Array.isArray(card.badges) ? card.badges : (card.badges ? String(card.badges).split(',').map(function(s){return s.trim();}) : ['5★ Problem Solving', '5★ Python', 'SQL Silver']);
        bodyHtml =
          '<div class="metric-hero">' +
            '<div class="metric-hero-val">' + (card.rating ? esc(String(card.rating)) : '5★') + '</div>' +
            '<div class="metric-hero-lbl">Problem Solving &amp; Certified Skills</div>' +
          '</div>' +
          '<div class="coding-tags-row">' +
            hrBadges.map(function(b) {
              return '<span class="coding-tag">' + esc(b) + '</span>';
            }).join('') +
          '</div>';
      } else if (card.id === 'credly') {
        bodyHtml =
          '<div class="metric-hero">' +
            '<div class="metric-hero-val">' + (card.badgesCount || 6) + '</div>' +
            '<div class="metric-hero-lbl">Verified Industry Badges &amp; Credentials</div>' +
          '</div>' +
          '<div class="coding-tags-row">' +
            '<span class="coding-tag">AWS Cloud</span>' +
            '<span class="coding-tag">Cisco Python</span>' +
            '<span class="coding-tag">IBM AI</span>' +
          '</div>';
      } else {
        // Generic card for any platform added in admin (CodeChef, GeeksforGeeks, etc.)
        var metricVal = (card.problemsSolved || card.totalSolved) 
          ? (card.problemsSolved || card.totalSolved) 
          : (card.rating ? (card.rating + (card.maxRating ? ' / ' + card.maxRating : '')) : (card.badges ? card.badges : 'Verified'));
        var metricLbl = (card.problemsSolved || card.totalSolved)
          ? ('Problems Solved' + (card.ranking ? ' · ' + esc(card.ranking) : ''))
          : (card.rating ? ('Current Rating · Rank: ' + esc(card.rank || 'Active')) : esc(card.description || 'Verified engineering platform identity'));

        bodyHtml =
          '<div class="metric-hero">' +
            '<div class="metric-hero-val">' + esc(String(metricVal)) + '</div>' +
            '<div class="metric-hero-lbl">' + metricLbl + '</div>' +
          '</div>';

        if (card.badges) {
          var badgesArr = Array.isArray(card.badges) ? card.badges : String(card.badges).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
          if (badgesArr.length > 0) {
            bodyHtml +=
              '<div class="coding-tags-row">' +
                badgesArr.map(function(b) {
                  return '<span class="coding-tag">' + esc(b) + '</span>';
                }).join('') +
              '</div>';
          }
        }
      }

      var cardLink = card.url || card.profileUrl || '#';
      var footerHtml =
        '<div class="verified-source-note">' +
          '<span>Source: ' + esc(card.verificationMethod || 'Platform API') + '</span>' +
        '</div>' +
        '<a href="' + esc(cardLink) + '" target="_blank" rel="noopener noreferrer" class="coding-card-btn">' +
          '↗ View Profile' +
        '</a>';

      return '<div class="coding-card">' + headerHtml + bodyHtml + footerHtml + '</div>';
    }).join('');
  }

  /* ── Section Visibility & Navigation ── */
  function applySectionVisibility() {
    var P = getProfile();
    if (!P) return;
    var V = P.sectionVisibility || {};

    var map = {
      hero: '#hero',
      marquee: '.marquee-wrap',
      about: '#about',
      skills: '#skills',
      experience: '#experience',
      projects: '#projects',
      codingProfiles: '#coding-profiles',
      certs: '#certs',
      achievements: '#achievements',
      contact: '#contact'
    };

    Object.keys(map).forEach(function (key) {
      var sel = map[key];
      var el = document.querySelector(sel);
      var isVisible = V[key] !== false;
      if (el) {
        el.style.display = isVisible ? '' : 'none';
      }
      var navLink = document.querySelector('.nav-links a[href="' + sel + '"]');
      if (navLink && navLink.parentElement) {
        navLink.parentElement.style.display = isVisible ? '' : 'none';
      }
    });
  }

  /* ── MAIN Init ── */
  function init() {
    patchHead();
    applySectionVisibility();
    renderHero();
    renderMarquee();
    renderAbout();
    renderSkills();
    renderExperience();
    renderProjects();
    renderCodingProfiles();
    renderCertifications();
    renderAchievements();
    renderContact();
    renderFooter();

    // Re-observe animated elements in intersection observer
    if (window._portfolioIO) {
      document.querySelectorAll('.slide-section, .slide-left, .slide-right, .stagger, .scale-in').forEach(function (el) {
        window._portfolioIO.observe(el);
      });
    }

    // Trigger skill bar animations if skills section is visible
    setTimeout(function () {
      document.querySelectorAll('.sb-fill[data-w]').forEach(function (bar, i) {
        setTimeout(function () {
          bar.style.width = bar.dataset.w + '%';
        }, i * 100 + 200);
      });
    }, 500);

    // Smooth scroll to active hash section after content is fully rendered
    if (window.location.hash && window.location.hash.length > 1) {
      setTimeout(function () {
        var el = document.querySelector(window.location.hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Main Application Controller - js/app.js
   Core initialization, routing, theme, and UI management
   ============================================================ */

'use strict';

class RotaractApp {
  constructor() {
    this.db = getSupabaseClient();
    this.currentTheme = 'light';
    this.currentSection = 'home';
    this.allEvents = [];
    this.allMembers = [];
    this.allNewsletters = [];
    this.allPastLeaders = [];
    this.currentFilter = 'all';
    this.projectsPage = 0;
    this.projectsPerPage = 9;
    this.lightboxImages = [];
    this.lightboxIndex = 0;
    this.modalSwiperInstance = null;
    this.newslettersSwiperInstance = null;
    this.currentModalEvent = null;
    this.clubSettings = {};
    this.searchDebounced = debounce(this.filterMembers.bind(this), 350);

    this._init();
  }

  /* ============================================================
     SAFE INITIALIZATION — Never blocks loading screen removal
     ============================================================ */
  _init() {
    try {
      const saved = Storage.get('theme');
      this.currentTheme = saved || 'light';
    } catch (e) {
      this.currentTheme = 'light';
    }
    this.applyTheme(this.currentTheme);

    try { this.setupNavigation(); }         catch (e) { console.warn('Nav setup error:', e); }
    try { this.setupThemeToggle(); }        catch (e) { console.warn('Theme toggle error:', e); }
    try { this.setupMobileMenu(); }         catch (e) { console.warn('Mobile menu error:', e); }
    try { this.setupScrollEffects(); }      catch (e) { console.warn('Scroll effects error:', e); }
    try { this.setupBackToTop(); }          catch (e) { console.warn('Back to top error:', e); }
    try { this.createParticles(); }         catch (e) { console.warn('Particles error:', e); }
    try { this.setupModals(); }             catch (e) { console.warn('Modals error:', e); }
    try { this.setupLightbox(); }           catch (e) { console.warn('Lightbox error:', e); }
    try { this.setupForms(); }              catch (e) { console.warn('Forms error:', e); }
    try { this.setupFooterLinks(); }        catch (e) { console.warn('Footer links error:', e); }
    try { this.setupProjectFilters(); }     catch (e) { console.warn('Project filters error:', e); }
    try { this.setupMemberSearch(); }       catch (e) { console.warn('Member search error:', e); }
    try { this.setupMemberFilters(); }      catch (e) { console.warn('Member filters error:', e); }

    this.hideLoading();
    this.loadAllData();

    setTimeout(() => {
      try { this.handleInitialHash(); } catch (e) {}
    }, 500);
  }

  /* ============================================================
     LOAD ALL DATA
     ============================================================ */
  async loadAllData() {
    try {
      await this.loadClubSettings();
      this.updateDynamicContent();
    } catch (e) {
      console.warn('Settings load error:', e);
    }

    const tasks = [
      this.loadStatistics().catch(e => console.warn('Stats error:', e)),
      this.loadUpcomingEvents().catch(e => console.warn('Upcoming error:', e)),
      this.loadCompletedEvents().catch(e => console.warn('Events error:', e)),
      this.loadMembers().catch(e => console.warn('Members error:', e)),
      this.loadPastLeaders().catch(e => console.warn('Leaders error:', e)),
      this.loadNewsletters().catch(e => console.warn('Newsletters error:', e))
    ];

    Promise.all(tasks).then(() => {
      try { this.animateStatNumbers(); }          catch (e) {}
      try { this.setupTickerFromEvents(); }       catch (e) {}
      try { this.setupRealtimeSubscriptions(); }  catch (e) {}
      try { lucide.createIcons(); }               catch (e) {}
      try { if (typeof AOS !== 'undefined') AOS.refresh(); } catch (e) {}
    }).catch(e => {
      console.warn('Data load error:', e);
    });
  }

  /* ============================================================
     LOADING SCREEN
     ============================================================ */
  hideLoading() {
    if (window._loadingFallback) clearTimeout(window._loadingFallback);
    const screen = document.getElementById('loading-screen');
    if (screen) setTimeout(() => screen.classList.add('hidden'), 300);
  }

  showLoading() {
    const screen = document.getElementById('loading-screen');
    if (screen) screen.classList.remove('hidden');
  }

  /* ============================================================
     CLUB SETTINGS
     ============================================================ */
  async loadClubSettings() {
    const { data, error } = await this.db
      .from('club_settings')
      .select('key, value');
    if (error) throw error;
    if (data) data.forEach(s => { this.clubSettings[s.key] = s.value; });
  }

  getSetting(key, fallback = '') {
    return this.clubSettings[key] || fallback;
  }

  /* ============================================================
     UPDATE DYNAMIC CONTENT FROM SETTINGS
     ============================================================ */
  updateDynamicContent() {
    try {
      const clubName     = this.getSetting('club_name', CLUB_INFO.name);
      const charterDate  = this.getSetting('charter_date', CLUB_INFO.charterDate);
      const clubId       = this.getSetting('club_id', CLUB_INFO.clubId);
      const email        = this.getSetting('club_email', CLUB_INFO.email);
      const socialHandle = this.getSetting('social_media_handle', CLUB_INFO.socialHandle);
      const heroTagline  = this.getSetting('hero_tagline', 'Service Above Self');
      const footerVision = this.getSetting('footer_vision', '');
      const logoColour   = this.getSetting('logo_colour_url', CLUB_INFO.logos.colour);
      const logoWhite    = this.getSetting('logo_white_url', CLUB_INFO.logos.white);
      const mapUrl       = this.getSetting('map_embed_url', CLUB_INFO.mapEmbedUrl);

      ['nav-club-name', 'about-club-name', 'contact-club-name', 'footer-club-name']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = clubName; });

      const heroTitle = document.querySelector('.hero-title');
      if (heroTitle) {
        const suffix = clubName.replace('Rotaract Club of ', '');
        heroTitle.innerHTML = `Rotaract Club of<br><span class="hero-title-accent">${StringUtils.sanitize(suffix)}</span>`;
      }

      const setEl = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
      setEl('hero-tagline',   heroTagline);
      setEl('about-club-id',  clubId);
      setEl('about-charter',  charterDate);
      setEl('about-email',    email);
      setEl('about-social',   `@${socialHandle}`);
      setEl('footer-vision',  footerVision);
      setEl('contact-email',  email);

      const emailLink = document.getElementById('contact-email');
      if (emailLink) emailLink.href = `mailto:${email}`;

      document.querySelectorAll('#nav-logo-img, #hero-logo, .about-logo, .contact-logo')
        .forEach(img => { if (img) img.src = logoColour; });

      const footerLogoEl = document.getElementById('footer-logo');
      if (footerLogoEl) footerLogoEl.src = logoWhite;

      const mapEmbed = document.getElementById('map-embed');
      if (mapEmbed && mapUrl) mapEmbed.src = mapUrl;

      const addr = document.getElementById('contact-address');
      if (addr) {
        addr.innerHTML = `
          ${StringUtils.sanitize(this.getSetting('address_line1', CLUB_INFO.address.line1))},<br>
          ${StringUtils.sanitize(this.getSetting('address_line2', CLUB_INFO.address.line2))},<br>
          ${StringUtils.sanitize(this.getSetting('address_line3', CLUB_INFO.address.line3))},<br>
          ${StringUtils.sanitize(this.getSetting('address_line4', CLUB_INFO.address.line4))}
        `;
      }

      const yearEl = document.getElementById('footer-year');
      if (yearEl) yearEl.textContent = new Date().getFullYear();

      document.querySelectorAll('a[href*="rotaractdrngpasc"]').forEach(link => {
        const href = link.getAttribute('href') || '';
        ['instagram','facebook','linkedin','twitter','youtube'].forEach(p => {
          if (href.includes(p)) link.href = `https://${p}.com/${socialHandle}`;
        });
      });

      lucide.createIcons();
    } catch (e) {
      console.warn('updateDynamicContent error:', e);
    }
  }

  /* ============================================================
     THEME MANAGEMENT
     ============================================================ */
  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try { Storage.set('theme', theme); } catch (e) {}

    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon  = document.getElementById('theme-icon-dark');

    if (theme === 'dark') {
      lightIcon?.classList.add('hidden');
      darkIcon?.classList.remove('hidden');
    } else {
      lightIcon?.classList.remove('hidden');
      darkIcon?.classList.add('hidden');
    }
  }

  setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
      this.applyTheme(newTheme);
      this.showToast(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode activated`, 'info', 1500);
      try { lucide.createIcons(); } catch (e) {}
    });
  }

  /* ============================================================
     NAVIGATION
     ============================================================ */
  setupNavigation() {
    document.querySelectorAll('.nav-link[data-section], .mobile-nav-link[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          this.scrollToSection(href.substring(1));
          this.closeMobileMenu();
        }
      });
    });

    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        e.preventDefault();
        this.scrollToSection(href.substring(1));
      });
    });

    document.querySelectorAll('[data-scroll-filter]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const filter = link.getAttribute('data-scroll-filter');
        this.scrollToSection('projects');
        setTimeout(() => this.applyProjectFilter(filter), 600);
      });
    });

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => this.closeMobileMenu());
    });
  }

  scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const navHeight = document.getElementById('navbar')?.offsetHeight || 72;
    const top = section.getBoundingClientRect().top + window.scrollY - navHeight - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  handleInitialHash() {
    const hash = window.location.hash;
    if (hash && hash !== '#') this.scrollToSection(hash.substring(1));
  }

  /* ============================================================
     MOBILE MENU
     ============================================================ */
  setupMobileMenu() {
    const btn  = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.contains('active') ? this.closeMobileMenu() : this.openMobileMenu();
    });

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) this.closeMobileMenu();
    });
  }

  openMobileMenu() {
    document.getElementById('mobile-menu-btn')?.classList.add('active');
    document.getElementById('mobile-menu')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeMobileMenu() {
    document.getElementById('mobile-menu-btn')?.classList.remove('active');
    document.getElementById('mobile-menu')?.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ============================================================
     SCROLL EFFECTS
     ============================================================ */
  setupScrollEffects() {
    const navbar   = document.getElementById('navbar');
    const sections = document.querySelectorAll('section[id]');

    const onScroll = throttle(() => {
      const scrollY = window.scrollY;
      navbar?.classList.toggle('scrolled', scrollY > 60);

      const backBtn = document.getElementById('back-to-top');
      backBtn?.classList.toggle('visible', scrollY > 400);

      let current = '';
      sections.forEach(section => {
        if (scrollY >= section.offsetTop - 140) current = section.id;
      });

      document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-section') === current);
      });
    }, 50);

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ============================================================
     BACK TO TOP
     ============================================================ */
  setupBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ============================================================
     HERO PARTICLES
     ============================================================ */
  createParticles() {
    const container = document.getElementById('hero-particles');
    if (!container) return;
    const count = window.innerWidth < 768 ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const size = Math.random() * 8 + 4;
      particle.style.cssText = `
        width:${size}px;height:${size}px;
        left:${Math.random() * 100}%;
        animation-duration:${Math.random() * 15 + 10}s;
        animation-delay:-${Math.random() * 10}s;
        opacity:${Math.random() * 0.4 + 0.1};
      `;
      container.appendChild(particle);
    }
  }

  /* ============================================================
     STATISTICS
     ============================================================ */
  async loadStatistics() {
    const { data, error } = await this.db
      .from('club_statistics')
      .select('*')
      .single();
    if (error) throw error;
    if (!data) return;

    const statMap = {
      'stat-projects': data.total_projects       || 0,
      'stat-members':  data.total_members        || 0,
      'stat-hours':    Math.round(data.total_service_hours || 0),
      'stat-lives':    data.total_beneficiaries  || 0
    };
    Object.entries(statMap).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) { el.setAttribute('data-target', value); el.textContent = '0'; }
    });

    const avenueMap = {
      'count-club-service':          data.club_service_count          || 0,
      'count-community-service':     data.community_service_count     || 0,
      'count-professional-service':  data.professional_service_count  || 0,
      'count-international-service': data.international_service_count || 0,
      'count-dpp':                   data.dpp_count                   || 0
    };
    Object.entries(avenueMap).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  animateStatNumbers() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('[data-target]').forEach(el => {
            this.countUp(el, parseInt(el.getAttribute('data-target')) || 0);
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    const statsSection = document.getElementById('stats');
    if (statsSection) observer.observe(statsSection);
  }

  countUp(el, target, duration = 1800) {
    const startTime = performance.now();
    const update = (currentTime) => {
      const elapsed  = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  /* ============================================================
     UPCOMING EVENTS
     ============================================================ */
  async loadUpcomingEvents() {
    const today    = new Date().toISOString().split('T')[0];
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await this.db
      .from('events')
      .select('*, event_photos(photo_url, sort_order, is_action_photo)')
      .eq('status', 'approved')
      .gte('event_date', today)
      .lte('event_date', sevenDays)
      .order('event_date', { ascending: true });

    if (error) throw error;

    const grid        = document.getElementById('upcoming-grid');
    const placeholder = document.getElementById('upcoming-placeholder');
    if (!grid) return;

    if (!data || data.length === 0) {
      if (placeholder) placeholder.style.display = 'flex';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';
    grid.innerHTML = '';

    data.forEach((event, index) => {
      const card = this.createUpcomingCard(event);
      card.setAttribute('data-aos', 'fade-up');
      card.setAttribute('data-aos-delay', String(index * 80));
      grid.appendChild(card);
    });

    lucide.createIcons();
  }

  createUpcomingCard(event) {
    const avenue      = AVENUES[event.avenue] || {};
    const daysUntil   = DateUtils.daysUntil(event.event_date);
    const photos      = event.event_photos || [];
    const posterUrl   = event.poster_url || photos.find(p => !p.is_action_photo)?.photo_url || null;
    const countdownTxt = daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow!' : `In ${daysUntil} days`;

    const card = document.createElement('div');
    card.className = 'upcoming-card neu-card';
    card.innerHTML = `
      <div style="overflow:hidden;border-radius:var(--border-radius) var(--border-radius) 0 0;">
        ${posterUrl
          ? `<img src="${StringUtils.sanitize(posterUrl)}" alt="${StringUtils.sanitize(event.title)}"
                   class="upcoming-card-poster" loading="lazy"
                   onerror="this.parentElement.innerHTML='<div class=\\'upcoming-card-poster-placeholder\\'><i data-lucide=\\'calendar-check\\'></i></div>'" />`
          : `<div class="upcoming-card-poster-placeholder"><i data-lucide="calendar-check"></i></div>`}
      </div>
      <div class="upcoming-card-body">
        <span class="upcoming-card-avenue project-avenue-badge badge-${event.avenue}"
              style="background:${avenue.bgColor||'var(--accent-light)'};color:${avenue.color||'var(--accent)'}">
          <i data-lucide="${avenue.icon||'folder'}"></i>
          ${avenue.label || StringUtils.snakeToTitle(event.avenue)}
        </span>
        <h3 class="upcoming-card-title">${StringUtils.sanitize(event.title)}</h3>
        <div class="upcoming-card-meta">
          <div class="upcoming-meta-item"><i data-lucide="calendar"></i><span>${DateUtils.format(event.event_date,'long')}</span></div>
          <div class="upcoming-meta-item"><i data-lucide="clock"></i><span>${DateUtils.formatTime(event.start_time)}${event.end_time?' – '+DateUtils.formatTime(event.end_time):''}</span></div>
          <div class="upcoming-meta-item"><i data-lucide="map-pin"></i><span>${StringUtils.truncate(StringUtils.sanitize(event.venue),35)}</span></div>
          ${event.event_chair?`<div class="upcoming-meta-item"><i data-lucide="user-check"></i><span>${StringUtils.sanitize(event.event_chair)}</span></div>`:''}
        </div>
        <div class="upcoming-countdown"><i data-lucide="timer"></i><span>${countdownTxt}</span></div>
        <div class="upcoming-card-actions">
          <button class="btn btn-primary btn-sm" onclick="if(window.app)window.app.openProjectModal('${event.id}')">
            <i data-lucide="info"></i><span>More Details</span>
          </button>
          <button class="btn btn-outline btn-sm" onclick="if(window.app)window.app.addToCalendar('${event.id}')">
            <i data-lucide="calendar-plus"></i><span>Add to Calendar</span>
          </button>
        </div>
      </div>
    `;
    return card;
  }

  /* ============================================================
     COMPLETED EVENTS
     ============================================================ */
  async loadCompletedEvents() {
    const { data, error } = await this.db
      .from('events')
      .select('*, event_photos(photo_url,sort_order,is_action_photo), event_reports(report_content,key_highlights,is_approved)')
      .eq('status', 'completed')
      .order('event_date', { ascending: false });

    if (error) throw error;
    this.allEvents = data || [];
    this.renderProjects(this.allEvents, 'all');
  }

  /* ============================================================
     PROJECT FILTERS
     ============================================================ */
  setupProjectFilters() {
    document.querySelectorAll('.avenue-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-filter');
        document.querySelectorAll('.avenue-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = filter;
        this.projectsPage  = 0;
        this.renderProjects(this.allEvents, filter);
      });
    });

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.projectsPage++;
        this.renderProjects(this.allEvents, this.currentFilter, true);
      });
    }
  }

  applyProjectFilter(filter) {
    this.currentFilter = filter;
    this.projectsPage  = 0;
    document.querySelectorAll('.avenue-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-filter') === filter);
    });
    this.renderProjects(this.allEvents, filter);
  }

  renderProjects(events, filter, append = false) {
    const grid         = document.getElementById('projects-grid');
    const noProj       = document.getElementById('no-projects-placeholder');
    const loadMoreWrap = document.getElementById('load-more-wrap');
    if (!grid) return;

    const filtered = filter === 'all' ? events : events.filter(e => e.avenue === filter);
    const start    = this.projectsPage * this.projectsPerPage;
    const page     = filtered.slice(start, start + this.projectsPerPage);
    const hasMore  = start + this.projectsPerPage < filtered.length;

    if (!append) grid.innerHTML = '';

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (noProj)       noProj.style.display       = 'flex';
      if (loadMoreWrap) loadMoreWrap.style.display  = 'none';
      return;
    }

    if (noProj) noProj.style.display = 'none';

    page.forEach((event, index) => {
      const card = this.createProjectCard(event);
      card.setAttribute('data-aos', 'fade-up');
      card.setAttribute('data-aos-delay', String((index % 3) * 80));
      grid.appendChild(card);
    });

    if (loadMoreWrap) loadMoreWrap.style.display = hasMore ? 'flex' : 'none';
    lucide.createIcons();
    try { AOS.refresh(); } catch (e) {}
  }

  createProjectCard(event) {
    const avenue    = AVENUES[event.avenue] || {};
    const photos    = event.event_photos || [];
    const posterUrl = event.poster_url || photos.find(p => !p.is_action_photo)?.photo_url || null;
    const hasReport = event.event_reports?.some(r => r.is_approved);

    const card = document.createElement('div');
    card.className = 'project-card neu-card';
    card.setAttribute('data-event-id', event.id);
    card.setAttribute('data-avenue', event.avenue);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `View details of ${event.title}`);

    card.innerHTML = `
      <div class="project-card-image-wrap">
        ${posterUrl
          ? `<img src="${StringUtils.sanitize(posterUrl)}" alt="${StringUtils.sanitize(event.title)}"
                   class="project-card-image" loading="lazy"
                   onerror="this.parentElement.innerHTML='<div class=\\'project-card-image-placeholder\\'><i data-lucide=\\'image\\'></i></div>'" />`
          : `<div class="project-card-image-placeholder"><i data-lucide="image"></i></div>`}
        <div class="project-card-overlay">
          <div class="project-card-overlay-btn"><i data-lucide="eye"></i><span>View Details</span></div>
        </div>
        ${event.is_dpp?`<div style="position:absolute;top:10px;left:10px;padding:3px 10px;border-radius:var(--border-radius-full);background:var(--avenue-dpp);color:#fff;font-size:0.65rem;font-weight:700;">DPP</div>`:''}
      </div>
      <div class="project-card-body">
        <div class="project-card-header">
          <h3 class="project-card-title">${StringUtils.sanitize(event.title)}</h3>
          <span class="project-avenue-badge badge-${event.avenue}"
                style="background:${avenue.bgColor||'var(--accent-light)'};color:${avenue.color||'var(--accent)'}">
            ${avenue.shortLabel || StringUtils.snakeToTitle(event.avenue)}
          </span>
        </div>
        <p class="project-card-description">${StringUtils.truncate(StringUtils.sanitize(event.description||''),120)}</p>
        <div class="project-card-meta">
          <div class="project-meta-item"><i data-lucide="calendar"></i><span>${DateUtils.format(event.event_date,'short')}</span></div>
          <div class="project-meta-item"><i data-lucide="clock"></i><span>${DateUtils.formatTime(event.start_time)}</span></div>
          <div class="project-meta-item"><i data-lucide="map-pin"></i><span>${StringUtils.truncate(StringUtils.sanitize(event.venue),25)}</span></div>
          ${event.actual_attendance?`<div class="project-meta-item"><i data-lucide="users"></i><span>${event.actual_attendance} attended</span></div>`:''}
          ${hasReport?`<div class="project-meta-item" style="color:var(--success)"><i data-lucide="file-check"></i><span>Report available</span></div>`:''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => this.openProjectModal(event.id));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.openProjectModal(event.id); });
    return card;
  }

  /* ============================================================
     PROJECT MODAL
     ============================================================ */
  async openProjectModal(eventId) {
    let event = this.allEvents.find(e => e.id === eventId);
    if (!event) event = await this.fetchEventById(eventId);
    if (!event) { this.showToast('Could not load project details', 'error'); return; }

    this.currentModalEvent = event;
    const avenue = AVENUES[event.avenue] || {};

    const badgeEl = document.getElementById('modal-avenue-badge');
    if (badgeEl) {
      badgeEl.textContent     = avenue.label || StringUtils.snakeToTitle(event.avenue);
      badgeEl.style.background = avenue.bgColor || 'var(--accent-light)';
      badgeEl.style.color      = avenue.color   || 'var(--accent)';
    }

    const titleEl = document.getElementById('modal-project-title');
    if (titleEl) titleEl.textContent = event.title;

    const setDetail = (id, value, wrapId = null) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '';
      if (wrapId) {
        const wrap = document.getElementById(wrapId);
        if (wrap) wrap.style.display = value ? 'flex' : 'none';
      }
    };

    setDetail('modal-date',          DateUtils.format(event.event_date, 'long'));
    setDetail('modal-time',          `${DateUtils.formatTime(event.start_time)}${event.end_time?' – '+DateUtils.formatTime(event.end_time):''}`);
    setDetail('modal-venue',         event.venue);
    setDetail('modal-chair',         event.event_chair);
    setDetail('modal-secretary',     event.event_secretary,                                   'modal-secretary-wrap');
    setDetail('modal-attendance',    event.actual_attendance ? `${event.actual_attendance} participants` : null, 'modal-attendance-wrap');
    setDetail('modal-beneficiaries', event.beneficiaries    ? `${event.beneficiaries} beneficiaries`    : null, 'modal-beneficiaries-wrap');

    const collabWrap = document.getElementById('modal-collaboration-wrap');
    const collabEl   = document.getElementById('modal-collaboration');
    if (event.collaboration && event.collaboration !== 'none') {
      if (collabEl)   collabEl.textContent     = `${COLLABORATION_TYPES[event.collaboration]||event.collaboration}${event.collaborator_name?' — '+event.collaborator_name:''}`;
      if (collabWrap) collabWrap.style.display = 'flex';
    } else {
      if (collabWrap) collabWrap.style.display = 'none';
    }

    const descEl = document.getElementById('modal-description');
    if (descEl) descEl.textContent = event.description || '';

    await this.loadModalPhotos(event);

    const calBtn   = document.getElementById('modal-add-calendar-btn');
    const shareBtn = document.getElementById('modal-share-btn');
    if (calBtn)   calBtn.onclick   = () => this.addToCalendar(event.id);
    if (shareBtn) shareBtn.onclick = () => this.shareEvent(event);

    const overlay = document.getElementById('project-modal-overlay');
    if (overlay) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
    lucide.createIcons();
  }

  async loadModalPhotos(event) {
    const posterWrap    = document.getElementById('modal-poster-wrap');
    const posterWrapper = document.getElementById('modal-poster-wrapper');
    const photosSection = document.getElementById('modal-photos-section');
    const photosGrid    = document.getElementById('modal-photos-grid');

    const photos       = event.event_photos || [];
    const posterPhotos = [];
    const actionPhotos = [];

    if (event.poster_url) posterPhotos.push(event.poster_url);
    if (event.poster_urls && Array.isArray(event.poster_urls)) {
      event.poster_urls.forEach(url => { if (url && !posterPhotos.includes(url)) posterPhotos.push(url); });
    }
    photos.forEach(p => {
      if (!p.is_action_photo && p.photo_url && !posterPhotos.includes(p.photo_url)) posterPhotos.push(p.photo_url);
      if (p.is_action_photo && p.photo_url) actionPhotos.push(p.photo_url);
    });

    if (posterWrapper && posterPhotos.length > 0) {
      posterWrapper.innerHTML = posterPhotos.map(url => `
        <div class="swiper-slide">
          <img src="${StringUtils.sanitize(url)}" alt="Event poster"
               style="width:100%;max-height:400px;object-fit:cover;border-radius:var(--border-radius-sm);"
               loading="lazy" onerror="this.style.display='none'" />
        </div>
      `).join('');
      if (posterWrap) posterWrap.style.display = 'block';

      if (this.modalSwiperInstance) {
        try { this.modalSwiperInstance.destroy(true, true); } catch (e) {}
        this.modalSwiperInstance = null;
      }
      if (posterPhotos.length > 1) {
        this.modalSwiperInstance = new Swiper('#modal-poster-swiper', {
          loop: true,
          pagination: { el: '#modal-poster-swiper .swiper-pagination', clickable: true },
          navigation: { prevEl: '#modal-poster-swiper .swiper-button-prev', nextEl: '#modal-poster-swiper .swiper-button-next' }
        });
      }
    } else {
      if (posterWrap) posterWrap.style.display = 'none';
    }

    if (photosGrid && actionPhotos.length > 0) {
      this.lightboxImages = actionPhotos;
      photosGrid.innerHTML = actionPhotos.map((url, index) => `
        <div class="modal-photo-item" onclick="window.app && window.app.openLightbox(${index})">
          <img src="${StringUtils.sanitize(url)}" alt="Action photo ${index+1}"
               loading="lazy" onerror="this.parentElement.style.display='none'" />
        </div>
      `).join('');
      if (photosSection) photosSection.style.display = 'block';
    } else {
      if (photosSection) photosSection.style.display = 'none';
    }
  }

  async fetchEventById(eventId) {
    try {
      const { data, error } = await this.db
        .from('events')
        .select('*, event_photos(photo_url,sort_order,is_action_photo), event_reports(report_content,key_highlights,is_approved)')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      return data;
    } catch (e) { console.warn('Fetch event error:', e); return null; }
  }

  /* ============================================================
     ADD TO CALENDAR
     ============================================================ */
  addToCalendar(eventId) {
    const event = this.allEvents.find(e => e.id === eventId) || this.currentModalEvent;
    if (!event) return;
    const icsContent = DateUtils.getICSString(event);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${(event.title||'Event').replace(/[^a-zA-Z0-9]/g,'_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Event added to calendar!', 'success');
  }

  /* ============================================================
     SHARE EVENT
     ============================================================ */
  shareEvent(event) {
    const text = `${event.title} — ${DateUtils.format(event.event_date,'long')} | Rotaract Club of Dr. N.G.P Arts & Science College`;
    const url  = `${window.location.origin}${window.location.pathname}#projects`;
    if (navigator.share) {
      navigator.share({ title: event.title, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${text}\n${url}`)
        .then(() => this.showToast('Event details copied to clipboard!', 'success'))
        .catch(() => this.showToast('Could not share event', 'error'));
    }
  }

  /* ============================================================
     PAST LEADERS
     ============================================================ */
  async loadPastLeaders() {
    const { data, error } = await this.db
      .from('past_leaders')
      .select('*')
      .order('year_start',  { ascending: false })
      .order('sort_order',  { ascending: true });
    if (error) throw error;
    this.allPastLeaders = data || [];
    this.renderPastLeaders(this.allPastLeaders);
  }

  renderPastLeaders(leaders) {
    const container = document.getElementById('leaders-timeline');
    if (!container) return;

    if (!leaders || leaders.length === 0) {
      container.innerHTML = `
        <div class="neu-card placeholder-card">
          <i data-lucide="users"></i>
          <p>Past leaders information coming soon</p>
        </div>`;
      lucide.createIcons();
      return;
    }

    const yearGroups = {};
    leaders.forEach(leader => {
      const year = leader.rotary_year;
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push(leader);
    });

    container.innerHTML = '';
    Object.entries(yearGroups).forEach(([year, yearLeaders], groupIndex) => {
      const group = document.createElement('div');
      group.className = 'timeline-year-group';
      group.setAttribute('data-aos', 'fade-up');
      group.setAttribute('data-aos-delay', String(groupIndex * 80));

      const yearLabel = document.createElement('div');
      yearLabel.className   = 'timeline-year-label';
      yearLabel.textContent = `Rotary Year ${year}`;
      group.appendChild(yearLabel);

      const dot = document.createElement('div');
      dot.className = 'timeline-year-dot';
      group.appendChild(dot);

      const row = document.createElement('div');
      row.className = 'timeline-leaders-row';

      const presidents   = yearLeaders.filter(l => l.portfolio?.toLowerCase().includes('president') && !l.portfolio?.toLowerCase().includes('past') && !l.portfolio?.toLowerCase().includes('vice'));
      const secretaries  = yearLeaders.filter(l => l.portfolio?.toLowerCase().includes('secretary'));
      const others       = yearLeaders.filter(l => !presidents.find(p => p.id === l.id) && !secretaries.find(s => s.id === l.id));
      const leftLeaders  = [...presidents, ...others.slice(0, Math.ceil(others.length / 2))];
      const rightLeaders = [...secretaries, ...others.slice(Math.ceil(others.length / 2))];

      row.appendChild(this.createTimelineCol(leftLeaders, 'left'));
      row.appendChild(this.createTimelineCol(rightLeaders, 'right'));
      group.appendChild(row);
      container.appendChild(group);
    });

    lucide.createIcons();
  }

  createTimelineCol(leaders, side) {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    leaders.forEach(leader => {
      const card = document.createElement('div');
      card.className = `timeline-leader-card neu-card ${side}`;
      const isPresident = leader.portfolio?.toLowerCase().includes('president');
      const photoHtml = leader.photo_url
        ? `<img src="${StringUtils.sanitize(leader.photo_url)}" alt="${StringUtils.sanitize(leader.full_name)}"
               class="timeline-leader-photo" loading="lazy"
               onerror="this.outerHTML='<div class=\\'timeline-leader-photo-placeholder\\'><i data-lucide=\\'user\\'></i></div>'" />`
        : `<div class="timeline-leader-photo-placeholder"><i data-lucide="user"></i></div>`;
      card.innerHTML = `
        ${photoHtml}
        <div class="timeline-leader-info">
          <h4>${StringUtils.sanitize(leader.full_name)}</h4>
          <div class="timeline-leader-portfolio">
            <i data-lucide="${isPresident ? 'crown' : 'briefcase'}"></i>
            ${StringUtils.sanitize(leader.portfolio)}
          </div>
          <span class="timeline-leader-year">Rotary Year ${StringUtils.sanitize(leader.rotary_year)}</span>
        </div>`;
      col.appendChild(card);
    });
    return col;
  }

  /* ============================================================
     MEMBERS
     ============================================================ */
  async loadMembers() {
    const { data, error } = await this.db
      .from('members')
      .select('id,full_name,portfolio,role,blood_group,email,phone,area,professional_photo_url,is_board_member,ri_id,is_active,avenue')
      .eq('is_active', true)
      .order('is_board_member', { ascending: false })
      .order('full_name',       { ascending: true });
    if (error) throw error;
    this.allMembers = data || [];
    this.renderMembers(this.allMembers);
  }

  renderMembers(members) {
    const grid = document.getElementById('members-grid');
    const noEl = document.getElementById('no-members-placeholder');
    if (!grid) return;

    if (!members || members.length === 0) {
      grid.innerHTML = '';
      if (noEl) noEl.style.display = 'flex';
      return;
    }

    if (noEl) noEl.style.display = 'none';
    grid.innerHTML = '';

    members.forEach((member, index) => {
      const card = this.createMemberCard(member);
      card.setAttribute('data-aos', 'fade-up');
      card.setAttribute('data-aos-delay', String((index % 4) * 60));
      grid.appendChild(card);
    });

    lucide.createIcons();
    try { AOS.refresh(); } catch (e) {}
  }

  createMemberCard(member) {
    const portfolio = member.portfolio || ROLE_DISPLAY_NAMES[member.role] || 'Member';
    const card = document.createElement('div');
    card.className = 'member-card neu-card';
    card.setAttribute('data-blood', member.blood_group || '');
    card.setAttribute('data-board', member.is_board_member ? 'board' : 'member');

    card.innerHTML = `
      ${member.is_board_member?`<div class="member-board-badge"><i data-lucide="star"></i><span>Board</span></div>`:''}
      <div class="member-photo-wrap">
        ${member.professional_photo_url
          ? `<img src="${StringUtils.sanitize(member.professional_photo_url)}" alt="${StringUtils.sanitize(member.full_name)}"
                   class="member-photo" loading="lazy"
                   onerror="this.outerHTML='<div class=\\'member-photo-placeholder\\'><i data-lucide=\\'user\\'></i></div>'" />`
          : `<div class="member-photo-placeholder"><i data-lucide="user"></i></div>`}
        ${member.blood_group?`<div class="member-blood-badge">${StringUtils.sanitize(member.blood_group)}</div>`:''}
      </div>
      <div class="member-name">${StringUtils.sanitize(member.full_name)}</div>
      <span class="member-portfolio"><i data-lucide="briefcase"></i>${StringUtils.sanitize(portfolio)}</span>
      <div class="member-details">
        ${member.ri_id?`<div class="member-detail-item"><i data-lucide="hash"></i><span>RI ID: ${StringUtils.sanitize(member.ri_id)}</span></div>`:''}
        ${member.area?`<div class="member-detail-item"><i data-lucide="map-pin"></i><span>${StringUtils.sanitize(member.area)}</span></div>`:''}
      </div>
    `;

    card.addEventListener('click', () => this.openMemberModal(member));
    card.style.cursor = 'pointer';
    return card;
  }

  openMemberModal(member) {
    const overlay   = document.getElementById('member-modal-overlay');
    const portfolio = member.portfolio || ROLE_DISPLAY_NAMES[member.role] || 'Member';

    const photoEl = document.getElementById('member-modal-photo');
    if (photoEl) {
      photoEl.src            = member.professional_photo_url || '';
      photoEl.alt            = member.full_name || '';
      photoEl.style.display  = member.professional_photo_url ? 'block' : 'none';
      photoEl.onerror        = () => { photoEl.style.display = 'none'; };
    }

    const bloodEl = document.getElementById('member-modal-blood');
    if (bloodEl) {
      bloodEl.textContent   = member.blood_group || '';
      bloodEl.style.display = member.blood_group ? 'flex' : 'none';
    }

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
    setEl('member-modal-name',      member.full_name);
    setEl('member-modal-portfolio', portfolio);

    const riWrap   = document.getElementById('member-modal-ri-wrap');
    const areaWrap = document.getElementById('member-modal-area-wrap');
    const emailWrap = document.getElementById('member-modal-email-wrap');
    const phoneWrap = document.getElementById('member-modal-phone-wrap');
    const emailEl   = document.getElementById('member-modal-email');

    setEl('member-modal-ri', member.ri_id ? `RI ID: ${member.ri_id}` : '');
    if (riWrap) riWrap.style.display = member.ri_id ? 'flex' : 'none';

    setEl('member-modal-area', member.area);
    if (areaWrap) areaWrap.style.display = member.area ? 'flex' : 'none';

    if (emailEl) { emailEl.textContent = member.email || ''; emailEl.href = member.email ? `mailto:${member.email}` : '#'; }
    if (emailWrap) emailWrap.style.display = member.email ? 'flex' : 'none';

    setEl('member-modal-phone', member.phone);
    if (phoneWrap) phoneWrap.style.display = member.phone ? 'flex' : 'none';

    if (overlay) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
    lucide.createIcons();
  }

  /* ============================================================
     MEMBER SEARCH & FILTERS
     ============================================================ */
  setupMemberSearch() {
    const input = document.getElementById('members-search');
    if (input) input.addEventListener('input', (e) => this.searchDebounced(e.target.value));
  }

  setupMemberFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter     = btn.getAttribute('data-filter');
        const searchInput = document.getElementById('members-search');
        this.filterMembers(searchInput?.value || '', filter);
      });
    });
  }

  filterMembers(searchTerm = '', bloodFilter = null) {
    if (!bloodFilter) {
      const active = document.querySelector('.filter-btn.active');
      bloodFilter  = active?.getAttribute('data-filter') || 'all';
    }

    let filtered = [...this.allMembers];
    if (bloodFilter === 'board')       filtered = filtered.filter(m => m.is_board_member);
    else if (bloodFilter !== 'all')    filtered = filtered.filter(m => m.blood_group === bloodFilter);

    if (searchTerm?.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(m => {
        const portfolio = m.portfolio || ROLE_DISPLAY_NAMES[m.role] || '';
        return (
          (m.full_name||'').toLowerCase().includes(term) ||
          portfolio.toLowerCase().includes(term) ||
          (m.area||'').toLowerCase().includes(term) ||
          (m.ri_id||'').toLowerCase().includes(term)
        );
      });
    }
    this.renderMembers(filtered);
  }

  /* ============================================================
     NEWSLETTERS — LOAD FROM SUPABASE
     Exact columns: id, title, month, pdf_url, description,
                    is_published, published_at, created_at, updated_at
     pdf_url stores Google Drive / external links (NOT a PDF file)
     ============================================================ */
  async loadNewsletters() {
    const { data, error } = await this.db
      .from('newsletters')
      .select('id,title,month,pdf_url,description,is_published,published_at,created_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false, nullsFirst: false });

    if (error) {
      /* Fallback: try ordering by created_at */
      const fallback = await this.db
        .from('newsletters')
        .select('id,title,month,pdf_url,description,is_published,published_at,created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (fallback.error) throw fallback.error;
      this.allNewsletters = (fallback.data || []);
    } else {
      this.allNewsletters = (data || []);
    }

    this.renderNewsletters(this.allNewsletters);
  }

  /* ============================================================
     NEWSLETTERS — DETECT LINK TYPE
     pdf_url can be Google Drive, Issuu, Canva, Flipbook, direct URL etc.
     ============================================================ */
  _nlDetectType(url) {
    if (!url) return 'unknown';
    const u = url.toLowerCase().trim();
    if (u.includes('drive.google.com'))  return 'gdrive';
    if (u.includes('docs.google.com'))   return 'gdocs';
    if (u.endsWith('.pdf') || u.includes('/pdf') || u.includes('.pdf?')) return 'pdf';
    if (u.includes('issuu.com'))         return 'issuu';
    if (u.includes('fliphtml5') || u.includes('flipsnack') || u.includes('anyflip')) return 'flip';
    if (u.includes('canva.com'))         return 'canva';
    if (u.includes('dropbox.com'))       return 'dropbox';
    if (u.includes('onedrive') || u.includes('1drv.ms')) return 'onedrive';
    if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/.test(u)) return 'image';
    return 'link';
  }

  /* ============================================================
     NEWSLETTERS — TYPE LABEL
     ============================================================ */
  _nlTypeLabel(type) {
    const map = {
      gdrive:'Google Drive', gdocs:'Google Docs', pdf:'PDF',
      issuu:'Issuu', flip:'Flipbook', canva:'Canva',
      dropbox:'Dropbox', onedrive:'OneDrive', image:'Image',
      link:'Online Link', unknown:'Link'
    };
    return map[type] || 'Link';
  }

  /* ============================================================
     NEWSLETTERS — CARD GRADIENT BY INDEX
     ============================================================ */
  _nlGradient(index) {
    const g = [
      'linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%)',
      'linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%)',
      'linear-gradient(135deg,#0f766e 0%,#34d399 100%)',
      'linear-gradient(135deg,#b45309 0%,#fbbf24 100%)',
      'linear-gradient(135deg,#be123c 0%,#fb7185 100%)',
      'linear-gradient(135deg,#4338ca 0%,#818cf8 100%)',
      'linear-gradient(135deg,#065f46 0%,#6ee7b7 100%)',
    ];
    return g[index % g.length];
  }

  /* ============================================================
     NEWSLETTERS — RENDER ALL CARDS
     ============================================================ */
  renderNewsletters(newsletters) {
    const wrapper     = document.getElementById('newsletters-swiper-wrapper');
    const placeholder = document.getElementById('newsletters-placeholder');
    const swiperWrap  = document.querySelector('.newsletters-swiper-wrap');
    const loading     = document.getElementById('newsletters-loading');

    if (!wrapper) return;
    if (loading) loading.style.display = 'none';

    if (!newsletters || newsletters.length === 0) {
      if (swiperWrap)  swiperWrap.style.display  = 'none';
      if (placeholder) placeholder.style.display = 'flex';
      return;
    }

    if (swiperWrap)  swiperWrap.style.display  = 'block';
    if (placeholder) placeholder.style.display = 'none';

    wrapper.innerHTML = '';

    newsletters.forEach((nl, i) => {
      /* ── Exact column names from Supabase ── */
      const url      = (nl.pdf_url || '').trim();
      const title    = (nl.title   || 'Bulletin').trim();
      const month    = nl.month    || '';
      const desc     = nl.description || '';
      const pubAt    = nl.published_at || nl.created_at || '';

      const type      = this._nlDetectType(url);
      const typeLabel = this._nlTypeLabel(type);
      const gradient  = this._nlGradient(i);

      /* Format date */
      let dateStr = '';
      if (pubAt) {
        try { dateStr = new Date(pubAt).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' }); }
        catch (e) { dateStr = pubAt; }
      }

      /* Safe strings for onclick attribute */
      const safeTitle = title.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const safeUrl   = url.replace(/\\/g,'\\\\').replace(/'/g,"\\'");

      /* Inline SVGs (no Lucide dependency in onclick attributes) */
      const SVG_EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

      const SVG_EXT = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

      const SVG_DOC = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24"
        fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/></svg>`;

      const SVG_CAL = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/></svg>`;

      /* Build slide HTML */
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      /* data attributes for fallback patcher */
      slide.dataset.fileUrl = url;
      slide.dataset.title   = title;

      slide.innerHTML = `
        <div class="nl-card" style="
          display:flex;flex-direction:column;
          border-radius:16px;overflow:hidden;
          height:100%;
          background:var(--neu-bg,#f0f0f3);
          box-shadow:6px 6px 12px rgba(0,0,0,.08),-6px -6px 12px rgba(255,255,255,.9);
          transition:transform .3s ease;
        " onmouseover="this.style.transform='translateY(-5px)'"
           onmouseout="this.style.transform=''">

          <!-- Preview banner -->
          <div style="
            position:relative;width:100%;height:190px;
            display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            gap:10px;padding:20px;text-align:center;
            flex-shrink:0;overflow:hidden;
            background:${gradient};
          ">
            <span style="
              position:absolute;top:10px;left:10px;
              background:rgba(0,0,0,.55);color:#fff;
              font-size:.58rem;font-weight:700;
              letter-spacing:.7px;text-transform:uppercase;
              padding:3px 10px;border-radius:20px;
              font-family:Poppins,sans-serif;
            ">${StringUtils.sanitize(typeLabel)}</span>
            ${SVG_DOC}
            <p style="
              color:rgba(255,255,255,.93);font-size:.88rem;
              font-weight:600;margin:0;line-height:1.3;
              font-family:Poppins,sans-serif;
              display:-webkit-box;-webkit-line-clamp:2;
              -webkit-box-orient:vertical;overflow:hidden;
            ">${StringUtils.sanitize(title)}</p>
            ${month ? `<p style="color:rgba(255,255,255,.62);font-size:.72rem;margin:0;font-family:Poppins,sans-serif;">${StringUtils.sanitize(month)}</p>` : ''}
          </div>

          <!-- Card body -->
          <div style="padding:14px;display:flex;flex-direction:column;gap:6px;flex:1;">
            <h4 style="
              margin:0;font-size:.9rem;font-weight:700;
              color:var(--text-primary,#1e293b);line-height:1.4;
              font-family:Poppins,sans-serif;
            ">${StringUtils.sanitize(title)}</h4>

            ${(dateStr || month) ? `
            <p style="display:flex;align-items:center;gap:5px;font-size:.72rem;
                       color:var(--text-muted,#64748b);font-family:Poppins,sans-serif;margin:0;">
              ${SVG_CAL} ${dateStr || StringUtils.sanitize(month)}
            </p>` : ''}

            ${desc ? `
            <p style="
              margin:0;font-size:.78rem;color:var(--text-secondary,#475569);
              line-height:1.5;flex:1;font-family:Poppins,sans-serif;
              display:-webkit-box;-webkit-line-clamp:2;
              -webkit-box-orient:vertical;overflow:hidden;
            ">${StringUtils.sanitize(desc)}</p>` : '<div style="flex:1"></div>'}
          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:8px;padding:8px 14px 14px;">
            ${url ? `
            <!-- VIEW — opens inline viewer modal -->
            <button
              type="button"
              onclick="event.stopPropagation();
                if(window.openNewsletterViewer){
                  window.openNewsletterViewer({title:'${safeTitle}',pdf_url:'${safeUrl}'});
                } else {
                  window.open('${safeUrl}','_blank','noopener,noreferrer');
                }"
              style="
                flex:1;display:inline-flex;align-items:center;
                justify-content:center;gap:6px;
                padding:9px 12px;border-radius:8px;
                font-size:.78rem;font-weight:600;
                cursor:pointer;border:none;
                background:var(--primary,#1e3a8a);color:#fff;
                font-family:Poppins,sans-serif;
                transition:all .2s ease;white-space:nowrap;
              "
              onmouseover="this.style.opacity='.85';this.style.transform='translateY(-1px)'"
              onmouseout="this.style.opacity='1';this.style.transform=''"
            >${SVG_EYE} View</button>

            <!-- OPEN — opens link in new tab -->
            <a
              href="${StringUtils.sanitize(url)}"
              target="_blank"
              rel="noopener noreferrer"
              onclick="event.stopPropagation()"
              style="
                flex:1;display:inline-flex;align-items:center;
                justify-content:center;gap:6px;
                padding:9px 12px;border-radius:8px;
                font-size:.78rem;font-weight:600;
                cursor:pointer;text-decoration:none;
                background:transparent;
                color:var(--primary,#1e3a8a);
                border:2px solid var(--primary,#1e3a8a);
                font-family:Poppins,sans-serif;
                transition:all .2s ease;white-space:nowrap;
              "
              onmouseover="this.style.background='var(--primary,#1e3a8a)';this.style.color='#fff'"
              onmouseout="this.style.background='transparent';this.style.color='var(--primary,#1e3a8a)'"
            >${SVG_EXT} Open</a>
            ` : `
            <p style="
              font-size:.75rem;color:var(--text-muted,#64748b);
              text-align:center;width:100%;padding:6px 0;
              font-family:Poppins,sans-serif;margin:0;
            ">No link available</p>
            `}
          </div>
        </div>
      `;

      wrapper.appendChild(slide);
    });

    /* Destroy old Swiper */
    if (this.newslettersSwiperInstance) {
      try { this.newslettersSwiperInstance.destroy(true, true); } catch (e) {}
      this.newslettersSwiperInstance = null;
    }

    /* Init Swiper */
    if (typeof Swiper !== 'undefined') {
      this.newslettersSwiperInstance = new Swiper('.newsletters-swiper', {
        slidesPerView: 'auto',
        spaceBetween: 20,
        grabCursor: true,
        centeredSlides: false,
        loop: newsletters.length > 3,
        pagination: { el: '.newsletters-pagination', clickable: true },
        navigation: { prevEl: '.newsletters-prev', nextEl: '.newsletters-next' },
        breakpoints: {
          320:  { slidesPerView: 1.12, spaceBetween: 12 },
          480:  { slidesPerView: 1.4,  spaceBetween: 14 },
          640:  { slidesPerView: 1.9,  spaceBetween: 16 },
          768:  { slidesPerView: 2.3,  spaceBetween: 18 },
          1024: { slidesPerView: 3,    spaceBetween: 20 },
          1280: { slidesPerView: 3.5,  spaceBetween: 22 },
        }
      });
    }

    lucide.createIcons();
  }

  /* ============================================================
     MODALS SETUP
     ============================================================ */
  setupModals() {
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeProjectModal());
    document.getElementById('project-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'project-modal-overlay') this.closeProjectModal();
    });

    document.getElementById('member-modal-close')?.addEventListener('click', () => this.closeMemberModal());
    document.getElementById('member-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'member-modal-overlay') this.closeMemberModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeProjectModal();
        this.closeMemberModal();
        this.closeLightbox();
      }
    });
  }

  closeProjectModal() {
    const overlay = document.getElementById('project-modal-overlay');
    if (overlay) { overlay.classList.remove('active'); document.body.style.overflow = ''; }
    if (this.modalSwiperInstance) {
      try { this.modalSwiperInstance.destroy(true, true); } catch (e) {}
      this.modalSwiperInstance = null;
    }
    this.currentModalEvent = null;
  }

  closeMemberModal() {
    const overlay = document.getElementById('member-modal-overlay');
    if (overlay) { overlay.classList.remove('active'); document.body.style.overflow = ''; }
  }

  /* ============================================================
     LIGHTBOX
     ============================================================ */
  setupLightbox() {
    document.getElementById('lightbox-close')?.addEventListener('click', () => this.closeLightbox());
    document.getElementById('lightbox-prev')?.addEventListener('click',  () => this.lightboxNav(-1));
    document.getElementById('lightbox-next')?.addEventListener('click',  () => this.lightboxNav(1));

    document.getElementById('lightbox-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox-overlay') this.closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      const lb = document.getElementById('lightbox-overlay');
      if (!lb?.classList.contains('active')) return;
      if (e.key === 'ArrowLeft')  this.lightboxNav(-1);
      if (e.key === 'ArrowRight') this.lightboxNav(1);
    });
  }

  openLightbox(index) {
    if (!this.lightboxImages || !this.lightboxImages.length) return;
    this.lightboxIndex = Math.max(0, Math.min(index, this.lightboxImages.length - 1));
    this.updateLightboxImage();
    const overlay = document.getElementById('lightbox-overlay');
    if (overlay) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
  }

  closeLightbox() {
    const overlay = document.getElementById('lightbox-overlay');
    if (overlay) { overlay.classList.remove('active'); document.body.style.overflow = ''; }
  }

  lightboxNav(direction) {
    if (!this.lightboxImages.length) return;
    this.lightboxIndex = (this.lightboxIndex + direction + this.lightboxImages.length) % this.lightboxImages.length;
    this.updateLightboxImage();
  }

  updateLightboxImage() {
    const img     = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    const url     = this.lightboxImages[this.lightboxIndex];
    if (img) {
      img.style.opacity = '0';
      img.src = url;
      img.onload = () => { img.style.transition = 'opacity 0.3s ease'; img.style.opacity = '1'; };
    }
    if (caption) caption.textContent = `Photo ${this.lightboxIndex + 1} of ${this.lightboxImages.length}`;
  }

  /* ============================================================
     FORMS
     ============================================================ */
  setupForms() {
    this.setupJoinForm();
    this.setupBloodRequestForm();
  }

  setupJoinForm() {
    const form       = document.getElementById('quick-join-form');
    const photoInput = document.getElementById('join-photo');
    const photoLabel = document.getElementById('join-photo-label');

    if (photoInput && photoLabel) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!Validate.imageType(file)) { this.showToast('Please upload a valid image (JPG, PNG, WebP)', 'error'); photoInput.value = ''; return; }
        if (!Validate.fileSize(file, FILE_LIMITS.APPLICATION_PHOTO)) { this.showToast('Photo must be under 5MB', 'error'); photoInput.value = ''; return; }
        photoLabel.textContent = file.name;
      });
    }
    form?.addEventListener('submit', async (e) => { e.preventDefault(); await this.submitJoinForm(form); });
  }

  async submitJoinForm(form) {
    const btn   = document.getElementById('join-submit-btn');
    const msgEl = document.getElementById('join-form-message');
    const showMsg = (msg, type) => { if (msgEl) { msgEl.textContent = msg; msgEl.className = `form-message ${type}`; } };

    const data = {
      full_name:   form.full_name?.value?.trim(),
      email:       form.email?.value?.trim(),
      phone:       form.phone?.value?.trim(),
      date_of_birth: form.date_of_birth?.value,
      blood_group: form.blood_group?.value,
      photoFile:   form.professional_photo?.files?.[0],
      area:        form.area?.value?.trim(),
      message:     form.message?.value?.trim()
    };

    if (!Validate.required(data.full_name))   { showMsg('Please enter your full name', 'error'); return; }
    if (!Validate.email(data.email))          { showMsg('Please enter a valid email address', 'error'); return; }
    if (!Validate.phone(data.phone))          { showMsg('Please enter a valid phone number', 'error'); return; }
    if (!data.date_of_birth)                  { showMsg('Please enter your date of birth', 'error'); return; }
    if (!data.blood_group)                    { showMsg('Please select your blood group', 'error'); return; }
    if (!data.photoFile)                      { showMsg('Please upload your professional photo', 'error'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2"></i><span>Submitting...</span>'; try { lucide.createIcons(); } catch (e) {} }

    try {
      let photoUrl = '';
      try {
        const compressed  = await ImageUtils.compress(data.photoFile, 800, 800, 0.85);
        const filename    = ImageUtils.generateFilename('applicant', 'jpg');
        const { data: uploadData, error: uploadError } = await this.db.storage
          .from(STORAGE_BUCKETS.APPLICATIONS)
          .upload(filename, compressed, { contentType: 'image/jpeg' });
        if (!uploadError && uploadData) photoUrl = ImageUtils.getPublicUrl(STORAGE_BUCKETS.APPLICATIONS, uploadData.path);
      } catch (e) { console.warn('Photo upload failed:', e); }

      const { error } = await this.db.from('membership_applications').insert({
        full_name:              data.full_name,
        email:                  data.email,
        phone:                  data.phone,
        date_of_birth:          data.date_of_birth,
        blood_group:            data.blood_group,
        professional_photo_url: photoUrl || null,
        area:                   data.area    || null,
        message:                data.message || null,
        status: 'pending'
      });
      if (error) throw error;

      showMsg('Application submitted successfully! We will contact you soon.', 'success');
      form.reset();
      if (document.getElementById('join-photo-label')) document.getElementById('join-photo-label').textContent = 'Click to upload photo (Max 5MB)';
      this.showToast('Membership application submitted!', 'success');
    } catch (err) {
      console.error('Join form error:', err);
      showMsg('Failed to submit application. Please try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send"></i><span>Submit Application</span>'; try { lucide.createIcons(); } catch (e) {} }
    }
  }

  setupBloodRequestForm() {
    const form      = document.getElementById('blood-request-form');
    if (!form) return;
    const dateInput = document.getElementById('blood-required-date');
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
    form.addEventListener('submit', async (e) => { e.preventDefault(); await this.submitBloodRequest(form); });
  }

  async submitBloodRequest(form) {
    const btn   = document.getElementById('blood-submit-btn');
    const msgEl = document.getElementById('blood-form-message');
    const showMsg = (msg, type) => { if (msgEl) { msgEl.textContent = msg; msgEl.className = `form-message ${type}`; } };

    const d = {
      patient_name:     form.patient_name?.value?.trim(),
      blood_group:      form.blood_group?.value,
      units_required:   parseInt(form.units_required?.value) || 1,
      hospital_name:    form.hospital_name?.value?.trim(),
      hospital_address: form.hospital_address?.value?.trim(),
      contact_name:     form.contact_name?.value?.trim(),
      contact_phone:    form.contact_phone?.value?.trim(),
      required_date:    form.required_date?.value,
      urgency_level:    form.urgency_level?.value || 'normal',
      additional_info:  form.additional_info?.value?.trim() || null
    };

    if (!d.patient_name)              { showMsg('Please enter patient name', 'error'); return; }
    if (!d.blood_group)               { showMsg('Please select blood group', 'error'); return; }
    if (!d.hospital_name)             { showMsg('Please enter hospital name', 'error'); return; }
    if (!d.hospital_address)          { showMsg('Please enter hospital address', 'error'); return; }
    if (!d.contact_name)              { showMsg('Please enter contact person name', 'error'); return; }
    if (!Validate.phone(d.contact_phone)) { showMsg('Please enter a valid contact phone number', 'error'); return; }
    if (!d.required_date)             { showMsg('Please enter required date', 'error'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2"></i><span>Submitting...</span>'; try { lucide.createIcons(); } catch (e) {} }

    try {
      const { error } = await this.db.from('blood_requests').insert(d);
      if (error) throw error;
      this.sendBloodRequestWhatsApp(d);
      showMsg('Blood request submitted! Our team will contact you immediately.', 'success');
      form.reset();
      this.showToast('Blood request submitted! Emergency alert sent.', 'success', 5000);
    } catch (err) {
      console.error('Blood request error:', err);
      showMsg('Failed to submit request. Please try again.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send"></i><span>Submit Blood Request</span>'; try { lucide.createIcons(); } catch (e) {} }
    }
  }

  sendBloodRequestWhatsApp(data) {
    const num1 = this.getSetting('whatsapp_blood_request_number1', CLUB_INFO.whatsappBloodRequest.number1);
    const num2 = this.getSetting('whatsapp_blood_request_number2', CLUB_INFO.whatsappBloodRequest.number2);
    const message = encodeURIComponent(
      `BLOOD REQUEST - ${(data.urgency_level||'normal').toUpperCase()}\n\n` +
      `Patient: ${data.patient_name}\n` +
      `Blood Group: ${data.blood_group} (${data.units_required} units)\n` +
      `Hospital: ${data.hospital_name}\n` +
      `Address: ${data.hospital_address}\n` +
      `Required by: ${DateUtils.format(data.required_date,'short')}\n` +
      `Contact: ${data.contact_name} - ${data.contact_phone}\n\n` +
      `From: Rotaract Club of Dr. N.G.P Arts & Science College`
    );
    [num1, num2].forEach(num => {
      if (!num) return;
      window.open(`https://api.whatsapp.com/send?phone=91${num.replace(/\D/g,'')} &text=${message}`, '_blank');
    });
  }

  /* ============================================================
     TICKER
     ============================================================ */
  setupTickerFromEvents() {
    const tickerContent = document.getElementById('ticker-content');
    if (!tickerContent || !this.allEvents.length) return;
    const recentEvents = this.allEvents.slice(0, 5);
    tickerContent.innerHTML =
      recentEvents.map(e =>
        `<span class="ticker-item">${StringUtils.sanitize(e.title)} — ${DateUtils.format(e.event_date,'short')}</span>
         <span class="ticker-sep">|</span>`
      ).join('') +
      `<span class="ticker-item">Club ID: 217835 | Rotary International District 3206 (Coimbatore | Pallakkad)</span>`;
  }

  /* ============================================================
     FOOTER LINKS
     ============================================================ */
  setupFooterLinks() {
    document.querySelectorAll('.footer-links a[data-scroll-filter]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const filter = link.getAttribute('data-scroll-filter');
        this.scrollToSection('projects');
        setTimeout(() => this.applyProjectFilter(filter), 600);
      });
    });
  }

  /* ============================================================
     REALTIME SUBSCRIPTIONS
     ============================================================ */
  setupRealtimeSubscriptions() {
    try {
      this.db.channel('public-events-changes')
        .on('postgres_changes', { event:'*', schema:'public', table:'events', filter:'status=eq.approved' }, async () => {
          await this.loadUpcomingEvents().catch(() => {});
          await this.loadCompletedEvents().catch(() => {});
          await this.loadStatistics().catch(() => {});
        })
        .subscribe();

      this.db.channel('public-blood-changes')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'blood_requests' }, () => {
          this.showToast('New blood request submitted', 'info');
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime setup error:', e);
    }
  }

  /* ============================================================
     TOAST NOTIFICATIONS
     ============================================================ */
  showToast(message, type = 'info', duration = 4000, title = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons  = { success:'check-circle', error:'alert-circle', warning:'alert-triangle', info:'info' };
    const titles = { success:'Success', error:'Error', warning:'Warning', info:'Information' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type]||'info'}" class="toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title || titles[type] || 'Notice'}</div>
        <div class="toast-message">${StringUtils.sanitize(message)}</div>
      </div>
      <button class="toast-close"><i data-lucide="x"></i></button>
    `;

    container.appendChild(toast);
    try { lucide.createIcons(); } catch (e) {}

    const remove = () => {
      toast.classList.add('removing');
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
    };
    toast.querySelector('.toast-close')?.addEventListener('click', remove);
    setTimeout(remove, duration);
  }
}

/* ============================================================
   GLOBAL APP INSTANCE
   ============================================================ */
let app;

document.addEventListener('DOMContentLoaded', () => {
  try {
    app = new RotaractApp();
    window.app = app;
  } catch (e) {
    console.error('App creation failed:', e);
    const screen = document.getElementById('loading-screen');
    if (screen) screen.classList.add('hidden');
  }
});

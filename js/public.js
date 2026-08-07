/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Public Page Logic - js/public.js
   Handles all public-facing dynamic content and interactions
   ============================================================ */

'use strict';

/* ============================================================
   PUBLIC PAGE MANAGER CLASS
   ============================================================ */
class PublicPageManager {
  constructor() {
    this.db = getSupabaseClient();
    this.clubSettings = {};
    this.isInitialized = false;
    this.observerInstances = [];
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.lazyLoadObserver = null;
  }

  /* ============================================================
     INITIALIZE
     ============================================================ */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    await this.loadClubSettings();
    this.setupLazyLoading();
    this.setupIntersectionObserver();
    this.setupResizeHandler();
    this.setupKeyboardShortcuts();
    this.setupPrintHandler();
    this.setupOfflineDetection();
    this.initTicker();
  }

  /* ============================================================
     CLUB SETTINGS
     ============================================================ */
  async loadClubSettings() {
    try {
      const { data } = await this.db
        .from('club_settings')
        .select('key, value');

      if (data) {
        data.forEach(s => {
          this.clubSettings[s.key] = s.value;
        });
      }
    } catch (e) {
      console.warn('PublicPageManager: settings load failed', e);
    }
  }

  getSetting(key, fallback = '') {
    return this.clubSettings[key] || fallback;
  }

  /* ============================================================
     LAZY LOADING FOR IMAGES
     ============================================================ */
  setupLazyLoading() {
    this.lazyLoadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute('data-src');
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
            }
            this.lazyLoadObserver.unobserve(img);
          }
        });
      },
      { rootMargin: '100px', threshold: 0.01 }
    );

    document.querySelectorAll('img[data-src]').forEach(img => {
      this.lazyLoadObserver.observe(img);
    });
  }

  addLazyImage(img) {
    if (this.lazyLoadObserver && img) {
      this.lazyLoadObserver.observe(img);
    }
  }

  /* ============================================================
     INTERSECTION OBSERVER FOR ANIMATIONS
     ============================================================ */
  setupIntersectionObserver() {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            const animClass = entry.target.getAttribute('data-animate');
            if (animClass) {
              entry.target.classList.add(animClass);
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('[data-animate]').forEach(el => {
      this.intersectionObserver.observe(el);
    });
  }

  /* ============================================================
     RESIZE HANDLER
     ============================================================ */
  setupResizeHandler() {
    const onResize = debounce(() => {
      this.handleResize();
    }, 250);

    window.addEventListener('resize', onResize);
  }

  handleResize() {
    const mobileBreakpoint = 768;
    const isMobile = window.innerWidth < mobileBreakpoint;

    const ticker = document.querySelector('.ticker-content');
    if (ticker) {
      ticker.style.animationDuration = isMobile ? '20s' : '30s';
    }
  }

  /* ============================================================
     KEYBOARD SHORTCUTS
     ============================================================ */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
      }
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        document.getElementById('members')?.scrollIntoView({ behavior: 'smooth' });
      }
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
      }
      if (e.altKey && e.key === 'j') {
        e.preventDefault();
        document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' });
      }
      if (e.altKey && e.key === 't') {
        e.preventDefault();
        document.getElementById('theme-toggle')?.click();
      }
    });
  }

  /* ============================================================
     PRINT HANDLER
     ============================================================ */
  setupPrintHandler() {
    window.addEventListener('beforeprint', () => {
      document.querySelectorAll('.collapsed').forEach(el => {
        el.classList.remove('collapsed');
        el.setAttribute('data-was-collapsed', 'true');
      });
    });

    window.addEventListener('afterprint', () => {
      document.querySelectorAll('[data-was-collapsed]').forEach(el => {
        el.classList.add('collapsed');
        el.removeAttribute('data-was-collapsed');
      });
    });
  }

  /* ============================================================
     OFFLINE DETECTION
     ============================================================ */
  setupOfflineDetection() {
    const showOfflineBanner = () => {
      if (document.getElementById('offline-banner')) return;
      const banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.style.cssText = `
        position:fixed;top:72px;left:0;right:0;
        background:var(--warning);color:#000;
        text-align:center;padding:10px;
        font-size:0.85rem;font-weight:600;
        z-index:9998;display:flex;
        align-items:center;justify-content:center;gap:8px;
      `;
      banner.innerHTML = `
        <i data-lucide="wifi-off" style="width:16px;height:16px;"></i>
        <span>You are currently offline. Some features may not be available.</span>
      `;
      document.body.appendChild(banner);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    const hideOfflineBanner = () => {
      document.getElementById('offline-banner')?.remove();
    };

    window.addEventListener('offline', showOfflineBanner);
    window.addEventListener('online', hideOfflineBanner);
    if (!navigator.onLine) showOfflineBanner();
  }

  /* ============================================================
     TICKER INITIALIZATION
     ============================================================ */
  initTicker() {
    const ticker = document.querySelector('.ticker-content');
    if (!ticker) return;

    ticker.addEventListener('mouseenter', () => {
      ticker.style.animationPlayState = 'paused';
    });
    ticker.addEventListener('mouseleave', () => {
      ticker.style.animationPlayState = 'running';
    });
  }

  /* ============================================================
     NEWSLETTER — LINK TYPE DETECTOR
     Handles Google Drive, Docs, PDF, Issuu, Flipbook,
     Canva, Dropbox, OneDrive, direct image, plain link
     ============================================================ */
  detectLinkType(url) {
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
     NEWSLETTER — LINK TYPE LABEL & ICON
     ============================================================ */
  getLinkTypeMeta(type) {
    const map = {
      gdrive:   { label: 'Google Drive', icon: 'hard-drive',    color: '#1e3a8a' },
      gdocs:    { label: 'Google Docs',  icon: 'file-text',     color: '#1e3a8a' },
      pdf:      { label: 'PDF',          icon: 'file-type',     color: '#dc2626' },
      issuu:    { label: 'Issuu',        icon: 'book-open',     color: '#f97316' },
      flip:     { label: 'Flipbook',     icon: 'book',          color: '#8b5cf6' },
      canva:    { label: 'Canva',        icon: 'layout',        color: '#06b6d4' },
      dropbox:  { label: 'Dropbox',      icon: 'cloud',         color: '#0061ff' },
      onedrive: { label: 'OneDrive',     icon: 'cloud',         color: '#0078d4' },
      image:    { label: 'Image',        icon: 'image',         color: '#059669' },
      link:     { label: 'Online Link',  icon: 'link',          color: '#6366f1' },
      unknown:  { label: 'Document',     icon: 'file',          color: '#64748b' },
    };
    return map[type] || map.unknown;
  }

  /* ============================================================
     NEWSLETTER — CARD COLORS (gradient per index)
     ============================================================ */
  getCardGradient(index) {
    const gradients = [
      'linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%)',
      'linear-gradient(135deg,#7c3aed 0%,#a78bfa 100%)',
      'linear-gradient(135deg,#0f766e 0%,#34d399 100%)',
      'linear-gradient(135deg,#b45309 0%,#fbbf24 100%)',
      'linear-gradient(135deg,#be123c 0%,#fb7185 100%)',
      'linear-gradient(135deg,#4338ca 0%,#818cf8 100%)',
      'linear-gradient(135deg,#065f46 0%,#6ee7b7 100%)',
    ];
    return gradients[index % gradients.length];
  }

  /* ============================================================
     NEWSLETTER — RENDER SINGLE CARD
     Uses exact Supabase columns:
       id, title, month, pdf_url, description,
       is_published, published_at, created_at, updated_at
     pdf_url stores Google Drive links (or any external link)
     ============================================================ */
  renderNewsletterCard(newsletter, index = 0) {
    /* ── Column mapping (exact Supabase column names) ── */
    const url       = (newsletter.pdf_url || '').trim();
    const title     = (newsletter.title || 'Bulletin').trim();
    const month     = newsletter.month || '';
    const desc      = newsletter.description || '';
    const pubAt     = newsletter.published_at || newsletter.created_at || '';

    /* ── Detect link type ── */
    const type      = this.detectLinkType(url);
    const meta      = this.getLinkTypeMeta(type);
    const gradient  = this.getCardGradient(index);

    /* ── Format date ── */
    let dateStr = '';
    if (pubAt) {
      try {
        dateStr = new Date(pubAt).toLocaleDateString('en-IN', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
      } catch (e) { dateStr = pubAt; }
    }

    /* ── Safe strings for onclick ── */
    const safeTitle = title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeUrl   = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    /* ── SVG icons (inline, no Lucide dependency) ── */
    const SVG_EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`;

    const SVG_EXT = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>`;

    const SVG_DOC = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24"
      fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>`;

    const SVG_CAL = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`;

    return `
      <div class="nl-card" style="
        display:flex;flex-direction:column;
        border-radius:16px;overflow:hidden;
        height:100%;
        background:var(--neu-bg,#f0f0f3);
        box-shadow:6px 6px 12px rgba(0,0,0,.08),-6px -6px 12px rgba(255,255,255,.9);
        transition:transform .3s ease,box-shadow .3s ease;
      " onmouseover="this.style.transform='translateY(-5px)'"
         onmouseout="this.style.transform=''">

        <!-- ── Preview Banner ── -->
        <div style="
          position:relative;width:100%;height:190px;
          display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          gap:10px;padding:20px;text-align:center;
          flex-shrink:0;overflow:hidden;
          background:${gradient};
        ">
          <!-- Type badge -->
          <span style="
            position:absolute;top:10px;left:10px;
            background:rgba(0,0,0,.55);color:#fff;
            font-size:.58rem;font-weight:700;
            letter-spacing:.7px;text-transform:uppercase;
            padding:3px 10px;border-radius:20px;
            font-family:Poppins,sans-serif;
          ">${StringUtils.sanitize(meta.label)}</span>

          ${SVG_DOC}

          <p style="
            color:rgba(255,255,255,.93);font-size:.88rem;
            font-weight:600;margin:0;line-height:1.3;
            font-family:Poppins,sans-serif;
            display:-webkit-box;-webkit-line-clamp:2;
            -webkit-box-orient:vertical;overflow:hidden;
          ">${StringUtils.sanitize(title)}</p>

          ${month ? `<p style="
            color:rgba(255,255,255,.62);font-size:.72rem;
            margin:0;font-family:Poppins,sans-serif;
          ">${StringUtils.sanitize(month)}</p>` : ''}
        </div>

        <!-- ── Card Body ── -->
        <div style="
          padding:14px;display:flex;
          flex-direction:column;gap:6px;flex:1;
        ">
          <h4 style="
            margin:0;font-size:.9rem;font-weight:700;
            color:var(--text-primary,#1e293b);
            line-height:1.4;font-family:Poppins,sans-serif;
          ">${StringUtils.sanitize(title)}</h4>

          ${(dateStr || month) ? `
          <p style="
            display:flex;align-items:center;gap:5px;
            font-size:.72rem;color:var(--text-muted,#64748b);
            font-family:Poppins,sans-serif;margin:0;
          ">
            ${SVG_CAL}
            ${dateStr || StringUtils.sanitize(month)}
          </p>` : ''}

          ${desc ? `<p style="
            margin:0;font-size:.78rem;
            color:var(--text-secondary,#475569);
            line-height:1.5;flex:1;
            display:-webkit-box;-webkit-line-clamp:2;
            -webkit-box-orient:vertical;overflow:hidden;
            font-family:Poppins,sans-serif;
          ">${StringUtils.sanitize(desc)}</p>` : '<div style="flex:1"></div>'}
        </div>

        <!-- ── Action Buttons ── -->
        <div style="
          display:flex;gap:8px;
          padding:8px 14px 14px;
        ">
          ${url ? `
          <!-- VIEW button → opens inline viewer modal -->
          <button
            type="button"
            onclick="event.stopPropagation();
              if(window.openNewsletterViewer){
                window.openNewsletterViewer({
                  title:'${safeTitle}',
                  pdf_url:'${safeUrl}'
                });
              } else {
                window.open('${safeUrl}','_blank','noopener,noreferrer');
              }"
            style="
              flex:1;display:inline-flex;align-items:center;
              justify-content:center;gap:6px;
              padding:9px 12px;border-radius:8px;
              font-size:.78rem;font-weight:600;
              cursor:pointer;transition:all .2s ease;
              font-family:Poppins,sans-serif;
              white-space:nowrap;border:none;
              background:var(--primary,#1e3a8a);color:#fff;
              min-width:80px;
            "
            onmouseover="this.style.opacity='.85';this.style.transform='translateY(-1px)'"
            onmouseout="this.style.opacity='1';this.style.transform=''"
          >${SVG_EYE} View</button>

          <!-- OPEN button → opens link in new tab -->
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
              cursor:pointer;transition:all .2s ease;
              font-family:Poppins,sans-serif;
              white-space:nowrap;
              background:transparent;
              color:var(--primary,#1e3a8a);
              border:2px solid var(--primary,#1e3a8a);
              text-decoration:none;min-width:80px;
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
  }

  /* ============================================================
     NEWSLETTER — FETCH & RENDER ALL (called from app.js)
     ============================================================ */
  async loadNewsletters() {
    const wrapper  = document.getElementById('newsletters-swiper-wrapper');
    const placeholder = document.getElementById('newsletters-placeholder');
    const loading  = document.getElementById('newsletters-loading');

    if (!wrapper) return;
    if (loading) loading.style.display = 'block';

    try {
      /* Fetch only published newsletters, newest first */
      const { data, error } = await this.db
        .from('newsletters')
        .select('id,title,month,pdf_url,description,is_published,published_at,created_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      if (loading) loading.style.display = 'none';

      const published = (data || []).filter(n =>
        n.is_published === true || n.is_published === 1
      );

      if (!published.length) {
        wrapper.innerHTML = '';
        if (placeholder) placeholder.style.display = 'block';
        return;
      }

      if (placeholder) placeholder.style.display = 'none';
      wrapper.innerHTML = '';

      /* Build slides */
      published.forEach((nl, i) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        /* Store data on slide for fallback patcher in index.html */
        slide.dataset.fileUrl = nl.pdf_url || '';
        slide.dataset.title   = nl.title || 'Bulletin';
        slide.innerHTML = this.renderNewsletterCard(nl, i);
        wrapper.appendChild(slide);
      });

      /* Init / reinit Swiper */
      this._initNewsletterSwiper(published.length);

      if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
      console.error('[Newsletters] Load error:', err);
      if (loading) loading.style.display = 'none';
      if (placeholder) placeholder.style.display = 'block';
    }
  }

  /* ============================================================
     NEWSLETTER — INIT SWIPER
     ============================================================ */
  _initNewsletterSwiper(count) {
    const el = document.querySelector('.newsletters-swiper');
    if (!el) return;

    /* Destroy existing instance */
    if (el.swiper) {
      try { el.swiper.destroy(true, true); } catch (e) { /* noop */ }
    }

    if (typeof Swiper === 'undefined') return;

    new Swiper('.newsletters-swiper', {
      slidesPerView: 'auto',
      spaceBetween: 20,
      grabCursor: true,
      centeredSlides: false,
      loop: count > 3,
      pagination: {
        el: '.newsletters-pagination',
        clickable: true,
      },
      navigation: {
        prevEl: '.newsletters-prev',
        nextEl: '.newsletters-next',
      },
      breakpoints: {
        320:  { slidesPerView: 1.12, spaceBetween: 12 },
        480:  { slidesPerView: 1.4,  spaceBetween: 14 },
        640:  { slidesPerView: 1.9,  spaceBetween: 16 },
        768:  { slidesPerView: 2.3,  spaceBetween: 18 },
        1024: { slidesPerView: 3,    spaceBetween: 20 },
        1280: { slidesPerView: 3.5,  spaceBetween: 22 },
      },
    });
  }

  /* ============================================================
     RENDER UPCOMING EVENT CARD (Enhanced)
     ============================================================ */
  renderUpcomingEventCard(event) {
    const avenue = AVENUES[event.avenue] || {};
    const daysUntil = DateUtils.daysUntil(event.event_date);

    const urgencyClass = daysUntil === 0 ? 'today' :
      daysUntil === 1 ? 'tomorrow' :
        daysUntil <= 3 ? 'soon' : 'normal';

    const urgencyColors = {
      today: 'var(--danger)',
      tomorrow: 'var(--warning)',
      soon: 'var(--accent)',
      normal: 'var(--success)'
    };

    return `
      <div class="upcoming-card neu-card" data-event-id="${event.id}" data-urgency="${urgencyClass}">
        <div style="position:relative;overflow:hidden;border-radius:var(--border-radius) var(--border-radius) 0 0;">
          ${event.poster_url
        ? `<img
              src="${StringUtils.sanitize(event.poster_url)}"
              alt="${StringUtils.sanitize(event.title)}"
              class="upcoming-card-poster"
              loading="lazy"
              onerror="this.parentElement.innerHTML='<div class=\\"upcoming-card-poster-placeholder\\"><i data-lucide=\\"image\\"></i></div>'"
            />`
        : `<div class="upcoming-card-poster-placeholder">
              <i data-lucide="calendar-check"></i>
            </div>`
      }
          <div style="
            position:absolute;top:12px;right:12px;
            padding:4px 10px;border-radius:var(--border-radius-full);
            background:${urgencyColors[urgencyClass]};color:#fff;
            font-size:0.7rem;font-weight:700;
            backdrop-filter:blur(8px);
          ">
            ${daysUntil === 0 ? 'Today!' :
        daysUntil === 1 ? 'Tomorrow!' :
          `${daysUntil} days`}
          </div>
        </div>
        <div class="upcoming-card-body">
          <span class="upcoming-card-avenue project-avenue-badge badge-${event.avenue}"
                style="background:${avenue.bgColor};color:${avenue.color}">
            <i data-lucide="${avenue.icon || 'folder'}"></i>
            ${avenue.label || StringUtils.snakeToTitle(event.avenue)}
          </span>
          <h3 class="upcoming-card-title">${StringUtils.sanitize(event.title)}</h3>
          <div class="upcoming-card-meta">
            <div class="upcoming-meta-item">
              <i data-lucide="calendar"></i>
              <span>${DateUtils.format(event.event_date, 'long')}</span>
            </div>
            <div class="upcoming-meta-item">
              <i data-lucide="clock"></i>
              <span>${DateUtils.formatTime(event.start_time)}
                ${event.end_time ? ' – ' + DateUtils.formatTime(event.end_time) : ''}
              </span>
            </div>
            <div class="upcoming-meta-item">
              <i data-lucide="map-pin"></i>
              <span>${StringUtils.sanitize(event.venue)}</span>
            </div>
            <div class="upcoming-meta-item">
              <i data-lucide="user-check"></i>
              <span>${StringUtils.sanitize(event.event_chair)}</span>
            </div>
            ${event.event_secretary ? `
            <div class="upcoming-meta-item">
              <i data-lucide="user"></i>
              <span>${StringUtils.sanitize(event.event_secretary)}</span>
            </div>` : ''}
            ${event.collaboration && event.collaboration !== 'none' ? `
            <div class="upcoming-meta-item">
              <i data-lucide="handshake"></i>
              <span>${COLLABORATION_TYPES[event.collaboration] || event.collaboration}
                ${event.collaborator_name ? ` - ${StringUtils.sanitize(event.collaborator_name)}` : ''}
              </span>
            </div>` : ''}
            ${event.expected_attendance ? `
            <div class="upcoming-meta-item">
              <i data-lucide="users"></i>
              <span>Expected: ${event.expected_attendance}</span>
            </div>` : ''}
          </div>
          ${event.description ? `
          <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;
                     display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${StringUtils.sanitize(event.description)}
          </p>` : ''}
          <div class="upcoming-card-actions">
            <button
              class="btn btn-primary btn-sm"
              onclick="if(window.app)app.openProjectModal('${event.id}')"
            >
              <i data-lucide="info"></i>
              <span>More Details</span>
            </button>
            <button
              class="btn btn-outline btn-sm"
              onclick="if(window.app)app.addToCalendar('${event.id}')"
            >
              <i data-lucide="calendar-plus"></i>
              <span>Add to Calendar</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     RENDER PROJECT CARD (Enhanced)
     ============================================================ */
  renderProjectCard(event) {
    const avenue = AVENUES[event.avenue] || {};
    const photos = event.event_photos || [];
    const posterUrl = event.poster_url ||
      photos.find(p => !p.is_action_photo)?.photo_url ||
      photos[0]?.photo_url || null;

    const hasReport = event.event_reports?.some(r => r.is_approved);
    const actionPhotoCount = photos.filter(p => p.is_action_photo).length;

    return `
      <div class="project-card neu-card"
           data-event-id="${event.id}"
           data-avenue="${event.avenue}"
           onclick="if(window.app)app.openProjectModal('${event.id}')"
           role="button"
           tabindex="0"
           aria-label="View details of ${StringUtils.sanitize(event.title)}"
           onkeydown="if(event.key==='Enter'&&window.app)app.openProjectModal('${event.id}')"
      >
        <div class="project-card-image-wrap">
          ${posterUrl
        ? `<img
              src="${StringUtils.sanitize(posterUrl)}"
              alt="${StringUtils.sanitize(event.title)}"
              class="project-card-image"
              loading="lazy"
              onerror="this.parentElement.innerHTML='<div class=\\"project-card-image-placeholder\\"><i data-lucide=\\"image\\"></i></div>'"
            />`
        : `<div class="project-card-image-placeholder">
              <i data-lucide="image"></i>
            </div>`
      }
          <div class="project-card-overlay">
            <div class="project-card-overlay-btn">
              <i data-lucide="eye"></i>
              <span>View Details</span>
            </div>
          </div>
          ${event.is_dpp ? `
          <div style="
            position:absolute;top:10px;left:10px;
            padding:3px 10px;border-radius:var(--border-radius-full);
            background:var(--avenue-dpp);color:#fff;
            font-size:0.65rem;font-weight:700;
          ">DPP</div>` : ''}
        </div>
        <div class="project-card-body">
          <div class="project-card-header">
            <h3 class="project-card-title">${StringUtils.sanitize(event.title)}</h3>
            <span class="project-avenue-badge badge-${event.avenue}"
                  style="background:${avenue.bgColor};color:${avenue.color}">
              ${avenue.shortLabel || StringUtils.snakeToTitle(event.avenue)}
            </span>
          </div>
          <p class="project-card-description">
            ${StringUtils.truncate(StringUtils.sanitize(event.description || ''), 120)}
          </p>
          <div class="project-card-meta">
            <div class="project-meta-item">
              <i data-lucide="calendar"></i>
              <span>${DateUtils.format(event.event_date, 'short')}</span>
            </div>
            <div class="project-meta-item">
              <i data-lucide="clock"></i>
              <span>${DateUtils.formatTime(event.start_time)}</span>
            </div>
            <div class="project-meta-item">
              <i data-lucide="map-pin"></i>
              <span>${StringUtils.truncate(StringUtils.sanitize(event.venue), 28)}</span>
            </div>
            ${event.actual_attendance ? `
            <div class="project-meta-item">
              <i data-lucide="users"></i>
              <span>${event.actual_attendance} attended</span>
            </div>` : ''}
            ${actionPhotoCount > 0 ? `
            <div class="project-meta-item">
              <i data-lucide="image"></i>
              <span>${actionPhotoCount} photo${actionPhotoCount > 1 ? 's' : ''}</span>
            </div>` : ''}
            ${hasReport ? `
            <div class="project-meta-item" style="color:var(--success)">
              <i data-lucide="file-check"></i>
              <span>Report available</span>
            </div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     RENDER MEMBER CARD (Enhanced)
     ============================================================ */
  renderMemberCard(member) {
    const portfolio = member.portfolio ||
      ROLE_DISPLAY_NAMES[member.role] || 'Member';

    return `
      <div class="member-card neu-card"
           data-blood="${member.blood_group || ''}"
           data-board="${member.is_board_member ? 'board' : 'member'}"
           data-name="${StringUtils.sanitize(member.full_name).toLowerCase()}"
           onclick="if(window.publicManager)publicManager.openMemberDetail('${member.id}')"
           role="button"
           tabindex="0"
           aria-label="View profile of ${StringUtils.sanitize(member.full_name)}"
      >
        ${member.is_board_member ? `
        <div class="member-board-badge">
          <i data-lucide="star"></i>
          <span>Board</span>
        </div>` : ''}

        <div class="member-photo-wrap">
          ${member.professional_photo_url
        ? `<img
              src="${StringUtils.sanitize(member.professional_photo_url)}"
              alt="${StringUtils.sanitize(member.full_name)}"
              class="member-photo"
              loading="lazy"
              onerror="this.outerHTML='<div class=\\"member-photo-placeholder\\"><i data-lucide=\\"user\\"></i></div>'"
            />`
        : `<div class="member-photo-placeholder">
              <i data-lucide="user"></i>
            </div>`
      }
          ${member.blood_group ? `
          <div class="member-blood-badge">${StringUtils.sanitize(member.blood_group)}</div>
          ` : ''}
        </div>

        <div class="member-name">${StringUtils.sanitize(member.full_name)}</div>

        <span class="member-portfolio">
          <i data-lucide="briefcase"></i>
          ${StringUtils.sanitize(portfolio)}
        </span>

        <div class="member-details">
          ${member.ri_id ? `
          <div class="member-detail-item">
            <i data-lucide="hash"></i>
            <span>RI ID: ${StringUtils.sanitize(member.ri_id)}</span>
          </div>` : ''}
          ${member.area ? `
          <div class="member-detail-item">
            <i data-lucide="map-pin"></i>
            <span>${StringUtils.sanitize(member.area)}</span>
          </div>` : ''}
          ${member.avenue ? `
          <div class="member-detail-item">
            <i data-lucide="layers"></i>
            <span>${AVENUES[member.avenue]?.label || StringUtils.snakeToTitle(member.avenue)}</span>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  /* ============================================================
     MEMBER DETAIL MODAL (Public)
     ============================================================ */
  openMemberDetail(memberId) {
    if (window.app) {
      const member = window.app.allMembers?.find(m => m.id === memberId);
      if (member) {
        window.app.openMemberModal(member);
        return;
      }
    }
    this.fetchMemberById(memberId).then(member => {
      if (member && window.app) {
        window.app.openMemberModal(member);
      }
    });
  }

  async fetchMemberById(memberId) {
    try {
      const { data, error } = await this.db
        .from('members')
        .select('*')
        .eq('id', memberId)
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Fetch member error:', e);
      return null;
    }
  }

  /* ============================================================
     RENDER PAST LEADER TIMELINE (Enhanced)
     ============================================================ */
  renderPastLeaderTimeline(leaders) {
    if (!leaders || leaders.length === 0) {
      return `
        <div class="neu-card placeholder-card">
          <i data-lucide="users"></i>
          <p>Past leaders information will be updated soon</p>
        </div>
      `;
    }

    const yearGroups = {};
    leaders.forEach(leader => {
      if (!yearGroups[leader.rotary_year]) {
        yearGroups[leader.rotary_year] = [];
      }
      yearGroups[leader.rotary_year].push(leader);
    });

    const sortedYears = Object.keys(yearGroups).sort((a, b) => {
      const yearA = parseInt(a.split('-')[0]);
      const yearB = parseInt(b.split('-')[0]);
      return yearB - yearA;
    });

    return sortedYears.map((year, groupIndex) => {
      const yearLeaders = yearGroups[year];

      const presidents = yearLeaders.filter(l =>
        l.portfolio.toLowerCase().includes('president') &&
        !l.portfolio.toLowerCase().includes('past') &&
        !l.portfolio.toLowerCase().includes('vice')
      );
      const secretaries = yearLeaders.filter(l =>
        l.portfolio.toLowerCase().includes('secretary')
      );
      const others = yearLeaders.filter(l =>
        !presidents.find(p => p.id === l.id) &&
        !secretaries.find(s => s.id === l.id)
      );

      const leftLeaders  = [...presidents, ...others.slice(0, Math.ceil(others.length / 2))];
      const rightLeaders = [...secretaries, ...others.slice(Math.ceil(others.length / 2))];

      return `
        <div class="timeline-year-group" data-aos="fade-up" data-aos-delay="${groupIndex * 80}">
          <div class="timeline-year-label">Rotary Year ${year}</div>
          <div class="timeline-year-dot"></div>
          <div class="timeline-leaders-row">
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${leftLeaders.map(l => this.renderLeaderCard(l, 'left')).join('')}
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${rightLeaders.map(l => this.renderLeaderCard(l, 'right')).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderLeaderCard(leader, side) {
    const isPresident = leader.portfolio.toLowerCase().includes('president');
    const photoHtml = leader.photo_url
      ? `<img
          src="${StringUtils.sanitize(leader.photo_url)}"
          alt="${StringUtils.sanitize(leader.full_name)}"
          class="timeline-leader-photo"
          loading="lazy"
          onerror="this.outerHTML='<div class=\\"timeline-leader-photo-placeholder\\"><i data-lucide=\\"user\\"></i></div>'"
        />`
      : `<div class="timeline-leader-photo-placeholder">
          <i data-lucide="user"></i>
        </div>`;

    return `
      <div class="timeline-leader-card neu-card ${side}">
        ${photoHtml}
        <div class="timeline-leader-info">
          <h4>${StringUtils.sanitize(leader.full_name)}</h4>
          <div class="timeline-leader-portfolio">
            <i data-lucide="${isPresident ? 'crown' : 'briefcase'}"></i>
            ${StringUtils.sanitize(leader.portfolio)}
          </div>
          <span class="timeline-leader-year">
            Rotary Year ${StringUtils.sanitize(leader.rotary_year)}
          </span>
          ${leader.email ? `
          <a href="mailto:${StringUtils.sanitize(leader.email)}"
             class="timeline-leader-email"
             style="font-size:0.72rem;color:var(--accent);margin-top:4px;display:flex;align-items:center;gap:4px;"
             onclick="event.stopPropagation()">
            <i data-lucide="mail" style="width:12px;height:12px;"></i>
            ${StringUtils.sanitize(leader.email)}
          </a>` : ''}
        </div>
      </div>
    `;
  }

  /* ============================================================
     STATISTICS RENDERER
     ============================================================ */
  async renderStatistics() {
    try {
      const { data, error } = await this.db
        .from('club_statistics')
        .select('*')
        .single();

      if (error || !data) return;

      const statConfigs = [
        { id: 'stat-projects', value: data.total_projects       || 0 },
        { id: 'stat-members',  value: data.total_members        || 0 },
        { id: 'stat-hours',    value: Math.round(data.total_service_hours || 0) },
        { id: 'stat-lives',    value: data.total_beneficiaries  || 0 },
      ];

      statConfigs.forEach(({ id, value }) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('data-target', value);
      });
    } catch (e) {
      console.warn('Statistics render error:', e);
    }
  }

  /* ============================================================
     BLOOD GROUP STATISTICS
     ============================================================ */
  async renderBloodGroupStats(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const { data, error } = await this.db
        .from('members')
        .select('blood_group')
        .eq('is_active', true)
        .not('blood_group', 'is', null);

      if (error) throw error;

      const counts = {};
      BLOOD_GROUPS.forEach(bg => counts[bg] = 0);
      data?.forEach(m => {
        if (m.blood_group && counts[m.blood_group] !== undefined) {
          counts[m.blood_group]++;
        }
      });

      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          ${Object.entries(counts).map(([bg, count]) => `
            <div class="neu-card" style="padding:16px;text-align:center;">
              <div style="
                width:44px;height:44px;border-radius:50%;
                background:var(--danger-light);color:var(--danger);
                display:flex;align-items:center;justify-content:center;
                margin:0 auto 8px;font-size:0.85rem;font-weight:800;
              ">${bg}</div>
              <div style="font-size:1.4rem;font-weight:800;color:var(--text-heading);">${count}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);">
                ${total > 0 ? Math.round((count / total) * 100) : 0}%
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      console.warn('Blood group stats error:', e);
    }
  }

  /* ============================================================
     GLOBAL SEARCH
     ============================================================ */
  async globalSearch(query) {
    if (!query || query.trim().length < 2) return { events: [], members: [] };
    const term = query.toLowerCase().trim();
    try {
      const [eventsRes, membersRes] = await Promise.all([
        this.db
          .from('events')
          .select('id,title,description,avenue,event_date,venue,status')
          .or(`title.ilike.%${term}%,description.ilike.%${term}%,venue.ilike.%${term}%`)
          .eq('status', 'completed')
          .limit(10),
        this.db
          .from('members')
          .select('id,full_name,portfolio,role,blood_group,area')
          .or(`full_name.ilike.%${term}%,portfolio.ilike.%${term}%,area.ilike.%${term}%`)
          .eq('is_active', true)
          .limit(10)
      ]);
      return { events: eventsRes.data || [], members: membersRes.data || [] };
    } catch (e) {
      console.warn('Global search error:', e);
      return { events: [], members: [] };
    }
  }

  /* ============================================================
     RENDER SEARCH RESULTS
     ============================================================ */
  renderSearchResults(results, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { events, members } = results;

    if (events.length === 0 && members.length === 0) {
      container.innerHTML = `
        <div class="neu-card placeholder-card">
          <i data-lucide="search-x"></i>
          <p>No results found</p>
        </div>
      `;
      return;
    }

    let html = '';

    if (events.length > 0) {
      html += `
        <div class="search-section">
          <h4 style="font-size:0.85rem;font-weight:700;color:var(--text-muted);
                     text-transform:uppercase;letter-spacing:0.06em;
                     margin-bottom:12px;padding-bottom:8px;
                     border-bottom:1px solid var(--border-color);">
            <i data-lucide="calendar-check" style="width:14px;height:14px;"></i>
            Projects (${events.length})
          </h4>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${events.map(e => `
              <div class="neu-card"
                   style="padding:14px;cursor:pointer;transition:var(--transition);"
                   onclick="if(window.app)app.openProjectModal('${e.id}')"
                   onmouseover="this.style.transform='translateX(4px)'"
                   onmouseout="this.style.transform=''"
              >
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:36px;height:36px;border-radius:var(--border-radius-sm);
                               background:${AVENUES[e.avenue]?.bgColor || 'var(--accent-light)'};
                               display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i data-lucide="${AVENUES[e.avenue]?.icon || 'folder'}"
                       style="width:18px;height:18px;color:${AVENUES[e.avenue]?.color || 'var(--accent)'}"></i>
                  </div>
                  <div>
                    <div style="font-size:0.88rem;font-weight:600;color:var(--text-heading);">
                      ${StringUtils.sanitize(e.title)}
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">
                      ${DateUtils.format(e.event_date, 'short')} | ${StringUtils.sanitize(e.venue)}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (members.length > 0) {
      html += `
        <div class="search-section" style="margin-top:16px;">
          <h4 style="font-size:0.85rem;font-weight:700;color:var(--text-muted);
                     text-transform:uppercase;letter-spacing:0.06em;
                     margin-bottom:12px;padding-bottom:8px;
                     border-bottom:1px solid var(--border-color);">
            <i data-lucide="users" style="width:14px;height:14px;"></i>
            Members (${members.length})
          </h4>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${members.map(m => `
              <div class="neu-card"
                   style="padding:14px;cursor:pointer;transition:var(--transition);"
                   onclick="if(window.publicManager)publicManager.openMemberDetail('${m.id}')"
                   onmouseover="this.style.transform='translateX(4px)'"
                   onmouseout="this.style.transform=''"
              >
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:36px;height:36px;border-radius:50%;
                               background:var(--accent-light);
                               display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i data-lucide="user" style="width:18px;height:18px;color:var(--accent)"></i>
                  </div>
                  <div>
                    <div style="font-size:0.88rem;font-weight:600;color:var(--text-heading);">
                      ${StringUtils.sanitize(m.full_name)}
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">
                      ${StringUtils.sanitize(m.portfolio || ROLE_DISPLAY_NAMES[m.role] || 'Member')}
                      ${m.blood_group ? ` | ${m.blood_group}` : ''}
                      ${m.area ? ` | ${StringUtils.sanitize(m.area)}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  /* ============================================================
     GLOBAL SEARCH MODAL
     ============================================================ */
  setupGlobalSearch() {
    const searchOverlay = document.createElement('div');
    searchOverlay.id = 'global-search-overlay';
    searchOverlay.style.cssText = `
      position:fixed;inset:0;
      background:rgba(0,0,0,0.6);
      backdrop-filter:blur(8px);
      z-index:9000;
      display:flex;
      align-items:flex-start;
      justify-content:center;
      padding:80px 24px 24px;
      opacity:0;visibility:hidden;
      transition:var(--transition);
    `;

    searchOverlay.innerHTML = `
      <div style="
        width:100%;max-width:600px;
        background:var(--bg-card);
        border-radius:var(--border-radius-lg);
        box-shadow:var(--neu-shadow-xl);
        overflow:hidden;
      ">
        <div style="
          padding:16px 20px;
          border-bottom:1px solid var(--border-color);
          display:flex;align-items:center;gap:12px;
        ">
          <i data-lucide="search" style="width:20px;height:20px;color:var(--accent);flex-shrink:0;"></i>
          <input
            type="text"
            id="global-search-input"
            placeholder="Search projects, members, events..."
            style="
              flex:1;border:none;outline:none;
              background:none;
              font-family:'Poppins',sans-serif;
              font-size:1rem;
              color:var(--text-primary);
            "
          />
          <button
            id="global-search-close"
            style="
              width:32px;height:32px;border-radius:50%;
              background:var(--bg-secondary);border:none;
              display:flex;align-items:center;justify-content:center;
              cursor:pointer;color:var(--text-muted);
            "
          >
            <i data-lucide="x" style="width:16px;height:16px;"></i>
          </button>
        </div>
        <div id="global-search-results" style="
          max-height:400px;overflow-y:auto;
          padding:16px;
        ">
          <div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:24px;">
            Start typing to search...
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(searchOverlay);

    const input     = document.getElementById('global-search-input');
    const closeBtn  = document.getElementById('global-search-close');
    const resultsEl = document.getElementById('global-search-results');

    const searchDebounced = debounce(async (query) => {
      if (!query || query.trim().length < 2) {
        if (resultsEl) resultsEl.innerHTML = `
          <div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:24px;">
            Start typing to search...
          </div>`;
        return;
      }
      if (resultsEl) resultsEl.innerHTML = `
        <div style="text-align:center;padding:24px;">
          <div class="loading-lines" style="width:80%;margin:0 auto;">
            <div class="loading-line"></div>
            <div class="loading-line"></div>
            <div class="loading-line"></div>
          </div>
        </div>`;
      const results = await this.globalSearch(query);
      this.renderSearchResults(results, 'global-search-results');
    }, 400);

    if (input) input.addEventListener('input', (e) => searchDebounced(e.target.value));

    const closeSearch = () => {
      searchOverlay.style.opacity = '0';
      searchOverlay.style.visibility = 'hidden';
      if (input) input.value = '';
      if (resultsEl) resultsEl.innerHTML = `
        <div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:24px;">
          Start typing to search...
        </div>`;
    };

    const openSearch = () => {
      searchOverlay.style.opacity = '1';
      searchOverlay.style.visibility = 'visible';
      setTimeout(() => input?.focus(), 100);
    };

    if (closeBtn) closeBtn.addEventListener('click', closeSearch);
    searchOverlay.addEventListener('click', (e) => { if (e.target === searchOverlay) closeSearch(); });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape') closeSearch();
    });

    this.addSearchButtonToNav(openSearch);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  addSearchButtonToNav(openSearchFn) {
    const navControls = document.querySelector('.nav-controls');
    if (!navControls) return;

    const searchBtn = document.createElement('button');
    searchBtn.className = 'neu-btn theme-toggle';
    searchBtn.title = 'Search (Ctrl+K)';
    searchBtn.setAttribute('aria-label', 'Search');
    searchBtn.innerHTML = '<i data-lucide="search" style="width:18px;height:18px;"></i>';
    searchBtn.addEventListener('click', openSearchFn);

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) navControls.insertBefore(searchBtn, themeToggle);
    else navControls.prepend(searchBtn);

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  /* ============================================================
     COPY TO CLIPBOARD
     ============================================================ */
  async copyToClipboard(text, successMsg = 'Copied!') {
    try {
      await navigator.clipboard.writeText(text);
      window.app?.showToast(successMsg, 'success', 2000);
      return true;
    } catch (e) {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      window.app?.showToast(successMsg, 'success', 2000);
      return true;
    }
  }

  /* ============================================================
     SMOOTH SCROLL WITH OFFSET
     ============================================================ */
  smoothScrollTo(elementId, offset = 80) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  /* ============================================================
     IMAGE GALLERY
     ============================================================ */
  openImageGallery(images, startIndex = 0) {
    if (!images || images.length === 0) return;
    if (window.app) {
      window.app.lightboxImages = images;
      window.app.openLightbox(startIndex);
    }
  }

  /* ============================================================
     FORMAT EVENT DETAILS
     ============================================================ */
  formatEventDetails(event) {
    const avenue = AVENUES[event.avenue] || {};
    const status = EVENT_STATUS[event.status] || {};
    return {
      title: event.title,
      date: DateUtils.format(event.event_date, 'long'),
      time: `${DateUtils.formatTime(event.start_time)}${event.end_time ? ' to ' + DateUtils.formatTime(event.end_time) : ''}`,
      venue: event.venue,
      avenue: avenue.label || StringUtils.snakeToTitle(event.avenue),
      avenueColor: avenue.color,
      avenueBg: avenue.bgColor,
      status: status.label || event.status,
      statusColor: status.color,
      chair: event.event_chair,
      secretary: event.event_secretary,
      collaboration: event.collaboration !== 'none'
        ? `${COLLABORATION_TYPES[event.collaboration] || event.collaboration}${event.collaborator_name ? ' - ' + event.collaborator_name : ''}`
        : null,
      attendance: event.actual_attendance,
      beneficiaries: event.beneficiaries,
      serviceHours: event.service_hours,
      isDPP: event.is_dpp,
      group: event.group_number
    };
  }

  /* ============================================================
     AVENUE STATISTICS
     ============================================================ */
  async loadAvenueStatistics() {
    try {
      const { data, error } = await this.db
        .from('events')
        .select('avenue')
        .eq('status', 'completed');

      if (error) throw error;

      const counts = {
        club_service: 0,
        community_service: 0,
        professional_service: 0,
        international_service: 0,
        district_priority_projects: 0
      };

      data?.forEach(event => {
        if (counts[event.avenue] !== undefined) counts[event.avenue]++;
      });

      const idMap = {
        club_service:              'count-club-service',
        community_service:         'count-community-service',
        professional_service:      'count-professional-service',
        international_service:     'count-international-service',
        district_priority_projects:'count-dpp'
      };

      Object.entries(counts).forEach(([avenue, count]) => {
        const el = document.getElementById(idMap[avenue]);
        if (el) el.textContent = count;
      });

      return counts;
    } catch (e) {
      console.warn('Avenue stats error:', e);
      return {};
    }
  }

  /* ============================================================
     TOOLTIP SYSTEM
     ============================================================ */
  setupTooltips() {
    const tooltip = document.createElement('div');
    tooltip.id = 'global-tooltip';
    tooltip.style.cssText = `
      position:fixed;
      background:var(--text-heading);color:var(--text-inverse);
      padding:6px 12px;border-radius:var(--border-radius-sm);
      font-size:0.75rem;font-weight:500;
      pointer-events:none;z-index:9999;
      opacity:0;transition:opacity 0.2s ease;
      white-space:nowrap;box-shadow:var(--neu-shadow-sm);
    `;
    document.body.appendChild(tooltip);

    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (!target) return;
      tooltip.textContent = target.getAttribute('data-tooltip');
      tooltip.style.opacity = '1';
    });
    document.addEventListener('mousemove', (e) => {
      if (tooltip.style.opacity === '1') {
        tooltip.style.left = `${e.clientX + 12}px`;
        tooltip.style.top  = `${e.clientY - 32}px`;
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('[data-tooltip]')) tooltip.style.opacity = '0';
    });
  }

  /* ============================================================
     SHARE BUTTONS
     ============================================================ */
  getShareButtons(title, url, text) {
    const t = encodeURIComponent(title);
    const u = encodeURIComponent(url || window.location.href);
    const d = encodeURIComponent(text || title);

    return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
          <i data-lucide="facebook"></i><span>Facebook</span>
        </a>
        <a href="https://twitter.com/intent/tweet?text=${d}&url=${u}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
          <i data-lucide="twitter"></i><span>Twitter</span>
        </a>
        <a href="https://wa.me/?text=${d}%20${u}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
          <i data-lucide="message-circle"></i><span>WhatsApp</span>
        </a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
          <i data-lucide="linkedin"></i><span>LinkedIn</span>
        </a>
      </div>
    `;
  }

  /* ============================================================
     CLEANUP
     ============================================================ */
  destroy() {
    this.observerInstances.forEach(obs => obs.disconnect());
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.lazyLoadObserver?.disconnect();
    this.isInitialized = false;
  }
}

/* ============================================================
   PUBLIC STYLES
   ============================================================ */
const publicStyles = `
  img[data-src] { opacity:0; transition:opacity 0.4s ease; }
  img.loaded    { opacity:1; }

  [data-animate] {
    opacity:0; transform:translateY(20px);
    transition:opacity 0.6s ease, transform 0.6s ease;
  }
  [data-animate].in-view { opacity:1; transform:translateY(0); }

  #global-search-overlay { transition:opacity 0.25s ease,visibility 0.25s ease; }
  #global-search-input::placeholder { color:var(--text-muted); }
  #global-tooltip { max-width:200px;white-space:normal;text-align:center; }

  .timeline-leader-card.right::before {
    content:'';position:absolute;left:-20px;top:50%;
    transform:translateY(-50%);width:20px;height:2px;background:var(--accent);
  }
  .timeline-leader-card.left::after {
    content:'';position:absolute;right:-20px;top:50%;
    transform:translateY(-50%);width:20px;height:2px;background:var(--accent);
  }
  @media(max-width:1024px){
    .timeline-leader-card.left::after,
    .timeline-leader-card.right::before { display:none; }
  }

  #offline-banner { transition:transform 0.3s ease; }
  .search-section { animation:fadeIn 0.3s ease; }

  .upcoming-card[data-urgency="today"]    { border-left:3px solid var(--danger);  }
  .upcoming-card[data-urgency="tomorrow"] { border-left:3px solid var(--warning); }
  .upcoming-card[data-urgency="soon"]     { border-left:3px solid var(--accent);  }

  /* Newsletter card hover fix */
  .nl-card { cursor:default; }
`;

/* ============================================================
   INJECT PUBLIC STYLES
   ============================================================ */
(function injectPublicStyles() {
  if (!document.getElementById('public-styles')) {
    const style = document.createElement('style');
    style.id = 'public-styles';
    style.textContent = publicStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const publicManager = new PublicPageManager();
window.publicManager = publicManager;

/* ============================================================
   AUTO INITIALIZE
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  await publicManager.init();
  publicManager.setupGlobalSearch();
  publicManager.setupTooltips();
  await publicManager.loadAvenueStatistics();

  /* Load newsletters from Supabase */
  await publicManager.loadNewsletters();
});

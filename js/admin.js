/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Admin Dashboard Controller - js/admin.js
   Complete admin panel with role-based access
   ============================================================ */

'use strict';

class AdminDashboard {
  constructor() {
    this.db = getSupabaseClient();
    this.auth = window.authManager;
    this.admin = null;
    this.currentSection = 'dashboard';
    this.sidebarCollapsed = false;
    this.pendingCounts = {};
    this.realtimeChannels = [];
    this.currentRotaryYear = DateUtils.getCurrentRotaryYear();
    this._initialized = false;
    this._nlCache = {};

    this._boot();
  }

  /* ============================================================
     BOOT
     ============================================================ */
  async _boot() {
    try {
      if (!this.auth || !this.auth.isAuthenticated()) { this._showLogin(); return; }
      await this.auth.refreshProfile?.();          // pick up role / portfolio changes made since last login
      this.admin = this.auth.getAdmin();
      if (!this.admin) { this._showLogin(); return; }

      this._hideLoading();
      this._renderLayout();
      await this._loadPendingCounts();
      this._renderSidebar();
      this._setupEventListeners();
      this._applyTheme(Storage.get('theme') || 'light');

      await this.navigateTo('dashboard');

      this._setupRealtime();
      this._startChatBackground();
      this._initPalette();
      this._initConnectionBanner();
      this._startBirthdayChecker();
      this._setupMeetingTimers();

      lucide.createIcons();
      this._initialized = true;
    } catch (err) {
      console.error('Admin boot error:', err);
      this._hideLoading();
      this._showError('Failed to initialize admin panel. Please refresh.');
    }
  }

  _showLogin() {
    const appEl   = document.getElementById('admin-app');
    const loginEl = document.getElementById('admin-login-container');
    if (appEl)   appEl.style.display = 'none';
    if (loginEl) {
      loginEl.style.display = 'block';
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      const ui = new AdminLoginUI(this.auth);
      ui.renderLoginForm('admin-login-container');
    }
    this._hideLoading();
    lucide.createIcons();
  }

  _hideLoading() {
    if (window._adminLoadingFallback) clearTimeout(window._adminLoadingFallback);
    const s = document.getElementById('loading-screen');
    if (s) setTimeout(() => s.classList.add('hidden'), 200);
  }

  _showError(msg) {
    const app = document.getElementById('admin-app');
    if (app) {
      app.style.display = 'flex';
      app.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;padding:24px;">
          <div class="neu-card" style="padding:40px;text-align:center;max-width:400px;">
            <i data-lucide="alert-circle" style="width:48px;height:48px;color:var(--danger);margin:0 auto 16px;display:block;"></i>
            <h2 style="color:var(--text-heading);margin-bottom:8px;">Error</h2>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:20px;">${this._safe(msg)}</p>
            <button class="btn btn-primary" onclick="window.location.reload()">
              <i data-lucide="refresh-cw"></i><span>Refresh</span>
            </button>
          </div>
        </div>`;
      lucide.createIcons();
    }
  }

  /* ============================================================
     RENDER LAYOUT
     ============================================================ */
  _renderLayout() {
    const app = document.getElementById('admin-app');
    if (!app) return;
    app.style.display = 'flex';
    app.innerHTML = `
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="admin-sidebar-header">
          <div class="admin-sidebar-logo">
            <img src="https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713317/ngp_logo_colourAsset_2_2x-8_lu8zgf.png"
                 alt="Logo" class="admin-logo-img" />
            <div class="admin-sidebar-brand">
              <span class="admin-brand-name">Rotaract Club</span>
              <span class="admin-brand-college">Dr. N.G.P Arts &amp; Science</span>
            </div>
          </div>
          <button class="admin-sidebar-toggle neu-btn" id="sidebar-toggle" title="Toggle Sidebar">
            <i data-lucide="panel-left-close" id="sidebar-toggle-icon" style="width:16px;height:16px;"></i>
          </button>
        </div>

        <div class="admin-user-card neu-card">
          <div class="admin-user-avatar-lg">
            <i data-lucide="user-circle-2" style="width:22px;height:22px;color:var(--accent);"></i>
          </div>
          <div class="admin-user-info-text">
            <span class="admin-user-name-lg" id="admin-name-display">${this._safe(this.admin.full_name)}</span>
            <span class="admin-user-role-badge" id="admin-role-display">
              ${this._safe(RoleUtils.labels(this.admin).join(' · ') || this.admin.role)}
            </span>
          </div>
        </div>

        <nav class="admin-nav" id="admin-nav"></nav>

        <div class="admin-sidebar-footer">
          <a href="../index.html" class="admin-sidebar-item" target="_blank">
            <i data-lucide="external-link" class="admin-sidebar-icon"></i>
            <span class="admin-nav-label">View Website</span>
          </a>
          <button class="admin-sidebar-item" id="admin-logout-btn">
            <i data-lucide="log-out" class="admin-sidebar-icon"></i>
            <span class="admin-nav-label">Sign Out</span>
          </button>
        </div>
      </aside>

      <main class="admin-main" id="admin-main">
        <header class="admin-topbar" id="admin-topbar">
          <div class="admin-topbar-left">
            <button class="neu-btn admin-mobile-sidebar-btn" id="mobile-sidebar-btn" style="width:38px;height:38px;">
              <i data-lucide="menu" style="width:18px;height:18px;"></i>
            </button>
            <div class="admin-breadcrumb" id="admin-breadcrumb">
              <i data-lucide="layout-dashboard" style="width:16px;height:16px;color:var(--accent);"></i>
              <span>Dashboard</span>
            </div>
          </div>
          <div class="admin-topbar-right">
            <button class="neu-btn admin-topbar-btn" id="admin-notif-btn"
                    title="Notifications" style="width:38px;height:38px;position:relative;">
              <i data-lucide="bell" style="width:18px;height:18px;"></i>
              <span class="admin-notif-badge" id="admin-notif-count" style="display:none;">0</span>
            </button>
            <button class="neu-btn admin-topbar-btn" id="admin-theme-toggle"
                    title="Toggle Theme" style="width:38px;height:38px;">
              <i data-lucide="sun"  id="admin-theme-icon-light" style="width:17px;height:17px;"></i>
              <i data-lucide="moon" id="admin-theme-icon-dark" class="hidden" style="width:17px;height:17px;"></i>
            </button>
            <div class="admin-topbar-user">
              <div class="admin-topbar-avatar">
                <i data-lucide="user-circle-2" style="width:18px;height:18px;color:var(--accent);"></i>
              </div>
              <div class="admin-topbar-user-info">
                <span id="topbar-admin-name">${this._safe(this.admin.full_name)}</span>
                <span id="topbar-admin-role">${this._safe(RoleUtils.labels(this.admin).join(' · ') || this.admin.role)}</span>
              </div>
            </div>
          </div>
        </header>

        <div class="admin-content" id="admin-content">
          <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
            <div class="loading-single-line" style="width:200px;">
              <div class="loading-line-track"><div class="loading-line-fill"></div></div>
            </div>
          </div>
        </div>
      </main>

      <div class="admin-mobile-overlay" id="admin-mobile-overlay"></div>

      <div class="toast-container" id="admin-toast-container"
           style="position:fixed;top:90px;right:24px;z-index:9999;
                  display:flex;flex-direction:column;gap:10px;
                  max-width:380px;width:calc(100vw - 48px);"></div>

      <div class="admin-confirm-overlay" id="admin-confirm-overlay"
           style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);
                  backdrop-filter:blur(8px);z-index:9999;align-items:center;
                  justify-content:center;padding:24px;">
        <div class="admin-confirm-dialog neu-card">
          <div class="admin-confirm-icon" id="admin-confirm-icon">
            <i data-lucide="alert-triangle" style="width:32px;height:32px;"></i>
          </div>
          <h3 id="admin-confirm-title">Are you sure?</h3>
          <p id="admin-confirm-message">This action cannot be undone.</p>
          <div class="admin-confirm-actions">
            <button class="btn btn-outline" id="admin-confirm-cancel">Cancel</button>
            <button class="btn btn-danger"  id="admin-confirm-ok">Confirm</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================
     SIDEBAR
     ============================================================ */
  _renderSidebar() {
    const nav = document.getElementById('admin-nav');
    if (!nav) return;
    nav.innerHTML = this._getMenuItems().map(item => this._renderNavItem(item)).join('');
  }

  _getMenuItems() {
    const all = [
      { id:'dashboard',      label:'Dashboard',         icon:'layout-dashboard', roles:'all' },
      { id:'chat',           label:'Team Chat',         icon:'message-circle',   roles:'all' },
      { id:'events',         label:'Events & Projects', icon:'calendar-check',   roles:'all',
        children:[
          { id:'events-list',    label:'All Events',       icon:'list',         roles:'all' },
          { id:'events-add',     label:'Add Event',        icon:'plus-circle',  roles:PERMISSIONS.CREATE_EVENT },
          { id:'events-pending', label:'Pending Approval', icon:'clock',        roles:PERMISSIONS.APPROVE_EVENT }
        ]},
      { id:'reports',        label:'Reports',           icon:'file-text',        roles:PERMISSIONS.SUBMIT_REPORT,
        children:[
          { id:'reports-list',    label:'All Reports',     icon:'list',         roles:PERMISSIONS.SUBMIT_REPORT },
          { id:'reports-monthly', label:'Monthly Reports', icon:'calendar',     roles:PERMISSIONS.DOWNLOAD_MONTHLY_REPORT },
          { id:'reports-dpp',     label:'DPP Reports',     icon:'star',         roles:PERMISSIONS.SUBMIT_REPORT }
        ]},
      { id:'meetings',       label:'Meetings',          icon:'users',            roles:PERMISSIONS.CREATE_MEETING,
        children:[
          { id:'meetings-list',       label:'All Meetings',    icon:'list',         roles:PERMISSIONS.CREATE_MEETING },
          { id:'meetings-add',        label:'Schedule Meeting', icon:'plus-circle',  roles:PERMISSIONS.CREATE_MEETING },
          { id:'meetings-attendance', label:'Attendance',       icon:'check-square', roles:PERMISSIONS.VIEW_MEETING_ATTENDANCE }
        ]},
      { id:'treasury',       label:'Treasury',          icon:'indian-rupee',     roles:PERMISSIONS.VIEW_TREASURY,
        children:[
          { id:'treasury-overview',     label:'Overview',        icon:'bar-chart',  roles:PERMISSIONS.VIEW_TREASURY },
          { id:'treasury-transactions', label:'Transactions',    icon:'list',       roles:PERMISSIONS.VIEW_TREASURY },
          { id:'treasury-add',          label:'Add Transaction', icon:'plus-circle',roles:PERMISSIONS.MANAGE_TREASURY },
          { id:'treasury-budget',       label:'Budget',          icon:'target',     roles:PERMISSIONS.MANAGE_TREASURY },
          { id:'treasury-statements',   label:'Statements',      icon:'download',   roles:PERMISSIONS.DOWNLOAD_TREASURY }
        ]},
      { id:'members',        label:'Members',           icon:'users-2',          roles:PERMISSIONS.MANAGE_MEMBERS,
        children:[
          { id:'members-list',  label:'All Members',   icon:'list',      roles:PERMISSIONS.MANAGE_MEMBERS },
          { id:'members-add',   label:'Add Member',    icon:'user-plus', roles:PERMISSIONS.MANAGE_MEMBERS },
          { id:'members-board', label:'Board Members', icon:'star',      roles:PERMISSIONS.MANAGE_MEMBERS }
        ]},
      { id:'applications',   label:'Applications',      icon:'inbox',            roles:PERMISSIONS.REVIEW_APPLICATIONS },
      { id:'newsletters',    label:'Bulletins',         icon:'newspaper',        roles:PERMISSIONS.MANAGE_NEWSLETTERS },
      { id:'blood-requests', label:'Blood Requests',    icon:'droplets',         roles:PERMISSIONS.MANAGE_BLOOD_REQUESTS },
      { id:'past-leaders',   label:'Past Leaders',      icon:'crown',            roles:PERMISSIONS.MANAGE_PAST_LEADERS },
      { id:'notifications',  label:'Notifications',     icon:'bell',             roles:PERMISSIONS.SEND_NOTIFICATIONS },
      { id:'email-center',   label:'Email Center',      icon:'mail',             roles:PERMISSIONS.SEND_BULK_EMAIL },
      { id:'logs',           label:'Activity Logs',     icon:'activity',         roles:PERMISSIONS.VIEW_LOGS },
      { id:'admin-users',    label:'Admin Users',       icon:'shield-check',     roles:PERMISSIONS.MANAGE_ADMINS },
      { id:'settings',       label:'Site Settings',     icon:'settings',         roles:PERMISSIONS.MANAGE_SETTINGS }
    ];
    return all.filter(item => this._canAccess(item.roles));
  }

  _canAccess(roles) {
    if (!roles || roles === 'all') return true;
    const arr = Array.isArray(roles) ? roles : [roles];
    const mine = RoleUtils.all(this.admin);
    return arr.some(r => mine.includes(r));
  }

  _renderNavItem(item) {
    const badge = (this.pendingCounts[item.id] || 0) > 0
      ? `<span class="admin-sidebar-badge">${this.pendingCounts[item.id]}</span>`
      : '';

    if (item.children && item.children.length > 0) {
      const accessible = item.children.filter(c => this._canAccess(c.roles));
      if (!accessible.length) return '';
      return `
        <div class="admin-nav-group">
          <button class="admin-sidebar-item admin-nav-group-toggle"
                  onclick="adminDashboard._toggleGroup('${item.id}')">
            <i data-lucide="${item.icon}" class="admin-sidebar-icon"></i>
            <span class="admin-nav-label">${item.label}</span>
            ${badge}
            <i data-lucide="chevron-down" class="admin-nav-chevron"
               id="chevron-${item.id}"
               ></i>
          </button>
          <div class="admin-nav-children" id="nav-children-${item.id}" style="display:none;">
            ${accessible.map(child => `
              <button class="admin-sidebar-item admin-sidebar-child"
                      data-section="${child.id}"
                      onclick="adminDashboard.navigateTo('${child.id}')">
                <i data-lucide="${child.icon}" class="admin-sidebar-icon"></i>
                <span class="admin-nav-label">${child.label}</span>
                ${(this.pendingCounts[child.id] || 0) > 0
                  ? `<span class="admin-sidebar-badge">${this.pendingCounts[child.id]}</span>` : ''}
              </button>`).join('')}
          </div>
        </div>`;
    }

    return `
      <button class="admin-sidebar-item" data-section="${item.id}"
              onclick="adminDashboard.navigateTo('${item.id}')">
        <i data-lucide="${item.icon}" class="admin-sidebar-icon"></i>
        <span class="admin-nav-label">${item.label}</span>
        ${badge}
      </button>`;
  }

  _toggleGroup(groupId) {
    const children = document.getElementById(`nav-children-${groupId}`);
    const chevron  = document.getElementById(`chevron-${groupId}`);
    if (!children) return;
    const isOpen = children.style.display !== 'none';
    children.style.display = isOpen ? 'none' : 'flex';
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  }

  /* ============================================================
     EVENT LISTENERS
     ============================================================ */
  _setupEventListeners() {
    document.getElementById('sidebar-toggle')?.addEventListener('click',   () => this._toggleSidebar());
    document.getElementById('mobile-sidebar-btn')?.addEventListener('click', () => this._openMobileSidebar());
    document.getElementById('admin-mobile-overlay')?.addEventListener('click', () => this._closeMobileSidebar());
    document.getElementById('admin-notif-btn')?.addEventListener('click',   () => this.navigateTo('notifications'));
    document.getElementById('admin-theme-toggle')?.addEventListener('click', () => {
      this._applyTheme((Storage.get('theme') || 'light') === 'dark' ? 'light' : 'dark');
    });
    document.getElementById('admin-logout-btn')?.addEventListener('click', () => {
      this.confirmAction('Sign Out', 'Are you sure you want to sign out?',
        () => this.auth.logout('You have been signed out successfully'), 'log-out');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this._closeMobileSidebar(); this._closeConfirmDialog(); }
    });
  }

  /* ============================================================
     NAVIGATION
     ============================================================ */
  async navigateTo(section) {
    this.currentSection = section;
    this._updateBreadcrumb(section);
    this._closeMobileSidebar();

    document.querySelectorAll('.admin-sidebar-item[data-section]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-section') === section);
    });

    const content = document.getElementById('admin-content');
    if (!content) return;
    if (this.chat && this.chat.mounted && section !== 'chat') this.chat.unmount();
    if (section !== 'chat') content.classList.remove('is-chat');

    content.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
        <div class="loading-single-line" style="width:200px;">
          <div class="loading-line-track"><div class="loading-line-fill"></div></div>
        </div>
      </div>`;

    try {
      await this._loadSection(section, content);
    } catch (err) {
      console.error(`Section error [${section}]:`, err);
      content.innerHTML = `
        <div style="padding:40px;text-align:center;">
          <div class="neu-card placeholder-card">
            <i data-lucide="alert-circle" style="color:var(--danger);"></i>
            <p>Failed to load this section. Please try again.</p>
            <button class="btn btn-outline" onclick="adminDashboard.navigateTo('${section}')">
              <i data-lucide="refresh-cw"></i><span>Retry</span>
            </button>
          </div>
        </div>`;
      lucide.createIcons();
    }
  }

  async _loadSection(section, content) {
    switch (section) {
      case 'dashboard':              await this._renderDashboard(content); break;
      case 'chat':                   await this._renderChat(content); break;
      case 'events-list':
      case 'events':
        if (window.eventsAdmin)    await window.eventsAdmin.renderEventsList(content, this);
        else content.innerHTML = this._loadingStub('Events'); break;
      case 'events-add':
        if (window.eventsAdmin)    await window.eventsAdmin.showEventForm();
        else content.innerHTML = this._loadingStub('Add Event'); break;
      case 'events-pending':
        if (window.eventsAdmin)    await window.eventsAdmin.renderPendingEvents(content, this);
        else content.innerHTML = this._loadingStub('Pending Events'); break;
      case 'reports-list':
      case 'reports':
        if (window.reportsAdmin)   await window.reportsAdmin.renderReportsList(content, this);
        else content.innerHTML = this._loadingStub('Reports'); break;
      case 'reports-monthly':
        if (window.reportsAdmin)   await window.reportsAdmin.renderMonthlyReports(content, this);
        else content.innerHTML = this._loadingStub('Monthly Reports'); break;
      case 'reports-dpp':
        if (window.reportsAdmin)   await window.reportsAdmin.renderDPPReports(content, this);
        else content.innerHTML = this._loadingStub('DPP Reports'); break;
      case 'meetings-list':
      case 'meetings':
        if (window.meetingsAdmin)  await window.meetingsAdmin.renderMeetingsList(content, this);
        else content.innerHTML = this._loadingStub('Meetings'); break;
      case 'meetings-add':
        if (window.meetingsAdmin)  window.meetingsAdmin.showMeetingForm(); break;
      case 'meetings-attendance':
        if (window.meetingsAdmin)  await window.meetingsAdmin.renderAttendance(content, this);
        else content.innerHTML = this._loadingStub('Attendance'); break;
      case 'treasury-overview':
      case 'treasury':
        if (window.treasuryAdmin)  await window.treasuryAdmin.renderOverview(content, this);
        else content.innerHTML = this._loadingStub('Treasury'); break;
      case 'treasury-transactions':
        if (window.treasuryAdmin)  await window.treasuryAdmin.renderTransactions(content, this);
        else content.innerHTML = this._loadingStub('Transactions'); break;
      case 'treasury-add':
        if (window.treasuryAdmin)  window.treasuryAdmin.renderTransactionForm(content, this);
        else content.innerHTML = this._loadingStub('Add Transaction'); break;
      case 'treasury-budget':
        if (window.treasuryAdmin)  await window.treasuryAdmin.renderBudget(content, this);
        else content.innerHTML = this._loadingStub('Budget'); break;
      case 'treasury-statements':
        if (window.treasuryAdmin)  window.treasuryAdmin.renderStatements(content, this);
        else content.innerHTML = this._loadingStub('Statements'); break;
      case 'members-list':
      case 'members':
        if (window.membersAdmin)   await window.membersAdmin.renderMembersList(content, this);
        else content.innerHTML = this._loadingStub('Members'); break;
      case 'members-add':
        if (window.membersAdmin)   window.membersAdmin.showMemberForm();
        else content.innerHTML = this._loadingStub('Add Member'); break;
      case 'members-board':
        if (window.membersAdmin)   await window.membersAdmin.renderBoardMembers(content, this);
        else content.innerHTML = this._loadingStub('Board Members'); break;
      case 'applications':
        if (window.membersAdmin)   await window.membersAdmin.renderApplications(content, this);
        else content.innerHTML = this._loadingStub('Applications'); break;
      case 'newsletters':
        await this._renderNewsletters(content); break;
      case 'blood-requests':
        if (window.membersAdmin)   await window.membersAdmin.renderBloodRequests(content, this);
        else content.innerHTML = this._loadingStub('Blood Requests'); break;
      case 'past-leaders':
        if (window.membersAdmin)   await window.membersAdmin.renderPastLeaders(content, this);
        else content.innerHTML = this._loadingStub('Past Leaders'); break;
      case 'notifications':
        if (window.membersAdmin)   await window.membersAdmin.renderNotifications(content, this);
        else content.innerHTML = this._loadingStub('Notifications'); break;
      case 'email-center':
        if (window.emailService)   window.emailService.renderEmailCenter(content, this);
        else content.innerHTML = this._loadingStub('Email Center'); break;
      case 'logs':
        await this._renderActivityLogs(content); break;
      case 'admin-users':
        await this._renderAdminUsers(content); break;
      case 'settings':
        await this._renderSettings(content); break;
      default:
        content.innerHTML = `
          <div style="padding:40px;text-align:center;">
            <div class="neu-card placeholder-card">
              <i data-lucide="search-x"></i>
              <p>Section "${section}" not found</p>
            </div>
          </div>`;
        lucide.createIcons();
    }
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  async _renderDashboard(container) {
    const [stats, upcoming, activity, birthdays] = await Promise.all([
      this._loadDashboardStats(),
      this._loadUpcomingEvents(),
      this._loadRecentActivity(),
      this._loadUpcomingBirthdays()
    ]);

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="layout-dashboard"></i> Dashboard
          </h1>
          <p class="admin-section-subtitle">
            Welcome back, ${this._safe(this.admin.full_name)}! &nbsp;${DateUtils.format(new Date(), 'long')}
          </p>
        </div>
        <div class="admin-section-actions">
          <button class="btn btn-outline btn-sm"
                  onclick="adminDashboard._renderDashboard(document.getElementById('admin-content'))">
            <i data-lucide="refresh-cw"></i><span>Refresh</span>
          </button>
        </div>
      </div>

      <div class="admin-stats-grid">${this._renderStatCards(stats)}</div>

      ${this._getQuickActions().length ? `
      <div class="admin-card neu-card" style="margin-bottom:24px;">
        <div class="admin-card-header">
          <h3><i data-lucide="zap"></i> Quick Actions</h3>
        </div>
        <div class="admin-quick-actions">
          ${this._getQuickActions().map(a => `
            <button class="admin-quick-action-btn neu-btn" onclick="adminDashboard.navigateTo('${a.section}')">
              <div class="admin-quick-action-icon"><i data-lucide="${a.icon}"></i></div>
              <span>${a.label}</span>
            </button>`).join('')}
        </div>
      </div>` : ''}

      <div class="admin-dashboard-grid">
        <div class="admin-card neu-card">
          <div class="admin-card-header">
            <h3><i data-lucide="calendar-clock"></i> Upcoming Events</h3>
            <button class="btn btn-outline btn-sm" onclick="adminDashboard.navigateTo('events-list')">
              <span>View All</span><i data-lucide="arrow-right"></i>
            </button>
          </div>
          ${this._renderUpcomingWidget(upcoming)}
        </div>

        <div class="admin-card neu-card">
          <div class="admin-card-header">
            <h3><i data-lucide="activity"></i> Recent Activity</h3>
          </div>
          ${this._renderActivityWidget(activity)}
        </div>

        <div class="admin-card neu-card">
          <div class="admin-card-header">
            <h3><i data-lucide="cake"></i> Upcoming Birthdays</h3>
          </div>
          ${this._renderBirthdayWidget(birthdays)}
        </div>

        ${this.auth.can('VIEW_TREASURY') ? `
        <div class="admin-card neu-card">
          <div class="admin-card-header">
            <h3><i data-lucide="indian-rupee"></i> Treasury Snapshot</h3>
            <button class="btn btn-outline btn-sm" onclick="adminDashboard.navigateTo('treasury-overview')">
              <span>View</span><i data-lucide="arrow-right"></i>
            </button>
          </div>
          <div id="treasury-snap-container">
            <div class="loading-single-line" style="width:80%;margin:20px auto;">
              <div class="loading-line-track"><div class="loading-line-fill"></div></div>
            </div>
          </div>
        </div>` : ''}
      </div>
    `;

    lucide.createIcons();
    if (this.auth.can('VIEW_TREASURY')) this._loadTreasurySnapshot();
  }

  async _loadDashboardStats() {
    try {
      const [ev, pend, mem, apps, blood, news] = await Promise.all([
        this.db.from('events').select('id', { count:'exact', head:true }).eq('status','completed'),
        this.auth.can('APPROVE_EVENT')
          ? this.db.from('events').select('id', { count:'exact', head:true }).eq('status','pending_approval')
          : Promise.resolve({ count:0 }),
        this.db.from('members').select('id', { count:'exact', head:true }).eq('is_active',true),
        this.auth.can('REVIEW_APPLICATIONS')
          ? this.db.from('membership_applications').select('id', { count:'exact', head:true }).eq('status','pending')
          : Promise.resolve({ count:0 }),
        this.auth.can('MANAGE_BLOOD_REQUESTS')
          ? this.db.from('blood_requests').select('id', { count:'exact', head:true }).eq('status','active')
          : Promise.resolve({ count:0 }),
        this.db.from('newsletters').select('id', { count:'exact', head:true }).eq('is_published',true)
      ]);
      return {
        completedEvents:      ev.count    || 0,
        pendingApprovals:     pend.count  || 0,
        totalMembers:         mem.count   || 0,
        pendingApplications:  apps.count  || 0,
        activeBloodRequests:  blood.count || 0,
        publishedNewsletters: news.count  || 0
      };
    } catch (e) { console.warn('Stats error:', e); return {}; }
  }

  _renderStatCards(stats) {
    const cards = [
      { label:'Completed Events',    value:stats.completedEvents     ||0, icon:'folder-check', section:'events-list',    show:true,                                   alert:false },
      { label:'Pending Approvals',   value:stats.pendingApprovals    ||0, icon:'clock',         section:'events-pending', show:this.auth.can('APPROVE_EVENT'),          alert:(stats.pendingApprovals||0)>0 },
      { label:'Active Members',      value:stats.totalMembers        ||0, icon:'users',          section:'members-list',   show:true,                                   alert:false },
      { label:'New Applications',    value:stats.pendingApplications ||0, icon:'inbox',          section:'applications',   show:this.auth.can('REVIEW_APPLICATIONS'),   alert:(stats.pendingApplications||0)>0 },
      { label:'Blood Requests',      value:stats.activeBloodRequests ||0, icon:'droplets',       section:'blood-requests', show:this.auth.can('MANAGE_BLOOD_REQUESTS'), alert:(stats.activeBloodRequests||0)>0 },
      { label:'Published Bulletins', value:stats.publishedNewsletters||0, icon:'newspaper',      section:'newsletters',    show:true,                                   alert:false }
    ];
    return cards.filter(c => c.show).map(c => `
      <div class="admin-stat-card neu-card ${c.alert ? 'admin-stat-alert' : ''}"
           onclick="adminDashboard.navigateTo('${c.section}')" style="cursor:pointer;">
        <div class="admin-stat-card-header">
          <div class="admin-stat-icon-wrap" style="background:var(--accent-light);">
            <i data-lucide="${c.icon}" style="width:22px;height:22px;color:var(--accent);"></i>
          </div>
          ${c.alert ? '<div class="admin-stat-alert-dot"></div>' : ''}
        </div>
        <div class="admin-stat-value">${(c.value||0).toLocaleString('en-IN')}</div>
        <div class="admin-stat-label">${c.label}</div>
      </div>`).join('');
  }

  async _loadUpcomingEvents() {
    try {
      const { data } = await this.db.from('events')
        .select('id,title,avenue,event_date,start_time,venue,status')
        .in('status', ['approved','pending_approval'])
        .gte('event_date', new Date().toLocalISODate())
        .order('event_date', { ascending:true }).limit(5);
      return data || [];
    } catch (e) { return []; }
  }

  _renderUpcomingWidget(events) {
    if (!events || !events.length)
      return `<div class="admin-empty-state"><i data-lucide="calendar-x"></i><p>No upcoming events</p></div>`;
    return events.map(e => {
      const av   = AVENUES[e.avenue] || {};
      const st   = EVENT_STATUS[e.status] || {};
      const days = DateUtils.daysUntil(e.event_date);
      return `
        <div class="admin-list-item" onclick="adminDashboard.navigateTo('events-list')">
          <div class="admin-list-icon" style="background:${av.bgColor||'var(--accent-light)'};color:${av.color||'var(--accent)'};">
            <i data-lucide="${av.icon||'folder'}"></i>
          </div>
          <div class="admin-list-info">
            <div class="admin-list-title">${this._safe(e.title)}</div>
            <div class="admin-list-meta">
              ${DateUtils.format(e.event_date,'short')} &bull;
              ${DateUtils.formatTime(e.start_time)} &bull;
              ${this._safe(e.venue).substring(0,25)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
            <span class="admin-status-badge" style="background:${st.bg||'var(--accent-light)'};color:${st.color||'var(--accent)'};">
              ${st.label||e.status}
            </span>
            <span style="font-size:.7rem;color:var(--text-muted);">
              ${days===0?'Today':days===1?'Tomorrow':`In ${days} days`}
            </span>
          </div>
        </div>`;
    }).join('');
  }

  async _loadRecentActivity() {
    try {
      const { data } = await this.db.from('admin_activity_logs')
        .select('action,created_at,admin_users(full_name)')
        .order('created_at', { ascending:false }).limit(8);
      return data || [];
    } catch (e) { return []; }
  }

  _renderActivityWidget(logs) {
    if (!logs || !logs.length)
      return `<div class="admin-empty-state"><i data-lucide="activity"></i><p>No recent activity</p></div>`;
    const icons = {
      LOGIN:'log-in', LOGOUT:'log-out', EVENT_CREATED:'calendar-plus',
      EVENT_APPROVED:'check-circle', REPORT_SUBMITTED:'file-text',
      MEMBER_CREATED:'user-plus', TREASURY_ADDED:'indian-rupee',
      PASSWORD_CHANGED:'key', SETTING_UPDATED:'settings',
      NEWSLETTER_CREATED:'newspaper', NEWSLETTER_UPDATED:'edit-3', NEWSLETTER_DELETED:'trash-2'
    };
    return logs.map(log => `
      <div class="admin-activity-item">
        <div class="admin-activity-icon">
          <i data-lucide="${icons[log.action]||'activity'}"></i>
        </div>
        <div class="admin-activity-info">
          <div class="admin-activity-title">
            ${this._safe(log.admin_users?.full_name||'System')}
            <span style="font-weight:400;color:var(--text-muted);">
              ${log.action.replace(/_/g,' ').toLowerCase()}
            </span>
          </div>
          <div class="admin-activity-time">${this.getTimeAgo(log.created_at)}</div>
        </div>
      </div>`).join('');
  }

  async _loadUpcomingBirthdays() {
    try {
      const { data } = await this.db.from('members')
        .select('id,full_name,date_of_birth').eq('is_active',true).not('date_of_birth','is',null);
      if (!data) return [];
      const today = new Date();
      return data.map(m => {
        const dob  = new Date(m.date_of_birth);
        const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        return { ...m, daysUntil: Math.ceil((next - today) / 86400000) };
      }).filter(m => m.daysUntil <= 30).sort((a,b) => a.daysUntil - b.daysUntil).slice(0,6);
    } catch (e) { return []; }
  }

  _renderBirthdayWidget(members) {
    if (!members || !members.length)
      return `<div class="admin-empty-state"><i data-lucide="cake"></i><p>No upcoming birthdays in 30 days</p></div>`;
    return members.map(m => {
      const dob     = new Date(m.date_of_birth);
      const isToday = m.daysUntil === 0;
      return `
        <div class="admin-list-item ${isToday ? 'admin-birthday-today' : ''}">
          <div class="admin-list-icon" style="background:var(--accent-light);color:var(--accent);">
            <i data-lucide="cake"></i>
          </div>
          <div class="admin-list-info">
            <div class="admin-list-title">${this._safe(m.full_name)}</div>
            <div class="admin-list-meta">${DateUtils.getMonthName(dob.getMonth()+1)} ${dob.getDate()}</div>
          </div>
          <span style="font-size:.72rem;font-weight:700;padding:3px 8px;border-radius:var(--border-radius-full);
                       color:${isToday?'var(--success)':'var(--text-muted)'};
                       background:${isToday?'var(--success-light)':'var(--bg-secondary)'};">
            ${isToday ? 'Today!' : `In ${m.daysUntil}d`}
          </span>
        </div>`;
    }).join('');
  }

  async _loadTreasurySnapshot() {
    const container = document.getElementById('treasury-snap-container');
    if (!container) return;
    try {
      const now = new Date();
      const { data } = await this.db.from('treasury_transactions')
        .select('transaction_type,amount,balance')
        .gte('transaction_date', `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`)
        .order('created_at', { ascending:false });
      if (!data || !data.length) {
        container.innerHTML = `<div class="admin-empty-state"><p>No transactions this month</p></div>`;
        return;
      }
      const income  = data.filter(t => t.transaction_type==='income').reduce((s,t) => s+parseFloat(t.amount||0), 0);
      const expense = data.filter(t => t.transaction_type==='expense').reduce((s,t) => s+parseFloat(t.amount||0), 0);
      const balance = parseFloat(data[0]?.balance || 0);
      container.innerHTML = `
        <div style="padding:16px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="neu-card" style="padding:14px;text-align:center;">
              <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;">Income</div>
              <div style="font-size:1rem;font-weight:800;color:var(--success);">${StringUtils.formatCurrency(income)}</div>
            </div>
            <div class="neu-card" style="padding:14px;text-align:center;">
              <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;">Expense</div>
              <div style="font-size:1rem;font-weight:800;color:var(--danger);">${StringUtils.formatCurrency(expense)}</div>
            </div>
          </div>
          <div class="neu-card" style="padding:14px;text-align:center;">
            <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;">Balance</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--accent);">${StringUtils.formatCurrency(balance)}</div>
          </div>
          <div style="font-size:.72rem;color:var(--text-muted);text-align:center;">${data.length} transactions this month</div>
        </div>`;
    } catch (e) {
      if (container) container.innerHTML = `<div class="admin-empty-state"><p>Could not load treasury data</p></div>`;
    }
    lucide.createIcons();
  }

  _getQuickActions() {
    const actions = [];
    if (this.auth.can('CREATE_EVENT'))       actions.push({ label:'Add Event',       icon:'calendar-plus', section:'events-add' });
    if (this.auth.can('APPROVE_EVENT'))      actions.push({ label:'Approve Events',  icon:'check-circle',  section:'events-pending' });
    if (this.auth.can('CREATE_MEETING'))     actions.push({ label:'Schedule Meeting',icon:'users',         section:'meetings-add' });
    if (this.auth.can('MANAGE_TREASURY'))    actions.push({ label:'Add Transaction', icon:'indian-rupee',  section:'treasury-add' });
    if (this.auth.can('MANAGE_MEMBERS'))     actions.push({ label:'Add Member',      icon:'user-plus',     section:'members-add' });
    if (this.auth.can('MANAGE_NEWSLETTERS')) actions.push({ label:'Add Bulletin',    icon:'newspaper',     section:'newsletters' });
    if (this.auth.can('SEND_BULK_EMAIL'))    actions.push({ label:'Send Email',      icon:'mail',          section:'email-center' });
    return actions;
  }

/* ============================================================
     NEWSLETTERS
     ============================================================ */
  async _renderNewsletters(container) {
    if (!this.auth.can('MANAGE_NEWSLETTERS')) {
      container.innerHTML = this._accessDenied();
      lucide.createIcons();
      return;
    }

    const { data: newsletters, error } = await this.db
      .from('newsletters')
      .select([
        'id',
        'title',
        'month',
        'year',
        'pdf_url',
        'cover_image_url',
        'description',
        'is_published',
        'published_at',
        'created_at',
        'created_by'
      ].join(','))
      .order('year',       { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      container.innerHTML = `
        <div style="padding:40px;text-align:center;">
          <div class="neu-card placeholder-card">
            <i data-lucide="alert-circle" style="color:var(--danger);"></i>
            <p>Failed to load bulletins: ${this._safe(error.message)}</p>
          </div>
        </div>`;
      lucide.createIcons();
      return;
    }

    /* Cache ALL newsletter objects by id for reliable edit access */
    this._nlCache = {};
    (newsletters || []).forEach(nl => { this._nlCache[nl.id] = nl; });

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title"><i data-lucide="newspaper"></i> Bulletins</h1>
          <p class="admin-section-subtitle">
            ${(newsletters||[]).length} bulletin${(newsletters||[]).length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button class="btn btn-primary" onclick="adminDashboard._showNewsletterForm(null)">
          <i data-lucide="plus-circle"></i><span>Add Bulletin</span>
        </button>
      </div>

      ${!newsletters || !newsletters.length ? `
        <div class="admin-card neu-card">
          <div class="admin-empty-state" style="padding:60px;">
            <i data-lucide="file-x" style="width:48px;height:48px;opacity:.3;"></i>
            <p>No bulletins yet. Click "Add Bulletin" to create your first one.</p>
          </div>
        </div>` : `
        <div id="nl-cards-grid"
             style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">
          ${(newsletters||[]).map(nl => this._renderNlCard(nl)).join('')}
        </div>`}
    `;

    lucide.createIcons();
  }

  /* ── Render one newsletter card ── */
  _renderNlCard(nl) {
    const url    = nl.pdf_url         || '';
    const cover  = nl.cover_image_url || '';
    const title  = nl.title           || 'Bulletin';
    const month  = nl.month           || '';
    const year   = nl.year            || new Date().getFullYear();
    const desc   = nl.description     || '';
    const pubAt  = nl.published_at    || nl.created_at || '';
    const nlId   = String(nl.id);

    /* "June 2025" or just "2025" */
    const period = month ? `${month} ${year}` : String(year);

    let dateStr = '';
    if (pubAt) {
      try {
        dateStr = new Date(pubAt).toLocaleDateString('en-IN', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
      } catch (e) { dateStr = pubAt; }
    }

    /* Escape for HTML attribute usage */
    const esc = (s) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    return `
      <div class="admin-nl-card neu-card">

        <!-- Cover image -->
        <div class="admin-nl-cover">
          ${cover
            ? `<img src="${esc(cover)}" alt="${esc(title)}" class="admin-nl-cover-img"
                    onerror="this.parentElement.innerHTML=
                      '<div class=&quot;admin-nl-cover-placeholder&quot;>
                        <i data-lucide=&quot;newspaper&quot;></i>
                      </div>';
                      lucide.createIcons();" />`
            : `<div class="admin-nl-cover-placeholder">
                 <i data-lucide="newspaper"></i>
                 <span style="font-size:.72rem;color:var(--text-muted);
                              font-family:Poppins,sans-serif;">No Cover</span>
               </div>`}

          <!-- Published toggle overlay -->
          <div class="admin-nl-status-overlay">
            <label class="admin-toggle"
                   title="${nl.is_published ? 'Click to unpublish' : 'Click to publish'}">
              <input type="checkbox" ${nl.is_published ? 'checked' : ''}
                     onchange="adminDashboard._toggleNlPublish('${esc(nlId)}', this.checked)" />
              <span class="admin-toggle-slider"></span>
            </label>
            <span class="admin-nl-status-label ${nl.is_published ? 'published' : 'draft'}">
              ${nl.is_published ? 'Published' : 'Draft'}
            </span>
          </div>
        </div>

        <!-- Body -->
        <div class="admin-nl-body">
          <div class="admin-nl-title" title="${esc(title)}">${esc(title)}</div>

          <!-- Period: "June 2025" or "2025" -->
          <div class="admin-nl-meta">
            <i data-lucide="calendar" style="width:12px;height:12px;flex-shrink:0;"></i>
            ${esc(period)}
          </div>

          ${dateStr ? `
          <div class="admin-nl-meta">
            <i data-lucide="clock" style="width:12px;height:12px;flex-shrink:0;"></i>
            ${dateStr}
          </div>` : ''}

          ${desc ? `<div class="admin-nl-desc">${esc(desc)}</div>` : ''}

          <div class="admin-nl-link-row">
            ${url
              ? `<span class="admin-nl-link-badge has-link">
                   <i data-lucide="link" style="width:11px;height:11px;"></i> Link added
                 </span>`
              : `<span class="admin-nl-link-badge no-link">
                   <i data-lucide="link-2-off" style="width:11px;height:11px;"></i> No link
                 </span>`}
          </div>
        </div>

        <!-- Actions — ONLY pass id string, never JSON -->
        <div class="admin-nl-actions">
          ${url ? `
          <button class="admin-nl-btn admin-nl-btn-preview" title="Preview"
                  onclick="adminDashboard._previewNl('${esc(nlId)}')">
            <i data-lucide="eye"></i> Preview
          </button>` : ''}

          <button class="admin-nl-btn admin-nl-btn-edit" title="Edit"
                  onclick="adminDashboard._editNl('${esc(nlId)}')">
            <i data-lucide="edit-3"></i> Edit
          </button>

          <button class="admin-nl-btn admin-nl-btn-delete" title="Delete"
                  onclick="adminDashboard._deleteNl('${esc(nlId)}','${esc(title)}')">
            <i data-lucide="trash-2"></i>
          </button>
        </div>

      </div>`;
  }

  /* ── Preview (id-based lookup) ── */
  _previewNl(id) {
    const nl = this._nlCache[id];
    if (!nl || !nl.pdf_url) {
      this.showToast('No link available to preview', 'warning');
      return;
    }
    this._previewNewsletter(nl.title || 'Bulletin', nl.pdf_url);
  }

  /* ── Edit (id-based lookup — ALWAYS works) ── */
  _editNl(id) {
    /* 1. Try in-memory cache (populated during _renderNewsletters) */
    if (this._nlCache && this._nlCache[id]) {
      this._showNewsletterForm(this._nlCache[id]);
      return;
    }
    /* 2. Fallback: fetch from DB */
    this.db.from('newsletters')
      .select('id,title,month,year,pdf_url,cover_image_url,description,is_published,published_at,created_at')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          this.showToast('Could not load bulletin for editing', 'error');
          return;
        }
        this._nlCache[id] = data;
        this._showNewsletterForm(data);
      })
      .catch(() => this.showToast('Could not load bulletin for editing', 'error'));
  }

  /* ── Delete ── */
  _deleteNl(id, title) {
    this.confirmAction(
      'Delete Bulletin',
      `Delete "${title}"? This cannot be undone.`,
      async () => {
        try {
          const { error } = await this.db.from('newsletters').delete().eq('id', id);
          if (error) throw error;
          delete this._nlCache[id];
          this.showToast('Bulletin deleted', 'success');
          await this._renderNewsletters(document.getElementById('admin-content'));
        } catch (err) {
          console.error('Delete newsletter error:', err);
          this.showToast('Failed to delete bulletin', 'error');
        }
      },
      'trash-2'
    );
  }

  /* ── Toggle publish ── */
  async _toggleNlPublish(id, isPublished) {
    try {
      const { error } = await this.db
        .from('newsletters')
        .update({ is_published: isPublished, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      if (this._nlCache[id]) this._nlCache[id].is_published = isPublished;
      this.showToast(`Bulletin ${isPublished ? 'published' : 'set to draft'}`, 'success', 2000);
    } catch (err) {
      console.error('Toggle publish error:', err);
      this.showToast('Failed to update status', 'error');
      await this._renderNewsletters(document.getElementById('admin-content'));
    }
  }

  /* ── Newsletter preview modal ── */
  _previewNewsletter(title, url) {
    if (!url) { this.showToast('No link available', 'warning'); return; }

    /* Use public viewer if available */
    if (window.openNewsletterViewer) {
      window.openNewsletterViewer({ title, pdf_url: url });
      return;
    }

    /* Convert to embeddable URL */
    let previewUrl = url;
    const u = url.toLowerCase();
    if (u.includes('drive.google.com')) {
      const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) previewUrl = `https://drive.google.com/file/d/${m[1]}/preview`;
    } else if (u.endsWith('.pdf') || u.includes('.pdf?')) {
      previewUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }

    document.getElementById('admin-nl-preview-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'admin-nl-preview-modal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;
      display:flex;align-items:center;justify-content:center;
      padding:16px;backdrop-filter:blur(8px);`;

    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;width:100%;max-width:900px;
                  max-height:90vh;display:flex;flex-direction:column;overflow:hidden;
                  box-shadow:0 32px 80px rgba(0,0,0,.5);">
        <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;
                    border-bottom:1px solid var(--border-color);flex-shrink:0;">
          <h3 style="flex:1;font-size:.92rem;font-weight:700;color:var(--text-heading);
                     margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                     font-family:Poppins,sans-serif;">${this._safe(title)}</h3>
          <a href="${this._safe(url)}" target="_blank" rel="noopener noreferrer"
             style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;
                    border-radius:8px;font-size:.76rem;font-weight:600;
                    background:transparent;color:var(--primary,#8E0C45);
                    border:2px solid var(--primary,#8E0C45);
                    text-decoration:none;white-space:nowrap;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>Open
          </a>
          <button onclick="document.getElementById('admin-nl-preview-modal').remove()"
                  style="background:none;border:none;cursor:pointer;
                         color:var(--text-secondary);width:32px;height:32px;
                         border-radius:8px;display:flex;
                         align-items:center;justify-content:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style="flex:1;background:#1a1a2e;position:relative;min-height:400px;">
          <iframe src="${this._safe(previewUrl)}"
                  style="width:100%;height:100%;min-height:500px;border:none;display:block;"
                  title="${this._safe(title)}" allowfullscreen loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation">
          </iframe>
        </div>
      </div>`;

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  /* ── Add / Edit form ── */
  _showNewsletterForm(existing) {
    const isEdit = !!(existing && existing.id);

    document.getElementById('nl-form-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id        = 'nl-form-modal';
    modal.style.cssText = [
      'position:fixed;inset:0;',
      'background:rgba(0,0,0,.6);',
      'backdrop-filter:blur(8px);',
      'z-index:9000;',
      'display:flex;align-items:center;justify-content:center;',
      'padding:16px;'
    ].join('');

    /* ── Current year for default ── */
    const currentYear  = new Date().getFullYear();
    const selectedYear = existing?.year || currentYear;

    /* ── Month select options ── */
    const monthNames = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    const monthOptions = monthNames.map(m =>
      `<option value="${m}" ${existing?.month === m ? 'selected' : ''}>${m}</option>`
    ).join('');

    /* ── Current cover preview ── */
    const coverPreviewHtml = existing?.cover_image_url
      ? `<div style="margin-bottom:10px;">
           <img src="${this._safe(existing.cover_image_url)}" alt="Current cover"
                style="width:100%;max-height:160px;object-fit:cover;
                       border-radius:10px;display:block;" />
           <p style="font-size:.72rem;color:var(--text-muted);
                     margin:4px 0 0;font-family:Poppins,sans-serif;">
             Current cover — upload a new one to replace
           </p>
         </div>`
      : '';

    /* ── publishedAt default ── */
    const pubDateVal = existing?.published_at
      ? existing.published_at.split('T')[0]
      : new Date().toLocalISODate();

    modal.innerHTML = `
      <div class="neu-card" style="
        width:100%;max-width:600px;max-height:92vh;
        display:flex;flex-direction:column;
        border-radius:18px;overflow:hidden;">

        <!-- Header -->
        <div style="
          display:flex;align-items:center;gap:10px;
          padding:16px 20px;
          border-bottom:1px solid var(--border-color);
          flex-shrink:0;">
          <h2 style="
            flex:1;font-size:1rem;font-weight:800;
            color:var(--text-heading);margin:0;
            display:flex;align-items:center;gap:8px;
            font-family:Poppins,sans-serif;">
            <i data-lucide="${isEdit ? 'edit-3' : 'plus-circle'}"
               style="width:18px;height:18px;color:var(--accent);"></i>
            ${isEdit ? 'Edit' : 'Add'} Bulletin
          </h2>
          <button class="neu-btn" style="width:34px;height:34px;"
                  onclick="adminDashboard._closeNlForm()">
            <i data-lucide="x" style="width:16px;height:16px;"></i>
          </button>
        </div>

        <!-- Scrollable body -->
        <div style="
          flex:1;overflow-y:auto;padding:20px;
          display:flex;flex-direction:column;gap:16px;">

          <!-- COVER IMAGE -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="image" style="width:14px;height:14px;"></i>
              Cover Image
            </label>
            ${coverPreviewHtml}
            <div class="file-upload-wrap neu-inset" style="cursor:pointer;"
                 onclick="document.getElementById('nl-cover-input').click()">
              <input type="file" id="nl-cover-input" name="cover_image"
                     accept="image/jpeg,image/png,image/webp,image/gif"
                     style="display:none;"
                     onchange="adminDashboard._onNlCoverChange(this)" />
              <div class="file-upload-ui">
                <i data-lucide="upload-cloud"
                   style="width:22px;height:22px;color:var(--text-muted);"></i>
                <span id="nl-cover-label"
                      style="font-size:.8rem;color:var(--text-muted);
                             font-family:Poppins,sans-serif;">
                  Click to upload cover image (JPG / PNG / WebP — Max 5 MB)
                </span>
              </div>
            </div>
            <div id="nl-cover-preview" style="display:none;margin-top:10px;">
              <img id="nl-cover-preview-img" src="" alt="Preview"
                   style="width:100%;max-height:160px;object-fit:cover;
                          border-radius:10px;display:block;" />
              <button type="button" onclick="adminDashboard._clearNlCover()"
                      style="margin-top:4px;font-size:.72rem;color:var(--danger);
                             background:none;border:none;cursor:pointer;
                             font-family:Poppins,sans-serif;padding:0;">
                ✕ Remove selected image
              </button>
            </div>
          </div>

          <!-- TITLE -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="type" style="width:14px;height:14px;"></i>
              Title *
            </label>
            <div class="input-wrap neu-inset">
              <input type="text" id="nl-title" class="form-input"
                     placeholder="e.g. Rotaract Bulletin — June 2025"
                     value="${this._safe(existing?.title || '')}" required />
            </div>
          </div>

          <!-- MONTH + YEAR side by side -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">

            <!-- MONTH (nullable — optional) -->
            <div class="form-group" style="margin:0;">
              <label class="form-label">
                <i data-lucide="calendar" style="width:14px;height:14px;"></i>
                Month
                <span style="font-size:.7rem;color:var(--text-muted);
                             font-weight:400;margin-left:4px;">(optional)</span>
              </label>
              <div class="select-wrap neu-inset">
                <select id="nl-month" class="form-select">
                  <option value="">— None —</option>
                  ${monthOptions}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- YEAR - CHANGED TO INPUT TYPE NUMBER -->
            <div class="form-group" style="margin:0;">
              <label class="form-label">
                <i data-lucide="calendar-check" style="width:14px;height:14px;"></i>
                Year *
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" id="nl-year" class="form-input" 
                       min="2019" max="2100" placeholder="e.g. 2025"
                       value="${selectedYear}" required />
              </div>
            </div>

          </div>

          <!-- BULLETIN LINK -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="link" style="width:14px;height:14px;"></i>
              Bulletin Link
            </label>
            <div class="input-wrap neu-inset">
              <input type="url" id="nl-url" class="form-input"
                     placeholder="https://drive.google.com/file/d/..."
                     value="${this._safe(existing?.pdf_url || '')}" />
            </div>
          </div>

          <!-- DESCRIPTION -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="file-text" style="width:14px;height:14px;"></i>
              Description
            </label>
            <div class="input-wrap neu-inset">
              <textarea id="nl-desc" class="form-textarea" rows="3"
                        placeholder="Brief description of this bulletin...">${this._safe(existing?.description || '')}</textarea>
            </div>
          </div>

          <!-- PUBLISH DATE -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="calendar-check" style="width:14px;height:14px;"></i>
              Publish Date
            </label>
            <div class="input-wrap neu-inset">
              <input type="date" id="nl-pubdate" class="form-input"
                     value="${pubDateVal}" />
            </div>
          </div>

          <!-- VISIBILITY -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="globe" style="width:14px;height:14px;"></i>
              Visibility
            </label>
            <div class="admin-toggle-wrap">
              <label class="admin-toggle">
                <input type="checkbox" id="nl-published"
                       ${(existing?.is_published ?? true) ? 'checked' : ''} />
                <span class="admin-toggle-slider"></span>
              </label>
              <span id="nl-published-label"
                    style="font-size:.84rem;font-family:Poppins,sans-serif;">
                ${(existing?.is_published ?? true)
                  ? 'Published — visible on website'
                  : 'Draft — hidden from website'}
              </span>
            </div>
          </div>

          <!-- FORM MESSAGE -->
          <div class="form-message" id="nl-form-msg" style="margin-top:4px;"></div>

        </div>

        <!-- Footer actions -->
        <div style="
          display:flex;gap:10px;justify-content:flex-end;
          padding:14px 20px;
          border-top:1px solid var(--border-color);
          flex-shrink:0;flex-wrap:wrap;">

          <button class="btn btn-outline" onclick="adminDashboard._closeNlForm()">
            Cancel
          </button>

          ${isEdit && existing?.pdf_url ? `
          <button class="btn btn-outline"
                  onclick="adminDashboard._previewNewsletter(
                    '${this._safe((existing.title || '').replace(/'/g,"\\'"))}',
                    '${this._safe((existing.pdf_url || '').replace(/'/g,"\\'"))}'
                  )">
            <i data-lucide="eye"></i><span>Preview</span>
          </button>` : ''}

          <button class="btn btn-primary" id="nl-save-btn"
                  onclick="adminDashboard._saveNl(
                    '${isEdit ? this._safe(existing.id) : ''}',
                    '${isEdit ? this._safe(existing.cover_image_url || '') : ''}'
                  )">
            <i data-lucide="${isEdit ? 'save' : 'plus-circle'}"></i>
            <span>${isEdit ? 'Save Changes' : 'Add Bulletin'}</span>
          </button>

        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    lucide.createIcons();

    /* Toggle label listener */
    const pubToggle = document.getElementById('nl-published');
    const pubLabel  = document.getElementById('nl-published-label');
    if (pubToggle && pubLabel) {
      pubToggle.addEventListener('change', () => {
        pubLabel.textContent = pubToggle.checked
          ? 'Published — visible on website'
          : 'Draft — hidden from website';
      });
    }

    /* Close on backdrop click */
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this._closeNlForm();
    });
  }

  _closeNlForm() {
    document.getElementById('nl-form-modal')?.remove();
    document.body.style.overflow = '';
  }

  /* ── Cover image file change ── */
  _onNlCoverChange(input) {
    const file    = input.files[0];
    const label   = document.getElementById('nl-cover-label');
    const preview = document.getElementById('nl-cover-preview');
    const img     = document.getElementById('nl-cover-preview-img');
    if (!file) return;

    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
      this.showToast('Please upload a valid image (JPG, PNG, WebP)', 'error');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.showToast('Image must be under 5 MB', 'error');
      input.value = '';
      return;
    }

    if (label) label.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (img)     img.src            = e.target.result;
      if (preview) preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  /* ── Clear cover ── */
  _clearNlCover() {
    const input   = document.getElementById('nl-cover-input');
    const label   = document.getElementById('nl-cover-label');
    const preview = document.getElementById('nl-cover-preview');
    if (input)   input.value          = '';
    if (label)   label.textContent    = 'Click to upload cover image (JPG / PNG / WebP — Max 5 MB)';
    if (preview) preview.style.display = 'none';
  }

  /* ── Upload cover image to Supabase Storage ── */
  async _uploadNlCover(file) {
    try {
      let uploadFile = file;
      if (typeof ImageUtils !== 'undefined') {
        try { uploadFile = await ImageUtils.compress(file, 900, 600, 0.88); }
        catch (e) { /* use original */ }
      }

      const ext = file.type === 'image/png' ? 'png'
                : file.type === 'image/gif'  ? 'gif' : 'jpg';
      const filename = `covers/nl_${Date.now()}_${Math.random().toString(36).substr(2,6)}.${ext}`;

      const bucket = (typeof STORAGE_BUCKETS !== 'undefined' && STORAGE_BUCKETS.NEWSLETTERS)
                   ? STORAGE_BUCKETS.NEWSLETTERS
                   : 'newsletters';

      const { data, error } = await this.db.storage
        .from(bucket)
        .upload(filename, uploadFile, { contentType: file.type, upsert: false });

      if (error) throw error;

      const { data: urlData } = this.db.storage.from(bucket).getPublicUrl(data.path);
      return urlData?.publicUrl || null;

    } catch (err) {
      console.error('Cover upload error:', err);
      this.showToast('Cover upload failed — saving without cover image', 'warning', 4000);
      return null;
    }
  }

  /* ── Save newsletter ── */
  async _saveNl(existingId, existingCoverUrl) {
    const btn   = document.getElementById('nl-save-btn');
    const msgEl = document.getElementById('nl-form-msg');

    const showMsg = (msg, type) => {
      if (msgEl) {
        msgEl.textContent = msg;
        msgEl.className   = `form-message ${type}`;
      }
    };

    /* ── Read all form fields ── */
    const title       = (document.getElementById('nl-title')?.value    || '').trim();
    const month       = (document.getElementById('nl-month')?.value    || '').trim() || null;
    const yearRaw     =  document.getElementById('nl-year')?.value     || '';
    const pdfUrl      = (document.getElementById('nl-url')?.value      || '').trim() || null;
    const description = (document.getElementById('nl-desc')?.value     || '').trim() || null;
    const publishedAt =  document.getElementById('nl-pubdate')?.value  || null;
    const isPublished =  document.getElementById('nl-published')?.checked ?? false;
    const coverFile   =  document.getElementById('nl-cover-input')?.files?.[0] || null;

    /* ── Derive year (integer) ── */
    let year = null;
    if (yearRaw && !isNaN(parseInt(yearRaw, 10))) {
      year = parseInt(yearRaw, 10);
    } else if (publishedAt) {
      try   { year = new Date(publishedAt).getFullYear(); }
      catch (e) { year = new Date().getFullYear(); }
    } else {
      year = new Date().getFullYear();
    }

    /* ── Validate ── */
    if (!title) { showMsg('Title is required', 'error'); return; }
    if (!year)  { showMsg('Valid year is required', 'error'); return; }

    /* ── Saving state ── */
    if (btn) {
      btn.disabled  = true;
      btn.innerHTML = '<i data-lucide="loader-2"></i><span>Saving…</span>';
      lucide.createIcons();
    }

    try {
      /* ── Upload cover if new file selected ── */
      let coverImageUrl = existingCoverUrl || null;
      if (coverFile) {
        showMsg('Uploading cover image…', 'info');
        const uploaded = await this._uploadNlCover(coverFile);
        if (uploaded) coverImageUrl = uploaded;
      }

      /* ── Payload ── */
      const payload = {
        title,
        month,
        year,
        pdf_url:         pdfUrl,
        cover_image_url: coverImageUrl,
        description,
        is_published:    isPublished,
        published_at:    publishedAt || null,
        updated_at:      new Date().toISOString()
      };

      const isEdit = !!(existingId && String(existingId).trim());
      let   dbError;

      if (isEdit) {
        const { error } = await this.db
          .from('newsletters')
          .update(payload)
          .eq('id', existingId.trim());
        dbError = error;
      } else {
        const { error } = await this.db
          .from('newsletters')
          .insert({
            ...payload,
            created_by: this.admin?.id || null,
            created_at: new Date().toISOString()
          });
        dbError = error;
      }

      if (dbError) throw dbError;

      this.showToast(`Bulletin ${isEdit ? 'updated' : 'added'} successfully!`, 'success');
      this._closeNlForm();
      await this._renderNewsletters(document.getElementById('admin-content'));

    } catch (err) {
      console.error('[Newsletter save] Error:', err);
      showMsg(`Failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      if (btn) {
        btn.disabled  = false;
        const isEdit  = !!(existingId && String(existingId).trim());
        btn.innerHTML = isEdit
          ? '<i data-lucide="save"></i><span>Save Changes</span>'
          : '<i data-lucide="plus-circle"></i><span>Add Bulletin</span>';
        lucide.createIcons();
      }
    }
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  /* ============================================================
     SITE SETTINGS (advanced)
     ============================================================ */
  _settingsSchema() {
    const ROUTE = ['members', 'board', 'both', 'custom', 'off'];
    return {
      general: { icon: 'building-2', label: 'General', sections: [
        { icon: 'building-2', title: 'Club identity', desc: 'Shown on the website, documents and e-mails', fields: [
          { key: 'club_name', label: 'Club name' }, { key: 'parent_club', label: 'Parent club' },
          { key: 'club_id', label: 'Club ID' }, { key: 'charter_date', label: 'Charter date' },
          { key: 'district', label: 'RI district' }, { key: 'district_region', label: 'District region' } ] },
        { icon: 'calendar-range', title: 'Rotary year & group', desc: 'Used in report headers and filters', fields: [
          { key: 'current_rotary_year', label: 'Current Rotary year', hint: 'Example: 2026-27' },
          { key: 'current_group', label: 'Current group number', type: 'select', options: ['1','2','3','4','5','6'] } ] },
        { icon: 'layout-template', title: 'Landing page text', desc: 'Hero and footer wording', fields: [
          { key: 'hero_tagline', label: 'Hero tagline' }, { key: 'hero_subtitle', label: 'Hero subtitle' },
          { key: 'footer_vision', label: 'Footer vision statement', type: 'textarea' },
          { key: 'map_embed_url', label: 'Google Maps embed URL', type: 'textarea', hint: 'Paste the src of the Google Maps embed iframe' } ] } ] },

      branding: { icon: 'palette', label: 'Logos', sections: [
        { icon: 'image', title: 'Website logos', desc: 'Direct image links (https)', fields: [
          { key: 'logo_colour_url', label: 'Colour logo' }, { key: 'logo_white_url', label: 'White logo' }, { key: 'logo_black_url', label: 'Black logo' } ] },
        { icon: 'file-image', title: 'Document header strips', desc: 'Printed at the top of every Word / PDF report', fields: [
          { key: 'report_logo_strip_url', label: 'Standard strip URL' },
          { key: 'report_logo_strip_width', label: 'Standard strip width (inches)', type: 'number', step: '0.01' },
          { key: 'report_logo_strip_height', label: 'Standard strip height (inches)', type: 'number', step: '0.01' },
          { key: 'dpp_logo_strip_url', label: 'DPP strip URL' },
          { key: 'dpp_logo_strip_width', label: 'DPP strip width (inches)', type: 'number', step: '0.01' },
          { key: 'dpp_logo_strip_height', label: 'DPP strip height (inches)', type: 'number', step: '0.01' } ] } ] },

      mail: { icon: 'mail', label: 'Mail & recipients', sections: [
        { icon: 'users', title: 'Google Groups', desc: 'Where club mails are delivered', fields: [
          { key: 'group_email', label: 'Members Google Group', type: 'email', def: 'ngpmembers@googlegroups.com', hint: 'All members. Example: ngpmembers@googlegroups.com' },
          { key: 'board_group_email', label: 'Board members Google Group', type: 'email', hint: 'Board only. Leave empty to fall back to the members group' },
          { key: 'mail_custom_recipients', label: 'Custom recipient list', type: 'chips', hint: 'Used by any mail routed to “Custom list”' },
          { key: 'mail_extra_recipients', label: 'Always copy (CC)', type: 'chips', hint: 'Added as CC on every club mail, e.g. advisor or secretary' } ] },
        { icon: 'route', title: 'Who receives which mail', desc: 'Choose a recipient list for each kind of mail', fields: [
          { type: 'routes', routes: [
            ['event_approval', 'Event approved', 'calendar-check'], ['report_notification', 'Event report published', 'file-text'],
            ['meeting_invitation', 'Meeting invitation', 'users'], ['meeting_attendance', 'Attendance form', 'check-square'],
            ['meeting_minutes', 'Meeting minutes', 'notebook-pen'], ['monthly_statement', 'Monthly treasury statement', 'indian-rupee'],
            ['birthday_wish', 'Birthday wishes', 'cake'], ['custom_email', 'Custom / bulk e-mail', 'send'] ], options: ROUTE } ] },
        { icon: 'paperclip', title: 'Attachments', desc: 'Files attached by the Google Apps Script mailer', fields: [
          { key: 'mail_attachments_enabled', label: 'Attach documents to mails', type: 'toggle', def: 'true' },
          { key: 'mail_attachment_format', label: 'Document format', type: 'select', options: ['pdf', 'docx', 'both'], def: 'pdf', hint: 'PDF, Word, or both files' },
          { key: 'mail_attach_posters', label: 'Attach event & meeting posters', type: 'toggle', def: 'true' },
          { key: 'mail_attach_excel', label: 'Attach Excel (attendance / treasury)', type: 'toggle', def: 'true' } ] },
        { icon: 'type', title: 'Message style', desc: 'Applied to every outgoing club mail', fields: [
          { key: 'mail_subject_prefix', label: 'Subject prefix', hint: 'Replaces the default “[Rotaract]”. Example: [NGP Rotaract]' },
          { key: 'mail_sender_signature', label: 'Sign mails with the sender’s details', type: 'toggle', def: 'true',
            hint: 'The end of every mail shows the person who pressed Send: name, portfolio(s), RI ID, club, group and RI district' },
          { key: 'mail_signature', label: 'Fallback signature line', type: 'textarea', hint: 'Used only for automatic mails where nobody is signed in' },
          { key: 'club_email', label: 'Reply-to address', type: 'email' } ] },
        { icon: 'flask-conical', title: 'Test', desc: 'Send a sample mail only to yourself', fields: [ { type: 'testmail' } ] } ] },

      automation: { icon: 'zap', label: 'Automation', sections: [
        { icon: 'timer', title: 'Scheduled mails', desc: 'Sent automatically while the admin panel is open', fields: [
          { key: 'birthday_email_enabled', label: 'Birthday e-mails', type: 'toggle', hint: 'Wishes members on their birthday' },
          { key: 'monthly_statement_email_enabled', label: 'Monthly treasury statement', type: 'toggle', hint: 'Sent on the 1st for the previous month' } ] },
        { icon: 'siren', title: 'Blood request alerts', desc: 'WhatsApp numbers alerted for new requests', fields: [
          { key: 'whatsapp_blood_request_number1', label: 'WhatsApp number 1', type: 'tel' },
          { key: 'whatsapp_blood_request_number2', label: 'WhatsApp number 2', type: 'tel' } ] },
        { icon: 'plug', title: 'EmailJS (legacy fallback)', desc: 'Only used if the main mailer is unavailable', fields: [
          { key: 'emailjs_service_id', label: 'Service ID' }, { key: 'emailjs_template_id', label: 'Template ID' }, { key: 'emailjs_public_key', label: 'Public key' } ] } ] },

      contact: { icon: 'map-pin', label: 'Contact', sections: [
        { icon: 'at-sign', title: 'Contact & social', desc: 'Footer and contact section', fields: [
          { key: 'social_media_handle', label: 'Social handle' },
          { key: 'address_line1', label: 'Address line 1' }, { key: 'address_line2', label: 'Address line 2' },
          { key: 'address_line3', label: 'Address line 3' }, { key: 'address_line4', label: 'Address line 4' } ] } ] },

      stats: { icon: 'bar-chart-3', label: 'Statistics', sections: [
        { icon: 'gauge', title: 'Landing page counters', desc: 'Leave empty to use live numbers', fields: [
          { key: 'stats_projects_completed', label: 'Projects completed', type: 'number' }, { key: 'stats_members', label: 'Members', type: 'number' },
          { key: 'stats_service_hours', label: 'Service hours', type: 'number' }, { key: 'stats_lives_impacted', label: 'Lives impacted', type: 'number' } ] } ] },

      portfolios: { icon: 'badge-check', label: 'Portfolios', sections: [] },

      advanced: { icon: 'sliders-horizontal', label: 'Advanced', sections: [
        { icon: 'database-backup', title: 'Backup & restore', desc: 'Move settings between sites or keep a copy', fields: [ { type: 'backup' } ] },
        ...(this.auth.isSuperAdmin() ? [ { icon: 'alert-triangle', title: 'Danger zone', desc: 'Super admin only — permanently erase portal data', danger: true, fields: [ { type: 'reset' } ] } ] : []) ] }
    };
  }

  async _renderSettings(container) {
    if (!this.auth.can('MANAGE_SETTINGS')) {
      container.innerHTML = this._accessDenied();
      lucide.createIcons();
      return;
    }
    const { data: settings } = await this.db.from('club_settings').select('*').order('key');
    this._settingsCache = settings || [];
    this._settingsTab = this._settingsTab || 'general';
    if (this._settingsTab === 'portfolios') await this._loadPortfolios(true);
    const schema = this._settingsSchema();
    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title"><i data-lucide="settings"></i> Site Settings</h1>
          <p class="admin-section-subtitle">Every change is saved the moment you make it</p>
        </div>
      </div>
      <div class="admin-settings-tabs" role="tablist">
        ${Object.entries(schema).map(([id, t]) => `
          <button class="admin-settings-tab ${id === this._settingsTab ? 'active' : ''}" role="tab"
                  onclick="adminDashboard._switchSettingsTab('${id}', this)">
            <i data-lucide="${t.icon}"></i><span>${t.label}</span>
          </button>`).join('')}
      </div>
      <div id="settings-tab-content">${this._renderSettingsTab(this._settingsTab, this._settingsCache)}</div>`;
    lucide.createIcons();
  }

  async _switchSettingsTab(tab, btn) {
    this._settingsTab = tab;
    if (tab === 'portfolios') await this._loadPortfolios(true);
    document.querySelectorAll('.admin-settings-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const el = document.getElementById('settings-tab-content');
    if (el) { el.innerHTML = this._renderSettingsTab(tab, this._settingsCache || []); lucide.createIcons(); }
  }

  _renderSettingsTab(tab, settings) {
    if (tab === 'portfolios') return this._portfoliosHTML();
    const schema = this._settingsSchema();
    const def = schema[tab] || schema.general;
    const get = (key, d = '') => {
      const v = settings.find(x => x.key === key)?.value;
      return (v === undefined || v === null || v === '') ? d : v;
    };
    const esc = (v) => this._safe(v);
    const control = (f) => {
      const val = get(f.key, f.def || '');
      const k = esc(f.key);
      if (f.type === 'textarea') return `<div class="input-wrap"><textarea class="form-textarea" rows="3" onchange="adminDashboard._saveSetting('${k}',this.value)">${esc(val)}</textarea></div>`;
      if (f.type === 'toggle') return `<label class="admin-toggle"><input type="checkbox" ${val === 'true' ? 'checked' : ''} onchange="adminDashboard._saveSetting('${k}',this.checked?'true':'false')" /><span class="admin-toggle-slider"></span></label>`;
      if (f.type === 'select') return `<div class="select-wrap"><select class="form-select" onchange="adminDashboard._saveSetting('${k}',this.value)">${(f.options || []).map(o => `<option value="${esc(o)}" ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
      if (f.type === 'chips') return this._chipsHTML(f.key, val);
      return `<div class="input-wrap"><input type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} class="form-input" value="${esc(val)}" onchange="adminDashboard._saveSetting('${k}',this.value)" /></div>`;
    };
    const special = (f) => {
      if (f.type === 'routes') return `<div class="route-table">${f.routes.map(([id, label, icon]) => {
        const cur = get('mail_route_' + id, 'members');
        return `<div class="route-row">
          <div class="route-name"><i data-lucide="${icon}"></i><div>${esc(label)}<small>${esc(id)}</small></div></div>
          <div class="select-wrap"><select class="form-select" onchange="adminDashboard._saveSetting('mail_route_${id}',this.value)">
            ${f.options.map(o => `<option value="${o}" ${cur === o ? 'selected' : ''}>${({ members: 'Members group', board: 'Board group', both: 'Members + Board', custom: 'Custom list', off: 'Do not send' })[o]}</option>`).join('')}
          </select></div><span></span></div>`;
      }).join('')}</div>`;
      if (f.type === 'testmail') return `<div class="set-row"><div class="set-meta"><label>Send a test mail</label><p class="set-hint">Goes only to your own address (${esc(this.admin?.email || 'your account')}) using the current mail settings.</p></div>
        <div class="set-control is-end" style="flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="adminDashboard._sendTestMail()"><i data-lucide="send"></i><span>Send test</span></button>
          <button class="btn btn-primary" onclick="adminDashboard._sendTestAttachmentMail()"><i data-lucide="paperclip"></i><span>Test with attachments</span></button>
        </div></div>`;
      if (f.type === 'reset') return this.auth.isSuperAdmin() ? `<div class="set-row"><div class="set-meta"><label>Erase all data</label><p class="set-hint">Deletes events, meetings, treasury, added admin accounts and other records so the portal starts fresh. <strong>Site Settings are kept.</strong> You choose what to erase and must type a confirmation phrase.</p></div>
        <div class="set-control is-end"><button class="btn btn-danger" onclick="adminDashboard._openResetDialog()"><i data-lucide="trash-2"></i><span>Erase all data</span></button></div></div>
        <div class="set-row"><div class="set-meta"><label>Download full backup</label><p class="set-hint">Saves every table (members, events, meetings, treasury, chat…) as one JSON file. Passwords are never included. Do this before erasing data.</p></div>
        <div class="set-control is-end"><button class="btn btn-outline" onclick="adminDashboard._downloadBackup()"><i data-lucide="download"></i><span>Download backup</span></button></div></div>` : '';
      if (f.type === 'backup') return `<div class="set-row"><div class="set-meta"><label>Export settings</label><p class="set-hint">Downloads every setting as a JSON file.</p></div>
        <div class="set-control is-end"><button class="btn btn-outline" onclick="adminDashboard._exportSettings()"><i data-lucide="download"></i><span>Export</span></button></div></div>
        <div class="set-row"><div class="set-meta"><label>Import settings</label><p class="set-hint">Applies values from a JSON file exported here. Existing values with the same key are replaced.</p></div>
        <div class="set-control is-end"><label class="btn btn-outline" style="cursor:pointer;"><i data-lucide="upload"></i><span>Choose file</span><input type="file" accept="application/json" hidden onchange="adminDashboard._importSettings(this)" /></label></div></div>`;
      return '';
    };
    return `<div class="set-grid">${def.sections.map(sec => `
      <section class="set-section neu-card${sec.danger ? ' set-danger' : ''}">
        <header class="set-section-head"><span class="set-ico"><i data-lucide="${sec.icon}"></i></span>
          <div><h3>${esc(sec.title)}</h3><p>${esc(sec.desc || '')}</p></div></header>
        <div class="set-body">${sec.fields.map(f => f.key ? `
          <div class="set-row">
            <div class="set-meta"><label>${esc(f.label)}</label>${f.hint ? `<p class="set-hint">${esc(f.hint)}</p>` : ''}</div>
            <div class="set-control${f.type === 'toggle' ? ' is-end' : ''}">${control(f)}</div>
          </div>` : special(f)).join('')}</div>
      </section>`).join('')}</div>`;
  }

  _chipsHTML(key, value) {
    const list = String(value || '').split(/[;,\s]+/).filter(Boolean);
    const k = this._safe(key);
    return `<div style="width:100%;">
      <div class="input-wrap"><input type="email" class="form-input" placeholder="Type an address and press Enter" inputmode="email"
        onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();adminDashboard._chipAdd('${k}',this);}"
        onblur="adminDashboard._chipAdd('${k}',this)" /></div>
      <div class="chip-list" id="chips-${k}">${list.map(e => `<span class="chip"><span>${this._safe(e)}</span>
        <button type="button" aria-label="Remove ${this._safe(e)}" onclick="adminDashboard._chipRemove('${k}','${this._safe(e)}')"><i data-lucide="x"></i></button></span>`).join('')}</div></div>`;
  }

  async _chipAdd(key, input) {
    const v = (input.value || '').trim().replace(/[;,]+$/, '');
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { this.showToast('Enter a valid e-mail address', 'error'); return; }
    const cur = String(this._settingsCache?.find(s => s.key === key)?.value || '').split(/[;,\s]+/).filter(Boolean);
    if (!cur.includes(v)) cur.push(v);
    input.value = '';
    await this._saveSetting(key, cur.join(','));
    this._switchSettingsTab(this._settingsTab, document.querySelector('.admin-settings-tab.active'));
  }

  async _chipRemove(key, email) {
    const cur = String(this._settingsCache?.find(s => s.key === key)?.value || '').split(/[;,\s]+/).filter(x => x && x !== email);
    await this._saveSetting(key, cur.join(','));
    this._switchSettingsTab(this._settingsTab, document.querySelector('.admin-settings-tab.active'));
  }

  /** Save one setting. Reports the REAL reason when the database refuses (before, failures looked like success). */
  async _persistSetting(key, v) {
    const stamp = { updated_by: this.admin.id, updated_at: new Date().toISOString() };
    const attempt = async (withStamp) => {
      // 1. change the existing row (select() returns the rows that really changed)
      const upd = await this.db.from('club_settings')
        .update(withStamp ? { value: v, ...stamp } : { value: v }).eq('key', key).select('key');
      if (upd.error) return { ok: false, error: upd.error };
      if (upd.data && upd.data.length) return { ok: true };
      // 2. no row changed → it is new (or the database silently refused the update): try to create it
      const ins = await this.db.from('club_settings')
        .insert(withStamp ? { key, value: v, ...stamp } : { key, value: v }).select('key');
      if (ins.error) return { ok: false, error: ins.error };
      return { ok: true };
    };
    let res = await attempt(true);
    if (!res.ok && /updated_by|updated_at|column/i.test(res.error?.message || '')) res = await attempt(false);
    return res;
  }

  _explainSaveError(err) {
    const t = `${err?.code || ''} ${err?.message || ''}`;
    if (/row-level security|42501|permission denied|23505|duplicate key/i.test(t))
      return 'the database is blocking changes to club_settings. Run sql/004_fix_settings_access.sql in the Supabase SQL editor, then try again.';
    if (/JWT|apikey|401/i.test(t)) return 'the Supabase key was rejected — check SUPABASE_ANON_KEY in config.js.';
    if (/fetch|network/i.test(t)) return 'no connection to Supabase.';
    return err?.message || 'unknown error';
  }

  async _saveSetting(key, value) {
    const v = String(value ?? '').trim();
    if (/(_email)$/.test(key) && key !== 'mail_extra_recipients' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      this.showToast('That does not look like a valid e-mail address', 'error'); return false;
    }
    try {
      const res = await this._persistSetting(key, v);
      if (!res.ok) throw res.error;
      this._settingsCache = this._settingsCache || [];
      const row = this._settingsCache.find(s => s.key === key);
      if (row) row.value = v; else this._settingsCache.push({ key, value: v });
      if (window.emailService?._settings) window.emailService._settings[key] = v;
      this.showToast('Saved', 'success', 1600);
      return true;
    } catch (e) {
      console.error('save setting:', key, e);
      this.showToast(`Not saved: ${this._explainSaveError(e)}`, 'error', 10000);
      return false;
    }
  }

  async _sendTestMail() {
    const to = this.admin?.email;
    if (!to || !window.emailService) { this.showToast('Mail service or your e-mail address is missing', 'error'); return; }
    this.showToast('Sending test mail…', 'info', 2000);
    const ok = await window.emailService.sendEmail({
      email_type: 'general', to_email: to, subject: 'Test mail from the club portal',
      html_message: '<p>This is a test mail. If you can read it, your mail settings work.</p>'
    });
    this.showToast(ok ? `Test mail sent to ${to}` : 'Test mail failed — check the mail function logs', ok ? 'success' : 'error');
  }

  /** Sends a mail to the signed-in admin only, with an Excel file (and an image) attached,
      and says exactly what to fix if the attachment mailer is not working. */
  async _sendTestAttachmentMail() {
    const to = this.admin?.email;
    const es = window.emailService;
    if (!to || !es) { this.showToast('Mail service or your e-mail address is missing', 'error'); return; }
    this.showToast('Sending a test mail with attachments…', 'info', 3000);
    const end = new Date(), start = new Date(end.getTime() - 30 * 864e5);
    const logo = (this._settingsCache || []).find(x => x.key === 'logo_colour_url')?.value;
    const range = { from_date: start.toLocalISODate(), to_date: end.toLocalISODate() };
    const attachments = [
      { kind: 'doc', doc: 'treasury', format: 'pdf',  name: 'Test_Statement', params: range },   // the real PDF template
      { kind: 'doc', doc: 'treasury', format: 'xlsx', name: 'Test_Statement', params: range }    // and the Excel workbook
    ];
    if (logo && /^https:\/\//i.test(logo)) attachments.push({ kind: 'url', url: logo, name: 'Test_Image' });
    const ok = await es.sendWithAttachments({
      subject: 'Test mail with attachments — club portal',
      html_body: '<p>This is a test of the attachment mailer.</p><p>If you can open the attached PDF and Excel file, posters, reports and minutes will reach members with their files too.</p>',
      email_type: 'general', recipient_group: to, attachments
    });
    if (ok) this.showToast(`Sent to ${to}. Open it and check the attached file.`, 'success', 8000);
    else this.showToast(es._explainMailError(es._lastAttachmentError), 'error', 12000);
  }

  _exportSettings() {
    const rows = (this._settingsCache || []).filter(s => !/(secret|password|private)/i.test(s.key));
    const blob = new Blob([JSON.stringify(Object.fromEntries(rows.map(s => [s.key, s.value])), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `club-settings-${new Date().toLocalISODate()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async _importSettings(input) {
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const entries = Object.entries(data).filter(([k, v]) => /^[a-z0-9_]+$/.test(k) && !/(secret|password|private)/i.test(k) && typeof v !== 'object');
      if (!entries.length) { this.showToast('No usable settings found in that file', 'error'); return; }
      if (!confirm(`Import ${entries.length} settings? Existing values with the same key will be replaced.`)) return;
      let failed = 0, firstError = null;
      for (const [key, value] of entries) {
        const res = await this._persistSetting(key, String(value ?? ''));
        if (!res.ok) { failed++; firstError = firstError || res.error; }
      }
      if (failed) throw firstError;
      this.showToast(`Imported ${entries.length} settings`, 'success');
      this._renderSettings(document.getElementById('admin-content') || document.querySelector('.admin-content'));
    } catch (e) { console.error(e); this.showToast(`Import stopped: ${this._explainSaveError(e)}`, 'error', 10000); }
  }

  /* ============================================================
     DANGER ZONE — erase portal data (super admin only)
     Keeps: Site Settings (club_settings), portfolios, club statistics counters
     and every super-admin account (so nobody is locked out).
     ============================================================ */
  _resetGroups() {
    return [
      { id: 'events',   icon: 'calendar-days', label: 'Events',
        desc: 'All events with their photos, posters and reports',
        tables: ['event_photos', 'event_reports', 'events'] },
      { id: 'meetings', icon: 'users',   label: 'Meetings',
        desc: 'All meetings with attendance records and photos',
        tables: ['meeting_attendance', 'meeting_photos', 'meetings'] },
      { id: 'treasury', icon: 'wallet',        label: 'Treasury',
        desc: 'Every transaction and the budget entries',
        tables: ['treasury_transactions', 'treasury_budget'] },
      { id: 'admins',   icon: 'shield-check',  label: 'Admin accounts added',
        desc: 'All admin logins except super admins (your own account stays)',
        tables: ['admin_activity_logs', 'admin_users'] },
      { id: 'members',  icon: 'contact',       label: 'Members & past leaders',
        desc: 'Member roster and the past-leaders timeline', tables: ['members', 'past_leaders'] },
      { id: 'content',  icon: 'newspaper',     label: 'Bulletins, applications & blood requests',
        desc: 'Newsletters, membership applications and blood requests',
        tables: ['newsletters', 'membership_applications', 'blood_requests'] },
      { id: 'chat',     icon: 'message-circle', label: 'Team chat',
        desc: 'All chat rooms, messages, reactions, polls and reports',
        tables: ['chat_reports', 'chat_poll_votes', 'chat_stars', 'chat_reactions', 'chat_message_edits', 'chat_messages', 'chat_members', 'chat_rooms', 'chat_profiles'] },
      { id: 'logs',     icon: 'scroll-text',   label: 'Notifications, mail logs & game scores',
        desc: 'Notification feed, e-mail history and saved game scores',
        tables: ['notifications', 'email_logs', 'game_scores'] }
    ];
  }

  _openResetDialog() {
    if (!this.auth.isSuperAdmin()) { this.showToast('Only the super admin can erase data', 'error'); return; }
    document.getElementById('reset-overlay')?.remove();
    const groups = this._resetGroups();
    const overlay = document.createElement('div');
    overlay.id = 'reset-overlay';
    overlay.className = 'reset-overlay';
    overlay.innerHTML = `
      <div class="reset-dialog neu-card" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <div class="reset-head">
          <span class="reset-head-ico"><i data-lucide="alert-triangle"></i></span>
          <div>
            <h3 id="reset-title">Erase portal data</h3>
            <p>This permanently deletes the records below and <strong>cannot be undone</strong>.
               Site Settings, portfolios and super-admin accounts are always kept.</p>
          </div>
        </div>
        <div class="reset-list" id="reset-list">
          ${groups.map(g => `
            <label class="reset-item">
              <input type="checkbox" class="reset-check" value="${g.id}" checked />
              <span class="reset-item-ico"><i data-lucide="${g.icon}"></i></span>
              <span class="reset-item-text"><strong>${this._safe(g.label)}</strong><small>${this._safe(g.desc)}</small></span>
              <span class="reset-item-state" id="reset-state-${g.id}"></span>
            </label>`).join('')}
        </div>
        <label class="chat-chk"><input type="checkbox" id="reset-backup" checked /> Download a backup file first (recommended)</label>
        <p class="reset-note">Uploaded image files stored on Cloudinary are not deleted — only the records that point to them.</p>
        <div class="reset-confirm">
          <label for="reset-phrase">Type <code>ERASE ALL DATA</code> to unlock the button</label>
          <div class="input-wrap"><input id="reset-phrase" class="form-input" autocomplete="off" spellcheck="false" placeholder="ERASE ALL DATA" /></div>
        </div>
        <div class="reset-actions">
          <button type="button" class="btn btn-outline" id="reset-cancel"><i data-lucide="x"></i><span>Cancel</span></button>
          <button type="button" class="btn btn-danger" id="reset-go" disabled><i data-lucide="trash-2"></i><span>Erase selected data</span></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    lucide.createIcons();

    const phrase = overlay.querySelector('#reset-phrase');
    const go = overlay.querySelector('#reset-go');
    const cancel = overlay.querySelector('#reset-cancel');
    const refresh = () => {
      const any = overlay.querySelector('.reset-check:checked');
      go.disabled = !(any && phrase.value.trim() === 'ERASE ALL DATA') || overlay.dataset.busy === '1';
    };
    phrase.addEventListener('input', refresh);
    overlay.querySelectorAll('.reset-check').forEach(c => c.addEventListener('change', refresh));
    cancel.addEventListener('click', () => { if (overlay.dataset.busy !== '1') overlay.remove(); });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay && overlay.dataset.busy !== '1') overlay.remove(); });
    go.addEventListener('click', () => this._runReset(overlay));
    setTimeout(() => phrase.focus(), 50);
  }

  async _countRows(table) {
    const { count, error } = await this.db.from(table).select('*', { count: 'exact', head: true });
    return error ? { error } : { count: count || 0 };
  }

  /** Delete every row of one table (or, for admin_users, every non-super-admin row). Returns { ok, deleted, left, note }. */
  async _wipeTable(table) {
    const keepSuper = table === 'admin_users';
    const before = await this._countRows(table);
    if (before.error) {
      // table not created in this project → nothing to erase
      if (/does not exist|relation|schema cache|42P01|PGRST205/i.test(before.error.message || before.error.code || '')) return { ok: true, deleted: 0, left: 0, note: 'not present' };
      return { ok: false, error: before.error };
    }
    if (before.count === 0) return { ok: true, deleted: 0, left: 0 };

    const run = async (col) => {
      let q = this.db.from(table).delete();
      q = keepSuper ? q.neq('role', 'super_admin') : q.not(col, 'is', null);
      return q;
    };
    let { error } = await run('id');
    if (error && /column .*id.* does not exist|42703/i.test(error.message || error.code || '')) ({ error } = await run('created_at'));
    if (error) return { ok: false, error };

    const after = await this._countRows(table);
    const left = after.error ? 0 : after.count;
    const expectedLeft = keepSuper ? (await this.db.from(table).select('id', { count: 'exact', head: true }).eq('role', 'super_admin')).count || 0 : 0;
    if (left > expectedLeft) {
      return { ok: false, deleted: before.count - left, left, error: { message: 'Some rows were not deleted — the database blocked it (row-level security / delete permission).' } };
    }
    return { ok: true, deleted: before.count - left, left };
  }

  async _runReset(overlay) {
    if (!this.auth.isSuperAdmin()) return;
    const chosen = [...overlay.querySelectorAll('.reset-check:checked')].map(c => c.value);
    if (!chosen.length) return;
    const groups = this._resetGroups().filter(g => chosen.includes(g.id));

    const wantBackup = overlay.querySelector('#reset-backup')?.checked;
    overlay.dataset.busy = '1';
    overlay.querySelectorAll('input,button').forEach(el => { el.disabled = true; });
    if (wantBackup) {
      try { await this._downloadBackup(true); }
      catch (e) {
        overlay.dataset.busy = '0'; overlay.querySelectorAll('input,button').forEach(el => { el.disabled = false; });
        this.showToast('Backup failed, so nothing was erased: ' + (e.message || e), 'error'); return;
      }
    }
    const setState = (id, html, cls = '') => {
      const el = overlay.querySelector(`#reset-state-${id}`);
      if (el) { el.className = `reset-item-state ${cls}`; el.innerHTML = html; lucide.createIcons(); }
    };

    // Child tables first inside each group; groups run in dependency order.
    const order = ['events', 'meetings', 'treasury', 'chat', 'logs', 'content', 'admins', 'members'];
    groups.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

    const failures = [];
    let totalDeleted = 0;
    for (const g of groups) {
      setState(g.id, '<i data-lucide="loader-2" class="reset-spin"></i>', 'is-busy');
      let groupOk = true;
      for (const t of g.tables) {
        const r = await this._wipeTable(t);
        totalDeleted += r.deleted || 0;
        if (!r.ok) {
          groupOk = false;
          const why = r.error?.message || r.error?.details || String(r.error || 'unknown error');
          failures.push(`${t}: ${why}`);
          console.error('[reset]', t, r.error);
        }
      }
      setState(g.id, groupOk ? '<i data-lucide="check"></i>' : '<i data-lucide="x"></i>', groupOk ? 'is-ok' : 'is-fail');
    }

    try { await this.auth.logActivity(this.admin.id, 'DATA_RESET', null, null, { groups: chosen, rows_deleted: totalDeleted, failures: failures.length }); } catch (e) { /* ignore */ }

    overlay.dataset.busy = '0';
    const actions = overlay.querySelector('.reset-actions');
    actions.innerHTML = `<button type="button" class="btn btn-primary" id="reset-done"><i data-lucide="check"></i><span>Done</span></button>`;
    const note = overlay.querySelector('.reset-note');
    if (failures.length) {
      note.className = 'reset-note is-error';
      note.innerHTML = `<strong>Some data could not be erased:</strong><br>${failures.map(f => this._safe(f)).join('<br>')}<br>Most often this means the database has no delete permission for that table — run <code>sql/004_fix_settings_access.sql</code> and try again.`;
    } else {
      note.className = 'reset-note is-ok';
      note.textContent = `Finished. ${totalDeleted} record${totalDeleted === 1 ? '' : 's'} erased. Site Settings were not touched.`;
    }
    lucide.createIcons();
    overlay.querySelector('#reset-done').addEventListener('click', async () => {
      overlay.remove();
      this._settingsCache = null; this._adminRows = null;
      try { await this.navigateTo('dashboard'); } catch (e) { location.reload(); }
    });
    this.showToast(failures.length ? 'Reset finished with errors' : 'All selected data erased', failures.length ? 'warning' : 'success', 7000);
  }

  /* ============================================================
     PORTFOLIOS  (titles shown on admin accounts and report signatures)
     Managed by the super admin in Site Settings → Portfolios
     ============================================================ */
  _signatureSlots() {
    return [
      ['none',                       'No signature slot'],
      ['club_service',               'Signs Club Service reports'],
      ['community_service',          'Signs Community Service reports'],
      ['professional_service',       'Signs Professional Service reports'],
      ['international_service',      'Signs International Service reports'],
      ['district_priority_projects', 'Signs DPP reports'],
      ['treasurer',                  'Signs treasury documents']
    ];
  }

  async _loadPortfolios(force = false) {
    if (this._portfolios && !force) return this._portfolios;
    this._portfolioError = null;
    try {
      const { data, error } = await this.db.from('admin_portfolios')
        .select('*').order('sort_order').order('name');
      if (error) throw error;
      let adminRows = null;
      {
        const r = await this.db.from('admin_users').select('id,portfolio_id,portfolio_ids,is_active');
        adminRows = r.error ? (await this.db.from('admin_users').select('id,portfolio_id,is_active')).data : r.data;
      }
      const counts = {};
      (adminRows || []).forEach(a => {
        if (!a.is_active) return;
        new Set([a.portfolio_id, ...(a.portfolio_ids || [])].filter(Boolean)).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      });
      this._portfolios = data || [];
      this._portfolioCounts = counts;
    } catch (e) {
      console.warn('portfolios unavailable:', e?.message || e);
      this._portfolios = [];
      this._portfolioCounts = {};
      this._portfolioError = 'The portfolio table is missing. Run sql/002_admin_portfolios.sql in the Supabase SQL editor.';
    }
    return this._portfolios;
  }

  _portfolioOptions(selectedId, includeBlank = true) {
    const rows = (this._portfolios || []).filter(p => p.is_active || p.id === selectedId);
    return (includeBlank ? '<option value="">Use role title (no portfolio)</option>' : '') +
      rows.map(p => `<option value="${this._safe(p.id)}" ${p.id === selectedId ? 'selected' : ''}>${this._safe(p.name)}${p.is_active ? '' : ' (disabled)'}</option>`).join('');
  }

  _portfoliosHTML() {
    const rows = this._portfolios || [];
    const counts = this._portfolioCounts || {};
    const slots = this._signatureSlots();
    const slotSelect = (cur, attrs) => `<div class="select-wrap"><select class="form-select" ${attrs}>
      ${slots.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
    return `<div class="set-grid">
      ${this._portfolioError ? `<div class="set-note"><i data-lucide="alert-triangle"></i><span>${this._safe(this._portfolioError)}</span></div>` : ''}
      <section class="set-section neu-card">
        <header class="set-section-head"><span class="set-ico"><i data-lucide="badge-plus"></i></span>
          <div><h3>Add a portfolio</h3><p>Create a new title for admin users, for example “Sports Director”</p></div></header>
        <div class="set-body">
          <div class="set-row"><div class="set-meta"><label>Portfolio name</label><p class="set-hint">Printed under the signature on documents.</p></div>
            <div class="set-control"><div class="input-wrap"><input id="pf-name" class="form-input" maxlength="80" placeholder="e.g. Sports Director" /></div></div></div>
          <div class="set-row"><div class="set-meta"><label>Signature slot</label><p class="set-hint">Optional. The admin holding this portfolio signs the chosen documents.</p></div>
            <div class="set-control">${slotSelect('none', 'id="pf-slot"')}</div></div>
          <div class="set-row"><span></span><div class="set-control is-end">
            <button class="btn btn-primary" onclick="adminDashboard._addPortfolio()"><i data-lucide="plus"></i><span>Add portfolio</span></button></div></div>
        </div>
      </section>
      <section class="set-section neu-card">
        <header class="set-section-head"><span class="set-ico"><i data-lucide="badge-check"></i></span>
          <div><h3>All portfolios</h3><p>${rows.length} portfolio${rows.length === 1 ? '' : 's'} · assign them in Admin Users</p></div></header>
        <div class="set-body"><div class="route-table">
          ${rows.length ? rows.map(p => `
            <div class="route-row pf-row">
              <div class="route-name"><i data-lucide="${p.is_built_in ? 'lock' : 'badge-check'}"></i>
                <div>${this._safe(p.name)}<small>${counts[p.id] || 0} admin${(counts[p.id] || 0) === 1 ? '' : 's'}${p.is_built_in ? ' · built-in' : ''}${p.is_active ? '' : ' · disabled'}</small></div></div>
              ${slotSelect(p.signature_slot || 'none', `onchange="adminDashboard._updatePortfolio('${this._safe(p.id)}',{signature_slot:this.value})"`)}
              <div class="pf-actions">
                <label class="admin-toggle" title="${p.is_active ? 'Disable' : 'Enable'}"><input type="checkbox" ${p.is_active ? 'checked' : ''}
                  onchange="adminDashboard._updatePortfolio('${this._safe(p.id)}',{is_active:this.checked})" /><span class="admin-toggle-slider"></span></label>
                ${p.is_built_in ? '' : `<button class="admin-action-btn admin-action-danger" title="Delete" onclick="adminDashboard._deletePortfolio('${this._safe(p.id)}')"><i data-lucide="trash-2"></i></button>`}
              </div>
            </div>`).join('') : '<p class="set-hint" style="padding:8px 0;">No portfolios yet.</p>'}
        </div></div>
      </section>
    </div>`;
  }

  async _refreshPortfolioTab() {
    await this._loadPortfolios(true);
    const el = document.getElementById('settings-tab-content');
    if (el && this._settingsTab === 'portfolios') { el.innerHTML = this._portfoliosHTML(); lucide.createIcons(); }
  }

  async _addPortfolio() {
    if (!this.auth.isSuperAdmin()) { this.showToast('Only the super admin can add portfolios', 'error'); return; }
    const name = (document.getElementById('pf-name')?.value || '').trim().replace(/\s+/g, ' ');
    const slot = document.getElementById('pf-slot')?.value || 'none';
    if (name.length < 2) { this.showToast('Enter a portfolio name', 'error'); return; }
    if ((this._portfolios || []).some(p => p.name.toLowerCase() === name.toLowerCase())) { this.showToast('That portfolio already exists', 'error'); return; }
    const { error } = await this.db.from('admin_portfolios').insert({
      name, signature_slot: slot, is_active: true, is_built_in: false, sort_order: 100, created_by: this.admin.id
    });
    if (error) { console.error(error); this.showToast('Could not add the portfolio', 'error'); return; }
    this.showToast('Portfolio added', 'success');
    await this._refreshPortfolioTab();
  }

  async _updatePortfolio(id, patch) {
    if (!this.auth.isSuperAdmin()) { this.showToast('Only the super admin can change portfolios', 'error'); return; }
    const { error } = await this.db.from('admin_portfolios').update(patch).eq('id', id);
    if (error) { console.error(error); this.showToast('Could not update the portfolio', 'error'); }
    else this.showToast('Saved', 'success', 1500);
    await this._refreshPortfolioTab();
  }

  async _deletePortfolio(id) {
    if (!this.auth.isSuperAdmin()) { this.showToast('Only the super admin can delete portfolios', 'error'); return; }
    const p = (this._portfolios || []).find(x => x.id === id);
    if (!p) return;
    if ((this._portfolioCounts || {})[id]) { this.showToast('Unassign this portfolio from its admins first', 'error'); return; }
    this.confirmAction('Delete portfolio', `Delete “${p.name}”? This cannot be undone.`, async () => {
      const { error } = await this.db.from('admin_portfolios').delete().eq('id', id);
      if (error) { this.showToast('Could not delete the portfolio', 'error'); return; }
      this.showToast('Portfolio deleted', 'success');
      await this._refreshPortfolioTab();
    });
  }

  /* ============================================================
     ADMIN USERS
     ============================================================ */
  async _renderAdminUsers(container) {
    if (!this.auth.can('MANAGE_ADMINS')) {
      container.innerHTML = this._accessDenied();
      lucide.createIcons();
      return;
    }
    await this._loadPortfolios(true);
    let admins = null;
    {
      const r = await this.db.from('admin_users')
        .select('id,email,full_name,role,is_active,avenue,last_login,login_attempts,portfolio_id,extra_roles,portfolio_ids')
        .order('role').order('full_name');
      if (r.error) {   // portfolio column not created yet — keep the screen working
        const r2 = await this.db.from('admin_users')
          .select('id,email,full_name,role,is_active,avenue,last_login,login_attempts').order('role').order('full_name');
        admins = r2.data;
      } else admins = r.data;
    }
    this._adminRows = admins || [];
    const pName = (id) => (this._portfolios || []).find(p => p.id === id)?.name || '';
    const pNames = (a) => [...new Set([a.portfolio_id, ...(a.portfolio_ids || [])].filter(Boolean))].map(pName).filter(Boolean);

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title"><i data-lucide="shield-check"></i> Admin Users</h1>
          <p class="admin-section-subtitle">${admins?.length || 0} admin accounts</p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.isSuperAdmin() ? `
          <button class="btn btn-outline" onclick="adminDashboard._settingsTab='portfolios';adminDashboard.navigateTo('settings')">
            <i data-lucide="badge-check"></i><span>Manage portfolios</span>
          </button>` : ''}
          <button class="btn btn-primary" onclick="adminDashboard._showCreateAdmin()">
            <i data-lucide="user-plus"></i><span>Add Admin</span>
          </button>
        </div>
      </div>
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>Admin User</th><th>Role</th><th>Portfolio</th><th>Avenue</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${(admins || []).map(a => `
                <tr>
                  <td>
                    <div class="admin-table-user">
                      <div class="admin-table-user-avatar"><i data-lucide="user-circle-2"></i></div>
                      <div>
                        <div class="admin-user-name">${this._safe(a.full_name)}${a.id === this.admin.id ? '<span class="admin-you-tag">You</span>' : ''}</div>
                        <div class="admin-user-mail">${this._safe(a.email)}</div>
                      </div>
                    </div>
                  </td>
                  <td><div class="admin-chip-stack">${RoleUtils.labels(a).map((l, i) => `<span class="admin-role-text${i ? ' is-extra' : ''}">${this._safe(l)}</span>`).join('')}</div></td>
                  <td>${pNames(a).length ? `<div class="admin-chip-stack">${pNames(a).map(n => `<span class="admin-portfolio-chip"><i data-lucide="badge-check"></i>${this._safe(n)}</span>`).join('')}</div>` : '<span class="admin-muted">Role title</span>'}</td>
                  <td>${a.avenue ? `<span class="admin-muted-strong">${this._safe(AVENUES[a.avenue]?.label || a.avenue)}</span>` : '<span class="admin-muted">—</span>'}</td>
                  <td>
                    <span class="admin-status-badge" style="background:${a.is_active ? 'var(--success-light)' : 'var(--danger-light)'};color:${a.is_active ? 'var(--success)' : 'var(--danger)'};">
                      ${a.is_active ? 'Active' : 'Inactive'}
                    </span>
                    ${(a.login_attempts || 0) >= 3 ? `<span class="admin-status-badge" style="background:var(--warning-light);color:var(--warning);margin-left:4px;">${a.login_attempts} failed</span>` : ''}
                  </td>
                  <td class="admin-muted">${a.last_login ? this.getTimeAgo(a.last_login) : 'Never'}</td>
                  <td>
                    <div class="admin-table-actions">
                      <button class="admin-action-btn" title="Edit role & portfolio" onclick="adminDashboard._showEditAdmin('${this._safe(a.id)}')"><i data-lucide="pencil"></i></button>
                      <button class="admin-action-btn" title="Set Password" onclick="adminDashboard._setAdminPassword('${this._safe(a.id)}','${this._safe(a.full_name)}')"><i data-lucide="key"></i></button>
                      ${a.id !== this.admin.id ? `
                      <button class="admin-action-btn ${a.is_active ? 'admin-action-danger' : 'admin-action-success'}" title="${a.is_active ? 'Deactivate' : 'Activate'}"
                              onclick="adminDashboard._toggleAdminStatus('${this._safe(a.id)}',${a.is_active})"><i data-lucide="${a.is_active ? 'user-x' : 'user-check'}"></i></button>` : ''}
                    </div>
                  </td>
                </tr>`).join('') || '<tr><td colspan="7" class="admin-table-empty">No admin users found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    lucide.createIcons();
  }

  _adminFormFields(a = null) {
    const isEdit = !!a;
    const self = isEdit && a.id === this.admin.id;
    const roleEntries = Object.entries(ROLE_DISPLAY_NAMES).filter(([k]) => k !== 'member');
    const extraSet = new Set(isEdit ? (a.extra_roles || []) : []);
    const portSet  = new Set(isEdit ? [a.portfolio_id, ...(a.portfolio_ids || [])].filter(Boolean) : []);
    const anyAvenueRole = isEdit && RoleUtils.all(a).some(r => this._avenueRoles().includes(r));
    return `
      <div class="form-group"><label class="form-label">Full Name *</label>
        <div class="input-wrap"><input type="text" name="full_name" class="form-input" placeholder="Full name" required value="${isEdit ? this._safe(a.full_name) : ''}" /></div></div>
      ${isEdit ? '' : `
      <div class="form-group"><label class="form-label">Email *</label>
        <div class="input-wrap"><input type="email" name="email" class="form-input" placeholder="Email address" required /></div></div>
      <div class="form-group"><label class="form-label">Password * (min 8 characters)</label>
        <div class="input-wrap"><input type="password" name="password" class="form-input" placeholder="••••••••" required minlength="8" autocomplete="new-password" /></div></div>`}
      <div class="form-group"><label class="form-label">Main role * <span class="admin-hint">(permissions + default title)</span></label>
        <div class="select-wrap"><select name="role" class="form-select" required ${self ? 'disabled' : ''} onchange="adminDashboard._syncAdminForm()">
          <option value="">Select role</option>
          ${roleEntries.map(([k, v]) => `<option value="${k}" ${isEdit && a.role === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select></div>${self ? '<p class="admin-hint">You cannot change your own main role.</p>' : ''}</div>

      <div class="form-group"><label class="form-label">Additional roles <span class="admin-hint">(optional — for someone who holds more than one post)</span></label>
        <div class="pick-grid" id="admin-extra-roles">
          ${roleEntries.map(([k, v]) => `
            <label class="pick-chip"><input type="checkbox" name="extra_roles" value="${k}" ${extraSet.has(k) ? 'checked' : ''} onchange="adminDashboard._syncAdminForm()" /><span>${v}</span></label>`).join('')}
        </div>
        <p class="admin-hint">Permissions from every selected role are combined.</p></div>

      <div class="form-group"><label class="form-label">Portfolios <span class="admin-hint">(titles printed under signatures — pick every one that applies)</span></label>
        <div class="pick-grid" id="admin-portfolios">
          ${(this._portfolios || []).filter(p => p.is_active || portSet.has(p.id)).map(p => `
            <label class="pick-chip"><input type="checkbox" name="portfolio_ids" value="${this._safe(p.id)}" ${portSet.has(p.id) ? 'checked' : ''} /><span>${this._safe(p.name)}</span></label>`).join('') || '<p class="admin-hint">No portfolios yet — add them in Site Settings → Portfolios.</p>'}
        </div>
        <p class="admin-hint">The first one ticked is the main title. Super admins can add more in Site Settings → Portfolios.</p></div>

      <div class="form-group" id="admin-avenue-wrap" style="display:${anyAvenueRole ? 'block' : 'none'};">
        <label class="form-label">Avenue</label>
        <div class="select-wrap"><select name="avenue" class="form-select">
          <option value="">Select Avenue</option>
          ${Object.entries(AVENUES).map(([k, v]) => `<option value="${k}" ${isEdit && a.avenue === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select></div></div>`;
  }

  _avenueRoles() {
    return ['avenue_director_club_service', 'avenue_director_community_service',
      'avenue_director_professional_service', 'avenue_director_international_service', 'district_priority_chair'];
  }

  async _showCreateAdmin() {
    await this._loadPortfolios();
    this._openAdminModal({
      id: 'create-admin-modal', icon: 'user-plus', title: 'Add Admin User', submit: 'Create Admin', fields: this._adminFormFields(),
      onSubmit: async (data) => {
        const { extra_roles, portfolio_ids, ...rest } = data;
        const extras = (extra_roles || []).filter(r => r && r !== rest.role);
        const ports  = [...new Set(portfolio_ids || [])];
        const result = await this.auth.createAdminUser(rest);
        if (!result.success) return result;
        if (extras.length || ports.length) {
          const { data: row } = await this.db.from('admin_users').select('id').eq('email', String(rest.email).toLowerCase().trim()).single();
          if (row?.id) await this.db.from('admin_users').update({ extra_roles: extras, portfolio_ids: ports, portfolio_id: ports[0] || null }).eq('id', row.id);
        }
        return result;
      }
    });
  }

  async _showEditAdmin(adminId) {
    await this._loadPortfolios();
    const a = (this._adminRows || []).find(x => x.id === adminId);
    if (!a) return;
    this._openAdminModal({
      id: 'edit-admin-modal', icon: 'pencil', title: `Edit ${a.full_name}`, submit: 'Save changes', fields: this._adminFormFields(a),
      onSubmit: async (data) => {
        const mainRole = (a.id !== this.admin.id && data.role) ? data.role : a.role;
        const ports  = [...new Set(data.portfolio_ids || [])];
        const extras = (data.extra_roles || []).filter(r => r && r !== mainRole);
        const updates = { full_name: String(data.full_name || '').trim(), extra_roles: extras, portfolio_ids: ports, portfolio_id: ports[0] || null };
        if (a.id !== this.admin.id && data.role) updates.role = data.role;
        updates.avenue = [mainRole, ...extras].some(r => this._avenueRoles().includes(r)) ? (data.avenue || null) : null;
        if (!updates.full_name) return { success: false, message: 'Name is required' };
        return await this.auth.updateAdminUser(a.id, updates);
      }
    });
  }

  _openAdminModal({ id, icon, title, submit, fields, onSubmit }) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = id;
    const close = () => { modal.remove(); document.body.style.overflow = ''; };
    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title-area"><h2 class="modal-title"><i data-lucide="${icon}"></i><span>${this._safe(title)}</span></h2></div>
          <button type="button" class="modal-close" aria-label="Close"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
          <form id="${id}-form" novalidate>
            ${fields}
            <div class="form-message" id="${id}-msg"></div>
            <div class="admin-form-actions">
              <button type="button" class="btn btn-outline" data-cancel>Cancel</button>
              <button type="submit" class="btn btn-primary"><i data-lucide="check"></i><span>${this._safe(submit)}</span></button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    this._syncAdminForm?.();           // disable the main role in the extras list, show Avenue when needed
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('[data-cancel]').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.extra_roles    = fd.getAll('extra_roles');      // checkboxes can hold several values
      data.portfolio_ids  = fd.getAll('portfolio_ids');
      const msgEl = document.getElementById(`${id}-msg`);
      const btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
      const result = await onSubmit(data, msgEl);
      btn.disabled = false;
      if (result?.success) {
        this.showToast('Saved', 'success');
        close();
        await this._renderAdminUsers(document.getElementById('admin-content'));
      } else if (msgEl) { msgEl.textContent = result?.message || 'Failed'; msgEl.className = 'form-message error'; }
    });
    lucide.createIcons();
  }

  /** Show the Avenue field when the main role OR any additional role is an avenue post */
  _syncAdminForm() {
    const form = document.querySelector('#create-admin-modal-form, #edit-admin-modal-form');
    if (!form) return;
    const main = form.querySelector('[name="role"]')?.value || '';
    const extras = [...form.querySelectorAll('[name="extra_roles"]:checked')].map(i => i.value);
    const wrap = document.getElementById('admin-avenue-wrap');
    if (wrap) wrap.style.display = [main, ...extras].some(r => this._avenueRoles().includes(r)) ? 'block' : 'none';
    // an additional role can't repeat the main role
    form.querySelectorAll('[name="extra_roles"]').forEach(i => {
      i.disabled = (i.value === main);
      if (i.disabled) i.checked = false;
    });
  }
  _onAdminRoleChange() { this._syncAdminForm(); }

  async _setAdminPassword(adminId, adminName) {
    const pw = prompt(`Set new password for ${adminName}:\n(Minimum 8 characters)`);
    if (!pw) return;
    if (pw.length < 8) { this.showToast('Password must be at least 8 characters', 'error'); return; }
    const result = await this.auth.setAdminPassword(adminId, pw);
    if (result.success) this.showToast(`Password updated for ${adminName}`, 'success');
    else this.showToast(result.message || 'Failed', 'error');
  }

  async _toggleAdminStatus(adminId, current) {
    this.confirmAction(
      current ? 'Deactivate Admin' : 'Activate Admin',
      `Are you sure you want to ${current ? 'deactivate' : 'activate'} this admin account?`,
      async () => {
        const result = await this.auth.updateAdminUser(adminId, { is_active: !current });
        if (result.success) {
          this.showToast(`Admin ${current ? 'deactivated' : 'activated'}`, 'success');
          await this._renderAdminUsers(document.getElementById('admin-content'));
        } else {
          this.showToast(result.message || 'Failed', 'error');
        }
      }
    );
  }

  /* ============================================================
     ACTIVITY LOGS
     ============================================================ */
  async _renderActivityLogs(container) {
    if (!this.auth.can('VIEW_LOGS')) { container.innerHTML = this._accessDenied(); lucide.createIcons(); return; }
    const { data: logs } = await this.db.from('admin_activity_logs')
      .select('*,admin_users(full_name,role)')
      .order('created_at', { ascending:false }).limit(100);
    container.innerHTML = `
      <div class="admin-section-header">
        <h1 class="admin-section-title"><i data-lucide="activity"></i> Activity Logs</h1>
      </div>
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Admin</th><th>Action</th><th>Table</th><th>Time</th></tr></thead>
            <tbody>
              ${(logs||[]).map(log => `
                <tr>
                  <td>
                    <div style="font-weight:600;">${this._safe(log.admin_users?.full_name||'System')}</div>
                    <div style="font-size:.72rem;color:var(--text-muted);">
                      ${ROLE_DISPLAY_NAMES[log.admin_users?.role]||''}
                    </div>
                  </td>
                  <td><span style="font-size:.82rem;">${this._safe(log.action)}</span></td>
                  <td><span style="font-size:.78rem;color:var(--text-muted);">${this._safe(log.table_name||'-')}</span></td>
                  <td style="font-size:.78rem;color:var(--text-muted);">
                    ${DateUtils.format(log.created_at,'short')}
                    ${new Date(log.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                  </td>
                </tr>`).join('')
              || '<tr><td colspan="4" class="admin-table-empty">No logs found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    lucide.createIcons();
  }

  /* ============================================================
     PENDING COUNTS
     ============================================================ */
  async _loadPendingCounts() {
    try {
      const [pendingEv, pendingApps, pendingBlood] = await Promise.all([
        this.auth.can('APPROVE_EVENT')
          ? this.db.from('events').select('id',{count:'exact',head:true}).eq('status','pending_approval')
          : Promise.resolve({count:0}),
        this.auth.can('REVIEW_APPLICATIONS')
          ? this.db.from('membership_applications').select('id',{count:'exact',head:true}).eq('status','pending')
          : Promise.resolve({count:0}),
        this.auth.can('MANAGE_BLOOD_REQUESTS')
          ? this.db.from('blood_requests').select('id',{count:'exact',head:true}).eq('status','active')
          : Promise.resolve({count:0})
      ]);
      this.pendingCounts = {
        'events-pending': pendingEv.count   || 0,
        applications:     pendingApps.count  || 0,
        'blood-requests': pendingBlood.count || 0
      };
      const total = Object.values(this.pendingCounts).reduce((a,b) => a+b, 0);
      const badge = document.getElementById('admin-notif-count');
      if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'flex' : 'none'; }
    } catch (e) { console.warn('Pending counts error:', e); }
  }

  /* ============================================================
     REALTIME
     ============================================================ */
  /* ============================================================
     FULL DATA BACKUP (super admin) — one JSON file with every portal table
     ============================================================ */
  async _downloadBackup(silent = false) {
    const tables = ['club_settings', 'club_statistics', 'admin_portfolios', 'admin_users', 'members', 'past_leaders', 'events', 'event_photos', 'event_reports',
      'meetings', 'meeting_photos', 'meeting_attendance', 'treasury_transactions', 'treasury_budget', 'newsletters', 'membership_applications', 'blood_requests',
      'notifications', 'game_scores', 'admin_activity_logs', 'chat_rooms', 'chat_members', 'chat_messages', 'chat_reactions', 'chat_stars', 'chat_poll_votes', 'chat_reports', 'chat_profiles'];
    const secret = /password|hash|token|secret|salt/i;
    const out = { app: 'rotaract-portal', format: 1, exported_at: new Date().toISOString(), exported_by: this.admin.full_name, tables: {}, skipped: [] };
    if (!silent) this.showToast('Preparing backup…', 'info');
    for (const t of tables) {
      let rows = [], from = 0, failed = false;
      for (let i = 0; i < 200; i++) {                       // up to 200 000 rows per table
        const { data, error } = await this.db.from(t).select('*').range(from, from + 999);
        if (error) { failed = true; break; }
        rows = rows.concat(data || []); if (!data || data.length < 1000) break; from += 1000;
      }
      if (failed && !rows.length) { out.skipped.push(t); continue; }
      out.tables[t] = rows.map(r => { const c = {}; Object.keys(r).forEach(k => { if (!secret.test(k)) c[k] = r[k]; }); return c; });
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `rotaract-portal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    try { await this.auth.logActivity(this.admin.id, 'DATA_BACKUP', null, null, { tables: Object.keys(out.tables).length }); } catch (e) { /* silent */ }
    if (!silent) this.showToast(`Backup downloaded (${Object.keys(out.tables).length} tables${out.skipped.length ? ', ' + out.skipped.length + ' unavailable' : ''}). Password fields are never included.`, 'success', 6000);
    return true;
  }

  /* ============================================================
     COMMAND PALETTE — Ctrl/⌘ + K : jump to any screen, find members and events
     ============================================================ */
  _initPalette() {
    if (this._paletteReady) return; this._paletteReady = true;
    // capture phase: in the admin area this shortcut opens the admin palette instead of the public-site search overlay
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); this._openPalette(); }
      else if (e.key === 'Escape') document.getElementById('cmdk-overlay')?.remove();
    }, true);
    try {
      if (!localStorage.getItem('rac_cmdk_tip')) { localStorage.setItem('rac_cmdk_tip', '1'); setTimeout(() => this.showToast('Tip: press Ctrl + K (or ⌘ + K) to jump anywhere quickly.', 'info', 7000), 4000); }
    } catch (e) { /* silent */ }
  }

  _openPalette() {
    if (document.getElementById('cmdk-overlay')) return;
    const screens = [...document.querySelectorAll('.admin-sidebar-item[data-section]')].map(b => ({ id: b.dataset.section, label: (b.querySelector('span')?.textContent || b.textContent || b.dataset.section).trim().replace(/\s+\d+\+?$/, '') }));
    const ov = document.createElement('div'); ov.id = 'cmdk-overlay'; ov.className = 'cmdk-overlay';
    ov.innerHTML = `<div class="cmdk neu-card" role="dialog" aria-modal="true" aria-label="Quick search">
      <div class="cmdk-input"><i data-lucide="search"></i><input id="cmdk-q" placeholder="Go to a screen, or search members and events…" autocomplete="off" /><kbd>Esc</kbd></div>
      <div class="cmdk-list" id="cmdk-list"></div></div>`;
    document.body.appendChild(ov); if (window.lucide) lucide.createIcons();
    const input = ov.querySelector('#cmdk-q'), list = ov.querySelector('#cmdk-list');
    let items = [], sel = 0, seq = 0;
    const esc = (t) => this._safe(t);
    const draw = () => {
      list.innerHTML = items.length ? items.map((it, i) => `<button type="button" class="cmdk-item ${i === sel ? 'on' : ''}" data-i="${i}"><i data-lucide="${it.icon}"></i><span><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span><em>${esc(it.tag)}</em></button>`).join('') : '<p class="cmdk-empty">No matches</p>';
      if (window.lucide) lucide.createIcons(); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    };
    const go = (it) => { ov.remove(); if (it) this.navigateTo(it.section); };
    const run = async (q) => {
      const my = ++seq, ql = q.trim().toLowerCase();
      items = screens.filter(s => !ql || s.label.toLowerCase().includes(ql) || s.id.includes(ql)).slice(0, 8).map(s => ({ icon: 'corner-down-right', label: s.label, tag: 'Go to', section: s.id }));
      sel = 0; draw();
      if (ql.length < 2) return;
      try {
        const [m, e] = await Promise.all([
          this.db.from('members').select('full_name,email').ilike('full_name', `%${ql}%`).limit(5),
          this.db.from('events').select('title,event_date').ilike('title', `%${ql}%`).limit(5)
        ]);
        if (my !== seq) return;
        (m.data || []).forEach(x => items.push({ icon: 'user', label: x.full_name, sub: x.email || '', tag: 'Member', section: 'members-list' }));
        (e.data || []).forEach(x => items.push({ icon: 'calendar-days', label: x.title, sub: x.event_date ? new Date(x.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '', tag: 'Event', section: 'events-list' }));
        draw();
      } catch (err) { /* silent */ }
    };
    let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run(input.value), 180); });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); go(items[sel]); }
    });
    list.addEventListener('click', (ev) => { const b = ev.target.closest('[data-i]'); if (b) go(items[+b.dataset.i]); });
    ov.addEventListener('mousedown', (ev) => { if (ev.target === ov) ov.remove(); });
    run(''); input.focus();
  }

  /* ---------- offline banner ---------- */
  _initConnectionBanner() {
    if (this._bannerReady) return; this._bannerReady = true;
    const show = () => {
      if (document.getElementById('offline-banner')) return;
      const b = document.createElement('div'); b.id = 'offline-banner'; b.className = 'offline-banner'; b.setAttribute('role', 'status');
      b.innerHTML = '<i data-lucide="wifi-off"></i><span>You are offline — changes cannot be saved until the connection returns.</span>';
      document.body.appendChild(b); if (window.lucide) lucide.createIcons();
    };
    const hide = () => { const b = document.getElementById('offline-banner'); if (b) { b.remove(); this.showToast('Back online', 'success'); } };
    window.addEventListener('offline', show); window.addEventListener('online', hide);
    if (navigator.onLine === false) show();
  }

  /* ---------- TEAM CHAT ---------- */
  async _startChatBackground() {
    try {
      if (!window.AdminChat) return;
      this.chat = this.chat || new AdminChat(this);
      await this.chat.init();
      this.chat.startRealtime();
    } catch (e) { console.warn('[chat] background start failed (run sql/004 section 7?):', e); }
  }

  async _renderChat(content) {
    content.classList.add('is-chat');
    try {
      this.chat = this.chat || new AdminChat(this);
      await this.chat.init();
      this.chat.startRealtime();
      await this.chat.mount(content);
    } catch (e) {
      console.error('[chat]', e);
      content.innerHTML = `<div style="padding:40px;text-align:center;"><div class="neu-card placeholder-card"><i data-lucide="message-circle-off"></i>
        <p><strong>Team Chat is not set up yet.</strong><br>Run <code>sql/004_fix_settings_access.sql</code> (section 7) in the Supabase SQL editor, then reload.</p>
        <button class="btn btn-outline" onclick="adminDashboard.navigateTo('chat')"><i data-lucide="refresh-cw"></i><span>Retry</span></button></div></div>`;
      lucide.createIcons();
    }
  }

  _setupRealtime() {
    try {
      this.db.channel('admin-realtime')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'membership_applications' }, () => {
          this._loadPendingCounts();
          this.showToast('New membership application!', 'info');
        })
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'blood_requests' }, () => {
          this._loadPendingCounts();
          this.showToast('New blood request submitted!', 'warning');
        })
        .on('postgres_changes', {
          event:'INSERT', schema:'public', table:'events', filter:'status=eq.pending_approval'
        }, () => {
          this._loadPendingCounts();
          this.showToast('New event submitted for approval!', 'info');
        })
        .subscribe();
    } catch (e) { console.warn('Realtime setup error:', e); }
  }

  /* ============================================================
     BIRTHDAY CHECKER
     ============================================================ */
  _startBirthdayChecker() {
    const check = async () => {
      if (!this.auth.can('SEND_NOTIFICATIONS')) return;
      try {
        const today = new Date();
        const { data } = await this.db.from('members')
          .select('id,full_name,email,date_of_birth')
          .eq('is_active',true).not('date_of_birth','is',null);
        if (!data) return;
        for (const m of data) {
          const dob = new Date(m.date_of_birth);
          if (dob.getDate()===today.getDate() && dob.getMonth()===today.getMonth()) {
            const key = `bday_${m.id}_${today.getFullYear()}`;
            if (!Storage.get(key) && window.emailService) {
              await window.emailService.sendBirthdayWish(m);
              Storage.set(key, true, 24*60*60*1000);
            }
          }
        }
      } catch (e) { console.warn('Birthday check error:', e); }
    };
    setTimeout(check, 5000);
    setInterval(check, 60*60*1000);
  }

  /* ============================================================
     MEETING TIMERS
     ============================================================ */
  async _setupMeetingTimers() {
    try {
      const today = new Date().toLocalISODate();
      const { data } = await this.db.from('meetings')
        .select('id,title,start_time,meeting_date').eq('meeting_date', today);
      if (!data) return;
      const now = new Date();
      data.forEach(meeting => {
        if (!meeting.start_time) return;
        const [h,m] = meeting.start_time.split(':').map(Number);
        const st    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
        const delay = st - now;
        if (delay > 0 && delay < 24*60*60*1000) {
          setTimeout(async () => {
            if (window.emailService) await window.emailService.sendMeetingAttendanceForm(meeting.id);
          }, delay);
        }
      });
    } catch (e) { console.warn('Meeting timer error:', e); }
  }

  /* ============================================================
     SIDEBAR CONTROLS
     ============================================================ */
  _toggleSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const icon    = document.getElementById('sidebar-toggle-icon');
    this.sidebarCollapsed = !this.sidebarCollapsed;
    sidebar?.classList.toggle('collapsed', this.sidebarCollapsed);
    if (icon) {
      icon.setAttribute('data-lucide', this.sidebarCollapsed ? 'panel-left-open' : 'panel-left-close');
      lucide.createIcons();
    }
  }

  _openMobileSidebar() {
    document.getElementById('admin-sidebar')?.classList.add('mobile-open');
    document.getElementById('admin-mobile-overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  _closeMobileSidebar() {
    document.getElementById('admin-sidebar')?.classList.remove('mobile-open');
    document.getElementById('admin-mobile-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ============================================================
     THEME
     ============================================================ */
  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { Storage.set('theme', theme); } catch (e) {}
    const li = document.getElementById('admin-theme-icon-light');
    const di = document.getElementById('admin-theme-icon-dark');
    if (theme === 'dark') { li?.classList.add('hidden'); di?.classList.remove('hidden'); }
    else                  { li?.classList.remove('hidden'); di?.classList.add('hidden'); }
  }

  /* ============================================================
     BREADCRUMB
     ============================================================ */
  _updateBreadcrumb(section) {
    const bc = document.getElementById('admin-breadcrumb');
    if (!bc) return;
    const map = {
      dashboard:               { icon:'layout-dashboard', label:'Dashboard' },
      'events-list':           { icon:'calendar-check',   label:'Events & Projects' },
      'events-add':            { icon:'plus-circle',      label:'Add Event' },
      'events-pending':        { icon:'clock',            label:'Pending Approval' },
      'reports-list':          { icon:'file-text',        label:'Reports' },
      'reports-monthly':       { icon:'calendar',         label:'Monthly Reports' },
      'reports-dpp':           { icon:'star',             label:'DPP Reports' },
      'meetings-list':         { icon:'users',            label:'Meetings' },
      'meetings-add':          { icon:'plus-circle',      label:'Schedule Meeting' },
      'meetings-attendance':   { icon:'check-square',     label:'Attendance' },
      'treasury-overview':     { icon:'bar-chart',        label:'Treasury Overview' },
      'treasury-transactions': { icon:'list',             label:'Transactions' },
      'treasury-add':          { icon:'plus-circle',      label:'Add Transaction' },
      'treasury-budget':       { icon:'target',           label:'Budget' },
      'treasury-statements':   { icon:'download',         label:'Statements' },
      'members-list':          { icon:'users-2',          label:'Members' },
      'members-add':           { icon:'user-plus',        label:'Add Member' },
      'members-board':         { icon:'star',             label:'Board Members' },
      applications:            { icon:'inbox',            label:'Applications' },
      newsletters:             { icon:'newspaper',        label:'Bulletins' },
      'blood-requests':        { icon:'droplets',         label:'Blood Requests' },
      'past-leaders':          { icon:'crown',            label:'Past Leaders' },
      notifications:           { icon:'bell',             label:'Notifications' },
      'email-center':          { icon:'mail',             label:'Email Center' },
      logs:                    { icon:'activity',         label:'Activity Logs' },
      'admin-users':           { icon:'shield-check',     label:'Admin Users' },
      settings:                { icon:'settings',         label:'Site Settings' }
    };
    const info = map[section] || { icon:'layout-dashboard', label:StringUtils.snakeToTitle(section) };
    bc.innerHTML = `
      <i data-lucide="${info.icon}" style="width:16px;height:16px;color:var(--accent);"></i>
      <span>${info.label}</span>`;
    lucide.createIcons();
  }

  /* ============================================================
     CONFIRM DIALOG
     ============================================================ */
  confirmAction(title, message, onConfirm, icon = 'alert-triangle') {
    const overlay = document.getElementById('admin-confirm-overlay');
    if (!overlay) { if (confirm(message)) onConfirm(); return; }

    overlay.style.display = 'flex';
    document.getElementById('admin-confirm-title').textContent   = title;
    document.getElementById('admin-confirm-message').textContent = message;
    const iconEl = document.getElementById('admin-confirm-icon');
    if (iconEl) iconEl.innerHTML = `<i data-lucide="${icon}" style="width:32px;height:32px;"></i>`;
    lucide.createIcons();

    const okBtn     = document.getElementById('admin-confirm-ok');
    const cancelBtn = document.getElementById('admin-confirm-cancel');

    const cleanup = () => {
      overlay.style.display = 'none';
      okBtn?.removeEventListener('click',     handleOk);
      cancelBtn?.removeEventListener('click', handleCancel);
    };
    const handleOk     = async () => { cleanup(); await onConfirm(); };
    const handleCancel = () => cleanup();

    okBtn?.addEventListener('click',     handleOk);
    cancelBtn?.addEventListener('click', handleCancel);
  }

  _closeConfirmDialog() {
    const overlay = document.getElementById('admin-confirm-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  /* ============================================================
     TOAST
     ============================================================ */
  showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('admin-toast-container')
                   || document.getElementById('toast-container');
    if (!container) return;

    const icons = { success:'check-circle', error:'alert-circle', warning:'alert-triangle', info:'info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type]||'info'}" class="toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${type.charAt(0).toUpperCase()+type.slice(1)}</div>
        <div class="toast-message">${this._safe(message)}</div>
      </div>
      <button class="toast-close"><i data-lucide="x"></i></button>`;
    container.appendChild(toast);
    lucide.createIcons();

    const remove = () => {
      toast.classList.add('removing');
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
    };
    toast.querySelector('.toast-close')?.addEventListener('click', remove);
    setTimeout(remove, duration);
  }

  showFormMsg(el, message, type) {
    if (el) {
      el.textContent    = message;
      el.className      = `form-message ${type}`;
      el.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
  }

  /* ============================================================
     UTILITIES
     ============================================================ */
  _safe(str) {
    if (str === null || str === undefined) return '';
    if (typeof StringUtils !== 'undefined') return StringUtils.sanitize(String(str));
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  getTimeAgo(dateStr) {
    if (!dateStr) return 'Unknown';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m <  1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d <  7) return `${d}d ago`;
    return DateUtils.format(dateStr, 'short');
  }

  _accessDenied() {
    return `
      <div style="padding:60px;text-align:center;">
        <div class="neu-card placeholder-card">
          <i data-lucide="shield-x" style="color:var(--danger);"></i>
          <h3 style="color:var(--text-heading);">Access Denied</h3>
          <p>You do not have permission to access this section.</p>
          <button class="btn btn-outline" onclick="adminDashboard.navigateTo('dashboard')">
            <i data-lucide="home"></i><span>Go to Dashboard</span>
          </button>
        </div>
      </div>`;
  }

  _loadingStub(name) {
    return `
      <div class="admin-section-header">
        <h1 class="admin-section-title">${this._safe(name)}</h1>
      </div>
      <div style="padding:40px;">
        <div class="loading-single-line" style="width:300px;margin:0 auto;">
          <div class="loading-line-track"><div class="loading-line-fill"></div></div>
        </div>
      </div>`;
  }
}

/* ============================================================
   ADMIN CSS — Neomorphism Design System
   ============================================================ */
const adminCSS = `/* styles now live in styles.css */`;

/* ── Inject CSS ── */
(function () {
  if (!document.getElementById('admin-dashboard-css')) {
    const style = document.createElement('style');
    style.id = 'admin-dashboard-css';
    style.textContent = adminCSS;
    document.head.appendChild(style);
  }
})();


/* ============================================================
   TEAM CHAT — admin chat rooms (WhatsApp-style, monitored by the super admin)
   Direct chats · groups · announcement rooms · replies · forwards · edit / delete · reactions ·
   star · pin · polls · tasks · event cards · images (auto-compressed) · files · voice notes ·
   @mentions · typing · online · read receipts · disappearing messages · search · notifications.
   Super admin: sees every room (including deleted / edited text), moderates, handles reports,
   exports transcripts and sees activity statistics.
   Data lives in the chat_* tables (sql/004 section 7); live updates use Supabase Realtime.
   ============================================================ */
const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const CHAT_EMOJIS = ('😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😎 🤓 🤔 🤗 🙄 😏 😌 😴 😢 😭 😤 😡 🥳 🤝 👍 👎 👏 🙌 🙏 💪 ✌️ 👌 🤞 ❤️ 💙 💚 💛 🧡 💜 🔥 ⭐ ✨ 🎉 🎂 🎁 💯 ✅ ❌ ⚠️ 📌 📎 📅 ⏰ 📣 💡 🩸 🌱 🤲 🏆 📷 📄').split(' ');
const CHAT_EDIT_WINDOW_MS = 60 * 60 * 1000;
const CHAT_PAGE = 40;

class AdminChat {
  constructor(dash) {
    this.d = dash; this.db = dash.db; this.me = dash.admin;
    this.isSuper = !!dash.auth.isSuperAdmin();
    this.admins = {};            // id → admin row
    this.rooms = new Map();      // id → room
    this.members = {};           // roomId → [member rows]
    this.msgs = {};              // roomId → [messages] (oldest → newest)
    this.extras = { reactions: {}, stars: new Set(), votes: {} };
    this.unread = {}; this.mentionUnread = {};
    this.cur = null; this.mode = 'mine'; this.tab = 'all'; this.q = '';
    this.online = new Set(); this.typing = {}; this.replyTo = null; this.editing = null;
    this.ready = false; this.started = false; this.mounted = false; this.windowed = false;
    this.hidden = new Set(this._ls('chat_hidden_' + this.me.id, []));
    this.cleared = this._ls('chat_cleared_' + this.me.id, {});
    this.prefs = Object.assign({ sound: true, notify: false }, this._ls('chat_prefs_' + this.me.id, {}));
    this.pollT = null; this.readT = null; this.lastTyping = 0; this.rec = null;
  }

  /* ---------- tiny helpers ---------- */
  _ls(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  _lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* silent */ } }
  esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  toast(m, t = 'info') { try { this.d.showToast(m, t); } catch (e) { /* silent */ } }
  nameOf(id) { return this.admins[id]?.full_name || (id ? 'Former admin' : 'System'); }
  initial(n) { return String(n || '?').trim().charAt(0).toUpperCase() || '?'; }
  colorFor(id) {
    const c = ['#D41367', '#2B7DE9', '#1FA971', '#E08A00', '#8E44EC', '#E5533D', '#0FB5C9', '#5C6B7A', '#B5179E', '#2A9D8F'];
    let h = 0; String(id || '').split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    return c[h % c.length];
  }
  fmtTime(ts) { return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase(); }
  dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  dayLabel(ts) {
    const d = new Date(ts), n = new Date(), y = new Date(Date.now() - 864e5);
    if (this.dayKey(d) === this.dayKey(n)) return 'Today';
    if (this.dayKey(d) === this.dayKey(y)) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  shortTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (this.dayKey(d) === this.dayKey(new Date())) return this.fmtTime(ts);
    if (this.dayKey(d) === this.dayKey(new Date(Date.now() - 864e5))) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
  bytes(n) { n = +n || 0; return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  isMember(roomId) { return (this.members[roomId] || []).some(m => m.admin_id === this.me.id); }
  myMember(roomId) { return (this.members[roomId] || []).find(m => m.admin_id === this.me.id) || null; }
  myRole(roomId) { return this.myMember(roomId)?.role || null; }
  isRoomAdmin(roomId) { const r = this.myRole(roomId); return r === 'owner' || r === 'admin'; }
  roomName(r) {
    if (!r) return 'Chat';
    if (r.kind === 'direct') {
      const other = (this.members[r.id] || []).find(m => m.admin_id !== this.me.id);
      if (other) return this.nameOf(other.admin_id);
      const parts = String(r.dm_key || '').split(':'); const oid = parts.find(x => x !== this.me.id);
      return this.nameOf(oid);
    }
    return r.name || 'Group';
  }
  roomColor(r) {
    if (r.kind === 'direct') { const o = (this.members[r.id] || []).find(m => m.admin_id !== this.me.id); return this.colorFor(o?.admin_id || r.id); }
    return r.color || '#B30F57';
  }
  directPeer(r) { const o = (this.members[r.id] || []).find(m => m.admin_id !== this.me.id); return o ? o.admin_id : null; }
  preview(m) {
    if (!m) return '';
    if (m.deleted_at) return 'This message was deleted';
    const map = { image: 'Photo', file: 'Document', voice: 'Voice message', poll: 'Poll', task: 'Task', event: 'Event' };
    return map[m.kind] ? (map[m.kind] + (m.body ? ': ' + m.body : '')) : (m.body || '');
  }

  /* ---------- loading ---------- */
  async init(force = false) {
    if (this.ready && !force) return;
    await this.loadAdmins();
    await this.ensureGeneralRoom();
    await this.loadRooms();
    this.ready = true;
    await this.loadUnread();
    this.updateBadge();
  }

  async loadAdmins() {
    const { data } = await this.db.from('admin_users').select('id,full_name,email,role,is_active,extra_roles');
    this.admins = {}; (data || []).forEach(a => { this.admins[a.id] = a; });
    if (!this.admins[this.me.id]) this.admins[this.me.id] = this.me;
    const { data: prof } = await this.db.from('chat_profiles').select('*');
    this.profiles = {}; (prof || []).forEach(p => { this.profiles[p.admin_id] = p; });
  }

  /** The built-in "All Admins" room: created once by the super admin; every active admin joins automatically. */
  async ensureGeneralRoom() {
    try {
      let { data: room } = await this.db.from('chat_rooms').select('*').eq('dm_key', 'all-admins').limit(1);
      let r = room && room[0];
      if (!r && this.isSuper) {
        const ins = await this.db.from('chat_rooms').insert({ kind: 'group', name: 'All Admins', description: 'Everyone on the admin team', color: '#B30F57', created_by: this.me.id, dm_key: 'all-admins' }).select('*');
        r = ins.data && ins.data[0];
        if (r) {
          const rows = Object.values(this.admins).filter(a => a.is_active !== false).map(a => ({ room_id: r.id, admin_id: a.id, role: a.id === this.me.id ? 'owner' : 'member' }));
          if (rows.length) await this.db.from('chat_members').insert(rows);
          await this.sendSystem(r.id, 'Room created. Welcome to the admin team chat.');
        }
      }
      if (r) {
        const { data: mem } = await this.db.from('chat_members').select('admin_id').eq('room_id', r.id).eq('admin_id', this.me.id);
        if (!mem || !mem.length) await this.db.from('chat_members').insert({ room_id: r.id, admin_id: this.me.id, role: 'member' });
      }
    } catch (e) { console.warn('[chat] general room:', e); }
  }

  async loadRooms() {
    let ids = [];
    const { data: mine, error } = await this.db.from('chat_members').select('*').eq('admin_id', this.me.id);
    if (error) throw error;
    ids = (mine || []).map(m => m.room_id);
    let rooms = [];
    if (this.mode === 'monitor' && this.isSuper) {
      const r = await this.db.from('chat_rooms').select('*').order('created_at', { ascending: false });
      rooms = r.data || [];
    } else if (ids.length) {
      const r = await this.db.from('chat_rooms').select('*').in('id', ids);
      rooms = r.data || [];
    }
    // members for every room we display (names, roles, read marks)
    const rids = rooms.map(r => r.id), members = {};
    if (rids.length) {
      const { data: mm } = await this.db.from('chat_members').select('*').in('room_id', rids);
      (mm || []).forEach(m => { (members[m.room_id] = members[m.room_id] || []).push(m); });
    }
    // assign everything at once so overlapping loads can never leave a half-built state
    this.members = members;
    this.rooms = new Map(rooms.map(r => [r.id, r]));
    this._myMemberships = mine || [];
  }

  async loadUnread() {
    this.unread = {}; this.mentionUnread = {};
    const mems = (this._myMemberships || []);
    await Promise.all(mems.map(async (m) => {
      if (!this.rooms.has(m.room_id) && this.mode !== 'mine') return;
      const { count } = await this.db.from('chat_messages').select('id', { count: 'exact', head: true })
        .eq('room_id', m.room_id).gt('created_at', m.last_read_at).neq('sender_id', this.me.id).is('deleted_at', null).neq('kind', 'system');
      this.unread[m.room_id] = count || 0;
    }));
  }
  totalUnread() { let n = 0; for (const [id, c] of Object.entries(this.unread)) { const m = this.myMember(id) || (this._myMemberships || []).find(x => x.room_id === id); if (!(m && m.muted)) n += c; } return n; }

  async loadMessages(roomId, opts = {}) {
    let q = this.db.from('chat_messages').select('*').eq('room_id', roomId);
    if (opts.before) q = q.lt('created_at', opts.before);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit || CHAT_PAGE);
    if (error) throw error;
    const list = (data || []).slice().reverse();
    await this.loadExtras(list);
    return list;
  }

  async loadExtras(list) {
    const ids = list.map(m => m.id); if (!ids.length) return;
    const [rx, st, vt] = await Promise.all([
      this.db.from('chat_reactions').select('*').in('message_id', ids),
      this.db.from('chat_stars').select('*').in('message_id', ids).eq('admin_id', this.me.id),
      this.db.from('chat_poll_votes').select('*').in('message_id', ids)
    ]);
    ids.forEach(id => { this.extras.reactions[id] = []; this.extras.votes[id] = []; this.extras.stars.delete(id); });
    (rx.data || []).forEach(r => this.extras.reactions[r.message_id].push(r));
    (vt.data || []).forEach(v => this.extras.votes[v.message_id].push(v));
    (st.data || []).forEach(s => this.extras.stars.add(s.message_id));
  }

  visible(m) {
    if (this.hidden.has(m.id)) return false;
    const cl = this.cleared[m.room_id]; if (cl && m.created_at <= cl) return false;
    if (m.expires_at && !this.isSuper && new Date(m.expires_at) < new Date()) return false;   // disappearing (super admin can still audit)
    return true;
  }

  /* ---------- realtime ---------- */
  startRealtime() {
    if (this.started) return; this.started = true;
    try {
      this.dbCh = this.db.channel('rac-chat-db')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (p) => this.onMessageChange(p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, (p) => this.onSideChange('reactions', p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_poll_votes' }, (p) => this.onSideChange('votes', p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, () => this.refreshRooms())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => this.refreshRooms())
        .subscribe();
      this.liveCh = this.db.channel('rac-admin-chat', { config: { presence: { key: this.me.id }, broadcast: { self: false } } })
        .on('presence', { event: 'sync' }, () => {
          this.online = new Set(Object.keys(this.liveCh.presenceState()));
          if (this.mounted) { this.renderRoomList(); this.renderHeader(); }
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => this.onTyping(payload))
        .subscribe((s) => { if (s === 'SUBSCRIBED') this.liveCh.track({ id: this.me.id, t: Date.now() }); });
    } catch (e) { console.warn('[chat] realtime unavailable, polling instead', e); }
    // safety net when Realtime is not enabled: poll every few seconds
    this.pollT = setInterval(() => this.poll(), 6000);
    this.seenT = setInterval(() => this.touchSeen(), 60000);
    this.touchSeen();
    this._vis = () => { if (!document.hidden && this.cur && this.mounted) this.markRead(); };
    document.addEventListener('visibilitychange', this._vis);
  }
  stopRealtime() {
    try { if (this.dbCh) this.db.removeChannel(this.dbCh); if (this.liveCh) this.db.removeChannel(this.liveCh); } catch (e) { /* silent */ }
    clearInterval(this.pollT); clearInterval(this.seenT); document.removeEventListener('visibilitychange', this._vis);
    this.started = false;
  }
  async touchSeen() {
    const now = new Date().toISOString();
    try {
      const u = await this.db.from('chat_profiles').update({ last_seen_at: now }).eq('admin_id', this.me.id).select('admin_id');
      if (!u.data || !u.data.length) await this.db.from('chat_profiles').insert({ admin_id: this.me.id, last_seen_at: now });
    } catch (e) { /* silent */ }
  }
  async poll() {
    if (!this.ready || document.hidden) return;
    try {
      if (this.cur && this.msgs[this.cur] && !this.windowed) {
        const list = this.msgs[this.cur], last = list.length ? list[list.length - 1].created_at : null;
        let q = this.db.from('chat_messages').select('*').eq('room_id', this.cur);
        if (last) q = q.gt('created_at', last);
        const { data } = await q.order('created_at', { ascending: true }).limit(50);
        (data || []).forEach(m => this.ingest(m, false));
      }
      await this.refreshRooms(true);
    } catch (e) { /* silent */ }
  }
  async refreshRooms(quiet) {
    if (!this.ready) return;
    if (this._rfBusy) { this._rfAgain = true; return this._rfBusy; }       // coalesce bursts of realtime events
    this._rfBusy = (async () => {
      do { this._rfAgain = false; await this._refreshRoomsNow(quiet); } while (this._rfAgain);
    })().finally(() => { this._rfBusy = null; });
    return this._rfBusy;
  }
  async _refreshRoomsNow(quiet) {
    const prev = JSON.stringify([...this.rooms.values()].map(r => [r.id, r.last_message_at, r.name, r.is_locked, r.disappear_after]));
    await this.loadRooms(); await this.loadUnread(); this.updateBadge();
    if (this.mounted && (!quiet || prev !== JSON.stringify([...this.rooms.values()].map(r => [r.id, r.last_message_at, r.name, r.is_locked, r.disappear_after])))) {
      this.renderRoomList(); if (this.cur) { this.renderHeader(); }
    }
    this.refreshTicks();
  }
  onSideChange(kind, p) {
    const row = p.new && Object.keys(p.new).length ? p.new : p.old; if (!row) return;
    const arr = (this.extras[kind] || (this.extras[kind] = {}));
    const list = arr[row.message_id] || (arr[row.message_id] = []);   // messages sent/received live have no list yet
    if (p.eventType === 'DELETE') { const i = list.findIndex(x => x.admin_id === row.admin_id && (x.emoji || x.option_idx) === (row.emoji || row.option_idx)); if (i >= 0) list.splice(i, 1); }
    else if (p.eventType === 'INSERT') { if (!list.some(x => x.admin_id === row.admin_id && x.emoji === row.emoji && x.option_idx === row.option_idx)) list.push(row); }
    if (this.mounted) this.updateMessageNode(row.message_id);
  }
  onMessageChange(p) {
    const m = p.new && p.new.id ? p.new : null;
    if (p.eventType === 'DELETE' || !m) return;
    this.ingest(m, true);
  }
  /** Merge a message (from realtime / polling / own send) into local state and the UI. */
  ingest(m, live) {
    const list = this.msgs[m.room_id];
    const mine = m.sender_id === this.me.id;
    const known = list && list.find(x => x.id === m.id || (x._tmp && mine && x.body === m.body && x.kind === m.kind));
    if (known) { Object.assign(known, m, { _tmp: false }); if (this.cur === m.room_id) this.updateMessageNode(known.id, true); }
    else if (list) { list.push(m); list.sort((a, b) => a.created_at < b.created_at ? -1 : 1); if (this.cur === m.room_id && this.mounted) this.appendMessageNode(m); }
    const room = this.rooms.get(m.room_id);
    if (room && !m.deleted_at && (!room.last_message_at || m.created_at >= room.last_message_at)) {
      room.last_message_at = m.created_at; room.last_message_preview = this.preview(m); room.last_sender_id = m.sender_id;
    }
    if (live && !known && !mine && m.kind !== 'system') this.onIncoming(m);
    if (this.mounted) this.renderRoomList();
  }
  onIncoming(m) {
    const mem = this.myMember(m.room_id) || (this._myMemberships || []).find(x => x.room_id === m.room_id);
    if (!mem) return;                                    // not our room (monitoring only)
    const viewing = this.cur === m.room_id && this.mounted && !document.hidden;
    if (viewing) { this.markRead(); return; }
    this.unread[m.room_id] = (this.unread[m.room_id] || 0) + 1;
    if ((m.mentions || []).includes(this.me.id)) this.mentionUnread[m.room_id] = (this.mentionUnread[m.room_id] || 0) + 1;
    this.updateBadge();
    if (mem.muted) return;
    const who = this.nameOf(m.sender_id), room = this.rooms.get(m.room_id);
    if (this.prefs.sound) this.beep();
    if (!this.mounted || document.hidden) {
      this.toast(`${who}: ${(this.preview(m) || '').slice(0, 60)}`, 'info');
      try {
        if (this.prefs.notify && window.Notification && Notification.permission === 'granted' && document.hidden) {
          const n = new Notification(room && room.kind !== 'direct' ? `${who} • ${this.roomName(room)}` : who, { body: (this.preview(m) || '').slice(0, 120), tag: 'chat-' + m.room_id });
          n.onclick = () => { window.focus(); this.d.navigateTo('chat').then(() => this.openRoom(m.room_id)); n.close(); };
        }
      } catch (e) { /* silent */ }
    }
  }
  beep() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      this._ac = this._ac || new C(); const o = this._ac.createOscillator(), g = this._ac.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.05; o.connect(g); g.connect(this._ac.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, this._ac.currentTime + 0.25); o.stop(this._ac.currentTime + 0.26);
    } catch (e) { /* silent */ }
  }
  updateBadge() {
    const n = this.totalUnread();
    this.d.pendingCounts = this.d.pendingCounts || {}; this.d.pendingCounts.chat = n;
    const btn = document.querySelector('.admin-sidebar-item[data-section="chat"]'); if (!btn) return;
    let b = btn.querySelector('.admin-sidebar-badge');
    if (n > 0) { if (!b) { b = document.createElement('span'); b.className = 'admin-sidebar-badge'; btn.appendChild(b); } b.textContent = n > 99 ? '99+' : n; }
    else if (b) b.remove();
    const base = document.title.replace(/^\(\d+\)\s*/, ''); document.title = n > 0 ? `(${n}) ${base}` : base;
  }
  onTyping(p) {
    if (!p || p.id === this.me.id) return;
    const key = p.room + ':' + p.id; clearTimeout(this.typing[key]);
    if (p.on) this.typing[key] = setTimeout(() => { delete this.typing[key]; this.renderHeader(); }, 4000); else delete this.typing[key];
    if (this.cur === p.room) this.renderHeader();
  }
  typingNames(roomId) { return Object.keys(this.typing).filter(k => k.startsWith(roomId + ':')).map(k => this.nameOf(k.split(':')[1]).split(' ')[0]); }
  sendTyping(on) {
    const now = Date.now(); if (on && now - this.lastTyping < 2500) return; this.lastTyping = on ? now : 0;
    try { this.liveCh && this.liveCh.send({ type: 'broadcast', event: 'typing', payload: { room: this.cur, id: this.me.id, on } }); } catch (e) { /* silent */ }
  }
  async markRead() {
    if (!this.cur || !this.isMember(this.cur)) return;
    clearTimeout(this.readT);
    this.readT = setTimeout(async () => {
      const now = new Date().toISOString(), m = this.myMember(this.cur); if (!m) return;
      m.last_read_at = now; this.unread[this.cur] = 0; this.mentionUnread[this.cur] = 0; this.updateBadge();
      const rid = this.cur;
      try { await this.db.from('chat_members').update({ last_read_at: now }).eq('room_id', rid).eq('admin_id', this.me.id); } catch (e) { /* silent */ }
      if (this.mounted) this.renderRoomList();
    }, 350);
  }
}

/* ---------- rendering ---------- */
Object.assign(AdminChat.prototype, {

  async mount(container) {
    this.container = container; this.mounted = true;
    container.innerHTML = `
      <div class="chat-app" id="chat-app">
        <aside class="chat-side" id="chat-side">
          <div class="chat-side-top">
            <div class="chat-me">
              <span class="chat-av" style="background:${this.colorFor(this.me.id)}">${this.esc(this.initial(this.me.full_name))}</span>
              <div class="chat-me-text"><b>${this.esc(this.me.full_name)}</b><small>${this.esc((window.RoleUtils ? RoleUtils.labels(this.me).join(' · ') : this.me.role) || '')}</small></div>
              <div class="chat-top-actions">
                <button type="button" class="chat-ib" data-act="new" title="New chat or group" aria-label="New chat"><i data-lucide="message-square-plus"></i></button>
                <button type="button" class="chat-ib" data-act="prefs" title="Chat settings" aria-label="Chat settings"><i data-lucide="settings-2"></i></button>
              </div>
            </div>
            <div class="chat-search"><i data-lucide="search"></i><input id="chat-q" type="search" placeholder="Search chats or people" autocomplete="off" /></div>
            <div class="chat-tabs" id="chat-tabs">
              ${[['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups'], ['direct', 'Direct']].map(t => `<button type="button" data-tab="${t[0]}" class="${this.tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}
              ${this.isSuper ? `<button type="button" data-tab="monitor" class="mon ${this.mode === 'monitor' ? 'on' : ''}"><i data-lucide="eye"></i>Monitor</button>` : ''}
            </div>
          </div>
          <div class="chat-rooms" id="chat-rooms"></div>
          <div class="chat-note"><i data-lucide="shield-check"></i><span>Chats in this room are monitored by the Super Admin.</span></div>
        </aside>
        <section class="chat-main" id="chat-main"></section>
        <aside class="chat-info" id="chat-info"></aside>
      </div>`;
    this.bind();
    lucide.createIcons();
    this.renderRoomList();
    if (this.cur && this.rooms.has(this.cur)) await this.openRoom(this.cur); else this.renderEmpty();
  },

  unmount() { this.mounted = false; this.container = null; this.stopRecording(true); },

  bind() {
    const app = document.getElementById('chat-app');
    app.addEventListener('click', (e) => this.onClick(e));
    app.addEventListener('input', (e) => this.onInput(e));
    app.addEventListener('keydown', (e) => this.onKey(e));
    app.addEventListener('change', (e) => this.onChange(e));
    document.getElementById('chat-tabs').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      const t = b.getAttribute('data-tab');
      if (t === 'monitor') { this.mode = this.mode === 'monitor' ? 'mine' : 'monitor'; await this.loadRooms(); if (this.mode === 'monitor') this.renderMonitorHome(); else if (!this.rooms.has(this.cur)) { this.cur = null; this.renderEmpty(); } }
      else { this.tab = t; if (this.mode === 'monitor') { this.mode = 'mine'; await this.loadRooms(); } }
      document.querySelectorAll('#chat-tabs button').forEach(x => x.classList.toggle('on', (x.dataset.tab === 'monitor' ? this.mode === 'monitor' : (this.mode !== 'monitor' && x.dataset.tab === this.tab))));
      this.renderRoomList();
    });
    document.addEventListener('click', this._docClick = (e) => { if (!e.target.closest('.chat-pop') && !e.target.closest('[data-act="menu"],[data-act="emoji"],[data-act="attach"]')) this.closePops(); });
  },

  /* ---------- sidebar ---------- */
  sortedRooms() {
    const mems = {}; (this._myMemberships || []).forEach(m => { mems[m.room_id] = m; });
    let list = [...this.rooms.values()];
    const q = this.q.trim().toLowerCase();
    if (q) list = list.filter(r => this.roomName(r).toLowerCase().includes(q) || String(r.last_message_preview || '').toLowerCase().includes(q));
    if (this.mode !== 'monitor') {
      if (this.tab === 'unread') list = list.filter(r => (this.unread[r.id] || 0) > 0);
      if (this.tab === 'groups') list = list.filter(r => r.kind !== 'direct');
      if (this.tab === 'direct') list = list.filter(r => r.kind === 'direct');
      list = list.filter(r => !(mems[r.id] && mems[r.id].archived) || q);
    }
    return list.sort((a, b) => {
      const pa = mems[a.id]?.pinned ? 1 : 0, pb = mems[b.id]?.pinned ? 1 : 0;
      if (pa !== pb && this.mode !== 'monitor') return pb - pa;
      return String(b.last_message_at || b.created_at).localeCompare(String(a.last_message_at || a.created_at));
    });
  },

  renderRoomList() {
    const box = document.getElementById('chat-rooms'); if (!box) return;
    const mems = {}; (this._myMemberships || []).forEach(m => { mems[m.room_id] = m; });
    const list = this.sortedRooms();
    let html = '';
    if (this.mode === 'monitor') html += `<button type="button" class="chat-room mon-home" data-act="monitor-home"><span class="chat-av" style="background:#43061F"><i data-lucide="layout-dashboard"></i></span><div class="chat-room-body"><b>Monitoring dashboard</b><small>Activity, reports and search across all chats</small></div></button>`;
    html += list.map(r => {
      const name = this.roomName(r), unread = this.unread[r.id] || 0, mem = mems[r.id];
      const peer = r.kind === 'direct' ? this.directPeer(r) : null;
      const online = peer && this.online.has(peer);
      const sender = r.last_sender_id === this.me.id ? 'You: ' : (r.kind !== 'direct' && r.last_sender_id ? this.nameOf(r.last_sender_id).split(' ')[0] + ': ' : '');
      const mine = r.last_sender_id === this.me.id;
      return `<button type="button" class="chat-room ${this.cur === r.id ? 'on' : ''}" data-act="open" data-id="${r.id}">
        <span class="chat-av ${r.kind === 'group' || r.kind === 'announcement' ? 'grp' : ''}" style="background:${this.roomColor(r)}">${r.kind === 'direct' ? this.esc(this.initial(name)) : (r.kind === 'announcement' ? '<i data-lucide="megaphone"></i>' : '<i data-lucide="users"></i>')}${online ? '<i class="chat-dot"></i>' : ''}</span>
        <div class="chat-room-body">
          <div class="chat-room-row"><b>${this.esc(name)}</b><time>${this.esc(this.shortTime(r.last_message_at))}</time></div>
          <div class="chat-room-row"><small>${mine ? '<i data-lucide="check-check" class="tick"></i>' : ''}${this.esc(r.last_message_at ? sender + (r.last_message_preview || '') : (r.description || 'No messages yet')).slice(0, 70)}</small>
            <span class="chat-room-flags">${mem && mem.muted ? '<i data-lucide="bell-off"></i>' : ''}${mem && mem.pinned ? '<i data-lucide="pin"></i>' : ''}${unread ? `<span class="chat-badge ${mem && mem.muted ? 'muted' : ''}">${unread > 99 ? '99+' : unread}</span>` : ''}</span></div>
        </div></button>`;
    }).join('');
    // people search → start a direct chat
    const q = this.q.trim().toLowerCase();
    if (q && this.mode !== 'monitor') {
      const people = Object.values(this.admins).filter(a => a.id !== this.me.id && a.is_active !== false && String(a.full_name || '').toLowerCase().includes(q));
      if (people.length) html += `<div class="chat-sec-title">People</div>` + people.map(a => `<button type="button" class="chat-room" data-act="dm" data-id="${a.id}"><span class="chat-av" style="background:${this.colorFor(a.id)}">${this.esc(this.initial(a.full_name))}${this.online.has(a.id) ? '<i class="chat-dot"></i>' : ''}</span><div class="chat-room-body"><b>${this.esc(a.full_name)}</b><small>${this.esc((window.RoleUtils ? RoleUtils.labels(a).join(' · ') : a.role) || '')}</small></div></button>`).join('');
    }
    if (!html.trim()) html = `<div class="chat-empty-list"><i data-lucide="message-circle"></i><p>${q ? 'Nothing found' : (this.tab === 'unread' ? 'No unread chats' : 'No chats yet — start one with the + button')}</p></div>`;
    box.innerHTML = html; lucide.createIcons();
  },

  renderEmpty() {
    const m = document.getElementById('chat-main'); if (!m) return;
    document.getElementById('chat-app').classList.remove('has-room');
    m.innerHTML = `<div class="chat-welcome"><span class="chat-welcome-ico"><i data-lucide="messages-square"></i></span><h2>Team Chat</h2>
      <p>Talk with fellow admins one-to-one or in groups. Share photos, files, voice notes, polls and tasks — everything stays inside the portal.</p>
      <div class="chat-welcome-pills"><span><i data-lucide="lock"></i> Admins only</span><span><i data-lucide="shield-check"></i> Monitored by Super Admin</span><span><i data-lucide="image"></i> Images auto-compressed</span></div>
      <button type="button" class="btn btn-primary" data-act="new"><i data-lucide="message-square-plus"></i><span>Start a chat</span></button></div>`;
    document.getElementById('chat-info').classList.remove('open');
    lucide.createIcons();
  },

  /* ---------- room view ---------- */
  async openRoom(id, opts = {}) {
    const room = this.rooms.get(id); if (!room) return;
    this.cur = id; this.windowed = false; this.replyTo = null; this.editing = null; this.stopRecording(true);
    const app = document.getElementById('chat-app'); if (app) app.classList.add('has-room');
    const first = !this.msgs[id];
    if (first || opts.reload) { this.msgs[id] = await this.loadMessages(id); this.noMore = this.noMore || {}; this.noMore[id] = this.msgs[id].length < CHAT_PAGE; }
    this.unreadFrom = null;
    const mem = this.myMember(id);
    if (mem && (this.unread[id] || 0) > 0) this.unreadFrom = mem.last_read_at;
    const main = document.getElementById('chat-main');
    main.innerHTML = `
      <header class="chat-head" id="chat-head"></header>
      <div class="chat-pinned" id="chat-pinned" hidden></div>
      <div class="chat-msgs" id="chat-msgs" tabindex="0"></div>
      <button type="button" class="chat-down" id="chat-down" data-act="down" hidden aria-label="Jump to latest"><i data-lucide="chevrons-down"></i><span id="chat-down-n"></span></button>
      <div class="chat-foot" id="chat-foot"></div>`;
    document.getElementById('chat-msgs').addEventListener('scroll', () => this.onScroll());
    this.renderHeader(); this.renderPinned(); this.renderMessages(true); this.renderComposer();
    this.renderRoomList();
    if (this.infoOpen) this.renderInfo();
    this.markRead();
    this.draftRestore();
    lucide.createIcons();
  },

  canPost(room) {
    room = room || this.rooms.get(this.cur); if (!room) return { ok: false, why: '' };
    if (!this.isMember(room.id)) return { ok: false, why: this.isSuper ? 'observer' : 'You are not a member of this chat' };
    if (room.is_archived) return { ok: false, why: 'This chat is archived' };
    const p = this.profiles && this.profiles[this.me.id];
    if (p && p.chat_blocked) return { ok: false, why: 'The Super Admin has turned off your chat access' };
    if (p && p.muted_until && new Date(p.muted_until) > new Date()) return { ok: false, why: 'You are muted until ' + new Date(p.muted_until).toLocaleString('en-IN') };
    if ((room.kind === 'announcement' || room.is_locked) && !this.isRoomAdmin(room.id) && !this.isSuper) return { ok: false, why: 'Only admins can send messages in this chat' };
    return { ok: true };
  },

  renderHeader() {
    const h = document.getElementById('chat-head'); if (!h) return;
    const r = this.rooms.get(this.cur); if (!r) return;
    const name = this.roomName(r), typing = this.typingNames(r.id);
    let sub = '';
    if (typing.length) sub = `<span class="typing">${this.esc(typing.join(', '))} ${typing.length > 1 ? 'are' : 'is'} typing…</span>`;
    else if (r.kind === 'direct') {
      const peer = this.directPeer(r), p = peer && this.profiles && this.profiles[peer];
      sub = this.online.has(peer) ? '<span class="on">online</span>' : (p && p.last_seen_at ? 'last seen ' + this.esc(this.shortTime(p.last_seen_at)) + (this.dayKey(p.last_seen_at) === this.dayKey(new Date()) ? '' : '') : 'offline');
    } else {
      const mem = this.members[r.id] || [];
      sub = this.esc(mem.slice(0, 4).map(m => this.nameOf(m.admin_id).split(' ')[0]).join(', ') + (mem.length > 4 ? ` +${mem.length - 4}` : '')) + ` · ${mem.length} members`;
    }
    const observer = !this.isMember(r.id);
    h.innerHTML = `
      <button type="button" class="chat-ib chat-back" data-act="back" aria-label="Back to chats"><i data-lucide="arrow-left"></i></button>
      <button type="button" class="chat-head-main" data-act="info">
        <span class="chat-av ${r.kind !== 'direct' ? 'grp' : ''}" style="background:${this.roomColor(r)}">${r.kind === 'direct' ? this.esc(this.initial(name)) : (r.kind === 'announcement' ? '<i data-lucide="megaphone"></i>' : '<i data-lucide="users"></i>')}</span>
        <span class="chat-head-text"><b>${this.esc(name)}${observer ? ' <em class="obs">Observer</em>' : ''}${r.disappear_after ? ' <i data-lucide="timer" title="Disappearing messages"></i>' : ''}</b><small>${sub}</small></span>
      </button>
      <div class="chat-head-actions">
        <button type="button" class="chat-ib" data-act="search" title="Search in chat" aria-label="Search"><i data-lucide="search"></i></button>
        <button type="button" class="chat-ib" data-act="info" title="Chat info" aria-label="Chat info"><i data-lucide="info"></i></button>
      </div>`;
    lucide.createIcons();
  },

  renderPinned() {
    const box = document.getElementById('chat-pinned'); if (!box) return;
    const pins = (this.msgs[this.cur] || []).filter(m => m.is_pinned && !m.deleted_at);
    if (!pins.length) { box.hidden = true; return; }
    const m = pins[pins.length - 1];
    box.hidden = false;
    box.innerHTML = `<button type="button" data-act="jump" data-id="${m.id}"><i data-lucide="pin"></i><span><b>Pinned${pins.length > 1 ? ' · ' + pins.length : ''}</b> ${this.esc(this.preview(m)).slice(0, 90)}</span></button>
      ${this.isRoomAdmin(this.cur) || this.isSuper ? `<button type="button" class="chat-ib" data-act="unpin" data-id="${m.id}" aria-label="Unpin"><i data-lucide="x"></i></button>` : ''}`;
    lucide.createIcons();
  },

  /* ---------- messages ---------- */
  renderMessages(toEnd) {
    const box = document.getElementById('chat-msgs'); if (!box) return;
    const list = (this.msgs[this.cur] || []).filter(m => this.visible(m));
    let html = '', lastDay = '', prev = null, dividerDone = false;
    if (!this.noMore?.[this.cur] && list.length) html += `<div class="chat-older"><button type="button" class="btn btn-outline btn-sm" data-act="older"><i data-lucide="history"></i><span>Load older messages</span></button></div>`;
    const r = this.rooms.get(this.cur);
    if (!list.length) html += `<div class="chat-sys-note">${this.esc(r && r.kind === 'direct' ? 'Say hello 👋' : 'No messages yet — start the conversation.')}</div>`;
    list.forEach(m => {
      const dk = this.dayKey(m.created_at);
      if (dk !== lastDay) { html += `<div class="chat-day"><span>${this.esc(this.dayLabel(m.created_at))}</span></div>`; lastDay = dk; prev = null; }
      if (!dividerDone && this.unreadFrom && m.created_at > this.unreadFrom && m.sender_id !== this.me.id) {
        html += `<div class="chat-unread-div" id="chat-unread-div"><span>${this.unread[this.cur] || ''} unread messages</span></div>`; dividerDone = true;
      }
      html += this.msgHtml(m, prev); prev = m;
    });
    box.innerHTML = html; lucide.createIcons();
    if (toEnd) { const d = document.getElementById('chat-unread-div'); if (d) box.scrollTop = Math.max(0, d.offsetTop - 60); else box.scrollTop = box.scrollHeight; }
    this.onScroll();
  },

  onScroll() {
    const box = document.getElementById('chat-msgs'), btn = document.getElementById('chat-down'); if (!box || !btn) return;
    const far = box.scrollHeight - box.scrollTop - box.clientHeight > 240;
    btn.hidden = !(far || this.windowed);
  },
  atBottom() { const b = document.getElementById('chat-msgs'); return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 160; },

  appendMessageNode(m) {
    const box = document.getElementById('chat-msgs'); if (!box || !this.visible(m)) return;
    const stick = this.atBottom() || m.sender_id === this.me.id;
    const list = this.msgs[this.cur].filter(x => this.visible(x)); const i = list.findIndex(x => x.id === m.id);
    const prev = i > 0 ? list[i - 1] : null;
    let html = '';
    if (!prev || this.dayKey(prev.created_at) !== this.dayKey(m.created_at)) html += `<div class="chat-day"><span>${this.esc(this.dayLabel(m.created_at))}</span></div>`;
    html += this.msgHtml(m, prev && this.dayKey(prev.created_at) === this.dayKey(m.created_at) ? prev : null);
    box.querySelector('.chat-sys-note')?.remove();
    box.insertAdjacentHTML('beforeend', html); lucide.createIcons();
    if (stick) box.scrollTop = box.scrollHeight; else { const n = document.getElementById('chat-down-n'); if (n) n.textContent = ''; }
    this.onScroll(); this.renderPinned();
  },

  updateMessageNode(id, force) {
    const m = (this.msgs[this.cur] || []).find(x => x.id === id); const node = document.getElementById('m-' + id);
    if (!m || !node) { if (m && force) this.renderMessages(false); return; }
    const list = (this.msgs[this.cur] || []).filter(x => this.visible(x)); const i = list.findIndex(x => x.id === id);
    const tmp = document.createElement('div'); tmp.innerHTML = this.msgHtml(m, i > 0 ? list[i - 1] : null);
    const fresh = tmp.firstElementChild; if (fresh) node.replaceWith(fresh);
    lucide.createIcons(); this.renderPinned();
  },

  fmt(text, room) {
    let t = this.esc(text);
    t = t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>')
         .replace(/(^|[\s(>])\*([^*\n]+)\*/g, '$1<b>$2</b>')
         .replace(/(^|[\s(>])_([^_\n]+)_/g, '$1<i>$2</i>')
         .replace(/(^|[\s(>])~([^~\n]+)~/g, '$1<s>$2</s>');
    const names = (this.members[room?.id || this.cur] || []).map(m => this.nameOf(m.admin_id)).filter(Boolean).sort((a, b) => b.length - a.length);
    names.forEach(n => { const re = new RegExp('@' + this.esc(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); t = t.replace(re, `<span class="men">@${this.esc(n)}</span>`); });
    return t.replace(/\n/g, '<br>');
  },

  isSeen(m) {
    const others = (this.members[m.room_id] || []).filter(x => x.admin_id !== this.me.id);
    return !!(others.length && others.every(o => o.last_read_at >= m.created_at));
  },
  ticks(m) {
    if (m._tmp) return '<i data-lucide="clock" class="tick"></i>';
    return this.isSeen(m) ? '<i data-lucide="check-check" class="tick seen"></i>' : '<i data-lucide="check" class="tick"></i>';
  },
  /** re-draw only the ticks that changed after somebody read the chat */
  refreshTicks() {
    if (!this.cur || !this.mounted) return;
    (this.msgs[this.cur] || []).forEach(m => {
      if (m.sender_id !== this.me.id || m.deleted_at || m._tmp) return;
      const node = document.getElementById('m-' + m.id); if (!node) return;
      if (node.getAttribute('data-seen') !== (this.isSeen(m) ? '1' : '0')) this.updateMessageNode(m.id);
    });
  },

  msgHtml(m, prev) {
    const mine = m.sender_id === this.me.id, r = this.rooms.get(m.room_id), group = r && r.kind !== 'direct';
    if (m.kind === 'system') return `<div class="chat-sys" id="m-${m.id}"><span>${this.esc(m.body)}</span></div>`;
    const sameRun = prev && prev.sender_id === m.sender_id && prev.kind !== 'system' && (new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60000;
    const sender = this.nameOf(m.sender_id);
    let inner = '';
    if (m.deleted_at) {
      inner = `<div class="cm-deleted"><i data-lucide="ban"></i> ${mine ? 'You deleted this message' : 'This message was deleted'}</div>`;
      if (this.isSuper) inner += `<div class="cm-audit"><b>Super Admin view — deleted by ${this.esc(this.nameOf(m.deleted_by))}:</b><br>${this.esc(m.body || m.attachment_name || '(' + m.kind + ')')}</div>`;
    } else {
      if (m.forwarded) inner += `<div class="cm-fwd"><i data-lucide="forward"></i> Forwarded</div>`;
      if (m.reply_to) {
        const q = (this.msgs[m.room_id] || []).find(x => x.id === m.reply_to);
        inner += `<button type="button" class="cm-quote" data-act="jump" data-id="${m.reply_to}"><b>${this.esc(q ? this.nameOf(q.sender_id) : 'Message')}</b><span>${this.esc(q ? (q.deleted_at ? 'Deleted message' : this.preview(q)).slice(0, 80) : 'Original message')}</span></button>`;
      }
      inner += this.contentHtml(m, r);
    }
    const rx = this.extras.reactions[m.id] || [], groups = {};
    rx.forEach(x => { (groups[x.emoji] = groups[x.emoji] || []).push(x.admin_id); });
    const rxHtml = !m.deleted_at && Object.keys(groups).length ? `<div class="cm-rx">${Object.entries(groups).map(([e, ids]) => `<button type="button" class="${ids.includes(this.me.id) ? 'me' : ''}" data-act="react" data-id="${m.id}" data-emoji="${e}" title="${this.esc(ids.map(i => this.nameOf(i)).join(', '))}">${e}<span>${ids.length}</span></button>`).join('')}</div>` : '';
    const starred = this.extras.stars.has(m.id);
    const meta = `<span class="cm-meta">${m.is_pinned ? '<i data-lucide="pin"></i>' : ''}${starred ? '<i data-lucide="star" class="star"></i>' : ''}${m.edited_at && !m.deleted_at ? (this.isSuper ? `<button type="button" class="cm-edited" data-act="history" data-id="${m.id}">edited</button>` : '<em>edited</em>') : ''}${m.expires_at ? '<i data-lucide="timer"></i>' : ''}<time>${this.fmtTime(m.created_at)}</time>${mine && !m.deleted_at ? this.ticks(m) : ''}</span>`;
    return `<div class="cm ${mine ? 'mine' : ''} ${sameRun ? 'run' : ''} ${m.deleted_at ? 'del' : ''}" id="m-${m.id}" data-id="${m.id}" data-seen="${mine && !m.deleted_at && !m._tmp ? (this.isSeen(m) ? 1 : 0) : ''}">
      ${group && !mine ? `<span class="chat-av sm" style="background:${this.colorFor(m.sender_id)};${sameRun ? 'visibility:hidden' : ''}">${this.esc(this.initial(sender))}</span>` : ''}
      <div class="cm-bubble">
        ${group && !mine && !sameRun ? `<div class="cm-name" style="color:${this.colorFor(m.sender_id)}">${this.esc(sender)}</div>` : ''}
        ${inner}${rxHtml}${meta}
        <button type="button" class="cm-menu" data-act="menu" data-id="${m.id}" aria-label="Message options"><i data-lucide="chevron-down"></i></button>
      </div></div>`;
  },

  contentHtml(m, room) {
    const cap = m.body ? `<div class="cm-text">${this.fmt(m.body, room)}</div>` : '';
    if (m.kind === 'image') return `<img class="cm-img" loading="lazy" src="${this.esc(m.attachment_url)}" alt="${this.esc(m.attachment_name || 'photo')}" data-act="lightbox" data-src="${this.esc(m.attachment_url)}">${cap}`;
    if (m.kind === 'file') {
      const ext = (m.attachment_name || '').split('.').pop().slice(0, 4).toUpperCase();
      return `<a class="cm-file" href="${this.esc(m.attachment_url)}" target="_blank" rel="noopener" download="${this.esc(m.attachment_name || 'file')}"><span class="cm-file-ico">${this.esc(ext || 'FILE')}</span><span class="cm-file-t"><b>${this.esc(m.attachment_name || 'File')}</b><small>${this.bytes(m.attachment_size)}</small></span><i data-lucide="download"></i></a>${cap}`;
    }
    if (m.kind === 'voice') return `<div class="cm-voice"><i data-lucide="mic"></i><audio controls preload="none" src="${this.esc(m.attachment_url)}"></audio><small>${m.duration ? Math.floor(m.duration / 60) + ':' + String(m.duration % 60).padStart(2, '0') : ''}</small></div>`;
    if (m.kind === 'poll') {
      const p = m.meta || {}, votes = this.extras.votes[m.id] || [], voters = new Set(votes.map(v => v.admin_id)).size;
      return `<div class="cm-poll"><div class="cm-poll-q"><i data-lucide="bar-chart-3"></i>${this.esc(p.q || '')}</div><small>${p.multi ? 'Select one or more' : 'Select one'}</small>
        ${(p.options || []).map((o, i) => {
          const n = votes.filter(v => v.option_idx === i), mineV = n.some(v => v.admin_id === this.me.id), pct = voters ? Math.round(n.length / voters * 100) : 0;
          return `<button type="button" class="cm-poll-opt ${mineV ? 'me' : ''}" data-act="vote" data-id="${m.id}" data-i="${i}" ${this.isSuper ? `title="${this.esc(n.map(v => this.nameOf(v.admin_id)).join(', ') || 'No votes')}"` : ''}><span class="bar" style="width:${pct}%"></span><span class="t">${mineV ? '<i data-lucide="check-circle-2"></i>' : '<i data-lucide="circle"></i>'}${this.esc(o)}</span><span class="n">${n.length}</span></button>`;
        }).join('')}<small>${voters} vote${voters === 1 ? '' : 'rs'}</small></div>${cap}`;
    }
    if (m.kind === 'task') {
      const t = m.meta || {}; const overdue = t.due && !t.done && t.due < new Date().toISOString().slice(0, 10);
      return `<div class="cm-task ${t.done ? 'done' : ''}"><button type="button" class="cm-task-chk" data-act="task" data-id="${m.id}" aria-label="Toggle done"><i data-lucide="${t.done ? 'check-square' : 'square'}"></i></button>
        <div><b>${this.esc(t.title || '')}</b><small>${t.assignee ? 'Assigned to ' + this.esc(this.nameOf(t.assignee)) : 'Unassigned'}${t.due ? ` · due ${this.esc(new Date(t.due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}` : ''}${overdue ? ' <em class="od">overdue</em>' : ''}${t.done ? ` · done by ${this.esc(this.nameOf(t.done_by))}` : ''}</small></div></div>${cap}`;
    }
    if (m.kind === 'event') {
      const e = m.meta || {};
      return `<div class="cm-event"><i data-lucide="calendar-days"></i><div><b>${this.esc(e.title || 'Event')}</b><small>${this.esc(e.date ? new Date(e.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '')}${e.venue ? ' · ' + this.esc(e.venue) : ''}</small></div></div>${cap}`;
    }
    return cap;
  },

  /* ---------- composer ---------- */
  renderComposer() {
    const foot = document.getElementById('chat-foot'); if (!foot) return;
    const room = this.rooms.get(this.cur), c = this.canPost(room);
    if (!c.ok) {
      foot.innerHTML = c.why === 'observer'
        ? `<div class="chat-blocked"><i data-lucide="eye"></i><span>Observer mode — you are viewing this chat as Super Admin.</span><button type="button" class="btn btn-outline btn-sm" data-act="join-room">Join chat</button></div>`
        : `<div class="chat-blocked"><i data-lucide="lock"></i><span>${this.esc(c.why)}</span></div>`;
      lucide.createIcons(); return;
    }
    foot.innerHTML = `
      <div class="chat-reply" id="chat-reply" hidden></div>
      <div class="chat-rec" id="chat-rec" hidden><span class="rec-dot"></span><b id="chat-rec-t">0:00</b><span>Recording…</span><button type="button" class="btn btn-outline btn-sm" data-act="rec-cancel">Cancel</button><button type="button" class="btn btn-primary btn-sm" data-act="rec-send"><i data-lucide="send"></i><span>Send</span></button></div>
      <div class="chat-composer" id="chat-composer">
        <button type="button" class="chat-ib" data-act="emoji" aria-label="Emoji"><i data-lucide="smile"></i></button>
        <button type="button" class="chat-ib" data-act="attach" aria-label="Attach"><i data-lucide="paperclip"></i></button>
        <textarea id="chat-input" rows="1" maxlength="4000" placeholder="Type a message" aria-label="Message"></textarea>
        <button type="button" class="chat-send" id="chat-send" data-act="mic" aria-label="Voice message"><i data-lucide="mic"></i></button>
      </div>
      <input type="file" id="chat-img" accept="image/*" multiple hidden />
      <input type="file" id="chat-file" multiple hidden />`;
    lucide.createIcons();
  },

  setSendIcon() {
    const i = document.getElementById('chat-input'), b = document.getElementById('chat-send'); if (!i || !b) return;
    const has = i.value.trim().length > 0, want = has || this.editing ? 'send' : 'mic';
    if (b.dataset.act !== want) { b.dataset.act = want; b.setAttribute('aria-label', has ? 'Send' : 'Voice message'); b.innerHTML = `<i data-lucide="${has || this.editing ? (this.editing ? 'check' : 'send') : 'mic'}"></i>`; lucide.createIcons(); }
  },

  renderReplyBar() {
    const bar = document.getElementById('chat-reply'); if (!bar) return;
    if (this.editing) { bar.hidden = false; bar.innerHTML = `<div><b>Editing message</b><span>${this.esc((this.editing.body || '').slice(0, 90))}</span></div><button type="button" class="chat-ib" data-act="cancel-reply" aria-label="Cancel"><i data-lucide="x"></i></button>`; }
    else if (this.replyTo) { bar.hidden = false; bar.innerHTML = `<div><b>Replying to ${this.esc(this.nameOf(this.replyTo.sender_id))}</b><span>${this.esc(this.preview(this.replyTo).slice(0, 90))}</span></div><button type="button" class="chat-ib" data-act="cancel-reply" aria-label="Cancel"><i data-lucide="x"></i></button>`; }
    else bar.hidden = true;
    lucide.createIcons();
  },

  draftKey() { return 'chat_draft_' + this.me.id + '_' + this.cur; },
  draftRestore() { const i = document.getElementById('chat-input'); if (i) { i.value = this._ls(this.draftKey(), ''); this.autosize(); this.setSendIcon(); } },
  autosize() { const i = document.getElementById('chat-input'); if (i) { i.style.height = 'auto'; i.style.height = Math.min(140, i.scrollHeight) + 'px'; } },

  /* ---------- popups ---------- */
  closePops() { document.querySelectorAll('.chat-pop').forEach(p => p.remove()); },
  popAt(el, html, cls = '') {
    this.closePops();
    const pop = document.createElement('div'); pop.className = 'chat-pop ' + cls; pop.innerHTML = html; document.body.appendChild(pop);
    lucide.createIcons();
    const r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8), top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    return pop;
  },
  dlg(title, bodyHtml, buttons = []) {
    document.getElementById('chat-dlg')?.remove();
    const ov = document.createElement('div'); ov.id = 'chat-dlg'; ov.className = 'reset-overlay chat-dlg-ov';
    ov.innerHTML = `<div class="reset-dialog neu-card chat-dlg" role="dialog" aria-modal="true"><div class="chat-dlg-h"><h3>${this.esc(title)}</h3><button type="button" class="chat-ib" data-dlg="close" aria-label="Close"><i data-lucide="x"></i></button></div><div class="chat-dlg-b">${bodyHtml}</div>
      <div class="reset-actions">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || 'btn-outline'}" data-dlg="${i}"><span>${this.esc(b.label)}</span></button>`).join('')}</div></div>`;
    document.body.appendChild(ov); lucide.createIcons();
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) ov.remove(); });
    ov.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-dlg]'); if (!b) return; const k = b.getAttribute('data-dlg');
      if (k === 'close') { ov.remove(); return; }
      const def = buttons[+k]; if (!def) return;
      const keep = def.fn ? await def.fn(ov, b) : null; if (keep !== false) ov.remove();
    });
    return ov;
  }
});

/* ---------- actions ---------- */
Object.assign(AdminChat.prototype, {

  async onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (['open', 'dm', 'jump', 'older', 'down', 'back', 'info', 'new', 'prefs', 'search', 'monitor-home', 'lightbox', 'send', 'mic', 'rec-send', 'rec-cancel', 'emoji', 'attach', 'menu', 'react', 'vote', 'task', 'unpin', 'history', 'join-room', 'cancel-reply', 'ins-emoji', 'mention', 'm-act', 'attach-do', 'info-act', 'close-info'].indexOf(act) === -1) return;
    try {
      switch (act) {
        case 'open': this.closePops(); await this.openRoom(id); break;
        case 'dm': await this.startDirect(id); break;
        case 'new': this.newChatDialog(); break;
        case 'prefs': this.prefsDialog(); break;
        case 'monitor-home': this.cur = null; this.renderRoomList(); this.renderMonitorHome(); break;
        case 'back': { this.cur = null; document.getElementById('chat-app').classList.remove('has-room'); document.getElementById('chat-info').classList.remove('open'); this.infoOpen = false; this.renderRoomList(); break; }
        case 'info': this.infoOpen = !this.infoOpen; this.renderInfo(); break;
        case 'close-info': this.infoOpen = false; this.renderInfo(); break;
        case 'search': this.openSearch(); break;
        case 'older': await this.loadOlder(); break;
        case 'down': await this.jumpLatest(); break;
        case 'jump': await this.jumpTo(id); break;
        case 'lightbox': this.lightbox(b.getAttribute('data-src')); break;
        case 'send': await this.sendFromInput(); break;
        case 'mic': await this.startRecording(); break;
        case 'rec-cancel': this.stopRecording(true); break;
        case 'rec-send': await this.finishRecording(); break;
        case 'emoji': this.emojiPop(b); break;
        case 'ins-emoji': this.insertAtCaret(b.getAttribute('data-emoji')); break;
        case 'attach': this.attachPop(b); break;
        case 'attach-do': this.closePops(); this.attachDo(b.getAttribute('data-kind')); break;
        case 'menu': this.msgMenu(id, b); break;
        case 'm-act': this.closePops(); await this.msgAction(b.getAttribute('data-do'), id); break;
        case 'react': this.closePops(); await this.toggleReaction(id, b.getAttribute('data-emoji')); break;
        case 'vote': await this.vote(id, +b.getAttribute('data-i')); break;
        case 'task': await this.toggleTask(id); break;
        case 'unpin': await this.setPinned(id, false); break;
        case 'history': await this.showHistory(id); break;
        case 'join-room': await this.joinAsObserver(); break;
        case 'cancel-reply': this.replyTo = null; this.cancelEdit(); this.renderReplyBar(); break;
        case 'mention': this.insertMention(b.getAttribute('data-id')); break;
        case 'info-act': this.closePops(); await this.infoAction(b.getAttribute('data-do'), id); break;
      }
    } catch (err) { console.error('[chat]', act, err); this.toast('Something went wrong: ' + (err.message || err), 'error'); }
  },

  onInput(e) {
    const t = e.target;
    if (t.id === 'chat-q') { this.q = t.value; this.renderRoomList(); return; }
    if (t.id === 'chat-input') {
      this.autosize(); this.setSendIcon();
      if (t.value.trim()) this.sendTyping(true); else this.sendTyping(false);
      this._lsSet(this.draftKey(), t.value);
      const before = t.value.slice(0, t.selectionStart), m = before.match(/(?:^|\s)@([^\s@]{0,20})$/);
      if (m && this.rooms.get(this.cur)?.kind !== 'direct') this.mentionPop(m[1]); else document.querySelector('.chat-pop.mention')?.remove();
    }
    if (t.id === 'chat-room-search') this.runSearch(t.value);
  },

  onKey(e) {
    const t = e.target;
    if (e.key === 'Escape') { this.closePops(); if (this.editing || this.replyTo) { this.replyTo = null; this.cancelEdit(); this.renderReplyBar(); } document.getElementById('chat-search-panel')?.remove(); return; }
    if (t.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer:coarse)').matches) { e.preventDefault(); this.sendFromInput(); }
  },

  async onChange(e) {
    const t = e.target;
    if (t.id === 'chat-img' && t.files.length) { const fs = [...t.files]; t.value = ''; for (const f of fs) await this.sendImage(f); }
    if (t.id === 'chat-file' && t.files.length) { const fs = [...t.files]; t.value = ''; for (const f of fs) await this.sendFile(f); }
  },

  onPaste(e) {
    if (!e.target || e.target.id !== 'chat-input') return;
    const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (it) { e.preventDefault(); const f = it.getAsFile(); if (f) this.sendImage(f); }
  },
  onDrop(e) {
    e.preventDefault(); if (!this.cur || !this.canPost().ok) return;
    [...(e.dataTransfer?.files || [])].forEach(f => f.type.startsWith('image/') ? this.sendImage(f) : this.sendFile(f));
  },

  /* ---------- sending ---------- */
  mentionIds(text, roomId) {
    const ids = [];
    (this.members[roomId] || []).forEach(m => { const n = this.nameOf(m.admin_id); if (n && text.includes('@' + n)) ids.push(m.admin_id); });
    return ids;
  },

  async sendMessage(part, roomId = this.cur) {
    const room = this.rooms.get(roomId); if (!room) return null;
    const c = this.canPost(room); if (!c.ok) { this.toast(c.why === 'observer' ? 'Join the chat to send messages' : c.why, 'warning'); return null; }
    const row = Object.assign({ room_id: roomId, sender_id: this.me.id, kind: 'text', body: null, mentions: [] }, part);
    if (this.replyTo && roomId === this.cur && !part.noReply) row.reply_to = this.replyTo.id;
    delete row.noReply;
    if (room.disappear_after > 0) row.expires_at = new Date(Date.now() + room.disappear_after * 1000).toISOString();
    const tmp = Object.assign({}, row, { id: 'tmp-' + Math.random().toString(36).slice(2), created_at: new Date().toISOString(), _tmp: true });
    if (roomId === this.cur) { (this.msgs[roomId] = this.msgs[roomId] || []).push(tmp); this.appendMessageNode(tmp); }
    this.replyTo = null; this.renderReplyBar();
    const { data, error } = await this.db.from('chat_messages').insert(row).select('*');
    if (error || !data || !data[0]) {
      this.msgs[roomId] = (this.msgs[roomId] || []).filter(x => x.id !== tmp.id); document.getElementById('m-' + tmp.id)?.remove();
      this.toast('Message not sent: ' + (error?.message || 'unknown error'), 'error'); return null;
    }
    const real = data[0], node = document.getElementById('m-' + tmp.id);
    Object.assign(tmp, real, { _tmp: false }); if (node) node.id = 'm-' + real.id;
    if (roomId === this.cur) this.updateMessageNode(real.id);
    room.last_message_at = real.created_at; room.last_message_preview = this.preview(real); room.last_sender_id = this.me.id;
    this.db.from('chat_rooms').update({ last_message_at: real.created_at, last_message_preview: this.preview(real).slice(0, 120), last_sender_id: this.me.id }).eq('id', roomId).then(() => {});
    this.renderRoomList();
    return real;
  },

  async sendSystem(roomId, text) {
    try { await this.db.from('chat_messages').insert({ room_id: roomId, sender_id: null, kind: 'system', body: text }); } catch (e) { /* silent */ }
  },

  async sendFromInput() {
    const i = document.getElementById('chat-input'); if (!i) return;
    const text = i.value.trim(); if (!text) return;
    if (this.editing) { await this.saveEdit(text); return; }
    i.value = ''; this.autosize(); this.setSendIcon(); this._lsSet(this.draftKey(), ''); this.sendTyping(false);
    document.querySelector('.chat-pop.mention')?.remove();
    const sent = await this.sendMessage({ kind: 'text', body: text, mentions: this.mentionIds(text, this.cur) });
    if (!sent) { i.value = text; this.autosize(); this.setSendIcon(); }
    i.focus();
  },

  insertAtCaret(txt) {
    const i = document.getElementById('chat-input'); if (!i) return;
    const s = i.selectionStart, e = i.selectionEnd; i.value = i.value.slice(0, s) + txt + i.value.slice(e);
    i.selectionStart = i.selectionEnd = s + txt.length; i.focus(); this.autosize(); this.setSendIcon();
  },

  mentionPop(q) {
    const list = (this.members[this.cur] || []).filter(m => m.admin_id !== this.me.id && this.nameOf(m.admin_id).toLowerCase().includes(q.toLowerCase())).slice(0, 6);
    document.querySelector('.chat-pop.mention')?.remove();
    if (!list.length) return;
    const anchor = document.getElementById('chat-composer');
    const pop = this.popAt(anchor, list.map(m => `<button type="button" data-act="mention" data-id="${m.admin_id}"><span class="chat-av sm" style="background:${this.colorFor(m.admin_id)}">${this.esc(this.initial(this.nameOf(m.admin_id)))}</span>${this.esc(this.nameOf(m.admin_id))}</button>`).join(''), 'mention');
    const r = anchor.getBoundingClientRect(); pop.style.left = r.left + 8 + 'px'; pop.style.top = Math.max(8, r.top - pop.offsetHeight - 6) + 'px';
  },
  insertMention(id) {
    const i = document.getElementById('chat-input'); if (!i) return;
    const before = i.value.slice(0, i.selectionStart).replace(/@[^\s@]*$/, ''), after = i.value.slice(i.selectionStart);
    const name = this.nameOf(id); i.value = before + '@' + name + ' ' + after; i.selectionStart = i.selectionEnd = (before + '@' + name + ' ').length;
    this.closePops(); i.focus(); this.autosize(); this.setSendIcon();
  },

  emojiPop(btn) {
    this.popAt(btn, `<div class="chat-emoji">${CHAT_EMOJIS.map(e => `<button type="button" data-act="ins-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>`, 'emoji');
  },
  attachPop(btn) {
    this.popAt(btn, [['image', 'image', 'Photo'], ['file', 'file-text', 'Document'], ['poll', 'bar-chart-3', 'Poll'], ['task', 'list-checks', 'Task'], ['event', 'calendar-days', 'Share an event']]
      .map(a => `<button type="button" data-act="attach-do" data-kind="${a[0]}"><i data-lucide="${a[1]}"></i>${a[2]}</button>`).join(''), 'attach');
  },
  attachDo(kind) {
    if (kind === 'image') document.getElementById('chat-img')?.click();
    else if (kind === 'file') document.getElementById('chat-file')?.click();
    else if (kind === 'poll') this.pollDialog();
    else if (kind === 'task') this.taskDialog();
    else if (kind === 'event') this.eventDialog();
  },

  /* ---------- uploads (images are compressed to 150 KB first) ---------- */
  async upload(blob, name, type) {
    const ext = (name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'bin';
    const path = `${this.cur}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await this.db.storage.from('chat-files').upload(path, blob, { contentType: type || blob.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    const url = this.db.storage.from('chat-files').getPublicUrl(data?.path || path).data.publicUrl;
    return { url, size: blob.size };
  },
  async sendImage(file) {
    if (!file || !this.cur) return;
    try {
      this.toast('Optimising and sending photo…');
      const blob = await ImageUtils.compress(file, 1280, 1280, 0.82);
      const up = await this.upload(blob, (file.name || 'photo.jpg').replace(/\.[^.]+$/, '') + '.jpg', 'image/jpeg');
      const i = document.getElementById('chat-input'), cap = i && i.value.trim() ? i.value.trim() : null;
      if (cap) { i.value = ''; this.setSendIcon(); }
      await this.sendMessage({ kind: 'image', body: cap, attachment_url: up.url, attachment_name: file.name || 'photo.jpg', attachment_type: 'image/jpeg', attachment_size: up.size });
    } catch (e) { this.toast('Could not send photo: ' + (e.message || e), 'error'); }
  },
  async sendFile(file) {
    if (!file || !this.cur) return;
    if (file.type.startsWith('image/')) return this.sendImage(file);
    if (file.size > 10 * 1024 * 1024) { this.toast('Files can be up to 10 MB', 'warning'); return; }
    try {
      this.toast('Uploading ' + file.name + '…');
      const up = await this.upload(file, file.name, file.type);
      await this.sendMessage({ kind: 'file', attachment_url: up.url, attachment_name: file.name, attachment_type: file.type, attachment_size: up.size });
    } catch (e) { this.toast('Could not upload file: ' + (e.message || e), 'error'); }
  },

  /* ---------- voice notes ---------- */
  async startRecording() {
    if (this.rec) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { this.toast('Voice messages are not supported on this browser', 'warning'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      this.rec = { mr, stream, chunks, t0: Date.now(), mime: mr.mimeType || mime || 'audio/webm', cancelled: false };
      mr.start();
      document.getElementById('chat-composer').hidden = true; document.getElementById('chat-rec').hidden = false;
      this.recT = setInterval(() => { const s = Math.floor((Date.now() - this.rec.t0) / 1000); const el = document.getElementById('chat-rec-t'); if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); if (s >= 300) this.finishRecording(); }, 250);
    } catch (e) { this.toast('Microphone permission is needed for voice messages', 'warning'); }
  },
  stopRecording(cancel) {
    clearInterval(this.recT);
    if (this.rec) { this.rec.cancelled = !!cancel; try { this.rec.mr.state !== 'inactive' && this.rec.mr.stop(); this.rec.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* silent */ } }
    if (cancel) this.rec = null;
    const r = document.getElementById('chat-rec'), c = document.getElementById('chat-composer'); if (r) r.hidden = true; if (c) c.hidden = false;
  },
  async finishRecording() {
    const rec = this.rec; if (!rec) return;
    const dur = Math.max(1, Math.round((Date.now() - rec.t0) / 1000));
    await new Promise(res => { rec.mr.onstop = res; try { rec.mr.stop(); } catch (e) { res(); } });
    this.stopRecording(false); this.rec = null;
    const blob = new Blob(rec.chunks, { type: rec.mime });
    if (blob.size < 500) return;
    try {
      const ext = rec.mime.includes('mp4') ? 'm4a' : rec.mime.includes('ogg') ? 'ogg' : 'webm';
      const up = await this.upload(blob, 'voice.' + ext, rec.mime.split(';')[0]);
      await this.sendMessage({ kind: 'voice', attachment_url: up.url, attachment_name: 'Voice message', attachment_type: rec.mime, attachment_size: up.size, duration: dur });
    } catch (e) { this.toast('Could not send voice message: ' + (e.message || e), 'error'); }
  },

  /* ---------- polls · tasks · events ---------- */
  pollDialog() {
    this.dlg('Create poll', `<label class="chat-lbl">Question</label><input id="pl-q" class="form-input" maxlength="200" placeholder="Ask something" />
      <label class="chat-lbl">Options</label><div id="pl-opts">${[1, 2].map(i => `<input class="form-input pl-o" maxlength="100" placeholder="Option ${i}" />`).join('')}</div>
      <button type="button" class="btn btn-outline btn-sm" id="pl-add"><i data-lucide="plus"></i><span>Add option</span></button>
      <label class="chat-chk"><input type="checkbox" id="pl-multi" /> Allow multiple answers</label>`,
      [{ label: 'Cancel' }, { label: 'Send poll', cls: 'btn-primary', fn: async (ov) => {
        const q = ov.querySelector('#pl-q').value.trim(), opts = [...ov.querySelectorAll('.pl-o')].map(x => x.value.trim()).filter(Boolean);
        if (!q || opts.length < 2) { this.toast('Add a question and at least two options', 'warning'); return false; }
        await this.sendMessage({ kind: 'poll', meta: { q, options: opts, multi: ov.querySelector('#pl-multi').checked } });
      } }]).querySelector('#pl-add').onclick = (e) => {
        const box = document.getElementById('pl-opts'); if (box.children.length >= 8) return;
        const inp = document.createElement('input'); inp.className = 'form-input pl-o'; inp.maxLength = 100; inp.placeholder = 'Option ' + (box.children.length + 1); box.appendChild(inp); inp.focus();
      };
  },
  taskDialog() {
    const mem = (this.members[this.cur] || []).map(m => `<option value="${m.admin_id}">${this.esc(this.nameOf(m.admin_id))}</option>`).join('');
    this.dlg('Assign a task', `<label class="chat-lbl">Task</label><input id="tk-t" class="form-input" maxlength="160" placeholder="What needs to be done?" />
      <label class="chat-lbl">Assign to</label><select id="tk-a" class="form-select"><option value="">Anyone</option>${mem}</select>
      <label class="chat-lbl">Due date</label><input id="tk-d" type="date" class="form-input" />`,
      [{ label: 'Cancel' }, { label: 'Send task', cls: 'btn-primary', fn: async (ov) => {
        const title = ov.querySelector('#tk-t').value.trim(); if (!title) { this.toast('Describe the task', 'warning'); return false; }
        const assignee = ov.querySelector('#tk-a').value || null;
        await this.sendMessage({ kind: 'task', meta: { title, assignee, due: ov.querySelector('#tk-d').value || null, done: false }, mentions: assignee ? [assignee] : [] });
      } }]);
  },
  async eventDialog() {
    const { data } = await this.db.from('events').select('id,title,event_date,venue').gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(30);
    const list = data || [];
    this.dlg('Share an event', list.length ? `<div class="chat-pick">${list.map((e, i) => `<label><input type="radio" name="ev" value="${i}" ${i === 0 ? 'checked' : ''}/><span><b>${this.esc(e.title)}</b><small>${this.esc(new Date(e.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}${e.venue ? ' · ' + this.esc(e.venue) : ''}</small></span></label>`).join('')}</div>` : '<p class="chat-hint">No upcoming events to share.</p>',
      [{ label: 'Cancel' }, ...(list.length ? [{ label: 'Share', cls: 'btn-primary', fn: async (ov) => {
        const ev = list[+(ov.querySelector('input[name=ev]:checked')?.value || 0)];
        await this.sendMessage({ kind: 'event', meta: { id: ev.id, title: ev.title, date: ev.event_date, venue: ev.venue || '' } });
      } }] : [])]);
  },

  /* ---------- message menu & actions ---------- */
  msgMenu(id, btn) {
    const m = (this.msgs[this.cur] || []).find(x => x.id === id); if (!m || m._tmp) return;
    const mine = m.sender_id === this.me.id, room = this.rooms.get(this.cur), canPost = this.canPost(room).ok, ra = this.isRoomAdmin(this.cur) || this.isSuper;
    const starred = this.extras.stars.has(id);
    const item = (k, ic, label, cls = '') => `<button type="button" class="${cls}" data-act="m-act" data-do="${k}" data-id="${id}"><i data-lucide="${ic}"></i>${label}</button>`;
    let h = '';
    if (!m.deleted_at && canPost) h += `<div class="chat-rx-pick">${CHAT_REACTIONS.map(e => `<button type="button" data-act="react" data-id="${id}" data-emoji="${e}">${e}</button>`).join('')}</div>`;
    if (!m.deleted_at) {
      if (canPost) h += item('reply', 'reply', 'Reply');
      if (m.body) h += item('copy', 'copy', 'Copy text');
      h += item('forward', 'forward', 'Forward');
      h += item('star', 'star', starred ? 'Unstar' : 'Star');
      if (ra) h += item('pin', 'pin', m.is_pinned ? 'Unpin' : 'Pin');
      if (mine && m.kind === 'text' && Date.now() - new Date(m.created_at) < CHAT_EDIT_WINDOW_MS) h += item('edit', 'pencil', 'Edit');
      h += item('info', 'info', 'Message info');
      if (!mine) h += item('report', 'flag', 'Report to Super Admin');
    }
    h += item('delme', 'eye-off', 'Delete for me');
    if (!m.deleted_at && (mine || ra)) h += item('delall', 'trash-2', this.isSuper && !mine ? 'Delete (moderation)' : 'Delete for everyone', 'danger');
    this.popAt(btn, h, 'msg');
  },

  async msgAction(kind, id) {
    const m = (this.msgs[this.cur] || []).find(x => x.id === id); if (!m) return;
    if (kind === 'reply') { this.replyTo = m; this.editing = null; this.renderReplyBar(); document.getElementById('chat-input')?.focus(); }
    else if (kind === 'copy') { try { await navigator.clipboard.writeText(m.body || ''); this.toast('Copied', 'success'); } catch (e) { this.toast('Could not copy', 'warning'); } }
    else if (kind === 'forward') this.forwardDialog(m);
    else if (kind === 'star') await this.toggleStar(id);
    else if (kind === 'pin') await this.setPinned(id, !m.is_pinned);
    else if (kind === 'edit') this.startEdit(m);
    else if (kind === 'info') this.messageInfo(m);
    else if (kind === 'report') this.reportDialog(m);
    else if (kind === 'delme') { this.hidden.add(id); this._lsSet('chat_hidden_' + this.me.id, [...this.hidden]); this.renderMessages(false); }
    else if (kind === 'delall') {
      this.dlg('Delete message?', '<p class="chat-hint">The message will be removed for everyone in this chat.</p>', [{ label: 'Cancel' }, { label: 'Delete', cls: 'btn-danger', fn: async () => {
        const upd = { deleted_at: new Date().toISOString(), deleted_by: this.me.id };
        const { error } = await this.db.from('chat_messages').update(upd).eq('id', id);
        if (error) { this.toast('Could not delete: ' + error.message, 'error'); return; }
        Object.assign(m, upd); this.updateMessageNode(id); this.renderPinned();
        if (this.isSuper && m.sender_id !== this.me.id) { try { await this.d.auth.logActivity(this.me.id, 'CHAT_MODERATE_DELETE', 'chat_messages', id, { room: m.room_id, sender: m.sender_id }); } catch (e) { /* silent */ } }
      } }]);
    }
  },

  async toggleReaction(id, emoji) {
    const list = this.extras.reactions[id] = this.extras.reactions[id] || [];
    const i = list.findIndex(x => x.admin_id === this.me.id && x.emoji === emoji);
    if (i >= 0) { list.splice(i, 1); this.updateMessageNode(id); await this.db.from('chat_reactions').delete().eq('message_id', id).eq('admin_id', this.me.id).eq('emoji', emoji); }
    else { list.push({ message_id: id, admin_id: this.me.id, emoji }); this.updateMessageNode(id); await this.db.from('chat_reactions').insert({ message_id: id, admin_id: this.me.id, emoji }); }
  },
  async toggleStar(id) {
    if (this.extras.stars.has(id)) { this.extras.stars.delete(id); await this.db.from('chat_stars').delete().eq('message_id', id).eq('admin_id', this.me.id); }
    else { this.extras.stars.add(id); await this.db.from('chat_stars').insert({ message_id: id, admin_id: this.me.id }); }
    this.updateMessageNode(id);
  },
  async setPinned(id, on) {
    const m = (this.msgs[this.cur] || []).find(x => x.id === id); if (!m) return;
    m.is_pinned = on; this.updateMessageNode(id); this.renderPinned();
    await this.db.from('chat_messages').update({ is_pinned: on }).eq('id', id);
  },
  async vote(id, idx) {
    const m = (this.msgs[this.cur] || []).find(x => x.id === id); if (!m || !this.canPost().ok) return;
    const list = this.extras.votes[id] = this.extras.votes[id] || [], had = list.some(v => v.admin_id === this.me.id && v.option_idx === idx);
    if (!m.meta.multi) {
      const mineOther = list.filter(v => v.admin_id === this.me.id && v.option_idx !== idx);
      for (const v of mineOther) { list.splice(list.indexOf(v), 1); await this.db.from('chat_poll_votes').delete().eq('message_id', id).eq('admin_id', this.me.id).eq('option_idx', v.option_idx); }
    }
    if (had) { list.splice(list.findIndex(v => v.admin_id === this.me.id && v.option_idx === idx), 1); await this.db.from('chat_poll_votes').delete().eq('message_id', id).eq('admin_id', this.me.id).eq('option_idx', idx); }
    else { list.push({ message_id: id, admin_id: this.me.id, option_idx: idx }); await this.db.from('chat_poll_votes').insert({ message_id: id, admin_id: this.me.id, option_idx: idx }); }
    this.updateMessageNode(id);
  },
  async toggleTask(id) {
    const m = (this.msgs[this.cur] || []).find(x => x.id === id); if (!m) return;
    const t = m.meta || {}, allowed = m.sender_id === this.me.id || t.assignee === this.me.id || !t.assignee || this.isRoomAdmin(this.cur) || this.isSuper;
    if (!allowed) { this.toast('Only the assignee or the creator can update this task', 'warning'); return; }
    const meta = Object.assign({}, t, { done: !t.done, done_by: !t.done ? this.me.id : null, done_at: !t.done ? new Date().toISOString() : null });
    m.meta = meta; this.updateMessageNode(id);
    await this.db.from('chat_messages').update({ meta }).eq('id', id);
  },

  startEdit(m) {
    this.editing = m; this.replyTo = null; this.renderReplyBar();
    const i = document.getElementById('chat-input'); if (i) { i.value = m.body || ''; i.focus(); this.autosize(); this.setSendIcon(); }
  },
  cancelEdit() { if (this.editing) { const i = document.getElementById('chat-input'); if (i) { i.value = ''; this.autosize(); } this.editing = null; this.setSendIcon(); } },
  async saveEdit(text) {
    const m = this.editing; this.editing = null; this.renderReplyBar();
    const i = document.getElementById('chat-input'); if (i) { i.value = ''; this.autosize(); this.setSendIcon(); }
    if (!m || text === m.body) return;
    await this.db.from('chat_message_edits').insert({ message_id: m.id, old_body: m.body, edited_by: this.me.id });
    const upd = { body: text, edited_at: new Date().toISOString(), mentions: this.mentionIds(text, m.room_id) };
    const { error } = await this.db.from('chat_messages').update(upd).eq('id', m.id);
    if (error) { this.toast('Could not edit: ' + error.message, 'error'); return; }
    Object.assign(m, upd); this.updateMessageNode(m.id);
  },
  async showHistory(id) {
    const { data } = await this.db.from('chat_message_edits').select('*').eq('message_id', id).order('edited_at', { ascending: true });
    this.dlg('Edit history', (data || []).length ? (data || []).map(e => `<div class="chat-hist"><small>${this.esc(new Date(e.edited_at).toLocaleString('en-IN'))} · replaced by ${this.esc(this.nameOf(e.edited_by))}</small><p>${this.esc(e.old_body)}</p></div>`).join('') : '<p class="chat-hint">No earlier versions.</p>', [{ label: 'Close' }]);
  },
  messageInfo(m) {
    const others = (this.members[m.room_id] || []).filter(x => x.admin_id !== m.sender_id);
    const seen = others.filter(o => o.last_read_at >= m.created_at), not = others.filter(o => o.last_read_at < m.created_at);
    const rx = this.extras.reactions[m.id] || [];
    this.dlg('Message info', `<p class="chat-hint">Sent ${this.esc(new Date(m.created_at).toLocaleString('en-IN'))} by <b>${this.esc(this.nameOf(m.sender_id))}</b></p>
      <h4 class="chat-h4"><i data-lucide="check-check" class="tick seen"></i> Seen by (${seen.length})</h4>${seen.map(o => `<div class="chat-person"><span class="chat-av sm" style="background:${this.colorFor(o.admin_id)}">${this.esc(this.initial(this.nameOf(o.admin_id)))}</span>${this.esc(this.nameOf(o.admin_id))}</div>`).join('') || '<p class="chat-hint">Nobody yet</p>'}
      <h4 class="chat-h4"><i data-lucide="check" class="tick"></i> Not yet seen (${not.length})</h4>${not.map(o => `<div class="chat-person"><span class="chat-av sm" style="background:${this.colorFor(o.admin_id)}">${this.esc(this.initial(this.nameOf(o.admin_id)))}</span>${this.esc(this.nameOf(o.admin_id))}</div>`).join('') || '<p class="chat-hint">Everyone has seen it</p>'}
      ${rx.length ? `<h4 class="chat-h4">Reactions</h4>${rx.map(r => `<div class="chat-person">${r.emoji} ${this.esc(this.nameOf(r.admin_id))}</div>`).join('')}` : ''}`, [{ label: 'Close' }]);
  },
  forwardDialog(m) {
    const rooms = [...this.rooms.values()].filter(r => this.isMember(r.id) && this.canPost(r).ok);
    const ov = this.dlg('Forward to…', `<div class="chat-pick">${rooms.map(r => `<label><input type="checkbox" value="${r.id}"/><span><b>${this.esc(this.roomName(r))}</b><small>${r.kind === 'direct' ? 'Direct chat' : (this.members[r.id] || []).length + ' members'}</small></span></label>`).join('') || '<p class="chat-hint">No chats to forward to.</p>'}</div>`,
      [{ label: 'Cancel' }, { label: 'Forward', cls: 'btn-primary', fn: async (o) => {
        const ids = [...o.querySelectorAll('input:checked')].map(x => x.value); if (!ids.length) return false;
        for (const rid of ids) {
          const room = this.rooms.get(rid);
          await this.sendMessage({ kind: m.kind, body: m.body, attachment_url: m.attachment_url, attachment_name: m.attachment_name, attachment_type: m.attachment_type, attachment_size: m.attachment_size, duration: m.duration, meta: m.meta || {}, forwarded: true, noReply: true }, rid);
          if (room && room.id === this.cur) this.renderMessages(false);
        }
        this.toast('Forwarded to ' + ids.length + ' chat' + (ids.length > 1 ? 's' : ''), 'success');
      } }]);
    return ov;
  },
  reportDialog(m) {
    this.dlg('Report message', `<p class="chat-hint">This sends the message to the Super Admin for review.</p><label class="chat-lbl">Reason</label><textarea id="rp-r" class="form-input" rows="3" maxlength="300" placeholder="What is wrong with this message?"></textarea>`,
      [{ label: 'Cancel' }, { label: 'Report', cls: 'btn-danger', fn: async (ov) => {
        const reason = ov.querySelector('#rp-r').value.trim(); if (!reason) { this.toast('Please add a reason', 'warning'); return false; }
        const { error } = await this.db.from('chat_reports').insert({ message_id: m.id, room_id: m.room_id, reported_by: this.me.id, reason });
        this.toast(error ? 'Could not send report' : 'Reported to the Super Admin', error ? 'error' : 'success');
      } }]);
  },
  lightbox(src) {
    const ov = document.createElement('div'); ov.className = 'chat-lightbox'; ov.innerHTML = `<button type="button" aria-label="Close"><i data-lucide="x"></i></button><img src="${this.esc(src)}" alt="">`;
    ov.addEventListener('click', () => ov.remove()); document.body.appendChild(ov); lucide.createIcons();
  },

  /* ---------- paging, jumping, search ---------- */
  async loadOlder() {
    const list = this.msgs[this.cur]; if (!list || !list.length) return;
    const older = await this.loadMessages(this.cur, { before: list[0].created_at });
    this.noMore[this.cur] = older.length < CHAT_PAGE; this.msgs[this.cur] = older.concat(list);
    const box = document.getElementById('chat-msgs'), h = box.scrollHeight; this.renderMessages(false); box.scrollTop = box.scrollHeight - h;
  },
  async jumpLatest() {
    if (this.windowed) { this.windowed = false; this.msgs[this.cur] = await this.loadMessages(this.cur); this.noMore[this.cur] = this.msgs[this.cur].length < CHAT_PAGE; this.renderMessages(true); }
    const box = document.getElementById('chat-msgs'); if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  },
  async jumpTo(id) {
    let node = document.getElementById('m-' + id);
    if (!node) {
      const { data } = await this.db.from('chat_messages').select('*').eq('id', id).limit(1); const row = data && data[0]; if (!row) return;
      if (row.room_id !== this.cur) await this.openRoom(row.room_id);
      this.msgs[this.cur] = await this.loadMessages(this.cur, { before: new Date(new Date(row.created_at).getTime() + 1).toISOString(), limit: 60 });
      this.windowed = true; this.noMore[this.cur] = false; this.renderMessages(false); node = document.getElementById('m-' + id);
    }
    if (node) { node.scrollIntoView({ block: 'center', behavior: 'smooth' }); node.classList.add('flash'); setTimeout(() => node.classList.remove('flash'), 1800); }
  },
  openSearch() {
    document.getElementById('chat-search-panel')?.remove();
    const p = document.createElement('div'); p.id = 'chat-search-panel'; p.className = 'chat-search-panel';
    p.innerHTML = `<div class="chat-search"><i data-lucide="search"></i><input id="chat-room-search" type="search" placeholder="Search in this chat" autocomplete="off" /><button type="button" class="chat-ib" id="chat-search-x" aria-label="Close search"><i data-lucide="x"></i></button></div><div class="chat-search-res" id="chat-search-res"></div>`;
    document.getElementById('chat-main').appendChild(p); lucide.createIcons();
    p.querySelector('#chat-search-x').onclick = () => p.remove(); p.querySelector('input').focus();
    p.querySelector('#chat-search-res').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { p.remove(); this.jumpTo(b.dataset.id); } });
  },
  async runSearch(q) {
    q = q.trim(); const box = document.getElementById('chat-search-res'); if (!box) return;
    if (q.length < 2) { box.innerHTML = ''; return; }
    const { data } = await this.db.from('chat_messages').select('*').eq('room_id', this.cur).ilike('body', '%' + q + '%').is('deleted_at', null).order('created_at', { ascending: false }).limit(30);
    box.innerHTML = (data || []).map(m => `<button type="button" data-id="${m.id}"><b>${this.esc(this.nameOf(m.sender_id))}</b><time>${this.esc(this.shortTime(m.created_at))}</time><span>${this.esc(m.body).slice(0, 120)}</span></button>`).join('') || '<p class="chat-hint">No messages found</p>';
  },

  /* ---------- rooms: create / direct / join ---------- */
  async startDirect(adminId) {
    const key = [this.me.id, adminId].sort().join(':');
    let room = [...this.rooms.values()].find(r => r.dm_key === key);
    if (!room) {
      const f = await this.db.from('chat_rooms').select('*').eq('dm_key', key).limit(1);
      room = f.data && f.data[0];
      if (!room) {
        const ins = await this.db.from('chat_rooms').insert({ kind: 'direct', dm_key: key, created_by: this.me.id }).select('*');
        if (ins.error) throw ins.error; room = ins.data[0];
      }
      const { data: mem } = await this.db.from('chat_members').select('admin_id').eq('room_id', room.id);
      const have = new Set((mem || []).map(m => m.admin_id)); const rows = [this.me.id, adminId].filter(x => !have.has(x)).map(x => ({ room_id: room.id, admin_id: x, role: 'member' }));
      if (rows.length) await this.db.from('chat_members').insert(rows);
      await this.refreshRooms();
    }
    this.q = ''; const qi = document.getElementById('chat-q'); if (qi) qi.value = '';
    if (this.mode === 'monitor') { this.mode = 'mine'; await this.loadRooms(); }
    await this.openRoom(room.id);
  },

  newChatDialog() {
    const people = Object.values(this.admins).filter(a => a.id !== this.me.id && a.is_active !== false).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
    const roles = [...new Set(people.map(p => p.role).filter(Boolean))];
    const ov = this.dlg('New chat', `
      <div class="chat-seg"><button type="button" class="on" data-seg="dm">Direct chat</button><button type="button" data-seg="grp">New group</button></div>
      <div id="nc-dm"><div class="chat-search"><i data-lucide="search"></i><input id="nc-q" placeholder="Search admins" /></div>
        <div class="chat-pick" id="nc-list">${people.map(p => `<button type="button" class="chat-person-btn" data-dm="${p.id}" data-n="${this.esc(String(p.full_name).toLowerCase())}"><span class="chat-av sm" style="background:${this.colorFor(p.id)}">${this.esc(this.initial(p.full_name))}</span><span><b>${this.esc(p.full_name)}</b><small>${this.esc((window.RoleUtils ? RoleUtils.labels(p).join(' · ') : p.role) || '')}</small></span></button>`).join('')}</div></div>
      <div id="nc-grp" hidden>
        <label class="chat-lbl">Group name</label><input id="ng-name" class="form-input" maxlength="60" placeholder="e.g. Project Committee" />
        <label class="chat-lbl">Description (optional)</label><input id="ng-desc" class="form-input" maxlength="140" />
        <label class="chat-lbl">Type</label><select id="ng-kind" class="form-select"><option value="group">Group — everyone can send</option><option value="announcement">Announcement — only admins can send</option></select>
        <label class="chat-lbl">Colour</label><div class="chat-colors" id="ng-colors">${['#B30F57', '#2B7DE9', '#1FA971', '#E08A00', '#8E44EC', '#0FB5C9', '#5C6B7A'].map((c, i) => `<button type="button" data-c="${c}" class="${i === 0 ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
        <label class="chat-lbl">Members <button type="button" class="chat-link" id="ng-all">Select all</button></label>
        ${roles.length ? `<div class="chat-chips">${roles.map(r => `<button type="button" data-role="${this.esc(r)}">${this.esc((window.ROLE_DISPLAY_NAMES && ROLE_DISPLAY_NAMES[r]) || r)}</button>`).join('')}</div>` : ''}
        <div class="chat-pick" id="ng-list">${people.map(p => `<label><input type="checkbox" value="${p.id}" data-role="${this.esc(p.role || '')}"/><span><b>${this.esc(p.full_name)}</b><small>${this.esc((window.RoleUtils ? RoleUtils.labels(p).join(' · ') : p.role) || '')}</small></span></label>`).join('')}</div></div>`,
      [{ label: 'Cancel' }, { label: 'Create group', cls: 'btn-primary grp-only', fn: async (o) => {
        if (o.querySelector('#nc-grp').hidden) return false;
        const name = o.querySelector('#ng-name').value.trim(); const ids = [...o.querySelectorAll('#ng-list input:checked')].map(x => x.value);
        if (!name) { this.toast('Give the group a name', 'warning'); return false; }
        if (!ids.length) { this.toast('Pick at least one member', 'warning'); return false; }
        await this.createGroup({ name, description: o.querySelector('#ng-desc').value.trim(), kind: o.querySelector('#ng-kind').value, color: o.querySelector('#ng-colors .on')?.dataset.c || '#B30F57' }, ids);
      } }]);
    const create = ov.querySelector('.grp-only'); create.style.display = 'none';
    ov.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => {
      ov.querySelectorAll('[data-seg]').forEach(x => x.classList.toggle('on', x === b));
      ov.querySelector('#nc-dm').hidden = b.dataset.seg !== 'dm'; ov.querySelector('#nc-grp').hidden = b.dataset.seg !== 'grp'; create.style.display = b.dataset.seg === 'grp' ? '' : 'none';
    });
    ov.querySelector('#nc-q').oninput = (e) => { const q = e.target.value.toLowerCase(); ov.querySelectorAll('[data-dm]').forEach(b => { b.hidden = !b.dataset.n.includes(q); }); };
    ov.querySelector('#nc-list').onclick = async (e) => { const b = e.target.closest('[data-dm]'); if (b) { ov.remove(); await this.startDirect(b.dataset.dm); } };
    ov.querySelector('#ng-colors').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { ov.querySelectorAll('#ng-colors button').forEach(x => x.classList.toggle('on', x === b)); } };
    ov.querySelector('#ng-all').onclick = () => { const boxes = [...ov.querySelectorAll('#ng-list input')], all = boxes.every(b => b.checked); boxes.forEach(b => { b.checked = !all; }); };
    ov.querySelectorAll('.chat-chips [data-role]').forEach(c => c.onclick = () => { ov.querySelectorAll(`#ng-list input[data-role="${c.dataset.role}"]`).forEach(b => { b.checked = true; }); c.classList.add('on'); });
  },

  async createGroup(info, ids) {
    const ins = await this.db.from('chat_rooms').insert({ kind: info.kind, name: info.name, description: info.description || null, color: info.color, created_by: this.me.id }).select('*');
    if (ins.error) { this.toast('Could not create group: ' + ins.error.message, 'error'); return; }
    const room = ins.data[0];
    const rows = [{ room_id: room.id, admin_id: this.me.id, role: 'owner' }].concat(ids.filter(i => i !== this.me.id).map(i => ({ room_id: room.id, admin_id: i, role: 'member' })));
    await this.db.from('chat_members').insert(rows);
    await this.sendSystem(room.id, `${this.me.full_name} created the group “${info.name}”`);
    await this.refreshRooms(); await this.openRoom(room.id); this.toast('Group created', 'success');
  },

  async joinAsObserver() {
    const r = this.rooms.get(this.cur); if (!r) return;
    await this.db.from('chat_members').insert({ room_id: r.id, admin_id: this.me.id, role: 'member' });
    await this.sendSystem(r.id, `${this.me.full_name} (Super Admin) joined the chat`);
    await this.refreshRooms(); await this.openRoom(r.id, { reload: true });
  },

  prefsDialog() {
    this.dlg('Chat settings', `<label class="chat-chk"><input type="checkbox" id="pf-snd" ${this.prefs.sound ? 'checked' : ''}/> Play a sound for new messages</label>
      <label class="chat-chk"><input type="checkbox" id="pf-ntf" ${this.prefs.notify ? 'checked' : ''}/> Desktop notifications when this tab is in the background</label>
      <p class="chat-hint">Messages you delete “for me” or clear are hidden only on this device. Chats are monitored by the Super Admin.</p>`,
      [{ label: 'Cancel' }, { label: 'Save', cls: 'btn-primary', fn: async (ov) => {
        this.prefs.sound = ov.querySelector('#pf-snd').checked; this.prefs.notify = ov.querySelector('#pf-ntf').checked;
        if (this.prefs.notify && window.Notification && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { /* silent */ } }
        if (this.prefs.notify && window.Notification && Notification.permission === 'denied') { this.prefs.notify = false; this.toast('Notifications are blocked in the browser settings', 'warning'); }
        this._lsSet('chat_prefs_' + this.me.id, this.prefs);
      } }]);
  }
});

/* ---------- room info · management ---------- */
Object.assign(AdminChat.prototype, {

  renderInfo() {
    const p = document.getElementById('chat-info'); if (!p) return;
    const r = this.rooms.get(this.cur);
    if (!this.infoOpen || !r) { p.classList.remove('open'); p.innerHTML = ''; return; }
    const mem = this.members[r.id] || [], mine = this.myMember(r.id), ra = this.isRoomAdmin(r.id) || this.isSuper, owner = this.myRole(r.id) === 'owner' || this.isSuper;
    const msgs = (this.msgs[r.id] || []).filter(m => !m.deleted_at && this.visible(m));
    const imgs = msgs.filter(m => m.kind === 'image').slice(-9).reverse(), docs = msgs.filter(m => m.kind === 'file').slice(-5).reverse();
    const starred = msgs.filter(m => this.extras.stars.has(m.id)).slice(-5).reverse(), pins = msgs.filter(m => m.is_pinned).slice(-5).reverse();
    const name = this.roomName(r);
    const row = (act, ic, label, extra = '', cls = '') => `<button type="button" class="chat-info-row ${cls}" data-act="info-act" data-do="${act}" ${extra}><i data-lucide="${ic}"></i><span>${label}</span></button>`;
    p.innerHTML = `
      <div class="chat-info-h"><b>${r.kind === 'direct' ? 'Contact info' : 'Group info'}</b><button type="button" class="chat-ib" data-act="close-info" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="chat-info-body">
        <div class="chat-info-top"><span class="chat-av xl" style="background:${this.roomColor(r)}">${r.kind === 'direct' ? this.esc(this.initial(name)) : (r.kind === 'announcement' ? '<i data-lucide="megaphone"></i>' : '<i data-lucide="users"></i>')}</span>
          <h3>${this.esc(name)}</h3><p>${this.esc(r.kind === 'direct' ? (this.admins[this.directPeer(r)]?.email || '') : (r.description || (r.kind === 'announcement' ? 'Announcement chat' : 'Group chat')))}</p>
          <small>${r.kind === 'direct' ? '' : mem.length + ' members · created ' + this.esc(new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}</small></div>
        <div class="chat-info-sec">
          ${mine ? row('mute', mine.muted ? 'bell' : 'bell-off', mine.muted ? 'Unmute notifications' : 'Mute notifications') + row('pin', 'pin', mine.pinned ? 'Unpin chat' : 'Pin chat to top') + row('archive', 'archive', mine.archived ? 'Unarchive chat' : 'Archive chat') : ''}
          ${ra ? `<label class="chat-info-sel"><i data-lucide="timer"></i><span>Disappearing messages</span><select id="info-dis" class="form-select">${[[0, 'Off'], [86400, '24 hours'], [604800, '7 days'], [7776000, '90 days']].map(o => `<option value="${o[0]}" ${r.disappear_after === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>` : ''}
          ${ra && r.kind !== 'direct' ? row('lock', r.is_locked ? 'lock-open' : 'lock', r.is_locked ? 'Let everyone send messages' : 'Only admins can send messages') : ''}
          ${ra && r.kind !== 'direct' ? row('edit', 'pencil', 'Edit group name &amp; details') + row('add', 'user-plus', 'Add members') : ''}
          ${row('export', 'download', 'Export chat (text file)')}
          ${row('clear', 'eraser', 'Clear chat on this device')}
        </div>
        ${r.disappear_after ? `<p class="chat-hint pad"><i data-lucide="timer"></i> Messages disappear for members after ${r.disappear_after >= 86400 ? r.disappear_after / 86400 + ' day(s)' : '24 hours'}. The Super Admin can still audit them.</p>` : ''}
        ${r.kind !== 'direct' ? `<div class="chat-info-sec"><h4 class="chat-h4">${mem.length} members</h4>${mem.map(m => `<div class="chat-person"><span class="chat-av sm" style="background:${this.colorFor(m.admin_id)}">${this.esc(this.initial(this.nameOf(m.admin_id)))}${this.online.has(m.admin_id) ? '<i class="chat-dot"></i>' : ''}</span><span class="grow"><b>${this.esc(this.nameOf(m.admin_id))}${m.admin_id === this.me.id ? ' (You)' : ''}</b><small>${this.esc((window.RoleUtils && this.admins[m.admin_id] ? RoleUtils.labels(this.admins[m.admin_id]).join(' · ') : ''))}</small></span>${m.role !== 'member' ? `<em class="role">${m.role === 'owner' ? 'Owner' : 'Admin'}</em>` : ''}
          ${ra && m.admin_id !== this.me.id && m.role !== 'owner' ? `<button type="button" class="chat-ib sm" data-act="info-act" data-do="${m.role === 'admin' ? 'demote' : 'promote'}" data-id="${m.admin_id}" title="${m.role === 'admin' ? 'Remove as admin' : 'Make group admin'}" aria-label="Toggle admin"><i data-lucide="${m.role === 'admin' ? 'shield-off' : 'shield-plus'}"></i></button><button type="button" class="chat-ib sm danger" data-act="info-act" data-do="remove" data-id="${m.admin_id}" title="Remove from group" aria-label="Remove"><i data-lucide="user-minus"></i></button>` : ''}</div>`).join('')}</div>` : ''}
        ${imgs.length ? `<div class="chat-info-sec"><h4 class="chat-h4">Photos</h4><div class="chat-media">${imgs.map(m => `<img loading="lazy" src="${this.esc(m.attachment_url)}" alt="" data-act="lightbox" data-src="${this.esc(m.attachment_url)}">`).join('')}</div></div>` : ''}
        ${docs.length ? `<div class="chat-info-sec"><h4 class="chat-h4">Documents</h4>${docs.map(m => `<a class="chat-doc" href="${this.esc(m.attachment_url)}" target="_blank" rel="noopener"><i data-lucide="file-text"></i><span>${this.esc(m.attachment_name)}</span></a>`).join('')}</div>` : ''}
        ${pins.length ? `<div class="chat-info-sec"><h4 class="chat-h4">Pinned messages</h4>${pins.map(m => `<button type="button" class="chat-doc" data-act="jump" data-id="${m.id}"><i data-lucide="pin"></i><span>${this.esc(this.preview(m)).slice(0, 70)}</span></button>`).join('')}</div>` : ''}
        ${starred.length ? `<div class="chat-info-sec"><h4 class="chat-h4">Starred messages</h4>${starred.map(m => `<button type="button" class="chat-doc" data-act="jump" data-id="${m.id}"><i data-lucide="star"></i><span>${this.esc(this.preview(m)).slice(0, 70)}</span></button>`).join('')}</div>` : ''}
        <div class="chat-info-sec">
          ${this.isSuper ? row('archive-room', 'archive', r.is_archived ? 'Restore chat (Super Admin)' : 'Archive chat (Super Admin)') : ''}
          ${r.kind !== 'direct' && mine && r.dm_key !== 'all-admins' ? row('leave', 'log-out', 'Leave group', '', 'danger') : ''}
          ${owner && r.dm_key !== 'all-admins' ? row('delete-room', 'trash-2', 'Delete chat for everyone', '', 'danger') : ''}
        </div>
        <p class="chat-hint pad"><i data-lucide="shield-check"></i> This chat is monitored by the Super Admin.</p>
      </div>`;
    p.classList.add('open'); lucide.createIcons();
  },

  async infoAction(kind, id) {
    const r = this.rooms.get(this.cur); if (!r) return;
    const mine = this.myMember(r.id);
    const upd = async (table, vals, match) => { let q = this.db.from(table).update(vals); Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v); }); const { error } = await q; if (error) throw error; };
    if (kind === 'mute' && mine) { mine.muted = !mine.muted; await upd('chat_members', { muted: mine.muted }, { room_id: r.id, admin_id: this.me.id }); const m = (this._myMemberships || []).find(x => x.room_id === r.id); if (m) m.muted = mine.muted; }
    else if (kind === 'pin' && mine) { mine.pinned = !mine.pinned; await upd('chat_members', { pinned: mine.pinned }, { room_id: r.id, admin_id: this.me.id }); const m = (this._myMemberships || []).find(x => x.room_id === r.id); if (m) m.pinned = mine.pinned; }
    else if (kind === 'archive' && mine) { mine.archived = !mine.archived; await upd('chat_members', { archived: mine.archived }, { room_id: r.id, admin_id: this.me.id }); const m = (this._myMemberships || []).find(x => x.room_id === r.id); if (m) m.archived = mine.archived; if (mine.archived) { this.toast('Chat archived — find it by searching', 'info'); } }
    else if (kind === 'lock') { r.is_locked = !r.is_locked; await upd('chat_rooms', { is_locked: r.is_locked }, { id: r.id }); await this.sendSystem(r.id, r.is_locked ? 'Only admins can send messages now' : 'Everyone can send messages now'); }
    else if (kind === 'archive-room') { r.is_archived = !r.is_archived; await upd('chat_rooms', { is_archived: r.is_archived }, { id: r.id }); try { await this.d.auth.logActivity(this.me.id, 'CHAT_ARCHIVE', 'chat_rooms', r.id, { archived: r.is_archived }); } catch (e) { /* silent */ } }
    else if (kind === 'export') { await this.exportRoom(r.id); return; }
    else if (kind === 'clear') { this.cleared[r.id] = new Date().toISOString(); this._lsSet('chat_cleared_' + this.me.id, this.cleared); this.renderMessages(false); this.toast('Chat cleared on this device', 'success'); }
    else if (kind === 'edit') { this.editGroupDialog(r); return; }
    else if (kind === 'add') { this.addMembersDialog(r); return; }
    else if (kind === 'promote' || kind === 'demote') { await upd('chat_members', { role: kind === 'promote' ? 'admin' : 'member' }, { room_id: r.id, admin_id: id }); const m = (this.members[r.id] || []).find(x => x.admin_id === id); if (m) m.role = kind === 'promote' ? 'admin' : 'member'; }
    else if (kind === 'remove') {
      this.dlg('Remove member?', `<p class="chat-hint">${this.esc(this.nameOf(id))} will no longer see this group.</p>`, [{ label: 'Cancel' }, { label: 'Remove', cls: 'btn-danger', fn: async () => {
        await this.db.from('chat_members').delete().eq('room_id', r.id).eq('admin_id', id); this.members[r.id] = (this.members[r.id] || []).filter(x => x.admin_id !== id);
        await this.sendSystem(r.id, `${this.nameOf(id)} was removed`); this.renderInfo(); this.renderHeader();
      } }]); return;
    }
    else if (kind === 'leave') {
      this.dlg('Leave group?', '<p class="chat-hint">You will stop receiving messages from this group.</p>', [{ label: 'Cancel' }, { label: 'Leave', cls: 'btn-danger', fn: async () => {
        await this.db.from('chat_members').delete().eq('room_id', r.id).eq('admin_id', this.me.id); await this.sendSystem(r.id, `${this.me.full_name} left`);
        this.cur = null; this.infoOpen = false; await this.refreshRooms(); this.renderEmpty(); this.renderRoomList();
      } }]); return;
    }
    else if (kind === 'delete-room') {
      this.dlg('Delete chat?', '<p class="chat-hint">All messages and files links in this chat will be permanently deleted for everyone. This cannot be undone.</p>', [{ label: 'Cancel' }, { label: 'Delete', cls: 'btn-danger', fn: async () => {
        const { error } = await this.db.from('chat_rooms').delete().eq('id', r.id); if (error) { this.toast('Could not delete: ' + error.message, 'error'); return; }
        try { await this.d.auth.logActivity(this.me.id, 'CHAT_ROOM_DELETE', 'chat_rooms', r.id, { name: this.roomName(r) }); } catch (e) { /* silent */ }
        delete this.msgs[r.id]; this.cur = null; this.infoOpen = false; await this.refreshRooms(); this.renderEmpty(); this.renderRoomList();
      } }]); return;
    }
    this.renderInfo(); this.renderHeader(); this.renderComposer(); this.renderRoomList();
  },

  editGroupDialog(r) {
    this.dlg('Edit group', `<label class="chat-lbl">Name</label><input id="eg-n" class="form-input" maxlength="60" value="${this.esc(r.name || '')}" />
      <label class="chat-lbl">Description</label><input id="eg-d" class="form-input" maxlength="140" value="${this.esc(r.description || '')}" />`,
      [{ label: 'Cancel' }, { label: 'Save', cls: 'btn-primary', fn: async (ov) => {
        const name = ov.querySelector('#eg-n').value.trim(); if (!name) return false;
        const vals = { name, description: ov.querySelector('#eg-d').value.trim() || null };
        const { error } = await this.db.from('chat_rooms').update(vals).eq('id', r.id); if (error) { this.toast(error.message, 'error'); return; }
        Object.assign(r, vals); this.renderInfo(); this.renderHeader(); this.renderRoomList();
      } }]);
  },
  addMembersDialog(r) {
    const have = new Set((this.members[r.id] || []).map(m => m.admin_id));
    const people = Object.values(this.admins).filter(a => a.is_active !== false && !have.has(a.id));
    this.dlg('Add members', people.length ? `<div class="chat-pick">${people.map(p => `<label><input type="checkbox" value="${p.id}"/><span><b>${this.esc(p.full_name)}</b><small>${this.esc((window.RoleUtils ? RoleUtils.labels(p).join(' · ') : p.role) || '')}</small></span></label>`).join('')}</div>` : '<p class="chat-hint">Everyone is already in this group.</p>',
      [{ label: 'Cancel' }, ...(people.length ? [{ label: 'Add', cls: 'btn-primary', fn: async (ov) => {
        const ids = [...ov.querySelectorAll('input:checked')].map(x => x.value); if (!ids.length) return false;
        await this.db.from('chat_members').insert(ids.map(i => ({ room_id: r.id, admin_id: i, role: 'member' })));
        await this.sendSystem(r.id, `${this.me.full_name} added ${ids.map(i => this.nameOf(i)).join(', ')}`);
        await this.refreshRooms(); this.renderInfo(); this.renderHeader();
      } }] : [])]);
  },

  async exportRoom(roomId) {
    const r = this.rooms.get(roomId); if (!r) return;
    let all = [], from = null;
    for (let i = 0; i < 40; i++) {                                    // up to ~40 000 messages
      let q = this.db.from('chat_messages').select('*').eq('room_id', roomId);
      if (from) q = q.lt('created_at', from);
      const { data } = await q.order('created_at', { ascending: false }).limit(1000);
      if (!data || !data.length) break; all = all.concat(data); from = data[data.length - 1].created_at; if (data.length < 1000) break;
    }
    all.reverse();
    const lines = [`${this.roomName(r)} — chat export`, `Exported by ${this.me.full_name} on ${new Date().toLocaleString('en-IN')}`, ''];
    all.filter(m => this.isSuper || this.visible(m)).forEach(m => {
      const when = new Date(m.created_at).toLocaleString('en-IN');
      if (m.kind === 'system') { lines.push(`[${when}] * ${m.body}`); return; }
      if (m.deleted_at && !this.isSuper) { lines.push(`[${when}] ${this.nameOf(m.sender_id)}: (message deleted)`); return; }
      let body = m.body || '';
      if (m.attachment_url) body = `${m.kind === 'image' ? '[photo]' : m.kind === 'voice' ? '[voice message]' : '[file: ' + (m.attachment_name || '') + ']'} ${m.attachment_url}${body ? ' — ' + body : ''}`;
      if (m.kind === 'poll') body = `[poll] ${m.meta?.q} — ${(m.meta?.options || []).join(' | ')}`;
      if (m.kind === 'task') body = `[task] ${m.meta?.title}${m.meta?.done ? ' (done)' : ''}`;
      if (m.kind === 'event') body = `[event] ${m.meta?.title}`;
      lines.push(`[${when}] ${this.nameOf(m.sender_id)}: ${body}${m.edited_at ? ' (edited)' : ''}${m.deleted_at ? ' [DELETED by ' + this.nameOf(m.deleted_by) + ']' : ''}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (this.roomName(r).replace(/[^\w]+/g, '_') || 'chat') + '_export.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.toast('Chat exported', 'success');
    if (this.isSuper) { try { await this.d.auth.logActivity(this.me.id, 'CHAT_EXPORT', 'chat_rooms', roomId, { messages: all.length }); } catch (e) { /* silent */ } }
  },

  /* ---------- super admin: monitoring dashboard ---------- */
  async renderMonitorHome() {
    if (!this.isSuper) return;
    const main = document.getElementById('chat-main'); if (!main) return;
    document.getElementById('chat-app').classList.add('has-room'); document.getElementById('chat-info').classList.remove('open'); this.infoOpen = false;
    main.innerHTML = `<div class="chat-mon"><div class="chat-mon-h"><button type="button" class="chat-ib chat-back" data-act="back" aria-label="Back"><i data-lucide="arrow-left"></i></button><div><h2><i data-lucide="eye"></i> Chat monitoring</h2><p>Every chat on the portal — including deleted and edited messages — is visible here to the Super Admin.</p></div></div><div class="chat-mon-body" id="chat-mon-body"><div class="chat-empty-list"><i data-lucide="loader-2" class="mp-spin"></i><p>Loading…</p></div></div></div>`;
    lucide.createIcons();
    const dayAgo = new Date(Date.now() - 864e5).toISOString(), weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const head = (q) => Promise.resolve(q).then(r => r.count || 0);
    const [total, today, deleted, reportsOpen] = await Promise.all([
      head(this.db.from('chat_messages').select('id', { count: 'exact', head: true }).neq('kind', 'system')),
      head(this.db.from('chat_messages').select('id', { count: 'exact', head: true }).neq('kind', 'system').gte('created_at', dayAgo)),
      head(this.db.from('chat_messages').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null)),
      head(this.db.from('chat_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'))
    ]);
    const { data: recent } = await this.db.from('chat_messages').select('sender_id,created_at').neq('kind', 'system').order('created_at', { ascending: false }).limit(3000);
    const agg = {}; (recent || []).forEach(m => { const a = agg[m.sender_id] = agg[m.sender_id] || { n: 0, w: 0, last: null }; a.n++; if (m.created_at >= weekAgo) a.w++; if (!a.last) a.last = m.created_at; });
    const { data: reps } = await this.db.from('chat_reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(20);
    const repMsgs = {}; if ((reps || []).length) { const { data: rm } = await this.db.from('chat_messages').select('*').in('id', reps.map(r => r.message_id)); (rm || []).forEach(m => { repMsgs[m.id] = m; }); }
    const admins = Object.values(this.admins).filter(a => a.is_active !== false).sort((a, b) => (agg[b.id]?.n || 0) - (agg[a.id]?.n || 0));
    const rooms = [...this.rooms.values()].sort((a, b) => String(b.last_message_at || '').localeCompare(String(a.last_message_at || ''))).slice(0, 15);
    const body = document.getElementById('chat-mon-body'); if (!body) return;
    const card = (ic, n, l, cls = '') => `<div class="chat-stat ${cls}"><i data-lucide="${ic}"></i><b>${n}</b><span>${l}</span></div>`;
    body.innerHTML = `
      <div class="chat-stats">${card('messages-square', total, 'Messages')}${card('zap', today, 'Last 24 hours')}${card('layers', this.rooms.size, 'Chats')}${card('trash-2', deleted, 'Deleted')}${card('flag', reportsOpen, 'Open reports', reportsOpen ? 'warn' : '')}</div>
      <div class="chat-mon-sec"><h3><i data-lucide="search"></i> Search every chat</h3><div class="chat-search"><i data-lucide="search"></i><input id="mon-q" placeholder="Search message text across all chats" /></div><div class="chat-search-res" id="mon-res"></div></div>
      <div class="chat-mon-sec"><h3><i data-lucide="flag"></i> Reported messages</h3>${(reps || []).length ? (reps || []).map(rp => { const m = repMsgs[rp.message_id]; return `<div class="chat-report" data-rp="${rp.id}"><div><b>${this.esc(this.nameOf(rp.reported_by))}</b> reported <b>${this.esc(m ? this.nameOf(m.sender_id) : 'a message')}</b> <small>${this.esc(new Date(rp.created_at).toLocaleString('en-IN'))}</small><p>“${this.esc(m ? (m.body || m.attachment_name || m.kind) : 'message removed')}”</p><em>Reason: ${this.esc(rp.reason || '')}</em></div><div class="chat-report-btns">${m ? `<button type="button" class="btn btn-outline btn-sm" data-mon="view" data-id="${m.id}" data-room="${m.room_id}">View</button><button type="button" class="btn btn-danger btn-sm" data-mon="del" data-id="${m.id}" data-rp="${rp.id}">Delete message</button>` : ''}<button type="button" class="btn btn-outline btn-sm" data-mon="dismiss" data-rp="${rp.id}">Dismiss</button></div></div>`; }).join('') : '<p class="chat-hint">No open reports.</p>'}</div>
      <div class="chat-mon-sec"><h3><i data-lucide="users"></i> Admin activity &amp; chat access</h3><div class="chat-table-wrap"><table class="chat-table"><thead><tr><th>Admin</th><th>Messages</th><th>7 days</th><th>Last message</th><th>Chat access</th></tr></thead><tbody>${admins.map(a => { const p = this.profiles[a.id] || {}, st = agg[a.id] || { n: 0, w: 0 }, muted = p.muted_until && new Date(p.muted_until) > new Date(); return `<tr><td><span class="chat-av sm" style="background:${this.colorFor(a.id)}">${this.esc(this.initial(a.full_name))}</span> ${this.esc(a.full_name)}${this.online.has(a.id) ? ' <i class="chat-dot inline"></i>' : ''}</td><td>${st.n}</td><td>${st.w}</td><td>${st.last ? this.esc(this.shortTime(st.last)) : '—'}</td><td class="act">${p.chat_blocked ? '<em class="bad">Blocked</em>' : muted ? '<em class="warn">Muted</em>' : '<em class="ok">Active</em>'}${a.id !== this.me.id ? `<button type="button" class="btn btn-outline btn-sm" data-mon="mute" data-id="${a.id}">${muted ? 'Unmute' : 'Mute 24h'}</button><button type="button" class="btn btn-outline btn-sm" data-mon="block" data-id="${a.id}">${p.chat_blocked ? 'Unblock' : 'Block'}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="chat-mon-sec"><h3><i data-lucide="layers"></i> Recent chats</h3>${rooms.map(r => `<button type="button" class="chat-room" data-mon="open" data-id="${r.id}"><span class="chat-av" style="background:${this.roomColor(r)}">${r.kind === 'direct' ? this.esc(this.initial(this.roomName(r))) : '<i data-lucide="users"></i>'}</span><div class="chat-room-body"><div class="chat-room-row"><b>${this.esc(this.roomName(r))}${r.kind === 'direct' ? ' <small>(direct: ' + this.esc((this.members[r.id] || []).map(m => this.nameOf(m.admin_id)).join(' & ')) + ')</small>' : ''}</b><time>${this.esc(this.shortTime(r.last_message_at))}</time></div><div class="chat-room-row"><small>${this.esc(r.last_message_preview || '').slice(0, 80)}</small></div></div></button>`).join('') || '<p class="chat-hint">No chats yet.</p>'}</div>`;
    lucide.createIcons();
    let st; body.querySelector('#mon-q').oninput = (e) => { clearTimeout(st); st = setTimeout(() => this.monSearch(e.target.value), 300); };
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-mon]'); if (!b) return; const k = b.dataset.mon, id = b.dataset.id;
      try {
        if (k === 'open' || k === 'view') { await this.openRoom(b.dataset.room || id); if (k === 'view') await this.jumpTo(id); }
        else if (k === 'dismiss') { await this.db.from('chat_reports').update({ status: 'dismissed', resolved_by: this.me.id, resolved_at: new Date().toISOString() }).eq('id', b.dataset.rp); this.renderMonitorHome(); }
        else if (k === 'del') {
          await this.db.from('chat_messages').update({ deleted_at: new Date().toISOString(), deleted_by: this.me.id }).eq('id', id);
          await this.db.from('chat_reports').update({ status: 'resolved', resolved_by: this.me.id, resolved_at: new Date().toISOString() }).eq('id', b.dataset.rp);
          try { await this.d.auth.logActivity(this.me.id, 'CHAT_MODERATE_DELETE', 'chat_messages', id, { via: 'report' }); } catch (er) { /* silent */ }
          this.toast('Message deleted', 'success'); this.renderMonitorHome();
        }
        else if (k === 'mute' || k === 'block') {
          const p = this.profiles[id] || { admin_id: id }; const vals = {};
          if (k === 'mute') vals.muted_until = (p.muted_until && new Date(p.muted_until) > new Date()) ? null : new Date(Date.now() + 864e5).toISOString();
          else vals.chat_blocked = !p.chat_blocked;
          const u = await this.db.from('chat_profiles').update(vals).eq('admin_id', id).select('admin_id');
          if (!u.data || !u.data.length) await this.db.from('chat_profiles').insert(Object.assign({ admin_id: id }, vals));
          this.profiles[id] = Object.assign({}, p, vals, { admin_id: id });
          try { await this.d.auth.logActivity(this.me.id, 'CHAT_ACCESS', 'chat_profiles', id, vals); } catch (er) { /* silent */ }
          this.renderMonitorHome();
        }
      } catch (err) { this.toast('Action failed: ' + (err.message || err), 'error'); }
    });
  },

  async monSearch(q) {
    q = q.trim(); const box = document.getElementById('mon-res'); if (!box) return;
    if (q.length < 2) { box.innerHTML = ''; return; }
    const { data } = await this.db.from('chat_messages').select('*').ilike('body', '%' + q + '%').order('created_at', { ascending: false }).limit(40);
    box.innerHTML = (data || []).map(m => { const r = this.rooms.get(m.room_id); return `<button type="button" data-mon="view" data-id="${m.id}" data-room="${m.room_id}"><b>${this.esc(this.nameOf(m.sender_id))} · ${this.esc(r ? this.roomName(r) : 'chat')}</b><time>${this.esc(this.shortTime(m.created_at))}</time><span>${m.deleted_at ? '[deleted] ' : ''}${this.esc(m.body).slice(0, 120)}</span></button>`; }).join('') || '<p class="chat-hint">No matches</p>';
  }
});

/* extra wiring: info-panel select, paste / drag-drop, popups need their own click handler (they live on <body>) */
(function () {
  const baseChange = AdminChat.prototype.onChange;
  AdminChat.prototype.onChange = async function (e) {
    if (e.target.id === 'info-dis') {
      const r = this.rooms.get(this.cur); if (!r) return;
      r.disappear_after = +e.target.value; await this.db.from('chat_rooms').update({ disappear_after: r.disappear_after }).eq('id', r.id);
      await this.sendSystem(r.id, r.disappear_after ? 'Disappearing messages turned on' : 'Disappearing messages turned off'); this.renderInfo(); this.renderHeader(); return;
    }
    return baseChange.call(this, e);
  };
  const basePop = AdminChat.prototype.popAt;
  AdminChat.prototype.popAt = function (el, html, cls) { const p = basePop.call(this, el, html, cls); p.addEventListener('click', (ev) => this.onClick(ev)); return p; };
  const baseBind = AdminChat.prototype.bind;
  AdminChat.prototype.bind = function () {
    baseBind.call(this);
    const app = document.getElementById('chat-app');
    app.addEventListener('paste', (e) => this.onPaste(e));
    app.addEventListener('dragover', (e) => e.preventDefault());
    app.addEventListener('drop', (e) => this.onDrop(e));
  };
})();

window.AdminChat = AdminChat;

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
let adminDashboard;

document.addEventListener('DOMContentLoaded', () => {
  const appEl = document.getElementById('admin-app');
  if (!appEl) return;
  try {
    adminDashboard = new AdminDashboard();
    window.adminDashboard = adminDashboard;
  } catch (e) {
    console.error('AdminDashboard init failed:', e);
    const s = document.getElementById('loading-screen');
    if (s) s.classList.add('hidden');
  }
});

/* tell the admin how much an uploaded image was shrunk (limit: 150 KB) */
window.addEventListener('image-compressed', (e) => {
  try {
    const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
    if (window.adminDashboard && adminDashboard.showToast) adminDashboard.showToast(`Image optimised: ${kb(e.detail.before)} → ${kb(e.detail.after)}`, 'success');
  } catch (err) { /* silent */ }
});

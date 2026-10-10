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
              ${ROLE_DISPLAY_NAMES[this.admin.role] || this.admin.role}
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
                <span id="topbar-admin-role">${ROLE_DISPLAY_NAMES[this.admin.role] || this.admin.role}</span>
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
    return arr.includes(this.admin.role);
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
          { key: 'mail_signature', label: 'Signature line', type: 'textarea', hint: 'Added at the end of each mail' },
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

      advanced: { icon: 'sliders-horizontal', label: 'Advanced', sections: [
        { icon: 'database-backup', title: 'Backup & restore', desc: 'Move settings between sites or keep a copy', fields: [ { type: 'backup' } ] } ] }
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

  _switchSettingsTab(tab, btn) {
    this._settingsTab = tab;
    document.querySelectorAll('.admin-settings-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const el = document.getElementById('settings-tab-content');
    if (el) { el.innerHTML = this._renderSettingsTab(tab, this._settingsCache || []); lucide.createIcons(); }
  }

  _renderSettingsTab(tab, settings) {
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
        <div class="set-control is-end"><button class="btn btn-outline" onclick="adminDashboard._sendTestMail()"><i data-lucide="send"></i><span>Send test</span></button></div></div>`;
      if (f.type === 'backup') return `<div class="set-row"><div class="set-meta"><label>Export settings</label><p class="set-hint">Downloads every setting as a JSON file.</p></div>
        <div class="set-control is-end"><button class="btn btn-outline" onclick="adminDashboard._exportSettings()"><i data-lucide="download"></i><span>Export</span></button></div></div>
        <div class="set-row"><div class="set-meta"><label>Import settings</label><p class="set-hint">Applies values from a JSON file exported here. Existing values with the same key are replaced.</p></div>
        <div class="set-control is-end"><label class="btn btn-outline" style="cursor:pointer;"><i data-lucide="upload"></i><span>Choose file</span><input type="file" accept="application/json" hidden onchange="adminDashboard._importSettings(this)" /></label></div></div>`;
      return '';
    };
    return `<div class="set-grid">${def.sections.map(sec => `
      <section class="set-section neu-card">
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

  async _saveSetting(key, value) {
    const v = String(value ?? '').trim();
    if (/(_email)$/.test(key) && key !== 'mail_extra_recipients' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      this.showToast('That does not look like a valid e-mail address', 'error'); return false;
    }
    try {
      /* upsert: a brand-new key must be created, not silently ignored */
      const { error } = await this.db.from('club_settings').upsert(
        { key, value: v, updated_by: this.admin.id, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      this._settingsCache = this._settingsCache || [];
      const row = this._settingsCache.find(s => s.key === key);
      if (row) row.value = v; else this._settingsCache.push({ key, value: v });
      if (window.emailService?._settings) window.emailService._settings[key] = v;
      this.showToast('Saved', 'success', 1600);
      return true;
    } catch (e) {
      console.error('save setting:', e);
      this.showToast('Failed to save setting', 'error');
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
      const { error } = await this.db.from('club_settings').upsert(
        entries.map(([key, value]) => ({ key, value: String(value ?? ''), updated_by: this.admin.id, updated_at: new Date().toISOString() })),
        { onConflict: 'key' });
      if (error) throw error;
      this.showToast(`Imported ${entries.length} settings`, 'success');
      this._renderSettings(document.getElementById('admin-content') || document.querySelector('.admin-content'));
    } catch (e) { console.error(e); this.showToast('Import failed — is it a valid settings file?', 'error'); }
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
    const { data: admins } = await this.db.from('admin_users')
      .select('id,email,full_name,role,is_active,avenue,last_login,login_attempts')
      .order('role').order('full_name');

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title"><i data-lucide="shield-check"></i> Admin Users</h1>
          <p class="admin-section-subtitle">${admins?.length||0} admin accounts</p>
        </div>
        <button class="btn btn-primary" onclick="adminDashboard._showCreateAdmin()">
          <i data-lucide="user-plus"></i><span>Add Admin</span>
        </button>
      </div>
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>Admin User</th><th>Role</th><th>Avenue</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${(admins||[]).map(a => `
                <tr>
                  <td>
                    <div class="admin-table-user">
                      <div class="admin-table-user-avatar"><i data-lucide="user-circle-2"></i></div>
                      <div>
                        <div style="font-weight:600;color:var(--text-heading);">
                          ${this._safe(a.full_name)}
                          ${a.id===this.admin.id
                            ? '<span style="font-size:.62rem;padding:2px 6px;border-radius:4px;background:var(--accent-light);color:var(--accent);margin-left:6px;">You</span>'
                            : ''}
                        </div>
                        <div style="font-size:.75rem;color:var(--text-muted);">${this._safe(a.email)}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style="font-size:.8rem;font-weight:600;color:var(--accent);">${ROLE_DISPLAY_NAMES[a.role]||a.role}</span></td>
                  <td>${a.avenue?`<span style="font-size:.78rem;">${AVENUES[a.avenue]?.label||a.avenue}</span>`:'<span style="color:var(--text-muted);font-size:.78rem;">All Access</span>'}</td>
                  <td>
                    <span class="admin-status-badge"
                          style="background:${a.is_active?'var(--success-light)':'var(--danger-light)'};
                                 color:${a.is_active?'var(--success)':'var(--danger)'};">
                      ${a.is_active?'Active':'Inactive'}
                    </span>
                    ${(a.login_attempts||0)>=3
                      ? `<span class="admin-status-badge"
                               style="background:var(--warning-light);color:var(--warning);margin-left:4px;">
                           ${a.login_attempts} failed
                         </span>` : ''}
                  </td>
                  <td style="font-size:.78rem;color:var(--text-muted);">
                    ${a.last_login ? this.getTimeAgo(a.last_login) : 'Never'}
                  </td>
                  <td>
                    <div class="admin-table-actions">
                      <button class="admin-action-btn" title="Set Password"
                              onclick="adminDashboard._setAdminPassword('${this._safe(a.id)}','${this._safe(a.full_name)}')">
                        <i data-lucide="key"></i>
                      </button>
                      ${a.id !== this.admin.id ? `
                      <button class="admin-action-btn ${a.is_active?'admin-action-danger':'admin-action-success'}"
                              title="${a.is_active?'Deactivate':'Activate'}"
                              onclick="adminDashboard._toggleAdminStatus('${this._safe(a.id)}',${a.is_active})">
                        <i data-lucide="${a.is_active?'user-x':'user-check'}"></i>
                      </button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')
              || '<tr><td colspan="6" class="admin-table-empty">No admin users found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    lucide.createIcons();
  }

  _showCreateAdmin() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'create-admin-modal';
    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:520px;">
        <div class="modal-header">
          <h2 class="modal-title"><i data-lucide="user-plus"></i> Add Admin User</h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('create-admin-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="create-admin-form">
            <div class="form-group"><label class="form-label">Full Name *</label>
              <div class="input-wrap neu-inset">
                <input type="text" name="full_name" class="form-input" placeholder="Full name" required />
              </div></div>
            <div class="form-group"><label class="form-label">Email *</label>
              <div class="input-wrap neu-inset">
                <input type="email" name="email" class="form-input" placeholder="Email address" required />
              </div></div>
            <div class="form-group"><label class="form-label">Password * (min 8 characters)</label>
              <div class="input-wrap neu-inset">
                <input type="password" name="password" class="form-input" placeholder="••••••••" required minlength="8" />
              </div></div>
            <div class="form-group"><label class="form-label">Role *</label>
              <div class="select-wrap neu-inset">
                <select name="role" class="form-select" required
                        onchange="adminDashboard._onAdminRoleChange(this.value)">
                  <option value="">Select Role</option>
                  ${Object.entries(ROLE_DISPLAY_NAMES)
                    .filter(([k]) => k !== 'member')
                    .map(([k,v]) => `<option value="${k}">${v}</option>`)
                    .join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div></div>
            <div class="form-group" id="create-admin-avenue-wrap" style="display:none;">
              <label class="form-label">Avenue</label>
              <div class="select-wrap neu-inset">
                <select name="avenue" class="form-select">
                  <option value="">Select Avenue</option>
                  ${Object.entries(AVENUES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div></div>
            <div class="form-message" id="create-admin-msg"></div>
            <div class="admin-form-actions" style="margin-top:16px;padding:0;">
              <button type="button" class="btn btn-outline"
                      onclick="document.getElementById('create-admin-modal').remove();document.body.style.overflow='';">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                <i data-lucide="user-plus"></i><span>Create Admin</span>
              </button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById('create-admin-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd     = new FormData(e.target);
      const data   = Object.fromEntries(fd.entries());
      const msgEl  = document.getElementById('create-admin-msg');
      const result = await this.auth.createAdminUser(data);
      if (result.success) {
        this.showToast('Admin user created!', 'success');
        modal.remove();
        document.body.style.overflow = '';
        await this._renderAdminUsers(document.getElementById('admin-content'));
      } else {
        if (msgEl) { msgEl.textContent = result.message || 'Failed'; msgEl.className = 'form-message error'; }
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });
    lucide.createIcons();
  }

  _onAdminRoleChange(role) {
    const avenueRoles = [
      'avenue_director_club_service','avenue_director_community_service',
      'avenue_director_professional_service','avenue_director_international_service',
      'district_priority_chair'
    ];
    const wrap = document.getElementById('create-admin-avenue-wrap');
    if (wrap) wrap.style.display = avenueRoles.includes(role) ? 'block' : 'none';
  }

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
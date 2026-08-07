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
               style="width:14px;height:14px;margin-left:auto;transition:var(--transition);"></i>
          </button>
          <div class="admin-nav-children" id="nav-children-${item.id}" style="display:none;">
            ${accessible.map(child => `
              <button class="admin-sidebar-item admin-sidebar-child"
                      data-section="${child.id}"
                      onclick="adminDashboard.navigateTo('${child.id}')">
                <i data-lucide="${child.icon}" class="admin-sidebar-icon"
                   style="width:15px;height:15px;margin-left:8px;"></i>
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
    children.style.display = isOpen ? 'none' : 'block';
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
        .gte('event_date', new Date().toISOString().split('T')[0])
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
      .select('id,title,month,pdf_url,cover_image_url,description,is_published,published_at,created_at,created_by')
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

  /* ── Render one newsletter card (NO inline JSON, NO <script> tags) ── */
  _renderNlCard(nl) {
    const url     = nl.pdf_url         || '';
    const cover   = nl.cover_image_url || '';
    const title   = nl.title           || 'Bulletin';
    const month   = nl.month           || '';
    const desc    = nl.description     || '';
    const pubAt   = nl.published_at    || nl.created_at || '';
    const nlId    = String(nl.id);

    let dateStr = '';
    if (pubAt) {
      try {
        dateStr = new Date(pubAt).toLocaleDateString('en-IN', {
          year:'numeric', month:'short', day:'numeric'
        });
      } catch (e) { dateStr = pubAt; }
    }

    /* Escape for HTML attribute usage */
    const esc = (s) => String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');

    return `
      <div class="admin-nl-card neu-card">

        <!-- Cover image -->
        <div class="admin-nl-cover">
          ${cover
            ? `<img src="${esc(cover)}" alt="${esc(title)}" class="admin-nl-cover-img"
                    onerror="this.parentElement.innerHTML='<div class=&quot;admin-nl-cover-placeholder&quot;><i data-lucide=&quot;newspaper&quot;></i></div>';lucide.createIcons();" />`
            : `<div class="admin-nl-cover-placeholder">
                 <i data-lucide="newspaper"></i>
                 <span style="font-size:.72rem;color:var(--text-muted);font-family:Poppins,sans-serif;">No Cover</span>
               </div>`}

          <!-- Published toggle overlay -->
          <div class="admin-nl-status-overlay">
            <label class="admin-toggle" title="${nl.is_published ? 'Click to unpublish' : 'Click to publish'}">
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
          ${month   ? `<div class="admin-nl-meta"><i data-lucide="calendar" style="width:12px;height:12px;flex-shrink:0;"></i>${esc(month)}</div>` : ''}
          ${dateStr ? `<div class="admin-nl-meta"><i data-lucide="clock"    style="width:12px;height:12px;flex-shrink:0;"></i>${dateStr}</div>` : ''}
          ${desc    ? `<div class="admin-nl-desc">${esc(desc)}</div>` : ''}
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
    if (!nl || !nl.pdf_url) { this.showToast('No link available to preview', 'warning'); return; }
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
      .select('id,title,month,pdf_url,cover_image_url,description,is_published,published_at,created_at')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { this.showToast('Could not load bulletin for editing', 'error'); return; }
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
                    background:transparent;color:var(--primary,#1e3a8a);
                    border:2px solid var(--primary,#1e3a8a);text-decoration:none;white-space:nowrap;">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>Open
          </a>
          <button onclick="document.getElementById('admin-nl-preview-modal').remove()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-secondary);
                         width:32px;height:32px;border-radius:8px;display:flex;
                         align-items:center;justify-content:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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

    /* Remove any existing modal */
    document.getElementById('nl-form-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'nl-form-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;';

    const coverHtml = existing && existing.cover_image_url
      ? `<div style="margin-bottom:10px;">
           <img src="${this._safe(existing.cover_image_url)}" alt="Current cover"
                style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;display:block;" />
           <p style="font-size:.72rem;color:var(--text-muted);margin:4px 0 0;font-family:Poppins,sans-serif;">
             Current cover — upload a new one to replace
           </p>
         </div>`
      : '';

    modal.innerHTML = `
      <div class="neu-card" style="width:100%;max-width:580px;max-height:92vh;
                                   display:flex;flex-direction:column;border-radius:18px;overflow:hidden;">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:10px;padding:16px 20px;
                    border-bottom:1px solid var(--border-color);flex-shrink:0;">
          <h2 style="flex:1;font-size:1rem;font-weight:800;color:var(--text-heading);
                     margin:0;display:flex;align-items:center;gap:8px;font-family:Poppins,sans-serif;">
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
        <div style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;">

          <!-- COVER IMAGE -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="image" style="width:14px;height:14px;"></i> Cover Image
            </label>
            ${coverHtml}
            <div class="file-upload-wrap neu-inset" style="cursor:pointer;"
                 onclick="document.getElementById('nl-cover-input').click()">
              <input type="file" id="nl-cover-input" name="cover_image"
                     accept="image/jpeg,image/png,image/webp,image/gif"
                     style="display:none;" onchange="adminDashboard._onNlCoverChange(this)" />
              <div class="file-upload-ui">
                <i data-lucide="upload-cloud" style="width:22px;height:22px;color:var(--text-muted);"></i>
                <span id="nl-cover-label"
                      style="font-size:.8rem;color:var(--text-muted);font-family:Poppins,sans-serif;">
                  Click to upload cover image (JPG / PNG / WebP — Max 5 MB)
                </span>
              </div>
            </div>
            <div id="nl-cover-preview" style="display:none;margin-top:10px;">
              <img id="nl-cover-preview-img" src="" alt="Preview"
                   style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;display:block;" />
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
              <i data-lucide="type" style="width:14px;height:14px;"></i> Title *
            </label>
            <div class="input-wrap neu-inset">
              <input type="text" id="nl-title" class="form-input"
                     placeholder="e.g. Rotaract Bulletin — June 2025"
                     value="${this._safe(existing?.title || '')}" required />
            </div>
          </div>

          <!-- MONTH -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="calendar" style="width:14px;height:14px;"></i> Month / Period
            </label>
            <div class="input-wrap neu-inset">
              <input type="text" id="nl-month" class="form-input"
                     placeholder="e.g. June 2025"
                     value="${this._safe(existing?.month || '')}" />
            </div>
          </div>

          <!-- BULLETIN LINK -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="link" style="width:14px;height:14px;"></i> Bulletin Link
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
              <i data-lucide="file-text" style="width:14px;height:14px;"></i> Description
            </label>
            <div class="input-wrap neu-inset">
              <textarea id="nl-desc" class="form-textarea" rows="3"
                        placeholder="Brief description of this bulletin...">${this._safe(existing?.description || '')}</textarea>
            </div>
          </div>

          <!-- PUBLISH DATE -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="calendar-check" style="width:14px;height:14px;"></i> Publish Date
            </label>
            <div class="input-wrap neu-inset">
              <input type="date" id="nl-pubdate" class="form-input"
                     value="${existing?.published_at
                               ? existing.published_at.split('T')[0]
                               : new Date().toISOString().split('T')[0]}" />
            </div>
          </div>

          <!-- VISIBILITY -->
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="globe" style="width:14px;height:14px;"></i> Visibility
            </label>
            <div class="admin-toggle-wrap">
              <label class="admin-toggle">
                <input type="checkbox" id="nl-published"
                       ${(existing?.is_published ?? true) ? 'checked' : ''} />
                <span class="admin-toggle-slider"></span>
              </label>
              <span id="nl-published-label" style="font-size:.84rem;font-family:Poppins,sans-serif;">
                ${(existing?.is_published ?? true)
                  ? 'Published — visible on website'
                  : 'Draft — hidden from website'}
              </span>
            </div>
          </div>

          <!-- FORM MESSAGE -->
          <div class="form-message" id="nl-form-msg"></div>
        </div>

        <!-- Footer actions -->
        <div style="display:flex;gap:10px;justify-content:flex-end;
                    padding:14px 20px;border-top:1px solid var(--border-color);
                    flex-shrink:0;flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="adminDashboard._closeNlForm()">Cancel</button>
          ${isEdit && existing?.pdf_url ? `
          <button class="btn btn-outline"
                  onclick="adminDashboard._previewNewsletter('${this._safe(existing.title||'').replace(/'/g,"\\'")}','${this._safe(existing.pdf_url||'').replace(/'/g,"\\'")}')">
            <i data-lucide="eye"></i><span>Preview</span>
          </button>` : ''}
          <button class="btn btn-primary" id="nl-save-btn"
                  onclick="adminDashboard._saveNl('${isEdit ? this._safe(existing.id) : ''}','${isEdit ? this._safe(existing.cover_image_url||'') : ''}')">
            <i data-lucide="${isEdit ? 'save' : 'plus-circle'}"></i>
            <span>${isEdit ? 'Save Changes' : 'Add Bulletin'}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    lucide.createIcons();

    /* Toggle label */
    const pubToggle = document.getElementById('nl-published');
    const pubLabel  = document.getElementById('nl-published-label');
    if (pubToggle && pubLabel) {
      pubToggle.addEventListener('change', () => {
        pubLabel.textContent = pubToggle.checked
          ? 'Published — visible on website'
          : 'Draft — hidden from website';
      });
    }

    /* Close on overlay click */
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this._closeNlForm();
    });
  }

  _closeNlForm() {
    document.getElementById('nl-form-modal')?.remove();
    document.body.style.overflow = 'hidden';
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
      if (img)     img.src = e.target.result;
      if (preview) preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  /* ── Clear cover ── */
  _clearNlCover() {
    const input   = document.getElementById('nl-cover-input');
    const label   = document.getElementById('nl-cover-label');
    const preview = document.getElementById('nl-cover-preview');
    if (input)   input.value = '';
    if (label)   label.textContent = 'Click to upload cover image (JPG / PNG / WebP — Max 5 MB)';
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

      const ext      = file.type === 'image/png' ? 'png'
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

  /* ── Save newsletter (called from button onclick with id string) ── */
  async _saveNl(existingId, existingCoverUrl) {
    const btn   = document.getElementById('nl-save-btn');
    const msgEl = document.getElementById('nl-form-msg');

    const showMsg = (msg, type) => {
      if (msgEl) { msgEl.textContent = msg; msgEl.className = `form-message ${type}`; }
    };

    /* Read form values via IDs (safe — no FormData needed) */
    const title       = (document.getElementById('nl-title')?.value    || '').trim();
    const month       = (document.getElementById('nl-month')?.value    || '').trim() || null;
    const pdfUrl      = (document.getElementById('nl-url')?.value      || '').trim() || null;
    const description = (document.getElementById('nl-desc')?.value     || '').trim() || null;
    const publishedAt = document.getElementById('nl-pubdate')?.value   || new Date().toISOString().split('T')[0];
    const isPublished = document.getElementById('nl-published')?.checked ?? true;
    const coverFile   = document.getElementById('nl-cover-input')?.files?.[0] || null;

    /* Validate */
    if (!title) { showMsg('Title is required', 'error'); return; }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2"></i><span>Saving…</span>';
      lucide.createIcons();
    }

    try {
      /* Upload cover if new file selected */
      let coverImageUrl = existingCoverUrl || null;
      if (coverFile) {
        showMsg('Uploading cover image…', 'info');
        const uploaded = await this._uploadNlCover(coverFile);
        if (uploaded) coverImageUrl = uploaded;
      }

      const payload = {
        title,
        month,
        pdf_url:         pdfUrl,
        cover_image_url: coverImageUrl,
        description,
        published_at:    publishedAt,
        is_published:    isPublished,
        created_by:      this.admin.id,
        updated_at:      new Date().toISOString()
      };

      let dbError;
      const isEdit = !!(existingId && existingId.trim());

      if (isEdit) {
        const { error } = await this.db
          .from('newsletters').update(payload).eq('id', existingId.trim());
        dbError = error;
      } else {
        const { error } = await this.db
          .from('newsletters').insert({ ...payload, created_at: new Date().toISOString() });
        dbError = error;
      }

      if (dbError) throw dbError;

      this.showToast(`Bulletin ${isEdit ? 'updated' : 'added'} successfully!`, 'success');
      this._closeNlForm();

      /* Refresh list */
      await this._renderNewsletters(document.getElementById('admin-content'));

    } catch (err) {
      console.error('Save newsletter error:', err);
      showMsg(`Failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        const isEdit = !!(existingId && existingId.trim());
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
  async _renderSettings(container) {
    if (!this.auth.can('MANAGE_SETTINGS')) {
      container.innerHTML = this._accessDenied();
      lucide.createIcons();
      return;
    }
    const { data: settings } = await this.db.from('club_settings').select('*').order('key');
    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title"><i data-lucide="settings"></i> Site Settings</h1>
          <p class="admin-section-subtitle">Changes apply immediately</p>
        </div>
      </div>
      <div class="admin-settings-tabs">
        ${['general','logos','reports','emails','social','stats'].map((tab, i) => `
          <button class="admin-settings-tab ${i === 0 ? 'active' : ''}"
                  onclick="adminDashboard._switchSettingsTab('${tab}', this)">
            ${tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>`).join('')}
      </div>
      <div id="settings-tab-content">
        ${this._renderSettingsTab('general', settings || [])}
      </div>`;
    lucide.createIcons();
  }

  _switchSettingsTab(tab, btn) {
    document.querySelectorAll('.admin-settings-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.db.from('club_settings').select('*').then(({ data }) => {
      const el = document.getElementById('settings-tab-content');
      if (el) { el.innerHTML = this._renderSettingsTab(tab, data || []); lucide.createIcons(); }
    });
  }

  _renderSettingsTab(tab, settings) {
    const get = (key) => settings.find(s => s.key === key)?.value || '';
    const groups = {
      general:[
        { key:'club_name',           label:'Club Name',               type:'text' },
        { key:'parent_club',         label:'Parent Club',             type:'text' },
        { key:'club_id',             label:'Club ID',                 type:'text' },
        { key:'charter_date',        label:'Charter Date',            type:'text' },
        { key:'district',            label:'RI District',             type:'text' },
        { key:'district_region',     label:'District Region',         type:'text' },
        { key:'current_rotary_year', label:'Current Rotary Year',     type:'text' },
        { key:'current_group',       label:'Current Group Number',    type:'select', options:['1','2','3','4','5','6'] },
        { key:'hero_tagline',        label:'Hero Tagline',            type:'text' },
        { key:'hero_subtitle',       label:'Hero Subtitle',           type:'text' },
        { key:'footer_vision',       label:'Footer Vision Statement', type:'textarea' },
        { key:'map_embed_url',       label:'Google Maps Embed URL',   type:'textarea' }
      ],
      logos:[
        { key:'logo_colour_url',          label:'Colour Logo URL',           type:'text' },
        { key:'logo_white_url',           label:'White Logo URL',            type:'text' },
        { key:'logo_black_url',           label:'Black Logo URL',            type:'text' },
        { key:'report_logo_strip_url',    label:'Report Logo Strip URL',     type:'text' },
        { key:'report_logo_strip_height', label:'Report Strip Height (in)',  type:'text' },
        { key:'report_logo_strip_width',  label:'Report Strip Width (in)',   type:'text' },
        { key:'dpp_logo_strip_url',       label:'DPP Logo Strip URL',        type:'text' },
        { key:'dpp_logo_strip_height',    label:'DPP Strip Height (in)',     type:'text' },
        { key:'dpp_logo_strip_width',     label:'DPP Strip Width (in)',      type:'text' }
      ],
      reports:[
        { key:'report_logo_strip_url',    label:'Report Header Logo URL',    type:'text' },
        { key:'report_logo_strip_height', label:'Report Logo Height (in)',   type:'text' },
        { key:'report_logo_strip_width',  label:'Report Logo Width (in)',    type:'text' }
      ],
      emails:[
        { key:'emailjs_service_id',              label:'EmailJS Service ID',        type:'text' },
        { key:'emailjs_template_id',             label:'EmailJS Template ID',       type:'text' },
        { key:'emailjs_public_key',              label:'EmailJS Public Key',        type:'text' },
        { key:'birthday_email_enabled',          label:'Birthday Email Automation', type:'toggle' },
        { key:'monthly_statement_email_enabled', label:'Monthly Statement Email',   type:'toggle' },
        { key:'whatsapp_blood_request_number1',  label:'WhatsApp Alert Number 1',   type:'text' },
        { key:'whatsapp_blood_request_number2',  label:'WhatsApp Alert Number 2',   type:'text' }
      ],
      social:[
        { key:'club_email',          label:'Club Email',     type:'email' },
        { key:'social_media_handle', label:'Social Handle',  type:'text' },
        { key:'address_line1',       label:'Address Line 1', type:'text' },
        { key:'address_line2',       label:'Address Line 2', type:'text' },
        { key:'address_line3',       label:'Address Line 3', type:'text' },
        { key:'address_line4',       label:'Address Line 4', type:'text' }
      ],
      stats:[
        { key:'stats_projects_completed', label:'Projects Completed (override)', type:'number' },
        { key:'stats_members',            label:'Members Count (override)',       type:'number' },
        { key:'stats_service_hours',      label:'Service Hours (override)',       type:'number' },
        { key:'stats_lives_impacted',     label:'Lives Impacted (override)',      type:'number' }
      ]
    };
    const fields = groups[tab] || groups.general;
    return `
      <div class="admin-card neu-card">
        <div style="padding:24px;">
          <div class="admin-form-grid">
            ${fields.map(f => {
              const val = get(f.key);
              const full = f.type === 'textarea' || f.type === 'toggle' ? 'admin-form-full' : '';
              return `
                <div class="form-group ${full}">
                  <label class="form-label">${this._safe(f.label)}</label>
                  ${f.type === 'textarea'
                    ? `<div class="input-wrap neu-inset"><textarea class="form-textarea" rows="3"
                         onchange="adminDashboard._saveSetting('${f.key}',this.value)">${this._safe(val)}</textarea></div>`
                  : f.type === 'toggle'
                    ? `<div class="admin-toggle-wrap">
                         <label class="admin-toggle">
                           <input type="checkbox" ${val==='true'?'checked':''}
                                  onchange="adminDashboard._saveSetting('${f.key}',this.checked?'true':'false')" />
                           <span class="admin-toggle-slider"></span>
                         </label>
                         <span>${this._safe(f.label)}</span>
                       </div>`
                  : f.type === 'select'
                    ? `<div class="select-wrap neu-inset">
                         <select class="form-select"
                                 onchange="adminDashboard._saveSetting('${f.key}',this.value)">
                           ${(f.options||[]).map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}
                         </select>
                         <i data-lucide="chevron-down" class="select-arrow"></i>
                       </div>`
                    : `<div class="input-wrap neu-inset">
                         <input type="${f.type}" class="form-input"
                                value="${this._safe(val)}"
                                onchange="adminDashboard._saveSetting('${f.key}',this.value)" />
                       </div>`}
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  }

  async _saveSetting(key, value) {
    try {
      await this.db.from('club_settings')
        .update({ value, updated_by: this.admin.id, updated_at: new Date().toISOString() })
        .eq('key', key);
      this.showToast(`Setting updated`, 'success', 2000);
    } catch (e) { this.showToast('Failed to update setting', 'error'); }
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
        document.body.style.overflow = 'hidden';
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
      const today = new Date().toISOString().split('T')[0];
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
    document.body.style.overflow = 'hidden';
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
const adminCSS = `
  body { overflow:hidden; }
  #admin-app { display:flex; height:100vh; overflow:hidden; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SIDEBAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-sidebar {
    width:260px; height:100vh;
    background:var(--bg-card);
    box-shadow:var(--neu-shadow);
    display:flex; flex-direction:column;
    flex-shrink:0; overflow:hidden; z-index:200;
    transition:width .3s cubic-bezier(.4,0,.2,1);
    position:relative;
  }
  .admin-sidebar.collapsed { width:68px; }
  .admin-sidebar.collapsed .admin-nav-label,
  .admin-sidebar.collapsed .admin-sidebar-brand,
  .admin-sidebar.collapsed .admin-user-info-text,
  .admin-sidebar.collapsed .admin-sidebar-badge,
  .admin-sidebar.collapsed .admin-nav-chevron { display:none; }
  .admin-sidebar.collapsed .admin-user-card    { padding:12px; justify-content:center; }
  .admin-sidebar.collapsed .admin-sidebar-header { justify-content:center; padding:12px; }

  .admin-sidebar-header {
    display:flex; align-items:center;
    justify-content:space-between;
    padding:16px 12px 16px 16px;
    border-bottom:1px solid var(--border-color);
    flex-shrink:0; gap:8px;
  }
  .admin-sidebar-logo     { display:flex; align-items:center; gap:10px; overflow:hidden; min-width:0; }
  .admin-logo-img         { width:36px; height:36px; object-fit:contain; flex-shrink:0; }
  .admin-sidebar-brand    { display:flex; flex-direction:column; overflow:hidden; min-width:0; }
  .admin-brand-name       { font-size:.82rem; font-weight:700; color:var(--text-heading); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .admin-brand-college    { font-size:.68rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .admin-sidebar-toggle   { width:32px; height:32px; flex-shrink:0; }

  .admin-user-card        { margin:12px; padding:12px; display:flex; align-items:center; gap:10px; flex-shrink:0; overflow:hidden; }
  .admin-user-avatar-lg   { width:36px; height:36px; border-radius:var(--border-radius-sm); background:var(--accent-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .admin-user-info-text   { display:flex; flex-direction:column; gap:2px; overflow:hidden; flex:1; min-width:0; }
  .admin-user-name-lg     { font-size:.82rem; font-weight:700; color:var(--text-heading); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .admin-user-role-badge  { font-size:.68rem; color:var(--accent); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .admin-nav              { flex:1; overflow-y:auto; overflow-x:hidden; padding:8px; display:flex; flex-direction:column; gap:2px; }
  .admin-nav::-webkit-scrollbar { width:3px; }
  .admin-nav::-webkit-scrollbar-thumb { background:var(--border-color); border-radius:2px; }

  .admin-nav-group        { display:flex; flex-direction:column; }
  .admin-nav-children     { padding-left:4px; display:flex; flex-direction:column; gap:2px; border-left:2px solid var(--border-color); margin-left:22px; margin-top:2px; }
  .admin-sidebar-child    { font-size:.8rem !important; padding:8px 12px !important; }

  .admin-sidebar-footer   { padding:8px; border-top:1px solid var(--border-color); display:flex; flex-direction:column; gap:2px; flex-shrink:0; }

  .admin-sidebar-item {
    display:flex; align-items:center; gap:10px;
    padding:10px 14px; border-radius:var(--border-radius-sm);
    color:var(--text-secondary); font-size:.84rem; font-weight:500;
    cursor:pointer; transition:var(--transition);
    position:relative; text-decoration:none;
    border:none; background:none; width:100%;
    text-align:left; font-family:'Poppins',sans-serif;
  }
  .admin-sidebar-item:hover  { color:var(--accent); background:var(--accent-light); }
  .admin-sidebar-item.active {
    color:var(--accent); background:var(--accent-light);
    box-shadow:var(--neu-shadow-sm); font-weight:600;
  }
  .admin-sidebar-item.active::before {
    content:''; position:absolute; left:0; top:4px; bottom:4px;
    width:3px; background:var(--accent); border-radius:0 2px 2px 0;
  }
  .admin-sidebar-icon   { width:18px; height:18px; flex-shrink:0; }
  .admin-sidebar-badge  {
    margin-left:auto; min-width:20px; height:20px;
    border-radius:var(--border-radius-full); background:var(--accent);
    color:#fff; font-size:.65rem; font-weight:700;
    display:flex; align-items:center; justify-content:center;
    padding:0 6px; flex-shrink:0;
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ MAIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-main   { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }

  .admin-topbar {
    height:60px; background:var(--bg-card);
    box-shadow:var(--neu-shadow-sm);
    display:flex; align-items:center; justify-content:space-between;
    padding:0 20px; flex-shrink:0; z-index:100; gap:12px;
  }
  .admin-topbar-left  { display:flex; align-items:center; gap:12px; min-width:0; }
  .admin-topbar-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .admin-mobile-sidebar-btn { display:none; }
  .admin-breadcrumb {
    display:flex; align-items:center; gap:8px;
    font-size:.88rem; font-weight:600; color:var(--text-heading);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .admin-notif-badge {
    position:absolute; top:-4px; right:-4px;
    min-width:18px; height:18px;
    border-radius:var(--border-radius-full); background:var(--danger); color:#fff;
    font-size:.6rem; font-weight:700;
    display:flex; align-items:center; justify-content:center;
    padding:0 4px; border:2px solid var(--bg-card);
  }
  .admin-topbar-user      { display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:var(--border-radius-sm); cursor:pointer; transition:var(--transition); }
  .admin-topbar-user:hover { background:var(--accent-light); }
  .admin-topbar-avatar    { width:30px; height:30px; border-radius:50%; background:var(--accent-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .admin-topbar-user-info { display:flex; flex-direction:column; }
  #topbar-admin-name      { font-size:.8rem; font-weight:700; color:var(--text-heading); white-space:nowrap; }
  #topbar-admin-role      { font-size:.66rem; color:var(--accent); font-weight:500; }

  .admin-content { flex:1; overflow-y:auto; padding:24px; background:var(--bg-secondary); }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SECTION HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-section-header   { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
  .admin-section-title    { display:flex; align-items:center; gap:10px; font-size:1.4rem; font-weight:800; color:var(--text-heading); margin-bottom:4px; }
  .admin-section-title svg,.admin-section-title i { width:24px; height:24px; color:var(--accent); }
  .admin-section-subtitle { font-size:.84rem; color:var(--text-muted); }
  .admin-section-actions  { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-card         { background:var(--bg-card); border-radius:var(--border-radius); box-shadow:var(--neu-shadow-sm); overflow:hidden; margin-bottom:20px; }
  .admin-card-header  { padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; gap:12px; }
  .admin-card-header h3 { display:flex; align-items:center; gap:8px; font-size:.95rem; font-weight:700; color:var(--text-heading); }
  .admin-card-header h3 svg,.admin-card-header h3 i { width:18px; height:18px; color:var(--accent); }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ STATS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-stats-grid     { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:16px; margin-bottom:24px; }
  .admin-stat-card      { padding:20px; cursor:pointer; transition:var(--transition); position:relative; overflow:hidden; }
  .admin-stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--accent),transparent); }
  .admin-stat-card:hover { transform:translateY(-3px); box-shadow:var(--neu-shadow); }
  .admin-stat-card.admin-stat-alert::before { background:linear-gradient(90deg,var(--warning),transparent); animation:alertPulse 2s ease-in-out infinite; }
  @keyframes alertPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .admin-stat-card-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
  .admin-stat-icon-wrap   { width:42px; height:42px; border-radius:var(--border-radius-sm); display:flex; align-items:center; justify-content:center; box-shadow:var(--neu-shadow-sm); }
  .admin-stat-alert-dot   { width:10px; height:10px; border-radius:50%; background:var(--warning); animation:alertPulse 1.5s ease-in-out infinite; }
  .admin-stat-value       { font-size:2rem; font-weight:800; color:var(--text-heading); line-height:1; margin-bottom:6px; letter-spacing:-.02em; }
  .admin-stat-label       { font-size:.78rem; color:var(--text-secondary); font-weight:500; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ DASHBOARD GRID ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-dashboard-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:20px; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ QUICK ACTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-quick-actions      { padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; }
  .admin-quick-action-btn   { display:flex; flex-direction:column; align-items:center; gap:8px; padding:16px 20px; border-radius:var(--border-radius-sm); min-width:90px; transition:var(--transition); }
  .admin-quick-action-btn:hover { transform:translateY(-3px); color:var(--accent); }
  .admin-quick-action-icon  { width:44px; height:44px; border-radius:var(--border-radius-sm); background:var(--accent-light); display:flex; align-items:center; justify-content:center; box-shadow:var(--neu-shadow-sm); transition:var(--transition); }
  .admin-quick-action-icon svg,.admin-quick-action-icon i { width:22px; height:22px; color:var(--accent); }
  .admin-quick-action-btn:hover .admin-quick-action-icon  { background:var(--accent); }
  .admin-quick-action-btn:hover .admin-quick-action-icon svg,
  .admin-quick-action-btn:hover .admin-quick-action-icon i { color:#fff; }
  .admin-quick-action-btn > span { font-size:.75rem; font-weight:600; color:var(--text-secondary); }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ LIST ITEMS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-list-item          { display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid var(--border-color); transition:var(--transition); cursor:pointer; }
  .admin-list-item:last-child { border-bottom:none; }
  .admin-list-item:hover    { background:var(--accent-light); }
  .admin-list-icon          { width:36px; height:36px; border-radius:var(--border-radius-sm); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .admin-list-icon svg,.admin-list-icon i { width:18px; height:18px; }
  .admin-list-info          { flex:1; overflow:hidden; }
  .admin-list-title         { font-size:.85rem; font-weight:600; color:var(--text-heading); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .admin-list-meta          { font-size:.72rem; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ACTIVITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-activity-item       { display:flex; align-items:flex-start; gap:10px; padding:10px 20px; border-bottom:1px solid var(--border-color); }
  .admin-activity-item:last-child { border-bottom:none; }
  .admin-activity-icon       { width:28px; height:28px; border-radius:50%; background:var(--accent-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
  .admin-activity-icon svg,.admin-activity-icon i { width:14px; height:14px; color:var(--accent); }
  .admin-activity-info       { flex:1; }
  .admin-activity-title      { font-size:.82rem; font-weight:600; color:var(--text-heading); line-height:1.4; }
  .admin-activity-time       { font-size:.72rem; color:var(--text-muted); margin-top:2px; }
  .admin-birthday-today      { background:var(--success-light) !important; border-left:3px solid var(--success); }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ EMPTY STATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-empty-state { display:flex; flex-direction:column; align-items:center; gap:10px; padding:32px; text-align:center; color:var(--text-muted); }
  .admin-empty-state svg,.admin-empty-state i { width:36px; height:36px; opacity:.4; }
  .admin-empty-state p { font-size:.84rem; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TABLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-table-wrap          { overflow-x:auto; }
  .admin-table               { width:100%; border-collapse:collapse; font-size:.84rem; }
  .admin-table thead         { background:var(--bg-secondary); }
  .admin-table th            { padding:12px 16px; text-align:left; font-size:.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
  .admin-table td            { padding:12px 16px; border-bottom:1px solid var(--border-color); color:var(--text-primary); vertical-align:middle; }
  .admin-table tbody tr:hover { background:var(--accent-light); }
  .admin-table tbody tr:last-child td { border-bottom:none; }
  .admin-table-empty         { text-align:center; padding:40px; color:var(--text-muted); font-size:.85rem; }
  .admin-table-actions       { display:flex; gap:6px; align-items:center; }
  .admin-action-btn          { width:30px; height:30px; border-radius:var(--border-radius-sm); background:var(--bg-secondary); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-secondary); transition:var(--transition-fast); }
  .admin-action-btn:hover    { color:var(--accent); border-color:var(--accent); }
  .admin-action-btn.admin-action-success:hover { color:var(--success); border-color:var(--success); }
  .admin-action-btn.admin-action-danger:hover  { color:var(--danger);  border-color:var(--danger); }
  .admin-action-btn svg,.admin-action-btn i { width:14px; height:14px; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ BADGES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-status-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:var(--border-radius-full); font-size:.7rem; font-weight:700; white-space:nowrap; }
  .admin-avenue-badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:var(--border-radius-full); font-size:.7rem; font-weight:700; }
  .admin-dpp-badge    { display:inline-flex; padding:2px 8px; border-radius:var(--border-radius-full); background:var(--avenue-dpp); color:#fff; font-size:.65rem; font-weight:800; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FORM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-filters-row  { display:flex; gap:12px; flex-wrap:wrap; align-items:center; padding:16px 20px; }
  .admin-form-grid    { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; padding:24px; }
  .admin-form-full    { grid-column:1/-1; }
  .admin-form-actions { display:flex; gap:12px; justify-content:flex-end; padding:16px 24px; border-top:1px solid var(--border-color); flex-wrap:wrap; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TOGGLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-toggle-wrap      { display:flex; align-items:center; gap:12px; padding:12px 0; font-size:.85rem; color:var(--text-secondary); }
  .admin-toggle           { position:relative; display:inline-block; width:44px; height:24px; flex-shrink:0; }
  .admin-toggle input     { opacity:0; width:0; height:0; }
  .admin-toggle-slider    { position:absolute; cursor:pointer; inset:0; background:var(--bg-secondary); border-radius:24px; box-shadow:var(--neu-inset-sm); transition:var(--transition); }
  .admin-toggle-slider::before { content:''; position:absolute; width:18px; height:18px; left:3px; top:3px; background:var(--text-muted); border-radius:50%; transition:var(--transition); }
  .admin-toggle input:checked + .admin-toggle-slider { background:var(--accent); }
  .admin-toggle input:checked + .admin-toggle-slider::before { transform:translateX(20px); background:#fff; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SETTINGS TABS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-settings-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
  .admin-settings-tab  {
    padding:8px 16px; border-radius:var(--border-radius-sm);
    background:var(--bg-card); color:var(--text-secondary);
    font-size:.82rem; font-weight:600;
    box-shadow:var(--neu-shadow-sm); border:2px solid transparent;
    cursor:pointer; transition:var(--transition); font-family:'Poppins',sans-serif;
  }
  .admin-settings-tab:hover  { color:var(--accent); }
  .admin-settings-tab.active { background:var(--accent); color:#fff; border-color:var(--accent); }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TABLE USER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-table-user        { display:flex; align-items:center; gap:10px; }
  .admin-table-user-avatar { width:32px; height:32px; border-radius:50%; background:var(--accent-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .admin-table-user-avatar svg,.admin-table-user-avatar i { width:16px; height:16px; color:var(--accent); }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CONFIRM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-confirm-dialog   { max-width:400px; width:100%; padding:32px; text-align:center; display:flex; flex-direction:column; gap:16px; align-items:center; }
  .admin-confirm-icon     { width:60px; height:60px; border-radius:50%; background:var(--warning-light); display:flex; align-items:center; justify-content:center; color:var(--warning); }
  .admin-confirm-dialog h3 { font-size:1.1rem; font-weight:700; color:var(--text-heading); }
  .admin-confirm-dialog p  { font-size:.85rem; color:var(--text-secondary); line-height:1.6; }
  .admin-confirm-actions   { display:flex; gap:12px; width:100%; }
  .admin-confirm-actions .btn { flex:1; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ MOBILE OVERLAY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-mobile-overlay        { display:none; position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:199; }
  .admin-mobile-overlay.active { display:block; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ NEWSLETTER CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  .admin-nl-card {
    display:flex; flex-direction:column;
    border-radius:14px; overflow:hidden;
    background:var(--bg-card);
    box-shadow:var(--neu-shadow-sm);
    transition:transform .25s ease, box-shadow .25s ease;
  }
  .admin-nl-card:hover { transform:translateY(-4px); box-shadow:var(--neu-shadow); }

  .admin-nl-cover {
    position:relative; width:100%; height:180px;
    background:var(--bg-secondary); overflow:hidden; flex-shrink:0;
  }
  .admin-nl-cover-img {
    width:100%; height:100%; object-fit:cover; display:block;
    transition:transform .3s ease;
  }
  .admin-nl-card:hover .admin-nl-cover-img { transform:scale(1.04); }
  .admin-nl-cover-placeholder {
    width:100%; height:100%;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
    background:linear-gradient(135deg,var(--accent-light) 0%,var(--bg-secondary) 100%);
    color:var(--text-muted);
  }
  .admin-nl-cover-placeholder i,
  .admin-nl-cover-placeholder svg { width:44px; height:44px; opacity:.35; }

  .admin-nl-status-overlay {
    position:absolute; bottom:0; left:0; right:0;
    padding:8px 12px;
    background:linear-gradient(transparent, rgba(0,0,0,.68));
    display:flex; align-items:center; gap:8px;
  }
  .admin-nl-status-label          { font-size:.68rem; font-weight:700; letter-spacing:.5px; text-transform:uppercase; font-family:Poppins,sans-serif; }
  .admin-nl-status-label.published { color:#86efac; }
  .admin-nl-status-label.draft     { color:rgba(255,255,255,.55); }

  .admin-nl-body {
    padding:14px; display:flex;
    flex-direction:column; gap:5px; flex:1;
  }
  .admin-nl-title {
    font-size:.88rem; font-weight:700; color:var(--text-heading);
    line-height:1.4; display:-webkit-box;
    -webkit-line-clamp:2; -webkit-box-orient:vertical;
    overflow:hidden; font-family:Poppins,sans-serif;
  }
  .admin-nl-meta {
    display:flex; align-items:center; gap:5px;
    font-size:.72rem; color:var(--text-muted); font-family:Poppins,sans-serif;
  }
  .admin-nl-desc {
    font-size:.76rem; color:var(--text-secondary); line-height:1.5;
    display:-webkit-box; -webkit-line-clamp:2;
    -webkit-box-orient:vertical; overflow:hidden;
    font-family:Poppins,sans-serif;
  }
  .admin-nl-link-row { margin-top:6px; }
  .admin-nl-link-badge {
    display:inline-flex; align-items:center; gap:4px;
    padding:2px 9px; border-radius:20px;
    font-size:.66rem; font-weight:700; font-family:Poppins,sans-serif;
  }
  .admin-nl-link-badge.has-link { background:var(--success-light); color:var(--success); }
  .admin-nl-link-badge.no-link  { background:var(--bg-secondary);   color:var(--text-muted); }

  .admin-nl-actions {
    display:flex; border-top:1px solid var(--border-color); flex-shrink:0;
  }
  .admin-nl-btn {
    flex:1; display:inline-flex; align-items:center; justify-content:center;
    gap:5px; padding:10px 8px; font-size:.76rem; font-weight:600;
    cursor:pointer; border:none; background:none;
    color:var(--text-secondary); transition:all .2s ease;
    font-family:Poppins,sans-serif;
    border-right:1px solid var(--border-color);
  }
  .admin-nl-btn:last-child  { border-right:none; }
  .admin-nl-btn i,.admin-nl-btn svg { width:13px; height:13px; flex-shrink:0; }
  .admin-nl-btn-preview:hover { background:var(--accent-light); color:var(--accent); }
  .admin-nl-btn-edit:hover    { background:var(--success-light); color:var(--success); }
  .admin-nl-btn-delete:hover  { background:var(--danger-light);  color:var(--danger);  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ RESPONSIVE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  @media (max-width:1024px) {
    .admin-topbar-user-info { display:none; }
    .admin-dashboard-grid   { grid-template-columns:1fr; }
  }
  @media (max-width:768px) {
    .admin-sidebar { position:fixed; left:-260px; top:0; bottom:0; z-index:201; transition:left .3s cubic-bezier(.4,0,.2,1); }
    .admin-sidebar.mobile-open { left:0; }
    .admin-main  { width:100%; }
    .admin-mobile-sidebar-btn { display:flex !important; }
    .admin-content { padding:16px; }
    .admin-topbar  { padding:0 12px; }
    .admin-stats-grid { grid-template-columns:repeat(2,1fr); }
    .admin-form-grid  { grid-template-columns:1fr; }
    .admin-form-full  { grid-column:1; }
    .admin-filters-row { flex-direction:column; align-items:stretch; }
    .admin-filters-row > * { width:100% !important; max-width:100% !important; }
  }
  @media (max-width:480px) {
    .admin-stats-grid     { grid-template-columns:1fr 1fr; }
    .admin-section-header { flex-direction:column; }
    .admin-settings-tabs  { flex-direction:column; }
    .admin-quick-actions  { justify-content:center; }
    #nl-cards-grid        { grid-template-columns:1fr !important; }
  }
`;

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

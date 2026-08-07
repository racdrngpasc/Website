/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Authentication & Authorization - js/auth.js
   Role-based access control, session management
   ============================================================ */

'use strict';

/* ============================================================
   AUTH MANAGER CLASS
   ============================================================ */
class AuthManager {
  constructor() {
    this.db = getSupabaseClient();
    this.currentAdmin = null;
    this.sessionKey = 'admin_session';
    this.sessionTimeout = 8 * 60 * 60 * 1000; // 8 hours
    this.activityTimeout = null;
    this.activityTimeoutDuration = 30 * 60 * 1000; // 30 min inactivity
    this.loginAttempts = {};
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 30 * 60 * 1000; // 30 min lockout

    this.init();
  }

  /* ============================================================
     INITIALIZATION
     ============================================================ */
  init() {
    this.restoreSession();
    this.setupActivityTracking();
  }

  /* ============================================================
     SESSION MANAGEMENT
     ============================================================ */
  restoreSession() {
    try {
      const session = Storage.get(this.sessionKey);
      if (!session) return null;

      // Check session expiry
      if (Date.now() > session.expiry) {
        this.clearSession();
        return null;
      }

      this.currentAdmin = session.admin;
      return this.currentAdmin;
    } catch (e) {
      this.clearSession();
      return null;
    }
  }

  saveSession(admin) {
    const session = {
      admin,
      expiry: Date.now() + this.sessionTimeout,
      createdAt: Date.now()
    };
    Storage.set(this.sessionKey, session, this.sessionTimeout);
    this.currentAdmin = admin;
  }

  clearSession() {
    Storage.remove(this.sessionKey);
    this.currentAdmin = null;
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }
  }

  isAuthenticated() {
    const session = Storage.get(this.sessionKey);
    if (!session) return false;
    if (Date.now() > session.expiry) {
      this.clearSession();
      return false;
    }
    return true;
  }

  getAdmin() {
    if (!this.isAuthenticated()) return null;
    const session = Storage.get(this.sessionKey);
    return session?.admin || null;
  }

  /* ============================================================
     ACTIVITY TRACKING (Auto logout on inactivity)
     ============================================================ */
  setupActivityTracking() {
    const resetTimer = throttle(() => {
      if (this.isAuthenticated()) {
        this.resetActivityTimer();
      }
    }, 30000);

    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });
  }

  resetActivityTimer() {
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }

    this.activityTimeout = setTimeout(() => {
      if (this.isAuthenticated()) {
        this.logout('Session expired due to inactivity');
      }
    }, this.activityTimeoutDuration);
  }

  /* ============================================================
     LOGIN
     ============================================================ */
  async login(email, password) {
    if (!email || !password) {
      return { success: false, message: 'Email and password are required' };
    }

    // Check local lockout
    const lockoutKey = `lockout_${email}`;
    const lockoutData = Storage.get(lockoutKey);
    if (lockoutData && Date.now() < lockoutData.until) {
      const remaining = Math.ceil((lockoutData.until - Date.now()) / 60000);
      return {
        success: false,
        message: `Account temporarily locked. Try again in ${remaining} minute(s).`
      };
    }

    try {
      // Call the database authenticate function
      const { data, error } = await this.db
        .rpc('authenticate_admin', {
          p_email: email.toLowerCase().trim(),
          p_password: password
        });

      if (error) throw error;

      if (!data || !data.success) {
        // Track failed attempts
        this.trackFailedAttempt(email);
        return {
          success: false,
          message: data?.message || 'Invalid email or password'
        };
      }

      // Clear failed attempts
      this.clearFailedAttempts(email);

      const admin = data.user;

      // Save session
      this.saveSession(admin);
      this.resetActivityTimer();

      // Log admin activity
      await this.logActivity(admin.id, 'LOGIN', null, null, {
        email: admin.email,
        role: admin.role,
        loginTime: new Date().toISOString()
      });

      return { success: true, admin };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Authentication failed. Please try again.'
      };
    }
  }

  trackFailedAttempt(email) {
    const key = `attempts_${email}`;
    const existing = Storage.get(key) || { count: 0, firstAttempt: Date.now() };
    existing.count++;

    if (existing.count >= this.maxLoginAttempts) {
      const lockoutKey = `lockout_${email}`;
      Storage.set(lockoutKey, { until: Date.now() + this.lockoutDuration }, this.lockoutDuration);
      Storage.remove(key);
    } else {
      Storage.set(key, existing, 15 * 60 * 1000); // 15 min window
    }
  }

  clearFailedAttempts(email) {
    Storage.remove(`attempts_${email}`);
    Storage.remove(`lockout_${email}`);
  }

  /* ============================================================
     LOGOUT
     ============================================================ */
  async logout(message = null) {
    const admin = this.getAdmin();

    if (admin) {
      try {
        await this.logActivity(admin.id, 'LOGOUT', null, null, {
          email: admin.email,
          logoutTime: new Date().toISOString(),
          reason: message || 'Manual logout'
        });
      } catch (e) {
        // Silent fail for logout logging
      }
    }

    this.clearSession();

    if (message) {
      // Store message to show after redirect
      sessionStorage.setItem('logout_message', message);
    }

    // Redirect to admin login
    window.location.href = 'admin.html';
  }

  /* ============================================================
     PASSWORD MANAGEMENT
     ============================================================ */
  async changePassword(oldPassword, newPassword) {
    const admin = this.getAdmin();
    if (!admin) return { success: false, message: 'Not authenticated' };

    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        message: 'New password must be at least 8 characters long'
      };
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return {
        success: false,
        message: 'Password must contain uppercase, lowercase, and a number'
      };
    }

    try {
      const { data, error } = await this.db
        .rpc('change_admin_password', {
          p_admin_id: admin.id,
          p_old_password: oldPassword,
          p_new_password: newPassword
        });

      if (error) throw error;

      if (data?.success) {
        await this.logActivity(admin.id, 'PASSWORD_CHANGED', 'admin_users', admin.id);
        return { success: true, message: 'Password changed successfully' };
      }

      return { success: false, message: data?.message || 'Failed to change password' };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, message: 'Failed to change password. Please try again.' };
    }
  }

  async setAdminPassword(targetAdminId, newPassword) {
    const admin = this.getAdmin();
    if (!admin || admin.role !== ROLES.SUPER_ADMIN) {
      return { success: false, message: 'Only Super Administrator can set passwords' };
    }

    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters'
      };
    }

    try {
      const { data, error } = await this.db
        .rpc('set_admin_password', {
          p_target_admin_id: targetAdminId,
          p_new_password: newPassword
        });

      if (error) throw error;

      await this.logActivity(admin.id, 'ADMIN_PASSWORD_SET', 'admin_users', targetAdminId);

      return data || { success: true, message: 'Password updated successfully' };
    } catch (error) {
      console.error('Set password error:', error);
      return { success: false, message: 'Failed to set password' };
    }
  }

  /* ============================================================
     ADMIN USER MANAGEMENT (Super Admin only)
     ============================================================ */
  async createAdminUser(userData) {
    const admin = this.getAdmin();
    if (!admin || admin.role !== ROLES.SUPER_ADMIN) {
      return { success: false, message: 'Only Super Administrator can create admin users' };
    }

    const { email, password, full_name, role, avenue, member_id } = userData;

    if (!email || !password || !full_name || !role) {
      return { success: false, message: 'Email, password, name and role are required' };
    }

    if (!Validate.email(email)) {
      return { success: false, message: 'Invalid email address' };
    }

    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters' };
    }

    try {
      // Check if email already exists
      const { data: existing } = await this.db
        .from('admin_users')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (existing) {
        return { success: false, message: 'An admin user with this email already exists' };
      }

      // Create admin user using RPC to handle password hashing
      const { data, error } = await this.db
        .rpc('create_admin_user_secure', {
          p_email: email.toLowerCase().trim(),
          p_password: password,
          p_full_name: full_name.trim(),
          p_role: role,
          p_avenue: avenue || null,
          p_member_id: member_id || null,
          p_created_by: admin.id
        });

      if (error) {
        // Fallback: direct insert with hashed password
        const { data: insertData, error: insertError } = await this.db
          .from('admin_users')
          .insert({
            email: email.toLowerCase().trim(),
            password_hash: await this.hashPassword(password),
            full_name: full_name.trim(),
            role,
            avenue: avenue || null,
            member_id: member_id || null,
            created_by: admin.id,
            is_active: true
          })
          .select('id, email, full_name, role')
          .single();

        if (insertError) throw insertError;

        await this.logActivity(admin.id, 'ADMIN_CREATED', 'admin_users', insertData.id, {
          email: insertData.email,
          role: insertData.role
        });

        return { success: true, admin: insertData };
      }

      await this.logActivity(admin.id, 'ADMIN_CREATED', 'admin_users', data?.id, {
        email,
        role
      });

      return { success: true, admin: data };

    } catch (error) {
      console.error('Create admin error:', error);
      return { success: false, message: 'Failed to create admin user. Please try again.' };
    }
  }

  async hashPassword(password) {
    // Client-side password hashing using Web Crypto API
    // Note: This is used as a fallback. The database function handles proper bcrypt hashing.
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async updateAdminUser(adminId, updates) {
    const admin = this.getAdmin();
    if (!admin || admin.role !== ROLES.SUPER_ADMIN) {
      return { success: false, message: 'Insufficient permissions' };
    }

    // Remove password from updates (use setAdminPassword for that)
    delete updates.password;
    delete updates.password_hash;

    try {
      const { data, error } = await this.db
        .from('admin_users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminId)
        .select('id, email, full_name, role, is_active, avenue')
        .single();

      if (error) throw error;

      await this.logActivity(admin.id, 'ADMIN_UPDATED', 'admin_users', adminId, updates);

      return { success: true, admin: data };
    } catch (error) {
      console.error('Update admin error:', error);
      return { success: false, message: 'Failed to update admin user' };
    }
  }

  async deleteAdminUser(adminId) {
    const admin = this.getAdmin();
    if (!admin || admin.role !== ROLES.SUPER_ADMIN) {
      return { success: false, message: 'Insufficient permissions' };
    }

    // Cannot delete self
    if (adminId === admin.id) {
      return { success: false, message: 'Cannot delete your own account' };
    }

    try {
      // Soft delete - deactivate instead of deleting
      const { error } = await this.db
        .from('admin_users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', adminId);

      if (error) throw error;

      await this.logActivity(admin.id, 'ADMIN_DEACTIVATED', 'admin_users', adminId);

      return { success: true, message: 'Admin user deactivated successfully' };
    } catch (error) {
      console.error('Delete admin error:', error);
      return { success: false, message: 'Failed to deactivate admin user' };
    }
  }

  async getAllAdminUsers() {
    const admin = this.getAdmin();
    if (!admin || admin.role !== ROLES.SUPER_ADMIN) {
      return { success: false, message: 'Insufficient permissions', data: [] };
    }

    try {
      const { data, error } = await this.db
        .from('admin_users')
        .select('id, email, full_name, role, is_active, avenue, last_login, created_at, login_attempts')
        .order('role')
        .order('full_name');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Get admin users error:', error);
      return { success: false, message: 'Failed to load admin users', data: [] };
    }
  }

  /* ============================================================
     PERMISSION CHECKING
     ============================================================ */
  can(permission) {
    const admin = this.getAdmin();
    if (!admin) return false;
    return PermissionChecker.can(admin.role, permission);
  }

  canAccessAvenue(avenue) {
    const admin = this.getAdmin();
    if (!admin) return false;
    return PermissionChecker.canAccessAvenue(admin.role, avenue);
  }

  getAccessibleAvenues() {
    const admin = this.getAdmin();
    if (!admin) return [];
    return PermissionChecker.getAccessibleAvenues(admin.role);
  }

  hasRole(...roles) {
    const admin = this.getAdmin();
    if (!admin) return false;
    return roles.includes(admin.role);
  }

  hasMinLevel(minLevel) {
    const admin = this.getAdmin();
    if (!admin) return false;
    return PermissionChecker.hasLevel(admin.role, minLevel);
  }

  isSuperAdmin() {
    return this.hasRole(ROLES.SUPER_ADMIN);
  }

  isAdvisor() {
    return this.hasRole(ROLES.ADVISOR);
  }

  isPresident() {
    return this.hasRole(ROLES.PRESIDENT);
  }

  isSecretary() {
    return this.hasRole(
      ROLES.SECRETARY_ADMINISTRATION,
      ROLES.SECRETARY_COMMUNICATION
    );
  }

  isTreasurer() {
    return this.hasRole(ROLES.TREASURER);
  }

  /* ============================================================
     NEW ROLE HELPERS
     ============================================================ */
  isRotaryFoundationChair() {
    return this.hasRole(ROLES.ROTARY_FOUNDATION_CHAIR);
  }

  isAllAvenueChair() {
    return this.hasRole(ROLES.ALL_AVENUE_CHAIR);
  }

  isAvenuDirector() {
    return this.hasRole(
      ROLES.AVENUE_DIRECTOR_CLUB_SERVICE,
      ROLES.AVENUE_DIRECTOR_COMMUNITY_SERVICE,
      ROLES.AVENUE_DIRECTOR_PROFESSIONAL_SERVICE,
      ROLES.AVENUE_DIRECTOR_INTERNATIONAL_SERVICE
    );
  }

  isFullAccess() {
    return this.hasRole(
      ROLES.SUPER_ADMIN,
      ROLES.ADVISOR,
      ROLES.PRESIDENT,
      ROLES.IMMEDIATE_PAST_PRESIDENT,
      ROLES.VICE_PRESIDENT,
      ROLES.SECRETARY_ADMINISTRATION,
      ROLES.SECRETARY_COMMUNICATION
    );
  }

  /* ============================================================
     ACTIVITY LOGGING
     ============================================================ */
  async logActivity(adminId, action, tableName = null, recordId = null, details = null) {
    try {
      await this.db
        .from('admin_activity_logs')
        .insert({
          admin_id: adminId,
          action,
          table_name: tableName,
          record_id: recordId,
          new_values: details,
          ip_address: null // Privacy - not collecting IP on client side
        });
    } catch (e) {
      // Silent fail for logging
      console.warn('Activity log failed:', e);
    }
  }

  /* ============================================================
     REQUIRE AUTH (Guard)
     ============================================================ */
  requireAuth(redirectUrl = 'admin.html') {
    if (!this.isAuthenticated()) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }

  requireRole(roles, redirectUrl = 'admin.html') {
    if (!this.requireAuth(redirectUrl)) return false;

    const admin = this.getAdmin();
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(admin.role)) {
      console.warn(`Access denied. Required: ${allowedRoles.join(', ')}, Got: ${admin.role}`);
      return false;
    }

    return true;
  }

  requirePermission(permission) {
    if (!this.isAuthenticated()) return false;
    return this.can(permission);
  }
}

/* ============================================================
   ADMIN LOGIN UI CLASS
   ============================================================ */
class AdminLoginUI {
  constructor(authManager) {
    this.auth = authManager;
    this.isVisible = true;
  }

  /* ============================================================
     RENDER LOGIN FORM
     ============================================================ */
  renderLoginForm(containerId = 'admin-login-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="admin-login-wrapper">
        <div class="admin-login-card neu-card">

          <!-- Login Header -->
          <div class="admin-login-header">
            <img 
              src="https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713317/ngp_logo_colourAsset_2_2x-8_lu8zgf.png"
              alt="Rotaract Logo"
              class="admin-login-logo"
            />
            <h1 class="admin-login-title">Admin Portal</h1>
            <p class="admin-login-subtitle">Rotaract Club of Dr. N.G.P Arts &amp; Science College</p>
            <div class="admin-login-badge">
              <i data-lucide="shield-check"></i>
              <span>Secure Access | Club ID: 217835</span>
            </div>
          </div>

          <!-- Logout message -->
          <div class="admin-logout-msg" id="admin-logout-msg" style="display:none;">
            <i data-lucide="info"></i>
            <span id="admin-logout-msg-text"></span>
          </div>

          <!-- Login Form -->
          <form id="admin-login-form" class="admin-login-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="admin-email">
                <i data-lucide="mail"></i>
                Email Address
              </label>
              <div class="input-wrap neu-inset">
                <i data-lucide="mail" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;"></i>
                <input 
                  type="email" 
                  id="admin-email" 
                  class="form-input" 
                  placeholder="admin@email.com"
                  autocomplete="email"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="admin-password">
                <i data-lucide="lock"></i>
                Password
              </label>
              <div class="input-wrap neu-inset" style="position:relative;">
                <i data-lucide="lock" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;"></i>
                <input 
                  type="password" 
                  id="admin-password" 
                  class="form-input" 
                  placeholder="••••••••"
                  autocomplete="current-password"
                  required
                />
                <button 
                  type="button" 
                  id="toggle-password"
                  style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text-muted);display:flex;align-items:center;"
                  aria-label="Toggle password visibility"
                >
                  <i data-lucide="eye" id="pass-eye-icon" style="width:16px;height:16px;"></i>
                </button>
              </div>
            </div>

            <!-- Error Message -->
            <div class="admin-login-error" id="admin-login-error" style="display:none;">
              <i data-lucide="alert-circle"></i>
              <span id="admin-login-error-text"></span>
            </div>

            <!-- Submit Button -->
            <button type="submit" class="btn btn-primary btn-full" id="admin-login-btn">
              <i data-lucide="log-in"></i>
              <span>Sign In</span>
            </button>

            <!-- Loading indicator -->
            <div class="admin-login-loading" id="admin-login-loading" style="display:none;">
              <div class="loading-lines" style="width:100%;">
                <div class="loading-line"></div>
                <div class="loading-line"></div>
                <div class="loading-line"></div>
              </div>
            </div>
          </form>

          <!-- Footer -->
          <div class="admin-login-footer">
            <a href="../index.html" class="btn btn-outline btn-sm">
              <i data-lucide="home"></i>
              <span>Back to Website</span>
            </a>
            <span class="admin-login-footer-text">
              <i data-lucide="shield"></i>
              Secured Portal
            </span>
          </div>

        </div>

        <!-- Decorative elements -->
        <div class="admin-login-decor">
          <div class="admin-decor-circle admin-decor-1"></div>
          <div class="admin-decor-circle admin-decor-2"></div>
          <div class="admin-decor-circle admin-decor-3"></div>
        </div>
      </div>
    `;

    this.setupLoginFormListeners();
    lucide.createIcons();

    // Show logout message if any
    const logoutMsg = sessionStorage.getItem('logout_message');
    if (logoutMsg) {
      const msgEl = document.getElementById('admin-logout-msg');
      const msgText = document.getElementById('admin-logout-msg-text');
      if (msgEl && msgText) {
        msgText.textContent = logoutMsg;
        msgEl.style.display = 'flex';
      }
      sessionStorage.removeItem('logout_message');
    }
  }

  setupLoginFormListeners() {
    const form = document.getElementById('admin-login-form');
    const togglePass = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('admin-password');

    // Password toggle
    if (togglePass && passwordInput) {
      togglePass.addEventListener('click', () => {
        const isPass = passwordInput.type === 'password';
        passwordInput.type = isPass ? 'text' : 'password';
        const icon = document.getElementById('pass-eye-icon');
        if (icon) {
          icon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
          lucide.createIcons();
        }
      });
    }

    // Enter key submission
    if (passwordInput) {
      passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          form?.dispatchEvent(new Event('submit'));
        }
      });
    }

    // Form submission
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin();
      });
    }
  }

  async handleLogin() {
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('admin-login-btn');
    const errorEl = document.getElementById('admin-login-error');
    const errorText = document.getElementById('admin-login-error-text');
    const loadingEl = document.getElementById('admin-login-loading');

    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    // Hide previous error
    if (errorEl) errorEl.style.display = 'none';

    // Validate
    if (!email || !password) {
      this.showLoginError('Please enter your email and password');
      return;
    }

    if (!Validate.email(email)) {
      this.showLoginError('Please enter a valid email address');
      return;
    }

    // Show loading
    if (loginBtn) loginBtn.disabled = true;
    if (loadingEl) loadingEl.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'none';

    try {
      const result = await this.auth.login(email, password);

      if (result.success) {
        // Show success and redirect
        this.showLoginSuccess();
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 800);
      } else {
        this.showLoginError(result.message || 'Login failed. Please try again.');
        if (passwordInput) passwordInput.value = '';
      }
    } catch (error) {
      this.showLoginError('An error occurred. Please try again.');
      console.error('Login UI error:', error);
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.style.display = 'flex';
      }
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  showLoginError(message) {
    const errorEl = document.getElementById('admin-login-error');
    const errorText = document.getElementById('admin-login-error-text');

    if (errorEl && errorText) {
      errorText.textContent = message;
      errorEl.style.display = 'flex';
      errorEl.style.animation = 'none';
      errorEl.offsetHeight; // reflow
      errorEl.style.animation = 'slideDown 0.3s ease';
    }

    lucide.createIcons();
  }

  showLoginSuccess() {
    const loginBtn = document.getElementById('admin-login-btn');
    if (loginBtn) {
      loginBtn.innerHTML = '<i data-lucide="check-circle"></i><span>Login Successful!</span>';
      loginBtn.style.background = 'var(--success)';
      loginBtn.style.borderColor = 'var(--success)';
      loginBtn.disabled = true;
      loginBtn.style.display = 'flex';
      lucide.createIcons();
    }
  }
}

/* ============================================================
   ADMIN PANEL ROLE RENDERER
   ============================================================ */
class AdminPanelRenderer {
  constructor(authManager) {
    this.auth = authManager;
    this.admin = authManager.getAdmin();
  }

  /* ============================================================
     GET SIDEBAR MENU ITEMS BASED ON ROLE
     ============================================================ */
  getSidebarMenu() {
    const admin = this.admin;
    if (!admin) return [];

    const allMenuItems = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'layout-dashboard',
        section: 'dashboard',
        roles: 'all'
      },
      {
        id: 'events',
        label: 'Events & Projects',
        icon: 'calendar-check',
        section: 'events',
        roles: 'all',
        children: [
          { id: 'events-list', label: 'All Events', icon: 'list', section: 'events-list' },
          { id: 'events-add', label: 'Add Event', icon: 'plus-circle', section: 'events-add' },
          { id: 'events-pending', label: 'Pending Approval', icon: 'clock', section: 'events-pending',
            roles: PERMISSIONS.APPROVE_EVENT }
        ]
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: 'file-text',
        section: 'reports',
        roles: PERMISSIONS.SUBMIT_REPORT,
        children: [
          { id: 'reports-list', label: 'All Reports', icon: 'list', section: 'reports-list' },
          { id: 'reports-monthly', label: 'Monthly Reports', icon: 'calendar', section: 'reports-monthly',
            roles: PERMISSIONS.DOWNLOAD_MONTHLY_REPORT },
          { id: 'reports-dpp', label: 'DPP Reports', icon: 'star', section: 'reports-dpp' }
        ]
      },
      {
        id: 'meetings',
        label: 'Meetings',
        icon: 'users',
        section: 'meetings',
        roles: PERMISSIONS.CREATE_MEETING,
        children: [
          { id: 'meetings-list', label: 'All Meetings', icon: 'list', section: 'meetings-list' },
          { id: 'meetings-add', label: 'Schedule Meeting', icon: 'plus-circle', section: 'meetings-add' },
          { id: 'meetings-attendance', label: 'Attendance', icon: 'check-square', section: 'meetings-attendance',
            roles: PERMISSIONS.VIEW_MEETING_ATTENDANCE }
        ]
      },
      {
        id: 'treasury',
        label: 'Treasury',
        icon: 'indian-rupee',
        section: 'treasury',
        roles: PERMISSIONS.VIEW_TREASURY,
        children: [
          { id: 'treasury-overview', label: 'Overview', icon: 'bar-chart', section: 'treasury-overview' },
          { id: 'treasury-transactions', label: 'Transactions', icon: 'list', section: 'treasury-transactions' },
          { id: 'treasury-add', label: 'Add Transaction', icon: 'plus-circle', section: 'treasury-add',
            roles: PERMISSIONS.MANAGE_TREASURY },
          { id: 'treasury-budget', label: 'Budget', icon: 'target', section: 'treasury-budget',
            roles: PERMISSIONS.MANAGE_TREASURY },
          { id: 'treasury-statements', label: 'Statements', icon: 'download', section: 'treasury-statements',
            roles: PERMISSIONS.DOWNLOAD_TREASURY }
        ]
      },
      {
        id: 'members',
        label: 'Members',
        icon: 'users-2',
        section: 'members',
        roles: PERMISSIONS.MANAGE_MEMBERS,
        children: [
          { id: 'members-list', label: 'All Members', icon: 'list', section: 'members-list' },
          { id: 'members-add', label: 'Add Member', icon: 'user-plus', section: 'members-add' },
          { id: 'members-board', label: 'Board Members', icon: 'star', section: 'members-board' }
        ]
      },
      {
        id: 'applications',
        label: 'Applications',
        icon: 'inbox',
        section: 'applications',
        roles: PERMISSIONS.REVIEW_APPLICATIONS
      },
      {
        id: 'newsletters',
        label: 'Bulletins',
        icon: 'newspaper',
        section: 'newsletters',
        roles: PERMISSIONS.MANAGE_NEWSLETTERS
      },
      {
        id: 'blood-requests',
        label: 'Blood Requests',
        icon: 'droplets',
        section: 'blood-requests',
        roles: PERMISSIONS.MANAGE_BLOOD_REQUESTS
      },
      {
        id: 'past-leaders',
        label: 'Past Leaders',
        icon: 'crown',
        section: 'past-leaders',
        roles: PERMISSIONS.MANAGE_PAST_LEADERS
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: 'bell',
        section: 'notifications',
        roles: PERMISSIONS.SEND_NOTIFICATIONS
      },
      {
        id: 'email-center',
        label: 'Email Center',
        icon: 'mail',
        section: 'email-center',
        roles: PERMISSIONS.SEND_BULK_EMAIL
      },
      {
        id: 'logs',
        label: 'Activity Logs',
        icon: 'activity',
        section: 'logs',
        roles: PERMISSIONS.VIEW_LOGS
      },
      {
        id: 'admin-users',
        label: 'Admin Users',
        icon: 'shield-check',
        section: 'admin-users',
        roles: PERMISSIONS.MANAGE_ADMINS
      },
      {
        id: 'settings',
        label: 'Site Settings',
        icon: 'settings',
        section: 'settings',
        roles: PERMISSIONS.MANAGE_SETTINGS
      }
    ];

    return allMenuItems.filter(item => this.canAccessMenuItem(item, admin.role));
  }

  canAccessMenuItem(item, role) {
    if (item.roles === 'all') return true;
    if (!item.roles) return true;

    const allowedRoles = Array.isArray(item.roles) ? item.roles : [item.roles];
    return allowedRoles.includes(role);
  }

  /* ============================================================
     RENDER ADMIN HEADER INFO
     ============================================================ */
  renderAdminInfo(containerId = 'admin-user-info') {
    const container = document.getElementById(containerId);
    if (!container || !this.admin) return;

    const roleDisplay = ROLE_DISPLAY_NAMES[this.admin.role] || this.admin.role;

    container.innerHTML = `
      <div class="admin-user-avatar">
        <i data-lucide="user-circle-2"></i>
      </div>
      <div class="admin-user-details">
        <span class="admin-user-name">${StringUtils.sanitize(this.admin.full_name)}</span>
        <span class="admin-user-role">${StringUtils.sanitize(roleDisplay)}</span>
      </div>
    `;

    lucide.createIcons();
  }

  /* ============================================================
     GET DASHBOARD WIDGETS BASED ON ROLE
     ============================================================ */
  getDashboardWidgets() {
    const admin = this.admin;
    if (!admin) return [];

    const widgets = [];
    const role = admin.role;

    // Stats widgets - visible to full access roles
    if (PermissionChecker.hasLevel(role, 50)) {
      widgets.push(
        { type: 'stat', id: 'total-events', label: 'Total Events', icon: 'calendar-check', color: 'accent' },
        { type: 'stat', id: 'total-members', label: 'Total Members', icon: 'users', color: 'success' },
        { type: 'stat', id: 'pending-approvals', label: 'Pending Approvals', icon: 'clock', color: 'warning' }
      );
    }

    // Treasury widget
    if (PermissionChecker.can(role, 'VIEW_TREASURY')) {
      widgets.push({
        type: 'stat',
        id: 'treasury-balance',
        label: 'Current Balance',
        icon: 'indian-rupee',
        color: 'accent'
      });
    }

    // Applications widget
    if (PermissionChecker.can(role, 'REVIEW_APPLICATIONS')) {
      widgets.push({
        type: 'stat',
        id: 'pending-applications',
        label: 'New Applications',
        icon: 'inbox',
        color: 'warning'
      });
    }

    // Blood requests
    if (PermissionChecker.can(role, 'MANAGE_BLOOD_REQUESTS')) {
      widgets.push({
        type: 'stat',
        id: 'active-blood-requests',
        label: 'Active Blood Requests',
        icon: 'droplets',
        color: 'danger'
      });
    }

    // Quick actions
    widgets.push({ type: 'quick-actions', id: 'quick-actions', label: 'Quick Actions' });

    // Upcoming events
    widgets.push({ type: 'upcoming-events', id: 'upcoming-events-widget', label: 'Upcoming Events' });

    // Recent activity (full access)
    if (PermissionChecker.hasLevel(role, 75)) {
      widgets.push({ type: 'activity', id: 'recent-activity', label: 'Recent Activity' });
    }

    // Birthday reminders
    widgets.push({ type: 'birthdays', id: 'birthday-widget', label: 'Upcoming Birthdays' });

    return widgets;
  }

  /* ============================================================
     GET QUICK ACTIONS BASED ON ROLE
     ============================================================ */
  getQuickActions() {
    const admin = this.admin;
    if (!admin) return [];

    const actions = [];
    const role = admin.role;

    if (PermissionChecker.can(role, 'CREATE_EVENT')) {
      actions.push({
        id: 'add-event',
        label: 'Add Event',
        icon: 'calendar-plus',
        section: 'events-add',
        color: 'primary'
      });
    }

    if (PermissionChecker.can(role, 'APPROVE_EVENT')) {
      actions.push({
        id: 'approve-events',
        label: 'Approve Events',
        icon: 'check-circle',
        section: 'events-pending',
        color: 'success'
      });
    }

    if (PermissionChecker.can(role, 'CREATE_MEETING')) {
      actions.push({
        id: 'schedule-meeting',
        label: 'Schedule Meeting',
        icon: 'users',
        section: 'meetings-add',
        color: 'primary'
      });
    }

    if (PermissionChecker.can(role, 'MANAGE_TREASURY')) {
      actions.push({
        id: 'add-transaction',
        label: 'Add Transaction',
        icon: 'indian-rupee',
        section: 'treasury-add',
        color: 'warning'
      });
    }

    if (PermissionChecker.can(role, 'MANAGE_MEMBERS')) {
      actions.push({
        id: 'add-member',
        label: 'Add Member',
        icon: 'user-plus',
        section: 'members-add',
        color: 'primary'
      });
    }

    if (PermissionChecker.can(role, 'SEND_BULK_EMAIL')) {
      actions.push({
        id: 'send-email',
        label: 'Send Email',
        icon: 'mail',
        section: 'email-center',
        color: 'accent'
      });
    }

    return actions;
  }
}

/* ============================================================
   AUTH CSS STYLES (Injected dynamically)
   ============================================================ */
const authStyles = `
  /* Admin Login Wrapper */
  .admin-login-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
    background: var(--bg);
  }

  .admin-login-card {
    width: 100%;
    max-width: 440px;
    padding: 40px;
    position: relative;
    z-index: 2;
  }

  .admin-login-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .admin-login-logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    margin: 0 auto 16px;
    filter: drop-shadow(0 4px 12px rgba(var(--accent-rgb), 0.3));
  }

  .admin-login-title {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--text-heading);
    margin-bottom: 6px;
  }

  .admin-login-subtitle {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin-bottom: 12px;
  }

  .admin-login-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 14px;
    border-radius: var(--border-radius-full);
    background: var(--accent-light);
    color: var(--accent);
    font-size: 0.72rem;
    font-weight: 600;
  }

  .admin-login-badge svg,
  .admin-login-badge i {
    width: 13px;
    height: 13px;
  }

  .admin-login-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .admin-login-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--border-radius-sm);
    background: var(--danger-light);
    color: var(--danger);
    font-size: 0.84rem;
    font-weight: 500;
    border-left: 3px solid var(--danger);
  }

  .admin-login-error svg,
  .admin-login-error i {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .admin-logout-msg {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--border-radius-sm);
    background: var(--accent-light);
    color: var(--accent);
    font-size: 0.84px;
    font-weight: 500;
    margin-bottom: 16px;
    border-left: 3px solid var(--accent);
  }

  .admin-logout-msg svg,
  .admin-logout-msg i {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .admin-login-loading {
    padding: 8px 0;
  }

  .admin-login-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
    gap: 12px;
    flex-wrap: wrap;
  }

  .admin-login-footer-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .admin-login-footer-text svg,
  .admin-login-footer-text i {
    width: 13px;
    height: 13px;
    color: var(--success);
  }

  /* Decorative circles */
  .admin-login-decor {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .admin-decor-circle {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(var(--accent-rgb), 0.1), transparent);
  }

  .admin-decor-1 {
    width: 400px;
    height: 400px;
    top: -100px;
    right: -100px;
    animation: decorFloat1 8s ease-in-out infinite;
  }

  .admin-decor-2 {
    width: 300px;
    height: 300px;
    bottom: -80px;
    left: -80px;
    animation: decorFloat2 10s ease-in-out infinite;
  }

  .admin-decor-3 {
    width: 200px;
    height: 200px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: decorFloat3 6s ease-in-out infinite;
  }

  @keyframes decorFloat1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-20px, 20px) scale(1.05); }
  }
  @keyframes decorFloat2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(15px, -15px) scale(1.03); }
  }
  @keyframes decorFloat3 {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.3; }
  }

  /* Admin Panel Common Styles */
  .admin-sidebar-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: var(--border-radius-sm);
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    position: relative;
    text-decoration: none;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
  }

  .admin-sidebar-item:hover {
    color: var(--accent);
    background: var(--accent-light);
  }

  .admin-sidebar-item.active {
    color: var(--accent);
    background: var(--accent-light);
    box-shadow: var(--neu-shadow-sm);
    font-weight: 600;
  }

  .admin-sidebar-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    background: var(--accent);
    border-radius: 0 2px 2px 0;
  }

  .admin-sidebar-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .admin-sidebar-badge {
    margin-left: auto;
    min-width: 20px;
    height: 20px;
    border-radius: var(--border-radius-full);
    background: var(--accent);
    color: #FFFFFF;
    font-size: 0.65rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
  }

  .admin-user-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--border-radius-sm);
    background: var(--accent-light);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .admin-user-avatar svg,
  .admin-user-avatar i {
    width: 22px;
    height: 22px;
    color: var(--accent);
  }

  .admin-user-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .admin-user-name {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-heading);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .admin-user-role {
    font-size: 0.72rem;
    color: var(--accent);
    font-weight: 500;
  }

  @keyframes slideDown {
    from { transform: translateY(-8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

/* ============================================================
   INJECT AUTH STYLES
   ============================================================ */
(function injectAuthStyles() {
  if (!document.getElementById('auth-styles')) {
    const style = document.createElement('style');
    style.id = 'auth-styles';
    style.textContent = authStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL AUTH INSTANCES
   ============================================================ */
const authManager = new AuthManager();
window.authManager = authManager;
window.AdminLoginUI = AdminLoginUI;
window.AdminPanelRenderer = AdminPanelRenderer;

/* ============================================================
   AUTO-PROTECT ADMIN PAGES
   ============================================================ */
(function autoProtect() {
  const isAdminPage = window.location.pathname.includes('admin.html') ||
    window.location.pathname.includes('/pages/admin');

  const isLoginPage = document.getElementById('admin-login-container') !== null;

  if (isAdminPage && !isLoginPage) {
    // Check auth on admin pages
    if (!authManager.isAuthenticated()) {
      window.location.href = window.location.pathname.includes('/pages/')
        ? 'admin.html'
        : 'pages/admin.html';
    }
  }
})();

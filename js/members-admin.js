/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Members Admin Manager - js/members-admin.js
   Members, applications, newsletters, blood requests,
   past leaders, and notifications management
   ============================================================ */

'use strict';

class MembersAdminManager {
  constructor() {
    this.db = getSupabaseClient();
    this.auth = window.authManager;
    this._currentDashboard = null;
    this._editingMemberId = null;
  }

  /* ============================================================
     MEMBERS LIST
     ============================================================ */
  async renderMembersList(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: members, error } = await this.db
      .from('members')
      .select('*')
      .order('is_board_member', { ascending: false })
      .order('full_name', { ascending: true });

    if (error) {
      dashboard.showToast('Failed to load members', 'error');
      return;
    }

    const active = members?.filter(m => m.is_active) || [];
    const inactive = members?.filter(m => !m.is_active) || [];

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="users-2"></i> Members Management
          </h1>
          <p class="admin-section-subtitle">
            ${active.length} active member${active.length !== 1 ? 's' : ''}
            ${inactive.length > 0 ? ` • ${inactive.length} inactive` : ''}
          </p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.can('MANAGE_MEMBERS') ? `
          <button class="btn btn-primary" onclick="membersAdmin.showMemberForm()">
            <i data-lucide="user-plus"></i>
            <span>Add Member</span>
          </button>` : ''}
          <button class="btn btn-outline" onclick="membersAdmin.exportMembersList()">
            <i data-lucide="download"></i>
            <span>Export</span>
          </button>
        </div>
      </div>

      <!-- Stats Row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
                  gap:12px;margin-bottom:20px;">
        <div class="neu-card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent);">${active.length}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">Active</div>
        </div>
        <div class="neu-card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent);">
            ${active.filter(m => m.is_board_member).length}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">Board Members</div>
        </div>
        ${BLOOD_GROUPS.map(bg => {
      const count = active.filter(m => m.blood_group === bg).length;
      return count > 0 ? `
          <div class="neu-card" style="padding:12px;text-align:center;">
            <div style="font-size:1.2rem;font-weight:800;color:var(--danger);">${count}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">${bg}</div>
          </div>` : '';
    }).join('')}
      </div>

      <!-- Filters -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-filters-row">
          <div class="input-wrap neu-inset" style="flex:1;max-width:300px;">
            <i data-lucide="search" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;"></i>
            <input type="text" id="mbr-search" class="form-input"
                   placeholder="Search by name, portfolio, RI ID..."
                   oninput="membersAdmin.applyFilters()" />
          </div>
          <div class="select-wrap neu-inset" style="min-width:140px;">
            <select id="mbr-role-filter" class="form-select" onchange="membersAdmin.applyFilters()">
              <option value="">All Roles</option>
              ${Object.entries(ROLE_DISPLAY_NAMES)
        .filter(([k]) => k !== 'super_admin' && k !== 'advisor')
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:100px;">
            <select id="mbr-blood-filter" class="form-select" onchange="membersAdmin.applyFilters()">
              <option value="">All Blood</option>
              ${BLOOD_GROUPS.map(bg => `<option value="${bg}">${bg}</option>`).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:120px;">
            <select id="mbr-board-filter" class="form-select" onchange="membersAdmin.applyFilters()">
              <option value="">All Members</option>
              <option value="board">Board Only</option>
              <option value="general">General Only</option>
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:120px;">
            <select id="mbr-status-filter" class="form-select" onchange="membersAdmin.applyFilters()">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
        </div>
      </div>

      <!-- Members Table -->
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table" id="mbr-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Portfolio</th>
                <th>RI ID</th>
                <th>Blood</th>
                <th>Contact</th>
                <th>Area</th>
                <th>Board</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="mbr-table-body">
              ${this.renderMemberRows(members || [])}
            </tbody>
          </table>
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  renderMemberRows(members) {
    if (!members || members.length === 0) {
      return `<tr><td colspan="9" class="admin-table-empty">
        <i data-lucide="users-x"></i><span>No members found</span>
      </td></tr>`;
    }

    return members.map(m => {
      const portfolio = m.portfolio || ROLE_DISPLAY_NAMES[m.role] || 'Member';
      return `
        <tr data-member-id="${m.id}"
            data-role="${m.role || ''}"
            data-blood="${m.blood_group || ''}"
            data-board="${m.is_board_member ? 'board' : 'general'}"
            data-active="${m.is_active}">
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              ${m.professional_photo_url
          ? `<img src="${StringUtils.sanitize(m.professional_photo_url)}"
                     style="width:36px;height:36px;border-radius:50%;object-fit:cover;
                            flex-shrink:0;border:2px solid var(--bg);"
                     loading="lazy"
                     onerror="this.outerHTML='<div style=\\'width:36px;height:36px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;\\'><i data-lucide=\\'user\\' style=\\'width:18px;height:18px;color:var(--accent)\\'></i></div>'" />`
          : `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent-light);
                          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i data-lucide="user" style="width:18px;height:18px;color:var(--accent)"></i>
              </div>`
        }
              <div>
                <div style="font-weight:600;color:var(--text-heading);">
                  ${StringUtils.sanitize(m.full_name)}
                </div>
                <div style="font-size:0.72rem;color:var(--text-muted);">
                  ${StringUtils.sanitize(m.email || '')}
                </div>
              </div>
            </div>
          </td>
          <td>
            <span style="font-size:0.78rem;padding:2px 8px;border-radius:var(--border-radius-full);
                         background:var(--accent-light);color:var(--accent);font-weight:600;">
              ${StringUtils.sanitize(portfolio)}
            </span>
          </td>
          <td style="font-size:0.82rem;color:var(--text-secondary);">
            ${StringUtils.sanitize(m.ri_id || '—')}
          </td>
          <td>
            ${m.blood_group
          ? `<span style="display:inline-flex;width:28px;height:28px;border-radius:50%;
                         background:var(--danger-light);color:var(--danger);
                         font-size:0.65rem;font-weight:800;
                         align-items:center;justify-content:center;">
                ${m.blood_group}
              </span>`
          : '<span style="color:var(--text-muted);font-size:0.78rem;">—</span>'}
          </td>
          <td style="font-size:0.78rem;color:var(--text-secondary);">
            ${StringUtils.sanitize(m.phone || '—')}
          </td>
          <td style="font-size:0.78rem;color:var(--text-secondary);max-width:120px;
                     overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${StringUtils.sanitize(m.area || '—')}
          </td>
          <td>
            ${m.is_board_member
          ? `<span class="admin-status-badge"
                    style="background:var(--accent-light);color:var(--accent);">
                Board
              </span>`
          : '<span style="color:var(--text-muted);font-size:0.78rem;">—</span>'}
          </td>
          <td>
            <span class="admin-status-badge"
                  style="background:${m.is_active ? 'var(--success-light)' : 'var(--danger-light)'};
                         color:${m.is_active ? 'var(--success)' : 'var(--danger)'};">
              ${m.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>
            <div class="admin-table-actions">
              ${this.auth.can('MANAGE_MEMBERS') ? `
              <button class="admin-action-btn"
                      onclick="membersAdmin.showMemberForm('${m.id}')"
                      title="Edit">
                <i data-lucide="pencil"></i>
              </button>
              <button class="admin-action-btn ${m.is_active ? 'admin-action-danger' : 'admin-action-success'}"
                      onclick="membersAdmin.toggleMemberStatus('${m.id}', ${m.is_active})"
                      title="${m.is_active ? 'Deactivate' : 'Activate'}">
                <i data-lucide="${m.is_active ? 'user-x' : 'user-check'}"></i>
              </button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  applyFilters() {
    const search = document.getElementById('mbr-search')?.value?.toLowerCase() || '';
    const role = document.getElementById('mbr-role-filter')?.value || '';
    const blood = document.getElementById('mbr-blood-filter')?.value || '';
    const board = document.getElementById('mbr-board-filter')?.value || '';
    const status = document.getElementById('mbr-status-filter')?.value || 'active';

    document.querySelectorAll('#mbr-table-body tr[data-member-id]').forEach(row => {
      const name = row.querySelector('td')?.textContent?.toLowerCase() || '';
      const rowRole = row.getAttribute('data-role') || '';
      const rowBlood = row.getAttribute('data-blood') || '';
      const rowBoard = row.getAttribute('data-board') || '';
      const rowActive = row.getAttribute('data-active') || '';

      const matchSearch = !search || name.includes(search);
      const matchRole = !role || rowRole === role;
      const matchBlood = !blood || rowBlood === blood;
      const matchBoard = !board || rowBoard === board;
      const matchStatus = status === 'all' ||
        (status === 'active' && rowActive === 'true') ||
        (status === 'inactive' && rowActive === 'false');

      row.style.display =
        (matchSearch && matchRole && matchBlood && matchBoard && matchStatus)
          ? '' : 'none';
    });
  }

  /* ============================================================
     MEMBER FORM (ADD / EDIT)
     ============================================================ */
  async showMemberForm(memberId = null) {
    this._editingMemberId = memberId;
    let memberData = null;

    if (memberId) {
      const { data } = await this.db
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single();
      memberData = data;
    }

    const isEdit = !!memberData;
    const content = document.getElementById('admin-content');
    if (!content) return;

    content.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="${isEdit ? 'pencil' : 'user-plus'}"></i>
            ${isEdit ? 'Edit Member' : 'Add New Member'}
          </h1>
        </div>
        <button class="btn btn-outline"
                onclick="membersAdmin.renderMembersList(document.getElementById('admin-content'), membersAdmin._currentDashboard)">
          <i data-lucide="arrow-left"></i>
          <span>Back</span>
        </button>
      </div>

      <div class="admin-card neu-card">
        <form id="mbr-form" novalidate>
          <div class="admin-form-grid">

            <div class="form-group admin-form-full">
              <label class="form-label"><i data-lucide="user"></i> Full Name *</label>
              <div class="input-wrap neu-inset">
                <input type="text" name="full_name" class="form-input"
                       placeholder="Member's full name"
                       value="${isEdit ? StringUtils.sanitize(memberData.full_name) : ''}"
                       required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="mail"></i> Email *</label>
              <div class="input-wrap neu-inset">
                <input type="email" name="email" class="form-input"
                       placeholder="email@example.com"
                       value="${isEdit ? StringUtils.sanitize(memberData.email || '') : ''}"
                       required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="phone"></i> Phone *</label>
              <div class="input-wrap neu-inset">
                <input type="tel" name="phone" class="form-input"
                       placeholder="+91 XXXXX XXXXX"
                       value="${isEdit ? StringUtils.sanitize(memberData.phone || '') : ''}"
                       required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="hash"></i> RI ID</label>
              <div class="input-wrap neu-inset">
                <input type="text" name="ri_id" class="form-input"
                       placeholder="Rotary International ID"
                       value="${isEdit ? StringUtils.sanitize(memberData.ri_id || '') : ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="cake"></i> Date of Birth</label>
              <div class="input-wrap neu-inset">
                <input type="date" name="date_of_birth" class="form-input"
                       value="${isEdit ? (memberData.date_of_birth || '') : ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="droplets"></i> Blood Group</label>
              <div class="select-wrap neu-inset">
                <select name="blood_group" class="form-select">
                  <option value="">Select</option>
                  ${BLOOD_GROUPS.map(bg =>
      `<option value="${bg}" ${isEdit && memberData.blood_group === bg ? 'selected' : ''}>${bg}</option>`
    ).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="briefcase"></i> Portfolio / Designation</label>
              <div class="input-wrap neu-inset">
                <input type="text" name="portfolio" class="form-input"
                       placeholder="e.g., Avenue Director"
                       value="${isEdit ? StringUtils.sanitize(memberData.portfolio || '') : ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="shield"></i> Role</label>
              <div class="select-wrap neu-inset">
                <select name="role" class="form-select">
                  ${Object.entries(ROLE_DISPLAY_NAMES)
        .filter(([k]) => k !== 'super_admin' && k !== 'advisor')
        .map(([k, v]) =>
          `<option value="${k}" ${isEdit && memberData.role === k ? 'selected' : k === 'member' ? 'selected' : ''}>${v}</option>`
        ).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="layers"></i> Avenue (if applicable)</label>
              <div class="select-wrap neu-inset">
                <select name="avenue" class="form-select">
                  <option value="">None</option>
                  ${Object.entries(AVENUES).map(([k, v]) =>
      `<option value="${k}" ${isEdit && memberData.avenue === k ? 'selected' : ''}>${v.label}</option>`
    ).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="map-pin"></i> Area / Locality</label>
              <div class="input-wrap neu-inset">
                <input type="text" name="area" class="form-input"
                       placeholder="Area or locality"
                       value="${isEdit ? StringUtils.sanitize(memberData.area || '') : ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="calendar"></i> Join Date</label>
              <div class="input-wrap neu-inset">
                <input type="date" name="join_date" class="form-input"
                       value="${isEdit ? (memberData.join_date || '') : ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label"><i data-lucide="calendar-range"></i> Rotary Year</label>
              <div class="select-wrap neu-inset">
                <select name="rotary_year" class="form-select">
                  ${ROTARY_YEARS.slice().reverse().map(y =>
      `<option value="${y}" ${isEdit && memberData.rotary_year === y ? 'selected'
        : y === DateUtils.getCurrentRotaryYear() ? 'selected' : ''}>${y}</option>`
    ).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Board Member Toggle -->
            <div class="form-group">
              <label class="form-label"><i data-lucide="star"></i> Board Member</label>
              <div class="admin-toggle-wrap">
                <label class="admin-toggle">
                  <input type="checkbox" name="is_board_member"
                         ${isEdit && memberData.is_board_member ? 'checked' : ''} />
                  <span class="admin-toggle-slider"></span>
                </label>
                <span>Mark as Board Member</span>
              </div>
            </div>

            <!-- Active Toggle -->
            <div class="form-group">
              <label class="form-label"><i data-lucide="check-circle"></i> Active Status</label>
              <div class="admin-toggle-wrap">
                <label class="admin-toggle">
                  <input type="checkbox" name="is_active"
                         ${isEdit ? (memberData.is_active ? 'checked' : '') : 'checked'} />
                  <span class="admin-toggle-slider"></span>
                </label>
                <span>Active Member</span>
              </div>
            </div>

            <!-- Photo Upload -->
            <div class="form-group admin-form-full">
              <label class="form-label"><i data-lucide="camera"></i> Professional Photo</label>
              <div class="file-upload-wrap neu-inset">
                <input type="file" id="mbr-photo-input" class="file-input" accept="image/*" />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span id="mbr-photo-label">
                    ${isEdit && memberData.professional_photo_url
        ? 'Change photo' : 'Upload professional photo'}
                  </span>
                </div>
              </div>
              ${isEdit && memberData.professional_photo_url ? `
              <div style="margin-top:8px;">
                <img src="${StringUtils.sanitize(memberData.professional_photo_url)}"
                     style="width:80px;height:80px;border-radius:50%;object-fit:cover;
                            box-shadow:var(--neu-shadow-sm);"
                     onerror="this.style.display='none'" />
              </div>` : ''}
            </div>

          </div>

          <div class="admin-form-actions">
            <button type="button" class="btn btn-outline"
                    onclick="membersAdmin.renderMembersList(document.getElementById('admin-content'), membersAdmin._currentDashboard)">
              <i data-lucide="x"></i><span>Cancel</span>
            </button>
            <button type="submit" class="btn btn-primary" id="mbr-submit-btn">
              <i data-lucide="${isEdit ? 'check-circle' : 'user-plus'}"></i>
              <span>${isEdit ? 'Update Member' : 'Add Member'}</span>
            </button>
          </div>

          <div class="form-message" id="mbr-form-msg"></div>
        </form>
      </div>
    `;

    document.getElementById('mbr-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitMemberForm(isEdit, isEdit ? memberData.id : null);
    });

    lucide.createIcons();
  }

  async submitMemberForm(isEdit, memberId) {
    const form = document.getElementById('mbr-form');
    const msgEl = document.getElementById('mbr-form-msg');
    const submitBtn = document.getElementById('mbr-submit-btn');

    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    if (!data.full_name?.trim()) { this.showMsg(msgEl, 'Name is required', 'error'); return; }
    if (!Validate.email(data.email)) { this.showMsg(msgEl, 'Valid email is required', 'error'); return; }
    if (!Validate.phone(data.phone)) { this.showMsg(msgEl, 'Valid phone number is required', 'error'); return; }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader-2"></i><span>Saving...</span>';
      lucide.createIcons();
    }

    try {
      let photoUrl = null;
      const photoInput = document.getElementById('mbr-photo-input');
      const photoFile = photoInput?.files?.[0];

      if (photoFile) {
        const compressed = await ImageUtils.compress(photoFile, 800, 800, 0.85);
        const filename = ImageUtils.generateFilename('member', 'jpg');
        const { data: uploadData, error: uploadError } = await this.db.storage
          .from(STORAGE_BUCKETS.AVATARS)
          .upload(filename, compressed, { contentType: 'image/jpeg', upsert: false });

        if (!uploadError && uploadData) {
          photoUrl = ImageUtils.getPublicUrl(STORAGE_BUCKETS.AVATARS, uploadData.path);
        }
      }

      const payload = {
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        ri_id: data.ri_id?.trim() || null,
        date_of_birth: data.date_of_birth || null,
        blood_group: data.blood_group || null,
        portfolio: data.portfolio?.trim() || null,
        role: data.role || 'member',
        avenue: data.avenue || null,
        area: data.area?.trim() || null,
        join_date: data.join_date || null,
        rotary_year: data.rotary_year || null,
        is_board_member: !!data.is_board_member,
        is_active: !!data.is_active,
        updated_at: new Date().toISOString()
      };

      if (photoUrl) payload.professional_photo_url = photoUrl;

      if (isEdit && memberId) {
        const { error } = await this.db.from('members').update(payload).eq('id', memberId);
        if (error) throw error;
      } else {
        const { error } = await this.db.from('members').insert(payload);
        if (error) throw error;

        await this.auth.logActivity(
          this.auth.getAdmin().id, 'MEMBER_CREATED', 'members', null,
          { name: payload.full_name, email: payload.email }
        );
      }

      this._currentDashboard?.showToast(
        isEdit ? 'Member updated!' : 'Member added!', 'success'
      );
      await this.renderMembersList(document.getElementById('admin-content'), this._currentDashboard);
    } catch (error) {
      console.error('Member form error:', error);
      this.showMsg(msgEl, `Failed: ${error.message}`, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="user-plus"></i><span>Add Member</span>';
        lucide.createIcons();
      }
    }
  }

  async toggleMemberStatus(memberId, currentActive) {
    if (!confirm(`${currentActive ? 'Deactivate' : 'Activate'} this member?`)) return;
    try {
      await this.db.from('members')
        .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
        .eq('id', memberId);
      this._currentDashboard?.showToast(
        `Member ${currentActive ? 'deactivated' : 'activated'}`, 'success'
      );
      await this.renderMembersList(document.getElementById('admin-content'), this._currentDashboard);
    } catch (e) {
      this._currentDashboard?.showToast('Failed to update status', 'error');
    }
  }

  async exportMembersList() {
    try {
      const { data } = await this.db
        .from('members')
        .select('full_name, email, phone, ri_id, blood_group, portfolio, role, area, date_of_birth, is_board_member, is_active')
        .eq('is_active', true)
        .order('full_name');

      if (!data || data.length === 0) {
        this._currentDashboard?.showToast('No members to export', 'warning');
        return;
      }

      const rows = data.map((m, i) => ({
        'S.No': i + 1,
        'Name': m.full_name,
        'Email': m.email,
        'Phone': m.phone,
        'RI ID': m.ri_id || '',
        'Blood Group': m.blood_group || '',
        'Portfolio': m.portfolio || ROLE_DISPLAY_NAMES[m.role] || '',
        'Area': m.area || '',
        'Date of Birth': m.date_of_birth ? DateUtils.format(m.date_of_birth, 'short') : '',
        'Board Member': m.is_board_member ? 'Yes' : 'No'
      }));

      if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
          { width: 6 }, { width: 25 }, { width: 25 }, { width: 16 },
          { width: 12 }, { width: 10 }, { width: 25 }, { width: 15 },
          { width: 14 }, { width: 12 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Members');
        XLSX.writeFile(wb, `Members_${DateUtils.getCurrentRotaryYear()}.xlsx`);
        this._currentDashboard?.showToast('Members exported!', 'success');
      }
    } catch (e) {
      this._currentDashboard?.showToast('Export failed', 'error');
    }
  }

  /* ============================================================
     BOARD MEMBERS
     ============================================================ */
  async renderBoardMembers(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: members } = await this.db
      .from('members')
      .select('*')
      .eq('is_active', true)
      .eq('is_board_member', true)
      .order('role');

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="star"></i> Board Members
          </h1>
          <p class="admin-section-subtitle">${members?.length || 0} board members</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${members?.map(m => {
      const portfolio = m.portfolio || ROLE_DISPLAY_NAMES[m.role] || 'Board Member';
      return `
            <div class="neu-card" style="padding:24px;text-align:center;">
              ${m.professional_photo_url
          ? `<img src="${StringUtils.sanitize(m.professional_photo_url)}"
                       style="width:80px;height:80px;border-radius:50%;object-fit:cover;
                              margin:0 auto 12px;display:block;box-shadow:var(--neu-shadow-sm);
                              border:3px solid var(--accent);"
                       loading="lazy"
                       onerror="this.outerHTML='<div style=\\'width:80px;height:80px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;\\'><i data-lucide=\\'user\\' style=\\'width:36px;height:36px;color:var(--accent)\\'></i></div>'" />`
          : `<div style="width:80px;height:80px;border-radius:50%;background:var(--accent-light);
                          display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
                <i data-lucide="user" style="width:36px;height:36px;color:var(--accent)"></i>
              </div>`
        }
              <h3 style="font-size:1rem;font-weight:700;color:var(--text-heading);margin-bottom:6px;">
                ${StringUtils.sanitize(m.full_name)}
              </h3>
              <span style="display:inline-block;padding:3px 12px;border-radius:var(--border-radius-full);
                           background:var(--accent-light);color:var(--accent);
                           font-size:0.75rem;font-weight:600;margin-bottom:8px;">
                ${StringUtils.sanitize(portfolio)}
              </span>
              <div style="font-size:0.78rem;color:var(--text-muted);">
                ${m.ri_id ? `RI ID: ${StringUtils.sanitize(m.ri_id)}` : ''}
                ${m.blood_group ? ` | ${m.blood_group}` : ''}
              </div>
            </div>
          `;
    }).join('') || '<div class="admin-empty-state"><i data-lucide="users"></i><p>No board members</p></div>'}
      </div>
    `;
    lucide.createIcons();
  }

  /* ============================================================
     MEMBERSHIP APPLICATIONS
     ============================================================ */
  async renderApplications(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: applications } = await this.db
      .from('membership_applications')
      .select('*')
      .order('created_at', { ascending: false });

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="inbox"></i> Membership Applications
          </h1>
          <p class="admin-section-subtitle">${applications?.length || 0} total applications</p>
        </div>
      </div>
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Contact</th>
                <th>DOB</th>
                <th>Blood</th>
                <th>Area</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${!applications || applications.length === 0
        ? '<tr><td colspan="8" class="admin-table-empty"><i data-lucide="inbox"></i><span>No applications</span></td></tr>'
        : applications.map(app => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      ${app.professional_photo_url
            ? `<img src="${StringUtils.sanitize(app.professional_photo_url)}"
                             style="width:32px;height:32px;border-radius:50%;object-fit:cover;"
                             loading="lazy" onerror="this.style.display='none'" />`
            : ''}
                      <span style="font-weight:600;color:var(--text-heading);">
                        ${StringUtils.sanitize(app.full_name)}
                      </span>
                    </div>
                  </td>
                  <td style="font-size:0.78rem;">
                    <div>${StringUtils.sanitize(app.email)}</div>
                    <div style="color:var(--text-muted);">${StringUtils.sanitize(app.phone)}</div>
                  </td>
                  <td style="font-size:0.82rem;">
                    ${app.date_of_birth ? DateUtils.format(app.date_of_birth, 'short') : '—'}
                  </td>
                  <td>
                    ${app.blood_group
            ? `<span style="display:inline-flex;width:26px;height:26px;border-radius:50%;
                               background:var(--danger-light);color:var(--danger);
                               font-size:0.62rem;font-weight:800;
                               align-items:center;justify-content:center;">${app.blood_group}</span>`
            : '—'}
                  </td>
                  <td style="font-size:0.78rem;max-width:100px;overflow:hidden;
                             text-overflow:ellipsis;white-space:nowrap;">
                    ${StringUtils.sanitize(app.area || '—')}
                  </td>
                  <td>
                    <span class="admin-status-badge"
                          style="background:${app.status === 'approved' ? 'var(--success-light)' :
            app.status === 'rejected' ? 'var(--danger-light)' :
              'var(--warning-light)'};
                                 color:${app.status === 'approved' ? 'var(--success)' :
            app.status === 'rejected' ? 'var(--danger)' :
              'var(--warning)'};">
                      ${StringUtils.capitalize(app.status)}
                    </span>
                  </td>
                  <td style="font-size:0.78rem;color:var(--text-muted);">
                    ${dashboard.getTimeAgo(app.created_at)}
                  </td>
                  <td>
                    <div class="admin-table-actions">
                      ${app.status === 'pending' ? `
                      <button class="admin-action-btn admin-action-success"
                              onclick="membersAdmin.approveApplication('${app.id}')"
                              title="Approve">
                        <i data-lucide="check-circle"></i>
                      </button>
                      <button class="admin-action-btn admin-action-danger"
                              onclick="membersAdmin.rejectApplication('${app.id}')"
                              title="Reject">
                        <i data-lucide="x-circle"></i>
                      </button>` : ''}
                      ${app.message ? `
                      <button class="admin-action-btn"
                              onclick="alert('${StringUtils.sanitize(app.message).replace(/'/g, "\\'")}')"
                              title="View Message">
                        <i data-lucide="message-square"></i>
                      </button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  async approveApplication(appId) {
    try {
      const { data: app } = await this.db
        .from('membership_applications')
        .select('*')
        .eq('id', appId)
        .single();

      if (!app) return;

      // Create member from application
      await this.db.from('members').insert({
        full_name: app.full_name,
        email: app.email,
        phone: app.phone,
        date_of_birth: app.date_of_birth,
        blood_group: app.blood_group,
        professional_photo_url: app.professional_photo_url,
        area: app.area,
        is_active: true,
        is_board_member: false,
        role: 'member'
      });

      await this.db
        .from('membership_applications')
        .update({
          status: 'approved',
          reviewed_by: this.auth.getAdmin().id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', appId);

      this._currentDashboard?.showToast('Application approved! Member created.', 'success');
      await this.renderApplications(document.getElementById('admin-content'), this._currentDashboard);
    } catch (e) {
      this._currentDashboard?.showToast('Failed to approve application', 'error');
    }
  }

  async rejectApplication(appId) {
    const reason = prompt('Rejection reason (optional):');
    try {
      await this.db
        .from('membership_applications')
        .update({
          status: 'rejected',
          reviewed_by: this.auth.getAdmin().id,
          reviewed_at: new Date().toISOString(),
          review_notes: reason || null
        })
        .eq('id', appId);

      this._currentDashboard?.showToast('Application rejected', 'warning');
      await this.renderApplications(document.getElementById('admin-content'), this._currentDashboard);
    } catch (e) {
      this._currentDashboard?.showToast('Failed to reject application', 'error');
    }
  }

  /* ============================================================
     NEWSLETTERS / BULLETINS
     ============================================================ */
  async renderNewsletters(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: newsletters } = await this.db
      .from('newsletters')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="newspaper"></i> Monthly Bulletins
          </h1>
        </div>
        <button class="btn btn-primary" onclick="membersAdmin.showNewsletterForm()">
          <i data-lucide="plus-circle"></i>
          <span>Add Bulletin</span>
        </button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;">
        ${newsletters?.map(nl => `
          <div class="neu-card" style="overflow:hidden;">
            ${nl.cover_image_url
          ? `<img src="${StringUtils.sanitize(nl.cover_image_url)}"
                     style="width:100%;height:180px;object-fit:cover;"
                     loading="lazy"
                     onerror="this.style.display='none'" />`
          : `<div style="height:180px;background:linear-gradient(135deg,var(--accent-light),var(--bg-secondary));
                          display:flex;align-items:center;justify-content:center;">
                <i data-lucide="newspaper" style="width:48px;height:48px;color:var(--accent);opacity:0.5;"></i>
              </div>`}
            <div style="padding:16px;">
              <div style="font-size:0.72rem;font-weight:700;color:var(--accent);
                          text-transform:uppercase;margin-bottom:6px;">
                ${StringUtils.sanitize(nl.month)} ${nl.year}
              </div>
              <h4 style="font-size:0.9rem;font-weight:700;color:var(--text-heading);margin-bottom:8px;">
                ${StringUtils.sanitize(nl.title)}
              </h4>
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:12px;">
                <span class="admin-status-badge"
                      style="background:${nl.is_published ? 'var(--success-light)' : 'var(--warning-light)'};
                             color:${nl.is_published ? 'var(--success)' : 'var(--warning)'};">
                  ${nl.is_published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-outline btn-sm"
                        onclick="membersAdmin.editNewsletter('${nl.id}')">
                  <i data-lucide="pencil"></i>
                </button>
                ${!nl.is_published ? `
                <button class="btn btn-success btn-sm"
                        onclick="membersAdmin.publishNewsletter('${nl.id}')">
                  <i data-lucide="check-circle"></i>
                  <span>Publish</span>
                </button>` : ''}
                ${nl.pdf_url ? `
                <a href="${StringUtils.sanitize(nl.pdf_url)}" target="_blank"
                   class="btn btn-outline btn-sm">
                  <i data-lucide="download"></i>
                </a>` : ''}
                <button class="btn btn-outline btn-sm admin-action-danger"
                        onclick="membersAdmin.deleteNewsletter('${nl.id}')"
                        style="color:var(--danger);border-color:var(--danger);">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          </div>
        `).join('') || `
        <div class="admin-empty-state" style="grid-column:1/-1;">
          <i data-lucide="newspaper"></i>
          <p>No bulletins yet</p>
        </div>`}
      </div>
    `;
    lucide.createIcons();
  }

  showNewsletterForm(nlData = null) {
    const isEdit = !!nlData;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'nl-form-modal';

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:520px;">
        <div class="modal-header">
          <h2 class="modal-title">
            <i data-lucide="${isEdit ? 'pencil' : 'plus-circle'}"></i>
            ${isEdit ? 'Edit' : 'Add'} Bulletin
          </h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('nl-form-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="nl-form">
            <div class="form-group">
              <label class="form-label"><i data-lucide="type"></i> Title *</label>
              <div class="input-wrap neu-inset">
                <input type="text" name="title" class="form-input" placeholder="Bulletin title"
                       value="${isEdit ? StringUtils.sanitize(nlData.title) : ''}" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label"><i data-lucide="calendar"></i> Month *</label>
                <div class="select-wrap neu-inset">
                  <select name="month" class="form-select" required>
                    ${months.map(m =>
      `<option value="${m}" ${isEdit && nlData.month === m ? 'selected' : ''}>${m}</option>`
    ).join('')}
                  </select>
                  <i data-lucide="chevron-down" class="select-arrow"></i>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label"><i data-lucide="hash"></i> Year *</label>
                <div class="input-wrap neu-inset">
                  <input type="number" name="year" class="form-input"
                         value="${isEdit ? nlData.year : new Date().getFullYear()}" required />
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label"><i data-lucide="file-text"></i> Description</label>
              <div class="input-wrap neu-inset">
                <textarea name="description" class="form-textarea" rows="2"
                          placeholder="Brief description...">${isEdit ? StringUtils.sanitize(nlData.description || '') : ''}</textarea>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label"><i data-lucide="image"></i> Cover Image</label>
              <div class="file-upload-wrap neu-inset">
                <input type="file" id="nl-cover-input" class="file-input" accept="image/*" />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span>Upload cover image</span>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label"><i data-lucide="file"></i> PDF File</label>
              <div class="file-upload-wrap neu-inset">
                <input type="file" id="nl-pdf-input" class="file-input" accept="application/pdf" />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span>Upload PDF</span>
                </div>
              </div>
            </div>
            <div class="admin-form-actions" style="padding:0;margin-top:16px;">
              <button type="button" class="btn btn-outline"
                      onclick="document.getElementById('nl-form-modal').remove();document.body.style.overflow='';">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                <i data-lucide="save"></i><span>${isEdit ? 'Update' : 'Save'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById('nl-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());

      try {
        let coverUrl = isEdit ? nlData.cover_image_url : null;
        let pdfUrl = isEdit ? nlData.pdf_url : null;

        // Upload cover
        const coverFile = document.getElementById('nl-cover-input')?.files?.[0];
        if (coverFile) {
          const compressed = await ImageUtils.compress(coverFile, 1200, 1600, 0.85);
          const filename = `newsletter_cover_${Date.now()}.jpg`;
          const { data: upData, error } = await this.db.storage
            .from(STORAGE_BUCKETS.NEWSLETTERS)
            .upload(filename, compressed, { contentType: 'image/jpeg' });
          if (!error && upData) {
            coverUrl = ImageUtils.getPublicUrl(STORAGE_BUCKETS.NEWSLETTERS, upData.path);
          }
        }

        // Upload PDF
        const pdfFile = document.getElementById('nl-pdf-input')?.files?.[0];
        if (pdfFile) {
          const filename = `newsletter_${Date.now()}.pdf`;
          const { data: upData, error } = await this.db.storage
            .from(STORAGE_BUCKETS.NEWSLETTERS)
            .upload(filename, pdfFile, { contentType: 'application/pdf' });
          if (!error && upData) {
            pdfUrl = ImageUtils.getPublicUrl(STORAGE_BUCKETS.NEWSLETTERS, upData.path);
          }
        }

        const payload = {
          title: data.title.trim(),
          month: data.month,
          year: parseInt(data.year),
          description: data.description?.trim() || null,
          cover_image_url: coverUrl,
          pdf_url: pdfUrl,
          created_by: this.auth.getAdmin().id,
          updated_at: new Date().toISOString()
        };

        if (isEdit) {
          await this.db.from('newsletters').update(payload).eq('id', nlData.id);
        } else {
          await this.db.from('newsletters').insert(payload);
        }

        modal.remove();
        document.body.style.overflow = '';
        this._currentDashboard?.showToast(isEdit ? 'Bulletin updated' : 'Bulletin added', 'success');
        await this.renderNewsletters(document.getElementById('admin-content'), this._currentDashboard);
      } catch (err) {
        this._currentDashboard?.showToast('Failed to save bulletin', 'error');
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });

    lucide.createIcons();
  }

  async editNewsletter(nlId) {
    const { data } = await this.db.from('newsletters').select('*').eq('id', nlId).single();
    if (data) this.showNewsletterForm(data);
  }

  async publishNewsletter(nlId) {
    try {
      await this.db.from('newsletters')
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq('id', nlId);
      this._currentDashboard?.showToast('Bulletin published!', 'success');
      await this.renderNewsletters(document.getElementById('admin-content'), this._currentDashboard);
    } catch (e) {
      this._currentDashboard?.showToast('Failed to publish', 'error');
    }
  }

  async deleteNewsletter(nlId) {
    if (!confirm('Delete this bulletin?')) return;
    try {
      await this.db.from('newsletters').delete().eq('id', nlId);
      this._currentDashboard?.showToast('Bulletin deleted', 'success');
      await this.renderNewsletters(document.getElementById('admin-content'), this._currentDashboard);
    } catch (e) {
      this._currentDashboard?.showToast('Failed to delete', 'error');
    }
  }

  /* ============================================================
     BLOOD REQUESTS
     ============================================================ */
  async renderBloodRequests(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: requests } = await this.db
      .from('blood_requests')
      .select('*')
      .order('created_at', { ascending: false });

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="droplets"></i> Blood Requests
          </h1>
          <p class="admin-section-subtitle">${requests?.length || 0} total requests</p>
        </div>
      </div>
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Blood Group</th>
                <th>Units</th>
                <th>Hospital</th>
                <th>Contact</th>
                <th>Required By</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${!requests || requests.length === 0
        ? '<tr><td colspan="9" class="admin-table-empty"><i data-lucide="droplets"></i><span>No blood requests</span></td></tr>'
        : requests.map(req => {
          const urgencyColors = {
            normal: { bg: 'var(--success-light)', color: 'var(--success)' },
            urgent: { bg: 'var(--warning-light)', color: 'var(--warning)' },
            critical: { bg: 'var(--danger-light)', color: 'var(--danger)' }
          };
          const urg = urgencyColors[req.urgency_level] || urgencyColors.normal;
          return `
                  <tr>
                    <td style="font-weight:600;color:var(--text-heading);">
                      ${StringUtils.sanitize(req.patient_name)}
                    </td>
                    <td>
                      <span style="display:inline-flex;width:32px;height:32px;border-radius:50%;
                                   background:var(--danger-light);color:var(--danger);
                                   font-size:0.72rem;font-weight:800;
                                   align-items:center;justify-content:center;">
                        ${req.blood_group}
                      </span>
                    </td>
                    <td style="font-weight:700;font-size:0.9rem;">${req.units_required}</td>
                    <td style="font-size:0.82rem;">${StringUtils.sanitize(req.hospital_name)}</td>
                    <td style="font-size:0.78rem;">
                      <div>${StringUtils.sanitize(req.contact_name)}</div>
                      <div style="color:var(--text-muted);">${StringUtils.sanitize(req.contact_phone)}</div>
                    </td>
                    <td style="font-size:0.82rem;">${DateUtils.format(req.required_date, 'short')}</td>
                    <td>
                      <span class="admin-status-badge"
                            style="background:${urg.bg};color:${urg.color};">
                        ${StringUtils.capitalize(req.urgency_level)}
                      </span>
                    </td>
                    <td>
                      <span class="admin-status-badge"
                            style="background:${req.status === 'fulfilled' ? 'var(--success-light)' :
              req.status === 'active' ? 'var(--warning-light)' : 'var(--bg-secondary)'};
                                   color:${req.status === 'fulfilled' ? 'var(--success)' :
              req.status === 'active' ? 'var(--warning)' : 'var(--text-muted)'};">
                        ${StringUtils.capitalize(req.status)}
                      </span>
                    </td>
                    <td>
                      <div class="admin-table-actions">
                        ${req.status === 'active' ? `
                        <button class="admin-action-btn admin-action-success"
                                onclick="membersAdmin.fulfillBloodRequest('${req.id}')"
                                title="Mark Fulfilled">
                          <i data-lucide="check-circle"></i>
                        </button>
                        <button class="admin-action-btn admin-action-danger"
                                onclick="membersAdmin.closeBloodRequest('${req.id}')"
                                title="Close Request">
                          <i data-lucide="x-circle"></i>
                        </button>` : ''}
                      </div>
                    </td>
                  </tr>
                `;
        }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  async fulfillBloodRequest(reqId) {
    const donor = prompt('Fulfilled by (donor name):');
    if (!donor) return;
    try {
      await this.db.from('blood_requests')
        .update({ status: 'fulfilled', fulfilled_by: donor, updated_at: new Date().toISOString() })
        .eq('id', reqId);
      this._currentDashboard?.showToast('Blood request marked as fulfilled', 'success');
      await this.renderBloodRequests(document.getElementById('admin-content'), this._currentDashboard);
    } catch (e) {
      this._currentDashboard?.showToast('Failed to update', 'error');
    }
  }

  async closeBloodRequest(reqId) {
    try {
      await this.db.from('blood_requests')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', reqId);
      this._currentDashboard?.showToast('Request closed', 'success');
      await this.renderBloodRequests(document.getElementById('admin-content'), this._currentDashboard);
    } catch (e) {
      this._currentDashboard?.showToast('Failed to close request', 'error');
    }
  }

  /* ============================================================
     PAST LEADERS
     ============================================================ */
  async renderPastLeaders(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: leaders } = await this.db
      .from('past_leaders')
      .select('*')
      .order('year_start', { ascending: false })
      .order('sort_order');

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="crown"></i> Past Presidents &amp; Secretaries
          </h1>
        </div>
        <button class="btn btn-primary" onclick="membersAdmin.showPastLeaderForm()">
          <i data-lucide="plus-circle"></i>
          <span>Add Leader</span>
        </button>
      </div>
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Portfolio</th>
                <th>Rotary Year</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${!leaders || leaders.length === 0
        ? '<tr><td colspan="5" class="admin-table-empty"><i data-lucide="crown"></i><span>No past leaders added</span></td></tr>'
        : leaders.map(l => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      ${l.photo_url
            ? `<img src="${StringUtils.sanitize(l.photo_url)}"
                             style="width:32px;height:32px;border-radius:6px;object-fit:cover;"
                             loading="lazy" onerror="this.style.display='none'" />`
            : ''}
                      <span style="font-weight:600;color:var(--text-heading);">
                        ${StringUtils.sanitize(l.full_name)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style="font-size:0.78rem;padding:2px 8px;border-radius:var(--border-radius-full);
                                 background:var(--accent-light);color:var(--accent);font-weight:600;">
                      ${StringUtils.sanitize(l.portfolio)}
                    </span>
                  </td>
                  <td style="font-size:0.82rem;">${StringUtils.sanitize(l.rotary_year)}</td>
                  <td style="font-size:0.78rem;color:var(--text-muted);">
                    ${StringUtils.sanitize(l.email || '—')}
                  </td>
                  <td>
                    <div class="admin-table-actions">
                      <button class="admin-action-btn"
                              onclick="membersAdmin.editPastLeader('${l.id}')" title="Edit">
                        <i data-lucide="pencil"></i>
                      </button>
                      <button class="admin-action-btn admin-action-danger"
                              onclick="membersAdmin.deletePastLeader('${l.id}')" title="Delete">
                        <i data-lucide="trash-2"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    lucide.createIcons();
  }

  showPastLeaderForm(leaderData = null) {
    const isEdit = !!leaderData;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'leader-form-modal';

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:520px;">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? 'Edit' : 'Add'} Past Leader</h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('leader-form-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="leader-form">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <div class="input-wrap neu-inset">
                <input type="text" name="full_name" class="form-input"
                       value="${isEdit ? StringUtils.sanitize(leaderData.full_name) : ''}" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Portfolio *</label>
                <div class="select-wrap neu-inset">
                  <select name="portfolio" class="form-select" required>
                    <option value="President" ${isEdit && leaderData.portfolio === 'President' ? 'selected' : ''}>President</option>
                    <option value="Secretary" ${isEdit && leaderData.portfolio === 'Secretary' ? 'selected' : ''}>Secretary</option>
                    <option value="Secretary Administration" ${isEdit && leaderData.portfolio === 'Secretary Administration' ? 'selected' : ''}>Secretary Administration</option>
                    <option value="Secretary Communication" ${isEdit && leaderData.portfolio === 'Secretary Communication' ? 'selected' : ''}>Secretary Communication</option>
                  </select>
                  <i data-lucide="chevron-down" class="select-arrow"></i>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Rotary Year *</label>
                <div class="select-wrap neu-inset">
                  <select name="rotary_year" class="form-select" required>
                    ${ROTARY_YEARS.map(y =>
      `<option value="${y}" ${isEdit && leaderData.rotary_year === y ? 'selected' : ''}>${y}</option>`
    ).join('')}
                  </select>
                  <i data-lucide="chevron-down" class="select-arrow"></i>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <div class="input-wrap neu-inset">
                <input type="email" name="email" class="form-input"
                       value="${isEdit ? StringUtils.sanitize(leaderData.email || '') : ''}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <div class="input-wrap neu-inset">
                <input type="tel" name="phone" class="form-input"
                       value="${isEdit ? StringUtils.sanitize(leaderData.phone || '') : ''}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Sort Order (lower = first)</label>
              <div class="input-wrap neu-inset">
                <input type="number" name="sort_order" class="form-input" min="0"
                       value="${isEdit ? (leaderData.sort_order || 0) : 0}" />
              </div>
            </div>
            <div class="admin-form-actions" style="padding:0;margin-top:16px;">
              <button type="button" class="btn btn-outline"
                      onclick="document.getElementById('leader-form-modal').remove();document.body.style.overflow='';">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                <i data-lucide="save"></i><span>${isEdit ? 'Update' : 'Save'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById('leader-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      const yearParts = data.rotary_year.split('-');

      const payload = {
        full_name: data.full_name.trim(),
        portfolio: data.portfolio,
        rotary_year: data.rotary_year,
        year_start: parseInt(yearParts[0]),
        year_end: parseInt('20' + yearParts[1]),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        sort_order: parseInt(data.sort_order) || 0
      };

      try {
        if (isEdit) {
          await this.db.from('past_leaders').update(payload).eq('id', leaderData.id);
        } else {
          await this.db.from('past_leaders').insert(payload);
        }
        modal.remove();
        document.body.style.overflow = '';
        this._currentDashboard?.showToast(isEdit ? 'Leader updated' : 'Leader added', 'success');
        await this.renderPastLeaders(document.getElementById('admin-content'), this._currentDashboard);
      } catch (err) {
        this._currentDashboard?.showToast('Failed to save', 'error');
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });

    lucide.createIcons();
  }

  async editPastLeader(id) {
    const { data } = await this.db.from('past_leaders').select('*').eq('id', id).single();
    if (data) this.showPastLeaderForm(data);
  }

  async deletePastLeader(id) {
    if (!confirm('Delete this past leader?')) return;
    try {
      await this.db.from('past_leaders').delete().eq('id', id);
      this._currentDashboard?.showToast('Leader deleted', 'success');
      await this.renderPastLeaders(document.getElementById('admin-content'), this._currentDashboard);
    } catch (e) {
      this._currentDashboard?.showToast('Failed to delete', 'error');
    }
  }

  /* ============================================================
     NOTIFICATIONS
     ============================================================ */
  async renderNotifications(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: notifications } = await this.db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="bell"></i> Notifications
          </h1>
        </div>
        ${this.auth.can('SEND_NOTIFICATIONS') ? `
        <button class="btn btn-primary" onclick="membersAdmin.showNotificationForm()">
          <i data-lucide="send"></i>
          <span>Send Notification</span>
        </button>` : ''}
      </div>
      <div class="admin-card neu-card">
        ${!notifications || notifications.length === 0
        ? `<div class="admin-empty-state" style="padding:60px;">
              <i data-lucide="bell-off"></i>
              <p>No notifications</p>
            </div>`
        : `<div style="display:flex;flex-direction:column;">
            ${notifications.map(n => {
          const icons = { info: 'info', warning: 'alert-triangle', error: 'alert-circle', success: 'check-circle' };
          const colors = { info: 'var(--accent)', warning: 'var(--warning)', error: 'var(--danger)', success: 'var(--success)' };
          return `
                <div class="admin-list-item" style="border-left:3px solid ${colors[n.type] || colors.info};">
                  <div class="admin-list-icon" style="background:${colors[n.type] || colors.info}20;color:${colors[n.type] || colors.info};">
                    <i data-lucide="${icons[n.type] || 'bell'}"></i>
                  </div>
                  <div class="admin-list-info">
                    <div class="admin-list-title">${StringUtils.sanitize(n.title)}</div>
                    <div class="admin-list-meta">${StringUtils.sanitize(n.message)}</div>
                  </div>
                  <span style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;">
                    ${dashboard.getTimeAgo(n.created_at)}
                  </span>
                </div>
              `;
        }).join('')}
          </div>`}
      </div>
    `;
    lucide.createIcons();
  }

  showNotificationForm() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'notif-form-modal';

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:480px;">
        <div class="modal-header">
          <h2 class="modal-title"><i data-lucide="send"></i> Send Notification</h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('notif-form-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="notif-form">
            <div class="form-group">
              <label class="form-label">Title *</label>
              <div class="input-wrap neu-inset">
                <input type="text" name="title" class="form-input" placeholder="Notification title" required />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Message *</label>
              <div class="input-wrap neu-inset">
                <textarea name="message" class="form-textarea" rows="4"
                          placeholder="Notification message..." required></textarea>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <div class="select-wrap neu-inset">
                <select name="type" class="form-select">
                  <option value="info">Information</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>
            <div class="admin-form-actions" style="padding:0;margin-top:16px;">
              <button type="button" class="btn btn-outline"
                      onclick="document.getElementById('notif-form-modal').remove();document.body.style.overflow='';">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                <i data-lucide="send"></i><span>Send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById('notif-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());

      try {
        await this.db.from('notifications').insert({
          title: data.title.trim(),
          message: data.message.trim(),
          type: data.type,
          is_global: true,
          created_by: this.auth.getAdmin().id
        });

        modal.remove();
        document.body.style.overflow = '';
        this._currentDashboard?.showToast('Notification sent!', 'success');
        await this.renderNotifications(document.getElementById('admin-content'), this._currentDashboard);
      } catch (err) {
        this._currentDashboard?.showToast('Failed to send notification', 'error');
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });

    lucide.createIcons();
  }

  /* ============================================================
     MEMBER FORM (for dashboard stub)
     ============================================================ */
  renderMemberForm(container, dashboard, data) {
    this._currentDashboard = dashboard;
    this.showMemberForm(data?.id || null);
  }

  /* ============================================================
     HELPER
     ============================================================ */
  showMsg(el, message, type) {
    if (el) {
      el.textContent = message;
      el.className = `form-message ${type}`;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const membersAdmin = new MembersAdminManager();
window.membersAdmin = membersAdmin;

// Connect to admin dashboard
if (window.adminDashboard) {
  window.adminDashboard.renderMembersList = async (c) => { await membersAdmin.renderMembersList(c, window.adminDashboard); };
  window.adminDashboard.renderMemberForm = (c, d) => { membersAdmin.renderMemberForm(c, window.adminDashboard, d); };
  window.adminDashboard.renderBoardMembers = async (c) => { await membersAdmin.renderBoardMembers(c, window.adminDashboard); };
  window.adminDashboard.renderApplications = async (c) => { await membersAdmin.renderApplications(c, window.adminDashboard); };
  window.adminDashboard.renderNewsletters = async (c) => { await membersAdmin.renderNewsletters(c, window.adminDashboard); };
  window.adminDashboard.renderBloodRequests = async (c) => { await membersAdmin.renderBloodRequests(c, window.adminDashboard); };
  window.adminDashboard.renderPastLeaders = async (c) => { await membersAdmin.renderPastLeaders(c, window.adminDashboard); };
  window.adminDashboard.renderNotifications = async (c) => { await membersAdmin.renderNotifications(c, window.adminDashboard); };
}
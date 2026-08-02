/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Reports Admin Manager - js/reports-admin.js
   Complete reports, monthly reports, DPP reports management
   ============================================================ */

'use strict';

class ReportsAdminManager {
  constructor() {
    this.db = getSupabaseClient();
    this.auth = window.authManager;
    this._currentDashboard = null;
  }

  /* ============================================================
     REPORTS LIST
     ============================================================ */
  async renderReportsList(container, dashboard) {
    this._currentDashboard = dashboard;

    const admin = this.auth.getAdmin();
    const accessibleAvenues = this.auth.getAccessibleAvenues();

    let query = this.db
      .from('event_reports')
      .select(`
        *,
        events(
          id, title, avenue, event_date, start_time, venue,
          event_chair, event_secretary, group_number, is_dpp,
          status, actual_attendance, beneficiaries, service_hours
        ),
        admin_users!event_reports_submitted_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    const { data: reports, error } = await query;

    if (error) {
      dashboard.showToast('Failed to load reports', 'error');
      return;
    }

    // Filter by accessible avenues for restricted roles
    let filteredReports = reports || [];
    if (!this.auth.isFullAccess()) {
      filteredReports = filteredReports.filter(r =>
        r.events && accessibleAvenues.includes(r.events.avenue)
      );
    }

    const pendingReports = filteredReports.filter(r => !r.is_approved);
    const approvedReports = filteredReports.filter(r => r.is_approved);

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="file-text"></i> Event Reports
          </h1>
          <p class="admin-section-subtitle">
            ${filteredReports.length} total •
            <span style="color:var(--warning);">${pendingReports.length} pending</span> •
            <span style="color:var(--success);">${approvedReports.length} approved</span>
          </p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') ? `
          <button class="btn btn-outline" onclick="reportsAdmin.showDownloadModal()">
            <i data-lucide="download"></i>
            <span>Download Reports</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
                  gap:12px;margin-bottom:20px;">
        <div class="neu-card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--warning);">
            ${pendingReports.length}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">
            Pending Approval
          </div>
        </div>
        <div class="neu-card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--success);">
            ${approvedReports.length}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">
            Approved
          </div>
        </div>
        ${Object.entries(AVENUES).map(([key, avenue]) => {
      const count = filteredReports.filter(
        r => r.events?.avenue === key && r.is_approved
      ).length;
      return `
          <div class="neu-card" style="padding:12px;text-align:center;cursor:pointer;"
               onclick="reportsAdmin.filterByAvenue('${key}')">
            <div style="font-size:1.2rem;font-weight:800;color:${avenue.color};">${count}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);font-weight:600;">
              ${avenue.shortLabel}
            </div>
          </div>
        `;
    }).join('')}
      </div>

      <!-- Filters -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-filters-row">
          <div class="input-wrap neu-inset" style="flex:1;max-width:300px;">
            <i data-lucide="search" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;"></i>
            <input type="text" id="rpt-search" class="form-input"
                   placeholder="Search by event name..."
                   oninput="reportsAdmin.applyFilters()" />
          </div>
          <div class="select-wrap neu-inset" style="min-width:160px;">
            <select id="rpt-avenue-filter" class="form-select"
                    onchange="reportsAdmin.applyFilters()">
              <option value="">All Avenues</option>
              ${accessibleAvenues.map(a =>
      `<option value="${a}">${AVENUES[a]?.label || a}</option>`
    ).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:160px;">
            <select id="rpt-status-filter" class="form-select"
                    onchange="reportsAdmin.applyFilters()">
              <option value="">All Status</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:130px;">
            <select id="rpt-dpp-filter" class="form-select"
                    onchange="reportsAdmin.applyFilters()">
              <option value="">All Types</option>
              <option value="dpp">DPP Only</option>
              <option value="regular">Regular Only</option>
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
        </div>
      </div>

      <!-- Reports Table -->
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table" id="rpt-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Avenue</th>
                <th>Date</th>
                <th>Submitted By</th>
                <th>Attendance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="rpt-table-body">
              ${this.renderReportRows(filteredReports)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this._allReports = filteredReports;
    lucide.createIcons();
  }

  renderReportRows(reports) {
    if (!reports || reports.length === 0) {
      return `<tr><td colspan="7" class="admin-table-empty">
        <i data-lucide="file-x"></i>
        <span>No reports found</span>
      </td></tr>`;
    }

    return reports.map(report => {
      const event = report.events;
      if (!event) return '';

      const avenue = AVENUES[event.avenue] || {};
      return `
        <tr data-report-id="${report.id}"
            data-avenue="${event.avenue}"
            data-status="${report.is_approved ? 'approved' : 'pending'}"
            data-is-dpp="${event.is_dpp}">
          <td>
            <div style="font-weight:600;color:var(--text-heading);
                        display:flex;align-items:center;gap:6px;">
              ${event.is_dpp ? '<span class="admin-dpp-badge">DPP</span>' : ''}
              ${StringUtils.sanitize(event.title)}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);">
              Chair: ${StringUtils.sanitize(event.event_chair || '—')}
            </div>
          </td>
          <td>
            <span class="admin-avenue-badge"
                  style="background:${avenue.bgColor};color:${avenue.color};">
              ${avenue.shortLabel || StringUtils.snakeToTitle(event.avenue)}
            </span>
          </td>
          <td style="white-space:nowrap;font-size:0.84rem;">
            ${DateUtils.format(event.event_date, 'short')}
          </td>
          <td style="font-size:0.82rem;color:var(--text-secondary);">
            ${StringUtils.sanitize(report.admin_users?.full_name || '—')}
          </td>
          <td style="font-size:0.82rem;">
            ${event.actual_attendance
          ? `${event.actual_attendance} participants`
          : '—'}
          </td>
          <td>
            <span class="admin-status-badge"
                  style="background:${report.is_approved
          ? 'var(--success-light)' : 'var(--warning-light)'};
                         color:${report.is_approved
          ? 'var(--success)' : 'var(--warning)'};">
              ${report.is_approved ? 'Approved' : 'Pending'}
            </span>
          </td>
          <td>
            <div class="admin-table-actions">
              <button class="admin-action-btn"
                      onclick="reportsAdmin.viewReport('${report.id}')"
                      title="View Report">
                <i data-lucide="eye"></i>
              </button>
              ${!report.is_approved && this.auth.can('APPROVE_REPORT') ? `
              <button class="admin-action-btn admin-action-success"
                      onclick="reportsAdmin.approveReport('${report.id}')"
                      title="Approve Report">
                <i data-lucide="check-circle"></i>
              </button>` : ''}
              ${report.is_approved ? `
              <button class="admin-action-btn"
                      onclick="reportsAdmin.downloadSingleReport('${event.id}')"
                      title="Download .docx">
                <i data-lucide="download"></i>
              </button>` : ''}
              ${this.auth.can('APPROVE_REPORT') ? `
              <button class="admin-action-btn admin-action-danger"
                      onclick="reportsAdmin.deleteReport('${report.id}')"
                      title="Delete">
                <i data-lucide="trash-2"></i>
              </button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* ============================================================
     FILTERS
     ============================================================ */
  applyFilters() {
    const search = document.getElementById('rpt-search')?.value?.toLowerCase() || '';
    const avenue = document.getElementById('rpt-avenue-filter')?.value || '';
    const status = document.getElementById('rpt-status-filter')?.value || '';
    const dpp = document.getElementById('rpt-dpp-filter')?.value || '';

    document.querySelectorAll('#rpt-table-body tr[data-report-id]').forEach(row => {
      const title = row.querySelector('td')?.textContent?.toLowerCase() || '';
      const rowAvenue = row.getAttribute('data-avenue') || '';
      const rowStatus = row.getAttribute('data-status') || '';
      const isDPP = row.getAttribute('data-is-dpp') === 'true';

      const matchSearch = !search || title.includes(search);
      const matchAvenue = !avenue || rowAvenue === avenue;
      const matchStatus = !status || rowStatus === status;
      const matchDPP = !dpp ||
        (dpp === 'dpp' && isDPP) ||
        (dpp === 'regular' && !isDPP);

      row.style.display = (matchSearch && matchAvenue && matchStatus && matchDPP)
        ? '' : 'none';
    });
  }

  filterByAvenue(avenue) {
    const select = document.getElementById('rpt-avenue-filter');
    if (select) { select.value = avenue; this.applyFilters(); }
  }

  /* ============================================================
     VIEW REPORT
     ============================================================ */
  async viewReport(reportId) {
    const { data: report, error } = await this.db
      .from('event_reports')
      .select(`
        *,
        events(
          id, title, avenue, event_date, start_time, end_time,
          venue, event_chair, event_secretary, group_number, is_dpp,
          actual_attendance, beneficiaries, service_hours,
          budget_proposed, budget_actual,
          event_photos(photo_url, is_action_photo, sort_order)
        )
      `)
      .eq('id', reportId)
      .single();

    if (error || !report) {
      this._currentDashboard?.showToast('Failed to load report', 'error');
      return;
    }

    const event = report.events;
    const avenue = AVENUES[event?.avenue] || {};
    const actionPhotos = event?.event_photos?.filter(p => p.is_action_photo) || [];
    const photos = report.photo_urls || [];
    const allPhotos = [...new Set([...photos, ...actionPhotos.map(p => p.photo_url)])];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'rpt-view-modal';

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:860px;max-height:92vh;">
        <div class="modal-header">
          <div class="modal-title-area">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span class="modal-avenue-badge"
                    style="background:${avenue.bgColor};color:${avenue.color};">
                ${avenue.label || StringUtils.snakeToTitle(event?.avenue)}
              </span>
              ${event?.is_dpp
        ? '<span class="admin-dpp-badge">District Priority Project</span>'
        : ''}
              <span class="admin-status-badge"
                    style="background:${report.is_approved
          ? 'var(--success-light)' : 'var(--warning-light)'};
                           color:${report.is_approved
          ? 'var(--success)' : 'var(--warning)'};">
                ${report.is_approved ? 'Approved' : 'Pending Approval'}
              </span>
            </div>
            <h2 class="modal-title">${StringUtils.sanitize(event?.title || '')}</h2>
          </div>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('rpt-view-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="modal-body" style="overflow-y:auto;">

          <!-- Event Details -->
          <div class="modal-details-grid" style="margin-bottom:20px;">
            <div class="modal-detail-item">
              <i data-lucide="calendar"></i>
              <div>
                <span class="modal-detail-label">Date</span>
                <span class="modal-detail-value">
                  ${DateUtils.format(event?.event_date, 'long')}
                </span>
              </div>
            </div>
            <div class="modal-detail-item">
              <i data-lucide="clock"></i>
              <div>
                <span class="modal-detail-label">Time</span>
                <span class="modal-detail-value">
                  ${DateUtils.formatTime(event?.start_time)}
                  ${event?.end_time ? ' to ' + DateUtils.formatTime(event.end_time) : ''}
                </span>
              </div>
            </div>
            <div class="modal-detail-item">
              <i data-lucide="map-pin"></i>
              <div>
                <span class="modal-detail-label">Venue</span>
                <span class="modal-detail-value">${StringUtils.sanitize(event?.venue || '')}</span>
              </div>
            </div>
            <div class="modal-detail-item">
              <i data-lucide="user-check"></i>
              <div>
                <span class="modal-detail-label">Event Chair</span>
                <span class="modal-detail-value">
                  ${StringUtils.sanitize(event?.event_chair || '—')}
                </span>
              </div>
            </div>
            ${event?.event_secretary ? `
            <div class="modal-detail-item">
              <i data-lucide="user"></i>
              <div>
                <span class="modal-detail-label">Event Secretary</span>
                <span class="modal-detail-value">
                  ${StringUtils.sanitize(event.event_secretary)}
                </span>
              </div>
            </div>` : ''}
            <div class="modal-detail-item">
              <i data-lucide="hash"></i>
              <div>
                <span class="modal-detail-label">Group</span>
                <span class="modal-detail-value">Group ${event?.group_number || '1'}</span>
              </div>
            </div>
            ${event?.actual_attendance ? `
            <div class="modal-detail-item">
              <i data-lucide="users"></i>
              <div>
                <span class="modal-detail-label">Attendance</span>
                <span class="modal-detail-value">${event.actual_attendance} participants</span>
              </div>
            </div>` : ''}
            ${event?.beneficiaries ? `
            <div class="modal-detail-item">
              <i data-lucide="heart"></i>
              <div>
                <span class="modal-detail-label">Beneficiaries</span>
                <span class="modal-detail-value">${event.beneficiaries}</span>
              </div>
            </div>` : ''}
            ${event?.service_hours ? `
            <div class="modal-detail-item">
              <i data-lucide="clock"></i>
              <div>
                <span class="modal-detail-label">Service Hours</span>
                <span class="modal-detail-value">${event.service_hours} hrs</span>
              </div>
            </div>` : ''}
            ${event?.budget_actual ? `
            <div class="modal-detail-item">
              <i data-lucide="indian-rupee"></i>
              <div>
                <span class="modal-detail-label">Budget</span>
                <span class="modal-detail-value">
                  Actual: ${StringUtils.formatCurrency(event.budget_actual)}
                </span>
              </div>
            </div>` : ''}
          </div>

          <!-- Report Content -->
          <div style="margin-bottom:20px;padding:16px;background:var(--bg-secondary);
                      border-radius:var(--border-radius-sm);">
            <h4 style="font-size:0.9rem;font-weight:700;color:var(--text-heading);
                        margin-bottom:10px;display:flex;align-items:center;gap:8px;">
              <i data-lucide="file-text" style="width:16px;height:16px;color:var(--accent);"></i>
              Report Content
            </h4>
            <p style="font-size:0.86rem;color:var(--text-secondary);line-height:1.8;
                      white-space:pre-wrap;">
              ${StringUtils.sanitize(report.report_content || '')}
            </p>
          </div>

          <!-- Highlights / Outcomes -->
          ${report.key_highlights || report.outcomes || report.challenges ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
                      gap:12px;margin-bottom:20px;">
            ${report.key_highlights ? `
            <div style="padding:14px;background:var(--success-light);
                        border-radius:var(--border-radius-sm);">
              <h5 style="font-size:0.8rem;font-weight:700;color:var(--success);
                          margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                <i data-lucide="star" style="width:13px;height:13px;"></i>Key Highlights
              </h5>
              <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.6;">
                ${StringUtils.sanitize(report.key_highlights)}
              </p>
            </div>` : ''}
            ${report.outcomes ? `
            <div style="padding:14px;background:var(--accent-light);
                        border-radius:var(--border-radius-sm);">
              <h5 style="font-size:0.8rem;font-weight:700;color:var(--accent);
                          margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                <i data-lucide="target" style="width:13px;height:13px;"></i>Outcomes
              </h5>
              <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.6;">
                ${StringUtils.sanitize(report.outcomes)}
              </p>
            </div>` : ''}
            ${report.challenges ? `
            <div style="padding:14px;background:var(--warning-light);
                        border-radius:var(--border-radius-sm);">
              <h5 style="font-size:0.8rem;font-weight:700;color:var(--warning);
                          margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                <i data-lucide="alert-triangle" style="width:13px;height:13px;"></i>Challenges
              </h5>
              <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.6;">
                ${StringUtils.sanitize(report.challenges)}
              </p>
            </div>` : ''}
            ${report.future_plans ? `
            <div style="padding:14px;background:var(--bg-secondary);
                        border-radius:var(--border-radius-sm);">
              <h5 style="font-size:0.8rem;font-weight:700;color:var(--text-heading);
                          margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                <i data-lucide="arrow-right-circle" style="width:13px;height:13px;"></i>Future Plans
              </h5>
              <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.6;">
                ${StringUtils.sanitize(report.future_plans)}
              </p>
            </div>` : ''}
          </div>` : ''}

          <!-- Action Photos -->
          ${allPhotos.length > 0 ? `
          <div class="modal-photos-section" style="margin-bottom:20px;">
            <h4>
              <i data-lucide="camera"></i>
              Action Photographs (${allPhotos.length})
            </h4>
            <div class="modal-photos-grid">
              ${allPhotos.map((url, idx) => `
                <div class="modal-photo-item"
                     onclick="reportsAdmin._viewPhoto(${idx}, ${JSON.stringify(allPhotos)})">
                  <img src="${StringUtils.sanitize(url)}"
                       alt="Action photo ${idx + 1}"
                       loading="lazy"
                       onerror="this.parentElement.style.display='none'" />
                </div>
              `).join('')}
            </div>
          </div>` : ''}

          <!-- Submission Info -->
          <div style="font-size:0.75rem;color:var(--text-muted);padding-top:12px;
                      border-top:1px solid var(--border-color);">
            Submitted: ${DateUtils.format(report.created_at, 'short')}
            ${report.approved_at
        ? ` • Approved: ${DateUtils.format(report.approved_at, 'short')}`
        : ''}
          </div>

          <!-- Actions -->
          <div class="modal-actions" style="margin-top:16px;flex-wrap:wrap;">
            ${!report.is_approved && this.auth.can('APPROVE_REPORT') ? `
            <button class="btn btn-success btn-sm"
                    onclick="reportsAdmin.approveReport('${report.id}');document.getElementById('rpt-view-modal').remove();document.body.style.overflow='';">
              <i data-lucide="check-circle"></i>
              <span>Approve Report</span>
            </button>` : ''}
            ${report.is_approved ? `
            <button class="btn btn-outline btn-sm"
                    onclick="reportsAdmin.downloadSingleReport('${event?.id}')">
              <i data-lucide="download"></i>
              <span>Download .docx</span>
            </button>` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });
    lucide.createIcons();
  }

  _viewPhoto(index, urls) {
    if (window.app) {
      window.app.lightboxImages = urls;
      window.app.openLightbox(index);
    }
  }

  /* ============================================================
     APPROVE REPORT
     ============================================================ */
  async approveReport(reportId) {
    const admin = this.auth.getAdmin();
    try {
      await this.db
        .from('event_reports')
        .update({
          is_approved: true,
          approved_by: admin.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', reportId);

      // Get the event_id for email notification
      const { data: report } = await this.db
        .from('event_reports')
        .select('event_id')
        .eq('id', reportId)
        .single();

      if (report?.event_id && window.emailService) {
        await window.emailService.sendReportNotification(report.event_id);
      }

      await this.auth.logActivity(
        admin.id, 'REPORT_APPROVED', 'event_reports', reportId
      );

      this._currentDashboard?.showToast(
        'Report approved! Members will receive PDF via email.', 'success'
      );

      await this.renderReportsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );
    } catch (e) {
      this._currentDashboard?.showToast('Failed to approve report', 'error');
    }
  }

  /* ============================================================
     DELETE REPORT
     ============================================================ */
  async deleteReport(reportId) {
    if (!this._currentDashboard) return;
    this._currentDashboard.confirmAction(
      'Delete Report',
      'Permanently delete this report? This action cannot be undone.',
      async () => {
        try {
          await this.db.from('event_reports').delete().eq('id', reportId);
          this._currentDashboard?.showToast('Report deleted', 'success');
          await this.renderReportsList(
            document.getElementById('admin-content'),
            this._currentDashboard
          );
        } catch (e) {
          this._currentDashboard?.showToast('Failed to delete report', 'error');
        }
      },
      'trash-2'
    );
  }

  /* ============================================================
     MONTHLY REPORTS
     ============================================================ */
  async renderMonthlyReports(container, dashboard) {
    this._currentDashboard = dashboard;

    // Get all months that have events with approved reports
    const { data: events } = await this.db
      .from('events')
      .select(`
        id, title, avenue, event_date, status, is_dpp, group_number,
        event_reports(id, is_approved)
      `)
      .eq('status', 'completed')
      .order('event_date', { ascending: false });

    // Group by month
    const monthGroups = {};
    (events || []).forEach(event => {
      const date = new Date(event.event_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthGroups[key]) {
        monthGroups[key] = {
          key,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          label: `${DateUtils.getMonthName(date.getMonth() + 1)} ${date.getFullYear()}`,
          events: []
        };
      }
      monthGroups[key].events.push(event);
    });

    const sortedMonths = Object.values(monthGroups)
      .sort((a, b) => b.key.localeCompare(a.key));

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="calendar"></i> Monthly Reports
          </h1>
          <p class="admin-section-subtitle">
            Combined monthly reports including all avenues and District Priority Projects
          </p>
        </div>
      </div>

      ${sortedMonths.length === 0 ? `
      <div class="admin-card neu-card">
        <div class="admin-empty-state" style="padding:80px;">
          <i data-lucide="calendar-x" style="width:48px;height:48px;opacity:0.4;"></i>
          <p>No completed events with reports yet</p>
        </div>
      </div>` : `
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${sortedMonths.map(group => {
      const totalEvents = group.events.length;
      const reportedEvents = group.events.filter(
        e => e.event_reports?.some(r => r.is_approved)
      ).length;
      const dppEvents = group.events.filter(e => e.is_dpp).length;
      const isComplete = reportedEvents === totalEvents && totalEvents > 0;

      return `
            <div class="admin-card neu-card" style="padding:0;overflow:hidden;">
              <div style="display:flex;justify-content:space-between;align-items:center;
                          padding:16px 24px;border-bottom:1px solid var(--border-color);">
                <div>
                  <h3 style="font-size:1rem;font-weight:700;color:var(--text-heading);">
                    ${group.label}
                  </h3>
                  <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">
                    ${totalEvents} event${totalEvents !== 1 ? 's' : ''} •
                    ${reportedEvents} report${reportedEvents !== 1 ? 's' : ''} submitted
                    ${dppEvents > 0 ? ` • ${dppEvents} DPP` : ''}
                  </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                  <span class="admin-status-badge"
                        style="background:${isComplete
          ? 'var(--success-light)' : 'var(--warning-light)'};
                               color:${isComplete
          ? 'var(--success)' : 'var(--warning)'};">
                    ${isComplete ? 'Complete' : 'Incomplete'}
                  </span>
                  ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') ? `
                  <button class="btn btn-primary btn-sm"
                          onclick="reportsAdmin.generateMonthlyReport(${group.month}, ${group.year})">
                    <i data-lucide="download"></i>
                    <span>Download .docx</span>
                  </button>` : ''}
                </div>
              </div>

              <!-- Events in this month -->
              <div style="padding:12px 24px;">
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  ${group.events.map(event => {
          const avenue = AVENUES[event.avenue] || {};
          const hasReport = event.event_reports?.some(r => r.is_approved);
          return `
                    <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;
                                border-radius:var(--border-radius-full);
                                background:${hasReport
              ? 'var(--success-light)' : 'var(--bg-secondary)'};
                                border:1px solid ${hasReport
              ? 'var(--success)' : 'var(--border-color)'};">
                      <span style="width:8px;height:8px;border-radius:50%;
                                   background:${avenue.color || 'var(--accent)'};
                                   flex-shrink:0;"></span>
                      <span style="font-size:0.72rem;font-weight:500;
                                   color:${hasReport
              ? 'var(--success)' : 'var(--text-muted)'};">
                        ${StringUtils.truncate(StringUtils.sanitize(event.title), 25)}
                      </span>
                      ${event.is_dpp ? '<span style="font-size:0.6rem;font-weight:700;color:var(--avenue-dpp);">DPP</span>' : ''}
                    </div>
                  `;
        }).join('')}
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>`}
    `;

    lucide.createIcons();
  }

  async generateMonthlyReport(month, year) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast('Document generator not available', 'error');
      return;
    }
    this._currentDashboard?.showToast('Generating monthly report...', 'info');
    try {
      await window.docGenerator.generateMonthlyReport(month, year);
      this._currentDashboard?.showToast('Monthly report downloaded!', 'success');
    } catch (e) {
      console.error('Monthly report error:', e);
      this._currentDashboard?.showToast('Failed to generate report', 'error');
    }
  }

  /* ============================================================
     DPP REPORTS
     ============================================================ */
  async renderDPPReports(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: dppEvents, error } = await this.db
      .from('events')
      .select(`
        *,
        event_photos(photo_url, is_action_photo, sort_order),
        event_reports(
          id, report_content, key_highlights, challenges,
          outcomes, is_approved, photo_urls, created_at
        )
      `)
      .eq('is_dpp', true)
      .order('event_date', { ascending: false });

    if (error) {
      dashboard.showToast('Failed to load DPP reports', 'error');
      return;
    }

    // Group by month
    const monthGroups = {};
    (dppEvents || []).forEach(event => {
      const date = new Date(event.event_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthGroups[key]) {
        monthGroups[key] = {
          key, year: date.getFullYear(), month: date.getMonth() + 1,
          label: `${DateUtils.getMonthName(date.getMonth() + 1)} ${date.getFullYear()}`,
          events: []
        };
      }
      monthGroups[key].events.push(event);
    });

    const sortedMonths = Object.values(monthGroups)
      .sort((a, b) => b.key.localeCompare(a.key));

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="star"></i> District Priority Projects Reports
          </h1>
          <p class="admin-section-subtitle">
            ${dppEvents?.length || 0} total District Priority Projects
          </p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') || this.auth.hasRole('district_priority_chair') ? `
          <button class="btn btn-outline" onclick="reportsAdmin.showDPPDownloadModal()">
            <i data-lucide="download"></i>
            <span>Download DPP Report</span>
          </button>` : ''}
        </div>
      </div>

      <!-- DPP Summary -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
                  gap:12px;margin-bottom:20px;">
        <div class="neu-card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--avenue-dpp);">
            ${dppEvents?.length || 0}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">
            Total DPP Events
          </div>
        </div>
        <div class="neu-card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--success);">
            ${dppEvents?.filter(e => e.event_reports?.some(r => r.is_approved)).length || 0}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">
            Reports Approved
          </div>
        </div>
        <div class="neu-card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent);">
            ${dppEvents?.reduce((s, e) => s + (e.actual_attendance || 0), 0) || 0}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">
            Total Participants
          </div>
        </div>
        <div class="neu-card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent);">
            ${Math.round(dppEvents?.reduce((s, e) => s + (parseFloat(e.service_hours) || 0), 0) || 0)}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">
            Service Hours
          </div>
        </div>
      </div>

      <!-- Month-wise DPP Events -->
      ${sortedMonths.length === 0 ? `
      <div class="admin-card neu-card">
        <div class="admin-empty-state" style="padding:80px;">
          <i data-lucide="star" style="width:48px;height:48px;opacity:0.4;"></i>
          <p>No District Priority Projects recorded yet</p>
        </div>
      </div>` : sortedMonths.map(group => `
      <div class="admin-card neu-card" style="margin-bottom:16px;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:16px 24px;border-bottom:1px solid var(--border-color);
                    background:rgba(var(--accent-rgb),0.04);">
          <div>
            <h3 style="font-size:1rem;font-weight:700;color:var(--text-heading);">
              ${group.label}
            </h3>
            <div style="font-size:0.78rem;color:var(--text-muted);">
              ${group.events.length} DPP event${group.events.length !== 1 ? 's' : ''}
            </div>
          </div>
          ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') || this.auth.hasRole('district_priority_chair') ? `
          <button class="btn btn-outline btn-sm"
                  onclick="reportsAdmin.generateDPPReport(${group.month}, ${group.year})">
            <i data-lucide="download"></i>
            <span>Download DPP Report</span>
          </button>` : ''}
        </div>

        ${group.events.map(event => {
      const report = event.event_reports?.[0] || null;
      const posterUrl = event.event_photos?.find(p => !p.is_action_photo)?.photo_url
        || event.poster_url;
      const actionPhotos = event.event_photos?.filter(p => p.is_action_photo) || [];
      return `
            <div style="padding:16px 24px;border-bottom:1px solid var(--border-color);">
              <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
                ${posterUrl ? `
                <img src="${StringUtils.sanitize(posterUrl)}"
                     style="width:80px;height:80px;object-fit:cover;
                            border-radius:var(--border-radius-sm);
                            box-shadow:var(--neu-shadow-sm);flex-shrink:0;"
                     loading="lazy"
                     onerror="this.style.display='none'" />` : ''}
                <div style="flex:1;">
                  <div style="font-weight:700;color:var(--text-heading);margin-bottom:6px;
                              display:flex;align-items:center;gap:8px;">
                    ${StringUtils.sanitize(event.title)}
                    <span class="admin-status-badge"
                          style="background:${event.status === 'completed'
          ? 'var(--success-light)' : 'var(--warning-light)'};
                                 color:${event.status === 'completed'
          ? 'var(--success)' : 'var(--warning)'};">
                      ${StringUtils.capitalize(event.status)}
                    </span>
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:0.78rem;
                              color:var(--text-secondary);">
                    <span style="display:flex;align-items:center;gap:4px;">
                      <i data-lucide="calendar" style="width:13px;height:13px;color:var(--accent);"></i>
                      ${DateUtils.format(event.event_date, 'short')}
                    </span>
                    <span style="display:flex;align-items:center;gap:4px;">
                      <i data-lucide="clock" style="width:13px;height:13px;color:var(--accent);"></i>
                      ${DateUtils.formatTime(event.start_time)}
                    </span>
                    <span style="display:flex;align-items:center;gap:4px;">
                      <i data-lucide="map-pin" style="width:13px;height:13px;color:var(--accent);"></i>
                      ${StringUtils.sanitize(event.venue)}
                    </span>
                    <span style="display:flex;align-items:center;gap:4px;">
                      <i data-lucide="user-check" style="width:13px;height:13px;color:var(--accent);"></i>
                      ${StringUtils.sanitize(event.event_chair || '—')}
                    </span>
                    ${event.actual_attendance ? `
                    <span style="display:flex;align-items:center;gap:4px;">
                      <i data-lucide="users" style="width:13px;height:13px;color:var(--accent);"></i>
                      ${event.actual_attendance} attended
                    </span>` : ''}
                  </div>

                  ${report ? `
                  <div style="margin-top:8px;padding:10px;background:var(--bg-secondary);
                              border-radius:var(--border-radius-sm);">
                    <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);
                                text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">
                      Report
                      <span style="margin-left:6px;padding:1px 6px;border-radius:3px;
                                   background:${report.is_approved
          ? 'var(--success-light)' : 'var(--warning-light)'};
                                   color:${report.is_approved
          ? 'var(--success)' : 'var(--warning)'};">
                        ${report.is_approved ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                    <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;">
                      ${StringUtils.truncate(StringUtils.sanitize(report.report_content || ''), 200)}
                    </p>
                  </div>` : `
                  <div style="margin-top:8px;font-size:0.78rem;color:var(--warning);
                              font-weight:500;">
                    <i data-lucide="alert-circle" style="width:13px;height:13px;"></i>
                    No report submitted yet
                  </div>`}

                  ${actionPhotos.length > 0 ? `
                  <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                    ${actionPhotos.slice(0, 3).map((p, idx) => `
                      <img src="${StringUtils.sanitize(p.photo_url)}"
                           style="width:56px;height:56px;object-fit:cover;
                                  border-radius:4px;cursor:pointer;"
                           loading="lazy"
                           onerror="this.style.display='none'"
                           onclick="reportsAdmin._viewPhoto(${idx}, ${JSON.stringify(actionPhotos.map(x => x.photo_url))})" />
                    `).join('')}
                    ${actionPhotos.length > 3 ? `
                    <div style="width:56px;height:56px;border-radius:4px;
                                background:var(--bg-secondary);display:flex;
                                align-items:center;justify-content:center;
                                font-size:0.72rem;font-weight:700;color:var(--text-muted);">
                      +${actionPhotos.length - 3}
                    </div>` : ''}
                  </div>` : ''}
                </div>

                <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
                  ${!report && (this.auth.can('SUBMIT_REPORT') || this.auth.hasRole('district_priority_chair')) ? `
                  <button class="btn btn-primary btn-sm"
                          onclick="eventsAdmin?.showReportForm('${event.id}')">
                    <i data-lucide="file-text"></i>
                    <span>Submit Report</span>
                  </button>` : ''}
                  ${report && !report.is_approved && this.auth.can('APPROVE_REPORT') ? `
                  <button class="btn btn-success btn-sm"
                          onclick="reportsAdmin.approveReport('${report.id}')">
                    <i data-lucide="check-circle"></i>
                    <span>Approve</span>
                  </button>` : ''}
                  ${report?.is_approved ? `
                  <button class="btn btn-outline btn-sm"
                          onclick="reportsAdmin.downloadSingleReport('${event.id}')">
                    <i data-lucide="download"></i>
                    <span>Download</span>
                  </button>` : ''}
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
      `).join('')}
    `;

    lucide.createIcons();
  }

  async generateDPPReport(month, year) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast('Document generator not available', 'error');
      return;
    }
    this._currentDashboard?.showToast('Generating DPP report...', 'info');
    try {
      await window.docGenerator.generateDPPReport(month, year);
      this._currentDashboard?.showToast('DPP report downloaded!', 'success');
    } catch (e) {
      console.error('DPP report error:', e);
      this._currentDashboard?.showToast('Failed to generate DPP report', 'error');
    }
  }

  /* ============================================================
     DOWNLOAD SINGLE REPORT
     ============================================================ */
  async downloadSingleReport(eventId) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast('Document generator not available', 'error');
      return;
    }
    this._currentDashboard?.showToast('Generating report...', 'info');
    try {
      await window.docGenerator.generateEventReport(eventId);
      this._currentDashboard?.showToast('Report downloaded!', 'success');
    } catch (e) {
      this._currentDashboard?.showToast('Failed to generate report', 'error');
    }
  }

  /* ============================================================
     DOWNLOAD MODALS
     ============================================================ */
  showDownloadModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'rpt-download-modal';

    const accessibleAvenues = this.auth.getAccessibleAvenues();
    const now = new Date();

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:480px;">
        <div class="modal-header">
          <h2 class="modal-title">
            <i data-lucide="download"></i> Download Reports
          </h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('rpt-download-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="calendar"></i> Month
            </label>
            <div class="select-wrap neu-inset">
              <select id="dl-month-select" class="form-select">
                ${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `
                  <option value="${m}"
                          ${m === now.getMonth() + 1 ? 'selected' : ''}>
                    ${DateUtils.getMonthName(m)}
                  </option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="hash"></i> Year
            </label>
            <div class="select-wrap neu-inset">
              <select id="dl-year-select" class="form-select">
                ${[now.getFullYear(), now.getFullYear() - 1].map(y => `
                  <option value="${y}" ${y === now.getFullYear() ? 'selected' : ''}>${y}</option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="file-text"></i> Report Type
            </label>
            <div class="select-wrap neu-inset">
              <select id="dl-type-select" class="form-select">
                ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') ? `
                <option value="monthly">Monthly Combined Report</option>` : ''}
                ${accessibleAvenues.map(a => `
                <option value="${a}">
                  ${AVENUES[a]?.label || StringUtils.snakeToTitle(a)} Report
                </option>`).join('')}
                <option value="dpp">District Priority Projects Report</option>
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>

          <div class="admin-form-actions" style="padding:0;margin-top:20px;">
            <button class="btn btn-outline"
                    onclick="document.getElementById('rpt-download-modal').remove();document.body.style.overflow='';">
              Cancel
            </button>
            <button class="btn btn-primary"
                    onclick="reportsAdmin.processDownload()">
              <i data-lucide="download"></i>
              <span>Generate &amp; Download</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });
    lucide.createIcons();
  }

  async processDownload() {
    const month = parseInt(document.getElementById('dl-month-select')?.value);
    const year = parseInt(document.getElementById('dl-year-select')?.value);
    const type = document.getElementById('dl-type-select')?.value;

    document.getElementById('rpt-download-modal')?.remove();
    document.body.style.overflow = '';

    if (!window.docGenerator) {
      this._currentDashboard?.showToast('Document generator not available', 'error');
      return;
    }

    this._currentDashboard?.showToast('Generating document...', 'info');

    try {
      if (type === 'monthly') {
        await window.docGenerator.generateMonthlyReport(month, year);
      } else if (type === 'dpp') {
        await window.docGenerator.generateDPPReport(month, year);
      } else {
        await window.docGenerator.generateAvenueReport(type, month, year);
      }
      this._currentDashboard?.showToast('Report downloaded!', 'success');
    } catch (e) {
      console.error('Download error:', e);
      this._currentDashboard?.showToast('Failed to generate report', 'error');
    }
  }

  showDPPDownloadModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'dpp-download-modal';
    const now = new Date();

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:400px;">
        <div class="modal-header">
          <h2 class="modal-title">
            <i data-lucide="download"></i> Download DPP Report
          </h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('dpp-download-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Month</label>
            <div class="select-wrap neu-inset">
              <select id="dpp-dl-month" class="form-select">
                ${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `
                  <option value="${m}" ${m === now.getMonth() + 1 ? 'selected' : ''}>
                    ${DateUtils.getMonthName(m)}
                  </option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Year</label>
            <div class="select-wrap neu-inset">
              <select id="dpp-dl-year" class="form-select">
                ${[now.getFullYear(), now.getFullYear() - 1].map(y => `
                  <option value="${y}">${y}</option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>
          <div class="admin-form-actions" style="padding:0;margin-top:16px;">
            <button class="btn btn-outline"
                    onclick="document.getElementById('dpp-download-modal').remove();document.body.style.overflow='';">
              Cancel
            </button>
            <button class="btn btn-primary" onclick="
              const m = parseInt(document.getElementById('dpp-dl-month').value);
              const y = parseInt(document.getElementById('dpp-dl-year').value);
              document.getElementById('dpp-download-modal').remove();
              document.body.style.overflow='';
              reportsAdmin.generateDPPReport(m, y);
            ">
              <i data-lucide="download"></i>
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; }
    });
    lucide.createIcons();
  }
}

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const reportsAdmin = new ReportsAdminManager();
window.reportsAdmin = reportsAdmin;

// Connect to admin dashboard
if (window.adminDashboard) {
  window.adminDashboard.renderReportsList = async (c) => {
    await reportsAdmin.renderReportsList(c, window.adminDashboard);
  };
  window.adminDashboard.renderMonthlyReports = async (c) => {
    await reportsAdmin.renderMonthlyReports(c, window.adminDashboard);
  };
  window.adminDashboard.renderDPPReports = async (c) => {
    await reportsAdmin.renderDPPReports(c, window.adminDashboard);
  };
}

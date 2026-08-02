/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Events Admin Manager - js/events-admin.js
   Complete events, reports, and project management
   ============================================================ */

'use strict';

class EventsAdminManager {
  constructor() {
    this.db = getSupabaseClient();
    this.auth = window.authManager;
    this._pendingPosters = [];
    this._pendingReportPhotos = [];
    this._editingEventId = null;
    this._currentDashboard = null;
    this._allEvents = [];
  }

  /* ============================================================
     EVENTS LIST
     ============================================================ */
  async renderEventsList(container, dashboard) {
    this._currentDashboard = dashboard;
    const accessibleAvenues = this.auth.getAccessibleAvenues();

    let query = this.db
      .from('events')
      .select(`
        id, title, avenue, event_date, start_time, end_time,
        venue, event_chair, event_secretary, status, is_dpp,
        group_number, collaboration, collaborator_name,
        actual_attendance, beneficiaries, service_hours,
        budget_proposed, budget_actual, created_at, updated_at,
        dpp_approval_number, dpp_pillar, dpp_category, dpp_council_member,
        event_photos(photo_url, is_action_photo, sort_order),
        event_reports(id, is_approved, submitted_by)
      `)
      .order('event_date', { ascending: false });

    if (!this.auth.isFullAccess() && accessibleAvenues.length > 0) {
      query = query.in('avenue', accessibleAvenues);
    }

    const { data: events, error } = await query;

    if (error) {
      dashboard?.showToast('Failed to load events', 'error');
      return;
    }

    this._allEvents = events || [];

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="calendar-check"></i>
            Events &amp; Projects
          </h1>
          <p class="admin-section-subtitle">
            ${events?.length || 0} total events across all avenues
          </p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.can('CREATE_EVENT') ? `
          <button class="btn btn-primary" onclick="eventsAdmin.showEventForm()">
            <i data-lucide="plus-circle"></i>
            <span>Add Event</span>
          </button>` : ''}
          ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') ? `
          <button class="btn btn-outline"
                  onclick="eventsAdmin.showDownloadOptions()">
            <i data-lucide="download"></i>
            <span>Download Reports</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Avenue Summary Cards -->
      <div class="events-avenue-summary">
        ${this.renderAvenueSummaryCards(events || [])}
      </div>

      <!-- Filters -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-filters-row" style="flex-wrap:wrap;gap:10px;">
          <div class="input-wrap neu-inset"
               style="flex:1;min-width:200px;max-width:300px;">
            <i data-lucide="search"
               style="width:16px;height:16px;color:var(--text-muted);
                      flex-shrink:0;"></i>
            <input type="text" id="ev-search" class="form-input"
                   placeholder="Search by title, chair, venue..."
                   oninput="eventsAdmin.applyFilters()" />
          </div>
          <div class="select-wrap neu-inset" style="min-width:160px;">
            <select id="ev-avenue-filter" class="form-select"
                    onchange="eventsAdmin.applyFilters()">
              <option value="">All Avenues</option>
              ${accessibleAvenues.map(a => `
                <option value="${a}">
                  ${AVENUES[a]?.label || StringUtils.snakeToTitle(a)}
                </option>
              `).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:160px;">
            <select id="ev-status-filter" class="form-select"
                    onchange="eventsAdmin.applyFilters()">
              <option value="">All Status</option>
              ${Object.entries(EVENT_STATUS).map(([k, v]) =>
                `<option value="${k}">${v.label}</option>`
              ).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:130px;">
            <select id="ev-dpp-filter" class="form-select"
                    onchange="eventsAdmin.applyFilters()">
              <option value="">All Types</option>
              <option value="dpp">DPP Only</option>
              <option value="regular">Regular Only</option>
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <button class="btn btn-outline btn-sm"
                  onclick="eventsAdmin.resetFilters()">
            <i data-lucide="x"></i>
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- Events Table -->
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table" id="ev-table">
            <thead>
              <tr>
                <th style="width:30px;">
                  <input type="checkbox" id="ev-select-all"
                         onchange="eventsAdmin.toggleSelectAll(this.checked)"
                         style="cursor:pointer;" />
                </th>
                <th>Event</th>
                <th>Avenue</th>
                <th>Date &amp; Time</th>
                <th>Chair</th>
                <th>Venue</th>
                <th>Status</th>
                <th>Report</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="ev-table-body">
              ${this.renderEventsRows(events || [])}
            </tbody>
          </table>
        </div>

        <!-- Bulk Actions Bar -->
        <div class="ev-bulk-actions" id="ev-bulk-actions" style="display:none;">
          <span id="ev-selected-count"
                style="font-size:0.84rem;font-weight:600;color:var(--accent);">
            0 selected
          </span>
          <div style="display:flex;gap:8px;">
            ${this.auth.can('APPROVE_EVENT') ? `
            <button class="btn btn-success btn-sm"
                    onclick="eventsAdmin.bulkApprove()">
              <i data-lucide="check-circle"></i>
              <span>Approve Selected</span>
            </button>` : ''}
            ${this.auth.can('DELETE_EVENT') ? `
            <button class="btn btn-danger btn-sm"
                    onclick="eventsAdmin.bulkDelete()">
              <i data-lucide="trash-2"></i>
              <span>Delete Selected</span>
            </button>` : ''}
            <button class="btn btn-outline btn-sm"
                    onclick="eventsAdmin.clearSelection()">
              <i data-lucide="x"></i>
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  renderAvenueSummaryCards(events) {
    const counts = {};
    Object.keys(AVENUES).forEach(a => counts[a] = 0);
    events.forEach(e => {
      if (counts[e.avenue] !== undefined) counts[e.avenue]++;
    });

    return `
      <div class="avenue-summary-grid">
        ${Object.entries(AVENUES).map(([key, avenue]) => `
          <div class="avenue-summary-card neu-card"
               onclick="eventsAdmin.filterByAvenue('${key}')"
               style="cursor:pointer;">
            <div class="avenue-summary-icon"
                 style="background:${avenue.bgColor};color:${avenue.color};">
              <i data-lucide="${avenue.icon}"></i>
            </div>
            <div class="avenue-summary-count">${counts[key] || 0}</div>
            <div class="avenue-summary-label">
              ${avenue.shortLabel || avenue.label}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderEventsRows(events) {
    if (!events || events.length === 0) {
      return `
        <tr>
          <td colspan="9" class="admin-table-empty">
            <i data-lucide="calendar-x"></i>
            <span>No events found</span>
          </td>
        </tr>`;
    }

    return events.map(event => {
      const avenue             = AVENUES[event.avenue] || {};
      const status             = EVENT_STATUS[event.status] || {};
      const hasApprovedReport  = event.event_reports?.some(r => r.is_approved);
      const hasPendingReport   = event.event_reports?.some(r => !r.is_approved);
      const posterUrl          = event.event_photos
        ?.find(p => !p.is_action_photo)?.photo_url || null;

      return `
        <tr data-event-id="${event.id}"
            data-avenue="${event.avenue}"
            data-status="${event.status}"
            data-is-dpp="${event.is_dpp ? 'true' : 'false'}">
          <td>
            <input type="checkbox" class="ev-row-check"
                   value="${event.id}"
                   onchange="eventsAdmin.handleRowSelect()"
                   style="cursor:pointer;" />
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              ${posterUrl ? `
              <img src="${StringUtils.sanitize(posterUrl)}"
                   style="width:40px;height:40px;border-radius:6px;
                          object-fit:cover;flex-shrink:0;"
                   loading="lazy"
                   onerror="this.style.display='none'" />` : ''}
              <div>
                <div style="font-weight:600;color:var(--text-heading);
                            display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  ${event.is_dpp
                    ? '<span class="admin-dpp-badge">DPP</span>'
                    : ''}
                  ${StringUtils.sanitize(event.title || '')}
                </div>
                ${event.event_secretary ? `
                <div style="font-size:0.72rem;color:var(--text-muted);">
                  Sec: ${StringUtils.sanitize(event.event_secretary)}
                </div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="admin-avenue-badge"
                  style="background:${avenue.bgColor || 'var(--accent-light)'};
                         color:${avenue.color || 'var(--accent)'};">
              ${avenue.shortLabel || StringUtils.snakeToTitle(event.avenue)}
            </span>
          </td>
          <td style="white-space:nowrap;">
            <div style="font-size:0.84rem;font-weight:600;">
              ${DateUtils.format(event.event_date, 'short')}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);">
              ${DateUtils.formatTime(event.start_time)}
              ${event.end_time
                ? ' – ' + DateUtils.formatTime(event.end_time)
                : ''}
            </div>
            <div style="font-size:0.68rem;color:var(--text-muted);">
              Group ${event.group_number || '1'}
            </div>
          </td>
          <td>
            <div style="font-size:0.82rem;">
              ${StringUtils.sanitize(event.event_chair || '—')}
            </div>
          </td>
          <td>
            <div style="font-size:0.82rem;max-width:150px;overflow:hidden;
                        text-overflow:ellipsis;white-space:nowrap;"
                 title="${StringUtils.sanitize(event.venue || '')}">
              ${StringUtils.sanitize(event.venue || '—')}
            </div>
          </td>
          <td>
            <span class="admin-status-badge"
                  style="background:${status.bg || ''};
                         color:${status.color || ''};">
              ${status.label || event.status}
            </span>
          </td>
          <td>
            ${hasApprovedReport
              ? `<div style="display:flex;align-items:center;gap:4px;
                             color:var(--success);font-size:0.78rem;font-weight:600;">
                   <i data-lucide="check-circle" style="width:13px;height:13px;"></i>
                   Approved
                 </div>`
              : hasPendingReport
                ? `<div style="display:flex;align-items:center;gap:4px;
                               color:var(--warning);font-size:0.78rem;font-weight:600;">
                     <i data-lucide="clock" style="width:13px;height:13px;"></i>
                     Pending
                   </div>`
                : `<div style="color:var(--text-muted);font-size:0.78rem;">
                     None
                   </div>`}
          </td>
          <td>
            <div class="admin-table-actions">
              <button class="admin-action-btn"
                      onclick="eventsAdmin.viewEventDetails('${event.id}')"
                      title="View Details">
                <i data-lucide="eye"></i>
              </button>
              ${this.auth.can('EDIT_ANY_EVENT') ||
                this.auth.canAccessAvenue(event.avenue) ? `
              <button class="admin-action-btn"
                      onclick="eventsAdmin.showEventForm('${event.id}')"
                      title="Edit Event">
                <i data-lucide="pencil"></i>
              </button>` : ''}
              ${this.auth.can('APPROVE_EVENT') &&
                event.status === 'pending_approval' ? `
              <button class="admin-action-btn admin-action-success"
                      onclick="eventsAdmin.approveEvent('${event.id}')"
                      title="Approve">
                <i data-lucide="check-circle"></i>
              </button>` : ''}
              ${this.auth.can('APPROVE_EVENT') &&
                event.status === 'approved' ? `
              <button class="admin-action-btn"
                      onclick="eventsAdmin.markCompleted('${event.id}')"
                      title="Mark Completed">
                <i data-lucide="flag"></i>
              </button>` : ''}
              ${(event.status === 'approved' || event.status === 'completed') &&
                (this.auth.can('SUBMIT_REPORT') ||
                  this.auth.canAccessAvenue(event.avenue)) ? `
              <button class="admin-action-btn"
                      onclick="eventsAdmin.showReportForm('${event.id}')"
                      title="Submit / View Report">
                <i data-lucide="file-text"></i>
              </button>` : ''}
              ${hasApprovedReport ? `
              <button class="admin-action-btn"
                      onclick="eventsAdmin.downloadEventReport('${event.id}')"
                      title="Download Report (.docx)">
                <i data-lucide="download"></i>
              </button>` : ''}
              ${this.auth.can('DELETE_EVENT') ? `
              <button class="admin-action-btn admin-action-danger"
                      onclick="eventsAdmin.deleteEvent('${event.id}')"
                      title="Delete">
                <i data-lucide="trash-2"></i>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  /* ============================================================
     FILTER & SEARCH
     ============================================================ */
  applyFilters() {
    const search    = document.getElementById('ev-search')?.value?.toLowerCase() || '';
    const avenue    = document.getElementById('ev-avenue-filter')?.value || '';
    const status    = document.getElementById('ev-status-filter')?.value || '';
    const dppFilter = document.getElementById('ev-dpp-filter')?.value || '';

    const rows = document.querySelectorAll('#ev-table-body tr[data-event-id]');

    rows.forEach(row => {
      const title     = row.querySelector('td:nth-child(2)')
        ?.textContent?.toLowerCase() || '';
      const rowAvenue = row.getAttribute('data-avenue') || '';
      const rowStatus = row.getAttribute('data-status') || '';
      const isDPP     = row.getAttribute('data-is-dpp') === 'true';

      const matchSearch = !search || title.includes(search);
      const matchAvenue = !avenue || rowAvenue === avenue;
      const matchStatus = !status || rowStatus === status;
      const matchDPP    = !dppFilter
        || (dppFilter === 'dpp'     && isDPP)
        || (dppFilter === 'regular' && !isDPP);

      row.style.display =
        (matchSearch && matchAvenue && matchStatus && matchDPP) ? '' : 'none';
    });
  }

  filterByAvenue(avenue) {
    const select = document.getElementById('ev-avenue-filter');
    if (select) { select.value = avenue; this.applyFilters(); }
  }

  resetFilters() {
    ['ev-search', 'ev-avenue-filter', 'ev-status-filter', 'ev-dpp-filter']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    this.applyFilters();
  }

  /* ============================================================
     ROW SELECTION
     ============================================================ */
  toggleSelectAll(checked) {
    document.querySelectorAll('.ev-row-check')
      .forEach(cb => { cb.checked = checked; });
    this.handleRowSelect();
  }

  handleRowSelect() {
    const selected = document.querySelectorAll('.ev-row-check:checked');
    const bulkBar  = document.getElementById('ev-bulk-actions');
    const countEl  = document.getElementById('ev-selected-count');
    if (bulkBar) bulkBar.style.display = selected.length > 0 ? 'flex' : 'none';
    if (countEl) countEl.textContent = `${selected.length} selected`;
  }

  clearSelection() {
    document.querySelectorAll('.ev-row-check').forEach(cb => cb.checked = false);
    const allCheck = document.getElementById('ev-select-all');
    if (allCheck) allCheck.checked = false;
    this.handleRowSelect();
  }

  getSelectedIds() {
    return Array.from(document.querySelectorAll('.ev-row-check:checked'))
      .map(cb => cb.value);
  }

  /* ============================================================
     BULK ACTIONS
     ============================================================ */
  async bulkApprove() {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    if (!confirm(`Approve ${ids.length} selected event(s)?`)) return;

    let successCount = 0;
    for (const id of ids) {
      try {
        await this.db.from('events').update({
          status      : 'approved',
          approved_by : this.auth.getAdmin()?.id,
          approved_at : new Date().toISOString()
        }).eq('id', id);
        successCount++;
        if (window.emailService) {
          await window.emailService.sendEventApprovalNotification(id);
        }
      } catch (e) {
        console.warn('Bulk approve error for', id, e);
      }
    }

    this._currentDashboard?.showToast(
      `${successCount} event(s) approved`, 'success'
    );
    this.clearSelection();
    await this.renderEventsList(
      document.getElementById('admin-content'), this._currentDashboard
    );
  }

  async bulkDelete() {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} selected event(s)?`)) return;

    let successCount = 0;
    for (const id of ids) {
      try {
        await this.db.from('event_photos').delete().eq('event_id', id);
        await this.db.from('event_reports').delete().eq('event_id', id);
        await this.db.from('events').delete().eq('id', id);
        successCount++;
      } catch (e) {
        console.warn('Bulk delete error for', id, e);
      }
    }

    this._currentDashboard?.showToast(
      `${successCount} event(s) deleted`, 'success'
    );
    await this.renderEventsList(
      document.getElementById('admin-content'), this._currentDashboard
    );
  }

  /* ============================================================
     EVENT FORM  (ADD / EDIT)
     ============================================================ */
  async showEventForm(eventId = null) {
    this._editingEventId = eventId;
    let eventData = null;

    if (eventId) {
      const { data } = await this.db
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      eventData = data;
    }

    const isEdit             = !!eventData;
    const content            = document.getElementById('admin-content');
    if (!content) return;

    const accessibleAvenues  = this.auth.getAccessibleAvenues();
    const isDPPEvent         = isEdit && eventData.is_dpp;
    const isDPPAvenue        = isEdit &&
      eventData.avenue === 'district_priority_projects';

    content.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="${isEdit ? 'pencil' : 'plus-circle'}"></i>
            ${isEdit ? 'Edit Event' : 'Add New Event'}
          </h1>
          ${isEdit ? `<p class="admin-section-subtitle">
            ${StringUtils.sanitize(eventData.title || '')}
          </p>` : ''}
        </div>
        <button class="btn btn-outline"
                onclick="eventsAdmin.renderEventsList(
                  document.getElementById('admin-content'),
                  eventsAdmin._currentDashboard)">
          <i data-lucide="arrow-left"></i>
          <span>Back to Events</span>
        </button>
      </div>

      <div class="admin-card neu-card">
        <form id="ev-form" novalidate>
          <div class="admin-form-grid">

            <!-- Title -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="type"></i> Event Title *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="title" class="form-input"
                       placeholder="Enter full event title"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.title || '')
                         : ''}"
                       required />
              </div>
            </div>

            <!-- Avenue -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="layers"></i> Avenue of Service *
              </label>
              <div class="select-wrap neu-inset">
                <select name="avenue" class="form-select" required
                        onchange="eventsAdmin.onAvenueChange(this.value)">
                  <option value="">Select Avenue</option>
                  ${accessibleAvenues.map(a => `
                    <option value="${a}"
                            ${isEdit && eventData.avenue === a ? 'selected' : ''}>
                      ${AVENUES[a]?.label || StringUtils.snakeToTitle(a)}
                    </option>
                  `).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Group Number -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="hash"></i> Group Number *
              </label>
              <div class="select-wrap neu-inset">
                <select name="group_number" class="form-select" required>
                  ${ROTARY_GROUPS.map(g => `
                    <option value="${g}"
                            ${isEdit && eventData.group_number === g
                              ? 'selected'
                              : !isEdit && g === '1' ? 'selected' : ''}>
                      Group ${g}
                    </option>
                  `).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Event Date -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="calendar"></i> Event Date *
              </label>
              <div class="input-wrap neu-inset">
                <input type="date" name="event_date" class="form-input"
                       value="${isEdit ? (eventData.event_date || '') : ''}"
                       required />
              </div>
            </div>

            <!-- Start Time -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock"></i> Start Time *
              </label>
              <div class="input-wrap neu-inset">
                <input type="time" name="start_time" class="form-input"
                       value="${isEdit ? (eventData.start_time || '') : ''}"
                       required />
              </div>
            </div>

            <!-- End Time -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock-8"></i> End Time (Optional)
              </label>
              <div class="input-wrap neu-inset">
                <input type="time" name="end_time" class="form-input"
                       value="${isEdit ? (eventData.end_time || '') : ''}" />
              </div>
            </div>

            <!-- Venue -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="map-pin"></i> Venue *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="venue" class="form-input"
                       placeholder="Full venue name and address"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.venue || '')
                         : ''}"
                       required />
              </div>
            </div>

            <!-- Event Chair -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="user-check"></i> Event Chair *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="event_chair" class="form-input"
                       placeholder="Name of event chair"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.event_chair || '')
                         : ''}"
                       required />
              </div>
            </div>

            <!-- Event Secretary -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="user"></i> Event Secretary (if any)
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="event_secretary" class="form-input"
                       placeholder="Name of event secretary"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.event_secretary || '')
                         : ''}" />
              </div>
            </div>

            <!-- Proposed By -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="user-plus"></i> Event Proposed By
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="event_proposed_by" class="form-input"
                       placeholder="Proposed by (member name)"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.event_proposed_by || '')
                         : ''}" />
              </div>
            </div>

            <!-- Seconded By -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="users"></i> Seconded By
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="event_seconded_by" class="form-input"
                       placeholder="Seconded by (member name)"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.event_seconded_by || '')
                         : ''}" />
              </div>
            </div>

            <!-- Collaboration -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="handshake"></i> Any Collaboration? (if any)
              </label>
              <div class="select-wrap neu-inset">
                <select name="collaboration" class="form-select"
                        onchange="eventsAdmin.onCollabChange(this.value)">
                  ${Object.entries(COLLABORATION_TYPES).map(([k, v]) => `
                    <option value="${k}"
                            ${isEdit && eventData.collaboration === k
                              ? 'selected'
                              : !isEdit && k === 'none' ? 'selected' : ''}>
                      ${v}
                    </option>
                  `).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Collaborator Name -->
            <div class="form-group" id="ev-collaborator-wrap"
                 style="${isEdit &&
                   eventData.collaboration &&
                   eventData.collaboration !== 'none'
                   ? '' : 'display:none;'}">
              <label class="form-label">
                <i data-lucide="building-2"></i> Collaborator Name
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="collaborator_name" class="form-input"
                       placeholder="Name of collaborating organization"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.collaborator_name || '')
                         : ''}" />
              </div>
            </div>

            <!-- DPP Toggle -->
            <div class="form-group" id="ev-dpp-wrap"
                 style="${isDPPAvenue ? '' : 'display:none;'}">
              <label class="form-label">
                <i data-lucide="star"></i> District Priority Project
              </label>
              <div class="admin-toggle-wrap">
                <label class="admin-toggle">
                  <input type="checkbox" name="is_dpp"
                         id="ev-is-dpp-check"
                         ${isDPPEvent ? 'checked' : ''}
                         onchange="eventsAdmin.onDPPToggle(this.checked)" />
                  <span class="admin-toggle-slider"></span>
                </label>
                <span>Mark as District Priority Project</span>
              </div>
            </div>

            <!-- ── DPP Extra Fields ──────────────────────────── -->
            <div class="form-group admin-form-full" id="ev-dpp-extra-fields"
                 style="${isDPPEvent ? '' : 'display:none;'}">
              <div style="padding:16px;
                          background:rgba(var(--avenue-dpp-rgb,239,68,68),0.05);
                          border-radius:var(--border-radius-sm);
                          border:1px solid rgba(var(--avenue-dpp-rgb,239,68,68),0.2);">

                <div style="font-size:0.75rem;font-weight:800;letter-spacing:0.06em;
                            text-transform:uppercase;color:var(--avenue-dpp);
                            margin-bottom:14px;display:flex;align-items:center;
                            gap:6px;">
                  <i data-lucide="award" style="width:14px;height:14px;"></i>
                  DPP Specific Details
                </div>

                <div class="admin-form-grid" style="padding:0;">

                  <!-- Approval Number -->
                  <div class="form-group">
                    <label class="form-label">
                      <i data-lucide="hash"></i>
                      Project Approval Number
                      <span class="form-required">*</span>
                    </label>
                    <div class="input-wrap neu-inset">
                      <input type="text" name="dpp_approval_number"
                             class="form-input"
                             placeholder="e.g. RID3232/DPP/2425/001"
                             value="${isEdit
                               ? StringUtils.sanitize(
                                   eventData.dpp_approval_number || '')
                               : ''}" />
                    </div>
                  </div>

                  <!-- DPP Pillar -->
                  <div class="form-group">
                    <label class="form-label">
                      <i data-lucide="layers"></i>
                      DPP Pillar
                      <span class="form-required">*</span>
                    </label>
                    <div class="select-wrap neu-inset">
                      <select name="dpp_pillar" class="form-select">
                        <option value="">— Select Pillar —</option>
                        ${Object.entries(DPP_PILLARS).map(([key, p]) => `
                          <option value="${key}"
                                  ${isEdit && eventData.dpp_pillar === key
                                    ? 'selected' : ''}>
                            ${p.label}
                          </option>
                        `).join('')}
                      </select>
                      <i data-lucide="chevron-down" class="select-arrow"></i>
                    </div>
                  </div>

                  <!-- Category -->
                  <div class="form-group">
                    <label class="form-label">
                      <i data-lucide="tag"></i>
                      Category
                      <span class="form-required">*</span>
                    </label>
                    <div class="select-wrap neu-inset">
                      <select name="dpp_category" class="form-select">
                        <option value="">— Select Category —</option>
                        ${Object.entries(DPP_CATEGORIES).map(([key, c]) => `
                          <option value="${key}"
                                  ${isEdit && eventData.dpp_category === key
                                    ? 'selected' : ''}>
                            ${c.label}
                          </option>
                        `).join('')}
                      </select>
                      <i data-lucide="chevron-down" class="select-arrow"></i>
                    </div>
                  </div>

                  <!-- Council Member / District Trainer -->
                  <div class="form-group">
                    <label class="form-label">
                      <i data-lucide="shield"></i>
                      Council Member / District Trainer
                      <span style="font-size:0.72rem;color:var(--text-muted);
                                   font-weight:400;">(optional)</span>
                    </label>
                    <div class="input-wrap neu-inset">
                      <input type="text" name="dpp_council_member"
                             class="form-input"
                             placeholder="Full name..."
                             value="${isEdit
                               ? StringUtils.sanitize(
                                   eventData.dpp_council_member || '')
                               : ''}" />
                    </div>
                  </div>

                </div>
              </div>
            </div>
            <!-- ── end DPP Extra Fields ──────────────────────── -->

            <!-- Expected Attendance -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="users"></i> Expected Attendance
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="expected_attendance" class="form-input"
                       placeholder="Expected participants" min="1"
                       value="${isEdit
                         ? (eventData.expected_attendance || '')
                         : ''}" />
              </div>
            </div>

            <!-- Proposed Budget -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="indian-rupee"></i> Proposed Budget (Rs.)
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="budget_proposed" class="form-input"
                       placeholder="0.00" min="0" step="0.01"
                       value="${isEdit
                         ? (eventData.budget_proposed || '0')
                         : '0'}" />
              </div>
            </div>

            <!-- Description -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="file-text"></i> Event Description *
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="description" class="form-textarea" rows="6"
                          placeholder="Detailed description about the event,
                          objectives, and expected outcomes..."
                          required>${isEdit
                            ? StringUtils.sanitize(eventData.description || '')
                            : ''}</textarea>
              </div>
            </div>

            <!-- Poster Upload -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="image"></i> Event Poster / Promotional Images
                <span style="font-weight:400;color:var(--text-muted);
                             font-size:0.75rem;">
                  (Max ${MAX_PHOTOS.EVENT} images, 4MB each)
                </span>
              </label>

              ${isEdit ? await this.getExistingPhotosHTML(eventId, false) : ''}

              <div class="file-upload-wrap neu-inset" id="ev-poster-wrap">
                <input type="file" id="ev-poster-input" class="file-input"
                       accept="image/jpeg,image/png,image/webp" multiple />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span id="ev-poster-label">
                    ${isEdit
                      ? 'Upload additional poster images'
                      : 'Click to upload poster images'}
                  </span>
                  <span style="font-size:0.7rem;color:var(--text-muted);">
                    JPG, PNG, WebP — Max 4MB each —
                    Max ${MAX_PHOTOS.EVENT} total
                  </span>
                </div>
              </div>

              <div id="ev-poster-previews"
                   style="margin-top:12px;display:none;flex-wrap:wrap;gap:10px;">
              </div>
            </div>

          </div>

          <!-- Form Footer -->
          <div class="admin-form-actions">
            <button type="button" class="btn btn-outline"
                    onclick="eventsAdmin.renderEventsList(
                      document.getElementById('admin-content'),
                      eventsAdmin._currentDashboard)">
              <i data-lucide="x"></i>
              <span>Cancel</span>
            </button>
            ${!isEdit ? `
            <button type="button" class="btn btn-outline" id="ev-save-draft"
                    onclick="eventsAdmin.submitForm('draft')">
              <i data-lucide="save"></i>
              <span>Save as Draft</span>
            </button>` : ''}
            <button type="submit" class="btn btn-primary" id="ev-submit-btn">
              <i data-lucide="send"></i>
              <span>${isEdit ? 'Update Event' : 'Submit for Approval'}</span>
            </button>
          </div>

          <div class="form-message" id="ev-form-msg"></div>
        </form>
      </div>
    `;

    this._pendingPosters = [];
    this.setupEventFormListeners(isEdit, eventData);
    lucide.createIcons();
  }

  async getExistingPhotosHTML(eventId, isActionPhoto) {
    if (!eventId) return '';
    try {
      const { data: photos } = await this.db
        .from('event_photos')
        .select('id, photo_url, photo_name, is_action_photo')
        .eq('event_id', eventId)
        .eq('is_action_photo', isActionPhoto)
        .order('sort_order');

      if (!photos || photos.length === 0) return '';

      return `
        <div style="margin-bottom:12px;">
          <p style="font-size:0.78rem;font-weight:600;color:var(--text-muted);
                    margin-bottom:8px;">
            Existing ${isActionPhoto ? 'Action Photos' : 'Poster Images'}:
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${photos.map(photo => `
              <div style="position:relative;width:80px;height:80px;
                          border-radius:var(--border-radius-sm);overflow:hidden;
                          box-shadow:var(--neu-shadow-sm);">
                <img src="${StringUtils.sanitize(photo.photo_url)}"
                     style="width:100%;height:100%;object-fit:cover;"
                     loading="lazy"
                     onerror="this.parentElement.style.display='none'" />
                <button onclick="eventsAdmin.deletePhoto('${photo.id}')"
                        title="Delete photo"
                        style="position:absolute;top:2px;right:2px;width:18px;
                               height:18px;border-radius:50%;background:var(--danger);
                               color:#fff;border:none;cursor:pointer;font-size:0.6rem;
                               display:flex;align-items:center;
                               justify-content:center;">
                  <i data-lucide="x" style="width:10px;height:10px;"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>`;
    } catch (e) {
      return '';
    }
  }

  setupEventFormListeners(isEdit, eventData) {
    const form        = document.getElementById('ev-form');
    const posterInput = document.getElementById('ev-poster-input');

    if (posterInput) {
      posterInput.addEventListener('change', (e) => {
        this.handlePosterFiles(e.target.files);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = isEdit ? 'keep' : 'pending_approval';
        await this.submitForm(status, isEdit ? this._editingEventId : null);
      });
    }
  }

  onAvenueChange(avenue) {
    const dppWrap = document.getElementById('ev-dpp-wrap');
    if (dppWrap) {
      dppWrap.style.display =
        avenue === 'district_priority_projects' ? 'block' : 'none';
    }
    // If not a DPP avenue, hide extra fields too
    if (avenue !== 'district_priority_projects') {
      const extraFields = document.getElementById('ev-dpp-extra-fields');
      if (extraFields) extraFields.style.display = 'none';
      const check = document.getElementById('ev-is-dpp-check');
      if (check) check.checked = false;
    }
  }

  onCollabChange(value) {
    const wrap = document.getElementById('ev-collaborator-wrap');
    if (wrap) {
      wrap.style.display = (value && value !== 'none') ? 'block' : 'none';
    }
  }

  onDPPToggle(checked) {
    const extraFields = document.getElementById('ev-dpp-extra-fields');
    if (extraFields) extraFields.style.display = checked ? 'block' : 'none';
  }

  handlePosterFiles(files) {
    const maxFiles = MAX_PHOTOS.EVENT;
    const previews = document.getElementById('ev-poster-previews');
    const label    = document.getElementById('ev-poster-label');

    const validFiles = [];
    for (const file of Array.from(files)) {
      if (!Validate.imageType(file)) {
        this._currentDashboard?.showToast(
          `${file.name}: Invalid file type`, 'error'
        );
        continue;
      }
      if (!Validate.fileSize(file, FILE_LIMITS.EVENT_PHOTO)) {
        this._currentDashboard?.showToast(
          `${file.name}: File too large (max 4MB)`, 'error'
        );
        continue;
      }
      validFiles.push(file);
    }

    this._pendingPosters = validFiles.slice(0, maxFiles);

    if (validFiles.length > maxFiles) {
      this._currentDashboard?.showToast(
        `Only first ${maxFiles} images selected`, 'warning'
      );
    }

    if (previews) {
      if (this._pendingPosters.length > 0) {
        previews.style.display = 'flex';
        previews.innerHTML = this._pendingPosters.map((file, i) => {
          const url = URL.createObjectURL(file);
          return `
            <div style="position:relative;width:80px;height:80px;
                        border-radius:var(--border-radius-sm);overflow:hidden;
                        box-shadow:var(--neu-shadow-sm);">
              <img src="${url}"
                   style="width:100%;height:100%;object-fit:cover;" />
              <button onclick="eventsAdmin.removePosterPreview(${i})"
                      style="position:absolute;top:2px;right:2px;width:18px;
                             height:18px;border-radius:50%;background:var(--danger);
                             color:#fff;border:none;cursor:pointer;display:flex;
                             align-items:center;justify-content:center;">
                <i data-lucide="x" style="width:10px;height:10px;"></i>
              </button>
            </div>`;
        }).join('');
        lucide.createIcons();
      } else {
        previews.style.display = 'none';
        previews.innerHTML = '';
      }
    }

    if (label) {
      label.textContent = this._pendingPosters.length > 0
        ? `${this._pendingPosters.length} file(s) selected`
        : 'Click to upload poster images';
    }
  }

  removePosterPreview(index) {
    this._pendingPosters.splice(index, 1);
    const fileInput = document.getElementById('ev-poster-input');
    if (fileInput) {
      const dt = new DataTransfer();
      this._pendingPosters.forEach(f => dt.items.add(f));
      fileInput.files = dt.files;
    }
    this.handlePosterFiles(this._pendingPosters);
  }

  /* ============================================================
     SUBMIT EVENT FORM
     ============================================================ */
  async submitForm(status, eventId = null) {
    const form      = document.getElementById('ev-form');
    const msgEl     = document.getElementById('ev-form-msg');
    const submitBtn = document.getElementById('ev-submit-btn');
    const draftBtn  = document.getElementById('ev-save-draft');

    if (!form) return;

    const formData = new FormData(form);
    const data     = Object.fromEntries(formData.entries());

    // Validate required fields
    const requiredFields = [
      { key: 'title',       label: 'Event Title' },
      { key: 'avenue',      label: 'Avenue' },
      { key: 'event_date',  label: 'Event Date' },
      { key: 'start_time',  label: 'Start Time' },
      { key: 'venue',       label: 'Venue' },
      { key: 'event_chair', label: 'Event Chair' },
      { key: 'description', label: 'Description' }
    ];

    for (const field of requiredFields) {
      if (!data[field.key] || !data[field.key].toString().trim()) {
        this.showFormMsg(msgEl, `${field.label} is required`, 'error');
        return;
      }
    }

    // Validate DPP-specific required fields
    const isDPP = !!data.is_dpp;
    if (isDPP) {
      if (!data.dpp_approval_number?.trim()) {
        this.showFormMsg(msgEl, 'DPP Project Approval Number is required', 'error');
        return;
      }
      if (!data.dpp_pillar) {
        this.showFormMsg(msgEl, 'DPP Pillar is required', 'error');
        return;
      }
      if (!data.dpp_category) {
        this.showFormMsg(msgEl, 'DPP Category is required', 'error');
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i data-lucide="loader-2"></i><span>Saving...</span>';
      lucide.createIcons();
    }
    if (draftBtn) draftBtn.disabled = true;

    try {
      const admin  = this.auth.getAdmin();
      const avenue = data.avenue;

      // Determine final status
      let finalStatus = status;
      if (status === 'keep' && eventId) {
        const { data: existing } = await this.db
          .from('events')
          .select('status')
          .eq('id', eventId)
          .single();
        finalStatus = existing?.status || 'draft';
      }

      // Full-access admins auto-approve
      if (status === 'pending_approval' && this.auth.isFullAccess()) {
        finalStatus = 'approved';
      }

      const payload = {
        title              : data.title.trim(),
        avenue,
        event_date         : data.event_date,
        start_time         : data.start_time,
        end_time           : data.end_time || null,
        venue              : data.venue.trim(),
        event_chair        : data.event_chair.trim(),
        event_secretary    : data.event_secretary?.trim()    || null,
        event_proposed_by  : data.event_proposed_by?.trim()  || null,
        event_seconded_by  : data.event_seconded_by?.trim()  || null,
        collaboration      : data.collaboration || 'none',
        collaborator_name  : data.collaborator_name?.trim()  || null,
        is_dpp             : isDPP,
        /* DPP specific fields – only saved when is_dpp is true */
        dpp_approval_number: isDPP
          ? (data.dpp_approval_number?.trim() || null) : null,
        dpp_pillar         : isDPP ? (data.dpp_pillar   || null) : null,
        dpp_category       : isDPP ? (data.dpp_category || null) : null,
        dpp_council_member : isDPP
          ? (data.dpp_council_member?.trim() || null) : null,
        expected_attendance: data.expected_attendance
          ? parseInt(data.expected_attendance) : null,
        budget_proposed    : parseFloat(data.budget_proposed) || 0,
        description        : data.description.trim(),
        group_number       : data.group_number || '1',
        updated_at         : new Date().toISOString()
      };

      let savedEventId = eventId;

      if (eventId) {
        // Update existing event
        const { error } = await this.db
          .from('events')
          .update(payload)
          .eq('id', eventId);
        if (error) throw error;
      } else {
        // Insert new event
        const { data: newEvent, error } = await this.db
          .from('events')
          .insert({
            ...payload,
            status     : finalStatus,
            created_by : admin?.id,
            ...(finalStatus === 'approved' ? {
              approved_by : admin?.id,
              approved_at : new Date().toISOString()
            } : {})
          })
          .select('id')
          .single();

        if (error) throw error;
        savedEventId = newEvent.id;

        await this.auth.logActivity(
          admin?.id, 'EVENT_CREATED', 'events', savedEventId,
          { title: payload.title, avenue: payload.avenue, status: finalStatus }
        );
      }

      // Upload poster photos
      if (this._pendingPosters?.length > 0 && savedEventId) {
        await this.uploadEventPhotos(savedEventId, this._pendingPosters, false);
        this._pendingPosters = [];
      }

      // Send notification if approved
      if (finalStatus === 'approved' && window.emailService) {
        await window.emailService.sendEventApprovalNotification(savedEventId);
      }

      this._currentDashboard?.showToast(
        eventId
          ? 'Event updated successfully!'
          : finalStatus === 'approved'
            ? 'Event created and approved! Members notified.'
            : 'Event submitted for approval!',
        'success'
      );

      await this.renderEventsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );

    } catch (error) {
      console.error('Event form submit error:', error);
      this.showFormMsg(
        msgEl, `Failed to save event: ${error.message}`, 'error'
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<i data-lucide="send"></i><span>Submit for Approval</span>';
        lucide.createIcons();
      }
      if (draftBtn) draftBtn.disabled = false;
    }
  }

  /* ============================================================
     UPLOAD PHOTOS
     ============================================================ */
  async uploadEventPhotos(eventId, files, isActionPhoto = false) {
    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressed = await ImageUtils.compress(file, 1280, 960, 0.82);
        const filename   = `event_${eventId}_${Date.now()}_${i}.jpg`;

        const { data: uploadData, error } = await this.db.storage
          .from(STORAGE_BUCKETS.EVENTS)
          .upload(filename, compressed, {
            contentType : 'image/jpeg',
            upsert      : false
          });

        if (!error && uploadData) {
          const url = ImageUtils.getPublicUrl(
            STORAGE_BUCKETS.EVENTS, uploadData.path
          );

          await this.db.from('event_photos').insert({
            event_id        : eventId,
            photo_url       : url,
            photo_name      : file.name,
            is_action_photo : isActionPhoto,
            sort_order      : i,
            file_size_bytes : compressed.size,
            uploaded_by     : this.auth.getAdmin()?.id
          });

          uploaded.push(url);
        }
      } catch (e) {
        console.warn(`Photo upload failed [${file.name}]:`, e);
      }
    }

    return uploaded;
  }

  async deletePhoto(photoId) {
    if (!confirm('Delete this photo?')) return;
    try {
      await this.db.from('event_photos').delete().eq('id', photoId);
      this._currentDashboard?.showToast('Photo deleted', 'success');
      if (this._editingEventId) {
        await this.showEventForm(this._editingEventId);
      }
    } catch (e) {
      this._currentDashboard?.showToast('Failed to delete photo', 'error');
    }
  }

  /* ============================================================
     EVENT DETAIL VIEW
     ============================================================ */
  async viewEventDetails(eventId) {
    try {
      const { data: event, error } = await this.db
        .from('events')
        .select(`
          *,
          event_photos(id, photo_url, photo_name, is_action_photo, sort_order),
          event_reports(
            id, report_content, key_highlights, challenges,
            outcomes, future_plans, is_approved, submitted_by,
            created_at, updated_at, photo_urls
          )
        `)
        .eq('id', eventId)
        .single();

      if (error || !event) {
        this._currentDashboard?.showToast('Failed to load event', 'error');
        return;
      }

      const avenue       = AVENUES[event.avenue] || {};
      const status       = EVENT_STATUS[event.status] || {};
      const posters      = (event.event_photos || [])
        .filter(p => !p.is_action_photo)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const actionPhotos = (event.event_photos || [])
        .filter(p => p.is_action_photo)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const report       = event.event_reports?.[0] || null;

      const pillar   = DPP_PILLARS[event.dpp_pillar]      || null;
      const category = DPP_CATEGORIES[event.dpp_category] || null;

      const modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.id = 'ev-detail-modal';

      modal.innerHTML = `
        <div class="modal-container neu-card"
             style="max-width:920px;max-height:92vh;">
          <div class="modal-header">
            <div class="modal-title-area">
              <div style="display:flex;align-items:center;gap:8px;
                          margin-bottom:6px;flex-wrap:wrap;">
                <span class="modal-avenue-badge"
                      style="background:${avenue.bgColor || 'var(--accent-light)'};
                             color:${avenue.color || 'var(--accent)'};">
                  ${avenue.label || StringUtils.snakeToTitle(event.avenue)}
                </span>
                ${event.is_dpp
                  ? '<span class="admin-dpp-badge">District Priority Project</span>'
                  : ''}
                <span class="admin-status-badge"
                      style="background:${status.bg || ''};
                             color:${status.color || ''};">
                  ${status.label || event.status}
                </span>
              </div>
              <h2 class="modal-title">
                ${StringUtils.sanitize(event.title || '')}
              </h2>
            </div>
            <button class="modal-close neu-btn"
                    onclick="document.getElementById('ev-detail-modal').remove();
                             document.body.style.overflow='';">
              <i data-lucide="x"></i>
            </button>
          </div>

          <div class="modal-body" style="overflow-y:auto;">

            <!-- Poster swiper -->
            ${posters.length > 0 ? `
            <div style="border-radius:var(--border-radius-sm);
                        overflow:hidden;margin-bottom:20px;">
              <div class="swiper ev-detail-swiper" id="ev-detail-swiper">
                <div class="swiper-wrapper">
                  ${posters.map(p => `
                    <div class="swiper-slide">
                      <img src="${StringUtils.sanitize(p.photo_url)}"
                           style="width:100%;max-height:360px;object-fit:cover;
                                  border-radius:var(--border-radius-sm);"
                           loading="lazy"
                           onerror="this.style.display='none'" />
                    </div>
                  `).join('')}
                </div>
                ${posters.length > 1 ? `
                <div class="swiper-pagination"></div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>` : ''}
              </div>
            </div>` : ''}

            <!-- Event Details -->
            <div class="modal-details-grid" style="margin-bottom:20px;">
              <div class="modal-detail-item">
                <i data-lucide="calendar"></i>
                <div>
                  <span class="modal-detail-label">Date</span>
                  <span class="modal-detail-value">
                    ${DateUtils.format(event.event_date, 'long')}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="clock"></i>
                <div>
                  <span class="modal-detail-label">Time</span>
                  <span class="modal-detail-value">
                    ${DateUtils.formatTime(event.start_time)}
                    ${event.end_time
                      ? ' to ' + DateUtils.formatTime(event.end_time)
                      : ''}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="map-pin"></i>
                <div>
                  <span class="modal-detail-label">Venue</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.venue || '')}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="user-check"></i>
                <div>
                  <span class="modal-detail-label">Event Chair</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.event_chair || '—')}
                  </span>
                </div>
              </div>
              ${event.event_secretary ? `
              <div class="modal-detail-item">
                <i data-lucide="user"></i>
                <div>
                  <span class="modal-detail-label">Event Secretary</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.event_secretary)}
                  </span>
                </div>
              </div>` : ''}
              ${event.event_proposed_by ? `
              <div class="modal-detail-item">
                <i data-lucide="user-plus"></i>
                <div>
                  <span class="modal-detail-label">Proposed By</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.event_proposed_by)}
                  </span>
                </div>
              </div>` : ''}
              ${event.event_seconded_by ? `
              <div class="modal-detail-item">
                <i data-lucide="users"></i>
                <div>
                  <span class="modal-detail-label">Seconded By</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.event_seconded_by)}
                  </span>
                </div>
              </div>` : ''}
              <div class="modal-detail-item">
                <i data-lucide="hash"></i>
                <div>
                  <span class="modal-detail-label">Group</span>
                  <span class="modal-detail-value">
                    Group ${event.group_number || '1'}
                  </span>
                </div>
              </div>
              ${event.collaboration && event.collaboration !== 'none' ? `
              <div class="modal-detail-item">
                <i data-lucide="handshake"></i>
                <div>
                  <span class="modal-detail-label">Collaboration</span>
                  <span class="modal-detail-value">
                    ${COLLABORATION_TYPES[event.collaboration] || event.collaboration}
                    ${event.collaborator_name
                      ? ' — ' + StringUtils.sanitize(event.collaborator_name)
                      : ''}
                  </span>
                </div>
              </div>` : ''}
              ${event.actual_attendance ? `
              <div class="modal-detail-item">
                <i data-lucide="users"></i>
                <div>
                  <span class="modal-detail-label">Attendance</span>
                  <span class="modal-detail-value">
                    ${event.actual_attendance} participants
                  </span>
                </div>
              </div>` : ''}
              ${event.beneficiaries ? `
              <div class="modal-detail-item">
                <i data-lucide="heart"></i>
                <div>
                  <span class="modal-detail-label">Beneficiaries</span>
                  <span class="modal-detail-value">
                    ${event.beneficiaries}
                  </span>
                </div>
              </div>` : ''}
              ${event.service_hours ? `
              <div class="modal-detail-item">
                <i data-lucide="clock"></i>
                <div>
                  <span class="modal-detail-label">Service Hours</span>
                  <span class="modal-detail-value">
                    ${event.service_hours} hrs
                  </span>
                </div>
              </div>` : ''}
            </div>

            <!-- ── DPP Details Panel ─────────────────────────── -->
            ${event.is_dpp ? `
            <div style="padding:16px;border-radius:var(--border-radius-sm);
                        background:linear-gradient(135deg,
                          rgba(var(--avenue-dpp-rgb,239,68,68),0.06) 0%,
                          var(--bg-secondary) 100%);
                        border:1px solid
                          rgba(var(--avenue-dpp-rgb,239,68,68),0.2);
                        margin-bottom:20px;">
              <h4 style="font-size:0.78rem;font-weight:800;letter-spacing:0.06em;
                         text-transform:uppercase;color:var(--avenue-dpp);
                         margin-bottom:14px;display:flex;
                         align-items:center;gap:6px;">
                <i data-lucide="award" style="width:15px;height:15px;"></i>
                DPP Information
              </h4>
              <div style="display:grid;
                          grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
                          gap:14px;">

                <!-- Approval Number -->
                <div style="padding:12px;background:var(--bg-primary);
                            border-radius:var(--border-radius-sm);
                            border:1px solid var(--border-color);">
                  <div style="font-size:0.68rem;font-weight:700;
                              color:var(--text-muted);text-transform:uppercase;
                              letter-spacing:0.05em;margin-bottom:4px;
                              display:flex;align-items:center;gap:4px;">
                    <i data-lucide="hash" style="width:11px;height:11px;"></i>
                    Project Approval Number
                  </div>
                  <div style="font-size:0.95rem;font-weight:800;
                              color:var(--accent);font-family:monospace;">
                    ${event.dpp_approval_number
                      ? StringUtils.sanitize(event.dpp_approval_number)
                      : `<span style="color:var(--text-muted);font-size:0.8rem;
                                     font-family:inherit;">Not specified</span>`}
                  </div>
                </div>

                <!-- Pillar -->
                <div style="padding:12px;background:var(--bg-primary);
                            border-radius:var(--border-radius-sm);
                            border:1px solid var(--border-color);">
                  <div style="font-size:0.68rem;font-weight:700;
                              color:var(--text-muted);text-transform:uppercase;
                              letter-spacing:0.05em;margin-bottom:4px;
                              display:flex;align-items:center;gap:4px;">
                    <i data-lucide="layers" style="width:11px;height:11px;"></i>
                    DPP Pillar
                  </div>
                  ${pillar ? `
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="width:10px;height:10px;border-radius:50%;
                                 background:${pillar.color};flex-shrink:0;"></span>
                    <span style="font-size:0.88rem;font-weight:700;
                                 color:${pillar.color};">
                      ${pillar.label}
                    </span>
                  </div>` : `
                  <span style="font-size:0.8rem;color:var(--text-muted);">
                    Not specified
                  </span>`}
                </div>

                <!-- Category -->
                <div style="padding:12px;background:var(--bg-primary);
                            border-radius:var(--border-radius-sm);
                            border:1px solid var(--border-color);">
                  <div style="font-size:0.68rem;font-weight:700;
                              color:var(--text-muted);text-transform:uppercase;
                              letter-spacing:0.05em;margin-bottom:4px;
                              display:flex;align-items:center;gap:4px;">
                    <i data-lucide="tag" style="width:11px;height:11px;"></i>
                    Category
                  </div>
                  ${category ? `
                  <div style="display:inline-flex;align-items:center;gap:6px;
                              padding:3px 10px;
                              border-radius:var(--border-radius-full);
                              background:${category.bgColor};
                              border:1px solid ${category.color}44;">
                    <span style="font-size:0.84rem;font-weight:700;
                                 color:${category.color};">
                      ${category.label}
                    </span>
                  </div>` : `
                  <span style="font-size:0.8rem;color:var(--text-muted);">
                    Not specified
                  </span>`}
                </div>

                <!-- Council Member / District Trainer -->
                <div style="padding:12px;background:var(--bg-primary);
                            border-radius:var(--border-radius-sm);
                            border:1px solid var(--border-color);">
                  <div style="font-size:0.68rem;font-weight:700;
                              color:var(--text-muted);text-transform:uppercase;
                              letter-spacing:0.05em;margin-bottom:4px;
                              display:flex;align-items:center;gap:4px;
                              flex-wrap:wrap;">
                    <i data-lucide="shield" style="width:11px;height:11px;"></i>
                    Council Member / District Trainer
                  </div>
                  <div style="font-size:0.88rem;font-weight:600;
                              color:var(--text-heading);">
                    ${event.dpp_council_member
                      ? StringUtils.sanitize(event.dpp_council_member)
                      : `<span style="font-size:0.8rem;
                                     color:var(--text-muted);">
                           Not specified
                         </span>`}
                  </div>
                </div>

              </div>
            </div>` : ''}
            <!-- ── end DPP Details Panel ──────────────────────── -->

            <!-- Description -->
            <div class="modal-description-section">
              <h4><i data-lucide="file-text"></i> Event Description</h4>
              <p>${StringUtils.sanitize(event.description || '')}</p>
            </div>

            <!-- Report snippet -->
            ${report ? `
            <div style="margin-top:20px;padding:16px;
                        background:var(--bg-secondary);
                        border-radius:var(--border-radius-sm);">
              <h4 style="display:flex;align-items:center;gap:8px;font-size:0.9rem;
                         font-weight:700;color:var(--text-heading);margin-bottom:12px;">
                <i data-lucide="file-check"></i>
                Event Report
                <span class="admin-status-badge"
                      style="background:${report.is_approved
                        ? 'var(--success-light)' : 'var(--warning-light)'};
                             color:${report.is_approved
                               ? 'var(--success)' : 'var(--warning)'};">
                  ${report.is_approved ? 'Approved' : 'Pending Approval'}
                </span>
              </h4>
              <p style="font-size:0.84rem;color:var(--text-secondary);
                        line-height:1.7;">
                ${StringUtils.sanitize(
                    report.report_content || '').substring(0, 400)}
                ${(report.report_content || '').length > 400 ? '...' : ''}
              </p>
            </div>` : ''}

            <!-- Action Photos -->
            ${actionPhotos.length > 0 ? `
            <div class="modal-photos-section" style="margin-top:20px;">
              <h4>
                <i data-lucide="camera"></i>
                Action Photographs (${actionPhotos.length})
              </h4>
              <div class="modal-photos-grid">
                ${actionPhotos.map((photo, idx) => `
                  <div class="modal-photo-item"
                       onclick="eventsAdmin._viewPhoto(
                         ${idx},
                         ${JSON.stringify(actionPhotos.map(p => p.photo_url))})">
                    <img src="${StringUtils.sanitize(photo.photo_url)}"
                         alt="Action photo"
                         loading="lazy"
                         onerror="this.parentElement.style.display='none'" />
                  </div>
                `).join('')}
              </div>
            </div>` : ''}

            <!-- Modal Actions -->
            <div class="modal-actions" style="margin-top:20px;flex-wrap:wrap;">
              ${this.auth.can('EDIT_ANY_EVENT') ||
                this.auth.canAccessAvenue(event.avenue) ? `
              <button class="btn btn-outline btn-sm"
                      onclick="eventsAdmin.showEventForm('${event.id}');
                               document.getElementById('ev-detail-modal').remove();
                               document.body.style.overflow='';">
                <i data-lucide="pencil"></i>
                <span>Edit Event</span>
              </button>` : ''}
              ${event.status === 'pending_approval' &&
                this.auth.can('APPROVE_EVENT') ? `
              <button class="btn btn-success btn-sm"
                      onclick="eventsAdmin.approveEvent('${event.id}');
                               document.getElementById('ev-detail-modal').remove();
                               document.body.style.overflow='';">
                <i data-lucide="check-circle"></i>
                <span>Approve</span>
              </button>
              <button class="btn btn-danger btn-sm"
                      onclick="eventsAdmin.rejectEvent('${event.id}');
                               document.getElementById('ev-detail-modal').remove();
                               document.body.style.overflow='';">
                <i data-lucide="x-circle"></i>
                <span>Reject</span>
              </button>` : ''}
              ${(event.status === 'approved' || event.status === 'completed') ? `
              <button class="btn btn-primary btn-sm"
                      onclick="eventsAdmin.showReportForm('${event.id}');
                               document.getElementById('ev-detail-modal').remove();
                               document.body.style.overflow='';">
                <i data-lucide="file-text"></i>
                <span>${report ? 'View/Edit Report' : 'Submit Report'}</span>
              </button>` : ''}
              ${report?.is_approved ? `
              <button class="btn btn-outline btn-sm"
                      onclick="eventsAdmin.downloadEventReport('${event.id}')">
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
        if (e.target === modal) {
          modal.remove();
          document.body.style.overflow = '';
        }
      });
      lucide.createIcons();

      // Init swiper for posters
      if (posters.length > 1) {
        setTimeout(() => {
          new Swiper('#ev-detail-swiper', {
            loop       : true,
            pagination : {
              el        : '#ev-detail-swiper .swiper-pagination',
              clickable : true
            },
            navigation : {
              prevEl : '#ev-detail-swiper .swiper-button-prev',
              nextEl : '#ev-detail-swiper .swiper-button-next'
            }
          });
        }, 100);
      }

    } catch (error) {
      console.error('View event error:', error);
      this._currentDashboard?.showToast('Failed to load event details', 'error');
    }
  }

  _viewPhoto(index, urls) {
    if (window.app) {
      window.app.lightboxImages = urls;
      window.app.openLightbox(index);
    }
  }

  /* ============================================================
     APPROVE / REJECT / DELETE / COMPLETE
     ============================================================ */
  async approveEvent(eventId) {
    const admin = this.auth.getAdmin();
    if (!admin) return;

    try {
      await this.db.from('events').update({
        status      : 'approved',
        approved_by : admin.id,
        approved_at : new Date().toISOString()
      }).eq('id', eventId);

      if (window.emailService) {
        await window.emailService.sendEventApprovalNotification(eventId);
      }

      await this.auth.logActivity(admin.id, 'EVENT_APPROVED', 'events', eventId);
      this._currentDashboard?.showToast(
        'Event approved! Members notified.', 'success'
      );
      await this._currentDashboard?.loadPendingCounts?.();
      await this.renderEventsList(
        document.getElementById('admin-content'), this._currentDashboard
      );
    } catch (e) {
      this._currentDashboard?.showToast('Failed to approve event', 'error');
    }
  }

  async rejectEvent(eventId) {
    const reason = prompt('Reason for rejection (required):');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    try {
      await this.db.from('events').update({
        status           : 'rejected',
        rejection_reason : reason.trim()
      }).eq('id', eventId);

      this._currentDashboard?.showToast('Event rejected', 'warning');
      await this.renderEventsList(
        document.getElementById('admin-content'), this._currentDashboard
      );
    } catch (e) {
      this._currentDashboard?.showToast('Failed to reject event', 'error');
    }
  }

  async markCompleted(eventId) {
    try {
      await this.db.from('events')
        .update({ status: 'completed' })
        .eq('id', eventId);

      this._currentDashboard?.showToast(
        'Event marked as completed', 'success'
      );
      await this.renderEventsList(
        document.getElementById('admin-content'), this._currentDashboard
      );
    } catch (e) {
      this._currentDashboard?.showToast('Failed to update status', 'error');
    }
  }

  async deleteEvent(eventId) {
    if (!this._currentDashboard) return;

    this._currentDashboard.confirmAction(
      'Delete Event',
      'Permanently delete this event and all its photos and reports? '
        + 'This cannot be undone.',
      async () => {
        try {
          await this.db.from('event_photos').delete().eq('event_id', eventId);
          await this.db.from('event_reports').delete().eq('event_id', eventId);
          await this.db.from('events').delete().eq('id', eventId);

          this._currentDashboard?.showToast('Event deleted', 'success');
          await this.renderEventsList(
            document.getElementById('admin-content'), this._currentDashboard
          );
        } catch (e) {
          this._currentDashboard?.showToast('Failed to delete event', 'error');
        }
      },
      'trash-2'
    );
  }

  /* ============================================================
     REPORT FORM
     ============================================================ */
  async showReportForm(eventId) {
    const content = document.getElementById('admin-content');
    if (!content) return;

    const { data: event } = await this.db
      .from('events')
      .select('*, event_reports(*), event_photos(*)')
      .eq('id', eventId)
      .single();

    if (!event) {
      this._currentDashboard?.showToast('Event not found', 'error');
      return;
    }

    const existingReport = event.event_reports?.[0] || null;
    const actionPhotos   = (event.event_photos || [])
      .filter(p => p.is_action_photo)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    content.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="file-text"></i>
            ${existingReport ? 'View / Edit Report' : 'Submit Event Report'}
          </h1>
          <p class="admin-section-subtitle">
            ${StringUtils.sanitize(event.title || '')}
          </p>
        </div>
        <div class="admin-section-actions">
          <button class="btn btn-outline"
                  onclick="eventsAdmin.renderEventsList(
                    document.getElementById('admin-content'),
                    eventsAdmin._currentDashboard)">
            <i data-lucide="arrow-left"></i>
            <span>Back</span>
          </button>
          ${existingReport?.is_approved ? `
          <button class="btn btn-primary"
                  onclick="eventsAdmin.downloadEventReport('${eventId}')">
            <i data-lucide="download"></i>
            <span>Download .docx</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Event Summary -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-card-header">
          <h3><i data-lucide="info"></i> Event Summary</h3>
        </div>
        <div class="modal-details-grid" style="padding:20px;">
          <div class="modal-detail-item">
            <i data-lucide="calendar"></i>
            <div>
              <span class="modal-detail-label">Date</span>
              <span class="modal-detail-value">
                ${DateUtils.format(event.event_date, 'long')}
              </span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="clock"></i>
            <div>
              <span class="modal-detail-label">Time</span>
              <span class="modal-detail-value">
                ${DateUtils.formatTime(event.start_time)}
              </span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="map-pin"></i>
            <div>
              <span class="modal-detail-label">Venue</span>
              <span class="modal-detail-value">
                ${StringUtils.sanitize(event.venue || '')}
              </span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="user-check"></i>
            <div>
              <span class="modal-detail-label">Event Chair</span>
              <span class="modal-detail-value">
                ${StringUtils.sanitize(event.event_chair || '—')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Report Form -->
      <div class="admin-card neu-card">
        <div class="admin-card-header">
          <h3><i data-lucide="file-text"></i> Report Details</h3>
          ${existingReport ? `
          <span class="admin-status-badge"
                style="background:${existingReport.is_approved
                  ? 'var(--success-light)' : 'var(--warning-light)'};
                       color:${existingReport.is_approved
                         ? 'var(--success)' : 'var(--warning)'};">
            ${existingReport.is_approved ? 'Approved' : 'Pending Approval'}
          </span>` : ''}
        </div>
        <form id="rpt-form" style="padding:20px;">
          <div class="admin-form-grid">

            <!-- Report Content -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="file-text"></i> Report Content *
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="report_content" class="form-textarea" rows="10"
                          placeholder="Write a detailed report..."
                          required>${existingReport?.report_content || ''
                          }</textarea>
              </div>
            </div>

            <!-- Key Highlights -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="star"></i> Key Highlights
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="key_highlights" class="form-textarea" rows="4"
                          placeholder="Notable highlights and achievements..."
                >${existingReport?.key_highlights || ''}</textarea>
              </div>
            </div>

            <!-- Challenges -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="alert-triangle"></i> Challenges Faced
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="challenges" class="form-textarea" rows="4"
                          placeholder="Any difficulties encountered..."
                >${existingReport?.challenges || ''}</textarea>
              </div>
            </div>

            <!-- Outcomes -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="target"></i> Outcomes &amp; Impact
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="outcomes" class="form-textarea" rows="4"
                          placeholder="Results achieved and community impact..."
                >${existingReport?.outcomes || ''}</textarea>
              </div>
            </div>

            <!-- Future Plans -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="arrow-right-circle"></i> Future Plans
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="future_plans" class="form-textarea" rows="4"
                          placeholder="Plans for follow-up activities..."
                >${existingReport?.future_plans || ''}</textarea>
              </div>
            </div>

            <!-- Stats -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="users"></i> Actual Attendance
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="actual_attendance" class="form-input"
                       min="0" placeholder="Total participants"
                       value="${event.actual_attendance || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="heart"></i> Total Beneficiaries
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="beneficiaries" class="form-input"
                       min="0" placeholder="People benefited"
                       value="${event.beneficiaries || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock"></i> Total Service Hours
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="service_hours" class="form-input"
                       min="0" step="0.5" placeholder="Service hours rendered"
                       value="${event.service_hours || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="indian-rupee"></i> Actual Expenses (Rs.)
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="budget_actual" class="form-input"
                       min="0" step="0.01" placeholder="Total amount spent"
                       value="${event.budget_actual || ''}" />
              </div>
            </div>

            <!-- Action Photos Upload -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="camera"></i> Action Photographs
                <span style="font-weight:400;color:var(--text-muted);
                             font-size:0.75rem;">
                  (Max ${MAX_PHOTOS.REPORT} photos, 4MB each)
                </span>
              </label>

              ${actionPhotos.length > 0 ? `
              <div style="margin-bottom:12px;">
                <p style="font-size:0.78rem;font-weight:600;
                          color:var(--text-muted);margin-bottom:8px;">
                  Existing Action Photos (${actionPhotos.length}):
                </p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  ${actionPhotos.map((photo, idx) => `
                    <div style="position:relative;width:80px;height:80px;
                                border-radius:var(--border-radius-sm);
                                overflow:hidden;box-shadow:var(--neu-shadow-sm);
                                cursor:pointer;"
                         onclick="eventsAdmin._viewPhoto(
                           ${idx},
                           ${JSON.stringify(actionPhotos.map(p => p.photo_url))})">
                      <img src="${StringUtils.sanitize(photo.photo_url)}"
                           style="width:100%;height:100%;object-fit:cover;"
                           loading="lazy"
                           onerror="this.parentElement.style.display='none'" />
                    </div>
                  `).join('')}
                </div>
              </div>` : ''}

              <div class="file-upload-wrap neu-inset" id="rpt-photos-wrap">
                <input type="file" id="rpt-photos-input" class="file-input"
                       accept="image/jpeg,image/png,image/webp" multiple />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span id="rpt-photos-label">
                    ${actionPhotos.length > 0
                      ? 'Upload additional action photos'
                      : 'Click to upload action photographs'}
                  </span>
                  <span style="font-size:0.7rem;color:var(--text-muted);">
                    Max ${MAX_PHOTOS.REPORT} photos — 4MB each
                  </span>
                </div>
              </div>

              <div id="rpt-photo-previews"
                   style="margin-top:8px;display:none;flex-wrap:wrap;gap:8px;">
              </div>
            </div>

            <!-- Approve toggle (for permitted admins) -->
            ${this.auth.can('APPROVE_REPORT') &&
              existingReport && !existingReport.is_approved ? `
            <div class="form-group admin-form-full">
              <div class="admin-toggle-wrap"
                   style="padding:12px;background:var(--success-light);
                          border-radius:var(--border-radius-sm);">
                <label class="admin-toggle">
                  <input type="checkbox" name="approve_report" />
                  <span class="admin-toggle-slider"></span>
                </label>
                <div>
                  <strong style="color:var(--success);">Approve this report</strong>
                  <p style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">
                    Approving will notify members via email.
                  </p>
                </div>
              </div>
            </div>` : ''}

          </div>

          <div class="admin-form-actions">
            <button type="button" class="btn btn-outline"
                    onclick="eventsAdmin.renderEventsList(
                      document.getElementById('admin-content'),
                      eventsAdmin._currentDashboard)">
              <i data-lucide="x"></i>
              <span>Cancel</span>
            </button>
            <button type="submit" class="btn btn-primary" id="rpt-submit-btn">
              <i data-lucide="send"></i>
              <span>Submit Report</span>
            </button>
          </div>

          <div class="form-message" id="rpt-form-msg"></div>
        </form>
      </div>
    `;

    this._pendingReportPhotos = [];
    this.setupReportFormListeners(event.id, existingReport?.id);
    lucide.createIcons();
  }

  setupReportFormListeners(eventId, existingReportId) {
    const form        = document.getElementById('rpt-form');
    const photosInput = document.getElementById('rpt-photos-input');
    const previews    = document.getElementById('rpt-photo-previews');
    const label       = document.getElementById('rpt-photos-label');

    if (photosInput) {
      photosInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).slice(0, MAX_PHOTOS.REPORT);
        this._pendingReportPhotos = files;

        if (previews) {
          if (files.length > 0) {
            previews.style.display = 'flex';
            previews.innerHTML = files.map(file => {
              const url = URL.createObjectURL(file);
              return `
                <div style="width:80px;height:80px;
                            border-radius:var(--border-radius-sm);
                            overflow:hidden;box-shadow:var(--neu-shadow-sm);">
                  <img src="${url}"
                       style="width:100%;height:100%;object-fit:cover;" />
                </div>`;
            }).join('');
          } else {
            previews.style.display = 'none';
          }
        }

        if (label) {
          label.textContent = files.length > 0
            ? `${files.length} photo(s) selected`
            : 'Click to upload action photographs';
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitReport(eventId, existingReportId, form);
      });
    }
  }

  async submitReport(eventId, existingReportId, form) {
    const btn   = document.getElementById('rpt-submit-btn');
    const msgEl = document.getElementById('rpt-form-msg');

    const formData = new FormData(form);
    const data     = Object.fromEntries(formData.entries());
    const admin    = this.auth.getAdmin();

    if (!data.report_content?.trim()) {
      this.showFormMsg(msgEl, 'Report content is required', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<i data-lucide="loader-2"></i><span>Submitting...</span>';
      lucide.createIcons();
    }

    try {
      // Upload new action photos
      const newPhotoUrls = [];
      if (this._pendingReportPhotos?.length > 0) {
        const uploaded = await this.uploadEventPhotos(
          eventId, this._pendingReportPhotos, true
        );
        newPhotoUrls.push(...uploaded);
        this._pendingReportPhotos = [];
      }

      const shouldApprove =
        !!data.approve_report && this.auth.can('APPROVE_REPORT');

      const reportPayload = {
        event_id        : eventId,
        report_content  : data.report_content.trim(),
        key_highlights  : data.key_highlights?.trim()  || null,
        challenges      : data.challenges?.trim()      || null,
        outcomes        : data.outcomes?.trim()        || null,
        future_plans    : data.future_plans?.trim()    || null,
        photo_urls      : newPhotoUrls,
        submitted_by    : admin?.id,
        report_month    : DateUtils.getMonthName(new Date().getMonth() + 1),
        report_year     : new Date().getFullYear(),
        is_approved     : shouldApprove || this.auth.isFullAccess(),
        updated_at      : new Date().toISOString()
      };

      if (shouldApprove || this.auth.isFullAccess()) {
        reportPayload.approved_by  = admin?.id;
        reportPayload.approved_at  = new Date().toISOString();
      }

      if (existingReportId) {
        const { error } = await this.db
          .from('event_reports')
          .update(reportPayload)
          .eq('id', existingReportId);
        if (error) throw error;
      } else {
        const { error } = await this.db
          .from('event_reports')
          .insert(reportPayload);
        if (error) throw error;
      }

      // Update event stats
      const statsUpdate = { status: 'completed' };
      if (data.actual_attendance) {
        statsUpdate.actual_attendance = parseInt(data.actual_attendance);
      }
      if (data.beneficiaries) {
        statsUpdate.beneficiaries = parseInt(data.beneficiaries);
      }
      if (data.service_hours) {
        statsUpdate.service_hours = parseFloat(data.service_hours);
      }
      if (data.budget_actual) {
        statsUpdate.budget_actual = parseFloat(data.budget_actual);
      }

      await this.db.from('events').update(statsUpdate).eq('id', eventId);

      // Notify if approved
      if ((shouldApprove || this.auth.isFullAccess()) && window.emailService) {
        await window.emailService.sendReportNotification(eventId);
      }

      await this.auth.logActivity(
        admin?.id, 'REPORT_SUBMITTED', 'event_reports', null,
        { event_id: eventId }
      );

      this._currentDashboard?.showToast(
        'Report submitted successfully!', 'success'
      );
      await this.renderEventsList(
        document.getElementById('admin-content'), this._currentDashboard
      );

    } catch (error) {
      console.error('Report submit error:', error);
      this.showFormMsg(
        msgEl, `Failed to submit report: ${error.message}`, 'error'
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i data-lucide="send"></i><span>Submit Report</span>';
        lucide.createIcons();
      }
    }
  }

  /* ============================================================
     DOWNLOAD OPTIONS
     ============================================================ */
  async showDownloadOptions() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'ev-download-modal';

    const accessibleAvenues = this.auth.getAccessibleAvenues();
    const now = new Date();

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:480px;">
        <div class="modal-header">
          <h2 class="modal-title">
            <i data-lucide="download"></i> Download Reports
          </h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('ev-download-modal').remove();
                           document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="calendar"></i> Select Month
            </label>
            <div class="select-wrap neu-inset">
              <select id="dl-month" class="form-select">
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
              <i data-lucide="hash"></i> Select Year
            </label>
            <div class="input-wrap neu-inset">
              <input type="number" id="dl-year" class="form-input"
                     value="${now.getFullYear()}"
                     min="2019" max="2100"
                     placeholder="e.g., 2025" />
            </div>
            <span style="font-size:0.68rem;color:var(--text-muted);
                         margin-top:4px;display:block;">
              Enter any year — 2019 onwards
            </span>
          </div>
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="layers"></i> Report Type
            </label>
            <div class="select-wrap neu-inset">
              <select id="dl-type" class="form-select">
                ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') ? `
                <option value="monthly">Monthly Combined Report</option>` : ''}
                ${accessibleAvenues.map(a => `
                  <option value="${a}">
                    ${AVENUES[a]?.label || StringUtils.snakeToTitle(a)} Report
                  </option>
                `).join('')}
                <option value="dpp">District Priority Projects Report</option>
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>
          <div class="admin-form-actions" style="margin-top:20px;padding:0;">
            <button class="btn btn-outline"
                    onclick="document.getElementById('ev-download-modal').remove();
                             document.body.style.overflow='';">
              Cancel
            </button>
            <button class="btn btn-primary"
                    onclick="eventsAdmin.processDownload()">
              <i data-lucide="download"></i>
              <span>Download .docx</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        document.body.style.overflow = '';
      }
    });
    lucide.createIcons();
  }

  async processDownload() {
    const month = parseInt(document.getElementById('dl-month')?.value || '0');
    const year  = parseInt(document.getElementById('dl-year')?.value  || '0');
    const type  = document.getElementById('dl-type')?.value;

    document.getElementById('ev-download-modal')?.remove();
    document.body.style.overflow = '';

    if (!window.docGenerator) {
      this._currentDashboard?.showToast(
        'Document generator not available', 'error'
      );
      return;
    }

    if (!month || !year || year < 2019) {
      this._currentDashboard?.showToast(
        'Please enter a valid month and year', 'error'
      );
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
    } catch (e) {
      console.error('Download error:', e);
      this._currentDashboard?.showToast(
        `Failed to generate report: ${e.message}`, 'error'
      );
    }
  }

  async downloadEventReport(eventId) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast(
        'Document generator not available', 'error'
      );
      return;
    }

    this._currentDashboard?.showToast('Generating report...', 'info');
    try {
      await window.docGenerator.generateEventReport(eventId);
    } catch (e) {
      console.error('Event report download error:', e);
      this._currentDashboard?.showToast(
        `Failed to generate report: ${e.message}`, 'error'
      );
    }
  }

  /* ============================================================
     PENDING EVENTS LIST
     ============================================================ */
  async renderPendingEvents(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: events } = await this.db
      .from('events')
      .select('*')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true });

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="clock"></i> Pending Approval
          </h1>
          <p class="admin-section-subtitle">
            ${events?.length || 0} event${events?.length !== 1 ? 's' : ''}
            awaiting your review
          </p>
        </div>
        <button class="btn btn-outline"
                onclick="eventsAdmin.renderEventsList(
                  document.getElementById('admin-content'),
                  eventsAdmin._currentDashboard)">
          <i data-lucide="arrow-left"></i>
          <span>All Events</span>
        </button>
      </div>

      ${!events || events.length === 0 ? `
      <div class="admin-card neu-card">
        <div class="admin-empty-state" style="padding:80px;">
          <i data-lucide="check-circle"
             style="width:56px;height:56px;color:var(--success);opacity:0.7;"></i>
          <h3 style="color:var(--text-heading);">All Clear!</h3>
          <p>No events are pending approval at this time.</p>
        </div>
      </div>` : `
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${events.map(event => this.renderPendingCard(event)).join('')}
      </div>`}
    `;

    lucide.createIcons();
  }

  renderPendingCard(event) {
    const avenue = AVENUES[event.avenue] || {};

    return `
      <div class="admin-card neu-card" style="padding:0;overflow:hidden;">
        <div style="padding:20px 24px;border-bottom:1px solid var(--border-color);">
          <div style="display:flex;justify-content:space-between;
                      align-items:flex-start;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;
                          margin-bottom:8px;flex-wrap:wrap;">
                <span class="admin-avenue-badge"
                      style="background:${avenue.bgColor || 'var(--accent-light)'};
                             color:${avenue.color || 'var(--accent)'};">
                  ${avenue.label || StringUtils.snakeToTitle(event.avenue)}
                </span>
                ${event.is_dpp
                  ? '<span class="admin-dpp-badge">District Priority Project</span>'
                  : ''}
                <span style="font-size:0.72rem;color:var(--text-muted);">
                  Group ${event.group_number || '1'}
                </span>
              </div>
              <h3 style="font-size:1.1rem;font-weight:700;
                         color:var(--text-heading);margin-bottom:6px;">
                ${StringUtils.sanitize(event.title || '')}
              </h3>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button class="btn btn-outline btn-sm"
                      onclick="eventsAdmin.viewEventDetails('${event.id}')">
                <i data-lucide="eye"></i>
                <span>View</span>
              </button>
              <button class="btn btn-success btn-sm"
                      onclick="eventsAdmin.approveEvent('${event.id}')">
                <i data-lucide="check-circle"></i>
                <span>Approve</span>
              </button>
              <button class="btn btn-danger btn-sm"
                      onclick="eventsAdmin.rejectEvent('${event.id}')">
                <i data-lucide="x-circle"></i>
                <span>Reject</span>
              </button>
            </div>
          </div>
        </div>
        <div style="padding:14px 24px;display:flex;flex-wrap:wrap;gap:14px;">
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:0.82rem;color:var(--text-secondary);">
            <i data-lucide="calendar"
               style="width:14px;height:14px;color:var(--accent);"></i>
            ${DateUtils.format(event.event_date, 'long')}
          </div>
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:0.82rem;color:var(--text-secondary);">
            <i data-lucide="clock"
               style="width:14px;height:14px;color:var(--accent);"></i>
            ${DateUtils.formatTime(event.start_time)}
            ${event.end_time
              ? ' to ' + DateUtils.formatTime(event.end_time)
              : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:0.82rem;color:var(--text-secondary);">
            <i data-lucide="map-pin"
               style="width:14px;height:14px;color:var(--accent);"></i>
            ${StringUtils.sanitize(event.venue || '')}
          </div>
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:0.82rem;color:var(--text-secondary);">
            <i data-lucide="user-check"
               style="width:14px;height:14px;color:var(--accent);"></i>
            ${StringUtils.sanitize(event.event_chair || '—')}
          </div>
        </div>
        ${event.description ? `
        <div style="padding:0 24px 14px;">
          <p style="font-size:0.84rem;color:var(--text-secondary);
                    line-height:1.7;">
            ${StringUtils.truncate(
                StringUtils.sanitize(event.description || ''), 300)}
          </p>
        </div>` : ''}
      </div>`;
  }

  /* ============================================================
     HELPER
     ============================================================ */
  showFormMsg(el, message, type) {
    if (el) {
      el.textContent = message;
      el.className   = `form-message ${type}`;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

/* ============================================================
   EVENTS ADMIN STYLES
   ============================================================ */
const eventsAdminStyles = `
  .avenue-summary-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }

  .avenue-summary-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    transition: var(--transition);
  }

  .avenue-summary-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--neu-shadow);
  }

  .avenue-summary-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--border-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--neu-shadow-sm);
  }

  .avenue-summary-icon svg,
  .avenue-summary-icon i { width: 22px; height: 22px; }

  .avenue-summary-count {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--text-heading);
    line-height: 1;
  }

  .avenue-summary-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
  }

  .ev-bulk-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: var(--accent-light);
    border-top: 1px solid var(--border-color);
    gap: 12px;
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .avenue-summary-grid { grid-template-columns: repeat(3, 1fr); }
  }

  @media (max-width: 480px) {
    .avenue-summary-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;

/* ============================================================
   INJECT EVENTS ADMIN STYLES
   ============================================================ */
(function injectEventsAdminStyles() {
  if (!document.getElementById('events-admin-styles')) {
    const style       = document.createElement('style');
    style.id          = 'events-admin-styles';
    style.textContent = eventsAdminStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const eventsAdmin = new EventsAdminManager();
window.eventsAdmin = eventsAdmin;

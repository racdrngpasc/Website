/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Meetings Admin Manager - js/meetings-admin.js
   Complete meetings, minutes, attendance, and agenda management
   ============================================================ */

'use strict';

class MeetingsAdminManager {
  constructor() {
    this.db = getSupabaseClient();
    this.auth = window.authManager;
    this._currentDashboard = null;
    this._editingMeetingId = null;
    this._pendingMeetingPhotos = [];
    this._minutesEntries = [];
    this._agendaItems = [];
    this._meetingTimers = {};
  }

  /* ============================================================
     MEETINGS LIST
     ============================================================ */
  async renderMeetingsList(container, dashboard) {
    this._currentDashboard = dashboard;
    const admin = this.auth.getAdmin();

    let query = this.db
      .from('meetings')
      .select(`
        id, title, meeting_type, meeting_date, start_time, end_time,
        actual_start_time, actual_end_time, venue, description,
        poster_url, group_number, minutes_prepared_by, sergeant_at_arms,
        minutes_finalized, is_invitation_sent, is_minutes_sent,
        created_at, agenda, attendance_form_url
      `)
      .order('meeting_date', { ascending: false });

    const { data: meetings, error } = await query;

    if (error) {
      dashboard.showToast('Failed to load meetings', 'error');
      return;
    }

    this._allMeetings = meetings || [];

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="users"></i> Meetings
          </h1>
          <p class="admin-section-subtitle">
            ${meetings?.length || 0} total meetings scheduled
          </p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.can('CREATE_MEETING') ? `
          <button class="btn btn-primary" onclick="meetingsAdmin.showMeetingForm()">
            <i data-lucide="plus-circle"></i>
            <span>Schedule Meeting</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Meeting Type Summary -->
      <div class="meetings-type-summary" style="margin-bottom:20px;">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          ${Object.entries(MEETING_TYPES).map(([key, label]) => {
      const count = meetings?.filter(m => m.meeting_type === key).length || 0;
      const icons = {
        board_meeting: 'shield',
        general_body_meeting: 'users-2',
        special_meeting: 'star',
        emergency_meeting: 'alert-triangle'
      };
      return `
              <div class="neu-card" style="padding:16px;text-align:center;cursor:pointer;"
                   onclick="meetingsAdmin.filterByType('${key}')">
                <div style="width:40px;height:40px;border-radius:var(--border-radius-sm);
                            background:var(--accent-light);display:flex;align-items:center;
                            justify-content:center;margin:0 auto 8px;">
                  <i data-lucide="${icons[key] || 'users'}"
                     style="width:20px;height:20px;color:var(--accent);"></i>
                </div>
                <div style="font-size:1.4rem;font-weight:800;color:var(--text-heading);">
                  ${count}
                </div>
                <div style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">
                  ${label}
                </div>
              </div>
            `;
    }).join('')}
        </div>
      </div>

      <!-- Filters -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-filters-row">
          <div class="input-wrap neu-inset" style="flex:1;max-width:300px;">
            <i data-lucide="search"
               style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;"></i>
            <input type="text" id="mtg-search" class="form-input"
                   placeholder="Search meetings..."
                   oninput="meetingsAdmin.applyFilters()" />
          </div>
          <div class="select-wrap neu-inset" style="min-width:180px;">
            <select id="mtg-type-filter" class="form-select"
                    onchange="meetingsAdmin.applyFilters()">
              <option value="">All Types</option>
              ${Object.entries(MEETING_TYPES).map(([k, v]) =>
      `<option value="${k}">${v}</option>`
    ).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:150px;">
            <select id="mtg-year-filter" class="form-select"
                    onchange="meetingsAdmin.applyFilters()">
              <option value="">All Years</option>
              ${ROTARY_YEARS.map(y => `<option value="${y}">${y}</option>`).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:180px;">
            <select id="mtg-status-filter" class="form-select"
                    onchange="meetingsAdmin.applyFilters()">
              <option value="">All Status</option>
              <option value="upcoming">Upcoming</option>
              <option value="today">Today</option>
              <option value="past">Past</option>
              <option value="minutes_ready">Minutes Ready</option>
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <button class="btn btn-outline btn-sm" onclick="meetingsAdmin.resetFilters()">
            <i data-lucide="x"></i>
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- Meetings Table -->
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table" id="mtg-table">
            <thead>
              <tr>
                <th>Meeting</th>
                <th>Type</th>
                <th>Date &amp; Time</th>
                <th>Venue</th>
                <th>Group</th>
                <th>Invitation</th>
                <th>Minutes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="mtg-table-body">
              ${this.renderMeetingRows(meetings || [])}
            </tbody>
          </table>
        </div>
      </div>
    `;

    lucide.createIcons();
    this.setupMeetingTimers(meetings || []);
  }

  renderMeetingRows(meetings) {
    if (!meetings || meetings.length === 0) {
      return `
        <tr>
          <td colspan="8" class="admin-table-empty">
            <i data-lucide="calendar-x"></i>
            <span>No meetings scheduled</span>
          </td>
        </tr>
      `;
    }

    const today = new Date().toISOString().split('T')[0];

    return meetings.map(meeting => {
      const isToday = meeting.meeting_date === today;
      const isPast = meeting.meeting_date < today;
      const isUpcoming = meeting.meeting_date > today;
      const typeLabel = MEETING_TYPES[meeting.meeting_type] || meeting.meeting_type;

      const statusBadge = isToday
        ? `<span class="admin-status-badge" style="background:var(--success-light);color:var(--success);">Today</span>`
        : isPast
          ? `<span class="admin-status-badge" style="background:var(--bg-secondary);color:var(--text-muted);">Past</span>`
          : `<span class="admin-status-badge" style="background:var(--accent-light);color:var(--accent);">Upcoming</span>`;

      return `
        <tr data-meeting-id="${meeting.id}"
            data-type="${meeting.meeting_type}"
            data-year="${meeting.meeting_date?.split('-')[0] || ''}"
            data-date="${meeting.meeting_date}"
            data-finalized="${meeting.minutes_finalized}">
          <td>
            <div style="font-weight:600;color:var(--text-heading);">
              ${StringUtils.sanitize(meeting.title)}
            </div>
            ${isToday ? '<div style="font-size:0.7rem;color:var(--success);font-weight:600;">Meeting is today!</div>' : ''}
          </td>
          <td>
            <span style="font-size:0.78rem;font-weight:600;color:var(--accent);">
              ${typeLabel}
            </span>
          </td>
          <td style="white-space:nowrap;">
            <div style="font-size:0.84rem;font-weight:600;">
              ${DateUtils.format(meeting.meeting_date, 'short')}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);">
              ${DateUtils.formatTime(meeting.start_time)}
              ${meeting.end_time ? ' – ' + DateUtils.formatTime(meeting.end_time) : ''}
            </div>
            ${statusBadge}
          </td>
          <td>
            <div style="font-size:0.82rem;max-width:160px;overflow:hidden;
                        text-overflow:ellipsis;white-space:nowrap;"
                 title="${StringUtils.sanitize(meeting.venue)}">
              ${StringUtils.sanitize(meeting.venue)}
            </div>
          </td>
          <td>
            <span style="font-size:0.78rem;">Group ${meeting.group_number || '1'}</span>
          </td>
          <td>
            ${meeting.is_invitation_sent
          ? `<div style="display:flex;align-items:center;gap:4px;color:var(--success);font-size:0.78rem;font-weight:600;">
                  <i data-lucide="check-circle" style="width:13px;height:13px;"></i>
                  Sent
                </div>`
          : `<div style="display:flex;align-items:center;gap:4px;color:var(--text-muted);font-size:0.78rem;">
                  <i data-lucide="clock" style="width:13px;height:13px;"></i>
                  Pending
                </div>`
        }
          </td>
          <td>
            ${meeting.minutes_finalized
          ? `<div style="display:flex;align-items:center;gap:4px;color:var(--success);font-size:0.78rem;font-weight:600;">
                  <i data-lucide="file-check" style="width:13px;height:13px;"></i>
                  Ready
                </div>`
          : isPast
            ? `<div style="display:flex;align-items:center;gap:4px;color:var(--warning);font-size:0.78rem;font-weight:600;">
                  <i data-lucide="file-edit" style="width:13px;height:13px;"></i>
                  Pending
                </div>`
            : `<div style="color:var(--text-muted);font-size:0.78rem;">—</div>`
        }
          </td>
          <td>
            <div class="admin-table-actions">
              <button class="admin-action-btn"
                      onclick="meetingsAdmin.viewMeeting('${meeting.id}')"
                      title="View Details">
                <i data-lucide="eye"></i>
              </button>
              ${this.auth.can('MANAGE_MEETING') ? `
              <button class="admin-action-btn"
                      onclick="meetingsAdmin.showMeetingForm('${meeting.id}')"
                      title="Edit Meeting">
                <i data-lucide="pencil"></i>
              </button>` : ''}
              ${this.auth.can('MANAGE_MEETING') && !meeting.is_invitation_sent ? `
              <button class="admin-action-btn admin-action-success"
                      onclick="meetingsAdmin.sendInvitation('${meeting.id}')"
                      title="Send Invitation">
                <i data-lucide="send"></i>
              </button>` : ''}
              ${this.auth.can('VIEW_MEETING_ATTENDANCE') ? `
              <button class="admin-action-btn"
                      onclick="meetingsAdmin.viewAttendance('${meeting.id}')"
                      title="View Attendance">
                <i data-lucide="check-square"></i>
              </button>` : ''}
              ${this.auth.can('GENERATE_MINUTES') && isPast ? `
              <button class="admin-action-btn"
                      onclick="meetingsAdmin.showMinutesForm('${meeting.id}')"
                      title="Meeting Minutes">
                <i data-lucide="file-text"></i>
              </button>` : ''}
              ${meeting.minutes_finalized ? `
              <button class="admin-action-btn"
                      onclick="meetingsAdmin.downloadMeetingDocs('${meeting.id}')"
                      title="Download Documents">
                <i data-lucide="download"></i>
              </button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* ============================================================
     FILTER & SEARCH
     ============================================================ */
  applyFilters() {
    const search = document.getElementById('mtg-search')?.value?.toLowerCase() || '';
    const type = document.getElementById('mtg-type-filter')?.value || '';
    const year = document.getElementById('mtg-year-filter')?.value || '';
    const status = document.getElementById('mtg-status-filter')?.value || '';
    const today = new Date().toISOString().split('T')[0];

    const rows = document.querySelectorAll('#mtg-table-body tr[data-meeting-id]');
    rows.forEach(row => {
      const title = row.querySelector('td')?.textContent?.toLowerCase() || '';
      const rowType = row.getAttribute('data-type') || '';
      const rowYear = row.getAttribute('data-year') || '';
      const rowDate = row.getAttribute('data-date') || '';
      const isFinalized = row.getAttribute('data-finalized') === 'true';

      const matchSearch = !search || title.includes(search);
      const matchType = !type || rowType === type;
      const matchYear = !year || rowYear === year.split('-')[0];
      const matchStatus = !status ||
        (status === 'today' && rowDate === today) ||
        (status === 'upcoming' && rowDate > today) ||
        (status === 'past' && rowDate < today) ||
        (status === 'minutes_ready' && isFinalized);

      row.style.display = (matchSearch && matchType && matchYear && matchStatus)
        ? '' : 'none';
    });
  }

  filterByType(type) {
    const select = document.getElementById('mtg-type-filter');
    if (select) {
      select.value = type;
      this.applyFilters();
    }
  }

  resetFilters() {
    ['mtg-search', 'mtg-type-filter', 'mtg-year-filter', 'mtg-status-filter']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    this.applyFilters();
  }

  /* ============================================================
     SETUP MEETING TIMERS (for auto-sending attendance forms)
     ============================================================ */
  setupMeetingTimers(meetings) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    meetings.forEach(meeting => {
      if (meeting.meeting_date !== today) return;
      if (!meeting.start_time) return;

      const [h, m] = meeting.start_time.split(':').map(Number);
      const meetingStart = new Date(meeting.meeting_date);
      meetingStart.setHours(h, m, 0, 0);

      const delay = meetingStart - now;

      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        if (this._meetingTimers[meeting.id]) {
          clearTimeout(this._meetingTimers[meeting.id]);
        }

        this._meetingTimers[meeting.id] = setTimeout(async () => {
          if (window.emailService) {
            await window.emailService.sendMeetingAttendanceForm(meeting.id);
          }
          console.log(`Attendance form sent for meeting: ${meeting.title}`);
        }, delay);
      }

      // Check minutes availability (after end time)
      if (meeting.end_time) {
        const [eh, em] = meeting.end_time.split(':').map(Number);
        const meetingEnd = new Date(meeting.meeting_date);
        meetingEnd.setHours(eh, em, 0, 0);

        const endDelay = meetingEnd - now;
        if (endDelay > 0) {
          setTimeout(() => {
            const row = document.querySelector(`tr[data-meeting-id="${meeting.id}"]`);
            if (row) {
              const minutesCell = row.querySelector('td:nth-child(7)');
              if (minutesCell && !meeting.minutes_finalized) {
                minutesCell.innerHTML = `
                  <div style="display:flex;align-items:center;gap:4px;
                              color:var(--warning);font-size:0.78rem;font-weight:600;">
                    <i data-lucide="file-edit" style="width:13px;height:13px;"></i>
                    Prepare Now
                  </div>
                `;
                lucide.createIcons();
              }
            }
          }, endDelay);
        }
      }
    });
  }

  /* ============================================================
     MEETING FORM (ADD / EDIT)
     ============================================================ */
  async showMeetingForm(meetingId = null) {
    this._editingMeetingId = meetingId;
    let meetingData = null;

    if (meetingId) {
      const { data } = await this.db
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();
      meetingData = data;
    }

    const isEdit = !!meetingData;
    const content = document.getElementById('admin-content');
    if (!content) return;

    // Parse existing agenda
    this._agendaItems = meetingData?.agenda
      ? (Array.isArray(meetingData.agenda) ? meetingData.agenda : [])
      : [];

    content.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="${isEdit ? 'pencil' : 'plus-circle'}"></i>
            ${isEdit ? 'Edit Meeting' : 'Schedule New Meeting'}
          </h1>
        </div>
        <button class="btn btn-outline"
                onclick="meetingsAdmin.renderMeetingsList(document.getElementById('admin-content'), meetingsAdmin._currentDashboard)">
          <i data-lucide="arrow-left"></i>
          <span>Back</span>
        </button>
      </div>

      <div class="admin-card neu-card">
        <form id="mtg-form" novalidate>
          <div class="admin-form-grid">

            <!-- Title -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="type"></i> Meeting Title *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="title" class="form-input"
                       placeholder="e.g., Regular Board Meeting – July 2025"
                       value="${isEdit ? StringUtils.sanitize(meetingData.title) : ''}"
                       required />
              </div>
            </div>

            <!-- Meeting Type -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="tag"></i> Meeting Type *
              </label>
              <div class="select-wrap neu-inset">
                <select name="meeting_type" class="form-select" required>
                  ${Object.entries(MEETING_TYPES).map(([k, v]) => `
                    <option value="${k}"
                            ${isEdit && meetingData.meeting_type === k ? 'selected' : ''}>
                      ${v}
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
                            ${isEdit && meetingData.group_number === g ? 'selected'
        : !isEdit && g === '1' ? 'selected' : ''}>
                      Group ${g}
                    </option>
                  `).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Date -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="calendar"></i> Meeting Date *
              </label>
              <div class="input-wrap neu-inset">
                <input type="date" name="meeting_date" class="form-input"
                       value="${isEdit ? meetingData.meeting_date : ''}"
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
                       value="${isEdit ? meetingData.start_time : ''}"
                       required />
              </div>
            </div>

            <!-- End Time -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock-8"></i> Expected End Time
              </label>
              <div class="input-wrap neu-inset">
                <input type="time" name="end_time" class="form-input"
                       value="${isEdit ? (meetingData.end_time || '') : ''}" />
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
                       value="${isEdit ? StringUtils.sanitize(meetingData.venue || '') : ''}"
                       required />
              </div>
            </div>

            <!-- Minutes Prepared By -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="user"></i> Minutes Prepared By
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="minutes_prepared_by" class="form-input"
                       placeholder="Name of person preparing minutes"
                       value="${isEdit ? StringUtils.sanitize(meetingData.minutes_prepared_by || '') : ''}" />
              </div>
            </div>

            <!-- Sergeant at Arms -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="shield"></i> Sergeant at Arms
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="sergeant_at_arms" class="form-input"
                       placeholder="Sergeant at Arms name"
                       value="${isEdit ? StringUtils.sanitize(meetingData.sergeant_at_arms || '') : ''}" />
              </div>
            </div>

            <!-- Description -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="file-text"></i> Meeting Description / Purpose
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="description" class="form-textarea" rows="3"
                          placeholder="Brief description of the meeting purpose and topics...">${isEdit ? StringUtils.sanitize(meetingData.description || '') : ''}</textarea>
              </div>
            </div>

            <!-- Meeting Poster -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="image"></i> Meeting Poster / Invitation Image
              </label>
              <div class="file-upload-wrap neu-inset" id="mtg-poster-wrap">
                <input type="file" id="mtg-poster-input" class="file-input"
                       accept="image/jpeg,image/png,image/webp" />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span id="mtg-poster-label">
                    ${isEdit && meetingData.poster_url
        ? 'Change poster image'
        : 'Click to upload meeting poster'}
                  </span>
                  <span style="font-size:0.7rem;color:var(--text-muted);">
                    JPG, PNG, WebP • Max 4MB
                  </span>
                </div>
              </div>
              ${isEdit && meetingData.poster_url ? `
              <div style="margin-top:8px;">
                <img src="${StringUtils.sanitize(meetingData.poster_url)}"
                     style="width:120px;height:120px;object-fit:cover;
                            border-radius:var(--border-radius-sm);
                            box-shadow:var(--neu-shadow-sm);" />
              </div>` : ''}
              <div id="mtg-poster-preview" style="display:none;margin-top:8px;"></div>
            </div>

          </div>

          <!-- Agenda Builder -->
          <div style="padding:0 24px 24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;
                        margin-bottom:12px;">
              <h3 style="font-size:0.95rem;font-weight:700;color:var(--text-heading);
                          display:flex;align-items:center;gap:8px;">
                <i data-lucide="list" style="width:18px;height:18px;color:var(--accent);"></i>
                Meeting Agenda
              </h3>
              <button type="button" class="btn btn-outline btn-sm"
                      onclick="meetingsAdmin.addAgendaItem()">
                <i data-lucide="plus"></i>
                <span>Add Agenda Item</span>
              </button>
            </div>
            <div id="agenda-items-container">
              ${this._agendaItems.length > 0
        ? this._agendaItems.map((item, i) =>
          this.renderAgendaItemRow(item, i)
        ).join('')
        : '<p style="color:var(--text-muted);font-size:0.84rem;text-align:center;padding:20px;">No agenda items added yet. Click "Add Agenda Item" to begin.</p>'
      }
            </div>
          </div>

          <!-- Form Actions -->
          <div class="admin-form-actions">
            <button type="button" class="btn btn-outline"
                    onclick="meetingsAdmin.renderMeetingsList(document.getElementById('admin-content'), meetingsAdmin._currentDashboard)">
              <i data-lucide="x"></i>
              <span>Cancel</span>
            </button>
            ${isEdit ? `
            <button type="button" class="btn btn-outline"
                    onclick="meetingsAdmin.sendInvitation('${meetingId}')">
              <i data-lucide="send"></i>
              <span>Send Invitation</span>
            </button>` : ''}
            <button type="submit" class="btn btn-primary" id="mtg-submit-btn">
              <i data-lucide="calendar-plus"></i>
              <span>${isEdit ? 'Update Meeting' : 'Schedule & Save'}</span>
            </button>
          </div>

          <div class="form-message" id="mtg-form-msg"></div>
        </form>
      </div>
    `;

    this.setupMeetingFormListeners(isEdit, meetingData);
    lucide.createIcons();
  }

  renderAgendaItemRow(item, index) {
    return `
      <div class="agenda-item-row" id="agenda-item-${index}"
           style="display:flex;align-items:center;gap:10px;margin-bottom:8px;
                  padding:10px;background:var(--bg-secondary);
                  border-radius:var(--border-radius-sm);">
        <div style="width:24px;height:24px;border-radius:50%;background:var(--accent);
                    color:#fff;display:flex;align-items:center;justify-content:center;
                    font-size:0.72rem;font-weight:700;flex-shrink:0;">
          ${index + 1}
        </div>
        <div class="input-wrap neu-inset" style="flex:1;padding:8px 12px;">
          <input type="text" class="form-input" placeholder="Agenda item description"
                 value="${StringUtils.sanitize(item.text || item || '')}"
                 onchange="meetingsAdmin.updateAgendaItem(${index}, this.value)"
                 style="font-size:0.85rem;" />
        </div>
        <button type="button"
                onclick="meetingsAdmin.removeAgendaItem(${index})"
                style="width:28px;height:28px;border-radius:50%;
                       background:var(--danger-light);color:var(--danger);
                       border:none;cursor:pointer;display:flex;
                       align-items:center;justify-content:center;flex-shrink:0;">
          <i data-lucide="x" style="width:13px;height:13px;"></i>
        </button>
      </div>
    `;
  }

  addAgendaItem() {
    this._agendaItems.push({ text: '', order: this._agendaItems.length + 1 });
    this.refreshAgendaContainer();
  }

  removeAgendaItem(index) {
    this._agendaItems.splice(index, 1);
    this.refreshAgendaContainer();
  }

  updateAgendaItem(index, value) {
    if (this._agendaItems[index]) {
      this._agendaItems[index] = { text: value, order: index + 1 };
    }
  }

  refreshAgendaContainer() {
    const container = document.getElementById('agenda-items-container');
    if (!container) return;

    if (this._agendaItems.length === 0) {
      container.innerHTML = `
        <p style="color:var(--text-muted);font-size:0.84rem;
                  text-align:center;padding:20px;">
          No agenda items added yet.
          Click "Add Agenda Item" to begin.
        </p>
      `;
    } else {
      container.innerHTML = this._agendaItems.map((item, i) =>
        this.renderAgendaItemRow(item, i)
      ).join('');
    }
    lucide.createIcons();
  }

  setupMeetingFormListeners(isEdit, meetingData) {
    const form = document.getElementById('mtg-form');
    const posterInput = document.getElementById('mtg-poster-input');
    const posterPreview = document.getElementById('mtg-poster-preview');
    const posterLabel = document.getElementById('mtg-poster-label');

    if (posterInput) {
      posterInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!Validate.imageType(file)) {
          this._currentDashboard?.showToast('Invalid image type', 'error');
          return;
        }
        if (!Validate.fileSize(file, FILE_LIMITS.EVENT_PHOTO)) {
          this._currentDashboard?.showToast('Image must be under 4MB', 'error');
          return;
        }

        this._pendingPoster = file;
        const url = URL.createObjectURL(file);

        if (posterPreview) {
          posterPreview.style.display = 'block';
          posterPreview.innerHTML = `
            <img src="${url}" style="width:120px;height:120px;object-fit:cover;
                 border-radius:var(--border-radius-sm);box-shadow:var(--neu-shadow-sm);" />
          `;
        }

        if (posterLabel) posterLabel.textContent = file.name;
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitMeetingForm(isEdit, isEdit ? this._editingMeetingId : null);
      });
    }
  }

  /* ============================================================
     SUBMIT MEETING FORM
     ============================================================ */
  async submitMeetingForm(isEdit, meetingId = null) {
    const form = document.getElementById('mtg-form');
    const msgEl = document.getElementById('mtg-form-msg');
    const submitBtn = document.getElementById('mtg-submit-btn');

    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const admin = this.auth.getAdmin();

    // Validate required fields
    const required = [
      { key: 'title', label: 'Meeting Title' },
      { key: 'meeting_type', label: 'Meeting Type' },
      { key: 'meeting_date', label: 'Date' },
      { key: 'start_time', label: 'Start Time' },
      { key: 'venue', label: 'Venue' }
    ];

    for (const field of required) {
      if (!data[field.key]?.trim()) {
        this.showFormMsg(msgEl, `${field.label} is required`, 'error');
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader-2"></i><span>Saving...</span>';
      lucide.createIcons();
    }

    try {
      // Collect valid agenda items
      const agendaInputs = document.querySelectorAll('#agenda-items-container input');
      const agendaItems = Array.from(agendaInputs)
        .map((input, i) => ({ text: input.value.trim(), order: i + 1 }))
        .filter(item => item.text);

      let posterUrl = null;

      // Upload poster if provided
      if (this._pendingPoster) {
        try {
          const compressed = await ImageUtils.compress(
            this._pendingPoster, 1280, 960, 0.85
          );
          const filename = `meeting_poster_${Date.now()}.jpg`;

          const { data: uploadData, error } = await this.db.storage
            .from(STORAGE_BUCKETS.MEETINGS)
            .upload(filename, compressed, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (!error && uploadData) {
            posterUrl = ImageUtils.getPublicUrl(
              STORAGE_BUCKETS.MEETINGS, uploadData.path
            );
          }
        } catch (e) {
          console.warn('Poster upload error:', e);
        }
        this._pendingPoster = null;
      }

      const payload = {
        title: data.title.trim(),
        meeting_type: data.meeting_type,
        meeting_date: data.meeting_date,
        start_time: data.start_time,
        end_time: data.end_time || null,
        venue: data.venue.trim(),
        description: data.description?.trim() || null,
        minutes_prepared_by: data.minutes_prepared_by?.trim() || null,
        sergeant_at_arms: data.sergeant_at_arms?.trim() || null,
        group_number: data.group_number || '1',
        agenda: agendaItems,
        updated_at: new Date().toISOString()
      };

      if (posterUrl) payload.poster_url = posterUrl;

      let savedMeetingId = meetingId;

      if (isEdit && meetingId) {
        const { error } = await this.db
          .from('meetings')
          .update(payload)
          .eq('id', meetingId);
        if (error) throw error;
      } else {
        const { data: newMeeting, error } = await this.db
          .from('meetings')
          .insert({ ...payload, created_by: admin.id })
          .select('id')
          .single();
        if (error) throw error;
        savedMeetingId = newMeeting.id;

        await this.auth.logActivity(
          admin.id, 'MEETING_CREATED', 'meetings', savedMeetingId,
          { title: payload.title, type: payload.meeting_type }
        );
      }

      // Send invitation if not already sent (for new meetings)
      if (!isEdit && savedMeetingId) {
        await this.sendInvitation(savedMeetingId, true);
      }

      this._currentDashboard?.showToast(
        isEdit
          ? 'Meeting updated successfully!'
          : 'Meeting scheduled! Invitation will be sent.',
        'success'
      );

      await this.renderMeetingsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );
    } catch (error) {
      console.error('Meeting form error:', error);
      this.showFormMsg(
        msgEl,
        `Failed to save meeting: ${error.message}`,
        'error'
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="calendar-plus"></i><span>Schedule & Save</span>';
        lucide.createIcons();
      }
    }
  }

  /* ============================================================
     SEND INVITATION
     ============================================================ */
  async sendInvitation(meetingId, silent = false) {
    try {
      const { data: meeting } = await this.db
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (!meeting) {
        if (!silent) this._currentDashboard?.showToast('Meeting not found', 'error');
        return;
      }

      if (window.emailService) {
        await window.emailService.sendMeetingInvitation(meeting);
      }

      // Mark invitation as sent
      await this.db
        .from('meetings')
        .update({ is_invitation_sent: true })
        .eq('id', meetingId);

      if (!silent) {
        this._currentDashboard?.showToast(
          'Meeting invitation sent to all relevant members!',
          'success'
        );
        await this.renderMeetingsList(
          document.getElementById('admin-content'),
          this._currentDashboard
        );
      }
    } catch (e) {
      console.error('Send invitation error:', e);
      if (!silent) {
        this._currentDashboard?.showToast('Failed to send invitation', 'error');
      }
    }
  }

  /* ============================================================
     VIEW MEETING DETAILS
     ============================================================ */
  async viewMeeting(meetingId) {
    const { data: meeting, error } = await this.db
      .from('meetings')
      .select('*, meeting_photos(*)')
      .eq('id', meetingId)
      .single();

    if (error || !meeting) {
      this._currentDashboard?.showToast('Failed to load meeting', 'error');
      return;
    }

    const typeLabel = MEETING_TYPES[meeting.meeting_type] || meeting.meeting_type;
    const agenda = Array.isArray(meeting.agenda) ? meeting.agenda : [];
    const photos = meeting.meeting_photos || [];
    const today = new Date().toISOString().split('T')[0];
    const isPast = meeting.meeting_date < today;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'mtg-detail-modal';

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:800px;max-height:92vh;">
        <div class="modal-header">
          <div class="modal-title-area">
            <div style="font-size:0.8rem;color:var(--accent);font-weight:600;margin-bottom:6px;">
              ${typeLabel} • Group ${meeting.group_number || '1'}
            </div>
            <h2 class="modal-title">${StringUtils.sanitize(meeting.title)}</h2>
          </div>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('mtg-detail-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="modal-body" style="overflow-y:auto;">

          <!-- Poster -->
          ${meeting.poster_url ? `
          <div style="margin-bottom:20px;border-radius:var(--border-radius-sm);overflow:hidden;">
            <img src="${StringUtils.sanitize(meeting.poster_url)}"
                 style="width:100%;max-height:300px;object-fit:cover;border-radius:var(--border-radius-sm);"
                 loading="lazy"
                 onerror="this.style.display='none'" />
          </div>` : ''}

          <!-- Meeting Details -->
          <div class="modal-details-grid" style="margin-bottom:20px;">
            <div class="modal-detail-item">
              <i data-lucide="calendar"></i>
              <div>
                <span class="modal-detail-label">Date</span>
                <span class="modal-detail-value">
                  ${DateUtils.format(meeting.meeting_date, 'long')}
                </span>
              </div>
            </div>
            <div class="modal-detail-item">
              <i data-lucide="clock"></i>
              <div>
                <span class="modal-detail-label">Time</span>
                <span class="modal-detail-value">
                  ${DateUtils.formatTime(meeting.start_time)}
                  ${meeting.end_time ? ' to ' + DateUtils.formatTime(meeting.end_time) : ''}
                </span>
              </div>
            </div>
            <div class="modal-detail-item">
              <i data-lucide="map-pin"></i>
              <div>
                <span class="modal-detail-label">Venue</span>
                <span class="modal-detail-value">
                  ${StringUtils.sanitize(meeting.venue)}
                </span>
              </div>
            </div>
            <div class="modal-detail-item">
              <i data-lucide="tag"></i>
              <div>
                <span class="modal-detail-label">Type</span>
                <span class="modal-detail-value">${typeLabel}</span>
              </div>
            </div>
            ${meeting.minutes_prepared_by ? `
            <div class="modal-detail-item">
              <i data-lucide="user"></i>
              <div>
                <span class="modal-detail-label">Minutes By</span>
                <span class="modal-detail-value">
                  ${StringUtils.sanitize(meeting.minutes_prepared_by)}
                </span>
              </div>
            </div>` : ''}
            ${meeting.sergeant_at_arms ? `
            <div class="modal-detail-item">
              <i data-lucide="shield"></i>
              <div>
                <span class="modal-detail-label">Sergeant at Arms</span>
                <span class="modal-detail-value">
                  ${StringUtils.sanitize(meeting.sergeant_at_arms)}
                </span>
              </div>
            </div>` : ''}
          </div>

          <!-- Description -->
          ${meeting.description ? `
          <div class="modal-description-section" style="margin-bottom:20px;">
            <h4><i data-lucide="file-text"></i> Description</h4>
            <p>${StringUtils.sanitize(meeting.description)}</p>
          </div>` : ''}

          <!-- Agenda -->
          ${agenda.length > 0 ? `
          <div style="margin-bottom:20px;padding:16px;background:var(--bg-secondary);
                      border-radius:var(--border-radius-sm);">
            <h4 style="display:flex;align-items:center;gap:8px;font-size:0.9rem;
                        font-weight:700;color:var(--text-heading);margin-bottom:12px;">
              <i data-lucide="list"></i>
              Agenda (${agenda.length} items)
            </h4>
            <ol style="padding-left:20px;display:flex;flex-direction:column;gap:8px;">
              ${agenda.map(item => `
                <li style="font-size:0.84rem;color:var(--text-secondary);line-height:1.5;">
                  ${StringUtils.sanitize(item.text || item)}
                </li>
              `).join('')}
            </ol>
          </div>` : ''}

          <!-- Meeting Photos -->
          ${photos.length > 0 ? `
          <div class="modal-photos-section" style="margin-bottom:20px;">
            <h4>
              <i data-lucide="camera"></i>
              Meeting Photos (${photos.length})
            </h4>
            <div class="modal-photos-grid">
              ${photos.map((photo, idx) => `
                <div class="modal-photo-item">
                  <img src="${StringUtils.sanitize(photo.photo_url)}"
                       alt="Meeting photo"
                       loading="lazy"
                       onerror="this.parentElement.style.display='none'" />
                </div>
              `).join('')}
            </div>
          </div>` : ''}

          <!-- Status -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
            ${meeting.is_invitation_sent ? `
            <span class="admin-status-badge"
                  style="background:var(--success-light);color:var(--success);">
              <i data-lucide="check-circle" style="width:12px;height:12px;"></i>
              Invitation Sent
            </span>` : `
            <span class="admin-status-badge"
                  style="background:var(--warning-light);color:var(--warning);">
              <i data-lucide="clock" style="width:12px;height:12px;"></i>
              Invitation Pending
            </span>`}
            ${meeting.minutes_finalized ? `
            <span class="admin-status-badge"
                  style="background:var(--success-light);color:var(--success);">
              <i data-lucide="file-check" style="width:12px;height:12px;"></i>
              Minutes Ready
            </span>` : ''}
            ${meeting.is_minutes_sent ? `
            <span class="admin-status-badge"
                  style="background:var(--success-light);color:var(--success);">
              <i data-lucide="send" style="width:12px;height:12px;"></i>
              Minutes Sent
            </span>` : ''}
          </div>

          <!-- Actions -->
          <div class="modal-actions" style="flex-wrap:wrap;">
            ${this.auth.can('MANAGE_MEETING') ? `
            <button class="btn btn-outline btn-sm"
                    onclick="meetingsAdmin.showMeetingForm('${meetingId}');document.getElementById('mtg-detail-modal').remove();document.body.style.overflow='';">
              <i data-lucide="pencil"></i>
              <span>Edit</span>
            </button>` : ''}
            ${!meeting.is_invitation_sent && this.auth.can('MANAGE_MEETING') ? `
            <button class="btn btn-primary btn-sm"
                    onclick="meetingsAdmin.sendInvitation('${meetingId}');document.getElementById('mtg-detail-modal').remove();document.body.style.overflow='';">
              <i data-lucide="send"></i>
              <span>Send Invitation</span>
            </button>` : ''}
            ${this.auth.can('VIEW_MEETING_ATTENDANCE') ? `
            <button class="btn btn-outline btn-sm"
                    onclick="meetingsAdmin.viewAttendance('${meetingId}');document.getElementById('mtg-detail-modal').remove();document.body.style.overflow='';">
              <i data-lucide="check-square"></i>
              <span>View Attendance</span>
            </button>` : ''}
            ${this.auth.can('GENERATE_MINUTES') && isPast ? `
            <button class="btn btn-outline btn-sm"
                    onclick="meetingsAdmin.showMinutesForm('${meetingId}');document.getElementById('mtg-detail-modal').remove();document.body.style.overflow='';">
              <i data-lucide="file-text"></i>
              <span>Meeting Minutes</span>
            </button>` : ''}
            ${this.auth.can('MANAGE_MEETING') ? `
            <button class="btn btn-outline btn-sm"
                    onclick="meetingsAdmin.downloadAgenda('${meetingId}')">
              <i data-lucide="download"></i>
              <span>Download Agenda</span>
            </button>` : ''}
            ${meeting.minutes_finalized ? `
            <button class="btn btn-outline btn-sm"
                    onclick="meetingsAdmin.downloadMeetingDocs('${meetingId}')">
              <i data-lucide="file-down"></i>
              <span>Download All Docs</span>
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
  }

  /* ============================================================
     MEETING MINUTES FORM
     ============================================================ */
  async showMinutesForm(meetingId) {
    const content = document.getElementById('admin-content');
    if (!content) return;

    const { data: meeting } = await this.db
      .from('meetings')
      .select('*, meeting_photos(*)')
      .eq('id', meetingId)
      .single();

    if (!meeting) {
      this._currentDashboard?.showToast('Meeting not found', 'error');
      return;
    }

    // Check if end time has passed
    const now = new Date();
    const meetingDate = new Date(meeting.meeting_date);
    const isToday = meeting.meeting_date === now.toISOString().split('T')[0];
    const isPast = meeting.meeting_date < now.toISOString().split('T')[0];

    if (!isPast && !isToday) {
      this._currentDashboard?.showToast(
        'Minutes can only be prepared after the meeting ends',
        'warning'
      );
      return;
    }

    // Parse existing minutes
    const existingMinutes = meeting.minutes_content
      ? (Array.isArray(meeting.minutes_content) ? meeting.minutes_content : [])
      : [];

    this._minutesEntries = existingMinutes.length > 0
      ? existingMinutes
      : [];

    content.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="file-text"></i> Meeting Minutes
          </h1>
          <p class="admin-section-subtitle">
            ${StringUtils.sanitize(meeting.title)} •
            ${DateUtils.format(meeting.meeting_date, 'long')}
          </p>
        </div>
        <div class="admin-section-actions">
          <button class="btn btn-outline"
                  onclick="meetingsAdmin.renderMeetingsList(document.getElementById('admin-content'), meetingsAdmin._currentDashboard)">
            <i data-lucide="arrow-left"></i>
            <span>Back</span>
          </button>
          ${meeting.minutes_finalized ? `
          <button class="btn btn-primary"
                  onclick="meetingsAdmin.downloadMeetingDocs('${meetingId}')">
            <i data-lucide="download"></i>
            <span>Download .docx</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Meeting Summary Card -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-card-header">
          <h3><i data-lucide="info"></i> Meeting Information</h3>
        </div>
        <div class="modal-details-grid" style="padding:20px;">
          <div class="modal-detail-item">
            <i data-lucide="calendar"></i>
            <div>
              <span class="modal-detail-label">Date</span>
              <span class="modal-detail-value">
                ${DateUtils.format(meeting.meeting_date, 'long')}
              </span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="clock"></i>
            <div>
              <span class="modal-detail-label">Scheduled Time</span>
              <span class="modal-detail-value">
                ${DateUtils.formatTime(meeting.start_time)}
                ${meeting.end_time ? ' to ' + DateUtils.formatTime(meeting.end_time) : ''}
              </span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="map-pin"></i>
            <div>
              <span class="modal-detail-label">Venue</span>
              <span class="modal-detail-value">${StringUtils.sanitize(meeting.venue)}</span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="tag"></i>
            <div>
              <span class="modal-detail-label">Type</span>
              <span class="modal-detail-value">
                ${MEETING_TYPES[meeting.meeting_type] || meeting.meeting_type}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Minutes Form -->
      <div class="admin-card neu-card">
        <div class="admin-card-header">
          <h3><i data-lucide="file-text"></i> Minutes Content</h3>
          ${meeting.minutes_finalized ? `
          <span class="admin-status-badge"
                style="background:var(--success-light);color:var(--success);">
            Finalized
          </span>` : ''}
        </div>

        <form id="minutes-form" style="padding:20px;">
          <div class="admin-form-grid">

            <!-- Actual Start Time -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock"></i> Actual Start Time *
              </label>
              <div class="input-wrap neu-inset">
                <input type="time" name="actual_start_time" class="form-input"
                       value="${meeting.actual_start_time || meeting.start_time || ''}"
                       required />
              </div>
            </div>

            <!-- Actual End Time -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock-8"></i> Actual End Time
              </label>
              <div class="input-wrap neu-inset">
                <input type="time" name="actual_end_time" class="form-input"
                       value="${meeting.actual_end_time || meeting.end_time || ''}" />
              </div>
            </div>

            <!-- Minutes Prepared By -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="user"></i> Minutes Prepared By
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="minutes_prepared_by" class="form-input"
                       placeholder="Name of secretary/member"
                       value="${StringUtils.sanitize(meeting.minutes_prepared_by || '')}" />
              </div>
            </div>

            <!-- Sergeant at Arms -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="shield"></i> Sergeant at Arms
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="sergeant_at_arms" class="form-input"
                       placeholder="Sergeant at Arms name"
                       value="${StringUtils.sanitize(meeting.sergeant_at_arms || '')}" />
              </div>
            </div>

          </div>

          <!-- Minutes Entries Section -->
          <div style="margin-top:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;
                        margin-bottom:12px;">
              <h4 style="font-size:0.9rem;font-weight:700;color:var(--text-heading);
                          display:flex;align-items:center;gap:8px;">
                <i data-lucide="list" style="width:16px;height:16px;color:var(--accent);"></i>
                Minutes Entries
                <span style="font-size:0.72rem;color:var(--text-muted);font-weight:400;">
                  (Time + Heading + Details)
                </span>
              </h4>
              <button type="button" class="btn btn-outline btn-sm"
                      onclick="meetingsAdmin.addMinutesEntry()">
                <i data-lucide="plus"></i>
                <span>Add Entry</span>
              </button>
            </div>

            <div id="minutes-entries-container">
              ${this._minutesEntries.length > 0
        ? this._minutesEntries.map((entry, i) =>
          this.renderMinutesEntryRow(entry, i)
        ).join('')
        : `<div style="text-align:center;padding:30px;color:var(--text-muted);
                       font-size:0.84rem;">
                    No entries yet. Click "Add Entry" to begin recording minutes.
                  </div>`
      }
            </div>
          </div>

          <!-- Meeting Photos Upload -->
          <div style="margin-top:20px;">
            <label class="form-label" style="margin-bottom:8px;">
              <i data-lucide="camera"></i> Meeting Photographs
              <span style="font-weight:400;color:var(--text-muted);font-size:0.75rem;">
                (Max ${MAX_PHOTOS.MEETING} photos, 4MB each)
              </span>
            </label>

            ${meeting.meeting_photos?.length > 0 ? `
            <div style="margin-bottom:12px;">
              <p style="font-size:0.78rem;font-weight:600;color:var(--text-muted);
                         margin-bottom:8px;">
                Existing Photos (${meeting.meeting_photos.length}):
              </p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${meeting.meeting_photos.map(p => `
                  <div style="width:80px;height:80px;border-radius:var(--border-radius-sm);
                              overflow:hidden;box-shadow:var(--neu-shadow-sm);">
                    <img src="${StringUtils.sanitize(p.photo_url)}"
                         style="width:100%;height:100%;object-fit:cover;"
                         onerror="this.parentElement.style.display='none'" />
                  </div>
                `).join('')}
              </div>
            </div>` : ''}

            <div class="file-upload-wrap neu-inset">
              <input type="file" id="minutes-photos-input" class="file-input"
                     accept="image/jpeg,image/png,image/webp" multiple />
              <div class="file-upload-ui">
                <i data-lucide="upload-cloud"></i>
                <span id="minutes-photos-label">Upload meeting photographs</span>
                <span style="font-size:0.7rem;color:var(--text-muted);">
                  Max ${MAX_PHOTOS.MEETING} photos
                </span>
              </div>
            </div>
            <div id="minutes-photo-previews"
                 style="margin-top:8px;display:none;flex-wrap:wrap;gap:8px;">
            </div>
          </div>

          <!-- Finalize Toggle -->
          <div style="margin-top:20px;padding:16px;background:var(--accent-light);
                      border-radius:var(--border-radius-sm);">
            <div class="admin-toggle-wrap">
              <label class="admin-toggle">
                <input type="checkbox" name="finalize_minutes"
                       ${meeting.minutes_finalized ? 'checked' : ''} />
                <span class="admin-toggle-slider"></span>
              </label>
              <div>
                <strong style="color:var(--accent);">Finalize Minutes</strong>
                <p style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">
                  Once finalized, minutes will be sent to all relevant members as PDF.
                </p>
              </div>
            </div>
          </div>

          <div class="admin-form-actions">
            <button type="button" class="btn btn-outline"
                    onclick="meetingsAdmin.renderMeetingsList(document.getElementById('admin-content'), meetingsAdmin._currentDashboard)">
              <i data-lucide="x"></i>
              <span>Cancel</span>
            </button>
            <button type="submit" class="btn btn-primary" id="minutes-submit-btn">
              <i data-lucide="save"></i>
              <span>Save Minutes</span>
            </button>
          </div>

          <div class="form-message" id="minutes-form-msg"></div>
        </form>
      </div>
    `;

    this.setupMinutesFormListeners(meetingId);
    lucide.createIcons();
  }

  renderMinutesEntryRow(entry, index) {
    return `
      <div class="minutes-entry-row" id="minutes-entry-${index}"
           style="border:1px solid var(--border-color);border-radius:var(--border-radius-sm);
                  padding:12px;margin-bottom:10px;background:var(--bg-secondary);">
        <div style="display:flex;gap:10px;margin-bottom:8px;">
          <!-- Time Column -->
          <div style="flex:0 0 120px;">
            <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);
                           display:block;margin-bottom:4px;">TIME</label>
            <div class="input-wrap neu-inset" style="padding:8px 10px;">
              <input type="time" class="form-input"
                     value="${entry.time || ''}"
                     onchange="meetingsAdmin.updateMinutesEntry(${index}, 'time', this.value)"
                     style="font-size:0.82rem;" />
            </div>
          </div>
          <!-- Heading Column -->
          <div style="flex:1;">
            <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);
                           display:block;margin-bottom:4px;">HEADING</label>
            <div class="input-wrap neu-inset" style="padding:8px 10px;">
              <input type="text" class="form-input"
                     placeholder="Agenda item / topic heading"
                     value="${StringUtils.sanitize(entry.heading || '')}"
                     onchange="meetingsAdmin.updateMinutesEntry(${index}, 'heading', this.value)"
                     style="font-size:0.82rem;" />
            </div>
          </div>
          <button type="button"
                  onclick="meetingsAdmin.removeMinutesEntry(${index})"
                  style="width:30px;height:30px;border-radius:50%;margin-top:20px;
                         background:var(--danger-light);color:var(--danger);
                         border:none;cursor:pointer;display:flex;flex-shrink:0;
                         align-items:center;justify-content:center;">
            <i data-lucide="x" style="width:13px;height:13px;"></i>
          </button>
        </div>
        <!-- Details (full width) -->
        <div>
          <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);
                         display:block;margin-bottom:4px;">DETAILS</label>
          <div class="input-wrap neu-inset" style="padding:8px 10px;">
            <textarea class="form-textarea" rows="3"
                      placeholder="Detailed minutes for this agenda item..."
                      onchange="meetingsAdmin.updateMinutesEntry(${index}, 'details', this.value)"
                      style="font-size:0.82rem;">${StringUtils.sanitize(entry.details || '')}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  addMinutesEntry() {
    this._minutesEntries.push({ time: '', heading: '', details: '' });
    this.refreshMinutesContainer();
  }

  removeMinutesEntry(index) {
    this._minutesEntries.splice(index, 1);
    this.refreshMinutesContainer();
  }

  updateMinutesEntry(index, field, value) {
    if (this._minutesEntries[index]) {
      this._minutesEntries[index][field] = value;
    }
  }

  refreshMinutesContainer() {
    const container = document.getElementById('minutes-entries-container');
    if (!container) return;

    if (this._minutesEntries.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--text-muted);font-size:0.84rem;">
          No entries yet. Click "Add Entry" to begin.
        </div>
      `;
    } else {
      container.innerHTML = this._minutesEntries.map((entry, i) =>
        this.renderMinutesEntryRow(entry, i)
      ).join('');
    }
    lucide.createIcons();
  }

  setupMinutesFormListeners(meetingId) {
    const form = document.getElementById('minutes-form');
    const photosInput = document.getElementById('minutes-photos-input');
    const previews = document.getElementById('minutes-photo-previews');
    const label = document.getElementById('minutes-photos-label');

    if (photosInput) {
      photosInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).slice(0, MAX_PHOTOS.MEETING);
        this._pendingMeetingPhotos = files;

        if (previews) {
          if (files.length > 0) {
            previews.style.display = 'flex';
            previews.innerHTML = files.map(file => {
              const url = URL.createObjectURL(file);
              return `
                <div style="width:80px;height:80px;border-radius:var(--border-radius-sm);
                            overflow:hidden;box-shadow:var(--neu-shadow-sm);">
                  <img src="${url}"
                       style="width:100%;height:100%;object-fit:cover;" />
                </div>
              `;
            }).join('');
          } else {
            previews.style.display = 'none';
          }
        }

        if (label) {
          label.textContent = files.length > 0
            ? `${files.length} photo(s) selected`
            : 'Upload meeting photographs';
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveMinutes(meetingId, form);
      });
    }
  }

  /* ============================================================
     SAVE MINUTES
     ============================================================ */
  async saveMinutes(meetingId, form) {
    const btn = document.getElementById('minutes-submit-btn');
    const msgEl = document.getElementById('minutes-form-msg');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const admin = this.auth.getAdmin();

    if (!data.actual_start_time) {
      this.showFormMsg(msgEl, 'Actual start time is required', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2"></i><span>Saving...</span>';
      lucide.createIcons();
    }

    try {
      // Collect minutes entries from DOM
      const entries = [];
      const timeInputs = document.querySelectorAll('#minutes-entries-container input[type="time"]');
      const headingInputs = document.querySelectorAll('#minutes-entries-container input[type="text"]');
      const detailsTextareas = document.querySelectorAll('#minutes-entries-container textarea');

      for (let i = 0; i < timeInputs.length; i++) {
        entries.push({
          time: timeInputs[i]?.value || '',
          heading: headingInputs[i]?.value || '',
          details: detailsTextareas[i]?.value || '',
          order: i + 1
        });
      }

      const finalizeMinutes = !!data.finalize_minutes;

      // Upload meeting photos
      if (this._pendingMeetingPhotos && this._pendingMeetingPhotos.length > 0) {
        for (let i = 0; i < this._pendingMeetingPhotos.length; i++) {
          const file = this._pendingMeetingPhotos[i];
          try {
            const compressed = await ImageUtils.compress(file, 1280, 960, 0.82);
            const filename = `meeting_photo_${meetingId}_${Date.now()}_${i}.jpg`;

            const { data: uploadData, error } = await this.db.storage
              .from(STORAGE_BUCKETS.MEETINGS)
              .upload(filename, compressed, {
                contentType: 'image/jpeg',
                upsert: false
              });

            if (!error && uploadData) {
              const url = ImageUtils.getPublicUrl(
                STORAGE_BUCKETS.MEETINGS, uploadData.path
              );
              await this.db.from('meeting_photos').insert({
                meeting_id: meetingId,
                photo_url: url,
                photo_name: file.name,
                sort_order: i,
                uploaded_by: admin.id
              });
            }
          } catch (e) {
            console.warn('Meeting photo upload error:', e);
          }
        }
        this._pendingMeetingPhotos = [];
      }

      // Calculate duration
      let durationText = '';
      if (data.actual_start_time && data.actual_end_time) {
        const duration = DateUtils.calcDuration(
          data.actual_start_time, data.actual_end_time
        );
        durationText = `${duration} minutes`;
      }

      const updatePayload = {
        minutes_content: entries,
        actual_start_time: data.actual_start_time || null,
        actual_end_time: data.actual_end_time || null,
        minutes_prepared_by: data.minutes_prepared_by?.trim() || null,
        sergeant_at_arms: data.sergeant_at_arms?.trim() || null,
        minutes_finalized: finalizeMinutes,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.db
        .from('meetings')
        .update(updatePayload)
        .eq('id', meetingId);

      if (error) throw error;

      // Send minutes to members if finalized
      if (finalizeMinutes && window.emailService) {
        await window.emailService.sendMeetingMinutes(meetingId);

        await this.db
          .from('meetings')
          .update({ is_minutes_sent: true })
          .eq('id', meetingId);
      }

      await this.auth.logActivity(
        admin.id, 'MINUTES_SAVED', 'meetings', meetingId,
        { finalized: finalizeMinutes }
      );

      this._currentDashboard?.showToast(
        finalizeMinutes
          ? 'Minutes finalized and sent to members!'
          : 'Minutes saved successfully!',
        'success'
      );

      await this.renderMeetingsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );
    } catch (error) {
      console.error('Save minutes error:', error);
      this.showFormMsg(
        msgEl,
        `Failed to save minutes: ${error.message}`,
        'error'
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save"></i><span>Save Minutes</span>';
        lucide.createIcons();
      }
    }
  }

  /* ============================================================
     VIEW ATTENDANCE
     ============================================================ */
  async renderAttendance(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: meetings } = await this.db
      .from('meetings')
      .select('id, title, meeting_date, meeting_type, start_time')
      .order('meeting_date', { ascending: false })
      .limit(20);

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="check-square"></i> Meeting Attendance
          </h1>
        </div>
      </div>

      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div style="padding:16px 20px;">
          <div class="form-group" style="max-width:400px;">
            <label class="form-label">
              <i data-lucide="calendar"></i> Select Meeting
            </label>
            <div class="select-wrap neu-inset">
              <select id="attendance-meeting-select" class="form-select"
                      onchange="meetingsAdmin.loadAttendanceForMeeting(this.value)">
                <option value="">Select a meeting...</option>
                ${meetings?.map(m => `
                  <option value="${m.id}">
                    ${StringUtils.sanitize(m.title)} —
                    ${DateUtils.format(m.meeting_date, 'short')}
                  </option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>
        </div>
      </div>

      <div id="attendance-content">
        <div class="admin-card neu-card">
          <div class="admin-empty-state" style="padding:60px;">
            <i data-lucide="check-square"
               style="width:40px;height:40px;opacity:0.4;"></i>
            <p>Select a meeting to view attendance</p>
          </div>
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  async viewAttendance(meetingId) {
    await this.renderAttendance(
      document.getElementById('admin-content'),
      this._currentDashboard
    );
    setTimeout(() => {
      const select = document.getElementById('attendance-meeting-select');
      if (select) {
        select.value = meetingId;
        this.loadAttendanceForMeeting(meetingId);
      }
    }, 200);
  }

  async loadAttendanceForMeeting(meetingId) {
    if (!meetingId) return;

    const content = document.getElementById('attendance-content');
    if (!content) return;

    content.innerHTML = `
      <div style="padding:40px;text-align:center;">
        <div class="loading-lines" style="width:200px;margin:0 auto;">
          <div class="loading-line"></div>
          <div class="loading-line"></div>
          <div class="loading-line"></div>
        </div>
      </div>
    `;

    try {
      const [meetingRes, attendanceRes] = await Promise.all([
        this.db
          .from('meetings')
          .select('*')
          .eq('id', meetingId)
          .single(),
        this.db
          .from('meeting_attendance')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('in_time', { ascending: true })
      ]);

      const meeting = meetingRes.data;
      const attendance = attendanceRes.data || [];

      content.innerHTML = `
        <div class="admin-card neu-card">
          <div class="admin-card-header">
            <div>
              <h3>${StringUtils.sanitize(meeting?.title || 'Meeting')}</h3>
              <p style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">
                ${DateUtils.format(meeting?.meeting_date, 'long')} •
                ${DateUtils.formatTime(meeting?.start_time)} •
                ${meeting?.venue ? StringUtils.sanitize(meeting.venue) : ''}
              </p>
            </div>
            <div style="display:flex;gap:8px;">
              <span style="padding:6px 14px;border-radius:var(--border-radius-full);
                           background:var(--accent-light);color:var(--accent);
                           font-size:0.82rem;font-weight:700;">
                ${attendance.length} Present
              </span>
              ${this.auth.can('VIEW_MEETING_ATTENDANCE') ? `
              <button class="btn btn-outline btn-sm"
                      onclick="meetingsAdmin.downloadAttendance('${meetingId}')">
                <i data-lucide="download"></i>
                <span>Download .docx</span>
              </button>` : ''}
            </div>
          </div>

          ${attendance.length === 0 ? `
          <div class="admin-empty-state" style="padding:60px;">
            <i data-lucide="users-x" style="width:36px;height:36px;opacity:0.4;"></i>
            <p>No attendance records found for this meeting</p>
            ${meeting?.attendance_form_url ? `
            <a href="${StringUtils.sanitize(meeting.attendance_form_url)}"
               target="_blank" class="btn btn-outline btn-sm" style="margin-top:8px;">
              <i data-lucide="external-link"></i>
              <span>Open Attendance Form</span>
            </a>` : ''}
          </div>` : `
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Name</th>
                  <th>RI ID</th>
                  <th>Designation</th>
                  <th>In Time</th>
                  <th>E-Sign</th>
                </tr>
              </thead>
              <tbody>
                ${attendance.map((record, i) => `
                  <tr>
                    <td style="color:var(--text-muted);font-size:0.82rem;">
                      ${i + 1}
                    </td>
                    <td>
                      <div style="font-weight:600;color:var(--text-heading);">
                        ${StringUtils.sanitize(record.member_name)}
                      </div>
                    </td>
                    <td style="font-size:0.82rem;color:var(--text-muted);">
                      ${StringUtils.sanitize(record.ri_id || '—')}
                    </td>
                    <td style="font-size:0.82rem;">
                      ${StringUtils.sanitize(record.designation || '—')}
                    </td>
                    <td style="font-size:0.82rem;white-space:nowrap;">
                      ${record.in_time ? DateUtils.formatTime(record.in_time) : '—'}
                    </td>
                    <td>
                      ${record.e_sign_url ? `
                      <img src="${StringUtils.sanitize(record.e_sign_url)}"
                           style="height:36px;width:auto;object-fit:contain;
                                  border-radius:4px;border:1px solid var(--border-color);"
                           loading="lazy"
                           onerror="this.style.display='none'" />` :
          '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`}
        </div>
      `;
    } catch (e) {
      content.innerHTML = `
        <div class="admin-card neu-card">
          <div class="admin-empty-state" style="padding:60px;">
            <i data-lucide="alert-circle" style="color:var(--danger);"></i>
            <p>Failed to load attendance data</p>
          </div>
        </div>
      `;
    }

    lucide.createIcons();
  }

  /* ============================================================
     DOWNLOAD DOCUMENTS
     ============================================================ */
  async downloadMeetingDocs(meetingId) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast('Document generator not available', 'error');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'download-docs-modal';

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:400px;">
        <div class="modal-header">
          <h2 class="modal-title">
            <i data-lucide="download"></i> Download Meeting Documents
          </h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('download-docs-modal').remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-outline"
                  onclick="meetingsAdmin.downloadAgenda('${meetingId}');document.getElementById('download-docs-modal').remove();document.body.style.overflow='';">
            <i data-lucide="list"></i>
            <span>Download Agenda (.docx)</span>
          </button>
          <button class="btn btn-outline"
                  onclick="meetingsAdmin.downloadAttendance('${meetingId}');document.getElementById('download-docs-modal').remove();document.body.style.overflow='';">
            <i data-lucide="check-square"></i>
            <span>Download Attendance (.docx)</span>
          </button>
          <button class="btn btn-primary"
                  onclick="meetingsAdmin.downloadMinutes('${meetingId}');document.getElementById('download-docs-modal').remove();document.body.style.overflow='';">
            <i data-lucide="file-text"></i>
            <span>Download Full Minutes (.docx)</span>
          </button>
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

  async downloadAgenda(meetingId) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast('Document generator not available', 'error');
      return;
    }
    this._currentDashboard?.showToast('Generating agenda...', 'info');
    try {
      await window.docGenerator.generateMeetingAgenda(meetingId);
      this._currentDashboard?.showToast('Agenda downloaded!', 'success');
    } catch (e) {
      this._currentDashboard?.showToast('Failed to generate agenda', 'error');
    }
  }

  async downloadAttendance(meetingId) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast('Document generator not available', 'error');
      return;
    }
    this._currentDashboard?.showToast('Generating attendance sheet...', 'info');
    try {
      await window.docGenerator.generateAttendanceSheet(meetingId);
      this._currentDashboard?.showToast('Attendance sheet downloaded!', 'success');
    } catch (e) {
      this._currentDashboard?.showToast('Failed to generate attendance sheet', 'error');
    }
  }

  async downloadMinutes(meetingId) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast('Document generator not available', 'error');
      return;
    }
    this._currentDashboard?.showToast('Generating meeting minutes...', 'info');
    try {
      await window.docGenerator.generateMeetingMinutes(meetingId);
      this._currentDashboard?.showToast('Minutes downloaded!', 'success');
    } catch (e) {
      this._currentDashboard?.showToast('Failed to generate minutes', 'error');
    }
  }

  /* ============================================================
     RENDER MEETING FORM (for dashboard stub)
     ============================================================ */
  renderMeetingForm(container, dashboard, data = null) {
    this._currentDashboard = dashboard;
    this.showMeetingForm(data?.id || null);
  }

  /* ============================================================
     HELPER
     ============================================================ */
  showFormMsg(el, message, type) {
    if (el) {
      el.textContent = message;
      el.className = `form-message ${type}`;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

/* ============================================================
   MEETINGS ADMIN STYLES
   ============================================================ */
const meetingsAdminStyles = `
  .meetings-type-summary { margin-bottom: 20px; }

  .minutes-entry-row {
    transition: var(--transition);
  }

  .minutes-entry-row:hover {
    border-color: var(--accent) !important;
  }

  .agenda-item-row {
    transition: var(--transition);
  }

  .agenda-item-row:hover {
    background: var(--accent-light) !important;
  }

  @media (max-width: 768px) {
    .meetings-type-summary > div {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
`;

/* ============================================================
   INJECT MEETINGS ADMIN STYLES
   ============================================================ */
(function injectMeetingsAdminStyles() {
  if (!document.getElementById('meetings-admin-styles')) {
    const style = document.createElement('style');
    style.id = 'meetings-admin-styles';
    style.textContent = meetingsAdminStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const meetingsAdmin = new MeetingsAdminManager();
window.meetingsAdmin = meetingsAdmin;

// Connect to admin dashboard
if (window.adminDashboard) {
  window.adminDashboard.renderMeetingsList = async (container) => {
    await meetingsAdmin.renderMeetingsList(container, window.adminDashboard);
  };
  window.adminDashboard.renderMeetingForm = (container, data) => {
    meetingsAdmin.renderMeetingForm(container, window.adminDashboard, data);
  };
  window.adminDashboard.renderMeetingAttendance = async (container) => {
    await meetingsAdmin.renderAttendance(container, window.adminDashboard);
  };
}
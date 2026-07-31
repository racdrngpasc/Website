/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   js/email-service.js
   
   All emails sent via Supabase Edge Function (send-email)
   which handles Resend → Gmail SMTP → EmailJS delivery.
   
   Public API:
     emailService.sendEventApprovalNotification(eventId)
     emailService.sendReportNotification(eventId)
     emailService.sendMeetingInvitation(meeting)
     emailService.sendMeetingAttendanceForm(meetingId)
     emailService.sendMeetingMinutes(meetingId)
     emailService.sendBirthdayWish(member)
     emailService.sendMonthlyTreasuryStatement()
     emailService.renderEmailCenter(container, dashboard)
   ============================================================ */

'use strict';

class EmailService {

  /* ============================================================
     CONSTRUCTOR
     ============================================================ */
  constructor() {
    this._db               = null;   // lazy — set in _getDb()
    this._settings         = {};
    this._settingsLoaded   = false;
    this._settingsLoadedAt = 0;
    this._SETTINGS_TTL_MS  = 5 * 60 * 1000;   // 5 minutes

    this._birthdayTimer        = null;
    this._meetingTimers        = {};
    this._monthlyTimer         = null;

    this.edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    this.edgeHeaders     = {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey':        SUPABASE_ANON_KEY
    };

    this._init();
  }

  /* ============================================================
     PRIVATE — LAZY SUPABASE CLIENT
     ============================================================ */
  _getDb() {
    if (!this._db) {
      this._db = getSupabaseClient();
    }
    return this._db;
  }

  /* ============================================================
     PRIVATE — INITIALISE
     ============================================================ */
  async _init() {
    try {
      await this._loadSettings();
      this._startBirthdayScheduler();
      this._startMonthlyStatementScheduler();
      this._scheduleTodayMeetings();
    } catch (e) {
      console.warn('[EmailService] init error:', e);
    }
  }

  /* ============================================================
     SETTINGS — LOAD WITH TTL CACHE
     ============================================================ */
  async _loadSettings(force = false) {
    const now    = Date.now();
    const stale  = (now - this._settingsLoadedAt) > this._SETTINGS_TTL_MS;

    if (!force && this._settingsLoaded && !stale) return;

    try {
      const { data, error } = await this._getDb()
        .from('club_settings')
        .select('key, value');

      if (error) throw error;

      if (data) {
        this._settings = {};
        data.forEach(row => {
          if (row.key != null && row.value != null) {
            this._settings[String(row.key)] = String(row.value);
          }
        });
      }

      this._settingsLoaded   = true;
      this._settingsLoadedAt = now;
    } catch (e) {
      console.warn('[EmailService] settings load error:', e);
    }
  }

  /** Return a setting value or the fallback */
  _getSetting(key, fallback = '') {
    return (this._settings[key] != null && this._settings[key] !== '')
      ? this._settings[key]
      : fallback;
  }

  /* ============================================================
     PRIVATE — VALIDATION HELPERS
     ============================================================ */

  /** True only for absolute HTTPS URLs */
  _isValidHttpsUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    try {
      const u = new URL(url.trim());
      return u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /** True for a plausible email address */
  _isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /* ============================================================
     PRIVATE — SANITISATION HELPERS
     ============================================================ */

  /** Escape HTML special characters to prevent XSS */
  _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /** Remove HTML tags — used when building plain-text fallbacks */
  _stripTags(html) {
    if (!html || typeof html !== 'string') return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ============================================================
     PRIVATE — FORMAT HELPERS
     ============================================================ */

  /** Format a date string to "1 January 2025" */
  _fmtDate(d) {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return String(d); }
  }

  /** Format a time string "HH:MM" or "HH:MM:SS" to "9:30 AM" */
  _fmtTime(t) {
    if (!t || typeof t !== 'string') return '';
    try {
      const parts = t.split(':').map(Number);
      const h     = parts[0] ?? 0;
      const m     = parts[1] ?? 0;
      const period   = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
    } catch { return t; }
  }

  /** Format a number as Indian Rupees */
  _fmtCur(v) {
    const num = parseFloat(String(v ?? 0)) || 0;
    return `Rs.\u00a0${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  /** Short date "02 Jan 2025" */
  _fmtShortDate(d) {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch { return String(d); }
  }

  /* ============================================================
     CORE — SEND EMAIL via Edge Function
     ============================================================ */
  async sendEmail(params = {}) {
    if (!params.subject?.trim()) {
      console.warn('[EmailService] sendEmail called without subject');
      return false;
    }

    const htmlMsg  = params.html_message || '';
    const plainMsg = params.message
      || this._stripTags(htmlMsg)
      || params.subject;

    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method:  'POST',
        headers: this.edgeHeaders,
        body: JSON.stringify({
          email_type:      params.email_type      || 'general',
          to_email:        params.to_email        || null,
          to_name:         params.to_name         || null,
          from_name:       params.from_name       || this._getSetting('club_name', CLUB_INFO.name),
          subject:         params.subject.trim(),
          html_message:    htmlMsg,
          message:         plainMsg,
          recipient_group: params.recipient_group || null,
          related_id:      params.related_id      || null,
          related_type:    params.related_type    || null
        })
      });

      let result = {};
      try { result = await response.json(); } catch { /* non-JSON */ }

      if (!response.ok) {
        console.error(
          '[EmailService] send failed:',
          response.status,
          result.error ?? result
        );
        return false;
      }

      if (result.success) {
        console.log(
          `[EmailService] sent via ${result.method ?? 'edge'}`
          + ` → ${result.recipient}`
        );
      }

      return result.success === true;

    } catch (err) {
      console.error('[EmailService] network error:', err);
      return false;
    }
  }

  /* ============================================================
     CORE — SEND TO MEMBERS GROUP
     ============================================================ */
  async _sendToGroup(subject, htmlBody, emailType = 'group') {
    return this.sendEmail({
      email_type:      emailType,
      to_email:        'ngpmembers@googlegroups.com',
      recipient_group: 'ngpmembers@googlegroups.com',
      from_name:       this._getSetting('club_name', CLUB_INFO.name),
      subject,
      html_message:    htmlBody,
      message:         this._stripTags(htmlBody)
    });
  }

  /* ============================================================
     BUILD — EMAIL WRAPPER (table-based layout)
     Produces a complete <!DOCTYPE html> document.
     Detects if bodyContent is already a full document (birthday
     email) and returns it unchanged to prevent double-wrapping.
     ============================================================ */
  _buildEmailWrapper(subject, bodyContent) {
    // Prevent double-wrapping
    const trimmed = (bodyContent || '').trimStart();
    if (
      trimmed.toLowerCase().startsWith('<!doctype') ||
      trimmed.toLowerCase().startsWith('<html')
    ) {
      return bodyContent;
    }

    const clubName = this._getSetting('club_name', CLUB_INFO.name);
    const clubId   = this._getSetting('club_id',   CLUB_INFO.clubId);
    const rawLogo  = this._getSetting('logo_colour_url', CLUB_INFO.logos?.colour ?? '');
    const logoUrl  = this._isValidHttpsUrl(rawLogo) ? rawLogo : '';

    const logoHtml = logoUrl
      ? `<img
           src="${logoUrl}"
           alt="${this._esc(clubName)} Logo"
           width="64" height="64"
           style="display:block;margin:0 auto 14px;border:0;
                  outline:none;border-radius:8px;" />`
      : '';

    const safeSubject  = this._esc(subject);
    const safeClubName = this._esc(clubName);
    const safeClubId   = this._esc(clubId);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;
             background-color:#f0f0f0;-webkit-font-smoothing:antialiased;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f0f0f0;padding:20px 0;">
    <tr>
      <td align="center">

        <table width="620" cellpadding="0" cellspacing="0" border="0"
               style="max-width:620px;width:100%;background:#ffffff;
                      border-radius:12px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- ═══ HEADER ═══ -->
          <tr>
            <td style="background:linear-gradient(135deg,#0055FF 0%,#003ACC 100%);
                       padding:32px 28px;text-align:center;">
              ${logoHtml}
              <h1 style="color:#ffffff;font-size:19px;font-weight:700;
                         margin:0 0 4px;letter-spacing:0.01em;
                         font-family:Arial,Helvetica,sans-serif;">
                ${safeClubName}
              </h1>
              <p style="color:rgba(255,255,255,0.80);font-size:12px;margin:0;
                        font-family:Arial,Helvetica,sans-serif;">
                Parented by Rotary Club of Coimbatore Meridian
              </p>
            </td>
          </tr>

          <!-- ═══ BODY ═══ -->
          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;">
              ${bodyContent}
            </td>
          </tr>

          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td style="background:#f7f8fa;padding:20px 28px;
                       border-top:1px solid #eeeeee;text-align:center;
                       font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 4px;color:#333333;font-size:12px;font-weight:700;">
                ${safeClubName}
              </p>
              <p style="margin:0 0 3px;color:#999999;font-size:11px;">
                Parented by Rotary Club of Coimbatore Meridian
              </p>
              <p style="margin:0 0 3px;color:#999999;font-size:11px;">
                Club ID: ${safeClubId}
                &nbsp;&bull;&nbsp;
                Rotary International District 3206
              </p>
              <p style="margin:0 0 3px;color:#999999;font-size:11px;">
                Dr. N.G.P. Arts and Science College,
                Coimbatore&#8209;641048. Tamil&nbsp;Nadu.
              </p>
              <p style="margin:10px 0 0;color:#cccccc;font-size:10px;">
                This is an automated notification from the Rotaract Club Portal.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
  }

  /* ============================================================
     BUILD — INFO BANNER
     ============================================================ */
  _banner(colour, icon, title, subtitle) {
    /* colour: '#0055FF' | '#38A169' | '#E53E3E' | '#6B46C1' | '#2D3748' */
    const bg = colour + '18';   // 10% opacity hex
    return `
      <div style="background:${bg};border-left:4px solid ${colour};
                  padding:16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
        <h2 style="margin:0 0 5px;color:${colour};font-size:16px;font-weight:700;
                   font-family:Arial,Helvetica,sans-serif;">
          ${icon ? icon + '&nbsp;&nbsp;' : ''}${this._esc(title)}
        </h2>
        ${subtitle
          ? `<p style="margin:0;color:#444444;font-size:13px;
                       font-family:Arial,Helvetica,sans-serif;">
               ${this._esc(subtitle)}
             </p>`
          : ''}
      </div>`;
  }

  /* ============================================================
     BUILD — DETAIL TABLE ROW
     ============================================================ */
  _row(label, value, last = false) {
    const border = last ? '' : 'border-bottom:1px solid #eeeeee;';
    return `
      <tr>
        <td style="padding:9px 12px;${border}font-weight:600;color:#333333;
                   width:36%;background:#f9f9f9;font-size:13px;
                   font-family:Arial,Helvetica,sans-serif;">
          ${this._esc(label)}
        </td>
        <td style="padding:9px 12px;${border}color:#555555;font-size:13px;
                   font-family:Arial,Helvetica,sans-serif;">
          ${value ?? '&mdash;'}
        </td>
      </tr>`;
  }

  /* ============================================================
     BUILD — DETAIL TABLE WRAPPER
     ============================================================ */
  _table(rows) {
    return `
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;
                    font-family:Arial,Helvetica,sans-serif;">
        ${rows}
      </table>`;
  }

  /* ============================================================
     1. EVENT APPROVAL NOTIFICATION
     ============================================================ */
  async sendEventApprovalNotification(eventId) {
    if (!eventId) return false;

    try {
      const { data: event, error } = await this._getDb()
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error || !event) {
        console.warn('[EmailService] event not found:', eventId);
        return false;
      }

      const AVENUE_LABELS = {
        club_service:              'Club Service',
        community_service:         'Community Service',
        professional_service:      'Professional Service',
        international_service:     'International Service',
        district_priority_projects:'District Priority Projects'
      };

      const avenueLabel = event.is_dpp
        ? 'District Priority Projects'
        : (AVENUE_LABELS[event.avenue] || this._esc(event.avenue) || '—');

      const timeRange = event.start_time
        ? this._fmtTime(event.start_time)
          + (event.end_time ? ` to ${this._fmtTime(event.end_time)}` : '')
        : '—';

      const subject = `[Rotaract] New Event Approved: ${event.title}`;

      const bodyContent = `
        ${this._banner('#0055FF', '&#x1F4CB;', 'New Event Approved!',
          'An event has been approved and published on the club portal.')}

        <h3 style="color:#222222;font-size:17px;margin:0 0 14px;font-weight:700;
                   font-family:Arial,Helvetica,sans-serif;">
          ${this._esc(event.title)}
        </h3>

        ${this._table(
          this._row('Date',            this._fmtDate(event.event_date))
        + this._row('Time',            timeRange)
        + this._row('Venue',           this._esc(event.venue) || '—')
        + this._row('Event Chair',     this._esc(event.event_chair) || '—')
        + (event.event_secretary
            ? this._row('Event Secretary', this._esc(event.event_secretary))
            : '')
        + this._row('Avenue',          avenueLabel)
        + this._row('Group',           `Group ${this._esc(String(event.group_number || 1))}`, true)
        )}

        ${event.description ? `
        <div style="background:#f9f9f9;padding:14px;border-radius:6px;
                    margin-bottom:20px;">
          <h4 style="margin:0 0 6px;font-size:13px;color:#333333;font-weight:700;
                     font-family:Arial,Helvetica,sans-serif;">
            About This Event
          </h4>
          <p style="margin:0;color:#666666;font-size:13px;line-height:1.7;
                    font-family:Arial,Helvetica,sans-serif;">
            ${this._esc(event.description)}
          </p>
        </div>` : ''}
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      return this._sendToGroup(subject, htmlBody, 'event_approval');

    } catch (e) {
      console.error('[EmailService] sendEventApprovalNotification:', e);
      return false;
    }
  }

  /* ============================================================
     2. EVENT REPORT NOTIFICATION
     ============================================================ */
  async sendReportNotification(eventId) {
    if (!eventId) return false;

    try {
      const { data: event, error } = await this._getDb()
        .from('events')
        .select('*, event_reports(report_content, key_highlights, is_approved)')
        .eq('id', eventId)
        .single();

      if (error || !event) {
        console.warn('[EmailService] event not found for report:', eventId);
        return false;
      }

      // Find the approved report — not just index 0
      const report = (event.event_reports || []).find(r => r.is_approved);
      if (!report) {
        console.warn('[EmailService] no approved report found for event:', eventId);
        return false;
      }

      const subject = `[Rotaract] Event Report Published: ${event.title}`;

      const bodyContent = `
        ${this._banner('#38A169', '&#x1F4C4;', 'Event Report Published!',
          'The event report has been approved and is now available.')}

        <h3 style="color:#222222;font-size:17px;margin:0 0 14px;font-weight:700;
                   font-family:Arial,Helvetica,sans-serif;">
          ${this._esc(event.title)}
        </h3>

        ${this._table(
          this._row('Date', this._fmtDate(event.event_date))
        + (event.actual_attendance
            ? this._row('Attendance', `${this._esc(String(event.actual_attendance))} participants`)
            : '')
        + (event.service_hours
            ? this._row('Service Hours', `${this._esc(String(event.service_hours))} hours`, true)
            : '')
        )}

        ${report.key_highlights ? `
        <div style="background:#f0f7ff;padding:14px;border-radius:6px;margin-top:4px;">
          <strong style="color:#0055FF;font-size:13px;display:block;margin-bottom:6px;
                         font-family:Arial,Helvetica,sans-serif;">
            Key Highlights
          </strong>
          <p style="margin:0;color:#555555;font-size:13px;line-height:1.7;
                    font-family:Arial,Helvetica,sans-serif;">
            ${this._esc(report.key_highlights)}
          </p>
        </div>` : ''}
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      return this._sendToGroup(subject, htmlBody, 'report_notification');

    } catch (e) {
      console.error('[EmailService] sendReportNotification:', e);
      return false;
    }
  }

  /* ============================================================
     3. MEETING INVITATION
     ============================================================ */
  async sendMeetingInvitation(meeting) {
    if (!meeting) return false;

    try {
      const MEETING_LABELS = {
        board_meeting:        'Board Meeting',
        general_body_meeting: 'General Body Meeting',
        special_meeting:      'Special Meeting',
        emergency_meeting:    'Emergency Meeting'
      };

      const typeLabel = MEETING_LABELS[meeting.meeting_type]
        || this._esc(meeting.meeting_type)
        || 'Meeting';

      const timeRange = meeting.start_time
        ? this._fmtTime(meeting.start_time)
          + (meeting.end_time ? ` to ${this._fmtTime(meeting.end_time)}` : '')
        : '—';

      const agenda = Array.isArray(meeting.agenda) ? meeting.agenda : [];

      const subject = `[Rotaract] Meeting Invitation: ${meeting.title}`;

      const bodyContent = `
        <div style="background:#ede9fe;border-left:4px solid #6B46C1;padding:16px;
                    border-radius:0 8px 8px 0;margin-bottom:20px;">
          <h2 style="margin:0 0 8px;color:#6B46C1;font-size:16px;font-weight:700;
                     font-family:Arial,Helvetica,sans-serif;">
            &#x1F4C5;&nbsp;&nbsp;${this._esc(meeting.title)}
          </h2>
          <span style="display:inline-block;padding:3px 12px;border-radius:20px;
                       background:#6B46C1;color:#ffffff;font-size:11px;font-weight:700;
                       font-family:Arial,Helvetica,sans-serif;">
            ${typeLabel}
          </span>
        </div>

        ${this._table(
          this._row('Date',  this._fmtDate(meeting.meeting_date))
        + this._row('Time',  timeRange)
        + this._row('Venue', this._esc(meeting.venue) || '—')
        + this._row('Group', `Group ${this._esc(String(meeting.group_number || 1))}`, true)
        )}

        ${agenda.length > 0 ? `
        <div style="background:#f0f7ff;padding:16px;border-radius:6px;margin-bottom:20px;">
          <h3 style="margin:0 0 10px;color:#0055FF;font-size:13px;font-weight:700;
                     font-family:Arial,Helvetica,sans-serif;">
            Agenda
          </h3>
          <ol style="margin:0;padding-left:20px;">
            ${agenda.map(item => `
              <li style="color:#444444;font-size:13px;line-height:1.8;margin-bottom:4px;
                         font-family:Arial,Helvetica,sans-serif;">
                ${this._esc(item.text || String(item))}
              </li>
            `).join('')}
          </ol>
        </div>` : ''}

        <div style="background:#fff8e1;border:1px solid #ffc107;
                    padding:12px 14px;border-radius:6px;">
          <p style="margin:0;color:#856404;font-size:13px;font-weight:600;
                    font-family:Arial,Helvetica,sans-serif;">
            &#x26A0;&#xFE0F;&nbsp;
            Please ensure timely attendance.
            An attendance form will be sent at the start of the meeting.
          </p>
        </div>
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      return this._sendToGroup(subject, htmlBody, 'meeting_invitation');

    } catch (e) {
      console.error('[EmailService] sendMeetingInvitation:', e);
      return false;
    }
  }

  /* ============================================================
     4. MEETING ATTENDANCE FORM
     ============================================================ */
  async sendMeetingAttendanceForm(meetingId) {
    if (!meetingId) return false;

    try {
      const { data: meeting, error } = await this._getDb()
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error || !meeting) {
        console.warn('[EmailService] meeting not found:', meetingId);
        return false;
      }

      const subject = `[Rotaract ATTENDANCE] ${meeting.title} — Mark Now`;

      const bodyContent = `
        ${this._banner('#E53E3E', '&#x23F0;', 'Mark Your Attendance Now!',
          'The meeting has started. Please mark your attendance immediately.')}

        ${this._table(
          this._row('Meeting', `<strong>${this._esc(meeting.title)}</strong>`)
        + this._row('Date',    this._fmtDate(meeting.meeting_date))
        + this._row('Time',    this._fmtTime(meeting.start_time))
        + this._row('Venue',   this._esc(meeting.venue) || '—', true)
        )}

        <div style="background:#e8f4fd;padding:14px;border-radius:6px;margin-bottom:16px;">
          <h3 style="margin:0 0 8px;color:#0055FF;font-size:13px;font-weight:700;
                     font-family:Arial,Helvetica,sans-serif;">
            This form collects:
          </h3>
          <ul style="margin:0;padding-left:20px;color:#555555;font-size:13px;
                     line-height:1.9;font-family:Arial,Helvetica,sans-serif;">
            <li>Your Full Name</li>
            <li>Your Designation / Portfolio</li>
            <li>Your RI ID</li>
            <li>Your In-Time</li>
            <li>E-Signature (Photo Upload)</li>
          </ul>
        </div>

        <p style="color:#999999;font-size:11px;text-align:center;margin:0;
                  font-family:Arial,Helvetica,sans-serif;">
          Please mark attendance within 30 minutes of meeting start.
        </p>
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      const result   = await this._sendToGroup(subject, htmlBody, 'meeting_attendance');

      if (result) {
        try {
          await this._getDb()
            .from('meetings')
            .update({ is_invitation_sent: true })
            .eq('id', meetingId);
        } catch (dbErr) {
          console.warn('[EmailService] failed to mark invitation sent:', dbErr);
        }
      }

      return result;

    } catch (e) {
      console.error('[EmailService] sendMeetingAttendanceForm:', e);
      return false;
    }
  }

  /* ============================================================
     5. MEETING MINUTES
     ============================================================ */
  async sendMeetingMinutes(meetingId) {
    if (!meetingId) return false;

    try {
      const { data: meeting, error } = await this._getDb()
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error || !meeting) {
        console.warn('[EmailService] meeting not found:', meetingId);
        return false;
      }

      if (!meeting.minutes_finalized) {
        console.warn('[EmailService] minutes not finalized for meeting:', meetingId);
        return false;
      }

      const MEETING_LABELS = {
        board_meeting:        'Board Meeting',
        general_body_meeting: 'General Body Meeting',
        special_meeting:      'Special Meeting',
        emergency_meeting:    'Emergency Meeting'
      };

      const minutes = Array.isArray(meeting.minutes_content)
        ? meeting.minutes_content : [];

      const actualStart = meeting.actual_start_time || meeting.start_time;
      const actualEnd   = meeting.actual_end_time   || meeting.end_time;
      let   durationMin = 0;

      if (actualStart && actualEnd) {
        try {
          const [sh, sm] = actualStart.split(':').map(Number);
          const [eh, em] = actualEnd.split(':').map(Number);
          durationMin = (eh * 60 + em) - (sh * 60 + sm);
          if (durationMin < 0) durationMin = 0;
        } catch { /* ignore */ }
      }

      const subject = `[Rotaract] Meeting Minutes: ${meeting.title}`;

      const bodyContent = `
        ${this._banner('#2D3748', '&#x1F4CB;', 'Meeting Minutes Ready',
          'Minutes of the meeting have been finalized and are now available.')}

        <h3 style="color:#222222;font-size:16px;margin:0 0 14px;font-weight:700;
                   font-family:Arial,Helvetica,sans-serif;">
          ${this._esc(meeting.title)}
        </h3>

        ${this._table(
          this._row('Date',   this._fmtDate(meeting.meeting_date))
        + this._row('Venue',  this._esc(meeting.venue) || '—')
        + this._row('Type',   MEETING_LABELS[meeting.meeting_type] || this._esc(meeting.meeting_type))
        + (durationMin > 0
            ? this._row('Duration', `${durationMin} minutes`, true)
            : '')
        )}

        ${minutes.length > 0 ? `
        <div style="border:1px solid #e2e8f0;border-radius:8px;
                    overflow:hidden;margin-bottom:16px;">
          <div style="background:#2D3748;padding:10px 16px;">
            <h3 style="margin:0;color:#ffffff;font-size:13px;font-weight:700;
                       font-family:Arial,Helvetica,sans-serif;">
              Minutes of Meeting
            </h3>
          </div>
          <div style="padding:16px;">
            ${minutes.map((entry, idx) => `
              <div style="margin-bottom:${idx < minutes.length - 1 ? '14px' : '0'};
                          ${idx < minutes.length - 1
                            ? 'padding-bottom:14px;border-bottom:1px solid #eeeeee;'
                            : ''}">
                <div style="margin-bottom:5px;">
                  ${entry.time ? `
                  <span style="color:#0055FF;font-size:12px;font-weight:700;
                               display:inline-block;min-width:64px;
                               font-family:Arial,Helvetica,sans-serif;">
                    ${this._fmtTime(entry.time)}
                  </span>` : ''}
                  <span style="color:#333333;font-size:13px;font-weight:700;
                               font-family:Arial,Helvetica,sans-serif;">
                    ${this._esc(entry.heading || '')}
                  </span>
                </div>
                ${entry.details ? `
                <p style="margin:0 0 0 ${entry.time ? '64px' : '0'};
                          color:#555555;font-size:13px;line-height:1.7;
                          font-family:Arial,Helvetica,sans-serif;">
                  ${this._esc(entry.details)}
                </p>` : ''}
              </div>
            `).join('')}
            ${durationMin > 0 ? `
            <p style="font-size:13px;color:#555555;margin:14px 0 0;
                      font-family:Arial,Helvetica,sans-serif;">
              <strong>Duration:</strong> ${durationMin} minutes
            </p>` : ''}
          </div>
        </div>` : ''}
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      const result   = await this._sendToGroup(subject, htmlBody, 'meeting_minutes');

      if (result) {
        try {
          await this._getDb()
            .from('meetings')
            .update({ is_minutes_sent: true })
            .eq('id', meetingId);
        } catch (dbErr) {
          console.warn('[EmailService] failed to mark minutes sent:', dbErr);
        }
      }

      return result;

    } catch (e) {
      console.error('[EmailService] sendMeetingMinutes:', e);
      return false;
    }
  }

  /* ============================================================
     6. BIRTHDAY WISH
     Individual email — not sent to group
     ============================================================ */
  async sendBirthdayWish(member) {
    if (!member?.email || !this._isValidEmail(member.email)) {
      console.warn('[EmailService] invalid member email for birthday wish');
      return false;
    }

    try {
      const clubName  = this._getSetting('club_name',   CLUB_INFO.name);
      const clubId    = this._getSetting('club_id',     CLUB_INFO.clubId);
      const parentClub = this._getSetting('parent_club', CLUB_INFO.parentClub
        || 'Rotary Club of Coimbatore Meridian');

      const safeName     = this._esc(member.full_name || 'Rotaractor');
      const safeClub     = this._esc(clubName);
      const safeParent   = this._esc(parentClub);
      const safeClubId   = this._esc(clubId);

      const subject = `Happy Birthday ${member.full_name}! — ${clubName}`;

      // Birthday email uses its own full-document design (not the standard wrapper)
      const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Happy Birthday!</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;
             background-color:#f5f5f5;-webkit-font-smoothing:antialiased;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f5f5f5;padding:20px 0;">
    <tr>
      <td align="center">

        <!-- Gradient border wrapper -->
        <table width="580" cellpadding="3" cellspacing="0" border="0"
               style="max-width:580px;width:100%;
                      background:linear-gradient(135deg,#f093fb,#f5576c);
                      border-radius:14px;">
          <tr>
            <td>

              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#ffffff;border-radius:12px;overflow:hidden;">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#f093fb,#f5576c);
                             padding:40px 28px;text-align:center;">
                    <div style="font-size:54px;line-height:1;margin-bottom:12px;">
                      &#127874;
                    </div>
                    <h1 style="color:#ffffff;font-size:28px;font-weight:800;
                               margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">
                      Happy Birthday!
                    </h1>
                    <p style="color:rgba(255,255,255,0.95);font-size:17px;
                              font-weight:600;margin:0;
                              font-family:Arial,Helvetica,sans-serif;">
                      ${safeName}
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 28px;text-align:center;
                             font-family:Arial,Helvetica,sans-serif;">
                    <p style="color:#333333;font-size:16px;font-weight:600;
                              margin:0 0 14px;">
                      Wishing you a wonderful birthday! &#127881;
                    </p>
                    <p style="color:#555555;font-size:14px;line-height:1.9;
                              margin:0 0 24px;max-width:420px;
                              margin-left:auto;margin-right:auto;">
                      On behalf of the entire <strong>${safeClub}</strong> family,
                      we wish you a very happy birthday!
                      May this special day bring you joy, success, and fulfilment.
                      Your dedication and service to Rotaract inspire us all!
                    </p>

                    <!-- Quote box -->
                    <div style="background:linear-gradient(135deg,
                                  rgba(240,147,251,0.10),rgba(245,87,108,0.10));
                                border:1px solid rgba(245,87,108,0.22);
                                padding:16px;border-radius:8px;margin-bottom:28px;">
                      <p style="margin:0;color:#C53030;font-size:13px;
                                font-style:italic;font-weight:600;
                                font-family:Arial,Helvetica,sans-serif;">
                        &ldquo;Service Above Self&rdquo;
                        &mdash; Happy Birthday, Rotaractor!
                      </p>
                    </div>

                    <p style="color:#555555;font-size:13px;margin:0 0 4px;">
                      With warm regards,
                    </p>
                    <p style="color:#333333;font-size:14px;font-weight:700;
                              margin:0 0 3px;">
                      ${safeClub}
                    </p>
                    <p style="color:#888888;font-size:12px;margin:0 0 2px;">
                      Parented by ${safeParent}
                    </p>
                    <p style="color:#888888;font-size:12px;margin:0;">
                      Club ID: ${safeClubId}
                      &nbsp;|&nbsp;
                      Rotary International District 3206
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f7f8fa;padding:16px 28px;
                             border-top:1px solid #eeeeee;text-align:center;
                             font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;color:#cccccc;font-size:10px;">
                      This birthday wish was sent automatically
                      by the Rotaract Club Portal.
                    </p>
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

      return this.sendEmail({
        email_type:   'birthday_wish',
        to_email:     member.email,
        to_name:      member.full_name,
        from_name:    clubName,
        subject,
        html_message: htmlBody,
        message: `Happy Birthday ${member.full_name}! `
               + `Wishing you a wonderful day from ${clubName}.`
      });

    } catch (e) {
      console.error('[EmailService] sendBirthdayWish:', e);
      return false;
    }
  }

  /* ============================================================
     7. MONTHLY TREASURY STATEMENT
     ============================================================ */
  async sendMonthlyTreasuryStatement() {
    const enabled = this._getSetting('monthly_statement_email_enabled', 'true');
    if (enabled !== 'true') return false;

    try {
      // Compute date range for the previous calendar month
      const now            = new Date();
      const firstOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthEnd   = new Date(firstOfMonth - 1);
      const lastMonthStart = new Date(
        lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1
      );

      const startDate = lastMonthStart.toISOString().split('T')[0];
      const endDate   = lastMonthEnd.toISOString().split('T')[0];
      const monthName = lastMonthEnd.toLocaleDateString('en-IN', { month: 'long' });
      const yearLabel = lastMonthEnd.getFullYear();

      const { data: transactions, error } = await this._getDb()
        .from('treasury_transactions')
        .select('*')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        console.log('[EmailService] no transactions for', monthName, yearLabel);
        return false;
      }

      const totalIncome = transactions
        .filter(t => t.transaction_type === 'income')
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

      const totalExpense = transactions
        .filter(t => t.transaction_type === 'expense')
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

      const lastTx         = transactions[transactions.length - 1];
      const closingBalance = parseFloat(lastTx?.balance ?? 0) || 0;

      const subject =
        `[Rotaract] Monthly Treasury Statement — ${monthName} ${yearLabel}`;

      /* ── Summary cards ── */
      const summaryRow = (bg, border, labelColor, label, valColor, value) => `
        <td style="width:33%;padding:4px;">
          <div style="background:${bg};border:1px solid ${border};
                      padding:14px;border-radius:8px;text-align:center;">
            <div style="color:${labelColor};font-size:10px;font-weight:700;
                        text-transform:uppercase;letter-spacing:0.07em;
                        margin-bottom:5px;font-family:Arial,Helvetica,sans-serif;">
              ${label}
            </div>
            <div style="color:${valColor};font-size:14px;font-weight:800;
                        font-family:Arial,Helvetica,sans-serif;">
              ${value}
            </div>
          </div>
        </td>`;

      const bodyContent = `
        ${this._banner('#38A169', '&#x1F4B0;',
          'Monthly Treasury Statement',
          `${monthName} ${yearLabel} — ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`
        )}

        <!-- Summary -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="margin-bottom:20px;">
          <tr>
            ${summaryRow('#f0fff4','#68D391','#38A169','Total Income',  '#276749', this._fmtCur(totalIncome))}
            ${summaryRow('#fff5f5','#FC8181','#E53E3E','Total Expense', '#C53030', this._fmtCur(totalExpense))}
            ${summaryRow('#ebf4ff','#63B3ED','#3182CE','Closing Balance',
              closingBalance >= 0 ? '#2B6CB0' : '#C53030',
              this._fmtCur(closingBalance))}
          </tr>
        </table>

        <!-- Transaction table -->
        <h4 style="font-size:13px;font-weight:700;color:#333333;margin:0 0 10px;
                   font-family:Arial,Helvetica,sans-serif;">
          Transaction Details
        </h4>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-collapse:collapse;font-size:12px;
                      font-family:Arial,Helvetica,sans-serif;">
          <thead>
            <tr style="background:#2D3748;color:#ffffff;">
              <th style="padding:9px 8px;text-align:left;font-weight:600;">#</th>
              <th style="padding:9px 8px;text-align:left;font-weight:600;">Date</th>
              <th style="padding:9px 8px;text-align:left;font-weight:600;">Particular</th>
              <th style="padding:9px 8px;text-align:right;font-weight:600;">Income</th>
              <th style="padding:9px 8px;text-align:right;font-weight:600;">Expense</th>
              <th style="padding:9px 8px;text-align:right;font-weight:600;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.slice(0, 30).map((t, i) => {
              const isIncome  = t.transaction_type === 'income';
              const bal       = parseFloat(t.balance ?? 0) || 0;
              return `
              <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
                <td style="padding:7px 8px;color:#888888;">${i + 1}</td>
                <td style="padding:7px 8px;color:#444444;white-space:nowrap;">
                  ${this._fmtShortDate(t.transaction_date)}
                </td>
                <td style="padding:7px 8px;color:#333333;">
                  ${this._esc(t.particular || '')}
                </td>
                <td style="padding:7px 8px;text-align:right;
                           color:${isIncome ? '#38A169' : '#cccccc'};">
                  ${isIncome ? this._fmtCur(t.amount) : '&mdash;'}
                </td>
                <td style="padding:7px 8px;text-align:right;
                           color:${!isIncome ? '#E53E3E' : '#cccccc'};">
                  ${!isIncome ? this._fmtCur(t.amount) : '&mdash;'}
                </td>
                <td style="padding:7px 8px;text-align:right;font-weight:600;
                           color:${bal >= 0 ? '#2B6CB0' : '#E53E3E'};">
                  ${this._fmtCur(t.balance)}
                </td>
              </tr>`;
            }).join('')}
            <!-- Totals row -->
            <tr style="background:#2D3748;color:#ffffff;font-weight:700;">
              <td colspan="3"
                  style="padding:9px 8px;text-align:right;
                         font-family:Arial,Helvetica,sans-serif;">
                TOTAL
              </td>
              <td style="padding:9px 8px;text-align:right;">
                ${this._fmtCur(totalIncome)}
              </td>
              <td style="padding:9px 8px;text-align:right;">
                ${this._fmtCur(totalExpense)}
              </td>
              <td style="padding:9px 8px;text-align:right;">
                ${this._fmtCur(closingBalance)}
              </td>
            </tr>
          </tbody>
        </table>

        ${transactions.length > 30 ? `
        <p style="font-size:11px;color:#999999;margin:8px 0 0;text-align:center;
                  font-family:Arial,Helvetica,sans-serif;">
          Showing first 30 of ${transactions.length} transactions.
          Log in to the portal to view the full ledger.
        </p>` : ''}
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      return this._sendToGroup(subject, htmlBody, 'monthly_statement');

    } catch (e) {
      console.error('[EmailService] sendMonthlyTreasuryStatement:', e);
      return false;
    }
  }

  /* ============================================================
     SCHEDULER — BIRTHDAY
     Runs once daily at 00:01 AM — NOT on every page load
     Uses localStorage to track sent emails per year per member
     ============================================================ */
  _startBirthdayScheduler() {
    const enabled = this._getSetting('birthday_email_enabled', 'true');
    if (enabled !== 'true') return;

    const checkBirthdays = async () => {
      try {
        await this._loadSettings();   // refresh settings before each run

        const enabled2 = this._getSetting('birthday_email_enabled', 'true');
        if (enabled2 !== 'true') return;

        const today     = new Date();
        const todayMon  = today.getMonth() + 1;
        const todayDay  = today.getDate();
        const thisYear  = today.getFullYear();

        const { data: members, error } = await this._getDb()
          .from('members')
          .select('id, full_name, email, date_of_birth')
          .eq('is_active', true)
          .not('date_of_birth', 'is', null)
          .not('email', 'is', null);

        if (error) throw error;
        if (!members?.length) return;

        for (const member of members) {
          if (!this._isValidEmail(member.email)) continue;

          const dob = new Date(member.date_of_birth);
          if (isNaN(dob.getTime())) continue;

          if (dob.getMonth() + 1 !== todayMon || dob.getDate() !== todayDay) {
            continue;
          }

          // One email per member per year — stored in localStorage
          const sentKey = `bday_${member.id}_${thisYear}`;
          let alreadySent = false;

          try {
            const stored = localStorage.getItem(sentKey);
            if (stored) {
              const parsed = JSON.parse(stored);
              alreadySent  = parsed?.sent === true;
            }
          } catch { /* ignore storage errors */ }

          if (alreadySent) continue;

          const sent = await this.sendBirthdayWish(member);
          if (sent) {
            try {
              localStorage.setItem(sentKey, JSON.stringify({
                sent: true,
                at:   new Date().toISOString()
              }));
            } catch { /* storage full — ignore */ }
          }
        }
      } catch (e) {
        console.warn('[EmailService] birthday check error:', e);
      }
    };

    const scheduleNextMidnight = () => {
      const now      = new Date();
      const midnight = new Date(
        now.getFullYear(), now.getMonth(), now.getDate() + 1,
        0, 1, 0   // 00:01 AM
      );
      const delay = midnight.getTime() - now.getTime();

      this._birthdayTimer = setTimeout(async () => {
        await checkBirthdays();
        scheduleNextMidnight();     // self-reschedule each day
      }, delay);

      console.log(
        `[EmailService] birthday check in ${Math.round(delay / 60000)}m`
      );
    };

    scheduleNextMidnight();
  }

  /* ============================================================
     SCHEDULER — MONTHLY STATEMENT
     Fires at 09:00 AM on the 1st of each month
     ============================================================ */
  _startMonthlyStatementScheduler() {
    const scheduleNext = () => {
      const now              = new Date();
      const firstNextMonth   = new Date(
        now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0
      );
      const delay = firstNextMonth.getTime() - now.getTime();

      this._monthlyTimer = setTimeout(async () => {
        try {
          await this._loadSettings(true);
          await this.sendMonthlyTreasuryStatement();
        } catch (e) {
          console.warn('[EmailService] monthly statement scheduler error:', e);
        }
        scheduleNext();
      }, delay);

      console.log(
        `[EmailService] monthly statement in ${Math.round(delay / 3600000)}h`
      );
    };

    scheduleNext();
  }

  /* ============================================================
     SCHEDULER — TODAY'S MEETING ATTENDANCE FORMS
     Fires at each meeting's start_time
     ============================================================ */
  async _scheduleTodayMeetings() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: meetings, error } = await this._getDb()
        .from('meetings')
        .select('id, title, meeting_date, start_time')
        .eq('meeting_date', today)
        .eq('is_invitation_sent', false);

      if (error) throw error;
      if (!meetings?.length) return;

      const now = Date.now();

      meetings.forEach(meeting => {
        if (!meeting.start_time) return;

        const parts = meeting.start_time.split(':').map(Number);
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;

        const todayDate  = new Date();
        const meetingTs  = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth(),
          todayDate.getDate(),
          h, m, 0
        ).getTime();

        const delay = meetingTs - now;

        // Only schedule if it's still in the future (within 24h)
        if (delay <= 0 || delay >= 24 * 60 * 60 * 1000) return;

        // Clear any existing timer for this meeting
        if (this._meetingTimers[meeting.id]) {
          clearTimeout(this._meetingTimers[meeting.id]);
        }

        this._meetingTimers[meeting.id] = setTimeout(async () => {
          await this.sendMeetingAttendanceForm(meeting.id);
          delete this._meetingTimers[meeting.id];
        }, delay);

        console.log(
          `[EmailService] attendance form for "${meeting.title}"`
          + ` in ${Math.round(delay / 60000)}m`
        );
      });

    } catch (e) {
      console.warn('[EmailService] meeting scheduler error:', e);
    }
  }

  /* ============================================================
     PUBLIC ALIAS — scheduleTodayMeetings
     Exposed so the admin UI can trigger a reschedule
     ============================================================ */
  async scheduleTodayMeetings() {
    return this._scheduleTodayMeetings();
  }

  /* ============================================================
     PUBLIC — TOGGLE AUTOMATION SETTING
     ============================================================ */
  async toggleAutomation(key, enabled) {
    try {
      const value = enabled ? 'true' : 'false';
      await this._getDb()
        .from('club_settings')
        .update({ value })
        .eq('key', key);
      this._settings[key] = value;
    } catch (e) {
      console.warn('[EmailService] toggleAutomation error:', e);
    }
  }

  /* ============================================================
     PUBLIC — LOAD EMAIL LOGS (admin UI)
     ============================================================ */
  async loadEmailLogs() {
    const container = document.getElementById('email-logs-container');
    if (!container) return;

    try {
      const { data: logs, error } = await this._getDb()
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;

      if (!logs?.length) {
        container.innerHTML = `
          <div style="text-align:center;color:var(--text-muted);
                      font-size:0.82rem;padding:32px;">
            No email logs yet.
          </div>`;
        return;
      }

      const STATUS_COLORS = {
        sent:      'var(--success)',
        failed:    'var(--danger)',
        triggered: 'var(--warning)',
        scheduled: 'var(--accent)'
      };

      container.innerHTML = logs.map(log => {
        const color      = STATUS_COLORS[log.status] || 'var(--text-muted)';
        const safeSubj   = log.subject   || log.email_type || '(no subject)';
        const safeType   = (log.email_type || '').replace(/_/g, ' ');
        const safeMethod = log.method ? ` via ${log.method}` : '';
        const recipient  = log.recipient_email
          ? log.recipient_email
          : log.recipient_group
            ? 'Group'
            : '—';

        const dateStr = log.created_at
          ? new Date(log.created_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short',
              hour: '2-digit', minute: '2-digit'
            })
          : '—';

        return `
          <div style="display:flex;align-items:flex-start;gap:10px;
                      padding:12px 20px;border-bottom:1px solid var(--border-color);">
            <div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;
                        background:${color};margin-top:5px;"></div>
            <div style="flex:1;overflow:hidden;min-width:0;">
              <div style="font-size:0.82rem;font-weight:600;color:var(--text-heading);
                          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                   title="${safeSubj.replace(/"/g,'&quot;')}">
                ${safeSubj.substring(0, 80)}
              </div>
              <div style="font-size:0.70rem;color:var(--text-muted);margin-top:2px;">
                ${safeType}${safeMethod}
                &nbsp;&bull;&nbsp;${recipient}
                &nbsp;&bull;&nbsp;${dateStr}
              </div>
              ${log.error_message ? `
              <div style="font-size:0.68rem;color:var(--danger);margin-top:2px;
                          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                   title="${String(log.error_message).replace(/"/g,'&quot;')}">
                ${String(log.error_message).substring(0, 90)}
              </div>` : ''}
            </div>
            <span style="font-size:0.68rem;font-weight:700;flex-shrink:0;
                         color:${color};white-space:nowrap;
                         padding:2px 8px;border-radius:var(--border-radius-full);
                         background:${color}20;">
              ${log.status || '—'}
            </span>
          </div>`;
      }).join('');

    } catch (e) {
      container.innerHTML = `
        <div style="text-align:center;color:var(--text-muted);
                    font-size:0.82rem;padding:32px;">
          Failed to load email logs.
        </div>`;
      console.error('[EmailService] loadEmailLogs:', e);
    }
  }

  /* ============================================================
     PUBLIC — RENDER EMAIL CENTER (admin UI)
     ============================================================ */
  renderEmailCenter(container, dashboard) {
    if (!container) return;

    const automations = [
      {
        key:  'birthday_email_enabled',
        icon: 'cake',
        label:'Birthday Wishes',
        desc: 'Auto-send on each member\'s birthday'
      },
      {
        key:  'monthly_statement_email_enabled',
        icon: 'indian-rupee',
        label:'Monthly Treasury Statement',
        desc: 'Auto-send on the 1st of each month at 9:00 AM'
      }
    ];

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="mail"></i> Email Center
          </h1>
          <p class="admin-section-subtitle">
            Send emails via Supabase Edge Function
            (Resend &rarr; Gmail SMTP &rarr; EmailJS)
          </p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;
                  gap:16px;margin-bottom:24px;">

        <!-- Custom Email -->
        <div class="admin-card neu-card" style="padding:24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
            <div style="width:44px;height:44px;border-radius:var(--border-radius-sm);
                        background:var(--accent-light);display:flex;align-items:center;
                        justify-content:center;flex-shrink:0;">
              <i data-lucide="send"
                 style="width:22px;height:22px;color:var(--accent);"></i>
            </div>
            <div>
              <h3 style="font-size:0.95rem;font-weight:700;
                          color:var(--text-heading);margin:0 0 2px;">
                Send Custom Email
              </h3>
              <p style="font-size:0.74rem;color:var(--text-muted);margin:0;">
                Sent to all members via group email
              </p>
            </div>
          </div>

          <form id="custom-email-form" novalidate>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" for="custom-email-subject">
                Subject *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" id="custom-email-subject" class="form-input"
                       placeholder="Email subject" maxlength="200" required />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" for="custom-email-message">
                Message *
              </label>
              <div class="input-wrap neu-inset">
                <textarea id="custom-email-message" class="form-textarea"
                          rows="6"
                          placeholder="Email message..."
                          required></textarea>
              </div>
            </div>
            <button type="submit" id="custom-email-btn"
                    class="btn btn-primary btn-full">
              <i data-lucide="send"></i>
              <span>Send to All Members</span>
            </button>
            <div class="form-message" id="custom-email-msg"
                 style="margin-top:10px;"></div>
          </form>
        </div>

        <!-- Automation Controls -->
        <div class="admin-card neu-card" style="padding:24px;">
          <h3 style="font-size:0.95rem;font-weight:700;
                      color:var(--text-heading);margin:0 0 16px;
                      display:flex;align-items:center;gap:8px;">
            <i data-lucide="zap"
               style="width:18px;height:18px;color:var(--accent);"></i>
            Automated Emails
          </h3>

          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
            ${automations.map(item => `
              <div style="display:flex;justify-content:space-between;
                          align-items:center;padding:12px;
                          background:var(--bg-secondary);
                          border-radius:var(--border-radius-sm);">
                <div style="display:flex;align-items:center;gap:8px;">
                  <i data-lucide="${item.icon}"
                     style="width:16px;height:16px;color:var(--accent);"></i>
                  <div>
                    <div style="font-size:0.82rem;font-weight:600;
                                color:var(--text-secondary);">
                      ${item.label}
                    </div>
                    <div style="font-size:0.68rem;color:var(--text-muted);">
                      ${item.desc}
                    </div>
                  </div>
                </div>
                <label class="admin-toggle"
                       style="width:36px;height:20px;flex-shrink:0;">
                  <input type="checkbox"
                         ${this._getSetting(item.key, 'true') === 'true'
                           ? 'checked' : ''}
                         onchange="window.emailService
                           .toggleAutomation('${item.key}', this.checked)" />
                  <span class="admin-toggle-slider"></span>
                </label>
              </div>
            `).join('')}
          </div>

          <div style="padding-top:16px;border-top:1px solid var(--border-color);">
            <h4 style="font-size:0.78rem;font-weight:700;color:var(--text-muted);
                        margin:0 0 10px;text-transform:uppercase;
                        letter-spacing:0.06em;">
              Manual Triggers
            </h4>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn btn-outline btn-sm"
                      onclick="window.emailService
                        .sendMonthlyTreasuryStatement()
                        .then(r => window.dashboard?.showToast(
                          r ? 'Statement sent!' : 'Failed to send.',
                          r ? 'success' : 'error'
                        ))">
                <i data-lucide="indian-rupee"></i>
                <span>Send Monthly Statement Now</span>
              </button>
              <button class="btn btn-outline btn-sm"
                      onclick="window.emailService
                        .scheduleTodayMeetings()
                        .then(() => window.dashboard?.showToast(
                          'Meeting timers reset.', 'info'
                        ))">
                <i data-lucide="calendar"></i>
                <span>Reschedule Today&rsquo;s Meetings</span>
              </button>
              <button class="btn btn-outline btn-sm"
                      onclick="window.emailService.loadEmailLogs()">
                <i data-lucide="refresh-cw"></i>
                <span>Refresh Email Logs</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- Email Logs -->
      <div class="admin-card neu-card">
        <div class="admin-card-header">
          <h3>
            <i data-lucide="activity"></i>
            Recent Email Logs
          </h3>
          <button class="btn btn-outline btn-sm"
                  onclick="window.emailService.loadEmailLogs()">
            <i data-lucide="refresh-cw"></i>
            <span>Refresh</span>
          </button>
        </div>
        <div id="email-logs-container">
          <div class="loading-single-line" style="width:200px;margin:24px auto;">
            <div class="loading-line-track">
              <div class="loading-line-fill"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    /* ── Custom email form submit ── */
    document
      .getElementById('custom-email-form')
      ?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const subjectEl = document.getElementById('custom-email-subject');
        const messageEl = document.getElementById('custom-email-message');
        const btn       = document.getElementById('custom-email-btn');
        const msgEl     = document.getElementById('custom-email-msg');

        const subject = subjectEl?.value?.trim();
        const message = messageEl?.value?.trim();

        if (!subject || !message) {
          if (msgEl) {
            msgEl.textContent  = 'Subject and message are required.';
            msgEl.className    = 'form-message error';
          }
          return;
        }

        if (btn) {
          btn.disabled   = true;
          btn.innerHTML  = '<i data-lucide="loader-2"></i><span>Sending&hellip;</span>';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form-message'; }

        const clubName = this._getSetting('club_name', CLUB_INFO.name);

        // Build body HTML — escape user content
        const htmlBody = this._buildEmailWrapper(
          subject,
          `<h2 style="color:#0055FF;font-size:16px;margin:0 0 14px;
                      font-family:Arial,Helvetica,sans-serif;">
             ${this._esc(subject)}
           </h2>
           <div style="font-size:14px;color:#444444;line-height:1.8;
                       white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;">
             ${this._esc(message)}
           </div>`
        );

        const result = await this._sendToGroup(
          `[Rotaract] ${subject}`,
          htmlBody,
          'custom_email'
        );

        if (btn) {
          btn.disabled  = false;
          btn.innerHTML = '<i data-lucide="send"></i><span>Send to All Members</span>';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        if (msgEl) {
          msgEl.textContent = result
            ? '✓ Email sent to all members!'
            : '✗ Failed to send. Check email logs for details.';
          msgEl.className = `form-message ${result ? 'success' : 'error'}`;
        }

        dashboard?.showToast(
          result ? 'Email sent to all members!' : 'Failed to send email.',
          result ? 'success' : 'error'
        );

        if (result) {
          if (subjectEl) subjectEl.value = '';
          if (messageEl) messageEl.value = '';
          this.loadEmailLogs();
          setTimeout(() => {
            if (msgEl) msgEl.className = 'form-message';
          }, 5000);
        }
      });

    /* ── Init icons + logs ── */
    if (typeof lucide !== 'undefined') lucide.createIcons();
    this.loadEmailLogs();
  }

  /* ============================================================
     PUBLIC — DESTROY (cleanup all timers)
     ============================================================ */
  destroy() {
    if (this._birthdayTimer)  clearTimeout(this._birthdayTimer);
    if (this._monthlyTimer)   clearTimeout(this._monthlyTimer);

    Object.values(this._meetingTimers).forEach(t => clearTimeout(t));
    this._meetingTimers = {};

    console.log('[EmailService] destroyed');
  }
}

/* ============================================================
   GLOBAL SINGLETON
   ============================================================ */
const emailService      = new EmailService();
window.emailService     = emailService;
/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   js/email-service.js

   All emails sent via Supabase Edge Function (send-email)
   which handles Resend → Gmail SMTP → EmailJS delivery.

   Public API:
     emailService.sendEventApprovalNotification(eventId)
     emailService.sendReportNotification(eventId)
     emailService.sendMeetingInvitation(meeting)
     emailService.sendAttendanceFormLink(meeting, formUrl, token)
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
    this._db               = null;
    this._settings         = {};
    this._settingsLoaded   = false;
    this._settingsLoadedAt = 0;
    this._SETTINGS_TTL_MS  = 5 * 60 * 1000;

    this._birthdayTimer        = null;
    this._meetingTimers        = {};
    this._monthlyTimer         = null;
    this._monthlyStatementLock = false; // local instance safety lock

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
    if (!this._db) this._db = getSupabaseClient();
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
    const now   = Date.now();
    const stale = (now - this._settingsLoadedAt) > this._SETTINGS_TTL_MS;

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

  _getSetting(key, fallback = '') {
    return (
      this._settings[key] != null && this._settings[key] !== ''
    )
      ? this._settings[key]
      : fallback;
  }

  /* ============================================================
     PRIVATE — VALIDATION HELPERS
     ============================================================ */
  _isValidHttpsUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    try {
      const u = new URL(url.trim());
      return u.protocol === 'https:';
    } catch { return false; }
  }

  _isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return (
      email.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    );
  }

  /* ============================================================
     PRIVATE — SANITISATION HELPERS
     ============================================================ */
  _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  _stripTags(html) {
    if (!html || typeof html !== 'string') return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ============================================================
     PRIVATE — FORMAT HELPERS
     ============================================================ */
  _fmtDate(d) {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return String(d); }
  }

  _fmtTime(t) {
    if (!t || typeof t !== 'string') return '';
    try {
      const parts  = t.split(':').map(Number);
      const h      = parts[0] ?? 0;
      const m      = parts[1] ?? 0;
      const period = h >= 12 ? 'PM' : 'AM';
      const dispH  = h % 12 || 12;
      return `${dispH}:${String(m).padStart(2, '0')} ${period}`;
    } catch { return t; }
  }

  _fmtCur(v) {
    const num = parseFloat(String(v ?? 0)) || 0;
    return `Rs.\u00a0${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2
    })}`;
  }

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
        method  : 'POST',
        headers : this.edgeHeaders,
        body    : JSON.stringify({
          email_type      : params.email_type      || 'general',
          to_email        : params.to_email        || null,
          to_name         : params.to_name         || null,
          from_name       : params.from_name
            || this._getSetting('club_name', CLUB_INFO.name),
          subject         : params.subject.trim(),
          html_message    : htmlMsg,
          message         : plainMsg,
          recipient_group : params.recipient_group || null,
          related_id      : params.related_id      || null,
          related_type    : params.related_type    || null
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
     CORE — SEND WITH ATTACHMENTS (PDF / Word / Excel / posters)
     Attachment specs:
       { kind:'doc', doc:'minutes', format:'pdf', params:{ meeting_id } }
       { kind:'url', url:'https://…', name:'Event_Poster' }
     ============================================================ */
  async sendWithAttachments(params = {}) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/send-mail-attachments`,
        { method: 'POST', headers: this.edgeHeaders, body: JSON.stringify({
            ...params,
            attachments: (params.attachments || []).filter(Boolean),
            triggered_by: params.triggered_by || window.authManager?.getAdmin?.()?.id || null
        }) }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        const why = [].concat(result.details || result.error || `HTTP ${response.status}`).join(' | ');
        console.error('[EmailService] attachment mail failed:', response.status, why);
        this._lastAttachmentError = why;
        return false;
      }
      this._lastAttachmentError = null;
      if (result.skipped?.length) this._warn('Mail sent, but some attachments could not be added: ' + result.skipped.join('; '));
      if (result.notes?.length)   this._warn(result.notes.join(' | '));
      return true;
    } catch (err) {
      console.error('[EmailService] attachment mail error:', err);
      this._lastAttachmentError = err?.message || 'network error';
      return false;
    }
  }

    _poster(url, name) {
    return this._isValidHttpsUrl(url) ? { kind: 'url', url, name } : null;
  }

  /** Posters of an event: events.poster_url / poster_urls plus every non-action photo in event_photos */
  async _eventPosterUrls(eventId, event) {
    const urls = [];
    const add = (u) => { if (u && this._isValidHttpsUrl(u) && !urls.includes(u)) urls.push(u); };
    add(event?.poster_url);
    if (Array.isArray(event?.poster_urls)) event.poster_urls.forEach(add);
    try {
      const { data } = await this._getDb().from('event_photos')
        .select('photo_url, sort_order, is_action_photo')
        .eq('event_id', eventId).eq('is_action_photo', false)
        .order('sort_order', { ascending: true });
      (data || []).forEach(p => add(p.photo_url));
    } catch (e) { console.warn('[EmailService] poster lookup failed:', e?.message || e); }
    return urls.slice(0, 3);
  }

  _posterAttachments(urls, baseName) {
    return (urls || []).map((u, i) =>
      this._poster(u, `${baseName}${urls.length > 1 ? '_' + (i + 1) : ''}`.replace(/[^\w\-]+/g, '_'))).filter(Boolean);
  }

  /** Inline poster picture at the top of the mail body (mail apps may hide remote images — the file is also attached) */
  _posterBlock(url) {
    if (!url || !this._isValidHttpsUrl(url)) return '';
    return `<div style="text-align:center;margin:0 0 20px;"><img src="${this._esc(url)}" alt="Poster" width="520"
      style="max-width:100%;height:auto;border-radius:10px;border:0;display:inline-block;" /></div>`;
  }

  /** Turn a raw mailer error into the exact thing to fix */
  _explainMailError(raw) {
    const t = String(raw || '');
    if (/not set/i.test(t))
      return 'The attachment mailer is not connected: add the secrets GAS_WEBAPP_URL and GAS_SHARED_SECRET in Supabase → Edge Functions → Secrets (see README_DEPLOY.md).';
    if (/unauthori[sz]ed/i.test(t))
      return 'The Apps Script rejected the request: GAS_SHARED_SECRET in Supabase must be exactly the same as SHARED_SECRET in the Apps Script project properties.';
    if (/quota/i.test(t))
      return 'The club Gmail has reached its daily sending limit. Try again tomorrow.';
    if (/Apps Script: (200|30\d|40\d)|Unexpected token|<html/i.test(t))
      return 'The Apps Script web-app link is not working: deploy it as a Web app (Execute as: Me, Who has access: Anyone) and copy the /exec link into GAS_WEBAPP_URL.';
    if (/Failed to fetch|network|404/i.test(t))
      return 'The send-mail-attachments function could not be reached: deploy it with "supabase functions deploy send-mail-attachments".';
    return t ? `Reason: ${t}` : 'The attachment mailer failed — check the send-mail-attachments function logs.';
  }

  /** Tell the admin when a mail went out without its attachments (silent failures hid this before) */
  _warn(message) {
    console.warn('[EmailService]', message);
    try { window.adminDashboard?.showToast?.(message, 'warning', 7000); } catch (e) { /* no UI */ }
  }

  /* ============================================================
     CORE — SEND TO MEMBERS GROUP
     ============================================================ */
  /* ---------- recipient routing (Site Settings → Mail & recipients) ---------- */
  _splitEmails(v) {
    return String(v || '').split(/[;,\s]+/).map(x => x.trim())
      .filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
  }

  _membersGroup() {
    return this._splitEmails(this._getSetting('group_email', 'ngpmembers@googlegroups.com'))[0]
      || 'ngpmembers@googlegroups.com';
  }

  /** Who should get this kind of mail? { off, to:[...], cc:[...] } */
  _routeFor(emailType) {
    const route   = String(this._getSetting('mail_route_' + emailType, '') || 'members').toLowerCase();
    const members = this._splitEmails(this._getSetting('group_email', 'ngpmembers@googlegroups.com'));
    const board   = this._splitEmails(this._getSetting('board_group_email', ''));
    const custom  = this._splitEmails(this._getSetting('mail_custom_recipients', ''));
    const cc      = this._splitEmails(this._getSetting('mail_extra_recipients', ''));
    if (route === 'off') return { off: true, to: [], cc: [] };
    let to;
    if (route === 'board')       to = board.length  ? board  : members;
    else if (route === 'both')   to = [...members, ...board];
    else if (route === 'custom') to = custom.length ? custom : members;
    else                         to = members;
    if (!to.length) to = ['ngpmembers@googlegroups.com'];
    const uniq = (a) => [...new Set(a.map(x => x.toLowerCase()))];
    const toU = uniq(to);
    return { off: false, to: toU, cc: uniq(cc).filter(x => !toU.includes(x)) };
  }

  _applySubjectPrefix(subject) {
    const prefix = String(this._getSetting('mail_subject_prefix', '') || '').trim();
    return prefix ? String(subject).replace(/^\[Rotaract[^\]]*\]\s*/i, '').replace(/^/, prefix + ' ') : subject;
  }

  /* ============================================================
     MAIL END SIGNATURE — the person who pressed "send"
       Name · portfolio(s) · RI ID · club · group · RI district
     (documents keep their own signature blocks — only the mail body changes)
     ============================================================ */
  async _senderProfile() {
    const admin = window.authManager?.getAdmin?.();
    if (!admin?.id) return null;
    this._profileCache = this._profileCache || {};
    const hit = this._profileCache[admin.id];
    if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;

    const db = this._getDb();
    let au = null, member = null, portfolioNames = [];
    try {
      const r = await db.from('admin_users').select('*').eq('id', admin.id).single();
      au = r.data || null;
    } catch (e) { /* use the session copy */ }
    au = { ...admin, ...(au || {}) };

    // the person's member record holds the RI ID
    try {
      if (au.member_id) {
        member = (await db.from('members').select('*').eq('id', au.member_id).single()).data || null;
      }
      if (!member && au.email) {
        for (const em of [au.email, String(au.email).toLowerCase()]) {
          const r = await db.from('members').select('*').eq('email', em).limit(1);
          if (r.data?.[0]) { member = r.data[0]; break; }
        }
      }
      if (!member && au.full_name) {
        const r = await db.from('members').select('*').ilike('full_name', String(au.full_name).trim()).limit(1);
        member = r.data?.[0] || null;
      }
    } catch (e) { /* no member record */ }

    // portfolios: the admin's own (Site Settings → Portfolios), else the member's titles, else role names
    try {
      const ids = [...new Set([au.portfolio_id, ...(Array.isArray(au.portfolio_ids) ? au.portfolio_ids : [])].filter(Boolean))];
      if (ids.length) {
        const r = await db.from('admin_portfolios').select('id, name, sort_order').in('id', ids);
        const byId = new Map((r.data || []).map(p => [p.id, p.name]));
        portfolioNames = ids.map(id => byId.get(id)).filter(Boolean);
      }
    } catch (e) { /* portfolio table not created yet */ }
    let titles = portfolioNames;
    if (!titles.length && member) titles = RoleUtils.titles(member);
    if (!titles.length) titles = RoleUtils.labels(au);

    const value = {
      name  : String(au.full_name || member?.full_name || '').trim(),
      titles: [...new Set(titles.map(t => String(t).trim()).filter(Boolean))],
      riId  : String(member?.ri_id || au.ri_id || '').trim()
    };
    this._profileCache[admin.id] = { at: Date.now(), value };
    return value;
  }

  _signatureHTML(profile) {
    if (!profile?.name) return '';
    const e = (v) => this._esc(v);
    const club     = this._getSetting('club_name', CLUB_INFO.name);
    const group    = String(this._getSetting('current_group', '') || '').trim();
    const district = (String(this._getSetting('district', '') || '').match(/\d{3,5}/) || ['3206'])[0];
    const lines = [
      `<div style="font-size:12px;color:#8a8a8a;margin-bottom:6px;">With regards,</div>`,
      `<div style="font-size:15px;font-weight:700;color:#2b1a20;line-height:1.3;">${e(profile.name)}</div>`,
      profile.titles.length ? `<div style="font-size:13px;font-weight:700;color:#D41367;line-height:1.4;">${profile.titles.map(e).join(' &amp; ')}</div>` : '',
      profile.riId ? `<div style="font-size:13px;color:#444;">RI ID: ${e(profile.riId)}</div>` : '',
      `<div style="font-size:13px;color:#444;">${e(club)}</div>`,
      `<div style="font-size:13px;color:#444;">${group ? `Group ${e(group)} &nbsp;|&nbsp; ` : ''}RI District ${e(district)}</div>`
    ].filter(Boolean).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td style="border-top:1px solid #eeeeee;padding-top:16px;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
        <div style="border-left:3px solid #D41367;padding-left:12px;">${lines}</div>
      </td></tr></table>`;
  }

  /** Puts the sender's signature at the end of the mail body. */
  _appendSignature(html, profile) {
    let block = '';
    if (String(this._getSetting('mail_sender_signature', 'true')) !== 'false' && profile?.name) {
      block = this._signatureHTML(profile);
    }
    if (!block) {
      // automatic mails (nobody signed in) → the optional fixed line from Site Settings
      const sig = String(this._getSetting('mail_signature', '') || '').trim();
      if (sig) block = `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #eee;color:#666;font-size:13px;white-space:pre-line;">${StringUtils.sanitize(sig)}</p>`;
    }
    if (!block) return html.replace('<!--MAIL_SIGNATURE-->', '');
    if (html.includes('<!--MAIL_SIGNATURE-->')) return html.replace('<!--MAIL_SIGNATURE-->', block);
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, block + '</body>') : html + block;
  }

  /** Apply the attachment switches from Site Settings to a list of attachment specs */
  _prepareAttachments(list) {
    const on = (k, d = 'true') => String(this._getSetting(k, d)) !== 'false';
    if (!on('mail_attachments_enabled')) return [];
    const fmt = String(this._getSetting('mail_attachment_format', 'pdf') || 'pdf').toLowerCase();
    const out = [];
    for (const a of (list || [])) {
      if (!a) continue;
      if (a.kind === 'url') { if (on('mail_attach_posters')) out.push(a); continue; }
      if (a.kind === 'doc') {
        if (a.format === 'xlsx') { if (on('mail_attach_excel')) out.push(a); continue; }
        if (fmt === 'both') { out.push({ ...a, format: 'pdf' }, { ...a, format: 'docx' }); continue; }
        out.push({ ...a, format: fmt === 'docx' ? 'docx' : 'pdf' });
        continue;
      }
      out.push(a);
    }
    return out;
  }

  async _sendToGroup(subject, htmlBody, emailType = 'group', attachments = null, meta = {}) {
    const route = this._routeFor(emailType);
    if (route.off) {
      console.info(`[EmailService] "${emailType}" is switched off in Site Settings — not sent`);
      return true;
    }
    subject  = this._applySubjectPrefix(subject);
    htmlBody = this._appendSignature(htmlBody, await this._senderProfile());
    const files = this._prepareAttachments(attachments);

    // With attachments → Google Apps Script mailer (via edge function).
    // If that fails, the mail still goes out without attachments.
    if (files.length) {
      const ok = await this.sendWithAttachments({
        subject, html_body: htmlBody, email_type: emailType, attachments: files,
        recipient_group: route.to.join(','), cc: route.cc.join(','), ...meta
      });
      if (ok) return true;
      this._warn('Sent WITHOUT attachments. ' + this._explainMailError(this._lastAttachmentError));
    }
    let sent = 0;
    for (const addr of route.to) {
      const ok = await this.sendEmail({
        email_type      : emailType,
        to_email        : addr,
        recipient_group : addr,
        from_name       : this._getSetting('club_name', CLUB_INFO.name),
        subject,
        html_message    : htmlBody,
        message         : this._stripTags(htmlBody),
        related_id      : meta.related_id   || null,
        related_type    : meta.related_type || null
      });
      if (ok) sent++;
    }
    return sent > 0;
  }

  /* ============================================================
     BUILD — EMAIL WRAPPER
     ============================================================ */
  /** Font stack: Latin first, then Noto / Windows fonts so Tamil, Hindi, Telugu etc. display on every device. */
  get _FF() {
    return "'Segoe UI','Helvetica Neue',Helvetica,Arial,'Noto Sans','Noto Sans Tamil','Noto Sans Devanagari','Nirmala UI',sans-serif";
  }

  /** Responsive rules shared by every mail (Gmail, Apple Mail, Outlook.com, Samsung and Yahoo read <style>). */
  _emailCss() {
    return `
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    table,td{mso-table-lspace:0;mso-table-rspace:0;}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;max-width:100%;height:auto;}
    a{color:#B30F57;}
    @media only screen and (max-width:620px){
      .em-outer{padding:0 !important;}
      .em-card{border-radius:0 !important;box-shadow:none !important;}
      .em-hdr{padding:26px 18px 22px !important;}
      .em-pad{padding:22px 16px !important;}
      .em-ftr{padding:22px 16px !important;}
      .em-h1{font-size:17px !important;}
      .em-lbl,.em-val{display:block !important;width:100% !important;box-sizing:border-box !important;}
      .em-lbl{padding:10px 12px 2px !important;border-bottom:0 !important;font-size:11px !important;text-transform:uppercase;letter-spacing:.05em;}
      .em-val{padding:2px 12px 11px !important;}
      .em-stack{display:block !important;width:100% !important;box-sizing:border-box !important;padding:0 0 10px !important;}
      .em-btn{display:block !important;width:100% !important;box-sizing:border-box !important;text-align:center !important;}
      .em-hide{display:none !important;}
      .em-tbl{font-size:11px !important;}
      .em-tbl td,.em-tbl th{padding:7px 5px !important;}
      .em-big{font-size:20px !important;}
    }`;
  }

  _buildEmailWrapper(subject, bodyContent) {
    const trimmed = (bodyContent || '').trimStart();
    if (
      trimmed.toLowerCase().startsWith('<!doctype') ||
      trimmed.toLowerCase().startsWith('<html')
    ) {
      return bodyContent;
    }

    const clubName = this._getSetting('club_name', CLUB_INFO.name);
    const clubId   = this._getSetting('club_id',   CLUB_INFO.clubId);
    const parent   = this._getSetting('parent_club', CLUB_INFO.parentClub || 'Rotary Club of Coimbatore Meridian');
    const rawLogo  = this._getSetting('logo_colour_url', CLUB_INFO.logos?.colour ?? '');
    const logoUrl  = this._isValidHttpsUrl(rawLogo) ? rawLogo : '';
    const FF = this._FF;

    const logoHtml = logoUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 14px;">
           <tr><td style="background:#ffffff;border-radius:50%;padding:7px;line-height:0;">
             <img src="${logoUrl}" alt="${this._esc(clubName)}" width="54" height="54"
                  style="display:block;border-radius:50%;width:54px;height:54px;" />
           </td></tr></table>`
      : '';

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${this._esc(subject)}</title>
  <style>${this._emailCss()}</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#F4EEF1;font-family:${FF};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F4EEF1;">
    ${this._esc(subject)} &mdash; ${this._esc(clubName)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-outer"
         style="background-color:#F4EEF1;padding:26px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="em-card"
             style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 36px rgba(67,6,31,0.12);">
        <!-- ribbon -->
        <tr><td style="font-size:0;line-height:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="25%" height="5" style="background:#43061F;font-size:0;line-height:0;">&nbsp;</td>
            <td width="25%" height="5" style="background:#B30F57;font-size:0;line-height:0;">&nbsp;</td>
            <td width="25%" height="5" style="background:#F06FA3;font-size:0;line-height:0;">&nbsp;</td>
            <td width="25%" height="5" style="background:#FFC857;font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>
        </td></tr>
        <!-- header -->
        <tr>
          <td align="center" class="em-hdr" bgcolor="#7D0A3C"
              style="background-color:#7D0A3C;background-image:linear-gradient(135deg,#43061F 0%,#9C1C42 60%,#B30F57 100%);padding:32px 28px 26px;text-align:center;">
            ${logoHtml}
            <h1 class="em-h1" style="margin:0 0 5px;color:#ffffff;font-size:20px;line-height:1.3;font-weight:700;font-family:${FF};">
              ${this._esc(clubName)}
            </h1>
            <p style="margin:0;color:rgba(255,255,255,0.82);font-size:12px;letter-spacing:0.4px;font-family:${FF};">
              Parented by ${this._esc(parent)}
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 0;">
              <tr><td width="46" height="3" style="background:#FFC857;border-radius:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
        <!-- body -->
        <tr>
          <td class="em-pad" style="padding:30px 32px;font-family:${FF};color:#3A2D33;font-size:14px;line-height:1.7;">
            ${bodyContent}
            <!--MAIL_SIGNATURE-->
          </td>
        </tr>
        <!-- footer -->
        <tr>
          <td class="em-ftr" bgcolor="#43061F" align="center"
              style="background-color:#43061F;padding:24px 28px;text-align:center;font-family:${FF};">
            <p style="margin:0 0 6px;color:#FFD98A;font-size:12px;font-weight:700;letter-spacing:1.6px;">SERVICE ABOVE SELF</p>
            <p style="margin:0 0 4px;color:#ffffff;font-size:13px;font-weight:600;">${this._esc(clubName)}</p>
            <p style="margin:0 0 3px;color:rgba(255,255,255,0.65);font-size:11px;">
              Club ID ${this._esc(clubId)} &nbsp;&bull;&nbsp; Rotary International District 3206
            </p>
            <p style="margin:0 0 12px;color:rgba(255,255,255,0.65);font-size:11px;">
              Dr. N.G.P. Arts and Science College, Coimbatore&#8209;641048
            </p>
            <p style="margin:0;color:rgba(255,255,255,0.40);font-size:10px;">
              This is an automated message from the Rotaract Club Portal.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /* ============================================================
     BUILD — REUSABLE COMPONENTS
     ============================================================ */
  _banner(colour, icon, title, subtitle) {
    const FF = this._FF;
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin-bottom:22px;background:${colour}14;border-radius:12px;">
        <tr>
          <td width="5" style="background:${colour};border-radius:12px 0 0 12px;font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding:16px 18px;">
            <h2 style="margin:0 0 4px;color:${colour};font-size:17px;line-height:1.35;font-weight:700;font-family:${FF};">
              ${this._esc(title)}
            </h2>
            ${subtitle ? `<p style="margin:0;color:#5A4A52;font-size:13px;line-height:1.55;font-family:${FF};">${this._esc(subtitle)}</p>` : ''}
          </td>
        </tr>
      </table>`;
  }

  _row(label, value, last = false) {
    const border = last ? '' : 'border-bottom:1px solid #F0E6EB;';
    const FF = this._FF;
    return `
      <tr>
        <td class="em-lbl" style="padding:10px 14px;${border}font-weight:600;color:#5A3A47;width:34%;background:#FBF6F8;font-size:13px;font-family:${FF};vertical-align:top;">
          ${this._esc(label)}
        </td>
        <td class="em-val" style="padding:10px 14px;${border}color:#3A2D33;font-size:13px;font-family:${FF};vertical-align:top;">
          ${value ?? '&mdash;'}
        </td>
      </tr>`;
  }

  _table(rows) {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:separate;border-spacing:0;border:1px solid #F0E6EB;border-radius:10px;overflow:hidden;margin-bottom:22px;font-family:${this._FF};">
        ${rows}
      </table>`;
  }

  /** Bulletproof call-to-action button (full width on phones). */
  _button(url, label, colour = '#B30F57') {
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:6px auto 18px;">
        <tr><td align="center" bgcolor="${colour}" style="border-radius:10px;">
          <a href="${url}" target="_blank" class="em-btn"
             style="display:inline-block;padding:14px 34px;font-family:${this._FF};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:${colour};">
            ${this._esc(label)}
          </a>
        </td></tr>
      </table>`;
  }

  /* ============================================================
     BUILD — DPP INFO BLOCK
     ============================================================ */
  _buildDPPInfoBlock(event) {
    if (!event?.is_dpp) return '';

    const approvalNumber = event.dpp_approval_number || '';
    const pillarText     = event.dpp_pillar           || '';
    const categoryText   = event.dpp_category         || '';
    const councilMember  = event.dpp_council_member   || '';

    const hasAny =
      approvalNumber ||
      pillarText     ||
      categoryText   ||
      councilMember;

    if (!hasAny) return '';

    const fieldRow = (label, value, color = '#D41367') => {
      if (!value) return '';
      return `
        <tr>
          <td style="padding:7px 10px;font-size:12px;font-weight:700;
                     color:${color};width:40%;
                     border-bottom:1px solid #e8f0ff;
                     font-family:Arial,Helvetica,sans-serif;">
            ${this._esc(label)}
          </td>
          <td style="padding:7px 10px;font-size:12px;color:#333333;
                     border-bottom:1px solid #e8f0ff;
                     font-family:Arial,Helvetica,sans-serif;">
            ${this._esc(value)}
          </td>
        </tr>`;
    };

    return `
      <div style="background:#e8f4ff;border:1px solid #F6C3D9;
                  border-radius:8px;overflow:hidden;
                  margin-bottom:16px;">
        <div style="background:#D41367;padding:8px 14px;">
          <span style="color:#ffffff;font-size:11px;font-weight:800;
                       text-transform:uppercase;letter-spacing:0.08em;
                       font-family:Arial,Helvetica,sans-serif;">
             DPP Project Details
          </span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${approvalNumber
            ? fieldRow('Project Approval Number', approvalNumber, '#D41367')
            : ''}
          ${pillarText
            ? fieldRow('DPP Pillar', pillarText, '#047857')
            : ''}
          ${categoryText
            ? fieldRow('Category', categoryText, '#047857')
            : ''}
          ${councilMember
            ? fieldRow(
                'Council Member / District Trainer',
                councilMember,
                '#92400e'
              )
            : ''}
        </table>
      </div>`;
  }

  /* ============================================================
     BUILD — ATTENDANCE FORM CTA BUTTON BLOCK
     ============================================================ */
  _buildFormCtaBlock(formUrl, meeting) {
    const safeUrl = this._esc(formUrl);
    const timeStr = meeting?.start_time
      ? this._fmtTime(meeting.start_time) : '';
    const endStr  = meeting?.end_time
      ? ` to ${this._fmtTime(meeting.end_time)}` : '';
    const agenda  = Array.isArray(meeting?.agenda) ? meeting.agenda : [];

    return `
      <!-- Urgency Banner -->
      <div style="background:#FFF5F5;border:2px solid #FC8181;
                  border-radius:8px;padding:14px 16px;
                  margin-bottom:18px;text-align:center;">
        <p style="margin:0;color:#C53030;font-size:14px;
                  font-weight:700;font-family:Arial,Helvetica,sans-serif;">
           The meeting has started —
          please mark your attendance now!
        </p>
      </div>

      <!-- Meeting Info -->
      ${this._table(
        this._row(
          'Meeting',
          `<strong>${this._esc(meeting?.title || '')}</strong>`
        )
        + this._row('Date',  this._fmtDate(meeting?.meeting_date))
        + this._row('Time',  timeStr + endStr)
        + this._row('Venue', this._esc(meeting?.venue || '—'),
            agenda.length === 0)
        + (agenda.length > 0
            ? this._row('Agenda items', String(agenda.length), true)
            : '')
      )}

      <!-- What the form collects -->
      <div style="background:#e8f4fd;padding:14px 16px;
                  border-radius:8px;margin-bottom:20px;">
        <h3 style="margin:0 0 8px;color:#9C1C42;font-size:13px;
                   font-weight:700;font-family:Arial,Helvetica,sans-serif;">
          The attendance form collects:
        </h3>
        <ul style="margin:0;padding-left:20px;color:#555555;
                   font-size:13px;line-height:1.9;
                   font-family:Arial,Helvetica,sans-serif;">
          <li>Your Full Name &amp; RI ID</li>
          <li>Your Designation / Portfolio</li>
          <li>Your In-Time</li>
          <li>Electronic Signature (drawn on-screen)</li>
        </ul>
      </div>

      <!-- Big CTA Button -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin-bottom:20px;">
        <tr>
          <td align="center">
            <a href="${safeUrl}" target="_blank" class="em-btn"
               rel="noopener noreferrer"
               style="display:inline-block;padding:16px 40px;
                      background:linear-gradient(
                        135deg,#E53E3E,#C53030);
                      color:#ffffff;font-size:16px;font-weight:800;
                      text-decoration:none;border-radius:10px;
                      font-family:Arial,Helvetica,sans-serif;
                      box-shadow:0 4px 14px rgba(229,62,62,0.40);
                      letter-spacing:0.02em;">
              Open Attendance Form
            </a>
          </td>
        </tr>
      </table>

      <!-- Fallback URL -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;
                  border-radius:6px;padding:10px 14px;
                  margin-bottom:16px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                  color:#6b7280;text-transform:uppercase;
                  letter-spacing:0.05em;
                  font-family:Arial,Helvetica,sans-serif;">
          Or copy this link into your browser:
        </p>
        <p style="margin:0;font-size:11px;color:#B30F57;
                  word-break:break-all;font-family:monospace,Arial;">
          ${safeUrl}
        </p>
      </div>

      <!-- Deadline notice -->
      <p style="color:#999999;font-size:11px;text-align:center;
                margin:0;font-family:Arial,Helvetica,sans-serif;">
        Please complete this form within <strong>30 minutes</strong>
        of the meeting start time.
        The form closes automatically after the meeting ends.
      </p>
    `;
  }

  /* ============================================================
     1. EVENT APPROVAL NOTIFICATION
     ============================================================ */
  async sendEventApprovalNotification(eventId) {
    if (!eventId) return false;

    try {
      const { data: event, error } = await this._getDb()
        .from('events')
        .select(`
          *,
          dpp_approval_number,
          dpp_pillar,
          dpp_category,
          dpp_council_member
        `)
        .eq('id', eventId)
        .single();

      if (error || !event) {
        console.warn('[EmailService] event not found:', eventId);
        return false;
      }

      const AVENUE_LABELS = {
        club_service               : 'Club Service',
        community_service          : 'Community Service',
        professional_service       : 'Professional Service',
        international_service      : 'International Service',
        district_priority_projects : 'District Priority Projects'
      };

      const avenueLabel = event.is_dpp
        ? 'District Priority Projects'
        : (AVENUE_LABELS[event.avenue]
            || this._esc(event.avenue) || '—');

      const timeRange = event.start_time
        ? this._fmtTime(event.start_time)
          + (event.end_time
              ? ` to ${this._fmtTime(event.end_time)}`
              : '')
        : '—';

      const subject =
        `[Rotaract] New Event Approved: ${event.title}`;
      const posterUrls = await this._eventPosterUrls(eventId, event);

      const bodyContent = `
        ${this._banner(
          '#9C1C42', '',
          'New Event Approved!',
          'An event has been approved and published on the club portal.'
        )}
        <h3 style="color:#222222;font-size:17px;margin:0 0 14px;
                   font-weight:700;
                   font-family:Arial,Helvetica,sans-serif;">
          ${this._esc(event.title)}
        </h3>
        ${this._table(
          this._row('Date',         this._fmtDate(event.event_date))
        + this._row('Time',         timeRange)
        + this._row('Venue',        this._esc(event.venue) || '—')
        + this._row('Event Chair',  this._esc(event.event_chair) || '—')
        + (event.event_secretary
            ? this._row('Event Secretary',
                this._esc(event.event_secretary))
            : '')
        + this._row('Avenue',       avenueLabel)
        + this._row(
            'Group',
            `Group ${this._esc(String(event.group_number || 1))}`,
            true
          )
        )}

        <!-- DPP block — only for DPP events -->
        ${this._buildDPPInfoBlock(event)}

        ${event.description ? `
        <div style="background:#f9f9f9;padding:14px;border-radius:6px;
                    margin-bottom:20px;">
          <h4 style="margin:0 0 6px;font-size:13px;color:#333333;
                     font-weight:700;
                     font-family:Arial,Helvetica,sans-serif;">
            About This Event
          </h4>
          <p style="margin:0;color:#666666;font-size:13px;
                    line-height:1.7;
                    font-family:Arial,Helvetica,sans-serif;">
            ${this._esc(event.description)}
          </p>
        </div>` : ''}
      `;

      const htmlBody = this._buildEmailWrapper(subject, this._posterBlock(posterUrls[0]) + bodyContent);
      return this._sendToGroup(subject, htmlBody, 'event_approval',
        this._posterAttachments(posterUrls, 'Event_Poster'),
        { related_id: eventId, related_type: 'events' });

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
        .select(`
          *,
          dpp_approval_number,
          dpp_pillar,
          dpp_category,
          dpp_council_member,
          event_reports (
            report_content,
            key_highlights,
            is_approved,
            project_approval_number,
            dpp_pillar,
            dpp_category,
            council_member_or_trainer
          )
        `)
        .eq('id', eventId)
        .single();

      if (error || !event) {
        console.warn(
          '[EmailService] event not found for report:', eventId
        );
        return false;
      }

      const report = (event.event_reports || [])
        .find(r => r.is_approved);
      if (!report) {
        console.warn(
          '[EmailService] no approved report found:', eventId
        );
        return false;
      }

      const mergedEventForDPP = {
        ...event,
        dpp_approval_number: event.dpp_approval_number
          || report.project_approval_number || null,
        dpp_pillar    : event.dpp_pillar   || report.dpp_pillar   || null,
        dpp_category  : event.dpp_category || report.dpp_category || null,
        dpp_council_member: event.dpp_council_member
          || report.council_member_or_trainer || null
      };

      const subject =
        `[Rotaract] Event Report Published: ${event.title}`;

      const bodyContent = `
        ${this._banner(
          '#38A169', '',
          'Event Report Published!',
          'The event report has been approved and is now available.'
        )}
        <h3 style="color:#222222;font-size:17px;margin:0 0 14px;
                   font-weight:700;
                   font-family:Arial,Helvetica,sans-serif;">
          ${this._esc(event.title)}
        </h3>
        ${this._table(
          this._row('Date', this._fmtDate(event.event_date))
        + (event.actual_attendance
            ? this._row(
                'Attendance',
                `${this._esc(String(event.actual_attendance))} participants`
              )
            : '')
        + (event.service_hours
            ? this._row(
                'Service Hours',
                `${this._esc(String(event.service_hours))} hours`,
                true
              )
            : '')
        )}

        <!-- DPP block — only for DPP events -->
        ${this._buildDPPInfoBlock(mergedEventForDPP)}

        ${report.key_highlights ? `
        <div style="background:#f0f7ff;padding:14px;border-radius:6px;
                    margin-top:4px;">
          <strong style="color:#9C1C42;font-size:13px;display:block;
                         margin-bottom:6px;
                         font-family:Arial,Helvetica,sans-serif;">
            Key Highlights
          </strong>
          <p style="margin:0;color:#555555;font-size:13px;
                    line-height:1.7;
                    font-family:Arial,Helvetica,sans-serif;">
            ${this._esc(report.key_highlights)}
          </p>
        </div>` : ''}
      `;

      const posterUrls = await this._eventPosterUrls(eventId, event);
      const htmlBody = this._buildEmailWrapper(subject, this._posterBlock(posterUrls[0]) + bodyContent);
      return this._sendToGroup(
        subject, htmlBody, 'report_notification',
        [
          { kind: 'doc', doc: 'event_report', format: 'pdf', params: { event_id: eventId }, name: `Report_${String(event.title || 'Event').replace(/[^\w\-]+/g, '_').slice(0, 40)}` },
          ...this._posterAttachments(posterUrls, 'Event_Poster')
        ],
        { related_id: eventId, related_type: 'events' }
      );

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
      // The caller may pass a partial row — make sure the poster field is present
      if (meeting.id && meeting.poster_url === undefined) {
        const { data: full } = await this._getDb().from('meetings')
          .select('*').eq('id', meeting.id).single();
        if (full) meeting = { ...meeting, ...full };
      }
      const MEETING_LABELS = {
        board_meeting        : 'Board Meeting',
        general_body_meeting : 'General Body Meeting',
        special_meeting      : 'Special Meeting',
        emergency_meeting    : 'Emergency Meeting'
      };

      const typeLabel = MEETING_LABELS[meeting.meeting_type]
        || this._esc(meeting.meeting_type)
        || 'Meeting';

      const timeRange = meeting.start_time
        ? this._fmtTime(meeting.start_time)
          + (meeting.end_time
              ? ` to ${this._fmtTime(meeting.end_time)}`
              : '')
        : '—';

      const agenda  = Array.isArray(meeting.agenda)
        ? meeting.agenda : [];
      const subject =
        `[Rotaract] Meeting Invitation: ${meeting.title}`;

      const bodyContent = `
        <div style="background:#FBE3EE;border-left:4px solid #8E0C45;
                    padding:16px;border-radius:0 8px 8px 0;
                    margin-bottom:20px;">
          <h2 style="margin:0 0 8px;color:#8E0C45;font-size:16px;
                     font-weight:700;
                     font-family:Arial,Helvetica,sans-serif;">
            ${this._esc(meeting.title)}
          </h2>
          <span style="display:inline-block;padding:3px 12px;
                       border-radius:20px;background:#8E0C45;
                       color:#ffffff;font-size:11px;font-weight:700;
                       font-family:Arial,Helvetica,sans-serif;">
            ${typeLabel}
          </span>
        </div>
        ${this._table(
          this._row('Date',  this._fmtDate(meeting.meeting_date))
        + this._row('Time',  timeRange)
        + this._row('Venue', this._esc(meeting.venue) || '—')
        + this._row(
            'Group',
            `Group ${this._esc(String(meeting.group_number || 1))}`,
            true
          )
        )}
        ${agenda.length > 0 ? `
        <div style="background:#f0f7ff;padding:16px;border-radius:6px;
                    margin-bottom:20px;">
          <h3 style="margin:0 0 10px;color:#9C1C42;font-size:13px;
                     font-weight:700;
                     font-family:Arial,Helvetica,sans-serif;">
            Agenda
          </h3>
          <ol style="margin:0;padding-left:20px;">
            ${agenda.map(item => `
              <li style="color:#444444;font-size:13px;line-height:1.8;
                         margin-bottom:4px;
                         font-family:Arial,Helvetica,sans-serif;">
                ${this._esc(item.text || String(item))}
              </li>
            `).join('')}
          </ol>
        </div>` : ''}
        <div style="background:#fff8e1;border:1px solid #ffc107;
                    padding:12px 14px;border-radius:6px;">
          <p style="margin:0;color:#856404;font-size:13px;
                    font-weight:600;
                    font-family:Arial,Helvetica,sans-serif;">
            
            Please ensure timely attendance.
            An attendance form link will be sent at the
            start of the meeting.
          </p>
        </div>
      `;

      const htmlBody = this._buildEmailWrapper(subject, this._posterBlock(meeting.poster_url) + bodyContent);
      return this._sendToGroup(
        subject, htmlBody, 'meeting_invitation',
        [
          this._poster(meeting.poster_url, 'Meeting_Poster'),
          meeting.id ? { kind: 'doc', doc: 'agenda', format: 'pdf', params: { meeting_id: meeting.id }, name: 'Agenda' } : null
        ].filter(Boolean),
        { related_id: meeting.id || null, related_type: 'meetings' }
      );

    } catch (e) {
      console.error('[EmailService] sendMeetingInvitation:', e);
      return false;
    }
  }

  /* ============================================================
     4a. SEND ATTENDANCE FORM LINK
     ============================================================ */
  async sendAttendanceFormLink(meeting, formUrl, token) {
    if (!meeting || !formUrl) {
      console.warn(
        '[EmailService] sendAttendanceFormLink: '
        + 'missing meeting or formUrl'
      );
      return false;
    }

    if (!this._isValidHttpsUrl(formUrl)) {
      console.warn(
        '[EmailService] sendAttendanceFormLink: invalid formUrl',
        formUrl
      );
      return false;
    }

    try {
      const subject =
        `[Rotaract ATTENDANCE] ${meeting.title} — Open Form Now`;

      const bodyContent = `
        ${this._banner(
          '#E53E3E',
          '',
          'Attendance Form — Mark Now!',
          `${this._esc(meeting.title)} has started. `
          + 'Submit your attendance below.'
        )}
        ${this._buildFormCtaBlock(formUrl, meeting)}
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      const result   = await this._sendToGroup(
        subject, htmlBody, 'meeting_attendance_form'
      );

      if (result) {
        console.log(
          '[EmailService] attendance form link sent for meeting: '
          + meeting.id
        );
        try {
          await this._getDb().from('email_logs').insert({
            email_type      : 'meeting_attendance_form',
            subject,
            recipient_group : this._membersGroup(),
            status          : 'sent',
            related_id      : meeting.id,
            related_type    : 'meetings',
            method          : 'edge_function',
            metadata        : { form_url: formUrl, token }
          });
        } catch (logErr) {
          console.warn(
            '[EmailService] email log insert failed:', logErr
          );
        }
      }

      return result;

    } catch (e) {
      console.error('[EmailService] sendAttendanceFormLink:', e);
      return false;
    }
  }

  /* ============================================================
     4b. MEETING ATTENDANCE FORM (legacy / fallback)
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

      if (window.meetingsAdmin) {
        try {
          const formUrl = await window.meetingsAdmin.sendAttendanceForm(
            meetingId, true
          );
          if (formUrl) {
            console.log(
              '[EmailService] attendance form generated & sent: '
              + formUrl
            );
            return true;
          }
        } catch (genErr) {
          console.warn(
            '[EmailService] form generation failed, '
            + 'falling back to reminder:',
            genErr
          );
        }
      }

      const subject =
        `[Rotaract ATTENDANCE] ${meeting.title} — Mark Now`;

      const bodyContent = `
        ${this._banner(
          '#E53E3E', '',
          'Mark Your Attendance Now!',
          'The meeting has started. '
          + 'Please mark your attendance immediately.'
        )}
        ${this._table(
          this._row(
            'Meeting',
            `<strong>${this._esc(meeting.title)}</strong>`
          )
        + this._row('Date',  this._fmtDate(meeting.meeting_date))
        + this._row('Time',  this._fmtTime(meeting.start_time))
        + this._row('Venue', this._esc(meeting.venue) || '—', true)
        )}
        <div style="background:#fff8e1;border:1px solid #ffc107;
                    padding:12px 14px;border-radius:6px;
                    margin-bottom:16px;">
          <p style="margin:0;color:#856404;font-size:13px;
                    font-weight:600;
                    font-family:Arial,Helvetica,sans-serif;">
            
            Contact the admin to get the attendance form
            link directly.
          </p>
        </div>
        <p style="color:#999999;font-size:11px;text-align:center;
                  margin:0;font-family:Arial,Helvetica,sans-serif;">
          Please mark attendance within 30 minutes of meeting start.
        </p>
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      const result   = await this._sendToGroup(
        subject, htmlBody, 'meeting_attendance'
      );

      if (result) {
        try {
          await this._getDb()
            .from('meetings')
            .update({ is_invitation_sent: true })
            .eq('id', meetingId);
        } catch (dbErr) {
          console.warn(
            '[EmailService] failed to update is_invitation_sent:',
            dbErr
          );
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
        console.warn(
          '[EmailService] minutes not finalized:', meetingId
        );
        return false;
      }

      const MEETING_LABELS = {
        board_meeting        : 'Board Meeting',
        general_body_meeting : 'General Body Meeting',
        special_meeting      : 'Special Meeting',
        emergency_meeting    : 'Emergency Meeting'
      };

      const minutes     = Array.isArray(meeting.minutes_content)
        ? meeting.minutes_content : [];
      const actualStart = meeting.actual_start_time
        || meeting.start_time;
      const actualEnd   = meeting.actual_end_time
        || meeting.end_time;
      let   durationMin = 0;

      if (actualStart && actualEnd) {
        try {
          const [sh, sm] = actualStart.split(':').map(Number);
          const [eh, em] = actualEnd.split(':').map(Number);
          durationMin    = (eh * 60 + em) - (sh * 60 + sm);
          if (durationMin < 0) durationMin = 0;
        } catch { /* ignore */ }
      }

      const subject = `[Rotaract] Meeting Minutes: ${meeting.title}`;

      const bodyContent = `
        ${this._banner(
          '#3B3737', '',
          'Meeting Minutes Ready',
          'Minutes have been finalized and are now available.'
        )}
        <h3 style="color:#222222;font-size:16px;margin:0 0 14px;
                   font-weight:700;
                   font-family:Arial,Helvetica,sans-serif;">
          ${this._esc(meeting.title)}
        </h3>
        ${this._table(
          this._row('Date',  this._fmtDate(meeting.meeting_date))
        + this._row('Venue', this._esc(meeting.venue) || '—')
        + this._row(
            'Type',
            MEETING_LABELS[meeting.meeting_type]
            || this._esc(meeting.meeting_type)
          )
        + (durationMin > 0
            ? this._row(
                'Duration', `${durationMin} minutes`, true
              )
            : '')
        )}
        ${minutes.length > 0 ? `
        <div style="border:1px solid #EDEBEB;border-radius:8px;
                    overflow:hidden;margin-bottom:16px;">
          <div style="background:#3B3737;padding:10px 16px;">
            <h3 style="margin:0;color:#ffffff;font-size:13px;
                       font-weight:700;
                       font-family:Arial,Helvetica,sans-serif;">
              Minutes of Meeting
            </h3>
          </div>
          <div style="padding:16px;">
            ${minutes.map((entry, idx) => `
              <div style="margin-bottom:${
                idx < minutes.length - 1 ? '14px' : '0'};
                ${idx < minutes.length - 1
                  ? 'padding-bottom:14px;'
                    + 'border-bottom:1px solid #eeeeee;'
                  : ''}">
                <div style="margin-bottom:5px;">
                  ${entry.time ? `
                  <span style="color:#9C1C42;font-size:12px;
                               font-weight:700;display:inline-block;
                               min-width:64px;
                               font-family:Arial,Helvetica,sans-serif;">
                    ${this._fmtTime(entry.time)}
                  </span>` : ''}
                  <span style="color:#333333;font-size:13px;
                               font-weight:700;
                               font-family:Arial,Helvetica,sans-serif;">
                    ${this._esc(entry.heading || '')}
                  </span>
                </div>
                ${entry.details ? `
                <p style="margin:0 0 0 ${
                  entry.time ? '64px' : '0'};
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
      const result   = await this._sendToGroup(
        subject, htmlBody, 'meeting_minutes',
        [
          { kind: 'doc', doc: 'combined_meeting', format: 'pdf', params: { meeting_id: meetingId },
            name: `Meeting_Record_${String(meeting.title || 'Meeting').replace(/[^\w\-]+/g, '_').slice(0, 40)}` },
          { kind: 'doc', doc: 'attendance', format: 'xlsx', params: { meeting_id: meetingId }, name: 'Attendance_Register' }
        ],
        { related_id: meetingId, related_type: 'meetings' }
      );

      if (result) {
        try {
          await this._getDb()
            .from('meetings')
            .update({ is_minutes_sent: true })
            .eq('id', meetingId);
        } catch (dbErr) {
          console.warn(
            '[EmailService] failed to mark minutes sent:', dbErr
          );
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
     ============================================================ */
  async sendBirthdayWish(member) {
    if (!member?.email || !this._isValidEmail(member.email)) {
      console.warn(
        '[EmailService] invalid member email for birthday wish'
      );
      return false;
    }

    try {
      const clubName   = this._getSetting('club_name', CLUB_INFO.name);
      const clubId     = this._getSetting('club_id',   CLUB_INFO.clubId);
      const parentClub = this._getSetting(
        'parent_club',
        CLUB_INFO.parentClub || 'Rotary Club of Coimbatore Meridian'
      );

      const safeName   = this._esc(member.full_name || 'Rotaractor');
      const safeClub   = this._esc(clubName);
      const safeParent = this._esc(parentClub);
      const safeClubId = this._esc(clubId);

      const rawLogo  = this._getSetting(
        'logo_colour_url', CLUB_INFO.logos?.colour ?? ''
      );
      const logoUrl  = this._isValidHttpsUrl(rawLogo) ? rawLogo : '';
      const firstName = this._esc(
        String(member.full_name || 'Rotaractor').trim().split(/\s+/)[0]
      );
      const year = new Date().getFullYear();

      /* Icons are drawn with plain HTML/CSS (no emoji, no images, no SVG)
         so they render the same in Gmail, Outlook, Apple Mail and phones. */
      const logoHtml = logoUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
                  <tr><td style="background:#ffffff;border-radius:50%;padding:7px;line-height:0;">
                    <img src="${logoUrl}" alt="${safeClub}" width="52" height="52"
                         style="display:block;border:0;outline:none;border-radius:50%;width:52px;height:52px;" />
                  </td></tr>
                </table>`
        : '';

      const confetti = (cols) => cols.map((c, i) =>
        `<td width="${i % 2 ? 10 : 14}" height="${i % 2 ? 10 : 14}" style="background:${c};font-size:0;line-height:0;border-radius:${i % 3 === 0 ? '50%' : '2px'};">&nbsp;</td><td width="14" style="font-size:0;line-height:0;">&nbsp;</td>`
      ).join('');
      const confettiRow = (cols) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>${confetti(cols)}</tr></table>`;

      const cakeIcon = `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 20px;">
                  <tr><td align="center" style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.28);border-radius:50%;width:118px;height:118px;" width="118" height="118" valign="middle">
                    <div style="width:12px;height:17px;margin:0 auto;background:#FFC857;border-radius:50% 50% 50% 50% / 62% 62% 38% 38%;box-shadow:0 0 12px 3px rgba(255,200,87,0.65);"></div>
                    <div style="width:6px;height:15px;margin:2px auto 0;background:#FFFFFF;border-radius:2px;"></div>
                    <div style="width:54px;height:15px;margin:0 auto;background:#FBC4DA;border-radius:9px 9px 0 0;border-bottom:3px solid #FFFFFF;"></div>
                    <div style="width:72px;height:16px;margin:0 auto;background:#F06FA3;border-bottom:3px solid #FFFFFF;"></div>
                    <div style="width:90px;height:17px;margin:0 auto;background:#D41367;border-radius:0 0 7px 7px;"></div>
                    <div style="width:104px;height:5px;margin:3px auto 0;background:rgba(255,255,255,0.85);border-radius:3px;"></div>
                  </td></tr>
                </table>`;

      const pillar = (glyph, title, text, tint) => `
                    <td width="33%" valign="top" align="center" style="padding:0 6px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px;">
                        <tr><td align="center" valign="middle" width="44" height="44"
                                style="width:44px;height:44px;border-radius:50%;background:${tint};color:#ffffff;font-size:19px;line-height:44px;font-family:Arial,Helvetica,sans-serif;font-weight:700;">${glyph}</td></tr>
                      </table>
                      <p style="margin:0 0 3px;color:#43061F;font-size:13px;font-weight:700;letter-spacing:0.4px;font-family:Arial,Helvetica,sans-serif;">${title}</p>
                      <p style="margin:0;color:#7A6670;font-size:11.5px;line-height:1.55;font-family:Arial,Helvetica,sans-serif;">${text}</p>
                    </td>`;

      const subject =
        `Happy Birthday ${member.full_name}! — ${clubName}`;

      const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>Happy Birthday, ${firstName}!</title>
</head>
<body style="margin:0;padding:0;background-color:#F6EDF1;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F6EDF1;font-size:1px;line-height:1px;">
    Warm birthday wishes from all of us at ${safeClub}.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6EDF1;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 14px 44px rgba(67,6,31,0.16);">

        <!-- colour ribbon -->
        <tr>
          <td style="font-size:0;line-height:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="25%" height="6" style="background:#43061F;font-size:0;line-height:0;">&nbsp;</td>
              <td width="25%" height="6" style="background:#B30F57;font-size:0;line-height:0;">&nbsp;</td>
              <td width="25%" height="6" style="background:#F06FA3;font-size:0;line-height:0;">&nbsp;</td>
              <td width="25%" height="6" style="background:#FFC857;font-size:0;line-height:0;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>

        <!-- hero -->
        <tr>
          <td align="center" bgcolor="#6B0A33"
              style="background-color:#6B0A33;background-image:linear-gradient(145deg,#43061F 0%,#B30F57 62%,#D41367 100%);padding:34px 28px 38px;text-align:center;">
            ${logoHtml}
            ${confettiRow(['#FFC857', '#F06FA3', '#FFFFFF', '#FFC857', '#F06FA3', '#FFFFFF', '#FFC857'])}
            <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
            ${cakeIcon}
            <p style="margin:0 0 8px;color:#FFD98A;font-size:12px;font-weight:700;letter-spacing:5px;font-family:Arial,Helvetica,sans-serif;">
              &#10022;&nbsp; HAPPY BIRTHDAY &nbsp;&#10022;
            </p>
            <h1 style="margin:0 0 10px;color:#ffffff;font-size:36px;line-height:1.15;font-weight:700;font-family:Georgia,'Times New Roman',serif;">
              ${safeName}
            </h1>
            <p style="margin:0;color:rgba(255,255,255,0.88);font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
              Today the whole club celebrates you.
            </p>
            <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
            ${confettiRow(['#FFFFFF', '#FFC857', '#F06FA3', '#FFFFFF', '#FFC857', '#F06FA3', '#FFFFFF'])}
          </td>
        </tr>

        <!-- message -->
        <tr>
          <td style="padding:36px 34px 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 14px;color:#43061F;font-size:20px;font-weight:700;font-family:Georgia,'Times New Roman',serif;">
              Dear ${firstName},
            </p>
            <p style="margin:0 auto 26px;max-width:440px;color:#4A3A41;font-size:14.5px;line-height:1.95;">
              On behalf of the entire <strong style="color:#B30F57;">${safeClub}</strong> family,
              we wish you a very happy birthday. May this special day bring you joy, success and fulfilment,
              and may the year ahead be filled with moments that make you proud.
              Your dedication and service to Rotaract inspire us all.
            </p>
          </td>
        </tr>

        <!-- three wishes -->
        <tr>
          <td style="padding:0 28px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#FCF5F8;border:1px solid #F3DCE6;border-radius:14px;">
              <tr><td style="padding:22px 10px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  ${pillar('&#9733;', 'JOY', 'Laughter and good company all year round', '#B30F57')}
                  ${pillar('&#10022;', 'SUCCESS', 'Every goal you chase within your reach', '#D41367')}
                  ${pillar('&#9670;', 'FULFILMENT', 'Meaning in the service you give', '#6B0A33')}
                </tr></table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- motto -->
        <tr>
          <td style="padding:0 34px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="4" style="background:#FFC857;border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:6px 0 6px 18px;text-align:left;">
                  <p style="margin:0 0 3px;color:#43061F;font-size:16px;font-style:italic;font-weight:700;font-family:Georgia,'Times New Roman',serif;">
                    &ldquo;Service Above Self&rdquo;
                  </p>
                  <p style="margin:0;color:#8A7580;font-size:12px;font-family:Arial,Helvetica,sans-serif;">
                    Thank you for living it every day, Rotaractor.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- sign-off -->
        <tr>
          <td align="center" style="padding:0 34px 34px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 4px;color:#7A6670;font-size:13px;">With warm regards,</p>
            <p style="margin:0 0 3px;color:#43061F;font-size:15px;font-weight:700;">${safeClub}</p>
            <p style="margin:0;color:#9A8690;font-size:12px;">Parented by ${safeParent}</p>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td bgcolor="#43061F" align="center"
              style="background-color:#43061F;padding:20px 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 4px;color:#FFD98A;font-size:11px;font-weight:700;letter-spacing:1.5px;">
              CLUB ID ${safeClubId} &nbsp;&#9670;&nbsp; ROTARY INTERNATIONAL DISTRICT 3206
            </p>
            <p style="margin:0;color:rgba(255,255,255,0.55);font-size:10.5px;">
              Sent automatically by the Rotaract Club Portal &middot; ${year}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

      return this.sendEmail({
        email_type   : 'birthday_wish',
        to_email     : member.email,
        to_name      : member.full_name,
        from_name    : clubName,
        subject,
        html_message : htmlBody,
        message      : `Happy Birthday ${member.full_name}! `
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
    const enabled = this._getSetting(
      'monthly_statement_email_enabled', 'true'
    );
    if (enabled !== 'true') return false;

    try {
      const now            = new Date();
      const firstOfMonth   = new Date(
        now.getFullYear(), now.getMonth(), 1
      );
      const lastMonthEnd   = new Date(firstOfMonth - 1);
      const lastMonthStart = new Date(
        lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1
      );

      const startDate = lastMonthStart.toLocalISODate();
      const endDate   = lastMonthEnd.toLocalISODate();
      const monthName = lastMonthEnd.toLocaleDateString('en-IN', {
        month: 'long'
      });
      const yearLabel = lastMonthEnd.getFullYear();

      const { data: transactions, error } = await this._getDb()
        .from('treasury_transactions')
        .select('*')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true });

      if (error) throw error;
      if (!transactions?.length) {
        console.log(
          '[EmailService] no transactions for', monthName, yearLabel
        );
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
      const netChange      = totalIncome - totalExpense;

      /* Opening balance of the month: last balance before it, otherwise the club's opening balance (Treasury → Opening balance) */
      let openingBalance = closingBalance - netChange;
      try {
        const db = this._getDb();
        const { data: prev } = await db.from('treasury_transactions').select('balance')
          .lt('transaction_date', startDate)
          .order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(1);
        if (prev && prev.length) openingBalance = parseFloat(prev[0].balance) || 0;
        else {
          const { data: ob } = await db.from('club_settings').select('key,value').in('key', ['treasury_opening_balance']);
          const v = parseFloat((ob || [])[0]?.value);
          if (isFinite(v)) openingBalance = v;
        }
      } catch (e) { /* keep the derived value */ }

      const subject =
        `[Rotaract] Monthly Treasury Statement`
        + ` — ${monthName} ${yearLabel}`;
      const FF = this._FF;
      const cur = (v) => this._fmtCur(v);

      /* KPI cards — 4 across on desktop, stacked on phones */
      const kpi = (label, value, colour, bg) => `
        <td width="50%" class="em-stack" valign="top" style="padding:5px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:${bg};border-radius:12px;border:1px solid ${colour}33;">
            <tr><td style="padding:14px 16px;">
              <div style="color:#7A6670;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-family:${FF};">${label}</div>
              <div class="em-big" style="color:${colour};font-size:22px;font-weight:800;line-height:1.25;margin-top:4px;font-family:${FF};">${value}</div>
            </td></tr>
          </table>
        </td>`;

      /* category breakdown with proportional bars */
      const byCat = (type) => {
        const m = {};
        transactions.filter(t => t.transaction_type === type).forEach(t => {
          const c = t.category || 'Uncategorised';
          m[c] = (m[c] || 0) + (parseFloat(t.amount) || 0);
        });
        return Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 6);
      };
      const bars = (rows, total, colour) => rows.length ? rows.map(([name, amt]) => {
        const pct = total > 0 ? Math.max(3, Math.round(amt / total * 100)) : 0;
        return `
          <tr><td style="padding:6px 0 2px;font-size:12px;color:#3A2D33;font-family:${FF};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-weight:600;">${this._esc(name)}</td>
              <td align="right" style="color:#5A4A52;white-space:nowrap;">${cur(amt)} <span style="color:#9A8690;">(${total > 0 ? Math.round(amt / total * 100) : 0}%)</span></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:0 0 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EAEE;border-radius:6px;"><tr>
              <td width="${pct}%" height="7" style="background:${colour};border-radius:6px;font-size:0;line-height:0;">&nbsp;</td>
              <td height="7" style="font-size:0;line-height:0;">&nbsp;</td>
            </tr></table>
          </td></tr>`;
      }).join('') : `<tr><td style="font-size:12px;color:#9A8690;padding:4px 0;font-family:${FF};">No entries this month</td></tr>`;

      const savingsRate = totalIncome > 0 ? Math.round(netChange / totalIncome * 100) : 0;
      const shown = transactions.slice(0, 25);

      const bodyContent = `
        ${this._banner('#B30F57', '', 'Monthly Treasury Statement',
          `${monthName} ${yearLabel} — ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`)}

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -5px 6px;width:calc(100% + 10px);">
          <tr>
            ${kpi('Opening balance', cur(openingBalance), '#5E3A4B', '#FBF6F8')}
            ${kpi('Closing balance', cur(closingBalance), closingBalance >= 0 ? '#8E0C45' : '#C53030', '#FDF1F6')}
          </tr>
          <tr>
            ${kpi('Total income', cur(totalIncome), '#1F8A5B', '#F1FBF6')}
            ${kpi('Total expenses', cur(totalExpense), '#C53030', '#FFF5F5')}
          </tr>
        </table>

        <p style="margin:6px 0 22px;font-size:13px;color:#5A4A52;font-family:${FF};">
          Net change for the month:
          <strong style="color:${netChange >= 0 ? '#1F8A5B' : '#C53030'};">${netChange >= 0 ? '+' : '−'}${cur(Math.abs(netChange))}</strong>
          ${totalIncome > 0 ? `&nbsp;&bull;&nbsp; ${savingsRate >= 0 ? 'Retained' : 'Overspent'} <strong>${Math.abs(savingsRate)}%</strong> of income` : ''}
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
          <tr>
            <td class="em-stack" width="50%" valign="top" style="padding-right:10px;">
              <h4 style="margin:0 0 6px;font-size:13px;color:#43061F;font-family:${FF};">Where the money went</h4>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bars(byCat('expense'), totalExpense, '#E5533D')}</table>
            </td>
            <td class="em-stack" width="50%" valign="top" style="padding-left:10px;">
              <h4 style="margin:0 0 6px;font-size:13px;color:#43061F;font-family:${FF};">Where it came from</h4>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bars(byCat('income'), totalIncome, '#1FA971')}</table>
            </td>
          </tr>
        </table>

        <h4 style="margin:0 0 10px;font-size:13px;color:#43061F;font-family:${FF};">Transaction details</h4>
        <table role="presentation" class="em-tbl" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-collapse:separate;border-spacing:0;border:1px solid #F0E6EB;border-radius:10px;overflow:hidden;font-size:12px;font-family:${FF};">
          <tr style="background:#43061F;">
            <th align="left"  style="padding:10px 10px;color:#fff;font-weight:600;">Date</th>
            <th align="left"  style="padding:10px 10px;color:#fff;font-weight:600;">Particular</th>
            <th align="right" style="padding:10px 10px;color:#fff;font-weight:600;">Amount</th>
            <th align="right" class="em-hide" style="padding:10px 10px;color:#fff;font-weight:600;">Balance</th>
          </tr>
          ${shown.map((t, i) => {
            const inc = t.transaction_type === 'income';
            return `
          <tr style="background:${i % 2 ? '#ffffff' : '#FCF8FA'};">
            <td style="padding:9px 10px;color:#6B5560;white-space:nowrap;vertical-align:top;">${this._fmtShortDate(t.transaction_date)}</td>
            <td style="padding:9px 10px;color:#3A2D33;vertical-align:top;">${this._esc(t.particular || '')}${t.category ? `<br><span style="color:#9A8690;font-size:11px;">${this._esc(t.category)}</span>` : ''}</td>
            <td align="right" style="padding:9px 10px;white-space:nowrap;font-weight:700;color:${inc ? '#1F8A5B' : '#C53030'};vertical-align:top;">${inc ? '+' : '−'}${cur(t.amount)}</td>
            <td align="right" class="em-hide" style="padding:9px 10px;white-space:nowrap;color:#8E0C45;font-weight:600;vertical-align:top;">${cur(t.balance)}</td>
          </tr>`;
          }).join('')}
          <tr style="background:#F6E9EF;">
            <td colspan="2" style="padding:11px 10px;font-weight:700;color:#43061F;">Month total</td>
            <td align="right" style="padding:11px 10px;font-weight:800;color:${netChange >= 0 ? '#1F8A5B' : '#C53030'};white-space:nowrap;">${netChange >= 0 ? '+' : '−'}${cur(Math.abs(netChange))}</td>
            <td align="right" class="em-hide" style="padding:11px 10px;font-weight:800;color:#8E0C45;white-space:nowrap;">${cur(closingBalance)}</td>
          </tr>
        </table>
        ${transactions.length > shown.length ? `
        <p style="font-size:11px;color:#9A8690;margin:10px 0 0;text-align:center;font-family:${FF};">
          Showing ${shown.length} of ${transactions.length} transactions — the attached PDF and Excel statements contain every entry.
        </p>` : `
        <p style="font-size:11px;color:#9A8690;margin:10px 0 0;text-align:center;font-family:${FF};">
          Detailed PDF and Excel statements are attached to this mail.
        </p>`}
      `;

      const htmlBody = this._buildEmailWrapper(subject, bodyContent);
      const result   = await this._sendToGroup(subject, htmlBody, 'monthly_statement', [
        { kind: 'doc', doc: 'treasury', format: 'pdf',  params: { from_date: startDate, to_date: endDate },
          name: `Treasury_Statement_${monthName}_${yearLabel}` },
        { kind: 'doc', doc: 'treasury', format: 'xlsx', params: { from_date: startDate, to_date: endDate },
          name: `Treasury_${monthName}_${yearLabel}` },
        /* one file holding the report (with photos) of every project completed that month */
        { kind: 'doc', doc: 'monthly_report', format: 'pdf',
          params: { month: lastMonthStart.getMonth() + 1, year: lastMonthStart.getFullYear() },
          name: `Project_Reports_${monthName}_${yearLabel}` }
      ]);

      if (result) {
        try {
          await this._getDb().from('email_logs').insert({
            email_type      : 'monthly_statement',
            subject,
            recipient_group : this._membersGroup(),
            status          : 'sent',
            method          : 'edge_function',
            metadata        : { month: monthName, year: yearLabel, auto_triggered: true }
          });
          console.log('[EmailService] Monthly statement logged successfully to DB.');
        } catch (logErr) {
          console.warn('[EmailService] failed to log monthly statement to DB:', logErr);
        }
      }

      return result;

    } catch (e) {
      console.error('[EmailService] sendMonthlyTreasuryStatement:', e);
      return false;
    }
  }

  /* ============================================================
     SCHEDULER — BIRTHDAY (daily at 00:01 AM)
     ============================================================ */
  _startBirthdayScheduler() {
    const enabled = this._getSetting(
      'birthday_email_enabled', 'true'
    );
    if (enabled !== 'true') return;

    const checkBirthdays = async () => {
      try {
        await this._loadSettings();
        if (
          this._getSetting('birthday_email_enabled', 'true') !== 'true'
        ) return;

        const today = new Date();
        const todayMon = today.getMonth() + 1;
        const todayDay = today.getDate();
        const thisYear = today.getFullYear();

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
          if (
            dob.getMonth() + 1 !== todayMon ||
            dob.getDate()      !== todayDay
          ) continue;

          const sentKey = `bday_${member.id}_${thisYear}`;
          let alreadySent = false;

          try {
            const stored = localStorage.getItem(sentKey);
            if (stored) {
              alreadySent = JSON.parse(stored)?.sent === true;
            }
          } catch { /* ignore */ }

          if (alreadySent) continue;

          const sent = await this.sendBirthdayWish(member);
          if (sent) {
            try {
              localStorage.setItem(
                sentKey,
                JSON.stringify({
                  sent: true, at: new Date().toISOString()
                })
              );
            } catch { /* storage full */ }
          }
        }
      } catch (e) {
        console.warn('[EmailService] birthday check error:', e);
      }
    };

    const scheduleNextMidnight = () => {
      const now      = new Date();
      const midnight = new Date(
        now.getFullYear(), now.getMonth(),
        now.getDate() + 1, 0, 1, 0
      );
      const delay = midnight.getTime() - now.getTime();

      this._birthdayTimer = setTimeout(async () => {
        await checkBirthdays();
        scheduleNextMidnight();
      }, delay);

      console.log(
        `[EmailService] birthday check in `
        + `${Math.round(delay / 60000)}m`
      );
    };

    scheduleNextMidnight();
  }

  /* ============================================================
     SCHEDULER — MONTHLY STATEMENT (Unbreakable Atomic Lock)
     Uses setting Row lock inside PostgreSQL via Supabase update neq.
     ============================================================ */
  _startMonthlyStatementScheduler() {
    const enabled = this._getSetting(
      'monthly_statement_email_enabled', 'true'
    );
    if (enabled !== 'true') return;

    const checkAndSendMonthlyStatement = async () => {
      try {
        await this._loadSettings();
        if (this._getSetting('monthly_statement_email_enabled', 'true') !== 'true') {
          return;
        }

        const now = new Date();
        // Fire strictly on the 1st of the month, after 09:00 AM local system time
        if (now.getDate() !== 1 || now.getHours() < 9) {
          return;
        }

        const currentYear  = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`; // "YYYY-MM" e.g., "2024-11"
        const localLockKey  = `monthly_statement_sent_${currentPeriod}`;

        // Tier 1 Check: Local instance memory safety lock (prevents concurrent clicks or tight loop checks)
        if (this._monthlyStatementLock) return;

        // Tier 2 Check: Quick exit if loaded settings state tells us it's already sent this month
        if (this._getSetting('last_monthly_statement_sent_period', '') === currentPeriod) {
          return;
        }

        // Tier 3 Check: Tab-concurrency local storage lock
        const localStatus = localStorage.getItem(localLockKey);
        if (localStatus === 'sent' || localStatus === 'pending') {
          return;
        }

        // Claim localized tab ownership locks
        this._monthlyStatementLock = true;
        localStorage.setItem(localLockKey, 'pending');

        // Apply a small randomized delay of 500ms - 3500ms
        // Helps spread out simultaneous queries if multiple admin devices are loaded at the exact same second
        const jitter = Math.floor(Math.random() * 3000) + 500;
        await new Promise(resolve => setTimeout(resolve, jitter));

        // Tier 4 Check: Unbreakable database setting lock. 
        // We attempt to update 'last_monthly_statement_sent_period' to the current period only if its value is NOT the current period.
        // Postgres enforces this atomic row-update safely. Only ONE transaction can succeed in changing a row.
        const { data, error } = await this._getDb()
          .from('club_settings')
          .update({ value: currentPeriod })
          .eq('key', 'last_monthly_statement_sent_period')
          .neq('value', currentPeriod)
          .select();

        if (error) {
          this._monthlyStatementLock = false;
          localStorage.removeItem(localLockKey);
          throw error;
        }

        let wonDistributedLock = false;

        if (data && data.length > 0) {
          // Row updated successfully! This client won the setting lock.
          wonDistributedLock = true;
        } else {
          // If 0 rows were updated, it means either:
          // A) The period was already updated to the current period by another browser system (we lost).
          // B) The key 'last_monthly_statement_sent_period' does not exist in the DB.
          try {
            // Attempt to insert the lock key. If it exists, PostgreSQL will fail with a duplicate key error.
            const { data: insData, error: insError } = await this._getDb()
              .from('club_settings')
              .insert({ key: 'last_monthly_statement_sent_period', value: currentPeriod })
              .select();

            if (!insError && insData && insData.length > 0) {
              wonDistributedLock = true;
            }
          } catch (errIns) {
            wonDistributedLock = false;
          }
        }

        if (!wonDistributedLock) {
          // Another process won the lock. Stop immediately.
          localStorage.setItem(localLockKey, 'sent');
          this._monthlyStatementLock = false;
          return;
        }

        // Lock Acquired! Sync to our internal configuration settings object
        this._settings['last_monthly_statement_sent_period'] = currentPeriod;
        localStorage.setItem(localLockKey, 'sent');

        console.log(`[EmailService] Distributed database-lock [${currentPeriod}] successfully acquired. Sending treasury statement.`);
        await this.sendMonthlyTreasuryStatement();
        
        this._monthlyStatementLock = false;

      } catch (e) {
        console.warn('[EmailService] monthly statement check error:', e);
        this._monthlyStatementLock = false;
      }
    };

    // Run verification on initial bootup
    checkAndSendMonthlyStatement();

    // Recheck strictly once every hour
    const ONE_HOUR = 60 * 60 * 1000;
    this._monthlyTimer = setInterval(async () => {
      await checkAndSendMonthlyStatement();
    }, ONE_HOUR);

    console.log('[EmailService] Monthly treasury scheduler active (hourly settings synchronization locks).');
  }

  /* ============================================================
     SCHEDULER — TODAY'S MEETINGS
     ============================================================ */
  async _scheduleTodayMeetings() {
    try {
      const today = new Date().toLocalISODate();

      const { data: meetings, error } = await this._getDb()
        .from('meetings')
        .select('id, title, meeting_date, start_time, attendance_form_url')
        .eq('meeting_date', today);

      if (error) throw error;
      if (!meetings?.length) return;

      const now = Date.now();

      meetings.forEach(meeting => {
        if (!meeting.start_time) return;

        const parts     = meeting.start_time.split(':').map(Number);
        const h         = parts[0] ?? 0;
        const m         = parts[1] ?? 0;
        const todayDate = new Date();
        const meetingTs = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth(),
          todayDate.getDate(),
          h, m, 0
        ).getTime();

        const delay = meetingTs - now;
        if (delay <= 0 || delay >= 24 * 60 * 60 * 1000) return;

        if (this._meetingTimers[meeting.id]) {
          clearTimeout(this._meetingTimers[meeting.id]);
        }

        this._meetingTimers[meeting.id] = setTimeout(async () => {
          console.log(
            `[EmailService] auto-sending attendance for: `
            + meeting.title
          );
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
     PUBLIC ALIAS
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
     PUBLIC — LOAD EMAIL LOGS
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
        sent      : 'var(--success)',
        failed    : 'var(--danger)',
        triggered : 'var(--warning)',
        scheduled : 'var(--accent)'
      };

      container.innerHTML = logs.map(log => {
        const color      = STATUS_COLORS[log.status]
          || 'var(--text-muted)';
        const safeSubj   = log.subject
          || log.email_type || '(no subject)';
        const safeType   = (log.email_type || '').replace(/_/g, ' ');
        const safeMethod = log.method ? ` via ${log.method}` : '';
        const recipient  = log.recipient_email
          ? log.recipient_email
          : log.recipient_group ? 'Group' : '—';

        const dateStr = log.created_at
          ? new Date(log.created_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short',
              hour: '2-digit', minute: '2-digit'
            })
          : '—';

        const formUrl = log.metadata?.form_url || '';

        return `
          <div style="display:flex;align-items:flex-start;gap:10px;
                      padding:12px 20px;
                      border-bottom:1px solid var(--border-color);">
            <div style="width:8px;height:8px;border-radius:50%;
                        flex-shrink:0;background:${color};
                        margin-top:5px;"></div>
            <div style="flex:1;overflow:hidden;min-width:0;">
              <div style="font-size:0.82rem;font-weight:600;
                          color:var(--text-heading);overflow:hidden;
                          text-overflow:ellipsis;white-space:nowrap;"
                   title="${safeSubj.replace(/"/g, '&quot;')}">
                ${safeSubj.substring(0, 80)}
              </div>
              <div style="font-size:0.70rem;color:var(--text-muted);
                          margin-top:2px;">
                ${safeType}${safeMethod}
                &nbsp;&bull;&nbsp;${recipient}
                &nbsp;&bull;&nbsp;${dateStr}
              </div>
              ${formUrl ? `
              <div style="font-size:0.68rem;color:var(--accent);
                          margin-top:2px;">
                <a href="${formUrl}" target="_blank"
                   style="color:inherit;text-decoration:underline;">
                  View Form &rarr;
                </a>
              </div>` : ''}
              ${log.error_message ? `
              <div style="font-size:0.68rem;color:var(--danger);
                          margin-top:2px;overflow:hidden;
                          text-overflow:ellipsis;white-space:nowrap;"
                   title="${String(log.error_message)
                     .replace(/"/g, '&quot;')}">
                ${String(log.error_message).substring(0, 90)}
              </div>` : ''}
            </div>
            <span style="font-size:0.68rem;font-weight:700;
                         flex-shrink:0;color:${color};
                         white-space:nowrap;padding:2px 8px;
                         border-radius:var(--border-radius-full);
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
        key  : 'birthday_email_enabled',
        icon : 'cake',
        label: 'Birthday Wishes',
        desc : "Auto-send on each member's birthday"
      },
      {
        key  : 'monthly_statement_email_enabled',
        icon : 'indian-rupee',
        label: 'Monthly Treasury Statement',
        desc : 'Auto-send once on the 1st of each month at 9:00 AM'
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
          <div style="display:flex;align-items:center;gap:12px;
                      margin-bottom:18px;">
            <div style="width:44px;height:44px;
                        border-radius:var(--border-radius-sm);
                        background:var(--accent-light);display:flex;
                        align-items:center;justify-content:center;
                        flex-shrink:0;">
              <i data-lucide="send"
                 style="width:22px;height:22px;
                        color:var(--accent);"></i>
            </div>
            <div>
              <h3 style="font-size:0.95rem;font-weight:700;
                         color:var(--text-heading);margin:0 0 2px;">
                Send Custom Email
              </h3>
              <p style="font-size:0.74rem;color:var(--text-muted);
                        margin:0;">
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
                <input type="text" id="custom-email-subject"
                       class="form-input"
                       placeholder="Email subject"
                       maxlength="200" required />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" for="custom-email-message">
                Message *
              </label>
              <div class="input-wrap neu-inset">
                <textarea id="custom-email-message"
                          class="form-textarea" rows="6"
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
               style="width:18px;height:18px;
                      color:var(--accent);"></i>
            Automated Emails
          </h3>

          <div style="display:flex;flex-direction:column;gap:10px;
                      margin-bottom:20px;">
            ${automations.map(item => `
              <div style="display:flex;justify-content:space-between;
                          align-items:center;padding:12px;
                          background:var(--bg-secondary);
                          border-radius:var(--border-radius-sm);">
                <div style="display:flex;align-items:center;gap:8px;">
                  <i data-lucide="${item.icon}"
                     style="width:16px;height:16px;
                            color:var(--accent);"></i>
                  <div>
                    <div style="font-size:0.82rem;font-weight:600;
                                color:var(--text-secondary);">
                      ${item.label}
                    </div>
                    <div style="font-size:0.68rem;
                                color:var(--text-muted);">
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
                           .toggleAutomation(
                             '${item.key}', this.checked)" />
                  <span class="admin-toggle-slider"></span>
                </label>
              </div>
            `).join('')}
          </div>

          <div style="padding-top:16px;
                      border-top:1px solid var(--border-color);">
            <h4 style="font-size:0.78rem;font-weight:700;
                       color:var(--text-muted);margin:0 0 10px;
                       text-transform:uppercase;
                       letter-spacing:0.06em;">
              Manual Triggers
            </h4>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn btn-outline btn-sm"
                      onclick="window.emailService
                        .sendMonthlyTreasuryStatement()
                        .then(r => window.dashboard?.showToast(
                          r ? 'Statement sent!' : 'Failed to send.',
                          r ? 'success' : 'error'))">
                <i data-lucide="indian-rupee"></i>
                <span>Send Monthly Statement Now</span>
              </button>
              <button class="btn btn-outline btn-sm"
                      onclick="window.emailService
                        .scheduleTodayMeetings()
                        .then(() => window.dashboard?.showToast(
                          'Meeting timers reset.', 'info'))">
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
            <i data-lucide="activity"></i> Recent Email Logs
          </h3>
          <button class="btn btn-outline btn-sm"
                  onclick="window.emailService.loadEmailLogs()">
            <i data-lucide="refresh-cw"></i>
            <span>Refresh</span>
          </button>
        </div>
        <div id="email-logs-container">
          <div class="loading-single-line"
               style="width:200px;margin:24px auto;">
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
            msgEl.textContent = 'Subject and message are required.';
            msgEl.className   = 'form-message error';
          }
          return;
        }

        if (btn) {
          btn.disabled  = true;
          btn.innerHTML =
            '<i data-lucide="loader-2"></i>'
            + '<span>Sending&hellip;</span>';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        if (msgEl) {
          msgEl.textContent = '';
          msgEl.className   = 'form-message';
        }

        const htmlBody = this._buildEmailWrapper(
          subject,
          `<h2 style="color:#9C1C42;font-size:16px;margin:0 0 14px;
                      font-family:Arial,Helvetica,sans-serif;">
             ${this._esc(subject)}
           </h2>
           <div style="font-size:14px;color:#444444;line-height:1.8;
                       white-space:pre-wrap;
                       font-family:Arial,Helvetica,sans-serif;">
             ${this._esc(message)}
           </div>`
        );

        const result = await this._sendToGroup(
          `[Rotaract] ${subject}`, htmlBody, 'custom_email'
        );

        if (btn) {
          btn.disabled  = false;
          btn.innerHTML =
            '<i data-lucide="send"></i>'
            + '<span>Send to All Members</span>';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        if (msgEl) {
          msgEl.textContent = result
            ? '✓ Email sent to all members!'
            : '✗ Failed to send. Check email logs for details.';
          msgEl.className =
            `form-message ${result ? 'success' : 'error'}`;
        }

        dashboard?.showToast(
          result
            ? 'Email sent to all members!'
            : 'Failed to send email.',
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

    if (typeof lucide !== 'undefined') lucide.createIcons();
    this.loadEmailLogs();
  }

  /* ============================================================
     PUBLIC — DESTROY
     ============================================================ */
  destroy() {
    if (this._birthdayTimer) clearTimeout(this._birthdayTimer);
    if (this._monthlyTimer)  clearInterval(this._monthlyTimer);
    Object.values(this._meetingTimers)
      .forEach(t => clearTimeout(t));
    this._meetingTimers = {};
    console.log('[EmailService] destroyed');
  }
}

/* ============================================================
   GLOBAL SINGLETON
   ============================================================ */
const emailService  = new EmailService();
window.emailService = emailService;
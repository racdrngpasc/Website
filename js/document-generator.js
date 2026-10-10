/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Document Generator - js/document-generator.js
   All DOCX generation via Supabase Edge Functions
   ============================================================ */

'use strict';

class DocumentGenerator {
  constructor() {
    this.db      = getSupabaseClient();
    this.baseUrl = `${SUPABASE_URL}/functions/v1`;
    this.headers = {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey'       : SUPABASE_ANON_KEY
    };
    this._settings       = {};
    this._settingsLoaded = false;
    this.format = (() => {
      try { return localStorage.getItem('docFormat') === 'pdf' ? 'pdf' : 'docx'; }
      catch (e) { return 'docx'; }
    })();
    this._watchDownloadModals();
  }

  /* ============================================================
     FORMAT PREFERENCE  (Word / PDF) — remembered between visits
     ============================================================ */
  setFormat(fmt) {
    this.format = fmt === 'pdf' ? 'pdf' : 'docx';
    try { localStorage.setItem('docFormat', this.format); } catch (e) { /* private mode */ }
    document.querySelectorAll('.doc-format-picker').forEach(p => {
      p.querySelectorAll('button').forEach(b =>
        b.classList.toggle('active', b.dataset.fmt === this.format));
    });
  }

  _formatPickerHTML() {
    const on = f => (this.format === f ? ' active' : '');
    return `<div class="doc-format-picker" role="group" aria-label="Download format">
      <span class="doc-format-label">Format</span>
      <button type="button" data-fmt="docx" class="${on('docx').trim()}"
              onclick="window.docGenerator.setFormat('docx')">Word</button>
      <button type="button" data-fmt="pdf" class="${on('pdf').trim()}"
              onclick="window.docGenerator.setFormat('pdf')">PDF</button>
    </div>`;
  }

  /* Adds the Word/PDF switch to every download modal the admin pages create */
  _watchDownloadModals() {
    if (this._modalObserver || typeof MutationObserver === 'undefined') return;
    const ids = ['ev-download-modal', 'download-docs-modal',
                 'rpt-download-modal', 'dpp-download-modal'];
    const inject = (node) => {
      if (!node || node.nodeType !== 1) return;
      const modals = ids.includes(node.id) ? [node]
        : ids.map(id => node.querySelector && node.querySelector('#' + id)).filter(Boolean);
      modals.forEach(m => {
        if (m.querySelector('.doc-format-picker')) return;
        const body = m.querySelector('.modal-body');
        if (body) body.insertAdjacentHTML('afterbegin', this._formatPickerHTML());
      });
    };
    this._modalObserver = new MutationObserver(list =>
      list.forEach(r => r.addedNodes.forEach(inject)));
    const start = () => this._modalObserver.observe(document.body, { childList: true });
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }

  /* ============================================================
     LOAD SETTINGS  (cached)
     ============================================================ */
  async loadSettings() {
    if (this._settingsLoaded) return this._settings;
    try {
      const { data } = await this.db
        .from('club_settings')
        .select('key, value');
      if (data) {
        data.forEach(s => { this._settings[s.key] = s.value; });
      }
      this._settingsLoaded = true;
    } catch (e) {
      console.warn('DocGenerator settings load error:', e);
    }
    return this._settings;
  }

  getSetting(key, fallback = '') {
    return this._settings[key] || fallback;
  }

  /* ============================================================
     CALL EDGE FUNCTION AND DOWNLOAD DOCX
     ============================================================ */
  async _callEdgeFunction(functionName, payload, fallbackFilename, formatOverride) {
    const ALIAS = {
      'generate-event-report'     : 'event_report',
      'generate-monthly-report'   : 'monthly_report',
      'generate-dpp-report'       : 'dpp_report',
      'generate-avenue-report'    : 'avenue_report',
      'generate-meeting-agenda'   : 'agenda',
      'generate-meeting-minutes'  : 'minutes',
      'generate-meeting-attendance': 'attendance',
      'combined_meeting'          : 'combined_meeting',
      'combined_agenda'           : 'combined_agenda',
      'treasury'                  : 'treasury'
    };
    const format = formatOverride || this.format || 'docx';
    const doc    = ALIAS[functionName];

    const post = async (name, body) => {
      try {
        return await fetch(`${this.baseUrl}/${name}`, {
          method : 'POST', headers: this.headers, body: JSON.stringify(body)
        });
      } catch (networkError) {
        throw new Error(
          `Network error calling ${name}: ${networkError.message}. ` +
          `Check your connection and that the edge function is deployed.`
        );
      }
    };

    // New cranberry generator first; legacy per-type function (Word only) as a safety net
    let response = doc ? await post('generate-document', { ...payload, doc, format }) : null;
    let usedLegacy = false;
    if ((!response || response.status === 404) && functionName.startsWith('generate-') && format === 'docx') {
      response = await post(functionName, payload);
      usedLegacy = true;
    }
    if (!response) throw new Error('Document generator is not available');

    if (!response.ok) {
      let errorMessage = `Edge function error: HTTP ${response.status}`;
      try { errorMessage = (await response.json()).error || errorMessage; } catch (e) { /* not JSON */ }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const maybeError = await response.json().catch(() => ({}));
      throw new Error(maybeError.error || 'Unexpected response from document generator');
    }

    const blob = await response.blob();
    if (!blob || blob.size === 0) throw new Error('Edge function returned empty file');

    const ext = usedLegacy || format === 'docx' ? 'docx' : 'pdf';
    let filename = (fallbackFilename || 'document').replace(/\.(docx|pdf)$/i, '') + '.' + ext;
    const match = (response.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
    if (match && match[1]) filename = match[1];

    this._downloadBlob(blob, filename);
    return true;
  }

  /* ============================================================
     DOWNLOAD BLOB HELPER
     ============================================================ */
  _downloadBlob(blob, filename) {
    if (typeof saveAs !== 'undefined') {
      saveAs(blob, filename);
    } else {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
  }

  /* ============================================================
     TOAST HELPERS
     ============================================================ */
  _showProgress(message) {
    if (window.adminDashboard?.showToast) {
      window.adminDashboard.showToast(message, 'info', 3000);
    } else if (window.app?.showToast) {
      window.app.showToast(message, 'info', 3000);
    } else {
      console.log(message);
    }
  }

  _showSuccess(message) {
    if (window.adminDashboard?.showToast) {
      window.adminDashboard.showToast(message, 'success');
    } else if (window.app?.showToast) {
      window.app.showToast(message, 'success');
    }
  }

  _showError(message) {
    if (window.adminDashboard?.showToast) {
      window.adminDashboard.showToast(message, 'error');
    } else if (window.app?.showToast) {
      window.app.showToast(message, 'error');
    }
  }

  /* ============================================================
     1.  GENERATE EVENT REPORT  (.docx)
     ============================================================ */
  async generateEventReport(eventId) {
    if (!eventId) throw new Error('eventId is required');

    this._showProgress('Generating event report...');

    try {
      await this._callEdgeFunction(
        'generate-event-report',
        { event_id: eventId },
        `Event_Report_${eventId}.docx`
      );
      this._showSuccess('Event report downloaded successfully!');
      return true;
    } catch (err) {
      console.error('generateEventReport error:', err);
      this._showError(`Failed to generate report: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     2.  GENERATE MONTHLY REPORT  (.docx)
     ============================================================ */
  async generateMonthlyReport(month, year) {
    if (!month || !year) throw new Error('month and year are required');

    await this.loadSettings();
    const monthName = this._getMonthName(month);
    this._showProgress(
      `Generating monthly report for ${monthName} ${year}...`
    );

    try {
      await this._callEdgeFunction(
        'generate-monthly-report',
        {
          month: parseInt(String(month)),
          year : parseInt(String(year))
        },
        `Monthly_Report_${monthName}_${year}.docx`
      );
      this._showSuccess(
        `Monthly report for ${monthName} ${year} downloaded!`
      );
      return true;
    } catch (err) {
      console.error('generateMonthlyReport error:', err);
      this._showError(`Failed to generate monthly report: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     3.  GENERATE DPP REPORT  (.docx)
         Sends full DPP metadata so the edge function can render
         Approval Number, Pillar, Category, Council Member fields.
     ============================================================ */
  async generateDPPReport(month, year) {
    if (!month || !year) throw new Error('month and year are required');

    await this.loadSettings();
    const monthName = this._getMonthName(month);
    this._showProgress(
      `Generating DPP report for ${monthName} ${year}...`
    );

    try {
      /* Fetch all DPP events for the requested month so we can pass
         the extra metadata to the edge function as a hint.
         The edge function queries the DB itself, but we also send
         the pillar / category labels so it can render them without
         needing to know the JS constants.                          */
      const { data: dppEvents } = await this.db
        .from('events')
        .select(`
          id, title, event_date, venue, event_chair,
          actual_attendance, service_hours, beneficiaries,
          dpp_approval_number, dpp_pillar, dpp_category, dpp_council_member,
          event_reports(id, is_approved, report_content)
        `)
        .eq('is_dpp', true)
        .gte('event_date', `${year}-${String(month).padStart(2, '0')}-01`)
        .lte('event_date', `${year}-${String(month).padStart(2, '0')}-31`)
        .order('event_date', { ascending: true });

      /* Build a lightweight metadata map to attach to the payload */
      const dppMeta = (dppEvents || []).map(e => ({
        id                 : e.id,
        dpp_approval_number: e.dpp_approval_number || null,
        dpp_pillar         : e.dpp_pillar || null,
        dpp_pillar_label   : e.dpp_pillar ? this._getDPPPillarLabel(e.dpp_pillar) : null,
        dpp_category       : e.dpp_category || null,
        dpp_category_label : e.dpp_category ? this._getDPPCategoryLabel(e.dpp_category) : null,
        dpp_council_member : e.dpp_council_member || null
      }));

      await this._callEdgeFunction(
        'generate-dpp-report',
        {
          month    : parseInt(String(month)),
          year     : parseInt(String(year)),
          dpp_meta : dppMeta          // extra hint for the edge function
        },
        `DPP_Report_${monthName}_${year}.docx`
      );
      this._showSuccess(`DPP report for ${monthName} ${year} downloaded!`);
      return true;
    } catch (err) {
      console.error('generateDPPReport error:', err);
      this._showError(`Failed to generate DPP report: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     4.  GENERATE AVENUE REPORT  (.docx)
     ============================================================ */
  async generateAvenueReport(avenue, month, year) {
    if (!avenue || !month || !year) {
      throw new Error('avenue, month, and year are required');
    }

    await this.loadSettings();
    const monthName   = this._getMonthName(month);
    const avenueLabel = (typeof AVENUES !== 'undefined' && AVENUES[avenue])
      ? AVENUES[avenue].label
      : avenue.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    this._showProgress(
      `Generating ${avenueLabel} report for ${monthName} ${year}...`
    );

    try {
      await this._callEdgeFunction(
        'generate-avenue-report',
        {
          avenue,
          month: parseInt(String(month)),
          year : parseInt(String(year))
        },
        `${avenueLabel.replace(/\s+/g, '_')}_Report_${monthName}_${year}.docx`
      );
      this._showSuccess(`${avenueLabel} report downloaded!`);
      return true;
    } catch (err) {
      console.error('generateAvenueReport error:', err);
      this._showError(`Failed to generate avenue report: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     5.  GENERATE MEETING AGENDA  (.docx)
     ============================================================ */
  async generateMeetingAgenda(meetingId) {
    if (!meetingId) throw new Error('meetingId is required');

    this._showProgress('Generating meeting agenda...');

    try {
      await this._callEdgeFunction(
        'generate-meeting-agenda',
        { meeting_id: meetingId },
        `Meeting_Agenda_${meetingId}.docx`
      );
      this._showSuccess('Meeting agenda downloaded!');
      return true;
    } catch (err) {
      console.error('generateMeetingAgenda error:', err);
      this._showError(`Failed to generate agenda: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     6.  GENERATE MEETING MINUTES  (.docx)
     ============================================================ */
  async generateMeetingMinutes(meetingId) {
    if (!meetingId) throw new Error('meetingId is required');

    this._showProgress('Generating meeting minutes...');

    try {
      await this._callEdgeFunction(
        'generate-meeting-minutes',
        { meeting_id: meetingId },
        `Meeting_Minutes_${meetingId}.docx`
      );
      this._showSuccess('Meeting minutes downloaded!');
      return true;
    } catch (err) {
      console.error('generateMeetingMinutes error:', err);
      this._showError(`Failed to generate minutes: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     7.  GENERATE ATTENDANCE SHEET  (.docx)
     ============================================================ */
  async generateAttendanceSheet(meetingId) {
    if (!meetingId) throw new Error('meetingId is required');

    this._showProgress('Generating attendance sheet...');

    try {
      await this._callEdgeFunction(
        'generate-meeting-attendance',
        { meeting_id: meetingId },
        `Attendance_Sheet_${meetingId}.docx`
      );
      this._showSuccess('Attendance sheet downloaded!');
      return true;
    } catch (err) {
      console.error('generateAttendanceSheet error:', err);
      this._showError(`Failed to generate attendance sheet: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     8.  GENERATE TREASURY STATEMENT  (.xlsx)  — client-side
         Uses SheetJS (XLSX) directly — no edge function needed.
     ============================================================ */
  async generateTreasuryStatement(fromDate, toDate) {
    if (!fromDate || !toDate) {
      throw new Error('fromDate and toDate are required');
    }

    this._showProgress('Generating treasury statement...');

    try {
      const { data: transactions, error } = await this.db
        .from('treasury_transactions')
        .select('*')
        .gte('transaction_date', fromDate)
        .lte('transaction_date', toDate)
        .order('transaction_date', { ascending: true })
        .order('created_at',      { ascending: true });

      if (error) throw new Error(error.message);

      if (!transactions || transactions.length === 0) {
        this._showError('No transactions found for the selected period');
        throw new Error('No transactions found');
      }

      const totalIncome = transactions
        .filter(t => t.transaction_type === 'income')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

      const totalExpense = transactions
        .filter(t => t.transaction_type === 'expense')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

      // Build rows
      const rows = transactions.map((t, i) => ({
        'S.No'         : i + 1,
        'Date'         : t.transaction_date,
        'Particular'   : t.particular   || '',
        'Category'     : t.category     || '',
        'Voucher No'   : t.voucher_number || '',
        'Income (Rs.)' : t.transaction_type === 'income'
          ? parseFloat(t.amount || 0) : '',
        'Expense (Rs.)': t.transaction_type === 'expense'
          ? parseFloat(t.amount || 0) : '',
        'Balance (Rs.)': parseFloat(t.balance || 0)
      }));

      // Totals row
      rows.push({
        'S.No'         : '',
        'Date'         : '',
        'Particular'   : 'TOTAL',
        'Category'     : '',
        'Voucher No'   : '',
        'Income (Rs.)' : totalIncome,
        'Expense (Rs.)': totalExpense,
        'Balance (Rs.)': parseFloat(transactions[transactions.length - 1].balance || 0)
      });

      if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
          { width: 6  },
          { width: 14 },
          { width: 35 },
          { width: 20 },
          { width: 12 },
          { width: 16 },
          { width: 16 },
          { width: 16 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Treasury Statement');

        const filename =
          `Treasury_Statement_${fromDate}_to_${toDate}.xlsx`;
        XLSX.writeFile(wb, filename);
        this._showSuccess('Treasury statement downloaded!');
      } else {
        // CSV fallback
        const headers = Object.keys(rows[0]);
        const csv = [
          headers.join(','),
          ...rows.map(row =>
            headers.map(h =>
              `"${String(row[h] || '').replace(/"/g, '""')}"`
            ).join(',')
          )
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        this._downloadBlob(
          blob,
          `Treasury_Statement_${fromDate}_to_${toDate}.csv`
        );
        this._showSuccess('Treasury statement (CSV) downloaded!');
      }

      return true;
    } catch (err) {
      console.error('generateTreasuryStatement error:', err);
      this._showError(`Failed to generate statement: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     TREASURY STATEMENT AS WORD / PDF  (cranberry layout)
     ============================================================ */
  async generateTreasuryDocument(fromDate, toDate, format = 'pdf') {
    if (!fromDate || !toDate) throw new Error('fromDate and toDate are required');
    this._showProgress('Generating treasury statement...');
    try {
      await this._callEdgeFunction('treasury', { from_date: fromDate, to_date: toDate },
        `Treasury_Statement_${fromDate}_to_${toDate}`, format === 'docx' ? 'docx' : 'pdf');
      this._showSuccess('Treasury statement downloaded!');
      return true;
    } catch (err) {
      console.error('generateTreasuryDocument error:', err);
      this._showError(`Failed to generate statement: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     COMBINED DOCUMENTS
     ============================================================ */
  async generateMeetingRecord(meetingId) {
    if (!meetingId) throw new Error('meetingId is required');
    this._showProgress('Generating meeting record...');
    try {
      await this._callEdgeFunction('combined_meeting', { meeting_id: meetingId },
        `Meeting_Record_${meetingId}`);
      this._showSuccess('Meeting record (agenda + attendance + minutes) downloaded!');
      return true;
    } catch (err) {
      this._showError(`Failed to generate meeting record: ${err.message}`);
      throw err;
    }
  }

  async generateCombinedAgenda(month, year) {
    if (!month || !year) throw new Error('month and year are required');
    this._showProgress('Generating combined agenda...');
    try {
      await this._callEdgeFunction('combined_agenda', { month, year },
        `Combined_Agenda_${month}_${year}`);
      this._showSuccess('Combined agenda downloaded!');
      return true;
    } catch (err) {
      this._showError(`Failed to generate combined agenda: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     QUICK TREASURY SHORTCUTS
     ============================================================ */
  async downloadCurrentMonthStatement() {
    const now      = new Date();
    const fromDate = `${now.getFullYear()}-${
      String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const toDate   = now.toLocalISODate();
    return await this.generateTreasuryStatement(fromDate, toDate);
  }

  async downloadLastMonthStatement() {
    const now          = new Date();
    const lastMonth    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    return await this.generateTreasuryStatement(
      lastMonth.toLocalISODate(),
      lastMonthEnd.toLocalISODate()
    );
  }

  async downloadCurrentYearStatement() {
    const now = new Date();
    // Rotary year starts July 1
    const rotaryYearStart = now.getMonth() >= 6
      ? `${now.getFullYear()}-07-01`
      : `${now.getFullYear() - 1}-07-01`;
    return await this.generateTreasuryStatement(
      rotaryYearStart,
      now.toLocalISODate()
    );
  }

  async downloadAllTransactionsStatement() {
    return await this.generateTreasuryStatement(
      '2019-01-01',
      new Date().toLocalISODate()
    );
  }

  /* ============================================================
     CHECK EDGE FUNCTION AVAILABILITY
     ============================================================ */
  async checkEdgeFunctions() {
    const functions = [
      'generate-event-report',
      'generate-monthly-report',
      'generate-dpp-report',
      'generate-avenue-report',
      'generate-meeting-agenda',
      'generate-meeting-minutes',
      'generate-meeting-attendance'
    ];

    const results = {};
    for (const fn of functions) {
      try {
        const response = await fetch(`${this.baseUrl}/${fn}`, {
          method : 'OPTIONS',
          headers: this.headers
        });
        results[fn] = response.ok || response.status === 200;
      } catch (e) {
        results[fn] = false;
      }
    }
    return results;
  }

  /* ============================================================
     GENERATE COMBINED MEETING DOCUMENT
     ============================================================ */
  async generateCombinedMeetingDoc(meetingId, type = 'minutes') {
    if (!meetingId) throw new Error('meetingId is required');

    switch (type) {
      case 'agenda':
        return await this.generateMeetingAgenda(meetingId);
      case 'attendance':
        return await this.generateAttendanceSheet(meetingId);
      case 'combined':
        return await this.generateMeetingRecord(meetingId);
      case 'minutes':
      default:
        return await this.generateMeetingMinutes(meetingId);
    }
  }

  /* ============================================================
     HELPER: safe filename
     ============================================================ */
  _safeFilename(name, extension = 'docx') {
    const safe = (name || 'document')
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80);
    return `${safe}.${extension}`;
  }

  /* ============================================================
     HELPER: month name
     ============================================================ */
  _getMonthName(month) {
    if (typeof DateUtils !== 'undefined') {
      return DateUtils.getMonthName(month);
    }
    const names = [
      '', 'January', 'February', 'March',    'April',   'May',      'June',
          'July',    'August',   'September', 'October', 'November', 'December'
    ];
    return names[parseInt(String(month))] || '';
  }

  /* ============================================================
     HELPER: resolve DPP pillar label from key
     ============================================================ */
  _getDPPPillarLabel(key) {
    if (typeof DPP_PILLARS !== 'undefined' && DPP_PILLARS[key]) {
      return DPP_PILLARS[key].label;
    }
    return key
      ? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : '';
  }

  /* ============================================================
     HELPER: resolve DPP category label from key
     ============================================================ */
  _getDPPCategoryLabel(key) {
    if (typeof DPP_CATEGORIES !== 'undefined' && DPP_CATEGORIES[key]) {
      return DPP_CATEGORIES[key].label;
    }
    return key
      ? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : '';
  }
}

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const docGenerator = new DocumentGenerator();
window.docGenerator = docGenerator;

/* ============================================================
   VERIFY SUPABASE CONFIG IS SET
   ============================================================ */
(function verifyDocGenerator() {
  if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL) {
    console.error(
      'DocumentGenerator: SUPABASE_URL is not defined. ' +
      'Make sure config.js is loaded first.'
    );
    return;
  }
  if (typeof SUPABASE_ANON_KEY === 'undefined' || !SUPABASE_ANON_KEY) {
    console.error(
      'DocumentGenerator: SUPABASE_ANON_KEY is not defined. ' +
      'Make sure config.js is loaded first.'
    );
    return;
  }
  console.log(
    '%c DocumentGenerator initialized — using Edge Functions',
    'color:#38A169;font-weight:600;font-size:11px;'
  );
})();
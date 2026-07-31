/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Document Generator - js/document-generator.js
   All DOCX generation via Supabase Edge Functions
   ============================================================ */

'use strict';

class DocumentGenerator {
  constructor() {
    this.db = getSupabaseClient();
    this.baseUrl = `${SUPABASE_URL}/functions/v1`;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY
    };
    this._settings = {};
    this._settingsLoaded = false;
  }

  /* ============================================================
     LOAD SETTINGS (cached)
     ============================================================ */
  async loadSettings() {
    if (this._settingsLoaded) return this._settings;
    try {
      const { data } = await this.db
        .from('club_settings')
        .select('key, value');
      if (data) {
        data.forEach(s => {
          this._settings[s.key] = s.value;
        });
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
  async _callEdgeFunction(functionName, payload, fallbackFilename) {
    const url = `${this.baseUrl}/${functionName}`;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      });
    } catch (networkError) {
      throw new Error(
        `Network error calling ${functionName}: ${networkError.message}. ` +
        `Make sure you are using a local server (not file://) and ` +
        `the edge function is deployed.`
      );
    }

    if (!response.ok) {
      let errorMessage = `Edge function error: HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // could not parse error response
      }
      throw new Error(errorMessage);
    }

    // Check content type — must be DOCX
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('wordprocessingml') &&
        !contentType.includes('octet-stream')) {
      // Maybe it returned JSON error even with 200
      try {
        const maybeError = await response.json();
        if (maybeError.error) {
          throw new Error(maybeError.error);
        }
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) {
          throw e;
        }
      }
    }

    const blob = await response.blob();

    if (!blob || blob.size === 0) {
      throw new Error('Edge function returned empty file');
    }

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition') || '';
    let filename = fallbackFilename;
    const match = contentDisposition.match(/filename="([^"]+)"/);
    if (match && match[1]) {
      filename = match[1];
    }

    // Download using FileSaver or fallback
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
      const a = document.createElement('a');
      a.href = url;
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
     SHOW PROGRESS TOAST
     ============================================================ */
  _showProgress(message) {
    if (window.adminDashboard && window.adminDashboard.showToast) {
      window.adminDashboard.showToast(message, 'info', 3000);
    } else if (window.app && window.app.showToast) {
      window.app.showToast(message, 'info', 3000);
    } else {
      console.log(message);
    }
  }

  _showSuccess(message) {
    if (window.adminDashboard && window.adminDashboard.showToast) {
      window.adminDashboard.showToast(message, 'success');
    } else if (window.app && window.app.showToast) {
      window.app.showToast(message, 'success');
    }
  }

  _showError(message) {
    if (window.adminDashboard && window.adminDashboard.showToast) {
      window.adminDashboard.showToast(message, 'error');
    } else if (window.app && window.app.showToast) {
      window.app.showToast(message, 'error');
    }
  }

  /* ============================================================
     1. GENERATE EVENT REPORT (.docx)
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
     2. GENERATE MONTHLY REPORT (.docx)
     ============================================================ */
  async generateMonthlyReport(month, year) {
    if (!month || !year) throw new Error('month and year are required');

    await this.loadSettings();
    const monthName = DateUtils.getMonthName(parseInt(String(month)));
    this._showProgress(`Generating monthly report for ${monthName} ${year}...`);

    try {
      await this._callEdgeFunction(
        'generate-monthly-report',
        { month: parseInt(String(month)), year: parseInt(String(year)) },
        `Monthly_Report_${monthName}_${year}.docx`
      );
      this._showSuccess(`Monthly report for ${monthName} ${year} downloaded!`);
      return true;
    } catch (err) {
      console.error('generateMonthlyReport error:', err);
      this._showError(`Failed to generate monthly report: ${err.message}`);
      throw err;
    }
  }

  /* ============================================================
     3. GENERATE DPP REPORT (.docx)
     ============================================================ */
  async generateDPPReport(month, year) {
    if (!month || !year) throw new Error('month and year are required');

    await this.loadSettings();
    const monthName = DateUtils.getMonthName(parseInt(String(month)));
    this._showProgress(`Generating DPP report for ${monthName} ${year}...`);

    try {
      await this._callEdgeFunction(
        'generate-dpp-report',
        { month: parseInt(String(month)), year: parseInt(String(year)) },
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
     4. GENERATE AVENUE REPORT (.docx)
     ============================================================ */
  async generateAvenueReport(avenue, month, year) {
    if (!avenue || !month || !year) {
      throw new Error('avenue, month, and year are required');
    }

    await this.loadSettings();
    const monthName = DateUtils.getMonthName(parseInt(String(month)));
    const avenueLabel = (typeof AVENUES !== 'undefined' && AVENUES[avenue])
      ? AVENUES[avenue].label
      : avenue.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    this._showProgress(`Generating ${avenueLabel} report for ${monthName} ${year}...`);

    try {
      await this._callEdgeFunction(
        'generate-avenue-report',
        {
          avenue,
          month: parseInt(String(month)),
          year: parseInt(String(year))
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
     5. GENERATE MEETING AGENDA (.docx)
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
     6. GENERATE MEETING MINUTES (.docx)
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
     7. GENERATE ATTENDANCE SHEET (.docx)
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
     8. GENERATE TREASURY STATEMENT (.xlsx) — Client Side
        (No edge function needed — uses SheetJS directly)
     ============================================================ */
  async generateTreasuryStatement(fromDate, toDate, format = 'excel') {
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
        .order('created_at', { ascending: true });

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
        'S.No': i + 1,
        'Date': t.transaction_date,
        'Particular': t.particular || '',
        'Category': t.category || '',
        'Voucher No': t.voucher_number || '',
        'Income (Rs.)': t.transaction_type === 'income'
          ? parseFloat(t.amount || 0).toFixed(2) : '',
        'Expense (Rs.)': t.transaction_type === 'expense'
          ? parseFloat(t.amount || 0).toFixed(2) : '',
        'Balance (Rs.)': parseFloat(t.balance || 0).toFixed(2)
      }));

      // Totals row
      rows.push({
        'S.No': '',
        'Date': '',
        'Particular': 'TOTAL',
        'Category': '',
        'Voucher No': '',
        'Income (Rs.)': totalIncome.toFixed(2),
        'Expense (Rs.)': totalExpense.toFixed(2),
        'Balance (Rs.)': (totalIncome - totalExpense).toFixed(2)
      });

      if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(rows);

        // Column widths
        ws['!cols'] = [
          { width: 6 },
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

        const filename = `Treasury_Statement_${fromDate}_to_${toDate}.xlsx`;
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
        const filename = `Treasury_Statement_${fromDate}_to_${toDate}.csv`;
        this._downloadBlob(blob, filename);
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
     QUICK TREASURY STATEMENT SHORTCUTS
     ============================================================ */
  async downloadCurrentMonthStatement() {
    const now = new Date();
    const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const toDate = now.toISOString().split('T')[0];
    return await this.generateTreasuryStatement(fromDate, toDate);
  }

  async downloadLastMonthStatement() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const fromDate = lastMonth.toISOString().split('T')[0];
    const toDate = lastMonthEnd.toISOString().split('T')[0];
    return await this.generateTreasuryStatement(fromDate, toDate);
  }

  async downloadCurrentYearStatement() {
    const now = new Date();
    // Rotary year starts July 1
    const rotaryYearStart = now.getMonth() >= 6
      ? `${now.getFullYear()}-07-01`
      : `${now.getFullYear() - 1}-07-01`;
    const toDate = now.toISOString().split('T')[0];
    return await this.generateTreasuryStatement(rotaryYearStart, toDate);
  }

  async downloadAllTransactionsStatement() {
    const fromDate = '2019-01-01';
    const toDate = new Date().toISOString().split('T')[0];
    return await this.generateTreasuryStatement(fromDate, toDate);
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
          method: 'OPTIONS',
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
     (Attendance + Agenda + Minutes in one call)
     ============================================================ */
  async generateCombinedMeetingDoc(meetingId, type = 'minutes') {
    if (!meetingId) throw new Error('meetingId is required');

    switch (type) {
      case 'agenda':
        return await this.generateMeetingAgenda(meetingId);
      case 'attendance':
        return await this.generateAttendanceSheet(meetingId);
      case 'minutes':
      default:
        return await this.generateMeetingMinutes(meetingId);
    }
  }

  /* ============================================================
     HELPER: Get safe filename
     ============================================================ */
  _safeFilename(name, extension = 'docx') {
    const safe = (name || 'document')
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80);
    return `${safe}.${extension}`;
  }

  /* ============================================================
     HELPER: Format month name
     ============================================================ */
  _getMonthName(month) {
    if (typeof DateUtils !== 'undefined') {
      return DateUtils.getMonthName(month);
    }
    const names = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return names[parseInt(String(month))] || '';
  }
}

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const docGenerator = new DocumentGenerator();
window.docGenerator = docGenerator;

/* ============================================================
   VERIFY SUPABASE URL IS SET
   ============================================================ */
(function verifyDocGenerator() {
  if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL) {
    console.error('DocumentGenerator: SUPABASE_URL is not defined. Make sure config.js is loaded first.');
    return;
  }
  if (typeof SUPABASE_ANON_KEY === 'undefined' || !SUPABASE_ANON_KEY) {
    console.error('DocumentGenerator: SUPABASE_ANON_KEY is not defined. Make sure config.js is loaded first.');
    return;
  }
  console.log(
    '%c DocumentGenerator initialized — using Edge Functions',
    'color:#38A169;font-weight:600;font-size:11px;'
  );
})();
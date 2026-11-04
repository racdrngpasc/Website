/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Document Generator - js/document-generator.js
   All DOCX generation via Supabase Edge Functions
   ============================================================ */

'use strict';

/* ============================================================
   LOCAL TREASURY STATEMENT (PDF + Word built in the browser)
   Used automatically when the Supabase "generate-document" function is not the current version
   (or cannot answer), so statements always start from the club's opening balance. Works for every language
   because the browser draws the text. Numbers come from TreasuryLedger — the same source as Excel and the mail.
   ============================================================ */
const LocalStatement = (() => {
  const CRIMSON = '#9C1C42', DARK = '#43061F', PINK = '#FBF1F5', INK = '#2E2327', MUTED = '#7A6670';
  const FONT = '"Segoe UI","Noto Sans","Noto Sans Tamil","Noto Sans Devanagari","Nirmala UI",Roboto,Arial,sans-serif';
  const cur = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dshort = (iso) => { const d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? String(iso || '') : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- tiny ZIP writer (stored, no compression) — enough for a .docx ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    const now = new Date(), time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(f => {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  /* ---------- Word (.docx) ---------- */
  function buildDocx(st, from, to, club) {
    const P = (text, o = {}) => `<w:p><w:pPr><w:spacing w:before="${o.before || 0}" w:after="${o.after || 80}"/>${o.center ? '<w:jc w:val="center"/>' : ''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Nirmala UI" w:eastAsia="Microsoft YaHei"/>${o.bold ? '<w:b/>' : ''}<w:color w:val="${o.color || '2E2327'}"/><w:sz w:val="${o.size || 21}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
    const cell = (text, w, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:tcMar><w:top w:w="50" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>` +
      `<w:p><w:pPr><w:spacing w:after="0"/>${o.right ? '<w:jc w:val="right"/>' : ''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Nirmala UI" w:eastAsia="Microsoft YaHei"/>${o.bold ? '<w:b/>' : ''}<w:color w:val="${o.color || '2E2327'}"/><w:sz w:val="${o.size || 18}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:tc>`;
    const borders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="E8D5DC"/><w:left w:val="single" w:sz="4" w:color="E8D5DC"/><w:bottom w:val="single" w:sz="4" w:color="E8D5DC"/><w:right w:val="single" w:sz="4" w:color="E8D5DC"/><w:insideH w:val="single" w:sz="4" w:color="E8D5DC"/><w:insideV w:val="single" w:sz="4" w:color="E8D5DC"/></w:tblBorders>';
    const widths = [600, 1400, 4600, 1900, 1300, 1500, 1500, 1700];            // 14 500 twips ≈ landscape A4 text width
    const head = ['S.No', 'Date', 'Particular', 'Category', 'Voucher', 'Income', 'Expense', 'Balance'];
    const row = (cells, o = {}) => `<w:tr>${cells.map((c, i) => cell(c, widths[i], { ...o, right: i >= 5 })).join('')}</w:tr>`;
    const sum = [['Opening Balance', cur(st.opening)], ['Total Income', cur(st.income)], ['Total Expense', cur(st.expense)], ['Closing Balance', cur(st.closing)]];
    const sumW = 3400;
    const sumTable = `<w:tbl><w:tblPr><w:tblW w:w="${sumW * 4}" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${sum.map(() => `<w:gridCol w:w="${sumW}"/>`).join('')}</w:tblGrid>` +
      `<w:tr>${sum.map(s => cell(s[0].toUpperCase(), sumW, { fill: 'FBF1F5', bold: true, color: '7A6670', size: 16 })).join('')}</w:tr>` +
      `<w:tr>${sum.map((s, i) => cell(s[1], sumW, { bold: true, size: 26, color: i === 2 ? 'C53030' : i === 1 ? '1F8A5B' : '9C1C42' })).join('')}</w:tr></w:tbl>`;
    const rows = [row(head, { fill: '9C1C42', bold: true, color: 'FFFFFF' })];
    rows.push(row(['', dshort(from), 'Opening Balance b/f' + (st.setting && st.setting.note ? ' — ' + st.setting.note : ''), '', '', '', '', cur(st.opening)], { fill: 'FBF1F5', bold: true }));
    st.rows.forEach((t, i) => {
      const inc = t.transaction_type === 'income', a = parseFloat(t.amount) || 0;
      rows.push(`<w:tr>${[String(i + 1), dshort(t.transaction_date), t.particular || '', t.category || '', t.voucher_number || '', inc ? cur(a) : '', inc ? '' : cur(a), cur(t.balance)]
        .map((c, k) => cell(c, widths[k], { right: k >= 5, fill: i % 2 ? 'FCF8FA' : '', color: k === 5 ? '1F8A5B' : k === 6 ? 'C53030' : '2E2327' })).join('')}</w:tr>`);
    });
    rows.push(row(['', '', 'TOTAL  ·  CLOSING BALANCE', '', '', cur(st.income), cur(st.expense), cur(st.closing)], { fill: 'F3DDE6', bold: true }));
    const table = `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
    const body = P(club, { bold: true, size: 34, color: '9C1C42', center: true, after: 40 }) + P('TREASURY STATEMENT', { bold: true, size: 26, color: '43061F', center: true, after: 40 }) +
      P(`Period: ${dshort(from)} to ${dshort(to)}`, { center: true, color: '7A6670', after: 200 }) + sumTable + P('', { after: 120 }) + table +
      P(`Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, { before: 200, color: '7A6670', size: 16 });
    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="900" w:right="1100" w:bottom="900" w:left="1100" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>` }
    ]).slice(0, undefined, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  /* ---------- PDF: pages drawn on a canvas (any language), packed as JPEG pages ---------- */
  async function buildPdf(st, from, to, club) {
    if (!CanvasRenderingContext2D.prototype.roundRect) {          // older browsers
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
    }
    const W = 1754, H = 1240, M = 70, pages = [];       // A4 landscape @150 dpi
    const cols = [{ k: 'n', w: 70, a: 'l' }, { k: 'd', w: 150, a: 'l' }, { k: 'p', w: 520, a: 'l' }, { k: 'c', w: 210, a: 'l' }, { k: 'v', w: 120, a: 'l' }, { k: 'i', w: 190, a: 'r' }, { k: 'e', w: 190, a: 'r' }, { k: 'b', w: 0, a: 'r' }];
    cols[7].w = W - 2 * M - cols.slice(0, 7).reduce((s, c) => s + c.w, 0);
    let cv, ctx, y;
    const newPage = () => {
      cv = document.createElement('canvas'); cv.width = W; cv.height = H; ctx = cv.getContext('2d'); pages.push(cv);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = CRIMSON; ctx.fillRect(0, 0, W, 14);
      y = 56;
    };
    const wrapText = (t, maxW, font) => { ctx.font = font; const words = String(t || '').split(/\s+/); const lines = []; let cur = ''; words.forEach(w => { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width <= maxW || !cur) cur = test; else { lines.push(cur); cur = w; } }); if (cur) lines.push(cur); return lines.length ? lines : ['']; };
    const header = () => {
      let x = M;
      ctx.fillStyle = DARK; ctx.fillRect(M, y, W - 2 * M, 112);
      ctx.fillStyle = CRIMSON; ctx.fillRect(M, y, 14, 112);
      ctx.fillStyle = '#FFFFFF'; ctx.font = `700 40px ${FONT}`; ctx.fillText(club, M + 40, y + 52);
      ctx.fillStyle = '#FFD98A'; ctx.font = `700 22px ${FONT}`; ctx.fillText('TREASURY STATEMENT', M + 40, y + 88);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `500 24px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`${dshort(from)}  –  ${dshort(to)}`, W - M - 30, y + 88); ctx.textAlign = 'left';
      y += 140;
    };
    const summary = () => {
      const items = [['OPENING BALANCE', st.opening, DARK], ['TOTAL INCOME', st.income, '#1F8A5B'], ['TOTAL EXPENSE', st.expense, '#C53030'], ['CLOSING BALANCE', st.closing, CRIMSON]];
      const gap = 18, w = (W - 2 * M - gap * 3) / 4;
      items.forEach((it, i) => {
        const x = M + i * (w + gap);
        ctx.fillStyle = PINK; ctx.beginPath(); ctx.roundRect(x, y, w, 110, 14); ctx.fill();
        ctx.fillStyle = it[2]; ctx.fillRect(x, y + 14, 6, 82);
        ctx.fillStyle = MUTED; ctx.font = `700 19px ${FONT}`; ctx.fillText(it[0], x + 26, y + 38);
        ctx.fillStyle = it[2]; ctx.font = `800 36px ${FONT}`; ctx.fillText(cur(it[1]), x + 26, y + 84);
      });
      y += 140;
    };
    const tableHead = () => {
      ctx.fillStyle = CRIMSON; ctx.fillRect(M, y, W - 2 * M, 48);
      let x = M; ctx.fillStyle = '#FFFFFF'; ctx.font = `700 21px ${FONT}`;
      ['S.No', 'Date', 'Particular', 'Category', 'Voucher', 'Income', 'Expense', 'Balance'].forEach((h, i) => {
        const c = cols[i]; ctx.textAlign = c.a === 'r' ? 'right' : 'left'; ctx.fillText(h, c.a === 'r' ? x + c.w - 14 : x + 14, y + 32); x += c.w;
      });
      ctx.textAlign = 'left'; y += 48;
    };
    const drawRow = (cells, o = {}) => {
      const font = `${o.bold ? 700 : 500} 21px ${FONT}`;
      const wrapped = cells.map((t, i) => wrapText(t, cols[i].w - 28, font));
      const lines = Math.max(...wrapped.map(w => w.length)), h = lines * 28 + 20;
      if (y + h > H - 90) { footer(); newPage(); tableHead(); }
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(M, y, W - 2 * M, h); }
      ctx.strokeStyle = '#EFE2E8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M, y + h); ctx.lineTo(W - M, y + h); ctx.stroke();
      let x = M; ctx.font = font;
      wrapped.forEach((ws, i) => {
        const c = cols[i]; ctx.fillStyle = i === 5 && o.col ? '#1F8A5B' : i === 6 && o.col ? '#C53030' : INK; ctx.textAlign = c.a === 'r' ? 'right' : 'left';
        ws.forEach((ln, k) => ctx.fillText(ln, c.a === 'r' ? x + c.w - 14 : x + 14, y + 32 + k * 28)); x += c.w;
      });
      ctx.textAlign = 'left'; y += h;
    };
    const footer = () => { ctx.fillStyle = MUTED; ctx.font = `500 18px ${FONT}`; ctx.fillText(`${club}  ·  Treasury Statement`, M, H - 36); };
    newPage(); header(); summary(); tableHead();
    drawRow(['', dshort(from), 'Opening Balance b/f' + (st.setting && st.setting.note ? ' — ' + st.setting.note : ''), '', '', '', '', cur(st.opening)], { bold: true, fill: PINK });
    st.rows.forEach((t, i) => {
      const inc = t.transaction_type === 'income', a = parseFloat(t.amount) || 0;
      drawRow([String(i + 1), dshort(t.transaction_date), t.particular || '', t.category || '', t.voucher_number || '', inc ? cur(a) : '', inc ? '' : cur(a), cur(t.balance)], { col: true, fill: i % 2 ? '#FCF8FA' : '' });
    });
    drawRow(['', '', 'TOTAL  ·  CLOSING BALANCE', '', '', cur(st.income), cur(st.expense), cur(st.closing)], { bold: true, fill: '#F3DDE6', col: true });
    footer();
    pages.forEach((p, i) => { const c = p.getContext('2d'); c.fillStyle = MUTED; c.font = `500 18px ${FONT}`; c.textAlign = 'right'; c.fillText(`Page ${i + 1} of ${pages.length}`, W - M, H - 36); });

    /* assemble a PDF: one JPEG image per page */
    const enc = new TextEncoder(), chunks = [], offsets = []; let len = 0;
    const add = (d) => { const u = typeof d === 'string' ? enc.encode(d) : d; chunks.push(u); len += u.length; };
    const obj = (n, d) => { offsets[n] = len; add(`${n} 0 obj\n`); add(d); add('\nendobj\n'); };
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const jpgs = [];
    for (const p of pages) { const blob = await new Promise(r => p.toBlob(r, 'image/jpeg', 0.88)); jpgs.push(new Uint8Array(await blob.arrayBuffer())); }
    const n = pages.length, pw = 842, ph = Math.round(842 * H / W);
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
    jpgs.forEach((j, i) => {
      const pg = 3 + i * 3, ct = pg + 1, im = pg + 2, content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
      obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Contents ${ct} 0 R /Resources << /XObject << /Im0 ${im} 0 R >> >> >>`);
      obj(ct, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      offsets[im] = len; add(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`); add(j); add('\nendstream\nendobj\n');
    });
    const total = 3 + n * 3, xref = len;
    add(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let i = 1; i < total; i++) add(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  return { buildDocx, buildPdf };
})();
window.LocalStatement = LocalStatement;

/* the edge function answers { version } — anything older (or silent) is treated as outdated */
const DOC_FUNCTION_MIN_VERSION = '2026-11-04';

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
    if (!(await this._serverIsCurrent())) this._warnOutdatedOnce();
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
  /** once per page: tell the admin that the Supabase document function needs updating (non-English PDF text, opening balance …) */
  _warnOutdatedOnce() {
    if (this._warnedOutdated) return; this._warnedOutdated = true;
    try {
      window.adminDashboard?.showToast('Your Supabase document function is outdated: non-English text in PDF reports can show as “?”. Deploy supabase/functions/generate-document (see README). Treasury PDF/Word statements are built in the portal and stay correct.', 'warning', 12000);
    } catch (e) { /* silent */ }
  }

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
      const st = await TreasuryLedger.statement(this.db, fromDate, toDate);
      if (!st.rows.length && !st.opening) {
        this._showError('No transactions found for the selected period');
        throw new Error('No transactions found');
      }
      const club = (typeof CLUB_INFO !== 'undefined' && CLUB_INFO.name) || 'Rotaract Club';
      const aoa  = TreasuryLedger.toSheet(st, fromDate, toDate, club);

      if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ width: 24 }, { width: 14 }, { width: 38 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }];
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Treasury Statement');
        XLSX.writeFile(wb, `Treasury_Statement_${fromDate}_to_${toDate}.xlsx`);
        this._showSuccess('Treasury statement downloaded!');
      } else {
        const csv = '\uFEFF' + aoa.map(r => r.map(c => `"${String(c === undefined || c === null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\n');
        this._downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `Treasury_Statement_${fromDate}_to_${toDate}.csv`);
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
  /** Is the deployed "generate-document" function the current version (opening balance from Site Settings)? Cached per page. */
  async _serverIsCurrent() {
    if (this._fnCurrent !== undefined) return this._fnCurrent;
    try {
      const res = await fetch(`${this.baseUrl}/generate-document`, { method: 'POST', headers: this.headers, body: JSON.stringify({ action: 'version' }) });
      const j = res.ok ? await res.json() : null;
      this._fnCurrent = !!(j && j.version && String(j.version) >= DOC_FUNCTION_MIN_VERSION);
    } catch (e) { this._fnCurrent = false; }
    return this._fnCurrent;
  }

  _downloadBlob(blob, filename) {
    if (typeof saveAs !== 'undefined') { saveAs(blob, filename); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /** PDF / Word statement built in the browser from the shared ledger (opening balance + earlier entries). */
  async _localTreasuryDocument(fromDate, toDate, format) {
    const st = await TreasuryLedger.statement(this.db, fromDate, toDate);
    if (!st.rows.length && !st.opening) throw new Error('No transactions found for the selected period');
    await this.loadSettings();
    const club = (typeof CLUB_INFO !== 'undefined' && CLUB_INFO.name) || 'Rotaract Club';
    const base = `Treasury_Statement_${fromDate}_to_${toDate}`;
    if (format === 'docx') this._downloadBlob(LocalStatement.buildDocx(st, fromDate, toDate, club), `${base}.docx`);
    else this._downloadBlob(await LocalStatement.buildPdf(st, fromDate, toDate, club), `${base}.pdf`);
  }

  async generateTreasuryDocument(fromDate, toDate, format = 'pdf') {
    if (!fromDate || !toDate) throw new Error('fromDate and toDate are required');
    format = format === 'docx' ? 'docx' : 'pdf';
    this._showProgress('Generating treasury statement...');
    try {
      /* the server function must be the current version, otherwise the opening balance would be wrong */
      if (await this._serverIsCurrent()) {
        try {
          await this._callEdgeFunction('treasury', { from_date: fromDate, to_date: toDate },
            `Treasury_Statement_${fromDate}_to_${toDate}`, format);
          this._showSuccess('Treasury statement downloaded!');
          return true;
        } catch (serverError) {
          console.warn('Server statement failed, building it in the browser:', serverError);
        }
      } else {
        console.info('generate-document is not the current version — building the statement in the browser');
      }
      await this._localTreasuryDocument(fromDate, toDate, format);
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

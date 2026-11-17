/* ============================================================
   PAGE INIT
   This code used to sit inline at the bottom of index.html. It is now a
   normal script loaded with `defer` straight after js/app.js, so it still
   runs AFTER the libraries (AOS, Lucide, Supabase, Swiper) and the other
   js files, exactly as before. Keep it last in the script list.
   ============================================================ */
(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────
     1. THEME RESTORE
  ──────────────────────────────────────────────────────────── */
  try {
    var _t = localStorage.getItem('rac_theme');
    if (_t) {
      var _p = JSON.parse(_t);
      if (_p && _p.value) {
        document.documentElement.setAttribute('data-theme', _p.value);
        if (_p.value === 'dark') {
          var _li = document.getElementById('theme-icon-light');
          var _di = document.getElementById('theme-icon-dark');
          if (_li) _li.classList.add('hidden');
          if (_di) _di.classList.remove('hidden');
        }
      }
    }
  } catch (e) { /* ignore */ }

  /* ────────────────────────────────────────────────────────────
     2. AOS + LUCIDE INIT
  ──────────────────────────────────────────────────────────── */
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 800, easing: 'ease-out-cubic', once: true, offset: 60 });
  }
  function RI() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  RI();

  /* ────────────────────────────────────────────────────────────
     3. FOOTER YEAR
  ──────────────────────────────────────────────────────────── */
  var fyEl = document.getElementById('footer-year');
  if (fyEl) fyEl.textContent = new Date().getFullYear();

  /* ────────────────────────────────────────────────────────────
     4. TOAST SYSTEM
  ──────────────────────────────────────────────────────────── */
  var TOAST_COLORS = {
    success: '#2D7A4F',
    error:   '#B3261E',
    info:    '#3B3737',
    warning: '#9A6B12'
  };
  var TOAST_ICONS = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };

  /* inject animation once */
  if (!document.getElementById('_nl_toast_style')) {
    var ts = document.createElement('style');
    ts.id = '_nl_toast_style';
    ts.textContent =
      '@keyframes _nl_toast_in{from{opacity:0;transform:translateX(120%)}to{opacity:1;transform:translateX(0)}}' +
      '#toast-container{position:fixed;top:20px;right:20px;z-index:9999999;display:flex;flex-direction:column;gap:8px;pointer-events:none}' +
      '.nl-toast{pointer-events:all}';
    document.head.appendChild(ts);
  }

  function showToast(msg, type) {
    var tc = document.getElementById('toast-container');
    if (!tc) return;
    var t = document.createElement('div');
    t.className = 'nl-toast';
    t.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:12px 20px;' +
      'border-radius:12px;font-family:Poppins,sans-serif;font-size:.85rem;' +
      'font-weight:500;color:#fff;min-width:250px;max-width:400px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.25);' +
      'animation:_nl_toast_in .35s ease;' +
      'background:' + (TOAST_COLORS[type] || TOAST_COLORS.info) + ';';
    t.innerHTML = (TOAST_ICONS[type] || TOAST_ICONS.info) + '<span>' + escH(msg) + '</span>';
    tc.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .35s,transform .35s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(120%)';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 380);
    }, 4000);
  }

  /* ────────────────────────────────────────────────────────────
     5. URL HELPERS
  ──────────────────────────────────────────────────────────── */
  function detectType(u) {
    if (!u) return 'unknown';
    var l = u.toLowerCase().trim();
    if (l.includes('drive.google.com'))  return 'gdrive';
    if (l.includes('docs.google.com'))   return 'gdocs';
    if (l.endsWith('.pdf') || l.includes('/pdf') ||
        l.includes('type=pdf') || l.includes('.pdf?')) return 'pdf';
    if (l.includes('issuu.com'))         return 'issuu';
    if (l.includes('fliphtml5') || l.includes('flipsnack') || l.includes('anyflip')) return 'flip';
    if (l.includes('canva.com'))         return 'canva';
    if (l.includes('dropbox.com'))       return 'dropbox';
    if (l.includes('onedrive') || l.includes('1drv.ms')) return 'onedrive';
    if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/.test(l)) return 'image';
    return 'link';
  }

  function extractGdriveId(u) {
    if (!u) return null;
    var m = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = u.match(/open\?id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
  }

  function toEmbed(u, t) {
    if (!u) return null;
    u = u.trim();
    if (t === 'gdrive') {
      var id = extractGdriveId(u);
      if (id) return 'https://drive.google.com/file/d/' + id + '/preview';
    }
    if (t === 'gdocs')
      return u.replace(/\/edit.*$/, '/preview').replace(/\/view.*$/, '/preview');
    if (t === 'pdf')
      return 'https://docs.google.com/viewer?url=' + encodeURIComponent(u) + '&embedded=true';
    if (t === 'dropbox')
      return u.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
               .replace('?dl=0', '').replace('?dl=1', '');
    if (t === 'issuu' || t === 'flip' || t === 'canva') return u;
    return null;
  }

  function gdriveThumb(url) {
    var id = extractGdriveId(url);
    if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w600';
    return null;
  }

  /* ────────────────────────────────────────────────────────────
     6. DOWNLOAD ENGINE
  ──────────────────────────────────────────────────────────── */
  function getDownloadUrl(url, type) {
    if (!url) return null;
    url = url.trim();
    if (type === 'gdrive') {
      var id = extractGdriveId(url);
      if (id) return 'https://drive.google.com/uc?export=download&id=' + id;
      return url;
    }
    if (type === 'gdocs') {
      if (url.includes('/document/'))
        return url.replace(/\/(edit|preview).*$/, '') + '/export?format=pdf';
      if (url.includes('/presentation/'))
        return url.replace(/\/(edit|preview).*$/, '') + '/export/pdf';
      if (url.includes('/spreadsheets/'))
        return url.replace(/\/(edit|preview).*$/, '') + '/export?format=pdf';
      return url;
    }
    if (type === 'dropbox')
      return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                .replace(/([?&])dl=0/, '$1dl=1')
                .replace('?dl=0', '?dl=1');
    if (type === 'onedrive')
      return url.replace('redir?', 'download?');
    return url;
  }

  function sanitizeFilename(title) {
    return (title || 'bulletin')
      .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 80);
  }

  /* Set download button to loading state */
  function setDlLoading(loading) {
    var btn = document.getElementById('nl-viewer-dl');
    if (!btn) return;
    if (loading) {
      btn.dataset.origHtml = btn.innerHTML;
      btn.innerHTML =
        '<div class="nlv-spin" style="width:14px;height:14px;border-width:2px;margin:0"></div>' +
        '<span>Downloading…</span>';
      btn.disabled = true;
    } else {
      if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
      btn.disabled = false;
    }
  }

  function triggerLinkDownload(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'bulletin';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 300);
  }

  function downloadFile(originalUrl, title, type) {
    if (!originalUrl) { showToast('No file URL available', 'error'); return; }

    var dlUrl  = getDownloadUrl(originalUrl, type);
    var fname  = sanitizeFilename(title || 'bulletin');

    /* For direct PDF / image files — try fetch → blob first */
    if (type === 'pdf' || type === 'image') {
      setDlLoading(true);
      fetch(dlUrl, { mode: 'cors' })
        .then(function (resp) {
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          return resp.blob();
        })
        .then(function (blob) {
          var ext = '.pdf';
          var ct  = blob.type || '';
          if (ct.includes('png'))  ext = '.png';
          else if (ct.includes('jpeg') || ct.includes('jpg')) ext = '.jpg';
          else if (ct.includes('gif'))  ext = '.gif';
          else if (ct.includes('webp')) ext = '.webp';
          else if (ct.includes('svg'))  ext = '.svg';

          if (typeof saveAs === 'function') {
            saveAs(blob, fname + ext);
          } else {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fname + ext;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
              document.body.removeChild(a);
              URL.revokeObjectURL(a.href);
            }, 200);
          }
          showToast('Download complete!', 'success');
          setDlLoading(false);
        })
        .catch(function (err) {
          console.warn('[NL Download] blob fetch failed:', err.message);
          setDlLoading(false);
          triggerLinkDownload(dlUrl, fname);
          showToast('Download started. Check your browser', 'info');
        });
      return;
    }

    /* Google Drive / Docs — direct export URL */
    if (type === 'gdrive' || type === 'gdocs') {
      triggerLinkDownload(dlUrl, fname);
      showToast('Download started. Check your browser downloads', 'success');
      return;
    }

    /* Dropbox / OneDrive */
    if (type === 'dropbox' || type === 'onedrive') {
      triggerLinkDownload(dlUrl, fname);
      showToast('Download started', 'success');
      return;
    }

    /* Fallback — open in new tab */
    triggerLinkDownload(dlUrl, fname);
    showToast('Opening file for download…', 'info');
  }

  /* Expose globally so inline onclick handlers can call it */
  window.downloadFile = downloadFile;

  /* ────────────────────────────────────────────────────────────
     7. VIEWER MODAL
  ──────────────────────────────────────────────────────────── */
  var _currentFile = null; /* { url, title, type } */
  var _nlvTimer = null;

  /* SVG strings */
  var SVG_OPEN =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>' +
    '<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  var SVG_DL =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>' +
    '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

  function openViewer(data) {
    var url   = ((data.pdf_url || data.file_url || data.url || '')).trim();
    var title = (data.title || 'Bulletin').trim();
    var type  = detectType(url);
    var embed = toEmbed(url, type);

    _currentFile = { url: url, title: title, type: type };

    /* Header title */
    document.getElementById('nl-viewer-title').textContent = title;

    /* Open button */
    var obtn = document.getElementById('nl-viewer-open');
    if (obtn) {
      obtn.href = url || '#';
      obtn.style.display = url ? 'inline-flex' : 'none';
      obtn.innerHTML = SVG_OPEN + '<span>Open</span>';
    }

    /* Download button — wire onclick */
    var dbtn = document.getElementById('nl-viewer-dl');
    if (dbtn) {
      dbtn.style.display = url ? 'inline-flex' : 'none';
      dbtn.innerHTML = SVG_DL + '<span>Download</span>';
      dbtn.disabled  = false;
      dbtn.onclick   = function (e) {
        e.preventDefault();
        if (_currentFile && _currentFile.url) {
          downloadFile(_currentFile.url, _currentFile.title, _currentFile.type);
        } else {
          showToast('No file available to download', 'error');
        }
      };
    }

    /* Content area */
    var body = document.getElementById('nl-viewer-content');
    clearTimeout(_nlvTimer);
    body.innerHTML = '';

    if (type === 'image' && url) {
      var img = document.createElement('img');
      img.src  = url; img.alt = title;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;display:block';
      body.appendChild(img);

    } else if (embed) {
      /* Loader */
      var ld = document.createElement('div');
      ld.className = 'nlv-loader'; ld.id = '_nlvld';
      ld.innerHTML = '<div class="nlv-spin"></div><p>Loading bulletin…</p>';
      body.appendChild(ld);

      /* iframe */
      var ifr = document.createElement('iframe');
      ifr.src   = embed; ifr.title = title; ifr.allowFullscreen = true;
      ifr.setAttribute('loading', 'lazy');
      ifr.setAttribute('sandbox',
        'allow-scripts allow-same-origin allow-forms allow-popups');
      ifr.style.cssText =
        'width:100%;height:100%;border:none;display:block;';
      ifr.addEventListener('load', function () {
        var l = document.getElementById('_nlvld');
        if (l) l.remove();
      });
      body.appendChild(ifr);

      /* 8s fallback */
      clearTimeout(_nlvTimer);
      _nlvTimer = setTimeout(function () {
        var l = document.getElementById('_nlvld');
        if (l) { l.remove(); showExtFallback(body, url, type); }
      }, 8000);

    } else {
      showExtFallback(body, url, type);
    }

    document.getElementById('nl-viewer-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    RI();
  }

  function showExtFallback(body, url, type) {
    var labels = {
      gdrive:'Google Drive', gdocs:'Google Docs', pdf:'PDF',
      issuu:'Issuu', flip:'Flipbook', canva:'Canva',
      dropbox:'Dropbox', onedrive:'OneDrive', link:'Link', unknown:'Document'
    };
    body.innerHTML =
      '<div class="nlv-ext">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      '<h4>' + (labels[type] || 'Document') + '</h4>' +
      '<p>This bulletin cannot be previewed inline.<br>Use the buttons below to access it.</p>' +
      (url ?
        '<a href="' + escA(url) + '" target="_blank" rel="noopener noreferrer" class="nlv-ext-btn">' +
          SVG_OPEN.replace(/width="13"/g,'width="16"').replace(/height="13"/g,'height="16"') +
          ' Open in New Tab' +
        '</a>' +
        '<button type="button" class="nlv-ext-btn is-dark" data-dl="1">' +
          SVG_DL.replace(/width="13"/g,'width="16"').replace(/height="13"/g,'height="16"') +
          ' Download File' +
        '</button>'
      : '') +
      '</div>';
  
    var dlb = body.querySelector('[data-dl]');
    if (dlb) dlb.addEventListener('click', function () {
      downloadFile(url, (_currentFile && _currentFile.title) || 'bulletin', type || 'link');
    });
  }

  function closeViewer() {
    clearTimeout(_nlvTimer);
    var o = document.getElementById('nl-viewer-overlay');
    if (!o) return;
    o.classList.remove('active');
    document.body.style.overflow = '';
    _currentFile = null;
    setTimeout(function () {
      var b = document.getElementById('nl-viewer-content');
      if (b) b.innerHTML = '';
    }, 380);
  }

  /* Viewer controls */
  var closeX = document.getElementById('nl-viewer-x');
  if (closeX) closeX.addEventListener('click', closeViewer);

  var overlay = document.getElementById('nl-viewer-overlay');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeViewer();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeViewer();
  });

  /* Global exposure */
  window.openNewsletterViewer  = openViewer;
  window.closeNewsletterViewer = closeViewer;

  /* ────────────────────────────────────────────────────────────
     8. SVG CONSTANTS FOR CARDS
  ──────────────────────────────────────────────────────────── */
  var SVG_EYE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var SVG_DL_SM =
    '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>' +
    '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var SVG_DOC =
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>' +
    '<polyline points="14 2 14 8 20 8"/>' +
    '<line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  var SVG_CAL =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>' +
    '<line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  var SVG_FILE_SM =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

  var TYPE_LABEL = {
    gdrive:'Google Drive', gdocs:'Google Docs', pdf:'PDF',
    issuu:'Issuu', flip:'Flipbook', canva:'Canva',
    dropbox:'Dropbox', onedrive:'OneDrive', image:'Image',
    link:'Link', unknown:'Link'
  };

  var COLORS = [
    'linear-gradient(135deg,#8E0C45 0%,#E3508F 100%)',
    'linear-gradient(135deg,#262323 0%,#6B6566 100%)',
    'linear-gradient(135deg,#B30F57 0%,#F06FA3 100%)',
    'linear-gradient(135deg,#43061F 0%,#B30F57 100%)',
    'linear-gradient(135deg,#55504F 0%,#9B9596 100%)',
    'linear-gradient(135deg,#690934 0%,#D41367 100%)',
    'linear-gradient(135deg,#151313 0%,#55504F 100%)',
    'linear-gradient(135deg,#D41367 0%,#F6C3D9 100%)'
  ];

  /* ────────────────────────────────────────────────────────────
     9. ESCAPE HELPERS
  ──────────────────────────────────────────────────────────── */
  function escH(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escA(s) { return String(s).replace(/"/g,'&quot;'); }
  /* Escape for single-quoted JS string inside HTML attribute */
  function escJS(s) {
    return String(s)
      .replace(/\\/g,'\\\\')
      .replace(/'/g,"\\'")
      .replace(/\n/g,'\\n')
      .replace(/\r/g,'\\r');
  }

  /* ────────────────────────────────────────────────────────────
     10. RENDER NEWSLETTER CARDS
  ──────────────────────────────────────────────────────────── */
  var _nlBusy = false, _nlDone = false;

  function renderCards(newsletters) {
    _nlBusy = false; _nlDone = true;
    var wrapper     = document.getElementById('newsletters-swiper-wrapper');
    var placeholder = document.getElementById('newsletters-placeholder');
    var loading     = document.getElementById('newsletters-loading');

    if (loading)  loading.style.display = 'none';
    if (!wrapper) return;

    /* Filter published only */
    var pub = newsletters.filter(function (n) {
      return n.is_published === true || n.is_published === 1 || n.is_published === 'true';
    });

    if (!pub.length) {
      wrapper.innerHTML = '';
      if (placeholder) placeholder.style.display = 'block';
      return;
    }
    if (placeholder) placeholder.style.display = 'none';
    wrapper.innerHTML = '';

    /* One delegated listener — titles/URLs never touch inline JS, so quotes can't break buttons */
    if (!wrapper._nlBound) {
      wrapper._nlBound = true;
      wrapper.addEventListener('click', function (e) {
        var b = e.target.closest('[data-nl-action]');
        if (!b) return;
        var sl = b.closest('.swiper-slide');
        if (!sl) return;
        var u = sl.dataset.nlUrl || '', t = sl.dataset.nlTitle || 'Bulletin', ty = sl.dataset.nlType || 'link';
        if (b.dataset.nlAction === 'view') openViewer({ title: t, pdf_url: u });
        else downloadFile(u, t, ty);
      });
    }

    pub.forEach(function (nl, i) {
      /* ── Column mapping ── */
      var url      = (nl.pdf_url || '').trim();
      var title    = (nl.title   || 'Bulletin').trim();
      var month    = nl.month    || '';
      var desc     = nl.description || '';
      var pubAt    = nl.published_at || nl.created_at || '';
      var coverUrl = (nl.cover_image_url || nl.cover_url ||
                      nl.thumbnail_url   || nl.image_url || '').trim();

      /* Auto-thumbnail for Google Drive PDFs if no cover */
      if (!coverUrl && url && detectType(url) === 'gdrive') {
        coverUrl = gdriveThumb(url) || '';
      }

      var hasCover = !!coverUrl;
      var ftype    = detectType(url);
      var color    = COLORS[i % COLORS.length];
      var issueNum = pub.length - i;

      /* Format date */
      var dateStr = '';
      if (pubAt) {
        try { dateStr = new Date(pubAt).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' }); }
        catch (e) { dateStr = pubAt; }
      }

      /* Safe strings for inline onclick attributes */
      var jTitle = escJS(title);
      var jUrl   = escJS(url);
      var jType  = escJS(ftype);

      var slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.dataset.nlUrl   = url;
      slide.dataset.nlTitle = title;
      slide.dataset.nlType  = ftype;

      slide.innerHTML =
        '<div class="nl-card">' +

          /* ── PREVIEW BANNER ── */
          '<div class="nl-preview" style="background:' + color + '">' +

            /* Cover image */
            (hasCover ?
              '<img src="' + escA(coverUrl) + '" alt="' + escA(title) + '" ' +
              'class="nl-preview-cover" loading="lazy" ' +
              'onerror="this.style.display=\'none\';var f=this.parentNode.querySelector(\'.nl-preview-fallback\');if(f)f.classList.remove(\'has-cover\');" />'
            : '') +

            /* Fallback content (shown when no cover) */
            '<div class="nl-preview-fallback' + (hasCover ? ' has-cover' : '') + '">' +
              SVG_DOC +
              '<p class="nl-preview-fallback-title">' + escH(title) + '</p>' +
              (month ? '<p class="nl-preview-fallback-month">' + escH(month) + '</p>' : '') +
            '</div>' +

            /* Gradient overlay on cover */
            (hasCover ? '<div class="nl-preview-overlay"></div>' : '') +

            /* Type badge */
            '<span class="nl-preview-badge">' + SVG_FILE_SM + ' ' + (TYPE_LABEL[ftype] || 'File') + '</span>' +

            /* Issue number badge */
            '<span class="nl-preview-issue">Issue #' + issueNum + '</span>' +

            /* Title on cover */
            (hasCover ?
              '<div class="nl-preview-info">' +
                '<p class="nl-preview-title">' + escH(title) + '</p>' +
                (month ? '<p class="nl-preview-month">' + escH(month) + '</p>' : '') +
              '</div>'
            : '') +

          '</div>' +

          /* ── BODY ── */
          '<div class="nl-body">' +
            '<h4 class="nl-body-title">' + escH(title) + '</h4>' +
            (dateStr ? '<p class="nl-body-meta">' + SVG_CAL + ' ' + dateStr + '</p>' :
              month   ? '<p class="nl-body-meta">' + SVG_CAL + ' ' + escH(month) + '</p>' : '') +
            (desc ? '<p class="nl-body-desc">' + escH(desc) + '</p>' :
              '<div style="flex:1"></div>') +
          '</div>' +

          /* ── ACTION BUTTONS ── */
          '<div class="nl-actions">' +
            (url ?
              /* View button */
              '<button type="button" class="nl-btn nl-btn-view" data-nl-action="view">' +
                SVG_EYE + ' View' +
              '</button>' +
              /* Download button */
              '<button type="button" class="nl-btn nl-btn-dl" data-nl-action="download">' +
                SVG_DL_SM + ' Download' +
              '</button>'
            :
              '<p class="nl-no-url">No file available</p>') +
          '</div>' +

        '</div>';

      wrapper.appendChild(slide);
    });

    /* ── Init / Reinit Swiper ── */
    var sEl = document.querySelector('.newsletters-swiper');
    if (sEl && sEl.swiper) {
      try { sEl.swiper.destroy(true, true); } catch (e) { /* ignore */ }
    }
    if (typeof Swiper !== 'undefined') {
      new Swiper('.newsletters-swiper', {
        slidesPerView: 'auto',
        spaceBetween: 20,
        grabCursor: true,
        centeredSlides: false,
        loop: false,
        rewind: true,
        watchOverflow: true,
        observer: true,
        observeParents: true,
        a11y: { enabled: true },
        pagination: { el: '.newsletters-pagination', clickable: true },
        navigation: { prevEl: '.newsletters-prev', nextEl: '.newsletters-next' },
        breakpoints: {
          320:  { slidesPerView: 1.1,  spaceBetween: 12 },
          480:  { slidesPerView: 1.35, spaceBetween: 14 },
          640:  { slidesPerView: 1.85, spaceBetween: 16 },
          768:  { slidesPerView: 2.2,  spaceBetween: 18 },
          1024: { slidesPerView: 2.8,  spaceBetween: 20 },
          1280: { slidesPerView: 3.3,  spaceBetween: 22 }
        }
      });
    }

    RI();
  }

  /* ────────────────────────────────────────────────────────────
     11. SUPABASE CLIENT HELPER
  ──────────────────────────────────────────────────────────── */
  function getClient() {
    if (window.supabaseClient && window.supabaseClient.from) return window.supabaseClient;
    if (window.supabase && window.supabase.createClient) {
      var url = window.SUPABASE_URL ||
                (window.CONFIG && window.CONFIG.SUPABASE_URL) || null;
      var key = window.SUPABASE_ANON_KEY ||
                (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) || null;
      if (url && key) return window.supabase.createClient(url, key);
    }
    return null;
  }

  /* ────────────────────────────────────────────────────────────
     12. FETCH NEWSLETTERS FROM SUPABASE
  ──────────────────────────────────────────────────────────── */
  function fetchNewsletters(force) {
    if (_nlBusy || (_nlDone && force !== true)) return;   /* never fetch/render twice */
    var loading = document.getElementById('newsletters-loading');
    if (loading) loading.style.display = 'block';

    var sb = getClient();
    if (!sb) {
      console.warn('[Newsletters] Supabase not ready, retrying…');
      setTimeout(fetchNewsletters, 600);
      return;
    }
    _nlBusy = true;

    /* Primary query — with cover_image_url */
    sb.from('newsletters')
      .select('id,title,month,pdf_url,cover_image_url,description,is_published,published_at,created_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .then(function (res) {
        if (res.error) {
          console.warn('[Newsletters] Primary query error, retrying without cover_image_url:', res.error.message);
          /* Fallback without cover_image_url column */
          return sb.from('newsletters')
                   .select('id,title,month,pdf_url,description,is_published,published_at,created_at')
                   .order('created_at', { ascending: false });
        }
        return res;
      })
      .then(function (res) {
        if (res && res.data) {
          console.log('[Newsletters] Loaded', res.data.length, 'bulletins');
          renderCards(res.data);
        } else {
          renderCards([]);
        }
      })
      .catch(function (err) {
        console.error('[Newsletters] Fetch error:', err);
        renderCards([]);
      });
  }

  /* ────────────────────────────────────────────────────────────
     13. RETRY UNTIL CLIENT READY
  ──────────────────────────────────────────────────────────── */
  function tryFetch() {
    if (_nlDone || _nlBusy) return;
    if (getClient()) { fetchNewsletters(); }
    else { setTimeout(tryFetch, 500); }
  }

  /* Expose for other scripts */
  window.fetchNewsletters      = fetchNewsletters;
  window.renderNewsletterCards = renderCards;

  /* Run at multiple points to survive late config loading */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(tryFetch, 400); });
  } else {
    setTimeout(tryFetch, 300);
  }
  window.addEventListener('load', function () { setTimeout(tryFetch, 800); });

  /* ────────────────────────────────────────────────────────────
     14. LOADING SCREEN HIDE
  ──────────────────────────────────────────────────────────── */
  function hideLoader() {
    var s = document.getElementById('loading-screen');
    if (s) s.classList.add('hidden');
  }
  window._ldf = setTimeout(hideLoader, 4000);
  window.addEventListener('load', function () {
    setTimeout(function () { hideLoader(); clearTimeout(window._ldf); }, 600);
  });
  window.addEventListener('error',              hideLoader);
  window.addEventListener('unhandledrejection', hideLoader);
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var s = document.getElementById('loading-screen');
      if (s && !s.classList.contains('hidden')) hideLoader();
    }, 3000);
  });

}());

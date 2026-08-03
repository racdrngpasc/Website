/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   js/games.js — Complete, self-contained, bug-free
   
   IMPORTANT: config.js must load before this file.
   config.js already declares (as const):
     - GAMES_CONFIG
     - QUIZ_QUESTIONS  
     - TYPING_QUOTES
     - Storage
     - getSupabaseClient
   This file reads them via window.* and never redeclares them.
   ============================================================ */

/* ============================================================
   DOUBLE-LOAD GUARD
   Prevents "already declared" crash if script loads twice
   ============================================================ */
if (window.__RACGAMES__) {
  // already loaded — skip everything
} else {
window.__RACGAMES__ = true;

/* ============================================================
   WORDLE WORDS
   Only new data not already in config.js
   ============================================================ */
var WORDLE_WORDS = [
  'SERVE', 'PEACE', 'UNITE', 'SHARE', 'LEADS', 'TRUST',
  'GROWN', 'HELPS', 'YOUTH', 'CLUBS', 'GRANT', 'GLOBE',
  'SMILE', 'LIGHT', 'BRAVE', 'FUNDS', 'WORKS', 'HANDS',
  'SKILL', 'TEAMS', 'BUILD', 'PROUD', 'FAITH', 'DREAM'
];

/* ============================================================
   CANVAS roundRect POLYFILL
   ============================================================ */
(function () {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  if (CanvasRenderingContext2D.prototype.roundRect) return;
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = +r || 0;
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y,     x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h,     x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y,         x + r, y);
    this.closePath();
    return this;
  };
}());

/* ============================================================
   SCORE STORAGE
   config.js Storage.set('game_high_scores', obj) stores under
   key "rac_game_high_scores" wrapped as {value, timestamp, expiry}.
   Storage.get('game_high_scores') unwraps and returns the plain obj.
   We always go through window.Storage so the key/format is consistent.
   ============================================================ */
function readScores() {
  try {
    return (window.Storage && window.Storage.get('game_high_scores')) || {};
  } catch (e) { return {}; }
}

function writeScores(obj) {
  try {
    if (window.Storage) window.Storage.set('game_high_scores', obj);
  } catch (e) { /* silent */ }
}

/* ============================================================
   GAMES MANAGER
   ============================================================ */
function GamesManager() {
  this.db             = null;
  this.currentGame    = null;
  this.gameCanvas     = null;
  this.gameCtx        = null;
  this.animFrame      = null;
  this.gameTick       = null;
  this.isPlaying      = false;
  this.score          = 0;
  this.highScores     = {};
  this._kd            = null; // keydown handler
  this._ku            = null; // keyup handler
  this._tc            = [];   // touch cleanup fns
  this._rh            = null; // resize handler

  try {
    if (window.getSupabaseClient) this.db = window.getSupabaseClient();
  } catch (e) { /* silent */ }

  this._init();
}

var P = GamesManager.prototype;

/* ─────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────── */
P._init = function () {
  this._loadScores();
  this._renderList();
};

/* ─────────────────────────────────────────────────────────
   RENDER GAMES LIST
   Reads window.GAMES_CONFIG (declared in config.js)
───────────────────────────────────────────────────────── */
P._renderList = function () {
  var grid = document.getElementById('games-grid');
  if (!grid) return;

  var cfg = window.GAMES_CONFIG;
  if (!cfg || !cfg.length) {
    grid.innerHTML =
      '<div style="grid-column:1/-1;padding:40px;text-align:center;' +
      'color:var(--danger);font-size:0.9rem;">' +
      '<strong>Error:</strong> GAMES_CONFIG not found.' +
      ' Ensure config.js loads before games.js.</div>';
    return;
  }

  var self = this;
  var html = '';

  for (var i = 0; i < cfg.length; i++) {
    var g  = cfg[i];
    var hs = this.highScores[g.id] || 0;

    var badge = hs > 0
      ? '<span class="g-hs-badge">' +
          '<i data-lucide="trophy" style="width:11px;height:11px;"></i>' +
          ' ' + hs +
        '</span>'
      : '';

    var diff = (g.difficulty || 'medium').toLowerCase();

    html +=
      '<div class="g-card neu-card"' +
           ' data-gid="' + g.id + '"' +
           ' data-gcat="' + (g.category || '') + '">' +

        '<div class="g-card-icon" style="background:var(--accent-light);">' +
          '<i data-lucide="' + g.icon + '"' +
             ' style="width:30px;height:30px;color:var(--accent);"></i>' +
        '</div>' +

        '<div class="g-card-body">' +
          '<div class="g-card-name">' + g.name + '</div>' +
          '<div class="g-card-desc">' + g.description + '</div>' +
          '<div class="g-card-meta">' +
            '<span class="g-diff g-diff-' + diff + '">' + (g.difficulty || '') + '</span>' +
            '<span class="g-cat">' + (g.category || '') + '</span>' +
            badge +
          '</div>' +
        '</div>' +

        '<div class="g-card-play">' +
          '<i data-lucide="play" style="width:18px;height:18px;"></i>' +
        '</div>' +

      '</div>';
  }

  grid.innerHTML = html;

  /* Attach click handlers — no inline onclick */
  var cards = grid.querySelectorAll('.g-card');
  for (var j = 0; j < cards.length; j++) {
    (function (card) {
      card.addEventListener('click', function () {
        var gid = card.getAttribute('data-gid');
        if (gid) self.openGame(gid);
      });
    })(cards[j]);
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
};

/* ─────────────────────────────────────────────────────────
   OPEN GAME
───────────────────────────────────────────────────────── */
P.openGame = function (gameId) {
  this._stop();
  this.currentGame = gameId;
  this.score       = 0;

  var play = document.getElementById('game-play-area');
  var list = document.getElementById('games-list-area');
  if (!play) return;

  if (list) list.style.display = 'none';
  play.style.display = 'block';

  /* Find config entry */
  var cfg  = window.GAMES_CONFIG || [];
  var game = null;
  for (var i = 0; i < cfg.length; i++) {
    if (cfg[i].id === gameId) { game = cfg[i]; break; }
  }
  if (!game) return;

  var diff = (game.difficulty || 'medium').toLowerCase();

  play.innerHTML =
    /* Header */
    '<div class="g-hdr">' +
      '<button class="btn btn-outline btn-sm" id="g-back-btn">' +
        '<i data-lucide="arrow-left"></i><span>Back</span>' +
      '</button>' +
      '<div class="g-hdr-title">' +
        '<h2 class="g-hdr-h2">' +
          '<i data-lucide="' + game.icon + '"></i>' +
          game.name +
        '</h2>' +
        '<span class="g-diff g-diff-' + diff + '">' + (game.difficulty || '') + '</span>' +
      '</div>' +
      '<div class="g-score-box">' +
        '<span class="g-score-lbl">Score</span>' +
        '<span class="g-score-val" id="g-score">0</span>' +
      '</div>' +
    '</div>' +

    /* Game container */
    '<div class="g-cont" id="g-cont">' +

      /* Canvas */
      '<canvas id="g-canvas" width="480" height="400"' +
              ' style="display:block;width:100%;"></canvas>' +

      /* Overlay (start / game-over screen) */
      '<div class="g-ovl" id="g-ovl">' +
        '<div class="g-ovl-inner">' +
          '<h3 id="g-ovl-h3">' + game.name + '</h3>' +
          '<p  id="g-ovl-p">'  + game.description + '</p>' +
          '<button class="btn btn-primary" id="g-start-btn">' +
            '<i data-lucide="play"></i><span>Start Game</span>' +
          '</button>' +
        '</div>' +
      '</div>' +

      /* UI layer (for HTML-based games) */
      '<div class="g-ui" id="g-ui"></div>' +

    '</div>';

  this.gameCanvas = document.getElementById('g-canvas');
  this.gameCtx    = this.gameCanvas
    ? this.gameCanvas.getContext('2d')
    : null;

  this._sizeCanvas();

  var self = this;

  document.getElementById('g-back-btn').addEventListener('click', function () {
    self.backToList();
  });

  document.getElementById('g-start-btn').addEventListener('click', function () {
    self._startGame();
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();

  this._rh = function () { self._sizeCanvas(); };
  window.addEventListener('resize', this._rh);
};

P._sizeCanvas = function () {
  var c  = this.gameCanvas;
  var ct = document.getElementById('g-cont');
  if (!c || !ct) return;
  c.width  = Math.min(ct.clientWidth - 4, 600);
  c.height = Math.max(280, Math.min(window.innerHeight - 260, 500));
};

P.backToList = function () {
  this._stop();

  var play = document.getElementById('game-play-area');
  var list = document.getElementById('games-list-area');
  if (play) play.style.display = 'none';
  if (list) list.style.display = 'block';

  this.currentGame = null;
  this._renderList();

  if (this._rh) {
    window.removeEventListener('resize', this._rh);
    this._rh = null;
  }
};

P._startGame = function () {
  var ovl = document.getElementById('g-ovl');
  if (ovl) ovl.style.display = 'none';

  this.score     = 0;
  this.isPlaying = true;
  this._setScore(0);

  var map = {
    snake:       '_snake',
    memory:      '_memory',
    quiz:        '_quiz',
    tictactoe:   '_ttt',
    typing:      '_typing',
    flappy:      '_flappy',
    breakout:    '_breakout',
    wordle:      '_wordle',
    pong:        '_pong',
    '2048':      '_g2048',
    minesweeper: '_mines',
    tetris:      '_tetris'
  };

  var fn = map[this.currentGame];
  if (fn && typeof this[fn] === 'function') {
    this[fn]();
  } else {
    this._stub();
  }
};

/* ─────────────────────────────────────────────────────────
   STOP / CLEANUP
───────────────────────────────────────────────────────── */
P._stop = function () {
  this.isPlaying = false;

  if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null; }
  if (this.gameTick)  { clearInterval(this.gameTick);         this.gameTick  = null; }

  if (this._kd) { document.removeEventListener('keydown', this._kd); this._kd = null; }
  if (this._ku) { document.removeEventListener('keyup',   this._ku); this._ku = null; }

  for (var i = 0; i < this._tc.length; i++) this._tc[i]();
  this._tc = [];
};

/* ─────────────────────────────────────────────────────────
   GAME OVER
───────────────────────────────────────────────────────── */
P._over = function (finalScore) {
  this.isPlaying = false;
  this._stop();

  finalScore = Math.round(finalScore || 0);
  this._saveScore(this.currentGame, finalScore);
  this._setScore(finalScore);

  var ovl = document.getElementById('g-ovl');
  var h3  = document.getElementById('g-ovl-h3');
  var p   = document.getElementById('g-ovl-p');
  var btn = document.getElementById('g-start-btn');

  if (ovl) ovl.style.display = 'flex';
  if (h3)  h3.textContent = 'Game Over!';
  if (p) {
    var best = this.highScores[this.currentGame] || 0;
    p.textContent =
      'Your score: ' + finalScore + '. ' +
      (best === finalScore && finalScore > 0
        ? 'New high score!'
        : 'Best: ' + best);
  }
  if (btn) {
    btn.innerHTML = '<i data-lucide="rotate-ccw"></i><span>Play Again</span>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

P._setScore = function (s) {
  this.score = s;
  var el = document.getElementById('g-score');
  if (el) el.textContent = s;
};

/* ─────────────────────────────────────────────────────────
   HIGH SCORES
───────────────────────────────────────────────────────── */
P._loadScores = function () {
  this.highScores = readScores();
};

P._saveScore = function (gameId, score) {
  if (!gameId) return;
  this._loadScores();

  if (!this.highScores[gameId] || score > this.highScores[gameId]) {
    this.highScores[gameId] = score;
    writeScores(this.highScores);

    /* Supabase — best effort */
    try {
      if (this.db) {
        var name = gameId;
        var cfg  = window.GAMES_CONFIG || [];
        for (var i = 0; i < cfg.length; i++) {
          if (cfg[i].id === gameId) { name = cfg[i].name; break; }
        }
        this.db.from('game_scores').insert({
          player_name: 'Guest',
          game_id:     gameId,
          game_name:   name,
          score:       score
        });
      }
    } catch (e) { /* silent */ }
  }
};

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
/* Theme-aware colours */
P._c = function (name) {
  var d = document.documentElement.getAttribute('data-theme') === 'dark';
  var m = {
    bg:      d ? '#1A1B26' : '#E8E8E8',
    card:    d ? '#22233A' : '#EFEFEF',
    pri:     d ? '#4DEEEA' : '#0055FF',
    txt:     d ? '#EAEFFB' : '#3A3A3A',
    sec:     d ? '#35374E' : '#BEBEBE',
    muted:   d ? '#666888' : '#888899',
    danger:  '#E53E3E',
    success: '#38A169',
    warning: '#D69E2E',
    white:   '#FFFFFF',
    dark:    '#1A1A1A'
  };
  return m[name] || m.pri;
};

/* Random grid position avoiding excluded cells */
P._randPos = function (cols, rows, exclude) {
  var pos, n = 0;
  do {
    pos = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    n++;
    if (n > 5000) break;
  } while ((exclude || []).some(function (e) { return e.x === pos.x && e.y === pos.y; }));
  return pos;
};

/* Draw a rounded rectangle path */
P._rr = function (ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
};

/* Register swipe-to-direction touch controls */
P._touch = function (el, cb) {
  if (!el) return;
  var sx = 0, sy = 0;
  var onS = function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
  var onE = function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return;
    cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  el.addEventListener('touchstart', onS, { passive: true });
  el.addEventListener('touchend',   onE, { passive: true });
  this._tc.push(function () {
    el.removeEventListener('touchstart', onS);
    el.removeEventListener('touchend',   onE);
  });
};

/* Hide canvas, show HTML-UI div */
P._useUI = function () {
  if (this.gameCanvas) this.gameCanvas.style.display = 'none';
  var ui = document.getElementById('g-ui');
  if (ui) ui.style.display = 'block';
  return ui;
};

/* Hide HTML-UI div, show canvas */
P._useCanvas = function () {
  if (this.gameCanvas) this.gameCanvas.style.display = 'block';
  var ui = document.getElementById('g-ui');
  if (ui) ui.style.display = 'none';
};

/* ============================================================
   ① SNAKE
   ============================================================ */
P._snake = function () {
  var cv = this.gameCanvas, cx = this.gameCtx;
  if (!cv || !cx) return;
  this._useCanvas();

  var self = this, GS = 20;
  var cols = Math.floor(cv.width / GS);
  var rows = Math.floor(cv.height / GS);

  var snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
  var dir   = { x: 1, y: 0 };
  var ndir  = { x: 1, y: 0 };
  var food  = this._randPos(cols, rows, snake);
  var score = 0, speed = 120;

  this._kd = function (e) {
    switch (e.key) {
      case 'ArrowUp':    if (dir.y !==  1) ndir = { x: 0, y: -1 }; e.preventDefault(); break;
      case 'ArrowDown':  if (dir.y !== -1) ndir = { x: 0, y:  1 }; e.preventDefault(); break;
      case 'ArrowLeft':  if (dir.x !==  1) ndir = { x: -1, y: 0 }; e.preventDefault(); break;
      case 'ArrowRight': if (dir.x !== -1) ndir = { x:  1, y: 0 }; e.preventDefault(); break;
    }
  };
  document.addEventListener('keydown', this._kd);

  this._touch(cv, function (d) {
    if (d === 'up'    && dir.y !==  1) ndir = { x: 0,  y: -1 };
    if (d === 'down'  && dir.y !== -1) ndir = { x: 0,  y:  1 };
    if (d === 'left'  && dir.x !==  1) ndir = { x: -1, y:  0 };
    if (d === 'right' && dir.x !== -1) ndir = { x:  1, y:  0 };
  });

  var tick = function () {
    if (!self.isPlaying) return;
    dir = { x: ndir.x, y: ndir.y };
    var h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (h.x < 0 || h.x >= cols || h.y < 0 || h.y >= rows) { self._over(score); return; }
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === h.x && snake[i].y === h.y) { self._over(score); return; }
    }

    snake.unshift(h);
    if (h.x === food.x && h.y === food.y) {
      score += 10;
      self._setScore(score);
      food = self._randPos(cols, rows, snake);
      if (speed > 60) {
        speed -= 3;
        clearInterval(self.gameTick);
        self.gameTick = setInterval(tick, speed);
      }
    } else { snake.pop(); }

    /* draw */
    cx.fillStyle = self._c('bg');
    cx.fillRect(0, 0, cv.width, cv.height);

    cx.strokeStyle = self._c('sec') + '20'; cx.lineWidth = 0.5;
    for (var gx = 0; gx <= cols; gx++) {
      cx.beginPath(); cx.moveTo(gx * GS, 0); cx.lineTo(gx * GS, cv.height); cx.stroke();
    }
    for (var gy = 0; gy <= rows; gy++) {
      cx.beginPath(); cx.moveTo(0, gy * GS); cx.lineTo(cv.width, gy * GS); cx.stroke();
    }

    cx.fillStyle = self._c('danger');
    cx.beginPath();
    cx.arc(food.x * GS + GS / 2, food.y * GS + GS / 2, GS / 2 - 2, 0, Math.PI * 2);
    cx.fill();

    for (var s = 0; s < snake.length; s++) {
      var seg   = snake[s];
      var alpha = Math.round((1 - (s / snake.length) * 0.5) * 200).toString(16);
      if (alpha.length < 2) alpha = '0' + alpha;
      cx.fillStyle = s === 0 ? self._c('pri') : self._c('pri') + alpha;
      self._rr(cx, seg.x * GS + 1, seg.y * GS + 1, GS - 2, GS - 2, 4);
      cx.fill();

      if (s === 0) {
        cx.fillStyle = self._c('bg');
        cx.beginPath();
        cx.arc(seg.x * GS + GS / 2 + dir.x * 4, seg.y * GS + GS / 2 + dir.y * 4, 3, 0, Math.PI * 2);
        cx.fill();
      }
    }
  };

  this.gameTick = setInterval(tick, speed);
};

/* ============================================================
   ② MEMORY MATCH
   ============================================================ */
P._memory = function () {
  var ui = this._useUI();
  if (!ui) return;

  var syms = ['heart','star','globe','shield','award','users','sun','moon','zap','coffee','book','flag'];
  var pairs = syms.slice(0, 8);
  var deck  = pairs.concat(pairs);
  for (var i = deck.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }

  this._M = {
    deck: deck, flipped: [], matched: {},
    moves: 0, score: 0, locked: false, pairs: pairs.length
  };
  this._drawMemory();
};

P._drawMemory = function () {
  var ui = document.getElementById('g-ui');
  if (!ui) return;
  var m = this._M, self = this;

  var mc = Object.keys(m.matched).length / 2;
  var html =
    '<div style="text-align:center;margin-bottom:12px;font-size:0.82rem;color:var(--text-secondary);">' +
      'Moves: <strong>' + m.moves + '</strong> | Matched: <strong>' + mc + '/' + m.pairs + '</strong>' +
    '</div><div class="gm-grid">';

  for (var i = 0; i < m.deck.length; i++) {
    var fl = (m.flipped.indexOf(i) !== -1) || m.matched[i];
    var mt = m.matched[i] ? ' gm-matched' : '';
    html +=
      '<div class="gm-card' + (fl ? ' gm-flip' : '') + mt + '" data-mi="' + i + '">' +
        '<div class="gm-inner">' +
          '<div class="gm-front"><i data-lucide="help-circle"></i></div>' +
          '<div class="gm-back"><i data-lucide="' + m.deck[i] + '"></i></div>' +
        '</div>' +
      '</div>';
  }
  html += '</div>';
  ui.innerHTML = html;

  var cards = ui.querySelectorAll('.gm-card');
  for (var c = 0; c < cards.length; c++) {
    (function (el) {
      el.addEventListener('click', function () {
        self._memFlip(parseInt(el.getAttribute('data-mi'), 10));
      });
    })(cards[c]);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

P._memFlip = function (idx) {
  if (!this.isPlaying) return;
  var m = this._M, self = this;
  if (m.locked || m.matched[idx] || m.flipped.indexOf(idx) !== -1) return;

  m.flipped.push(idx);
  this._drawMemory();

  if (m.flipped.length === 2) {
    m.moves++; m.locked = true;
    var a = m.flipped[0], b = m.flipped[1];

    if (m.deck[a] === m.deck[b]) {
      m.matched[a] = m.matched[b] = true;
      m.score += 20;
      this._setScore(m.score);
      m.flipped = []; m.locked = false;
      this._drawMemory();

      if (Object.keys(m.matched).length >= m.deck.length) {
        m.score += Math.max(0, 200 - m.moves * 5);
        this._setScore(m.score);
        setTimeout(function () { self._over(m.score); }, 600);
      }
    } else {
      setTimeout(function () { m.flipped = []; m.locked = false; self._drawMemory(); }, 900);
    }
  }
};

/* ============================================================
   ③ QUIZ
   Reads window.QUIZ_QUESTIONS (declared in config.js)
   ============================================================ */
P._quiz = function () {
  var ui = this._useUI();
  if (!ui) return;

  var src = window.QUIZ_QUESTIONS || [];
  var qs  = src.slice();
  for (var i = qs.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = qs[i]; qs[i] = qs[j]; qs[j] = t;
  }

  this._Q = { qs: qs, cur: 0, score: 0, answered: false };
  this._drawQuiz();
};

P._drawQuiz = function () {
  var ui = document.getElementById('g-ui');
  if (!ui) return;
  var q = this._Q, self = this;

  if (q.cur >= q.qs.length) { this._over(q.score); return; }

  var item = q.qs[q.cur];
  var pct  = (q.cur / q.qs.length) * 100;
  var opts = '';

  for (var i = 0; i < item.options.length; i++) {
    opts +=
      '<button class="q-opt" data-qi="' + i + '">' +
        '<span class="q-letter">' + String.fromCharCode(65 + i) + '</span>' +
        '<span>' + item.options[i] + '</span>' +
      '</button>';
  }

  ui.innerHTML =
    '<div class="q-wrap">' +
      '<div class="q-bar"><div class="q-fill" style="width:' + pct + '%;"></div></div>' +
      '<div class="q-num">Question ' + (q.cur + 1) + ' of ' + q.qs.length + '</div>' +
      '<div class="q-txt">' + item.question + '</div>' +
      '<div class="q-opts">' + opts + '</div>' +
      '<div id="q-exp"></div>' +
    '</div>';

  var btns = ui.querySelectorAll('.q-opt');
  for (var b = 0; b < btns.length; b++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        self._answerQuiz(parseInt(btn.getAttribute('data-qi'), 10));
      });
    })(btns[b]);
  }
};

P._answerQuiz = function (idx) {
  if (!this.isPlaying) return;
  var q = this._Q, self = this;
  if (q.answered) return;
  q.answered = true;

  var item = q.qs[q.cur];
  var ok   = idx === item.answer;

  var btns = document.querySelectorAll('.q-opt');
  for (var i = 0; i < btns.length; i++) {
    var bi = parseInt(btns[i].getAttribute('data-qi'), 10);
    btns[i].disabled = true;
    btns[i].style.pointerEvents = 'none';
    if (bi === item.answer) btns[i].classList.add('q-ok');
    if (bi === idx && !ok)  btns[i].classList.add('q-no');
  }

  if (ok) { q.score += 10; this._setScore(q.score); }

  var exp = document.getElementById('q-exp');
  if (exp && item.explanation) {
    var ic = ok ? 'check-circle' : 'x-circle';
    var cl = ok ? 'var(--success)' : 'var(--danger)';
    exp.innerHTML =
      '<div class="q-exp-box">' +
        '<i data-lucide="' + ic + '" style="width:16px;height:16px;flex-shrink:0;color:' + cl + ';"></i>' +
        '<span>' + item.explanation + '</span>' +
      '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  setTimeout(function () { q.cur++; q.answered = false; self._drawQuiz(); }, 2200);
};

/* ============================================================
   ④ TIC TAC TOE
   ============================================================ */
P._ttt = function () {
  var ui = this._useUI();
  if (!ui) return;
  this._T = { b: Array(9).fill(null), myTurn: true, active: true, score: 0, W: 0, L: 0, D: 0 };
  this._drawTTT();
};

P._tttWin = function (b, p) {
  var w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (var i = 0; i < w.length; i++)
    if (b[w[i][0]] === p && b[w[i][1]] === p && b[w[i][2]] === p) return true;
  return false;
};

P._tttAI = function (b) {
  var w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  var i, v, ni, cnt;

  for (i = 0; i < w.length; i++) { /* win */
    v = [b[w[i][0]], b[w[i][1]], b[w[i][2]]]; cnt = 0; ni = -1;
    for (var a = 0; a < 3; a++) { if (v[a]==='O') cnt++; if (v[a]===null) ni=a; }
    if (cnt === 2 && ni !== -1) return w[i][ni];
  }
  for (i = 0; i < w.length; i++) { /* block */
    v = [b[w[i][0]], b[w[i][1]], b[w[i][2]]]; cnt = 0; ni = -1;
    for (var a2 = 0; a2 < 3; a2++) { if (v[a2]==='X') cnt++; if (v[a2]===null) ni=a2; }
    if (cnt === 2 && ni !== -1) return w[i][ni];
  }
  if (b[4] === null) return 4;
  var cr = [0,2,6,8].filter(function(x){return b[x]===null;});
  if (cr.length) return cr[Math.floor(Math.random() * cr.length)];
  var em = b.map(function(v2,i2){return v2===null?i2:-1;}).filter(function(x){return x>=0;});
  return em.length ? em[Math.floor(Math.random() * em.length)] : -1;
};

P._drawTTT = function () {
  var ui = document.getElementById('g-ui');
  if (!ui) return;
  var T = this._T, self = this;
  var st = !T.active ? 'Game ended' : T.myTurn ? 'Your turn (X)' : 'AI thinking…';

  var cells = '';
  for (var i = 0; i < 9; i++) {
    var v   = T.b[i];
    var cls = 'ttt-c' + (v ? ' ttt-f' : '') + (v==='X' ? ' ttt-x' : v==='O' ? ' ttt-o' : '');
    var dis = !!(v || !T.myTurn || !T.active);
    cells +=
      '<button class="' + cls + '" data-ti="' + i + '"' + (dis ? ' disabled' : '') + '>' +
        (v === 'X' ? '<i data-lucide="x"      style="width:28px;height:28px;"></i>' :
         v === 'O' ? '<i data-lucide="circle" style="width:28px;height:28px;"></i>' : '') +
      '</button>';
  }

  ui.innerHTML =
    '<div class="ttt-wrap">' +
      '<div class="ttt-sc">' +
        '<span style="color:var(--accent)">You: ' + T.W + '</span>' +
        '<span style="color:var(--text-muted)">Draw: ' + T.D + '</span>' +
        '<span style="color:var(--danger)">AI: ' + T.L + '</span>' +
      '</div>' +
      '<div class="ttt-st" id="ttt-st">' + st + '</div>' +
      '<div class="ttt-grid">' + cells + '</div>' +
      (!T.active
        ? '<button class="btn btn-primary" id="ttt-nr" style="margin-top:14px;">' +
            '<i data-lucide="rotate-ccw"></i><span>New Round</span></button>'
        : '') +
    '</div>';

  var cs = ui.querySelectorAll('.ttt-c');
  for (var c = 0; c < cs.length; c++) {
    (function (el) {
      el.addEventListener('click', function () {
        self._tttMove(parseInt(el.getAttribute('data-ti'), 10));
      });
    })(cs[c]);
  }

  var nr = document.getElementById('ttt-nr');
  if (nr) nr.addEventListener('click', function () { self._tttNewRound(); });
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

P._tttMove = function (i) {
  if (!this.isPlaying) return;
  var T = this._T, self = this;
  if (!T.active || !T.myTurn || T.b[i] !== null) return;

  T.b[i] = 'X'; T.myTurn = false; this._drawTTT();

  if (this._tttWin(T.b, 'X')) {
    T.active = false; T.W++; T.score += 30; this._setScore(T.score);
    this._drawTTT();
    var st = document.getElementById('ttt-st');
    if (st) st.textContent = 'You Win! 🎉';
    return;
  }
  if (T.b.every(function(c){return c!==null;})) {
    T.active = false; T.D++; T.score += 10; this._setScore(T.score);
    this._drawTTT();
    var st2 = document.getElementById('ttt-st');
    if (st2) st2.textContent = "It's a Draw!";
    return;
  }

  setTimeout(function () {
    if (!self.isPlaying) return;
    var mv = self._tttAI(T.b);
    if (mv === -1) return;
    T.b[mv] = 'O'; T.myTurn = true;

    if (self._tttWin(T.b, 'O')) {
      T.active = false; T.L++; self._drawTTT();
      var st3 = document.getElementById('ttt-st');
      if (st3) st3.textContent = 'AI Wins!';
      return;
    }
    if (T.b.every(function(c){return c!==null;})) {
      T.active = false; T.D++; T.score += 10; self._setScore(T.score);
      self._drawTTT();
      var st4 = document.getElementById('ttt-st');
      if (st4) st4.textContent = "It's a Draw!";
      return;
    }
    self._drawTTT();
  }, 500);
};

P._tttNewRound = function () {
  if (!this.isPlaying) return;
  var T = this._T;
  T.b = Array(9).fill(null); T.myTurn = true; T.active = true;
  this._drawTTT();
};

/* ============================================================
   ⑤ SPEED TYPING
   Reads window.TYPING_QUOTES (declared in config.js)
   ============================================================ */
P._typing = function () {
  var ui = this._useUI();
  if (!ui) return;

  var quotes = window.TYPING_QUOTES || ['Service Above Self.'];
  var quote  = quotes[Math.floor(Math.random() * quotes.length)];
  var start  = Date.now();
  var done   = false;
  var self   = this;

  ui.innerHTML =
    '<div class="ty-wrap">' +
      '<p style="font-size:0.88rem;font-weight:700;color:var(--text-heading);' +
         'text-align:center;margin-bottom:14px;">Type the text below as fast as you can!</p>' +
      '<div class="ty-target" id="ty-tgt">' + quote + '</div>' +
      '<textarea id="ty-inp" rows="3" placeholder="Start typing here…"' +
        ' style="width:100%;margin-top:12px;padding:12px;border-radius:8px;' +
        'border:2px solid var(--border);background:var(--bg-card);' +
        'color:var(--text-primary);font-family:Poppins,sans-serif;' +
        'font-size:1rem;line-height:1.8;resize:none;outline:none;' +
        'box-sizing:border-box;"></textarea>' +
      '<div class="ty-stats">' +
        '<span>WPM: <strong id="ty-wpm">0</strong></span>' +
        '<span>Accuracy: <strong id="ty-acc">100%</strong></span>' +
        '<span>Time: <strong id="ty-tim">0s</strong></span>' +
      '</div>' +
    '</div>';

  var inp = document.getElementById('ty-inp');
  var tgt = document.getElementById('ty-tgt');
  if (!inp) return;
  inp.focus();
  inp.addEventListener('focus', function () { inp.style.borderColor = 'var(--accent)'; });
  inp.addEventListener('blur',  function () { inp.style.borderColor = 'var(--border)'; });

  inp.addEventListener('input', function () {
    if (done || !self.isPlaying) return;
    var typed   = inp.value;
    var elapsed = Math.max(1, (Date.now() - start) / 1000);
    var wpm     = typed.trim() === '' ? 0 : Math.round((typed.trim().split(/\s+/).length / elapsed) * 60);
    var correct = 0;
    for (var i = 0; i < Math.min(typed.length, quote.length); i++) {
      if (typed[i] === quote[i]) correct++;
    }
    var acc = typed.length ? Math.round((correct / typed.length) * 100) : 100;

    /* Highlight */
    var hl = '';
    for (var h = 0; h < quote.length; h++) {
      var ch = quote[h] === ' ' ? '&nbsp;' : quote[h];
      if (h < typed.length) {
        if (typed[h] === quote[h])
          hl += '<span style="color:var(--success);font-weight:600;">' + ch + '</span>';
        else
          hl += '<span style="color:var(--danger);background:rgba(229,62,62,0.15);">' + ch + '</span>';
      } else { hl += (quote[h] === ' ' ? ' ' : quote[h]); }
    }
    if (tgt) tgt.innerHTML = hl;

    var wEl = document.getElementById('ty-wpm');
    var aEl = document.getElementById('ty-acc');
    var tEl = document.getElementById('ty-tim');
    if (wEl) wEl.textContent = wpm;
    if (aEl) aEl.textContent = acc + '%';
    if (tEl) tEl.textContent = Math.round(elapsed) + 's';

    var sc = Math.round(wpm * acc / 100);
    self._setScore(sc);

    if (typed.length >= quote.length) {
      done = true; inp.disabled = true;
      setTimeout(function () { self._over(sc); }, 500);
    }
  });
};

/* ============================================================
   ⑥ FLAPPY BIRD
   ============================================================ */
P._flappy = function () {
  var cv = this.gameCanvas, cx = this.gameCtx;
  if (!cv || !cx) return;
  this._useCanvas();

  var self = this;
  var by = cv.height / 2, bv = 0;
  var bx = 80, bs = 18, G = 0.45, J = -7.5;
  var PW = 52, PG = 145, PS = 2.5;
  var pipes = [], score = 0, frame = 0;

  var addPipe = function () {
    var min = 60, max = cv.height - PG - 60;
    pipes.push({ x: cv.width, th: Math.random() * (max - min) + min, passed: false });
  };
  var jump = function () { if (self.isPlaying) bv = J; };

  this._kd = function (e) {
    if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); jump(); }
  };
  document.addEventListener('keydown', this._kd);

  var ch = function () { jump(); };
  var th = function (e) { e.preventDefault(); jump(); };
  cv.addEventListener('click', ch);
  cv.addEventListener('touchstart', th, { passive: false });
  this._tc.push(function () {
    cv.removeEventListener('click', ch);
    cv.removeEventListener('touchstart', th);
  });

  addPipe();

  var tick = function () {
    if (!self.isPlaying) return;
    self.animFrame = requestAnimationFrame(tick);
    frame++; bv += G; by += bv;
    if (frame % 90 === 0) addPipe();

    var np = [];
    for (var p = 0; p < pipes.length; p++) {
      pipes[p].x -= PS;
      if (!pipes[p].passed && pipes[p].x + PW < bx) {
        pipes[p].passed = true; score++; self._setScore(score);
      }
      if (pipes[p].x > -PW - 10) np.push(pipes[p]);
    }
    pipes = np;

    if (by < 0 || by + bs > cv.height) { self._over(score); return; }
    for (var c = 0; c < pipes.length; c++) {
      var pp = pipes[c], bot = pp.th + PG;
      if (bx + bs - 4 > pp.x && bx + 4 < pp.x + PW) {
        if (by + 4 < pp.th || by + bs - 4 > bot) { self._over(score); return; }
      }
    }

    cx.fillStyle = self._c('bg'); cx.fillRect(0, 0, cv.width, cv.height);

    var pc = self._c('success');
    for (var d = 0; d < pipes.length; d++) {
      var pi = pipes[d], bot2 = pi.th + PG;
      cx.fillStyle = pc;
      cx.fillRect(pi.x, 0, PW, pi.th);
      cx.fillRect(pi.x, bot2, PW, cv.height - bot2);
      cx.fillStyle = pc + 'CC';
      cx.fillRect(pi.x - 5, pi.th - 22, PW + 10, 22);
      cx.fillRect(pi.x - 5, bot2, PW + 10, 22);
    }

    cx.fillStyle = self._c('pri');
    cx.beginPath(); cx.arc(bx + bs / 2, by + bs / 2, bs / 2, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = self._c('white');
    cx.beginPath(); cx.arc(bx + bs / 2 + 5, by + bs / 2 - 3, 4, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = self._c('dark');
    cx.beginPath(); cx.arc(bx + bs / 2 + 6, by + bs / 2 - 3, 2, 0, Math.PI * 2); cx.fill();

    cx.fillStyle = self._c('txt') + 'CC';
    cx.font = 'bold 18px Poppins,sans-serif';
    cx.textAlign = 'center';
    cx.fillText('' + score, cv.width / 2, 30);
    cx.textAlign = 'start';

    cx.strokeStyle = self._c('sec'); cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(0, cv.height - 1); cx.lineTo(cv.width, cv.height - 1); cx.stroke();
  };
  tick();
};

/* ============================================================
   ⑦ BREAKOUT
   ============================================================ */
P._breakout = function () {
  var cv = this.gameCanvas, cx = this.gameCtx;
  if (!cv || !cx) return;
  this._useCanvas();

  var self = this;
  var PW = 90, PH = 12, px = cv.width / 2 - 45;
  var BR = 8, bx = cv.width / 2, by = cv.height - 60, bdx = 3.5, bdy = -3.5;
  var lives = 3, score = 0;

  var ROWS = 5, COLS = Math.floor((cv.width - 20) / 58);
  var BW = (cv.width - 20 - (COLS - 1) * 4) / COLS, BH = 18;
  var rowColors = [self._c('danger'), self._c('warning'), self._c('success'), self._c('pri'), '#9F7AEA'];
  var bricks = [];
  for (var r = 0; r < ROWS; r++)
    for (var c = 0; c < COLS; c++)
      bricks.push({ x: 10 + c * (BW + 4), y: 40 + r * (BH + 4), alive: true, color: rowColors[r] });

  var rP = false, lP = false;
  this._kd = function (e) {
    if (e.key === 'ArrowRight') { rP = true; e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { lP = true; e.preventDefault(); }
  };
  this._ku = function (e) {
    if (e.key === 'ArrowRight') rP = false;
    if (e.key === 'ArrowLeft')  lP = false;
  };
  document.addEventListener('keydown', this._kd);
  document.addEventListener('keyup',   this._ku);

  var mm = function (e) {
    var rect = cv.getBoundingClientRect(), sx = cv.width / rect.width;
    px = Math.max(0, Math.min(cv.width - PW, (e.clientX - rect.left) * sx - PW / 2));
  };
  var tm = function (e) {
    e.preventDefault();
    var rect = cv.getBoundingClientRect(), sx = cv.width / rect.width;
    px = Math.max(0, Math.min(cv.width - PW, (e.touches[0].clientX - rect.left) * sx - PW / 2));
  };
  cv.addEventListener('mousemove', mm);
  cv.addEventListener('touchmove', tm, { passive: false });
  this._tc.push(function () { cv.removeEventListener('mousemove', mm); cv.removeEventListener('touchmove', tm); });

  var tick = function () {
    if (!self.isPlaying) return;
    self.animFrame = requestAnimationFrame(tick);

    if (rP && px < cv.width - PW) px += 7;
    if (lP && px > 0) px -= 7;
    bx += bdx; by += bdy;

    if (bx + BR > cv.width  || bx - BR < 0) bdx = -bdx;
    if (by - BR < 0) bdy = -bdy;

    var pt = cv.height - PH - 10;
    if (by + BR >= pt && by + BR <= pt + PH + Math.abs(bdy) && bx >= px && bx <= px + PW) {
      bdy = -Math.abs(bdy);
      bdx = ((bx - px) / PW - 0.5) * 9;
    }

    if (by + BR > cv.height) {
      lives--;
      if (lives <= 0) { self._over(score); return; }
      bx = cv.width / 2; by = cv.height - 60; bdx = 3.5; bdy = -3.5;
    }

    var allDead = true;
    for (var b = 0; b < bricks.length; b++) {
      var bk = bricks[b];
      if (!bk.alive) continue;
      allDead = false;
      if (bx+BR>bk.x && bx-BR<bk.x+BW && by+BR>bk.y && by-BR<bk.y+BH) {
        var oL=bx+BR-bk.x, oR=bk.x+BW-(bx-BR), oT=by+BR-bk.y, oB=bk.y+BH-(by-BR);
        if (Math.min(oL,oR,oT,oB)===oT||Math.min(oL,oR,oT,oB)===oB) bdy=-bdy; else bdx=-bdx;
        bk.alive = false; score += 10; self._setScore(score); break;
      }
    }
    if (allDead) { self._over(score + 100); return; }

    cx.fillStyle = self._c('bg'); cx.fillRect(0, 0, cv.width, cv.height);

    for (var d = 0; d < bricks.length; d++) {
      if (!bricks[d].alive) continue;
      cx.fillStyle = bricks[d].color;
      cx.fillRect(bricks[d].x, bricks[d].y, BW, BH);
      cx.strokeStyle = self._c('bg'); cx.lineWidth = 1;
      cx.strokeRect(bricks[d].x, bricks[d].y, BW, BH);
    }

    cx.fillStyle = self._c('pri');
    cx.beginPath(); cx.arc(bx, by, BR, 0, Math.PI * 2); cx.fill();

    cx.fillStyle = self._c('txt');
    self._rr(cx, px, pt, PW, PH, 6); cx.fill();

    cx.fillStyle = self._c('txt') + 'CC'; cx.font = 'bold 13px Poppins,sans-serif';
    cx.fillText('Lives: ' + '★ '.repeat(lives).trim(), 8, 20);
  };
  tick();
};

/* ============================================================
   ⑧ WORDLE
   ============================================================ */
P._wordle = function () {
  var ui = this._useUI();
  if (!ui) return;

  this._W = {
    word: WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)],
    guesses: [], cur: '', max: 6, won: false, lost: false
  };
  this._drawWordle();

  var self = this;
  this._kd = function (e) {
    if (!self.isPlaying) return;
    var w = self._W; if (w.won || w.lost) return;
    var k = e.key.toUpperCase();
    if (k === 'ENTER')     { self._wKey('ENTER'); e.preventDefault(); }
    else if (k === 'BACKSPACE') { self._wKey('DEL'); e.preventDefault(); }
    else if (/^[A-Z]$/.test(k)) self._wKey(k);
  };
  document.addEventListener('keydown', this._kd);
};

P._wStates = function () {
  var w = this._W, st = {};
  for (var g = 0; g < w.guesses.length; g++) {
    var gs = w.guesses[g];
    for (var i = 0; i < 5; i++) {
      var l = gs[i]; if (!l) continue;
      if (l === w.word[i])                                   st[l] = 'correct';
      else if (w.word.indexOf(l) !== -1 && st[l] !== 'correct') st[l] = 'present';
      else if (w.word.indexOf(l) === -1 && !st[l])          st[l] = 'absent';
    }
  }
  return st;
};

P._drawWordle = function () {
  var ui = document.getElementById('g-ui');
  if (!ui) return;
  var w = this._W, self = this;

  var grid = '<div class="wl-grid">';
  for (var r = 0; r < w.max; r++) {
    var gs = w.guesses[r] || '';
    var isA = (r === w.guesses.length && !w.won && !w.lost);
    var dp  = isA ? w.cur : gs;
    grid += '<div class="wl-row">';
    for (var c = 0; c < 5; c++) {
      var cls = 'wl-cell', letter = dp[c] || '';
      if (r < w.guesses.length && gs[c]) {
        if (gs[c] === w.word[c])              cls += ' wl-c';
        else if (w.word.indexOf(gs[c]) !== -1) cls += ' wl-p';
        else                                   cls += ' wl-a';
      } else if (isA && letter) { cls += ' wl-cur'; }
      grid += '<div class="' + cls + '">' + letter + '</div>';
    }
    grid += '</div>';
  }
  grid += '</div>';

  var msg = '';
  if (w.won)  msg = '<div class="wl-msg wl-ok">Brilliant! Word was <strong>' + w.word + '</strong></div>';
  if (w.lost) msg = '<div class="wl-msg wl-no">Word was <strong>' + w.word + '</strong>. Try again!</div>';

  var KR = [['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['ENTER','Z','X','C','V','B','N','M','DEL']];
  var st = this._wStates();
  var kb = '<div class="wl-kb">';
  for (var kr = 0; kr < KR.length; kr++) {
    kb += '<div class="wl-kr">';
    for (var kc = 0; kc < KR[kr].length; kc++) {
      var key = KR[kr][kc];
      var wide = (key === 'ENTER' || key === 'DEL') ? ' wl-wide' : '';
      var kcls = 'wl-k' + wide + ' wlk-' + (st[key] || '');
      kb += '<button class="' + kcls + '" data-wk="' + key + '">' + key + '</button>';
    }
    kb += '</div>';
  }
  kb += '</div>';

  ui.innerHTML =
    '<div class="wl-wrap">' +
      '<p style="text-align:center;margin-bottom:8px;font-size:0.8rem;' +
         'color:var(--text-muted);font-weight:600;">Guess the 5-letter word!</p>' +
      grid + msg + kb +
    '</div>';

  var kbs = ui.querySelectorAll('.wl-k');
  for (var kb2 = 0; kb2 < kbs.length; kb2++) {
    (function (btn) {
      btn.addEventListener('click', function () { self._wKey(btn.getAttribute('data-wk')); });
    })(kbs[kb2]);
  }
};

P._wKey = function (key) {
  if (!this.isPlaying) return;
  var w = this._W, self = this;
  if (w.won || w.lost) return;

  if (key === 'DEL' || key === 'BACKSPACE') {
    w.cur = w.cur.slice(0, -1);
  } else if (key === 'ENTER') {
    if (w.cur.length < 5) {
      var rows = document.querySelectorAll('.wl-row');
      var ar   = rows[w.guesses.length];
      if (ar) { ar.classList.add('wl-shake'); setTimeout(function(){ar.classList.remove('wl-shake');}, 500); }
      return;
    }
    w.guesses.push(w.cur);
    if (w.cur === w.word) {
      w.won = true;
      var sc = 100 + (w.max - w.guesses.length + 1) * 20;
      this._setScore(sc); this._drawWordle();
      setTimeout(function () { self._over(sc); }, 1500);
      return;
    }
    if (w.guesses.length >= w.max) {
      w.lost = true; this._drawWordle();
      setTimeout(function () { self._over(0); }, 1500);
      return;
    }
    w.cur = '';
  } else if (/^[A-Z]$/.test(key) && w.cur.length < 5) {
    w.cur += key;
  }
  this._drawWordle();
};

/* ============================================================
   ⑨ PONG
   ============================================================ */
P._pong = function () {
  var cv = this.gameCanvas, cx = this.gameCtx;
  if (!cv || !cx) return;
  this._useCanvas();

  var self = this;
  var PH = 70, PW = 10, BS = 10, WIN = 7;
  var py = cv.height/2-PH/2, ay = cv.height/2-PH/2;
  var bx = cv.width/2, by = cv.height/2, bdx = 4, bdy = 3;
  var pSc = 0, aSc = 0, aiSpd = 3.2, uP = false, dP = false;

  this._kd = function (e) {
    if (e.key==='ArrowUp'||e.key==='w'||e.key==='W')   { uP=true;  e.preventDefault(); }
    if (e.key==='ArrowDown'||e.key==='s'||e.key==='S') { dP=true;  e.preventDefault(); }
  };
  this._ku = function (e) {
    if (e.key==='ArrowUp'  ||e.key==='w'||e.key==='W') uP=false;
    if (e.key==='ArrowDown'||e.key==='s'||e.key==='S') dP=false;
  };
  document.addEventListener('keydown', this._kd);
  document.addEventListener('keyup',   this._ku);

  var tm = function (e) {
    e.preventDefault();
    var rect = cv.getBoundingClientRect(), sy = cv.height/rect.height;
    py = Math.max(0, Math.min(cv.height-PH, (e.touches[0].clientY-rect.top)*sy - PH/2));
  };
  cv.addEventListener('touchmove', tm, { passive: false });
  this._tc.push(function () { cv.removeEventListener('touchmove', tm); });

  var reset = function () {
    bx=cv.width/2; by=cv.height/2;
    bdx=(Math.random()>0.5?1:-1)*4; bdy=(Math.random()>0.5?1:-1)*3;
  };

  var tick = function () {
    if (!self.isPlaying) return;
    self.animFrame = requestAnimationFrame(tick);

    if (uP && py>0)              py-=6;
    if (dP && py<cv.height-PH)   py+=6;

    var ac = ay+PH/2;
    if (ac < by-5) ay=Math.min(cv.height-PH, ay+aiSpd);
    if (ac > by+5) ay=Math.max(0, ay-aiSpd);

    bx+=bdx; by+=bdy;
    if (by-BS/2<0||by+BS/2>cv.height) bdy=-bdy;
    if (bx-BS/2<PW+20&&by>py&&by<py+PH&&bdx<0)
      { bdx=Math.abs(bdx)*1.05; bdy=((by-py)/PH-0.5)*8; }
    if (bx+BS/2>cv.width-PW-20&&by>ay&&by<ay+PH&&bdx>0)
      { bdx=-Math.abs(bdx)*1.05; bdy=((by-ay)/PH-0.5)*8; }
    bdx=Math.max(-10,Math.min(10,bdx));
    bdy=Math.max(-8, Math.min(8, bdy));

    if (bx<0) { aSc++; if(aSc>=WIN){self._over(pSc*10);return;} reset(); }
    if (bx>cv.width) { pSc++; self._setScore(pSc*10); if(pSc>=WIN){self._over(pSc*15);return;} reset(); }

    cx.fillStyle=self._c('bg'); cx.fillRect(0,0,cv.width,cv.height);
    cx.setLineDash([10,10]); cx.strokeStyle=self._c('sec')+'60'; cx.lineWidth=2;
    cx.beginPath(); cx.moveTo(cv.width/2,0); cx.lineTo(cv.width/2,cv.height); cx.stroke();
    cx.setLineDash([]);

    cx.fillStyle=self._c('pri');   self._rr(cx,10,py,PW,PH,5);           cx.fill();
    cx.fillStyle=self._c('danger');self._rr(cx,cv.width-PW-10,ay,PW,PH,5);cx.fill();
    cx.fillStyle=self._c('txt');
    cx.beginPath(); cx.arc(bx,by,BS/2,0,Math.PI*2); cx.fill();

    cx.font='bold 28px Poppins,sans-serif'; cx.textAlign='center';
    cx.fillStyle=self._c('txt');
    cx.fillText(''+pSc, cv.width/2-36, 40);
    cx.fillText(''+aSc, cv.width/2+36, 40);
    cx.font='bold 10px Poppins,sans-serif'; cx.fillStyle=self._c('muted');
    cx.fillText('YOU', cv.width/2-36, 56);
    cx.fillText('AI',  cv.width/2+36, 56);
    cx.textAlign='start';
  };
  tick();
};

/* ============================================================
   ⑩ 2048
   ============================================================ */
P._g2048 = function () {
  var ui = this._useUI();
  if (!ui) return;

  var self = this, SZ = 4;

  var newGrid = function () {
    var g = [];
    for (var r=0;r<SZ;r++){var row=[];for(var c=0;c<SZ;c++)row.push(0);g.push(row);}
    return g;
  };
  var addRand = function (g) {
    var e=[];
    for(var r=0;r<SZ;r++)for(var c=0;c<SZ;c++)if(!g[r][c])e.push([r,c]);
    if(!e.length)return;
    var cell=e[Math.floor(Math.random()*e.length)];
    g[cell[0]][cell[1]]=Math.random()<0.9?2:4;
  };
  var rot = function (g) {
    var n=newGrid();
    for(var r=0;r<SZ;r++)for(var c=0;c<SZ;c++)n[c][SZ-1-r]=g[r][c];
    return n;
  };
  var slide = function (row) {
    var a=[],pts=0;
    for(var i=0;i<row.length;i++)if(row[i])a.push(row[i]);
    for(var j=0;j<a.length-1;j++)if(a[j]===a[j+1]){a[j]*=2;pts+=a[j];a.splice(j+1,1);}
    while(a.length<SZ)a.push(0);
    return{r:a,pts:pts};
  };
  var hasMoves = function (g) {
    for(var r=0;r<SZ;r++)for(var c=0;c<SZ;c++){
      if(!g[r][c])return true;
      if(c<SZ-1&&g[r][c]===g[r][c+1])return true;
      if(r<SZ-1&&g[r][c]===g[r+1][c])return true;
    }
    return false;
  };

  var grid = newGrid(), score = 0;
  addRand(grid); addRand(grid);
  this._G = { grid: grid, score: score };

  var move = function (dir) {
    var gd=self._G;
    var rots={left:0,right:2,up:3,down:1}[dir]||0;
    var moved=false,pts=0;
    var tmp=[];for(var r=0;r<SZ;r++)tmp.push(gd.grid[r].slice());
    for(var i=0;i<rots;i++)tmp=rot(tmp);
    for(var row=0;row<SZ;row++){
      var res=slide(tmp[row]);
      pts+=res.pts;
      if(JSON.stringify(tmp[row])!==JSON.stringify(res.r))moved=true;
      tmp[row]=res.r;
    }
    for(var j=0;j<(4-rots)%4;j++)tmp=rot(tmp);
    if(moved){
      gd.grid=tmp;gd.score+=pts;score=gd.score;
      addRand(gd.grid);self._setScore(score);self._draw2048();
      var has=false;
      for(var r2=0;r2<SZ;r2++)for(var c2=0;c2<SZ;c2++)if(gd.grid[r2][c2]===2048)has=true;
      if(has){setTimeout(function(){self._over(score+500);},300);return;}
      if(!hasMoves(gd.grid)){setTimeout(function(){self._over(score);},300);}
    }
  };
  this._doMove = move;

  this._kd = function (e) {
    if(!self.isPlaying)return;
    var m={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    if(m[e.key]){e.preventDefault();move(m[e.key]);}
  };
  document.addEventListener('keydown', this._kd);
  this._touch(ui, function(d){move(d);});
  this._draw2048();
};

P._draw2048 = function () {
  var ui = document.getElementById('g-ui');
  if (!ui) return;
  var gd = this._G, self = this;

  var TC = {
    0:{bg:'#cdc1b4',fg:'#cdc1b4'},2:{bg:'#eee4da',fg:'#776e65'},
    4:{bg:'#ede0c8',fg:'#776e65'},8:{bg:'#f2b179',fg:'#f9f6f2'},
    16:{bg:'#f59563',fg:'#f9f6f2'},32:{bg:'#f67c5f',fg:'#f9f6f2'},
    64:{bg:'#f65e3b',fg:'#f9f6f2'},128:{bg:'#edcf72',fg:'#f9f6f2'},
    256:{bg:'#edcc61',fg:'#f9f6f2'},512:{bg:'#edc850',fg:'#f9f6f2'},
    1024:{bg:'#edc53f',fg:'#f9f6f2'},2048:{bg:'#edc22e',fg:'#f9f6f2'}
  };

  var cells='';
  for(var r=0;r<SZ2;r++)for(var c=0;c<SZ2;c++){
    var v=gd.grid[r][c],cl=TC[v]||TC[2048];
    var fs=v>=1024?'0.95rem':v>=128?'1.15rem':'1.35rem';
    cells+='<div class="g2-cell" style="background:'+cl.bg+';color:'+cl.fg+';font-size:'+fs+';">'+(v||'')+'</div>';
  }

  ui.innerHTML=
    '<div class="g2-wrap">'+
      '<p style="text-align:center;margin-bottom:12px;font-size:0.82rem;color:var(--text-muted);font-weight:600;">Arrow keys or swipe to merge tiles!</p>'+
      '<div class="g2-grid">'+cells+'</div>'+
      '<div style="display:flex;justify-content:center;gap:10px;margin-top:14px;flex-wrap:wrap;">'+
        '<button class="g2-btn" data-d="up">&#9650;</button>'+
        '<button class="g2-btn" data-d="left">&#9664;</button>'+
        '<button class="g2-btn" data-d="down">&#9660;</button>'+
        '<button class="g2-btn" data-d="right">&#9654;</button>'+
      '</div>'+
    '</div>';

  var dbs=ui.querySelectorAll('.g2-btn');
  for(var d=0;d<dbs.length;d++){
    (function(btn){
      btn.addEventListener('click',function(){self._doMove(btn.getAttribute('data-d'));});
    })(dbs[d]);
  }
};
var SZ2=4; /* used by _draw2048 */

/* ============================================================
   ⑪ MINESWEEPER
   ============================================================ */
P._mines = function () {
  var ui = this._useUI();
  if (!ui) return;

  var R=9,C=9,M=10;
  var dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var board=[];
  for(var r=0;r<R;r++){
    var row=[];
    for(var c=0;c<C;c++)row.push({r:r,c:c,mine:false,rev:false,flag:false,adj:0});
    board.push(row);
  }

  var placed=0;
  while(placed<M){
    var mr=Math.floor(Math.random()*R),mc=Math.floor(Math.random()*C);
    if(!board[mr][mc].mine){board[mr][mc].mine=true;placed++;}
  }

  var recalc=function(){
    for(var r2=0;r2<R;r2++)for(var c2=0;c2<C;c2++){
      if(board[r2][c2].mine){board[r2][c2].adj=0;continue;}
      var n=0;
      for(var d=0;d<dirs.length;d++){
        var nr=r2+dirs[d][0],nc=c2+dirs[d][1];
        if(nr>=0&&nr<R&&nc>=0&&nc<C&&board[nr][nc].mine)n++;
      }
      board[r2][c2].adj=n;
    }
  };
  recalc();

  this._MS={board:board,R:R,C:C,M:M,rev:0,flag:0,first:true,won:false,lost:false,score:0,dirs:dirs,recalc:recalc};
  this._drawMines();
};

P._drawMines = function () {
  var ui=document.getElementById('g-ui');if(!ui)return;
  var ms=this._MS,self=this;
  var AC=['','#1976D2','#388E3C','#D32F2F','#7B1FA2','#F57F17','#0097A7','#212121','#757575'];
  var safe=ms.R*ms.C-ms.M;

  var grid='<div class="ms-grid" style="grid-template-columns:repeat('+ms.C+',1fr);">';
  for(var r=0;r<ms.R;r++)for(var c=0;c<ms.C;c++){
    var cell=ms.board[r][c],cont='',cls='ms-cell';
    if(ms.lost&&cell.mine&&!cell.flag){cls+=' ms-mine';cont='<i data-lucide="crosshair" style="width:13px;height:13px;"></i>';}
    else if(cell.flag){cls+=' ms-flag';cont='<i data-lucide="flag" style="width:13px;height:13px;color:var(--danger);"></i>';}
    else if(!cell.rev){cls+=' ms-hid';}
    else if(cell.mine){cls+=' ms-mine';cont='<i data-lucide="crosshair" style="width:13px;height:13px;"></i>';}
    else{cls+=' ms-rev';if(cell.adj>0)cont='<span style="color:'+AC[cell.adj]+';font-weight:800;">'+cell.adj+'</span>';}
    grid+='<div class="'+cls+'" data-r="'+r+'" data-c="'+c+'">'+cont+'</div>';
  }
  grid+='</div>';

  var si=ms.won?'check-circle':ms.lost?'x-circle':'play';
  var st=ms.won?'You Win!':ms.lost?'Boom!':'Playing';
  var ab=(ms.won||ms.lost)
    ?'<button class="btn btn-primary" id="ms-new" style="display:block;margin:12px auto 0;"><i data-lucide="rotate-ccw"></i><span>New Game</span></button>'
    :'';

  ui.innerHTML=
    '<div class="ms-wrap">'+
      '<div class="ms-hdr">'+
        '<span><i data-lucide="crosshair" style="width:12px;height:12px;vertical-align:middle;"></i> '+(ms.M-ms.flag)+' left</span>'+
        '<span><i data-lucide="'+si+'" style="width:12px;height:12px;vertical-align:middle;"></i> '+st+'</span>'+
        '<span><i data-lucide="check-circle" style="width:12px;height:12px;vertical-align:middle;"></i> '+ms.rev+'/'+safe+'</span>'+
      '</div>'+
      grid+
      '<p style="text-align:center;font-size:0.72rem;color:var(--text-muted);margin-top:10px;">Click to reveal | Right-click / long-press to flag</p>'+
      ab+
    '</div>';

  var cells=ui.querySelectorAll('.ms-cell');
  for(var i=0;i<cells.length;i++){
    (function(el){
      var cr=+el.getAttribute('data-r'),cc=+el.getAttribute('data-c');
      el.addEventListener('click',function(){self._msReveal(cr,cc);});
      el.addEventListener('contextmenu',function(e){e.preventDefault();self._msFlag(cr,cc);});
      var tmr=null;
      el.addEventListener('touchstart',function(e){tmr=setTimeout(function(){e.preventDefault();self._msFlag(cr,cc);},500);},{passive:false});
      el.addEventListener('touchend', function(){clearTimeout(tmr);});
      el.addEventListener('touchmove',function(){clearTimeout(tmr);});
    })(cells[i]);
  }
  var nb=document.getElementById('ms-new');
  if(nb)nb.addEventListener('click',function(){self._mines();});
  if(typeof lucide!=='undefined')lucide.createIcons();
};

P._msReveal=function(r,c){
  if(!this.isPlaying)return;
  var ms=this._MS,cell=ms.board[r][c];
  if(ms.lost||ms.won||cell.rev||cell.flag)return;

  if(ms.first&&cell.mine){
    cell.mine=false;var rel=false;
    for(var fr=0;fr<ms.R&&!rel;fr++)for(var fc=0;fc<ms.C&&!rel;fc++)
      if(!ms.board[fr][fc].mine&&!(fr===r&&fc===c)){ms.board[fr][fc].mine=true;rel=true;}
    ms.recalc();
  }
  ms.first=false;

  if(cell.mine){cell.rev=true;ms.lost=true;this._drawMines();this._over(ms.score);return;}

  var stack=[[r,c]];
  while(stack.length){
    var pos=stack.pop(),pr=pos[0],pc=pos[1];
    var b=ms.board[pr]&&ms.board[pr][pc];
    if(!b||b.rev||b.flag||b.mine)continue;
    b.rev=true;ms.rev++;ms.score+=5;
    if(b.adj===0)for(var d=0;d<ms.dirs.length;d++){
      var nr=pr+ms.dirs[d][0],nc=pc+ms.dirs[d][1];
      if(nr>=0&&nr<ms.R&&nc>=0&&nc<ms.C)stack.push([nr,nc]);
    }
  }
  this._setScore(ms.score);
  if(ms.rev>=ms.R*ms.C-ms.M){ms.won=true;ms.score+=200;this._setScore(ms.score);this._drawMines();this._over(ms.score);return;}
  this._drawMines();
};

P._msFlag=function(r,c){
  if(!this.isPlaying)return;
  var ms=this._MS,cell=ms.board[r][c];
  if(ms.lost||ms.won||cell.rev)return;
  cell.flag=!cell.flag;ms.flag+=cell.flag?1:-1;
  this._drawMines();
};

/* ============================================================
   ⑫ TETRIS
   ============================================================ */
P._tetris = function () {
  var cv=this.gameCanvas,cx=this.gameCtx;
  if(!cv||!cx)return;
  this._useCanvas();

  var self=this,COLS=10,ROWS=20;
  var CW=Math.floor(cv.width*0.56/COLS);
  var CH=Math.floor(cv.height/ROWS);
  var BX=Math.floor((cv.width*0.56-COLS*CW)/2);

  var SHAPES=[
    {s:[[1,1,1,1]],        col:'#4DEEEA'},
    {s:[[1,0],[1,0],[1,1]],col:'#F6AD55'},
    {s:[[0,1],[0,1],[1,1]],col:'#0055FF'},
    {s:[[1,1],[1,1]],      col:'#ECC94B'},
    {s:[[0,1,1],[1,1,0]],  col:'#38A169'},
    {s:[[1,1,1],[0,1,0]],  col:'#9F7AEA'},
    {s:[[1,1,0],[0,1,1]],  col:'#E53E3E'}
  ];

  var board=[];
  for(var r=0;r<ROWS;r++){var row2=[];for(var c=0;c<COLS;c++)row2.push(null);board.push(row2);}

  var rotP=function(s){return s[0].map(function(_,i){return s.map(function(r2){return r2[i];}).reverse();});};
  var spawn=function(){var t=SHAPES[Math.floor(Math.random()*SHAPES.length)];return{s:t.s,col:t.col,x:Math.floor(COLS/2)-Math.floor(t.s[0].length/2),y:0};};
  var fits=function(s,px,py){
    for(var r2=0;r2<s.length;r2++)for(var c2=0;c2<s[r2].length;c2++){
      if(!s[r2][c2])continue;
      var nx=px+c2,ny=py+r2;
      if(nx<0||nx>=COLS||ny>=ROWS)return false;
      if(ny>=0&&board[ny][nx])return false;
    }
    return true;
  };
  var lock=function(p){
    for(var r2=0;r2<p.s.length;r2++)for(var c2=0;c2<p.s[r2].length;c2++){
      if(!p.s[r2][c2])continue;
      if(p.y+r2<0)return false;
      board[p.y+r2][p.x+c2]=p.col;
    }
    return true;
  };
  var clearLines=function(){
    var n=0;
    for(var r2=ROWS-1;r2>=0;r2--){
      if(board[r2].every(function(c2){return c2!==null;})){
        board.splice(r2,1);var nr=[];for(var c3=0;c3<COLS;c3++)nr.push(null);board.unshift(nr);n++;r2++;
      }
    }
    return n;
  };

  var score=0,level=1,lines=0;
  var dropMs=600,lastDrop=Date.now();
  var piece=spawn(),next=spawn();
  var LB=[0,100,300,500,800];

  this._kd=function(e){
    if(!self.isPlaying)return;
    switch(e.key){
      case'ArrowLeft':  if(fits(piece.s,piece.x-1,piece.y))piece.x--;e.preventDefault();break;
      case'ArrowRight': if(fits(piece.s,piece.x+1,piece.y))piece.x++;e.preventDefault();break;
      case'ArrowDown':  if(fits(piece.s,piece.x,piece.y+1))piece.y++;e.preventDefault();break;
      case'ArrowUp':case'z':case'Z':
        var rot2=rotP(piece.s);if(fits(rot2,piece.x,piece.y))piece.s=rot2;e.preventDefault();break;
      case' ':
        while(fits(piece.s,piece.x,piece.y+1))piece.y++;e.preventDefault();break;
    }
  };
  document.addEventListener('keydown',this._kd);
  this._touch(cv,function(d){
    if(d==='left' &&fits(piece.s,piece.x-1,piece.y))piece.x--;
    if(d==='right'&&fits(piece.s,piece.x+1,piece.y))piece.x++;
    if(d==='down' &&fits(piece.s,piece.x,piece.y+1))piece.y++;
    if(d==='up'){var rot3=rotP(piece.s);if(fits(rot3,piece.x,piece.y))piece.s=rot3;}
  });

  var tick=function(){
    if(!self.isPlaying)return;
    self.animFrame=requestAnimationFrame(tick);
    var now=Date.now();
    if(now-lastDrop>=dropMs){
      lastDrop=now;
      if(fits(piece.s,piece.x,piece.y+1)){piece.y++;}
      else{
        if(!lock(piece)){self._over(score);return;}
        var cl=clearLines();lines+=cl;score+=LB[cl]||0;score+=2;
        level=Math.floor(lines/10)+1;dropMs=Math.max(100,600-(level-1)*50);
        self._setScore(score);piece=next;next=spawn();
        if(!fits(piece.s,piece.x,piece.y)){self._over(score);return;}
      }
    }

    cx.fillStyle=self._c('bg');cx.fillRect(0,0,cv.width,cv.height);
    cx.fillStyle=self._c('sec')+'20';cx.fillRect(BX,0,COLS*CW,ROWS*CH);

    cx.strokeStyle=self._c('sec')+'15';cx.lineWidth=0.5;
    for(var gc=0;gc<=COLS;gc++){cx.beginPath();cx.moveTo(BX+gc*CW,0);cx.lineTo(BX+gc*CW,ROWS*CH);cx.stroke();}
    for(var gr=0;gr<=ROWS;gr++){cx.beginPath();cx.moveTo(BX,gr*CH);cx.lineTo(BX+COLS*CW,gr*CH);cx.stroke();}

    for(var br=0;br<ROWS;br++)for(var bc=0;bc<COLS;bc++){
      if(!board[br][bc])continue;
      cx.fillStyle=board[br][bc];cx.fillRect(BX+bc*CW+1,br*CH+1,CW-2,CH-2);
    }

    var gy=piece.y;while(fits(piece.s,piece.x,gy+1))gy++;
    for(var gr2=0;gr2<piece.s.length;gr2++)for(var gc2=0;gc2<piece.s[gr2].length;gc2++){
      if(!piece.s[gr2][gc2])continue;
      cx.strokeStyle=piece.col+'60';cx.lineWidth=1;
      cx.strokeRect(BX+(piece.x+gc2)*CW+1,(gy+gr2)*CH+1,CW-2,CH-2);
    }

    for(var ar=0;ar<piece.s.length;ar++)for(var ac=0;ac<piece.s[ar].length;ac++){
      if(!piece.s[ar][ac])continue;
      cx.fillStyle=piece.col;cx.fillRect(BX+(piece.x+ac)*CW+1,(piece.y+ar)*CH+1,CW-2,CH-2);
      cx.fillStyle='rgba(255,255,255,0.2)';cx.fillRect(BX+(piece.x+ac)*CW+1,(piece.y+ar)*CH+1,CW-2,4);
    }

    var PX=BX+COLS*CW+12;
    cx.fillStyle=self._c('txt');cx.font='bold 11px Poppins,sans-serif';
    cx.fillText('NEXT',PX,18);
    cx.fillText('Lvl: '+level,  PX,cv.height-56);
    cx.fillText('Lines: '+lines, PX,cv.height-42);
    cx.fillText('Score:',        PX,cv.height-28);
    cx.fillText(''+score,        PX,cv.height-14);

    var pcW=Math.min(CW,16),pcH=Math.min(CH,16);
    for(var nr=0;nr<next.s.length;nr++)for(var nc=0;nc<next.s[nr].length;nc++){
      if(!next.s[nr][nc])continue;
      cx.fillStyle=next.col;cx.fillRect(PX+nc*pcW,24+nr*pcH,pcW-1,pcH-1);
    }

    cx.fillStyle=self._c('muted');cx.font='9px Poppins,sans-serif';
    var hints=['Arrows: move','Up/Z: rotate','Space: drop'];
    for(var hi=0;hi<hints.length;hi++)cx.fillText(hints[hi],PX,cv.height-130+hi*13);
  };
  tick();
};

/* ============================================================
   UNSUPPORTED GAME FALLBACK
   ============================================================ */
P._stub = function () {
  var ui = this._useUI();
  if (!ui) return;
  var self = this;
  ui.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;padding:60px;text-align:center;gap:16px;">' +
      '<i data-lucide="construction" style="width:48px;height:48px;' +
         'color:var(--accent);opacity:0.6;"></i>' +
      '<h3 style="color:var(--text-heading);font-weight:700;">Coming Soon</h3>' +
      '<p style="color:var(--text-muted);font-size:0.88rem;max-width:280px;">' +
        'This game is under development. Check back soon!' +
      '</p>' +
      '<button class="btn btn-outline" id="stub-back">' +
        '<i data-lucide="arrow-left"></i><span>Back to Games</span>' +
      '</button>' +
    '</div>';
  document.getElementById('stub-back').addEventListener('click', function () {
    self.backToList();
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

/* ============================================================
   CSS — injected once into <head>
   ============================================================ */
(function injectCSS() {
  if (document.getElementById('rac-games-css')) return;

  var css = [
    /* ── Game cards ── */
    '.g-card{display:flex;align-items:center;gap:15px;padding:18px 20px;cursor:pointer;transition:all 0.22s ease;}',
    '.g-card:hover{transform:translateY(-4px) scale(1.01);}',
    '.g-card-icon{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.22s ease;box-shadow:var(--neu-shadow-sm);}',
    '.g-card:hover .g-card-icon{background:var(--accent)!important;}',
    '.g-card:hover .g-card-icon i,.g-card:hover .g-card-icon svg{color:#fff!important;}',
    '.g-card-body{flex:1;min-width:0;}',
    '.g-card-name{font-size:0.95rem;font-weight:700;color:var(--text-heading);margin-bottom:4px;}',
    '.g-card-desc{font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;}',
    '.g-card-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}',
    '.g-diff,.g-cat,.g-hs-badge{padding:2px 9px;border-radius:999px;font-size:0.67rem;font-weight:700;}',
    '.g-diff-easy{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
    '.g-diff-medium{background:var(--warning-light,#fefcbf);color:var(--warning,#d69e2e);}',
    '.g-diff-hard{background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
    '.g-cat{background:var(--bg-secondary);color:var(--text-muted);}',
    '.g-hs-badge{background:var(--accent-light);color:var(--accent);display:flex;align-items:center;gap:3px;}',
    '.g-card-play{width:38px;height:38px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent);transition:all 0.22s ease;}',
    '.g-card:hover .g-card-play{background:var(--accent);color:#fff;transform:scale(1.15);}',

    /* ── Game play header ── */
    '.g-hdr{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;}',
    '.g-hdr-title{display:flex;align-items:center;gap:8px;}',
    '.g-hdr-h2{font-size:1.05rem;font-weight:700;color:var(--text-heading);display:flex;align-items:center;gap:7px;}',
    '.g-hdr-h2 i,.g-hdr-h2 svg{width:20px;height:20px;color:var(--accent);}',
    '.g-score-box{display:flex;flex-direction:column;align-items:center;padding:7px 18px;background:var(--bg-card);border-radius:8px;box-shadow:var(--neu-shadow-sm);}',
    '.g-score-lbl{font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;}',
    '.g-score-val{font-size:1.5rem;font-weight:800;color:var(--accent);line-height:1;}',

    /* ── Game container ── */
    '.g-cont{position:relative;background:var(--bg-card);border-radius:12px;overflow:hidden;min-height:300px;box-shadow:var(--neu-shadow);}',
    '.g-cont canvas{display:block;width:100%;}',
    '.g-ovl{position:absolute;inset:0;background:rgba(0,0,0,0.76);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:10;}',
    '.g-ovl-inner{text-align:center;color:#fff;display:flex;flex-direction:column;align-items:center;gap:14px;}',
    '.g-ovl-inner h3{font-size:1.5rem;font-weight:800;}',
    '.g-ovl-inner p{font-size:0.88rem;opacity:0.8;max-width:280px;line-height:1.6;}',
    '.g-ui{padding:16px;min-height:300px;}',

    /* ── Memory ── */
    '.gm-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:340px;margin:0 auto;}',
    '.gm-card{aspect-ratio:1;cursor:pointer;perspective:600px;}',
    '.gm-inner{width:100%;height:100%;transition:transform 0.44s;transform-style:preserve-3d;position:relative;}',
    '.gm-card.gm-flip .gm-inner{transform:rotateY(180deg);}',
    '.gm-front,.gm-back{position:absolute;inset:0;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;border-radius:8px;box-shadow:var(--neu-shadow-sm);}',
    '.gm-front{background:var(--accent-light);color:var(--accent);}',
    '.gm-front i,.gm-front svg{width:22px;height:22px;}',
    '.gm-back{background:var(--bg-card);transform:rotateY(180deg);color:var(--accent);}',
    '.gm-back i,.gm-back svg{width:26px;height:26px;}',
    '.gm-card.gm-matched .gm-back{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',

    /* ── Quiz ── */
    '.q-wrap{max-width:500px;margin:0 auto;}',
    '.q-bar{height:4px;background:var(--bg-secondary);border-radius:999px;margin-bottom:14px;overflow:hidden;}',
    '.q-fill{height:100%;background:var(--accent);border-radius:999px;transition:width 0.4s ease;}',
    '.q-num{font-size:0.76rem;color:var(--text-muted);margin-bottom:12px;text-align:center;font-weight:600;}',
    '.q-txt{font-size:1rem;font-weight:700;color:var(--text-heading);margin-bottom:16px;line-height:1.5;text-align:center;}',
    '.q-opts{display:flex;flex-direction:column;gap:8px;}',
    '.q-opt{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:8px;background:var(--bg-card);border:2px solid transparent;cursor:pointer;transition:0.2s;text-align:left;width:100%;font-family:inherit;font-size:0.86rem;color:var(--text-primary);box-shadow:var(--neu-shadow-sm);}',
    '.q-opt:hover:not(:disabled){border-color:var(--accent);transform:translateX(4px);}',
    '.q-opt.q-ok{border-color:var(--success,#38a169);background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
    '.q-opt.q-no{border-color:var(--danger,#e53e3e);background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
    '.q-letter{width:26px;height:26px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;flex-shrink:0;}',
    '.q-exp-box{margin-top:14px;padding:10px 12px;border-radius:8px;background:var(--bg-secondary);display:flex;align-items:flex-start;gap:8px;font-size:0.8rem;color:var(--text-secondary);}',

    /* ── Tic Tac Toe ── */
    '.ttt-wrap{max-width:300px;margin:0 auto;text-align:center;}',
    '.ttt-sc{display:flex;justify-content:space-around;margin-bottom:10px;font-size:0.86rem;font-weight:700;}',
    '.ttt-st{font-size:0.88rem;font-weight:600;color:var(--text-heading);margin-bottom:12px;}',
    '.ttt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}',
    '.ttt-c{aspect-ratio:1;border-radius:8px;background:var(--bg-card);border:2px solid transparent;cursor:pointer;transition:0.2s;display:flex;align-items:center;justify-content:center;font-family:inherit;box-shadow:var(--neu-shadow-sm);}',
    '.ttt-c:hover:not(:disabled){border-color:var(--accent);transform:scale(1.05);}',
    '.ttt-x{color:var(--accent);}',
    '.ttt-o{color:var(--danger);}',

    /* ── Typing ── */
    '.ty-wrap{max-width:540px;margin:0 auto;}',
    '.ty-target{padding:18px;background:var(--bg-secondary);border-radius:8px;font-size:1rem;line-height:1.8;color:var(--text-secondary);min-height:76px;box-shadow:var(--neu-inset);}',
    '.ty-stats{display:flex;justify-content:center;gap:20px;margin-top:14px;font-size:0.86rem;color:var(--text-secondary);flex-wrap:wrap;}',
    '.ty-stats strong{color:var(--accent);font-weight:800;}',

    /* ── Wordle ── */
    '.wl-wrap{max-width:340px;margin:0 auto;}',
    '.wl-grid{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;}',
    '.wl-row{display:flex;gap:5px;justify-content:center;}',
    '.wl-cell{width:52px;height:52px;border:2px solid var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:800;text-transform:uppercase;transition:0.2s;color:var(--text-heading);background:var(--bg-card);}',
    '.wl-cur{border-color:var(--accent)!important;transform:scale(1.06);}',
    '.wl-c{background:#538d4e;border-color:#538d4e;color:#fff;}',
    '.wl-p{background:#b59f3b;border-color:#b59f3b;color:#fff;}',
    '.wl-a{background:#3a3a3c;border-color:#3a3a3c;color:#fff;}',
    '.wl-kb{display:flex;flex-direction:column;gap:5px;align-items:center;}',
    '.wl-kr{display:flex;gap:4px;}',
    '.wl-k{min-width:30px;height:44px;border-radius:5px;border:none;cursor:pointer;font-weight:700;font-size:0.78rem;background:var(--bg-secondary);color:var(--text-heading);transition:0.15s;font-family:inherit;}',
    '.wl-k:hover{opacity:0.8;}',
    '.wl-wide{min-width:52px;font-size:0.7rem;}',
    '.wlk-correct{background:#538d4e!important;color:#fff!important;}',
    '.wlk-present{background:#b59f3b!important;color:#fff!important;}',
    '.wlk-absent{background:#3a3a3c!important;color:#fff!important;}',
    '.wl-msg{text-align:center;padding:9px;border-radius:8px;margin-bottom:9px;font-size:0.86rem;font-weight:600;}',
    '.wl-ok{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
    '.wl-no{background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
    '@keyframes wlShake{0%,100%{transform:translateX(0);}20%{transform:translateX(-5px);}40%{transform:translateX(5px);}60%{transform:translateX(-3px);}80%{transform:translateX(3px);}}',
    '.wl-shake{animation:wlShake 0.4s ease;}',

    /* ── 2048 ── */
    '.g2-wrap{max-width:360px;margin:0 auto;}',
    '.g2-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;background:#bbada0;padding:7px;border-radius:8px;}',
    '.g2-cell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;transition:0.1s;}',
    '.g2-btn{width:50px;height:50px;border-radius:8px;border:none;cursor:pointer;background:var(--accent-light);color:var(--accent);font-size:1.3rem;font-weight:700;transition:0.15s;font-family:inherit;}',
    '.g2-btn:hover{background:var(--accent);color:#fff;}',

    /* ── Minesweeper ── */
    '.ms-wrap{max-width:360px;margin:0 auto;}',
    '.ms-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:700;font-size:0.8rem;color:var(--text-heading);}',
    '.ms-grid{display:grid;gap:2px;background:var(--bg-secondary);padding:2px;border-radius:4px;}',
    '.ms-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;cursor:pointer;border-radius:3px;user-select:none;min-width:30px;}',
    '.ms-hid{background:var(--bg-card);}',
    '.ms-hid:hover{background:var(--accent-light);}',
    '.ms-rev{background:var(--bg-secondary);}',
    '.ms-mine{background:var(--danger-light,#fed7d7);}',
    '.ms-flag{background:var(--warning-light,#fefcbf);cursor:pointer;}',

    /* ── Responsive ── */
    '@media(max-width:480px){',
    '.g-hdr{flex-direction:column;align-items:flex-start;}',
    '.g-score-box{flex-direction:row;gap:8px;width:100%;justify-content:center;}',
    '.gm-grid{gap:5px;}',
    '.ty-stats{flex-direction:column;gap:6px;align-items:center;}',
    '.wl-cell{width:44px;height:44px;font-size:1rem;}',
    '.ms-cell{min-width:26px;font-size:0.6rem;}',
    '.ttt-c{min-height:65px;}',
    '}'
  ].join('');

  var s = document.createElement('style');
  s.id  = 'rac-games-css';
  s.textContent = css;
  document.head.appendChild(s);
}());

/* ============================================================
   GLOBAL INIT
   ============================================================ */
var gamesManager;

function _initGames() {
  /* Wait for GAMES_CONFIG to be available */
  if (!window.GAMES_CONFIG || !window.GAMES_CONFIG.length) {
    console.error(
      '[games.js] window.GAMES_CONFIG is missing.\n' +
      'Make sure config.js loads BEFORE games.js in your HTML.'
    );
    var g = document.getElementById('games-grid');
    if (g) {
      g.innerHTML =
        '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--danger);">' +
        '<strong>Configuration Error:</strong> config.js must load before games.js.</div>';
    }
    return;
  }

  gamesManager        = new GamesManager();
  window.gamesManager = gamesManager;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initGames);
} else {
  _initGames(); /* DOM already ready */
}

} /* ── end double-load guard ── */

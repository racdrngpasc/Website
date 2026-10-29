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
            (g.mode === 'multi' ? '<span class="g-mp-badge"><i data-lucide="users"></i>' + (g.min === g.max ? g.min : g.min + '-' + g.max) + ' players</span>' : '') +
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

  /* Multiplayer room games have their own lobby / room screens */
  if (game.mode === 'multi') { this._mpEnter(game); return; }

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
  if (this._mpRoom) { var mr = this._mpRoom; this._mpRoom = null; mr.destroy(); }
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
    pri:     d ? '#F06FA3' : '#D41367',
    txt:     d ? '#EAEFFB' : '#3A3A3A',
    sec:     d ? '#35374E' : '#BEBEBE',
    muted:   d ? '#756F70' : '#888899',
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
  var rowColors = [self._c('danger'), self._c('warning'), self._c('success'), self._c('pri'), '#E3508F'];
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
  var AC=['','#D41367','#388E3C','#D32F2F','#8E0C45','#F57F17','#E3508F','#212121','#757575'];
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
    {s:[[1,1,1,1]],        col:'#F06FA3'},
    {s:[[1,0],[1,0],[1,1]],col:'#F6AD55'},
    {s:[[0,1],[0,1],[1,1]],col:'#D41367'},
    {s:[[1,1],[1,1]],      col:'#ECC94B'},
    {s:[[0,1,1],[1,1,0]],  col:'#38A169'},
    {s:[[1,1,1],[0,1,0]],  col:'#E3508F'},
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
   MULTIPLAYER ROOMS — shared helpers
   Rooms use Supabase Realtime Broadcast + Presence only (no tables).
   The host's browser runs the rules; every other player sends
   actions to the host and receives the public game state back.
   ============================================================ */
var MP_COLORS = ['#D41367', '#2B7DE9', '#1FA971', '#F2A413', '#8E44EC', '#E5533D', '#0FB5C9', '#64748B'];
var MP_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
var MP_IDLE_MS = 10 * 60 * 1000;      /* room closes after 10 minutes without any action */
var MP_RESULT_MS = 3 * 60 * 1000;     /* ...or 3 minutes after the game ended if the host does nothing */

var MP_WORDS = [
  'ROTARACT', 'SERVICE', 'FELLOWSHIP', 'LEADERSHIP', 'COMMUNITY', 'INTEGRITY', 'CHARTER', 'PRESIDENT',
  'SECRETARY', 'TREASURER', 'DISTRICT', 'VOLUNTEER', 'PROJECT', 'AWARENESS', 'DONATION', 'HEALTH',
  'EDUCATION', 'ENVIRONMENT', 'FOUNDATION', 'POLIO', 'FRIENDSHIP', 'GOODWILL', 'HARMONY', 'PEACE',
  'AMBASSADOR', 'NETWORK', 'MENTOR', 'CAMPAIGN', 'SCHOLARSHIP', 'INITIATIVE', 'GENEROSITY', 'DIVERSITY',
  'IMPACT', 'TEAMWORK', 'CAMPUS', 'COIMBATORE', 'MERIDIAN', 'AVENUE', 'BULLETIN', 'MEETING'
];
var MP_DRAW_WORDS = [
  'TREE', 'HOUSE', 'SUN', 'FLOWER', 'HEART', 'CAMERA', 'BICYCLE', 'TROPHY', 'BOOK', 'CLOCK', 'RAINBOW',
  'UMBRELLA', 'FISH', 'BIRD', 'CAR', 'GUITAR', 'CAKE', 'MOUNTAIN', 'CHAIR', 'BALLOON', 'HANDSHAKE',
  'BLOOD DROP', 'TORCH', 'GLOBE', 'SMILE', 'PLANT A TREE', 'FLAG', 'BOAT', 'KEY', 'ROCKET', 'STAR',
  'MOON', 'APPLE', 'SPECTACLES', 'LAPTOP', 'PHONE', 'ELEPHANT', 'TRAIN'
];

function mpEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function mpRand(n) { return Math.floor(Math.random() * n); }
function mpShuffle(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = mpRand(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function mpPick(a, n) { return mpShuffle(a).slice(0, n); }
function mpClone(o) { return JSON.parse(JSON.stringify(o)); }
function mpCode() { var s = ''; for (var i = 0; i < 4; i++) s += MP_CODE_CHARS.charAt(mpRand(MP_CODE_CHARS.length)); return s; }
function mpId() { return Math.random().toString(36).slice(2, 10); }
function mpZeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
function mpGone(st, i) { return !!(st.gone && st.gone[i]); }
function mpActive(st) { var o = []; for (var i = 0; i < st.n; i++) if (!mpGone(st, i)) o.push(i); return o; }
function mpNext(st, from) {
  for (var k = 1; k <= st.n; k++) { var j = (from + k) % st.n; if (!mpGone(st, j)) return j; }
  return from;
}
function mpFinish(st, note) { st.over = true; st.note = note || ''; return st; }
function mpLetters(s) { return String(s || '').toUpperCase().replace(/[^A-Z]/g, ''); }
function mpA(a) { return ' data-a="' + mpEsc(JSON.stringify(a)) + '"'; }
function mpBar(until, total) {
  return '<div class="mp-bar"><div class="mp-bar-fill" data-bar data-until="' + until + '" data-total="' + total + '"></div></div>';
}
function mpClock(until) { return '<span class="mp-clock" data-until="' + until + '">--</span>'; }
function mpName(x, i) { var p = x.P[i]; return p ? mpEsc(p.name) : 'Player'; }
function mpDot(x, i) { var p = x.P[i]; return '<span class="mp-dot" style="background:' + (p ? p.color : '#888') + '"></span>'; }

/* dice face drawn with CSS dots (no emoji) */
function mpDie(n) {
  var map = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  var on = map[n] || [], h = '<div class="pig-die' + (n ? '' : ' is-blank') + '">';
  for (var i = 0; i < 9; i++) h += '<span class="' + (on.indexOf(i) !== -1 ? 'on' : '') + '"></span>';
  return h + '</div>';
}

/* gallows drawn with inline SVG, one stroke per wrong guess */
function mpHang(w) {
  var s = '<svg class="hm-fig" viewBox="0 0 120 140" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">';
  s += '<path d="M10 132h100M30 132V10h58"/>';
  if (w >= 1) s += '<path d="M88 10v20"/>';
  if (w >= 2) s += '<circle cx="88" cy="42" r="12"/>';
  if (w >= 3) s += '<path d="M88 54v36"/>';
  if (w >= 4) s += '<path d="M88 64l-16 14"/>';
  if (w >= 5) s += '<path d="M88 64l16 14"/>';
  if (w >= 6) s += '<path d="M88 90l-14 24"/>';
  if (w >= 7) s += '<path d="M88 90l14 24"/>';
  return s + '</svg>';
}

function mpFour(b, r, c, p) {
  var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (var d = 0; d < dirs.length; d++) {
    var cells = [[r, c]];
    for (var s = -1; s <= 1; s += 2) {
      var y = r + dirs[d][0] * s, x = c + dirs[d][1] * s;
      while (y >= 0 && y < 6 && x >= 0 && x < 7 && b[y][x] === p) {
        cells.push([y, x]); y += dirs[d][0] * s; x += dirs[d][1] * s;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

/* ============================================================
   GAME RULES — each entry is { min, max, opts, help, init, reduce,
   tick, pub, secret, render | mount+update }.
   init/reduce/tick/pub run only on the host. render/mount/update
   run on everybody and only ever see the public state.
   ============================================================ */
var MP_GAMES = {};

/* ───────── 1. CONNECT FOUR ───────── */
MP_GAMES.connect4 = {
  min: 2, max: 2, opts: [],
  help: 'Take turns dropping a disc into a column. The first player to line up four discs — across, down or diagonally — wins.',
  init: function () {
    var b = []; for (var r = 0; r < 6; r++) b.push([-1, -1, -1, -1, -1, -1, -1]);
    return { board: b, turn: 0, pts: [0, 0], last: null, line: null };
  },
  reduce: function (st, a, i) {
    if (st.over || a.k !== 'drop' || st.turn !== i) return null;
    var c = a.c | 0; if (c < 0 || c > 6) return null;
    var r = -1; for (var y = 5; y >= 0; y--) { if (st.board[y][c] === -1) { r = y; break; } }
    if (r < 0) return null;
    st.board[r][c] = i; st.last = [r, c];
    var line = mpFour(st.board, r, c, i);
    if (line) { st.line = line; st.pts[i] = 100; return mpFinish(st, 'Four in a row!'); }
    if (st.board[0].every(function (v) { return v !== -1; })) { st.pts = [50, 50]; return mpFinish(st, 'The grid is full — it is a draw.'); }
    st.turn = 1 - i; return st;
  },
  turnOf: function (st) { return st.over ? -1 : st.turn; },
  render: function (x) {
    var st = x.st, my = (x.me === st.turn && !st.over), head;
    if (st.over) head = st.line ? mpName(x, st.turn) + ' wins!' : 'It is a draw';
    else head = my ? 'Your turn — pick a column' : mpName(x, st.turn) + ' is thinking…';
    var h = '<div class="c4-wrap"><div class="mp-status">' + mpDot(x, st.turn) + '<span>' + head + '</span></div><div class="c4-board">';
    for (var c = 0; c < 7; c++) {
      h += '<button type="button" class="c4-col"' + (my ? mpA({ k: 'drop', c: c }) : ' disabled') + ' aria-label="Column ' + (c + 1) + '">';
      for (var r = 0; r < 6; r++) {
        var v = st.board[r][c], win = false, rr = r, cc = c;
        if (st.line) win = st.line.some(function (p) { return p[0] === rr && p[1] === cc; });
        var isLast = st.last && st.last[0] === r && st.last[1] === c;
        h += '<span class="c4-cell' + (win ? ' is-win' : '') + (isLast ? ' is-last' : '') + '">' +
             (v >= 0 ? '<i style="background:' + x.P[v].color + '"></i>' : '') + '</span>';
      }
      h += '</button>';
    }
    return h + '</div></div>';
  }
};

/* ───────── 2. RPS ARENA ───────── */
(function () {
  var BEATS = { r: 's', p: 'r', s: 'p' };
  function resolve(st, now) {
    var delta = mpZeros(st.n), ks = Object.keys(st.picks);
    ks.forEach(function (a) {
      ks.forEach(function (b) { if (a !== b && BEATS[st.picks[a]] === st.picks[b]) delta[a]++; });
    });
    for (var i = 0; i < st.n; i++) st.pts[i] += delta[i];
    st.last = { picks: mpClone(st.picks), delta: delta };
    st.phase = 'reveal'; st.until = now + 2800;
    return st;
  }
  MP_GAMES.rps = {
    min: 2, max: 6,
    opts: [{ id: 'rounds', label: 'Rounds', choices: [3, 5, 7], def: 5 }],
    help: 'Everyone secretly picks rock, paper or scissors. You score one point for every opponent your pick beats. Most points after the last round wins.',
    init: function (n, o, now) {
      return { round: 1, rounds: o.rounds || 5, phase: 'pick', picks: {}, pts: mpZeros(n), until: now + 12000, last: null };
    },
    reduce: function (st, a, i, now) {
      if (st.phase !== 'pick' || a.k !== 'pick' || !BEATS[a.v] || st.picks[i]) return null;
      st.picks[i] = a.v;
      if (mpActive(st).every(function (j) { return st.picks[j]; })) return resolve(st, now);
      return st;
    },
    tick: function (st, now) {
      if (st.phase === 'pick') {
        var act = mpActive(st);
        if (now >= st.until || (act.length && act.every(function (j) { return st.picks[j]; }))) return resolve(st, now);
      } else if (now >= st.until) {
        if (st.round >= st.rounds) return mpFinish(st, 'All rounds played.');
        st.round++; st.phase = 'pick'; st.picks = {}; st.until = now + 12000; return st;
      }
      return null;
    },
    pub: function (st) {
      var picks = st.picks;
      if (st.phase === 'pick') { picks = {}; Object.keys(st.picks).forEach(function (k) { picks[k] = 1; }); }
      return { round: st.round, rounds: st.rounds, phase: st.phase, picks: picks, until: st.until, last: st.last };
    },
    onSend: function (local, a) { if (a.k === 'pick') local.pick = a.v; },
    render: function (x) {
      var st = x.st, icons = { r: 'mountain', p: 'hand', s: 'scissors' }, names = { r: 'Rock', p: 'Paper', s: 'Scissors' };
      var h = '<div class="rps-wrap"><div class="mp-status"><span>Round ' + st.round + ' of ' + st.rounds + '</span>';
      if (st.phase === 'pick') {
        var done = Object.keys(st.picks).length, tot = mpActive(st).length;
        h += '<span class="mp-pill">' + done + '/' + tot + ' ready</span></div>' + mpBar(st.until, 12000) + '<div class="rps-pick">';
        ['r', 'p', 's'].forEach(function (k) {
          var chosen = st.picks[x.me] && x.local.pick === k;
          h += '<button type="button" class="rps-btn' + (chosen ? ' is-chosen' : '') + '"' + (st.picks[x.me] ? ' disabled' : mpA({ k: 'pick', v: k })) +
               '><i data-lucide="' + icons[k] + '"></i><span>' + names[k] + '</span></button>';
        });
        h += '</div><p class="mp-hint">' + (st.picks[x.me] ? 'Locked in — waiting for the others…' : 'Choose before the timer ends.') + '</p>';
      } else {
        h += '</div><div class="rps-reveal">';
        for (var i = 0; i < st.n; i++) {
          var pk = st.last && st.last.picks[i], d = st.last ? st.last.delta[i] : 0;
          h += '<div class="rps-row">' + mpDot(x, i) + '<b>' + mpName(x, i) + '</b>' +
               (pk ? '<span class="rps-chip"><i data-lucide="' + icons[pk] + '"></i>' + names[pk] + '</span>' : '<span class="rps-chip is-miss">No pick</span>') +
               '<em class="' + (d > 0 ? 'is-up' : '') + '">+' + d + '</em></div>';
        }
        h += '</div>';
      }
      return h + '</div>';
    }
  };
})();

/* ───────── 3. QUICK DRAW ───────── */
(function () {
  function settle(st, now) {
    var valid = [], early = [];
    Object.keys(st.taps).forEach(function (k) { var ms = st.taps[k]; if (ms > 0) valid.push([+k, ms]); else early.push(+k); });
    valid.sort(function (a, b) { return a[1] - b[1]; });
    var award = [3, 2, 1];
    valid.forEach(function (v, idx) { st.pts[v[0]] += (award[idx] || 0); });
    early.forEach(function (i) { st.pts[i] = Math.max(0, st.pts[i] - 1); });
    st.res = valid.map(function (v, idx) { return { i: v[0], ms: v[1], p: award[idx] || 0 }; })
      .concat(early.map(function (i) { return { i: i, ms: -1, p: -1 }; }));
    st.phase = 'result'; st.until = now + 3200;
    return st;
  }
  MP_GAMES.quickdraw = {
    min: 2, max: 8,
    opts: [{ id: 'rounds', label: 'Rounds', choices: [3, 5, 8], def: 5 }],
    help: 'Wait for the pad to turn green, then tap as fast as you can. Fastest gets 3 points, second 2, third 1. Tap too early and you lose a point.',
    init: function (n, o, now) {
      return { round: 1, rounds: o.rounds || 5, phase: 'wait', goAt: now + 2200 + mpRand(3500), taps: {}, pts: mpZeros(n), res: null, until: 0 };
    },
    reduce: function (st, a, i, now) {
      if ((st.phase !== 'wait' && st.phase !== 'go') || st.taps[i] !== undefined) return null;
      if (a.k === 'early') { st.taps[i] = -1; }
      else if (a.k === 'tap') {
        if (now < st.goAt - 250) st.taps[i] = -1;
        else st.taps[i] = Math.max(60, Math.min(5000, a.ms | 0));
      } else return null;
      if (mpActive(st).every(function (j) { return st.taps[j] !== undefined; })) return settle(st, now);
      return st;
    },
    tick: function (st, now) {
      if (st.phase === 'wait' && now >= st.goAt) { st.phase = 'go'; st.until = st.goAt + 3500; return st; }
      if (st.phase === 'go' && now >= st.until) return settle(st, now);
      if ((st.phase === 'wait' || st.phase === 'go') && mpActive(st).every(function (j) { return st.taps[j] !== undefined; })) return settle(st, now);
      if (st.phase === 'result' && now >= st.until) {
        if (st.round >= st.rounds) return mpFinish(st, 'Lightning reflexes!');
        st.round++; st.phase = 'wait'; st.goAt = now + 2200 + mpRand(3500); st.taps = {}; st.res = null; return st;
      }
      return null;
    },
    pub: function (st) {
      var tapped = {}; Object.keys(st.taps).forEach(function (k) { tapped[k] = 1; });
      return { round: st.round, rounds: st.rounds, phase: st.phase, goAt: st.goAt, until: st.until, tapped: tapped, res: st.res };
    },
    mount: function (x) {
      x.stage.innerHTML = '<div class="qd-wrap"><div class="mp-status"><span id="qd-round"></span></div>' +
        '<button type="button" class="qd-pad is-wait" id="qd-pad"><strong id="qd-msg">Get ready…</strong><small id="qd-sub"></small></button>' +
        '<div class="qd-res" id="qd-res"></div></div>';
      var L = x.local;
      document.getElementById('qd-pad').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var st = L.st; if (!st || L.sent || x.me < 0) return;
        if (st.phase === 'wait' || st.phase === 'go') {
          if (L.flipAt) { L.sent = true; x.send({ k: 'tap', ms: Math.round(performance.now() - L.flipAt) }); L.msg = 'Sent!'; }
          else { L.sent = true; x.send({ k: 'early' }); L.msg = 'Too early!'; }
          MP_GAMES.quickdraw.paint(x);
        }
      });
    },
    paint: function (x) {
      var L = x.local, st = L.st, pad = document.getElementById('qd-pad');
      if (!pad || !st) return;
      var m = document.getElementById('qd-msg'), s = document.getElementById('qd-sub');
      document.getElementById('qd-round').textContent = 'Round ' + st.round + ' of ' + st.rounds;
      if (st.phase === 'wait' || st.phase === 'go') {
        if (L.sent) { pad.className = 'qd-pad is-done'; m.textContent = L.msg || 'Sent!'; s.textContent = 'Waiting for the others…'; }
        else if (L.flipAt) { pad.className = 'qd-pad is-go'; m.textContent = 'TAP NOW!'; s.textContent = ''; }
        else { pad.className = 'qd-pad is-wait'; m.textContent = 'Wait for green…'; s.textContent = 'Do not tap yet'; }
      } else {
        pad.className = 'qd-pad is-done'; m.textContent = 'Round over'; s.textContent = 'Next round starting…';
      }
    },
    update: function (x) {
      var L = x.local, st = x.st;
      if (L.round !== st.round) {
        if (L.timer) clearTimeout(L.timer);
        L.round = st.round; L.flipAt = 0; L.sent = false; L.msg = ''; L.timer = null; L.armed = false;
      }
      L.st = st;
      if (st.phase === 'wait' && !L.armed && !L.sent) {
        L.armed = true;
        L.timer = setTimeout(function () { if (!L.sent) { L.flipAt = performance.now(); MP_GAMES.quickdraw.paint(x); } }, Math.max(0, st.goAt - x.now()));
      }
      if (st.phase === 'go' && !L.flipAt && !L.sent) L.flipAt = performance.now();
      MP_GAMES.quickdraw.paint(x);
      var box = document.getElementById('qd-res');
      if (box) {
        if (st.res) {
          box.innerHTML = st.res.map(function (r) {
            return '<div class="qd-row">' + mpDot(x, r.i) + '<b>' + mpName(x, r.i) + '</b><span>' + (r.ms > 0 ? r.ms + ' ms' : 'Too early') + '</span><em>' + (r.p > 0 ? '+' + r.p : r.p < 0 ? '−1' : '') + '</em></div>';
          }).join('') || '<p class="mp-hint">Nobody tapped in time.</p>';
        } else box.innerHTML = '';
      }
    },
    destroy: function (L) { if (L.timer) clearTimeout(L.timer); }
  };
})();

/* ───────── 4. TRIVIA SHOWDOWN ───────── */
(function () {
  var QMS = 15000;
  function reveal(st, now) {
    var q = st.qs[st.qi], best = -1, bestT = 1e12;
    st.gain = mpZeros(st.n);
    Object.keys(st.ans).forEach(function (k) {
      var a = st.ans[k];
      if (a.c === q.a) {
        st.gain[k] = 100 + Math.round(50 * Math.max(0, 1 - a.t / QMS));
        if (a.t < bestT) { bestT = a.t; best = +k; }
      }
    });
    if (best >= 0) st.gain[best] += 25;
    for (var i = 0; i < st.n; i++) st.pts[i] += st.gain[i];
    st.phase = 'reveal'; st.until = now + 3800; return st;
  }
  MP_GAMES.trivia = {
    min: 2, max: 8,
    opts: [{ id: 'questions', label: 'Questions', choices: [5, 8, 10], def: 8 }],
    help: 'Answer Rotary and Rotaract questions. Correct answers earn 100 points plus up to 50 for speed, and the fastest correct answer gets a 25 point bonus.',
    init: function (n, o, now) {
      var src = window.QUIZ_QUESTIONS || [], total = Math.min(o.questions || 8, src.length);
      var qs = mpPick(src, total).map(function (q) {
        var idx = mpShuffle(q.options.map(function (_, k) { return k; }));
        return { q: q.question, o: idx.map(function (k) { return q.options[k]; }), a: idx.indexOf(q.answer), e: q.explanation || '' };
      });
      return { qs: qs, qi: 0, total: total, phase: 'ask', t0: now, until: now + QMS, ans: {}, gain: null, pts: mpZeros(n) };
    },
    reduce: function (st, a, i, now) {
      if (st.phase !== 'ask' || a.k !== 'ans' || st.ans[i]) return null;
      var c = a.c | 0; if (c < 0 || c >= st.qs[st.qi].o.length) return null;
      st.ans[i] = { c: c, t: now - st.t0 };
      if (mpActive(st).every(function (j) { return st.ans[j]; })) return reveal(st, now);
      return st;
    },
    tick: function (st, now) {
      if (st.phase === 'ask') {
        var act = mpActive(st);
        if (now >= st.until || (act.length && act.every(function (j) { return st.ans[j]; }))) return reveal(st, now);
      } else if (now >= st.until) {
        if (st.qi + 1 >= st.total) return mpFinish(st, 'Quiz complete.');
        st.qi++; st.phase = 'ask'; st.t0 = now; st.until = now + QMS; st.ans = {}; st.gain = null; return st;
      }
      return null;
    },
    pub: function (st) {
      var q = st.qs[st.qi], rev = st.phase === 'reveal', ans = {};
      Object.keys(st.ans).forEach(function (k) { ans[k] = rev ? st.ans[k] : 1; });
      return { qi: st.qi, total: st.total, phase: st.phase, until: st.until, ans: ans, gain: rev ? st.gain : null,
               q: { q: q.q, o: q.o, a: rev ? q.a : -1, e: rev ? q.e : '' } };
    },
    onSend: function (local, a) { if (a.k === 'ans') local.sel = a.c; },
    render: function (x) {
      var st = x.st, q = st.q, rev = st.phase === 'reveal', mine = st.ans[x.me];
      var mineC = rev ? (mine ? mine.c : -1) : (mine ? x.local.sel : -1);
      var h = '<div class="tv-wrap"><div class="mp-status"><span>Question ' + (st.qi + 1) + ' of ' + st.total + '</span>' +
              (rev ? '' : '<span class="mp-pill">' + Object.keys(st.ans).length + '/' + mpActive(st).length + ' answered</span>') + '</div>';
      if (!rev) h += mpBar(st.until, QMS);
      h += '<h3 class="tv-q">' + mpEsc(q.q) + '</h3><div class="tv-opts">';
      q.o.forEach(function (o, k) {
        var cls = 'tv-opt';
        if (rev) { if (k === q.a) cls += ' is-ok'; else if (k === mineC) cls += ' is-no'; }
        else if (k === mineC) cls += ' is-sel';
        h += '<button type="button" class="' + cls + '"' + (mine || rev || x.me < 0 ? ' disabled' : mpA({ k: 'ans', c: k })) +
             '><span class="tv-l">' + 'ABCD'.charAt(k) + '</span><span>' + mpEsc(o) + '</span></button>';
      });
      h += '</div>';
      if (rev) {
        var g = st.gain && st.gain[x.me];
        h += '<div class="tv-exp"><b>' + (g > 0 ? 'Correct! +' + g : (mine ? 'Not this time.' : 'Time ran out.')) + '</b> ' + mpEsc(q.e) + '</div>';
      } else if (mine) h += '<p class="mp-hint">Answer locked — waiting for the others…</p>';
      return h + '</div>';
    }
  };
})();

/* ───────── 5. HANGMAN DUEL ───────── */
(function () {
  var TURN = 20000, MAXW = 7;
  function endWord(st, now, solved) { st.phase = 'between'; st.solved = solved; st.until = now + 3200; return st; }
  function revealed(st) { return st.word.split('').every(function (ch) { return st.guessed.indexOf(ch) !== -1; }); }
  MP_GAMES.hangman = {
    min: 2, max: 6,
    opts: [{ id: 'words', label: 'Words', choices: [2, 3, 5], def: 3 }],
    help: 'Take turns guessing one letter. Every letter you reveal scores 10 points and keeps your turn. A wrong guess passes the turn and builds the gallows. Finish a word for a 30 point bonus.',
    init: function (n, o, now) {
      var words = mpPick(MP_WORDS, o.words || 3);
      return { words: words, wi: 0, total: words.length, word: words[0], guessed: [], wrong: 0, turn: 0, phase: 'play', solved: false, until: now + TURN, pts: mpZeros(n) };
    },
    reduce: function (st, a, i, now) {
      if (st.phase !== 'play' || a.k !== 'g' || st.turn !== i) return null;
      var l = String(a.l || '').toUpperCase();
      if (!/^[A-Z]$/.test(l) || st.guessed.indexOf(l) !== -1) return null;
      st.guessed.push(l);
      var c = st.word.split('').filter(function (ch) { return ch === l; }).length;
      if (c > 0) {
        st.pts[i] += 10 * c; st.until = now + TURN;
        if (revealed(st)) { st.pts[i] += 30; return endWord(st, now, true); }
      } else {
        st.wrong++;
        if (st.wrong >= MAXW) return endWord(st, now, false);
        st.turn = mpNext(st, i); st.until = now + TURN;
      }
      return st;
    },
    tick: function (st, now) {
      if (st.phase === 'play') {
        if (mpGone(st, st.turn) || now >= st.until) { st.turn = mpNext(st, st.turn); st.until = now + TURN; return st; }
      } else if (now >= st.until) {
        if (st.wi + 1 >= st.total) return mpFinish(st, 'All words played.');
        st.wi++; st.word = st.words[st.wi]; st.guessed = []; st.wrong = 0; st.phase = 'play'; st.solved = false;
        st.turn = mpNext(st, st.turn); st.until = now + TURN; return st;
      }
      return null;
    },
    turnOf: function (st) { return st.over ? -1 : (st.phase === 'play' ? st.turn : -1); },
    pub: function (st) {
      var show = st.phase !== 'play';
      return { wi: st.wi, total: st.total, guessed: st.guessed, wrong: st.wrong, turn: st.turn, phase: st.phase, solved: st.solved, until: st.until,
               len: st.word.length, word: show ? st.word : null,
               mask: st.word.split('').map(function (ch) { return (show || st.guessed.indexOf(ch) !== -1) ? ch : '_'; }).join('') };
    },
    render: function (x) {
      var st = x.st, my = x.me === st.turn && st.phase === 'play';
      var h = '<div class="hm-wrap"><div class="mp-status"><span>Word ' + (st.wi + 1) + ' of ' + st.total + '</span><span class="mp-pill">Wrong ' + st.wrong + '/' + MAXW + '</span></div>';
      if (st.phase === 'play') h += mpBar(st.until, TURN);
      h += '<div class="hm-main">' + mpHang(st.wrong) + '<div class="hm-word">' +
           st.mask.split('').map(function (ch) { return '<span class="' + (ch === '_' ? 'is-blank' : '') + '">' + (ch === '_' ? '' : ch) + '</span>'; }).join('') + '</div></div>';
      if (st.phase === 'play') {
        h += '<p class="mp-hint">' + (my ? 'Your turn — pick a letter' : mpDot(x, st.turn) + mpName(x, st.turn) + ' is choosing…') + '</p>';
      } else {
        h += '<p class="mp-hint"><b>' + (st.solved ? 'Solved!' : 'Out of guesses.') + '</b> The word was ' + mpEsc(st.word) + '.</p>';
      }
      h += '<div class="hm-kb">';
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (l) {
        var used = st.guessed.indexOf(l) !== -1;
        h += '<button type="button" class="hm-k' + (used ? ' is-used' : '') + '"' + (used || !my ? ' disabled' : mpA({ k: 'g', l: l })) + '>' + l + '</button>';
      });
      return h + '</div></div>';
    }
  };
})();

/* ───────── 6. WORD SCRAMBLE RACE ───────── */
(function () {
  var RMS = 25000;
  function scramble(w) {
    var s = w, n = 0;
    while (s === w && n++ < 20) s = mpShuffle(w.split('')).join('');
    return s;
  }
  MP_GAMES.scramble = {
    min: 2, max: 8,
    opts: [{ id: 'rounds', label: 'Rounds', choices: [5, 8, 10], def: 8 }],
    help: 'A Rotary word appears with its letters mixed up. Type the real word — the first correct answer scores up to 160 points. A hint appears halfway through the round.',
    init: function (n, o, now) {
      var pool = MP_WORDS.filter(function (w) { return w.length >= 5 && w.length <= 10; });
      var words = mpPick(pool, o.rounds || 8);
      return { words: words, r: 1, total: words.length, word: words[0], scr: scramble(words[0]), phase: 'play', until: now + RMS, hint: false,
               solver: -1, gain: 0, feed: [], pts: mpZeros(n) };
    },
    reduce: function (st, a, i, now) {
      if (st.phase !== 'play' || a.k !== 'guess') return null;
      var w = mpLetters(a.w).slice(0, 20); if (!w) return null;
      if (w === st.word) {
        st.solver = i; st.gain = 100 + Math.round(60 * Math.max(0, (st.until - now)) / RMS);
        st.pts[i] += st.gain; st.phase = 'reveal'; st.until = now + 2800;
        st.feed.push({ i: i, ok: true });
      } else st.feed.push({ i: i, w: w });
      if (st.feed.length > 6) st.feed.shift();
      return st;
    },
    tick: function (st, now) {
      if (st.phase === 'play') {
        if (now >= st.until) { st.phase = 'reveal'; st.until = now + 2800; st.solver = -1; return st; }
        if (!st.hint && now >= st.until - RMS / 2) { st.hint = true; return st; }
      } else if (now >= st.until) {
        if (st.r >= st.total) return mpFinish(st, 'All words played.');
        st.r++; st.word = st.words[st.r - 1]; st.scr = scramble(st.word); st.phase = 'play';
        st.until = now + RMS; st.hint = false; st.solver = -1; st.gain = 0; st.feed = []; return st;
      }
      return null;
    },
    pub: function (st) {
      var rev = st.phase === 'reveal';
      return { r: st.r, total: st.total, scr: st.scr, len: st.word.length, phase: st.phase, until: st.until,
               hint: st.hint ? st.word.charAt(0) : '', word: rev ? st.word : null, solver: st.solver, gain: st.gain, feed: st.feed };
    },
    render: function (x) {
      var st = x.st, rev = st.phase === 'reveal';
      var h = '<div class="sc-wrap"><div class="mp-status"><span>Word ' + st.r + ' of ' + st.total + '</span><span class="mp-pill">' + st.len + ' letters</span></div>';
      if (!rev) h += mpBar(st.until, RMS);
      h += '<div class="sc-tiles">' + st.scr.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>';
      if (rev) {
        h += '<p class="sc-msg ' + (st.solver >= 0 ? 'is-ok' : 'is-no') + '">' +
             (st.solver >= 0 ? mpName(x, st.solver) + ' solved it! +' + st.gain : 'Time is up!') + ' The word was <b>' + mpEsc(st.word) + '</b>.</p>';
      } else {
        h += '<p class="mp-hint">' + (st.hint ? 'Hint: it starts with <b>' + mpEsc(st.hint) + '</b>' : 'Type your answer below') + '</p>' +
             '<div class="sc-form"><input type="text" id="sc-input" data-keep data-enter="sc-go" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="Your answer"' + (x.me < 0 ? ' disabled' : '') + ' />' +
             '<button type="button" class="btn btn-primary" id="sc-go"' + mpA({ k: 'guess', w: '@sc-input' }) + ' data-clear="sc-input"><i data-lucide="send"></i><span>Guess</span></button></div>';
      }
      if (st.feed.length) {
        h += '<div class="sc-feed">' + st.feed.map(function (f) {
          return '<div>' + mpDot(x, f.i) + '<b>' + mpName(x, f.i) + '</b> ' + (f.ok ? '<span class="is-ok">got it!</span>' : 'tried <code>' + mpEsc(f.w) + '</code>') + '</div>';
        }).join('') + '</div>';
      }
      return h + '</div>';
    }
  };
})();

/* ───────── 7. MEMORY CLASH ───────── */
(function () {
  var ICONS = ['heart', 'star', 'sun', 'moon', 'cloud', 'flag', 'bell', 'anchor'], TURN = 30000, HOLD = 1100;
  MP_GAMES.memoryclash = {
    min: 2, max: 4, opts: [],
    help: 'Flip two cards per turn. A matching pair is yours and you play again; a mismatch passes the turn. The player with the most pairs wins.',
    init: function (n, o, now) {
      var keys = mpShuffle(ICONS.concat(ICONS));
      return { cards: keys.map(function (k) { return { k: k, f: 'down', by: -1 }; }), turn: 0, first: -1, second: -1, phase: 'pick', until: now + TURN, pts: mpZeros(n) };
    },
    reduce: function (st, a, i, now) {
      if (st.phase !== 'pick' || a.k !== 'flip' || st.turn !== i) return null;
      var c = a.i | 0; if (c < 0 || c >= st.cards.length || st.cards[c].f !== 'down') return null;
      st.cards[c].f = 'up';
      if (st.first < 0) { st.first = c; st.until = now + TURN; return st; }
      st.second = c;
      if (st.cards[st.first].k === st.cards[c].k) {
        st.cards[st.first].f = 'done'; st.cards[c].f = 'done'; st.cards[st.first].by = i; st.cards[c].by = i;
        st.pts[i]++; st.first = -1; st.second = -1; st.until = now + TURN;
        if (st.cards.every(function (d) { return d.f === 'done'; })) return mpFinish(st, 'All pairs found!');
        return st;
      }
      st.phase = 'hold'; st.until = now + HOLD; return st;
    },
    tick: function (st, now) {
      if (st.phase === 'hold' && now >= st.until) {
        st.cards.forEach(function (d) { if (d.f === 'up') d.f = 'down'; });
        st.first = -1; st.second = -1; st.turn = mpNext(st, st.turn); st.phase = 'pick'; st.until = now + TURN; return st;
      }
      if (st.phase === 'pick' && (mpGone(st, st.turn) || now >= st.until)) {
        st.cards.forEach(function (d) { if (d.f === 'up') d.f = 'down'; });
        st.first = -1; st.second = -1; st.turn = mpNext(st, st.turn); st.until = now + TURN; return st;
      }
      return null;
    },
    turnOf: function (st) { return st.over ? -1 : st.turn; },
    pub: function (st) {
      return { turn: st.turn, phase: st.phase, until: st.until,
               cards: st.cards.map(function (d) { return { k: d.f === 'down' ? '' : d.k, f: d.f, by: d.by }; }) };
    },
    render: function (x) {
      var st = x.st, my = x.me === st.turn && st.phase === 'pick' && !st.over;
      var h = '<div class="mc-wrap"><div class="mp-status">' + mpDot(x, st.turn) + '<span>' +
              (st.over ? 'Board cleared' : (my ? 'Your turn — flip two cards' : mpName(x, st.turn) + ' is flipping…')) + '</span></div>';
      if (!st.over) h += mpBar(st.until, st.phase === 'hold' ? 1100 : 30000);
      h += '<div class="mc-grid">';
      st.cards.forEach(function (d, i) {
        var own = d.f === 'done' && d.by >= 0 ? ' style="--own:' + x.P[d.by].color + '"' : '';
        h += '<button type="button" class="mc-card is-' + d.f + '"' + own + (my && d.f === 'down' ? mpA({ k: 'flip', i: i }) : ' disabled') + ' aria-label="Card ' + (i + 1) + '">' +
             (d.f === 'down' ? '<i data-lucide="help-circle"></i>' : '<i data-lucide="' + d.k + '"></i>') + '</button>';
      });
      return h + '</div></div>';
    }
  };
})();

/* ───────── 8. PIG DICE RACE ───────── */
(function () {
  var TURN = 25000;
  function advance(st, now) { st.turn = mpNext(st, st.turn); st.cur = 0; st.die = 0; st.until = now + TURN; }
  MP_GAMES.pig = {
    min: 2, max: 6,
    opts: [{ id: 'target', label: 'Race to', choices: [30, 50, 100], def: 50 }],
    help: 'On your turn keep rolling to build up a turn total, then hold to bank it. Roll a 1 and you lose the turn total and your turn. First to the target score wins.',
    init: function (n, o, now) { return { turn: 0, cur: 0, die: 0, rollId: 0, bust: false, target: o.target || 50, until: now + TURN, pts: mpZeros(n), log: '' }; },
    reduce: function (st, a, i, now) {
      if (st.over || st.turn !== i) return null;
      if (a.k === 'roll') {
        var d = 1 + mpRand(6); st.die = d; st.rollId++;
        if (d === 1) { st.bust = true; st.log = 'rolled a 1 and lost ' + st.cur + ' points'; var who = st.turn; advance(st, now); st.die = 1; st.lastBy = who; }
        else { st.bust = false; st.cur += d; st.until = now + TURN; st.log = ''; }
        return st;
      }
      if (a.k === 'hold') {
        if (st.cur <= 0) return null;
        st.pts[i] += st.cur; st.bust = false; st.log = 'banked ' + st.cur; st.lastBy = i;
        if (st.pts[i] >= st.target) { st.cur = 0; return mpFinish(st, 'Reached ' + st.target + ' points!'); }
        advance(st, now); return st;
      }
      return null;
    },
    tick: function (st, now) {
      if (mpGone(st, st.turn)) { advance(st, now); return st; }
      if (now >= st.until) {
        if (st.cur > 0) return MP_GAMES.pig.reduce(st, { k: 'hold' }, st.turn, now);
        advance(st, now); return st;
      }
      return null;
    },
    turnOf: function (st) { return st.over ? -1 : st.turn; },
    onSend: function (local, a) { if (a.k === 'roll') local.rolling = Date.now(); },
    render: function (x) {
      var st = x.st, my = x.me === st.turn && !st.over;
      var h = '<div class="pig-wrap"><div class="mp-status">' + mpDot(x, st.turn) + '<span>' +
              (st.over ? mpName(x, st.turn) + ' wins!' : (my ? 'Your turn' : mpName(x, st.turn) + ' is rolling…')) + '</span><span class="mp-pill">Race to ' + st.target + '</span></div>';
      if (!st.over) h += mpBar(st.until, 25000);
      h += '<div class="pig-stage ' + (st.bust ? 'is-bust' : '') + '" data-roll="' + st.rollId + '">' + mpDie(st.die) +
           '<div class="pig-cur"><small>Turn total</small><strong>' + st.cur + '</strong></div></div>';
      if (st.log && st.lastBy !== undefined) h += '<p class="mp-hint">' + mpName(x, st.lastBy) + ' ' + mpEsc(st.log) + '.</p>';
      h += '<div class="pig-actions"><button type="button" class="btn btn-primary"' + (my ? mpA({ k: 'roll' }) : ' disabled') + '><i data-lucide="dice-5"></i><span>Roll</span></button>' +
           '<button type="button" class="btn btn-outline"' + (my && st.cur > 0 ? mpA({ k: 'hold' }) : ' disabled') + '><i data-lucide="hand"></i><span>Hold &amp; bank ' + st.cur + '</span></button></div>';
      return h + '</div>';
    }
  };
})();

/* ───────── 9. TAP RUSH ───────── */
(function () {
  MP_GAMES.taprush = {
    min: 2, max: 8,
    opts: [{ id: 'secs', label: 'Seconds', choices: [10, 15, 20], def: 10 }],
    help: 'When the countdown ends, tap (or press space) as fast as you can. The player with the most taps when time runs out wins.',
    init: function (n, o, now) {
      var start = now + 3600, secs = o.secs || 10;
      return { phase: 'count', startAt: start, endAt: start + secs * 1000, secs: secs, taps: mpZeros(n), pts: mpZeros(n) };
    },
    reduce: function (st, a, i, now) {
      if (a.k !== 't' || st.phase === 'done' || now < st.startAt - 150 || now > st.endAt + 1500) return null;
      var elapsed = Math.min(now, st.endAt + 300) - st.startAt;
      var cap = Math.floor(Math.max(0, elapsed) / 1000 * 16) + 6;
      var n = Math.min(a.n | 0, cap);
      if (n > st.taps[i]) { st.taps[i] = n; st.pts[i] = n; return st; }
      return null;
    },
    tick: function (st, now) {
      if (st.phase === 'count' && now >= st.startAt) { st.phase = 'run'; return st; }
      if ((st.phase === 'run' || st.phase === 'count') && now >= st.endAt + 1500) { st.phase = 'done'; return mpFinish(st, 'Time!'); }
      return null;
    },
    pub: function (st) { return { phase: st.phase, startAt: st.startAt, endAt: st.endAt, secs: st.secs, taps: st.taps }; },
    mount: function (x) {
      var L = x.local; L.count = 0; L.finalSent = false;
      x.stage.innerHTML = '<div class="tr-wrap"><div class="mp-status"><span id="tr-status">Get ready…</span></div>' +
        '<div class="tr-clock" id="tr-clock">3</div>' +
        '<button type="button" class="tr-btn" id="tr-btn" disabled><i data-lucide="mouse-pointer-click"></i><strong id="tr-count">0</strong><small>taps</small></button>' +
        '<div class="tr-bars" id="tr-bars"></div></div>';
      if (window.lucide) window.lucide.createIcons();
      var btn = document.getElementById('tr-btn');
      function flush() {
        L.flushT = null;
        x.send({ k: 't', n: L.count });
      }
      function tap(e) {
        if (e) e.preventDefault();
        var st = L.st; if (!st || x.me < 0) return;
        var t = x.now();
        if (t < st.startAt || t > st.endAt) return;
        L.count++;
        document.getElementById('tr-count').textContent = L.count;
        if (!L.flushT) L.flushT = setTimeout(flush, 220);
      }
      btn.addEventListener('pointerdown', tap);
      L.key = function (e) { if (e.code === 'Space') tap(e); };
      document.addEventListener('keydown', L.key);
      L.iv = setInterval(function () {
        var st = L.st; if (!st) return;
        var t = x.now(), clock = document.getElementById('tr-clock'), status = document.getElementById('tr-status');
        if (!clock) return;
        if (t < st.startAt) { clock.textContent = Math.max(1, Math.ceil((st.startAt - t) / 1000)); status.textContent = 'Get ready…'; btn.disabled = true; }
        else if (t <= st.endAt) { clock.textContent = Math.max(0, Math.ceil((st.endAt - t) / 1000)); status.textContent = 'TAP TAP TAP!'; btn.disabled = false; clock.classList.add('is-run'); }
        else {
          clock.textContent = '0'; status.textContent = 'Time!'; btn.disabled = true;
          if (!L.finalSent && x.me >= 0) { L.finalSent = true; if (L.flushT) { clearTimeout(L.flushT); L.flushT = null; } x.send({ k: 't', n: L.count }); }
        }
      }, 80);
    },
    update: function (x) {
      var L = x.local, st = x.st; L.st = st;
      var bars = document.getElementById('tr-bars'); if (!bars) return;
      var mx = Math.max(10, Math.max.apply(null, st.taps));
      bars.innerHTML = st.taps.map(function (n, i) {
        return '<div class="tr-row">' + mpDot(x, i) + '<b>' + mpName(x, i) + (i === x.me ? ' (you)' : '') + '</b><div class="tr-track"><div class="tr-fill" style="width:' + Math.round(n / mx * 100) + '%;background:' + x.P[i].color + '"></div></div><em>' + n + '</em></div>';
      }).join('');
    },
    destroy: function (L) {
      if (L.iv) clearInterval(L.iv);
      if (L.flushT) clearTimeout(L.flushT);
      if (L.key) document.removeEventListener('keydown', L.key);
    }
  };
})();

/* ───────── 10. DRAW & GUESS ───────── */
(function () {
  var DMS = 60000, BMS = 3800, COLORS = ['#1A1A2E', '#D41367', '#2B7DE9', '#1FA971', '#F2A413', '#8E44EC'];
  function maskOf(st) {
    return st.word.split('').map(function (ch, k) { return ch === ' ' ? ' ' : (st.rev.indexOf(k) !== -1 ? ch : '_'); }).join('');
  }
  function startTurn(st, now) {
    var o = st.order = st.order || [], d = o[st.turnNo % o.length];
    if (mpGone(st, d)) d = mpNext(st, d);
    st.drawer = d; st.word = st.words[st.turnNo]; st.rev = []; st.phase = 'draw'; st.until = now + DMS; st.guessed = []; st.feed = []; st.sk++;
  }
  function endTurn(st, now) { st.phase = 'between'; st.until = now + BMS; return st; }
  MP_GAMES.drawguess = {
    min: 2, max: 8,
    opts: [{ id: 'turns', label: 'Turns each', choices: [1, 2], def: 1 }],
    help: 'Each turn one player gets a secret word and draws it. Everyone else types guesses — the faster you guess, the more you score, and the artist earns points too.',
    init: function (n, o, now) {
      var turns = (o.turns || 1) * n, st = { words: mpPick(MP_DRAW_WORDS, turns), turnNo: 0, total: turns, order: [], sk: 0, pts: mpZeros(n), drawer: 0 };
      for (var i = 0; i < n; i++) st.order.push(i);
      startTurn(st, now); return st;
    },
    reduce: function (st, a, i, now) {
      if (st.phase !== 'draw' || a.k !== 'guess' || i === st.drawer || st.guessed.indexOf(i) !== -1) return null;
      var w = mpLetters(a.w).slice(0, 24); if (!w) return null;
      if (w === mpLetters(st.word)) {
        var g = 50 + Math.round(50 * Math.max(0, st.until - now) / DMS);
        st.pts[i] += g; st.pts[st.drawer] += 30; st.guessed.push(i); st.feed.push({ i: i, ok: true });
        if (mpActive(st).every(function (j) { return j === st.drawer || st.guessed.indexOf(j) !== -1; })) endTurn(st, now);
      } else st.feed.push({ i: i, w: w });
      if (st.feed.length > 7) st.feed.shift();
      return st;
    },
    tick: function (st, now) {
      if (st.phase === 'draw') {
        if (mpGone(st, st.drawer) || now >= st.until) return endTurn(st, now);
        var el = (DMS - (st.until - now)) / DMS, want = el > 0.7 ? 2 : (el > 0.4 ? 1 : 0), letters = 0;
        if (st.rev.length < want) {
          var hid = []; st.word.split('').forEach(function (ch, k) { if (ch !== ' ' && st.rev.indexOf(k) === -1) hid.push(k); });
          if (hid.length > 2) { st.rev.push(hid[mpRand(hid.length)]); return st; }
        }
      } else if (now >= st.until) {
        st.turnNo++;
        if (st.turnNo >= st.total) return mpFinish(st, 'Everyone has had a turn.');
        startTurn(st, now); return st;
      }
      return null;
    },
    secret: function (st) { var o = {}; o[st.drawer] = st.word; return o; },
    turnOf: function (st) { return st.over ? -1 : st.drawer; },
    pub: function (st) {
      return { drawer: st.drawer, phase: st.phase, until: st.until, turnNo: st.turnNo, total: st.total, mask: maskOf(st), guessed: st.guessed,
               feed: st.feed, word: st.phase === 'between' ? st.word : null };
    },
    mount: function (x) {
      var L = x.local; L.color = COLORS[0]; L.size = 5; L.turnNo = -1; L.buf = [];
      x.stage.innerHTML =
        '<div class="dg-wrap"><div class="mp-status"><span id="dg-role"></span><span class="mp-clock" id="dg-clock">--</span></div>' +
        '<div class="mp-bar"><div class="mp-bar-fill" id="dg-bar"></div></div>' +
        '<div class="dg-word" id="dg-word"></div>' +
        '<canvas id="dg-canvas" class="dg-canvas" width="640" height="400"></canvas>' +
        '<div class="dg-tools" id="dg-tools">' +
          COLORS.map(function (c, k) { return '<button type="button" class="dg-sw' + (k === 0 ? ' is-on' : '') + '" data-color="' + c + '" style="background:' + c + '" aria-label="Colour ' + (k + 1) + '"></button>'; }).join('') +
          '<button type="button" class="dg-tool" data-size="3" aria-label="Thin"><i class="dg-dot s"></i></button>' +
          '<button type="button" class="dg-tool is-on" data-size="5" aria-label="Medium"><i class="dg-dot m"></i></button>' +
          '<button type="button" class="dg-tool" data-size="10" aria-label="Thick"><i class="dg-dot l"></i></button>' +
          '<button type="button" class="dg-tool" data-color="#FFFFFF" aria-label="Eraser"><i data-lucide="eraser"></i></button>' +
          '<button type="button" class="dg-tool" id="dg-clear" aria-label="Clear"><i data-lucide="trash-2"></i></button></div>' +
        '<div class="sc-feed dg-feed" id="dg-feed"></div>' +
        '<div class="sc-form" id="dg-guess"><input type="text" id="dg-input" data-keep data-enter="dg-send" autocomplete="off" spellcheck="false" maxlength="24" placeholder="Type your guess" />' +
        '<button type="button" class="btn btn-primary" id="dg-send"' + mpA({ k: 'guess', w: '@dg-input' }) + ' data-clear="dg-input"><i data-lucide="send"></i><span>Guess</span></button></div></div>';
      if (window.lucide) window.lucide.createIcons();
      var cv = document.getElementById('dg-canvas'), cx = cv.getContext('2d');
      cx.fillStyle = '#FFFFFF'; cx.fillRect(0, 0, cv.width, cv.height);
      L.cv = cv; L.cx = cx;
      function pos(e) { var r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; }
      function flush() {
        L.flushT = null;
        if (L.buf.length > 1) { x.raw({ t: 's', c: L.color, w: L.size, p: L.buf }); L.buf = [L.buf[L.buf.length - 1]]; }
      }
      cv.addEventListener('pointerdown', function (e) {
        var st = L.st; if (!st || st.phase !== 'draw' || x.me !== st.drawer) return;
        e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        L.drawing = true; var p = pos(e); L.buf = [p, p];
        MP_GAMES.drawguess.seg(L, { c: L.color, w: L.size, p: [p, p] });
        if (!L.flushT) L.flushT = setTimeout(flush, 150);
      });
      cv.addEventListener('pointermove', function (e) {
        if (!L.drawing) return; e.preventDefault();
        var p = pos(e), prev = L.buf[L.buf.length - 1];
        MP_GAMES.drawguess.seg(L, { c: L.color, w: L.size, p: [prev, p] });
        L.buf.push(p);
        if (!L.flushT) L.flushT = setTimeout(flush, 150);
      });
      function up() { if (!L.drawing) return; L.drawing = false; if (L.flushT) { clearTimeout(L.flushT); L.flushT = null; } flush(); L.buf = []; }
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      document.getElementById('dg-tools').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.id === 'dg-clear') { MP_GAMES.drawguess.clear(L); x.raw({ t: 'c' }); return; }
        if (b.getAttribute('data-color')) { L.color = b.getAttribute('data-color'); }
        if (b.getAttribute('data-size')) { L.size = +b.getAttribute('data-size'); }
        Array.prototype.forEach.call(document.querySelectorAll('#dg-tools .is-on'), function (n) {
          var isColor = !!n.getAttribute('data-color'), pressedColor = !!b.getAttribute('data-color');
          if (isColor === pressedColor) n.classList.remove('is-on');
        });
        b.classList.add('is-on');
      });
    },
    seg: function (L, s) {
      var cx = L.cx, cv = L.cv; if (!cx) return;
      cx.strokeStyle = s.c; cx.fillStyle = s.c; cx.lineWidth = s.w * (cv.width / 640); cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.beginPath(); cx.moveTo(s.p[0][0] * cv.width, s.p[0][1] * cv.height);
      for (var k = 1; k < s.p.length; k++) cx.lineTo(s.p[k][0] * cv.width, s.p[k][1] * cv.height);
      if (s.p.length === 2 && s.p[0][0] === s.p[1][0] && s.p[0][1] === s.p[1][1]) { cx.arc(s.p[0][0] * cv.width, s.p[0][1] * cv.height, s.w * (cv.width / 640) / 2, 0, 6.2832); cx.fill(); }
      else cx.stroke();
    },
    clear: function (L) { if (!L.cx) return; L.cx.fillStyle = '#FFFFFF'; L.cx.fillRect(0, 0, L.cv.width, L.cv.height); },
    onRaw: function (x, from, e) {
      var L = x.local, st = L.st; if (!st || from !== st.drawer || from === x.me) return;
      if (e.t === 'c') MP_GAMES.drawguess.clear(L);
      else if (e.t === 's' && e.p && e.p.length > 1 && e.p.length < 200) MP_GAMES.drawguess.seg(L, { c: String(e.c).slice(0, 9), w: Math.max(1, Math.min(14, +e.w || 4)), p: e.p });
    },
    update: function (x) {
      var L = x.local, st = x.st, G = MP_GAMES.drawguess; L.st = st;
      if (L.turnNo !== st.turnNo) { L.turnNo = st.turnNo; G.clear(L); L.sec = ''; }
      var isD = x.me === st.drawer, role = document.getElementById('dg-role'), word = document.getElementById('dg-word');
      var tools = document.getElementById('dg-tools'), guess = document.getElementById('dg-guess');
      if (!role) return;
      role.innerHTML = st.phase === 'between' ? 'Turn over' : (isD ? 'You are drawing' : mpDot(x, st.drawer) + mpName(x, st.drawer) + ' is drawing');
      if (st.phase === 'between') word.innerHTML = 'The word was <b>' + mpEsc(st.word) + '</b>';
      else if (isD) word.innerHTML = 'Draw: <b>' + mpEsc(L.sec || '…') + '</b>';
      else word.textContent = st.mask.split('').join(' ');
      tools.style.display = (isD && st.phase === 'draw') ? 'flex' : 'none';
      var me = st.guessed.indexOf(x.me) !== -1;
      guess.style.display = (!isD && st.phase === 'draw' && !me && x.me >= 0) ? 'flex' : 'none';
      document.getElementById('dg-feed').innerHTML = st.feed.map(function (f) {
        return '<div>' + mpDot(x, f.i) + '<b>' + mpName(x, f.i) + '</b> ' + (f.ok ? '<span class="is-ok">guessed the word!</span>' : mpEsc(f.w)) + '</div>';
      }).join('');
      var cl = document.getElementById('dg-clock'); cl.setAttribute('data-until', st.until);
      var bar = document.getElementById('dg-bar'); bar.setAttribute('data-bar', ''); bar.setAttribute('data-until', st.until); bar.setAttribute('data-total', st.phase === 'draw' ? DMS : BMS);
    },
    onSecret: function (x, d) { x.local.sec = d; x.local.secNext = d; var w = document.getElementById('dg-word'); if (w && x.local.st && x.me === x.local.st.drawer) w.innerHTML = 'Draw: <b>' + mpEsc(d) + '</b>'; },
    destroy: function (L) { if (L.flushT) clearTimeout(L.flushT); }
  };
})();

/* ============================================================
   MULTIPLAYER ROOM ENGINE
   Lifecycle: entry → connecting → lobby → playing → done → (lobby again | closed)
   A room CLOSES when: the host presses Close room, the host leaves or loses connection,
   10 minutes pass without any action, or 3 minutes pass on the results screen.
   ============================================================ */
function mpToast(t, m) { try { if (typeof window.showToast === 'function') window.showToast(t, m); } catch (e) { /* silent */ } }
function mpSavedName() { try { return localStorage.getItem('rac_mp_name') || ''; } catch (e) { return ''; } }
function mpSaveName(n) { try { localStorage.setItem('rac_mp_name', n); } catch (e) { /* silent */ } }
function mpMyId() {
  try { var v = sessionStorage.getItem('rac_mp_pid'); if (!v) { v = mpId(); sessionStorage.setItem('rac_mp_pid', v); } return v; }
  catch (e) { return mpId(); }
}
function mpCfg(id) { var c = window.GAMES_CONFIG || []; for (var i = 0; i < c.length; i++) if (c[i].id === id) return c[i]; return null; }
function mpCopy(text, done) {
  function fb() {
    var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* silent */ } t.remove(); done();
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fb); else fb();
}

function MpRoom(mgr, cfg) {
  this.mgr = mgr; this.cfg = cfg || null; this.gameId = cfg ? cfg.id : null; this.spec = cfg ? MP_GAMES[cfg.id] : null;
  this.root = document.getElementById('game-play-area');
  this.pid = mpMyId(); this.name = mpSavedName();
  this.status = 'entry'; this.ch = null; this.db = null; this.code = ''; this.isHost = false;
  this.full = null; this.pub = null; this.players = []; this.me = -1; this.opts = {}; this.ver = 0; this.lastBc = 0;
  this.skew = 0; this.local = {}; this.mounted = false; this.stage = null; this.lastHtml = '';
  this.gotState = false; this.destroyed = false; this.kicked = {}; this.missing = {}; this.lastAct = Date.now();
  this.resultsAt = 0; this.scoreSaved = false; this.helloN = 0; this.lastHello = 0; this.retries = 0;
  var self = this;
  this._click = function (e) { self._onClick(e); };
  this._key = function (e) {
    if (e.key === 'Enter' && e.target && e.target.getAttribute && e.target.getAttribute('data-enter')) {
      e.preventDefault(); var b = document.getElementById(e.target.getAttribute('data-enter')); if (b) b.click();
    }
  };
  this._change = function (e) {
    var o = e.target && e.target.getAttribute && e.target.getAttribute('data-mp-opt');
    if (o && self.isHost) { self.opts[o] = +e.target.value; self.lastAct = Date.now(); self._bc(true); }
  };
  this._pagehide = function () { self._farewell(); };
  this.root.addEventListener('click', this._click);
  this.root.addEventListener('keydown', this._key);
  this.root.addEventListener('change', this._change);
  window.addEventListener('pagehide', this._pagehide);
  this.uiT = setInterval(function () { self._uiTick(); }, 200);
  this.hostT = null;
}
var RM = MpRoom.prototype;

RM._now = function () { return Date.now() + (this.isHost ? 0 : this.skew); };
RM._defaults = function () {
  var o = {}; ((this.spec && this.spec.opts) || []).forEach(function (d) { o[d.id] = d.def; }); return o;
};

/* ---------- screens ---------- */
RM._top = function () {
  var title = this.cfg ? this.cfg.name : 'Multiplayer room', icon = this.cfg ? this.cfg.icon : 'users';
  var chip = this.code && this.status !== 'closed' ? '<button type="button" class="mp-chip" data-mp="copy-code" title="Copy room code"><i data-lucide="copy"></i><span>' + this.code + '</span></button>' : '';
  return '<div class="g-hdr mp-top"><button type="button" class="btn btn-outline btn-sm" data-mp="leave"><i data-lucide="' + (this.status === 'entry' || this.status === 'closed' ? 'arrow-left' : 'log-out') + '"></i><span>' +
    (this.status === 'entry' || this.status === 'closed' ? 'Back' : (this.isHost ? 'Close room' : 'Leave room')) + '</span></button>' +
    '<div class="g-hdr-title"><h2 class="g-hdr-h2"><i data-lucide="' + icon + '"></i>' + mpEsc(title) + '</h2><span class="mp-pill">Multiplayer</span></div>' + chip + '</div>';
};
RM._set = function (html) {
  this.root.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
};
RM.showEntry = function (code) {
  this.status = 'entry';
  var c = this.cfg, h = this._top() + '<div class="mp-card neu-card"><div class="mp-entry">';
  if (c) {
    h += '<div class="mp-hero"><span class="mp-hero-ico"><i data-lucide="' + c.icon + '"></i></span><div><h3>' + mpEsc(c.name) + '</h3><p>' + mpEsc(c.description) + '</p>' +
         '<span class="mp-pill"><i data-lucide="users"></i> ' + (c.min === c.max ? c.min : c.min + '–' + c.max) + ' players</span></div></div>' +
         '<p class="mp-how"><b>How to play:</b> ' + mpEsc(this.spec.help) + '</p>';
  } else {
    h += '<div class="mp-hero"><span class="mp-hero-ico"><i data-lucide="door-open"></i></span><div><h3>Join a room</h3><p>Enter the 4-letter code your host shared with you.</p></div></div>';
  }
  h += '<label class="mp-lbl" for="mp-name">Your nickname</label><div class="input-wrap"><input id="mp-name" class="form-input" maxlength="16" placeholder="e.g. Priya" value="' + mpEsc(this.name) + '" data-keep data-enter="' + (c && !code ? 'mp-create' : 'mp-join') + '" autocomplete="off" /></div>';
  if (c && !code) h += '<button type="button" class="btn btn-primary mp-wide" id="mp-create" data-mp="create"><i data-lucide="plus"></i><span>Create a room</span></button><div class="mp-or"><span>or join a friend</span></div>';
  h += '<div class="mp-join"><div class="input-wrap"><input id="mp-code" class="form-input mp-code-in" maxlength="4" placeholder="CODE" value="' + mpEsc(code || '') + '" data-keep data-enter="mp-join" autocomplete="off" spellcheck="false" /></div>' +
       '<button type="button" class="btn ' + (c && !code ? 'btn-outline' : 'btn-primary') + '" id="mp-join" data-mp="join"><i data-lucide="log-in"></i><span>Join room</span></button></div>' +
       '<p class="mp-hint">Everyone opens this page on their own device. The room closes automatically when the host leaves or after a period of inactivity.</p></div></div>';
  this._set(h);
};
RM._connectingHtml = function (msg) {
  return this._top() + '<div class="mp-card neu-card mp-center"><i data-lucide="loader-2" class="mp-spin"></i><h3>' + mpEsc(msg) + '</h3></div>';
};
RM._closedHtml = function (msg, title) {
  return this._top() + '<div class="mp-card neu-card mp-center"><span class="mp-hero-ico is-warn"><i data-lucide="door-closed"></i></span><h3>' + mpEsc(title || 'Room closed') + '</h3><p>' + mpEsc(msg) + '</p>' +
    '<button type="button" class="btn btn-primary" data-mp="home"><i data-lucide="arrow-left"></i><span>Back to games</span></button></div>';
};
RM._lobbyHtml = function () {
  var spec = this.spec, cfg = this.cfg || {}, ros = this._roster(), me = this;
  var link = location.origin + location.pathname + '?room=' + this.code;
  var h = this._top() + '<div class="mp-card neu-card mp-lobby"><div class="mp-code-box"><small>Room code</small><strong>' + this.code + '</strong>' +
    '<div class="mp-code-actions"><button type="button" class="btn btn-outline btn-sm" data-mp="copy-code"><i data-lucide="copy"></i><span>Copy code</span></button>' +
    '<button type="button" class="btn btn-outline btn-sm" data-mp="copy-link"><i data-lucide="link"></i><span>Copy invite link</span></button></div></div>';
  h += '<div class="mp-sec"><h4>Players <span class="mp-pill">' + ros.length + ' / ' + spec.max + '</span></h4><div class="mp-roster">';
  ros.forEach(function (r, i) {
    h += '<div class="mp-pl"><span class="mp-av" style="background:' + MP_COLORS[i % 8] + '">' + mpEsc((r.name || '?').charAt(0).toUpperCase()) + '</span><b>' + mpEsc(r.name) + '</b>' +
         (r.host ? '<i data-lucide="crown" title="Host"></i>' : '') + (r.pid === me.pid ? '<em>You</em>' : '') + '</div>';
  });
  h += '</div>' + (ros.length < spec.min ? '<p class="mp-hint">Waiting for at least ' + spec.min + ' players…</p>' : '') + '</div>';
  if (this.isHost && spec.opts.length) {
    h += '<div class="mp-sec"><h4>Game settings</h4><div class="mp-opts">' + spec.opts.map(function (d) {
      return '<label>' + mpEsc(d.label) + '<select class="form-select" data-mp-opt="' + d.id + '">' + d.choices.map(function (c) {
        return '<option value="' + c + '"' + (me.opts[d.id] === c ? ' selected' : '') + '>' + c + '</option>';
      }).join('') + '</select></label>';
    }).join('') + '</div></div>';
  } else if (spec.opts.length) {
    h += '<div class="mp-sec"><h4>Game settings</h4><p class="mp-hint">' + spec.opts.map(function (d) { return mpEsc(d.label) + ': <b>' + me.opts[d.id] + '</b>'; }).join(' · ') + '</p></div>';
  }
  h += '<p class="mp-how"><b>How to play:</b> ' + mpEsc(spec.help) + '</p><div class="mp-actions">' +
    (this.isHost ? '<button type="button" class="btn btn-primary" data-mp="start"' + (ros.length < spec.min ? ' disabled' : '') + '><i data-lucide="play"></i><span>Start game</span></button>'
                 : '<p class="mp-hint"><i data-lucide="hourglass"></i> Waiting for the host to start…</p>') + '</div></div>';
  return h;
};
RM._resultsHtml = function () {
  var st = this.pub, me = this, idx = st.pts.map(function (_, i) { return i; }).sort(function (a, b) { return st.pts[b] - st.pts[a]; });
  var top = st.pts[idx[0]], win = top > 0 ? idx.filter(function (i) { return st.pts[i] === top; }) : [];
  var h = this._top() + '<div class="mp-card neu-card mp-results"><div class="mp-trophy"><i data-lucide="trophy"></i></div><h3>' +
    (win.length === 0 ? 'No winner this time' : win.length > 1 ? 'It is a tie!' : mpEsc(this.players[win[0]].name) + ' wins!') + '</h3>' +
    (st.note ? '<p class="mp-hint">' + mpEsc(st.note) + '</p>' : '') + '<div class="mp-rank">';
  var shown = 0;
  idx.forEach(function (i, r) {
    var isW = win.indexOf(i) !== -1, p = me.players[i];
    h += '<div class="mp-rk' + (isW ? ' is-win' : '') + '"><span class="mp-pos">' + (r < 3 && isW ? '<i data-lucide="' + ['crown', 'medal', 'award'][Math.min(r, 2)] + '"></i>' : (r + 1)) + '</span>' +
         '<span class="mp-av" style="background:' + p.color + '">' + mpEsc(p.name.charAt(0).toUpperCase()) + '</span><b>' + mpEsc(p.name) + (i === me.me ? ' <em>You</em>' : '') +
         (st.gone && st.gone[i] ? ' <small>(left)</small>' : '') + '</b><strong>' + st.pts[i] + '</strong></div>';
    shown++;
  });
  h += '</div><div class="mp-actions">' + (this.isHost
    ? '<button type="button" class="btn btn-primary" data-mp="again"><i data-lucide="rotate-ccw"></i><span>Play again</span></button><button type="button" class="btn btn-outline" data-mp="leave"><i data-lucide="door-closed"></i><span>Close room</span></button>'
    : '<p class="mp-hint"><i data-lucide="hourglass"></i> Waiting for the host to start another round or close the room…</p><button type="button" class="btn btn-outline" data-mp="leave"><i data-lucide="log-out"></i><span>Leave room</span></button>') + '</div></div>';
  return h;
};
RM._boardHtml = function () {
  var st = this.pub, me = this, turn = this.spec.turnOf ? this.spec.turnOf(st) : -1;
  return '<h4>Scoreboard</h4>' + this.players.map(function (p, i) {
    return '<div class="mp-sb' + (i === turn ? ' is-turn' : '') + (st.gone && st.gone[i] ? ' is-gone' : '') + '"><span class="mp-av" style="background:' + p.color + '">' + mpEsc(p.name.charAt(0).toUpperCase()) + '</span>' +
      '<b>' + mpEsc(p.name) + (i === me.me ? ' <em>You</em>' : '') + (p.host ? ' <i data-lucide="crown"></i>' : '') + '</b><strong>' + (st.pts[i] || 0) + '</strong></div>';
  }).join('');
};

/* ---------- painting ---------- */
RM._ctx = function () {
  var self = this;
  return { st: this.pub, P: this.players, me: this.me, n: this.players.length, isHost: this.isHost, local: this.local, stage: this.stage, opts: this.opts,
           send: function (a) { self.send(a); }, raw: function (e) { self._raw(e); }, now: function () { return self._now(); } };
};
RM._unmount = function () {
  if (this.mounted && this.spec && this.spec.destroy) { try { this.spec.destroy(this.local); } catch (e) { /* silent */ } }
  this.mounted = false; this.stage = null; this.lastHtml = '';
};
RM._setStage = function (html) {
  if (!this.stage || html === this.lastHtml) return;
  var a = document.activeElement, keep = null;
  if (a && a.getAttribute && a.getAttribute('data-keep') && this.stage.contains(a)) keep = { id: a.id, v: a.value, s: a.selectionStart, e: a.selectionEnd };
  this.stage.innerHTML = html; this.lastHtml = html;
  if (window.lucide) window.lucide.createIcons();
  if (keep) { var el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch (e) { /* silent */ } } }
};
RM._render = function () {
  if (this.destroyed) return;
  var s = this.status;
  if (s === 'playing' && this.pub && this.spec) {
    if (!this.mounted) {
      this._set(this._top() + '<div class="mp-play"><div class="mp-stage neu-card" id="mp-stage"></div><aside class="mp-board neu-card" id="mp-board"></aside></div>');
      this.stage = document.getElementById('mp-stage'); this.mounted = true; this.lastHtml = '';
      if (this.spec.mount) this.spec.mount(this._ctx());
    }
    var b = document.getElementById('mp-board'); if (b) { b.innerHTML = this._boardHtml(); }
    if (this.spec.update) this.spec.update(this._ctx()); else this._setStage(this.spec.render(this._ctx()));
    if (window.lucide) window.lucide.createIcons();
    return;
  }
  this._unmount();
  if (s === 'lobby') this._set(this._lobbyHtml());
  else if (s === 'done' && this.pub) this._set(this._resultsHtml());
  else if (s === 'connecting') this._set(this._connectingHtml(this.isHost ? 'Creating your room…' : 'Looking for the room…'));
};
RM._uiTick = function () {
  if (!this.root) return;
  var now = this._now(), els = this.root.querySelectorAll('[data-until]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i], u = +el.getAttribute('data-until'), rem = Math.max(0, u - now);
    if (el.hasAttribute('data-bar')) { var t = +el.getAttribute('data-total') || 1; el.style.width = Math.min(100, rem / t * 100) + '%'; }
    else el.textContent = Math.ceil(rem / 1000);
  }
};

/* ---------- connection ---------- */
RM._readName = function () {
  var el = document.getElementById('mp-name'), n = el ? el.value.replace(/\s+/g, ' ').trim().slice(0, 16) : this.name;
  if (!n) n = 'Player' + (100 + mpRand(900));
  this.name = n; mpSaveName(n); return n;
};
RM.create = function () { this._readName(); this._connect(mpCode(), true); };
RM.join = function (code) {
  this._readName(); code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { mpToast('Room code', 'Enter the 4-character room code.'); return; }
  this._connect(code, false);
};
RM._connect = function (code, asHost) {
  var self = this;
  var db = this.db = window.getSupabaseClient ? window.getSupabaseClient() : null;
  if (!db || !db.channel) { this._fail('Multiplayer needs an internet connection and the Supabase library.'); return; }
  this.code = code; this.isHost = asHost; this.status = 'connecting'; this.gotState = false;
  if (asHost) { this.opts = this._defaults(); }
  this._render();
  var ch = this.ch = db.channel('rac-games-' + code, { config: { broadcast: { self: false, ack: false }, presence: { key: this.pid } } });
  ch.on('broadcast', { event: 'st' }, function (m) { self._onSt(m.payload); });
  ch.on('broadcast', { event: 'a' }, function (m) { if (self.isHost && m.payload) self._hostApply(m.payload.pid, m.payload.a); });
  ch.on('broadcast', { event: 'hello' }, function () { if (self.isHost) self._bc(true); });
  ch.on('broadcast', { event: 'sec' }, function (m) {
    var p = m.payload; if (!p || p.to !== self.pid) return;
    self.local.sec = p.d; self.local.secNext = p.d;
    if (self.mounted && self.spec.onSecret) self.spec.onSecret(self._ctx(), p.d);
  });
  ch.on('broadcast', { event: 'x' }, function (m) {
    var p = m.payload; if (!p || !self.mounted || !self.spec.onRaw) return;
    var idx = -1; for (var i = 0; i < self.players.length; i++) if (self.players[i].pid === p.pid) idx = i;
    if (idx >= 0) self.spec.onRaw(self._ctx(), idx, p.e || {});
  });
  ch.on('broadcast', { event: 'ctl' }, function (m) { self._onCtl(m.payload || {}); });
  ch.on('presence', { event: 'sync' }, function () { self._onPresence(); });
  ch.subscribe(function (s) {
    if (self.destroyed) return;
    if (s === 'SUBSCRIBED') {
      Promise.resolve(ch.track({ pid: self.pid, name: self.name, host: asHost, t: Date.now() })).then(function () { self._subscribed(); });
    } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
      self._fail('Could not reach the multiplayer server. Make sure Realtime is enabled for the Supabase project, then try again.');
    }
  });
};
RM._subscribed = function () {
  var self = this;
  if (this.destroyed) return;
  if (this.isHost) {
    setTimeout(function () {
      if (self.destroyed) return;
      var other = self._roster().filter(function (r) { return r.host && r.pid !== self.pid; });
      if (other.length && self.retries < 4) {
        self.retries++; var old = self.ch; self.ch = null; try { old.untrack(); self.db.removeChannel(old); } catch (e) { /* silent */ }
        self._connect(mpCode(), true); return;
      }
      self.status = 'lobby'; self.lastAct = Date.now();
      self.hostT = setInterval(function () { self._hostTick(); }, 350);
      self._bc(true); self._render();
    }, 900);
  } else {
    this.joinT = setTimeout(function () {
      if (!self.gotState && !self.destroyed) self._fail('Room not found, or it has already closed. Check the code and try again.', 'Could not join');
    }, 4500);
    this.helloIv = setInterval(function () {
      if (self.gotState || self.destroyed || !self.ch || self.helloN >= 6) { clearInterval(self.helloIv); self.helloIv = null; return; }
      self.helloN++; self.ch.send({ type: 'broadcast', event: 'hello', payload: { pid: self.pid } });
    }, 1300);
    this._onPresence();
  }
};
RM._roster = function () {
  if (!this.ch) return [];
  var st = this.ch.presenceState(), out = [];
  Object.keys(st).forEach(function (k) { var m = st[k]; if (m && m.length) out.push(m[m.length - 1]); });
  out.sort(function (a, b) { return (b.host ? 1 : 0) - (a.host ? 1 : 0) || (a.t || 0) - (b.t || 0) || String(a.pid).localeCompare(String(b.pid)); });
  return out;
};
RM._onPresence = function () {
  if (this.destroyed || !this.ch) return;
  var self = this, ros = this._roster(), hostSeen = ros.some(function (r) { return r.host; }), now = Date.now();
  if (!this.isHost) {
    if (hostSeen) {
      if (this.hostGoneT) { clearTimeout(this.hostGoneT); this.hostGoneT = null; }
      if (!this.gotState && this.helloN < 5 && now - this.lastHello > 1200) {
        this.helloN++; this.lastHello = now;
        this.ch.send({ type: 'broadcast', event: 'hello', payload: { pid: this.pid } });
      }
    } else if (this.gotState && !this.hostGoneT) {
      this.hostGoneT = setTimeout(function () { self._closed('The host left, so the room was closed.'); }, 7000);
    }
    if (this.status === 'lobby') this._render();
    return;
  }
  if (this.status === 'connecting') return;
  var cap = this.spec ? this.spec.max : 8;
  if (this.status === 'lobby') {
    ros.filter(function (r) { return !r.host; }).slice(cap - 1).forEach(function (r) { self._kick(r.pid, 'This room is full.'); });
  } else {
    var inGame = {}; this.players.forEach(function (p) { inGame[p.pid] = 1; });
    ros.forEach(function (r) { if (!r.host && !inGame[r.pid]) self._kick(r.pid, 'This game has already started.'); });
  }
  if (this.status === 'lobby') { this._bc(true); this._render(); }
};
RM._kick = function (pid, why) {
  if (this.kicked[pid]) return; this.kicked[pid] = 1;
  this.ch.send({ type: 'broadcast', event: 'ctl', payload: { k: 'kick', pid: pid, why: why } });
};
RM._onCtl = function (c) {
  if (this.isHost) return;
  if (c.k === 'close') this._closed(c.why || 'The host closed the room.');
  else if (c.k === 'kick' && c.pid === this.pid) this._fail(c.why || 'You were removed from the room.', 'Could not join');
};
RM._farewell = function () {
  try {
    if (!this.ch) return;
    if (this.isHost) this.ch.send({ type: 'broadcast', event: 'ctl', payload: { k: 'close', why: 'The host left, so the room was closed.' } });
    else this.ch.untrack();
  } catch (e) { /* silent */ }
};
RM._shutdown = function () {
  var ch = this.ch; this.ch = null;
  if (this.hostT) { clearInterval(this.hostT); this.hostT = null; }
  ['joinT', 'hostGoneT', 'bcT'].forEach(function (k) { if (this[k]) { clearTimeout(this[k]); this[k] = null; } }, this);
  if (this.helloIv) { clearInterval(this.helloIv); this.helloIv = null; }
  if (ch) { try { ch.untrack(); } catch (e) { /* silent */ } try { this.db.removeChannel(ch); } catch (e2) { /* silent */ } }
};
RM._closed = function (msg) {
  this._unmount(); this._shutdown(); this.status = 'closed';
  this._set(this._closedHtml(msg));
};
RM._fail = function (msg, title) {
  this._unmount(); this._shutdown(); this.status = 'closed';
  this._set(this._closedHtml(msg, title || 'Connection problem'));
};

/* ---------- host: authoritative state ---------- */
RM._mkPub = function () {
  var f = this.full, p = this.spec.pub ? this.spec.pub(f) : mpClone(f);
  p.n = f.n; p.gone = f.gone; p.over = !!f.over; p.note = f.note || ''; p.pts = f.pts;
  return p;
};
RM._bc = function (force) {
  var self = this;
  if (!this.isHost || !this.ch || this.status === 'connecting') return;
  var now = Date.now();
  if (!force && now - this.lastBc < 300) {
    if (!this.bcT) this.bcT = setTimeout(function () { self.bcT = null; self._bc(true); }, 300 - (now - this.lastBc));
    return;
  }
  this.lastBc = now; this.ver++;
  this.pub = this.full ? this._mkPub() : null;
  this.ch.send({ type: 'broadcast', event: 'st', payload: { room: { code: this.code, game: this.gameId, status: this.status, opts: this.opts }, st: this.pub, ts: now, ver: this.ver, players: this.players } });
  if (this.full && this.spec.secret && this.full.sk !== this.lastSk) {
    this.lastSk = this.full.sk;
    var m = this.spec.secret(this.full);
    for (var i in m) {
      var p = this.players[i]; if (!p) continue;
      if (p.pid === this.pid) { this.local.sec = m[i]; this.local.secNext = m[i]; if (this.mounted && this.spec.onSecret) this.spec.onSecret(this._ctx(), m[i]); }
      else this.ch.send({ type: 'broadcast', event: 'sec', payload: { to: p.pid, d: m[i] } });
    }
  }
};
RM.start = function () {
  if (!this.isHost || this.status !== 'lobby') return;
  var spec = this.spec, ros = this._roster().slice(0, spec.max);
  if (ros.length < spec.min) { mpToast('Not enough players', 'This game needs at least ' + spec.min + ' players.'); return; }
  var self = this;
  this.players = ros.map(function (r, i) { return { pid: r.pid, name: r.name, color: MP_COLORS[i % 8], host: !!r.host }; });
  this.me = 0; this.players.forEach(function (p, i) { if (p.pid === self.pid) self.me = i; });
  var n = this.players.length, now = Date.now();
  this.full = spec.init(n, this.opts, now); this.full.n = n; this.full.gone = []; for (var i = 0; i < n; i++) this.full.gone.push(false);
  this.local = {}; this.lastSk = undefined; this.scoreSaved = false; this.missing = {}; this.status = 'playing'; this.lastAct = now;
  this._unmount(); this.pub = this._mkPub(); this._render(); this._bc(true);
};
RM.again = function () {
  if (!this.isHost) return;
  this._unmount(); this.full = null; this.pub = null; this.players = []; this.me = -1; this.local = {};
  this.status = 'lobby'; this.lastAct = Date.now(); this.kicked = {};
  this._bc(true); this._render();
};
RM._hostApply = function (pid, a) {
  if (this.status !== 'playing' || !this.full || this.full.over) return;
  var idx = -1; for (var i = 0; i < this.players.length; i++) if (this.players[i].pid === pid) idx = i;
  if (idx < 0 || this.full.gone[idx]) return;
  var ns = this.spec.reduce(mpClone(this.full), a, idx, Date.now());
  if (ns) this._commit(ns);
};
RM._commit = function (ns) {
  this.full = ns; this.lastAct = Date.now();
  if (ns.over && this.status === 'playing') { this._finish(); return; }
  this.pub = this._mkPub(); this._bc(); this._render();
};
RM._finish = function () {
  this.status = 'done'; this.resultsAt = Date.now(); this.pub = this._mkPub();
  this._saveMyScore(); this._bc(true); this._render();
};
RM._saveMyScore = function () {
  if (this.scoreSaved || !this.pub || this.me < 0) return; this.scoreSaved = true;
  try { this.mgr._saveScore(this.gameId, this.pub.pts[this.me] || 0); } catch (e) { /* silent */ }
};
RM._hostTick = function () {
  if (this.destroyed || !this.isHost) return;
  var now = Date.now();
  if (now - this.lastAct > MP_IDLE_MS) { this.closeRoom('The room closed after 10 minutes of inactivity.'); return; }
  if (this.status === 'done' && now - this.resultsAt > MP_RESULT_MS) { this.closeRoom('The room closed because the game was over.'); return; }
  if (this.status !== 'playing' || !this.full) return;
  var f = this.full, self = this, ros = {}, changed = false;
  this._roster().forEach(function (r) { ros[r.pid] = 1; });
  this.players.forEach(function (p, i) {
    if (f.gone[i]) return;
    if (!ros[p.pid]) { self.missing[p.pid] = self.missing[p.pid] || now; if (now - self.missing[p.pid] > 6000) { f.gone[i] = true; changed = true; } }
    else delete self.missing[p.pid];
  });
  if (mpActive(f).length < this.spec.min) {
    var act = mpActive(f);
    if (act.length === 1 && Math.max.apply(null, f.pts) === 0) f.pts[act[0]] = 100;
    this._commit(mpFinish(f, 'The other players left the game.')); return;
  }
  var ns = this.spec.tick ? this.spec.tick(mpClone(f), now) : null;
  if (ns) this._commit(ns); else if (changed) this._commit(f);
};
RM.closeRoom = function (why) {
  var self = this, ch = this.ch, done = false;
  function fin() { if (done) return; done = true; self.destroy(); self.mgr.backToList(); mpToast('Room closed', why || 'The room has been closed.'); }
  if (ch) {
    try { Promise.resolve(ch.send({ type: 'broadcast', event: 'ctl', payload: { k: 'close', why: why || 'The host closed the room.' } })).then(fin, fin); } catch (e) { fin(); }
    setTimeout(fin, 700);
  } else fin();
};

/* ---------- guest: receive state ---------- */
RM._onSt = function (p) {
  if (this.isHost || !p || !p.room || p.ver <= this.ver || this.destroyed) return;
  this.ver = p.ver; this.gotState = true;
  if (this.joinT) { clearTimeout(this.joinT); this.joinT = null; }
  this.skew = p.ts - Date.now(); this.code = p.room.code; this.opts = p.room.opts || {};
  if (p.room.game !== this.gameId) { this.gameId = p.room.game; this.cfg = mpCfg(this.gameId); this.spec = MP_GAMES[this.gameId]; }
  if (!this.spec) { this._fail('This game is not available in your version of the page. Refresh and try again.'); return; }
  var prev = this.status;
  this.players = p.players || []; this.pub = p.st; this.status = p.room.status;
  this.me = -1; for (var i = 0; i < this.players.length; i++) if (this.players[i].pid === this.pid) this.me = i;
  if (this.status !== 'lobby' && this.me < 0) { this._fail('This game has already started. Ask the host to start a new round.', 'Could not join'); return; }
  if (this.status === 'playing' && prev !== 'playing') { this.local = {}; this.scoreSaved = false; this._unmount(); }
  if (this.status === 'done') this._saveMyScore();
  this._render();
};

/* ---------- player input ---------- */
RM.send = function (a) {
  if (this.status !== 'playing' || !this.spec) return;
  if (this.spec.onSend) this.spec.onSend(this.local, a);
  if (this.isHost) this._hostApply(this.pid, a);
  else this.ch.send({ type: 'broadcast', event: 'a', payload: { pid: this.pid, a: a } });
};
RM._raw = function (e) { if (this.ch) this.ch.send({ type: 'broadcast', event: 'x', payload: { pid: this.pid, e: e } }); };
RM._onClick = function (ev) {
  var b = ev.target.closest ? ev.target.closest('[data-mp],[data-a]') : null;
  if (!b || b.disabled || !this.root.contains(b)) return;
  var self = this, act = b.getAttribute('data-a');
  if (act) {
    try { act = JSON.parse(act); } catch (e) { return; }
    var empty = false;
    Object.keys(act).forEach(function (k) {
      if (typeof act[k] === 'string' && act[k].charAt(0) === '@') { var el = document.getElementById(act[k].slice(1)); act[k] = el ? el.value : ''; if (!String(act[k]).trim()) empty = true; }
    });
    if (empty) return;
    var cl = b.getAttribute('data-clear'); if (cl) { var ce = document.getElementById(cl); if (ce) { ce.value = ''; ce.focus(); } }
    this.send(act); return;
  }
  var m = b.getAttribute('data-mp');
  if (m === 'create') this.create();
  else if (m === 'join') { var ci = document.getElementById('mp-code'); this.join(ci ? ci.value : ''); }
  else if (m === 'start') this.start();
  else if (m === 'again') this.again();
  else if (m === 'copy-code') mpCopy(this.code, function () { mpToast('Copied', 'Room code ' + self.code + ' copied.'); });
  else if (m === 'copy-link') mpCopy(location.origin + location.pathname + '?room=' + this.code, function () { mpToast('Copied', 'Invite link copied — share it with your friends.'); });
  else if (m === 'home') { this.destroy(); this.mgr.backToList(); }
  else if (m === 'leave') {
    if (this.status === 'entry' || this.status === 'closed' || (this.status === 'connecting' && !this.isHost)) { this.destroy(); this.mgr.backToList(); }
    else if (this.isHost) {
      var others = this._roster().length > 1;
      if (!others || confirm('Close the room for everyone?')) this.closeRoom('The host closed the room.');
    } else { this._farewell(); this.destroy(); this.mgr.backToList(); }
  }
};
RM.destroy = function () {
  if (this.destroyed) return;
  this.destroyed = true; this._unmount(); this._shutdown();
  if (this.uiT) { clearInterval(this.uiT); this.uiT = null; }
  if (this.root) { this.root.removeEventListener('click', this._click); this.root.removeEventListener('keydown', this._key); this.root.removeEventListener('change', this._change); }
  window.removeEventListener('pagehide', this._pagehide);
};

/* ---------- GamesManager hooks ---------- */
P._mpEnter = function (game, code) {
  if (this._mpRoom) this._mpRoom.destroy();
  this._mpRoom = new MpRoom(this, game);
  this._mpRoom.showEntry(code);
};
P.mpJoinCode = function (code, name) {
  var play = document.getElementById('game-play-area'), list = document.getElementById('games-list-area');
  if (!play) return;
  if (list) list.style.display = 'none';
  play.style.display = 'block';
  this._stop();
  if (this._mpRoom) this._mpRoom.destroy();
  var r = this._mpRoom = new MpRoom(this, null);
  if (name) { r.name = String(name).slice(0, 16); mpSaveName(r.name); }
  r.showEntry(String(code || '').toUpperCase());
  if (name && String(code || '').length === 4) r.join(code);
};

/* ── Multiplayer CSS — injected once ── */
(function injectMpCSS() {
  if (document.getElementById('rac-mp-css')) return;
  var s = document.createElement('style');
  s.id = 'rac-mp-css';
  s.textContent = ".g-mp-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;font-size:.67rem;font-weight:700;background:linear-gradient(135deg,var(--accent),#8E44EC);color:#fff;}\n.g-mp-badge svg{width:11px;height:11px;}\n.mp-top{align-items:center;}\n.mp-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:.7rem;font-weight:700;background:var(--accent-light);color:var(--accent);}\n.mp-pill svg{width:12px;height:12px;}\n.mp-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;border:2px dashed var(--accent);background:var(--bg-card);color:var(--accent);font:800 .95rem 'Poppins',sans-serif;letter-spacing:.2em;cursor:pointer;box-shadow:var(--neu-shadow-sm);}\n.mp-chip svg{width:15px;height:15px;}\n.mp-card{padding:clamp(18px,4vw,30px);max-width:640px;margin:0 auto;}\n.mp-center{text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px;}\n.mp-center h3{font-size:1.1rem;color:var(--text-heading);}\n.mp-center p{font-size:.88rem;color:var(--text-secondary);max-width:380px;line-height:1.6;}\n.mp-spin{width:38px;height:38px;color:var(--accent);animation:mpSpin 1s linear infinite;}\n@keyframes mpSpin{to{transform:rotate(360deg);}}\n.mp-entry{display:flex;flex-direction:column;gap:14px;}\n.mp-hero{display:flex;gap:16px;align-items:center;}\n.mp-hero h3{font-size:1.2rem;font-weight:800;color:var(--text-heading);margin-bottom:3px;}\n.mp-hero p{font-size:.82rem;color:var(--text-secondary);margin-bottom:8px;line-height:1.5;}\n.mp-hero-ico{flex:0 0 58px;width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:var(--accent-light);color:var(--accent);box-shadow:var(--neu-shadow-sm);}\n.mp-hero-ico svg{width:28px;height:28px;}\n.mp-hero-ico.is-warn{background:var(--warning-light);color:var(--warning);}\n.mp-how{font-size:.8rem;line-height:1.65;color:var(--text-secondary);padding:12px 14px;border-radius:10px;background:var(--bg-secondary);}\n.mp-lbl{font-size:.78rem;font-weight:700;color:var(--text-secondary);margin-bottom:-6px;}\n.mp-wide{width:100%;justify-content:center;padding:13px 18px;}\n.mp-or{display:flex;align-items:center;gap:12px;font-size:.72rem;color:var(--text-muted);font-weight:600;}\n.mp-or::before,.mp-or::after{content:'';flex:1;height:1px;background:var(--border-color);}\n.mp-join{display:flex;gap:10px;align-items:stretch;}\n.mp-join .input-wrap{flex:1;}\n.mp-code-in{text-align:center;font-weight:800;letter-spacing:.35em;text-transform:uppercase;}\n.mp-hint{font-size:.78rem;color:var(--text-muted);text-align:center;line-height:1.55;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;}\n.mp-hint svg{width:14px;height:14px;}\n.mp-code-box{text-align:center;padding:18px;border-radius:14px;background:var(--bg-secondary);box-shadow:var(--neu-inset);margin-bottom:18px;}\n.mp-code-box small{display:block;font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.12em;}\n.mp-code-box strong{display:block;font-size:2.6rem;font-weight:900;letter-spacing:.28em;color:var(--accent);padding-left:.28em;line-height:1.2;margin:4px 0 10px;}\n.mp-code-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}\n.mp-sec{margin-bottom:16px;}\n.mp-sec h4{display:flex;align-items:center;gap:8px;font-size:.88rem;color:var(--text-heading);margin-bottom:10px;}\n.mp-roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;}\n.mp-pl{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:var(--bg-card);box-shadow:var(--neu-shadow-sm);min-width:0;}\n.mp-pl b{font-size:.82rem;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.mp-pl svg{width:15px;height:15px;color:var(--warning);flex-shrink:0;}\n.mp-pl em,.mp-sb em,.mp-rk em{font-style:normal;font-size:.62rem;font-weight:800;padding:1px 7px;border-radius:999px;background:var(--accent);color:#fff;}\n.mp-av{flex:0 0 32px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:.85rem;}\n.mp-opts{display:flex;gap:12px;flex-wrap:wrap;}\n.mp-opts label{display:flex;flex-direction:column;gap:5px;font-size:.74rem;font-weight:700;color:var(--text-secondary);min-width:130px;}\n.mp-opts select{min-height:42px;padding:8px 14px;border-radius:10px;background:var(--bg-secondary);color:var(--text-primary);border:0;font-family:inherit;}\n.mp-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px;align-items:center;}\n.mp-play{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:16px;align-items:start;}\n.mp-stage{padding:clamp(12px,3vw,22px);min-height:320px;}\n.mp-board{padding:14px;display:flex;flex-direction:column;gap:8px;}\n.mp-board h4{font-size:.78rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);}\n.mp-sb{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;border:2px solid transparent;}\n.mp-sb b{flex:1;min-width:0;font-size:.78rem;color:var(--text-heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.mp-sb b svg{width:12px;height:12px;color:var(--warning);vertical-align:-1px;}\n.mp-sb strong{font-size:1rem;color:var(--accent);}\n.mp-sb.is-turn{border-color:var(--accent);background:var(--accent-light);}\n.mp-sb.is-gone{opacity:.4;}\n.mp-sb .mp-av{flex-basis:26px;width:26px;height:26px;font-size:.72rem;}\n.mp-status{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;font-size:.88rem;font-weight:700;color:var(--text-heading);margin-bottom:10px;text-align:center;}\n.mp-dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:middle;flex-shrink:0;}\n.mp-clock{font-weight:800;color:var(--accent);min-width:2ch;text-align:center;}\n.mp-bar{height:6px;border-radius:999px;background:var(--bg-secondary);overflow:hidden;margin-bottom:14px;}\n.mp-bar-fill{height:100%;width:100%;background:linear-gradient(90deg,var(--accent),#F2A413);border-radius:999px;transition:width .2s linear;}\n.mp-results{text-align:center;}\n.mp-trophy{width:70px;height:70px;margin:0 auto 10px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#FFD700,#FFA500);color:#fff;box-shadow:0 8px 22px rgba(255,165,0,.35);}\n.mp-trophy svg{width:34px;height:34px;}\n.mp-results h3{font-size:1.35rem;font-weight:800;color:var(--text-heading);margin-bottom:4px;}\n.mp-rank{display:flex;flex-direction:column;gap:8px;margin:16px 0 4px;text-align:left;}\n.mp-rk{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:var(--bg-card);box-shadow:var(--neu-shadow-sm);border:2px solid transparent;}\n.mp-rk.is-win{border-color:#F2A413;}\n.mp-rk b{flex:1;min-width:0;font-size:.88rem;color:var(--text-heading);}\n.mp-rk strong{font-size:1.15rem;color:var(--accent);}\n.mp-pos{flex:0 0 26px;text-align:center;font-weight:800;color:var(--text-muted);}\n.mp-pos svg{width:20px;height:20px;color:#F2A413;}\n/* Connect Four */\n.c4-board{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:10px;border-radius:16px;background:#1d4fb3;max-width:460px;margin:0 auto;box-shadow:var(--neu-shadow);}\n.c4-col{display:flex;flex-direction:column;gap:6px;padding:0;border:0;background:transparent;cursor:pointer;border-radius:10px;}\n.c4-col:not(:disabled):hover{background:rgba(255,255,255,.14);}\n.c4-col:disabled{cursor:default;}\n.c4-cell{aspect-ratio:1;border-radius:50%;background:#0d2f7a;display:grid;place-items:center;box-shadow:inset 0 3px 6px rgba(0,0,0,.45);}\n.c4-cell i{display:block;width:84%;height:84%;border-radius:50%;box-shadow:inset 0 -3px 6px rgba(0,0,0,.25);animation:c4Drop .35s ease-out;}\n.c4-cell.is-win i{outline:3px solid #fff;animation:c4Win .8s ease-in-out infinite alternate;}\n@keyframes c4Drop{from{transform:translateY(-260%);}to{transform:none;}}\n@keyframes c4Win{to{transform:scale(1.08);}}\n/* RPS */\n.rps-pick{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:440px;margin:0 auto;}\n.rps-btn{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 8px;border-radius:16px;border:2px solid transparent;background:var(--bg-card);box-shadow:var(--neu-shadow-sm);cursor:pointer;color:var(--text-heading);font:700 .82rem 'Poppins',sans-serif;transition:.2s;}\n.rps-btn svg{width:38px;height:38px;color:var(--accent);}\n.rps-btn:not(:disabled):hover{transform:translateY(-4px);border-color:var(--accent);}\n.rps-btn:disabled{opacity:.55;cursor:default;}\n.rps-btn.is-chosen{opacity:1;border-color:var(--accent);background:var(--accent-light);}\n.rps-reveal{display:flex;flex-direction:column;gap:8px;max-width:440px;margin:0 auto;}\n.rps-row{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:var(--bg-secondary);}\n.rps-row b{flex:1;font-size:.85rem;color:var(--text-heading);}\n.rps-chip{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;font-weight:700;color:var(--accent);}\n.rps-chip svg{width:18px;height:18px;}\n.rps-chip.is-miss{color:var(--text-muted);}\n.rps-row em{font-style:normal;font-weight:800;min-width:28px;text-align:right;color:var(--text-muted);}\n.rps-row em.is-up{color:var(--success);}\n/* Quick Draw */\n.qd-pad{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:100%;min-height:210px;border:0;border-radius:20px;color:#fff;cursor:pointer;touch-action:manipulation;user-select:none;transition:background .08s;}\n.qd-pad strong{font-size:1.8rem;font-weight:900;letter-spacing:.04em;}\n.qd-pad small{font-size:.8rem;opacity:.85;}\n.qd-pad.is-wait{background:#E5533D;}\n.qd-pad.is-go{background:#1FA971;box-shadow:0 0 40px rgba(31,169,113,.6);}\n.qd-pad.is-done{background:#64748B;}\n.qd-res{margin-top:14px;display:flex;flex-direction:column;gap:6px;}\n.qd-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:var(--bg-secondary);font-size:.82rem;}\n.qd-row b{flex:1;color:var(--text-heading);}\n.qd-row em{font-style:normal;font-weight:800;color:var(--accent);min-width:28px;text-align:right;}\n/* Trivia + shared */\n.tv-q{font-size:1.02rem;line-height:1.5;color:var(--text-heading);text-align:center;margin:6px 0 14px;}\n.tv-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;}\n.tv-opt{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;border:2px solid transparent;background:var(--bg-card);box-shadow:var(--neu-shadow-sm);cursor:pointer;font:600 .84rem 'Poppins',sans-serif;color:var(--text-primary);text-align:left;transition:.2s;}\n.tv-opt:not(:disabled):hover{border-color:var(--accent);transform:translateY(-2px);}\n.tv-opt:disabled{cursor:default;}\n.tv-l{flex:0 0 28px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--accent-light);color:var(--accent);font-weight:800;font-size:.8rem;}\n.tv-opt.is-sel{border-color:var(--accent);background:var(--accent-light);}\n.tv-opt.is-ok{border-color:var(--success);background:var(--success-light);color:var(--success);}\n.tv-opt.is-no{border-color:var(--danger);background:var(--danger-light);color:var(--danger);}\n.tv-exp{margin-top:14px;padding:12px 14px;border-radius:10px;background:var(--bg-secondary);font-size:.8rem;line-height:1.6;color:var(--text-secondary);}\n/* Hangman */\n.hm-main{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;margin:6px 0 10px;}\n.hm-fig{width:130px;height:150px;color:var(--accent);}\n.hm-word{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}\n.hm-word span{width:34px;height:44px;border-bottom:4px solid var(--text-heading);display:grid;place-items:center;font-size:1.5rem;font-weight:800;color:var(--text-heading);}\n.hm-kb{display:grid;grid-template-columns:repeat(9,1fr);gap:5px;max-width:420px;margin:12px auto 0;}\n.hm-k{aspect-ratio:1;border:0;border-radius:8px;background:var(--bg-card);box-shadow:var(--neu-shadow-sm);font:800 .85rem 'Poppins',sans-serif;color:var(--text-heading);cursor:pointer;}\n.hm-k:not(:disabled):hover{background:var(--accent);color:#fff;}\n.hm-k:disabled{opacity:.4;cursor:default;}\n/* Scramble + Draw feed */\n.sc-tiles{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin:8px 0 12px;}\n.sc-tiles span{width:42px;height:50px;display:grid;place-items:center;border-radius:10px;background:var(--accent);color:#fff;font-size:1.4rem;font-weight:800;box-shadow:var(--neu-shadow-sm);}\n.sc-form{display:flex;gap:8px;margin-top:6px;}\n.sc-form input{flex:1;min-width:0;min-height:46px;padding:10px 14px;border-radius:10px;border:2px solid transparent;background:var(--bg-secondary);color:var(--text-heading);font:700 1rem 'Poppins',sans-serif;text-transform:uppercase;outline:none;}\n.sc-form input:focus{border-color:var(--accent);}\n.sc-msg{text-align:center;font-size:.9rem;padding:12px;border-radius:10px;}\n.sc-msg.is-ok{background:var(--success-light);color:var(--success);}\n.sc-msg.is-no{background:var(--danger-light);color:var(--danger);}\n.sc-feed{margin-top:12px;display:flex;flex-direction:column;gap:4px;font-size:.78rem;color:var(--text-secondary);max-height:130px;overflow:auto;}\n.sc-feed code{font-weight:700;color:var(--text-heading);}\n.sc-feed .is-ok{color:var(--success);font-weight:700;}\n/* Memory Clash */\n.mc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:400px;margin:0 auto;}\n.mc-card{aspect-ratio:1;border-radius:12px;border:2px solid transparent;display:grid;place-items:center;cursor:pointer;transition:.25s;background:var(--accent-light);color:var(--accent);box-shadow:var(--neu-shadow-sm);}\n.mc-card svg{width:46%;height:46%;}\n.mc-card.is-down:not(:disabled):hover{transform:translateY(-3px);border-color:var(--accent);}\n.mc-card.is-up{background:var(--bg-card);transform:scale(1.04);}\n.mc-card.is-done{background:var(--bg-card);border-color:var(--own,var(--success));color:var(--own,var(--success));}\n.mc-card:disabled{cursor:default;}\n/* Pig */\n.pig-stage{display:flex;align-items:center;justify-content:center;gap:26px;margin:10px 0 14px;}\n.pig-die{width:84px;height:84px;padding:10px;border-radius:16px;background:#fff;box-shadow:var(--neu-shadow),inset 0 -4px 8px rgba(0,0,0,.08);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:3px;}\n.pig-die span{border-radius:50%;}\n.pig-die span.on{background:#1A1A2E;}\n.pig-die.is-blank{opacity:.35;}\n.pig-stage.is-bust .pig-die span.on{background:var(--danger);}\n.pig-stage[data-roll] .pig-die{animation:pigRoll .45s ease-out;}\n@keyframes pigRoll{from{transform:rotate(-200deg) scale(.6);}to{transform:none;}}\n.pig-cur{text-align:center;}\n.pig-cur small{display:block;font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;}\n.pig-cur strong{font-size:2.4rem;font-weight:900;color:var(--accent);line-height:1.1;}\n.pig-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px;}\n/* Tap Rush */\n.tr-wrap{text-align:center;}\n.tr-clock{font-size:3rem;font-weight:900;color:var(--text-heading);line-height:1;margin:2px 0 12px;}\n.tr-clock.is-run{color:var(--danger);}\n.tr-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;width:180px;height:180px;margin:0 auto 16px;border-radius:50%;border:0;background:linear-gradient(145deg,var(--accent),#8E44EC);color:#fff;cursor:pointer;touch-action:manipulation;user-select:none;box-shadow:0 10px 30px rgba(212,19,103,.4);transition:transform .05s;}\n.tr-btn:active:not(:disabled){transform:scale(.94);}\n.tr-btn:disabled{filter:grayscale(.7);opacity:.6;cursor:default;}\n.tr-btn svg{width:30px;height:30px;}\n.tr-btn strong{font-size:2.4rem;line-height:1.1;}\n.tr-btn small{font-size:.7rem;opacity:.8;}\n.tr-bars{display:flex;flex-direction:column;gap:7px;text-align:left;}\n.tr-row{display:flex;align-items:center;gap:8px;font-size:.78rem;}\n.tr-row b{flex:0 0 96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-heading);}\n.tr-track{flex:1;height:10px;border-radius:999px;background:var(--bg-secondary);overflow:hidden;}\n.tr-fill{height:100%;border-radius:999px;transition:width .25s;}\n.tr-row em{font-style:normal;font-weight:800;min-width:32px;text-align:right;color:var(--accent);}\n/* Draw & Guess */\n.dg-word{text-align:center;font-size:1.15rem;letter-spacing:.14em;color:var(--text-heading);margin:6px 0 10px;min-height:1.6em;white-space:pre-wrap;}\n.dg-canvas{display:block;width:100%;aspect-ratio:8/5;border-radius:12px;background:#fff;box-shadow:var(--neu-inset);touch-action:none;cursor:crosshair;}\n.dg-tools{display:none;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px;}\n.dg-sw{width:28px;height:28px;border-radius:50%;border:3px solid transparent;cursor:pointer;box-shadow:var(--neu-shadow-sm);}\n.dg-sw.is-on{border-color:var(--text-heading);}\n.dg-tool{width:34px;height:34px;border-radius:10px;border:2px solid transparent;background:var(--bg-card);box-shadow:var(--neu-shadow-sm);cursor:pointer;display:grid;place-items:center;color:var(--text-heading);}\n.dg-tool svg{width:16px;height:16px;}\n.dg-tool.is-on{border-color:var(--accent);color:var(--accent);}\n.dg-dot{display:block;border-radius:50%;background:currentColor;}\n.dg-dot.s{width:5px;height:5px;}.dg-dot.m{width:9px;height:9px;}.dg-dot.l{width:14px;height:14px;}\n@media(max-width:760px){\n.mp-play{grid-template-columns:1fr;}\n.mp-board{flex-direction:row;flex-wrap:wrap;order:-1;}\n.mp-board h4{width:100%;}\n.mp-sb{flex:1 1 140px;}\n.tv-opts{grid-template-columns:1fr;}\n.mp-hero{flex-direction:column;text-align:center;}\n.mp-join{flex-direction:column;}\n.hm-kb{grid-template-columns:repeat(7,1fr);}\n.tr-btn{width:150px;height:150px;}\n}\n";
  document.head.appendChild(s);
}());

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

  /* Invite link: games.html?room=ABCD opens the join screen with the code filled in */
  try {
    var rc = new URLSearchParams(window.location.search).get('room');
    if (rc && /^[A-Za-z0-9]{4}$/.test(rc)) gamesManager.mpJoinCode(rc);
  } catch (e) { /* silent */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initGames);
} else {
  _initGames(); /* DOM already ready */
}

} /* ── end double-load guard ── */
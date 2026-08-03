/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Games Module — js/games.js
   Works with the existing config.js — does NOT redeclare
   anything already defined there.
   ============================================================ */

'use strict';

/* ============================================================
   GUARD: prevent double-load crash
   ============================================================ */
if (typeof window._GAMES_JS_LOADED === 'undefined') {
  window._GAMES_JS_LOADED = true;

/* ============================================================
   WORDLE WORDS  (only this is new — not in config.js)
   ============================================================ */
var WORDLE_WORDS = [
  'SERVE', 'PEACE', 'UNITE', 'SHARE', 'LEADS', 'TRUST',
  'GROWN', 'HELPS', 'YOUTH', 'CLUBS', 'GRANT', 'GLOBE',
  'SMILE', 'LIGHT', 'BRAVE', 'FUNDS', 'WORKS', 'HANDS',
  'SKILL', 'TEAMS', 'BUILD', 'PROUD', 'FAITH', 'DREAM',
  'ROTARY', 'SERVE'
];

/* ============================================================
   CANVAS POLYFILL: roundRect
   ============================================================ */
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 0) || 0;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
    return this;
  };
}

/* ============================================================
   SCORE STORAGE HELPERS
   ────────────────────────────────────────────────────────────
   config.js Storage wraps values as:
     { value, timestamp, expiry }
   under key  "rac_" + key

   So Storage.get('game_high_scores') reads
     localStorage["rac_game_high_scores"] → unwraps → plain object

   We use the SAME Storage helper from config.js everywhere.
   ============================================================ */
function readHighScores() {
  /* Storage is defined in config.js — always available here */
  return Storage.get('game_high_scores') || {};
}

function writeHighScores(obj) {
  Storage.set('game_high_scores', obj);
}

/* ============================================================
   GAMES MANAGER CLASS
   ============================================================ */
var GamesManager = (function () {

  function GM() {
    this.db            = getSupabaseClient();   /* from config.js */
    this.currentGame   = null;
    this.gameCanvas    = null;
    this.gameCtx       = null;
    this.animationFrame = null;
    this.gameInterval  = null;
    this.isPlaying     = false;
    this.score         = 0;
    this.highScores    = {};
    this._keyHandler   = null;
    this._keyUpHandler = null;
    this._touchCleanups = [];
    this._resizeHandler = null;

    this.init();
  }

  var p = GM.prototype;

  /* ────────────────────────────────────────────────
     INIT
  ──────────────────────────────────────────────── */
  p.init = function () {
    this.loadHighScores();
    this.renderGamesList();
  };

  /* ────────────────────────────────────────────────
     RENDER GAMES LIST
     Uses GAMES_CONFIG from config.js
  ──────────────────────────────────────────────── */
  p.renderGamesList = function () {
    var container = document.getElementById('games-grid');
    if (!container) return;
    var self = this;
    var html = '';

    /* GAMES_CONFIG is declared in config.js — use it directly */
    var cfg = window.GAMES_CONFIG || [];
    for (var i = 0; i < cfg.length; i++) {
      var game = cfg[i];
      var hs   = this.highScores[game.id] || 0;
      var hsHTML = hs > 0
        ? '<span class="game-high-score">' +
            '<i data-lucide="trophy" style="width:12px;height:12px;"></i> ' +
            hs + '</span>'
        : '';

      html +=
        '<div class="game-card neu-card" ' +
             'data-game-id="' + game.id + '" ' +
             'data-category="' + game.category + '">' +
          '<div class="game-card-icon" style="background:var(--accent-light);">' +
            '<i data-lucide="' + game.icon + '" ' +
               'style="width:32px;height:32px;color:var(--accent);"></i>' +
          '</div>' +
          '<div class="game-card-info">' +
            '<h3 class="game-card-title">' + game.name + '</h3>' +
            '<p class="game-card-desc">' + game.description + '</p>' +
            '<div class="game-card-meta">' +
              '<span class="game-difficulty ' +
                'game-difficulty-' + (game.difficulty || 'medium').toLowerCase() + '">' +
                (game.difficulty || '') +
              '</span>' +
              '<span class="game-category">' + (game.category || '') + '</span>' +
              hsHTML +
            '</div>' +
          '</div>' +
          '<div class="game-card-play">' +
            '<i data-lucide="play" style="width:20px;height:20px;"></i>' +
          '</div>' +
        '</div>';
    }

    container.innerHTML = html;

    /* Attach click handlers */
    var cards = container.querySelectorAll('.game-card');
    for (var j = 0; j < cards.length; j++) {
      (function (card) {
        card.addEventListener('click', function () {
          var gid = card.getAttribute('data-game-id');
          if (gid) self.openGame(gid);
        });
      })(cards[j]);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  /* ────────────────────────────────────────────────
     OPEN GAME
  ──────────────────────────────────────────────── */
  p.openGame = function (gameId) {
    this.stopCurrentGame();
    this.currentGame = gameId;
    this.score       = 0;

    var container = document.getElementById('game-play-area');
    var listArea  = document.getElementById('games-list-area');
    if (!container) return;

    if (listArea)  listArea.style.display  = 'none';
    container.style.display = 'block';

    /* Find game config */
    var cfg  = window.GAMES_CONFIG || [];
    var game = null;
    for (var i = 0; i < cfg.length; i++) {
      if (cfg[i].id === gameId) { game = cfg[i]; break; }
    }
    if (!game) return;

    container.innerHTML =
      '<div class="game-header">' +
        '<button class="btn btn-outline btn-sm" id="game-back-btn">' +
          '<i data-lucide="arrow-left"></i><span>Back</span>' +
        '</button>' +
        '<div class="game-title-area">' +
          '<h2><i data-lucide="' + game.icon + '"></i> ' + game.name + '</h2>' +
          '<span class="game-difficulty game-difficulty-' +
            (game.difficulty || 'medium').toLowerCase() + '">' +
            (game.difficulty || '') + '</span>' +
        '</div>' +
        '<div class="game-score-area">' +
          '<span class="game-score-label">Score</span>' +
          '<span class="game-score-value" id="game-score">0</span>' +
        '</div>' +
      '</div>' +
      '<div class="game-container" id="game-container">' +
        '<canvas id="game-canvas" width="480" height="400"></canvas>' +
        '<div class="game-overlay" id="game-overlay">' +
          '<div class="game-overlay-content">' +
            '<h3 id="game-overlay-title">' + game.name + '</h3>' +
            '<p id="game-overlay-text">' + game.description + '</p>' +
            '<button class="btn btn-primary" id="game-start-btn">' +
              '<i data-lucide="play"></i><span>Start Game</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="game-ui" id="game-ui"></div>' +
      '</div>';

    this.gameCanvas = document.getElementById('game-canvas');
    this.gameCtx    = this.gameCanvas ? this.gameCanvas.getContext('2d') : null;
    this.resizeCanvas();

    var self = this;
    document.getElementById('game-back-btn').addEventListener('click', function () {
      self.backToList();
    });
    document.getElementById('game-start-btn').addEventListener('click', function () {
      self.startGame();
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();

    this._resizeHandler = function () { self.resizeCanvas(); };
    window.addEventListener('resize', this._resizeHandler);
  };

  p.resizeCanvas = function () {
    if (!this.gameCanvas) return;
    var cont = document.getElementById('game-container');
    if (!cont) return;
    var maxW = Math.min(cont.clientWidth - 4, 600);
    var maxH = Math.min(window.innerHeight - 260, 500);
    this.gameCanvas.width  = maxW;
    this.gameCanvas.height = Math.max(280, maxH);
  };

  p.backToList = function () {
    this.stopCurrentGame();
    var container = document.getElementById('game-play-area');
    var listArea  = document.getElementById('games-list-area');
    if (container) container.style.display = 'none';
    if (listArea)  listArea.style.display  = 'block';
    this.currentGame = null;
    this.renderGamesList();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
  };

  p.startGame = function () {
    var overlay = document.getElementById('game-overlay');
    if (overlay) overlay.style.display = 'none';
    this.score = 0;
    this.updateScoreDisplay(0);
    this.isPlaying = true;

    switch (this.currentGame) {
      case 'snake':       this.initSnake();       break;
      case 'memory':      this.initMemory();      break;
      case 'quiz':        this.initQuiz();        break;
      case 'flappy':      this.initFlappy();      break;
      case 'pong':        this.initPong();        break;
      case '2048':        this.init2048();        break;
      case 'tictactoe':   this.initTicTacToe();   break;
      case 'typing':      this.initTyping();      break;
      case 'minesweeper': this.initMinesweeper(); break;
      case 'breakout':    this.initBreakout();    break;
      case 'wordle':      this.initWordle();      break;
      case 'tetris':      this.initTetris();      break;
      default:            this.initUnsupported(); break;
    }
  };

  p.stopCurrentGame = function () {
    this.isPlaying = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._keyUpHandler) {
      document.removeEventListener('keyup', this._keyUpHandler);
      this._keyUpHandler = null;
    }
    for (var i = 0; i < this._touchCleanups.length; i++) {
      this._touchCleanups[i]();
    }
    this._touchCleanups = [];
  };

  p.gameOver = function (finalScore) {
    this.isPlaying = false;
    this.stopCurrentGame();

    finalScore = Math.round(finalScore || 0);
    this.saveHighScore(this.currentGame, finalScore);
    this.updateScoreDisplay(finalScore);

    var overlay = document.getElementById('game-overlay');
    var title   = document.getElementById('game-overlay-title');
    var text    = document.getElementById('game-overlay-text');
    var btn     = document.getElementById('game-start-btn');

    if (overlay) overlay.style.display = 'flex';
    if (title)   title.textContent = 'Game Over!';
    if (text) {
      var best = this.highScores[this.currentGame] || 0;
      text.textContent = 'Your score: ' + finalScore + '. ' +
        (best === finalScore && finalScore > 0
          ? 'New high score!'
          : 'Best: ' + best);
    }
    if (btn) {
      btn.innerHTML = '<i data-lucide="rotate-ccw"></i><span>Play Again</span>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  };

  p.updateScoreDisplay = function (score) {
    var el = document.getElementById('game-score');
    if (el) el.textContent = score;
    this.score = score;
  };

  /* ────────────────────────────────────────────────
     HIGH SCORES  — reads / writes via config.js Storage
  ──────────────────────────────────────────────── */
  p.loadHighScores = function () {
    this.highScores = readHighScores();
  };

  p.saveHighScore = function (gameId, score) {
    if (!gameId) return;
    this.loadHighScores();          /* always refresh first */
    if (!this.highScores[gameId] || score > this.highScores[gameId]) {
      this.highScores[gameId] = score;
      writeHighScores(this.highScores);

      /* Persist to Supabase (best-effort) */
      try {
        var cfg    = window.GAMES_CONFIG || [];
        var gName  = gameId;
        for (var i = 0; i < cfg.length; i++) {
          if (cfg[i].id === gameId) { gName = cfg[i].name; break; }
        }
        this.db.from('game_scores').insert({
          player_name: 'Guest',
          game_id:     gameId,
          game_name:   gName,
          score:       score
        });
      } catch (e) { /* silent */ }
    }
  };

  /* ────────────────────────────────────────────────
     COLOR HELPER
  ──────────────────────────────────────────────── */
  p.getColor = function (name) {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var map  = {
      bg:        dark ? '#1A1B26' : '#E8E8E8',
      primary:   dark ? '#4DEEEA' : '#0055FF',
      text:      dark ? '#EAEFFB' : '#3A3A3A',
      secondary: dark ? '#35374E' : '#BEBEBE',
      danger:    '#E53E3E',
      success:   '#38A169',
      warning:   '#D69E2E',
      white:     '#FFFFFF',
      dark:      '#222222',
      accent:    dark ? '#4DEEEA' : '#0055FF',
      muted:     dark ? '#666888' : '#888899'
    };
    return map[name] || map.primary;
  };

  /* ────────────────────────────────────────────────
     HELPERS
  ──────────────────────────────────────────────── */
  p.randomPosition = function (cols, rows, exclude) {
    var pos, safe = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
      };
      safe++;
      if (safe > 2000) break;
    } while (exclude && exclude.some(function (e) {
      return e.x === pos.x && e.y === pos.y;
    }));
    return pos;
  };

  p.setupTouchControls = function (element, callback) {
    if (!element) return;
    var startX = 0, startY = 0;
    var onStart = function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    var onEnd = function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return;
      if (Math.abs(dx) > Math.abs(dy)) callback(dx > 0 ? 'right' : 'left');
      else                              callback(dy > 0 ? 'down'  : 'up');
    };
    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchend',   onEnd,   { passive: true });
    this._touchCleanups.push(function () {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchend',   onEnd);
    });
  };

  p.drawRR = function (ctx, x, y, w, h, r) {
    /* safe rounded-rect helper — works on all browsers */
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  /* ============================================================
     1.  SNAKE
  ============================================================ */
  p.initSnake = function () {
    var canvas = this.gameCanvas, ctx = this.gameCtx;
    if (!canvas || !ctx) return;
    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var GS   = 20;
    var cols = Math.floor(canvas.width  / GS);
    var rows = Math.floor(canvas.height / GS);
    var self = this;

    var snake     = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    var direction = { x: 1, y: 0 };
    var nextDir   = { x: 1, y: 0 };
    var food      = this.randomPosition(cols, rows, snake);
    var score     = 0;
    var speed     = 120;

    this._keyHandler = function (e) {
      var k = e.key;
      if (k==='ArrowUp'    && direction.y!== 1) { nextDir={x:0,y:-1}; e.preventDefault(); }
      if (k==='ArrowDown'  && direction.y!==-1) { nextDir={x:0,y: 1}; e.preventDefault(); }
      if (k==='ArrowLeft'  && direction.x!== 1) { nextDir={x:-1,y:0}; e.preventDefault(); }
      if (k==='ArrowRight' && direction.x!==-1) { nextDir={x: 1,y:0}; e.preventDefault(); }
    };
    document.addEventListener('keydown', this._keyHandler);

    this.setupTouchControls(canvas, function (dir) {
      if (dir==='up'    && direction.y!== 1) nextDir={x:0,y:-1};
      if (dir==='down'  && direction.y!==-1) nextDir={x:0,y: 1};
      if (dir==='left'  && direction.x!== 1) nextDir={x:-1,y:0};
      if (dir==='right' && direction.x!==-1) nextDir={x: 1,y:0};
    });

    var tick = function () {
      if (!self.isPlaying) return;
      direction = { x: nextDir.x, y: nextDir.y };
      var head  = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

      if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        self.gameOver(score); return;
      }
      for (var i = 0; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
          self.gameOver(score); return;
        }
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        self.updateScoreDisplay(score);
        food = self.randomPosition(cols, rows, snake);
        if (speed > 60) {
          speed -= 3;
          clearInterval(self.gameInterval);
          self.gameInterval = setInterval(tick, speed);
        }
      } else {
        snake.pop();
      }

      /* Draw */
      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      /* Subtle grid */
      ctx.strokeStyle = self.getColor('secondary') + '20';
      ctx.lineWidth   = 0.5;
      for (var gx = 0; gx <= cols; gx++) {
        ctx.beginPath(); ctx.moveTo(gx*GS,0); ctx.lineTo(gx*GS,canvas.height); ctx.stroke();
      }
      for (var gy = 0; gy <= rows; gy++) {
        ctx.beginPath(); ctx.moveTo(0,gy*GS); ctx.lineTo(canvas.width,gy*GS); ctx.stroke();
      }

      /* Food */
      ctx.fillStyle = self.getColor('danger');
      ctx.beginPath();
      ctx.arc(food.x*GS+GS/2, food.y*GS+GS/2, GS/2-2, 0, Math.PI*2);
      ctx.fill();

      /* Snake */
      for (var s = 0; s < snake.length; s++) {
        var seg   = snake[s];
        var ratio = 1 - (s / snake.length) * 0.5;
        var alpha = Math.round(ratio*200).toString(16);
        if (alpha.length < 2) alpha = '0' + alpha;
        ctx.fillStyle = s === 0
          ? self.getColor('primary')
          : self.getColor('primary') + alpha;
        self.drawRR(ctx, seg.x*GS+1, seg.y*GS+1, GS-2, GS-2, 4);
        ctx.fill();

        if (s === 0) {
          ctx.fillStyle = self.getColor('bg');
          ctx.beginPath();
          ctx.arc(seg.x*GS+GS/2+direction.x*4,
                  seg.y*GS+GS/2+direction.y*4, 3, 0, Math.PI*2);
          ctx.fill();
        }
      }

      /* Score overlay */
      ctx.fillStyle = self.getColor('text') + 'CC';
      ctx.font      = 'bold 14px Poppins, sans-serif';
      ctx.fillText('Score: ' + score, 8, 20);
    };

    this.gameInterval = setInterval(tick, speed);
  };

  /* ============================================================
     2.  MEMORY MATCH
  ============================================================ */
  p.initMemory = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    var symbols = [
      'heart','star','globe','shield','award','users',
      'sun','moon','zap','coffee','book','flag'
    ];
    var chosen = symbols.slice(0, 8);
    var cards  = chosen.concat(chosen);

    /* Shuffle */
    for (var i = cards.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = cards[i]; cards[i] = cards[j]; cards[j] = t;
    }

    this._mem = {
      cards:      cards,
      flipped:    [],
      matched:    {},
      moves:      0,
      score:      0,
      locked:     false,
      totalPairs: chosen.length
    };

    this._renderMemory();
  };

  p._renderMemory = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var m    = this._mem;
    var self = this;

    var matchedCount = 0;
    var keys = Object.keys(m.matched);
    for (var k = 0; k < keys.length; k++) {
      if (m.matched[keys[k]]) matchedCount++;
    }
    matchedCount = Math.floor(matchedCount / 2);

    var html =
      '<div style="text-align:center;margin-bottom:12px;">' +
        '<span style="font-size:0.82rem;color:var(--text-secondary);">' +
          'Moves: <strong>' + m.moves + '</strong> | ' +
          'Matched: <strong>' + matchedCount + '/' + m.totalPairs + '</strong>' +
        '</span>' +
      '</div>' +
      '<div class="memory-grid">';

    for (var i = 0; i < m.cards.length; i++) {
      var isFlipped = (m.flipped.indexOf(i) !== -1) || m.matched[i];
      var isMatched = m.matched[i] || false;
      html +=
        '<div class="memory-card ' + (isFlipped ? 'flipped ' : '') +
             (isMatched ? 'matched' : '') + '" data-mi="' + i + '">' +
          '<div class="memory-card-inner">' +
            '<div class="memory-card-front">' +
              '<i data-lucide="help-circle"></i>' +
            '</div>' +
            '<div class="memory-card-back">' +
              '<i data-lucide="' + m.cards[i] + '"></i>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    html += '</div>';
    ui.innerHTML = html;

    var cardEls = ui.querySelectorAll('.memory-card');
    for (var c = 0; c < cardEls.length; c++) {
      (function (el) {
        el.addEventListener('click', function () {
          self.flipMemoryCard(parseInt(el.getAttribute('data-mi'), 10));
        });
      })(cardEls[c]);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  p.flipMemoryCard = function (index) {
    if (!this.isPlaying) return;
    var m    = this._mem;
    var self = this;
    if (m.locked)               return;
    if (m.matched[index])       return;
    if (m.flipped.indexOf(index) !== -1) return;

    m.flipped.push(index);
    this._renderMemory();

    if (m.flipped.length === 2) {
      m.moves++;
      m.locked = true;
      var a = m.flipped[0], b = m.flipped[1];

      if (m.cards[a] === m.cards[b]) {
        m.matched[a] = true;
        m.matched[b] = true;
        m.score += 20;
        this.updateScoreDisplay(m.score);
        m.flipped = [];
        m.locked  = false;
        this._renderMemory();

        var total = 0;
        var keys  = Object.keys(m.matched);
        for (var k = 0; k < keys.length; k++) {
          if (m.matched[keys[k]]) total++;
        }
        if (total >= m.cards.length) {
          var bonus = Math.max(0, 200 - m.moves * 5);
          m.score  += bonus;
          this.updateScoreDisplay(m.score);
          setTimeout(function () { self.gameOver(m.score); }, 600);
        }
      } else {
        setTimeout(function () {
          m.flipped = [];
          m.locked  = false;
          self._renderMemory();
        }, 900);
      }
    }
  };

  /* ============================================================
     3.  QUIZ
     Uses QUIZ_QUESTIONS from config.js
  ============================================================ */
  p.initQuiz = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    /* QUIZ_QUESTIONS is defined in config.js */
    var qs = window.QUIZ_QUESTIONS || [];
    /* Shuffle a copy */
    var questions = qs.slice();
    for (var i = questions.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = questions[i]; questions[i] = questions[j]; questions[j] = t;
    }

    this._quiz = {
      questions: questions,
      current:   0,
      score:     0,
      answered:  false
    };

    this._renderQuiz();
  };

  p._renderQuiz = function () {
    var ui   = document.getElementById('game-ui');
    if (!ui) return;
    var q    = this._quiz;
    var self = this;

    if (q.current >= q.questions.length) {
      this.gameOver(q.score);
      return;
    }

    var question = q.questions[q.current];
    var progress = (q.current / q.questions.length) * 100;

    var optsHTML = '';
    for (var i = 0; i < question.options.length; i++) {
      optsHTML +=
        '<button class="quiz-option" data-qi="' + i + '">' +
          '<span class="quiz-option-letter">' +
            String.fromCharCode(65 + i) +
          '</span>' +
          '<span class="quiz-option-text">' + question.options[i] + '</span>' +
        '</button>';
    }

    ui.innerHTML =
      '<div class="quiz-container">' +
        '<div class="quiz-progress">' +
          '<div class="quiz-progress-bar" style="width:' + progress + '%;"></div>' +
        '</div>' +
        '<div class="quiz-counter">' +
          'Question ' + (q.current + 1) + ' of ' + q.questions.length +
        '</div>' +
        '<h3 class="quiz-question">' + question.question + '</h3>' +
        '<div class="quiz-options" id="quiz-options">' + optsHTML + '</div>' +
        '<div id="quiz-exp-area"></div>' +
      '</div>';

    var btns = ui.querySelectorAll('.quiz-option');
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.answerQuiz(parseInt(btn.getAttribute('data-qi'), 10));
        });
      })(btns[b]);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  p.answerQuiz = function (optionIndex) {
    if (!this.isPlaying) return;
    var q    = this._quiz;
    var self = this;
    if (q.answered) return;
    q.answered = true;

    var question  = q.questions[q.current];
    var isCorrect = (optionIndex === question.answer);

    /* Disable all & highlight */
    var btns = document.querySelectorAll('.quiz-option');
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled        = true;
      btns[i].style.pointerEvents = 'none';
      var idx = parseInt(btns[i].getAttribute('data-qi'), 10);
      if (idx === question.answer)             btns[i].classList.add('quiz-correct');
      if (idx === optionIndex && !isCorrect)   btns[i].classList.add('quiz-wrong');
    }

    if (isCorrect) {
      q.score += 10;
      this.updateScoreDisplay(q.score);
    }

    /* Explanation */
    var expArea = document.getElementById('quiz-exp-area');
    if (expArea && question.explanation) {
      var icon  = isCorrect ? 'check-circle' : 'x-circle';
      var color = isCorrect ? 'var(--success)' : 'var(--danger)';
      expArea.innerHTML =
        '<div class="quiz-explanation">' +
          '<i data-lucide="' + icon + '" ' +
             'style="width:18px;height:18px;flex-shrink:0;color:' + color + ';"></i>' +
          '<span>' + question.explanation + '</span>' +
        '</div>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /* Next question */
    setTimeout(function () {
      q.current++;
      q.answered = false;
      self._renderQuiz();
    }, 2200);
  };

  /* ============================================================
     4.  TIC TAC TOE
  ============================================================ */
  p.initTicTacToe = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    this._ttt = {
      board:       [null,null,null,null,null,null,null,null,null],
      playerTurn:  true,
      active:      true,
      score:       0,
      wins:        0,
      losses:      0,
      draws:       0
    };
    this._renderTTT();
  };

  p._tttWin = function (board, player) {
    var p = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (var i = 0; i < p.length; i++) {
      if (board[p[i][0]]===player && board[p[i][1]]===player && board[p[i][2]]===player)
        return true;
    }
    return false;
  };

  p._tttAI = function (board) {
    var patterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    var i, pp, vals, ni, cnt;

    /* Win */
    for (i = 0; i < patterns.length; i++) {
      pp = patterns[i]; vals = [board[pp[0]],board[pp[1]],board[pp[2]]];
      cnt = 0; ni = -1;
      for (var v = 0; v < 3; v++) { if (vals[v]==='O') cnt++; if (vals[v]===null) ni=v; }
      if (cnt===2 && ni!==-1) return pp[ni];
    }
    /* Block */
    for (i = 0; i < patterns.length; i++) {
      pp = patterns[i]; vals = [board[pp[0]],board[pp[1]],board[pp[2]]];
      cnt = 0; ni = -1;
      for (var v2 = 0; v2 < 3; v2++) { if (vals[v2]==='X') cnt++; if (vals[v2]===null) ni=v2; }
      if (cnt===2 && ni!==-1) return pp[ni];
    }
    if (board[4]===null) return 4;
    var corners = [0,2,6,8].filter(function(c){return board[c]===null;});
    if (corners.length) return corners[Math.floor(Math.random()*corners.length)];
    var empty = [];
    for (i = 0; i < 9; i++) if (board[i]===null) empty.push(i);
    return empty.length ? empty[Math.floor(Math.random()*empty.length)] : -1;
  };

  p._renderTTT = function () {
    var ui   = document.getElementById('game-ui');
    if (!ui) return;
    var t    = this._ttt;
    var self = this;

    var status = !t.active ? 'Game ended'
               : t.playerTurn ? 'Your turn (X)' : 'AI thinking...';

    var grid = '<div class="ttt-grid">';
    for (var i = 0; i < 9; i++) {
      var cell = t.board[i];
      var cls  = 'ttt-cell' + (cell ? ' ttt-filled' : '') +
                 (cell==='X' ? ' ttt-x' : cell==='O' ? ' ttt-o' : '');
      var disabled = cell || !t.playerTurn || !t.active;
      var content  = cell==='X'
        ? '<i data-lucide="x" style="width:32px;height:32px;"></i>'
        : cell==='O'
          ? '<i data-lucide="circle" style="width:32px;height:32px;"></i>'
          : '';
      grid += '<button class="' + cls + '" data-ti="' + i + '"' +
              (disabled ? ' disabled' : '') + '>' + content + '</button>';
    }
    grid += '</div>';

    var newBtn = !t.active
      ? '<button class="btn btn-primary" id="ttt-new" style="margin-top:16px;">' +
          '<i data-lucide="rotate-ccw"></i><span>New Round</span></button>'
      : '';

    ui.innerHTML =
      '<div class="ttt-container">' +
        '<div class="ttt-scoreboard">' +
          '<span style="color:var(--accent);">You: '    + t.wins   + '</span>' +
          '<span style="color:var(--text-muted);">Draw: '+ t.draws  + '</span>' +
          '<span style="color:var(--danger);">AI: '     + t.losses + '</span>' +
        '</div>' +
        '<div class="ttt-status" id="ttt-status">' + status + '</div>' +
        grid + newBtn +
      '</div>';

    var cells = ui.querySelectorAll('.ttt-cell');
    for (var c = 0; c < cells.length; c++) {
      (function (el) {
        el.addEventListener('click', function () {
          self.tttMove(parseInt(el.getAttribute('data-ti'), 10));
        });
      })(cells[c]);
    }

    var nb = document.getElementById('ttt-new');
    if (nb) nb.addEventListener('click', function () { self.tttNewRound(); });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  p.tttMove = function (index) {
    if (!this.isPlaying) return;
    var t    = this._ttt;
    var self = this;
    if (!t.active || !t.playerTurn || t.board[index] !== null) return;

    t.board[index] = 'X';
    t.playerTurn   = false;
    this._renderTTT();

    if (this._tttWin(t.board, 'X')) {
      t.active = false; t.wins++; t.score += 30;
      this.updateScoreDisplay(t.score);
      this._renderTTT();
      var s1 = document.getElementById('ttt-status');
      if (s1) s1.textContent = 'You Win!';
      return;
    }
    if (t.board.every(function(c){return c!==null;})) {
      t.active = false; t.draws++; t.score += 10;
      this.updateScoreDisplay(t.score);
      this._renderTTT();
      var s2 = document.getElementById('ttt-status');
      if (s2) s2.textContent = "Draw!";
      return;
    }

    setTimeout(function () {
      if (!self.isPlaying) return;
      var move = self._tttAI(t.board);
      if (move === -1) return;
      t.board[move] = 'O';
      t.playerTurn  = true;

      if (self._tttWin(t.board, 'O')) {
        t.active = false; t.losses++;
        self._renderTTT();
        var s3 = document.getElementById('ttt-status');
        if (s3) s3.textContent = 'AI Wins!';
        return;
      }
      if (t.board.every(function(c){return c!==null;})) {
        t.active = false; t.draws++; t.score += 10;
        self.updateScoreDisplay(t.score);
        self._renderTTT();
        var s4 = document.getElementById('ttt-status');
        if (s4) s4.textContent = "Draw!";
        return;
      }
      self._renderTTT();
    }, 500);
  };

  p.tttNewRound = function () {
    if (!this.isPlaying) return;
    this._ttt.board      = [null,null,null,null,null,null,null,null,null];
    this._ttt.playerTurn = true;
    this._ttt.active     = true;
    this._renderTTT();
  };

  /* ============================================================
     5.  SPEED TYPING
     Uses TYPING_QUOTES from config.js
  ============================================================ */
  p.initTyping = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    /* TYPING_QUOTES from config.js */
    var quotes = window.TYPING_QUOTES || ['Service Above Self.'];
    var quote  = quotes[Math.floor(Math.random() * quotes.length)];

    var startTime = Date.now();
    var finished  = false;
    var self      = this;

    ui.innerHTML =
      '<div class="typing-container">' +
        '<h3 style="font-size:0.9rem;font-weight:700;color:var(--text-heading);' +
            'margin-bottom:16px;text-align:center;">' +
          'Type the text below as fast as you can!' +
        '</h3>' +
        '<div class="typing-target" id="typing-target">' + quote + '</div>' +
        '<div style="margin-top:16px;">' +
          '<textarea id="typing-input" rows="3" ' +
            'placeholder="Start typing here..." ' +
            'style="font-size:1rem;line-height:1.8;width:100%;box-sizing:border-box;' +
            'resize:none;padding:12px;border-radius:8px;' +
            'border:2px solid var(--border);background:var(--bg-card);' +
            'color:var(--text-primary);font-family:Poppins,sans-serif;' +
            'outline:none;transition:border-color 0.2s;"></textarea>' +
        '</div>' +
        '<div class="typing-stats">' +
          '<span>WPM: <strong id="stat-wpm">0</strong></span>' +
          '<span>Accuracy: <strong id="stat-acc">100%</strong></span>' +
          '<span>Time: <strong id="stat-time">0s</strong></span>' +
        '</div>' +
      '</div>';

    var input    = document.getElementById('typing-input');
    var targetEl = document.getElementById('typing-target');
    if (!input) return;
    input.focus();

    input.addEventListener('focus', function () { input.style.borderColor = 'var(--accent)'; });
    input.addEventListener('blur',  function () { input.style.borderColor = 'var(--border)'; });

    input.addEventListener('input', function () {
      if (finished || !self.isPlaying) return;
      var typed   = input.value;
      var elapsed = Math.max(1, (Date.now() - startTime) / 1000);
      var words   = typed.trim() === '' ? 0 : typed.trim().split(/\s+/).length;
      var wpm     = Math.round((words / elapsed) * 60);

      var correct = 0;
      var len     = Math.min(typed.length, quote.length);
      for (var i = 0; i < len; i++) {
        if (typed[i] === quote[i]) correct++;
      }
      var accuracy = typed.length > 0
        ? Math.round((correct / typed.length) * 100) : 100;

      /* Highlight */
      var hl = '';
      for (var h = 0; h < quote.length; h++) {
        var ch = quote[h] === ' ' ? '&nbsp;' : quote[h];
        if (h < typed.length) {
          if (typed[h] === quote[h]) {
            hl += '<span style="color:var(--success);font-weight:600;">' + ch + '</span>';
          } else {
            hl += '<span style="color:var(--danger);background:rgba(229,62,62,0.15);' +
                  'text-decoration:underline;">' + ch + '</span>';
          }
        } else {
          hl += (quote[h] === ' ') ? ' ' : quote[h];
        }
      }
      if (targetEl) targetEl.innerHTML = hl;

      var wEl  = document.getElementById('stat-wpm');
      var aEl  = document.getElementById('stat-acc');
      var tEl  = document.getElementById('stat-time');
      if (wEl) wEl.textContent = wpm;
      if (aEl) aEl.textContent = accuracy + '%';
      if (tEl) tEl.textContent = Math.round(elapsed) + 's';

      var score = Math.round(wpm * (accuracy / 100));
      self.updateScoreDisplay(score);

      if (typed.length >= quote.length) {
        finished        = true;
        input.disabled  = true;
        setTimeout(function () { self.gameOver(score); }, 500);
      }
    });
  };

  /* ============================================================
     6.  FLAPPY BIRD
  ============================================================ */
  p.initFlappy = function () {
    var canvas = this.gameCanvas, ctx = this.gameCtx;
    if (!canvas || !ctx) return;
    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var self      = this;
    var birdY     = canvas.height / 2;
    var birdVel   = 0;
    var birdX     = 80, birdSize = 18;
    var gravity   = 0.45, jumpStr = -7.5;
    var pipeW     = 52, pipeGap = 145, pipeSpd = 2.5;
    var pipes     = [];
    var score     = 0, frame = 0;

    var addPipe = function () {
      var min = 60, max = canvas.height - pipeGap - 60;
      pipes.push({ x: canvas.width, topH: Math.random()*(max-min)+min, passed: false });
    };

    var doJump = function () { if (self.isPlaying) birdVel = jumpStr; };

    this._keyHandler = function (e) {
      if (e.code==='Space'||e.key==='ArrowUp') { e.preventDefault(); doJump(); }
    };
    document.addEventListener('keydown', this._keyHandler);

    var clickH = function () { doJump(); };
    var touchH = function (e) { e.preventDefault(); doJump(); };
    canvas.addEventListener('click', clickH);
    canvas.addEventListener('touchstart', touchH, { passive: false });
    this._touchCleanups.push(function () {
      canvas.removeEventListener('click', clickH);
      canvas.removeEventListener('touchstart', touchH);
    });

    addPipe();

    var tick = function () {
      if (!self.isPlaying) return;
      self.animationFrame = requestAnimationFrame(tick);
      frame++;
      birdVel += gravity;
      birdY   += birdVel;

      if (frame % 90 === 0) addPipe();

      var newPipes = [];
      for (var p = 0; p < pipes.length; p++) {
        pipes[p].x -= pipeSpd;
        if (!pipes[p].passed && pipes[p].x + pipeW < birdX) {
          pipes[p].passed = true; score++;
          self.updateScoreDisplay(score);
        }
        if (pipes[p].x > -pipeW - 10) newPipes.push(pipes[p]);
      }
      pipes = newPipes;

      if (birdY < 0 || birdY + birdSize > canvas.height) {
        self.gameOver(score); return;
      }
      for (var c = 0; c < pipes.length; c++) {
        var pp = pipes[c];
        var botY = pp.topH + pipeGap;
        if (birdX+birdSize-4>pp.x && birdX+4<pp.x+pipeW) {
          if (birdY+4<pp.topH || birdY+birdSize-4>botY) {
            self.gameOver(score); return;
          }
        }
      }

      /* Draw */
      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      var pc = self.getColor('success');
      for (var d = 0; d < pipes.length; d++) {
        var pi = pipes[d], by = pi.topH + pipeGap;
        ctx.fillStyle = pc;
        ctx.fillRect(pi.x, 0, pipeW, pi.topH);
        ctx.fillRect(pi.x, by, pipeW, canvas.height - by);
        ctx.fillStyle = pc + 'CC';
        ctx.fillRect(pi.x-5, pi.topH-22, pipeW+10, 22);
        ctx.fillRect(pi.x-5, by, pipeW+10, 22);
      }

      ctx.fillStyle = self.getColor('primary');
      ctx.beginPath();
      ctx.arc(birdX+birdSize/2, birdY+birdSize/2, birdSize/2, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = self.getColor('white');
      ctx.beginPath();
      ctx.arc(birdX+birdSize/2+5, birdY+birdSize/2-3, 4, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = self.getColor('dark');
      ctx.beginPath();
      ctx.arc(birdX+birdSize/2+6, birdY+birdSize/2-3, 2, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle   = self.getColor('text') + 'CC';
      ctx.font        = 'bold 18px Poppins, sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillText('' + score, canvas.width/2, 30);
      ctx.textAlign   = 'start';

      ctx.strokeStyle = self.getColor('secondary');
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height-1);
      ctx.lineTo(canvas.width, canvas.height-1);
      ctx.stroke();
    };

    tick();
  };

  /* ============================================================
     7.  BREAKOUT
  ============================================================ */
  p.initBreakout = function () {
    var canvas = this.gameCanvas, ctx = this.gameCtx;
    if (!canvas || !ctx) return;
    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var self   = this;
    var padW   = 90, padH = 12;
    var padX   = canvas.width / 2 - padW / 2;
    var ballR  = 8;
    var ballX  = canvas.width / 2, ballY = canvas.height - 60;
    var bDX    = 3.5, bDY = -3.5;
    var lives  = 3;
    var score  = 0;

    var bRows  = 5;
    var bCols  = Math.floor((canvas.width - 20) / 58);
    var bW     = (canvas.width - 20 - (bCols-1)*4) / bCols;
    var bH     = 18, bPad = 4, bTop = 40, bLeft = 10;

    var rowColors = [
      self.getColor('danger'), self.getColor('warning'),
      self.getColor('success'), self.getColor('primary'), '#9F7AEA'
    ];

    var bricks = [];
    for (var r = 0; r < bRows; r++) {
      for (var c = 0; c < bCols; c++) {
        bricks.push({
          x: bLeft + c*(bW+bPad), y: bTop + r*(bH+bPad),
          alive: true, color: rowColors[r]
        });
      }
    }

    var rightP = false, leftP = false;
    this._keyHandler = function (e) {
      if (e.key==='ArrowRight'){rightP=true; e.preventDefault();}
      if (e.key==='ArrowLeft') {leftP=true;  e.preventDefault();}
    };
    this._keyUpHandler = function (e) {
      if (e.key==='ArrowRight') rightP=false;
      if (e.key==='ArrowLeft')  leftP=false;
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup',   this._keyUpHandler);

    var mmH = function (e) {
      var rect=canvas.getBoundingClientRect();
      var sx=canvas.width/rect.width;
      padX=Math.max(0,Math.min(canvas.width-padW,(e.clientX-rect.left)*sx-padW/2));
    };
    var tmH = function (e) {
      e.preventDefault();
      var rect=canvas.getBoundingClientRect();
      var sx=canvas.width/rect.width;
      padX=Math.max(0,Math.min(canvas.width-padW,(e.touches[0].clientX-rect.left)*sx-padW/2));
    };
    canvas.addEventListener('mousemove', mmH);
    canvas.addEventListener('touchmove', tmH, { passive: false });
    this._touchCleanups.push(function () {
      canvas.removeEventListener('mousemove', mmH);
      canvas.removeEventListener('touchmove', tmH);
    });

    var tick = function () {
      if (!self.isPlaying) return;
      self.animationFrame = requestAnimationFrame(tick);

      if (rightP && padX < canvas.width-padW) padX += 7;
      if (leftP  && padX > 0)                 padX -= 7;

      ballX += bDX; ballY += bDY;

      if (ballX+ballR>canvas.width || ballX-ballR<0) bDX=-bDX;
      if (ballY-ballR<0)                              bDY=-bDY;

      var padTop = canvas.height - padH - 10;
      if (ballY+ballR>=padTop && ballY+ballR<=padTop+padH+Math.abs(bDY) &&
          ballX>=padX && ballX<=padX+padW) {
        bDY  = -Math.abs(bDY);
        bDX  = (((ballX-padX)/padW)-0.5)*9;
      }

      if (ballY+ballR>canvas.height) {
        lives--;
        if (lives<=0) { self.gameOver(score); return; }
        ballX=canvas.width/2; ballY=canvas.height-60; bDX=3.5; bDY=-3.5;
      }

      var allDead = true;
      for (var b = 0; b < bricks.length; b++) {
        var bk = bricks[b];
        if (!bk.alive) continue;
        allDead = false;
        if (ballX+ballR>bk.x && ballX-ballR<bk.x+bW &&
            ballY+ballR>bk.y && ballY-ballR<bk.y+bH) {
          var oL=ballX+ballR-bk.x, oR=bk.x+bW-(ballX-ballR);
          var oT=ballY+ballR-bk.y, oB=bk.y+bH-(ballY-ballR);
          var mO=Math.min(oL,oR,oT,oB);
          if (mO===oT||mO===oB) bDY=-bDY; else bDX=-bDX;
          bk.alive=false; score+=10;
          self.updateScoreDisplay(score);
          break;
        }
      }
      if (allDead) { self.gameOver(score+100); return; }

      /* Draw */
      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (var d = 0; d < bricks.length; d++) {
        if (!bricks[d].alive) continue;
        ctx.fillStyle   = bricks[d].color;
        ctx.fillRect(bricks[d].x, bricks[d].y, bW, bH);
        ctx.strokeStyle = self.getColor('bg');
        ctx.lineWidth   = 1;
        ctx.strokeRect(bricks[d].x, bricks[d].y, bW, bH);
      }

      ctx.fillStyle = self.getColor('primary');
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballR, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = self.getColor('text');
      self.drawRR(ctx, padX, padTop, padW, padH, 6);
      ctx.fill();

      ctx.fillStyle = self.getColor('text') + 'CC';
      ctx.font      = 'bold 13px Poppins, sans-serif';
      var livesStr  = 'Lives: ';
      for (var lv = 0; lv < lives; lv++) livesStr += '* ';
      ctx.fillText(livesStr.trim(), 8, 20);
    };

    tick();
  };

  /* ============================================================
     8.  WORDLE
  ============================================================ */
  p.initWordle = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    var words = WORDLE_WORDS; /* defined at top of this file */
    this._wordle = {
      word:         words[Math.floor(Math.random()*words.length)],
      guesses:      [],
      currentGuess: '',
      maxGuesses:   6,
      won:          false,
      lost:         false
    };

    this._renderWordle();
    this._setupWordleKeys();
  };

  p._wordleStates = function () {
    var w = this._wordle, states = {};
    for (var g = 0; g < w.guesses.length; g++) {
      var guess = w.guesses[g];
      for (var i = 0; i < 5; i++) {
        var letter = guess[i];
        if (!letter) continue;
        if (letter===w.word[i]) {
          states[letter] = 'correct';
        } else if (w.word.indexOf(letter)!==-1 && states[letter]!=='correct') {
          states[letter] = 'present';
        } else if (w.word.indexOf(letter)===-1 && !states[letter]) {
          states[letter] = 'absent';
        }
      }
    }
    return states;
  };

  p._renderWordle = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var w    = this._wordle;
    var self = this;

    var gridHTML = '<div class="wordle-grid">';
    for (var row = 0; row < w.maxGuesses; row++) {
      var guess    = w.guesses[row] || '';
      var isActive = (row===w.guesses.length && !w.won && !w.lost);
      var display  = isActive ? w.currentGuess : guess;

      gridHTML += '<div class="wordle-row">';
      for (var col = 0; col < 5; col++) {
        var cls    = 'wordle-cell';
        var letter = display[col] || '';
        if (row < w.guesses.length && guess[col]) {
          if (guess[col]===w.word[col])           cls += ' wc-correct';
          else if (w.word.indexOf(guess[col])!==-1) cls += ' wc-present';
          else                                    cls += ' wc-absent';
        } else if (isActive && letter) {
          cls += ' wc-active';
        }
        gridHTML += '<div class="' + cls + '">' + letter + '</div>';
      }
      gridHTML += '</div>';
    }
    gridHTML += '</div>';

    var msgHTML = '';
    if (w.won)  msgHTML = '<div class="wordle-msg wm-success">Brilliant! Word: <strong>' + w.word + '</strong></div>';
    if (w.lost) msgHTML = '<div class="wordle-msg wm-danger">Word was <strong>' + w.word + '</strong>. Try again!</div>';

    var kbRows = [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['ENTER','Z','X','C','V','B','N','M','DEL']
    ];
    var states  = this._wordleStates();
    var kbHTML  = '<div class="wordle-keyboard">';
    for (var kr = 0; kr < kbRows.length; kr++) {
      kbHTML += '<div class="wordle-kb-row">';
      for (var kc = 0; kc < kbRows[kr].length; kc++) {
        var key   = kbRows[kr][kc];
        var state = states[key] || '';
        var wide  = (key==='ENTER'||key==='DEL') ? ' wk-wide' : '';
        kbHTML += '<button class="wordle-key' + wide + ' wk-' + state + '" ' +
                  'data-wk="' + key + '">' + key + '</button>';
      }
      kbHTML += '</div>';
    }
    kbHTML += '</div>';

    ui.innerHTML =
      '<div class="wordle-container">' +
        '<div style="text-align:center;margin-bottom:8px;font-size:0.8rem;' +
            'color:var(--text-muted);font-weight:600;">Guess the 5-letter word!</div>' +
        gridHTML + msgHTML + kbHTML +
      '</div>';

    var kBtns = ui.querySelectorAll('.wordle-key');
    for (var kb = 0; kb < kBtns.length; kb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.wordleKey(btn.getAttribute('data-wk'));
        });
      })(kBtns[kb]);
    }
  };

  p._setupWordleKeys = function () {
    var self = this;
    this._keyHandler = function (e) {
      if (!self.isPlaying) return;
      var w = self._wordle;
      if (w.won || w.lost) return;
      var key = e.key.toUpperCase();
      if (key==='ENTER')     { self.wordleKey('ENTER');    e.preventDefault(); }
      else if (key==='BACKSPACE') { self.wordleKey('DEL'); e.preventDefault(); }
      else if (/^[A-Z]$/.test(key)) { self.wordleKey(key); }
    };
    document.addEventListener('keydown', this._keyHandler);
  };

  p.wordleKey = function (key) {
    if (!this.isPlaying) return;
    var w    = this._wordle;
    var self = this;
    if (w.won || w.lost) return;

    if (key==='DEL'||key==='BACKSPACE') {
      w.currentGuess = w.currentGuess.slice(0, -1);
    } else if (key==='ENTER') {
      if (w.currentGuess.length < 5) {
        var rows = document.querySelectorAll('.wordle-row');
        var ar   = rows[w.guesses.length];
        if (ar) {
          ar.classList.add('wordle-shake');
          setTimeout(function(){ar.classList.remove('wordle-shake');},500);
        }
        return;
      }
      w.guesses.push(w.currentGuess);
      if (w.currentGuess===w.word) {
        w.won = true;
        var bonus = (w.maxGuesses - w.guesses.length + 1) * 20;
        var sc    = 100 + bonus;
        this.updateScoreDisplay(sc);
        this._renderWordle();
        setTimeout(function(){self.gameOver(sc);},1500);
        return;
      }
      if (w.guesses.length>=w.maxGuesses) {
        w.lost = true;
        this._renderWordle();
        setTimeout(function(){self.gameOver(0);},1500);
        return;
      }
      w.currentGuess = '';
    } else if (/^[A-Z]$/.test(key) && w.currentGuess.length<5) {
      w.currentGuess += key;
    }

    this._renderWordle();
  };

  /* ============================================================
     9.  PONG
  ============================================================ */
  p.initPong = function () {
    var canvas = this.gameCanvas, ctx = this.gameCtx;
    if (!canvas || !ctx) return;
    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var self   = this;
    var padH   = 70, padW = 10, ballSz = 10, winSc = 7;
    var playerY = canvas.height/2 - padH/2;
    var aiY     = canvas.height/2 - padH/2;
    var ballX   = canvas.width/2, ballY = canvas.height/2;
    var bDX     = 4, bDY = 3;
    var pSc     = 0, aiSc = 0, aiSpd = 3.2;
    var upP     = false, downP = false;

    this._keyHandler = function (e) {
      if (e.key==='ArrowUp'||e.key==='w'||e.key==='W'){upP=true;e.preventDefault();}
      if (e.key==='ArrowDown'||e.key==='s'||e.key==='S'){downP=true;e.preventDefault();}
    };
    this._keyUpHandler = function (e) {
      if (e.key==='ArrowUp'||e.key==='w'||e.key==='W') upP=false;
      if (e.key==='ArrowDown'||e.key==='s'||e.key==='S') downP=false;
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup',   this._keyUpHandler);

    var tmH = function (e) {
      e.preventDefault();
      var rect=canvas.getBoundingClientRect();
      var sy=canvas.height/rect.height;
      playerY=Math.max(0,Math.min(canvas.height-padH,
        (e.touches[0].clientY-rect.top)*sy-padH/2));
    };
    canvas.addEventListener('touchmove', tmH, { passive: false });
    this._touchCleanups.push(function(){canvas.removeEventListener('touchmove',tmH);});

    var resetBall = function () {
      ballX=canvas.width/2; ballY=canvas.height/2;
      bDX=(Math.random()>0.5?1:-1)*4;
      bDY=(Math.random()>0.5?1:-1)*3;
    };

    var tick = function () {
      if (!self.isPlaying) return;
      self.animationFrame = requestAnimationFrame(tick);

      if (upP   && playerY>0)               playerY-=6;
      if (downP && playerY<canvas.height-padH) playerY+=6;

      var aiC = aiY + padH/2;
      if (aiC<ballY-5) aiY=Math.min(canvas.height-padH,aiY+aiSpd);
      if (aiC>ballY+5) aiY=Math.max(0,aiY-aiSpd);

      ballX+=bDX; ballY+=bDY;

      if (ballY-ballSz/2<0 || ballY+ballSz/2>canvas.height) bDY=-bDY;

      /* Player paddle (left) */
      if (ballX-ballSz/2<padW+20 && ballY>playerY && ballY<playerY+padH && bDX<0) {
        bDX=Math.abs(bDX)*1.05;
        bDY=((ballY-playerY)/padH-0.5)*8;
      }
      /* AI paddle (right) */
      if (ballX+ballSz/2>canvas.width-padW-20 && ballY>aiY && ballY<aiY+padH && bDX>0) {
        bDX=-Math.abs(bDX)*1.05;
        bDY=((ballY-aiY)/padH-0.5)*8;
      }
      bDX=Math.max(-10,Math.min(10,bDX));
      bDY=Math.max(-8, Math.min(8, bDY));

      if (ballX<0) {
        aiSc++;
        if (aiSc>=winSc){self.gameOver(pSc*10);return;}
        resetBall();
      }
      if (ballX>canvas.width) {
        pSc++;
        self.updateScoreDisplay(pSc*10);
        if (pSc>=winSc){self.gameOver(pSc*15);return;}
        resetBall();
      }

      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0,0,canvas.width,canvas.height);

      ctx.setLineDash([10,10]);
      ctx.strokeStyle = self.getColor('secondary')+'60';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width/2,0);
      ctx.lineTo(canvas.width/2,canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = self.getColor('primary');
      self.drawRR(ctx,10,playerY,padW,padH,5); ctx.fill();

      ctx.fillStyle = self.getColor('danger');
      self.drawRR(ctx,canvas.width-padW-10,aiY,padW,padH,5); ctx.fill();

      ctx.fillStyle = self.getColor('text');
      ctx.beginPath();
      ctx.arc(ballX,ballY,ballSz/2,0,Math.PI*2); ctx.fill();

      ctx.fillStyle   = self.getColor('text');
      ctx.font        = 'bold 28px Poppins, sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillText(''+pSc, canvas.width/2-36, 40);
      ctx.fillText(''+aiSc,canvas.width/2+36, 40);
      ctx.font        = 'bold 10px Poppins, sans-serif';
      ctx.fillStyle   = self.getColor('muted');
      ctx.fillText('YOU',canvas.width/2-36,56);
      ctx.fillText('AI', canvas.width/2+36,56);
      ctx.textAlign   = 'start';
    };

    tick();
  };

  /* ============================================================
     10.  2048
  ============================================================ */
  p.init2048 = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    var self = this, SIZE = 4;

    var newGrid = function () {
      var g=[];
      for(var r=0;r<SIZE;r++){var row=[];for(var c=0;c<SIZE;c++)row.push(0);g.push(row);}
      return g;
    };

    var addRandom = function (grid) {
      var empty=[];
      for(var r=0;r<SIZE;r++) for(var c=0;c<SIZE;c++) if(!grid[r][c]) empty.push([r,c]);
      if(!empty.length) return;
      var cell=empty[Math.floor(Math.random()*empty.length)];
      grid[cell[0]][cell[1]]=Math.random()<0.9?2:4;
    };

    var rotateCW = function (g) {
      var n=newGrid();
      for(var r=0;r<SIZE;r++) for(var c=0;c<SIZE;c++) n[c][SIZE-1-r]=g[r][c];
      return n;
    };

    var slide = function (row) {
      var arr=[],pts=0;
      for(var i=0;i<row.length;i++) if(row[i]) arr.push(row[i]);
      for(var j=0;j<arr.length-1;j++){
        if(arr[j]===arr[j+1]){arr[j]*=2;pts+=arr[j];arr.splice(j+1,1);}
      }
      while(arr.length<SIZE) arr.push(0);
      return {row:arr,pts:pts};
    };

    var hasMoves = function (g) {
      for(var r=0;r<SIZE;r++) for(var c=0;c<SIZE;c++){
        if(!g[r][c]) return true;
        if(c<SIZE-1&&g[r][c]===g[r][c+1]) return true;
        if(r<SIZE-1&&g[r][c]===g[r+1][c]) return true;
      }
      return false;
    };

    var grid  = newGrid();
    var score = 0;
    addRandom(grid); addRandom(grid);
    this._g2048 = { grid: grid, score: score };

    var doMove = function (dir) {
      var gd   = self._g2048;
      var rots = {left:0,right:2,up:3,down:1}[dir]||0;
      var moved=false, pts=0;

      var temp=[];
      for(var r=0;r<SIZE;r++) temp.push(gd.grid[r].slice());
      for(var i=0;i<rots;i++) temp=rotateCW(temp);

      for(var row=0;row<SIZE;row++){
        var res=slide(temp[row]);
        pts+=res.pts;
        if(JSON.stringify(temp[row])!==JSON.stringify(res.row)) moved=true;
        temp[row]=res.row;
      }
      for(var j=0;j<(4-rots)%4;j++) temp=rotateCW(temp);

      if(moved){
        gd.grid=temp; gd.score+=pts; score=gd.score;
        addRandom(gd.grid);
        self.updateScoreDisplay(score);
        self._render2048();

        var has2048=false;
        for(var r2=0;r2<SIZE;r2++) for(var c2=0;c2<SIZE;c2++)
          if(gd.grid[r2][c2]===2048) has2048=true;
        if(has2048){setTimeout(function(){self.gameOver(score+500);},300);return;}
        if(!hasMoves(gd.grid)){setTimeout(function(){self.gameOver(score);},300);}
      }
    };

    this._2048move = doMove;

    this._keyHandler = function (e) {
      if(!self.isPlaying) return;
      var map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
      if(map[e.key]){e.preventDefault();doMove(map[e.key]);}
    };
    document.addEventListener('keydown', this._keyHandler);
    this.setupTouchControls(ui, function(dir){doMove(dir);});

    this._render2048();
  };

  p._render2048 = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var gd   = this._g2048;
    var self = this;

    var tileColors = {
      0:{bg:'#cdc1b4',fg:'#cdc1b4'},
      2:{bg:'#eee4da',fg:'#776e65'},
      4:{bg:'#ede0c8',fg:'#776e65'},
      8:{bg:'#f2b179',fg:'#f9f6f2'},
      16:{bg:'#f59563',fg:'#f9f6f2'},
      32:{bg:'#f67c5f',fg:'#f9f6f2'},
      64:{bg:'#f65e3b',fg:'#f9f6f2'},
      128:{bg:'#edcf72',fg:'#f9f6f2'},
      256:{bg:'#edcc61',fg:'#f9f6f2'},
      512:{bg:'#edc850',fg:'#f9f6f2'},
      1024:{bg:'#edc53f',fg:'#f9f6f2'},
      2048:{bg:'#edc22e',fg:'#f9f6f2'}
    };

    var cells = '';
    for(var r=0;r<4;r++) for(var c=0;c<4;c++){
      var v=gd.grid[r][c];
      var cl=tileColors[v]||tileColors[2048];
      var fs=v>=1024?'1rem':v>=128?'1.2rem':'1.4rem';
      cells+='<div class="g2048-cell" style="background:'+cl.bg+';color:'+cl.fg+';font-size:'+fs+';">'+(v||'')+'</div>';
    }

    ui.innerHTML=
      '<div class="g2048-container">'+
        '<div style="text-align:center;margin-bottom:12px;font-size:0.82rem;'+
            'color:var(--text-muted);font-weight:600;">'+
          'Arrow keys or swipe to merge tiles!'+
        '</div>'+
        '<div class="g2048-grid">'+cells+'</div>'+
        '<div style="display:flex;justify-content:center;gap:12px;margin-top:16px;flex-wrap:wrap;">'+
          '<button class="g2048-btn" data-d="up">&#9650;</button>'+
          '<button class="g2048-btn" data-d="left">&#9664;</button>'+
          '<button class="g2048-btn" data-d="down">&#9660;</button>'+
          '<button class="g2048-btn" data-d="right">&#9654;</button>'+
        '</div>'+
      '</div>';

    var dBtns = ui.querySelectorAll('.g2048-btn');
    for(var d=0;d<dBtns.length;d++){
      (function(btn){
        btn.addEventListener('click',function(){self._2048move(btn.getAttribute('data-d'));});
      })(dBtns[d]);
    }
  };

  /* ============================================================
     11.  MINESWEEPER
  ============================================================ */
  p.initMinesweeper = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    var ROWS=9, COLS=9, MINES=10;
    var dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    var board=[];
    for(var r=0;r<ROWS;r++){
      var row=[];
      for(var c=0;c<COLS;c++)
        row.push({r:r,c:c,mine:false,revealed:false,flagged:false,adjacent:0});
      board.push(row);
    }

    /* Place mines */
    var placed=0;
    while(placed<MINES){
      var mr=Math.floor(Math.random()*ROWS);
      var mc=Math.floor(Math.random()*COLS);
      if(!board[mr][mc].mine){board[mr][mc].mine=true;placed++;}
    }

    var recalc=function(){
      for(var r2=0;r2<ROWS;r2++) for(var c2=0;c2<COLS;c2++){
        if(board[r2][c2].mine){board[r2][c2].adjacent=0;continue;}
        var cnt=0;
        for(var d=0;d<dirs.length;d++){
          var nr=r2+dirs[d][0],nc=c2+dirs[d][1];
          if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[nr][nc].mine) cnt++;
        }
        board[r2][c2].adjacent=cnt;
      }
    };
    recalc();

    this._ms={
      board:board,rows:ROWS,cols:COLS,mines:MINES,
      revealed:0,flagged:0,firstMove:true,
      won:false,lost:false,score:0,dirs:dirs,recalc:recalc
    };
    this._renderMS();
  };

  p._renderMS = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var ms   = this._ms;
    var self = this;

    var adjColors=['','#1976D2','#388E3C','#D32F2F','#7B1FA2',
                   '#F57F17','#0097A7','#212121','#757575'];
    var safe     = ms.rows*ms.cols - ms.mines;
    var remaining= ms.mines - ms.flagged;

    var gridHTML='<div class="ms-grid" style="grid-template-columns:repeat('+ms.cols+',1fr);">';
    for(var r=0;r<ms.rows;r++) for(var c=0;c<ms.cols;c++){
      var cell=ms.board[r][c];
      var content='', cls='ms-cell';

      if(ms.lost&&cell.mine&&!cell.flagged){
        cls+=' ms-mine';
        content='<i data-lucide="crosshair" style="width:14px;height:14px;"></i>';
      } else if(cell.flagged){
        content='<i data-lucide="flag" style="width:14px;height:14px;color:var(--danger);"></i>';
        cls+=' ms-flagged';
      } else if(!cell.revealed){
        cls+=' ms-hidden';
      } else if(cell.mine){
        cls+=' ms-mine';
        content='<i data-lucide="crosshair" style="width:14px;height:14px;"></i>';
      } else {
        cls+=' ms-revealed';
        if(cell.adjacent>0)
          content='<span style="color:'+adjColors[cell.adjacent]+';font-weight:800;">'+cell.adjacent+'</span>';
      }

      gridHTML+='<div class="'+cls+'" data-mr="'+r+'" data-mc="'+c+'">'+content+'</div>';
    }
    gridHTML+='</div>';

    var statusIcon = ms.won?'check-circle':ms.lost?'x-circle':'play';
    var statusText = ms.won?'You Win!':ms.lost?'Boom!':'Playing';

    var actionBtn = (ms.won||ms.lost)
      ? '<button class="btn btn-primary" id="ms-restart" '+
          'style="display:block;margin:12px auto 0;">'+
          '<i data-lucide="rotate-ccw"></i><span>New Game</span></button>'
      : '';

    ui.innerHTML=
      '<div class="ms-container">'+
        '<div class="ms-header">'+
          '<span><i data-lucide="crosshair" style="width:14px;height:14px;vertical-align:middle;"></i> '+remaining+' left</span>'+
          '<span><i data-lucide="'+statusIcon+'" style="width:14px;height:14px;vertical-align:middle;"></i> '+statusText+'</span>'+
          '<span><i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:middle;"></i> '+ms.revealed+'/'+safe+'</span>'+
        '</div>'+
        gridHTML+
        '<p style="text-align:center;font-size:0.72rem;color:var(--text-muted);margin-top:10px;">'+
          'Click to reveal | Right-click / long-press to flag'+
        '</p>'+
        actionBtn+
      '</div>';

    /* Attach handlers */
    var cells=ui.querySelectorAll('.ms-cell');
    for(var i=0;i<cells.length;i++){
      (function(el){
        var cr=parseInt(el.getAttribute('data-mr'),10);
        var cc=parseInt(el.getAttribute('data-mc'),10);
        el.addEventListener('click',function(){self.msReveal(cr,cc);});
        el.addEventListener('contextmenu',function(e){e.preventDefault();self.msFlag(cr,cc);});
        var timer=null;
        el.addEventListener('touchstart',function(e){
          timer=setTimeout(function(){e.preventDefault();self.msFlag(cr,cc);},500);
        },{passive:false});
        el.addEventListener('touchend',  function(){clearTimeout(timer);});
        el.addEventListener('touchmove', function(){clearTimeout(timer);});
      })(cells[i]);
    }

    var rb=document.getElementById('ms-restart');
    if(rb) rb.addEventListener('click',function(){self.initMinesweeper();});

    if(typeof lucide!=='undefined') lucide.createIcons();
  };

  p.msReveal = function (r, c) {
    if (!this.isPlaying) return;
    var ms   = this._ms;
    var cell = ms.board[r][c];
    if (ms.lost||ms.won||cell.revealed||cell.flagged) return;

    /* Safe first click */
    if (ms.firstMove && cell.mine) {
      cell.mine = false;
      var relocated = false;
      for (var fr=0; fr<ms.rows&&!relocated; fr++) {
        for (var fc=0; fc<ms.cols&&!relocated; fc++) {
          if (!ms.board[fr][fc].mine && !(fr===r&&fc===c)) {
            ms.board[fr][fc].mine=true; relocated=true;
          }
        }
      }
      ms.recalc();
    }
    ms.firstMove = false;

    if (cell.mine) {
      cell.revealed=true; ms.lost=true;
      this._renderMS();
      this.gameOver(ms.score);
      return;
    }

    /* Flood fill */
    var stack=[[r,c]];
    while(stack.length>0){
      var pos=stack.pop();
      var pr=pos[0], pc=pos[1];
      var b=ms.board[pr]&&ms.board[pr][pc];
      if(!b||b.revealed||b.flagged||b.mine) continue;
      b.revealed=true; ms.revealed++; ms.score+=5;
      if(b.adjacent===0){
        for(var d=0;d<ms.dirs.length;d++){
          var nr=pr+ms.dirs[d][0],nc=pc+ms.dirs[d][1];
          if(nr>=0&&nr<ms.rows&&nc>=0&&nc<ms.cols) stack.push([nr,nc]);
        }
      }
    }
    this.updateScoreDisplay(ms.score);

    var safe=ms.rows*ms.cols-ms.mines;
    if(ms.revealed>=safe){
      ms.won=true; ms.score+=200;
      this.updateScoreDisplay(ms.score);
      this._renderMS();
      this.gameOver(ms.score);
      return;
    }
    this._renderMS();
  };

  p.msFlag = function (r, c) {
    if (!this.isPlaying) return;
    var ms   = this._ms;
    var cell = ms.board[r][c];
    if (ms.lost||ms.won||cell.revealed) return;
    cell.flagged = !cell.flagged;
    ms.flagged  += cell.flagged ? 1 : -1;
    this._renderMS();
  };

  /* ============================================================
     12.  TETRIS  (config.js has this in GAMES_CONFIG)
  ============================================================ */
  p.initTetris = function () {
    var canvas = this.gameCanvas, ctx = this.gameCtx;
    if (!canvas || !ctx) return;
    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var self   = this;
    var COLS   = 10, ROWS = 20;
    var cellW  = Math.floor(canvas.width * 0.55 / COLS);
    var cellH  = Math.floor(canvas.height / ROWS);
    var boardX = Math.floor((canvas.width * 0.55 - COLS * cellW) / 2);

    var PIECES = [
      { shape: [[1,1,1,1]],                         color: '#4DEEEA' },
      { shape: [[1,0],[1,0],[1,1]],                  color: '#F6AD55' },
      { shape: [[0,1],[0,1],[1,1]],                  color: '#0055FF' },
      { shape: [[1,1],[1,1]],                        color: '#ECC94B' },
      { shape: [[0,1,1],[1,1,0]],                    color: '#38A169' },
      { shape: [[1,1,1],[0,1,0]],                    color: '#9F7AEA' },
      { shape: [[1,1,0],[0,1,1]],                    color: '#E53E3E' }
    ];

    var board = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(null);
      board.push(row);
    }

    var rotate = function (shape) {
      return shape[0].map(function(_, i) {
        return shape.map(function(row){ return row[i]; }).reverse();
      });
    };

    var spawnPiece = function () {
      var tmpl = PIECES[Math.floor(Math.random() * PIECES.length)];
      return {
        shape: tmpl.shape,
        color: tmpl.color,
        x: Math.floor(COLS / 2) - Math.floor(tmpl.shape[0].length / 2),
        y: 0
      };
    };

    var fits = function (shape, px, py) {
      for (var r = 0; r < shape.length; r++) {
        for (var c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          var nx = px + c, ny = py + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
          if (ny >= 0 && board[ny][nx]) return false;
        }
      }
      return true;
    };

    var lockPiece = function (piece) {
      for (var r = 0; r < piece.shape.length; r++) {
        for (var c = 0; c < piece.shape[r].length; c++) {
          if (!piece.shape[r][c]) continue;
          var ny = piece.y + r;
          if (ny < 0) return false; /* piece locked above board = game over */
          board[ny][piece.x + c] = piece.color;
        }
      }
      return true;
    };

    var clearLines = function () {
      var cleared = 0;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(function(c){return c!==null;})) {
          board.splice(r, 1);
          var newRow = [];
          for (var c2 = 0; c2 < COLS; c2++) newRow.push(null);
          board.unshift(newRow);
          cleared++;
          r++; /* re-check same row index */
        }
      }
      return cleared;
    };

    var score  = 0;
    var level  = 1;
    var lines  = 0;
    var piece  = spawnPiece();
    var next   = spawnPiece();
    var dropMs = 600;
    var lastDrop = Date.now();
    var lineBonus = [0, 100, 300, 500, 800];

    this._keyHandler = function (e) {
      if (!self.isPlaying) return;
      switch (e.key) {
        case 'ArrowLeft':
          if (fits(piece.shape, piece.x-1, piece.y)) piece.x--;
          e.preventDefault(); break;
        case 'ArrowRight':
          if (fits(piece.shape, piece.x+1, piece.y)) piece.x++;
          e.preventDefault(); break;
        case 'ArrowDown':
          if (fits(piece.shape, piece.x, piece.y+1)) piece.y++;
          e.preventDefault(); break;
        case 'ArrowUp':
        case 'z':
        case 'Z':
          var rotated = rotate(piece.shape);
          if (fits(rotated, piece.x, piece.y)) piece.shape = rotated;
          e.preventDefault(); break;
        case ' ':
          /* Hard drop */
          while (fits(piece.shape, piece.x, piece.y+1)) piece.y++;
          e.preventDefault(); break;
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    this.setupTouchControls(canvas, function (dir) {
      if (dir==='left'  && fits(piece.shape,piece.x-1,piece.y)) piece.x--;
      if (dir==='right' && fits(piece.shape,piece.x+1,piece.y)) piece.x++;
      if (dir==='down'  && fits(piece.shape,piece.x,piece.y+1)) piece.y++;
      if (dir==='up') {
        var rot=rotate(piece.shape);
        if(fits(rot,piece.x,piece.y)) piece.shape=rot;
      }
    });

    var tick = function () {
      if (!self.isPlaying) return;
      self.animationFrame = requestAnimationFrame(tick);

      /* Auto-drop */
      var now = Date.now();
      if (now - lastDrop >= dropMs) {
        lastDrop = now;
        if (fits(piece.shape, piece.x, piece.y+1)) {
          piece.y++;
        } else {
          var ok = lockPiece(piece);
          if (!ok) { self.gameOver(score); return; }
          var cleared = clearLines();
          lines  += cleared;
          score  += lineBonus[cleared] || 0;
          score  += 2; /* small drop bonus */
          level   = Math.floor(lines / 10) + 1;
          dropMs  = Math.max(100, 600 - (level-1)*50);
          self.updateScoreDisplay(score);
          piece = next;
          next  = spawnPiece();
          if (!fits(piece.shape, piece.x, piece.y)) {
            self.gameOver(score); return;
          }
        }
      }

      /* ── Draw ── */
      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      /* Board background */
      ctx.fillStyle = self.getColor('secondary') + '20';
      ctx.fillRect(boardX, 0, COLS*cellW, ROWS*cellH);

      /* Grid lines */
      ctx.strokeStyle = self.getColor('secondary') + '15';
      ctx.lineWidth   = 0.5;
      for (var gc = 0; gc <= COLS; gc++) {
        ctx.beginPath();
        ctx.moveTo(boardX+gc*cellW, 0);
        ctx.lineTo(boardX+gc*cellW, ROWS*cellH);
        ctx.stroke();
      }
      for (var gr = 0; gr <= ROWS; gr++) {
        ctx.beginPath();
        ctx.moveTo(boardX, gr*cellH);
        ctx.lineTo(boardX+COLS*cellW, gr*cellH);
        ctx.stroke();
      }

      /* Locked blocks */
      for (var br = 0; br < ROWS; br++) {
        for (var bc = 0; bc < COLS; bc++) {
          if (board[br][bc]) {
            ctx.fillStyle = board[br][bc];
            ctx.fillRect(boardX+bc*cellW+1, br*cellH+1, cellW-2, cellH-2);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(boardX+bc*cellW+1, br*cellH+1, cellW-2, 4);
          }
        }
      }

      /* Ghost piece */
      var ghostY = piece.y;
      while (fits(piece.shape, piece.x, ghostY+1)) ghostY++;
      for (var gr2 = 0; gr2 < piece.shape.length; gr2++) {
        for (var gc2 = 0; gc2 < piece.shape[gr2].length; gc2++) {
          if (!piece.shape[gr2][gc2]) continue;
          ctx.strokeStyle = piece.color + '60';
          ctx.lineWidth   = 1;
          ctx.strokeRect(
            boardX+(piece.x+gc2)*cellW+1,
            (ghostY+gr2)*cellH+1,
            cellW-2, cellH-2
          );
        }
      }

      /* Active piece */
      for (var ar = 0; ar < piece.shape.length; ar++) {
        for (var ac = 0; ac < piece.shape[ar].length; ac++) {
          if (!piece.shape[ar][ac]) continue;
          ctx.fillStyle = piece.color;
          ctx.fillRect(
            boardX+(piece.x+ac)*cellW+1,
            (piece.y+ar)*cellH+1,
            cellW-2, cellH-2
          );
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(
            boardX+(piece.x+ac)*cellW+1,
            (piece.y+ar)*cellH+1,
            cellW-2, 4
          );
        }
      }

      /* Right panel */
      var panX = boardX + COLS*cellW + 16;
      ctx.fillStyle = self.getColor('text');
      ctx.font      = 'bold 12px Poppins, sans-serif';
      ctx.fillText('NEXT',   panX, 20);
      ctx.fillText('Level: '+level, panX, canvas.height-60);
      ctx.fillText('Lines: '+lines, panX, canvas.height-44);
      ctx.fillText('Score:',         panX, canvas.height-28);
      ctx.fillText(''+score,         panX, canvas.height-12);

      /* Draw next piece preview */
      var previewCellW = Math.min(cellW, 18);
      var previewCellH = Math.min(cellH, 18);
      for (var nr = 0; nr < next.shape.length; nr++) {
        for (var nc = 0; nc < next.shape[nr].length; nc++) {
          if (!next.shape[nr][nc]) continue;
          ctx.fillStyle = next.color;
          ctx.fillRect(
            panX + nc*previewCellW,
            30 + nr*previewCellH,
            previewCellW-1, previewCellH-1
          );
        }
      }

      /* Controls hint */
      ctx.fillStyle = self.getColor('muted');
      ctx.font      = '9px Poppins, sans-serif';
      var hints     = ['← → Move','↑ Rotate','↓ Drop',' SPACE Hard'];
      for (var hi = 0; hi < hints.length; hi++) {
        ctx.fillText(hints[hi], panX, canvas.height - 140 + hi*14);
      }
    };

    tick();
  };

  /* ============================================================
     UNSUPPORTED GAME FALLBACK
  ============================================================ */
  p.initUnsupported = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';
    ui.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;' +
          'justify-content:center;padding:60px;text-align:center;gap:16px;">' +
        '<i data-lucide="construction" ' +
           'style="width:48px;height:48px;color:var(--accent);opacity:0.6;"></i>' +
        '<h3 style="color:var(--text-heading);font-weight:700;">Coming Soon</h3>' +
        '<p style="color:var(--text-muted);font-size:0.88rem;max-width:280px;">' +
          'This game is under construction. Check back soon!' +
        '</p>' +
        '<button class="btn btn-outline" id="back-from-stub">' +
          '<i data-lucide="arrow-left"></i><span>Back to Games</span>' +
        '</button>' +
      '</div>';
    var self = this;
    var btn  = document.getElementById('back-from-stub');
    if (btn) btn.addEventListener('click', function () { self.backToList(); });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  return GM;

})(); /* end GamesManager IIFE */

/* ============================================================
   STYLES
   ============================================================ */
var _gamesCSS = [
  /* Card */
  '.game-card{display:flex;align-items:center;gap:16px;padding:20px;cursor:pointer;transition:all 0.22s ease;}',
  '.game-card:hover{transform:translateY(-4px) scale(1.01);}',
  '.game-card-icon{width:60px;height:60px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.22s ease;box-shadow:var(--neu-shadow-sm);}',
  '.game-card:hover .game-card-icon{background:var(--accent)!important;}',
  '.game-card:hover .game-card-icon svg,.game-card:hover .game-card-icon i{color:#fff!important;}',
  '.game-card-info{flex:1;}',
  '.game-card-title{font-size:1rem;font-weight:700;color:var(--text-heading);margin-bottom:4px;}',
  '.game-card-desc{font-size:0.8rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;}',
  '.game-card-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
  '.game-difficulty,.game-category,.game-high-score{padding:2px 10px;border-radius:999px;font-size:0.68rem;font-weight:700;}',
  '.game-difficulty-easy{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
  '.game-difficulty-medium{background:var(--warning-light,#fefcbf);color:var(--warning,#d69e2e);}',
  '.game-difficulty-hard{background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
  '.game-category{background:var(--bg-secondary,#eee);color:var(--text-muted,#888);}',
  '.game-high-score{background:var(--accent-light);color:var(--accent);display:flex;align-items:center;gap:4px;}',
  '.game-card-play{width:40px;height:40px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent);transition:all 0.22s ease;}',
  '.game-card:hover .game-card-play{background:var(--accent);color:#fff;transform:scale(1.15);}',
  /* Header */
  '.game-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap;}',
  '.game-title-area{display:flex;align-items:center;gap:10px;}',
  '.game-title-area h2{font-size:1.1rem;font-weight:700;color:var(--text-heading);display:flex;align-items:center;gap:8px;}',
  '.game-title-area h2 svg,.game-title-area h2 i{width:22px;height:22px;color:var(--accent);}',
  '.game-score-area{display:flex;flex-direction:column;align-items:center;padding:8px 20px;background:var(--bg-card);border-radius:8px;box-shadow:var(--neu-shadow-sm);}',
  '.game-score-label{font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;}',
  '.game-score-value{font-size:1.6rem;font-weight:800;color:var(--accent);line-height:1;}',
  /* Container */
  '.game-container{position:relative;background:var(--bg-card);border-radius:12px;overflow:hidden;min-height:300px;box-shadow:var(--neu-shadow);}',
  '.game-container canvas{display:block;width:100%;}',
  '.game-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:10;}',
  '.game-overlay-content{text-align:center;color:#fff;display:flex;flex-direction:column;align-items:center;gap:16px;}',
  '.game-overlay-content h3{font-size:1.6rem;font-weight:800;}',
  '.game-overlay-content p{font-size:0.9rem;opacity:0.8;max-width:300px;line-height:1.6;}',
  '.game-ui{padding:16px;min-height:300px;}',
  /* Memory */
  '.memory-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:360px;margin:0 auto;}',
  '.memory-card{aspect-ratio:1;cursor:pointer;perspective:600px;}',
  '.memory-card-inner{width:100%;height:100%;transition:transform 0.45s;transform-style:preserve-3d;position:relative;}',
  '.memory-card.flipped .memory-card-inner{transform:rotateY(180deg);}',
  '.memory-card-front,.memory-card-back{position:absolute;inset:0;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;border-radius:8px;box-shadow:var(--neu-shadow-sm);}',
  '.memory-card-front{background:var(--accent-light);color:var(--accent);}',
  '.memory-card-front i,.memory-card-front svg{width:24px;height:24px;}',
  '.memory-card-back{background:var(--bg-card);transform:rotateY(180deg);color:var(--accent);}',
  '.memory-card-back i,.memory-card-back svg{width:28px;height:28px;}',
  '.memory-card.matched .memory-card-back{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
  /* Quiz */
  '.quiz-container{max-width:500px;margin:0 auto;}',
  '.quiz-progress{height:4px;background:var(--bg-secondary);border-radius:999px;margin-bottom:16px;overflow:hidden;}',
  '.quiz-progress-bar{height:100%;background:var(--accent);border-radius:999px;transition:width 0.4s ease;}',
  '.quiz-counter{font-size:0.78rem;color:var(--text-muted);margin-bottom:16px;text-align:center;font-weight:600;}',
  '.quiz-question{font-size:1.05rem;font-weight:700;color:var(--text-heading);margin-bottom:20px;line-height:1.5;text-align:center;}',
  '.quiz-options{display:flex;flex-direction:column;gap:10px;}',
  '.quiz-option{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:8px;background:var(--bg-card);border:2px solid transparent;cursor:pointer;transition:0.2s;text-align:left;width:100%;font-family:inherit;font-size:0.88rem;color:var(--text-primary);box-shadow:var(--neu-shadow-sm);}',
  '.quiz-option:hover:not(:disabled){border-color:var(--accent);transform:translateX(4px);}',
  '.quiz-option.quiz-correct{border-color:var(--success,#38a169);background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
  '.quiz-option.quiz-wrong{border-color:var(--danger,#e53e3e);background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
  '.quiz-option-letter{width:28px;height:28px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.82rem;flex-shrink:0;}',
  '.quiz-option-text{flex:1;}',
  '.quiz-explanation{margin-top:16px;padding:12px;border-radius:8px;background:var(--bg-secondary);display:flex;align-items:flex-start;gap:10px;font-size:0.82rem;color:var(--text-secondary);}',
  /* TTT */
  '.ttt-container{max-width:320px;margin:0 auto;text-align:center;}',
  '.ttt-scoreboard{display:flex;justify-content:space-around;margin-bottom:12px;font-size:0.88rem;font-weight:700;}',
  '.ttt-status{font-size:0.9rem;font-weight:600;color:var(--text-heading);margin-bottom:16px;}',
  '.ttt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
  '.ttt-cell{aspect-ratio:1;border-radius:8px;background:var(--bg-card);border:2px solid transparent;cursor:pointer;transition:0.2s;display:flex;align-items:center;justify-content:center;font-family:inherit;box-shadow:var(--neu-shadow-sm);}',
  '.ttt-cell:hover:not(:disabled){border-color:var(--accent);transform:scale(1.05);}',
  '.ttt-x{color:var(--accent);}',
  '.ttt-o{color:var(--danger);}',
  /* Typing */
  '.typing-container{max-width:550px;margin:0 auto;}',
  '.typing-target{padding:20px;background:var(--bg-secondary);border-radius:8px;font-size:1rem;line-height:1.8;color:var(--text-secondary);letter-spacing:0.02em;min-height:80px;}',
  '.typing-stats{display:flex;justify-content:center;gap:24px;margin-top:16px;font-size:0.88rem;color:var(--text-secondary);flex-wrap:wrap;}',
  '.typing-stats strong{color:var(--accent);font-weight:800;}',
  /* Wordle */
  '.wordle-container{max-width:340px;margin:0 auto;}',
  '.wordle-grid{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}',
  '.wordle-row{display:flex;gap:6px;justify-content:center;}',
  '.wordle-cell{width:54px;height:54px;border:2px solid var(--border,#ccc);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;text-transform:uppercase;transition:0.25s;color:var(--text-heading);background:var(--bg-card);}',
  '.wc-active{border-color:var(--accent);transform:scale(1.05);}',
  '.wc-correct{background:#538d4e;border-color:#538d4e;color:#fff;}',
  '.wc-present{background:#b59f3b;border-color:#b59f3b;color:#fff;}',
  '.wc-absent{background:#3a3a3c;border-color:#3a3a3c;color:#fff;}',
  '.wordle-keyboard{display:flex;flex-direction:column;gap:6px;align-items:center;}',
  '.wordle-kb-row{display:flex;gap:4px;}',
  '.wordle-key{min-width:32px;height:46px;border-radius:5px;border:none;cursor:pointer;font-weight:700;font-size:0.82rem;background:var(--bg-secondary);color:var(--text-heading);transition:0.15s;font-family:inherit;}',
  '.wordle-key:hover{opacity:0.8;}',
  '.wk-wide{min-width:54px;font-size:0.72rem;}',
  '.wk-correct{background:#538d4e!important;color:#fff!important;}',
  '.wk-present{background:#b59f3b!important;color:#fff!important;}',
  '.wk-absent{background:#3a3a3c!important;color:#fff!important;}',
  '.wordle-msg{text-align:center;padding:10px;border-radius:8px;margin-bottom:10px;font-size:0.88rem;font-weight:600;}',
  '.wm-success{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
  '.wm-danger{background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
  '@keyframes wShake{0%,100%{transform:translateX(0);}20%{transform:translateX(-6px);}40%{transform:translateX(6px);}60%{transform:translateX(-4px);}80%{transform:translateX(4px);}}',
  '.wordle-shake{animation:wShake 0.45s ease;}',
  /* 2048 */
  '.g2048-container{max-width:380px;margin:0 auto;}',
  '.g2048-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#bbada0;padding:8px;border-radius:8px;}',
  '.g2048-cell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;transition:0.1s;}',
  '.g2048-btn{width:52px;height:52px;border-radius:8px;border:none;cursor:pointer;background:var(--accent-light);color:var(--accent);font-size:1.4rem;font-weight:700;transition:0.15s;font-family:inherit;}',
  '.g2048-btn:hover{background:var(--accent);color:#fff;}',
  /* Minesweeper */
  '.ms-container{max-width:380px;margin:0 auto;}',
  '.ms-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-weight:700;font-size:0.82rem;color:var(--text-heading);}',
  '.ms-grid{display:grid;gap:2px;background:var(--bg-secondary);padding:2px;border-radius:4px;}',
  '.ms-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;cursor:pointer;border-radius:3px;user-select:none;min-width:32px;}',
  '.ms-hidden{background:var(--bg-card);transition:0.1s;}',
  '.ms-hidden:hover{background:var(--accent-light);}',
  '.ms-revealed{background:var(--bg-secondary);}',
  '.ms-mine{background:var(--danger-light,#fed7d7);}',
  '.ms-flagged{background:var(--warning-light,#fefcbf);cursor:pointer;}',
  /* Responsive */
  '@media(max-width:480px){',
  '.memory-grid{gap:6px;}',
  '.game-header{flex-direction:column;align-items:flex-start;}',
  '.typing-stats{flex-direction:column;gap:8px;align-items:center;}',
  '.wordle-cell{width:46px;height:46px;font-size:1.1rem;}',
  '.ms-cell{min-width:26px;font-size:0.65rem;}',
  '.ttt-cell{min-height:70px;}',
  '}'
].join('');

(function injectCSS() {
  if (!document.getElementById('games-module-css')) {
    var s  = document.createElement('style');
    s.id   = 'games-module-css';
    s.textContent = _gamesCSS;
    document.head.appendChild(s);
  }
})();

/* ============================================================
   GLOBAL INIT
   ============================================================ */
var gamesManager;

document.addEventListener('DOMContentLoaded', function () {
  var grid = document.getElementById('games-grid');
  var play = document.getElementById('game-play-area');
  if (grid || play) {
    gamesManager = new GamesManager();
    window.gamesManager = gamesManager;
  }
});

} /* end _GAMES_JS_LOADED guard */

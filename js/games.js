/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Games Module — js/games.js
   Complete, self-contained, bug-free
   ============================================================ */

'use strict';

/* ============================================================
   GUARD: prevent double-load crash
   ============================================================ */
if (typeof window._GAMES_JS_LOADED === 'undefined') {
window._GAMES_JS_LOADED = true;

/* ============================================================
   GAMES CONFIGURATION
   ============================================================ */
var GAMES_CONFIG = [
  {
    id: 'snake',
    name: 'Snake',
    description: 'Classic snake game. Eat food to grow longer without hitting walls or yourself.',
    icon: 'zap',
    difficulty: 'Easy',
    category: 'Arcade'
  },
  {
    id: 'memory',
    name: 'Memory Match',
    description: 'Flip cards to find matching pairs. Test your memory skills!',
    icon: 'brain',
    difficulty: 'Easy',
    category: 'Puzzle'
  },
  {
    id: 'quiz',
    name: 'Rotaract Quiz',
    description: 'Test your knowledge about Rotaract, Rotary, and service activities.',
    icon: 'help-circle',
    difficulty: 'Medium',
    category: 'Trivia'
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    description: 'Classic Tic Tac Toe against an AI opponent. Get three in a row!',
    icon: 'grid-3x3',
    difficulty: 'Easy',
    category: 'Strategy'
  },
  {
    id: 'typing',
    name: 'Speed Typing',
    description: 'Type the given text as fast and accurately as possible!',
    icon: 'keyboard',
    difficulty: 'Medium',
    category: 'Skill'
  },
  {
    id: 'flappy',
    name: 'Flappy Bird',
    description: 'Tap or press Space to fly through pipes. How far can you go?',
    icon: 'feather',
    difficulty: 'Hard',
    category: 'Arcade'
  },
  {
    id: 'breakout',
    name: 'Breakout',
    description: 'Break all the bricks using a ball and paddle. Classic arcade action!',
    icon: 'layers',
    difficulty: 'Medium',
    category: 'Arcade'
  },
  {
    id: 'wordle',
    name: 'Rotaract Wordle',
    description: 'Guess the 5-letter service-themed word in 6 tries!',
    icon: 'type',
    difficulty: 'Medium',
    category: 'Word'
  },
  {
    id: 'pong',
    name: 'Ping Pong',
    description: 'Classic pong! Move your paddle to deflect the ball. First to 7 wins!',
    icon: 'activity',
    difficulty: 'Easy',
    category: 'Arcade'
  },
  {
    id: '2048',
    name: '2048 Challenge',
    description: 'Merge tiles with the same number to reach 2048!',
    icon: 'hash',
    difficulty: 'Medium',
    category: 'Puzzle'
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    description: 'Find all safe cells without triggering any mines. Use logic!',
    icon: 'target',
    difficulty: 'Hard',
    category: 'Puzzle'
  },
  {
    id: 'colorguess',
    name: 'Color Guess',
    description: 'Identify the correct color from its HEX value. Train your eye!',
    icon: 'droplet',
    difficulty: 'Easy',
    category: 'Skill'
  }
];

/* ============================================================
   QUIZ QUESTIONS
   ============================================================ */
var QUIZ_QUESTIONS = [
  {
    question: 'What does "Rotaract" stand for?',
    options: ['Rotary Action', 'Rotary Youth Service', 'Rotary Action Club', 'Rotate and Act'],
    answer: 0,
    explanation: 'Rotaract stands for "Rotary Action" — a Rotary-sponsored service club for young adults.'
  },
  {
    question: 'In which year was Rotaract founded?',
    options: ['1968', '1975', '1985', '1960'],
    answer: 0,
    explanation: 'Rotaract was founded in 1968 by Rotary International.'
  },
  {
    question: 'What is the age group for Rotaract Club membership?',
    options: ['14-18', '18-30', '21-35', '16-24'],
    answer: 1,
    explanation: 'Rotaract Club membership is open to young adults aged 18 to 30 years.'
  },
  {
    question: 'What is the motto of Rotary International?',
    options: ['Service Above Self', 'Serve to Lead', 'Together We Serve', 'Act with Integrity'],
    answer: 0,
    explanation: '"Service Above Self" is the official motto of Rotary International.'
  },
  {
    question: 'Which organization sponsors Rotaract Clubs?',
    options: ['United Nations', 'Rotary International', 'Lions Club', 'YMCA'],
    answer: 1,
    explanation: 'Rotaract Clubs are sponsored by local Rotary Clubs and Rotary International.'
  },
  {
    question: 'What are the four avenues of service in Rotary?',
    options: [
      'Club, Community, Vocational, International',
      'Health, Education, Economy, Peace',
      'Youth, Senior, Women, Men',
      'Local, National, Global, Digital'
    ],
    answer: 0,
    explanation: 'The four avenues are: Club Service, Community Service, Vocational Service, and International Service.'
  },
  {
    question: 'How many areas of focus does Rotary International have?',
    options: ['4', '6', '7', '5'],
    answer: 2,
    explanation: 'Rotary has 7 areas of focus including peace, disease prevention, water, and more.'
  },
  {
    question: 'What is the Rotary "Four-Way Test"?',
    options: [
      'A test of truthfulness, fairness, goodwill, and benefit to all',
      'A physical fitness test',
      'An annual club evaluation',
      'A leadership assessment tool'
    ],
    answer: 0,
    explanation: 'The Four-Way Test asks about truth, fairness, goodwill, and benefit to all concerned.'
  },
  {
    question: 'What colors are primarily associated with Rotary International?',
    options: ['Blue', 'Gold', 'Royal Blue and Gold', 'Red and White'],
    answer: 2,
    explanation: 'The official Rotary colors are Royal Blue and Gold.'
  },
  {
    question: 'Where is Rotary International headquartered?',
    options: ['Washington D.C.', 'Geneva', 'Evanston, Illinois', 'London'],
    answer: 2,
    explanation: 'Rotary International is headquartered in Evanston, Illinois, USA.'
  },
  {
    question: 'Which Rotary scholarship supports peace studies?',
    options: ['Fulbright', 'Rotary Peace Fellowship', 'Rhodes Scholarship', 'Chevening'],
    answer: 1,
    explanation: 'The Rotary Peace Fellowship supports individuals promoting peace and conflict resolution.'
  },
  {
    question: 'What does the Rotary wheel symbol represent?',
    options: [
      'Progress through service and movement',
      'The world map',
      'Unity of nations',
      'The cycle of life'
    ],
    answer: 0,
    explanation: 'The gear-wheel logo symbolizes work, movement, and progress through service.'
  },
  {
    question: 'Rotary PolioPlus program aims to:',
    options: [
      'Eradicate polio globally',
      'Build hospitals',
      'Train doctors',
      'Provide vaccines only in India'
    ],
    answer: 0,
    explanation: 'PolioPlus is Rotary\'s program to eradicate polio worldwide.'
  },
  {
    question: 'What is Rotary\'s humanitarian arm called?',
    options: ['Rotary Fund', 'Rotary Foundation', 'Rotary Trust', 'Rotary Aid'],
    answer: 1,
    explanation: 'The Rotary Foundation funds projects and scholarships worldwide.'
  },
  {
    question: 'Who founded Rotary International?',
    options: ['Paul Harris', 'John Smith', 'Robert Baden-Powell', 'Henry Dunant'],
    answer: 0,
    explanation: 'Paul Harris founded Rotary in 1905 in Chicago, Illinois.'
  }
];

/* ============================================================
   TYPING QUOTES
   ============================================================ */
var TYPING_QUOTES = [
  'Service above self is the motto that drives every Rotaract member to make a positive difference in the world around them.',
  'The best way to find yourself is to lose yourself in the service of others and their communities.',
  'Together we can create a world where every child has access to clean water, education, and healthcare.',
  'Leadership is not about being in charge but about taking care of those in your charge through dedicated service.',
  'Rotaract brings young people together to create lasting change through fellowship and professional development.',
  'One act of kindness can spark a thousand more. Let us light the way for our community through compassion.',
  'The strength of a club lies not in its numbers but in the commitment of every single member to serve.',
  'Education is the most powerful weapon which you can use to change the world and lift communities out of poverty.',
  'Small acts performed with great love can transform neighborhoods, cities, and ultimately the entire world.',
  'Community service is not just a program but a way of life that defines who we are as Rotaractors every day.'
];

/* ============================================================
   WORDLE WORDS
   ============================================================ */
var WORDLE_WORDS = [
  'SERVE', 'PEACE', 'UNITE', 'SHARE', 'LEADS', 'TRUST',
  'GROWN', 'HELPS', 'YOUTH', 'CLUBS', 'GRANT', 'GLOBE',
  'SMILE', 'LIGHT', 'BRAVE', 'FUNDS', 'WORKS', 'HANDS',
  'SKILL', 'TEAMS', 'BUILD', 'PROUD', 'FAITH', 'DREAM'
];

/* ============================================================
   STORAGE HELPER
   Uses plain JSON — no wrapping
   ============================================================ */
var Storage = {
  get: function (key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  set: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* quota exceeded or private mode */ }
  },
  remove: function (key) {
    try {
      localStorage.removeItem(key);
    } catch (e) { /* silent */ }
  }
};

/* ============================================================
   SUPABASE HELPER (mock if unavailable)
   ============================================================ */
function getSupabaseClient() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    try {
      return supabase.createClient(
        window.SUPABASE_URL || '',
        window.SUPABASE_KEY || ''
      );
    } catch (e) { /* silent */ }
  }
  return {
    from: function () {
      return {
        insert: function () { return Promise.resolve({ error: null }); },
        select: function () { return Promise.resolve({ data: [], error: null }); }
      };
    }
  };
}

/* ============================================================
   CANVAS POLYFILL: roundRect
   ============================================================ */
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    if (!Array.isArray(r)) r = [0, 0, 0, 0];
    var tl = r[0] || 0, tr = r[1] || r[0] || 0;
    var br = r[2] || r[0] || 0, bl = r[3] || r[1] || r[0] || 0;
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

/* ============================================================
   GAMES MANAGER CLASS
   ============================================================ */
var GamesManager = (function () {

  function GM() {
    this.db = getSupabaseClient();
    this.currentGame = null;
    this.gameCanvas = null;
    this.gameCtx = null;
    this.animationFrame = null;
    this.gameInterval = null;
    this.isPlaying = false;
    this.score = 0;
    this.highScores = {};
    this._keyHandler = null;
    this._keyUpHandler = null;
    this._touchCleanups = [];

    this.init();
  }

  var proto = GM.prototype;

  /* ──────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────── */
  proto.init = function () {
    this.loadHighScores();
    this.renderGamesList();
  };

  /* ──────────────────────────────────────────────────
     RENDER GAMES LIST
  ────────────────────────────────────────────────── */
  proto.renderGamesList = function () {
    var container = document.getElementById('games-grid');
    if (!container) return;
    var self = this;
    var html = '';

    for (var i = 0; i < GAMES_CONFIG.length; i++) {
      var game = GAMES_CONFIG[i];
      var hs = this.highScores[game.id] || 0;
      var hsHTML = '';
      if (hs > 0) {
        hsHTML =
          '<span class="game-high-score">' +
            '<i data-lucide="trophy" style="width:12px;height:12px;"></i> ' +
            hs +
          '</span>';
      }

      html +=
        '<div class="game-card neu-card" data-game-id="' + game.id + '" ' +
             'data-category="' + game.category + '">' +
          '<div class="game-card-icon" style="background:var(--accent-light);">' +
            '<i data-lucide="' + game.icon + '" style="width:32px;height:32px;color:var(--accent);"></i>' +
          '</div>' +
          '<div class="game-card-info">' +
            '<h3 class="game-card-title">' + game.name + '</h3>' +
            '<p class="game-card-desc">' + game.description + '</p>' +
            '<div class="game-card-meta">' +
              '<span class="game-difficulty game-difficulty-' + game.difficulty.toLowerCase() + '">' +
                game.difficulty +
              '</span>' +
              '<span class="game-category">' + game.category + '</span>' +
              hsHTML +
            '</div>' +
          '</div>' +
          '<div class="game-card-play">' +
            '<i data-lucide="play" style="width:20px;height:20px;"></i>' +
          '</div>' +
        '</div>';
    }

    container.innerHTML = html;

    // Attach click handlers
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

  /* ──────────────────────────────────────────────────
     OPEN GAME
  ────────────────────────────────────────────────── */
  proto.openGame = function (gameId) {
    this.stopCurrentGame();
    this.currentGame = gameId;
    this.score = 0;

    var container = document.getElementById('game-play-area');
    var listArea = document.getElementById('games-list-area');
    if (!container) return;

    if (listArea) listArea.style.display = 'none';
    container.style.display = 'block';

    var game = null;
    for (var i = 0; i < GAMES_CONFIG.length; i++) {
      if (GAMES_CONFIG[i].id === gameId) { game = GAMES_CONFIG[i]; break; }
    }
    if (!game) return;

    container.innerHTML =
      '<div class="game-header">' +
        '<button class="btn btn-outline btn-sm" id="game-back-btn">' +
          '<i data-lucide="arrow-left"></i>' +
          '<span>Back</span>' +
        '</button>' +
        '<div class="game-title-area">' +
          '<h2>' +
            '<i data-lucide="' + game.icon + '"></i> ' +
            game.name +
          '</h2>' +
          '<span class="game-difficulty game-difficulty-' + game.difficulty.toLowerCase() + '">' +
            game.difficulty +
          '</span>' +
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
              '<i data-lucide="play"></i>' +
              '<span>Start Game</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="game-ui" id="game-ui"></div>' +
      '</div>';

    this.gameCanvas = document.getElementById('game-canvas');
    this.gameCtx = this.gameCanvas ? this.gameCanvas.getContext('2d') : null;
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

  proto.resizeCanvas = function () {
    if (!this.gameCanvas) return;
    var cont = document.getElementById('game-container');
    if (!cont) return;
    var maxW = Math.min(cont.clientWidth - 4, 600);
    var maxH = Math.min(window.innerHeight - 260, 500);
    this.gameCanvas.width = maxW;
    this.gameCanvas.height = Math.max(280, maxH);
  };

  proto.backToList = function () {
    this.stopCurrentGame();
    var container = document.getElementById('game-play-area');
    var listArea = document.getElementById('games-list-area');
    if (container) container.style.display = 'none';
    if (listArea) listArea.style.display = 'block';
    this.currentGame = null;
    this.renderGamesList();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
  };

  proto.startGame = function () {
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
      case 'colorguess':  this.initColorGuess();  break;
    }
  };

  proto.stopCurrentGame = function () {
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
    // Clean up touch listeners
    for (var i = 0; i < this._touchCleanups.length; i++) {
      this._touchCleanups[i]();
    }
    this._touchCleanups = [];
  };

  proto.gameOver = function (finalScore) {
    this.isPlaying = false;
    this.stopCurrentGame();

    finalScore = Math.round(finalScore || 0);
    this.saveHighScore(this.currentGame, finalScore);
    this.updateScoreDisplay(finalScore);

    var overlay = document.getElementById('game-overlay');
    var title = document.getElementById('game-overlay-title');
    var text = document.getElementById('game-overlay-text');
    var btn = document.getElementById('game-start-btn');

    if (overlay) overlay.style.display = 'flex';
    if (title) title.textContent = 'Game Over!';
    if (text) {
      var best = this.highScores[this.currentGame] || 0;
      text.textContent = 'Your score: ' + finalScore + '. ' +
        (best === finalScore ? 'New high score!' : 'Best: ' + best);
    }
    if (btn) {
      btn.innerHTML =
        '<i data-lucide="rotate-ccw"></i><span>Play Again</span>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  };

  proto.updateScoreDisplay = function (score) {
    var el = document.getElementById('game-score');
    if (el) el.textContent = score;
    this.score = score;
  };

  /* ──────────────────────────────────────────────────
     HIGH SCORES
  ────────────────────────────────────────────────── */
  proto.loadHighScores = function () {
    this.highScores = Storage.get('game_high_scores') || {};
  };

  proto.saveHighScore = function (gameId, score) {
    if (!gameId) return;
    if (!this.highScores[gameId] || score > this.highScores[gameId]) {
      this.highScores[gameId] = score;
      Storage.set('game_high_scores', this.highScores);
      try {
        var gName = '';
        for (var i = 0; i < GAMES_CONFIG.length; i++) {
          if (GAMES_CONFIG[i].id === gameId) { gName = GAMES_CONFIG[i].name; break; }
        }
        this.db.from('game_scores').insert({
          player_name: 'Guest',
          game_id: gameId,
          game_name: gName || gameId,
          score: score
        });
      } catch (e) { /* silent */ }
    }
  };

  /* ──────────────────────────────────────────────────
     COLOR HELPER
  ────────────────────────────────────────────────── */
  proto.getColor = function (name) {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var map = {
      bg:        isDark ? '#1A1B26' : '#E8E8E8',
      primary:   isDark ? '#4DEEEA' : '#0055FF',
      text:      isDark ? '#EAEFFB' : '#3A3A3A',
      secondary: isDark ? '#35374E' : '#BEBEBE',
      danger:    '#E53E3E',
      success:   '#38A169',
      warning:   '#D69E2E',
      white:     '#FFFFFF',
      dark:      '#222222',
      accent:    isDark ? '#4DEEEA' : '#0055FF',
      muted:     isDark ? '#666888' : '#888899'
    };
    return map[name] || map.primary;
  };

  /* ──────────────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────────────── */
  proto.randomPosition = function (cols, rows, exclude) {
    var pos, safe = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
      };
      safe++;
      if (safe > 1000) break;
    } while (exclude && exclude.some(function (e) {
      return e.x === pos.x && e.y === pos.y;
    }));
    return pos;
  };

  proto.setupTouchControls = function (element, callback) {
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
      if (Math.abs(dx) > Math.abs(dy)) {
        callback(dx > 0 ? 'right' : 'left');
      } else {
        callback(dy > 0 ? 'down' : 'up');
      }
    };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchend', onEnd, { passive: true });

    var self = this;
    self._touchCleanups.push(function () {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchend', onEnd);
    });
  };

  proto.drawRoundRect = function (ctx, x, y, w, h, r) {
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
     1. SNAKE
  ============================================================ */
  proto.initSnake = function () {
    var canvas = this.gameCanvas;
    var ctx = this.gameCtx;
    if (!canvas || !ctx) return;

    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var gridSize = 20;
    var cols = Math.floor(canvas.width / gridSize);
    var rows = Math.floor(canvas.height / gridSize);
    var self = this;

    var snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    var direction = { x: 1, y: 0 };
    var nextDir = { x: 1, y: 0 };
    var food = this.randomPosition(cols, rows, snake);
    var score = 0;
    var speed = 120;

    this._keyHandler = function (e) {
      var k = e.key;
      if (k === 'ArrowUp'    && direction.y !== 1)  { nextDir = { x: 0, y: -1 }; e.preventDefault(); }
      if (k === 'ArrowDown'  && direction.y !== -1) { nextDir = { x: 0, y: 1 };  e.preventDefault(); }
      if (k === 'ArrowLeft'  && direction.x !== 1)  { nextDir = { x: -1, y: 0 }; e.preventDefault(); }
      if (k === 'ArrowRight' && direction.x !== -1) { nextDir = { x: 1, y: 0 };  e.preventDefault(); }
    };
    document.addEventListener('keydown', this._keyHandler);

    this.setupTouchControls(canvas, function (dir) {
      if (dir === 'up'    && direction.y !== 1)  nextDir = { x: 0, y: -1 };
      if (dir === 'down'  && direction.y !== -1) nextDir = { x: 0, y: 1 };
      if (dir === 'left'  && direction.x !== 1)  nextDir = { x: -1, y: 0 };
      if (dir === 'right' && direction.x !== -1) nextDir = { x: 1, y: 0 };
    });

    var tick = function () {
      if (!self.isPlaying) return;

      direction = { x: nextDir.x, y: nextDir.y };
      var head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

      // Collision checks
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

      // Draw background
      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = self.getColor('secondary') + '20';
      ctx.lineWidth = 0.5;
      for (var gx = 0; gx <= cols; gx++) {
        ctx.beginPath();
        ctx.moveTo(gx * gridSize, 0);
        ctx.lineTo(gx * gridSize, canvas.height);
        ctx.stroke();
      }
      for (var gy = 0; gy <= rows; gy++) {
        ctx.beginPath();
        ctx.moveTo(0, gy * gridSize);
        ctx.lineTo(canvas.width, gy * gridSize);
        ctx.stroke();
      }

      // Food
      ctx.fillStyle = self.getColor('danger');
      ctx.beginPath();
      ctx.arc(
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        gridSize / 2 - 2, 0, Math.PI * 2
      );
      ctx.fill();

      // Snake
      for (var s = 0; s < snake.length; s++) {
        var seg = snake[s];
        var ratio = 1 - (s / snake.length) * 0.5;
        var alpha = Math.round(ratio * 200).toString(16);
        if (alpha.length < 2) alpha = '0' + alpha;
        ctx.fillStyle = s === 0 ? self.getColor('primary') : self.getColor('primary') + alpha;
        self.drawRoundRect(ctx,
          seg.x * gridSize + 1,
          seg.y * gridSize + 1,
          gridSize - 2, gridSize - 2, 4
        );
        ctx.fill();

        if (s === 0) {
          ctx.fillStyle = self.getColor('bg');
          ctx.beginPath();
          ctx.arc(
            seg.x * gridSize + gridSize / 2 + direction.x * 4,
            seg.y * gridSize + gridSize / 2 + direction.y * 4,
            3, 0, Math.PI * 2
          );
          ctx.fill();
        }
      }
    };

    this.gameInterval = setInterval(tick, speed);
  };

  /* ============================================================
     2. MEMORY MATCH
  ============================================================ */
  proto.initMemory = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    var allSymbols = [
      'heart', 'star', 'globe', 'shield', 'award', 'users',
      'sun', 'moon', 'zap', 'coffee', 'book', 'flag'
    ];
    var chosen = allSymbols.slice(0, 8);
    var cards = chosen.concat(chosen);

    // Shuffle
    for (var i = cards.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }

    this._mem = {
      cards: cards,
      flipped: [],
      matched: {},
      moves: 0,
      score: 0,
      locked: false,
      totalPairs: chosen.length
    };

    this._renderMemory();
  };

  proto._renderMemory = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var m = this._mem;
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
      var isFlipped = m.flipped.indexOf(i) !== -1 || m.matched[i];
      var isMatched = m.matched[i] || false;

      html +=
        '<div class="memory-card ' + (isFlipped ? 'flipped' : '') + ' ' +
             (isMatched ? 'matched' : '') + '" data-mem-idx="' + i + '">' +
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

    // Attach click handlers
    var self = this;
    var cardEls = ui.querySelectorAll('.memory-card');
    for (var c = 0; c < cardEls.length; c++) {
      (function (el) {
        el.addEventListener('click', function () {
          var idx = parseInt(el.getAttribute('data-mem-idx'), 10);
          self.flipMemoryCard(idx);
        });
      })(cardEls[c]);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  proto.flipMemoryCard = function (index) {
    if (!this.isPlaying) return;
    var m = this._mem;
    if (m.locked) return;
    if (m.matched[index]) return;
    if (m.flipped.indexOf(index) !== -1) return;

    m.flipped.push(index);
    this._renderMemory();

    if (m.flipped.length === 2) {
      m.moves++;
      m.locked = true;
      var a = m.flipped[0], b = m.flipped[1];
      var self = this;

      if (m.cards[a] === m.cards[b]) {
        m.matched[a] = true;
        m.matched[b] = true;
        m.score += 20;
        this.updateScoreDisplay(m.score);
        m.flipped = [];
        m.locked = false;
        this._renderMemory();

        var matchedCount = 0;
        var keys = Object.keys(m.matched);
        for (var k = 0; k < keys.length; k++) {
          if (m.matched[keys[k]]) matchedCount++;
        }
        if (matchedCount >= m.cards.length) {
          var bonus = Math.max(0, 200 - m.moves * 5);
          m.score += bonus;
          this.updateScoreDisplay(m.score);
          setTimeout(function () { self.gameOver(m.score); }, 600);
        }
      } else {
        setTimeout(function () {
          m.flipped = [];
          m.locked = false;
          self._renderMemory();
        }, 900);
      }
    }
  };

  /* ============================================================
     3. QUIZ
  ============================================================ */
  proto.initQuiz = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    // Shuffle questions
    var questions = QUIZ_QUESTIONS.slice();
    for (var i = questions.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = questions[i]; questions[i] = questions[j]; questions[j] = tmp;
    }

    this._quiz = {
      questions: questions,
      current: 0,
      score: 0,
      answered: false
    };

    this._renderQuiz();
  };

  proto._renderQuiz = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var q = this._quiz;

    if (q.current >= q.questions.length) {
      this.gameOver(q.score);
      return;
    }

    var question = q.questions[q.current];
    var progress = (q.current / q.questions.length) * 100;
    var self = this;

    var optionsHTML = '';
    for (var i = 0; i < question.options.length; i++) {
      var letter = String.fromCharCode(65 + i);
      optionsHTML +=
        '<button class="quiz-option" data-opt-idx="' + i + '">' +
          '<span class="quiz-option-letter">' + letter + '</span>' +
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
        '<div class="quiz-options" id="quiz-options">' + optionsHTML + '</div>' +
        '<div id="quiz-explanation-area"></div>' +
      '</div>';

    // Attach click handlers
    var btns = ui.querySelectorAll('.quiz-option');
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-opt-idx'), 10);
          self.answerQuiz(idx);
        });
      })(btns[b]);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  proto.answerQuiz = function (optionIndex) {
    if (!this.isPlaying) return;
    var q = this._quiz;
    if (q.answered) return;
    q.answered = true;

    var question = q.questions[q.current];
    var isCorrect = optionIndex === question.answer;
    var self = this;

    // Disable all buttons and show result
    var btns = document.querySelectorAll('.quiz-option');
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = true;
      btns[i].style.pointerEvents = 'none';
      var idx = parseInt(btns[i].getAttribute('data-opt-idx'), 10);
      if (idx === question.answer) {
        btns[i].classList.add('quiz-correct');
      }
      if (idx === optionIndex && !isCorrect) {
        btns[i].classList.add('quiz-wrong');
      }
    }

    if (isCorrect) {
      q.score += 10;
      this.updateScoreDisplay(q.score);
    }

    // Show explanation
    var expArea = document.getElementById('quiz-explanation-area');
    if (expArea && question.explanation) {
      var iconName = isCorrect ? 'check-circle' : 'x-circle';
      var iconColor = isCorrect ? 'var(--success)' : 'var(--danger)';
      expArea.innerHTML =
        '<div class="quiz-explanation">' +
          '<i data-lucide="' + iconName + '" style="width:18px;height:18px;flex-shrink:0;color:' + iconColor + ';"></i>' +
          '<span>' + question.explanation + '</span>' +
        '</div>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Next question
    setTimeout(function () {
      q.current++;
      q.answered = false;
      self._renderQuiz();
    }, 2200);
  };

  /* ============================================================
     4. TIC TAC TOE
  ============================================================ */
  proto.initTicTacToe = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    this._ttt = {
      board: [null, null, null, null, null, null, null, null, null],
      playerTurn: true,
      active: true,
      score: 0,
      wins: 0,
      losses: 0,
      draws: 0
    };

    this._renderTTT();
  };

  proto._tttCheckWin = function (board, player) {
    var patterns = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      if (board[p[0]] === player && board[p[1]] === player && board[p[2]] === player) {
        return true;
      }
    }
    return false;
  };

  proto._tttAiMove = function (board) {
    var patterns = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    var i, p, vals, idx;

    // Try to win
    for (i = 0; i < patterns.length; i++) {
      p = patterns[i];
      vals = [board[p[0]], board[p[1]], board[p[2]]];
      var oCount = 0, nullIdx = -1;
      for (var v = 0; v < 3; v++) {
        if (vals[v] === 'O') oCount++;
        if (vals[v] === null) nullIdx = v;
      }
      if (oCount === 2 && nullIdx !== -1) return p[nullIdx];
    }

    // Block player
    for (i = 0; i < patterns.length; i++) {
      p = patterns[i];
      vals = [board[p[0]], board[p[1]], board[p[2]]];
      var xCount = 0;
      nullIdx = -1;
      for (var v2 = 0; v2 < 3; v2++) {
        if (vals[v2] === 'X') xCount++;
        if (vals[v2] === null) nullIdx = v2;
      }
      if (xCount === 2 && nullIdx !== -1) return p[nullIdx];
    }

    // Center
    if (board[4] === null) return 4;

    // Corners
    var corners = [0, 2, 6, 8];
    var freeCorners = [];
    for (i = 0; i < corners.length; i++) {
      if (board[corners[i]] === null) freeCorners.push(corners[i]);
    }
    if (freeCorners.length > 0) {
      return freeCorners[Math.floor(Math.random() * freeCorners.length)];
    }

    // Any empty
    var empty = [];
    for (i = 0; i < board.length; i++) {
      if (board[i] === null) empty.push(i);
    }
    if (empty.length > 0) {
      return empty[Math.floor(Math.random() * empty.length)];
    }

    return -1;
  };

  proto._renderTTT = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var t = this._ttt;
    var self = this;

    var status = '';
    if (!t.active) status = 'Game ended';
    else if (t.playerTurn) status = 'Your turn (X)';
    else status = 'AI thinking...';

    var gridHTML = '<div class="ttt-grid">';
    for (var i = 0; i < 9; i++) {
      var cell = t.board[i];
      var cls = 'ttt-cell';
      if (cell) cls += ' ttt-filled';
      if (cell === 'X') cls += ' ttt-x';
      if (cell === 'O') cls += ' ttt-o';
      var disabled = cell || !t.playerTurn || !t.active;

      var content = '';
      if (cell === 'X') content = '<i data-lucide="x" style="width:32px;height:32px;"></i>';
      if (cell === 'O') content = '<i data-lucide="circle" style="width:32px;height:32px;"></i>';

      gridHTML +=
        '<button class="' + cls + '" data-ttt-idx="' + i + '"' +
        (disabled ? ' disabled' : '') + '>' +
        content + '</button>';
    }
    gridHTML += '</div>';

    var newRoundBtn = '';
    if (!t.active) {
      newRoundBtn =
        '<button class="btn btn-primary" id="ttt-new-round" style="margin-top:16px;">' +
          '<i data-lucide="rotate-ccw"></i> <span>New Round</span>' +
        '</button>';
    }

    ui.innerHTML =
      '<div class="ttt-container">' +
        '<div class="ttt-scoreboard">' +
          '<span style="color:var(--accent);">You: ' + t.wins + '</span>' +
          '<span style="color:var(--text-muted);">Draw: ' + t.draws + '</span>' +
          '<span style="color:var(--danger);">AI: ' + t.losses + '</span>' +
        '</div>' +
        '<div class="ttt-status" id="ttt-status">' + status + '</div>' +
        gridHTML +
        newRoundBtn +
      '</div>';

    // Attach click handlers
    var cells = ui.querySelectorAll('.ttt-cell');
    for (var c = 0; c < cells.length; c++) {
      (function (el) {
        el.addEventListener('click', function () {
          var idx = parseInt(el.getAttribute('data-ttt-idx'), 10);
          self.tttMove(idx);
        });
      })(cells[c]);
    }

    var newBtn = document.getElementById('ttt-new-round');
    if (newBtn) {
      newBtn.addEventListener('click', function () { self.tttNewRound(); });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  proto.tttMove = function (index) {
    if (!this.isPlaying) return;
    var t = this._ttt;
    if (!t.active || !t.playerTurn || t.board[index] !== null) return;

    var self = this;
    t.board[index] = 'X';
    t.playerTurn = false;
    this._renderTTT();

    if (this._tttCheckWin(t.board, 'X')) {
      t.active = false;
      t.wins++;
      t.score += 30;
      this.updateScoreDisplay(t.score);
      this._renderTTT();
      var statusEl = document.getElementById('ttt-status');
      if (statusEl) statusEl.textContent = 'You Win!';
      return;
    }

    var allFilled = true;
    for (var i = 0; i < t.board.length; i++) {
      if (t.board[i] === null) { allFilled = false; break; }
    }
    if (allFilled) {
      t.active = false;
      t.draws++;
      t.score += 10;
      this.updateScoreDisplay(t.score);
      this._renderTTT();
      var statusEl2 = document.getElementById('ttt-status');
      if (statusEl2) statusEl2.textContent = 'Draw!';
      return;
    }

    // AI move
    setTimeout(function () {
      if (!self.isPlaying) return;
      var move = self._tttAiMove(t.board);
      if (move === -1) return;
      t.board[move] = 'O';
      t.playerTurn = true;

      if (self._tttCheckWin(t.board, 'O')) {
        t.active = false;
        t.losses++;
        self._renderTTT();
        var s = document.getElementById('ttt-status');
        if (s) s.textContent = 'AI Wins!';
        return;
      }

      var allDone = true;
      for (var k = 0; k < t.board.length; k++) {
        if (t.board[k] === null) { allDone = false; break; }
      }
      if (allDone) {
        t.active = false;
        t.draws++;
        t.score += 10;
        self.updateScoreDisplay(t.score);
        self._renderTTT();
        var s2 = document.getElementById('ttt-status');
        if (s2) s2.textContent = 'Draw!';
        return;
      }

      self._renderTTT();
    }, 500);
  };

  proto.tttNewRound = function () {
    if (!this.isPlaying) return;
    this._ttt.board = [null, null, null, null, null, null, null, null, null];
    this._ttt.playerTurn = true;
    this._ttt.active = true;
    this._renderTTT();
  };

  /* ============================================================
     5. SPEED TYPING
  ============================================================ */
  proto.initTyping = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    var quote = TYPING_QUOTES[Math.floor(Math.random() * TYPING_QUOTES.length)];
    var startTime = Date.now();
    var finished = false;
    var self = this;

    ui.innerHTML =
      '<div class="typing-container">' +
        '<h3 style="font-size:0.9rem;font-weight:700;color:var(--text-heading);' +
            'margin-bottom:16px;text-align:center;">' +
          'Type the text below as fast as you can!' +
        '</h3>' +
        '<div class="typing-target" id="typing-target">' + quote + '</div>' +
        '<div style="margin-top:16px;">' +
          '<textarea id="typing-input" rows="3" placeholder="Start typing here..." ' +
            'style="font-size:1rem;line-height:1.8;width:100%;box-sizing:border-box;' +
            'resize:none;padding:12px;border-radius:8px;border:2px solid var(--border);' +
            'background:var(--bg-card);color:var(--text-primary);font-family:Poppins,sans-serif;' +
            'outline:none;transition:border-color 0.2s;"></textarea>' +
        '</div>' +
        '<div class="typing-stats" id="typing-stats">' +
          '<span>WPM: <strong id="stat-wpm">0</strong></span>' +
          '<span>Accuracy: <strong id="stat-acc">100%</strong></span>' +
          '<span>Time: <strong id="stat-time">0s</strong></span>' +
        '</div>' +
      '</div>';

    var input = document.getElementById('typing-input');
    var targetEl = document.getElementById('typing-target');
    if (!input) return;

    input.focus();

    input.addEventListener('focus', function () {
      input.style.borderColor = 'var(--accent)';
    });
    input.addEventListener('blur', function () {
      input.style.borderColor = 'var(--border)';
    });

    input.addEventListener('input', function () {
      if (finished || !self.isPlaying) return;
      var typed = input.value;
      var elapsed = Math.max(1, (Date.now() - startTime) / 1000);
      var wordArr = typed.trim().split(/\s+/);
      var words = typed.trim() === '' ? 0 : wordArr.length;
      var wpm = Math.round((words / elapsed) * 60);

      var correct = 0;
      var len = Math.min(typed.length, quote.length);
      for (var i = 0; i < len; i++) {
        if (typed[i] === quote[i]) correct++;
      }
      var accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;

      // Highlight target
      var highlighted = '';
      for (var h = 0; h < quote.length; h++) {
        var ch = quote[h] === ' ' ? '&nbsp;' : quote[h];
        if (h < typed.length) {
          if (typed[h] === quote[h]) {
            highlighted += '<span style="color:var(--success);font-weight:600;">' + ch + '</span>';
          } else {
            highlighted += '<span style="color:var(--danger);background:rgba(229,62,62,0.15);text-decoration:underline;">' + ch + '</span>';
          }
        } else {
          highlighted += (quote[h] === ' ') ? ' ' : quote[h];
        }
      }
      if (targetEl) targetEl.innerHTML = highlighted;

      var wpmEl = document.getElementById('stat-wpm');
      var accEl = document.getElementById('stat-acc');
      var timeEl = document.getElementById('stat-time');
      if (wpmEl) wpmEl.textContent = wpm;
      if (accEl) accEl.textContent = accuracy + '%';
      if (timeEl) timeEl.textContent = Math.round(elapsed) + 's';

      var score = Math.round(wpm * (accuracy / 100));
      self.updateScoreDisplay(score);

      if (typed.length >= quote.length) {
        finished = true;
        input.disabled = true;
        setTimeout(function () { self.gameOver(score); }, 500);
      }
    });
  };

  /* ============================================================
     6. FLAPPY BIRD
  ============================================================ */
  proto.initFlappy = function () {
    var canvas = this.gameCanvas;
    var ctx = this.gameCtx;
    if (!canvas || !ctx) return;
    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var self = this;
    var birdY = canvas.height / 2;
    var birdVel = 0;
    var birdX = 80;
    var birdSize = 18;
    var gravity = 0.45;
    var jumpStr = -7.5;
    var pipeWidth = 52;
    var pipeGap = 145;
    var pipeSpeed = 2.5;
    var pipes = [];
    var score = 0;
    var frame = 0;

    var addPipe = function () {
      var min = 60;
      var max = canvas.height - pipeGap - 60;
      pipes.push({
        x: canvas.width,
        topH: Math.random() * (max - min) + min,
        passed: false
      });
    };

    var doJump = function () {
      if (self.isPlaying) birdVel = jumpStr;
    };

    this._keyHandler = function (e) {
      if (e.code === 'Space' || e.key === 'ArrowUp') {
        e.preventDefault();
        doJump();
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    var clickHandler = function () { doJump(); };
    var touchHandler = function (e) { e.preventDefault(); doJump(); };
    canvas.addEventListener('click', clickHandler);
    canvas.addEventListener('touchstart', touchHandler, { passive: false });
    this._touchCleanups.push(function () {
      canvas.removeEventListener('click', clickHandler);
      canvas.removeEventListener('touchstart', touchHandler);
    });

    addPipe();

    var tick = function () {
      if (!self.isPlaying) return;
      self.animationFrame = requestAnimationFrame(tick);

      frame++;
      birdVel += gravity;
      birdY += birdVel;

      if (frame % 90 === 0) addPipe();

      for (var p = 0; p < pipes.length; p++) {
        pipes[p].x -= pipeSpeed;
        if (!pipes[p].passed && pipes[p].x + pipeWidth < birdX) {
          pipes[p].passed = true;
          score++;
          self.updateScoreDisplay(score);
        }
      }

      // Remove off-screen pipes
      var newPipes = [];
      for (var r = 0; r < pipes.length; r++) {
        if (pipes[r].x > -pipeWidth - 10) newPipes.push(pipes[r]);
      }
      pipes = newPipes;

      // Collision
      if (birdY < 0 || birdY + birdSize > canvas.height) {
        self.gameOver(score); return;
      }
      for (var c = 0; c < pipes.length; c++) {
        var pipe = pipes[c];
        var botY = pipe.topH + pipeGap;
        if (birdX + birdSize - 4 > pipe.x && birdX + 4 < pipe.x + pipeWidth) {
          if (birdY + 4 < pipe.topH || birdY + birdSize - 4 > botY) {
            self.gameOver(score); return;
          }
        }
      }

      // Draw
      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Pipes
      var pipeColor = self.getColor('success');
      for (var d = 0; d < pipes.length; d++) {
        var pp = pipes[d];
        var bY = pp.topH + pipeGap;
        ctx.fillStyle = pipeColor;
        ctx.fillRect(pp.x, 0, pipeWidth, pp.topH);
        ctx.fillRect(pp.x, bY, pipeWidth, canvas.height - bY);
        ctx.fillStyle = pipeColor + 'CC';
        ctx.fillRect(pp.x - 5, pp.topH - 22, pipeWidth + 10, 22);
        ctx.fillRect(pp.x - 5, bY, pipeWidth + 10, 22);
      }

      // Bird
      ctx.fillStyle = self.getColor('primary');
      ctx.beginPath();
      ctx.arc(birdX + birdSize / 2, birdY + birdSize / 2, birdSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = self.getColor('white');
      ctx.beginPath();
      ctx.arc(birdX + birdSize / 2 + 5, birdY + birdSize / 2 - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = self.getColor('dark');
      ctx.beginPath();
      ctx.arc(birdX + birdSize / 2 + 6, birdY + birdSize / 2 - 3, 2, 0, Math.PI * 2);
      ctx.fill();

      // Score on canvas
      ctx.fillStyle = self.getColor('text') + 'CC';
      ctx.font = 'bold 18px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('' + score, canvas.width / 2, 30);
      ctx.textAlign = 'start';

      // Ground
      ctx.strokeStyle = self.getColor('secondary');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 1);
      ctx.lineTo(canvas.width, canvas.height - 1);
      ctx.stroke();
    };

    tick();
  };

  /* ============================================================
     7. BREAKOUT
  ============================================================ */
  proto.initBreakout = function () {
    var canvas = this.gameCanvas;
    var ctx = this.gameCtx;
    if (!canvas || !ctx) return;
    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var self = this;
    var paddleW = 90, paddleH = 12;
    var paddleX = canvas.width / 2 - paddleW / 2;

    var ballR = 8;
    var ballX = canvas.width / 2;
    var ballY = canvas.height - 60;
    var ballDX = 3.5, ballDY = -3.5;
    var lives = 3;

    var bRows = 5;
    var bCols = Math.floor((canvas.width - 20) / 58);
    var bW = (canvas.width - 20 - (bCols - 1) * 4) / bCols;
    var bH = 18, bPad = 4, bTop = 40, bLeft = 10;

    var rowColors = [
      self.getColor('danger'), self.getColor('warning'),
      self.getColor('success'), self.getColor('primary'), '#9F7AEA'
    ];

    var bricks = [];
    for (var r = 0; r < bRows; r++) {
      for (var c = 0; c < bCols; c++) {
        bricks.push({
          x: bLeft + c * (bW + bPad),
          y: bTop + r * (bH + bPad),
          alive: true,
          color: rowColors[r]
        });
      }
    }

    var score = 0;
    var rightPressed = false, leftPressed = false;

    this._keyHandler = function (e) {
      if (e.key === 'ArrowRight') { rightPressed = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { leftPressed = true; e.preventDefault(); }
    };
    this._keyUpHandler = function (e) {
      if (e.key === 'ArrowRight') rightPressed = false;
      if (e.key === 'ArrowLeft') leftPressed = false;
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup', this._keyUpHandler);

    var mouseHandler = function (e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      paddleX = Math.max(0, Math.min(canvas.width - paddleW,
        (e.clientX - rect.left) * scaleX - paddleW / 2));
    };
    var touchMoveHandler = function (e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      paddleX = Math.max(0, Math.min(canvas.width - paddleW,
        (e.touches[0].clientX - rect.left) * scaleX - paddleW / 2));
    };
    canvas.addEventListener('mousemove', mouseHandler);
    canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });
    this._touchCleanups.push(function () {
      canvas.removeEventListener('mousemove', mouseHandler);
      canvas.removeEventListener('touchmove', touchMoveHandler);
    });

    var tick = function () {
      if (!self.isPlaying) return;
      self.animationFrame = requestAnimationFrame(tick);

      if (rightPressed && paddleX < canvas.width - paddleW) paddleX += 7;
      if (leftPressed && paddleX > 0) paddleX -= 7;

      ballX += ballDX;
      ballY += ballDY;

      if (ballX + ballR > canvas.width || ballX - ballR < 0) ballDX = -ballDX;
      if (ballY - ballR < 0) ballDY = -ballDY;

      // Paddle bounce
      var paddleTop = canvas.height - paddleH - 10;
      if (ballY + ballR >= paddleTop && ballY + ballR <= paddleTop + paddleH + Math.abs(ballDY) &&
          ballX >= paddleX && ballX <= paddleX + paddleW) {
        ballDY = -Math.abs(ballDY);
        ballDX = (((ballX - paddleX) / paddleW) - 0.5) * 9;
      }

      // Bottom
      if (ballY + ballR > canvas.height) {
        lives--;
        if (lives <= 0) { self.gameOver(score); return; }
        ballX = canvas.width / 2;
        ballY = canvas.height - 60;
        ballDX = 3.5;
        ballDY = -3.5;
      }

      // Brick collision
      for (var b = 0; b < bricks.length; b++) {
        var brick = bricks[b];
        if (!brick.alive) continue;
        if (ballX + ballR > brick.x && ballX - ballR < brick.x + bW &&
            ballY + ballR > brick.y && ballY - ballR < brick.y + bH) {
          var overlapL = ballX + ballR - brick.x;
          var overlapR = brick.x + bW - (ballX - ballR);
          var overlapT = ballY + ballR - brick.y;
          var overlapB = brick.y + bH - (ballY - ballR);
          var minO = Math.min(overlapL, overlapR, overlapT, overlapB);
          if (minO === overlapT || minO === overlapB) ballDY = -ballDY;
          else ballDX = -ballDX;
          brick.alive = false;
          score += 10;
          self.updateScoreDisplay(score);
          break;
        }
      }

      // Win check
      var allDead = true;
      for (var w = 0; w < bricks.length; w++) {
        if (bricks[w].alive) { allDead = false; break; }
      }
      if (allDead) { self.gameOver(score + 100); return; }

      // Draw
      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (var d = 0; d < bricks.length; d++) {
        if (!bricks[d].alive) continue;
        ctx.fillStyle = bricks[d].color;
        ctx.fillRect(bricks[d].x, bricks[d].y, bW, bH);
        ctx.strokeStyle = self.getColor('bg');
        ctx.lineWidth = 1;
        ctx.strokeRect(bricks[d].x, bricks[d].y, bW, bH);
      }

      // Ball
      ctx.fillStyle = self.getColor('primary');
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
      ctx.fill();

      // Paddle
      ctx.fillStyle = self.getColor('text');
      self.drawRoundRect(ctx, paddleX, paddleTop, paddleW, paddleH, 6);
      ctx.fill();

      // Lives
      ctx.fillStyle = self.getColor('text') + 'CC';
      ctx.font = 'bold 13px Poppins, sans-serif';
      var livesText = 'Lives: ';
      for (var lv = 0; lv < lives; lv++) livesText += '* ';
      ctx.fillText(livesText.trim(), 8, 20);
    };

    tick();
  };

  /* ============================================================
     8. WORDLE
  ============================================================ */
  proto.initWordle = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    this._wordle = {
      word: WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)],
      guesses: [],
      currentGuess: '',
      maxGuesses: 6,
      won: false,
      lost: false
    };

    this._renderWordle();
    this._setupWordleKeys();
  };

  proto._wordleLetterStates = function () {
    var w = this._wordle;
    var states = {};
    for (var g = 0; g < w.guesses.length; g++) {
      var guess = w.guesses[g];
      for (var i = 0; i < 5; i++) {
        var letter = guess[i];
        if (!letter) continue;
        if (letter === w.word[i]) {
          states[letter] = 'correct';
        } else if (w.word.indexOf(letter) !== -1 && states[letter] !== 'correct') {
          states[letter] = 'present';
        } else if (w.word.indexOf(letter) === -1 && !states[letter]) {
          states[letter] = 'absent';
        }
      }
    }
    return states;
  };

  proto._renderWordle = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var w = this._wordle;
    var self = this;

    // Grid
    var gridHTML = '<div class="wordle-grid">';
    for (var row = 0; row < w.maxGuesses; row++) {
      var guess = w.guesses[row] || '';
      var isActive = row === w.guesses.length && !w.won && !w.lost;
      var display = isActive ? w.currentGuess : guess;

      gridHTML += '<div class="wordle-row">';
      for (var col = 0; col < 5; col++) {
        var cls = 'wordle-cell';
        var letter = display[col] || '';

        if (row < w.guesses.length && guess[col]) {
          if (guess[col] === w.word[col]) {
            cls += ' wc-correct';
          } else if (w.word.indexOf(guess[col]) !== -1) {
            cls += ' wc-present';
          } else {
            cls += ' wc-absent';
          }
        } else if (isActive && letter) {
          cls += ' wc-active';
        }
        gridHTML += '<div class="' + cls + '">' + letter + '</div>';
      }
      gridHTML += '</div>';
    }
    gridHTML += '</div>';

    // Message
    var msgHTML = '';
    if (w.won) {
      msgHTML = '<div class="wordle-msg wm-success">Brilliant! The word was <strong>' + w.word + '</strong></div>';
    }
    if (w.lost) {
      msgHTML = '<div class="wordle-msg wm-danger">The word was <strong>' + w.word + '</strong>. Try again!</div>';
    }

    // Keyboard
    var kbRows = [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['ENTER','Z','X','C','V','B','N','M','DEL']
    ];
    var letterStates = this._wordleLetterStates();

    var kbHTML = '<div class="wordle-keyboard">';
    for (var kr = 0; kr < kbRows.length; kr++) {
      kbHTML += '<div class="wordle-kb-row">';
      for (var kc = 0; kc < kbRows[kr].length; kc++) {
        var key = kbRows[kr][kc];
        var state = letterStates[key] || '';
        var wide = (key === 'ENTER' || key === 'DEL') ? ' wk-wide' : '';
        kbHTML += '<button class="wordle-key' + wide + ' wk-' + state + '" ' +
                  'data-wordle-key="' + key + '">' + key + '</button>';
      }
      kbHTML += '</div>';
    }
    kbHTML += '</div>';

    ui.innerHTML =
      '<div class="wordle-container">' +
        '<div style="text-align:center;margin-bottom:8px;font-size:0.8rem;' +
            'color:var(--text-muted);font-weight:600;">' +
          'Guess the 5-letter word!' +
        '</div>' +
        gridHTML +
        msgHTML +
        kbHTML +
      '</div>';

    // Attach keyboard click handlers
    var keyBtns = ui.querySelectorAll('.wordle-key');
    for (var kb = 0; kb < keyBtns.length; kb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.wordleKey(btn.getAttribute('data-wordle-key'));
        });
      })(keyBtns[kb]);
    }
  };

  proto._setupWordleKeys = function () {
    var self = this;
    this._keyHandler = function (e) {
      if (!self.isPlaying) return;
      var w = self._wordle;
      if (w.won || w.lost) return;
      var key = e.key.toUpperCase();
      if (key === 'ENTER') { self.wordleKey('ENTER'); e.preventDefault(); }
      else if (key === 'BACKSPACE') { self.wordleKey('DEL'); e.preventDefault(); }
      else if (/^[A-Z]$/.test(key)) { self.wordleKey(key); }
    };
    document.addEventListener('keydown', this._keyHandler);
  };

  proto.wordleKey = function (key) {
    if (!this.isPlaying) return;
    var w = this._wordle;
    if (w.won || w.lost) return;

    if (key === 'DEL' || key === 'BACKSPACE') {
      w.currentGuess = w.currentGuess.slice(0, -1);
    } else if (key === 'ENTER') {
      if (w.currentGuess.length < 5) {
        // Shake animation
        var rows = document.querySelectorAll('.wordle-row');
        var activeRow = rows[w.guesses.length];
        if (activeRow) {
          activeRow.classList.add('wordle-shake');
          setTimeout(function () { activeRow.classList.remove('wordle-shake'); }, 500);
        }
        return;
      }
      w.guesses.push(w.currentGuess);

      if (w.currentGuess === w.word) {
        w.won = true;
        var bonus = (w.maxGuesses - w.guesses.length + 1) * 20;
        var score = 100 + bonus;
        this.updateScoreDisplay(score);
        this._renderWordle();
        var self = this;
        setTimeout(function () { self.gameOver(score); }, 1500);
        return;
      }

      if (w.guesses.length >= w.maxGuesses) {
        w.lost = true;
        this._renderWordle();
        var self2 = this;
        setTimeout(function () { self2.gameOver(0); }, 1500);
        return;
      }

      w.currentGuess = '';
    } else if (/^[A-Z]$/.test(key) && w.currentGuess.length < 5) {
      w.currentGuess += key;
    }

    this._renderWordle();
  };

  /* ============================================================
     9. PONG
  ============================================================ */
  proto.initPong = function () {
    var canvas = this.gameCanvas;
    var ctx = this.gameCtx;
    if (!canvas || !ctx) return;
    var ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    var self = this;
    var paddleH = 70, paddleW = 10, ballSize = 10;
    var winScore = 7;
    var playerY = canvas.height / 2 - paddleH / 2;
    var aiY = canvas.height / 2 - paddleH / 2;
    var ballX = canvas.width / 2, ballY = canvas.height / 2;
    var ballDX = 4, ballDY = 3;
    var playerScore = 0, aiScore = 0;
    var aiSpeed = 3.2;
    var upPressed = false, downPressed = false;

    this._keyHandler = function (e) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        upPressed = true; e.preventDefault();
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        downPressed = true; e.preventDefault();
      }
    };
    this._keyUpHandler = function (e) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') upPressed = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') downPressed = false;
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup', this._keyUpHandler);

    var touchMoveH = function (e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var scaleY = canvas.height / rect.height;
      playerY = Math.max(0, Math.min(canvas.height - paddleH,
        (e.touches[0].clientY - rect.top) * scaleY - paddleH / 2));
    };
    canvas.addEventListener('touchmove', touchMoveH, { passive: false });
    this._touchCleanups.push(function () {
      canvas.removeEventListener('touchmove', touchMoveH);
    });

    var resetBall = function () {
      ballX = canvas.width / 2;
      ballY = canvas.height / 2;
      ballDX = (Math.random() > 0.5 ? 1 : -1) * 4;
      ballDY = (Math.random() > 0.5 ? 1 : -1) * 3;
    };

    var tick = function () {
      if (!self.isPlaying) return;
      self.animationFrame = requestAnimationFrame(tick);

      if (upPressed && playerY > 0) playerY -= 6;
      if (downPressed && playerY < canvas.height - paddleH) playerY += 6;

      // AI
      var aiCenter = aiY + paddleH / 2;
      if (aiCenter < ballY - 5) aiY = Math.min(canvas.height - paddleH, aiY + aiSpeed);
      if (aiCenter > ballY + 5) aiY = Math.max(0, aiY - aiSpeed);

      ballX += ballDX;
      ballY += ballDY;

      // Top/bottom bounce
      if (ballY - ballSize / 2 < 0 || ballY + ballSize / 2 > canvas.height) ballDY = -ballDY;

      // Player paddle
      if (ballX - ballSize / 2 < paddleW + 20 &&
          ballY > playerY && ballY < playerY + paddleH && ballDX < 0) {
        ballDX = Math.abs(ballDX) * 1.05;
        ballDY = ((ballY - playerY) / paddleH - 0.5) * 8;
      }

      // AI paddle
      if (ballX + ballSize / 2 > canvas.width - paddleW - 20 &&
          ballY > aiY && ballY < aiY + paddleH && ballDX > 0) {
        ballDX = -Math.abs(ballDX) * 1.05;
        ballDY = ((ballY - aiY) / paddleH - 0.5) * 8;
      }

      // Speed cap
      ballDX = Math.max(-10, Math.min(10, ballDX));
      ballDY = Math.max(-8, Math.min(8, ballDY));

      // Scoring
      if (ballX < 0) {
        aiScore++;
        if (aiScore >= winScore) { self.gameOver(playerScore * 10); return; }
        resetBall();
      }
      if (ballX > canvas.width) {
        playerScore++;
        self.updateScoreDisplay(playerScore * 10);
        if (playerScore >= winScore) { self.gameOver(playerScore * 15); return; }
        resetBall();
      }

      // Draw
      ctx.fillStyle = self.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center line
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = self.getColor('secondary') + '60';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Paddles
      ctx.fillStyle = self.getColor('primary');
      self.drawRoundRect(ctx, 10, playerY, paddleW, paddleH, 5);
      ctx.fill();

      ctx.fillStyle = self.getColor('danger');
      self.drawRoundRect(ctx, canvas.width - paddleW - 10, aiY, paddleW, paddleH, 5);
      ctx.fill();

      // Ball
      ctx.fillStyle = self.getColor('text');
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Scores
      ctx.fillStyle = self.getColor('text');
      ctx.font = 'bold 28px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('' + playerScore, canvas.width / 2 - 36, 40);
      ctx.fillText('' + aiScore, canvas.width / 2 + 36, 40);

      ctx.font = 'bold 10px Poppins, sans-serif';
      ctx.fillStyle = self.getColor('muted');
      ctx.fillText('YOU', canvas.width / 2 - 36, 56);
      ctx.fillText('AI', canvas.width / 2 + 36, 56);
      ctx.textAlign = 'start';
    };

    tick();
  };

  /* ============================================================
     10. 2048
  ============================================================ */
  proto.init2048 = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    var self = this;
    var SIZE = 4;

    var newGrid = function () {
      var g = [];
      for (var r = 0; r < SIZE; r++) {
        var row = [];
        for (var c = 0; c < SIZE; c++) row.push(0);
        g.push(row);
      }
      return g;
    };

    var addRandom = function (grid) {
      var empty = [];
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (!grid[r][c]) empty.push([r, c]);
        }
      }
      if (!empty.length) return;
      var cell = empty[Math.floor(Math.random() * empty.length)];
      grid[cell[0]][cell[1]] = Math.random() < 0.9 ? 2 : 4;
    };

    var grid = newGrid();
    addRandom(grid);
    addRandom(grid);
    var score = 0;

    this._g2048 = { grid: grid, score: score };

    var rotateGrid = function (g) {
      var newG = newGrid();
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          newG[c][SIZE - 1 - r] = g[r][c];
        }
      }
      return newG;
    };

    var slide = function (row) {
      var arr = [];
      var pts = 0;
      for (var i = 0; i < row.length; i++) {
        if (row[i]) arr.push(row[i]);
      }
      for (var j = 0; j < arr.length - 1; j++) {
        if (arr[j] === arr[j + 1]) {
          arr[j] *= 2;
          pts += arr[j];
          arr.splice(j + 1, 1);
        }
      }
      while (arr.length < SIZE) arr.push(0);
      return { row: arr, pts: pts };
    };

    var hasMoves = function (g) {
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (!g[r][c]) return true;
          if (c < SIZE - 1 && g[r][c] === g[r][c + 1]) return true;
          if (r < SIZE - 1 && g[r][c] === g[r + 1][c]) return true;
        }
      }
      return false;
    };

    var doMove = function (dir) {
      var gd = self._g2048;
      var rotations = { left: 0, right: 2, up: 3, down: 1 };
      var rots = rotations[dir] || 0;
      var moved = false;
      var pts = 0;

      var temp = [];
      for (var r = 0; r < SIZE; r++) temp.push(gd.grid[r].slice());

      for (var i = 0; i < rots; i++) temp = rotateGrid(temp);

      for (var row = 0; row < SIZE; row++) {
        var res = slide(temp[row]);
        pts += res.pts;
        var oldRow = JSON.stringify(temp[row]);
        var newRow = JSON.stringify(res.row);
        if (oldRow !== newRow) moved = true;
        temp[row] = res.row;
      }

      for (var j = 0; j < (4 - rots) % 4; j++) temp = rotateGrid(temp);

      if (moved) {
        gd.grid = temp;
        gd.score += pts;
        score = gd.score;
        addRandom(gd.grid);
        self.updateScoreDisplay(score);
        self._render2048();

        // Check for 2048
        var has2048 = false;
        for (var r2 = 0; r2 < SIZE; r2++) {
          for (var c2 = 0; c2 < SIZE; c2++) {
            if (gd.grid[r2][c2] === 2048) has2048 = true;
          }
        }
        if (has2048) {
          setTimeout(function () { self.gameOver(score + 500); }, 300);
          return;
        }
        if (!hasMoves(gd.grid)) {
          setTimeout(function () { self.gameOver(score); }, 300);
        }
      }
    };

    this._2048move = doMove;

    this._keyHandler = function (e) {
      if (!self.isPlaying) return;
      var map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); doMove(map[e.key]); }
    };
    document.addEventListener('keydown', this._keyHandler);

    this.setupTouchControls(ui, function (dir) { doMove(dir); });

    this._render2048();
  };

  proto._render2048 = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var gd = this._g2048;
    var self = this;

    var tileColors = {
      0:    { bg: '#cdc1b4', fg: '#cdc1b4' },
      2:    { bg: '#eee4da', fg: '#776e65' },
      4:    { bg: '#ede0c8', fg: '#776e65' },
      8:    { bg: '#f2b179', fg: '#f9f6f2' },
      16:   { bg: '#f59563', fg: '#f9f6f2' },
      32:   { bg: '#f67c5f', fg: '#f9f6f2' },
      64:   { bg: '#f65e3b', fg: '#f9f6f2' },
      128:  { bg: '#edcf72', fg: '#f9f6f2' },
      256:  { bg: '#edcc61', fg: '#f9f6f2' },
      512:  { bg: '#edc850', fg: '#f9f6f2' },
      1024: { bg: '#edc53f', fg: '#f9f6f2' },
      2048: { bg: '#edc22e', fg: '#f9f6f2' }
    };

    var cellsHTML = '';
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        var v = gd.grid[r][c];
        var colors = tileColors[v] || tileColors[2048];
        var fontSize = v >= 1024 ? '1rem' : v >= 128 ? '1.2rem' : '1.4rem';
        cellsHTML +=
          '<div class="g2048-cell" style="background:' + colors.bg + ';color:' + colors.fg +
          ';font-size:' + fontSize + ';">' + (v || '') + '</div>';
      }
    }

    ui.innerHTML =
      '<div class="g2048-container">' +
        '<div style="text-align:center;margin-bottom:12px;font-size:0.82rem;' +
            'color:var(--text-muted);font-weight:600;">' +
          'Use arrow keys or swipe to merge tiles!' +
        '</div>' +
        '<div class="g2048-grid">' + cellsHTML + '</div>' +
        '<div style="display:flex;justify-content:center;gap:12px;margin-top:16px;flex-wrap:wrap;">' +
          '<button class="g2048-btn" data-dir="up">&#9650;</button>' +
          '<button class="g2048-btn" data-dir="left">&#9664;</button>' +
          '<button class="g2048-btn" data-dir="down">&#9660;</button>' +
          '<button class="g2048-btn" data-dir="right">&#9654;</button>' +
        '</div>' +
      '</div>';

    // Attach button handlers
    var dirBtns = ui.querySelectorAll('.g2048-btn');
    for (var d = 0; d < dirBtns.length; d++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self._2048move(btn.getAttribute('data-dir'));
        });
      })(dirBtns[d]);
    }
  };

  /* ============================================================
     11. MINESWEEPER
  ============================================================ */
  proto.initMinesweeper = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    var ROWS = 9, COLS = 9, MINES = 10;
    var dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    var board = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) {
        row.push({ r: r, c: c, mine: false, revealed: false, flagged: false, adjacent: 0 });
      }
      board.push(row);
    }

    // Place mines
    var placed = 0;
    while (placed < MINES) {
      var mr = Math.floor(Math.random() * ROWS);
      var mc = Math.floor(Math.random() * COLS);
      if (!board[mr][mc].mine) { board[mr][mc].mine = true; placed++; }
    }

    // Calculate adjacency
    var recalc = function () {
      for (var r2 = 0; r2 < ROWS; r2++) {
        for (var c2 = 0; c2 < COLS; c2++) {
          if (board[r2][c2].mine) { board[r2][c2].adjacent = 0; continue; }
          var count = 0;
          for (var d = 0; d < dirs.length; d++) {
            var nr = r2 + dirs[d][0], nc = c2 + dirs[d][1];
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++;
          }
          board[r2][c2].adjacent = count;
        }
      }
    };
    recalc();

    this._ms = {
      board: board,
      rows: ROWS,
      cols: COLS,
      mines: MINES,
      revealed: 0,
      flagged: 0,
      firstMove: true,
      won: false,
      lost: false,
      score: 0,
      dirs: dirs,
      recalc: recalc
    };

    this._renderMS();
  };

  proto._renderMS = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var ms = this._ms;
    var self = this;

    var adjColors = ['', '#1976D2', '#388E3C', '#D32F2F', '#7B1FA2',
                     '#F57F17', '#0097A7', '#212121', '#757575'];

    var remaining = ms.mines - ms.flagged;
    var safe = ms.rows * ms.cols - ms.mines;

    var statusText = '';
    var statusIcon = '';
    if (ms.won) { statusText = 'You Win!'; statusIcon = 'check-circle'; }
    else if (ms.lost) { statusText = 'Boom!'; statusIcon = 'x-circle'; }
    else { statusText = 'Playing'; statusIcon = 'play'; }

    var gridHTML = '<div class="ms-grid" style="grid-template-columns:repeat(' + ms.cols + ',1fr);">';
    for (var r = 0; r < ms.rows; r++) {
      for (var c = 0; c < ms.cols; c++) {
        var cell = ms.board[r][c];
        var content = '';
        var cls = 'ms-cell';

        if (ms.lost && cell.mine && !cell.flagged) {
          cls += ' ms-mine';
          content = '<i data-lucide="bomb" style="width:14px;height:14px;"></i>';
        } else if (cell.flagged) {
          content = '<i data-lucide="flag" style="width:14px;height:14px;color:var(--danger);"></i>';
          cls += ' ms-flagged';
        } else if (!cell.revealed) {
          cls += ' ms-hidden';
        } else if (cell.mine) {
          cls += ' ms-mine';
          content = '<i data-lucide="bomb" style="width:14px;height:14px;"></i>';
        } else {
          cls += ' ms-revealed';
          if (cell.adjacent > 0) {
            content = '<span style="color:' + adjColors[cell.adjacent] + ';font-weight:800;">' +
                      cell.adjacent + '</span>';
          }
        }

        gridHTML +=
          '<div class="' + cls + '" data-ms-r="' + r + '" data-ms-c="' + c + '">' +
            content +
          '</div>';
      }
    }
    gridHTML += '</div>';

    var actionBtn = '';
    if (ms.won || ms.lost) {
      actionBtn =
        '<button class="btn btn-primary" id="ms-restart" style="display:block;margin:12px auto 0;">' +
          '<i data-lucide="rotate-ccw"></i> <span>New Game</span>' +
        '</button>';
    }

    ui.innerHTML =
      '<div class="ms-container">' +
        '<div class="ms-header">' +
          '<span><i data-lucide="bomb" style="width:14px;height:14px;vertical-align:middle;"></i> ' + remaining + ' left</span>' +
          '<span><i data-lucide="' + statusIcon + '" style="width:14px;height:14px;vertical-align:middle;"></i> ' + statusText + '</span>' +
          '<span><i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:middle;"></i> ' + ms.revealed + '/' + safe + '</span>' +
        '</div>' +
        gridHTML +
        '<p style="text-align:center;font-size:0.72rem;color:var(--text-muted);margin-top:10px;">' +
          'Click to reveal | Right-click / long-press to flag' +
        '</p>' +
        actionBtn +
      '</div>';

    // Attach handlers
    var cells = ui.querySelectorAll('.ms-cell');
    for (var i = 0; i < cells.length; i++) {
      (function (el) {
        var cr = parseInt(el.getAttribute('data-ms-r'), 10);
        var cc = parseInt(el.getAttribute('data-ms-c'), 10);
        el.addEventListener('click', function () { self.msReveal(cr, cc); });
        el.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          self.msFlag(cr, cc);
        });
        // Long press for mobile
        var timer = null;
        el.addEventListener('touchstart', function (e) {
          timer = setTimeout(function () {
            e.preventDefault();
            self.msFlag(cr, cc);
          }, 500);
        }, { passive: false });
        el.addEventListener('touchend', function () { clearTimeout(timer); });
        el.addEventListener('touchmove', function () { clearTimeout(timer); });
      })(cells[i]);
    }

    var restartBtn = document.getElementById('ms-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () { self.initMinesweeper(); });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  proto.msReveal = function (r, c) {
    if (!this.isPlaying) return;
    var ms = this._ms;
    var cell = ms.board[r][c];
    if (ms.lost || ms.won || cell.revealed || cell.flagged) return;

    // Safe first click
    if (ms.firstMove && cell.mine) {
      cell.mine = false;
      var relocated = false;
      for (var fr = 0; fr < ms.rows && !relocated; fr++) {
        for (var fc = 0; fc < ms.cols && !relocated; fc++) {
          if (!ms.board[fr][fc].mine && !(fr === r && fc === c)) {
            ms.board[fr][fc].mine = true;
            relocated = true;
          }
        }
      }
      ms.recalc();
    }
    ms.firstMove = false;

    if (cell.mine) {
      cell.revealed = true;
      ms.lost = true;
      this._renderMS();
      this.gameOver(ms.score);
      return;
    }

    // Flood fill
    var stack = [[r, c]];
    while (stack.length > 0) {
      var pos = stack.pop();
      var pr = pos[0], pc = pos[1];
      var b = ms.board[pr] && ms.board[pr][pc];
      if (!b || b.revealed || b.flagged || b.mine) continue;
      b.revealed = true;
      ms.revealed++;
      ms.score += 5;
      if (b.adjacent === 0) {
        for (var d = 0; d < ms.dirs.length; d++) {
          var nr = pr + ms.dirs[d][0], nc = pc + ms.dirs[d][1];
          if (nr >= 0 && nr < ms.rows && nc >= 0 && nc < ms.cols) {
            stack.push([nr, nc]);
          }
        }
      }
    }

    this.updateScoreDisplay(ms.score);

    var safe = ms.rows * ms.cols - ms.mines;
    if (ms.revealed >= safe) {
      ms.won = true;
      ms.score += 200;
      this.updateScoreDisplay(ms.score);
      this._renderMS();
      this.gameOver(ms.score);
      return;
    }
    this._renderMS();
  };

  proto.msFlag = function (r, c) {
    if (!this.isPlaying) return;
    var ms = this._ms;
    var cell = ms.board[r][c];
    if (ms.lost || ms.won || cell.revealed) return;
    cell.flagged = !cell.flagged;
    ms.flagged += cell.flagged ? 1 : -1;
    this._renderMS();
  };

  /* ============================================================
     12. COLOR GUESS
  ============================================================ */
  proto.initColorGuess = function () {
    var canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    this._cg = { score: 0, round: 0, totalRounds: 10 };
    this._cgNextRound();
  };

  proto._cgNextRound = function () {
    var ui = document.getElementById('game-ui');
    if (!ui) return;
    var cg = this._cg;
    var self = this;

    if (cg.round >= cg.totalRounds) {
      this.gameOver(cg.score);
      return;
    }
    cg.round++;

    var randColor = function () {
      return {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256)
      };
    };

    var toHex = function (col) {
      var rh = col.r.toString(16); if (rh.length < 2) rh = '0' + rh;
      var gh = col.g.toString(16); if (gh.length < 2) gh = '0' + gh;
      var bh = col.b.toString(16); if (bh.length < 2) bh = '0' + bh;
      return '#' + rh.toUpperCase() + gh.toUpperCase() + bh.toUpperCase();
    };

    var correct = randColor();
    var options = [correct];
    while (options.length < 4) {
      var col = randColor();
      var dup = false;
      for (var i = 0; i < options.length; i++) {
        if (options[i].r === col.r && options[i].g === col.g && options[i].b === col.b) {
          dup = true; break;
        }
      }
      if (!dup) options.push(col);
    }

    // Shuffle options
    for (var s = options.length - 1; s > 0; s--) {
      var si = Math.floor(Math.random() * (s + 1));
      var st = options[s]; options[s] = options[si]; options[si] = st;
    }

    var correctIdx = -1;
    for (var f = 0; f < options.length; f++) {
      if (options[f].r === correct.r && options[f].g === correct.g && options[f].b === correct.b) {
        correctIdx = f; break;
      }
    }

    var swatchesHTML = '';
    for (var sw = 0; sw < options.length; sw++) {
      var o = options[sw];
      swatchesHTML +=
        '<div class="cg-swatch" data-cg-idx="' + sw + '" ' +
        'style="background:rgb(' + o.r + ',' + o.g + ',' + o.b + ');"></div>';
    }

    ui.innerHTML =
      '<div class="cg-container">' +
        '<div style="text-align:center;margin-bottom:6px;font-size:0.8rem;' +
            'color:var(--text-muted);font-weight:600;">' +
          'Round ' + cg.round + '/' + cg.totalRounds + ' - Which color matches this HEX?' +
        '</div>' +
        '<div class="cg-code">' + toHex(correct) + '</div>' +
        '<div class="cg-swatches">' + swatchesHTML + '</div>' +
        '<div id="cg-msg" style="text-align:center;min-height:24px;"></div>' +
        '<div style="text-align:center;margin-top:8px;font-size:0.82rem;color:var(--text-muted);">' +
          'Score: <strong>' + cg.score + '</strong>' +
        '</div>' +
      '</div>';

    // Attach click handlers
    var swatches = ui.querySelectorAll('.cg-swatch');
    var answered = false;
    for (var h = 0; h < swatches.length; h++) {
      (function (el) {
        el.addEventListener('click', function () {
          if (answered || !self.isPlaying) return;
          answered = true;
          var idx = parseInt(el.getAttribute('data-cg-idx'), 10);

          // Disable all
          for (var d = 0; d < swatches.length; d++) {
            swatches[d].style.pointerEvents = 'none';
          }

          var msg = document.getElementById('cg-msg');
          if (idx === correctIdx) {
            cg.score += 10;
            self.updateScoreDisplay(cg.score);
            if (msg) msg.innerHTML =
              '<span style="color:var(--success);font-weight:700;">' +
                '<i data-lucide="check" style="width:14px;height:14px;vertical-align:middle;"></i> Correct! +10' +
              '</span>';
          } else {
            if (msg) msg.innerHTML =
              '<span style="color:var(--danger);font-weight:700;">' +
                '<i data-lucide="x" style="width:14px;height:14px;vertical-align:middle;"></i> Wrong!' +
              '</span>';
            if (swatches[correctIdx]) {
              swatches[correctIdx].style.outline = '4px solid var(--success)';
              swatches[correctIdx].style.outlineOffset = '2px';
            }
          }
          if (typeof lucide !== 'undefined') lucide.createIcons();

          setTimeout(function () { self._cgNextRound(); }, 1200);
        });
      })(swatches[h]);
    }
  };

  return GM;
})(); // end GamesManager IIFE


/* ============================================================
   GAME STYLES
   ============================================================ */
var gamesStyles = '' +
  /* Card */
  '.game-card{display:flex;align-items:center;gap:16px;padding:20px;cursor:pointer;transition:all 0.22s ease;}' +
  '.game-card:hover{transform:translateY(-4px) scale(1.01);}' +
  '.game-card-icon{width:60px;height:60px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.22s ease;box-shadow:var(--neu-shadow-sm);}' +
  '.game-card:hover .game-card-icon{background:var(--accent)!important;}' +
  '.game-card:hover .game-card-icon svg,.game-card:hover .game-card-icon i{color:#fff!important;}' +
  '.game-card-info{flex:1;}' +
  '.game-card-title{font-size:1rem;font-weight:700;color:var(--text-heading);margin-bottom:4px;}' +
  '.game-card-desc{font-size:0.8rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;}' +
  '.game-card-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
  '.game-difficulty,.game-category,.game-high-score{padding:2px 10px;border-radius:999px;font-size:0.68rem;font-weight:700;}' +
  '.game-difficulty-easy{background:var(--success-light);color:var(--success);}' +
  '.game-difficulty-medium{background:var(--warning-light);color:var(--warning);}' +
  '.game-difficulty-hard{background:var(--danger-light);color:var(--danger);}' +
  '.game-category{background:var(--bg-secondary);color:var(--text-muted);}' +
  '.game-high-score{background:var(--accent-light);color:var(--accent);display:flex;align-items:center;gap:4px;}' +
  '.game-card-play{width:40px;height:40px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent);transition:all 0.22s ease;}' +
  '.game-card:hover .game-card-play{background:var(--accent);color:#fff;transform:scale(1.15);}' +
  /* Header */
  '.game-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap;}' +
  '.game-title-area{display:flex;align-items:center;gap:10px;}' +
  '.game-title-area h2{font-size:1.1rem;font-weight:700;color:var(--text-heading);display:flex;align-items:center;gap:8px;}' +
  '.game-title-area h2 svg,.game-title-area h2 i{width:22px;height:22px;color:var(--accent);}' +
  '.game-score-area{display:flex;flex-direction:column;align-items:center;padding:8px 20px;background:var(--bg-card);border-radius:8px;box-shadow:var(--neu-shadow-sm);}' +
  '.game-score-label{font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;}' +
  '.game-score-value{font-size:1.6rem;font-weight:800;color:var(--accent);line-height:1;}' +
  /* Container */
  '.game-container{position:relative;background:var(--bg-card);border-radius:12px;overflow:hidden;min-height:300px;box-shadow:var(--neu-shadow);}' +
  '.game-container canvas{display:block;width:100%;}' +
  '.game-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:10;}' +
  '.game-overlay-content{text-align:center;color:#fff;display:flex;flex-direction:column;align-items:center;gap:16px;}' +
  '.game-overlay-content h3{font-size:1.6rem;font-weight:800;}' +
  '.game-overlay-content p{font-size:0.9rem;opacity:0.8;max-width:300px;line-height:1.6;}' +
  '.game-ui{padding:16px;min-height:300px;}' +
  /* Memory */
  '.memory-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:360px;margin:0 auto;}' +
  '.memory-card{aspect-ratio:1;cursor:pointer;perspective:600px;}' +
  '.memory-card-inner{width:100%;height:100%;transition:transform 0.45s;transform-style:preserve-3d;position:relative;}' +
  '.memory-card.flipped .memory-card-inner{transform:rotateY(180deg);}' +
  '.memory-card-front,.memory-card-back{position:absolute;inset:0;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;border-radius:8px;box-shadow:var(--neu-shadow-sm);}' +
  '.memory-card-front{background:var(--accent-light);color:var(--accent);}' +
  '.memory-card-front i,.memory-card-front svg{width:24px;height:24px;}' +
  '.memory-card-back{background:var(--bg-card);transform:rotateY(180deg);color:var(--accent);}' +
  '.memory-card-back i,.memory-card-back svg{width:28px;height:28px;}' +
  '.memory-card.matched .memory-card-back{background:var(--success-light);color:var(--success);}' +
  /* Quiz */
  '.quiz-container{max-width:500px;margin:0 auto;}' +
  '.quiz-progress{height:4px;background:var(--bg-secondary);border-radius:999px;margin-bottom:16px;overflow:hidden;}' +
  '.quiz-progress-bar{height:100%;background:var(--accent);border-radius:999px;transition:width 0.4s ease;}' +
  '.quiz-counter{font-size:0.78rem;color:var(--text-muted);margin-bottom:16px;text-align:center;font-weight:600;}' +
  '.quiz-question{font-size:1.05rem;font-weight:700;color:var(--text-heading);margin-bottom:20px;line-height:1.5;text-align:center;}' +
  '.quiz-options{display:flex;flex-direction:column;gap:10px;}' +
  '.quiz-option{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:8px;background:var(--bg-card);border:2px solid transparent;cursor:pointer;transition:0.2s;text-align:left;width:100%;font-family:inherit;font-size:0.88rem;color:var(--text-primary);box-shadow:var(--neu-shadow-sm);}' +
  '.quiz-option:hover:not(:disabled){border-color:var(--accent);transform:translateX(4px);}' +
  '.quiz-option.quiz-correct{border-color:var(--success);background:var(--success-light);color:var(--success);}' +
  '.quiz-option.quiz-wrong{border-color:var(--danger);background:var(--danger-light);color:var(--danger);}' +
  '.quiz-option-letter{width:28px;height:28px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.82rem;flex-shrink:0;}' +
  '.quiz-option-text{flex:1;}' +
  '.quiz-explanation{margin-top:16px;padding:12px;border-radius:8px;background:var(--bg-secondary);display:flex;align-items:flex-start;gap:10px;font-size:0.82rem;color:var(--text-secondary);animation:qFadeIn 0.3s ease;}' +
  '@keyframes qFadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
  /* TTT */
  '.ttt-container{max-width:320px;margin:0 auto;text-align:center;}' +
  '.ttt-scoreboard{display:flex;justify-content:space-around;margin-bottom:12px;font-size:0.88rem;font-weight:700;}' +
  '.ttt-status{font-size:0.9rem;font-weight:600;color:var(--text-heading);margin-bottom:16px;}' +
  '.ttt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}' +
  '.ttt-cell{aspect-ratio:1;border-radius:8px;background:var(--bg-card);border:2px solid transparent;cursor:pointer;transition:0.2s;display:flex;align-items:center;justify-content:center;font-family:inherit;box-shadow:var(--neu-shadow-sm);}' +
  '.ttt-cell:hover:not(:disabled){border-color:var(--accent);transform:scale(1.05);}' +
  '.ttt-x{color:var(--accent);}' +
  '.ttt-o{color:var(--danger);}' +
  /* Typing */
  '.typing-container{max-width:550px;margin:0 auto;}' +
  '.typing-target{padding:20px;background:var(--bg-secondary);border-radius:8px;font-size:1rem;line-height:1.8;color:var(--text-secondary);letter-spacing:0.02em;min-height:80px;box-shadow:var(--neu-inset);}' +
  '.typing-stats{display:flex;justify-content:center;gap:24px;margin-top:16px;font-size:0.88rem;color:var(--text-secondary);flex-wrap:wrap;}' +
  '.typing-stats strong{color:var(--accent);font-weight:800;}' +
  /* Wordle */
  '.wordle-container{max-width:340px;margin:0 auto;}' +
  '.wordle-grid{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}' +
  '.wordle-row{display:flex;gap:6px;justify-content:center;}' +
  '.wordle-cell{width:54px;height:54px;border:2px solid var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;text-transform:uppercase;transition:0.25s;color:var(--text-heading);background:var(--bg-card);}' +
  '.wc-active{border-color:var(--accent);transform:scale(1.05);}' +
  '.wc-correct{background:#538d4e;border-color:#538d4e;color:#fff;}' +
  '.wc-present{background:#b59f3b;border-color:#b59f3b;color:#fff;}' +
  '.wc-absent{background:#3a3a3c;border-color:#3a3a3c;color:#fff;}' +
  '.wordle-keyboard{display:flex;flex-direction:column;gap:6px;align-items:center;}' +
  '.wordle-kb-row{display:flex;gap:4px;}' +
  '.wordle-key{min-width:32px;height:46px;border-radius:5px;border:none;cursor:pointer;font-weight:700;font-size:0.82rem;background:var(--bg-secondary);color:var(--text-heading);transition:0.15s;font-family:inherit;}' +
  '.wordle-key:hover{opacity:0.8;}' +
  '.wk-wide{min-width:54px;font-size:0.72rem;}' +
  '.wk-correct{background:#538d4e!important;color:#fff!important;}' +
  '.wk-present{background:#b59f3b!important;color:#fff!important;}' +
  '.wk-absent{background:#3a3a3c!important;color:#fff!important;}' +
  '.wordle-msg{text-align:center;padding:10px;border-radius:8px;margin-bottom:10px;font-size:0.88rem;font-weight:600;}' +
  '.wm-success{background:var(--success-light);color:var(--success);}' +
  '.wm-danger{background:var(--danger-light);color:var(--danger);}' +
  '@keyframes wShake{0%,100%{transform:translateX(0);}20%{transform:translateX(-6px);}40%{transform:translateX(6px);}60%{transform:translateX(-4px);}80%{transform:translateX(4px);}}' +
  '.wordle-shake{animation:wShake 0.45s ease;}' +
  /* 2048 */
  '.g2048-container{max-width:380px;margin:0 auto;}' +
  '.g2048-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#bbada0;padding:8px;border-radius:8px;}' +
  '.g2048-cell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;transition:0.1s;}' +
  '.g2048-btn{width:52px;height:52px;border-radius:8px;border:none;cursor:pointer;background:var(--accent-light);color:var(--accent);font-size:1.4rem;font-weight:700;transition:0.15s;font-family:inherit;}' +
  '.g2048-btn:hover{background:var(--accent);color:#fff;}' +
  /* Minesweeper */
  '.ms-container{max-width:380px;margin:0 auto;}' +
  '.ms-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-weight:700;font-size:0.82rem;color:var(--text-heading);}' +
  '.ms-header i,.ms-header svg{vertical-align:middle;}' +
  '.ms-grid{display:grid;gap:2px;background:var(--bg-secondary);padding:2px;border-radius:4px;}' +
  '.ms-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;cursor:pointer;border-radius:3px;user-select:none;min-width:32px;}' +
  '.ms-hidden{background:var(--bg-card);transition:0.1s;}' +
  '.ms-hidden:hover{background:var(--accent-light);}' +
  '.ms-revealed{background:var(--bg-secondary);}' +
  '.ms-mine{background:var(--danger-light);}' +
  '.ms-flagged{background:var(--warning-light);cursor:pointer;}' +
  /* Color Guess */
  '.cg-container{max-width:360px;margin:0 auto;text-align:center;}' +
  '.cg-code{font-size:1.8rem;font-weight:800;letter-spacing:0.1em;color:var(--text-heading);margin:16px 0;font-family:monospace;}' +
  '.cg-swatches{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;max-width:280px;margin:0 auto 16px;}' +
  '.cg-swatch{aspect-ratio:1;border-radius:12px;cursor:pointer;transition:0.15s;box-shadow:0 4px 12px rgba(0,0,0,0.2);}' +
  '.cg-swatch:hover{transform:scale(1.06);box-shadow:0 6px 20px rgba(0,0,0,0.3);}' +
  /* Responsive */
  '@media(max-width:480px){' +
    '.memory-grid{gap:6px;}' +
    '.game-header{flex-direction:column;align-items:flex-start;}' +
    '.game-score-area{flex-direction:row;gap:8px;width:100%;justify-content:center;}' +
    '.typing-stats{flex-direction:column;gap:8px;align-items:center;}' +
    '.wordle-cell{width:46px;height:46px;font-size:1.1rem;}' +
    '.ms-cell{min-width:28px;font-size:0.65rem;}' +
    '.ttt-cell{min-height:70px;}' +
  '}';

/* ============================================================
   INJECT STYLES
   ============================================================ */
(function () {
  if (!document.getElementById('games-module-styles')) {
    var style = document.createElement('style');
    style.id = 'games-module-styles';
    style.textContent = gamesStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INIT
   ============================================================ */
var gamesManager;

document.addEventListener('DOMContentLoaded', function () {
  var grid = document.getElementById('games-grid');
  var playArea = document.getElementById('game-play-area');
  if (grid || playArea) {
    gamesManager = new GamesManager();
    window.gamesManager = gamesManager;
  }
});

} // end if guard: _GAMES_JS_LOADED

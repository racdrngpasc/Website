/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Games Module - js/games.js
   12+ Interactive games for members and visitors
   ============================================================ */

'use strict';

/* ============================================================
   GAMES CONFIGURATION
   ============================================================ */
const GAMES_CONFIG = [
  {
    id: 'snake',
    name: 'Snake',
    description: 'Classic snake game! Eat food to grow longer without hitting walls or yourself.',
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
    description: 'Classic Tic Tac Toe against an AI opponent. Get three in a row to win!',
    icon: 'grid',
    difficulty: 'Easy',
    category: 'Strategy'
  },
  {
    id: 'typing',
    name: 'Speed Typing',
    description: 'Type the given text as fast and accurately as possible. Improve your WPM!',
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
    description: 'Guess the 5-letter Rotary/service themed word in 6 tries!',
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
    description: 'Identify the correct color from its RGB or HEX value. Train your eye!',
    icon: 'droplet',
    difficulty: 'Easy',
    category: 'Skill'
  }
];

/* ============================================================
   QUIZ QUESTIONS
   ============================================================ */
const QUIZ_QUESTIONS = [
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
    explanation: 'Rotaract was founded in 1968 by Rotary International to provide opportunities for young adults aged 18-30.'
  },
  {
    question: 'What is the age group for Rotaract Club membership?',
    options: ['14–18', '18–30', '21–35', '16–24'],
    answer: 1,
    explanation: 'Rotaract Club membership is open to young adults aged 18 to 30 years.'
  },
  {
    question: 'What is the motto of Rotary International?',
    options: [
      'Service Above Self',
      'Serve to Lead',
      'Together We Serve',
      'Act with Integrity'
    ],
    answer: 0,
    explanation: '"Service Above Self" is the official motto of Rotary International, reflecting the spirit of selfless service.'
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
    explanation: 'The four avenues of Rotary service are: Club Service, Community Service, Vocational Service, and International Service.'
  },
  {
    question: 'How many areas of focus does Rotary International have?',
    options: ['4', '6', '7', '5'],
    answer: 2,
    explanation: 'Rotary International has 7 areas of focus: peace, disease prevention, water, maternal health, basic education, economic development, and environment.'
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
    explanation: 'The Four-Way Test asks: Is it the TRUTH? Is it FAIR to all concerned? Will it build GOODWILL and BETTER FRIENDSHIPS? Will it be BENEFICIAL to all concerned?'
  },
  {
    question: 'What color is primarily associated with Rotary International?',
    options: ['Blue', 'Gold', 'Royal Blue and Gold', 'Red and White'],
    answer: 2,
    explanation: 'The official Rotary colors are Royal Blue and Gold, representing strength and excellence.'
  },
  {
    question: 'Where is Rotary International headquartered?',
    options: ['Washington D.C.', 'Geneva', 'Evanston, Illinois', 'London'],
    answer: 2,
    explanation: 'Rotary International is headquartered in Evanston, Illinois, USA.'
  },
  {
    question: 'What is the Rotaract Club project theme for Dr. NGP Arts & Science College focused on?',
    options: ['Community Service', 'Sports', 'Politics', 'Fashion'],
    answer: 0,
    explanation: 'Rotaract Clubs primarily focus on community service, professional development, and international understanding.'
  },
  {
    question: 'Which prestigious Rotary scholarship provides opportunities for peace studies?',
    options: ['Fulbright', 'Rotary Peace Fellowship', 'Rhodes Scholarship', 'Chevening'],
    answer: 1,
    explanation: 'The Rotary Peace Fellowship supports individuals dedicated to promoting peace and conflict resolution worldwide.'
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
    explanation: 'The gear-wheel logo of Rotary symbolizes work, movement, and progress — achieved through collective service.'
  },
  {
    question: 'Rotary\'s PolioPlus program aims to:',
    options: [
      'Eradicate polio globally',
      'Build hospitals',
      'Train doctors',
      'Provide vaccines only in India'
    ],
    answer: 0,
    explanation: 'PolioPlus is Rotary\'s flagship program to eradicate polio worldwide, and has helped reduce cases by over 99.9%.'
  },
  {
    question: 'What is the name of Rotary\'s humanitarian arm?',
    options: ['Rotary Fund', 'Rotary Foundation', 'Rotary Trust', 'Rotary Aid'],
    answer: 1,
    explanation: 'The Rotary Foundation is the charitable arm of Rotary International, funding projects and scholarships worldwide.'
  }
];

/* ============================================================
   TYPING QUOTES
   ============================================================ */
const TYPING_QUOTES = [
  'Service above self is the motto that drives every Rotaract member to make a positive difference in the world.',
  'The best way to find yourself is to lose yourself in the service of others. Rotaract lives by this ideal every day.',
  'Together we can create a world where every child has access to clean water, education, and a life free from disease.',
  'Leadership is not about being in charge. It is about taking care of those in your charge through dedicated service.',
  'Rotaract brings young people together to create lasting change through fellowship, professional development, and service.',
  'One act of kindness can spark a thousand more. Let us light the way for our community through action and compassion.',
  'The strength of a club lies not in its numbers but in the commitment of every single member to serve with heart.',
  'Education is the most powerful weapon which you can use to change the world and lift communities out of poverty.',
  'Small acts performed with great love can transform neighborhoods, cities, and ultimately the entire world we live in.',
  'Community service is not just a program. It is a way of life that defines who we are as Rotaractors.'
];

/* ============================================================
   STORAGE HELPER (if not defined elsewhere)
   ============================================================ */
const Storage = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* silent */ }
  }
};

/* ============================================================
   WORDLE WORDS (5-letter Rotary/service themed)
   ============================================================ */
const WORDLE_WORDS = [
  'SERVE', 'PEACE', 'UNITE', 'SHARE', 'LEADS', 'TRUST',
  'GROWN', 'HELPS', 'YOUTH', 'CLUBS', 'GRANT', 'GLOBE',
  'SMILE', 'LIGHT', 'BRAVE', 'FUNDS', 'WORKS', 'HANDS',
  'SKILL', 'TEAMS', 'BUILD', 'PROUD', 'FAITH', 'DREAM'
];

/* ============================================================
   SUPABASE HELPER (fallback if not defined)
   ============================================================ */
function getSupabaseClient() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    try {
      return supabase.createClient(
        window.SUPABASE_URL || '',
        window.SUPABASE_KEY || ''
      );
    } catch { /* silent */ }
  }
  // Return a mock client that silently ignores all calls
  return {
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      select: () => Promise.resolve({ data: [], error: null })
    })
  };
}

/* ============================================================
   GAMES MANAGER CLASS
   ============================================================ */
class GamesManager {
  constructor() {
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

    this.init();
  }

  /* ============================================================
     INITIALIZATION
     ============================================================ */
  init() {
    this.loadHighScores();
    this.renderGamesList();
    this.setupThemeToggle();
  }

  setupThemeToggle() {
    const toggle = document.getElementById('games-theme-toggle');
    if (toggle) {
      const currentTheme = Storage.get('theme') || 'light';
      document.documentElement.setAttribute('data-theme', currentTheme);
      toggle.addEventListener('click', () => {
        const newTheme =
          document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'light'
            : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        Storage.set('theme', newTheme);
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    }
  }

  /* ============================================================
     RENDER GAMES LIST
     ============================================================ */
  renderGamesList() {
    const container = document.getElementById('games-grid');
    if (!container) return;

    container.innerHTML = GAMES_CONFIG.map(game => {
      const highScore = this.highScores[game.id] || 0;
      return `
        <div class="game-card neu-card" data-game-id="${game.id}"
             onclick="gamesManager.openGame('${game.id}')">
          <div class="game-card-icon" style="background:var(--accent-light);">
            <i data-lucide="${game.icon}" style="width:32px;height:32px;color:var(--accent);"></i>
          </div>
          <div class="game-card-info">
            <h3 class="game-card-title">${game.name}</h3>
            <p class="game-card-desc">${game.description}</p>
            <div class="game-card-meta">
              <span class="game-difficulty game-difficulty-${game.difficulty.toLowerCase()}">
                ${game.difficulty}
              </span>
              <span class="game-category">${game.category}</span>
              ${highScore > 0
                ? `<span class="game-high-score">
                    <i data-lucide="trophy" style="width:12px;height:12px;"></i>
                    ${highScore}
                   </span>`
                : ''
              }
            </div>
          </div>
          <div class="game-card-play">
            <i data-lucide="play" style="width:20px;height:20px;"></i>
          </div>
        </div>
      `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  /* ============================================================
     OPEN GAME
     ============================================================ */
  openGame(gameId) {
    this.stopCurrentGame();
    this.currentGame = gameId;
    this.score = 0;

    const container = document.getElementById('game-play-area');
    const listArea = document.getElementById('games-list-area');

    if (listArea) listArea.style.display = 'none';
    if (container) container.style.display = 'block';

    const game = GAMES_CONFIG.find(g => g.id === gameId);
    if (!game) return;

    container.innerHTML = `
      <div class="game-header">
        <button class="btn btn-outline btn-sm" onclick="gamesManager.backToList()">
          <i data-lucide="arrow-left"></i>
          <span>Back</span>
        </button>
        <div class="game-title-area">
          <h2>
            <i data-lucide="${game.icon}"></i>
            ${game.name}
          </h2>
          <span class="game-difficulty game-difficulty-${game.difficulty.toLowerCase()}">
            ${game.difficulty}
          </span>
        </div>
        <div class="game-score-area">
          <span class="game-score-label">Score</span>
          <span class="game-score-value" id="game-score">0</span>
        </div>
      </div>

      <div class="game-container" id="game-container">
        <canvas id="game-canvas" width="480" height="400"
                style="display:block;width:100%;"></canvas>
        <div class="game-overlay" id="game-overlay">
          <div class="game-overlay-content">
            <h3 id="game-overlay-title">${game.name}</h3>
            <p id="game-overlay-text">${game.description}</p>
            <button class="btn btn-primary" id="game-start-btn"
                    onclick="gamesManager.startGame()">
              <i data-lucide="play"></i>
              <span>Start Game</span>
            </button>
          </div>
        </div>
        <div class="game-ui" id="game-ui"></div>
      </div>
    `;

    this.gameCanvas = document.getElementById('game-canvas');
    this.gameCtx = this.gameCanvas ? this.gameCanvas.getContext('2d') : null;
    this.resizeCanvas();

    if (typeof lucide !== 'undefined') lucide.createIcons();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.gameCanvas) return;
    const container = document.getElementById('game-container');
    if (!container) return;
    const maxWidth = Math.min(container.clientWidth - 4, 600);
    const maxHeight = Math.min(window.innerHeight - 260, 500);
    this.gameCanvas.width = maxWidth;
    this.gameCanvas.height = maxHeight;
  }

  backToList() {
    this.stopCurrentGame();
    const container = document.getElementById('game-play-area');
    const listArea = document.getElementById('games-list-area');
    if (container) container.style.display = 'none';
    if (listArea) listArea.style.display = 'block';
    this.currentGame = null;
    this.renderGamesList(); // Refresh high scores shown
  }

  startGame() {
    const overlay = document.getElementById('game-overlay');
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
      default: break;
    }
  }

  stopCurrentGame() {
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
  }

  gameOver(finalScore) {
    this.isPlaying = false;
    this.stopCurrentGame();

    finalScore = Math.round(finalScore);
    this.saveHighScore(this.currentGame, finalScore);
    this.updateScoreDisplay(finalScore);

    const overlay = document.getElementById('game-overlay');
    const title   = document.getElementById('game-overlay-title');
    const text    = document.getElementById('game-overlay-text');
    const btn     = document.getElementById('game-start-btn');

    if (overlay) overlay.style.display = 'flex';
    if (title)   title.textContent = 'Game Over!';
    if (text) {
      const best = this.highScores[this.currentGame] || 0;
      text.textContent = `Your score: ${finalScore}. ${
        best === finalScore ? '🏆 New high score!' : `Best: ${best}`
      }`;
    }
    if (btn) {
      btn.innerHTML = '<i data-lucide="rotate-ccw"></i><span>Play Again</span>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  updateScoreDisplay(score) {
    const el = document.getElementById('game-score');
    if (el) el.textContent = score;
    this.score = score;
  }

  /* ============================================================
     HIGH SCORES
     ============================================================ */
  loadHighScores() {
    this.highScores = Storage.get('game_high_scores') || {};
  }

  saveHighScore(gameId, score) {
    if (!gameId) return;
    if (!this.highScores[gameId] || score > this.highScores[gameId]) {
      this.highScores[gameId] = score;
      Storage.set('game_high_scores', this.highScores);
      try {
        this.db.from('game_scores').insert({
          player_name: 'Guest',
          game_id: gameId,
          game_name: GAMES_CONFIG.find(g => g.id === gameId)?.name || gameId,
          score
        });
      } catch (e) { /* silent */ }
    }
  }

  /* ============================================================
     COLOR HELPER
     ============================================================ */
  getColor(name) {
    const isDark =
      document.documentElement.getAttribute('data-theme') === 'dark';
    const colors = {
      bg:        isDark ? '#1A1B26' : '#E8E8E8',
      primary:   isDark ? '#4DEEEA' : '#0055FF',
      text:      isDark ? '#EAEFFB' : '#3A3A3A',
      secondary: isDark ? '#35374E' : '#BEBEBE',
      danger:    '#E53E3E',
      success:   '#38A169',
      warning:   '#D69E2E',
      white:     '#FFFFFF',
      dark:      '#222222',
      accent:    isDark ? '#4DEEEA' : '#0055FF'
    };
    return colors[name] || colors.primary;
  }

  /* =============================================================
     1. SNAKE GAME
     ============================================================= */
  initSnake() {
    const canvas = this.gameCanvas;
    const ctx    = this.gameCtx;
    if (!canvas || !ctx) return;

    // Hide the UI div — canvas is used
    const ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    const gridSize = 20;
    const cols = Math.floor(canvas.width  / gridSize);
    const rows = Math.floor(canvas.height / gridSize);

    let snake     = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    let direction = { x: 1, y: 0 };
    let nextDir   = { x: 1, y: 0 };
    let food      = this.randomPosition(cols, rows, snake);
    let score     = 0;
    let speed     = 120;

    this._keyHandler = (e) => {
      switch (e.key) {
        case 'ArrowUp':
          if (direction.y !== 1)  nextDir = { x: 0, y: -1 };
          e.preventDefault(); break;
        case 'ArrowDown':
          if (direction.y !== -1) nextDir = { x: 0, y:  1 };
          e.preventDefault(); break;
        case 'ArrowLeft':
          if (direction.x !== 1)  nextDir = { x: -1, y: 0 };
          e.preventDefault(); break;
        case 'ArrowRight':
          if (direction.x !== -1) nextDir = { x:  1, y: 0 };
          e.preventDefault(); break;
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    this.setupTouchControls(canvas, (dir) => {
      if (dir === 'up'    && direction.y !== 1)  nextDir = { x: 0,  y: -1 };
      if (dir === 'down'  && direction.y !== -1) nextDir = { x: 0,  y:  1 };
      if (dir === 'left'  && direction.x !== 1)  nextDir = { x: -1, y:  0 };
      if (dir === 'right' && direction.x !== -1) nextDir = { x:  1, y:  0 };
    });

    const drawFrame = () => {
      direction = { ...nextDir };
      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

      if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        this.gameOver(score); return;
      }
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        this.gameOver(score); return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        this.updateScoreDisplay(score);
        food = this.randomPosition(cols, rows, snake);
        if (speed > 60) {
          speed -= 3;
          clearInterval(this.gameInterval);
          this.gameInterval = setInterval(drawFrame, speed);
        }
      } else {
        snake.pop();
      }

      // Background
      ctx.fillStyle = this.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines (subtle)
      ctx.strokeStyle = this.getColor('secondary') + '20';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvas.width, i * gridSize);
        ctx.stroke();
      }

      // Food
      ctx.fillStyle = this.getColor('danger');
      ctx.beginPath();
      ctx.arc(
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        gridSize / 2 - 2, 0, Math.PI * 2
      );
      ctx.fill();

      // Snake body
      snake.forEach((seg, i) => {
        const ratio = 1 - (i / snake.length) * 0.5;
        ctx.fillStyle = i === 0
          ? this.getColor('primary')
          : this.getColor('primary') +
            Math.round(ratio * 200).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.roundRect(
          seg.x * gridSize + 1,
          seg.y * gridSize + 1,
          gridSize - 2,
          gridSize - 2,
          4
        );
        ctx.fill();

        // Head eye
        if (i === 0) {
          ctx.fillStyle = this.getColor('bg');
          ctx.beginPath();
          ctx.arc(
            seg.x * gridSize + gridSize / 2 + direction.x * 4,
            seg.y * gridSize + gridSize / 2 + direction.y * 4,
            3, 0, Math.PI * 2
          );
          ctx.fill();
        }
      });

      // Score overlay
      ctx.fillStyle = this.getColor('text') + 'CC';
      ctx.font = 'bold 14px Poppins, sans-serif';
      ctx.fillText(`Score: ${score}`, 10, 20);
    };

    this.gameInterval = setInterval(drawFrame, speed);
  }

  /* =============================================================
     2. MEMORY MATCH GAME  (fully rewritten — no closure bugs)
     ============================================================= */
  initMemory() {
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    const allSymbols = [
      'heart','star','globe','shield','award','users',
      'sun','moon','zap','coffee','book','flag',
      'music','camera','compass','bell'
    ];
    const chosen = allSymbols.slice(0, 8);
    // Store everything on `this` so event handlers always see current state
    this._mem = {
      cards:   [...chosen, ...chosen].sort(() => Math.random() - 0.5),
      flipped: [],      // indices currently face-up (unmatched)
      matched: new Set(),
      moves:   0,
      score:   0,
      locked:  false    // prevent clicks during flip-back animation
    };

    this._renderMemory(ui);
  }

  _renderMemory(ui) {
    if (!ui) ui = document.getElementById('game-ui');
    if (!ui) return;
    const m = this._mem;
    const totalPairs = m.cards.length / 2;

    ui.innerHTML = `
      <div style="text-align:center;margin-bottom:12px;">
        <span style="font-size:0.82rem;color:var(--text-secondary);">
          Moves: <strong>${m.moves}</strong> &nbsp;|&nbsp;
          Matched: <strong>${m.matched.size / 2}/${totalPairs}</strong>
        </span>
      </div>
      <div class="memory-grid">
        ${m.cards.map((symbol, i) => {
          const isFlipped  = m.flipped.includes(i) || m.matched.has(i);
          const isMatched  = m.matched.has(i);
          return `
            <div class="memory-card ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''}"
                 onclick="gamesManager.flipMemoryCard(${i})">
              <div class="memory-card-inner">
                <div class="memory-card-front">
                  <i data-lucide="help-circle"></i>
                </div>
                <div class="memory-card-back">
                  <i data-lucide="${symbol}"></i>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  flipMemoryCard(index) {
    if (!this.isPlaying) return;
    const m   = this._mem;
    const ui  = document.getElementById('game-ui');
    if (!m || !ui) return;
    if (m.locked)              return;   // mid-animation
    if (m.matched.has(index))  return;   // already matched
    if (m.flipped.includes(index)) return; // already showing

    m.flipped.push(index);
    this._renderMemory(ui);

    if (m.flipped.length === 2) {
      m.moves++;
      m.locked = true;
      const [a, b] = m.flipped;

      if (m.cards[a] === m.cards[b]) {
        // Match!
        m.matched.add(a);
        m.matched.add(b);
        m.score += 20;
        this.updateScoreDisplay(m.score);
        m.flipped = [];
        m.locked  = false;
        this._renderMemory(ui);

        if (m.matched.size === m.cards.length) {
          const bonus = Math.max(0, 200 - m.moves * 5);
          m.score += bonus;
          this.updateScoreDisplay(m.score);
          setTimeout(() => this.gameOver(m.score), 600);
        }
      } else {
        // No match — flip back after delay
        setTimeout(() => {
          m.flipped = [];
          m.locked  = false;
          this._renderMemory(ui);
        }, 900);
      }
    }
  }

  /* =============================================================
     3. QUIZ GAME  (fully rewritten — no closure bugs)
     ============================================================= */
  initQuiz() {
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    // Shuffle & store on `this`
    this._quiz = {
      questions: [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5),
      current:   0,
      score:     0,
      answered:  false
    };

    this._renderQuiz();
  }

  _renderQuiz() {
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    const q = this._quiz;

    if (q.current >= q.questions.length) {
      this.gameOver(q.score);
      return;
    }

    const question = q.questions[q.current];
    const progress = ((q.current) / q.questions.length) * 100;

    ui.innerHTML = `
      <div class="quiz-container">
        <div class="quiz-progress">
          <div class="quiz-progress-bar" style="width:${progress}%;"></div>
        </div>
        <div class="quiz-counter">
          Question ${q.current + 1} of ${q.questions.length}
        </div>
        <h3 class="quiz-question">${question.question}</h3>
        <div class="quiz-options" id="quiz-options">
          ${question.options.map((opt, i) => `
            <button class="quiz-option" data-index="${i}"
                    onclick="gamesManager.answerQuiz(${i})">
              <span class="quiz-option-letter">${String.fromCharCode(65 + i)}</span>
              <span class="quiz-option-text">${opt}</span>
            </button>
          `).join('')}
        </div>
        <div id="quiz-explanation-area"></div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  answerQuiz(optionIndex) {
    if (!this.isPlaying) return;
    const q = this._quiz;
    if (q.answered) return;  // Prevent double-click
    q.answered = true;

    const question   = q.questions[q.current];
    const isCorrect  = optionIndex === question.answer;

    // Disable all buttons and highlight
    const buttons = document.querySelectorAll('.quiz-option');
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      btn.onclick  = null;
      if (i === question.answer)                  btn.classList.add('quiz-correct');
      if (i === optionIndex && !isCorrect)        btn.classList.add('quiz-wrong');
    });

    if (isCorrect) {
      q.score += 10;
      this.updateScoreDisplay(q.score);
    }

    // Show explanation
    const expArea = document.getElementById('quiz-explanation-area');
    if (expArea && question.explanation) {
      expArea.innerHTML = `
        <div class="quiz-explanation">
          <i data-lucide="${isCorrect ? 'check-circle' : 'x-circle'}"
             style="width:18px;height:18px;flex-shrink:0;
                    color:${isCorrect ? 'var(--success)' : 'var(--danger)'};"></i>
          <span>${question.explanation}</span>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Move to next question after delay
    setTimeout(() => {
      q.current++;
      q.answered = false;
      this._renderQuiz();
    }, 2200);
  }

  /* =============================================================
     4. TIC TAC TOE
     ============================================================= */
  initTicTacToe() {
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    this._ttt = {
      board:       Array(9).fill(null),
      playerTurn:  true,
      active:      true,
      score:       0,
      wins:        0,
      losses:      0,
      draws:       0
    };

    this._renderTTT();
  }

  _tttCheckWin(board, player) {
    const patterns = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    return patterns.find(p => p.every(i => board[i] === player)) || null;
  }

  _tttAiMove(board) {
    const patterns = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    // Win
    for (const p of patterns) {
      const vals = p.map(i => board[i]);
      if (vals.filter(v => v === 'O').length === 2 && vals.includes(null))
        return p[vals.indexOf(null)];
    }
    // Block
    for (const p of patterns) {
      const vals = p.map(i => board[i]);
      if (vals.filter(v => v === 'X').length === 2 && vals.includes(null))
        return p[vals.indexOf(null)];
    }
    if (board[4] === null) return 4;
    const corners = [0, 2, 6, 8].filter(i => board[i] === null);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    const empty = board.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    return empty.length ? empty[Math.floor(Math.random() * empty.length)] : -1;
  }

  _renderTTT() {
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    const t = this._ttt;

    let statusMsg = '';
    if (!t.active) statusMsg = 'Game ended. Start a new round!';
    else if (t.playerTurn) statusMsg = "Your turn <strong>(X)</strong>";
    else statusMsg = "AI is thinking…";

    ui.innerHTML = `
      <div class="ttt-container">
        <div class="ttt-scoreboard">
          <span style="color:var(--accent);">You: ${t.wins}</span>
          <span style="color:var(--text-muted);">Draw: ${t.draws}</span>
          <span style="color:var(--danger);">AI: ${t.losses}</span>
        </div>
        <div class="ttt-status" id="ttt-status">${statusMsg}</div>
        <div class="ttt-grid">
          ${t.board.map((cell, i) => `
            <button class="ttt-cell ${cell ? 'ttt-filled' : ''}
                           ${cell === 'X' ? 'ttt-x' : cell === 'O' ? 'ttt-o' : ''}"
                    onclick="gamesManager.tttMove(${i})"
                    ${cell || !t.playerTurn || !t.active ? 'disabled' : ''}>
              ${cell
                ? `<i data-lucide="${cell === 'X' ? 'x' : 'circle'}"
                       style="width:32px;height:32px;"></i>`
                : ''
              }
            </button>
          `).join('')}
        </div>
        ${!t.active
          ? `<button class="btn btn-primary" style="margin-top:16px;"
                     onclick="gamesManager.tttNewRound()">
               <i data-lucide="rotate-ccw"></i>
               <span>New Round</span>
             </button>`
          : ''
        }
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  tttMove(index) {
    if (!this.isPlaying) return;
    const t = this._ttt;
    if (!t.active || !t.playerTurn || t.board[index] !== null) return;

    t.board[index] = 'X';
    t.playerTurn   = false;
    this._renderTTT();

    // Check player win
    if (this._tttCheckWin(t.board, 'X')) {
      t.active = false;
      t.wins++;
      t.score += 30;
      this.updateScoreDisplay(t.score);
      this._showTTTResult('You Win! 🎉');
      return;
    }
    // Check draw
    if (t.board.every(c => c !== null)) {
      t.active = false;
      t.draws++;
      t.score += 10;
      this.updateScoreDisplay(t.score);
      this._showTTTResult("It's a Draw!");
      return;
    }

    // AI move
    setTimeout(() => {
      if (!this.isPlaying) return;
      const move = this._tttAiMove(t.board);
      if (move === -1) return;
      t.board[move] = 'O';
      t.playerTurn  = true;

      if (this._tttCheckWin(t.board, 'O')) {
        t.active = false;
        t.losses++;
        this._renderTTT();
        this._showTTTResult('AI Wins! 🤖');
        return;
      }
      if (t.board.every(c => c !== null)) {
        t.active = false;
        t.draws++;
        t.score += 10;
        this.updateScoreDisplay(t.score);
        this._renderTTT();
        this._showTTTResult("It's a Draw!");
        return;
      }
      this._renderTTT();
    }, 500);
  }

  _showTTTResult(msg) {
    this._renderTTT();
    const status = document.getElementById('ttt-status');
    if (status) status.innerHTML = `<strong>${msg}</strong>`;
  }

  tttNewRound() {
    if (!this.isPlaying) return;
    this._ttt.board      = Array(9).fill(null);
    this._ttt.playerTurn = true;
    this._ttt.active     = true;
    this._renderTTT();
  }

  /* =============================================================
     5. SPEED TYPING GAME
     ============================================================= */
  initTyping() {
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    const quote     = TYPING_QUOTES[Math.floor(Math.random() * TYPING_QUOTES.length)];
    const startTime = Date.now();
    let   finished  = false;

    ui.innerHTML = `
      <div class="typing-container">
        <h3 style="font-size:0.9rem;font-weight:700;color:var(--text-heading);
                   margin-bottom:16px;text-align:center;">
          Type the text below as fast as you can!
        </h3>
        <div class="typing-target" id="typing-target">${quote}</div>
        <div class="input-wrap" style="margin-top:16px;">
          <textarea id="typing-input" class="form-textarea" rows="3"
                    placeholder="Start typing here…"
                    style="font-size:1rem;line-height:1.8;width:100%;
                           box-sizing:border-box;resize:none;
                           padding:10px;border-radius:8px;
                           border:2px solid var(--border);
                           background:var(--bg-card);color:var(--text-primary);"></textarea>
        </div>
        <div class="typing-stats" id="typing-stats">
          <span>WPM: <strong id="stat-wpm">0</strong></span>
          <span>Accuracy: <strong id="stat-acc">100%</strong></span>
          <span>Time: <strong id="stat-time">0s</strong></span>
        </div>
      </div>
    `;

    const input    = document.getElementById('typing-input');
    const targetEl = document.getElementById('typing-target');

    if (!input) return;
    input.focus();

    input.addEventListener('input', () => {
      if (finished || !this.isPlaying) return;
      const typed   = input.value;
      const elapsed = Math.max(1, (Date.now() - startTime) / 1000);
      const words   = typed.trim().split(/\s+/).filter(Boolean).length;
      const wpm     = Math.round((words / elapsed) * 60);

      let correct = 0;
      for (let i = 0; i < typed.length && i < quote.length; i++) {
        if (typed[i] === quote[i]) correct++;
      }
      const accuracy = typed.length > 0
        ? Math.round((correct / typed.length) * 100)
        : 100;

      // Highlight
      let highlighted = '';
      for (let i = 0; i < quote.length; i++) {
        if (i < typed.length) {
          if (typed[i] === quote[i]) {
            highlighted += `<span style="color:var(--success);font-weight:600;">${quote[i] === ' ' ? '&nbsp;' : quote[i]}</span>`;
          } else {
            highlighted += `<span style="color:var(--danger);background:rgba(229,62,62,0.15);text-decoration:underline;">${quote[i] === ' ' ? '&nbsp;' : quote[i]}</span>`;
          }
        } else {
          highlighted += quote[i] === ' ' ? ' ' : quote[i];
        }
      }
      if (targetEl) targetEl.innerHTML = highlighted;

      const wpmEl  = document.getElementById('stat-wpm');
      const accEl  = document.getElementById('stat-acc');
      const timeEl = document.getElementById('stat-time');
      if (wpmEl)  wpmEl.textContent  = wpm;
      if (accEl)  accEl.textContent  = accuracy + '%';
      if (timeEl) timeEl.textContent = Math.round(elapsed) + 's';

      const score = Math.round(wpm * (accuracy / 100));
      this.updateScoreDisplay(score);

      if (typed.length >= quote.length) {
        finished      = true;
        input.disabled = true;
        setTimeout(() => this.gameOver(score), 500);
      }
    });
  }

  /* =============================================================
     6. FLAPPY BIRD
     ============================================================= */
  initFlappy() {
    const canvas = this.gameCanvas;
    const ctx    = this.gameCtx;
    if (!canvas || !ctx) return;
    const ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    let birdY        = canvas.height / 2;
    let birdVel      = 0;
    const birdX      = 80;
    const birdSize   = 18;
    const gravity    = 0.45;
    const jumpStr    = -7.5;
    const pipeWidth  = 52;
    const pipeGap    = 145;
    const pipeSpeed  = 2.5;
    let   pipes      = [];
    let   score      = 0;
    let   frame      = 0;

    const addPipe = () => {
      const min = 60;
      const max = canvas.height - pipeGap - 60;
      pipes.push({
        x:         canvas.width,
        topH:      Math.random() * (max - min) + min,
        passed:    false
      });
    };

    const doJump = () => { if (this.isPlaying) birdVel = jumpStr; };

    this._keyHandler = (e) => {
      if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); doJump(); }
    };
    document.addEventListener('keydown', this._keyHandler);
    canvas.addEventListener('click',      doJump);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); doJump(); }, { passive: false });

    addPipe();

    const tick = () => {
      if (!this.isPlaying) return;
      this.animationFrame = requestAnimationFrame(tick);

      frame++;
      birdVel += gravity;
      birdY   += birdVel;

      if (frame % 90 === 0) addPipe();

      pipes.forEach(p => {
        p.x -= pipeSpeed;
        if (!p.passed && p.x + pipeWidth < birdX) {
          p.passed = true;
          score++;
          this.updateScoreDisplay(score);
        }
      });
      pipes = pipes.filter(p => p.x > -pipeWidth - 10);

      // Boundary collision
      if (birdY < 0 || birdY + birdSize > canvas.height) {
        this.gameOver(score); return;
      }
      // Pipe collision
      for (const p of pipes) {
        const botY = p.topH + pipeGap;
        if (birdX + birdSize - 4 > p.x && birdX + 4 < p.x + pipeWidth) {
          if (birdY + 4 < p.topH || birdY + birdSize - 4 > botY) {
            this.gameOver(score); return;
          }
        }
      }

      // Draw background
      ctx.fillStyle = this.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Pipes
      const pipeColor = this.getColor('success');
      pipes.forEach(p => {
        const botY = p.topH + pipeGap;
        ctx.fillStyle = pipeColor;
        ctx.fillRect(p.x, 0, pipeWidth, p.topH);
        ctx.fillRect(p.x, botY, pipeWidth, canvas.height - botY);
        // Caps
        ctx.fillStyle = pipeColor + 'CC';
        ctx.fillRect(p.x - 5, p.topH - 22, pipeWidth + 10, 22);
        ctx.fillRect(p.x - 5, botY, pipeWidth + 10, 22);
      });

      // Bird
      ctx.fillStyle = this.getColor('primary');
      ctx.beginPath();
      ctx.arc(birdX + birdSize/2, birdY + birdSize/2, birdSize/2, 0, Math.PI*2);
      ctx.fill();

      const tilt = Math.min(Math.max(birdVel * 3, -30), 30);
      ctx.save();
      ctx.translate(birdX + birdSize/2, birdY + birdSize/2);
      ctx.rotate((tilt * Math.PI) / 180);
      ctx.fillStyle = this.getColor('white');
      ctx.beginPath();
      ctx.arc(5, -3, 4, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = this.getColor('dark');
      ctx.beginPath();
      ctx.arc(6, -3, 2, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // Score
      ctx.fillStyle   = this.getColor('text') + 'CC';
      ctx.font        = 'bold 16px Poppins, sans-serif';
      ctx.fillText(`${score}`, canvas.width / 2, 30);

      // Ground
      ctx.strokeStyle = this.getColor('secondary');
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 1);
      ctx.lineTo(canvas.width, canvas.height - 1);
      ctx.stroke();
    };

    tick();
  }

  /* =============================================================
     7. BREAKOUT
     ============================================================= */
  initBreakout() {
    const canvas = this.gameCanvas;
    const ctx    = this.gameCtx;
    if (!canvas || !ctx) return;
    const ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    const paddleW  = 90;
    const paddleH  = 12;
    let   paddleX  = canvas.width / 2 - paddleW / 2;

    const ballR    = 8;
    let   ballX    = canvas.width / 2;
    let   ballY    = canvas.height - 60;
    let   ballDX   = 3.5;
    let   ballDY   = -3.5;
    let   lives    = 3;

    const bRows    = 5;
    const bCols    = Math.floor((canvas.width - 20) / 58);
    const bW       = (canvas.width - 20 - (bCols - 1) * 4) / bCols;
    const bH       = 18;
    const bPad     = 4;
    const bTop     = 40;
    const bLeft    = 10;
    const rowColors = [
      this.getColor('danger'), this.getColor('warning'),
      this.getColor('success'), this.getColor('primary'), '#9F7AEA'
    ];

    let bricks = [];
    for (let r = 0; r < bRows; r++) {
      for (let c = 0; c < bCols; c++) {
        bricks.push({
          x: bLeft + c * (bW + bPad),
          y: bTop  + r * (bH + bPad),
          alive: true,
          color: rowColors[r]
        });
      }
    }

    let score         = 0;
    let rightPressed  = false;
    let leftPressed   = false;

    this._keyHandler = (e) => {
      if (e.key === 'ArrowRight') { rightPressed = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { leftPressed  = true; e.preventDefault(); }
    };
    this._keyUpHandler = (e) => {
      if (e.key === 'ArrowRight') rightPressed = false;
      if (e.key === 'ArrowLeft')  leftPressed  = false;
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup',   this._keyUpHandler);

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      paddleX = Math.max(0, Math.min(
        canvas.width - paddleW,
        (e.clientX - rect.left) * scaleX - paddleW / 2
      ));
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      paddleX = Math.max(0, Math.min(
        canvas.width - paddleW,
        (e.touches[0].clientX - rect.left) * scaleX - paddleW / 2
      ));
    }, { passive: false });

    const tick = () => {
      if (!this.isPlaying) return;
      this.animationFrame = requestAnimationFrame(tick);

      if (rightPressed && paddleX < canvas.width - paddleW) paddleX += 7;
      if (leftPressed  && paddleX > 0)                      paddleX -= 7;

      ballX += ballDX;
      ballY += ballDY;

      // Wall bounce
      if (ballX + ballR > canvas.width  || ballX - ballR < 0) ballDX = -ballDX;
      if (ballY - ballR < 0)                                    ballDY = -ballDY;

      // Paddle bounce
      const paddleTop = canvas.height - paddleH - 10;
      if (
        ballY + ballR >= paddleTop &&
        ballY + ballR <= paddleTop + paddleH + Math.abs(ballDY) &&
        ballX >= paddleX && ballX <= paddleX + paddleW
      ) {
        ballDY = -Math.abs(ballDY);
        const hitPos = (ballX - paddleX) / paddleW;
        ballDX = (hitPos - 0.5) * 9;
      }

      // Bottom — lose life
      if (ballY + ballR > canvas.height) {
        lives--;
        if (lives <= 0) { this.gameOver(score); return; }
        ballX  = canvas.width / 2;
        ballY  = canvas.height - 60;
        ballDX = 3.5;
        ballDY = -3.5;
      }

      // Brick collision
      for (const brick of bricks) {
        if (!brick.alive) continue;
        if (
          ballX + ballR > brick.x &&
          ballX - ballR < brick.x + bW &&
          ballY + ballR > brick.y &&
          ballY - ballR < brick.y + bH
        ) {
          // Determine bounce direction
          const overlapLeft   = ballX + ballR - brick.x;
          const overlapRight  = brick.x + bW - (ballX - ballR);
          const overlapTop    = ballY + ballR - brick.y;
          const overlapBottom = brick.y + bH - (ballY - ballR);
          const minOverlap    = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          if (minOverlap === overlapTop || minOverlap === overlapBottom) ballDY = -ballDY;
          else ballDX = -ballDX;

          brick.alive = false;
          score += 10;
          this.updateScoreDisplay(score);
          break; // One brick per frame
        }
      }

      // Win
      if (bricks.every(b => !b.alive)) { this.gameOver(score + 100); return; }

      // Draw
      ctx.fillStyle = this.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bricks
      bricks.forEach(brick => {
        if (!brick.alive) return;
        ctx.fillStyle   = brick.color;
        ctx.fillRect(brick.x, brick.y, bW, bH);
        ctx.strokeStyle = this.getColor('bg');
        ctx.lineWidth   = 1;
        ctx.strokeRect(brick.x, brick.y, bW, bH);
      });

      // Ball
      ctx.fillStyle = this.getColor('primary');
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
      ctx.fill();

      // Ball glow
      const grd = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, ballR * 2);
      grd.addColorStop(0, this.getColor('primary') + '60');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballR * 2, 0, Math.PI * 2);
      ctx.fill();

      // Paddle
      ctx.fillStyle   = this.getColor('text');
      ctx.beginPath();
      ctx.roundRect(paddleX, paddleTop, paddleW, paddleH, 6);
      ctx.fill();

      // Lives & score
      ctx.fillStyle = this.getColor('text') + 'CC';
      ctx.font      = 'bold 13px Poppins, sans-serif';
      ctx.fillText(`Lives: ${'♥ '.repeat(lives).trim()}`, 8, 20);
    };

    tick();
  }

  /* =============================================================
     8. WORDLE  (fully implemented)
     ============================================================= */
  initWordle() {
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    const word = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];

    this._wordle = {
      word,
      guesses:     [],   // array of strings
      currentGuess: '',
      maxGuesses:   6,
      won:          false,
      lost:         false
    };

    this._renderWordle();
    this._setupWordleKeyboard();
  }

  _renderWordle() {
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    const w = this._wordle;

    // Build grid
    let gridHTML = '<div class="wordle-grid">';
    for (let row = 0; row < w.maxGuesses; row++) {
      const guess = w.guesses[row] || '';
      const isActive = row === w.guesses.length && !w.won && !w.lost;
      const display  = isActive ? w.currentGuess : guess;

      gridHTML += '<div class="wordle-row">';
      for (let col = 0; col < 5; col++) {
        let cls   = 'wordle-cell';
        let letter = display[col] || '';

        if (row < w.guesses.length) {
          // Evaluate
          if (guess[col] === w.word[col]) {
            cls += ' wc-correct';
          } else if (w.word.includes(guess[col])) {
            cls += ' wc-present';
          } else if (guess[col]) {
            cls += ' wc-absent';
          }
        } else if (isActive && letter) {
          cls += ' wc-active';
        }
        gridHTML += `<div class="${cls}">${letter}</div>`;
      }
      gridHTML += '</div>';
    }
    gridHTML += '</div>';

    // Keyboard
    const rows = [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['ENTER','Z','X','C','V','B','N','M','⌫']
    ];
    const usedLetters = this._wordleLetterStates();
    let kbHTML = '<div class="wordle-keyboard">';
    rows.forEach(row => {
      kbHTML += '<div class="wordle-kb-row">';
      row.forEach(key => {
        const state = usedLetters[key] || '';
        const wide  = key === 'ENTER' || key === '⌫' ? ' wk-wide' : '';
        kbHTML += `<button class="wordle-key${wide} wk-${state}"
                           onclick="gamesManager.wordleKey('${key}')">${key}</button>`;
      });
      kbHTML += '</div>';
    });
    kbHTML += '</div>';

    let msgHTML = '';
    if (w.won)  msgHTML = `<div class="wordle-msg success">🎉 Brilliant! The word was <strong>${w.word}</strong></div>`;
    if (w.lost) msgHTML = `<div class="wordle-msg danger">The word was <strong>${w.word}</strong>. Better luck next time!</div>`;

    ui.innerHTML = `
      <div class="wordle-container">
        <div style="text-align:center;margin-bottom:8px;font-size:0.8rem;
                    color:var(--text-muted);font-weight:600;">
          Guess the 5-letter Rotaract word!
        </div>
        ${gridHTML}
        ${msgHTML}
        ${kbHTML}
      </div>
    `;
  }

  _wordleLetterStates() {
    const w = this._wordle;
    const states = {};
    w.guesses.forEach(guess => {
      for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        if (!letter) continue;
        if (guess[i] === w.word[i]) {
          states[letter] = 'correct';
        } else if (w.word.includes(letter) && states[letter] !== 'correct') {
          states[letter] = 'present';
        } else if (!w.word.includes(letter) && !states[letter]) {
          states[letter] = 'absent';
        }
      }
    });
    return states;
  }

  _setupWordleKeyboard() {
    this._keyHandler = (e) => {
      if (!this.isPlaying) return;
      const w = this._wordle;
      if (w.won || w.lost) return;
      const key = e.key.toUpperCase();
      if (key === 'ENTER')     { this.wordleKey('ENTER'); e.preventDefault(); }
      else if (key === 'BACKSPACE') { this.wordleKey('⌫'); e.preventDefault(); }
      else if (/^[A-Z]$/.test(key)) { this.wordleKey(key); }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  wordleKey(key) {
    if (!this.isPlaying) return;
    const w = this._wordle;
    if (w.won || w.lost) return;

    if (key === '⌫' || key === 'BACKSPACE') {
      w.currentGuess = w.currentGuess.slice(0, -1);
    } else if (key === 'ENTER') {
      if (w.currentGuess.length < 5) {
        this._wordleShake(); return;
      }
      w.guesses.push(w.currentGuess);
      if (w.currentGuess === w.word) {
        w.won = true;
        const bonus = (w.maxGuesses - w.guesses.length + 1) * 20;
        const score = 100 + bonus;
        this.updateScoreDisplay(score);
        this._renderWordle();
        setTimeout(() => this.gameOver(score), 1500);
        return;
      }
      if (w.guesses.length >= w.maxGuesses) {
        w.lost = true;
        this._renderWordle();
        setTimeout(() => this.gameOver(0), 1500);
        return;
      }
      w.currentGuess = '';
    } else if (/^[A-Z]$/.test(key) && w.currentGuess.length < 5) {
      w.currentGuess += key;
    }

    this._renderWordle();
  }

  _wordleShake() {
    const rows = document.querySelectorAll('.wordle-row');
    const activeRow = rows[this._wordle.guesses.length];
    if (activeRow) {
      activeRow.classList.add('wordle-shake');
      setTimeout(() => activeRow.classList.remove('wordle-shake'), 500);
    }
  }

  /* =============================================================
     9. PONG
     ============================================================= */
  initPong() {
    const canvas = this.gameCanvas;
    const ctx    = this.gameCtx;
    if (!canvas || !ctx) return;
    const ui = document.getElementById('game-ui');
    if (ui) ui.style.display = 'none';
    canvas.style.display = 'block';

    const paddleH  = 70;
    const paddleW  = 10;
    const ballSize = 10;
    const winScore = 7;

    let playerY  = canvas.height / 2 - paddleH / 2;
    let aiY      = canvas.height / 2 - paddleH / 2;
    let ballX    = canvas.width  / 2;
    let ballY    = canvas.height / 2;
    let ballDX   = 4;
    let ballDY   = 3;
    let playerScore = 0;
    let aiScore     = 0;
    const aiSpeed   = 3.2;

    let upPressed   = false;
    let downPressed = false;

    this._keyHandler = (e) => {
      if (e.key === 'ArrowUp')   { upPressed   = true;  e.preventDefault(); }
      if (e.key === 'ArrowDown') { downPressed = true;  e.preventDefault(); }
      if (e.key === 'w' || e.key === 'W') upPressed   = true;
      if (e.key === 's' || e.key === 'S') downPressed = true;
    };
    this._keyUpHandler = (e) => {
      if (e.key === 'ArrowUp'   || e.key === 'w' || e.key === 'W') upPressed   = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') downPressed = false;
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup',   this._keyUpHandler);

    // Touch: drag player paddle
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleY = canvas.height / rect.height;
      playerY = Math.max(0, Math.min(
        canvas.height - paddleH,
        (e.touches[0].clientY - rect.top) * scaleY - paddleH / 2
      ));
    }, { passive: false });

    const resetBall = () => {
      ballX  = canvas.width  / 2;
      ballY  = canvas.height / 2;
      ballDX = (Math.random() > 0.5 ? 1 : -1) * 4;
      ballDY = (Math.random() > 0.5 ? 1 : -1) * 3;
    };

    const tick = () => {
      if (!this.isPlaying) return;
      this.animationFrame = requestAnimationFrame(tick);

      // Player movement
      if (upPressed   && playerY > 0)                   playerY -= 6;
      if (downPressed && playerY < canvas.height - paddleH) playerY += 6;

      // AI movement
      const aiCenter = aiY + paddleH / 2;
      if (aiCenter < ballY - 5) aiY = Math.min(canvas.height - paddleH, aiY + aiSpeed);
      if (aiCenter > ballY + 5) aiY = Math.max(0, aiY - aiSpeed);

      // Ball movement
      ballX += ballDX;
      ballY += ballDY;

      // Top/bottom bounce
      if (ballY - ballSize/2 < 0 || ballY + ballSize/2 > canvas.height) ballDY = -ballDY;

      // Player paddle collision (left)
      if (
        ballX - ballSize/2 < paddleW + 20 &&
        ballY > playerY && ballY < playerY + paddleH && ballDX < 0
      ) {
        ballDX = Math.abs(ballDX) * 1.05;
        const rel = (ballY - playerY) / paddleH;
        ballDY = (rel - 0.5) * 8;
      }

      // AI paddle collision (right)
      if (
        ballX + ballSize/2 > canvas.width - paddleW - 20 &&
        ballY > aiY && ballY < aiY + paddleH && ballDX > 0
      ) {
        ballDX = -Math.abs(ballDX) * 1.05;
        const rel = (ballY - aiY) / paddleH;
        ballDY = (rel - 0.5) * 8;
      }

      // Speed cap
      ballDX = Math.max(-10, Math.min(10, ballDX));
      ballDY = Math.max(-8,  Math.min(8,  ballDY));

      // Score
      if (ballX < 0) {
        aiScore++;
        if (aiScore >= winScore) { this.gameOver(playerScore * 10); return; }
        resetBall();
      }
      if (ballX > canvas.width) {
        playerScore++;
        this.updateScoreDisplay(playerScore * 10);
        if (playerScore >= winScore) { this.gameOver(playerScore * 15); return; }
        resetBall();
      }

      // Draw
      ctx.fillStyle = this.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Centre line
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = this.getColor('secondary') + '60';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Paddles
      ctx.fillStyle = this.getColor('primary');
      ctx.beginPath();
      ctx.roundRect(10, playerY, paddleW, paddleH, 5);
      ctx.fill();

      ctx.fillStyle = this.getColor('danger');
      ctx.beginPath();
      ctx.roundRect(canvas.width - paddleW - 10, aiY, paddleW, paddleH, 5);
      ctx.fill();

      // Ball
      ctx.fillStyle = this.getColor('text');
      ctx.beginPath();
      ctx.roundRect(ballX - ballSize/2, ballY - ballSize/2, ballSize, ballSize, 3);
      ctx.fill();

      // Scores
      ctx.fillStyle = this.getColor('text');
      ctx.font      = 'bold 28px Poppins, sans-serif';
      ctx.fillText(playerScore, canvas.width / 2 - 40, 40);
      ctx.fillText(aiScore,     canvas.width / 2 + 22, 40);

      // Labels
      ctx.font      = 'bold 10px Poppins, sans-serif';
      ctx.fillStyle = this.getColor('text') + '80';
      ctx.fillText('YOU',canvas.width / 2 - 44, 56);
      ctx.fillText('AI', canvas.width / 2 + 22, 56);
    };

    tick();
  }

  /* =============================================================
     10. 2048
     ============================================================= */
  init2048() {
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    const SIZE = 4;
    const newGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

    const addRandom = (grid) => {
      const empty = [];
      grid.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); }));
      if (!empty.length) return;
      const [r, c] = empty[Math.floor(Math.random() * empty.length)];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    };

    let grid = newGrid();
    addRandom(grid);
    addRandom(grid);
    let score = 0;

    this._g2048 = { grid, score, size: SIZE };

    const slide = (row) => {
      let arr = row.filter(v => v);
      let pts = 0;
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1]) {
          arr[i] *= 2;
          pts += arr[i];
          arr.splice(i + 1, 1);
        }
      }
      while (arr.length < SIZE) arr.push(0);
      return { row: arr, pts };
    };

    const move = (dir) => {
      const g = this._g2048;
      let moved = false;
      let pts   = 0;

      const rotateGrid = (grid) =>
        grid[0].map((_, c) => grid.map(r => r[c]).reverse());

      let rotations = { left: 0, right: 2, up: 3, down: 1 }[dir] || 0;
      let temp = g.grid.map(r => [...r]);
      for (let i = 0; i < rotations; i++) temp = rotateGrid(temp);

      temp = temp.map(row => {
        const res = slide(row);
        pts += res.pts;
        if (JSON.stringify(row) !== JSON.stringify(res.row)) moved = true;
        return res.row;
      });

      for (let i = 0; i < (4 - rotations) % 4; i++) temp = rotateGrid(temp);

      if (moved) {
        g.grid  = temp;
        g.score += pts;
        score    = g.score;
        addRandom(g.grid);
        this.updateScoreDisplay(score);
        this._render2048();

        // Win check
        if (g.grid.flat().includes(2048)) {
          setTimeout(() => this.gameOver(score + 500), 300);
          return;
        }
        // Lose check
        if (!this._has2048Moves(g.grid)) {
          setTimeout(() => this.gameOver(score), 300);
        }
      }
    };

    this._2048move = move;

    this._keyHandler = (e) => {
      if (!this.isPlaying) return;
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    };
    document.addEventListener('keydown', this._keyHandler);
    this.setupTouchControls(document.getElementById('game-ui'), (dir) => move(dir));

    this._render2048();
  }

  _has2048Moves(grid) {
    const s = grid.length;
    for (let r = 0; r < s; r++) {
      for (let c = 0; c < s; c++) {
        if (!grid[r][c]) return true;
        if (c < s - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < s - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  _render2048() {
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    const g = this._g2048;

    const tileColors = {
      0:    ['#cdc1b4','#776e65'],
      2:    ['#eee4da','#776e65'],
      4:    ['#ede0c8','#776e65'],
      8:    ['#f2b179','#f9f6f2'],
      16:   ['#f59563','#f9f6f2'],
      32:   ['#f67c5f','#f9f6f2'],
      64:   ['#f65e3b','#f9f6f2'],
      128:  ['#edcf72','#f9f6f2'],
      256:  ['#edcc61','#f9f6f2'],
      512:  ['#edc850','#f9f6f2'],
      1024: ['#edc53f','#f9f6f2'],
      2048: ['#edc22e','#f9f6f2']
    };

    ui.innerHTML = `
      <div class="g2048-container">
        <div style="text-align:center;margin-bottom:12px;
                    font-size:0.82rem;color:var(--text-muted);font-weight:600;">
          Use arrow keys or swipe to merge tiles → reach <strong>2048</strong>!
        </div>
        <div class="g2048-grid">
          ${g.grid.flat().map(v => {
            const colors = tileColors[v] || tileColors[2048];
            return `
              <div class="g2048-cell" style="background:${colors[0]};color:${colors[1]};
                          font-size:${v >= 1024 ? '1rem' : v >= 128 ? '1.2rem' : '1.4rem'};">
                ${v || ''}
              </div>
            `;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:center;gap:12px;margin-top:16px;flex-wrap:wrap;">
          <button class="g2048-btn" onclick="gamesManager._2048move('up')">↑</button>
          <button class="g2048-btn" onclick="gamesManager._2048move('left')">←</button>
          <button class="g2048-btn" onclick="gamesManager._2048move('down')">↓</button>
          <button class="g2048-btn" onclick="gamesManager._2048move('right')">→</button>
        </div>
      </div>
    `;
  }

  /* =============================================================
     11. MINESWEEPER
     ============================================================= */
  initMinesweeper() {
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    const ROWS  = 9;
    const COLS  = 9;
    const MINES = 10;

    const createBoard = () => {
      const board = Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => ({
          r, c, mine: false, revealed: false, flagged: false, adjacent: 0
        }))
      );
      // Place mines
      let placed = 0;
      while (placed < MINES) {
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        if (!board[r][c].mine) { board[r][c].mine = true; placed++; }
      }
      // Calculate adjacency
      const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      board.forEach(row => row.forEach(cell => {
        if (cell.mine) return;
        cell.adjacent = dirs.reduce((n, [dr, dc]) => {
          const nr = cell.r + dr, nc = cell.c + dc;
          return n + (board[nr]?.[nc]?.mine ? 1 : 0);
        }, 0);
      }));
      return board;
    };

    this._ms = {
      board:     createBoard(),
      rows: ROWS, cols: COLS, mines: MINES,
      revealed:  0,
      flagged:   0,
      firstMove: true,
      won:       false,
      lost:      false,
      score:     0
    };

    this._renderMS();
  }

  _renderMS() {
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    const ms = this._ms;

    const adjColors = ['','#1976D2','#388E3C','#D32F2F','#7B1FA2',
                       '#F57F17','#0097A7','#212121','#757575'];

    let gridHTML = '<div class="ms-grid" style="grid-template-columns:repeat(' +
                   ms.cols + ',1fr);">';
    ms.board.forEach(row => row.forEach(cell => {
      let content = '';
      let cls     = 'ms-cell';
      if (ms.lost && cell.mine && !cell.flagged) {
        cls += ' ms-mine'; content = '💣';
      } else if (cell.flagged) {
        content = '🚩'; cls += ' ms-flagged';
      } else if (!cell.revealed) {
        cls += ' ms-hidden';
      } else if (cell.mine) {
        cls += ' ms-mine'; content = '💣';
      } else {
        cls += ' ms-revealed';
        if (cell.adjacent > 0)
          content = `<span style="color:${adjColors[cell.adjacent]};font-weight:800;">
                       ${cell.adjacent}</span>`;
      }
      gridHTML += `
        <div class="${cls}"
             onclick="gamesManager.msReveal(${cell.r},${cell.c})"
             oncontextmenu="gamesManager.msFlag(event,${cell.r},${cell.c})">
          ${content}
        </div>`;
    }));
    gridHTML += '</div>';

    const remaining = ms.mines - ms.flagged;
    const safe      = ms.rows * ms.cols - ms.mines;

    ui.innerHTML = `
      <div class="ms-container">
        <div class="ms-header">
          <span>💣 ${remaining} left</span>
          <span>${ms.won ? '🎉 You Win!' : ms.lost ? '💥 Boom!' : '🎮 Playing'}</span>
          <span>✅ ${ms.revealed}/${safe}</span>
        </div>
        ${gridHTML}
        <p style="text-align:center;font-size:0.72rem;color:var(--text-muted);margin-top:10px;">
          Left-click to reveal &nbsp;|&nbsp; Right-click to flag
        </p>
        ${ms.won || ms.lost
          ? `<button class="btn btn-primary" style="display:block;margin:12px auto 0;"
                     onclick="gamesManager.initMinesweeper()">
               New Game
             </button>`
          : ''
        }
      </div>
    `;
  }

  msReveal(r, c) {
    if (!this.isPlaying) return;
    const ms   = this._ms;
    const cell = ms.board[r][c];
    if (ms.lost || ms.won || cell.revealed || cell.flagged) return;

    if (ms.firstMove && cell.mine) {
      // Relocate mine so first click is always safe
      ms.board.forEach(row => row.forEach(b => {
        if (!b.mine && b.r !== r && b.c !== c) {
          b.mine = true; cell.mine = false;
          // Recalculate adjacency
          const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
          ms.board.forEach(row2 => row2.forEach(b2 => {
            if (b2.mine) return;
            b2.adjacent = dirs.reduce((n, [dr, dc]) => {
              const nr = b2.r + dr, nc = b2.c + dc;
              return n + (ms.board[nr]?.[nc]?.mine ? 1 : 0);
            }, 0);
          }));
          return;
        }
      }));
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
    const fill = (row, col) => {
      const b = ms.board[row]?.[col];
      if (!b || b.revealed || b.flagged || b.mine) return;
      b.revealed = true;
      ms.revealed++;
      ms.score += 5;
      if (b.adjacent === 0) {
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
          .forEach(([dr, dc]) => fill(row + dr, col + dc));
      }
    };
    fill(r, c);
    this.updateScoreDisplay(ms.score);

    const safe = ms.rows * ms.cols - ms.mines;
    if (ms.revealed >= safe) {
      ms.won = true;
      ms.score += 200;
      this.updateScoreDisplay(ms.score);
      this._renderMS();
      this.gameOver(ms.score);
      return;
    }
    this._renderMS();
  }

  msFlag(e, r, c) {
    e.preventDefault();
    if (!this.isPlaying) return;
    const ms   = this._ms;
    const cell = ms.board[r][c];
    if (ms.lost || ms.won || cell.revealed) return;
    cell.flagged = !cell.flagged;
    ms.flagged  += cell.flagged ? 1 : -1;
    this._renderMS();
  }

  /* =============================================================
     12. COLOR GUESS
     ============================================================= */
  initColorGuess() {
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    ui.style.display = 'block';

    this._cg = { score: 0, round: 0, totalRounds: 10 };
    this._cgNextRound();
  }

  _cgNextRound() {
    const ui = document.getElementById('game-ui');
    if (!ui) return;
    const cg = this._cg;

    if (cg.round >= cg.totalRounds) {
      this.gameOver(cg.score);
      return;
    }
    cg.round++;

    const randColor = () => ({
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256)
    });

    const correct = randColor();
    const options = [correct];
    while (options.length < 4) {
      const col = randColor();
      if (!options.some(o => o.r === col.r && o.g === col.g && o.b === col.b))
        options.push(col);
    }
    options.sort(() => Math.random() - 0.5);
    const correctIdx = options.findIndex(o =>
      o.r === correct.r && o.g === correct.g && o.b === correct.b
    );

    this._cgCorrectIdx = correctIdx;
    this._cgOptions    = options;

    const toHex = ({r,g,b}) =>
      '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();

    ui.innerHTML = `
      <div class="cg-container">
        <div style="text-align:center;margin-bottom:6px;
                    font-size:0.8rem;color:var(--text-muted);font-weight:600;">
          Round ${cg.round}/${cg.totalRounds} — Which color matches this HEX?
        </div>
        <div class="cg-code">${toHex(correct)}</div>
        <div class="cg-swatches">
          ${options.map((col, i) => `
            <div class="cg-swatch"
                 style="background:rgb(${col.r},${col.g},${col.b});"
                 onclick="gamesManager.cgGuess(${i})">
            </div>
          `).join('')}
        </div>
        <div id="cg-msg" style="text-align:center;min-height:24px;"></div>
        <div style="text-align:center;margin-top:8px;
                    font-size:0.82rem;color:var(--text-muted);">
          Score: <strong>${cg.score}</strong>
        </div>
      </div>
    `;
  }

  cgGuess(index) {
    if (!this.isPlaying) return;
    const cg  = this._cg;
    const msg = document.getElementById('cg-msg');
    const swatches = document.querySelectorAll('.cg-swatch');
    swatches.forEach(s => s.style.pointerEvents = 'none');

    if (index === this._cgCorrectIdx) {
      const pts = 10;
      cg.score += pts;
      this.updateScoreDisplay(cg.score);
      if (msg) msg.innerHTML = `<span style="color:var(--success);font-weight:700;">✓ Correct! +${pts}</span>`;
    } else {
      if (msg) msg.innerHTML = `<span style="color:var(--danger);font-weight:700;">✗ Wrong!</span>`;
      if (swatches[this._cgCorrectIdx])
        swatches[this._cgCorrectIdx].style.outline = '4px solid var(--success)';
    }

    setTimeout(() => this._cgNextRound(), 1200);
  }

  /* =============================================================
     TOUCH CONTROLS HELPER
     ============================================================= */
  setupTouchControls(element, callback) {
    if (!element) return;
    let startX = 0, startY = 0;
    element.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    element.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy)) callback(dx > 0 ? 'right' : 'left');
      else                              callback(dy > 0 ? 'down'  : 'up');
    }, { passive: true });
  }

  /* =============================================================
     RANDOM POSITION HELPER
     ============================================================= */
  randomPosition(cols, rows, exclude = []) {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
      };
    } while (exclude.some(e => e.x === pos.x && e.y === pos.y));
    return pos;
  }
}

/* ============================================================
   GAMES STYLES
   ============================================================ */
const gamesStyles = `
  /* ---------- Layout ---------- */
  .game-card {
    display:flex;align-items:center;gap:16px;padding:20px;
    cursor:pointer;transition:var(--transition,0.2s);
  }
  .game-card:hover { transform:translateY(-4px) scale(1.01); }
  .game-card-icon {
    width:60px;height:60px;border-radius:12px;
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;transition:var(--transition,0.2s);
  }
  .game-card:hover .game-card-icon { background:var(--accent)!important; }
  .game-card:hover .game-card-icon svg,
  .game-card:hover .game-card-icon i { color:#FFF!important; }
  .game-card-info  { flex:1; }
  .game-card-title { font-size:1rem;font-weight:700;color:var(--text-heading);margin-bottom:4px; }
  .game-card-desc  { font-size:0.8rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px; }
  .game-card-meta  { display:flex;gap:8px;align-items:center;flex-wrap:wrap; }
  .game-difficulty,.game-category,.game-high-score {
    padding:2px 10px;border-radius:999px;font-size:0.68rem;font-weight:700;
  }
  .game-difficulty-easy   { background:var(--success-light,#c6f6d5);color:var(--success,#38a169); }
  .game-difficulty-medium { background:var(--warning-light,#fefcbf);color:var(--warning,#d69e2e); }
  .game-difficulty-hard   { background:var(--danger-light,#fed7d7); color:var(--danger,#e53e3e);  }
  .game-category     { background:var(--bg-secondary,#eee);color:var(--text-muted,#888); }
  .game-high-score   { background:var(--accent-light);color:var(--accent);
                        display:flex;align-items:center;gap:4px; }
  .game-card-play {
    width:40px;height:40px;border-radius:50%;background:var(--accent-light);
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;color:var(--accent);transition:var(--transition,0.2s);
  }
  .game-card:hover .game-card-play { background:var(--accent);color:#FFF;transform:scale(1.15); }

  /* ---------- Game Header ---------- */
  .game-header {
    display:flex;align-items:center;justify-content:space-between;
    gap:16px;margin-bottom:16px;flex-wrap:wrap;
  }
  .game-title-area { display:flex;align-items:center;gap:10px; }
  .game-title-area h2 {
    font-size:1.1rem;font-weight:700;color:var(--text-heading);
    display:flex;align-items:center;gap:8px;
  }
  .game-title-area h2 svg,.game-title-area h2 i { width:22px;height:22px;color:var(--accent); }
  .game-score-area {
    display:flex;flex-direction:column;align-items:center;
    padding:8px 20px;background:var(--bg-card);border-radius:8px;
  }
  .game-score-label {
    font-size:0.68rem;font-weight:600;color:var(--text-muted);
    text-transform:uppercase;letter-spacing:0.08em;
  }
  .game-score-value { font-size:1.6rem;font-weight:800;color:var(--accent);line-height:1; }

  /* ---------- Canvas Container ---------- */
  .game-container {
    position:relative;background:var(--bg-card);border-radius:12px;
    overflow:hidden;min-height:300px;
  }
  .game-container canvas { display:block;width:100%; }
  .game-overlay {
    position:absolute;inset:0;background:rgba(0,0,0,0.75);
    backdrop-filter:blur(8px);display:flex;
    align-items:center;justify-content:center;z-index:10;
  }
  .game-overlay-content {
    text-align:center;color:#FFF;
    display:flex;flex-direction:column;align-items:center;gap:16px;
  }
  .game-overlay-content h3 { font-size:1.6rem;font-weight:800; }
  .game-overlay-content p  { font-size:0.9rem;opacity:0.8;max-width:300px;line-height:1.6; }
  .game-ui { padding:16px;min-height:300px; }

  /* ---------- Memory ---------- */
  .memory-grid {
    display:grid;grid-template-columns:repeat(4,1fr);
    gap:10px;max-width:360px;margin:0 auto;
  }
  .memory-card { aspect-ratio:1;cursor:pointer;perspective:600px; }
  .memory-card-inner {
    width:100%;height:100%;transition:transform 0.45s;
    transform-style:preserve-3d;position:relative;
  }
  .memory-card.flipped .memory-card-inner { transform:rotateY(180deg); }
  .memory-card-front,.memory-card-back {
    position:absolute;inset:0;backface-visibility:hidden;
    display:flex;align-items:center;justify-content:center;
    border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);
  }
  .memory-card-front {
    background:var(--accent-light,#ebf8ff);color:var(--accent);
  }
  .memory-card-front i,.memory-card-front svg { width:24px;height:24px; }
  .memory-card-back {
    background:var(--bg-card,#fff);transform:rotateY(180deg);color:var(--accent);
  }
  .memory-card-back  i,.memory-card-back  svg { width:28px;height:28px; }
  .memory-card.matched .memory-card-back { background:var(--success-light,#c6f6d5);color:var(--success,#38a169); }

  /* ---------- Quiz ---------- */
  .quiz-container { max-width:500px;margin:0 auto; }
  .quiz-progress {
    height:4px;background:var(--bg-secondary,#eee);
    border-radius:999px;margin-bottom:16px;overflow:hidden;
  }
  .quiz-progress-bar {
    height:100%;background:var(--accent);border-radius:999px;
    transition:width 0.4s ease;
  }
  .quiz-counter {
    font-size:0.78rem;color:var(--text-muted);
    margin-bottom:16px;text-align:center;font-weight:600;
  }
  .quiz-question {
    font-size:1.05rem;font-weight:700;color:var(--text-heading);
    margin-bottom:20px;line-height:1.5;text-align:center;
  }
  .quiz-options { display:flex;flex-direction:column;gap:10px; }
  .quiz-option {
    display:flex;align-items:center;gap:14px;padding:14px 18px;
    border-radius:8px;background:var(--bg-card);
    border:2px solid transparent;cursor:pointer;
    transition:0.2s;text-align:left;width:100%;
    font-family:inherit;font-size:0.88rem;color:var(--text-primary);
  }
  .quiz-option:hover:not(:disabled) { border-color:var(--accent);transform:translateX(4px); }
  .quiz-option.quiz-correct { border-color:var(--success,#38a169);background:var(--success-light,#c6f6d5);color:var(--success,#38a169); }
  .quiz-option.quiz-wrong   { border-color:var(--danger,#e53e3e); background:var(--danger-light,#fed7d7); color:var(--danger,#e53e3e);  }
  .quiz-option-letter {
    width:28px;height:28px;border-radius:50%;
    background:var(--accent-light);color:var(--accent);
    display:flex;align-items:center;justify-content:center;
    font-weight:800;font-size:0.82rem;flex-shrink:0;
  }
  .quiz-option-text { flex:1; }
  .quiz-explanation {
    margin-top:16px;padding:12px;border-radius:8px;
    background:var(--bg-secondary,#f7f7f7);
    display:flex;align-items:flex-start;gap:10px;
    font-size:0.82rem;color:var(--text-secondary);
    animation:fadeIn 0.3s ease;
  }

  /* ---------- Tic Tac Toe ---------- */
  .ttt-container { max-width:320px;margin:0 auto;text-align:center; }
  .ttt-scoreboard {
    display:flex;justify-content:space-around;
    margin-bottom:12px;font-size:0.88rem;font-weight:700;
  }
  .ttt-status { font-size:0.9rem;font-weight:600;color:var(--text-heading);margin-bottom:16px; }
  .ttt-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }
  .ttt-cell {
    aspect-ratio:1;border-radius:8px;background:var(--bg-card);
    border:2px solid transparent;cursor:pointer;transition:0.2s;
    display:flex;align-items:center;justify-content:center;
    font-family:inherit;
  }
  .ttt-cell:hover:not(:disabled) { border-color:var(--accent);transform:scale(1.05); }
  .ttt-x { color:var(--accent); }
  .ttt-o { color:var(--danger); }

  /* ---------- Typing ---------- */
  .typing-container { max-width:550px;margin:0 auto; }
  .typing-target {
    padding:20px;background:var(--bg-secondary,#f7f7f7);
    border-radius:8px;font-size:1rem;line-height:1.8;
    color:var(--text-secondary);letter-spacing:0.02em;min-height:80px;
  }
  .typing-stats {
    display:flex;justify-content:center;gap:24px;
    margin-top:16px;font-size:0.88rem;color:var(--text-secondary);flex-wrap:wrap;
  }
  .typing-stats strong { color:var(--accent);font-weight:800; }

  /* ---------- Wordle ---------- */
  .wordle-container { max-width:340px;margin:0 auto; }
  .wordle-grid { display:flex;flex-direction:column;gap:6px;margin-bottom:12px; }
  .wordle-row  { display:flex;gap:6px; }
  .wordle-cell {
    width:54px;height:54px;border:2px solid var(--border,#ccc);
    border-radius:6px;display:flex;align-items:center;justify-content:center;
    font-size:1.4rem;font-weight:800;text-transform:uppercase;
    transition:0.25s;color:var(--text-heading);background:var(--bg-card);
  }
  .wc-active   { border-color:var(--accent);transform:scale(1.05); }
  .wc-correct  { background:#538d4e;border-color:#538d4e;color:#fff; }
  .wc-present  { background:#b59f3b;border-color:#b59f3b;color:#fff; }
  .wc-absent   { background:#3a3a3c;border-color:#3a3a3c;color:#fff; }
  .wordle-keyboard { display:flex;flex-direction:column;gap:6px;align-items:center; }
  .wordle-kb-row   { display:flex;gap:4px; }
  .wordle-key {
    min-width:32px;height:46px;border-radius:5px;border:none;cursor:pointer;
    font-weight:700;font-size:0.82rem;background:var(--bg-secondary,#d3d6da);
    color:var(--text-heading);transition:0.15s;font-family:inherit;
  }
  .wordle-key:hover { opacity:0.8; }
  .wk-wide { min-width:54px;font-size:0.75rem; }
  .wk-correct { background:#538d4e!important;color:#fff!important; }
  .wk-present { background:#b59f3b!important;color:#fff!important; }
  .wk-absent  { background:#3a3a3c!important;color:#fff!important; }
  .wordle-msg {
    text-align:center;padding:10px;border-radius:8px;margin-bottom:10px;
    font-size:0.88rem;font-weight:600;
  }
  .wordle-msg.success { background:var(--success-light,#c6f6d5);color:var(--success,#38a169); }
  .wordle-msg.danger  { background:var(--danger-light,#fed7d7); color:var(--danger,#e53e3e);  }
  @keyframes wordle-shake {
    0%,100%{ transform:translateX(0); }
    20%    { transform:translateX(-6px); }
    40%    { transform:translateX(6px); }
    60%    { transform:translateX(-4px); }
    80%    { transform:translateX(4px); }
  }
  .wordle-shake { animation:wordle-shake 0.45s ease; }

  /* ---------- 2048 ---------- */
  .g2048-container { max-width:380px;margin:0 auto; }
  .g2048-grid {
    display:grid;grid-template-columns:repeat(4,1fr);
    gap:8px;background:var(--bg-secondary,#bbada0);
    padding:8px;border-radius:8px;
  }
  .g2048-cell {
    aspect-ratio:1;border-radius:6px;display:flex;
    align-items:center;justify-content:center;
    font-weight:800;transition:0.1s;
  }
  .g2048-btn {
    width:52px;height:52px;border-radius:8px;border:none;cursor:pointer;
    background:var(--accent-light);color:var(--accent);font-size:1.4rem;
    font-weight:700;transition:0.15s;
  }
  .g2048-btn:hover { background:var(--accent);color:#fff; }

  /* ---------- Minesweeper ---------- */
  .ms-container { max-width:380px;margin:0 auto; }
  .ms-header {
    display:flex;justify-content:space-between;align-items:center;
    margin-bottom:10px;font-weight:700;font-size:0.85rem;
    color:var(--text-heading);
  }
  .ms-grid {
    display:grid;gap:2px;background:var(--bg-secondary,#ccc);
    padding:2px;border-radius:4px;
  }
  .ms-cell {
    aspect-ratio:1;display:flex;align-items:center;justify-content:center;
    font-size:0.75rem;font-weight:700;cursor:pointer;border-radius:3px;
    user-select:none;min-width:32px;
  }
  .ms-hidden   { background:var(--bg-card);transition:0.1s; }
  .ms-hidden:hover { background:var(--accent-light); }
  .ms-revealed { background:var(--bg-secondary,#e0e0e0); }
  .ms-mine     { background:var(--danger-light,#fed7d7); }
  .ms-flagged  { background:var(--warning-light,#fefcbf);cursor:pointer; }

  /* ---------- Color Guess ---------- */
  .cg-container { max-width:360px;margin:0 auto;text-align:center; }
  .cg-code {
    font-size:1.8rem;font-weight:800;letter-spacing:0.1em;
    color:var(--text-heading);margin:16px 0;font-family:monospace;
  }
  .cg-swatches {
    display:grid;grid-template-columns:repeat(2,1fr);
    gap:12px;max-width:280px;margin:0 auto 16px;
  }
  .cg-swatch {
    aspect-ratio:1;border-radius:12px;cursor:pointer;
    transition:0.15s;box-shadow:0 4px 12px rgba(0,0,0,0.2);
  }
  .cg-swatch:hover { transform:scale(1.06);box-shadow:0 6px 20px rgba(0,0,0,0.3); }

  /* ---------- Responsive ---------- */
  @media(max-width:480px){
    .memory-grid  { gap:6px; }
    .game-header  { flex-direction:column;align-items:flex-start; }
    .typing-stats { flex-direction:column;gap:8px;align-items:center; }
    .wordle-cell  { width:46px;height:46px;font-size:1.1rem; }
    .ms-cell      { min-width:28px;font-size:0.65rem; }
    .ttt-cell     { min-height:70px; }
  }
`;

/* ============================================================
   INJECT STYLES
   ============================================================ */
(function injectGamesStyles() {
  if (!document.getElementById('games-styles')) {
    const style = document.createElement('style');
    style.id      = 'games-styles';
    style.textContent = gamesStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
let gamesManager;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('games-grid') ||
      document.getElementById('game-play-area')) {
    gamesManager = new GamesManager();
    window.gamesManager = gamesManager;
  }
});

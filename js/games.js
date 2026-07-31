/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Games Module - js/games.js
   12+ Interactive games for members and visitors
   ============================================================ */

'use strict';

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
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark'
          ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        Storage.set('theme', newTheme);
        lucide.createIcons();
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
          <div class="game-card-icon"
               style="background:var(--accent-light);">
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
              ${highScore > 0 ? `
              <span class="game-high-score">
                <i data-lucide="trophy" style="width:12px;height:12px;"></i>
                ${highScore}
              </span>` : ''}
            </div>
          </div>
          <div class="game-card-play">
            <i data-lucide="play" style="width:20px;height:20px;"></i>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
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
          <span class="game-difficulty game-difficulty-${game.difficulty.toLowerCase()}">${game.difficulty}</span>
        </div>
        <div class="game-score-area">
          <span class="game-score-label">Score</span>
          <span class="game-score-value" id="game-score">0</span>
        </div>
      </div>

      <div class="game-container" id="game-container">
        <canvas id="game-canvas" width="480" height="400"></canvas>
        <div class="game-overlay" id="game-overlay">
          <div class="game-overlay-content">
            <h3 id="game-overlay-title">${game.name}</h3>
            <p id="game-overlay-text">${game.description}</p>
            <button class="btn btn-primary" id="game-start-btn" onclick="gamesManager.startGame()">
              <i data-lucide="play"></i>
              <span>Start Game</span>
            </button>
          </div>
        </div>
        <div class="game-ui" id="game-ui"></div>
      </div>
    `;

    this.gameCanvas = document.getElementById('game-canvas');
    this.gameCtx = this.gameCanvas?.getContext('2d');
    this.resizeCanvas();

    lucide.createIcons();
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
  }

  startGame() {
    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.style.display = 'none';
    this.score = 0;
    this.updateScoreDisplay(0);
    this.isPlaying = true;

    switch (this.currentGame) {
      case 'snake': this.initSnake(); break;
      case 'memory': this.initMemory(); break;
      case 'tetris': this.initTetris(); break;
      case 'quiz': this.initQuiz(); break;
      case 'flappy': this.initFlappy(); break;
      case 'wordle': this.initWordle(); break;
      case 'pong': this.initPong(); break;
      case '2048': this.init2048(); break;
      case 'tictactoe': this.initTicTacToe(); break;
      case 'typing': this.initTyping(); break;
      case 'minesweeper': this.initMinesweeper(); break;
      case 'breakout': this.initBreakout(); break;
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
    document.removeEventListener('keydown', this._keyHandler);
    document.removeEventListener('keyup', this._keyUpHandler);
  }

  gameOver(finalScore) {
    this.isPlaying = false;
    this.stopCurrentGame();

    this.saveHighScore(this.currentGame, finalScore);
    this.updateScoreDisplay(finalScore);

    const overlay = document.getElementById('game-overlay');
    const title = document.getElementById('game-overlay-title');
    const text = document.getElementById('game-overlay-text');
    const btn = document.getElementById('game-start-btn');

    if (overlay) overlay.style.display = 'flex';
    if (title) title.textContent = 'Game Over!';
    if (text) text.textContent = `Your score: ${finalScore}. ${this.highScores[this.currentGame] === finalScore ? 'New high score!' : `Best: ${this.highScores[this.currentGame] || 0}`}`;
    if (btn) {
      btn.innerHTML = '<i data-lucide="rotate-ccw"></i><span>Play Again</span>';
      lucide.createIcons();
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
    if (!this.highScores[gameId] || score > this.highScores[gameId]) {
      this.highScores[gameId] = score;
      Storage.set('game_high_scores', this.highScores);

      // Save to DB
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
     COLORS HELPER
     ============================================================ */
  getColor(name) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const colors = {
      bg: isDark ? '#1A1B26' : '#E0E0E0',
      primary: isDark ? '#4DEEEA' : '#0055FF',
      text: isDark ? '#EAEFFB' : '#3A3A3A',
      secondary: isDark ? '#35374E' : '#BEBEBE',
      danger: '#E53E3E',
      success: '#38A169',
      warning: '#D69E2E',
      white: '#FFFFFF',
      dark: '#222222'
    };
    return colors[name] || colors.primary;
  }

  /* ============================================================
     SNAKE GAME
     ============================================================ */
  initSnake() {
    const canvas = this.gameCanvas;
    const ctx = this.gameCtx;
    const gridSize = 20;
    const cols = Math.floor(canvas.width / gridSize);
    const rows = Math.floor(canvas.height / gridSize);

    let snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    let direction = { x: 1, y: 0 };
    let food = this.randomPosition(cols, rows, snake);
    let score = 0;
    let speed = 120;

    this._keyHandler = (e) => {
      const key = e.key;
      if (key === 'ArrowUp' && direction.y !== 1) { direction = { x: 0, y: -1 }; e.preventDefault(); }
      if (key === 'ArrowDown' && direction.y !== -1) { direction = { x: 0, y: 1 }; e.preventDefault(); }
      if (key === 'ArrowLeft' && direction.x !== 1) { direction = { x: -1, y: 0 }; e.preventDefault(); }
      if (key === 'ArrowRight' && direction.x !== -1) { direction = { x: 1, y: 0 }; e.preventDefault(); }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Touch controls
    this.setupTouchControls(canvas, (dir) => {
      if (dir === 'up' && direction.y !== 1) direction = { x: 0, y: -1 };
      if (dir === 'down' && direction.y !== -1) direction = { x: 0, y: 1 };
      if (dir === 'left' && direction.x !== 1) direction = { x: -1, y: 0 };
      if (dir === 'right' && direction.x !== -1) direction = { x: 1, y: 0 };
    });

    const tick = () => {
      if (!this.isPlaying) return;

      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

      // Wall collision
      if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        this.gameOver(score); return;
      }

      // Self collision
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        this.gameOver(score); return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        this.updateScoreDisplay(score);
        food = this.randomPosition(cols, rows, snake);
        if (speed > 60) speed -= 2;
        clearInterval(this.gameInterval);
        this.gameInterval = setInterval(tick, speed);
      } else {
        snake.pop();
      }

      // Draw
      ctx.fillStyle = this.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = this.getColor('secondary') + '30';
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
      ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2,
        gridSize / 2 - 2, 0, Math.PI * 2);
      ctx.fill();

      // Snake
      snake.forEach((seg, i) => {
        const alpha = 1 - (i / snake.length) * 0.4;
        ctx.fillStyle = i === 0 ? this.getColor('primary') :
          this.getColor('primary') + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fillRect(
          seg.x * gridSize + 1, seg.y * gridSize + 1,
          gridSize - 2, gridSize - 2
        );
        if (i === 0) {
          // Eye
          ctx.fillStyle = this.getColor('bg');
          const eyeX = seg.x * gridSize + gridSize / 2 + direction.x * 4;
          const eyeY = seg.y * gridSize + gridSize / 2 + direction.y * 4;
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    };

    this.gameInterval = setInterval(tick, speed);
  }

  /* ============================================================
     MEMORY MATCH GAME
     ============================================================ */
  initMemory() {
    const ui = document.getElementById('game-ui');
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';

    const symbols = [
      'heart', 'star', 'globe', 'shield', 'award', 'users',
      'sun', 'moon', 'zap', 'coffee', 'book', 'flag'
    ];
    const pairs = symbols.slice(0, 8);
    const cards = [...pairs, ...pairs].sort(() => Math.random() - 0.5);

    let flipped = [];
    let matched = [];
    let moves = 0;
    let score = 0;

    const render = () => {
      ui.innerHTML = `
        <div style="text-align:center;margin-bottom:12px;">
          <span style="font-size:0.82rem;color:var(--text-secondary);">
            Moves: ${moves} | Matched: ${matched.length / 2}/${pairs.length}
          </span>
        </div>
        <div class="memory-grid">
          ${cards.map((symbol, i) => {
        const isFlipped = flipped.includes(i) || matched.includes(i);
        return `
              <div class="memory-card ${isFlipped ? 'flipped' : ''} ${matched.includes(i) ? 'matched' : ''}"
                   onclick="gamesManager.flipMemoryCard(${i})"
                   data-index="${i}">
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
      lucide.createIcons();
    };

    this._memoryCards = cards;
    this._memoryFlipped = flipped;
    this._memoryMatched = matched;
    this._memoryMoves = moves;
    this._memoryPairs = pairs;
    this._memoryRender = render;
    this._memoryScore = score;

    render();
  }

  flipMemoryCard(index) {
    if (!this.isPlaying) return;
    if (this._memoryFlipped.length >= 2) return;
    if (this._memoryFlipped.includes(index)) return;
    if (this._memoryMatched.includes(index)) return;

    this._memoryFlipped.push(index);
    this._memoryRender();

    if (this._memoryFlipped.length === 2) {
      this._memoryMoves++;

      const [a, b] = this._memoryFlipped;
      if (this._memoryCards[a] === this._memoryCards[b]) {
        this._memoryMatched.push(a, b);
        this._memoryScore += 20;
        this.updateScoreDisplay(this._memoryScore);
        this._memoryFlipped = [];
        this._memoryRender();

        // Check win
        if (this._memoryMatched.length === this._memoryCards.length) {
          const bonus = Math.max(0, 100 - this._memoryMoves * 2);
          this._memoryScore += bonus;
          this.updateScoreDisplay(this._memoryScore);
          setTimeout(() => this.gameOver(this._memoryScore), 500);
        }
      } else {
        setTimeout(() => {
          this._memoryFlipped = [];
          this._memoryRender();
        }, 800);
      }
    }
  }

  /* ============================================================
     QUIZ GAME
     ============================================================ */
  initQuiz() {
    const ui = document.getElementById('game-ui');
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';

    const questions = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
    let currentQ = 0;
    let score = 0;

    const renderQuestion = () => {
      if (currentQ >= questions.length) {
        this.gameOver(score);
        return;
      }

      const q = questions[currentQ];
      ui.innerHTML = `
        <div class="quiz-container">
          <div class="quiz-progress">
            <div class="quiz-progress-bar" style="width:${((currentQ) / questions.length) * 100}%;"></div>
          </div>
          <div class="quiz-counter">
            Question ${currentQ + 1} of ${questions.length}
          </div>
          <h3 class="quiz-question">${q.question}</h3>
          <div class="quiz-options">
            ${q.options.map((opt, i) => `
              <button class="quiz-option" onclick="gamesManager.answerQuiz(${i})">
                <span class="quiz-option-letter">${String.fromCharCode(65 + i)}</span>
                <span class="quiz-option-text">${opt}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    };

    this._quizQuestions = questions;
    this._quizCurrent = currentQ;
    this._quizScore = score;
    this._quizRender = renderQuestion;

    renderQuestion();
  }

  answerQuiz(optionIndex) {
    if (!this.isPlaying) return;
    const q = this._quizQuestions[this._quizCurrent];
    const isCorrect = optionIndex === q.answer;

    // Show result
    const buttons = document.querySelectorAll('.quiz-option');
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('quiz-correct');
      if (i === optionIndex && !isCorrect) btn.classList.add('quiz-wrong');
    });

    if (isCorrect) {
      this._quizScore += 10;
      this.updateScoreDisplay(this._quizScore);
    }

    // Show explanation
    const container = document.querySelector('.quiz-container');
    if (container && q.explanation) {
      const expDiv = document.createElement('div');
      expDiv.className = 'quiz-explanation';
      expDiv.innerHTML = `
        <i data-lucide="${isCorrect ? 'check-circle' : 'x-circle'}"
           style="width:18px;height:18px;color:${isCorrect ? 'var(--success)' : 'var(--danger)'};"></i>
        <span>${q.explanation}</span>
      `;
      container.appendChild(expDiv);
      lucide.createIcons();
    }

    // Next question after delay
    setTimeout(() => {
      this._quizCurrent++;
      this._quizRender();
    }, 2000);
  }

  /* ============================================================
     TIC TAC TOE
     ============================================================ */
  initTicTacToe() {
    const ui = document.getElementById('game-ui');
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';

    let board = Array(9).fill(null);
    let isPlayerTurn = true;
    let gameActive = true;

    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    const checkWin = (b, player) => winPatterns.find(p => p.every(i => b[i] === player));
    const checkDraw = (b) => b.every(cell => cell !== null);

    const aiMove = () => {
      // Simple AI - try to win, block, or pick best spot
      for (const p of winPatterns) {
        const vals = p.map(i => board[i]);
        if (vals.filter(v => v === 'O').length === 2 && vals.includes(null)) {
          return p[vals.indexOf(null)];
        }
      }
      for (const p of winPatterns) {
        const vals = p.map(i => board[i]);
        if (vals.filter(v => v === 'X').length === 2 && vals.includes(null)) {
          return p[vals.indexOf(null)];
        }
      }
      if (board[4] === null) return 4;
      const corners = [0, 2, 6, 8].filter(i => board[i] === null);
      if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
      const empty = board.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
      return empty[Math.floor(Math.random() * empty.length)];
    };

    const render = () => {
      ui.innerHTML = `
        <div class="ttt-container">
          <div class="ttt-status" id="ttt-status">
            ${!gameActive ? '' : isPlayerTurn ? 'Your turn (X)' : 'AI thinking...'}
          </div>
          <div class="ttt-grid">
            ${board.map((cell, i) => `
              <button class="ttt-cell ${cell ? 'ttt-filled' : ''} ${cell === 'X' ? 'ttt-x' : cell === 'O' ? 'ttt-o' : ''}"
                      onclick="gamesManager.tttMove(${i})"
                      ${cell || !isPlayerTurn || !gameActive ? 'disabled' : ''}>
                ${cell ? `<i data-lucide="${cell === 'X' ? 'x' : 'circle'}" style="width:32px;height:32px;"></i>` : ''}
              </button>
            `).join('')}
          </div>
        </div>
      `;
      lucide.createIcons();
    };

    this._tttBoard = board;
    this._tttPlayerTurn = isPlayerTurn;
    this._tttActive = gameActive;
    this._tttRender = render;
    this._tttCheckWin = checkWin;
    this._tttCheckDraw = checkDraw;
    this._tttAiMove = aiMove;

    render();
  }

  tttMove(index) {
    if (!this.isPlaying || !this._tttActive || !this._tttPlayerTurn) return;
    if (this._tttBoard[index] !== null) return;

    this._tttBoard[index] = 'X';
    this._tttPlayerTurn = false;
    this._tttRender();

    const win = this._tttCheckWin(this._tttBoard, 'X');
    if (win) {
      this._tttActive = false;
      this.updateScoreDisplay(this.score + 30);
      setTimeout(() => {
        this.gameOver(this.score);
      }, 600);
      return;
    }

    if (this._tttCheckDraw(this._tttBoard)) {
      this._tttActive = false;
      this.updateScoreDisplay(this.score + 10);
      setTimeout(() => this.gameOver(this.score), 600);
      return;
    }

    // AI move
    setTimeout(() => {
      const move = this._tttAiMove();
      if (move !== undefined) {
        this._tttBoard[move] = 'O';
        this._tttPlayerTurn = true;

        const aiWin = this._tttCheckWin(this._tttBoard, 'O');
        if (aiWin) {
          this._tttActive = false;
          this._tttRender();
          setTimeout(() => this.gameOver(this.score), 600);
          return;
        }

        if (this._tttCheckDraw(this._tttBoard)) {
          this._tttActive = false;
          this.updateScoreDisplay(this.score + 10);
          this._tttRender();
          setTimeout(() => this.gameOver(this.score), 600);
          return;
        }

        this._tttRender();
      }
    }, 500);
  }

  /* ============================================================
     SPEED TYPING GAME
     ============================================================ */
  initTyping() {
    const ui = document.getElementById('game-ui');
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';

    const quote = TYPING_QUOTES[Math.floor(Math.random() * TYPING_QUOTES.length)];
    let startTime = Date.now();
    let finished = false;

    ui.innerHTML = `
      <div class="typing-container">
        <h3 style="font-size:0.9rem;font-weight:700;color:var(--text-heading);margin-bottom:16px;
                    text-align:center;">
          Type the text below as fast as you can!
        </h3>
        <div class="typing-target" id="typing-target">${quote}</div>
        <div class="input-wrap neu-inset" style="margin-top:16px;">
          <textarea id="typing-input" class="form-textarea" rows="3"
                    placeholder="Start typing here..."
                    style="font-size:1rem;line-height:1.8;"></textarea>
        </div>
        <div class="typing-stats" id="typing-stats">
          <span>WPM: <strong>0</strong></span>
          <span>Accuracy: <strong>100%</strong></span>
          <span>Time: <strong>0s</strong></span>
        </div>
      </div>
    `;

    const input = document.getElementById('typing-input');
    const statsEl = document.getElementById('typing-stats');
    const targetEl = document.getElementById('typing-target');

    if (input) {
      input.focus();
      input.addEventListener('input', () => {
        if (finished) return;
        const typed = input.value;
        const elapsed = (Date.now() - startTime) / 1000;
        const words = typed.trim().split(/\s+/).filter(Boolean).length;
        const wpm = elapsed > 0 ? Math.round((words / elapsed) * 60) : 0;

        // Calculate accuracy
        let correct = 0;
        for (let i = 0; i < typed.length && i < quote.length; i++) {
          if (typed[i] === quote[i]) correct++;
        }
        const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;

        // Highlight target
        let highlighted = '';
        for (let i = 0; i < quote.length; i++) {
          if (i < typed.length) {
            if (typed[i] === quote[i]) {
              highlighted += `<span style="color:var(--success);font-weight:600;">${quote[i]}</span>`;
            } else {
              highlighted += `<span style="color:var(--danger);background:var(--danger-light);text-decoration:underline;">${quote[i]}</span>`;
            }
          } else {
            highlighted += quote[i];
          }
        }
        if (targetEl) targetEl.innerHTML = highlighted;

        if (statsEl) {
          statsEl.innerHTML = `
            <span>WPM: <strong>${wpm}</strong></span>
            <span>Accuracy: <strong>${accuracy}%</strong></span>
            <span>Time: <strong>${Math.round(elapsed)}s</strong></span>
          `;
        }

        const score = Math.round(wpm * (accuracy / 100));
        this.updateScoreDisplay(score);

        // Check if complete
        if (typed.length >= quote.length) {
          finished = true;
          input.disabled = true;
          this.gameOver(score);
        }
      });
    }
  }

  /* ============================================================
     FLAPPY BIRD STYLE GAME
     ============================================================ */
  initFlappy() {
    const canvas = this.gameCanvas;
    const ctx = this.gameCtx;

    let birdY = canvas.height / 2;
    let birdVelocity = 0;
    const birdX = 80;
    const birdSize = 18;
    const gravity = 0.45;
    const jumpStrength = -7;
    const pipeWidth = 50;
    const pipeGap = 140;
    const pipeSpeed = 2.5;
    let pipes = [];
    let score = 0;
    let frame = 0;

    const addPipe = () => {
      const minTop = 50;
      const maxTop = canvas.height - pipeGap - 50;
      const topHeight = Math.random() * (maxTop - minTop) + minTop;
      pipes.push({
        x: canvas.width,
        topHeight,
        bottomY: topHeight + pipeGap,
        passed: false
      });
    };

    this._keyHandler = (e) => {
      if (e.code === 'Space' || e.key === 'ArrowUp') {
        e.preventDefault();
        birdVelocity = jumpStrength;
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    canvas.addEventListener('click', () => {
      if (this.isPlaying) birdVelocity = jumpStrength;
    });
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.isPlaying) birdVelocity = jumpStrength;
    });

    addPipe();

    const tick = () => {
      if (!this.isPlaying) return;
      this.animationFrame = requestAnimationFrame(tick);

      frame++;
      birdVelocity += gravity;
      birdY += birdVelocity;

      // Add pipes
      if (frame % 90 === 0) addPipe();

      // Update pipes
      pipes.forEach(pipe => {
        pipe.x -= pipeSpeed;

        if (!pipe.passed && pipe.x + pipeWidth < birdX) {
          pipe.passed = true;
          score++;
          this.updateScoreDisplay(score);
        }
      });
      pipes = pipes.filter(p => p.x > -pipeWidth);

      // Collision detection
      if (birdY < 0 || birdY + birdSize > canvas.height) {
        this.gameOver(score); return;
      }

      for (const pipe of pipes) {
        if (birdX + birdSize > pipe.x && birdX < pipe.x + pipeWidth) {
          if (birdY < pipe.topHeight || birdY + birdSize > pipe.bottomY) {
            this.gameOver(score); return;
          }
        }
      }

      // Draw
      ctx.fillStyle = this.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Pipes
      pipes.forEach(pipe => {
        ctx.fillStyle = this.getColor('success');
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        ctx.fillRect(pipe.x, pipe.bottomY, pipeWidth, canvas.height - pipe.bottomY);

        // Pipe caps
        ctx.fillStyle = this.getColor('success') + 'CC';
        ctx.fillRect(pipe.x - 4, pipe.topHeight - 20, pipeWidth + 8, 20);
        ctx.fillRect(pipe.x - 4, pipe.bottomY, pipeWidth + 8, 20);
      });

      // Bird
      ctx.fillStyle = this.getColor('primary');
      ctx.beginPath();
      ctx.arc(birdX + birdSize / 2, birdY + birdSize / 2, birdSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = this.getColor('white');
      ctx.beginPath();
      ctx.arc(birdX + birdSize / 2 + 4, birdY + birdSize / 2 - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.getColor('dark');
      ctx.beginPath();
      ctx.arc(birdX + birdSize / 2 + 5, birdY + birdSize / 2 - 3, 2, 0, Math.PI * 2);
      ctx.fill();

      // Ground line
      ctx.strokeStyle = this.getColor('secondary');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 1);
      ctx.lineTo(canvas.width, canvas.height - 1);
      ctx.stroke();
    };

    tick();
  }

  /* ============================================================
     BREAKOUT GAME
     ============================================================ */
  initBreakout() {
    const canvas = this.gameCanvas;
    const ctx = this.gameCtx;

    const paddleWidth = 80;
    const paddleHeight = 12;
    let paddleX = canvas.width / 2 - paddleWidth / 2;

    const ballRadius = 8;
    let ballX = canvas.width / 2;
    let ballY = canvas.height - 50;
    let ballDX = 3;
    let ballDY = -3;

    const brickRows = 5;
    const brickCols = Math.floor((canvas.width - 20) / 55);
    const brickWidth = (canvas.width - 20 - (brickCols - 1) * 4) / brickCols;
    const brickHeight = 18;
    const brickPadding = 4;
    const brickTop = 40;
    const brickLeft = 10;

    const brickColors = [
      this.getColor('danger'), this.getColor('warning'),
      this.getColor('success'), this.getColor('primary'), '#9F7AEA'
    ];

    let bricks = [];
    for (let r = 0; r < brickRows; r++) {
      for (let c = 0; c < brickCols; c++) {
        bricks.push({
          x: brickLeft + c * (brickWidth + brickPadding),
          y: brickTop + r * (brickHeight + brickPadding),
          alive: true,
          color: brickColors[r]
        });
      }
    }

    let score = 0;
    let rightPressed = false;
    let leftPressed = false;

    this._keyHandler = (e) => {
      if (e.key === 'ArrowRight') { rightPressed = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { leftPressed = true; e.preventDefault(); }
    };
    this._keyUpHandler = (e) => {
      if (e.key === 'ArrowRight') rightPressed = false;
      if (e.key === 'ArrowLeft') leftPressed = false;
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup', this._keyUpHandler);

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      paddleX = Math.max(0, Math.min(canvas.width - paddleWidth, x - paddleWidth / 2));
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      paddleX = Math.max(0, Math.min(canvas.width - paddleWidth, x - paddleWidth / 2));
    });

    const tick = () => {
      if (!this.isPlaying) return;
      this.animationFrame = requestAnimationFrame(tick);

      // Paddle movement
      if (rightPressed && paddleX < canvas.width - paddleWidth) paddleX += 6;
      if (leftPressed && paddleX > 0) paddleX -= 6;

      // Ball movement
      ballX += ballDX;
      ballY += ballDY;

      // Wall bounce
      if (ballX + ballRadius > canvas.width || ballX - ballRadius < 0) ballDX = -ballDX;
      if (ballY - ballRadius < 0) ballDY = -ballDY;

      // Paddle bounce
      if (
        ballY + ballRadius > canvas.height - paddleHeight - 10 &&
        ballX > paddleX && ballX < paddleX + paddleWidth
      ) {
        ballDY = -Math.abs(ballDY);
        const hitPos = (ballX - paddleX) / paddleWidth;
        ballDX = (hitPos - 0.5) * 8;
      }

      // Bottom death
      if (ballY + ballRadius > canvas.height) {
        this.gameOver(score); return;
      }

      // Brick collision
      bricks.forEach(brick => {
        if (!brick.alive) return;
        if (
          ballX > brick.x && ballX < brick.x + brickWidth &&
          ballY - ballRadius < brick.y + brickHeight && ballY + ballRadius > brick.y
        ) {
          brick.alive = false;
          ballDY = -ballDY;
          score += 10;
          this.updateScoreDisplay(score);
        }
      });

      // Win check
      if (bricks.every(b => !b.alive)) {
        this.gameOver(score + 100); return;
      }

      // Draw
      ctx.fillStyle = this.getColor('bg');
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bricks
      bricks.forEach(brick => {
        if (!brick.alive) return;
        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, brickWidth, brickHeight);
        ctx.strokeStyle = this.getColor('bg');
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x, brick.y, brickWidth, brickHeight);
      });

      // Ball
      ctx.fillStyle = this.getColor('primary');
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
      ctx.fill();

      // Paddle
      ctx.fillStyle = this.getColor('text');
      ctx.fillRect(paddleX, canvas.height - paddleHeight - 10, paddleWidth, paddleHeight);
    };

    tick();
  }

  /* ============================================================
     STUB GAMES (initialize with placeholder)
     ============================================================ */
  initTetris() { this.initStubGame('Block Builder', 'Coming soon! Stack blocks to clear rows.'); }
  initWordle() { this.initStubGame('Rotaract Wordle', 'Coming soon! Guess the Rotary-themed word.'); }
  initPong() { this.initStubGame('Ping Pong', 'Coming soon! Classic pong action.'); }
  init2048() { this.initStubGame('2048 Challenge', 'Coming soon! Merge tiles to reach 2048.'); }
  initMinesweeper() { this.initStubGame('Minesweeper', 'Coming soon! Find all mines safely.'); }

  initStubGame(name, desc) {
    const ui = document.getElementById('game-ui');
    const canvas = this.gameCanvas;
    if (canvas) canvas.style.display = 'none';

    ui.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
                  justify-content:center;padding:60px;text-align:center;gap:16px;">
        <div style="width:80px;height:80px;border-radius:var(--border-radius);
                    background:var(--accent-light);display:flex;align-items:center;
                    justify-content:center;margin-bottom:8px;">
          <i data-lucide="gamepad-2" style="width:40px;height:40px;color:var(--accent);"></i>
        </div>
        <h3 style="font-size:1.2rem;font-weight:700;color:var(--text-heading);">${name}</h3>
        <p style="font-size:0.9rem;color:var(--text-secondary);max-width:300px;line-height:1.6;">
          ${desc}
        </p>
        <button class="btn btn-outline" onclick="gamesManager.backToList()">
          <i data-lucide="arrow-left"></i>
          <span>Back to Games</span>
        </button>
      </div>
    `;
    lucide.createIcons();
  }

  /* ============================================================
     TOUCH CONTROLS HELPER
     ============================================================ */
  setupTouchControls(canvas, callback) {
    let startX = 0, startY = 0;

    canvas.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;

      if (Math.abs(dx) > Math.abs(dy)) {
        callback(dx > 0 ? 'right' : 'left');
      } else {
        callback(dy > 0 ? 'down' : 'up');
      }
    }, { passive: true });
  }

  /* ============================================================
     RANDOM POSITION HELPER
     ============================================================ */
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
  .game-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    cursor: pointer;
    transition: var(--transition);
  }

  .game-card:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: var(--neu-shadow-lg);
  }

  .game-card-icon {
    width: 60px;
    height: 60px;
    border-radius: var(--border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: var(--neu-shadow-sm);
    transition: var(--transition);
  }

  .game-card:hover .game-card-icon {
    background: var(--accent) !important;
  }

  .game-card:hover .game-card-icon svg,
  .game-card:hover .game-card-icon i {
    color: #FFFFFF !important;
  }

  .game-card-info { flex: 1; }

  .game-card-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: 4px;
  }

  .game-card-desc {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .game-card-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .game-difficulty, .game-category, .game-high-score {
    padding: 2px 10px;
    border-radius: var(--border-radius-full);
    font-size: 0.68rem;
    font-weight: 700;
  }

  .game-difficulty-easy { background: var(--success-light); color: var(--success); }
  .game-difficulty-medium { background: var(--warning-light); color: var(--warning); }
  .game-difficulty-hard { background: var(--danger-light); color: var(--danger); }
  .game-category { background: var(--bg-secondary); color: var(--text-muted); }

  .game-high-score {
    background: var(--accent-light);
    color: var(--accent);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .game-card-play {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent-light);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--accent);
    transition: var(--transition);
  }

  .game-card:hover .game-card-play {
    background: var(--accent);
    color: #FFFFFF;
    transform: scale(1.15);
  }

  .game-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .game-title-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .game-title-area h2 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-heading);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .game-title-area h2 svg,
  .game-title-area h2 i {
    width: 22px;
    height: 22px;
    color: var(--accent);
  }

  .game-score-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 20px;
    background: var(--bg-card);
    border-radius: var(--border-radius-sm);
    box-shadow: var(--neu-shadow-sm);
  }

  .game-score-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .game-score-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
  }

  .game-container {
    position: relative;
    background: var(--bg-card);
    border-radius: var(--border-radius);
    box-shadow: var(--neu-shadow);
    overflow: hidden;
    min-height: 300px;
  }

  .game-container canvas {
    display: block;
    width: 100%;
  }

  .game-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .game-overlay-content {
    text-align: center;
    color: #FFFFFF;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .game-overlay-content h3 {
    font-size: 1.6rem;
    font-weight: 800;
  }

  .game-overlay-content p {
    font-size: 0.9rem;
    opacity: 0.8;
    max-width: 300px;
    line-height: 1.6;
  }

  .game-ui {
    padding: 16px;
    min-height: 300px;
  }

  /* Memory Game */
  .memory-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    max-width: 400px;
    margin: 0 auto;
  }

  .memory-card {
    aspect-ratio: 1;
    cursor: pointer;
    perspective: 600px;
  }

  .memory-card-inner {
    width: 100%;
    height: 100%;
    transition: transform 0.5s;
    transform-style: preserve-3d;
    position: relative;
  }

  .memory-card.flipped .memory-card-inner {
    transform: rotateY(180deg);
  }

  .memory-card-front, .memory-card-back {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    box-shadow: var(--neu-shadow-sm);
  }

  .memory-card-front {
    background: var(--accent-light);
    color: var(--accent);
  }

  .memory-card-front svg, .memory-card-front i {
    width: 24px;
    height: 24px;
  }

  .memory-card-back {
    background: var(--bg-card);
    transform: rotateY(180deg);
    color: var(--accent);
  }

  .memory-card-back svg, .memory-card-back i {
    width: 28px;
    height: 28px;
  }

  .memory-card.matched .memory-card-back {
    background: var(--success-light);
    color: var(--success);
  }

  /* Quiz Game */
  .quiz-container { max-width: 500px; margin: 0 auto; }

  .quiz-progress {
    height: 4px;
    background: var(--bg-secondary);
    border-radius: var(--border-radius-full);
    margin-bottom: 16px;
    overflow: hidden;
  }

  .quiz-progress-bar {
    height: 100%;
    background: var(--accent);
    border-radius: var(--border-radius-full);
    transition: width 0.4s ease;
  }

  .quiz-counter {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-bottom: 16px;
    text-align: center;
    font-weight: 600;
  }

  .quiz-question {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: 20px;
    line-height: 1.5;
    text-align: center;
  }

  .quiz-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .quiz-option {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border-radius: var(--border-radius-sm);
    background: var(--bg-card);
    box-shadow: var(--neu-shadow-sm);
    border: 2px solid transparent;
    cursor: pointer;
    transition: var(--transition);
    text-align: left;
    font-family: 'Poppins', sans-serif;
    font-size: 0.88rem;
    color: var(--text-primary);
  }

  .quiz-option:hover:not(:disabled) {
    border-color: var(--accent);
    transform: translateX(4px);
  }

  .quiz-option.quiz-correct {
    border-color: var(--success);
    background: var(--success-light);
    color: var(--success);
  }

  .quiz-option.quiz-wrong {
    border-color: var(--danger);
    background: var(--danger-light);
    color: var(--danger);
  }

  .quiz-option-letter {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent-light);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.82rem;
    flex-shrink: 0;
  }

  .quiz-option-text { flex: 1; }

  .quiz-explanation {
    margin-top: 16px;
    padding: 12px;
    border-radius: var(--border-radius-sm);
    background: var(--bg-secondary);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 0.82rem;
    color: var(--text-secondary);
    animation: fadeIn 0.3s ease;
  }

  /* Tic Tac Toe */
  .ttt-container { max-width: 320px; margin: 0 auto; text-align: center; }

  .ttt-status {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-heading);
    margin-bottom: 16px;
  }

  .ttt-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .ttt-cell {
    aspect-ratio: 1;
    border-radius: var(--border-radius-sm);
    background: var(--bg-card);
    box-shadow: var(--neu-shadow-sm);
    border: 2px solid transparent;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Poppins', sans-serif;
  }

  .ttt-cell:hover:not(:disabled) {
    border-color: var(--accent);
    transform: scale(1.05);
  }

  .ttt-x { color: var(--accent); }
  .ttt-o { color: var(--danger); }

  /* Speed Typing */
  .typing-container { max-width: 550px; margin: 0 auto; }

  .typing-target {
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: var(--border-radius-sm);
    font-size: 1rem;
    line-height: 1.8;
    color: var(--text-secondary);
    box-shadow: var(--neu-inset-sm);
    letter-spacing: 0.02em;
  }

  .typing-stats {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-top: 16px;
    font-size: 0.88rem;
    color: var(--text-secondary);
  }

  .typing-stats strong {
    color: var(--accent);
    font-weight: 800;
  }

  @media (max-width: 480px) {
    .memory-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .game-header { flex-direction: column; align-items: flex-start; }
    .game-score-area { flex-direction: row; gap: 8px; }
    .typing-stats { flex-direction: column; gap: 8px; align-items: center; }
  }
`;

/* ============================================================
   INJECT GAMES STYLES
   ============================================================ */
(function injectGamesStyles() {
  if (!document.getElementById('games-styles')) {
    const style = document.createElement('style');
    style.id = 'games-styles';
    style.textContent = gamesStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
let gamesManager;

document.addEventListener('DOMContentLoaded', () => {
  const gamesGrid = document.getElementById('games-grid');
  if (gamesGrid) {
    gamesManager = new GamesManager();
    window.gamesManager = gamesManager;
  }
});
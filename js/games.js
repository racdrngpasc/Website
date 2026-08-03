/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Games Module — js/games.js
   ============================================================ */

/* ============================================================
   GUARD: prevent double-load crash
   "Identifier already declared" happens when this file is
   loaded twice OR when config.js already declared the same
   const. The guard + using var (not const/let) fixes both.
   ============================================================ */
if (typeof window._RACGAMES !== 'undefined') {
  /* Already loaded — do nothing */
} else {
window._RACGAMES = true;

/* ============================================================
   WORDLE WORDS — only new data not in config.js
   ============================================================ */
var WORDLE_WORDS = [
  'SERVE','PEACE','UNITE','SHARE','LEADS','TRUST',
  'GROWN','HELPS','YOUTH','CLUBS','GRANT','GLOBE',
  'SMILE','LIGHT','BRAVE','FUNDS','WORKS','HANDS',
  'SKILL','TEAMS','BUILD','PROUD','FAITH','DREAM'
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
}());

/* ============================================================
   SCORE HELPERS
   config.js Storage wraps values:
     Storage.set('game_high_scores', obj)
     → localStorage['rac_game_high_scores'] = JSON.stringify({value:obj, timestamp:..., expiry:...})

   Storage.get('game_high_scores')
     → reads ['rac_game_high_scores'] → JSON.parse → returns .value
   ============================================================ */
function _readScores() {
  try {
    /* Storage is from config.js — always available */
    return window.Storage.get('game_high_scores') || {};
  } catch (e) {
    return {};
  }
}

function _writeScores(obj) {
  try {
    window.Storage.set('game_high_scores', obj);
  } catch (e) { /* silent */ }
}

/* ============================================================
   GAMES MANAGER
   ============================================================ */
function GamesManager() {
  this.db             = window.getSupabaseClient ? window.getSupabaseClient() : null;
  this.currentGame    = null;
  this.gameCanvas     = null;
  this.gameCtx        = null;
  this.animationFrame = null;
  this.gameInterval   = null;
  this.isPlaying      = false;
  this.score          = 0;
  this.highScores     = {};
  this._keyHandler    = null;
  this._keyUpHandler  = null;
  this._touchCleanups = [];
  this._resizeHandler = null;

  this._init();
}

var P = GamesManager.prototype;

/* ────────────────────────────────────────────────
   INIT
──────────────────────────────────────────────── */
P._init = function () {
  this._loadScores();
  this._renderList();
};

/* ────────────────────────────────────────────────
   RENDER GAMES LIST
   Reads GAMES_CONFIG from window (set by config.js)
──────────────────────────────────────────────── */
P._renderList = function () {
  var grid = document.getElementById('games-grid');
  if (!grid) return;

  var cfg = window.GAMES_CONFIG;
  if (!cfg || !cfg.length) {
    grid.innerHTML =
      '<p style="color:var(--text-muted);text-align:center;padding:40px;">' +
      'Games configuration not found. Please check config.js.</p>';
    return;
  }

  var self = this;
  var html = '';

  for (var i = 0; i < cfg.length; i++) {
    var g  = cfg[i];
    var hs = this.highScores[g.id] || 0;
    var hsBadge = hs > 0
      ? '<span class="ghighscore">' +
          '<i data-lucide="trophy" style="width:11px;height:11px;"></i> ' + hs +
        '</span>'
      : '';

    html +=
      '<div class="gcard neu-card"' +
           ' data-gid="' + g.id + '"' +
           ' data-gcat="' + (g.category || '') + '">' +
        '<div class="gcard-icon" style="background:var(--accent-light);">' +
          '<i data-lucide="' + g.icon + '"' +
             ' style="width:30px;height:30px;color:var(--accent);"></i>' +
        '</div>' +
        '<div class="gcard-body">' +
          '<div class="gcard-title">' + g.name + '</div>' +
          '<div class="gcard-desc">' + g.description + '</div>' +
          '<div class="gcard-meta">' +
            '<span class="gdiff gdiff-' + (g.difficulty||'medium').toLowerCase() + '">' +
              (g.difficulty || 'Medium') +
            '</span>' +
            '<span class="gcat-badge">' + (g.category || '') + '</span>' +
            hsBadge +
          '</div>' +
        '</div>' +
        '<div class="gcard-arrow">' +
          '<i data-lucide="play" style="width:18px;height:18px;"></i>' +
        '</div>' +
      '</div>';
  }

  grid.innerHTML = html;

  /* Attach click handlers */
  var cards = grid.querySelectorAll('.gcard');
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

/* ────────────────────────────────────────────────
   OPEN / CLOSE GAME
──────────────────────────────────────────────── */
P.openGame = function (gameId) {
  this._stop();
  this.currentGame = gameId;
  this.score       = 0;

  var playArea = document.getElementById('game-play-area');
  var listArea = document.getElementById('games-list-area');
  if (!playArea) return;
  if (listArea) listArea.style.display = 'none';
  playArea.style.display = 'block';

  /* Find game config */
  var cfg  = window.GAMES_CONFIG || [];
  var game = null;
  for (var i = 0; i < cfg.length; i++) {
    if (cfg[i].id === gameId) { game = cfg[i]; break; }
  }
  if (!game) return;

  playArea.innerHTML =
    '<div class="ghdr">' +
      '<button class="btn btn-outline btn-sm" id="g-back">' +
        '<i data-lucide="arrow-left"></i><span>Back</span>' +
      '</button>' +
      '<div class="gtitle-area">' +
        '<h2 class="gtitle">' +
          '<i data-lucide="' + game.icon + '"></i> ' + game.name +
        '</h2>' +
        '<span class="gdiff gdiff-' + (game.difficulty||'medium').toLowerCase() + '">' +
          (game.difficulty||'Medium') +
        '</span>' +
      '</div>' +
      '<div class="gscore-box">' +
        '<span class="gscore-lbl">Score</span>' +
        '<span class="gscore-val" id="g-score">0</span>' +
      '</div>' +
    '</div>' +
    '<div class="gcont" id="g-cont">' +
      '<canvas id="g-canvas" width="480" height="400"></canvas>' +
      '<div class="govl" id="g-ovl">' +
        '<div class="govl-body">' +
          '<h3 id="g-ovl-title">' + game.name + '</h3>' +
          '<p id="g-ovl-text">'   + game.description + '</p>' +
          '<button class="btn btn-primary" id="g-start">' +
            '<i data-lucide="play"></i><span>Start Game</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="g-ui" id="g-ui"></div>' +
    '</div>';

  this.gameCanvas = document.getElementById('g-canvas');
  this.gameCtx    = this.gameCanvas ? this.gameCanvas.getContext('2d') : null;
  this._sizeCanvas();

  var self = this;
  document.getElementById('g-back').addEventListener('click', function () {
    self.backToList();
  });
  document.getElementById('g-start').addEventListener('click', function () {
    self._startGame();
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();

  this._resizeHandler = function () { self._sizeCanvas(); };
  window.addEventListener('resize', this._resizeHandler);
};

P._sizeCanvas = function () {
  var canvas = this.gameCanvas;
  var cont   = document.getElementById('g-cont');
  if (!canvas || !cont) return;
  canvas.width  = Math.min(cont.clientWidth - 4, 600);
  canvas.height = Math.max(280, Math.min(window.innerHeight - 260, 500));
};

P.backToList = function () {
  this._stop();
  var playArea = document.getElementById('game-play-area');
  var listArea = document.getElementById('games-list-area');
  if (playArea) playArea.style.display = 'none';
  if (listArea) listArea.style.display = 'block';
  this.currentGame = null;
  this._renderList(); /* refresh high score badges */
  if (this._resizeHandler) {
    window.removeEventListener('resize', this._resizeHandler);
    this._resizeHandler = null;
  }
};

P._startGame = function () {
  var ovl = document.getElementById('g-ovl');
  if (ovl) ovl.style.display = 'none';
  this.score     = 0;
  this.isPlaying = true;
  this._updateScore(0);

  var map = {
    snake:       '_initSnake',
    memory:      '_initMemory',
    quiz:        '_initQuiz',
    tictactoe:   '_initTTT',
    typing:      '_initTyping',
    flappy:      '_initFlappy',
    breakout:    '_initBreakout',
    wordle:      '_initWordle',
    pong:        '_initPong',
    '2048':      '_init2048',
    minesweeper: '_initMines',
    tetris:      '_initTetris'
  };

  var fn = map[this.currentGame];
  if (fn && typeof this[fn] === 'function') {
    this[fn]();
  } else {
    this._initUnsupported();
  }
};

P._stop = function () {
  this.isPlaying = false;
  if (this.animationFrame) { cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }
  if (this.gameInterval)   { clearInterval(this.gameInterval); this.gameInterval = null; }
  if (this._keyHandler)    { document.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
  if (this._keyUpHandler)  { document.removeEventListener('keyup',   this._keyUpHandler); this._keyUpHandler = null; }
  for (var i = 0; i < this._touchCleanups.length; i++) this._touchCleanups[i]();
  this._touchCleanups = [];
};

P._gameOver = function (finalScore) {
  this.isPlaying = false;
  this._stop();

  finalScore = Math.round(finalScore || 0);
  this._saveScore(this.currentGame, finalScore);
  this._updateScore(finalScore);

  var ovl  = document.getElementById('g-ovl');
  var ttl  = document.getElementById('g-ovl-title');
  var txt  = document.getElementById('g-ovl-text');
  var btn  = document.getElementById('g-start');

  if (ovl) ovl.style.display = 'flex';
  if (ttl) ttl.textContent = 'Game Over!';
  if (txt) {
    var best = this.highScores[this.currentGame] || 0;
    txt.textContent =
      'Your score: ' + finalScore + '. ' +
      (best === finalScore && finalScore > 0 ? 'New high score!' : 'Best: ' + best);
  }
  if (btn) {
    btn.innerHTML = '<i data-lucide="rotate-ccw"></i><span>Play Again</span>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
};

P._updateScore = function (s) {
  this.score = s;
  var el = document.getElementById('g-score');
  if (el) el.textContent = s;
};

/* ────────────────────────────────────────────────
   SCORE PERSISTENCE
──────────────────────────────────────────────── */
P._loadScores = function () {
  this.highScores = _readScores();
};

P._saveScore = function (gameId, score) {
  if (!gameId) return;
  this._loadScores();
  if (!this.highScores[gameId] || score > this.highScores[gameId]) {
    this.highScores[gameId] = score;
    _writeScores(this.highScores);
    /* Supabase best-effort */
    try {
      if (this.db) {
        var cfg   = window.GAMES_CONFIG || [];
        var gName = gameId;
        for (var i = 0; i < cfg.length; i++) {
          if (cfg[i].id === gameId) { gName = cfg[i].name; break; }
        }
        this.db.from('game_scores').insert({
          player_name: 'Guest',
          game_id:     gameId,
          game_name:   gName,
          score:       score
        });
      }
    } catch (e) { /* silent */ }
  }
};

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────── */
P._col = function (name) {
  var d = document.documentElement.getAttribute('data-theme') === 'dark';
  var m = {
    bg:'#1A1B26',     bgL:'#E8E8E8',
    pri:'#4DEEEA',    priL:'#0055FF',
    txt:'#EAEFFB',    txtL:'#3A3A3A',
    sec:'#35374E',    secL:'#BEBEBE',
    danger:'#E53E3E', success:'#38A169',
    warning:'#D69E2E',white:'#FFFFFF',
    dark:'#1A1A1A',   muted:'#666888', mutedL:'#888899'
  };
  var key = name + (d ? '' : 'L');
  return m[key] || m[name] || '#0055FF';
};

P._randPos = function (cols, rows, exclude) {
  var pos, n = 0;
  do {
    pos = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    n++;
    if (n > 2000) break;
  } while (exclude && exclude.some(function (e) { return e.x === pos.x && e.y === pos.y; }));
  return pos;
};

P._rr = function (ctx, x, y, w, h, r) {
  /* cross-browser rounded rect path */
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

P._touch = function (el, cb) {
  if (!el) return;
  var sx = 0, sy = 0;
  var onS = function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
  var onE = function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return;
    if (Math.abs(dx) > Math.abs(dy)) cb(dx > 0 ? 'right' : 'left');
    else                              cb(dy > 0 ? 'down'  : 'up');
  };
  el.addEventListener('touchstart', onS, { passive: true });
  el.addEventListener('touchend',   onE, { passive: true });
  this._touchCleanups.push(function () {
    el.removeEventListener('touchstart', onS);
    el.removeEventListener('touchend',   onE);
  });
};

P._hideCanvas = function () {
  if (this.gameCanvas) this.gameCanvas.style.display = 'none';
  var ui = document.getElementById('g-ui');
  if (ui) ui.style.display = 'block';
};

P._showCanvas = function () {
  if (this.gameCanvas) this.gameCanvas.style.display = 'block';
  var ui = document.getElementById('g-ui');
  if (ui) ui.style.display = 'none';
};

/* ============================================================
   1. SNAKE
============================================================ */
P._initSnake = function () {
  var canvas = this.gameCanvas, ctx = this.gameCtx;
  if (!canvas || !ctx) return;
  this._showCanvas();

  var self = this;
  var GS   = 20;
  var cols = Math.floor(canvas.width  / GS);
  var rows = Math.floor(canvas.height / GS);

  var snake = [{ x: Math.floor(cols/2), y: Math.floor(rows/2) }];
  var dir   = { x:1, y:0 };
  var nDir  = { x:1, y:0 };
  var food  = this._randPos(cols, rows, snake);
  var score = 0;
  var speed = 120;

  this._keyHandler = function (e) {
    var k = e.key;
    if (k==='ArrowUp'    && dir.y!== 1){nDir={x:0,y:-1};e.preventDefault();}
    if (k==='ArrowDown'  && dir.y!==-1){nDir={x:0,y: 1};e.preventDefault();}
    if (k==='ArrowLeft'  && dir.x!== 1){nDir={x:-1,y:0};e.preventDefault();}
    if (k==='ArrowRight' && dir.x!==-1){nDir={x: 1,y:0};e.preventDefault();}
  };
  document.addEventListener('keydown', this._keyHandler);

  this._touch(canvas, function (d) {
    if (d==='up'    && dir.y!== 1) nDir={x:0,y:-1};
    if (d==='down'  && dir.y!==-1) nDir={x:0,y: 1};
    if (d==='left'  && dir.x!== 1) nDir={x:-1,y:0};
    if (d==='right' && dir.x!==-1) nDir={x: 1,y:0};
  });

  var tick = function () {
    if (!self.isPlaying) return;
    dir = { x:nDir.x, y:nDir.y };
    var head = { x:snake[0].x+dir.x, y:snake[0].y+dir.y };

    if (head.x<0||head.x>=cols||head.y<0||head.y>=rows) { self._gameOver(score); return; }
    for (var i=0;i<snake.length;i++) {
      if (snake[i].x===head.x&&snake[i].y===head.y) { self._gameOver(score); return; }
    }
    snake.unshift(head);

    if (head.x===food.x&&head.y===food.y) {
      score+=10;
      self._updateScore(score);
      food=self._randPos(cols,rows,snake);
      if (speed>60) {
        speed-=3;
        clearInterval(self.gameInterval);
        self.gameInterval=setInterval(tick,speed);
      }
    } else {
      snake.pop();
    }

    /* draw */
    ctx.fillStyle=self._col('bg'); ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle=self._col('sec')+'20'; ctx.lineWidth=0.5;
    for(var gx=0;gx<=cols;gx++){ctx.beginPath();ctx.moveTo(gx*GS,0);ctx.lineTo(gx*GS,canvas.height);ctx.stroke();}
    for(var gy=0;gy<=rows;gy++){ctx.beginPath();ctx.moveTo(0,gy*GS);ctx.lineTo(canvas.width,gy*GS);ctx.stroke();}

    ctx.fillStyle=self._col('danger');
    ctx.beginPath();ctx.arc(food.x*GS+GS/2,food.y*GS+GS/2,GS/2-2,0,Math.PI*2);ctx.fill();

    for (var s=0;s<snake.length;s++) {
      var seg=snake[s];
      var alpha=Math.round((1-(s/snake.length)*0.5)*200).toString(16);
      if(alpha.length<2) alpha='0'+alpha;
      ctx.fillStyle = s===0 ? self._col('pri') : self._col('pri')+alpha;
      self._rr(ctx,seg.x*GS+1,seg.y*GS+1,GS-2,GS-2,4); ctx.fill();
      if (s===0) {
        ctx.fillStyle=self._col('bg');
        ctx.beginPath();ctx.arc(seg.x*GS+GS/2+dir.x*4,seg.y*GS+GS/2+dir.y*4,3,0,Math.PI*2);ctx.fill();
      }
    }
  };

  this.gameInterval = setInterval(tick, speed);
};

/* ============================================================
   2. MEMORY MATCH
============================================================ */
P._initMemory = function () {
  this._hideCanvas();
  var ui   = document.getElementById('g-ui');
  if (!ui) return;

  var syms = ['heart','star','globe','shield','award','users','sun','moon','zap','coffee','book','flag'];
  var chosen = syms.slice(0, 8);
  var cards  = chosen.concat(chosen);
  for (var i=cards.length-1;i>0;i--) {
    var j=Math.floor(Math.random()*(i+1)); var t=cards[i]; cards[i]=cards[j]; cards[j]=t;
  }

  this._M = { cards:cards, flipped:[], matched:{}, moves:0, score:0, locked:false, pairs:chosen.length };
  this._drawMemory(ui);
};

P._drawMemory = function (ui) {
  if (!ui) ui = document.getElementById('g-ui');
  if (!ui) return;
  var m    = this._M;
  var self = this;

  var mc = 0;
  var keys = Object.keys(m.matched);
  for (var k=0;k<keys.length;k++) if(m.matched[keys[k]]) mc++;

  var html =
    '<div style="text-align:center;margin-bottom:12px;font-size:0.82rem;color:var(--text-secondary);">' +
      'Moves: <strong>' + m.moves + '</strong> | Matched: <strong>' + Math.floor(mc/2) + '/' + m.pairs + '</strong>' +
    '</div>' +
    '<div class="mem-grid">';

  for (var i=0;i<m.cards.length;i++) {
    var flipped = (m.flipped.indexOf(i)!==-1)||m.matched[i];
    html +=
      '<div class="mem-card'+(flipped?' flipped':'')+(m.matched[i]?' matched':'')+'" data-idx="'+i+'">' +
        '<div class="mem-inner">' +
          '<div class="mem-front"><i data-lucide="help-circle"></i></div>' +
          '<div class="mem-back"><i data-lucide="'+m.cards[i]+'"></i></div>' +
        '</div>' +
      '</div>';
  }
  html += '</div>';
  ui.innerHTML = html;

  var els = ui.querySelectorAll('.mem-card');
  for (var c=0;c<els.length;c++) {
    (function(el){
      el.addEventListener('click',function(){
        self._flipCard(parseInt(el.getAttribute('data-idx'),10));
      });
    })(els[c]);
  }
  if (typeof lucide!=='undefined') lucide.createIcons();
};

P._flipCard = function (idx) {
  if (!this.isPlaying) return;
  var m    = this._M;
  var self = this;
  if (m.locked||m.matched[idx]||m.flipped.indexOf(idx)!==-1) return;

  m.flipped.push(idx);
  this._drawMemory();

  if (m.flipped.length===2) {
    m.moves++; m.locked=true;
    var a=m.flipped[0], b=m.flipped[1];
    if (m.cards[a]===m.cards[b]) {
      m.matched[a]=true; m.matched[b]=true;
      m.score+=20; this._updateScore(m.score);
      m.flipped=[]; m.locked=false;
      this._drawMemory();
      var total=0;
      var ks=Object.keys(m.matched); for(var k=0;k<ks.length;k++) if(m.matched[ks[k]]) total++;
      if (total>=m.cards.length) {
        m.score+=Math.max(0,200-m.moves*5); this._updateScore(m.score);
        setTimeout(function(){self._gameOver(m.score);},600);
      }
    } else {
      setTimeout(function(){m.flipped=[];m.locked=false;self._drawMemory();},900);
    }
  }
};

/* ============================================================
   3. QUIZ
   Uses window.QUIZ_QUESTIONS from config.js
============================================================ */
P._initQuiz = function () {
  this._hideCanvas();
  var ui = document.getElementById('g-ui');
  if (!ui) return;

  var qs = (window.QUIZ_QUESTIONS || []).slice();
  for (var i=qs.length-1;i>0;i--) {
    var j=Math.floor(Math.random()*(i+1)); var t=qs[i]; qs[i]=qs[j]; qs[j]=t;
  }
  this._Q = { qs:qs, cur:0, score:0, answered:false };
  this._drawQuiz();
};

P._drawQuiz = function () {
  var ui = document.getElementById('g-ui');
  if (!ui) return;
  var q    = this._Q;
  var self = this;

  if (q.cur >= q.qs.length) { this._gameOver(q.score); return; }

  var item = q.qs[q.cur];
  var pct  = (q.cur / q.qs.length) * 100;
  var opts = '';

  for (var i=0;i<item.options.length;i++) {
    opts +=
      '<button class="q-opt" data-qi="'+i+'">' +
        '<span class="q-letter">'+String.fromCharCode(65+i)+'</span>' +
        '<span>'+item.options[i]+'</span>' +
      '</button>';
  }

  ui.innerHTML =
    '<div class="quiz-wrap">' +
      '<div class="q-bar"><div class="q-fill" style="width:'+pct+'%;"></div></div>' +
      '<div class="q-ctr">Question '+(q.cur+1)+' of '+q.qs.length+'</div>' +
      '<div class="q-txt">'+item.question+'</div>' +
      '<div class="q-opts" id="q-opts">'+opts+'</div>' +
      '<div id="q-exp"></div>' +
    '</div>';

  var btns = ui.querySelectorAll('.q-opt');
  for (var b=0;b<btns.length;b++) {
    (function(btn){
      btn.addEventListener('click',function(){
        self._answerQuiz(parseInt(btn.getAttribute('data-qi'),10));
      });
    })(btns[b]);
  }
};

P._answerQuiz = function (idx) {
  if (!this.isPlaying) return;
  var q    = this._Q;
  var self = this;
  if (q.answered) return;
  q.answered = true;

  var item = q.qs[q.cur];
  var ok   = idx === item.answer;

  var btns = document.querySelectorAll('.q-opt');
  for (var i=0;i<btns.length;i++) {
    btns[i].disabled = true;
    btns[i].style.pointerEvents = 'none';
    var bi = parseInt(btns[i].getAttribute('data-qi'),10);
    if (bi===item.answer)      btns[i].classList.add('q-correct');
    if (bi===idx && !ok)       btns[i].classList.add('q-wrong');
  }

  if (ok) { q.score+=10; this._updateScore(q.score); }

  var expEl = document.getElementById('q-exp');
  if (expEl && item.explanation) {
    expEl.innerHTML =
      '<div class="q-explanation">' +
        '<i data-lucide="'+(ok?'check-circle':'x-circle')+'" '+
           'style="width:16px;height:16px;color:'+(ok?'var(--success)':'var(--danger)')+'"></i>' +
        '<span>'+item.explanation+'</span>' +
      '</div>';
    if (typeof lucide!=='undefined') lucide.createIcons();
  }

  setTimeout(function(){ q.cur++; q.answered=false; self._drawQuiz(); }, 2200);
};

/* ============================================================
   4. TIC TAC TOE
============================================================ */
P._initTTT = function () {
  this._hideCanvas();
  var ui = document.getElementById('g-ui');
  if (!ui) return;
  this._T = { board:Array(9).fill(null), playerTurn:true, active:true, score:0, W:0, L:0, D:0 };
  this._drawTTT();
};

P._tttWin = function (b, p) {
  var wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(var i=0;i<wins.length;i++) if(b[wins[i][0]]===p&&b[wins[i][1]]===p&&b[wins[i][2]]===p) return true;
  return false;
};

P._tttAI = function (b) {
  var w=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  var i,p,vals,ni,cnt;
  for(i=0;i<w.length;i++){p=w[i];vals=[b[p[0]],b[p[1]],b[p[2]]];cnt=0;ni=-1;
    for(var v=0;v<3;v++){if(vals[v]==='O')cnt++;if(vals[v]===null)ni=v;}
    if(cnt===2&&ni!==-1)return p[ni];}
  for(i=0;i<w.length;i++){p=w[i];vals=[b[p[0]],b[p[1]],b[p[2]]];cnt=0;ni=-1;
    for(var v2=0;v2<3;v2++){if(vals[v2]==='X')cnt++;if(vals[v2]===null)ni=v2;}
    if(cnt===2&&ni!==-1)return p[ni];}
  if(b[4]===null)return 4;
  var c=[0,2,6,8].filter(function(x){return b[x]===null;});
  if(c.length)return c[Math.floor(Math.random()*c.length)];
  var e=[];for(i=0;i<9;i++)if(b[i]===null)e.push(i);
  return e.length?e[Math.floor(Math.random()*e.length)]:-1;
};

P._drawTTT = function () {
  var ui   = document.getElementById('g-ui');
  if (!ui) return;
  var t    = this._T;
  var self = this;

  var status = !t.active?'Game ended':t.playerTurn?'Your turn (X)':'AI thinking...';
  var cells  = '';
  for (var i=0;i<9;i++) {
    var v=t.board[i];
    var cls='ttt-c'+(v?' ttt-f':'')+(v==='X'?' ttt-x':v==='O'?' ttt-o':'');
    var dis=v||!t.playerTurn||!t.active;
    cells+='<button class="'+cls+'" data-ti="'+i+'"'+(dis?' disabled':'')+'>'+
      (v==='X'?'<i data-lucide="x" style="width:28px;height:28px;"></i>':
       v==='O'?'<i data-lucide="circle" style="width:28px;height:28px;"></i>':'')+
      '</button>';
  }

  ui.innerHTML=
    '<div class="ttt-wrap">'+
      '<div class="ttt-score">'+
        '<span style="color:var(--accent)">You: '+t.W+'</span>'+
        '<span style="color:var(--text-muted)">Draw: '+t.D+'</span>'+
        '<span style="color:var(--danger)">AI: '+t.L+'</span>'+
      '</div>'+
      '<div class="ttt-status" id="ttt-st">'+status+'</div>'+
      '<div class="ttt-grid">'+cells+'</div>'+
      (!t.active?'<button class="btn btn-primary" id="ttt-new" style="margin-top:16px;">'+
        '<i data-lucide="rotate-ccw"></i><span>New Round</span></button>':'')+
    '</div>';

  var cs=ui.querySelectorAll('.ttt-c');
  for(var c=0;c<cs.length;c++){
    (function(el){
      el.addEventListener('click',function(){
        self._tttMove(parseInt(el.getAttribute('data-ti'),10));
      });
    })(cs[c]);
  }
  var nb=document.getElementById('ttt-new');
  if(nb) nb.addEventListener('click',function(){self._tttNewRound();});
  if(typeof lucide!=='undefined') lucide.createIcons();
};

P._tttMove = function (i) {
  if(!this.isPlaying) return;
  var t=this._T, self=this;
  if(!t.active||!t.playerTurn||t.board[i]!==null) return;
  t.board[i]='X'; t.playerTurn=false; this._drawTTT();

  if(this._tttWin(t.board,'X')){
    t.active=false;t.W++;t.score+=30;this._updateScore(t.score);
    this._drawTTT();
    var s=document.getElementById('ttt-st');if(s)s.textContent='You Win!';return;
  }
  if(t.board.every(function(c){return c!==null;})){
    t.active=false;t.D++;t.score+=10;this._updateScore(t.score);
    this._drawTTT();var s2=document.getElementById('ttt-st');if(s2)s2.textContent='Draw!';return;
  }

  setTimeout(function(){
    if(!self.isPlaying) return;
    var mv=self._tttAI(t.board);
    if(mv===-1) return;
    t.board[mv]='O';t.playerTurn=true;
    if(self._tttWin(t.board,'O')){
      t.active=false;t.L++;self._drawTTT();
      var s3=document.getElementById('ttt-st');if(s3)s3.textContent='AI Wins!';return;
    }
    if(t.board.every(function(c){return c!==null;})){
      t.active=false;t.D++;t.score+=10;self._updateScore(t.score);
      self._drawTTT();var s4=document.getElementById('ttt-st');if(s4)s4.textContent='Draw!';return;
    }
    self._drawTTT();
  },500);
};

P._tttNewRound = function () {
  if(!this.isPlaying) return;
  this._T.board=Array(9).fill(null);this._T.playerTurn=true;this._T.active=true;
  this._drawTTT();
};

/* ============================================================
   5. SPEED TYPING
   Uses window.TYPING_QUOTES from config.js
============================================================ */
P._initTyping = function () {
  this._hideCanvas();
  var ui=document.getElementById('g-ui');if(!ui)return;
  var quotes = window.TYPING_QUOTES || ['Service Above Self is the motto of Rotary International.'];
  var quote  = quotes[Math.floor(Math.random()*quotes.length)];
  var start  = Date.now();
  var done   = false;
  var self   = this;

  ui.innerHTML=
    '<div class="type-wrap">'+
      '<h3 style="font-size:0.9rem;font-weight:700;color:var(--text-heading);margin-bottom:16px;text-align:center;">'+
        'Type the text below as fast as you can!'+
      '</h3>'+
      '<div class="type-target" id="type-tgt">'+quote+'</div>'+
      '<textarea id="type-inp" rows="3" placeholder="Start typing here..." '+
        'style="width:100%;margin-top:12px;padding:12px;border-radius:8px;'+
        'border:2px solid var(--border);background:var(--bg-card);'+
        'color:var(--text-primary);font-family:Poppins,sans-serif;'+
        'font-size:1rem;line-height:1.8;resize:none;outline:none;'+
        'box-sizing:border-box;transition:border-color 0.2s;"></textarea>'+
      '<div class="type-stats">'+
        '<span>WPM: <strong id="st-wpm">0</strong></span>'+
        '<span>Accuracy: <strong id="st-acc">100%</strong></span>'+
        '<span>Time: <strong id="st-tim">0s</strong></span>'+
      '</div>'+
    '</div>';

  var inp=document.getElementById('type-inp');
  var tgt=document.getElementById('type-tgt');
  if(!inp) return;
  inp.focus();
  inp.addEventListener('focus',function(){inp.style.borderColor='var(--accent)';});
  inp.addEventListener('blur', function(){inp.style.borderColor='var(--border)';});

  inp.addEventListener('input',function(){
    if(done||!self.isPlaying) return;
    var typed=inp.value;
    var elapsed=Math.max(1,(Date.now()-start)/1000);
    var words=typed.trim()===''?0:typed.trim().split(/\s+/).length;
    var wpm=Math.round((words/elapsed)*60);
    var correct=0;
    for(var i=0;i<Math.min(typed.length,quote.length);i++) if(typed[i]===quote[i]) correct++;
    var acc=typed.length>0?Math.round((correct/typed.length)*100):100;

    var hl='';
    for(var h=0;h<quote.length;h++){
      var ch=quote[h]===' '?'&nbsp;':quote[h];
      if(h<typed.length){
        if(typed[h]===quote[h]) hl+='<span style="color:var(--success);font-weight:600;">'+ch+'</span>';
        else hl+='<span style="color:var(--danger);background:rgba(229,62,62,0.15);">'+ch+'</span>';
      } else {
        hl+=quote[h]===' '?' ':quote[h];
      }
    }
    if(tgt) tgt.innerHTML=hl;

    var wEl=document.getElementById('st-wpm');
    var aEl=document.getElementById('st-acc');
    var tEl=document.getElementById('st-tim');
    if(wEl)wEl.textContent=wpm;
    if(aEl)aEl.textContent=acc+'%';
    if(tEl)tEl.textContent=Math.round(elapsed)+'s';

    var sc=Math.round(wpm*(acc/100));
    self._updateScore(sc);
    if(typed.length>=quote.length){done=true;inp.disabled=true;setTimeout(function(){self._gameOver(sc);},500);}
  });
};

/* ============================================================
   6. FLAPPY BIRD
============================================================ */
P._initFlappy = function () {
  var canvas=this.gameCanvas,ctx=this.gameCtx;
  if(!canvas||!ctx) return;
  this._showCanvas();

  var self=this;
  var by=canvas.height/2, bv=0;
  var bx=80, bs=18, g=0.45, js=-7.5;
  var pw=52, pg=145, ps=2.5;
  var pipes=[], score=0, frame=0;

  var addP=function(){
    var mn=60,mx=canvas.height-pg-60;
    pipes.push({x:canvas.width,topH:Math.random()*(mx-mn)+mn,passed:false});
  };
  var jump=function(){if(self.isPlaying)bv=js;};

  this._keyHandler=function(e){if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();jump();}};
  document.addEventListener('keydown',this._keyHandler);
  var ch=function(){jump();};
  var th=function(e){e.preventDefault();jump();};
  canvas.addEventListener('click',ch);
  canvas.addEventListener('touchstart',th,{passive:false});
  this._touchCleanups.push(function(){canvas.removeEventListener('click',ch);canvas.removeEventListener('touchstart',th);});

  addP();

  var tick=function(){
    if(!self.isPlaying) return;
    self.animationFrame=requestAnimationFrame(tick);
    frame++;bv+=g;by+=bv;
    if(frame%90===0) addP();

    var np=[];
    for(var p=0;p<pipes.length;p++){
      pipes[p].x-=ps;
      if(!pipes[p].passed&&pipes[p].x+pw<bx){pipes[p].passed=true;score++;self._updateScore(score);}
      if(pipes[p].x>-pw-10) np.push(pipes[p]);
    }
    pipes=np;

    if(by<0||by+bs>canvas.height){self._gameOver(score);return;}
    for(var c=0;c<pipes.length;c++){
      var pp=pipes[c],bot=pp.topH+pg;
      if(bx+bs-4>pp.x&&bx+4<pp.x+pw&&(by+4<pp.topH||by+bs-4>bot)){self._gameOver(score);return;}
    }

    ctx.fillStyle=self._col('bg');ctx.fillRect(0,0,canvas.width,canvas.height);
    var pc=self._col('success');
    for(var d=0;d<pipes.length;d++){
      var pi=pipes[d],by2=pi.topH+pg;
      ctx.fillStyle=pc;ctx.fillRect(pi.x,0,pw,pi.topH);ctx.fillRect(pi.x,by2,pw,canvas.height-by2);
      ctx.fillStyle=pc+'CC';ctx.fillRect(pi.x-5,pi.topH-22,pw+10,22);ctx.fillRect(pi.x-5,by2,pw+10,22);
    }
    ctx.fillStyle=self._col('pri');ctx.beginPath();ctx.arc(bx+bs/2,by+bs/2,bs/2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=self._col('white');ctx.beginPath();ctx.arc(bx+bs/2+5,by+bs/2-3,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=self._col('dark');ctx.beginPath();ctx.arc(bx+bs/2+6,by+bs/2-3,2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=self._col('txt')+'CC';ctx.font='bold 18px Poppins,sans-serif';
    ctx.textAlign='center';ctx.fillText(''+score,canvas.width/2,30);ctx.textAlign='start';
    ctx.strokeStyle=self._col('sec');ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,canvas.height-1);ctx.lineTo(canvas.width,canvas.height-1);ctx.stroke();
  };
  tick();
};

/* ============================================================
   7. BREAKOUT
============================================================ */
P._initBreakout = function () {
  var canvas=this.gameCanvas,ctx=this.gameCtx;
  if(!canvas||!ctx) return;
  this._showCanvas();

  var self=this;
  var pw=90,ph=12,px=canvas.width/2-45;
  var br=8,bx=canvas.width/2,by2=canvas.height-60,bdx=3.5,bdy=-3.5;
  var lives=3,score=0;

  var bR=5,bC=Math.floor((canvas.width-20)/58);
  var bW=(canvas.width-20-(bC-1)*4)/bC,bH=18,bPad=4,bTop=40,bLeft=10;
  var rc=[self._col('danger'),self._col('warning'),self._col('success'),self._col('pri'),'#9F7AEA'];
  var bricks=[];
  for(var r=0;r<bR;r++) for(var c=0;c<bC;c++)
    bricks.push({x:bLeft+c*(bW+bPad),y:bTop+r*(bH+bPad),alive:true,color:rc[r]});

  var rP=false,lP=false;
  this._keyHandler=function(e){if(e.key==='ArrowRight'){rP=true;e.preventDefault();}if(e.key==='ArrowLeft'){lP=true;e.preventDefault();}};
  this._keyUpHandler=function(e){if(e.key==='ArrowRight')rP=false;if(e.key==='ArrowLeft')lP=false;};
  document.addEventListener('keydown',this._keyHandler);
  document.addEventListener('keyup',this._keyUpHandler);

  var mmH=function(e){var rect=canvas.getBoundingClientRect();px=Math.max(0,Math.min(canvas.width-pw,(e.clientX-rect.left)*(canvas.width/rect.width)-pw/2));};
  var tmH=function(e){e.preventDefault();var rect=canvas.getBoundingClientRect();px=Math.max(0,Math.min(canvas.width-pw,(e.touches[0].clientX-rect.left)*(canvas.width/rect.width)-pw/2));};
  canvas.addEventListener('mousemove',mmH);
  canvas.addEventListener('touchmove',tmH,{passive:false});
  this._touchCleanups.push(function(){canvas.removeEventListener('mousemove',mmH);canvas.removeEventListener('touchmove',tmH);});

  var tick=function(){
    if(!self.isPlaying) return;
    self.animationFrame=requestAnimationFrame(tick);
    if(rP&&px<canvas.width-pw)px+=7;if(lP&&px>0)px-=7;
    bx+=bdx;by2+=bdy;
    if(bx+br>canvas.width||bx-br<0)bdx=-bdx;if(by2-br<0)bdy=-bdy;

    var padTop=canvas.height-ph-10;
    if(by2+br>=padTop&&by2+br<=padTop+ph+Math.abs(bdy)&&bx>=px&&bx<=px+pw){
      bdy=-Math.abs(bdy);bdx=((bx-px)/pw-0.5)*9;
    }
    if(by2+br>canvas.height){lives--;if(lives<=0){self._gameOver(score);return;}bx=canvas.width/2;by2=canvas.height-60;bdx=3.5;bdy=-3.5;}

    var allD=true;
    for(var b=0;b<bricks.length;b++){
      var bk=bricks[b];if(!bk.alive)continue;allD=false;
      if(bx+br>bk.x&&bx-br<bk.x+bW&&by2+br>bk.y&&by2-br<bk.y+bH){
        var oL=bx+br-bk.x,oR=bk.x+bW-(bx-br),oT=by2+br-bk.y,oB=bk.y+bH-(by2-br);
        var mO=Math.min(oL,oR,oT,oB);
        if(mO===oT||mO===oB)bdy=-bdy;else bdx=-bdx;
        bk.alive=false;score+=10;self._updateScore(score);break;
      }
    }
    if(allD){self._gameOver(score+100);return;}

    ctx.fillStyle=self._col('bg');ctx.fillRect(0,0,canvas.width,canvas.height);
    for(var d=0;d<bricks.length;d++){
      if(!bricks[d].alive)continue;
      ctx.fillStyle=bricks[d].color;ctx.fillRect(bricks[d].x,bricks[d].y,bW,bH);
      ctx.strokeStyle=self._col('bg');ctx.lineWidth=1;ctx.strokeRect(bricks[d].x,bricks[d].y,bW,bH);
    }
    ctx.fillStyle=self._col('pri');ctx.beginPath();ctx.arc(bx,by2,br,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=self._col('txt');self._rr(ctx,px,padTop,pw,ph,6);ctx.fill();
    ctx.fillStyle=self._col('txt')+'CC';ctx.font='bold 13px Poppins,sans-serif';
    var lstr='Lives: ';for(var lv=0;lv<lives;lv++)lstr+='* ';ctx.fillText(lstr.trim(),8,20);
  };
  tick();
};

/* ============================================================
   8. WORDLE
============================================================ */
P._initWordle = function () {
  this._hideCanvas();
  var ui=document.getElementById('g-ui');if(!ui)return;
  this._W={word:WORDLE_WORDS[Math.floor(Math.random()*WORDLE_WORDS.length)],guesses:[],cur:'',max:6,won:false,lost:false};
  this._drawWordle();this._wKeys();
};

P._wStates = function () {
  var w=this._W,st={};
  for(var g=0;g<w.guesses.length;g++){
    var guess=w.guesses[g];
    for(var i=0;i<5;i++){
      var l=guess[i];if(!l)continue;
      if(l===w.word[i]) st[l]='correct';
      else if(w.word.indexOf(l)!==-1&&st[l]!=='correct') st[l]='present';
      else if(w.word.indexOf(l)===-1&&!st[l]) st[l]='absent';
    }
  }
  return st;
};

P._drawWordle = function () {
  var ui=document.getElementById('g-ui');if(!ui)return;
  var w=this._W,self=this;

  var grid='<div class="wgrid">';
  for(var r=0;r<w.max;r++){
    var guess=w.guesses[r]||'';
    var isA=(r===w.guesses.length&&!w.won&&!w.lost);
    var disp=isA?w.cur:guess;
    grid+='<div class="wrow">';
    for(var c=0;c<5;c++){
      var cls='wcell',letter=disp[c]||'';
      if(r<w.guesses.length&&guess[c]){
        if(guess[c]===w.word[c])cls+=' wcc';
        else if(w.word.indexOf(guess[c])!==-1)cls+=' wcp';
        else cls+=' wca';
      }else if(isA&&letter)cls+=' wca-cur';
      grid+='<div class="'+cls+'">'+letter+'</div>';
    }
    grid+='</div>';
  }
  grid+='</div>';

  var msg='';
  if(w.won) msg='<div class="wm wm-ok">Brilliant! Word was <strong>'+w.word+'</strong></div>';
  if(w.lost)msg='<div class="wm wm-no">Word was <strong>'+w.word+'</strong>. Try again!</div>';

  var krows=[['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['ENTER','Z','X','C','V','B','N','M','DEL']];
  var sts=this._wStates();
  var kb='<div class="wkb">';
  for(var kr=0;kr<krows.length;kr++){
    kb+='<div class="wkr">';
    for(var kc=0;kc<krows[kr].length;kc++){
      var key=krows[kr][kc];
      var kcls='wk'+(key==='ENTER'||key==='DEL'?' wk-wide':'')+' wks-'+(sts[key]||'');
      kb+='<button class="'+kcls+'" data-wk="'+key+'">'+key+'</button>';
    }
    kb+='</div>';
  }
  kb+='</div>';

  ui.innerHTML='<div class="wordle-wrap"><div style="text-align:center;margin-bottom:8px;font-size:0.8rem;color:var(--text-muted);font-weight:600;">Guess the 5-letter word!</div>'+grid+msg+kb+'</div>';

  var kbs=ui.querySelectorAll('.wk');
  for(var k=0;k<kbs.length;k++){
    (function(btn){btn.addEventListener('click',function(){self._wKey(btn.getAttribute('data-wk'));});})(kbs[k]);
  }
};

P._wKeys = function () {
  var self=this;
  this._keyHandler=function(e){
    if(!self.isPlaying) return;
    var w=self._W;if(w.won||w.lost) return;
    var k=e.key.toUpperCase();
    if(k==='ENTER'){self._wKey('ENTER');e.preventDefault();}
    else if(k==='BACKSPACE'){self._wKey('DEL');e.preventDefault();}
    else if(/^[A-Z]$/.test(k)) self._wKey(k);
  };
  document.addEventListener('keydown',this._keyHandler);
};

P._wKey = function (key) {
  if(!this.isPlaying) return;
  var w=this._W,self=this;
  if(w.won||w.lost) return;
  if(key==='DEL'||key==='BACKSPACE'){w.cur=w.cur.slice(0,-1);}
  else if(key==='ENTER'){
    if(w.cur.length<5){
      var rows=document.querySelectorAll('.wrow');var ar=rows[w.guesses.length];
      if(ar){ar.classList.add('wshake');setTimeout(function(){ar.classList.remove('wshake');},500);}
      return;
    }
    w.guesses.push(w.cur);
    if(w.cur===w.word){
      w.won=true;var sc=100+(w.max-w.guesses.length+1)*20;this._updateScore(sc);
      this._drawWordle();setTimeout(function(){self._gameOver(sc);},1500);return;
    }
    if(w.guesses.length>=w.max){
      w.lost=true;this._drawWordle();setTimeout(function(){self._gameOver(0);},1500);return;
    }
    w.cur='';
  }else if(/^[A-Z]$/.test(key)&&w.cur.length<5){w.cur+=key;}
  this._drawWordle();
};

/* ============================================================
   9. PONG
============================================================ */
P._initPong = function () {
  var canvas=this.gameCanvas,ctx=this.gameCtx;
  if(!canvas||!ctx)return;
  this._showCanvas();
  var self=this;
  var ph=70,pw=10,bs=10,win=7;
  var py=canvas.height/2-ph/2,ay=canvas.height/2-ph/2;
  var bx=canvas.width/2,by=canvas.height/2,bdx=4,bdy=3;
  var pSc=0,aSc=0,aiSpd=3.2;
  var uP=false,dP=false;

  this._keyHandler=function(e){if(e.key==='ArrowUp'||e.key==='w'||e.key==='W'){uP=true;e.preventDefault();}if(e.key==='ArrowDown'||e.key==='s'||e.key==='S'){dP=true;e.preventDefault();}};
  this._keyUpHandler=function(e){if(e.key==='ArrowUp'||e.key==='w'||e.key==='W')uP=false;if(e.key==='ArrowDown'||e.key==='s'||e.key==='S')dP=false;};
  document.addEventListener('keydown',this._keyHandler);
  document.addEventListener('keyup',this._keyUpHandler);

  var tmH=function(e){e.preventDefault();var rect=canvas.getBoundingClientRect();py=Math.max(0,Math.min(canvas.height-ph,(e.touches[0].clientY-rect.top)*(canvas.height/rect.height)-ph/2));};
  canvas.addEventListener('touchmove',tmH,{passive:false});
  this._touchCleanups.push(function(){canvas.removeEventListener('touchmove',tmH);});

  var reset=function(){bx=canvas.width/2;by=canvas.height/2;bdx=(Math.random()>0.5?1:-1)*4;bdy=(Math.random()>0.5?1:-1)*3;};

  var tick=function(){
    if(!self.isPlaying)return;
    self.animationFrame=requestAnimationFrame(tick);
    if(uP&&py>0)py-=6;if(dP&&py<canvas.height-ph)py+=6;
    var ac=ay+ph/2;if(ac<by-5)ay=Math.min(canvas.height-ph,ay+aiSpd);if(ac>by+5)ay=Math.max(0,ay-aiSpd);
    bx+=bdx;by+=bdy;
    if(by-bs/2<0||by+bs/2>canvas.height)bdy=-bdy;
    if(bx-bs/2<pw+20&&by>py&&by<py+ph&&bdx<0){bdx=Math.abs(bdx)*1.05;bdy=((by-py)/ph-0.5)*8;}
    if(bx+bs/2>canvas.width-pw-20&&by>ay&&by<ay+ph&&bdx>0){bdx=-Math.abs(bdx)*1.05;bdy=((by-ay)/ph-0.5)*8;}
    bdx=Math.max(-10,Math.min(10,bdx));bdy=Math.max(-8,Math.min(8,bdy));
    if(bx<0){aSc++;if(aSc>=win){self._gameOver(pSc*10);return;}reset();}
    if(bx>canvas.width){pSc++;self._updateScore(pSc*10);if(pSc>=win){self._gameOver(pSc*15);return;}reset();}

    ctx.fillStyle=self._col('bg');ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.setLineDash([10,10]);ctx.strokeStyle=self._col('sec')+'60';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(canvas.width/2,0);ctx.lineTo(canvas.width/2,canvas.height);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=self._col('pri');self._rr(ctx,10,py,pw,ph,5);ctx.fill();
    ctx.fillStyle=self._col('danger');self._rr(ctx,canvas.width-pw-10,ay,pw,ph,5);ctx.fill();
    ctx.fillStyle=self._col('txt');ctx.beginPath();ctx.arc(bx,by,bs/2,0,Math.PI*2);ctx.fill();
    ctx.font='bold 28px Poppins,sans-serif';ctx.textAlign='center';
    ctx.fillText(''+pSc,canvas.width/2-36,40);ctx.fillText(''+aSc,canvas.width/2+36,40);
    ctx.font='bold 10px Poppins,sans-serif';ctx.fillStyle=self._col('muted');
    ctx.fillText('YOU',canvas.width/2-36,56);ctx.fillText('AI',canvas.width/2+36,56);ctx.textAlign='start';
  };
  tick();
};

/* ============================================================
   10. 2048
============================================================ */
P._init2048 = function () {
  this._hideCanvas();
  var ui=document.getElementById('g-ui');if(!ui)return;
  var self=this,SZ=4;

  var ng=function(){var g=[];for(var r=0;r<SZ;r++){var row=[];for(var c=0;c<SZ;c++)row.push(0);g.push(row);}return g;};
  var ar=function(g){var e=[];for(var r=0;r<SZ;r++)for(var c=0;c<SZ;c++)if(!g[r][c])e.push([r,c]);if(!e.length)return;var cell=e[Math.floor(Math.random()*e.length)];g[cell[0]][cell[1]]=Math.random()<0.9?2:4;};
  var rot=function(g){var n=ng();for(var r=0;r<SZ;r++)for(var c=0;c<SZ;c++)n[c][SZ-1-r]=g[r][c];return n;};
  var slide=function(row){var a=[],pts=0;for(var i=0;i<row.length;i++)if(row[i])a.push(row[i]);for(var j=0;j<a.length-1;j++)if(a[j]===a[j+1]){a[j]*=2;pts+=a[j];a.splice(j+1,1);}while(a.length<SZ)a.push(0);return{row:a,pts:pts};};
  var hasMoves=function(g){for(var r=0;r<SZ;r++)for(var c=0;c<SZ;c++){if(!g[r][c])return true;if(c<SZ-1&&g[r][c]===g[r][c+1])return true;if(r<SZ-1&&g[r][c]===g[r+1][c])return true;}return false;};

  var grid=ng(),score=0;ar(grid);ar(grid);
  this._G48={grid:grid,score:score};

  var move=function(dir){
    var gd=self._G48,rots={left:0,right:2,up:3,down:1}[dir]||0;
    var moved=false,pts=0;
    var temp=[];for(var r=0;r<SZ;r++)temp.push(gd.grid[r].slice());
    for(var i=0;i<rots;i++)temp=rot(temp);
    for(var row=0;row<SZ;row++){var res=slide(temp[row]);pts+=res.pts;if(JSON.stringify(temp[row])!==JSON.stringify(res.row))moved=true;temp[row]=res.row;}
    for(var j=0;j<(4-rots)%4;j++)temp=rot(temp);
    if(moved){gd.grid=temp;gd.score+=pts;score=gd.score;ar(gd.grid);self._updateScore(score);self._draw2048();
      var has=false;for(var r2=0;r2<SZ;r2++)for(var c2=0;c2<SZ;c2++)if(gd.grid[r2][c2]===2048)has=true;
      if(has){setTimeout(function(){self._gameOver(score+500);},300);return;}
      if(!hasMoves(gd.grid)){setTimeout(function(){self._gameOver(score);},300);}
    }
  };
  this._48move=move;

  this._keyHandler=function(e){if(!self.isPlaying)return;var m={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(m[e.key]){e.preventDefault();move(m[e.key]);}};
  document.addEventListener('keydown',this._keyHandler);
  this._touch(ui,function(d){move(d);});
  this._draw2048();
};

P._draw2048 = function () {
  var ui=document.getElementById('g-ui');if(!ui)return;
  var gd=this._G48,self=this;
  var tc={0:{bg:'#cdc1b4',fg:'#cdc1b4'},2:{bg:'#eee4da',fg:'#776e65'},4:{bg:'#ede0c8',fg:'#776e65'},
    8:{bg:'#f2b179',fg:'#f9f6f2'},16:{bg:'#f59563',fg:'#f9f6f2'},32:{bg:'#f67c5f',fg:'#f9f6f2'},
    64:{bg:'#f65e3b',fg:'#f9f6f2'},128:{bg:'#edcf72',fg:'#f9f6f2'},256:{bg:'#edcc61',fg:'#f9f6f2'},
    512:{bg:'#edc850',fg:'#f9f6f2'},1024:{bg:'#edc53f',fg:'#f9f6f2'},2048:{bg:'#edc22e',fg:'#f9f6f2'}};

  var cells='';
  for(var r=0;r<4;r++)for(var c=0;c<4;c++){
    var v=gd.grid[r][c],cl=tc[v]||tc[2048];
    var fs=v>=1024?'1rem':v>=128?'1.2rem':'1.4rem';
    cells+='<div class="g48cell" style="background:'+cl.bg+';color:'+cl.fg+';font-size:'+fs+';">'+(v||'')+'</div>';
  }

  ui.innerHTML='<div class="g48wrap">'+
    '<div style="text-align:center;margin-bottom:12px;font-size:0.82rem;color:var(--text-muted);font-weight:600;">Arrow keys or swipe to merge tiles!</div>'+
    '<div class="g48grid">'+cells+'</div>'+
    '<div style="display:flex;justify-content:center;gap:12px;margin-top:16px;flex-wrap:wrap;">'+
      '<button class="g48btn" data-d="up">&#9650;</button>'+
      '<button class="g48btn" data-d="left">&#9664;</button>'+
      '<button class="g48btn" data-d="down">&#9660;</button>'+
      '<button class="g48btn" data-d="right">&#9654;</button>'+
    '</div>'+
  '</div>';

  var dbs=ui.querySelectorAll('.g48btn');
  for(var d=0;d<dbs.length;d++){
    (function(btn){btn.addEventListener('click',function(){self._48move(btn.getAttribute('data-d'));});})(dbs[d]);
  }
};

/* ============================================================
   11. MINESWEEPER
============================================================ */
P._initMines = function () {
  this._hideCanvas();
  var ui=document.getElementById('g-ui');if(!ui)return;
  var R=9,C=9,M=10;
  var dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var board=[];
  for(var r=0;r<R;r++){var row=[];for(var c=0;c<C;c++)row.push({r:r,c:c,mine:false,revealed:false,flagged:false,adj:0});board.push(row);}
  var placed=0;while(placed<M){var mr=Math.floor(Math.random()*R),mc=Math.floor(Math.random()*C);if(!board[mr][mc].mine){board[mr][mc].mine=true;placed++;}}
  var recalc=function(){for(var r2=0;r2<R;r2++)for(var c2=0;c2<C;c2++){if(board[r2][c2].mine){board[r2][c2].adj=0;continue;}var cnt=0;for(var d=0;d<dirs.length;d++){var nr=r2+dirs[d][0],nc=c2+dirs[d][1];if(nr>=0&&nr<R&&nc>=0&&nc<C&&board[nr][nc].mine)cnt++;}board[r2][c2].adj=cnt;}};
  recalc();
  this._MS={board:board,R:R,C:C,M:M,revealed:0,flagged:0,first:true,won:false,lost:false,score:0,dirs:dirs,recalc:recalc};
  this._drawMines();
};

P._drawMines = function () {
  var ui=document.getElementById('g-ui');if(!ui)return;
  var ms=this._MS,self=this;
  var ac=['','#1976D2','#388E3C','#D32F2F','#7B1FA2','#F57F17','#0097A7','#212121','#757575'];
  var safe=ms.R*ms.C-ms.M;
  var rem=ms.M-ms.flagged;
  var si=ms.won?'check-circle':ms.lost?'x-circle':'play';
  var st=ms.won?'You Win!':ms.lost?'Boom!':'Playing';

  var grid='<div class="mgrid" style="grid-template-columns:repeat('+ms.C+',1fr);">';
  for(var r=0;r<ms.R;r++)for(var c=0;c<ms.C;c++){
    var cell=ms.board[r][c],cont='',cls='mcell';
    if(ms.lost&&cell.mine&&!cell.flagged){cls+=' mcell-mine';cont='<i data-lucide="crosshair" style="width:13px;height:13px;"></i>';}
    else if(cell.flagged){cls+=' mcell-flag';cont='<i data-lucide="flag" style="width:13px;height:13px;color:var(--danger);"></i>';}
    else if(!cell.revealed){cls+=' mcell-hid';}
    else if(cell.mine){cls+=' mcell-mine';cont='<i data-lucide="crosshair" style="width:13px;height:13px;"></i>';}
    else{cls+=' mcell-rev';if(cell.adj>0)cont='<span style="color:'+ac[cell.adj]+';font-weight:800;">'+cell.adj+'</span>';}
    grid+='<div class="'+cls+'" data-mr="'+r+'" data-mc="'+c+'">'+cont+'</div>';
  }
  grid+='</div>';

  var ab=(ms.won||ms.lost)?'<button class="btn btn-primary" id="ms-rst" style="display:block;margin:12px auto 0;"><i data-lucide="rotate-ccw"></i><span>New Game</span></button>':'';

  ui.innerHTML='<div class="mswrap">'+
    '<div class="mshdr">'+
      '<span><i data-lucide="crosshair" style="width:12px;height:12px;vertical-align:middle;"></i> '+rem+' left</span>'+
      '<span><i data-lucide="'+si+'" style="width:12px;height:12px;vertical-align:middle;"></i> '+st+'</span>'+
      '<span><i data-lucide="check-circle" style="width:12px;height:12px;vertical-align:middle;"></i> '+ms.revealed+'/'+safe+'</span>'+
    '</div>'+
    grid+
    '<p style="text-align:center;font-size:0.72rem;color:var(--text-muted);margin-top:10px;">Click to reveal | Right-click/long-press to flag</p>'+
    ab+
  '</div>';

  var cells=ui.querySelectorAll('.mcell');
  for(var i=0;i<cells.length;i++){
    (function(el){
      var cr=parseInt(el.getAttribute('data-mr'),10),cc=parseInt(el.getAttribute('data-mc'),10);
      el.addEventListener('click',function(){self._msReveal(cr,cc);});
      el.addEventListener('contextmenu',function(e){e.preventDefault();self._msFlag(cr,cc);});
      var tmr=null;
      el.addEventListener('touchstart',function(e){tmr=setTimeout(function(){e.preventDefault();self._msFlag(cr,cc);},500);},{passive:false});
      el.addEventListener('touchend',function(){clearTimeout(tmr);});
      el.addEventListener('touchmove',function(){clearTimeout(tmr);});
    })(cells[i]);
  }
  var rb=document.getElementById('ms-rst');
  if(rb)rb.addEventListener('click',function(){self._initMines();});
  if(typeof lucide!=='undefined')lucide.createIcons();
};

P._msReveal = function (r, c) {
  if(!this.isPlaying)return;
  var ms=this._MS,cell=ms.board[r][c];
  if(ms.lost||ms.won||cell.revealed||cell.flagged)return;

  if(ms.first&&cell.mine){
    cell.mine=false;var rel=false;
    for(var fr=0;fr<ms.R&&!rel;fr++)for(var fc=0;fc<ms.C&&!rel;fc++)
      if(!ms.board[fr][fc].mine&&!(fr===r&&fc===c)){ms.board[fr][fc].mine=true;rel=true;}
    ms.recalc();
  }
  ms.first=false;

  if(cell.mine){cell.revealed=true;ms.lost=true;this._drawMines();this._gameOver(ms.score);return;}

  var stack=[[r,c]];
  while(stack.length>0){
    var pos=stack.pop(),pr=pos[0],pc=pos[1];
    var b=ms.board[pr]&&ms.board[pr][pc];
    if(!b||b.revealed||b.flagged||b.mine)continue;
    b.revealed=true;ms.revealed++;ms.score+=5;
    if(b.adj===0)for(var d=0;d<ms.dirs.length;d++){var nr=pr+ms.dirs[d][0],nc=pc+ms.dirs[d][1];if(nr>=0&&nr<ms.R&&nc>=0&&nc<ms.C)stack.push([nr,nc]);}
  }
  this._updateScore(ms.score);
  var safe=ms.R*ms.C-ms.M;
  if(ms.revealed>=safe){ms.won=true;ms.score+=200;this._updateScore(ms.score);this._drawMines();this._gameOver(ms.score);return;}
  this._drawMines();
};

P._msFlag = function (r, c) {
  if(!this.isPlaying)return;
  var ms=this._MS,cell=ms.board[r][c];
  if(ms.lost||ms.won||cell.revealed)return;
  cell.flagged=!cell.flagged;ms.flagged+=cell.flagged?1:-1;
  this._drawMines();
};

/* ============================================================
   12. TETRIS
============================================================ */
P._initTetris = function () {
  var canvas=this.gameCanvas,ctx=this.gameCtx;
  if(!canvas||!ctx)return;
  this._showCanvas();

  var self=this,COLS=10,ROWS=20;
  var cW=Math.floor(canvas.width*0.55/COLS);
  var cH=Math.floor(canvas.height/ROWS);
  var bX=Math.floor((canvas.width*0.55-COLS*cW)/2);

  var SHAPES=[
    {shape:[[1,1,1,1]],color:'#4DEEEA'},
    {shape:[[1,0],[1,0],[1,1]],color:'#F6AD55'},
    {shape:[[0,1],[0,1],[1,1]],color:'#0055FF'},
    {shape:[[1,1],[1,1]],color:'#ECC94B'},
    {shape:[[0,1,1],[1,1,0]],color:'#38A169'},
    {shape:[[1,1,1],[0,1,0]],color:'#9F7AEA'},
    {shape:[[1,1,0],[0,1,1]],color:'#E53E3E'}
  ];

  var board=[];
  for(var r=0;r<ROWS;r++){var row=[];for(var c=0;c<COLS;c++)row.push(null);board.push(row);}

  var rotate=function(s){return s[0].map(function(_,i){return s.map(function(r){return r[i];}).reverse();});};
  var spawn=function(){var t=SHAPES[Math.floor(Math.random()*SHAPES.length)];return{shape:t.shape,color:t.color,x:Math.floor(COLS/2)-Math.floor(t.shape[0].length/2),y:0};};
  var fits=function(s,px,py){for(var r=0;r<s.length;r++)for(var c=0;c<s[r].length;c++){if(!s[r][c])continue;var nx=px+c,ny=py+r;if(nx<0||nx>=COLS||ny>=ROWS)return false;if(ny>=0&&board[ny][nx])return false;}return true;};
  var lock=function(p){for(var r=0;r<p.shape.length;r++)for(var c=0;c<p.shape[r].length;c++){if(!p.shape[r][c])continue;if(p.y+r<0)return false;board[p.y+r][p.x+c]=p.color;}return true;};
  var clear=function(){var n=0;for(var r=ROWS-1;r>=0;r--)if(board[r].every(function(c){return c!==null;})){board.splice(r,1);var nr=[];for(var c2=0;c2<COLS;c2++)nr.push(null);board.unshift(nr);n++;r++;}return n;};

  var score=0,level=1,lines=0,dropMs=600,lastDrop=Date.now();
  var piece=spawn(),next=spawn();
  var lb=[0,100,300,500,800];

  this._keyHandler=function(e){
    if(!self.isPlaying)return;
    switch(e.key){
      case'ArrowLeft':if(fits(piece.shape,piece.x-1,piece.y))piece.x--;e.preventDefault();break;
      case'ArrowRight':if(fits(piece.shape,piece.x+1,piece.y))piece.x++;e.preventDefault();break;
      case'ArrowDown':if(fits(piece.shape,piece.x,piece.y+1))piece.y++;e.preventDefault();break;
      case'ArrowUp':case'z':case'Z':var rot=rotate(piece.shape);if(fits(rot,piece.x,piece.y))piece.shape=rot;e.preventDefault();break;
      case' ':while(fits(piece.shape,piece.x,piece.y+1))piece.y++;e.preventDefault();break;
    }
  };
  document.addEventListener('keydown',this._keyHandler);
  this._touch(canvas,function(d){
    if(d==='left'&&fits(piece.shape,piece.x-1,piece.y))piece.x--;
    if(d==='right'&&fits(piece.shape,piece.x+1,piece.y))piece.x++;
    if(d==='down'&&fits(piece.shape,piece.x,piece.y+1))piece.y++;
    if(d==='up'){var rot2=rotate(piece.shape);if(fits(rot2,piece.x,piece.y))piece.shape=rot2;}
  });

  var tick=function(){
    if(!self.isPlaying)return;
    self.animationFrame=requestAnimationFrame(tick);
    var now=Date.now();
    if(now-lastDrop>=dropMs){
      lastDrop=now;
      if(fits(piece.shape,piece.x,piece.y+1)){piece.y++;}
      else{var ok=lock(piece);if(!ok){self._gameOver(score);return;}var cl=clear();lines+=cl;score+=lb[cl]||0;score+=2;level=Math.floor(lines/10)+1;dropMs=Math.max(100,600-(level-1)*50);self._updateScore(score);piece=next;next=spawn();if(!fits(piece.shape,piece.x,piece.y)){self._gameOver(score);return;}}
    }

    ctx.fillStyle=self._col('bg');ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=self._col('sec')+'20';ctx.fillRect(bX,0,COLS*cW,ROWS*cH);

    ctx.strokeStyle=self._col('sec')+'15';ctx.lineWidth=0.5;
    for(var gc=0;gc<=COLS;gc++){ctx.beginPath();ctx.moveTo(bX+gc*cW,0);ctx.lineTo(bX+gc*cW,ROWS*cH);ctx.stroke();}
    for(var gr=0;gr<=ROWS;gr++){ctx.beginPath();ctx.moveTo(bX,gr*cH);ctx.lineTo(bX+COLS*cW,gr*cH);ctx.stroke();}

    for(var br=0;br<ROWS;br++)for(var bc=0;bc<COLS;bc++)if(board[br][bc]){ctx.fillStyle=board[br][bc];ctx.fillRect(bX+bc*cW+1,br*cH+1,cW-2,cH-2);}

    var gy=piece.y;while(fits(piece.shape,piece.x,gy+1))gy++;
    for(var gr2=0;gr2<piece.shape.length;gr2++)for(var gc2=0;gc2<piece.shape[gr2].length;gc2++){if(!piece.shape[gr2][gc2])continue;ctx.strokeStyle=piece.color+'60';ctx.lineWidth=1;ctx.strokeRect(bX+(piece.x+gc2)*cW+1,(gy+gr2)*cH+1,cW-2,cH-2);}

    for(var ar=0;ar<piece.shape.length;ar++)for(var ac=0;ac<piece.shape[ar].length;ac++){if(!piece.shape[ar][ac])continue;ctx.fillStyle=piece.color;ctx.fillRect(bX+(piece.x+ac)*cW+1,(piece.y+ar)*cH+1,cW-2,cH-2);}

    var px2=bX+COLS*cW+12;
    ctx.fillStyle=self._col('txt');ctx.font='bold 11px Poppins,sans-serif';
    ctx.fillText('NEXT',px2,18);ctx.fillText('Lvl:'+level,px2,canvas.height-56);
    ctx.fillText('Lines:'+lines,px2,canvas.height-42);ctx.fillText('Score:',px2,canvas.height-28);ctx.fillText(''+score,px2,canvas.height-14);

    var pcW=Math.min(cW,16),pcH=Math.min(cH,16);
    for(var nr=0;nr<next.shape.length;nr++)for(var nc=0;nc<next.shape[nr].length;nc++){if(!next.shape[nr][nc])continue;ctx.fillStyle=next.color;ctx.fillRect(px2+nc*pcW,24+nr*pcH,pcW-1,pcH-1);}

    ctx.fillStyle=self._col('muted');ctx.font='9px Poppins,sans-serif';
    ['Arrows: move','Up: rotate',' Space: drop'].forEach(function(h,i){ctx.fillText(h,px2,canvas.height-130+i*13);});
  };
  tick();
};

/* ============================================================
   UNSUPPORTED GAME
============================================================ */
P._initUnsupported = function () {
  this._hideCanvas();
  var ui=document.getElementById('g-ui');if(!ui)return;
  var self=this;
  ui.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;text-align:center;gap:16px;">'+
    '<i data-lucide="construction" style="width:48px;height:48px;color:var(--accent);opacity:0.6;"></i>'+
    '<h3 style="color:var(--text-heading);font-weight:700;">Coming Soon</h3>'+
    '<p style="color:var(--text-muted);font-size:0.88rem;max-width:280px;">This game is under construction!</p>'+
    '<button class="btn btn-outline" id="g-unstub"><i data-lucide="arrow-left"></i><span>Back</span></button>'+
  '</div>';
  var btn=document.getElementById('g-unstub');
  if(btn)btn.addEventListener('click',function(){self.backToList();});
  if(typeof lucide!=='undefined')lucide.createIcons();
};

/* ============================================================
   CSS
============================================================ */
var _CSS = [
  /* gcard */
  '.gcard{display:flex;align-items:center;gap:16px;padding:20px;cursor:pointer;transition:all 0.22s ease;}',
  '.gcard:hover{transform:translateY(-4px) scale(1.01);}',
  '.gcard-icon{width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.22s ease;box-shadow:var(--neu-shadow-sm);}',
  '.gcard:hover .gcard-icon{background:var(--accent)!important;}',
  '.gcard:hover .gcard-icon svg,.gcard:hover .gcard-icon i{color:#fff!important;}',
  '.gcard-body{flex:1;}',
  '.gcard-title{font-size:0.95rem;font-weight:700;color:var(--text-heading);margin-bottom:4px;}',
  '.gcard-desc{font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;}',
  '.gcard-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}',
  '.gdiff,.gcat-badge,.ghighscore{padding:2px 9px;border-radius:999px;font-size:0.66rem;font-weight:700;}',
  '.gdiff-easy{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
  '.gdiff-medium{background:var(--warning-light,#fefcbf);color:var(--warning,#d69e2e);}',
  '.gdiff-hard{background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
  '.gcat-badge{background:var(--bg-secondary,#eee);color:var(--text-muted,#888);}',
  '.ghighscore{background:var(--accent-light);color:var(--accent);display:flex;align-items:center;gap:3px;}',
  '.gcard-arrow{width:38px;height:38px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent);transition:all 0.22s ease;}',
  '.gcard:hover .gcard-arrow{background:var(--accent);color:#fff;transform:scale(1.15);}',
  /* game header */
  '.ghdr{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;}',
  '.gtitle-area{display:flex;align-items:center;gap:8px;}',
  '.gtitle{font-size:1.05rem;font-weight:700;color:var(--text-heading);display:flex;align-items:center;gap:7px;}',
  '.gtitle svg,.gtitle i{width:20px;height:20px;color:var(--accent);}',
  '.gscore-box{display:flex;flex-direction:column;align-items:center;padding:7px 18px;background:var(--bg-card);border-radius:8px;box-shadow:var(--neu-shadow-sm);}',
  '.gscore-lbl{font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;}',
  '.gscore-val{font-size:1.5rem;font-weight:800;color:var(--accent);line-height:1;}',
  /* game container */
  '.gcont{position:relative;background:var(--bg-card);border-radius:12px;overflow:hidden;min-height:300px;box-shadow:var(--neu-shadow);}',
  '.gcont canvas{display:block;width:100%;}',
  '.govl{position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:10;}',
  '.govl-body{text-align:center;color:#fff;display:flex;flex-direction:column;align-items:center;gap:14px;}',
  '.govl-body h3{font-size:1.5rem;font-weight:800;}',
  '.govl-body p{font-size:0.88rem;opacity:0.8;max-width:280px;line-height:1.6;}',
  '.g-ui{padding:16px;min-height:300px;}',
  /* memory */
  '.mem-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:340px;margin:0 auto;}',
  '.mem-card{aspect-ratio:1;cursor:pointer;perspective:600px;}',
  '.mem-inner{width:100%;height:100%;transition:transform 0.45s;transform-style:preserve-3d;position:relative;}',
  '.mem-card.flipped .mem-inner{transform:rotateY(180deg);}',
  '.mem-front,.mem-back{position:absolute;inset:0;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;border-radius:8px;box-shadow:var(--neu-shadow-sm);}',
  '.mem-front{background:var(--accent-light);color:var(--accent);}',
  '.mem-front i,.mem-front svg{width:22px;height:22px;}',
  '.mem-back{background:var(--bg-card);transform:rotateY(180deg);color:var(--accent);}',
  '.mem-back i,.mem-back svg{width:26px;height:26px;}',
  '.mem-card.matched .mem-back{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
  /* quiz */
  '.quiz-wrap{max-width:500px;margin:0 auto;}',
  '.q-bar{height:4px;background:var(--bg-secondary);border-radius:999px;margin-bottom:14px;overflow:hidden;}',
  '.q-fill{height:100%;background:var(--accent);border-radius:999px;transition:width 0.4s ease;}',
  '.q-ctr{font-size:0.76rem;color:var(--text-muted);margin-bottom:14px;text-align:center;font-weight:600;}',
  '.q-txt{font-size:1rem;font-weight:700;color:var(--text-heading);margin-bottom:18px;line-height:1.5;text-align:center;}',
  '.q-opts{display:flex;flex-direction:column;gap:8px;}',
  '.q-opt{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:8px;background:var(--bg-card);border:2px solid transparent;cursor:pointer;transition:0.2s;text-align:left;width:100%;font-family:inherit;font-size:0.86rem;color:var(--text-primary);box-shadow:var(--neu-shadow-sm);}',
  '.q-opt:hover:not(:disabled){border-color:var(--accent);transform:translateX(4px);}',
  '.q-opt.q-correct{border-color:var(--success,#38a169);background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
  '.q-opt.q-wrong{border-color:var(--danger,#e53e3e);background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
  '.q-letter{width:26px;height:26px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;flex-shrink:0;}',
  '.q-explanation{margin-top:14px;padding:10px;border-radius:8px;background:var(--bg-secondary);display:flex;align-items:flex-start;gap:8px;font-size:0.8rem;color:var(--text-secondary);}',
  /* ttt */
  '.ttt-wrap{max-width:300px;margin:0 auto;text-align:center;}',
  '.ttt-score{display:flex;justify-content:space-around;margin-bottom:10px;font-size:0.86rem;font-weight:700;}',
  '.ttt-status{font-size:0.88rem;font-weight:600;color:var(--text-heading);margin-bottom:14px;}',
  '.ttt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}',
  '.ttt-c{aspect-ratio:1;border-radius:8px;background:var(--bg-card);border:2px solid transparent;cursor:pointer;transition:0.2s;display:flex;align-items:center;justify-content:center;font-family:inherit;box-shadow:var(--neu-shadow-sm);}',
  '.ttt-c:hover:not(:disabled){border-color:var(--accent);transform:scale(1.05);}',
  '.ttt-x{color:var(--accent);}',
  '.ttt-o{color:var(--danger);}',
  /* typing */
  '.type-wrap{max-width:540px;margin:0 auto;}',
  '.type-target{padding:18px;background:var(--bg-secondary);border-radius:8px;font-size:1rem;line-height:1.8;color:var(--text-secondary);min-height:76px;}',
  '.type-stats{display:flex;justify-content:center;gap:20px;margin-top:14px;font-size:0.86rem;color:var(--text-secondary);flex-wrap:wrap;}',
  '.type-stats strong{color:var(--accent);font-weight:800;}',
  /* wordle */
  '.wordle-wrap{max-width:340px;margin:0 auto;}',
  '.wgrid{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;}',
  '.wrow{display:flex;gap:5px;justify-content:center;}',
  '.wcell{width:52px;height:52px;border:2px solid var(--border,#ccc);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:800;text-transform:uppercase;transition:0.25s;color:var(--text-heading);background:var(--bg-card);}',
  '.wca-cur{border-color:var(--accent);transform:scale(1.05);}',
  '.wcc{background:#538d4e;border-color:#538d4e;color:#fff;}',
  '.wcp{background:#b59f3b;border-color:#b59f3b;color:#fff;}',
  '.wca{background:#3a3a3c;border-color:#3a3a3c;color:#fff;}',
  '.wkb{display:flex;flex-direction:column;gap:5px;align-items:center;}',
  '.wkr{display:flex;gap:4px;}',
  '.wk{min-width:30px;height:44px;border-radius:5px;border:none;cursor:pointer;font-weight:700;font-size:0.8rem;background:var(--bg-secondary);color:var(--text-heading);transition:0.15s;font-family:inherit;}',
  '.wk:hover{opacity:0.8;}',
  '.wk-wide{min-width:52px;font-size:0.7rem;}',
  '.wks-correct{background:#538d4e!important;color:#fff!important;}',
  '.wks-present{background:#b59f3b!important;color:#fff!important;}',
  '.wks-absent{background:#3a3a3c!important;color:#fff!important;}',
  '.wm{text-align:center;padding:9px;border-radius:8px;margin-bottom:9px;font-size:0.86rem;font-weight:600;}',
  '.wm-ok{background:var(--success-light,#c6f6d5);color:var(--success,#38a169);}',
  '.wm-no{background:var(--danger-light,#fed7d7);color:var(--danger,#e53e3e);}',
  '@keyframes wshake{0%,100%{transform:translateX(0);}20%{transform:translateX(-6px);}40%{transform:translateX(6px);}60%{transform:translateX(-4px);}80%{transform:translateX(4px);}}',
  '.wshake{animation:wshake 0.45s ease;}',
  /* 2048 */
  '.g48wrap{max-width:360px;margin:0 auto;}',
  '.g48grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;background:#bbada0;padding:7px;border-radius:8px;}',
  '.g48cell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;transition:0.1s;}',
  '.g48btn{width:50px;height:50px;border-radius:8px;border:none;cursor:pointer;background:var(--accent-light);color:var(--accent);font-size:1.3rem;font-weight:700;transition:0.15s;font-family:inherit;}',
  '.g48btn:hover{background:var(--accent);color:#fff;}',
  /* mines */
  '.mswrap{max-width:360px;margin:0 auto;}',
  '.mshdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:700;font-size:0.8rem;color:var(--text-heading);}',
  '.mgrid{display:grid;gap:2px;background:var(--bg-secondary);padding:2px;border-radius:4px;}',
  '.mcell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;cursor:pointer;border-radius:3px;user-select:none;min-width:30px;}',
  '.mcell-hid{background:var(--bg-card);}',
  '.mcell-hid:hover{background:var(--accent-light);}',
  '.mcell-rev{background:var(--bg-secondary);}',
  '.mcell-mine{background:var(--danger-light,#fed7d7);}',
  '.mcell-flag{background:var(--warning-light,#fefcbf);cursor:pointer;}',
  /* responsive */
  '@media(max-width:480px){',
  '.ghdr{flex-direction:column;align-items:flex-start;}',
  '.mem-grid{gap:5px;}',
  '.type-stats{flex-direction:column;gap:6px;align-items:center;}',
  '.wcell{width:44px;height:44px;font-size:1rem;}',
  '.mcell{min-width:26px;font-size:0.6rem;}',
  '.ttt-c{min-height:65px;}',
  '}'
].join('');

(function () {
  if (document.getElementById('rac-games-css')) return;
  var s=document.createElement('style');
  s.id='rac-games-css';
  s.textContent=_CSS;
  document.head.appendChild(s);
}());

/* ============================================================
   GLOBAL INIT
============================================================ */
var gamesManager;

function _initGamesManager () {
  var grid = document.getElementById('games-grid');
  var play = document.getElementById('game-play-area');
  if (!grid && !play) return;

  /* safety check — GAMES_CONFIG must be loaded */
  if (!window.GAMES_CONFIG || !window.GAMES_CONFIG.length) {
    console.error('[games.js] GAMES_CONFIG not found. Is config.js loaded before games.js?');
    var g2 = document.getElementById('games-grid');
    if (g2) g2.innerHTML =
      '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--danger);">'+
      '<strong>Error:</strong> config.js must load before games.js</div>';
    return;
  }

  gamesManager = new GamesManager();
  window.gamesManager = gamesManager;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initGamesManager);
} else {
  /* DOM already ready (script loaded async/defer) */
  _initGamesManager();
}

} /* end guard */

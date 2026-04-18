/* PICAZO V8 FINAL — script.js */
'use strict';

const $ = id => document.getElementById(id);
const S = {
  playerName: '', rounds: 3, drawTime: 100, maxPlayers: 8, hints: 'normal',
  players: [], myId: 'me', drawerIdx: 0, round: 1, currentWord: '',
  revealedIdx: [], guessedIds: new Set(),
  timeLeft: 100, timerInt: null, isDrawer: false, isDrawing: false,
  tool: 'pencil', color: '#000000', size: 3, strokes: [], dpr: window.devicePixelRatio || 1
};

const WORDS = ['elephant','pizza','rainbow','submarine','telescope','butterfly','volcano','astronaut','octopus'];
const COLORS = ['#000000','#ffffff','#c0c0c0','#808080','#ff0000','#ff6600','#ffcc00','#ffff00','#00cc00','#00ffcc','#0088ff','#0000ff','#8800ff','#ff00ff','#ff6699','#8b4513'];

const AVATAR_DEFS = [
  {name:'Alex', skin:'#fdd09a', hair:'#3a2010', hCol:'#222', style:'m-short', accent:'#4a8fe8'},
  {name:'Jamie', skin:'#f9c49a', hair:'#1a0a0a', hCol:'#111', style:'f-long', accent:'#9c5cf8'},
  {name:'Morgan', skin:'#e8a87c', hair:'#6a3010', hCol:'#4a1a0a', style:'m-beard', accent:'#e87c4a'},
  {name:'Taylor', skin:'#fdd8b0', hair:'#8b4513', hCol:'#5a2a0a', style:'f-bun', accent:'#4acf8a'},
  {name:'Jordan', skin:'#c8884a', hair:'#2a1808', hCol:'#1a0a00', style:'m-spec', accent:'#f4b942'}
];

/* ── AVATAR RENDERER ── */
function drawAvatar(canvas, def, size = 96) {
  const c = canvas.getContext('2d');
  const W = size, H = size;
  c.clearRect(0, 0, W, H);

  // Background
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, def.accent + '55'); bg.addColorStop(1, def.accent + '22');
  c.fillStyle = bg;
  c.beginPath(); if(c.roundRect) c.roundRect(0, 0, W, H, W * 0.2); else c.rect(0,0,W,H); c.fill();

  const cx = W / 2, cy = H / 2, headR = W * 0.22, headY = H * 0.4;
  
  // Body
  c.fillStyle = def.accent; c.beginPath(); c.ellipse(cx, H * 0.88, W * 0.28, H * 0.22, 0, 0, Math.PI * 2); c.fill();
  // Neck
  c.fillStyle = def.skin; c.fillRect(cx - W * 0.065, headY + headR * 0.8, W * 0.13, H * 0.1);
  // Head
  c.fillStyle = def.skin; c.beginPath(); c.ellipse(cx, headY, headR, headR * 1.1, 0, 0, Math.PI * 2); c.fill();
  
  // Hair
  c.fillStyle = def.hCol;
  if(def.style.includes('long')) { c.beginPath(); c.ellipse(cx, headY + headR * 0.6, headR * 1.15, headR * 1.5, 0, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.ellipse(cx, headY - headR * 0.65, headR * 1.0, headR * 0.55, 0, Math.PI, Math.PI * 2); c.fill();

  // Eyes
  const eyeY = headY - headR * 0.08, eyeOffX = headR * 0.42;
  [-1,1].forEach(side => {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx + side * eyeOffX, eyeY, headR * 0.2, headR * 0.24, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = def.hCol; c.beginPath(); c.arc(cx + side * eyeOffX, eyeY + 1, headR * 0.13, 0, Math.PI * 2); c.fill();
  });
}

function buildAvDots() {
  const container = $('av-dots');
  if(!container) return;
  container.innerHTML = AVATAR_DEFS.map((_, i) => `<button class="av-dot ${i === S.avatarIdx ? 'active' : ''}" onclick="setAvatar(${i})"></button>`).join('');
}

function setAvatar(i) {
  S.avatarIdx = ((i % AVATAR_DEFS.length) + AVATAR_DEFS.length) % AVATAR_DEFS.length;
  drawAvatar($('av-canvas'), AVATAR_DEFS[S.avatarIdx], 96);
  const dots = $('av-dots').querySelectorAll('.av-dot');
  if (dots.length > 0) dots.forEach((d, j) => d.classList.toggle('active', j === S.avatarIdx));
}

/* ── UI INITIALIZATION ── */
$('btn-av-prev').onclick = () => setAvatar(S.avatarIdx - 1);
$('btn-av-next').onclick = () => setAvatar(S.avatarIdx + 1);

$('btn-play').onclick = () => joinGame(false);
$('btn-private').onclick = () => $('modal-private').classList.remove('hidden');
$('btn-close-modal').onclick = () => $('modal-private').classList.add('hidden');
$('btn-generate-link').onclick = () => joinGame(true);

function joinGame(isPrivate) {
  const name = $('inp-name').value.trim();
  if(!name) {
    $('inp-name').classList.add('shake'); 
    setTimeout(() => $('inp-name').classList.remove('shake'), 500); 
    return;
  }
  S.playerName = name;
  if(isPrivate) {
    S.rounds = +$('sel-rounds').value;
    S.maxPlayers = +$('sel-bots').value;
    S.drawTime = +$('sel-time').value;
  }
  $('screen-lobby').classList.remove('active');
  $('modal-private').classList.add('hidden');
  $('screen-game').classList.add('active');
  initGame();
}

/* ── GAME ENGINE ── */
function initGame() {
  buildPlayers(); buildLeaderboard(); buildToolbar(); initCanvas();
  $('chat-input').onkeydown = e => { if (e.key === 'Enter') handleGuess($('chat-input').value); };
  popToast('👋 Joined the room!');
  startRound();
}

function buildPlayers() {
  S.players = [{ id: S.myId, name: S.playerName, score: 0, guessed: false, isSelf: true, avatarDef: AVATAR_DEFS[S.avatarIdx] }];
  for(let i=1; i<S.maxPlayers; i++) {
    S.players.push({ id: 'b'+i, name: 'Bot '+i, score: 0, guessed: false, isSelf: false, avatarDef: AVATAR_DEFS[i % AVATAR_DEFS.length] });
  }
}

function buildLeaderboard() {
  $('player-list').innerHTML = [...S.players].sort((a,b)=>b.score-a.score).map((p, i) => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; drawAvatar(c, p.avatarDef, 32);
    return `<li class="player-item ${p.id === S.players[S.drawerIdx].id ? 'drawing' : ''} ${p.guessed ? 'guessed' : ''}">
      <div class="pi-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
      <div class="pi-av"><img src="${c.toDataURL()}" style="width:100%;height:100%"></div>
      <div class="pi-name">${p.name}</div>
      <div class="pi-score">${p.score}</div>
      ${p.id === S.players[S.drawerIdx].id ? '✏️' : ''}
    </li>`;
  }).join('');
}

function startRound() {
  S.players.forEach(p => p.guessed = false); S.guessedIds.clear();
  S.isDrawer = S.players[S.drawerIdx].id === S.myId;
  buildLeaderboard();
  $('round-badge').textContent = `Round ${S.round}/${S.rounds}`;
  
  $('overlay-word-select').classList.remove('hidden');
  const choices = WORDS.sort(()=>Math.random()-0.5).slice(0,3);
  $('ws-cards').innerHTML = choices.map(w => `<button class="ws-card" onclick="if(S.isDrawer) pickWord('${w}')">${S.isDrawer?w:'???'}</button>`).join('');
  if(!S.isDrawer) setTimeout(() => pickWord(choices[0]), 3000);
}

function pickWord(w) {
  $('overlay-word-select').classList.add('hidden');
  S.currentWord = w; S.revealedIdx = [];
  popToast(`🖌️ ${S.players[S.drawerIdx].name} is drawing!`);
  renderWord(); startTimer(); scheduleBots();
}

function renderWord() {
  const word = S.currentWord;
  $('word-display').innerHTML = S.isDrawer 
    ? word.toUpperCase().split('').join(' ') 
    : word.split('').map((c,i) => S.revealedIdx.includes(i) ? c.toUpperCase() : '_').join(' ');
  $('word-meta').textContent = S.isDrawer ? `You are drawing — ${word.length} letters` : `${word.length} letters`;
}

function startTimer() {
  S.timeLeft = S.drawTime; clearInterval(S.timerInt);
  S.timerInt = setInterval(() => {
    S.timeLeft--;
    $('timer-num').textContent = S.timeLeft;
    $('t-fg').style.strokeDashoffset = CIRC * (1 - (S.timeLeft/S.drawTime));
    if(!S.isDrawer && S.timeLeft === Math.floor(S.drawTime*0.5)) revealHint();
    if(!S.isDrawer && S.timeLeft === Math.floor(S.drawTime*0.25)) revealHint();
    if(S.timeLeft <= 0) endTurn(false);
  }, 1000);
}

function revealHint() {
  const unrev = S.currentWord.split('').map((_,i)=>i).filter(i => !S.revealedIdx.includes(i));
  if(unrev.length > 1) { S.revealedIdx.push(unrev[Math.floor(Math.random()*unrev.length)]); renderWord(); }
}

/* ── CHAT ENGINE ── */
function handleGuess(val) {
  val = val.trim(); if(!val) return; $('chat-input').value = '';
  if(S.isDrawer || S.guessedIds.has(S.myId)) { appendChat('msg-normal', `<b>${S.playerName}:</b> ${val}`); return; }
  const guess = val.toLowerCase(); const ans = S.currentWord.toLowerCase();
  
  if(guess === ans) {
    const pts = Math.max(10, Math.floor((S.timeLeft/S.drawTime)*100));
    S.players[0].score += pts; S.players[0].guessed = true; S.guessedIds.add(S.myId);
    appendChat('msg-correct', `${S.playerName} guessed the word!`);
    buildLeaderboard();
    if(S.players.filter(p=>!p.isDrawer).every(p=>p.guessed)) endTurn(true);
  } else if (guess.length === ans.length && guess.split('').filter((c,i)=>c!==ans[i]).length === 1) {
    appendChat('msg-close', `'${val}' is very close!`);
  } else {
    appendChat('msg-normal', `<b>${S.playerName}:</b> ${val}`);
  }
}

function appendChat(cls, html) {
  const c = $('chat-messages');
  c.insertAdjacentHTML('beforeend', `<div class="chat-msg ${cls}">${html}</div>`);
  c.scrollTop = c.scrollHeight;
}

function popToast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(()=>t.remove(),300); }, 3000);
}

/* ── ROUND & BOT LOGIC ── */
function endTurn(allGuessed) {
  clearInterval(S.timerInt);
  $('overlay-round-end').classList.remove('hidden');
  $('re-word-val').textContent = S.currentWord;
  $('re-scores').innerHTML = S.players.map(p => `<div class="re-score-row"><span>${p.name}</span><span>${p.score} pts</span></div>`).join('');
  
  setTimeout(() => {
    $('overlay-round-end').classList.add('hidden');
    S.drawerIdx++;
    if(S.drawerIdx >= S.players.length) { S.drawerIdx = 0; S.round++; }
    if(S.round > S.rounds) gameOver();
    else { $('game-canvas').getContext('2d').clearRect(0,0,9999,9999); startRound(); }
  }, 4000);
}

function gameOver() {
  $('overlay-podium').classList.remove('hidden');
  const sorted = [...S.players].sort((a,b)=>b.score-a.score);
  $('podium-stand').innerHTML = sorted.slice(0,3).map((p,i) => `<h3>${i+1}. ${p.name} (${p.score} pts)</h3>`).join('');
  fireConfetti();
}

function scheduleBots() {
  S.players.filter(p => !p.isSelf && p.id !== S.players[S.drawerIdx]?.id).forEach((bot, idx) => {
    setTimeout(() => {
      if(!S.currentWord || bot.guessed) return;
      if(S.timeLeft/S.drawTime < 0.5 && Math.random() < 0.4) {
        bot.score += 40; bot.guessed = true; S.guessedIds.add(bot.id);
        appendChat('msg-correct', `${bot.name} guessed the word!`); buildLeaderboard();
      } else {
        appendChat('msg-normal', `<b>${bot.name}:</b> ${['dog','cat','car','house'][Math.floor(Math.random()*4)]}`);
      }
    }, 5000 + idx*4000 + Math.random()*5000);
  });
}

/* ── CANVAS & TOOLBAR ── */
function initCanvas() {
  const c = $('game-canvas'); const ctx = c.getContext('2d', { willReadFrequently: true });
  const resize = () => {
    const r = $('canvas-wrap').getBoundingClientRect();
    c.width = r.width * S.dpr; c.height = r.height * S.dpr;
    ctx.scale(S.dpr, S.dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  window.addEventListener('resize', resize); resize();

  c.onpointerdown = e => { if(S.isDrawer) { c.setPointerCapture(e.pointerId); S.isDrawing=true; ctx.beginPath(); ctx.moveTo(e.offsetX,e.offsetY); }};
  c.onpointermove = e => { 
    if(S.isDrawer && S.isDrawing) { 
      ctx.lineTo(e.offsetX, e.offsetY); 
      ctx.strokeStyle = S.tool === 'eraser' ? '#ffffff' : S.color; 
      ctx.lineWidth = S.size; 
      ctx.stroke(); 
    }
  };
  c.onpointerup = e => { if(S.isDrawer) { S.isDrawing=false; ctx.closePath(); c.releasePointerCapture(e.pointerId); S.strokes.push(ctx.getImageData(0,0,c.width,c.height)); }};
}

function buildToolbar() {
  ['pencil','eraser','fill'].forEach(t => {
    const btn = $('tool-' + t);
    if(btn) btn.onclick = () => { 
      S.tool = t; 
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); 
      btn.classList.add('active'); 
    };
  });
  
  $('tool-clear').onclick = () => $('game-canvas').getContext('2d').clearRect(0,0,9999,9999);
  $('tool-undo').onclick = () => {
    const ctx = $('game-canvas').getContext('2d');
    if(S.strokes.length > 1) { S.strokes.pop(); ctx.putImageData(S.strokes[S.strokes.length-1], 0, 0); }
    else { ctx.clearRect(0,0,9999,9999); S.strokes = []; }
  };
  
  $('btn-color-popup').onclick = e => { e.stopPropagation(); $('popup-color').classList.toggle('hidden'); $('popup-size').classList.add('hidden'); };
  $('btn-size-popup').onclick = e => { e.stopPropagation(); $('popup-size').classList.toggle('hidden'); $('popup-color').classList.add('hidden'); };
  document.onclick = e => { 
    if(!$('popup-color').contains(e.target) && !$('btn-color-popup').contains(e.target)) $('popup-color').classList.add('hidden'); 
    if(!$('popup-size').contains(e.target) && !$('btn-size-popup').contains(e.target)) $('popup-size').classList.add('hidden'); 
  };
  
  $('color-palette').innerHTML = COLORS.map(h => `<div class="c-swatch" style="background:${h}" onclick="S.color='${h}';$('color-indicator').style.background='${h}';$('popup-color').classList.add('hidden');"></div>`).join('');
  $('color-picker').oninput = e => { S.color = e.target.value; $('color-indicator').style.background = e.target.value; };
  $('size-slider').oninput = e => { S.size = +e.target.value; $('size-val-txt').textContent = S.size+'px'; };
}

/* ── CONFETTI HTML5 ── */
function fireConfetti() {
  const canvas = $('confetti-canvas'); const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const pieces = Array.from({length:150}, () => ({x:Math.random()*canvas.width, y:Math.random()*canvas.height-canvas.height, w:Math.random()*10+5, h:Math.random()*10+5, dx:Math.random()*4-2, dy:Math.random()*5+2, c:COLORS[Math.floor(Math.random()*COLORS.length)]}));
  function render() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p => { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.w, p.h); p.x+=p.dx; p.y+=p.dy; if(p.y > canvas.height) p.y = -10; });
    requestAnimationFrame(render);
  }
  render();
}

// Initial Call
buildAvDots();
setAvatar(0);

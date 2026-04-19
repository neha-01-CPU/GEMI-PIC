/* ================================================================
   PICAZO V8 FINAL — script.js
   Pure HD Canvas · Skribbl.io Engine · Bouncy Popups
================================================================ */
'use strict';

const $ = id => document.getElementById(id);

// --- GLOBAL GAME STATE ---
const S = {
  playerName: '', rounds: 3, drawTime: 100, maxPlayers: 8, hints: 'normal',
  players: [], myId: 'me', drawerIdx: 0, round: 1, currentWord: '',
  revealedIdx: [], guessedIds: new Set(),
  timeLeft: 100, timerInt: null, isDrawer: false, isDrawing: false,
  tool: 'pencil', color: '#000000', size: 3, strokes: [], 
  dpr: window.devicePixelRatio || 1, isMuted: false
};

const WORDS = ['elephant','pizza','rainbow','submarine','telescope','butterfly','volcano','astronaut','octopus','galaxy','pyramid'];
const COLORS = ['#000000','#ffffff','#c0c0c0','#808080','#ff0000','#ff6600','#ffcc00','#ffff00','#00cc00','#00ffcc','#0088ff','#0000ff','#8800ff','#ff00ff','#ff6699','#8b4513'];

// Abstract Vector Avatars (Sunset/Twilight Aesthetic)
const AVATAR_DEFS = [
  { name: 'Alpha', bg: '#ff9a9e', shape: 'circle', eye: '#fff', detail: '#ff007f' },
  { name: 'Beta',  bg: '#a18cd1', shape: 'rect',   eye: '#fff', detail: '#7f00ff' },
  { name: 'Gamma', bg: '#fbc2eb', shape: 'tri',    eye: '#fff', detail: '#a18cd1' },
  { name: 'Delta', bg: '#84fab0', shape: 'circle', eye: '#fff', detail: '#00ff7f' },
  { name: 'Epsilon',bg:'#8fd3f4', shape: 'rect',   eye: '#fff', detail: '#007fff' }
];

const CIRC = 2 * Math.PI * 25;

/* ================================================================
   AVATAR RENDERER (Abstract Vectors)
================================================================ */
function drawAvatar(canvas, def, size = 96) {
  if (!canvas) return;
  const c = canvas.getContext('2d');
  const W = size, H = size;
  c.clearRect(0, 0, W, H);

  // Glass Background
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, def.bg); bg.addColorStop(1, def.detail);
  c.fillStyle = bg;
  c.beginPath(); if(c.roundRect) c.roundRect(0, 0, W, H, W * 0.2); else c.rect(0,0,W,H); c.fill();

  const cx = W / 2, cy = H / 2;
  
  // Abstract Inner Shape
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.beginPath();
  if (def.shape === 'circle') c.arc(cx, cy, W*0.25, 0, Math.PI*2);
  else if (def.shape === 'rect') { if(c.roundRect) c.roundRect(cx - W*0.2, cy - W*0.2, W*0.4, W*0.4, 8); else c.rect(cx - W*0.2, cy - W*0.2, W*0.4, W*0.4); }
  else if (def.shape === 'tri') { c.moveTo(cx, cy - W*0.25); c.lineTo(cx + W*0.25, cy + W*0.2); c.lineTo(cx - W*0.25, cy + W*0.2); }
  c.fill();

  // Abstract "Eyes"
  c.fillStyle = def.eye;
  c.beginPath(); c.arc(cx - W*0.1, cy - W*0.05, W*0.05, 0, Math.PI*2); c.fill();
  c.beginPath(); c.arc(cx + W*0.1, cy - W*0.05, W*0.05, 0, Math.PI*2); c.fill();
}

function buildAvDots() {
  const container = $('av-dots');
  if(!container) return;
  container.innerHTML = AVATAR_DEFS.map((_, i) => `<button class="av-dot ${i === S.avatarIdx ? 'active' : ''}" onclick="setAvatar(${i})"></button>`).join('');
}

window.setAvatar = function(i) {
  S.avatarIdx = ((i % AVATAR_DEFS.length) + AVATAR_DEFS.length) % AVATAR_DEFS.length;
  drawAvatar($('av-canvas'), AVATAR_DEFS[S.avatarIdx], 96);
  const dots = $('av-dots').querySelectorAll('.av-dot');
  if (dots.length > 0) dots.forEach((d, j) => d.classList.toggle('active', j === S.avatarIdx));
}

/* ================================================================
   UI INITIALIZATION & LOBBY FLOW
================================================================ */
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
    setTimeout(() => $('inp-name').classList.remove('shake'), 400); 
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

/* ================================================================
   CORE GAME ENGINE
================================================================ */
function initGame() {
  buildPlayers(); 
  buildLeaderboard(); 
  buildToolbar(); 
  initCanvas();
  setupInteractions();
  
  sysToast('👋 Joined the room!');
  startRound();
}

function setupInteractions() {
  $('chat-input').onkeydown = e => { if (e.key === 'Enter') handleGuess(); };
  $('btn-guess-send').onclick = () => handleGuess();
  
  $('btn-mute').onclick = () => {
    S.isMuted = !S.isMuted;
    $('btn-mute').textContent = S.isMuted ? '🔇' : '🔊';
  };

  $('btn-rate-up').onclick = () => sysToast('👍 You liked this drawing!');
  $('btn-rate-down').onclick = () => sysToast('👎 You disliked this drawing!');
}

function buildPlayers() {
  S.players = [{ id: S.myId, name: S.playerName, score: 0, guessed: false, isSelf: true, avatarDef: AVATAR_DEFS[S.avatarIdx] }];
  for(let i=1; i<S.maxPlayers; i++) {
    S.players.push({ id: 'b'+i, name: 'Bot '+i, score: 0, guessed: false, isSelf: false, avatarDef: AVATAR_DEFS[i % AVATAR_DEFS.length] });
  }
}

function buildLeaderboard() {
  $('player-list').innerHTML = [...S.players].sort((a,b)=>b.score-a.score).map((p, i) => {
    const c = document.createElement('canvas'); c.width = 28; c.height = 28; drawAvatar(c, p.avatarDef, 28);
    return `<li class="player-item ${p.id === S.players[S.drawerIdx].id ? 'drawing' : ''} ${p.guessed ? 'guessed' : ''}" onclick="if(!${p.isSelf}) openContext('${p.id}')">
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
  sysToast(`🖌️ ${S.players[S.drawerIdx].name} is drawing!`);
  renderWord(); 
  startTimer(); 
  scheduleBots();
}

function renderWord() {
  const word = S.currentWord;
  $('word-display').innerHTML = S.isDrawer 
    ? word.toUpperCase().split('').join(' ') 
    : word.split('').map((c,i) => S.revealedIdx.includes(i) ? c.toUpperCase() : '_').join(' ');
  $('word-meta').textContent = S.isDrawer ? `${word.length} letters` : `${word.length} letters`;
}

function startTimer() {
  S.timeLeft = S.drawTime; clearInterval(S.timerInt);
  
  // Timer shaking logic
  const timerWrap = $('timer-ring-wrap');
  
  S.timerInt = setInterval(() => {
    S.timeLeft--;
    $('timer-num').textContent = S.timeLeft;
    $('t-fg').style.strokeDashoffset = CIRC * (1 - (S.timeLeft/S.drawTime));
    
    // Shake and turn red under 30s
    if (S.timeLeft <= 30) {
      $('timer-num').style.color = 'var(--red)';
      $('t-fg').style.stroke = 'var(--red)';
      timerWrap.style.animation = 'shake 0.5s infinite';
    } else {
      $('timer-num').style.color = 'var(--blue)';
      $('t-fg').style.stroke = 'var(--blue)';
      timerWrap.style.animation = 'none';
    }
    
    if(!S.isDrawer && S.timeLeft === Math.floor(S.drawTime*0.5)) revealHint();
    if(!S.isDrawer && S.timeLeft === Math.floor(S.drawTime*0.25)) revealHint();
    
    if(S.timeLeft <= 0) endTurn(false);
  }, 1000);
}

function revealHint() {
  const unrev = S.currentWord.split('').map((_,i)=>i).filter(i => !S.revealedIdx.includes(i));
  if(unrev.length > 1) { S.revealedIdx.push(unrev[Math.floor(Math.random()*unrev.length)]); renderWord(); }
}

/* ================================================================
   CHAT ENGINE & GUESSING (Skribbl.io Rules)
================================================================ */
function handleGuess() {
  const input = $('chat-input');
  let val = input.value.trim(); 
  if(!val) return; 
  input.value = '';
  
  if(S.isDrawer || S.guessedIds.has(S.myId)) { 
    appendChat('msg-normal', `<b>${S.playerName}:</b> ${escHtml(val)}`); 
    return; 
  }
  
  const guess = val.toLowerCase(); const ans = S.currentWord.toLowerCase();
  
  if(guess === ans) {
    const pts = Math.max(10, Math.floor((S.timeLeft/S.drawTime)*100));
    S.players[0].score += pts; S.players[0].guessed = true; S.guessedIds.add(S.myId);
    appendChat('msg-correct', `${S.playerName} guessed the word!`);
    sysToast(`✅ You guessed the word!`);
    buildLeaderboard();
    if(S.players.filter(p=>!p.isDrawer).every(p=>p.guessed)) endTurn(true);
  } else if (guess.length === ans.length && guess.split('').filter((c,i)=>c!==ans[i]).length === 1) {
    appendChat('msg-close', `'${escHtml(val)}' is very close!`);
  } else {
    appendChat('msg-normal', `<b>${S.playerName}:</b> ${escHtml(val)}`);
  }
}

function appendChat(cls, html) {
  const c = $('chat-messages');
  c.insertAdjacentHTML('beforeend', `<div class="chat-msg ${cls}">${html}</div>`);
  c.scrollTop = c.scrollHeight;
}

function sysToast(msg) {
  const tc = $('sys-toast-container');
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(()=>t.remove(),300); }, 3000);
}

/* ================================================================
   ROUND END & BOT SIMULATION
================================================================ */
function endTurn(allGuessed) {
  clearInterval(S.timerInt);
  $('timer-ring-wrap').style.animation = 'none';
  
  $('overlay-round-end').classList.remove('hidden');
  $('re-word-val').textContent = S.currentWord;
  $('re-scores').innerHTML = S.players.map(p => `<div class="re-score-row"><span>${p.name}</span><span>+${p.guessed ? Math.max(10, Math.floor((S.timeLeft/S.drawTime)*100)) : 0} pts</span></div>`).join('');
  
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
  $('podium-stand').innerHTML = sorted.slice(0,3).map((p,i) => `<h3>${i===0?'🥇':i===1?'🥈':'🥉'} ${p.name} (${p.score} pts)</h3>`).join('');
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
        appendChat('msg-normal', `<b>${bot.name}:</b> ${['dog','cat','car','house','tree'][Math.floor(Math.random()*5)]}`);
      }
    }, 5000 + idx*4000 + Math.random()*5000);
  });
}

/* ================================================================
   MODERATION & CONTEXT MENU
================================================================ */
window.openContext = function(id) {
  const p = S.players.find(x => x.id === id);
  if(!p) return;
  S.ctxTarget = p;
  $('ctx-name').textContent = p.name;
  
  const c = document.createElement('canvas'); c.width = 34; c.height = 34; drawAvatar(c, p.avatarDef, 34);
  $('ctx-av').innerHTML = ''; $('ctx-av').appendChild(c);
  
  $('context-menu').classList.remove('hidden');
  // Position roughly center
  $('context-menu').style.top = '40%'; $('context-menu').style.left = '50%';
  $('context-menu').style.transform = 'translate(-50%, -50%)';
}

$('ctx-close').onclick = () => $('context-menu').classList.add('hidden');
$('ctx-mute').onclick = () => { sysToast(`🔇 Muted ${S.ctxTarget.name}`); $('context-menu').classList.add('hidden'); };
$('ctx-report').onclick = () => { sysToast(`🚩 Reported ${S.ctxTarget.name}`); $('context-menu').classList.add('hidden'); };
$('ctx-kick').onclick = () => { 
  $('context-menu').classList.add('hidden');
  $('vote-banner').classList.remove('hidden');
};

$('btn-vote-yes').onclick = () => {
  $('vote-banner').classList.add('hidden');
  if(S.ctxTarget) {
    sysToast(`🚪 ${S.ctxTarget.name} was kicked!`);
    S.players = S.players.filter(p => p.id !== S.ctxTarget.id);
    buildLeaderboard();
  }
};
$('btn-vote-no').onclick = () => $('vote-banner').classList.add('hidden');

/* ================================================================
   PURE HD CANVAS & TOOLBAR
================================================================ */
function initCanvas() {
  const c = $('game-canvas'); const ctx = c.getContext('2d', { willReadFrequently: true });
  
  const resize = () => {
    const r = $('canvas-wrap').getBoundingClientRect();
    if(r.width === 0 || r.height === 0) return;
    
    let snap = null;
    if (c.width > 0) { try { snap = ctx.getImageData(0, 0, c.width, c.height); } catch(e){} }
    
    c.width = r.width * S.dpr; c.height = r.height * S.dpr;
    ctx.scale(S.dpr, S.dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    
    if (snap) {
      const temp = document.createElement('canvas'); temp.width = snap.width; temp.height = snap.height;
      temp.getContext('2d').putImageData(snap, 0, 0); ctx.drawImage(temp, 0, 0, r.width, r.height);
    }
  };
  window.addEventListener('resize', resize); setTimeout(resize, 100);

  const getPos = (e) => {
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  c.onpointerdown = e => { 
    if(S.isDrawer) { 
      c.setPointerCapture(e.pointerId); S.isDrawing=true; 
      const pos = getPos(e);
      if(S.tool === 'fill') { floodFill(pos.x, pos.y, S.color); S.isDrawing=false; return; }
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y); 
    }
  };
  
  c.onpointermove = e => { 
    if(S.isDrawer && S.isDrawing) { 
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y); 
      ctx.strokeStyle = S.tool === 'eraser' ? '#ffffff' : S.color; 
      ctx.lineWidth = S.size; 
      ctx.globalCompositeOperation = S.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.stroke(); 
    }
  };
  
  c.onpointerup = e => { 
    if(S.isDrawer) { 
      S.isDrawing=false; ctx.closePath(); c.releasePointerCapture(e.pointerId); 
      ctx.globalCompositeOperation = 'source-over';
      try { S.strokes.push(ctx.getImageData(0,0,c.width,c.height)); } catch(err){}
    }
  };
}

function floodFill(startX, startY, fillHex) {
  const c = $('game-canvas'); const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  const id = ctx.getImageData(0, 0, w, h); const d = id.data;
  const xi = Math.round(startX * S.dpr), yi = Math.round(startY * S.dpr);
  if (xi < 0 || xi >= w || yi < 0 || yi >= h) return;

  const idx = (yi * w + xi) * 4;
  const tr = d[idx], tg = d[idx+1], tb = d[idx+2], ta = d[idx+3];

  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fillHex);
  const fc = r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
  if (!fc || (tr === fc.r && tg === fc.g && tb === fc.b && ta === 255)) return;

  function match(i) { return Math.abs(d[i]-tr)<30 && Math.abs(d[i+1]-tg)<30 && Math.abs(d[i+2]-tb)<30 && Math.abs(d[i+3]-ta)<30; }

  const stack = [xi + yi * w]; const seen = new Uint8Array(w * h);
  while (stack.length) {
    const p = stack.pop(); if (seen[p]) continue;
    const x = p % w, y = Math.floor(p / w);
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const i = p * 4; if (!match(i)) continue;
    seen[p] = 1;
    d[i] = fc.r; d[i+1] = fc.g; d[i+2] = fc.b; d[i+3] = 255;
    if (x+1 < w) stack.push(p+1); if (x-1 >= 0) stack.push(p-1);
    if (y+1 < h) stack.push(p+w); if (y-1 >= 0) stack.push(p-w);
  }
  ctx.putImageData(id, 0, 0);
  try { S.strokes.push(ctx.getImageData(0,0,w,h)); } catch(err){}
}

function buildToolbar() {
  ['pencil','eraser','fill'].forEach(t => {
    const btn = $('tool-' + t);
    if(btn) btn.onclick = () => { 
      S.tool = t; 
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active')); 
      btn.classList.add('active'); 
    };
  });
  
  $('tool-clear').onclick = () => {
    $('game-canvas').getContext('2d').clearRect(0,0,9999,9999);
    S.strokes = [];
  };
  
  $('tool-undo').onclick = () => {
    const ctx = $('game-canvas').getContext('2d');
    if(S.strokes.length > 1) { 
      S.strokes.pop(); 
      ctx.putImageData(S.strokes[S.strokes.length-1], 0, 0); 
    } else { 
      ctx.clearRect(0,0,9999,9999); S.strokes = []; 
    }
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

function escHtml(str) { return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]); }

/* ── CONFETTI HTML5 ── */
function fireConfetti() {
  const canvas = $('confetti-canvas'); const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const pieces = Array.from({length:200}, () => ({x:Math.random()*canvas.width, y:Math.random()*canvas.height-canvas.height, w:Math.random()*10+5, h:Math.random()*10+5, dx:Math.random()*4-2, dy:Math.random()*5+3, c:COLORS[Math.floor(Math.random()*COLORS.length)]}));
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

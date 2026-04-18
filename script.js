/* PICAZO V6 — script.js */
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
const COLORS = ['#000','#fff','#c0c0c0','#808080','#f00','#f60','#fc0','#ff0','#0c0','#0fc','#08f','#00f','#80f','#f0f','#f69','#960'];
const AVATARS = [{bg:'#fdd09a', h:'#222'}, {bg:'#f9c49a', h:'#111'}, {bg:'#e8a87c', h:'#4a1a0a'}, {bg:'#fdd8b0', h:'#5a2a0a'}];

/* ── UI INITIALIZATION ── */
$('btn-av-prev').onclick = () => setAvatar(S.avatarIdx - 1);
$('btn-av-next').onclick = () => setAvatar(S.avatarIdx + 1);
let avIdx = 0;
function setAvatar(i) {
  avIdx = ((i % AVATAR_DEFS.length) + AVATAR_DEFS.length) % AVATAR_DEFS.length;
  // Simple fallback render for abstract avatar
  const c = $('av-canvas').getContext('2d');
  c.clearRect(0,0,96,96); c.fillStyle = AVATARS[avIdx%AVATARS.length].bg; c.fillRect(10,10,76,76);
}

$('btn-play').onclick = () => joinGame(false);
$('btn-private').onclick = () => $('modal-private').classList.remove('hidden');
$('btn-close-modal').onclick = () => $('modal-private').classList.add('hidden');
$('btn-generate-link').onclick = () => joinGame(true);

function joinGame(isPrivate) {
  const name = $('inp-name').value.trim();
  if(!name) return;
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
  
  // Enter input logic for mobile footer
  $('chat-input').onkeydown = e => { if (e.key === 'Enter') handleGuess($('chat-input').value); };
  
  popToast('👋 Joined the room!');
  startRound();
}

function buildPlayers() {
  S.players = [{ id: S.myId, name: S.playerName, score: 0, guessed: false, isSelf: true }];
  for(let i=1; i<S.maxPlayers; i++) {
    S.players.push({ id: 'b'+i, name: 'Bot '+i, score: 0, guessed: false, isSelf: false });
  }
}

function buildLeaderboard() {
  $('player-list').innerHTML = [...S.players].sort((a,b)=>b.score-a.score).map((p, i) => `
    <li class="player-item ${p.id === S.players[S.drawerIdx].id ? 'drawing' : ''} ${p.guessed ? 'guessed' : ''}">
      <div class="pi-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
      <div class="pi-av" style="background:${AVATARS[0].bg}"></div>
      <div class="pi-name">${p.name}</div>
      <div class="pi-score">${p.score}</div>
      ${p.id === S.players[S.drawerIdx].id ? '✏️' : ''}
    </li>
  `).join('');
}

function startRound() {
  S.players.forEach(p => p.guessed = false); S.guessedIds.clear();
  S.isDrawer = S.players[S.drawerIdx].id === S.myId;
  buildLeaderboard();
  $('round-badge').textContent = `Round ${S.round}/${S.rounds}`;
  
  // Word Selection
  $('overlay-word-select').classList.remove('hidden');
  const choices = WORDS.sort(()=>Math.random()-0.5).slice(0,3);
  $('ws-cards').innerHTML = choices.map(w => `<button class="ws-card" onclick="if(S.isDrawer) pickWord('${w}')">${S.isDrawer?w:'???'}</button>`).join('');
  
  if(!S.isDrawer) setTimeout(() => pickWord(choices[0]), 3000);
}

function pickWord(w) {
  $('overlay-word-select').classList.add('hidden');
  S.currentWord = w; S.revealedIdx = [];
  popToast(`🖌️ ${S.players[S.drawerIdx].name} is drawing!`);
  renderWord();
  startTimer();
  scheduleBots();
}

function renderWord() {
  const word = S.currentWord;
  $('word-display').innerHTML = S.isDrawer 
    ? word.toUpperCase().split('').join(' ') 
    : word.split('').map((c,i) => S.revealedIdx.includes(i) ? c.toUpperCase() : '_').join(' ');
}

function startTimer() {
  S.timeLeft = S.drawTime; clearInterval(S.timerInt);
  S.timerInt = setInterval(() => {
    S.timeLeft--;
    $('timer-num').textContent = S.timeLeft;
    $('t-fg').style.strokeDashoffset = CIRC * (1 - (S.timeLeft/S.drawTime));
    
    // Hint System
    if(!S.isDrawer && S.timeLeft === Math.floor(S.drawTime*0.5)) revealHint();
    if(!S.isDrawer && S.timeLeft === Math.floor(S.drawTime*0.25)) revealHint();

    if(S.timeLeft <= 0) endTurn(false);
  }, 1000);
}

function revealHint() {
  const unrev = S.currentWord.split('').map((_,i)=>i).filter(i => !S.revealedIdx.includes(i));
  if(unrev.length > 1) { S.revealedIdx.push(unrev[Math.floor(Math.random()*unrev.length)]); renderWord(); }
}

/* ── CHAT & GUESSING ENGINE (SKRIBBLE RULES) ── */
function handleGuess(val) {
  val = val.trim(); if(!val) return; $('chat-input').value = '';
  
  if(S.isDrawer || S.guessedIds.has(S.myId)) {
    appendChat('msg-normal', `<b>${S.playerName}:</b> ${val}`); return;
  }

  const guess = val.toLowerCase(); const ans = S.currentWord.toLowerCase();
  
  if(guess === ans) {
    const pts = Math.max(10, Math.floor((S.timeLeft/S.drawTime)*100));
    S.players[0].score += pts; S.players[0].guessed = true; S.guessedIds.add(S.myId);
    appendChat('msg-correct', `${S.playerName} guessed the word!`);
    buildLeaderboard();
    if(S.players.filter(p=>!p.isDrawer).every(p=>p.guessed)) endTurn(true);
  } else if (isClose(guess, ans)) {
    appendChat('msg-close', `'${val}' is very close!`);
  } else {
    appendChat('msg-normal', `<b>${S.playerName}:</b> ${val}`);
  }
}

function isClose(a, b) {
  if(a.length !== b.length) return false;
  let diff = 0; for(let i=0; i<a.length; i++) if(a[i]!==b[i]) diff++;
  return diff === 1;
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

/* ── ROUND LOGIC ── */
function endTurn(allGuessed) {
  clearInterval(S.timerInt);
  $('overlay-round-end').classList.remove('hidden');
  $('re-word-val').textContent = S.currentWord;
  $('re-scores').innerHTML = S.players.map(p => `<div class="re-score-row"><span>${p.name}</span><span>${p.score}</span></div>`).join('');
  
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

/* ── BOT SIMULATION ── */
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
  const c = $('game-canvas'); const ctx = c.getContext('2d');
  const resize = () => {
    const r = $('canvas-wrap').getBoundingClientRect();
    c.width = r.width * S.dpr; c.height = r.height * S.dpr;
    ctx.scale(S.dpr, S.dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  window.addEventListener('resize', resize); resize();

  c.onpointerdown = e => { if(S.isDrawer) { c.setPointerCapture(e.pointerId); S.isDrawing=true; ctx.beginPath(); ctx.moveTo(e.offsetX,e.offsetY); }};
  c.onpointermove = e => { if(S.isDrawer && S.isDrawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.strokeStyle=S.tool==='eraser'?'#fff':S.color; ctx.lineWidth=S.size; ctx.stroke(); }};
  c.onpointerup = e => { if(S.isDrawer) { S.isDrawing=false; ctx.closePath(); c.releasePointerCapture(e.pointerId); }};
}

function buildToolbar() {
  ['pencil','eraser','fill'].forEach(t => $(`tool-${t}`).onclick = () => { S.tool = t; });
  $('tool-clear').onclick = () => $('game-canvas').getContext('2d').clearRect(0,0,9999,9999);
  
  $('btn-color-popup').onclick = e => { e.stopPropagation(); $('popup-color').classList.toggle('hidden'); $('popup-size').classList.add('hidden'); };
  $('btn-size-popup').onclick = e => { e.stopPropagation(); $('popup-size').classList.toggle('hidden'); $('popup-color').classList.add('hidden'); };
  
  $('color-palette').innerHTML = COLORS.map(h => `<div class="c-swatch" style="background:${h}" onclick="S.color='${h}';$('color-indicator').style.background='${h}'"></div>`).join('');
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

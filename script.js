/* ============================================
   Para Helô — script principal (vanilla JS)
   - SPA simples baseada em "scenes"
   - Minigames: labirinto, memória, frases, estrelas
   - Otimizado para mobile: canvas leve, DPR limitado,
     listeners passivos, animações pausadas fora da tela.
   ============================================ */

(() => {
  'use strict';

  // ---------- Util ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const isMobile = matchMedia('(max-width: 640px)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

  // ---------- Scene router ----------
  const order = ['scene-intro','scene-hero','scene-maze','scene-memory','scene-phrases','scene-stars','scene-transition','scene-letter'];
  let current = 'scene-intro';

  function go(id){
    if (id === current) return;
    const prev = document.getElementById(current);
    const next = document.getElementById(id);
    if (!next) return;
    prev?.classList.remove('active');
    next.classList.add('active');
    current = id;
    onEnter(id);
  }

  function next(){
    const i = order.indexOf(current);
    if (i >= 0 && i < order.length - 1) go(order[i+1]);
  }

  // Botões "data-next"
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-next]');
    if (t) go(t.dataset.next);
  });

  // ---------- 1. Intro ----------
  setTimeout(() => go('scene-hero'), 4200);

  // ---------- onEnter ----------
  function onEnter(id){
    if (id === 'scene-maze')   initMaze();
    if (id === 'scene-memory') initMemory();
    if (id === 'scene-phrases')initPhrases();
    if (id === 'scene-stars')  initStars();
    if (id === 'scene-transition') playTransition();
    if (id === 'scene-letter') typeLetter();
  }

  // ============================================
  // 3. LABIRINTO
  // ============================================
  let mazeRAF = 0;
  // Gera labirinto perfeito com recursive backtracking. N deve ser ímpar.
  function genMaze(N){
    const g = Array.from({length:N}, () => Array(N).fill(1));
    const stack = [[1,1]];
    g[1][1] = 0;
    while (stack.length){
      const [x,y] = stack[stack.length-1];
      const dirs = [[2,0],[-2,0],[0,2],[0,-2]].sort(() => Math.random()-0.5);
      let carved = false;
      for (const [dx,dy] of dirs){
        const nx=x+dx, ny=y+dy;
        if (nx>0 && ny>0 && nx<N-1 && ny<N-1 && g[ny][nx]===1){
          g[y+dy/2][x+dx/2] = 0;
          g[ny][nx] = 0;
          stack.push([nx,ny]);
          carved = true;
          break;
        }
      }
      if (!carved) stack.pop();
    }
    return g;
  }

  function initMaze(){
    const canvas = $('#mazeCanvas');
    const ctx = canvas.getContext('2d', { alpha:true });
    // tamanho real (CSS px) → backing store em DPR
    const cssSize = Math.min(canvas.clientWidth, canvas.clientHeight);
    canvas.width = Math.floor(cssSize * DPR);
    canvas.height = Math.floor(cssSize * DPR);

    // Labirinto 21x21 — bem mais difícil que o anterior
    const N = 21;
    const G = genMaze(N);
    const cell = canvas.width / N;
    let px = 1, py = 1;
    const gx = N-2, gy = N-2;
    G[gy][gx] = 0;
    let done = false;
    let pulse = 0;

    // pré-renderiza as paredes em buffer (sem refazer a cada frame)
    const wallBuf = document.createElement('canvas');
    wallBuf.width = canvas.width; wallBuf.height = canvas.height;
    const wctx = wallBuf.getContext('2d');
    // fundo do "chão"
    wctx.fillStyle = '#03130e';
    wctx.fillRect(0,0,wallBuf.width,wallBuf.height);
    // paredes como blocos sólidos esmeralda
    wctx.fillStyle = '#0b3a2a';
    for (let y=0;y<N;y++){
      for (let x=0;x<N;x++){
        if (G[y][x]===1) wctx.fillRect(x*cell, y*cell, cell+0.5, cell+0.5);
      }
    }
    // contorno neon sutil só no perímetro das paredes
    wctx.strokeStyle = 'rgba(110,231,183,0.35)';
    wctx.lineWidth = Math.max(1, DPR*0.6);
    for (let y=0;y<N;y++){
      for (let x=0;x<N;x++){
        if (G[y][x]!==1) continue;
        // top
        if (y===0 || G[y-1][x]!==1){
          wctx.beginPath(); wctx.moveTo(x*cell, y*cell); wctx.lineTo((x+1)*cell, y*cell); wctx.stroke();
        }
        // bottom
        if (y===N-1 || G[y+1][x]!==1){
          wctx.beginPath(); wctx.moveTo(x*cell, (y+1)*cell); wctx.lineTo((x+1)*cell, (y+1)*cell); wctx.stroke();
        }
        // left
        if (x===0 || G[y][x-1]!==1){
          wctx.beginPath(); wctx.moveTo(x*cell, y*cell); wctx.lineTo(x*cell, (y+1)*cell); wctx.stroke();
        }
        // right
        if (x===N-1 || G[y][x+1]!==1){
          wctx.beginPath(); wctx.moveTo((x+1)*cell, y*cell); wctx.lineTo((x+1)*cell, (y+1)*cell); wctx.stroke();
        }
      }
    }

    function draw(){
      // copia paredes pré-renderizadas (rápido)
      ctx.drawImage(wallBuf, 0, 0);

      // coração (alvo) pulsando
      pulse += 0.05;
      const hs = cell*0.42 + Math.sin(pulse)*cell*0.06;
      drawHeart(ctx, gx*cell+cell/2, gy*cell+cell/2, hs, '#ff8fb3');

      // jogador (orbe luminoso)
      const cx = px*cell+cell/2, cy = py*cell+cell/2;
      const r  = cell*0.32;
      const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.6);
      grad.addColorStop(0,'#eaf7f1');
      grad.addColorStop(0.4,'#6ee7b7');
      grad.addColorStop(1,'rgba(16,185,129,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx,cy,r*1.6,0,Math.PI*2); ctx.fill();

      if (!done) mazeRAF = requestAnimationFrame(draw);
    }


    function tryMove(dx,dy){
      if (done) return;
      const nx = px+dx, ny = py+dy;
      if (G[ny] && G[ny][nx] === 0){
        px = nx; py = ny;
        if (px===gx && py===gy){
          done = true;
          setTimeout(() => { cancelAnimationFrame(mazeRAF); go('scene-memory'); }, 700);
        }
      }
    }

    // Controles touch (pad)
    $$('#touchpad .pad').forEach(b => {
      b.onclick = () => {
        const d = b.dataset.dir;
        if (d==='up') tryMove(0,-1);
        if (d==='down') tryMove(0,1);
        if (d==='left') tryMove(-1,0);
        if (d==='right') tryMove(1,0);
      };
    });

    // Swipe
    let sx=0, sy=0;
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0]; sx=t.clientX; sy=t.clientY;
    }, {passive:true});
    canvas.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) tryMove(dx>0?1:-1, 0);
      else tryMove(0, dy>0?1:-1);
    }, {passive:true});

    // Teclado
    window.addEventListener('keydown', mazeKey);
    function mazeKey(e){
      if (current!=='scene-maze') return;
      if (e.key==='ArrowUp') tryMove(0,-1);
      if (e.key==='ArrowDown') tryMove(0,1);
      if (e.key==='ArrowLeft') tryMove(-1,0);
      if (e.key==='ArrowRight') tryMove(1,0);
    }

    cancelAnimationFrame(mazeRAF);
    draw();
  }

  function drawHeart(ctx,x,y,s,color){
    ctx.save();
    ctx.translate(x,y); ctx.scale(s/30, s/30);
    ctx.beginPath();
    ctx.moveTo(0,8);
    ctx.bezierCurveTo(-18,-10,-26,8,0,24);
    ctx.bezierCurveTo(26,8,18,-10,0,8);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }

  // ============================================
  // 4. MEMÓRIA
  // ============================================
  function initMemory(){
    const grid = $('#memoryGrid');
    grid.innerHTML = '';
    const icons = ['♡','✿','✦','☾','✧','♥','❀','✶'];
    const deck = [...icons, ...icons].sort(() => Math.random()-0.5);
    let first = null, lock = false, matches = 0;

    deck.forEach(sym => {
      const el = document.createElement('div');
      el.className = 'mcard';
      el.innerHTML = `<div class="face back"></div><div class="face front">${sym}</div>`;
      el.dataset.sym = sym;
      el.addEventListener('click', () => {
        if (lock || el.classList.contains('flipped') || el.classList.contains('matched')) return;
        el.classList.add('flipped');
        if (!first){ first = el; return; }
        if (first.dataset.sym === el.dataset.sym){
          first.classList.add('matched'); el.classList.add('matched');
          first = null; matches++;
          if (matches === icons.length) setTimeout(() => go('scene-phrases'), 700);
        } else {
          lock = true;
          const f = first;
          setTimeout(() => {
            f.classList.remove('flipped'); el.classList.remove('flipped');
            first = null; lock = false;
          }, 700);
        }
      });
      grid.appendChild(el);
    });
  }

  // ============================================
  // 5. FRASES
  // ============================================
  const phrases = [
    ['eu','amo','você','minha','princesa'],
    ['você','é','o','que','tenho','de','mais','importante'],
  ];
  let phraseIdx = 0;

  function initPhrases(){
    phraseIdx = 0;
    renderPhrase();
  }

  function renderPhrase(){
    const target = $('#phraseTarget');
    const pool = $('#phrasePool');
    const hint = $('#phraseHint');
    target.innerHTML = ''; pool.innerHTML = '';
    hint.textContent = `Frase ${phraseIdx+1}/${phrases.length}: toque na ordem certa.`;

    const phrase = phrases[phraseIdx];
    let step = 0;
    const shuffled = [...phrase].sort(() => Math.random()-0.5);

    shuffled.forEach(w => {
      const b = document.createElement('button');
      b.className = 'word';
      b.textContent = w;
      b.addEventListener('click', () => {
        if (b.disabled) return;
        if (w === phrase[step]){
          b.classList.add('correct');
          b.disabled = true;
          const c = b.cloneNode(true);
          c.disabled = true;
          target.appendChild(c);
          step++;
          if (step === phrase.length){
            setTimeout(() => {
              phraseIdx++;
              if (phraseIdx < phrases.length) renderPhrase();
              else go('scene-stars');
            }, 600);
          }
        } else {
          b.animate(
            [{transform:'translateX(0)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],
            {duration:220}
          );
        }
      });
      pool.appendChild(b);
    });
  }

  // ============================================
  // 6. CONSTELAÇÃO
  // ============================================
  let starsRAF = 0;
  function initStars(){
    const canvas = $('#starsCanvas');
    const ctx = canvas.getContext('2d', { alpha:true });
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w*DPR; canvas.height = h*DPR;

    // 12 estrelas dispostas ao longo de uma curva de coração
    // parametrização clássica: x = 16 sin³(t), y = -(13cos t - 5cos2t - 2cos3t - cos4t)
    const N = 12;
    const raw = [];
    for (let i=0;i<N;i++){
      const t = (i / N) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t));
      raw.push([x,y]);
    }
    // normaliza para [0.1, 0.9]
    const xs = raw.map(p=>p[0]), ys = raw.map(p=>p[1]);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const pad = 0.12;
    const pts = raw.map(([x,y]) => ({
      x: (pad + (x-minX)/(maxX-minX) * (1-2*pad)) * canvas.width,
      y: (pad + (y-minY)/(maxY-minY) * (1-2*pad)) * canvas.height,
      r: 4*DPR, hit:false
    }));

    let nextI = 0;
    let twinkle = 0;

    function draw(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      twinkle += 0.03;

      // linhas conectadas
      ctx.strokeStyle = 'rgba(255,143,179,0.8)';
      ctx.lineWidth = 1.8*DPR;
      ctx.shadowColor = 'rgba(255,143,179,0.6)'; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i=0;i<nextI;i++){
        if (i===0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      // fecha o coração quando todas conectadas
      if (nextI === pts.length) ctx.lineTo(pts[0].x, pts[0].y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // estrelas
      pts.forEach((p,i) => {
        const active = i === nextI;
        const done = i < nextI;
        const tw = 0.6 + Math.sin(twinkle + i)*0.2;
        const r = p.r * (active ? 2.2 : done ? 1.6 : 1.4);
        const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*3);
        const core = done ? '#ffd1de' : active ? '#ff8fb3' : `rgba(234,247,241,${tw})`;
        g.addColorStop(0, core);
        g.addColorStop(1,'rgba(255,143,179,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x,p.y,r*3,0,Math.PI*2); ctx.fill();
      });

      starsRAF = requestAnimationFrame(draw);
    }

    function pick(e){
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      const x = (t.clientX - rect.left) * (canvas.width / rect.width);
      const y = (t.clientY - rect.top)  * (canvas.height / rect.height);
      const p = pts[nextI];
      if (!p) return;
      const dx = x-p.x, dy = y-p.y;
      if (dx*dx + dy*dy < (44*DPR)**2){
        nextI++;
        if (nextI >= pts.length){
          setTimeout(() => { cancelAnimationFrame(starsRAF); go('scene-transition'); }, 1000);
        }
      }
    }
    canvas.addEventListener('touchstart', pick, {passive:true});
    canvas.addEventListener('mousedown', pick);

    cancelAnimationFrame(starsRAF);
    draw();
  }


  // ============================================
  // 7. TRANSIÇÃO
  // ============================================
  function playTransition(){
    const lines = $$('#scene-transition .trans-line');
    const btn = $('#scene-transition .btn-primary');
    lines.forEach(l => l.classList.remove('show'));
    btn.classList.remove('show');
    lines.forEach((l,i) => setTimeout(() => l.classList.add('show'), 400 + i*1100));
    setTimeout(() => btn.classList.add('show'), 400 + lines.length*1100);
  }

  // ============================================
  // 8. CARTA
  // ============================================
  const letterText =
`Queria dizer que amo você, mas estava pensando numa forma diferente de fazer isso, então decidi fazer esses joguinhos.

Bom, queria dizer o quão importante você é pra minha vida, a luz que você é e sempre será pra mim.

Helô, você é aquilo de melhor que já me aconteceu, você é tudo que eu sempre desejei, você é a garota que ilumina todos os meus dias e eu te amo muito.

Amo seu jeito de ser, seu jeito de falar, sua voz, seus olhos, sua personalidade, eu amo a pessoa por completo que você é.

Eu te amo minha princesa 🤍`;

  let typingTO = 0;
  function typeLetter(){
    const body = $('#letterBody');
    const cursor = $('#letterCursor');
    body.textContent = '';
    let i = 0;
    clearTimeout(typingTO);
    function step(){
      body.textContent = letterText.slice(0, i);
      i++;
      if (i <= letterText.length){
        // velocidade adaptativa
        const ch = letterText[i-1];
        const delay = ch === '\n' ? 220 : (ch === ',' || ch === '.' ? 80 : 28);
        typingTO = setTimeout(step, delay);
      } else {
        cursor.style.display = 'none';
      }
    }
    cursor.style.display = '';
    step();
  }

  // ============================================
  // ÁUDIO
  // Música fixa em /áudio/musica.mp3 — toca em loop até o fim.
  // ============================================
  const btn = $('#musicBtn');
  const ico = $('#musicIco');
  const songEl = $('#songEl');
  btn.classList.add('off');

  let on = false;
  let fadeRAF = 0;

  function fadeVolume(target, ms){
    cancelAnimationFrame(fadeRAF);
    const start = songEl.volume;
    const t0 = performance.now();
    (function tick(t){
      const k = Math.min(1, (t - t0) / ms);
      songEl.volume = start + (target - start) * k;
      if (k < 1) fadeRAF = requestAnimationFrame(tick);
    })(t0);
  }

  btn.addEventListener('click', async () => {
    on = !on;
    btn.classList.toggle('off', !on);
    ico.textContent = on ? '♫' : '♪';

    if (!on){
      fadeVolume(0, 600);
      setTimeout(() => { if (!on) songEl.pause(); }, 700);
      return;
    }

    try {
      songEl.volume = 0;
      await songEl.play();
      fadeVolume(0.7, 1200);
    } catch (e) {
      console.warn('Não foi possível tocar a música:', e);
    }
  });


  // Pausar canvases fora da tela
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){
      cancelAnimationFrame(mazeRAF);
      cancelAnimationFrame(starsRAF);
    } else {
      if (current === 'scene-maze') initMaze();
      if (current === 'scene-stars') initStars();
    }
  });
})();

// ============================================
// match.js - واجهة المباراة، الرسم، النتيجة
// ============================================

// ============================================
// بدء المباراة
// ============================================
function play(){
  if(!G.lu || G.lu.length !== 11 || G.lu.includes(null) || G.lu.some(id => !T[G.my].ps.find(p => p.id === id))){
    return alert('التشكيلة غير مكتملة!');
  }
  const nm = getNextUserMatch();
  if(!nm) return alert('لا مباراة!');
  if(daysUntilMatch(nm) > 0) return alert(`بعد ${daysUntilMatch(nm)} يوم!`);

  const hm = nm.home;
  const oid = nm.opp;
  let oT;
  if(T[oid]) oT = T[oid];
  else if(AFRICAN.find(a => a[0] === oid)){
    const a = AFRICAN.find(a => a[0] === oid);
    oT = createVirtualTeam(oid, a[1], a[2]);
  } else if(WORLD.find(w => w[0] === oid)){
    const w = WORLD.find(w => w[0] === oid);
    oT = createVirtualTeam(oid, w[1], w[2], w[3], w[4]);
  } else if(DIV2.includes(oid)){
    oT = createVirtualTeam(oid, oid, 68);
  } else return alert('خصم غير معروف');

  const hT = hm ? T[G.my] : oT;
  const aT = hm ? oT : T[G.my];
  const hL = hm
    ? G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean)
    : autoFillLineup(oT, '4-3-3').map(id => oT.ps.find(p => p.id === id)).filter(Boolean);
  const aL = hm
    ? autoFillLineup(oT, '4-3-3').map(id => oT.ps.find(p => p.id === id)).filter(Boolean)
    : G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean);

  const cn = {league:'الدوري', cup:'كأس مصر', cafCL:'أبطال أفريقيا', cafCC:'الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم'};
  const w = getWeather(nm.day);

  Mt = new Match({
    h: hT, a: aT, hl: hL, al: aL,
    hf: hm ? G.form : '4-3-3',
    af: hm ? '4-3-3' : G.form,
    ht: hm ? G.tac : 'balanced',
    at: hm ? 'balanced' : G.tac,
    human: hm ? 'home' : 'away',
    compName: cn[nm.comp] || nm.comp,
    weather: w
  });

  $('mh').textContent = Mt.h.name;
  $('ma').textContent = Mt.a.name;
  $('weather-badge').textContent = `${w.emoji} ${w.type}`;
  shown = 0;
  paused = false;
  speed = 3;
  $('bs').textContent = '×3';
  $('lg').innerHTML = '';
  $('mr').textContent = `${cn[nm.comp]||nm.comp} • ${nm.round}`;
  $('live-commentary').style.display = 'none';
  $('momentum-pointer').style.left = '50%';
  mtac(G.tac);
  $('ms').hidden = false;
  last = performance.now();
  raf = requestAnimationFrame(loop);
}

// ============================================
// فريق افتراضي للخصوم (الأفريقي، العالمي، DIV2)
// ============================================
function createVirtualTeam(id, name, rating, c1, c2){
  const ps = [];
  const positions = ['GK','GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
  positions.forEach((pos, i) => {
    const r = Math.max(55, rating-3+Math.floor(R()*6));
    ps.push(createPlayer(id+'_'+i, name+' '+i, pos, r, 22));
  });
  return {
    id, name, R: rating,
    c1: c1 || '#1e40af',
    c2: c2 || '#ffffff',
    ps, form:'4-3-3', tac:'balanced', budget:50,
    gk: GKC[hs(id)%4]
  };
}

// ============================================
// حلقة المباراة
// ============================================
function loop(n){
  last = n;
  if(!paused && !Mt.done && Mt.hold <= 0){
    for(let i=0; i<speed; i++){
      if(!Mt.done) Mt.step();
    }
  }
  draw();
  ui();
  if(Mt.done){finish(); return;}
  raf = requestAnimationFrame(loop);
}

// ============================================
// تحديث واجهة المباراة
// ============================================
function ui(){
  const s = Mt.s;
  $('sc').textContent = `${s.home.g} - ${s.away.g}`;
  const mF = Math.floor(Mt.min);
  if(Mt.half === 1 && mF >= 45) $('mm').textContent = `45+${mF-45}'`;
  else if(Mt.half === 2 && mF >= 90) $('mm').textContent = `90+${mF-90}'`;
  else $('mm').textContent = mF+"'";
  $('mhalf').textContent = Mt.half === 1 ? 'ش1' : 'ش2';

  const lc = $('live-commentary');
  if(Mt.log.length > 0){
    const l = Mt.log[Mt.log.length-1];
    lc.textContent = l.x;
    lc.style.display = 'block';
    lc.style.color = l.t==='goal' ? '#4ade80'
      : (l.t==='red' ? '#f87171'
      : (l.t==='var' ? '#a855f7'
      : (l.t==='injury' ? '#ef4444'
      : (l.t==='shot' ? '#fbbf24' : '#fff'))));
  }

  while(shown < Mt.log.length){
    const l = Mt.log[shown++], d = document.createElement('div');
    d.className = 'li '+l.t;
    d.textContent = (l.t==='info'?'':l.m+"' ")+l.x;
    $('lg').prepend(d);
  }

  const a = s.home, b = s.away;
  $('ms-shotH').textContent = a.sh;
  $('ms-shotA').textContent = b.sh;
  $('ms-corH').textContent = a.co;
  $('ms-corA').textContent = b.co;
  $('ms-flH').textContent = a.fl;
  $('ms-flA').textContent = b.fl;
  $('ms-ycH').textContent = a.yc;
  $('ms-ycA').textContent = b.yc;
  $('ms-rcH').textContent = a.rc;
  $('ms-rcA').textContent = b.rc;
  $('momentum-pointer').style.left = Mt.momentum+'%';
  $('sl').textContent = s[Mt.hu].subs+'/5';
  $('bp').textContent = paused ? '▶' : '⏸';
}

// ============================================
// رسم اللاعب على الملعب
// ============================================
function man(x, p, px, py, t, gk, car, num, isRef = false){
  const f = p.fc || 1;
  const mv = Math.min(1, p.mv||0);
  const a = Math.sin(p.ph||0)*.95*mv;
  const ks = p.kick > 0;
  const up = Mt.sc && Mt.sc.p == p;
  const dv = p.dive > 0 && gk;
  const kit = isRef ? '#111' : (gk ? t.gk : t.c1);
  const sh = isRef ? '#111' : (gk ? '#1a1a1a' : t.c2);
  const sock = isRef ? '#ffeb3b' : (gk ? '#1a1a1a' : t.c1);
  const sc = SKN[(p.sk||1)%9];
  const hc = HRC[(p.sk||1)%5];

  x.save();
  x.translate(px, py);
  x.fillStyle = 'rgba(0,0,0,.28)';
  x.beginPath();
  x.ellipse(0, 1, 8, 2.6, 0, 0, 7);
  x.fill();
  if(car){
    x.strokeStyle = '#fbbf24';
    x.lineWidth = 1.5;
    x.beginPath();
    x.ellipse(0, 1, 10, 3.8, 0, 0, 7);
    x.stroke();
  }
  x.scale(f, 1);
  x.lineCap = 'round';

  const leg = g => {
    const hy = -12;
    const kx = Math.sin(g)*6.5;
    const ky = hy+Math.cos(g)*6.5;
    const g2 = g-.7*Math.abs(g);
    const ax = kx+Math.sin(g2)*6.5;
    const ay = ky+Math.cos(g2)*6.5;
    x.strokeStyle = sc; x.lineWidth = 3.2;
    x.beginPath(); x.moveTo(0, hy); x.lineTo(kx, ky); x.stroke();
    x.strokeStyle = sock; x.lineWidth = 3.4;
    x.beginPath(); x.moveTo(kx, ky); x.lineTo(ax, ay); x.stroke();
    x.fillStyle = '#111';
    x.fillRect(ax-1.5, ay-1, 5, 2.6);
  };
  leg(ks ? 1.15 : -a);
  leg(ks ? -.25 : a);

  x.fillStyle = sh;
  x.beginPath();
  x.moveTo(-4.6, -12.5);
  x.lineTo(4.6, -12.5);
  x.lineTo(5.2, -6.5);
  x.lineTo(-5.2, -6.5);
  x.fill();

  x.fillStyle = kit;
  x.beginPath();
  x.moveTo(-5.6, -22);
  x.lineTo(5.6, -22);
  x.lineTo(4.4, -12);
  x.lineTo(-4.4, -12);
  x.closePath();
  x.fill();

  const arm = b => {
    const ex = Math.sin(b)*4.5;
    const ey = -21+Math.cos(b)*4.5;
    const hx = ex+Math.sin(b-.6)*4;
    const hy = ey+Math.cos(b-.6)*4;
    x.strokeStyle = kit; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, -21); x.lineTo(ex, ey); x.stroke();
    x.strokeStyle = sc; x.lineWidth = 2.2;
    x.beginPath(); x.moveTo(ex, ey); x.lineTo(hx, hy); x.stroke();
    if(gk){
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(hx, hy, 2, 0, 7); x.fill();
    }
  };
  if(up || dv){
    arm(up ? 2.9 : 2.2);
    arm(up ? 3.4 : 2.6);
  } else {
    arm(a*.9);
    arm(-a*.9);
  }

  x.fillStyle = sc;
  x.fillRect(-1.2, -24, 2.4, 2.5);
  x.beginPath();
  x.arc(.6, -27.2, 3.6, 0, 7);
  x.fill();
  x.fillStyle = hc;
  x.beginPath();
  x.arc(.2, -27.8, 3.8, Math.PI*1.05, Math.PI*2.05);
  x.fill();

  x.scale(f, 1);
  if(!isRef){
    x.fillStyle = gk ? '#fff' : t.c2;
    x.font = 'bold 6px sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(num, 0, -16.5);
    if(p.yc > 0){
      x.fillStyle = '#fbbf24';
      x.fillRect(5, -31, 3.5, 5);
      x.strokeStyle = '#000';
      x.lineWidth = .4;
      x.strokeRect(5, -31, 3.5, 5);
    }
    if(p.origId === Mt.effectiveRoles?.captain){
      x.fillStyle = '#fbbf24';
      x.strokeStyle = '#000';
      x.lineWidth = .6;
      x.beginPath();
      x.arc(-6, -23, 3, 0, 7);
      x.fill();
      x.stroke();
      x.fillStyle = '#000';
      x.font = 'bold 4px sans-serif';
      x.fillText('C', -6, -22.5);
    }
  }
  x.restore();
}

// ============================================
// رسم الملعب (مع cache)
// ============================================
let _pitch = null, _pW = 0, _pH = 0;

function drawPitch(x, W, H, P, u){
  if(_pitch && _pW == W && _pH == H){
    x.drawImage(_pitch, 0, 0);
    return;
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const px = c.getContext('2d');
  const grad = px.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*.7);
  grad.addColorStop(0, '#1a7a3e');
  grad.addColorStop(1, '#0f4d24');
  px.fillStyle = grad;
  px.fillRect(0, 0, W, H);

  for(let i=0; i<14; i+=2){
    px.fillStyle = 'rgba(0,0,0,.1)';
    px.fillRect(P+i*L/14*u, P, L/14*u, H-2*P);
  }

  px.strokeStyle = '#ffffffd0';
  px.lineWidth = 2;
  px.strokeRect(P, P, W-2*P, H-2*P);
  px.beginPath();
  px.moveTo(P+L/2*u, P);
  px.lineTo(P+L/2*u, H-P);
  px.stroke();
  px.beginPath();
  px.arc(P+L/2*u, P+34*(H-2*P)/WD, 9.15*u, 0, 7);
  px.stroke();

  [0,1].forEach(i => {
    const s = i ? -1 : 1;
    const g = i ? L : 0;
    px.strokeRect(i ? P+(L-16.5)*u : P, P+(34-20.15)*(H-2*P)/WD, 16.5*u, 40.3*(H-2*P)/WD);
    px.strokeRect(i ? P+(L-5.5)*u : P, P+(34-9.15)*(H-2*P)/WD, 5.5*u, 18.3*(H-2*P)/WD);
    px.beginPath();
    px.arc(P+(g+s*11)*u, P+34*(H-2*P)/WD, 2, 0, 7);
    px.fillStyle = '#fff';
    px.fill();
    px.fillStyle = '#ffffff55';
    px.fillRect(i ? P+L*u : P-9, P+(34-GW/2)*(H-2*P)/WD, 9, GW*(H-2*P)/WD);
  });

  _pitch = c;
  _pW = W;
  _pH = H;
  x.drawImage(c, 0, 0);
}

// ============================================
// الرسم الرئيسي
// ============================================
function draw(){
  const c = $('pc'), x = c.getContext('2d'), W = c.width, H = c.height, P = 14;
  const u = (W-2*P)/L;
  const X = v => P+v*u;
  const Y = v => P+v*(H-2*P)/WD;
  drawPitch(x, W, H, P, u);

  const LS = [];
  for(const k of ['home','away']){
    Mt.s[k].on.forEach((p, i) => LS.push([p, k, i, false]));
  }
  LS.push([Mt.ref, 'ref', 0, true]);
  LS.sort((a, b) => a[0].y-b[0].y);

  LS.forEach(([p, k, i, isRef]) => {
    if(isRef) man(x, p, X(p.x), Y(p.y)+12, null, false, false, 0, true);
    else man(x, p, X(p.x), Y(p.y)+12, Mt.s[k].t, p.role=='GK', Mt.ball.o == p, i+1, false);
  });

  const b = Mt.ball;
  const bx = X(b.x), by = Y(b.y)+12, bz = b.z||0;

  if(b.trail && b.trail.length){
    b.trail.forEach((t, i) => {
      const a = 0.5*((i+1)/b.trail.length);
      x.fillStyle = `rgba(255,255,255,${a})`;
      x.beginPath();
      x.arc(X(t.x), Y(t.y)+12-4-(t.z||0)*2.2, 2, 0, 7);
      x.fill();
    });
  }

  x.fillStyle = 'rgba(0,0,0,.35)';
  x.beginPath();
  x.ellipse(bx, by, Math.max(2, 5-bz*.25), Math.max(1, 2-bz*.1), 0, 0, 7);
  x.fill();
  x.fillStyle = '#fff';
  x.beginPath();
  x.arc(bx, by-4-bz*2.2, 4.2+Math.min(2, bz*.15), 0, 7);
  x.fill();
  x.strokeStyle = '#000';
  x.lineWidth = .8;
  x.stroke();

  if(b.o){
    x.font = 'bold 8px Cairo,sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'bottom';
    x.lineWidth = 2;
    x.strokeStyle = '#000';
    x.fillStyle = '#fff';
    const tx = X(b.o.x), ty = Y(b.o.y)+12-34;
    x.strokeText(b.o.name, tx, ty);
    x.fillText(b.o.name, tx, ty);
  }

  if(Mt.fl){
    x.fillStyle = 'rgba(0,0,0,.75)';
    x.fillRect(0, H/2-28, W, 56);
    x.fillStyle = '#fbbf24';
    x.font = '900 22px Cairo,sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(Mt.fl.x, W/2, H/2);
  }
}

// ============================================
// أزرار التحكم أثناء المباراة
// ============================================
function mtac(k){
  if(!Mt) return;
  Mt.s[Mt.hu].tc = k;
  document.querySelectorAll('[data-t]').forEach(b => {
    b.classList.toggle('on', b.dataset.t === k);
  });
}

function pz(){paused = !paused;}
function spd(){
  const a = [1,2,3,4];
  speed = a[(a.indexOf(speed)+1)%4];
  $('bs').textContent = '×'+speed;
}

function subm(){
  const s = Mt.s[Mt.hu];
  if(s.subs >= 5) return alert('5 تبديلات');
  $('so').innerHTML = s.on.filter(p => p.role != 'GK').map(p => `<option value="${p.id}">${p.name} (${p.role}) ⭐${p.r}</option>`).join('');
  $('si').innerHTML = s.bn.map(p => `<option value="${p.id}">${p.name} (${p.pos}) ⭐${p.r}</option>`).join('');
  $('sm').hidden = false;
}

function doSub(){
  if(Mt.sub(Mt.hu, $('so').value, $('si').value)) $('sm').hidden = true;
}

function skip(){
  if(!Mt || Mt.done) return;
  let s = 0;
  while(!Mt.done && s < 60000){
    Mt.step();
    s++;
  }
  ui();
  draw();
  finish();
}

// ============================================
// مزامنة إحصائيات المباراة بعد الانتهاء
// ============================================
function syncMatchStats(m){
  try{
    ['home','away'].forEach(k => {
      const team = m.s[k].t;
      if(!team || !team.ps) return;
      team.ps.forEach(p => {
        if(p.susp > 0) p.susp = Math.max(0, p.susp-1);
      });
      const played = m.s[k].played || m.s[k].on || [];
      played.forEach(p => {
        const orig = team.ps.find(x => x.id === (p.origId||p.id));
        if(!orig) return;
        if(p.goals) orig.goals = (orig.goals||0)+p.goals;
        if(p.minSt != null) orig.fit = Math.max(35, Math.round(p.minSt));
        let xp = 35;
        if(p.goals) xp += p.goals*30;
        if(p.yc) xp -= 5;
        if(p.rc) xp -= 20;
        gainXp(orig, xp);
        if(R() < .008) tryInjure(orig);
        orig.stats.matches++;
        orig.stats.goals += p.goals||0;
        let rating = 6.0+(p.goals*2)+(p.stats.tackles*0.1)+(p.stats.passes*0.01);
        if(rating > 10) rating = 10;
        orig.stats.rating += rating;
        if(!orig.form) orig.form = [];
        orig.form.push(rating);
        if(orig.form.length > 3) orig.form.shift();
      });
    });

    (m.redCards||[]).forEach(rc => {
      const team = T[rc.teamId];
      if(!team) return;
      const p = team.ps.find(x => x.id === rc.id);
      if(p) p.susp = 1;
    });

    (m.injuries||[]).forEach(inj => {
      const team = m.s.home.t.ps.find(p => p.id === inj.id) ? m.s.home.t : m.s.away.t;
      const p = team.ps.find(x => x.id === inj.id);
      if(p) tryInjure(p);
    });
  } catch(e){
    console.error('sync error:', e);
  }
}

// ============================================
// إنهاء المباراة وإظهار النتيجة
// ============================================
function finish(){
  try{
    cancelAnimationFrame(raf);
    if(Mt.fin) return;
    Mt.fin = 1;

    const s = Mt.s;
    const mg = s[Mt.hu].g;
    const og = s[Mt.hu==='home' ? 'away' : 'home'].g;
    const myT = Mt.s[Mt.hu].t;
    const oppT = Mt.s[Mt.hu==='home' ? 'away' : 'home'].t;
    const nm = getNextUserMatch();
    const cn = {league:'الدوري', cup:'كأس مصر', cafCL:'أبطال أفريقيا', cafCC:'الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم'};

    // تسجيل نتيجة الدوري
    if(nm && nm.comp === 'league'){
      rec(Mt.h, Mt.a, s.home.g, s.away.g);
      const lf = G.season.leagueFixtures[nm.round];
      if(lf){
        const k = `${Mt.h.id}_${Mt.a.id}`;
        if(!lf.played.includes(k)) lf.played.push(k);
      }
    }

    let rW = mg > og, rD = mg === og;
    const isKO = ['cup','cafCL','cafCC','super','cafSuper','clubWC'].includes(nm?.comp);
    let pr = null;
    if(isKO && rD){
      pr = realPenaltyShootout(Mt.h, Mt.a);
      const pw = pr.winner === 'home' ? Mt.h.id : Mt.a.id;
      if(pw === G.my) rW = true;
      showPenaltyModal(pr, Mt.h.name, Mt.a.name);
    }

    if(nm){
      nm.played = true;
      nm.result = {myGoals:mg, oppGoals:og, won:rW, draw:rD, penalty:pr};
    }

    // تقدم البطولات
    if(nm){
      if(nm.comp === 'cup' && G.season.cupBracket){
        const m = G.season.cupBracket.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){
          m.played = true;
          m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home);
          advanceCupBracket();
        }
      }
      if(nm.comp === 'cafCL' && G.season.cafCL){
        const m = G.season.cafCL.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){
          m.played = true;
          m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home);
          advanceCafComp('cafCL');
        }
      }
      if(nm.comp === 'cafCC' && G.season.cafCC){
        const m = G.season.cafCC.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){
          m.played = true;
          m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home);
          advanceCafComp('cafCC');
        }
      }
      if(nm.comp === 'super' && G.season.egyptSuper){
        G.season.egyptSuper.played = true;
        G.season.egyptSuper.winner = rW ? G.my : nm.opp;
        if(rW){
          G.trophies = (G.trophies||0)+1;
          addTrophy('السوبر المصري', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1);
          addNews(`🏆 ${myT.name} بطل السوبر المصري!`, `🎉 فوز على ${oppT.name} • بطولة جديدة`);
        }
      }
      if(nm.comp === 'cafSuper' && G.season.cafSuper){
        G.season.cafSuper.played = true;
        G.season.cafSuper.winner = rW ? G.my : nm.opp;
        if(rW){
          G.trophies = (G.trophies||0)+1;
          addTrophy('السوبر الأفريقي', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1);
          addNews(`🌍 ${myT.name} بطل السوبر الأفريقي!`, `🏆 فوز على ${oppT.name} • إنجاز قاري`);
        }
      }
      if(nm.comp === 'clubWC' && G.season.clubWC){
        const m = G.season.clubWC.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){
          m.played = true;
          m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home);
          advanceClubWC();
        }
      }
    }

    syncMatchStats(Mt);
    updateMorale(myT, rW ? 'win' : (rD ? 'draw' : 'loss'));
    updateMorale(oppT, rW ? 'loss' : (rD ? 'draw' : 'win'));
    updateContractMorale(myT);

    // الاقتصاد
    const totalSalary = myT.ps.reduce((sum, p) => sum+(p.contract?.salary||0), 0);
    const baseIncome = rW ? 15 : rD ? 8 : 3;
    const sponsorInc = G.currentSponsor ? (G.currentSponsor.safe/20) : 0;
    const netIncome = Math.round((baseIncome+sponsorInc-totalSalary)*10)/10;
    myT.budget = Math.round((myT.budget+netIncome)*10)/10;
    if(myT.budget < -20){
      myT.budget += 30;
      addNews(`💰 قرض طارئ من الإدارة!`, `📈 +30M لتفادي الإفلاس • ميزانيتك الآن ${myT.budget.toFixed(1)}M`);
    }

    // الديربي
    if(Mt.isDerby){
      if(rW) addNews(`⚔️🔥 فوز ديربي تاريخي!`, `${myT.name} يهزم ${oppT.name} ${s.home.g}-${s.away.g}`);
      else if(!rD) addNews(`⚔️😞 خسارة ديربي مؤلمة`, `${oppT.name} يهزم ${myT.name} ${s.home.g}-${s.away.g}`);
      else addNews(`⚔️ تعادل ديربي مثير`, `${myT.name} و${oppT.name} يتقاسمان النقاط ${s.home.g}-${s.away.g}`);
    }

    // الهدافون
    const homeScorers = [], awayScorers = [];
    Mt.s[Mt.hu].on.forEach(p => {if(p.goals > 0) homeScorers.push(`${p.name}×${p.goals}`);});
    Mt.s[Mt.hu==='home' ? 'away' : 'home'].on.forEach(p => {if(p.goals > 0) awayScorers.push(`${p.name}×${p.goals}`);});
    let scorerLine = '';
    if(homeScorers.length) scorerLine += `⚽ ${myT.name}: ${homeScorers.join(', ')}`;
    if(awayScorers.length){
      if(scorerLine) scorerLine += '\n';
      scorerLine += `⚽ ${oppT.name}: ${awayScorers.join(', ')}`;
    }
    if(!scorerLine) scorerLine = '⚽ مباراة بدون أهداف';
    addNews(`⚽ ${cn[nm?.comp||'']}: ${myT.name} ${s.home.g}-${s.away.g} ${oppT.name}`,
      `${rW?'🎉 فوز':rD?'🤝 تعادل':'😞 خسارة'}\n${scorerLine}`);

    Mt.s[Mt.hu].on.forEach(p => {
      if(p.goals >= 3) addNews(`🔥 هاتريك! ${p.name}`, `⚽ ${p.goals} أهداف في مباراة واحدة • إنجاز فردي`);
    });

    if(netIncome !== 0){
      const incomeLine = netIncome > 0 ? `📈 دخل صافي +${netIncome}M` : `📉 عجز ${Math.abs(netIncome).toFixed(1)}M`;
      addNews(`💰 الميزانية بعد المباراة: ${myT.budget.toFixed(1)}M`, `${incomeLine} • ${totalSalary.toFixed(2)}M رواتب • ${baseIncome+sponsorInc}M دخل`);
    }

    // XP للمدرب
    let xpG = rW ? 50 : rD ? 20 : 5;
    if(isKO && rW) xpG += 30;
    if(Mt.isDerby && rW) xpG += 20;
    addManagerXp(xpG);

    // خسائر متتالية
    if(rW){playSound('goal'); G.lossStreak = 0;}
    else if(!rD){
      playSound('card');
      G.lossStreak++;
      if(G.lossStreak >= 3) addNews(`⚠️ تحذير! ${G.lossStreak} خسارات متتالية!`, `📉 الإدارة بدأت تفكر في بديل • صحح المسار!`);
    } else playSound('whistle');

    if(G.lossStreak >= 5){
      save();
      $('game-over').hidden = false;
      $('go-text').textContent = `خسرت 5 مباريات متتالية، قررت الإدارة إقالتك.`;
      return;
    }

    save();

    // إظهار شاشة النتيجة
    const rsIcon = rW ? '🏆' : rD ? '🤝' : '😞';
    const rsTitle = rW ? 'فوز رائع!' : rD ? 'تعادل مثير' : 'خسارة صعبة';
    const rsClass = rW ? 'mc-success' : rD ? 'mc-warning' : 'mc-danger';
    const rsEmoji = rW ? '🎉' : rD ? '🤝' : '😔';

    document.getElementById('rs-mc').className = 'mc '+rsClass;
    $('rs-icon').textContent = rsIcon;
    $('rs-title').textContent = rsTitle;
    $('rcomp').textContent = cn[nm?.comp]||'مباراة';
    $('rst').innerHTML = `📊 <b>استحواذ:</b> ${Math.round(100*s.home.ps/(s.home.ps+s.away.ps||1))}% • <b>تسديدات:</b> ${s.home.sh}-${s.away.sh} • <b>بطاقات:</b> 🟨${s.home.yc}-${s.away.yc}`;
    $('rsc').textContent = `${Mt.h.name} ${s.home.g} - ${s.away.g} ${Mt.a.name}`;
    $('rso').innerHTML = `${rsEmoji} ${rW?'فوز! 🎉':rD?'تعادل 🤝':'خسارة 😞'}`;
    $('rso').style.color = rW ? '#22c55e' : rD ? '#fbbf24' : '#ef4444';
    $('rfin').innerHTML = `💰 صافي المباراة: <b style="color:${netIncome>=0?'#4ade80':'#f87171'}">${netIncome>=0?'+':''}${netIncome.toFixed(1)}M</b> • الرصيد: ${myT.budget.toFixed(1)}M`;
    if(pr){
      $('rpen').style.display = 'block';
      $('rpen').innerHTML = `🥅 ترجيح: ${pr.scoreA}-${pr.scoreB}`;
    } else $('rpen').style.display = 'none';
    $('rlu').innerHTML = (Array.isArray(pendingLvl) && pendingLvl.length) ? pendingLvl.map(l => `<div>${l}</div>`).join('') : '';
    $('rs').hidden = false;
  } catch(e){
    console.error('finish err:', e);
    $('rs').hidden = true;
    alert('خطأ: '+e.message);
  }
}

// ============================================
// ركلات الترجيح (نافذة)
// ============================================
function showPenaltyModal(r, hN, aN){
  $('pen-score').textContent = `${hN} ${r.scoreA} - ${r.scoreB} ${aN}`;
  $('pen-log').innerHTML = r.log.map(l => `<div>${l}</div>`).join('');
  const wN = r.winner === 'home' ? hN : aN;
  $('pen-result').textContent = `🏆 ${wN} يتأهل!`;
  pendingPenaltyResult = r;
  $('pen-m').hidden = false;
}

function closePenaltyModal(){
  $('pen-m').hidden = true;
}

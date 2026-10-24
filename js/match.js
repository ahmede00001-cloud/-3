// ============================================
// match.js - الإصدار النهائي (v4.0) - محصن ضد أخطاء البطولات
// ============================================

(function(){
  if(document.getElementById('hidden-fix')) return;
  const st = document.createElement('style');
  st.id = 'hidden-fix';
  st.textContent = '[hidden]{display:none !important}';
  document.head.appendChild(st);
})();

let _mtSimAcc = 0;
let _mtLoopErr = 0;
let _mtStartTime = 0;
const _MT_STEP_MS = 1000/60;

// دالة إجبارية لإخفاء كل النوافذ
function forceHideModals() {
  document.querySelectorAll('.md, .ov, #cm, #pen-m, #sm, #rs, #om, #pm').forEach(el => {
    el.hidden = true;
    el.style.display = 'none';
  });
}

function play(){
  try {
    if(!G.lu || G.lu.length !== 11 || G.lu.includes(null) || G.lu.some(id => !T[G.my] || !T[G.my].ps.find(p => p.id === id))){
      return alert('التشكيلة غير مكتملة! يرجى التأكد من اختيار 11 لاعباً.');
    }

    const nm = getNextUserMatch();
    if(!nm) return alert('لا توجد مباراة قادمة!');

    if(daysUntilMatch(nm) > 0) {
      try { advanceToDay(nm.day); } catch(e) { console.error("Advance error:", e); }
    }

    forceHideModals();
    if(raf) cancelAnimationFrame(raf);

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
    } else {
      // احتياطي في حال عدم وجود الفريق
      oT = createVirtualTeam(oid || 'unknown', 'فريق خصم', 75);
    }

    const hT = hm ? T[G.my] : oT;
    const aT = hm ? oT : T[G.my];
    const hL = hm ? G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) : autoFillLineup(oT, '4-3-3').map(id => oT.ps.find(p => p.id === id)).filter(Boolean);
    const aL = hm ? autoFillLineup(oT, '4-3-3').map(id => oT.ps.find(p => p.id === id)).filter(Boolean) : G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean);

    const cn = {league:'الدوري', cup:'كأس مصر', cafCL:'أبطال أفريقيا', cafCC:'الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم'};
    const w = typeof getWeather === 'function' ? getWeather(nm.day) : {emoji:'☀️', type:'مشمس'};

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

    Mt.calendarItem = nm;

    if($('mh')) $('mh').textContent = Mt.h.name;
    if($('ma')) $('ma').textContent = Mt.a.name;
    if($('weather-badge')) $('weather-badge').textContent = `${w.emoji} ${w.type}`;
    shown = 0;
    paused = false;
    speed = 3;
    _mtSimAcc = 0;
    _mtLoopErr = 0;
    _mtStartTime = performance.now();
    
    if($('bs')) $('bs').textContent = '×3';
    if($('lg')) $('lg').innerHTML = '';
    if($('mr')) $('mr').textContent = `${cn[nm.comp]||nm.comp} • ${nm.round}`;
    if($('live-commentary')) $('live-commentary').style.display = 'none';
    if($('momentum-pointer')) $('momentum-pointer').style.left = '50%';
    mtac(G.tac);

    const msEl = $('ms');
    if(msEl) {
      msEl.hidden = false;
      msEl.style.display = 'flex';
    }

    // زر الطوارئ
    if(msEl && !document.getElementById('force-end-btn')){
      const btn = document.createElement('button');
      btn.id = 'force-end-btn';
      btn.textContent = '⚠️ إنهاء المباراة';
      btn.style.cssText = 'position:absolute;bottom:60px;left:10px;z-index:9999;background:#ef4444;color:white;padding:6px 10px;font-size:10px;border-radius:6px;border:none;opacity:0.8;';
      btn.onclick = () => { if(Mt){ Mt.done = true; finish(); } };
      msEl.appendChild(btn);
    }

    last = performance.now();
    raf = requestAnimationFrame(loop);
    
  } catch(e) {
    console.error("Critical error in play():", e);
    alert("حدث خطأ أثناء بدء المباراة: " + e.message);
    forceHideModals();
    if(typeof dash === 'function') dash();
  }
}

function loop(n){
  const dt = Math.min(100, Math.max(0, n - last));
  last = n;
  
  try {
    if(!paused && !Mt.done && Mt.hold <= 0){
      _mtSimAcc += dt;
      let safetyCounter = 0;
      
      while(_mtSimAcc >= _MT_STEP_MS && safetyCounter < 100){
        _mtSimAcc -= _MT_STEP_MS;
        for(let i=0; i<speed; i++){
          if(!Mt.done) Mt.step();
        }
        if(Mt.done) break;
        safetyCounter++;
      }
    }

    if(!Mt.done && Mt.min >= 95 + (Mt.inj2 || 0)) Mt.done = true;
    if(!Mt.done && (performance.now() - _mtStartTime) > 180000) Mt.done = true; // 3 دقائق حقيقية

    draw();
    ui();
    _mtLoopErr = 0;
    
    if(Mt.done){ 
      finish(); 
      return; 
    }
    
    raf = requestAnimationFrame(loop);
    
  } catch(e) {
    console.error("Match Loop Error:", e);
    _mtLoopErr++;
    if(_mtLoopErr >= 3){
      try { Mt.done = true; finish(); } catch(err){ forceHideModals(); location.reload(); }
      return;
    }
    paused = true;
    if($('bp')) $('bp').textContent = '▶';
    raf = requestAnimationFrame(loop);
  }
}

function skip(){
  if(!Mt || Mt.done) return;
  try {
    const msEl = $('ms');
    if(msEl) { msEl.hidden = true; msEl.style.display = 'none'; }
    cancelAnimationFrame(raf);

    const hp = typeof Mt.teamPower === 'function' ? Mt.teamPower('home') : 75;
    const ap = typeof Mt.teamPower === 'function' ? Mt.teamPower('away') : 75;
    const currentMin = Math.floor(Mt.min);
    const remainingMin = Math.max(0, 90 - currentMin);

    simLateGoals('home', hp, ap, remainingMin);
    simLateGoals('away', ap, hp, remainingMin);

    Mt.min = 90 + (Mt.inj2 || 0);
    Mt.done = true;
    if (typeof Mt.say === 'function') Mt.say(90, 'info', '🏁 نهاية المباراة');
    finish();
  } catch(e) {
    console.error('Skip Error:', e);
    forceHideModals();
    if(Mt) Mt.done = true;
    finish();
  }
}

function finish(){
  try{
    cancelAnimationFrame(raf);
    if(Mt.fin) return;
    Mt.fin = 1;

    const s = Mt.s;
    const mg = s[Mt.hu].g;
    const og = s[Mt.hu==='home' ? 'away' : 'home'].g;

    let nm = (Mt && Mt.calendarItem) ? Mt.calendarItem : null;
    if(!nm && G && G.season && G.season.userCalendar){
      nm = G.season.userCalendar.find(m => !m.played);
    }

    let rW = mg > og, rD = mg === og;
    const isKO = ['cup','cafCL','cafCC','super','cafSuper','clubWC'].includes(nm?.comp);
    let pr = null;

    // ركلات الترجيح مع حماية
    if(isKO && rD && Mt){
      try {
        if(typeof realPenaltyShootout === 'function') {
            pr = realPenaltyShootout(Mt.h, Mt.a);
        } else {
            throw new Error("realPenaltyShootout is not defined");
        }
        const pw = pr.winner === 'home' ? Mt.h.id : Mt.a.id;
        rW = (pw === G.my);
        rD = false;
        showPenaltyModal(pr, Mt.h.name, Mt.a.name);
      } catch(e) {
        console.error("Penalty error, using fallback:", e);
        const isHomeWin = Math.random() > 0.5;
        rW = isHomeWin ? (Mt.h.id === G.my) : (Mt.a.id === G.my);
        rD = false;
        pr = { winner: isHomeWin ? 'home' : 'away', scoreA: isHomeWin ? 4 : 3, scoreB: isHomeWin ? 3 : 4, log: ['تم استخدام الترجيح التلقائي.'] };
      }
    }

    if(nm){
      nm.played = true;
      nm.result = {myGoals:mg, oppGoals:og, won:rW, draw:rD, penalty:pr};
      if(G.season && G.season.userCalendar) {
        G.season.userCalendar = G.season.userCalendar.filter(m => m !== nm);
      }
      save();
    }

    const myT = Mt.s[Mt.hu].t;
    const oppT = Mt.s[Mt.hu==='home' ? 'away' : 'home'].t;
    const cn = {league:'الدوري', cup:'كأس مصر', cafCL:'أبطال أفريقيا', cafCC:'الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم'};

    // 🚨 تحديث البطولات بحماية صارمة (حتى لو حدث خطأ، المباراة ستنتهي)
    try {
      if(nm && nm.comp === 'league' && Mt){
        rec(Mt.h, Mt.a, s.home.g, s.away.g);
        const lf = G.season.leagueFixtures[nm.round];
        if(lf){ const k = `${Mt.h.id}_${Mt.a.id}`; if(!lf.played.includes(k)) lf.played.push(k); }
      }
    } catch(e) { console.error("League error:", e); }

    try {
      if(nm && nm.comp === 'cup' && G.season.cupBracket){
        const m = G.season.cupBracket.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); }
        if(typeof advanceCupBracket === 'function') advanceCupBracket();
      }
    } catch(e) { console.error("Cup error:", e); }

    try {
      if(nm && nm.comp === 'cafCL' && G.season.cafCL){
        const m = G.season.cafCL.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); }
        if(typeof advanceCafComp === 'function') advanceCafComp('cafCL');
      }
    } catch(e) { console.error("CAF CL error:", e); }

    try {
      if(nm && nm.comp === 'cafCC' && G.season.cafCC){
        const m = G.season.cafCC.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); }
        if(typeof advanceCafComp === 'function') advanceCafComp('cafCC');
      }
    } catch(e) { console.error("CAF CC error:", e); }

    // تحديث الإحصائيات
    try { if(Mt) syncMatchStats(Mt); } catch(e) { console.error('sync err', e); }
    try {
      updateMorale(myT, rW ? 'win' : (rD ? 'draw' : 'loss'));
      updateMorale(oppT, rW ? 'loss' : (rD ? 'draw' : 'win'));
      updateContractMorale(myT);
    } catch(e) { console.error('Morale error:', e); }

    const totalSalary = myT.ps.reduce((sum, p) => sum+(p.contract?.salary||0), 0);
    const baseIncome = rW ? 15 : rD ? 8 : 3;
    const sponsorInc = G.currentSponsor ? (G.currentSponsor.safe/20) : 0;
    const netIncome = Math.round((baseIncome+sponsorInc-totalSalary)*10)/10;
    myT.budget = Math.round((myT.budget+netIncome)*10)/10;

    const scoreStr = `${Mt.h.name} ${s.home.g}-${s.away.g} ${Mt.a.name}`;
    
    const scorersOf = k => (Mt.s[k].played || Mt.s[k].on).filter(p => p.goals > 0).map(p => `${p.name}×${p.goals}`);
    const homeScorers = scorersOf(Mt.hu);
    const awayScorers = scorersOf(Mt.hu==='home' ? 'away' : 'home');
    let scorerLine = '';
    if(homeScorers.length) scorerLine += `⚽ ${myT.name}: ${homeScorers.join(', ')}`;
    if(awayScorers.length){ if(scorerLine) scorerLine += '\n'; scorerLine += `⚽ ${oppT.name}: ${awayScorers.join(', ')}`; }
    if(!scorerLine) scorerLine = '⚽ مباراة بدون أهداف';
    addNews(`⚽ ${cn[nm?.comp||'']||'مباراة'}: ${scoreStr}`, `${rW?'🎉 فوز':rD?'🤝 تعادل':'😞 خسارة'}\n${scorerLine}`);

    let xpG = rW ? 50 : rD ? 20 : 5;
    if(isKO && rW) xpG += 30;
    addManagerXp(xpG);
    if(rW){ if(typeof playSound === 'function') playSound('goal'); G.lossStreak = 0; }
    else if(!rD){ if(typeof playSound === 'function') playSound('card'); G.lossStreak = (G.lossStreak||0)+1; } 
    else { if(typeof playSound === 'function') playSound('whistle'); }

    if(G.lossStreak >= 5){
      save(); if($('game-over')) $('game-over').hidden = false; return;
    }
    save();

    forceHideModals();

    // إظهار شاشة النتيجة
    if($('rs-mc')) $('rs-mc').className = 'mc ' + (rW ? 'mc-success' : rD ? 'mc-warning' : 'mc-danger');
    if($('rs-icon')) $('rs-icon').textContent = rW ? '🏆' : rD ? '🤝' : '😞';
    if($('rs-title')) $('rs-title').textContent = rW ? 'فوز رائع!' : rD ? 'تعادل مثير' : 'خسارة صعبة';
    if($('rcomp')) $('rcomp').textContent = cn[nm?.comp]||'مباراة';
    if($('rst')) $('rst').innerHTML = `📊 <b>استحواذ:</b> ${Math.round(100*s.home.ps/((s.home.ps+s.away.ps)||1))}% • <b>تسديدات:</b> ${s.home.sh}-${s.away.sh}`;
    if($('rsc')) $('rsc').textContent = `${Mt.h.name} ${s.home.g} - ${s.away.g} ${Mt.a.name}`;
    if($('rso')) {
        $('rso').innerHTML = `${rW?'🎉 فوز! 🎉':rD?'🤝 تعادل 🤝':'😔 خسارة 😔'}`;
        $('rso').style.color = rW ? '#22c55e' : rD ? '#fbbf24' : '#ef4444';
    }
    if($('rfin')) $('rfin').innerHTML = `💰 صافي المباراة: <b style="color:${netIncome>=0?'#4ade80':'#f87171'}">${netIncome>=0?'+':''}${netIncome.toFixed(1)}M</b> • الرصيد: ${myT.budget.toFixed(1)}M`;
    
    if(pr && $('rpen')){ $('rpen').style.display = 'block'; $('rpen').innerHTML = `🥅 ترجيح: ${pr.scoreA}-${pr.scoreB}`; }
    else if($('rpen')){ $('rpen').style.display = 'none'; }

    const rsEl = $('rs');
    if(rsEl) {
        rsEl.hidden = false;
        rsEl.style.display = 'flex';
    }

  } catch(e){
    console.error('CRITICAL finish err:', e);
    forceHideModals();
    alert('حدث خطأ أثناء معالجة نتيجة المباراة. سيتم حفظ تقدمك والعودة للقائمة الرئيسية.');
    try { if(G && G.season) save(); } catch(err){}
    if(typeof dash === 'function') dash();
  }
}

function createVirtualTeam(id, name, rating, c1, c2){
  const ps = [];
  const positions = ['GK','GK','DEF','DEF','DEF','DEF','DEF','DEF','MID','MID','MID','MID','MID','MID','FWD','FWD','FWD','FWD'];
  positions.forEach((pos, i) => {
    const r = Math.max(55, rating-3+Math.floor(Math.random()*6));
    ps.push(createPlayer(id+'_'+i, name+' '+i, pos, r, 22));
  });
  return {
    id, name, R: rating, c1: c1 || '#1e40af', c2: c2 || '#ffffff',
    ps, form:'4-3-3', tac:'balanced', budget:50, gk: GKC[Math.abs(hs(id))%4]
  };
}

function ui(){
  const s = Mt.s;
  if($('sc')) $('sc').textContent = `${s.home.g} - ${s.away.g}`;
  const mF = Math.floor(Mt.min);
  if(Mt.half === 1 && mF >= 45) { if($('mm')) $('mm').textContent = `45+${mF-45}'`; }
  else if(Mt.half === 2 && mF >= 90) { if($('mm')) $('mm').textContent = `90+${mF-90}'`; }
  else { if($('mm')) $('mm').textContent = mF+"'"; }
  if($('mhalf')) $('mhalf').textContent = Mt.half === 1 ? 'ش1' : 'ش2';

  const lc = $('live-commentary');
  if(lc && Mt.log.length > 0){
    const l = Mt.log[Mt.log.length-1];
    lc.textContent = l.x;
    lc.style.display = 'block';
    lc.style.color = l.t==='goal' ? '#4ade80' : (l.t==='red' ? '#f87171' : (l.t==='var' ? '#a855f7' : (l.t==='injury' ? '#ef4444' : (l.t==='shot' ? '#fbbf24' : '#fff'))));
  }

  while(shown < Mt.log.length){
    const l = Mt.log[shown++], d = document.createElement('div');
    d.className = 'li '+l.t;
    d.textContent = (l.t==='info'?'':l.m+"' ")+l.x;
    if($('lg')) $('lg').prepend(d);
  }

  const a = s.home, b = s.away;
  if($('ms-shotH')) $('ms-shotH').textContent = a.sh; if($('ms-shotA')) $('ms-shotA').textContent = b.sh;
  if($('ms-corH')) $('ms-corH').textContent = a.co; if($('ms-corA')) $('ms-corA').textContent = b.co;
  if($('ms-flH')) $('ms-flH').textContent = a.fl; if($('ms-flA')) $('ms-flA').textContent = b.fl;
  if($('ms-ycH')) $('ms-ycH').textContent = a.yc; if($('ms-ycA')) $('ms-ycA').textContent = b.yc;
  if($('ms-rcH')) $('ms-rcH').textContent = a.rc; if($('ms-rcA')) $('ms-rcA').textContent = b.rc;
  if($('momentum-pointer')) $('momentum-pointer').style.left = Mt.momentum+'%';
  if($('sl')) $('sl').textContent = s[Mt.hu].subs+'/5';
  if($('bp')) $('bp').textContent = paused ? '▶' : '⏸';
}

function mtac(k){
  if(!Mt) return;
  Mt.s[Mt.hu].tc = k;
  document.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === k));
}

function pz(){
  if(!Mt) return;
  paused = !paused;
  ui();
}

function spd(){
  const a = [1,2,3,4];
  speed = a[(a.indexOf(speed)+1)%4];
  if($('bs')) $('bs').textContent = '×'+speed;
}

function subm(){
  const s = Mt.s[Mt.hu];
  if(s.subs >= 5) return alert('5 تبديلات كحد أقصى');
  if($('so')) $('so').innerHTML = s.on.filter(p => p.role != 'GK').map(p => `<option value="${p.id}">${p.name} (${p.role}) ⭐${p.r}</option>`).join('');
  if($('si')) $('si').innerHTML = s.bn.map(p => `<option value="${p.id}">${p.name} (${p.pos}) ⭐${p.r}</option>`).join('');
  const sm = $('sm');
  if(sm) {
      sm.style.display = '';
      sm.hidden = false;
  }
}

function doSub(){
  const s = Mt.s[Mt.hu];
  const out = s.on.find(p => String(p.id) === String($('so').value));
  const inn = s.bn.find(p => String(p.id) === String($('si').value));
  if(!out || !inn) return;
  if(Mt.sub(Mt.hu, out.id, inn.id)) $('sm').hidden = true;
}

function simLateGoals(k, power, oppPower, remainingMin){
  const share = (power > 0 && oppPower > 0) ? (2*power/(power+oppPower)) : 1;
  const perMin = Math.min(0.05, 0.015*share);
  const team = Mt.s[k];
  let count = 0;
  for(let i=0; i<remainingMin; i++){
    if(Math.random() < perMin) count++;
  }
  for(let i=0; i<count; i++){
    const cands = team.on.filter(p => p.role != 'GK');
    const scorer = cands.length ? cands[Math.floor(Math.random()*cands.length)] : null;
    team.g++;
    if(scorer) scorer.goals = (scorer.goals||0)+1;
    if(typeof Mt.say === 'function') Mt.say(90, 'goal', `⚽ هدف متأخر لـ ${team.t.name}${scorer ? ' - '+scorer.name : ''}`);
  }
}

function syncMatchStats(m){
  try{
    ['home','away'].forEach(k => {
      const team = m.s[k].t;
      if(!team || !team.ps) return;
      team.ps.forEach(p => { if(p.susp > 0) p.susp = Math.max(0, p.susp-1); });
      const played = m.s[k].played || m.s[k].on || [];
      played.forEach(p => {
        const orig = team.ps.find(x => x.id === (p.origId||p.id));
        if(!orig) return;
        if(!orig.stats) orig.stats = {matches:0, goals:0, rating:0};
        const goals = p.goals || 0;
        if(goals) orig.goals = (orig.goals||0)+goals;
        if(p.minSt != null) orig.fit = Math.max(35, Math.round(p.minSt));
        let xp = 35;
        if(goals) xp += goals*30;
        if(p.yc) xp -= 5;
        if(p.rc) xp -= 20;
        if(typeof gainXp === 'function') gainXp(orig, xp);
        if(Math.random() < .008 && typeof tryInjure === 'function') tryInjure(orig);
        orig.stats.matches = (orig.stats.matches||0)+1;
        orig.stats.goals = (orig.stats.goals||0)+goals;
        let rating = 6.0 + goals*2 + (p.stats?.tackles||0)*0.1 + (p.stats?.passes||0)*0.01;
        if(rating > 10) rating = 10;
        orig.stats.rating = (orig.stats.rating||0)+rating;
        if(!orig.form) orig.form = [];
        orig.form.push(rating);
        if(orig.form.length > 3) orig.form.shift();
      });
    });
  } catch(e){ console.error('sync error:', e); }
}

function showPenaltyModal(r, hN, aN){
  if($('pen-score')) $('pen-score').textContent = `${hN} ${r.scoreA} - ${r.scoreB} ${aN}`;
  if($('pen-log')) $('pen-log').innerHTML = r.log.map(l => `<div>${l}</div>`).join('');
  const wN = r.winner === 'home' ? hN : aN;
  if($('pen-result')) $('pen-result').textContent = `🏆 ${wN} يتأهل!`;
  pendingPenaltyResult = r;
  const pm = $('pen-m');
  if(pm) {
      pm.style.display = '';
      pm.hidden = false;
  }
}

function closePenaltyModal(){ if($('pen-m')) $('pen-m').hidden = true; }

window.play = play;
window.skip = skip;
window.pz = pz;
window.spd = spd;
window.subm = subm;
window.doSub = doSub;
window.mtac = mtac;
window.finish = finish;
window.closePenaltyModal = closePenaltyModal;

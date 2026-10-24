// ============================================
// match.js - النسخة النهائية المحصنة (v2.0)
// ============================================

// 1. إخفاء إجباري لأي عنصر يحمل خاصية hidden
(function(){
  if(document.getElementById('hidden-fix')) return;
  const st = document.createElement('style');
  st.id = 'hidden-fix';
  st.textContent = '[hidden]{display:none !important}';
  document.head.appendChild(st);
})();

let _mtSimAcc = 0;
let _mtLoopErr = 0;
let _mtStartTime = 0; // لتتبع الوقت الحقيقي للمباراة
const _MT_STEP_MS = 1000/60;

// ============================================
// 2. دالة بدء المباراة (تم تحصينها)
// ============================================
function play(){
  if(!G.lu || G.lu.length !== 11 || G.lu.includes(null) || G.lu.some(id => !T[G.my].ps.find(p => p.id === id))){
    return alert('التشكيلة غير مكتملة! يرجى التأكد من اختيار 11 لاعباً.');
  }

  const nm = getNextUserMatch();
  if(!nm) return alert('لا توجد مباراة قادمة!');

  if(daysUntilMatch(nm) > 0) {
    try { advanceToDay(nm.day); } catch(e) { console.error("Advance error:", e); }
  }

  // ✅ إجبار إخفاء أي نافذة منبثقة (بما فيها نافذة "فهمت - إلى المباراة")
  document.querySelectorAll('.md, .ov, #pen-m, #sm, #rs').forEach(el => {
    el.hidden = true;
    el.style.display = 'none';
  });

  if(raf) cancelAnimationFrame(raf);

  const hm = nm.home;
  const oid = nm.opp;
  let oT;
  
  try {
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
  } catch(e) {
    console.error("Team creation error:", e);
    return alert('حدث خطأ في تحميل بيانات الفريق الخصم.');
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

  // تحديث واجهة المباراة
  $('mh').textContent = Mt.h.name;
  $('ma').textContent = Mt.a.name;
  $('weather-badge').textContent = `${w.emoji} ${w.type}`;
  shown = 0;
  paused = false;
  speed = 3;
  _mtSimAcc = 0;
  _mtLoopErr = 0;
  _mtStartTime = performance.now(); // تسجيل وقت البدء للحماية
  
  $('bs').textContent = '×3';
  $('lg').innerHTML = '';
  $('mr').textContent = `${cn[nm.comp]||nm.comp} • ${nm.round}`;
  $('live-commentary').style.display = 'none';
  $('momentum-pointer').style.left = '50%';
  mtac(G.tac);

  const msEl = $('ms');
  msEl.hidden = false;
  msEl.style.display = 'flex';

  last = performance.now();
  raf = requestAnimationFrame(loop);
}

// ============================================
// 3. دالة التحديث اللحظي (Loop) - مع أنظمة طوارئ
// ============================================
function loop(n){
  const dt = Math.min(100, Math.max(0, n - last));
  last = n;
  
  try {
    // محاكاة المباراة
    if(!paused && !Mt.done && Mt.hold <= 0){
      _mtSimAcc += dt;
      let safetyCounter = 0; // حماية من الدخول في حلقة لا نهائية
      
      while(_mtSimAcc >= _MT_STEP_MS && safetyCounter < 100){
        _mtSimAcc -= _MT_STEP_MS;
        for(let i=0; i<speed; i++){
          if(!Mt.done) Mt.step();
        }
        if(Mt.done) break;
        safetyCounter++;
      }
    }

    // 🚨 نظام الطوارئ 1: إذا وصلت الدقيقة 95 ولم تنته المباراة
    if(!Mt.done && Mt.min >= 95 + (Mt.inj2 || 0)) {
      console.warn("Match stuck at 95min, forcing end");
      Mt.done = true;
    }

    // 🚨 نظام الطوارئ 2: إذا مر 3 دقائق حقيقية ولم تنته المباراة
    if(!Mt.done && (performance.now() - _mtStartTime) > 180000) {
      console.warn("Match real-time limit reached (3 mins), forcing end");
      Mt.done = true;
    }

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
    
    // إذا تكرر الخطأ 3 مرات، ننهي المباراة قسرياً لتجنب التعليق
    if(_mtLoopErr >= 3){
      console.error("Too many loop errors, finishing match forcefully");
      try { Mt.done = true; finish(); } catch(err){ console.error(err); }
      return;
    }
    paused = true;
    $('bp').textContent = '▶';
    raf = requestAnimationFrame(loop);
  }
}

// ============================================
// 4. دالة تخطي المباراة (Skip)
// ============================================
function skip(){
  if(!Mt || Mt.done) return;
  try {
    const msEl = $('ms');
    msEl.hidden = true;
    msEl.style.display = 'none';

    cancelAnimationFrame(raf);

    // محاكاة باقي المباراة بسرعة
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
    $('ms').style.display = 'none';
    if(Mt) Mt.done = true;
    finish();
  }
}

// ============================================
// 5. دالة النهاية (Finish) - محصنة ضد الأخطاء
// ============================================
function finish(){
  const msEl = $('ms');
  if(msEl) { msEl.hidden = true; msEl.style.display = 'none'; }

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

    // ركلات الترجيح في الأدوار الإقصائية
    if(isKO && rD && Mt){
      try {
        pr = realPenaltyShootout(Mt.h, Mt.a);
        const pw = pr.winner === 'home' ? Mt.h.id : Mt.a.id;
        rW = (pw === G.my);
        rD = false;
        showPenaltyModal(pr, Mt.h.name, Mt.a.name);
      } catch(e) { console.error("Penalty error:", e); }
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

    // تحديث البطولات
    try {
      if(nm && nm.comp === 'league' && Mt){
        rec(Mt.h, Mt.a, s.home.g, s.away.g);
        const lf = G.season.leagueFixtures[nm.round];
        if(lf){ const k = `${Mt.h.id}_${Mt.a.id}`; if(!lf.played.includes(k)) lf.played.push(k); }
      }
      if(nm && nm.comp === 'cup' && G.season.cupBracket){
        const m = G.season.cupBracket.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); advanceCupBracket(); }
      }
      if(nm && nm.comp === 'cafCL' && G.season.cafCL){
        const m = G.season.cafCL.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); advanceCafComp('cafCL'); }
      }
      if(nm && nm.comp === 'cafCC' && G.season.cafCC){
        const m = G.season.cafCC.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
        if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); advanceCafComp('cafCC'); }
      }
    } catch(e) { console.error("Tournament advance error:", e); }

    // تحديث الإحصائيات
    try { if(Mt) syncMatchStats(Mt); } catch(e) { console.error('sync err', e); }
    try {
      updateMorale(myT, rW ? 'win' : (rD ? 'draw' : 'loss'));
      updateMorale(oppT, rW ? 'loss' : (rD ? 'draw' : 'win'));
      updateContractMorale(myT);
    } catch(e) { console.error('Morale error:', e); }

    // الحسابات المالية
    const totalSalary = myT.ps.reduce((sum, p) => sum+(p.contract?.salary||0), 0);
    const baseIncome = rW ? 15 : rD ? 8 : 3;
    const sponsorInc = G.currentSponsor ? (G.currentSponsor.safe/20) : 0;
    const netIncome = Math.round((baseIncome+sponsorInc-totalSalary)*10)/10;
    myT.budget = Math.round((myT.budget+netIncome)*10)/10;

    if(myT.budget < -20){ myT.budget += 30; addNews(`💰 قرض طارئ من الإدارة!`, `📈 +30M لتفادي الإفلاس`); }

    const scoreStr = `${Mt.h.name} ${s.home.g}-${s.away.g} ${Mt.a.name}`;
    
    // إضافة الأخبار
    const scorersOf = k => (Mt.s[k].played || Mt.s[k].on).filter(p => p.goals > 0).map(p => `${p.name}×${p.goals}`);
    const homeScorers = scorersOf(Mt.hu);
    const awayScorers = scorersOf(Mt.hu==='home' ? 'away' : 'home');
    let scorerLine = '';
    if(homeScorers.length) scorerLine += `⚽ ${myT.name}: ${homeScorers.join(', ')}`;
    if(awayScorers.length){ if(scorerLine) scorerLine += '\n'; scorerLine += `⚽ ${oppT.name}: ${awayScorers.join(', ')}`; }
    if(!scorerLine) scorerLine = '⚽ مباراة بدون أهداف';
    addNews(`⚽ ${cn[nm?.comp||'']||'مباراة'}: ${scoreStr}`, `${rW?'🎉 فوز':rD?'🤝 تعادل':'😞 خسارة'}\n${scorerLine}`);

    // نقاط المدرب والخسائر المتتالية
    let xpG = rW ? 50 : rD ? 20 : 5;
    if(isKO && rW) xpG += 30;
    addManagerXp(xpG);
    if(rW){ playSound('goal'); G.lossStreak = 0; }
    else if(!rD){
      playSound('card');
      G.lossStreak = (G.lossStreak||0)+1;
      if(G.lossStreak >= 3) addNews(`⚠️ تحذير! ${G.lossStreak} خسارات متتالية!`, `📉 الإدارة تفكر في بديل!`);
    } else playSound('whistle');

    if(G.lossStreak >= 5){
      save(); $('game-over').hidden = false; $('go-text').textContent = `خسرت 5 مباريات متتالية، قررت الإدارة إقالتك.`;
      return;
    }
    save();

    // إظهار شاشة النتيجة
    const rsIcon = rW ? '🏆' : rD ? '🤝' : '😞';
    const rsTitle = rW ? 'فوز رائع!' : rD ? 'تعادل مثير' : 'خسارة صعبة';
    const rsClass = rW ? 'mc-success' : rD ? 'mc-warning' : 'mc-danger';
    const rsEmoji = rW ? '🎉' : rD ? '🤝' : '😔';

    document.getElementById('rs-mc').className = 'mc '+rsClass;
    $('rs-icon').textContent = rsIcon; $('rs-title').textContent = rsTitle;
    $('rcomp').textContent = cn[nm?.comp]||'مباراة';
    $('rst').innerHTML = `📊 <b>استحواذ:</b> ${Math.round(100*s.home.ps/((s.home.ps+s.away.ps)||1))}% • <b>تسديدات:</b> ${s.home.sh}-${s.away.sh}`;
    $('rsc').textContent = `${Mt.h.name} ${s.home.g} - ${s.away.g} ${Mt.a.name}`;
    $('rso').innerHTML = `${rsEmoji} ${rW?'فوز! 🎉':rD?'تعادل 🤝':'خسارة 😔'}`;
    $('rso').style.color = rW ? '#22c55e' : rD ? '#fbbf24' : '#ef4444';
    $('rfin').innerHTML = `💰 صافي المباراة: <b style="color:${netIncome>=0?'#4ade80':'#f87171'}">${netIncome>=0?'+':''}${netIncome.toFixed(1)}M</b> • الرصيد: ${myT.budget.toFixed(1)}M`;
    if(pr){ $('rpen').style.display = 'block'; $('rpen').innerHTML = `🥅 ترجيح: ${pr.scoreA}-${pr.scoreB}`; }
    else $('rpen').style.display = 'none';

    const rsEl = $('rs');
    rsEl.hidden = false;
    rsEl.style.display = 'flex';

  } catch(e){
    // 🚨 نظام طوارئ: إذا فشلت شاشة النتيجة، نرجع للقائمة الرئيسية
    console.error('CRITICAL finish err:', e);
    const msEl = $('ms'); if(msEl) { msEl.hidden = true; msEl.style.display = 'none'; }
    const rsEl = $('rs'); if(rsEl) { rsEl.hidden = true; rsEl.style.display = 'none'; }
    alert('حدث خطأ في إنهاء المباراة، سيتم حفظ تقدمك والعودة للقائمة.');
    try { if(G && G.season) save(); } catch(err){}
    if(typeof dash === 'function') dash();
  }
}

// الدوال المساعدة (لم يتم تغييرها)
function createVirtualTeam(id, name, rating, c1, c2){
  const ps = [];
  const positions = ['GK','GK','DEF','DEF','DEF','DEF','DEF','DEF','MID','MID','MID','MID','MID','MID','FWD','FWD','FWD','FWD'];
  positions.forEach((pos, i) => {
    const r = Math.max(55, rating-3+Math.floor(Math.random()*6)); // تم استخدام Math.random بدلاً من R لضمان العمل
    ps.push(createPlayer(id+'_'+i, name+' '+i, pos, r, 22));
  });
  return {
    id, name, R: rating, c1: c1 || '#1e40af', c2: c2 || '#ffffff',
    ps, form:'4-3-3', tac:'balanced', budget:50, gk: GKC[Math.abs(hs(id))%4]
  };
}

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
    lc.style.color = l.t==='goal' ? '#4ade80' : (l.t==='red' ? '#f87171' : (l.t==='var' ? '#a855f7' : (l.t==='injury' ? '#ef4444' : (l.t==='shot' ? '#fbbf24' : '#fff'))));
  }

  while(shown < Mt.log.length){
    const l = Mt.log[shown++], d = document.createElement('div');
    d.className = 'li '+l.t;
    d.textContent = (l.t==='info'?'':l.m+"' ")+l.x;
    $('lg').prepend(d);
  }

  const a = s.home, b = s.away;
  $('ms-shotH').textContent = a.sh; $('ms-shotA').textContent = b.sh;
  $('ms-corH').textContent = a.co; $('ms-corA').textContent = b.co;
  $('ms-flH').textContent = a.fl; $('ms-flA').textContent = b.fl;
  $('ms-ycH').textContent = a.yc; $('ms-ycA').textContent = b.yc;
  $('ms-rcH').textContent = a.rc; $('ms-rcA').textContent = b.rc;
  $('momentum-pointer').style.left = Mt.momentum+'%';
  $('sl').textContent = s[Mt.hu].subs+'/5';
  $('bp').textContent = paused ? '▶' : '⏸';
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
  $('bs').textContent = '×'+speed;
}

function subm(){
  const s = Mt.s[Mt.hu];
  if(s.subs >= 5) return alert('5 تبديلات كحد أقصى');
  $('so').innerHTML = s.on.filter(p => p.role != 'GK').map(p => `<option value="${p.id}">${p.name} (${p.role}) ⭐${p.r}</option>`).join('');
  $('si').innerHTML = s.bn.map(p => `<option value="${p.id}">${p.name} (${p.pos}) ⭐${p.r}</option>`).join('');
  const sm = $('sm');
  sm.style.display = '';
  sm.hidden = false;
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
    Mt.say(90, 'goal', `⚽ هدف متأخر لـ ${team.t.name}${scorer ? ' - '+scorer.name : ''}`);
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
        gainXp(orig, xp);
        if(Math.random() < .008) tryInjure(orig);
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

    (m.redCards||[]).forEach(rc => {
      const team = T[rc.teamId];
      if(!team) return;
      const p = team.ps.find(x => x.id === rc.id);
      if(p) p.susp = 1;
    });

    (m.injuries||[]).forEach(inj => {
      const team = m.s.home.t.ps.find(p => p.id === inj.id) ? m.s.home.t : m.s.away.t;
      const p = team.ps.find(p => p.id === inj.id);
      if(p) tryInjure(p);
    });
  } catch(e){ console.error('sync error:', e); }
}

function showPenaltyModal(r, hN, aN){
  $('pen-score').textContent = `${hN} ${r.scoreA} - ${r.scoreB} ${aN}`;
  $('pen-log').innerHTML = r.log.map(l => `<div>${l}</div>`).join('');
  const wN = r.winner === 'home' ? hN : aN;
  $('pen-result').textContent = `🏆 ${wN} يتأهل!`;
  pendingPenaltyResult = r;
  const pm = $('pen-m');
  pm.style.display = '';
  pm.hidden = false;
}

function closePenaltyModal(){ $('pen-m').hidden = true; }

// ============================================
// 6. التصدير الصحيح للدوال لتعمل مع HTML
// ============================================
window.play = play;
window.skip = skip;
window.pz = pz;
window.spd = spd;
window.subm = subm;
window.doSub = doSub;
window.mtac = mtac;
window.finish = finish;
window.closePenaltyModal = closePenaltyModal;

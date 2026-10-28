// ============================================
// ui.js - واجهة المستخدم الكاملة (النسخة النهائية المتكاملة)
// ============================================

let liveTbInterval = null;
let liveMarketInterval = null;

function switchTab(t) {
  if (!G) return; 
  
  if (typeof mpCompInterval !== 'undefined' && mpCompInterval && t !== 'comp' && t !== 'lu') {
      clearInterval(mpCompInterval);
      mpCompInterval = null;
  }
  if (liveTbInterval) { clearInterval(liveTbInterval); liveTbInterval = null; }
  if (liveMarketInterval) { clearInterval(liveMarketInterval); liveMarketInterval = null; }
  
  G.tab = t; 
  dash();
}

function dash(){
  if(!G || !G.season){showSetup(); return;}
  
  let t = T[G.my];
  if (!t) {
      if (typeof mk === 'function') mk(G.league || 'egypt');
      t = T[G.my] || Object.values(T)[0];
      if (t) G.my = t.id;
      else { showSetup(); return; }
  }
  
  $('bottom-nav').hidden = false;
  
  const lvl = G.managerLevel || 1;
  const vipTier = Math.min(10, Math.floor(lvl / 2)); 
  const vipEmoji = vipTier > 5 ? '👑' : (vipTier > 2 ? '💎' : '⭐');
  
  if($('hdr-name')) $('hdr-name').textContent = G.managerName || 'المدرب';
  if($('hdr-vip')) $('hdr-vip').innerHTML = `${vipEmoji} VIP ${vipTier}`;
  if($('hdr-trophies')) $('hdr-trophies').innerHTML = `🏆 ${G.trophies || 0}`;
  
  if($('hdr-day')) $('hdr-day').textContent = G.season ? G.season.currentDay : 1;
  if($('hdr-budget')) $('hdr-budget').textContent = `${(t.budget || 0).toFixed(1)}M`;

  document.querySelectorAll('.nav-item').forEach((el, idx) => {
    const tabs = ['lu','tb','comp','tr','cr','mgr','news'];
    el.classList.toggle('on', tabs[idx] === G.tab);
  });

  let content = '';
  if(G.tab === 'lu') content = luH(t);
  else if(G.tab === 'tb') content = tbH();
  else if(G.tab === 'comp') content = compH();
  else if(G.tab === 'tr') content = trH(t);
  else if(G.tab === 'cr') content = crH(t);
  else if(G.tab === 'mgr') content = mgrH();
  else if(G.tab === 'news') content = newsH();

  $('main').innerHTML = content;
  setTimeout(checkCupNotification, 100);
}

// ============================================
// 👤 صفحة الملف الشخصي
// ============================================
function showUserProfile() {
  if (!G || !G.season) return;
  const t = T[G.my];
  const lvl = G.managerLevel || 1;
  const xp = G.managerXp || 0;
  const cur = MGR_LEVELS[lvl-1];
  const nxt = MGR_LEVELS[lvl] || null;
  const need = nxt ? nxt.xp-cur.xp : 1;
  const have = nxt ? xp-cur.xp : 1;
  const pct = nxt ? Math.min(100, Math.round((have/need)*100)) : 100;

  $('bottom-nav').hidden = true;

  let h = `<div class="c" style="margin-top: 15px; border: 2px solid var(--gold); padding: 20px 15px; position: relative;">
    <button class="b sm" style="position: absolute; top: 10px; right: 10px; padding: 4px 10px; font-size: 10px;" onclick="dash()">⬅ عودة</button>
    
    <div style="text-align: center; margin-bottom: 20px; margin-top: 10px;">
      <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--gold); margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 40px; border: 3px solid #fff; box-shadow: 0 0 20px rgba(251,191,36,.6);">👨‍💼</div>
      <h2 style="color: var(--gold); margin: 0; font-size: 22px;">${G.managerName}</h2>
      <div style="font-size: 14px; color: #cbd5e1; margin-top: 5px;">مدرب ${t.name}</div>
    </div>

    <div class="mgr-card" style="background:linear-gradient(135deg,rgba(30,58,138,.5),rgba(15,34,56,.9)); margin-bottom: 15px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="mgr-level-badge">👑 L${lvl} - ${cur.name}</div>
        <div style="font-size:11px;color:#4ade80">${cur.perk}</div>
      </div>
      <div style="font-size:10px;color:var(--m);text-align:right">XP: ${xp} ${nxt?'/ '+nxt.xp:'— أقصى'}</div>
      <div class="xp-bar"><div style="width:${pct}%"></div></div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
      <div class="c" style="text-align: center; padding: 15px; margin: 0;">
        <div style="font-size: 24px; margin-bottom: 5px;">🏆</div>
        <div style="font-size: 18px; font-weight: 900; color: var(--gold);">${G.trophies || 0}</div>
        <div style="font-size: 11px; color: #94a3b8;">بطولات</div>
      </div>
      <div class="c" style="text-align: center; padding: 15px; margin: 0;">
        <div style="font-size: 24px; margin-bottom: 5px;">⭐</div>
        <div style="font-size: 18px; font-weight: 900; color: #22d3ee;">${G.managerLevel || 1}</div>
        <div style="font-size: 11px; color: #94a3b8;">المستوى</div>
      </div>
    </div>

    <button class="b full" style="background:linear-gradient(180deg,#8b5cf6,#6d28d9); color:#fff; margin-bottom:10px;" onclick="changeManagerName()">✏️ تغيير اسم المدرب</button>
    <button class="b full r" onclick="if(confirm('هل أنت متأكد من تسجيل الخروج والعودة لشاشة البداية؟')) { try{localStorage.removeItem('c26_egypt_v26')}catch(e){}; location.reload(); }">🚪 تسجيل الخروج / مسيرة جديدة</button>
  </div>`;

  if (G.trophyCabinet && G.trophyCabinet.length > 0) {
      h += `<div class="c">
          <div class="sec">🏆 خزانة البطولات</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${G.trophyCabinet.map(trophy => `<div style="font-size:12px; background:rgba(0,0,0,.4); padding:6px 10px; border-radius:8px; border:1px solid rgba(251,191,36,.3);">🏆 ${trophy}</div>`).join('')}
          </div>
      </div>`;
  }

  $('main').innerHTML = h;
}

// ============================================
// محرك الوقت
// ============================================
function startFastForward(targetDay) {
    let ffModal = document.getElementById('ff-modal');
    if (!ffModal) {
        ffModal = document.createElement('div');
        ffModal.id = 'ff-modal';
        ffModal.className = 'md';
        ffModal.style.zIndex = 3000;
        ffModal.style.background = 'rgba(3,7,18,.95)';
        ffModal.innerHTML = `
            <div style="text-align:center; animation: bgPulse 2s infinite alternate; padding: 20px;">
                <div style="font-size:60px; margin-bottom:20px; filter:drop-shadow(0 0 20px #22d3ee);">⏳</div>
                <div style="font-size:24px; font-weight:900; color:#fff; margin-bottom:10px;">جاري مرور الأيام...</div>
                <div id="ff-day-display" style="font-size:40px; font-weight:900; color:#fbbf24; text-shadow:0 0 15px rgba(251,191,36,.8); margin:20px 0;">اليوم ${G.season.currentDay}</div>
                <div style="font-size:12px; color:#94a3b8;">يتم محاكاة التدريبات وأحداث اللعبة...</div>
            </div>
        `;
        document.body.appendChild(ffModal);
    }
    ffModal.hidden = false;

    const dayDisplay = document.getElementById('ff-day-display');
    let simDay = G.season.currentDay;

    const interval = setInterval(() => {
        simDay++;
        if (simDay > targetDay) {
            clearInterval(interval);
            ffModal.hidden = true;
            dash();
            return;
        }

        dayDisplay.textContent = `اليوم ${simDay}`;
        dayDisplay.style.transform = 'scale(1.2)';
        setTimeout(() => { dayDisplay.style.transform = 'scale(1)'; }, 150);

        advanceToDay(simDay);
        simulateLivingWorld();
        checkLegendsMarket();
        checkPlayerOfMonth();

        const eventPaused = processTimeEvents(simDay);

        if (eventPaused) {
            clearInterval(interval);
            ffModal.hidden = true;
        }
    }, 350);
}

function processTimeEvents(simDay) {
    if (G.pendingOffer) {
        showTimeEventModal('💰', 'عرض انتقال جديد!', `تلقيت عرضاً لضم لاعب من فريقك.`, () => { showOffer(); });
        return true;
    }
    if (G.legendsMarket && G.legendsMarket.length > 0 && !G._legendNotified) {
        const legend = G.legendsMarket[0];
        G._legendNotified = true;
        showTimeEventModal('🌟', 'أسطورة في السوق!', `اللاعب ${legend.name} متاح للتعاقد الآن.`, () => { switchTab('tr'); });
        return true;
    }
    const injuredStarter = T[G.my].ps.find(p => p.injury && p.injury.matches > 3 && G.lu.includes(p.id) && !p._injuryNotified);
    if (injuredStarter) {
        injuredStarter._injuryNotified = true;
        showTimeEventModal('🚑', 'إصابة خطيرة!', `اللاعب ${injuredStarter.name} تعرض لإصابة سيغيب على إثرها لعدة مباريات.`, () => { switchTab('lu'); });
        return true;
    }
    return false;
}

function showTimeEventModal(icon, title, desc, actionCallback) {
    $('cmc').innerHTML = `<div class="mc mc-warning modal-bg-anim" style="text-align:center;">
        <div class="mc-icon" style="font-size:60px; filter:drop-shadow(0 0 15px rgba(251,191,36,.6));">${icon}</div>
        <div class="mc-title" style="color:#fbbf24; font-size:22px;">${title}</div>
        <div class="mc-sub" style="font-size:14px; color:#cbd5e1; margin:10px 0; line-height:1.6;">${desc}</div>
        <div class="mc-actions"><button class="b full" style="padding:14px; font-size:14px;" onclick="resumeTimeAfterEvent()">▶ متابعة</button></div>
    </div>`;
    $('cm').hidden = false;
    window.pendingEventAction = actionCallback;
}

function resumeTimeAfterEvent() {
    $('cm').hidden = true;
    if (window.pendingEventAction) {
        window.pendingEventAction();
        window.pendingEventAction = null;
    }
    setTimeout(() => {
        G._legendNotified = false;
        T[G.my].ps.forEach(p => p._injuryNotified = false);
    }, 2000);

    setTimeout(() => {
        if ($('ms').hidden && $('rs').hidden && $('cm').hidden && !window.isSimulating) {
            const nextMatch = getNextUserMatch();
            if (nextMatch && G.season.currentDay < nextMatch.day) {
                startFastForward(nextMatch.day);
            } else {
                dash();
            }
        }
    }, 800);
}

function autoAssignRoles(){
  const t = T[G.my]; if(!t) return;
  const starters = G.lu.map(id => t.ps.find(p => p.id === id)).filter(p => p && !p.injury);
  const nonGK = starters.filter(p => p.pos !== 'GK');
  if(!G.captain || !starters.find(p => p.id === G.captain)){
    const bestCap = [...starters].sort((a,b) => (b.r+b.lvl*2+(b.morale||70)*0.15+(b.physical||70)*0.1) - (a.r+a.lvl*2+(a.morale||70)*0.15+(a.physical||70)*0.1))[0];
    G.captain = bestCap ? bestCap.id : null;
  }
  if(!G.penaltyTaker || !starters.find(p => p.id === G.penaltyTaker)){
    const bestPen = [...nonGK].sort((a,b) => b.shooting-a.shooting)[0];
    G.penaltyTaker = bestPen ? bestPen.id : null;
  }
  if(!G.freeKickTaker || !starters.find(p => p.id === G.freeKickTaker)){
    const bestFK = [...nonGK].sort((a,b) => (b.shooting*0.6+b.passing*0.4) - (a.shooting*0.6+a.passing*0.4))[0];
    G.freeKickTaker = bestFK ? bestFK.id : null;
  }
  if(!G.cornerTaker || !starters.find(p => p.id === G.cornerTaker)){
    const bestCorner = [...nonGK].sort((a,b) => b.passing-a.passing)[0];
    G.cornerTaker = bestCorner ? bestCorner.id : null;
  }
}

function setRole(role, playerId){ G[role] = playerId || null; save(); dash(); if(navigator.vibrate) try{navigator.vibrate(20);}catch(e){} }

function buildRoleSelect(role){
  const t = T[G.my]; if(!t) return '';
  const current = G[role];
  const starters = G.lu.map(id => t.ps.find(p => p.id === id)).filter(p => p && !p.injury);
  if(starters.length === 0) return '<option value="">لا لاعبين</option>';
  let html = '<option value="">⚙️ تلقائي</option>';
  starters.forEach(p => {
    const isSel = p.id === current;
    let attrLabel = '';
    if(role === 'penaltyTaker') attrLabel = `🎯${p.shooting}`;
    else if(role === 'freeKickTaker') attrLabel = `🎯${p.shooting} 🎨${p.passing}`;
    else if(role === 'cornerTaker') attrLabel = `🎨${p.passing}`;
    else if(role === 'captain') attrLabel = `⭐${p.r}`;
    html += `<option value="${p.id}" ${isSel?'selected':''}>${p.name.split(' ')[0]} (${p.pos} ${attrLabel})</option>`;
  });
  return html;
}

function luH(t){
  if(!G.lu || G.lu.length !== 11) G.lu = autoFillLineup(t, G.form);
  if(!G.inst) G.inst = {};
  const starters = G.lu.map(id => t.ps.find(p => p.id === id)).filter(p => p);
  if(!G.captain || !starters.find(p => p.id === G.captain)) autoAssignRoles();

  const slots = getSlots(G.form);
  const absoluteNext = getNextUserMatch();
  const nm = absoluteNext;

  const myPower = calcTeamPower(t, G.lu);
  let oppPower = null, oppName = '';
  if(nm){
    oppName = T[nm.opp]?.name || AFRICAN.find(a=>a[0]===nm.opp)?.[1] || WORLD.find(w=>w[0]===nm.opp)?.[1] || nm.opp;
    const oppTeam = T[nm.opp];
    if(oppTeam) oppPower = calcTeamPower(oppTeam);
    else { const r = AFRICAN.find(a=>a[0]===nm.opp)?.[2] || WORLD.find(w=>w[0]===nm.opp)?.[2] || 68; oppPower = {att:r, mid:r, def:r, overall:r}; }
  }

  const powerCard = `<div class="team-power-card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:12px;color:var(--gold);font-weight:900">⚡ قوة الفريق</div>
      <div style="font-size:20px;font-weight:900;color:var(--gold);text-shadow:0 0 15px rgba(251,191,36,.6)">${myPower.overall}</div>
    </div>
    <div class="power-bars">
      <div class="power-item"><div class="power-label">⚔️ هجوم</div><div class="power-value">${myPower.att}</div><div class="power-bar"><div style="width:${myPower.att}%;background:linear-gradient(90deg,#ef4444,#f87171)"></div></div></div>
      <div class="power-item"><div class="power-label">🎯 وسط</div><div class="power-value">${myPower.mid}</div><div class="power-bar"><div style="width:${myPower.mid}%;background:linear-gradient(90deg,#fbbf24,#fcd34d)"></div></div></div>
      <div class="power-item"><div class="power-label">🛡️ دفاع</div><div class="power-value">${myPower.def}</div><div class="power-bar"><div style="width:${myPower.def}%;background:linear-gradient(90deg,#3b82f6,#60a5fa)"></div></div></div>
    </div>
    ${oppPower ? `<div class="power-vs"><span>🆚 ${oppName}</span><b style="color:${myPower.overall>=oppPower.overall?'#4ade80':'#f87171'}">${oppPower.overall}</b></div>` : ''}
  </div>`;

  const form = calcUserForm();
  const formPills = form.length ? form.map(r => `<div class="form-pill ${r}">${r==='W'?'ف':r==='D'?'ت':'خ'}</div>`).join('') : '<div class="form-pill none">🚀 بداية</div>';

  const warnings = calcWarnings();
  const warningsBar = warnings.length ? `<div class="warnings-bar">${warnings.map(w => `<div class="warning-pill" style="color:${w.color}">${w.icon} ${w.text}</div>`).join('')}</div>` : '';

  const preview = calcMatchPreview();
  const previewCard = preview ? `<div class="match-preview">
    <div style="font-size:11px;color:var(--gold);font-weight:900;margin-bottom:4px">📊 تحليل المباراة</div>
    <div style="font-size:10px;color:var(--m)">${oppName} يلعب ${preview.oppFormation} • ${preview.isHome?'ملعبك 🏟️':'خارج ✈️'}</div>
    <div class="prob-bar">
      <div class="prob-seg prob-win" style="flex:${preview.winProb}">${preview.winProb}%</div>
      <div class="prob-seg prob-draw" style="flex:${preview.drawProb}">${preview.drawProb}%</div>
      <div class="prob-seg prob-loss" style="flex:${preview.lossProb}">${preview.lossProb}%</div>
    </div>
    <div class="xg-row"><span>⚽ أهداف متوقعة</span><b>${preview.xG} - ${preview.xGA}</b></div>
  </div>` : '';

  const quickActions = `<div class="quick-actions">
    <button class="b g" onclick="autoFillAction()">🎯 تشكيل تلقائي</button>
    <button class="b r" onclick="if(confirm('مسح التشكيلة؟'))clearLineupAction()">🗑️ مسح</button>
  </div>`;

  const hints = buildHints();
  const hintsBox = hints.length ? `<div class="hints-container"><div class="hints-title">💡 اقتراحات ذكية</div>${hints.map(h => `<div class="hint-item"><span>${h.icon}</span><span style="color:${h.color}">${h.text}</span></span></div>`).join('')}</div>` : '';

  let missionCard = '';
  
  if (G.multiplayerLeagueId) {
      missionCard = `<div id="mp-mission-container" style="margin-bottom:15px;">
          <div class="c" style="text-align:center; border:2px solid #ef4444; background:rgba(239,68,68,.1); box-shadow:0 0 15px rgba(239,68,68,.2); padding:15px;">
              <div style="color:#ef4444; font-weight:900; margin-bottom:10px; font-size:14px; display:flex; justify-content:center; align-items:center; gap:5px;">
                  <span style="animation: badgeGlow 1s infinite alternate;">🔴</span> الدوري المباشر (أونلاين)
              </div>
              <div id="mp-mission-content" style="text-align:right; font-size:12px; color:#94a3b8;">
                  ⏳ جاري تحميل بيانات الدوري...
              </div>
          </div>
      </div>`;
      setTimeout(() => { if(typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData(); }, 100);
  } else if (nm) {
      const isTournament = nm.comp !== 'league';
      const cn = {league:'الدوري', cup:'كأس مصر', cafCL:'أبطال أفريقيا', cafCC:'الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم'};
      const compName = cn[nm.comp] || nm.comp;
      const btnColor = isTournament ? '#8b5cf6' : '#22c55e';
      const btnText = isTournament ? '▶️ العب مباراة البطولة' : '▶️ العب المباراة';
      const simAction = isTournament ? `startSimulationWithTimer('tournament')` : `startSimulationWithTimer('league')`;
      const playAction = isTournament ? `playTournamentMatch()` : `playLeagueMatch()`;

      missionCard = `<div style="background:linear-gradient(135deg, rgba(251,191,36,.15), rgba(15,34,56,.9)); border:2px solid #fbbf24; padding:15px; border-radius:12px; text-align:center; margin-bottom:15px; box-shadow:0 0 20px rgba(251,191,36,.3); position:relative; overflow:hidden;">
          <div style="position:absolute; top:-10px; right:-10px; font-size:80px; opacity:0.05; transform:rotate(20deg);">🎯</div>
          <div style="font-size:12px; font-weight:900; color:#fbbf24; margin-bottom:5px; letter-spacing:1px;">🎯 المهمة الحالية</div>
          <div style="font-size:16px; color:#fff; font-weight:bold; margin-bottom:5px;">${compName} • ${nm.round}</div>
          <div style="font-size:20px; color:#fff; font-weight:900; margin-bottom:10px;">${t.name} ${nm.home?'vs':'@'} ${oppName}</div>
          <div style="font-size:11px; color:#cbd5e1; margin-bottom:15px; background:rgba(0,0,0,.4); padding:4px; border-radius:8px; display:inline-block;">📅 ${dayToDate(nm.day)}</div>
          
          <div style="display:flex;gap:8px;">
             <button class="b" style="flex:2; background:${btnColor}; padding:14px; border:none;" onclick="${playAction}">${btnText}</button>
             <button class="b" style="flex:1; background:#475569; padding:14px; border:none;" onclick="${simAction}">⏩ محاكاة</button>
          </div>
      </div>`;
  } else {
      missionCard = `<div style="background:rgba(15,34,56,.8); border:1px solid #475569; padding:15px; border-radius:12px; text-align:center; margin-bottom:15px;">
          <div style="font-size:20px; margin-bottom:5px;">🏁</div>
          <div style="font-weight:900; color:#94a3b8; font-size:14px; margin-bottom:5px;">انتهت المهمات!</div>
          <div style="font-size:11px; color:#cbd5e1;">لقد أكملت جميع مباريات الموسم.</div>
      </div>`;
  }

  // ✅ إضافة زر المباراة الودية
  const friendliesLeft = 2 - (G.season.friendlyMatchesPlayed || 0);
  let friendlyBtnHtml = '';
  if (friendliesLeft > 0) {
      friendlyBtnHtml = `
      <div style="text-align:center; margin-bottom:15px;">
          <button class="b sm" style="background:linear-gradient(180deg,#8b5cf6,#6d28d9); color:#fff; padding:10px 15px; font-size:12px; font-weight:bold; width:100%; border-radius:10px; box-shadow:0 4px 0 #4c1d95, 0 6px 20px rgba(139,92,246,.4);" onclick="showFriendlyTeams()">
              🤝 لعب مباراة ودية (${friendliesLeft} متبقية)
          </button>
      </div>`;
  }

  const roleCards = `<div class="sec">👑 الأدوار الخاصة</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
      <div class="role-card ${G.captain?'active':''}"><div class="role-label">👑 الكابتن</div><select class="role-select" onchange="setRole('captain', this.value)">${buildRoleSelect('captain')}</select></div>
      <div class="role-card ${G.penaltyTaker?'active':''}"><div class="role-label">🥅 مسدد الجزاءات</div><select class="role-select" onchange="setRole('penaltyTaker', this.value)">${buildRoleSelect('penaltyTaker')}</select></div>
      <div class="role-card ${G.freeKickTaker?'active':''}"><div class="role-label">🎯 مسدد الحرات</div><select class="role-select" onchange="setRole('freeKickTaker', this.value)">${buildRoleSelect('freeKickTaker')}</select></div>
      <div class="role-card ${G.cornerTaker?'active':''}"><div class="role-label">🚩 مسدد الركنيات</div><select class="role-select" onchange="setRole('cornerTaker', this.value)">${buildRoleSelect('cornerTaker')}</select></div>
    </div>
    <div class="info-box">📖 <b>تأثيرات:</b> الكابتن +8% فريق • الجزاء +30% دقة • الحرة +35% تصويب</div>`;

  const pitch = `<div class="pitch-wrapper" id="pitch-wrapper">
    <div class="pitch-lines" style="pointer-events:none;"><div class="penalty-box-top"></div><div class="penalty-box-bot"></div></div>
    ${slots.map((slot,i) => {
      const pid = G.lu[i];
      const p = pid ? t.ps.find(x => x.id === pid) : null;
      const inst = G.inst[i] || 'normal';
      const isInj = p && p.injury;
      if(!p) return `<div class="p-token empty" style="left:${slot.y*100}%; top:${(1-slot.x)*100}%;">${slot.pos}</div>`;
      let borderC = '#22c55e';
      if(p.pos !== slot.pos && p.secPos !== slot.pos) borderC = '#ef4444';
      else if(p.pos !== slot.pos && p.secPos === slot.pos) borderC = '#fbbf24';
      const fit = p.fit != null ? Math.round(p.fit) : 100;
      const fitColor = fit>=85?'#22c55e':fit>=65?'#fbbf24':fit>=45?'#f97316':'#ef4444';
      let ii = '';
      if(inst==='attack') ii += '<div class="p-inst-icon" style="background:#ef4444;color:#fff">⚔️</div>';
      if(inst==='defense') ii += '<div class="p-inst-icon" style="background:#3b82f6;color:#fff">🛡️</div>';
      if(inst==='counter') ii += '<div class="p-inst-icon" style="background:#a855f7;color:#fff">⚡</div>';
      if(inst==='press') ii += '<div class="p-inst-icon" style="background:#f97316;color:#fff">🔥</div>';
      if(inst==='stayback') ii += '<div class="p-inst-icon" style="background:#475569;color:#fff">🔒</div>';
      if(isInj) ii += '<div class="p-inst-icon" style="background:#ef4444;color:#fff">🚑</div>';
      const isCap = G.captain === p.id;
      const capBadge = isCap ? '<div class="p-capt-badge">C</div>' : '';
      let roleBadge = '';
      if(G.penaltyTaker===p.id) roleBadge = '<div class="p-role-badge" style="color:#22d3ee;border-color:#22d3ee">🥅</div>';
      else if(G.freeKickTaker===p.id) roleBadge = '<div class="p-role-badge" style="color:#a855f7;border-color:#a855f7">🎯</div>';
      else if(G.cornerTaker===p.id) roleBadge = '<div class="p-role-badge" style="color:#f97316;border-color:#f97316">🚩</div>';
      const mo = getMoraleEmoji(p.morale);
      const fm = getFormEmoji(p);
      
      // ✅ إضافة الصورة داخل الملعب
      return `<div class="p-token ${isInj?'injured':''}" style="left:${slot.y*100}%; top:${(1-slot.x)*100}%; background:${t.c1}; color:${t.c2==='#FFFFFF'?'#000':t.c2}; border-color:${isInj?'#ef4444':borderC}; border-width:${isCap?'3px':'2px'}; padding:0; overflow:hidden;" onpointerdown="startDrag(event,${i},false,'${p.id}')">
        ${capBadge}${roleBadge}${ii}
        <div style="position:absolute; inset:0; opacity:0.8;">
           ${typeof playerAvatarHtml === 'function' ? playerAvatarHtml(p, 42, 'border:none; border-radius:0;') : ''}
        </div>
        <div style="position:relative; z-index:2; font-size:8px; font-weight:900; background:rgba(0,0,0,0.6); padding:1px 4px; border-radius:4px;">${slot.pos} ${p.r}</div>
        <div class="fit-bar" style="z-index:2;"><div style="width:${fit}%;background:${fitColor}"></div></div>
        <div class="p-name-label" style="z-index:2;">${p.name.split(' ')[0]} ${mo} ${fm}</div>
      </div>`;
    }).join('')}
  </div>`;

  const instC = buildInstSummary();
  const instNames = {attack:'⚔️ هجوم', defense:'🛡️ دفاع', counter:'⚡ مرتد', press:'🔥 ضغط', stayback:'🔒 تثبيت', normal:'⚖️ عادي'};
  const instSummary = `<div class="sec">📋 ملخص التعليمات</div>
    <div class="inst-summary">${Object.entries(instC).filter(([k,v]) => v>0).map(([k,v]) => `<div class="inst-group"><b>${instNames[k]}</b>${v} لاعب</div>`).join('')}</div>`;

  const bench = t.ps.filter(p => !G.lu.includes(p.id) && !p.susp);
  const benchGroups = {GK:[], DEF:[], MID:[], FWD:[]};
  bench.forEach(p => {if(benchGroups[p.pos]) benchGroups[p.pos].push(p);});
  const groupLabels = {GK:'🧤 حراس', DEF:'🛡️ مدافعون', MID:'🎨 وسط', FWD:'⚔️ مهاجمون'};
  const benchHTML = Object.entries(benchGroups).filter(([k,v]) => v.length>0).map(([pos, players]) =>
    `<div class="bench-group"><div class="bench-group-label">${groupLabels[pos]} (${players.length})</div>
    <div class="bench-container">${players.sort((a,b)=>b.r-a.r).map(p => {
      const fit = p.fit != null ? Math.round(p.fit) : 100;
      const fitColor = fit>=85?'#22c55e':fit>=65?'#fbbf24':fit>=45?'#f97316':'#ef4444';
      return `<div class="bench-player" onpointerdown="startDrag(event,-1,true,'${p.id}')" style="align-items:center; display:flex; flex-direction:column;">
        ${typeof playerAvatarHtml === 'function' ? playerAvatarHtml(p, 40) : `<div style="width:38px;height:38px;border-radius:50%;background:${p.injury?'#7f1d1d':t.c1};border:2px solid ${p.injury?'#ef4444':fitColor};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:${t.c2==='#FFFFFF'?'#000':t.c2}">${p.r}</div>`}
        <div style="font-size:9px;margin-top:4px;max-width:48px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name.split(' ')[0]}</div>
      </div>`;
    }).join('')}</div></div>`
  ).join('');
  const benchBlock = benchHTML || '<div class="c" style="text-align:center;color:var(--m);font-size:10px;padding:10px">لا بدلاء متاحون</div>';

  const fs = FM_STYLE[G.form] || FM_STYLE['4-3-3'];
  const ts = TAC_STYLE[G.tac] || TAC_STYLE.balanced;

  return `${missionCard}
    ${friendlyBtnHtml}
    <div class="c" style="text-align:center;padding:8px">
      <div style="font-size:9px;color:var(--m);margin-bottom:4px">📈 آخر 5 مباريات</div>
      <div class="form-pills">${formPills}</div>
    </div>
    ${powerCard}${warningsBar}${previewCard}${quickActions}${hintsBox}

    <div class="sec">📐 الخطة</div>
    <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
      ${Object.keys(FM).map(f => `<div class="chip ${G.form===f?'on':''}" style="padding:6px 8px;font-size:10px;flex:0 0 auto" onclick="setF('${f}')">${f}</div>`).join('')}
    </div>
    <div class="info-box">📖 <b>${G.form}:</b> ${fs.desc} • ⚔️×${fs.att.toFixed(2)} 🛡️×${fs.def.toFixed(2)}</div>

    <div class="sec">🎯 التكتيك</div>
    <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
      ${Object.entries(TAC_STYLE).map(([k,v]) => `<div class="chip ${G.tac===k?'on':''}" style="padding:6px 8px;font-size:10px;flex:0 0 auto" onclick="G.tac='${k}';save();dash()">${v.label}</div>`).join('')}
    </div>
    <div class="info-box">📖 <b>${ts.label}:</b> ${ts.desc} • ⚔️×${ts.att.toFixed(2)} 🛡️×${ts.def.toFixed(2)}</div>

    ${roleCards}
    ${pitch}
    <div style="font-size:9px;color:var(--m);text-align:center;margin-bottom:6px">🟢 مركزه • 🟡 ثانوي • 🔴 خارج مركزه</div>
    ${instSummary}
    <div class="sec">🔄 البدلاء</div>
    ${benchBlock}`;
}

// ✅ دالة اختيار خصم ودي
function showFriendlyTeams() {
    if (G.season.friendlyMatchesPlayed >= 2) {
        return alert('لقد استنفدت مبارياتك الودية لهذه الجولة.');
    }

    let teams = [];
    if (typeof WORLD !== 'undefined') {
        WORLD.forEach(t => { if(t[0] !== G.my) teams.push({id: t[0], name: t[1], rating: t[2]}); });
    }
    if (typeof AFRICAN !== 'undefined') {
        AFRICAN.forEach(t => { if(t[0] !== G.my) teams.push({id: t[0], name: t[1], rating: t[2]}); });
    }
    
    // خلط الفرق واختيار 6 عشوائياً
    teams = teams.sort(() => Math.random() - 0.5).slice(0, 6);

    let html = `<div class="mc-head"><div class="mc-icon">🤝</div><div class="mc-title">اختر خصمك الودي</div><div class="mc-sub">المباريات المتبقية: ${2 - G.season.friendlyMatchesPlayed}</div></div>
    <div style="display:flex; flex-direction:column; gap:8px; max-height:60vh; overflow-y:auto; padding:5px;">`;

    teams.forEach(t => {
        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:10px; border-radius:10px;">
            <div>
                <div style="color:#fff; font-weight:bold; font-size:14px;">${t.name}</div>
                <div style="color:#94a3b8; font-size:11px;">⭐ التقييم: ${t.rating}</div>
            </div>
            <button class="b g sm" style="padding:6px 12px; font-size:11px;" onclick="$('cm').hidden=true; startFriendlyMatch('${t.id}', '${t.name}', ${t.rating})">العب ▶</button>
        </div>`;
    });

    html += `</div><div class="mc-actions" style="margin-top:10px;"><button class="b r full" onclick="$('cm').hidden=true">إلغاء</button></div>`;

    $('cmc').innerHTML = `<div class="mc mc-warning">${html}</div>`;
    $('cm').hidden = false;
}

// ============================================
// 🏆 الترتيب المباشر (Live Standings)
// ============================================
function tbH(){
  if (G.multiplayerLeagueId) {
      setTimeout(loadLiveStandings, 100);
      return `<div id="live-tb-container" style="text-align:center; padding:50px; color:var(--gold);">⏳ جاري تحميل جدول الترتيب المباشر...</div>`;
  }
  
  // الجدول القديم (الفردي)
  return `<div class="c" style="padding:6px">
    <table>
      <tr><th>#</th><th style="text-align:right">الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>ن</th></tr>
      ${tbl().map((t,i) => `<tr class="${t.id===G.my?'me':''} ${t.id!==G.my?'clickable':''}" ${t.id!==G.my?`onclick="showTeamPlayers('${t.id}')"`:''}>
        <td>${i+1}</td>
        <td style="text-align:right;font-weight:600">${t.name}${t.id!==G.my?' 👥':''}</td>
        <td>${t.pl}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
        <td>${t.gf-t.ga}</td><td style="color:var(--gold);font-weight:900">${t.pts}</td>
      </tr>`).join('')}
    </table>
  </div>`;
}

async function loadLiveStandings() {
    if (liveTbInterval) { clearInterval(liveTbInterval); liveTbInterval = null; }
    
    const fetchAndRender = async () => {
        const container = document.getElementById('live-tb-container');
        if (!container) {
            if (liveTbInterval) { clearInterval(liveTbInterval); liveTbInterval = null; }
            return;
        }
        
        try {
            const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', G.multiplayerLeagueId);
            if (!slots) return;
            
            const sorted = slots.sort((a, b) => (b.points||0) - (a.points||0) || ((b.goals_for||0) - (b.goals_against||0)) - ((a.goals_for||0) - (a.goals_against||0)));
            
            let html = `<div class="c" style="padding:6px">
                <div class="sec" style="color:var(--gold); text-align:center; margin-bottom:10px;">🏆 جدول ترتيب الدوري المباشر</div>
                <table>
                    <tr><th>#</th><th style="text-align:right">الفريق / المدرب</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>ن</th></tr>`;
            
            sorted.forEach((s, i) => {
                const isMe = s.user_id === G._userId;
                const gd = (s.goals_for||0) - (s.goals_against||0);
                html += `<tr style="${isMe ? 'background:rgba(251,191,36,.15); border:1px solid var(--gold);' : ''}">
                    <td>${i+1}</td>
                    <td style="text-align:right;">
                        <b style="color:#fff; font-size:12px;">${s.team_name} ${isMe?'⭐':''}</b>
                        <div style="font-size:9px; color:#94a3b8;">👤 ${s.manager_name}</div>
                    </td>
                    <td>${s.played||0}</td>
                    <td>${s.won||0}</td>
                    <td>${s.drawn||0}</td>
                    <td>${s.lost||0}</td>
                    <td>${gd > 0 ? '+' : ''}${gd}</td>
                    <td style="color:var(--gold); font-weight:900; font-size:14px;">${s.points||0}</td>
                </tr>`;
            });
            html += `</table></div>`;
            container.innerHTML = html;
        } catch(e) { console.error("Standings error:", e); }
    };

    await fetchAndRender();
    liveTbInterval = setInterval(fetchAndRender, 5000);
}

// ============================================
// 💰 السوق المباشر (Live Market)
// ============================================
function trH(t){
  if (G.multiplayerLeagueId) {
      setTimeout(loadLiveMarket, 100);
      return `<div id="live-market-container" style="text-align:center; padding:50px; color:var(--gold);">⏳ جاري تحميل السوق المباشر...</div>`;
  }

  // السوق القديم (الفردي)
  const me = T[G.my];
  const isWindowOpen = checkTransferWindow();
  const surplus = [];
  Object.values(T).forEach(team => {
    if(team.id === G.my) return;
    const b11 = autoFillLineup(team, team.form);
    team.ps.forEach(p => {
      if(!b11.includes(p.id) && !p.susp && !p.injury && p.r >= 70) surplus.push({p, team});
    });
  });
  surplus.sort((a,b) => b.p.r - a.p.r);
  const mine = [...t.ps].sort((a,b) => b.r - a.r);
  
  let winMsg = isWindowOpen 
    ? `<div style="background:rgba(74,222,128,.2);border:1px solid #4ade80;border-radius:10px;padding:8px;text-align:center;font-size:11px;color:#4ade80;margin-bottom:8px">✅ نافذة الانتقالات مفتوحة</div>`
    : `<div style="background:rgba(248,113,113,.2);border:1px solid #f87171;border-radius:10px;padding:8px;text-align:center;font-size:11px;color:#f87171;margin-bottom:8px">❌ النافذة مغلقة (1-60، 140-175)</div>`;
    
  let totalSal = 0;
  t.ps.forEach(p => totalSal += (p.contract?.salary || 0));
  
  return winMsg + `
    <div class="c" style="text-align:center;border:1px solid rgba(251,191,36,.4);padding:10px">
      <div style="font-size:10px;color:var(--m)">ميزانيتك</div>
      <div style="color:var(--gold);font-size:20px;font-weight:900">${t.budget.toFixed(1)}M</div>
      <div style="font-size:9px;color:var(--m)">${t.ps.length}/25 • رواتب ${totalSal.toFixed(2)}M/مباراة</div>
    </div>
    
    ${G.legendsMarket && G.legendsMarket.length ? `
      <div class="sec" style="color:#fbbf24; display:flex; justify-content:space-between;">
        <span>🌟 سوق الأساطير</span>
        <span style="font-size:9px; color:#ef4444; animation: badgeGlow 1s infinite alternate;">🔥 عرض محدود</span>
      </div>
      <div style="max-height:150px;overflow:auto;background:rgba(120,53,15,.2);border-radius:10px;padding:6px;margin-bottom:8px;border:2px solid var(--gold)">
        ${G.legendsMarket.map(p => {
          const remaining = p.expiresOnDay ? Math.max(0, p.expiresOnDay - G.season.currentDay) : 999;
          return `
          <div class="pl legend" onclick="${isWindowOpen ? `showLegendCard('${p.id}')` : ''}" style="cursor:${isWindowOpen ? 'pointer' : 'not-allowed'};${!isWindowOpen ? 'opacity:0.5' : ''}">
            <span>🌟</span><span style="flex:1;font-size:11px">${p.name}</span>
            <span style="color:var(--gold);font-size:10px">⭐${p.r}</span>
            <div style="display:flex; flex-direction:column; align-items:flex-end; margin-right:6px;">
              <span style="color:#fbbf24;font-size:10px; font-weight:900;">${p.value}M</span>
              ${remaining <= 1 ? `<span style="color:#ef4444;font-size:8px;font-weight:bold;background:rgba(239,68,68,.2);padding:1px 4px;border-radius:4px;margin-top:2px">⏳ ينتهي اليوم</span>` : `<span style="color:#4ade80;font-size:8px;margin-top:2px">⏳ ${remaining} أيام</span>`}
            </div>
          </div>`;
        }).join('')}
      </div>
    ` : ''}
    
    <div class="sec">🛒 السوق (${surplus.length})</div>
    <div style="max-height:200px;overflow:auto;background:rgba(15,34,56,.5);border-radius:10px;padding:6px;margin-bottom:8px;border:1px solid rgba(251,191,36,.2)">
      ${surplus.length === 0 ? '<div style="text-align:center;color:var(--m);padding:10px;font-size:10px">لا لاعبون</div>' 
        : surplus.slice(0, 40).map(x => `
          <div class="pl" style="cursor:${isWindowOpen ? 'pointer' : 'not-allowed'};${!isWindowOpen ? 'opacity:0.5' : ''}" onclick="${isWindowOpen ? `showCard('${x.p.id}','${x.team.id}')` : ''}">
            <span style="flex:1;font-size:11px">${x.p.name}</span>
            <span style="font-size:9px;color:var(--m)">${x.p.pos}</span>
            <span style="color:var(--gold);font-size:10px">⭐${x.p.r}</span>
            <span style="color:#4ade80;font-weight:700;font-size:10px">${x.p.value}M</span>
          </div>`).join('')}
    </div>
    <div class="sec">📤 لاعبوك</div>
    <div style="max-height:200px;overflow:auto;background:rgba(15,34,56,.5);border-radius:10px;padding:6px;border:1px solid rgba(251,191,36,.2)">
      ${mine.map(p => `
        <div class="pl">
          <span style="flex:1;cursor:pointer;font-size:11px" onclick="showCard('${p.id}')">${p.injury ? '🚑 ' : ''}${p.name}</span>
          <span style="color:#c4b5fd;font-size:9px">L${p.lvl}</span>
          <span style="color:var(--gold);font-size:10px">⭐${p.r}</span>
          <span style="color:#4ade80;font-size:10px">${p.value}M</span>
          <button class="b a sm" style="padding:3px 8px;font-size:9px;opacity:${isWindowOpen ? 1 : .4}" ${isWindowOpen ? `onclick="event.stopPropagation();sellPlayer('${p.id}')"` : 'disabled'}>بيع</button>
        </div>`).join('')}
    </div>`;
}

async function loadLiveMarket() {
    if (liveMarketInterval) { clearInterval(liveMarketInterval); liveMarketInterval = null; }
    
    const fetchAndRender = async () => {
        const container = document.getElementById('live-market-container');
        if (!container) {
            if (liveMarketInterval) { clearInterval(liveMarketInterval); liveMarketInterval = null; }
            return;
        }

        try {
            const { data: { user } } = await _db.auth.getUser();
            const { data: listings } = await _db.from('market_listings').select('*').order('listed_at', { ascending: false });
            
            let html = `<div class="c" style="border:2px solid #22d3ee; padding:10px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="font-size:14px; font-weight:900; color:#22d3ee;">🌐 السوق المباشر (أونلاين)</div>
                    <div style="font-size:12px; font-weight:bold; color:var(--gold);">ميزانيتك: ${T[G.my].budget.toFixed(1)}M</div>
                </div>`;
                
            if (!listings || listings.length === 0) {
                html += `<div style="text-align:center; padding:20px; color:#94a3b8;">لا يوجد لاعبون معروضون للبيع حالياً من قبل المستخدمين.</div>`;
            } else {
                html += `<div style="max-height:300px; overflow:auto;">`;
                listings.forEach(list => {
                    const p = list.player_data;
                    html += `<div class="pl" style="background:rgba(0,0,0,.3); border-radius:8px; padding:8px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:12px; font-weight:bold; color:#fff;">${p.name} <span style="font-size:9px; color:#94a3b8;">(${p.pos})</span></span>
                            <span style="font-size:9px; color:#22d3ee;">بواسطة: ${list.manager_name} • ${list.team_name}</span>
                        </div>
                        <div style="text-align:center;">
                            <span style="color:var(--gold); font-size:14px; font-weight:900;">⭐${p.r}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="color:#4ade80; font-size:12px; font-weight:bold;">${list.asking_price}M</span>
                            ${list.user_id !== user.id ? `
                                <button class="b g sm" style="padding:4px 8px; font-size:10px;" onclick="buyMarketPlayer('${list.id}')">شراء</button>
                            ` : `
                                <button class="b r sm" style="padding:4px 8px; font-size:10px;" onclick="cancelMarketListing('${list.id}', '${p.id}')">إلغاء</button>
                            `}
                        </div>
                    </div>`;
                });
                html += `</div>`;
            }
            html += `</div>`;

            // قسم لاعبوك للبيع
            const mine = [...T[G.my].ps].sort((a,b) => b.r - a.r);
            html += `<div class="sec">📤 لاعبوك (اضغط لعرضهم للبيع)</div>
                <div style="max-height:250px;overflow:auto;background:rgba(15,34,56,.5);border-radius:10px;padding:6px;border:1px solid rgba(251,191,36,.2)">
                ${mine.map(p => `
                    <div class="pl" style="cursor:pointer;" onclick="showCard('${p.id}')">
                        <span style="flex:1;font-size:11px">${p.injury ? '🚑 ' : ''}${p.name}</span>
                        <span style="color:#c4b5fd;font-size:9px">L${p.lvl}</span>
                        <span style="color:var(--gold);font-size:10px">⭐${p.r}</span>
                        <span style="color:#4ade80;font-size:10px">${p.value}M</span>
                    </div>`).join('')}
                </div>`;

            container.innerHTML = html;

        } catch (e) { console.error("Market error:", e); }
    };

    await fetchAndRender();
    liveMarketInterval = setInterval(fetchAndRender, 5000);
}

// ============================================
// باقي الدوال (مثل crH, mgrH, newsH...)
// ============================================
function crH(t){
  let h = `<div class="c" style="text-align:center;padding:10px">
    <div style="font-size:10px;color:var(--m)">الفريق</div>
    <div style="font-size:12px;margin-top:4px;font-weight:900">${t.ps.length} لاعب • مستوى ${teamLvl(t)}</div>
  </div>`;

  const teamAvgXp = t.ps.reduce((sum, p) => {
    if(p.lvl >= 10) return sum + 100;
    return sum + Math.min(100, ((p.xp || 0) / xpNeeded(p.lvl)) * 100);
  }, 0) / t.ps.length;

  const trainFocus = G.training?.focus || 'balanced';
  const trainIntensity = G.training?.intensity || 'normal';
  const intensityLabels = {light: 'خفيف', normal: 'عادي', intense: 'مكثف 🔥'};
  const intensityColors = {light: '#4ade80', normal: '#fbbf24', intense: '#ef4444'};
  const focusLabels = {attack: '⚔️ هجوم', defense: '🛡️ دفاع', fitness: '🏃 بدني', youth: '🌱 شباب', balanced: '⚖️ متوازن'};
  
  h += `<div class="c">
    <div class="sec">🏋️ مركز التدريب</div>
    
    <div style="background:linear-gradient(135deg,rgba(59,130,246,.15),rgba(15,34,56,.5));border:1px solid rgba(59,130,246,.3);border-radius:10px;padding:10px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:11px;color:#94a3b8;font-weight:bold;">📊 تقدم الفريق في التدريب</span>
        <b style="font-size:13px;color:#60a5fa;">${Math.round(teamAvgXp)}%</b>
      </div>
      <div style="height:10px;background:rgba(0,0,0,.5);border-radius:5px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.5);">
        <div style="width:${teamAvgXp}%;height:100%;background:linear-gradient(90deg,#3b82f6,#22d3ee);border-radius:5px;transition:width .5s;box-shadow:0 0 10px rgba(34,211,238,.6);"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:9px;color:#94a3b8;">
        <span>التركيز: <b style="color:#fff;">${focusLabels[trainFocus]}</b></span>
        <span>الشدة: <b style="color:${intensityColors[trainIntensity]};">${intensityLabels[trainIntensity]}</b></span>
      </div>
    </div>

    <div style="font-size:10px; color:#94a3b8; margin-bottom:8px;">اختر تركيز التدريب وشدة التمرين. التدريب المكثف يطور اللاعبين أسرع لكنه يسبب إرهاقاً وإصابات.</div>
    
    <div style="font-size:10px; color:var(--gold); margin-bottom:4px;">التركيز:</div>
    <div style="display:flex; gap:4px; margin-bottom:8px; flex-wrap:wrap;">
      <div class="chip ${trainFocus==='attack'?'on':''}" onclick="setTraining('focus','attack')">⚔️ هجوم</div>
      <div class="chip ${trainFocus==='defense'?'on':''}" onclick="setTraining('focus','defense')">🛡️ دفاع</div>
      <div class="chip ${trainFocus==='fitness'?'on':''}" onclick="setTraining('focus','fitness')">🏃 بدني</div>
      <div class="chip ${trainFocus==='youth'?'on':''}" onclick="setTraining('focus','youth')">🌱 شباب</div>
    </div>

    <div style="font-size:10px; color:var(--gold); margin-bottom:4px;">الشدة:</div>
    <div style="display:flex; gap:4px; flex-wrap:wrap;">
      <div class="chip ${trainIntensity==='light'?'on':''}" onclick="setTraining('intensity','light')">خفيف</div>
      <div class="chip ${trainIntensity==='normal'?'on':''}" onclick="setTraining('intensity','normal')">عادي</div>
      <div class="chip ${trainIntensity==='intense'?'on':''}" onclick="setTraining('intensity','intense')">مكثف 🔥</div>
    </div>
  </div>`;

  h += `<div class="g2">`;

  h += [...t.ps].sort((a,b) => b.r-a.r || b.lvl-a.lvl).map(p => {
    const mo = getMoraleEmoji(p.morale);
    const inj = p.injury ? '🚑 ' : '';
    const conYrs = p.contract?.years || 0;
    
    const maxed = p.lvl >= 10;
    const xpPct = maxed ? 100 : Math.min(100, Math.round(((p.xp || 0) / xpNeeded(p.lvl)) * 100));
    const xpBarColor = maxed ? '#22c55e' : 'linear-gradient(90deg,#3b82f6,#22d3ee)';
    const xpText = maxed ? 'MAX' : `${p.xp || 0}/${xpNeeded(p.lvl)}`;
    
    return `<div class="c" style="padding:8px;cursor:pointer;margin-bottom:4px;${p.injury?'border-color:#ef4444':''}${conYrs<=0?'border-color:#f87171':''}" onclick="showCard('${p.id}')">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
        
        <!-- ✅ صورة اللاعب الجديدة -->
        <div style="position:relative;">
           ${typeof playerAvatarHtml === 'function' ? playerAvatarHtml(p, 40) : `<div style="width:40px;height:40px;border-radius:50%;background:${p.injury?'#7f1d1d':t.c1};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:${t.c2==='#FFFFFF'?'#000':t.c2}">${p.r}</div>`}
           <div style="position:absolute; bottom:-2px; right:-2px; background:var(--gold); color:#000; font-size:9px; font-weight:900; padding:1px 4px; border-radius:8px; border:1px solid #000;">${p.r}</div>
        </div>

        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inj}${p.name} ${mo}</div>
          <div style="font-size:9px;color:var(--m)">${p.pos} • L${p.lvl} • ${p.age}س</div>
        </div>
      </div>
      
      <div style="height:4px;background:rgba(0,0,0,.5);border-radius:2px;overflow:hidden;position:relative;">
        <div style="width:${xpPct}%;height:100%;background:${xpBarColor};border-radius:2px;transition:width .5s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:8px;color:#94a3b8;margin-top:2px;">
        <span>XP</span>
        <span style="color:${maxed ? '#22c55e' : '#60a5fa'};font-weight:bold;">${xpText}</span>
      </div>
      
    </div>`;
  }).join('');
  
  h += '</div>';
  return h;
}

function mgrH(){
  const t = T[G.my];
  const myPos = tbl().findIndex(x => x.id === G.my)+1;
  let totalSal = 0;
  t.ps.forEach(p => totalSal += (p.contract?.salary || 0));

  let h = `<div class="c" style="text-align:center; margin-top:10px;">
    <h2 style="color:var(--gold); margin:0; font-size:18px;">🏢 إدارة النادي</h2>
    <div style="font-size:12px; color:#94a3b8; margin-top:5px;">${t.name} • المركز #${myPos}</div>
  </div>`;

  // ✅ 1. أهداف مجلس الإدارة
  if (G.boardObjectives) {
      const obj = G.boardObjectives;
      h += `<div class="c" style="border:1px solid #fbbf24; background:rgba(251,191,36,.05);">
          <div class="sec" style="color:#fbbf24;">🎯 أهداف مجلس الإدارة</div>
          <div style="font-size:12px; color:#fff; margin-bottom:5px;">الهدف: <b>${obj.target || obj.desc}</b></div>
          <div style="font-size:11px; color:#94a3b8;">المكافأة: <b style="color:#4ade80;">${obj.reward || 0}M</b></div>
          <div style="font-size:10px; color:${obj.status === 'success' ? '#4ade80' : (obj.status === 'failed' ? '#ef4444' : '#cbd5e1')}; margin-top:5px;">
              الحالة: ${obj.status === 'success' ? '✅ تم تحقيق الهدف' : (obj.status === 'failed' ? '❌ فشل الهدف' : '⏳ جاري التقييم')}
          </div>
      </div>`;
  }

  // ✅ 2. تفاصيل الراعي الحالي
  if (G.currentSponsor) {
      const s = G.currentSponsor;
      h += `<div class="c" style="border:1px solid #60a5fa; background:rgba(59,130,246,.05);">
          <div class="sec" style="color:#60a5fa;">💼 الراعي الرسمي</div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:10px;">
                  <div style="font-size:24px; background:rgba(255,255,255,.1); padding:6px; border-radius:8px;">${s.logo}</div>
                  <div>
                      <div style="font-size:14px; font-weight:900; color:#fff;">${s.name}</div>
                      <div style="font-size:10px; color:#4ade80;">دفعة مقدمة: ${s.safe}M</div>
                  </div>
              </div>
              <div style="text-align:left;">
                  <div style="font-size:9px; color:#94a3b8; margin-bottom:3px;">شروط إضافية:</div>
                  <div style="font-size:10px; color:#fbbf24; font-weight:bold; background:rgba(0,0,0,.3); padding:2px 6px; border-radius:4px;">${s.bonus || 'لا يوجد'}</div>
              </div>
          </div>
      </div>`;
  }

  // ✅ 3. أكاديمية الشباب (عرض المواهب)
  if (G.youthPlayers && G.youthPlayers.length > 0) {
      h += `<div class="c" style="border:1px solid #22c55e;">
          <div class="sec" style="color:#22c55e; display:flex; justify-content:space-between; align-items:center;">
              <span>🌱 أكاديمية الشباب</span>
              <span style="font-size:9px; background:rgba(34,197,94,.2); padding:2px 6px; border-radius:4px;">${G.youthPlayers.length} مواهب</span>
          </div>
          <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:5px;">`;

      G.youthPlayers.forEach((p, idx) => {
          const ratingColor = p.r >= 75 ? '#fbbf24' : (p.r >= 65 ? '#4ade80' : '#fff');
          h += `<div style="min-width:100px; background:rgba(0,0,0,.4); padding:8px; border-radius:8px; text-align:center;">
              <div style="display:flex; justify-content:center; margin-bottom:4px;">
                ${typeof playerAvatarHtml === 'function' ? playerAvatarHtml(p, 40) : ''}
              </div>
              <div style="font-size:16px; font-weight:900; color:${ratingColor};">${p.r}</div>
              <div style="font-size:9px; color:#94a3b8; margin-bottom:2px;">${p.pos}</div>
              <div style="font-size:11px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name.split(' ')[0]}</div>
              <button class="b sm" style="margin-top:6px; padding:3px 6px; font-size:9px; background:#22c55e; width:100%;" onclick="promoteYouth(${idx})">ترقية</button>
          </div>`;
      });

      h += `</div></div>`;
  }

  // ✅ 4. المنشآت
  const fac = G.facilities || {stadium: 1, training: 1, youth: 1};
  h += `<div class="c">
    <div class="sec">🏗️ تطوير المنشآت</div>
    
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; background:rgba(0,0,0,.2); padding:8px; border-radius:8px;">
      <div>
        <div style="font-size:12px; color:#fff; font-weight:bold;">🏟️ الملعب</div>
        <div style="font-size:9px; color:#94a3b8;">المستوى ${fac.stadium} • يزيد دخل المباراة</div>
      </div>
      <button class="b sm" onclick="upgradeFacility('stadium')" ${fac.stadium>=5?'disabled':''} style="padding:4px 8px; font-size:10px;">ترقية (${50*fac.stadium}M)</button>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; background:rgba(0,0,0,.2); padding:8px; border-radius:8px;">
      <div>
        <div style="font-size:12px; color:#fff; font-weight:bold;">🏋️ مركز التدريب</div>
        <div style="font-size:9px; color:#94a3b8;">المستوى ${fac.training} • يزيد سرعة تطور اللاعبين</div>
      </div>
      <button class="b sm" onclick="upgradeFacility('training')" ${fac.training>=5?'disabled':''} style="padding:4px 8px; font-size:10px;">ترقية (${50*fac.training}M)</button>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.2); padding:8px; border-radius:8px;">
      <div>
        <div style="font-size:12px; color:#fff; font-weight:bold;">🌱 أكاديمية الشباب</div>
        <div style="font-size:9px; color:#94a3b8;">المستوى ${fac.youth} • ينتج لاعبين شباب أفضل</div>
      </div>
      <button class="b sm" onclick="upgradeFacility('youth')" ${fac.youth>=5?'disabled':''} style="padding:4px 8px; font-size:10px;">ترقية (${50*fac.youth}M)</button>
    </div>
  </div>`;

  // ✅ 5. الاقتصاد
  h += `<div class="c"><div class="sec">💰 الاقتصاد</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#fff;margin-bottom:6px"><span>الميزانية:</span><b style="color:${t.budget>=0?'#4ade80':'#f87171'}">${t.budget.toFixed(1)}M</b></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#fff;margin-bottom:6px"><span>رواتب/مباراة:</span><b style="color:#f87171">-${totalSal.toFixed(2)}M</b></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#fff;margin-bottom:6px"><span>عدد اللاعبين:</span><b>${t.ps.length} / 25</b></div>
  </div>`;

  // ✅ 6. تقييم مجلس الإدارة (واقعي واحترافي)
  let boardConfidence = 100;
  let boardTitle = "🏛️ تقييم مجلس الإدارة";
  
  if (G.multiplayerLeagueId && typeof mySlot !== 'undefined' && mySlot && mySlot.played > 0) {
      boardTitle = "🔴 تقييم الإدارة (الدوري المباشر)";
      const maxPossiblePoints = mySlot.played * 3;
      const pointRatio = (mySlot.points || 0) / (maxPossiblePoints || 1); 
      boardConfidence = Math.round(pointRatio * 100);
      const gd = (mySlot.goals_for || 0) - (mySlot.goals_against || 0);
      boardConfidence += Math.min(10, Math.max(-10, gd)); 
  } else {
      const curPos = tbl().findIndex(x => x.id === G.my) + 1;
      if (curPos > 10) boardConfidence -= (curPos - 10) * 5;
      if (G.boardObjectives && G.boardObjectives.status === 'failed') boardConfidence -= 30;
      if (G.boardObjectives && G.boardObjectives.status === 'success') boardConfidence += 10;
  }
  
  if (boardConfidence > 100) boardConfidence = 100;
  if (boardConfidence < 0) boardConfidence = 0;

  let confColor = '#22c55e'; // أخضر
  let confStatus = 'مستقر';
  if (boardConfidence < 30) {
      confColor = '#ef4444'; // أحمر
      confStatus = 'مهدد بالإقالة';
  } else if (boardConfidence < 60) {
      confColor = '#f59e0b'; // برتقالي
      confStatus = 'تحت المراقبة';
  }

  h += `<div class="c" style="border:1px solid ${confColor}44; background:linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.9));">
    <div class="sec" style="color:${confColor}; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px; margin-bottom:15px;">
        <span>${boardTitle}</span>
    </div>
    
    <div style="display:flex; align-items:center; justify-content:center; gap:20px; margin: 15px 0;">
        
        <!-- الرسم الواقعي (سيلويت لرجل أعمال) -->
        ${getBoardRealisticSVG(boardConfidence)}

        <!-- مؤشر الأداء الدائري -->
        <div style="position:relative; width:100px; height:100px; border-radius:50%; background: conic-gradient(${confColor} ${boardConfidence}%, rgba(255,255,255,0.05) ${boardConfidence}%); display:flex; align-items:center; justify-content:center; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">
            <!-- الدائرة الداخلية الشفافة -->
            <div style="width:80px; height:80px; background:#0f172a; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                <div style="font-size:24px; font-weight:900; color:${confColor}; text-shadow:0 0 10px ${confColor}88;">${boardConfidence}%</div>
            </div>
        </div>
    </div>

    <div style="text-align:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; border:1px solid ${confColor}33;">
        <div style="font-size:14px; font-weight:900; color:${confColor}; margin-bottom:4px;">${confStatus}</div>
        <div style="font-size:11px; color:#cbd5e1;">
            ${G.multiplayerLeagueId ? 
              'التقييم يعتمد على نتائجك ونقاطك في الدوري المباشر.' : 
              'التقييم يعتمد على مركزك في الدوري وتحقيق الأهداف.'}
        </div>
    </div>
  </div>`;

  // ✅ 7. التقرير المالي التفصيلي
  const sponsorIncome = G.currentSponsor ? G.currentSponsor.safe : 0;
  const matchdayIncome = fac.stadium * 5; // دخل تقريبي من الملعب
  h += `<div class="c">
    <div class="sec" style="color:#22d3ee;">📊 التقرير المالي (تقديري)</div>
    
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#4ade80; margin-bottom:6px;">
        <span>📈 الإيرادات (كل مباراة):</span>
        <b>+${(sponsorIncome / 20 + matchdayIncome).toFixed(1)}M</b>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#ef4444; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,.1); padding-bottom:8px;">
        <span>📉 المصروفات (الرواتب):</span>
        <b>-${totalSal.toFixed(1)}M</b>
    </div>
    
    <div style="display:flex; justify-content:space-between; font-size:13px; color:#fff; font-weight:bold;">
        <span>💰 الصافي التقديري:</span>
        <b style="color:${(sponsorIncome/20 + matchdayIncome - totalSal) >= 0 ? '#4ade80' : '#ef4444'};">
            ${(sponsorIncome/20 + matchdayIncome - totalSal) >= 0 ? '+' : ''}${(sponsorIncome/20 + matchdayIncome - totalSal).toFixed(1)}M
        </b>
    </div>
  </div>`;

  // ✅ 8. قسم اللعب الجماعي
  h += `<div class="c" style="margin-top:10px; border:1px solid #8b5cf6; box-shadow:0 0 15px rgba(139,92,246,.3);">
    <div style="font-size:12px; color:#8b5cf6; font-weight:900; margin-bottom:8px; text-align:center;">🌍 اللعب الجماعي</div>
    <button class="b full" style="padding:14px; font-size:13px; background:linear-gradient(135deg, #8b5cf6, #6d28d9); color:#fff; border:none; margin-bottom:10px;" onclick="if(typeof showLeaguesPage==='function') showLeaguesPage()">🏆 الدخول إلى الدوريات</button>
    
    ${G.multiplayerLeagueId ? `
    <button class="b full" style="padding:12px; font-size:12px; background:#ef4444; color:#fff; border:none;" onclick="resignFromLobby()">🚪 تقديم استقالة (مغادرة الغرفة)</button>
    ` : ''}
  </div>`;
  
  return h;
}

// ✅ دالة رسم أيقونة واقعية لمجلس الإدارة
function getBoardRealisticSVG(confidence) {
    let suitColor, tieColor, accentColor;
    
    if (confidence >= 60) {
        suitColor = '#1e293b'; // كحلي داكن
        tieColor = '#16a34a';  // كرافة خضراء (رضا)
        accentColor = '#22c55e';
    } else if (confidence >= 30) {
        suitColor = '#334155'; // رمادي داكن
        tieColor = '#f59e0b';  // كرافة برتقالية (تحذير)
        accentColor = '#f59e0b';
    } else {
        suitColor = '#1f2937'; // أسود داكن
        tieColor = '#dc2626';  // كرافة حمراء (غضب)
        accentColor = '#ef4444';
    }

    return `
    <svg width="90" height="90" viewBox="0 0 100 100" style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));">
        <!-- الخلفية -->
        <circle cx="50" cy="50" r="46" fill="#0f172a" stroke="${accentColor}55" stroke-width="2" />
        
        <!-- البدلة (الكتفين) -->
        <path d="M 15 95 Q 15 65 50 65 Q 85 65 85 95 Z" fill="${suitColor}" />
        
        <!-- القميص الأبيض -->
        <path d="M 42 65 L 50 85 L 58 65 Z" fill="#e2e8f0" />
        
        <!-- الكرافة -->
        <path d="M 47 65 L 53 65 L 56 80 L 50 95 L 44 80 Z" fill="${tieColor}" />
        
        <!-- الرأس (سيلويت بدون تفاصيل كرتونية) -->
        <circle cx="50" cy="40" r="20" fill="#94a3b8" />
        
        <!-- الشعر (احترافي) -->
        <path d="M 30 35 Q 30 15 50 15 Q 70 15 70 35 Q 60 25 50 25 Q 40 25 30 35 Z" fill="#0f172a" />
    </svg>
    `;
}

// ✅ دوال مساعدة إضافية
function promoteYouth(idx) {
    const yp = G.youthPlayers[idx];
    if (!yp) return;
    if (T[G.my].ps.length >= 25) return alert('الفريق ممتلئ! لا يمكنك ترقية المزيد.');
    
    T[G.my].ps.push(yp);
    G.youthPlayers.splice(idx, 1);
    addNews(`🌱 تمت ترقية ${yp.name} للفريق الأول!`, `⭐ تقييم ${yp.r}`);
    save(); 
    dash();
    if(typeof playSound === 'function') playSound('whistle');
}

function changeManagerName() {
    const newName = prompt("أدخل اسم المدرب الجديد:", G.managerName);
    if (newName && newName.trim().length > 0) {
        G.managerName = newName.trim();
        if (typeof updateLobbySnapshot === 'function') updateLobbySnapshot();
        save();
        dash();
    }
}

// ============================================
// دوال الأخبار والبقية (كما هي)
// ============================================
function newsH(){
  if(!G.news || !G.news.length){
    return `<div class="c news-empty"><div class="news-empty-icon">📭</div><div class="news-empty-text">لا أخبار بعد</div></div>`;
  }
  const categorized = G.news.map((n, idx) => ({...n, cat: categorizeNews(n.text), idx, isNew: idx >= G.news.length-3}));
  const counts = {};
  categorized.forEach(n => {counts[n.cat] = (counts[n.cat]||0)+1;});
  const total = categorized.length;
  const filtered = currentNewsFilter === 'all' ? categorized : categorized.filter(n => n.cat === currentNewsFilter);
  const sorted = [...filtered].reverse();
  const groups = {};
  sorted.forEach(n => { const key = `د${n.day} • ${n.season}`; if(!groups[key]) groups[key] = []; groups[key].push(n); });

  const filtersHTML = `<div class="news-filters">
    <button class="nf-btn ${currentNewsFilter==='all'?'on':''}" onclick="setNewsFilter('all')">📰 الكل <span class="nf-count">${total}</span></button>
    ${Object.entries(NEWS_CATEGORIES).filter(([k]) => counts[k]>0).map(([k,v]) => `<button class="nf-btn ${currentNewsFilter===k?'on':''}" onclick="setNewsFilter('${k}')">${v.icon} ${v.label} <span class="nf-count">${counts[k]}</span></button>`).join('')}
  </div>`;

  const headerHTML = `<div class="news-header">
    <div><div style="font-size:12px;color:#fff;font-weight:900">📰 أخبار الاتحاد</div></div>
    <button class="news-clear-btn" onclick="clearAllNews()">🗑️ مسح</button>
  </div>`;

  const groupsHTML = Object.entries(groups).map(([dayKey, newsList]) => {
    const cardsHTML = newsList.map(n => {
      const cat = NEWS_CATEGORIES[n.cat] || NEWS_CATEGORIES.general;
      const lines = n.text.split('\n');
      return `<div class="news-card ${n.isNew?'new':''}" style="--cat-color:${cat.color};--cat-bg:${cat.bg}">
        <div class="news-card-head">
          <div class="news-cat-icon" style="background:${cat.bg}">${cat.icon}</div>
          <div class="news-cat-label">${cat.label}</div>
          <div class="news-time">🕐 د${n.day}</div>
        </div>
        <div class="news-title">${lines[0]}</div>
        ${lines[1] ? `<div class="news-body">${lines.slice(1).join('\n')}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="news-day-group"><div class="news-day-header"><span>📅 اليوم ${newsList[0].day}</span></div>${cardsHTML}</div>`;
  }).join('');

  return `${headerHTML}${filtersHTML}<div style="max-height:calc(100vh - 280px);overflow-y:auto;padding-bottom:20px">${sorted.length > 0 ? groupsHTML : '<div class="c" style="text-align:center">لا أخبار هنا</div>'}</div>`;
}

function autoFillAction(){ G.lu = autoFillLineup(T[G.my], G.form); autoAssignRoles(); save(); dash(); }
function clearLineupAction(){ const gk = G.lu[0]; G.lu = new Array(11).fill(null); if(gk) G.lu[0] = gk; G.inst = {}; save(); dash(); }
function setF(f){ G.form = f; G.lu = autoFillLineup(T[G.my], f); G.inst = {}; save(); dash(); }
function toggleSound(){ soundEnabled = !soundEnabled; save(); dash(); }

function setTraining(type, val) {
  if(!G.training) G.training = { focus: 'balanced', intensity: 'normal' };
  G.training[type] = val;
  save(); dash();
}

function upgradeFacility(type) {
  if(!G.facilities) G.facilities = {stadium: 1, training: 1, youth: 1};
  const cost = 50 * G.facilities[type];
  if(T[G.my].budget < cost) return alert('ميزانية غير كافية!');
  T[G.my].budget -= cost;
  G.facilities[type]++;
  addNews(`🏗️ تم تطوير ${type === 'stadium' ? 'الملعب' : type === 'training' ? 'مركز التدريب' : 'أكاديمية الشباب'}`, `المستوى الجديد: ${G.facilities[type]}`);
  save(); dash();
}

function startSimulationWithTimer(filterComp) {
  if (window.isSimulating) return;
  
  const nm = getNextUserMatch(filterComp);
  if (!nm) return alert("لا توجد مباراة لمحاكاتها حالياً!");
  
  window.isSimulating = true;
  
  let modal = document.getElementById('sim-modal');
  if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sim-modal';
      modal.className = 'md';
      modal.style.zIndex = 2000;
      modal.innerHTML = `
          <div class="mc mc-warning" style="text-align:center; border:2px solid #fbbf24;">
              <div class="mc-icon" style="font-size:60px; animation:logoBounce 1s infinite alternate;">⚽</div>
              <div class="mc-title" style="color:#fbbf24;">جاري محاكاة المباراة...</div>
              <div style="font-size:11px; color:#94a3b8; margin-bottom:20px;" id="sim-match-teams">جاري الحساب</div>
              
              <div style="font-size:48px; font-weight:900; color:#fff; margin:20px 0; text-shadow:0 0 20px rgba(255,255,255,0.5);" id="sim-timer">60</div>
              
              <div style="height:12px; background:rgba(0,0,0,0.6); border-radius:6px; overflow:hidden; margin-bottom:20px;">
                  <div id="sim-progress" style="width:0%; height:100%; background:linear-gradient(90deg,#fbbf24,#d97706); transition:width 1s linear;"></div>
              </div>
              <div style="font-size:12px; color:#cbd5e1;" id="sim-status">يتم استخراج التقارير...</div>
          </div>
      `;
      document.body.appendChild(modal);
  }
  
  const oppName = T[nm.opp]?.name || AFRICAN.find(a=>a[0]===nm.opp)?.[1] || nm.opp;
  document.getElementById('sim-match-teams').textContent = `${T[G.my].name} ضد ${oppName}`;
  
  modal.hidden = false;
  let timeLeft = 60;
  const timerEl = document.getElementById('sim-timer');
  const progressEl = document.getElementById('sim-progress');
  const statusEl = document.getElementById('sim-status');
  
  timerEl.textContent = timeLeft;
  progressEl.style.width = '0%';
  statusEl.textContent = "جاري تحليل تشكيلة الفريقين...";

  const interval = setInterval(() => {
      timeLeft--;
      timerEl.textContent = timeLeft;
      progressEl.style.width = ((60 - timeLeft) / 60 * 100) + '%';

      if (timeLeft === 40) statusEl.textContent = "جاري محاكاة أحداث المباراة...";
      if (timeLeft === 20) statusEl.textContent = "يتم تسجيل الإحصائيات والأهداف...";
      if (timeLeft === 5) statusEl.textContent = "تجهيز شاشة النتيجة...";

      if (timeLeft <= 0) {
          clearInterval(interval);
          modal.hidden = true;
          window.isSimulating = false;
          
          simulateCurrentRound(filterComp);
      }
  }, 1000);
}

function checkCupNotification(){
  if(!G || !G.season) return;
  const nm = getNextUserMatch();
  if(nm && nm.comp !== 'league' && !nm.cupNotified && daysUntilMatch(nm) <= 0){
    nm.cupNotified = true; save();
    setTimeout(() => showCupNotification(nm), 300);
  }
}

function showCupNotification(nm){
  const oppName = T[nm.opp]?.name || AFRICAN.find(a=>a[0]===nm.opp)?.[1] || nm.opp;
  const postponed = G.season.postponedRounds?.find(p => p.cupRound === nm.round);
  
  let postponeHTML = '';
  if (postponed) {
    postponeHTML = `
      <div style="background:rgba(239,68,68,.15); border:1px solid #ef4444; border-radius:12px; padding:10px; margin:10px 0; text-align:right;">
        <div style="font-size:12px; color:#fca5a5; font-weight:900; margin-bottom:4px;">⚠️ تم تأجيل الجولة ${postponed.leagueRound} من الدوري</div>
        <div style="font-size:10px; color:#cbd5e1;">الكأس له الأولوية. ستُلعب الجولة المؤجلة لاحقاً.</div>
      </div>
    `;
  }

  $('cmc').innerHTML = `<div class="mc mc-warning modal-bg-anim">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    <div class="mc-head">
      <div class="mc-icon" style="font-size:50px; filter:drop-shadow(0 0 20px rgba(251,191,36,.8))">🏆</div>
      <div class="mc-title" style="color:#fbbf24">مباراة كأس مصر!</div>
      <div class="mc-sub">دور ${nm.round}</div>
    </div>
    
    <div style="background:linear-gradient(135deg, rgba(30,41,59,.9), rgba(15,23,42,.9)); border:1px solid rgba(251,191,36,.3); border-radius:16px; padding:15px; margin:10px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="font-size:14px; font-weight:900; color:#fff; flex:1; text-align:center;">${T[G.my].name}</div>
        <div style="font-size:12px; color:#94a3b8; font-weight:900; padding:0 10px;">VS</div>
        <div style="font-size:14px; font-weight:900; color:#fff; flex:1; text-align:center;">${oppName}</div>
      </div>
      <div style="text-align:center; font-size:11px; color:#fbbf24; background:rgba(0,0,0,.4); padding:4px; border-radius:8px;">
        📅 ${dayToDate(nm.day)} • ${nm.home ? '🏟️ على أرضك' : '✈️ خارج أرضك'}
      </div>
    </div>
    
    ${postponeHTML}
    
    <div class="info-box" style="font-size:10px; text-align:center; color:#cbd5e1; margin-top:5px;">
      ⚠️ يرجى التوجه لتبويب البطولات للعب المباراة!
    </div>
    <div class="mc-actions">
      <button class="b g" style="flex:1" onclick="$('cm').hidden=true; switchTab('comp')">⚽ الذهاب للبطولات</button>
    </div>
  </div>`;
  $('cm').hidden = false;
}

function startDrag(e, index, isBench, playerId){
  e.preventDefault();
  const el = e.currentTarget; const rect = el.getBoundingClientRect();
  dragState = { index, isBench, playerId, startX: e.clientX, startY: e.clientY, moved: false, offsetX: e.clientX-rect.left, offsetY: e.clientY-rect.top, clone: el.cloneNode(true) };
  dragState.clone.style.position = 'fixed'; dragState.clone.style.pointerEvents = 'none'; dragState.clone.style.zIndex = 9999;
  dragState.clone.style.width = rect.width+'px'; dragState.clone.style.height = rect.height+'px';
  dragState.clone.style.left = (e.clientX-dragState.offsetX)+'px'; dragState.clone.style.top = (e.clientY-dragState.offsetY)+'px';
  dragState.clone.style.opacity = '0.9'; document.body.appendChild(dragState.clone);
  document.addEventListener('pointermove', moveDrag); document.addEventListener('pointerup', endDrag);
}

function moveDrag(e){
  if(!dragState) return;
  const dx = e.clientX-dragState.startX, dy = e.clientY-dragState.startY;
  if(Math.hypot(dx, dy) > 5) dragState.moved = true;
  dragState.clone.style.left = (e.clientX-dragState.offsetX)+'px'; dragState.clone.style.top = (e.clientY-dragState.offsetY)+'px';
  const slots = getSlots(G.form); const pr = document.getElementById('pitch-wrapper')?.getBoundingClientRect();
  if(!pr) return;
  let md = 60; activeSlotIdx = -1;
  slots.forEach((s, i) => {
    const sx = pr.left+s.y*pr.width; const sy = pr.top+(1-s.x)*pr.height;
    const d = Math.hypot(e.clientX-sx, e.clientY-sy);
    if(d < md){md = d; activeSlotIdx = i;}
  });
  document.querySelectorAll('.p-token').forEach((t, i) => {
    if(i === activeSlotIdx) t.style.boxShadow = '0 0 25px #fbbf24,0 0 40px rgba(251,191,36,.6)';
    else t.style.boxShadow = '0 3px 10px rgba(0,0,0,0.7)';
  });
}

function endDrag(e){
  if(!dragState) return;
  document.removeEventListener('pointermove', moveDrag); document.removeEventListener('pointerup', endDrag);
  dragState.clone.remove();
  if(activeSlotIdx !== -1){
    if(dragState.isBench){ G.lu[activeSlotIdx] = dragState.playerId; if(G.inst) delete G.inst[activeSlotIdx]; } 
    else {
      const tp = G.lu[activeSlotIdx]; G.lu[activeSlotIdx] = dragState.playerId;
      const ti = G.inst ? G.inst[activeSlotIdx] : null;
      if(activeSlotIdx !== dragState.index){ G.lu[dragState.index] = tp; if(G.inst){ if(ti) G.inst[dragState.index] = ti; else delete G.inst[dragState.index]; } }
    }
    save(); dash();
  } else if(!dragState.moved && !dragState.isBench){
    currentInstSlot = dragState.index;
    $('pm-title').innerText = T[G.my].ps.find(x => x.id === dragState.playerId)?.name || 'خيارات';
    $('pm').hidden = false;
  }
  dragState = null; activeSlotIdx = -1;
  document.querySelectorAll('.p-token').forEach(t => { t.style.boxShadow = '0 3px 10px rgba(0,0,0,0.7)'; });
}

function setInst(i){
  if(currentInstSlot === -1) return;
  if(!G.inst) G.inst = {};
  if(i === 'normal') delete G.inst[currentInstSlot]; else G.inst[currentInstSlot] = i;
  $('pm').hidden = true; save(); dash();
}

function removePlayer(){
  if(currentInstSlot === -1) return;
  G.lu[currentInstSlot] = null; if(G.inst) delete G.inst[currentInstSlot];
  $('pm').hidden = true; save(); dash();
}

function showTeamPlayers(tid){
  const team = T[tid]; if(!team) return;
  const st = autoFillLineup(team, team.form);
  
  let h = `<div class="mc mc-info modal-bg-anim" style="padding: 20px 15px;">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    
    <div style="text-align:center; margin-bottom: 15px;">
      <div style="display:flex; justify-content:center; margin-bottom:5px;">
         ${typeof clubBadgeHtml === 'function' ? clubBadgeHtml(tid, team.name, 50) : '<div style="font-size:35px;">🛡️</div>'}
      </div>
      <div style="font-size:18px; font-weight:900; color:#fff;">${team.name}</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:2px;">💰 ${team.budget.toFixed(1)}M • ⭐ ${team.R}</div>
    </div>

    <div style="max-height: 50vh; overflow-y: auto; padding: 0 4px; scrollbar-width: thin; scrollbar-color: #fbbf24 rgba(0,0,0,.2);">`;

  const groups = {GK:[], DEF:[], MID:[], FWD:[]};
  [...team.ps].sort((a,b) => b.r - a.r).forEach(p => { 
    if(groups[p.pos]) groups[p.pos].push(p); 
  });
  
  const groupLabels = {GK:'🧤 حراس المرمى', DEF:'🛡️ خط الدفاع', MID:'🎨 خط الوسط', FWD:'⚔️ خط الهجوم'};

  Object.entries(groups).forEach(([pos, players]) => {
    if(players.length === 0) return;
    
    h += `<div style="font-size:11px; font-weight:900; color:#fbbf24; margin:12px 0 6px; display:flex; align-items:center; gap:6px;">
      <div style="width:3px; height:12px; background:#fbbf24; border-radius:2px;"></div>
      ${groupLabels[pos]}
    </div>`;
    
    players.forEach(p => {
      const isS = st.includes(p.id);
      h += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-bottom:6px; border-right:3px solid ${isS ? '#4ade80' : 'transparent'}; cursor:pointer;" onclick="showCard('${p.id}','${tid}')">
        
        <div style="display:flex; align-items:center; gap:10px;">
            ${typeof playerAvatarHtml === 'function' ? playerAvatarHtml(p, 32) : ''}
            <div style="text-align:right;">
              <div style="font-size:12px; font-weight:bold; color:#fff;">
                ${p.injury ? '🚑 ' : ''}${p.name}
              </div>
              <div style="font-size:10px; color:#94a3b8;">
                ${p.pos} ${isS ? '<span style="color:#4ade80; margin-right:4px;">• أساسي</span>' : ''}
              </div>
            </div>
        </div>

        <div style="width:30px; height:30px; border-radius:50%; background:${isS ? '#4ade80' : '#475569'}; color:#000; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:12px;">
          ${p.r}
        </div>
      </div>`;
    });
  });
  
  h += `</div>
    <div style="margin-top:12px;">
      <button class="b full" onclick="$('cm').hidden=true" style="padding: 10px;">إغلاق</button>
    </div>
  </div>`;
  $('cmc').innerHTML = h; $('cm').hidden = false;
}

function showCard(pid, teamId){
  teamId = teamId || G.my; const team = T[teamId];
  if(!team) return; const p = team.ps.find(x => x.id === pid); if(!p) return;
  const isO = teamId !== G.my; const mo = getMoraleEmoji(p.morale);
  
  $('cmc').innerHTML = `<div class="mc mc-warning modal-bg-anim" style="padding: 20px 15px;">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    
    <div style="background: linear-gradient(160deg, #1e293b, #0f172a); border: 2px solid #fbbf24; border-radius: 20px; padding: 20px 15px; margin-top: 10px; box-shadow: 0 15px 35px rgba(0,0,0,.6); position: relative; overflow: hidden;">
      
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="text-align: right;">
          <div style="font-size:45px; font-weight:900; color:#fbbf24; line-height:1;">${p.r}</div>
          <div style="font-size:12px; font-weight:bold; color:#94a3b8; margin-top: 2px;">${p.pos}</div>
        </div>
        
        <!-- ✅ صورة اللاعب -->
        <div style="width:64px; height:64px;">
            ${typeof playerAvatarHtml === 'function' ? playerAvatarHtml(p, 64, 'border:2px solid #fbbf24;') : '<div style="font-size:30px;">👤</div>'}
        </div>
      </div>
      
      <div style="text-align:center; font-size:20px; font-weight:900; color:#fff; margin-top:10px;">${p.name}</div>
      <div style="text-align:center; font-size:11px; color:#94a3b8; margin-top:2px;">
        ${team.name} • ${p.age} سنة • ${mo}
      </div>
      
      <div style="height: 1px; background: rgba(251,191,36,.3); margin: 12px 0;"></div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.4); padding:8px 12px; border-radius:8px;">
          <span style="font-size:11px; color:#94a3b8;">⚡ سرعة</span>
          <b style="color:#fff; font-size:14px;">${p.pace}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.4); padding:8px 12px; border-radius:8px;">
          <span style="font-size:11px; color:#94a3b8;">🎯 تسديد</span>
          <b style="color:#fff; font-size:14px;">${p.shooting}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.4); padding:8px 12px; border-radius:8px;">
          <span style="font-size:11px; color:#94a3b8;">🎨 تمرير</span>
          <b style="color:#fff; font-size:14px;">${p.passing}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.4); padding:8px 12px; border-radius:8px;">
          <span style="font-size:11px; color:#94a3b8;">🏃 مراوغة</span>
          <b style="color:#fff; font-size:14px;">${p.dribbling}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.4); padding:8px 12px; border-radius:8px;">
          <span style="font-size:11px; color:#94a3b8;">🛡️ دفاع</span>
          <b style="color:#fff; font-size:14px;">${p.defending}</b>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.4); padding:8px 12px; border-radius:8px;">
          <span style="font-size:11px; color:#94a3b8;">💪 بدنية</span>
          <b style="color:#fff; font-size:14px;">${p.physical}</b>
        </div>
      </div>

      <div style="text-align:center; font-size:13px; font-weight:900; color:#fbbf24; background:rgba(251,191,36,.1); padding:10px; border-radius:8px; margin-top:12px;">
        💰 القيمة السوقية: ${p.value}M
      </div>
      
    </div>
    
    <div style="display:flex; gap:10px; margin-top:15px;">
      ${isO ? `<button class="b a full" style="flex:2; padding:12px;" onclick="makeOffer('${p.id}','${teamId}')">💰 عرض شراء</button>` : ''}
      ${!isO && G.multiplayerLeagueId ? `<button class="b" style="background:#8b5cf6; color:#fff; flex:2; padding:12px;" onclick="listPlayerForSale('${p.id}')">📤 عرض للبيع</button>` : ''}
      <button class="b ${isO || G.multiplayerLeagueId ? '':'full'}" style="background:#334155; color:#fff; flex:1; padding:12px;" onclick="$('cm').hidden=true">إغلاق</button>
    </div>
  </div>`;
  $('cm').hidden = false;
}

function makeOffer(pid, tid){
  if(!checkTransferWindow()) return alert('نافذة مغلقة!');
  const team = T[tid]; const p = team.ps.find(x => x.id === pid); if(!p) return;
  const me = T[G.my]; if(me.ps.length >= 25) return alert('ممتلئ!'); if(p.injury) return alert('مصاب!');
  const mm = 1.05; const sug = Math.ceil(p.value*mm);
  const offer = prompt(`القيمة: ${p.value}M\nالسعر المقترح: ${sug}M\nميزانيتك: ${me.budget}M\n\nعرضك:`, sug);
  if(offer === null) return; const on = parseFloat(offer);
  if(isNaN(on) || on <= 0) return alert('قيمة خطأ');
  if(on > me.budget) return alert('ميزانية غير كافية!');
  let th = p.value*mm;
  if(on >= th){
    me.budget -= on; team.budget += on; team.ps = team.ps.filter(x => x.id !== pid); me.ps.push(p);
    addNews(`💰 ${p.name} ينضم لـ ${me.name}!`, `💸 بـ${on}M`);
    alert(`✅ قبلت!`); $('cm').hidden = true; save(); dash();
  } else { alert(`❌ رفض! تطلب ${Math.ceil(th)}M`); }
}

function sellPlayer(pid){
  if(!checkTransferWindow()) return alert('نافذة مغلقة!');
  const me = T[G.my]; const p = me.ps.find(x => x.id === pid); if(!p) return;
  if(me.ps.length <= 14) return alert('تحتاج 14 لاعب!');
  const ask = prompt(`💰 بيع ${p.name}\nالقيمة: ${p.value}M\n\nالسعر:`, p.value);
  if(ask === null) return; const price = parseFloat(ask); if(isNaN(price) || price <= 0) return alert('سعر خطأ');
  me.budget += price; me.ps = me.ps.filter(x => x.id !== pid); G.lu = G.lu.map(id => id === pid ? null : id);
  if(G.lu.includes(null)) G.lu = autoFillLineup(me, G.form);
  addNews(`💰 ${p.name} يغادر ${me.name}!`, `💸 بـ${price}M`);
  alert(`✅ بيع بـ${price}M`); save(); dash();
}

function showSetup(){
  $('bottom-nav').hidden = true; 
  
  if($('hdr-name')) $('hdr-name').textContent = 'إعداد';
  if($('hdr-vip')) $('hdr-vip').textContent = '---';
  if($('hdr-trophies')) $('hdr-trophies').textContent = '---';
  if($('hdr-day')) $('hdr-day').textContent = '1';
  if($('hdr-budget')) $('hdr-budget').textContent = '0.0M';

  const sv = load();
  $('main').innerHTML = `<div class="setup-hero">
    <div class="setup-icon">⚽</div><div class="setup-title">محاكاة اتحاد الكرة</div><div class="setup-sub">v26 • Pro Edition</div>
    
    ${sv ? '<button class="b a" style="margin-bottom:12px;padding:14px;font-size:14px" onclick="cont()">▶ متابعة المسيرة</button>' : ''}
    
    <button class="b" style="margin-bottom:15px; padding:12px; font-size:13px; background:#3b82f6; color:#fff;" onclick="if(typeof showAuthScreen === 'function') showAuthScreen()">☁️ تسجيل الدخول / حفظ سحابي</button>

    <input type="text" id="inp-user" placeholder="اسمك" value="مستخدم" style="margin-bottom:10px">
    <input type="text" id="inp-manager" placeholder="اسم المدرب" value="المدرب" style="margin-bottom:12px">
    <button class="b g" onclick="startNewCareer()" style="padding:14px;font-size:14px">⚽ اختر النادي (مسيرة جديدة)</button>
  </div>`;
}

function startNewCareer(){
  const u = $('inp-user').value.trim(), m = $('inp-manager').value.trim();
  if(!u || !m) return alert('اكتب البيانات!');
  tempUserData.username = u; tempUserData.managerName = m; selTeam();
}

function selTeam(){
  $('main').innerHTML = `<h2 style="text-align:center;color:var(--gold);margin:20px 0;font-size:18px">🌍 اختر الدوري</h2>
    <div class="g2" style="grid-template-columns: 1fr;">
      ${Object.entries(LEAGUES).map(([key, league]) => `
        <div class="team-select-card" onclick="showLeagueTeams('${key}')" style="margin-bottom:10px; padding:20px;">
          <b style="font-size:16px">${league.name}</b>
          <div style="color:var(--gold);font-size:12px;margin-top:4px">اضغط لاختيار فريقك</div>
        </div>
      `).join('')}
    </div>`;
}

function showLeagueTeams(leagueId){
  const league = LEAGUES[leagueId];
  $('main').innerHTML = `
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; margin-top:20px;">
    <button class="b sm" onclick="selTeam()" style="padding:4px 10px; font-size:10px;">⬅ عودة</button>
    <h2 style="color:var(--gold);margin:0;font-size:15px">🏟️ ${league.name}</h2>
  </div>
  <div class="g2">
    ${league.teams.map(t => `
      <div class="team-select-card" onclick="choose('${t[0]}', '${leagueId}')" style="cursor:pointer; position:relative; z-index:10;">
        <div class="bd" style="background:${t[3]};color:${t[4]==='#FFFFFF'?'#000':t[4]}">${t[1][0]}</div>
        <b style="font-size:12px; pointer-events:none;">${t[1]}</b>
        <div style="color:var(--gold);font-size:11px;margin-top:4px; pointer-events:none;">⭐${t[2]}</div>
      </div>
    `).join('')}
  </div>`;
}

function choose(id, leagueId = 'egypt'){
  try {
    if (typeof mk === 'function') mk(leagueId);
    
    if (!T[id]) {
      const league = LEAGUES[leagueId];
      const teamInfo = league ? league.teams.find(x => x[0] === id) : null;
      if (teamInfo) {
        T[id] = {
          id: teamInfo[0], name: teamInfo[1], R: teamInfo[2], 
          c1: teamInfo[3], c2: teamInfo[4],
          budget: 50, ps: [], form: '4-3-3', 
          pl: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0
        };
      } else {
        return alert("خطأ: لم يتم العثور على بيانات هذا الفريق.");
      }
    }

    G = { 
      my: id, league: leagueId, form:'4-3-3', tac:'balanced', tab:'lu', 
      username: tempUserData.username, managerName: tempUserData.managerName, 
      trophies:0, news:[], inst:{}, legendsMarket:[], usedLegends:[], lastLegendRound:0, 
      seasonNumber:1, history:[], trophyCabinet:[], youthPlayers:[], pendingOffer:null, 
      boardObjectives:null, managerXp:0, managerLevel:1, hallOfFame:[], monthlyAwards:[], 
      lastPOTM:0, currentSponsor:null, lossStreak:0, boardAnger:0, captain:null, 
      penaltyTaker:null, freeKickTaker:null, cornerTaker:null,
      training: { focus: 'balanced', intensity: 'normal' },
      facilities: { stadium: 1, training: 1, youth: 1 }
    };

    G.season = generateSeason(id, null); 
    if (typeof setBoardObjectives === 'function') G.boardObjectives = setBoardObjectives(T[id]);
    if (typeof generateYouthPlayer === 'function') G.youthPlayers = [generateYouthPlayer(T[id]), generateYouthPlayer(T[id])];
    
    G.lu = autoFillLineup(T[id], G.form); 
    autoAssignRoles();
    
    addNews(`🏆 يبدأ الموسم ${SEASON_YEAR}/${SEASON_YEAR+1}!`, `👨‍💼 ${G.managerName} يقود ${T[id].name}`);
    
    save(); 
    dash(); 
    setTimeout(() => { if(typeof showSponsorOffers === 'function') showSponsorOffers(); }, 500);

  } catch (error) {
    console.error("Error selecting team:", error);
    alert("حدث خطأ أثناء اختيار الفريق: " + error.message);
  }
}

function migrateSave(){
  Object.values(T).forEach(t => {
    if(t.budget < 0){ t.budget = Math.max(30, t.budget); }
    t.ps.forEach(p => { if(!p.contract) p.contract = {years:2, salary:calcSalary(p.r)}; });
  });
  if(G.captain === undefined) G.captain = null;
  if(!G.training) G.training = { focus: 'balanced', intensity: 'normal' };
  if(!G.facilities) G.facilities = {stadium: 1, training: 1, youth: 1};
}

function cont(){
  const d = load(); if(!d){ location.reload(); return; }
  T = d.T; G = d.G;
  if(!G.news) G.news = []; if(!G.inst) G.inst = []; if(!G.legendsMarket) G.legendsMarket = [];
  if(!G.lu || G.lu.length !== 11) G.lu = autoFillLineup(T[G.my], G.form);
  migrateSave(); autoAssignRoles(); 
  dash();
}

function showLegendCard(pid){
  if(!checkTransferWindow()) return alert('نافذة مغلقة!');
  const p = G.legendsMarket.find(x => x.id === pid);
  if(!p) return;
  const me = T[G.my];
  const can = me.budget >= p.value && me.ps.length < 25;

  $('cmc').innerHTML = `<div class="mc" style="border:2px solid #fbbf24 modal-bg-anim">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    <div class="mc-head">
      <div class="mc-icon">🌟</div>
      <div class="mc-title" style="color:#fbbf24">أسطورة!</div>
      <div class="mc-sub">فرصة نادرة لضم نجم عالمي</div>
    </div>
    
    <div style="background:rgba(239,68,68,.15); border:1px dashed #ef4444; color:#fca5a5; padding:8px; border-radius:10px; font-size:11px; margin-bottom:8px; font-weight:bold;">
      ⏳ عرض محدود! سيختفي هذا اللاعب من السوق مع نهاية اليوم.
    </div>

    <div class="fcard legend" style="margin: 10px auto;">
      <div class="fcard-hd">
        <div style="font-size:12px;color:#fbbf24">🌟 أسطورة</div>
        <div class="fcard-rt">${p.r}</div>
        <div class="fcard-pos">${p.pos}</div>
        <div class="fcard-lv">L${p.lvl}</div>
      </div>
      <div class="fcard-nm">${p.name}</div>
      <div class="fcard-tm">${p.age} سنة</div>
      <div class="fcard-stats">
        <div><span>⚡ سرعة</span><b>${p.pace}</b></div>
        <div><span>🎯 تسديد</span><b>${p.shooting}</b></div>
        <div><span>🎨 تمرير</span><b>${p.passing}</b></div>
        <div><span>🏃 مراوغة</span><b>${p.dribbling}</b></div>
        <div><span>🛡️ دفاع</span><b>${p.defending}</b></div>
        <div><span>💪 بدنية</span><b>${p.physical}</b></div>
      </div>
      <div class="fcard-ft">💰 ${p.value}M</div>
    </div>
    <div style="margin-top:10px;font-size:12px;color:${can?'#4ade80':'#f87171'};font-weight:900">${can?'✅ يمكنك ضمه':'⚠️ لا يمكن (ميزانية غير كافية/الفريق ممتلئ)'}</div>
    <div class="mc-actions">
      <button class="b ${can?'':'full'}" style="background:linear-gradient(180deg,#fbbf24,#d97706);color:#000;opacity:${can?1:.4};padding:12px;font-size:12px" ${can?`onclick="buyLegend('${p.id}')"`:'disabled'}>🌟 شراء بـ ${p.value}M</button>
      <button class="b" style="background:#475569;color:#fff;padding:12px;font-size:12px" onclick="$('cm').hidden=true">إغلاق</button>
    </div>
  </div>`;
  $('cm').hidden = false;
}

function buyLegend(pid){
  if(!checkTransferWindow()) return alert('نافذة مغلقة!');
  const p = G.legendsMarket.find(x => x.id === pid);
  const me = T[G.my];
  if(!p || me.budget < p.value || me.ps.length >= 25) return;
  
  me.budget = Math.round((me.budget - p.value) * 10) / 10;
  me.ps.push(p);
  G.legendsMarket = G.legendsMarket.filter(x => x.id !== pid);
  G.usedLegends.push(pid);
  
  addNews(`🌟🌟 ${p.name} ينضم لـ ${me.name}!`, `💸 صفقة أسطورية بـ${p.value}M • تقييم ${p.r}`);
  alert(`🎉 تم التعاقد مع ${p.name} بنجاح!`);
  $('cm').hidden = true;
  save(); dash();
}

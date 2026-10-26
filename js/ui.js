// ============================================
// ui.js - واجهة المستخدم الكاملة (مع الدوري المباشر)
// ============================================

function switchTab(t) {
  if (!G) return; // ✅ حماية: إذا لم تكن اللعبة جاهزة، لا تفعل شيئاً
  
  // ✅ إيقاف تحديث البث المباشر إذا غادر المستخدم صفحة البطولات
  if (typeof mpCompInterval !== 'undefined' && mpCompInterval && t !== 'comp') {
      clearInterval(mpCompInterval);
      mpCompInterval = null;
  }
  
  G.tab = t; 
  dash();
}

function dash(){
  if(!G || !G.season){showSetup(); return;}
  
  // ✅ حماية إضافية: التأكد من وجود بيانات الفريق
  let t = T[G.my];
  if (!t) {
      // محاولة إصلاح تلقائي إذا كانت البيانات مفقودة
      if (typeof mk === 'function') mk(G.league || 'egypt');
      t = T[G.my] || Object.values(T)[0];
      if (t) G.my = t.id;
      else { showSetup(); return; }
  }
  
  $('bottom-nav').hidden = false;
  
  // ✅ تحديث الملف الشخصي (VIP)
  const lvl = G.managerLevel || 1;
  const vipTier = Math.min(10, Math.floor(lvl / 2)); 
  const vipEmoji = vipTier > 5 ? '👑' : (vipTier > 2 ? '💎' : '⭐');
  
  if($('hdr-name')) $('hdr-name').textContent = G.managerName || 'المدرب';
  if($('hdr-vip')) $('hdr-vip').innerHTML = `${vipEmoji} VIP ${vipTier}`;
  if($('hdr-trophies')) $('hdr-trophies').innerHTML = `🏆 ${G.trophies || 0}`;
  
  // ✅ تحديث شريط الوقت والميزانية
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
// محرك الوقت المبني على الأحداث
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
  if (nm) {
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
      return `<div class="p-token ${isInj?'injured':''}" style="left:${slot.y*100}%; top:${(1-slot.x)*100}%; background:${t.c1}; color:${t.c2==='#FFFFFF'?'#000':t.c2}; border-color:${isInj?'#ef4444':borderC}; border-width:${isCap?'3px':'2px'};" onpointerdown="startDrag(event,${i},false,'${p.id}')">
        ${capBadge}${roleBadge}${ii}
        <div style="font-size:8px;opacity:.85">${slot.pos}</div>
        <div>${p.r}</div>
        <div class="fit-bar"><div style="width:${fit}%;background:${fitColor}"></div></div>
        <div class="p-name-label">${p.name.split(' ')[0]} ${mo} ${fm}</div>
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
      return `<div class="bench-player" onpointerdown="startDrag(event,-1,true,'${p.id}')">
        <div style="width:38px;height:38px;border-radius:50%;background:${p.injury?'#7f1d1d':t.c1};border:2px solid ${p.injury?'#ef4444':fitColor};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:${t.c2==='#FFFFFF'?'#000':t.c2};box-shadow:0 2px 8px rgba(0,0,0,.5);position:relative">
          ${p.injury?'🚑':p.r}
          <div style="position:absolute;bottom:1px;left:3px;right:3px;height:2px;background:rgba(0,0,0,.6);border-radius:1px"><div style="height:100%;width:${fit}%;background:${fitColor};border-radius:1px"></div></div>
        </div>
        <div style="font-size:9px;margin-top:4px;max-width:48px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name.split(' ')[0]}</div>
      </div>`;
    }).join('')}</div></div>`
  ).join('');
  const benchBlock = benchHTML || '<div class="c" style="text-align:center;color:var(--m);font-size:10px;padding:10px">لا بدلاء متاحون</div>';

  const fs = FM_STYLE[G.form] || FM_STYLE['4-3-3'];
  const ts = TAC_STYLE[G.tac] || TAC_STYLE.balanced;

  return `${missionCard}
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

function tbH(){
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

function compH(){
  const t = T[G.my], s = G.season, st = tbl();
  const myPos = st.findIndex(x => x.id === G.my)+1;
  const leagueRound = Object.values(s.leagueFixtures).filter(d => d.played.length >= d.round.length).length;
  const totalRounds = Object.keys(s.leagueFixtures).length;
  const tName = id => { if(!id) return null; return T[id]?.name || AFRICAN.find(a=>a[0]===id)?.[1] || WORLD.find(w=>w[0]===id)?.[1] || (DIV2.includes(id)?id:null) || id; };
  const cupW = s.cupBracket?.winner, clW = s.cafCL?.winner, ccW = s.cafCC?.winner;
  const supW = s.egyptSuper?.winner, cafSupW = s.cafSuper?.winner, cwcW = s.clubWC?.winner;
  const projCL = myPos <= 2 || clW === G.my || ccW === G.my;
  const projCC = !projCL && ((myPos >= 3 && myPos <= 4) || cupW === G.my);
  const projSup = st[0]?.id === G.my || cupW === G.my;
  const projColor = projCL ? '#4ade80' : projCC ? '#60a5fa' : '#f87171';

  // ✅ قسم الدوري المباشر (Multiplayer)
  let multiplayerSection = '';
  if (G.multiplayerLeagueId) {
      multiplayerSection = `<div id="mp-league-container" style="margin-bottom:15px;">
          <div class="c" style="text-align:center; border:2px solid #ef4444; background:rgba(239,68,68,.1); box-shadow:0 0 15px rgba(239,68,68,.2);">
              <div style="color:#ef4444; font-weight:900; margin-bottom:10px; font-size:14px; display:flex; justify-content:center; align-items:center; gap:5px;">
                  <span style="animation: badgeGlow 1s infinite alternate;">🔴</span> الدوري المباشر (أونلاين)
              </div>
              <div id="mp-league-content" style="text-align:right; font-size:12px; color:#94a3b8;">
                  ⏳ جاري تحميل بيانات الدوري...
              </div>
          </div>
      </div>`;
      // استدعاء دالة تحميل البيانات بعد رسم الواجهة
      setTimeout(() => { if(typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData(); }, 100);
  }

  const nextTourn = getNextUserMatch('tournament');
  let tournActionHTML = '';
  if (nextTourn && nextTourn.day === G.season.currentDay) {
      const oppName = T[nextTourn.opp]?.name || AFRICAN.find(a=>a[0]===nextTourn.opp)?.[1] || WORLD.find(w=>w[0]===nextTourn.opp)?.[1] || nextTourn.opp;
      const cn = {cup:'كأس مصر', cafCL:'أبطال أفريقيا', cafCC:'الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم'};
      
      tournActionHTML = `
      <div class="c" style="border:2px solid #fbbf24; background:linear-gradient(135deg,rgba(251,191,36,.2),rgba(15,34,56,.9)); margin-bottom:15px; box-shadow:0 0 20px rgba(251,191,36,.3)">
        <div style="font-size:14px;color:#fbbf24;font-weight:900;margin-bottom:12px;display:flex;align-items:center;gap:8px; justify-content:center;">🏆 مباراتك القادمة في البطولات</div>
        <div style="text-align:center; margin-bottom:15px; background:rgba(0,0,0,.4); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,.1);">
          <div style="font-size:20px;font-weight:900;color:#fff; margin-bottom:5px;">${T[G.my].name} <span style="color:#fbbf24; font-size:16px;">${nextTourn.home?'vs':'@'}</span> ${oppName}</div>
          <div style="font-size:12px;color:#cbd5e1; font-weight:bold;">${cn[nextTourn.comp] || nextTourn.comp} • ${nextTourn.round}</div>
          <div style="font-size:11px;color:#4ade80; margin-top:8px; background:rgba(74,222,128,.1); display:inline-block; padding:4px 10px; border-radius:8px;">📅 ${dayToDate(nextTourn.day)}</div>
        </div>
        
        <div style="display:flex;gap:8px">
           <button class="b g" style="flex:1;padding:14px;font-size:14px" onclick="playTournamentMatch()">▶️ العب المباراة</button>
           <button class="b" style="flex:1;padding:14px;font-size:14px;background:#8b5cf6;color:#fff;border:none" onclick="startSimulationWithTimer('tournament')">⏩ محاكاة المباراة</button>
        </div>
      </div>`;
  } else if (nextTourn) {
      tournActionHTML = `
      <div class="c" style="border:1px solid #475569; background:rgba(15,34,56,.8); margin-bottom:15px;">
        <div style="font-size:12px;color:#94a3b8;font-weight:900;margin-bottom:8px;text-align:center;">⏳ مباراتك القادمة في البطولات</div>
        <div style="text-align:center;font-size:11px; color:#cbd5e1;">
          ${T[G.my].name} ضد ${T[nextTourn.opp]?.name || nextTourn.opp}<br>
          <b style="color:#fbbf24;">يوم ${nextTourn.day}</b> (لم يحن الموعد بعد)
        </div>
      </div>`;
  }

  let h = multiplayerSection + tournActionHTML + `<div class="c"><div class="sec">🌳 خريطة البطولات والتأهل</div>`;
  
  h += `<div onclick="showTournamentDetails('league')" style="cursor:pointer;background:linear-gradient(135deg,rgba(30,58,138,.6),rgba(15,34,56,.9));border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="color:#fbbf24;font-size:11px">🏆 الدوري المصري</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">ج ${leagueRound}/${totalRounds} • مركزك ${myPos} • 👆 التفاصيل</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;line-height:1.6;padding-right:8px;border-right:2px solid rgba(251,191,36,.3)">
      <div>🥇 1-2 ← <b style="color:#4ade80">🌍 أبطال أفريقيا</b></div>
      <div>🥉 3-4 ← <b style="color:#60a5fa">🌍 الكونفدرالية</b></div>
      <div>👑 الفائز ← <b style="color:#fbbf24">⚡ السوبر المصري</b></div>
    </div>
  </div>`;
  
  h += `<div onclick="showTournamentDetails('cup')" style="cursor:pointer;background:linear-gradient(135deg,rgba(30,58,138,.6),rgba(15,34,56,.9));border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="color:#fbbf24;font-size:11px">🥇 كأس مصر</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">${cupW ? '🏆 '+tName(cupW) : '⏳ جارية'} • 👆 التفاصيل</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;line-height:1.6;padding-right:8px;border-right:2px solid rgba(251,191,36,.3)">
      <div>🏆 الفائز ← <b style="color:#60a5fa">🌍 الكونفدرالية</b></div>
      <div>👑 الفائز ← <b style="color:#fbbf24">⚡ السوبر المصري</b></div>
    </div>
  </div>`;
  
  h += `<div style="text-align:center;font-size:10px;color:var(--m);margin:2px 0">↓</div>`;
  
  h += `<div onclick="showTournamentDetails('super')" style="cursor:pointer;background:linear-gradient(135deg,rgba(34,211,238,.15),rgba(15,34,56,.9));border:1px solid rgba(34,211,238,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <b style="color:#22d3ee;font-size:11px">⚡ السوبر المصري</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">${supW ? '🏆 '+tName(supW) : '⏳'} • 👆 التفاصيل</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;margin-top:4px">بطل الدوري × بطل الكأس</div>
  </div>`;
  
  h += `<div style="text-align:center;font-size:10px;color:var(--m);margin:2px 0">↓</div>`;
  
  h += `<div onclick="showTournamentDetails('cafCL')" style="cursor:pointer;background:linear-gradient(135deg,rgba(168,85,247,.2),rgba(15,34,56,.9));border:1px solid rgba(168,85,247,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="color:#a855f7;font-size:11px">🌍 أبطال أفريقيا</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">${clW ? '🏆 '+tName(clW) : s.cafCL ? '⏳ جارية' : '❌ لم تتأهل'} • 👆 التفاصيل</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;line-height:1.6;padding-right:8px;border-right:2px solid rgba(168,85,247,.3)">
      <div>🏆 الفائز ← <b style="color:#fbbf24">⚡ السوبر الأفريقي</b></div>
      <div>🌐 الفائز ← <b style="color:#22d3ee">كأس العالم للأندية</b></div>
    </div>
  </div>`;
  
  h += `<div onclick="showTournamentDetails('cafCC')" style="cursor:pointer;background:linear-gradient(135deg,rgba(96,165,250,.2),rgba(15,34,56,.9));border:1px solid rgba(96,165,250,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="color:#60a5fa;font-size:11px">🌍 كأس الكونفدرالية</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">${ccW ? '🏆 '+tName(ccW) : s.cafCC ? '⏳ جارية' : '❌ لم تتأهل'} • 👆 التفاصيل</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;line-height:1.6;padding-right:8px;border-right:2px solid rgba(96,165,250,.3)">
      <div>🏆 الفائز ← <b style="color:#fbbf24">⚡ السوبر الأفريقي</b></div>
    </div>
  </div>`;
  
  h += `</div>`;

  h += `<div class="c" style="border:2px solid ${projColor}">
    <div class="sec">🎯 لو انتهى الموسم الآن</div>
    <div style="font-size:11px;line-height:1.9">
      <div>🏆 الدوري: <b style="color:${projColor}">المركز ${myPos}</b></div>
      <div>🌍 التأهل القاري: <b style="color:${projColor}">${projCL ? '🌍 دوري أبطال أفريقيا' : projCC ? '🌍 كأس الكونفدرالية' : '❌ لن تتأهل'}</b></div>
      ${projSup ? '<div style="color:#fbbf24">⚡ متأهل للسوبر المصري</div>' : ''}
    </div>
  </div>`;

  if(G.youthPlayers && G.youthPlayers.length){
    h += `<div class="c"><div class="sec">🌱 أكاديمية الشباب</div>`;
    h += G.youthPlayers.map(yp => `<div class="youth-card"><div style="display:flex;justify-content:space-between;align-items:center"><div><b style="font-size:12px;color:#fff">${yp.name}</b><div style="font-size:10px;color:var(--m)">${yp.pos} • ⭐${yp.r} • ${yp.age}س</div></div><button class="b g sm" onclick="promoteYouth()">ترقية</button></div></div>`).join('');
    h += `</div>`;
  }
  return h;
}

function trH(t){
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
        <div style="width:36px;height:36px;border-radius:50%;background:${p.injury?'#7f1d1d':t.c1};border:2px solid ${p.injury?'#ef4444':'var(--gold)'};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:${t.c2==='#FFFFFF'?'#000':t.c2}">${p.r}</div>
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
  const lvl = G.managerLevel || 1;
  const xp = G.managerXp || 0;
  const cur = MGR_LEVELS[lvl-1];
  const nxt = MGR_LEVELS[lvl] || null;
  const need = nxt ? nxt.xp-cur.xp : 1;
  const have = nxt ? xp-cur.xp : 1;
  const pct = nxt ? Math.min(100, Math.round((have/need)*100)) : 100;
  const t = T[G.my];
  const myPos = tbl().findIndex(x => x.id === G.my)+1;
  let totalSal = 0;
  t.ps.forEach(p => totalSal += (p.contract?.salary || 0));

  let h = `<div class="profile-header">
    <div class="profile-avatar">👨‍💼</div>
    <div style="flex:1">
      <h2 style="color:var(--gold);margin:0 0 4px;font-size:18px;">${G.managerName}</h2>
      <div style="font-size:12px;color:#fff">${t.name} • المركز #${myPos}</div>
      <div style="font-size:11px;color:#4ade80">🏆 ${G.trophies||0} بطولة</div>
    </div>
  </div>

  <div class="mgr-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div class="mgr-level-badge">👑 L${lvl} - ${cur.name}</div>
      <div style="font-size:11px;color:#4ade80">${cur.perk}</div>
    </div>
    <div style="font-size:10px;color:var(--m);text-align:right">XP: ${xp} ${nxt?'/ '+nxt.xp:'— أقصى'}</div>
    <div class="xp-bar"><div style="width:${pct}%"></div></div>
  </div>`;

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

  h += `<div class="c"><div class="sec">💰 الاقتصاد</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#fff;margin-bottom:6px"><span>الميزانية:</span><b style="color:${t.budget>=0?'#4ade80':'#f87171'}">${t.budget.toFixed(1)}M</b></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#fff;margin-bottom:6px"><span>رواتب/مباراة:</span><b style="color:#f87171">-${totalSal.toFixed(2)}M</b></div>
  </div>

  <div class="c"><div class="sec">⚙️ إعدادات</div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
      <span>الصوت:</span>
      <button class="b sm ${soundEnabled?'g':'r'}" onclick="toggleSound()">${soundEnabled?'مفعل':'مكتوم'}</button>
    </div>
  </div>`;

  // ✅ إضافة زر الدخول إلى الدوريات الجماعية
  h += `<div class="c" style="margin-top:10px; border:1px solid #8b5cf6; box-shadow:0 0 15px rgba(139,92,246,.3);">
    <div style="font-size:12px; color:#8b5cf6; font-weight:900; margin-bottom:8px; text-align:center;">🌍 اللعب الجماعي</div>
    <button class="b full" style="padding:14px; font-size:13px; background:linear-gradient(135deg, #8b5cf6, #6d28d9); color:#fff; border:none;" onclick="if(typeof showLeaguesPage==='function') showLeaguesPage()">🏆 الدخول إلى الدوريات</button>
  </div>`;
  
  return h;
}

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
      <div style="font-size:35px; margin-bottom:5px;">🛡️</div>
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
        
        <div style="text-align:right;">
          <div style="font-size:12px; font-weight:bold; color:#fff;">
            ${p.injury ? '🚑 ' : ''}${p.name}
          </div>
          <div style="font-size:10px; color:#94a3b8;">
            ${p.pos} ${isS ? '<span style="color:#4ade80; margin-right:4px;">• أساسي</span>' : ''}
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
  
  const maxed = p.lvl >= 10;
  const xpPct = maxed ? 100 : Math.min(100, Math.round(((p.xp || 0) / xpNeeded(p.lvl)) * 100));
  const xpText = maxed ? 'MAX LEVEL' : `${p.xp || 0} / ${xpNeeded(p.lvl)}`;
  
  $('cmc').innerHTML = `<div class="mc mc-warning modal-bg-anim" style="padding: 20px 15px;">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    
    <div style="background: linear-gradient(160deg, #1e293b, #0f172a); border: 2px solid #fbbf24; border-radius: 20px; padding: 20px 15px; margin-top: 10px; box-shadow: 0 15px 35px rgba(0,0,0,.6); position: relative; overflow: hidden;">
      
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="text-align: right;">
          <div style="font-size:45px; font-weight:900; color:#fbbf24; line-height:1;">${p.r}</div>
          <div style="font-size:12px; font-weight:bold; color:#94a3b8; margin-top: 2px;">${p.pos}</div>
        </div>
        <div style="font-size:30px;">👤</div>
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
      <button class="b ${isO?'':'full'}" style="background:#334155; color:#fff; flex:1; padding:12px;" onclick="$('cm').hidden=true">إغلاق</button>
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
    
    <!-- ✅ زر تسجيل الدخول الجديد -->
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
    // 1. تهيئة البيانات
    if (typeof mk === 'function') mk(leagueId);
    
    // 2. حماية: التأكد من وجود بيانات الفريق
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

    // 3. إنشاء حالة اللعبة
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

    // 4. توليد الموسم والبيانات
    G.season = generateSeason(id, null); 
    if (typeof setBoardObjectives === 'function') G.boardObjectives = setBoardObjectives(T[id]);
    if (typeof generateYouthPlayer === 'function') G.youthPlayers = [generateYouthPlayer(T[id]), generateYouthPlayer(T[id])];
    
    // 5. التشكيلة التلقائية
    G.lu = autoFillLineup(T[id], G.form); 
    autoAssignRoles();
    
    // 6. أخبار البداية
    addNews(`🏆 يبدأ الموسم ${SEASON_YEAR}/${SEASON_YEAR+1}!`, `👨‍💼 ${G.managerName} يقود ${T[id].name}`);
    
    // 7. الحفظ والانتقال للوحة التحكم
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

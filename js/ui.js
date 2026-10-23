// ============================================
// ui.js - الشاشات والواجهة (الجزء 1/2)
// ============================================

// ============================================
// الموجه الرئيسي
// ============================================
function switchTab(t){G.tab = t; dash();}

function dash(){
  if(!G || !G.season){showSetup(); return;}
  const t = T[G.my];
  $('bottom-nav').hidden = false;
  $('header-badge').textContent = `يوم ${G.season.currentDay} • ${t.budget.toFixed(1)}M`;

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
// توزيع الأدوار تلقائياً
// ============================================
function autoAssignRoles(){
  const t = T[G.my];
  if(!t) return;
  const starters = G.lu.map(id => t.ps.find(p => p.id === id)).filter(p => p && !p.injury);
  const nonGK = starters.filter(p => p.pos !== 'GK');

  if(!G.captain || !starters.find(p => p.id === G.captain)){
    const bestCap = [...starters].sort((a,b) =>
      (b.r+b.lvl*2+(b.morale||70)*0.15+(b.physical||70)*0.1) -
      (a.r+a.lvl*2+(a.morale||70)*0.15+(a.physical||70)*0.1)
    )[0];
    G.captain = bestCap ? bestCap.id : null;
  }
  if(!G.penaltyTaker || !starters.find(p => p.id === G.penaltyTaker)){
    const bestPen = [...nonGK].sort((a,b) => b.shooting-a.shooting)[0];
    G.penaltyTaker = bestPen ? bestPen.id : null;
  }
  if(!G.freeKickTaker || !starters.find(p => p.id === G.freeKickTaker)){
    const bestFK = [...nonGK].sort((a,b) =>
      (b.shooting*0.6+b.passing*0.4) - (a.shooting*0.6+a.passing*0.4)
    )[0];
    G.freeKickTaker = bestFK ? bestFK.id : null;
  }
  if(!G.cornerTaker || !starters.find(p => p.id === G.cornerTaker)){
    const bestCorner = [...nonGK].sort((a,b) => b.passing-a.passing)[0];
    G.cornerTaker = bestCorner ? bestCorner.id : null;
  }
}

function setRole(role, playerId){
  G[role] = playerId || null;
  save(); dash();
  if(navigator.vibrate) try{navigator.vibrate(20);}catch(e){}
}

function buildRoleSelect(role){
  const t = T[G.my];
  if(!t) return '';
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

// ============================================
// تبويب التشكيلة (الأكبر)
// ============================================
function luH(t){
  if(!G.lu || G.lu.length !== 11) G.lu = autoFillLineup(t, G.form);
  if(!G.inst) G.inst = {};
  const starters = G.lu.map(id => t.ps.find(p => p.id === id)).filter(p => p);
  if(!G.captain || !starters.find(p => p.id === G.captain)) autoAssignRoles();

  const slots = getSlots(G.form);
  const nm = getNextUserMatch();
  const cp = nm && daysUntilMatch(nm) <= 0 && !nm.played;

  const myPower = calcTeamPower(t, G.lu);
  let oppPower = null, oppName = '';
  if(nm){
    oppName = T[nm.opp]?.name || AFRICAN.find(a=>a[0]===nm.opp)?.[1] || WORLD.find(w=>w[0]===nm.opp)?.[1] || nm.opp;
    const oppTeam = T[nm.opp];
    if(oppTeam) oppPower = calcTeamPower(oppTeam);
    else {
      const r = AFRICAN.find(a=>a[0]===nm.opp)?.[2] || WORLD.find(w=>w[0]===nm.opp)?.[2] || 68;
      oppPower = {att:r, mid:r, def:r, overall:r};
    }
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
  const formPills = form.length
    ? form.map(r => `<div class="form-pill ${r}">${r==='W'?'ف':r==='D'?'ت':'خ'}</div>`).join('')
    : '<div class="form-pill none">لا مباريات</div>';

  const warnings = calcWarnings();
  const warningsBar = warnings.length
    ? `<div class="warnings-bar">${warnings.map(w => `<div class="warning-pill" style="color:${w.color}">${w.icon} ${w.text}</div>`).join('')}</div>`
    : '';

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
  const hintsBox = hints.length
    ? `<div class="hints-container"><div class="hints-title">💡 اقتراحات ذكية</div>${hints.map(h => `<div class="hint-item"><span>${h.icon}</span><span style="color:${h.color}">${h.text}</span></div>`).join('')}</div>`
    : '';

  let pb = '';
  if(cp){
    const df = isDerby(G.my, nm.opp) ? '⚔️ ديربي! ' : '';
    pb = `<button class="b g" style="width:100%;margin-bottom:8px;padding:14px;font-size:14px" onclick="play()">${df}▶️ العب المباراة</button>`;
  } else if(nm){
    pb = `<button class="b a" style="width:100%;margin-bottom:8px;padding:12px;font-size:12px" onclick="advanceToNextMatch()">⏭️ تقدّم (${daysUntilMatch(nm)} يوم)</button>`;
  } else {
    pb = `<button class="b" style="width:100%;margin-bottom:8px;padding:12px;font-size:12px;background:#475569;color:#fff" onclick="endSeason()">🏁 انهاء الموسم</button>`;
  }

  let matchCard = '';
  if(nm){
    const cn = {league:'🏆 الدوري', cup:'🥇 كأس مصر', cafCL:'🌍 أبطال أفريقيا', cafCC:'🌍 الكونفدرالية', super:'⚡ السوبر المصري', cafSuper:'⚡ السوبر الأفريقي', clubWC:'🌐 كأس العالم'};
    const df = isDerby(G.my, nm.opp) ? '⚔️ ديربي! ' : '';
    const w = getWeather(nm.day);
    const postponedInfo = G.season.postponedRounds?.find(r => r.cupRound === nm.round && nm.comp === 'cup');
    const postponeBadge = postponedInfo
      ? `<div style="margin-top:6px;padding:5px 8px;background:rgba(239,68,68,.35);border-radius:8px;font-size:9px;color:#fca5a5;border:1px solid #ef4444">⚠️ الجولة ${postponedInfo.leagueRound} مؤجلة إلى ${dayToDate(postponedInfo.newDay)}</div>`
      : '';
    matchCard = `<div class="next-match-card">
      <div style="font-size:11px;color:#fff;margin-bottom:6px">${df}${cn[nm.comp]||nm.comp} • ${nm.round}</div>
      <div style="font-size:16px;font-weight:900;color:#fff">${t.name} ${nm.home?'vs':'@'} ${oppName}</div>
      <div class="day-badge">📅 ${dayToDate(nm.day)} • ${w.emoji} ${w.type}</div>
      ${postponeBadge}
    </div>`;
  }

  const roleCards = `<div class="sec">👑 الأدوار الخاصة</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
      <div class="role-card ${G.captain?'active':''}"><div class="role-label">👑 الكابتن</div><select class="role-select" onchange="setRole('captain', this.value)">${buildRoleSelect('captain')}</select></div>
      <div class="role-card ${G.penaltyTaker?'active':''}"><div class="role-label">🥅 مسدد الجزاءات</div><select class="role-select" onchange="setRole('penaltyTaker', this.value)">${buildRoleSelect('penaltyTaker')}</select></div>
      <div class="role-card ${G.freeKickTaker?'active':''}"><div class="role-label">🎯 مسدد الحرات</div><select class="role-select" onchange="setRole('freeKickTaker', this.value)">${buildRoleSelect('freeKickTaker')}</select></div>
      <div class="role-card ${G.cornerTaker?'active':''}"><div class="role-label">🚩 مسدد الركنيات</div><select class="role-select" onchange="setRole('cornerTaker', this.value)">${buildRoleSelect('cornerTaker')}</select></div>
    </div>
    <div class="info-box">📖 <b>تأثيرات:</b> الكابتن +8% فريق • الجزاء +30% دقة • الحرة +35% تصويب • الركنية +20% عرضية</div>`;

  // ملعب التشكيلة
  const pitch = `<div class="pitch-wrapper" id="pitch-wrapper">
    <div class="pitch-lines"><div class="penalty-box-top"></div><div class="penalty-box-bot"></div></div>
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

  return `${matchCard}
    <div class="c" style="text-align:center;padding:8px">
      <div style="font-size:9px;color:var(--m);margin-bottom:4px">📈 آخر 5 مباريات</div>
      <div class="form-pills">${formPills}</div>
    </div>
    ${powerCard}${warningsBar}${previewCard}${pb}${quickActions}${hintsBox}

    <div class="sec">📐 الخطة (${Object.keys(FM).length} خيار)</div>
    <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
      ${Object.keys(FM).map(f => `<div class="chip ${G.form===f?'on':''}" style="padding:6px 8px;font-size:10px;flex:0 0 auto" onclick="setF('${f}')">${f}</div>`).join('')}
    </div>
    <div class="info-box">📖 <b>${G.form}:</b> ${fs.desc} • ⚔️×${fs.att.toFixed(2)} 🛡️×${fs.def.toFixed(2)}</div>

    <div class="sec">🎯 التكتيك (${Object.keys(TAC_STYLE).length} خيار)</div>
    <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
      ${Object.entries(TAC_STYLE).map(([k,v]) => `<div class="chip ${G.tac===k?'on':''}" style="padding:6px 8px;font-size:10px;flex:0 0 auto" onclick="G.tac='${k}';save();dash()">${v.label}</div>`).join('')}
    </div>
    <div class="info-box">📖 <b>${ts.label}:</b> ${ts.desc} • ⚔️×${ts.att.toFixed(2)} 🛡️×${ts.def.toFixed(2)} • استنزاف ×${ts.staminaDrain.toFixed(2)}</div>

    <div class="sec">⚽ الكرات الثابتة</div>
    <div style="font-size:10px;color:var(--m);margin-bottom:4px">الركنيات:</div>
    <div class="sp-row">
      ${[['short','قصيرة'],['cross','عرضية'],['long','طويلة']].map(([k,l]) => {
        const cur = G.setPieces?.corner || 'cross';
        return `<div class="sp-opt ${cur===k?'on':''}" onclick="setCornerTactic('${k}')">${l}</div>`;
      }).join('')}
    </div>
    <div style="font-size:10px;color:var(--m);margin-bottom:4px;margin-top:6px">الركلات الحرة:</div>
    <div class="sp-row">
      ${[['direct','تسديدة'],['cross','عرضية']].map(([k,l]) => {
        const cur = G.setPieces?.freeKick || 'direct';
        return `<div class="sp-opt ${cur===k?'on':''}" onclick="setFreeKickTactic('${k}')">${l}</div>`;
      }).join('')}
    </div>

    ${roleCards}
    ${pitch}
    <div style="font-size:9px;color:var(--m);text-align:center;margin-bottom:6px">🟢 مركزه • 🟡 ثانوي • 🔴 خارج مركزه • شريط سفلي = لياقة</div>
    ${instSummary}
    <div class="sec">🔄 البدلاء</div>
    ${benchBlock}`;
}

// ============================================
// تبويب الترتيب
// ============================================
function tbH(){
  return `<div class="c" style="padding:6px">
    <div style="font-size:10px;color:var(--m);text-align:center;margin-bottom:6px">اضغط فريق لعرض لاعبيه</div>
    <table>
      <tr><th>#</th><th style="text-align:right">الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>ن</th></tr>
      ${tbl().map((t,i) => `<tr class="${t.id===G.my?'me':''} ${t.id!==G.my?'clickable':''}" ${t.id!==G.my?`onclick="showTeamPlayers('${t.id}')"`:''}>
        <td>${i+1}</td>
        <td style="text-align:right;font-weight:600">${t.name}${t.id!==G.my?' 👥':''}</td>
        <td>${t.pl}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
        <td>${t.gf-t.ga}</td>
        <td style="color:var(--gold);font-weight:900">${t.pts}</td>
      </tr>`).join('')}
    </table>
  </div>`;
}

// ============================================
// تبويب البطولات (خريطة التأهل)
// ============================================
function compH(){
  const t = T[G.my], s = G.season, st = tbl();
  const myPos = st.findIndex(x => x.id === G.my)+1;
  const leagueRound = Object.values(s.leagueFixtures).filter(d => d.played.length >= d.round.length).length;
  const totalRounds = Object.keys(s.leagueFixtures).length;
  const tName = id => {
    if(!id) return null;
    return T[id]?.name || AFRICAN.find(a=>a[0]===id)?.[1] || WORLD.find(w=>w[0]===id)?.[1] || (DIV2.includes(id)?id:null) || id;
  };
  const cupW = s.cupBracket?.winner, clW = s.cafCL?.winner, ccW = s.cafCC?.winner;
  const supW = s.egyptSuper?.winner, cafSupW = s.cafSuper?.winner, cwcW = s.clubWC?.winner;
  const projCL = myPos <= 2 || clW === G.my || ccW === G.my;
  const projCC = !projCL && ((myPos >= 3 && myPos <= 4) || cupW === G.my);
  const projSup = st[0]?.id === G.my || cupW === G.my;
  const projColor = projCL ? '#4ade80' : projCC ? '#60a5fa' : '#f87171';

  let h = `<div class="c"><div class="sec">🌳 خريطة البطولات والتأهل</div>`;

  h += `<div style="background:linear-gradient(135deg,rgba(30,58,138,.6),rgba(15,34,56,.9));border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="color:#fbbf24;font-size:11px">🏆 الدوري المصري</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">ج ${leagueRound}/${totalRounds} • مركزك ${myPos}</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;line-height:1.6;padding-right:8px;border-right:2px solid rgba(251,191,36,.3)">
      <div>🥇 1-2 ← <b style="color:#4ade80">🌍 أبطال أفريقيا</b></div>
      <div>🥉 3-4 ← <b style="color:#60a5fa">🌍 الكونفدرالية</b></div>
      <div>👑 الفائز ← <b style="color:#fbbf24">⚡ السوبر المصري</b></div>
    </div>
  </div>`;

  h += `<div style="background:linear-gradient(135deg,rgba(30,58,138,.6),rgba(15,34,56,.9));border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="color:#fbbf24;font-size:11px">🥇 كأس مصر</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">${cupW ? '🏆 '+tName(cupW) : '⏳ جارية'}</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;line-height:1.6;padding-right:8px;border-right:2px solid rgba(251,191,36,.3)">
      <div>🏆 الفائز ← <b style="color:#60a5fa">🌍 الكونفدرالية</b></div>
      <div>👑 الفائز ← <b style="color:#fbbf24">⚡ السوبر المصري</b></div>
    </div>
  </div>`;

  h += `<div style="text-align:center;font-size:10px;color:var(--m);margin:2px 0">↓</div>`;

  h += `<div style="background:linear-gradient(135deg,rgba(34,211,238,.15),rgba(15,34,56,.9));border:1px solid rgba(34,211,238,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <b style="color:#22d3ee;font-size:11px">⚡ السوبر المصري</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">${supW ? '🏆 '+tName(supW) : '⏳'}</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;margin-top:4px">بطل الدوري × بطل الكأس</div>
  </div>`;

  h += `<div style="text-align:center;font-size:10px;color:var(--m);margin:2px 0">↓</div>`;

  h += `<div style="background:linear-gradient(135deg,rgba(168,85,247,.2),rgba(15,34,56,.9));border:1px solid rgba(168,85,247,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="color:#a855f7;font-size:11px">🌍 أبطال أفريقيا</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">${clW ? '🏆 '+tName(clW) : s.cafCL ? '⏳ جارية' : '❌ لم تتأهل'}</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;line-height:1.6;padding-right:8px;border-right:2px solid rgba(168,85,247,.3)">
      <div>🏆 الفائز ← <b style="color:#fbbf24">⚡ السوبر الأفريقي</b></div>
      <div>🌐 الفائز ← <b style="color:#22d3ee">كأس العالم للأندية</b></div>
      <div>🔄 الفائز ← <b style="color:#4ade80">دوري الأبطال (تلقائي)</b></div>
    </div>
  </div>`;

  h += `<div style="background:linear-gradient(135deg,rgba(96,165,250,.2),rgba(15,34,56,.9));border:1px solid rgba(96,165,250,.4);border-radius:10px;padding:8px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <b style="color:#60a5fa;font-size:11px">🌍 كأس الكونفدرالية</b>
      <span style="font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:2px 6px;border-radius:6px">${ccW ? '🏆 '+tName(ccW) : s.cafCC ? '⏳ جارية' : '❌ لم تتأهل'}</span>
    </div>
    <div style="font-size:9px;color:#e5e7eb;line-height:1.6;padding-right:8px;border-right:2px solid rgba(96,165,250,.3)">
      <div>🏆 الفائز ← <b style="color:#fbbf24">⚡ السوبر الأفريقي</b></div>
      <div>🔄 الفائز ← <b style="color:#4ade80">دوري الأبطال (تلقائي)</b></div>
    </div>
  </div>`;

  h += `<div style="text-align:center;font-size:10px;color:var(--m);margin:2px 0">↓</div>`;

  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
    <div style="background:linear-gradient(135deg,rgba(251,191,36,.2),rgba(15,34,56,.9));border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:8px">
      <b style="color:#fbbf24;font-size:10px">⚡ السوبر الأفريقي</b>
      <div style="font-size:8px;color:#e5e7eb;margin-top:3px">الأبطال × الكونفدرالية</div>
      ${cafSupW ? `<div style="font-size:9px;color:#4ade80;margin-top:3px">🏆 ${tName(cafSupW)}</div>` : ''}
    </div>
    <div style="background:linear-gradient(135deg,rgba(34,211,238,.2),rgba(15,34,56,.9));border:1px solid rgba(34,211,238,.4);border-radius:10px;padding:8px">
      <b style="color:#22d3ee;font-size:10px">🌐 كأس العالم</b>
      <div style="font-size:8px;color:#e5e7eb;margin-top:3px">بطل أفريقيا × أبطال العالم</div>
      ${cwcW ? `<div style="font-size:9px;color:#4ade80;margin-top:3px">🏆 ${tName(cwcW)}</div>` : ''}
    </div>
  </div>`;
  h += `</div>`;

  const projText = projCL ? '🌍 دوري أبطال أفريقيا' : projCC ? '🌍 كأس الكونفدرالية' : '❌ لن تتأهل قارياً';
  h += `<div class="c" style="border:2px solid ${projColor}">
    <div class="sec">🎯 لو انتهى الموسم الآن</div>
    <div style="font-size:11px;line-height:1.9">
      <div>🏆 الدوري: <b style="color:${projColor}">المركز ${myPos}</b></div>
      <div>🌍 التأهل القاري: <b style="color:${projColor}">${projText}</b></div>
      ${projSup ? '<div style="color:#fbbf24">⚡ متأهل للسوبر المصري</div>' : ''}
    </div>
  </div>`;

  if(G.youthPlayers && G.youthPlayers.length){
    h += `<div class="c"><div class="sec">🌱 أكاديمية الشباب</div>`;
    h += G.youthPlayers.map(yp =>
      `<div class="youth-card"><div style="display:flex;justify-content:space-between;align-items:center">
        <div><b style="font-size:12px;color:#fff">${yp.name}</b>
        <div style="font-size:10px;color:var(--m)">${yp.pos} • ⭐${yp.r} • ${yp.age}س</div></div>
        <button class="b g sm" onclick="promoteYouth()">ترقية</button>
      </div></div>`
    ).join('');
    h += `</div>`;
  }

  return h;
}

// ============================================
// تبويب الفريق
// ============================================
function crH(t){
  let h = `<div class="c" style="text-align:center;padding:10px;background:linear-gradient(135deg,rgba(15,34,56,.9),rgba(30,58,138,.5))">
    <div style="font-size:10px;color:var(--m)">الفريق</div>
    <div style="font-size:12px;margin-top:4px;font-weight:900">${t.ps.length} لاعب • مستوى ${teamLvl(t)}</div>
  </div>
  <div class="g2">`;

  h += [...t.ps].sort((a,b) => b.r-a.r || b.lvl-a.lvl).map(p => {
    const mo = getMoraleEmoji(p.morale);
    const fm = getFormEmoji(p);
    const inj = p.injury ? '🚑 ' : '';
    const conYrs = p.contract?.years || 0;
    const conColor = conYrs<=0 ? '#f87171' : conYrs===1 ? '#fbbf24' : '#4ade80';
    let roleIcon = '';
    if(G.captain === p.id) roleIcon += '👑';
    if(G.penaltyTaker === p.id) roleIcon += '🥅';
    if(G.freeKickTaker === p.id) roleIcon += '🎯';
    if(G.cornerTaker === p.id) roleIcon += '🚩';
    return `<div class="c" style="padding:8px;cursor:pointer;margin-bottom:4px;${p.injury?'border-color:#ef4444':''}${conYrs<=0?'border-color:#f87171':''}" onclick="showCard('${p.id}')">
      <div style="display:flex;gap:6px;align-items:center">
        <div style="width:36px;height:36px;border-radius:50%;background:${p.injury?'#7f1d1d':t.c1};border:2px solid ${p.injury?'#ef4444':'var(--gold)'};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:${t.c2==='#FFFFFF'?'#000':t.c2};box-shadow:0 2px 8px rgba(0,0,0,.4)">${p.r}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inj}${p.name} ${mo} ${fm} ${roleIcon?'<span style="font-size:9px">'+roleIcon+'</span>':''}</div>
          <div style="font-size:9px;color:var(--m)">${p.pos} • L${p.lvl} • ${p.age}س • ⚽${p.goals||0} • <span style="color:${conColor}">📋${conYrs}</span></div>
        </div>
      </div>
    </div>`;
  }).join('');

  h += '</div>';
  return h;
}

// ============================================
// تبويب الملف الشخصي للمدرب
// ============================================
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
      <h2 style="color:var(--gold);margin:0 0 4px;font-size:18px;text-shadow:0 2px 6px rgba(0,0,0,.8)">${G.managerName}</h2>
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
  </div>

  <div class="c"><div class="sec">💰 الاقتصاد</div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#fff;margin-bottom:6px"><span>الميزانية:</span><b style="color:${t.budget>=0?'#4ade80':'#f87171'}">${t.budget.toFixed(1)}M</b></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#fff;margin-bottom:6px"><span>رواتب/مباراة:</span><b style="color:#f87171">-${totalSal.toFixed(2)}M</b></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#fff"><span>دخل/مباراة:</span><b style="color:#4ade80">+${(G.currentSponsor?G.currentSponsor.safe/20:0).toFixed(2)}M</b></div>
  </div>

  <div class="board-card">
    <div style="font-size:12px;color:var(--gold);font-weight:900;margin-bottom:6px">🎯 أهداف الإدارة</div>
    ${G.boardObjectives.map(o => `<div class="board-item"><span>${o.desc}</span><span style="color:#4ade80;font-weight:900">+${o.reward}M</span></div>`).join('')}
  </div>

  <div class="c"><div class="sec">⚙️ إعدادات</div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
      <span>الصوت:</span>
      <button class="b sm ${soundEnabled?'g':'r'}" onclick="toggleSound()">${soundEnabled?'مفعل':'مكتوم'}</button>
    </div>
  </div>`;

  if(G.currentSponsor){
    h += `<div class="c" style="border:1px solid #60a5fa"><div class="sec">💼 الراعي الحالي</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><b style="font-size:13px">${G.currentSponsor.logo} ${G.currentSponsor.name}</b>
        <div style="font-size:10px;color:var(--m)">${G.currentSponsor.bonus||'عرض آمن'}</div></div>
        <div style="color:#4ade80;font-size:14px;font-weight:900">${G.currentSponsor.safe}M</div>
      </div>
    </div>`;
  }

  if(G.hallOfFame && G.hallOfFame.length > 0){
    h += `<div class="c"><div class="sec">🏛️ قاعة المشاهير</div>`;
    G.hallOfFame.slice().reverse().forEach(p => {
      h += `<div class="hof-card"><div class="hof-icon">🏆</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:900;color:#fff">${p.name}</div>
          <div style="font-size:10px;color:var(--m)">${p.pos} • ⭐${p.r} • L${p.lvl}</div>
          <div style="font-size:9px;color:var(--gold)">⚽ ${p.goals} • موسم ${p.season}</div>
        </div>
      </div>`;
    });
    h += `</div>`;
  }
  return h;
}

// ============================================
// تبويب الأخبار
// ============================================
function newsH(){
  if(!G.news || !G.news.length){
    return `<div class="c news-empty"><div class="news-empty-icon">📭</div>
      <div class="news-empty-text">لا أخبار بعد</div>
      <div class="news-empty-sub">ستظهر هنا كل أحداث الفريق والموسم</div>
    </div>`;
  }

  const categorized = G.news.map((n, idx) => ({
    ...n,
    cat: categorizeNews(n.text),
    idx,
    isNew: idx >= G.news.length-3
  }));

  const counts = {};
  categorized.forEach(n => {counts[n.cat] = (counts[n.cat]||0)+1;});
  const total = categorized.length;

  const filtered = currentNewsFilter === 'all' ? categorized : categorized.filter(n => n.cat === currentNewsFilter);
  const sorted = [...filtered].reverse();
  const groups = {};
  sorted.forEach(n => {
    const key = `د${n.day} • ${n.season}`;
    if(!groups[key]) groups[key] = [];
    groups[key].push(n);
  });

  const filtersHTML = `<div class="news-filters">
    <button class="nf-btn ${currentNewsFilter==='all'?'on':''}" onclick="setNewsFilter('all')">📰 الكل <span class="nf-count">${total}</span></button>
    ${Object.entries(NEWS_CATEGORIES).filter(([k]) => counts[k]>0).map(([k,v]) =>
      `<button class="nf-btn ${currentNewsFilter===k?'on':''}" onclick="setNewsFilter('${k}')">${v.icon} ${v.label} <span class="nf-count">${counts[k]}</span></button>`
    ).join('')}
  </div>`;

  const headerHTML = `<div class="news-header">
    <div><div style="font-size:12px;color:#fff;font-weight:900">📰 أخبار الاتحاد</div>
    <div class="news-header-stats"><span>📊 <b>${total}</b> خبر</span><span>📅 <b>${Object.keys(groups).length}</b> يوم</span></div></div>
    <button class="news-clear-btn" onclick="clearAllNews()">🗑️ مسح</button>
  </div>`;

  const groupsHTML = Object.entries(groups).map(([dayKey, newsList]) => {
    const dayNum = newsList[0].day;
    const seasonYear = newsList[0].season;
    const cardsHTML = newsList.map(n => {
      const cat = NEWS_CATEGORIES[n.cat] || NEWS_CATEGORIES.general;
      const lines = n.text.split('\n');
      const title = lines[0] || '';
      const body = lines.slice(1).join('\n') || '';
      return `<div class="news-card ${n.isNew?'new':''}" style="--cat-color:${cat.color};--cat-bg:${cat.bg}">
        <div class="news-card-head">
          <div class="news-cat-icon" style="background:${cat.bg}">${cat.icon}</div>
          <div class="news-cat-label">${cat.label}</div>
          <div class="news-time">🕐 د${n.day}</div>
        </div>
        <div class="news-title">${title.replace(/^\[.*?\]\s*/, '')}</div>
        ${body ? `<div class="news-body">${body}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="news-day-group">
      <div class="news-day-header"><span>📅 اليوم ${dayNum}</span><span>${seasonYear}</span></div>
      ${cardsHTML}
    </div>`;
  }).join('');

  const emptyFilter = `<div class="c news-empty"><div class="news-empty-icon">🔍</div>
    <div class="news-empty-text">لا أخبار في هذه الفئة</div>
    <div class="news-empty-sub">جرّب فئة أخرى</div>
  </div>`;

  return `${headerHTML}${filtersHTML}
    <div style="max-height:calc(100vh - 280px);overflow-y:auto;padding-bottom:20px">
      ${sorted.length > 0 ? groupsHTML : emptyFilter}
    </div>`;
}

// ============================================
// أدوات تحكم سريعة
// ============================================
function autoFillAction(){
  G.lu = autoFillLineup(T[G.my], G.form);
  autoAssignRoles();
  save(); dash();
  if(navigator.vibrate) try{navigator.vibrate(30);}catch(e){}
}

function clearLineupAction(){
  const gk = G.lu[0];
  G.lu = new Array(11).fill(null);
  if(gk) G.lu[0] = gk;
  G.inst = {};
  save(); dash();
}

function setF(f){
  G.form = f;
  G.lu = autoFillLineup(T[G.my], f);
  G.inst = {};
  save(); dash();
}

function setCornerTactic(st){
  if(!G.setPieces) G.setPieces = {};
  G.setPieces.corner = st;
  save(); dash();
}

function setFreeKickTactic(st){
  if(!G.setPieces) G.setPieces = {};
  G.setPieces.freeKick = st;
  save(); dash();
}

function toggleSound(){
  soundEnabled = !soundEnabled;
  save(); dash();
}

// ============================================
// التنقل للمباراة القادمة + التنبيه
// ============================================
function advanceToNextMatch(){
  const nm = getNextUserMatch();
  if(!nm) return;
  advanceToDay(nm.day);
  // للكأس: التنبيه الخاص يظهر تلقائياً عبر dash → checkCupNotification
  if(nm.comp !== 'cup' && (nm.comp !== 'league' || isDerby(G.my, nm.opp))){
    const ds = G.season.currentDay-(G.lastPressDay||0);
    if(ds >= 5){
      G.lastPressDay = G.season.currentDay;
      setTimeout(() => showPressConference(nm), 600);
    }
  }
  dash();
}

function showCupNotification(nm){
  const oppName = T[nm.opp]?.name
    || AFRICAN.find(a=>a[0]===nm.opp)?.[1]
    || WORLD.find(w=>w[0]===nm.opp)?.[1]
    || nm.opp || 'الفريق المنافس';

  const compLabels = {cup:'كأس مصر', cafCL:'دوري أبطال أفريقيا', cafCC:'كأس الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم للأندية'};
  const roundLabels = {R32:'دور الـ32', R16:'دور الـ16', QF:'ربع النهائي', SF:'نصف النهائي', F:'النهائي', S:'السوبر'};
  const compLabel = compLabels[nm.comp] || nm.comp;
  const roundLabel = roundLabels[nm.round] || nm.round;
  const icon = nm.comp === 'cup' ? '🏆' : (String(nm.comp).includes('caf') ? '🌍' : '⚡');
  const isKnockout = ['cup','cafCL','cafCC','super','cafSuper','clubWC'].includes(nm.comp);
  const postponed = G.season.postponedRounds?.find(p => p.cupRound === nm.round);

  let html = `<div class="mc mc-warning">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    <div class="mc-head">
      <div class="mc-icon">${icon}</div>
      <div class="mc-title">مباراة ${compLabel}!</div>
      <div class="mc-sub">${roundLabel}</div>
    </div>
    <div style="padding:14px;background:rgba(0,0,0,.35);border-radius:12px;margin:8px 0;text-align:center">
      <div style="font-size:14px;color:#fff;margin-bottom:8px"><b>${T[G.my].name}</b> 🆚 <b>${oppName}</b></div>
      <div style="font-size:12px;color:#fbbf24">📅 ${dayToDate(nm.day)}</div>
      <div style="font-size:11px;color:#e5e7eb;margin-top:6px">${nm.home ? '🏟️ على أرضك' : '✈️ خارج أرضك'}</div>
    </div>`;

  if(postponed){
    html += `<div style="padding:12px;background:rgba(239,68,68,.2);border:2px solid #ef4444;border-radius:12px;margin:8px 0;text-align:right">
      <div style="font-size:12px;color:#fca5a5;font-weight:900;margin-bottom:6px">⚠️ تم تأجيل الجولة ${postponed.leagueRound} من الدوري</div>
      <div style="font-size:10px;color:#e5e7eb">📅 من <b>${dayToDate(postponed.previousDay)}</b> إلى <b>${dayToDate(postponed.newDay)}</b></div>
      <div style="font-size:9px;color:#fbbf24;margin-top:4px">(الكأس له الأولوية على الدوري)</div>
    </div>`;
  }

  if(isKnockout){
    html += `<div class="info-box" style="font-size:10px;text-align:right">🎯 <b>مباراة إقصائية:</b> لا تعادل — ركلات الترجيح تحسم الفائز!</div>`;
  }

  html += `<div class="mc-actions"><button class="b full" onclick="$('cm').hidden=true">✅ فهمت - إلى المباراة</button></div></div>`;

  $('cmc').innerHTML = html;
  $('cm').hidden = false;
}

function checkCupNotification(){
  if(!G || !G.season) return;
  const nm = getNextUserMatch();
  if(nm && nm.comp !== 'league' && !nm.cupNotified && daysUntilMatch(nm) <= 0){
    nm.cupNotified = true;
    save();
    setTimeout(() => showCupNotification(nm), 300);
  }
}
// ============================================
// ui.js - الجزء 2/2: السحب + البطاقات + الإعداد
// ============================================

// ============================================
// سحب اللاعبين (Drag & Drop)
// ============================================
function startDrag(e, index, isBench, playerId){
  e.preventDefault();
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  dragState = {
    index, isBench, playerId,
    startX: e.clientX, startY: e.clientY,
    moved: false,
    offsetX: e.clientX-rect.left,
    offsetY: e.clientY-rect.top,
    clone: el.cloneNode(true)
  };
  dragState.clone.style.position = 'fixed';
  dragState.clone.style.pointerEvents = 'none';
  dragState.clone.style.zIndex = 9999;
  dragState.clone.style.width = rect.width+'px';
  dragState.clone.style.height = rect.height+'px';
  dragState.clone.style.left = (e.clientX-dragState.offsetX)+'px';
  dragState.clone.style.top = (e.clientY-dragState.offsetY)+'px';
  dragState.clone.style.opacity = '0.9';
  document.body.appendChild(dragState.clone);
  document.addEventListener('pointermove', moveDrag);
  document.addEventListener('pointerup', endDrag);
}

function moveDrag(e){
  if(!dragState) return;
  const dx = e.clientX-dragState.startX, dy = e.clientY-dragState.startY;
  if(Math.hypot(dx, dy) > 5) dragState.moved = true;
  dragState.clone.style.left = (e.clientX-dragState.offsetX)+'px';
  dragState.clone.style.top = (e.clientY-dragState.offsetY)+'px';

  const slots = getSlots(G.form);
  const pr = document.getElementById('pitch-wrapper')?.getBoundingClientRect();
  if(!pr) return;
  let md = 60;
  activeSlotIdx = -1;
  slots.forEach((s, i) => {
    const sx = pr.left+s.y*pr.width;
    const sy = pr.top+(1-s.x)*pr.height;
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
  document.removeEventListener('pointermove', moveDrag);
  document.removeEventListener('pointerup', endDrag);
  dragState.clone.remove();

  if(activeSlotIdx !== -1){
    if(dragState.isBench){
      G.lu[activeSlotIdx] = dragState.playerId;
      if(G.inst) delete G.inst[activeSlotIdx];
    } else {
      const tp = G.lu[activeSlotIdx];
      G.lu[activeSlotIdx] = dragState.playerId;
      const ti = G.inst ? G.inst[activeSlotIdx] : null;
      if(activeSlotIdx !== dragState.index){
        G.lu[dragState.index] = tp;
        if(G.inst){
          if(ti) G.inst[dragState.index] = ti;
          else delete G.inst[dragState.index];
        }
      }
    }
    save(); dash();
  } else if(!dragState.moved && !dragState.isBench){
    currentInstSlot = dragState.index;
    const pl = T[G.my].ps.find(x => x.id === dragState.playerId);
    $('pm-title').innerText = pl ? pl.name : 'خيارات';
    const ci = G.inst && G.inst[currentInstSlot] ? G.inst[currentInstSlot] : 'normal';
    ['normal','attack','defense','counter','press','stayback'].forEach(k => {
      const el = $('btn-inst-'+k);
      if(el) el.style.opacity = ci===k ? '1' : '0.55';
    });
    $('pm').hidden = false;
  }
  dragState = null;
  activeSlotIdx = -1;
  document.querySelectorAll('.p-token').forEach(t => {
    t.style.boxShadow = '0 3px 10px rgba(0,0,0,0.7)';
  });
}

function setInst(i){
  if(currentInstSlot === -1) return;
  if(!G.inst) G.inst = {};
  if(i === 'normal') delete G.inst[currentInstSlot];
  else G.inst[currentInstSlot] = i;
  $('pm').hidden = true;
  save(); dash();
}

function removePlayer(){
  if(currentInstSlot === -1) return;
  G.lu[currentInstSlot] = null;
  if(G.inst) delete G.inst[currentInstSlot];
  $('pm').hidden = true;
  save(); dash();
}

// ============================================
// عرض لاعبي فريق آخر
// ============================================
function showTeamPlayers(tid){
  const team = T[tid];
  if(!team) return;
  const st = autoFillLineup(team, team.form);
  let h = `<div class="mc mc-info">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    <div class="mc-head">
      <div class="mc-icon">👥</div>
      <div class="mc-title">${team.name}</div>
      <div class="mc-sub">💰 ${team.budget.toFixed(1)}M • ⭐ ${team.R}</div>
    </div>
    <div class="mc-list">`;
  [...team.ps].sort((a,b) => b.r-a.r).forEach(p => {
    const isS = st.includes(p.id);
    h += `<div class="mc-list-item" onclick="showCard('${p.id}','${tid}')" style="cursor:pointer;${isS?'border-right:3px solid #4ade80;background:rgba(74,222,128,.08)':''}">
      <div style="text-align:right;flex:1">
        <div style="font-size:12px;color:#fff;font-weight:700">${p.injury?'🚑 ':''}${p.name} ${isS?'✅':''}</div>
        <div style="font-size:10px;color:var(--m)">${p.pos} • ⭐${p.r}</div>
      </div>
      <div style="text-align:left;font-size:11px"><div style="color:#4ade80;font-weight:900">${p.value}M</div></div>
    </div>`;
  });
  h += `</div><div class="mc-actions"><button class="b full" onclick="$('cm').hidden=true">إغلاق</button></div></div>`;
  $('cmc').innerHTML = h;
  $('cm').hidden = false;
}

// ============================================
// بطاقة اللاعب الكاملة
// ============================================
function showCard(pid, teamId){
  teamId = teamId || G.my;
  const team = T[teamId];
  if(!team) return;
  const p = team.ps.find(x => x.id === pid);
  if(!p) return;
  const need = xpNeeded(p.lvl);
  const pct = p.lvl >= 10 ? 100 : Math.min(100, Math.round((p.xp||0)/need*100));
  const bg1 = team.c1, bg2 = team.c2 === '#FFFFFF' ? team.c1 : team.c2;
  const isO = teamId !== G.my;
  const mo = getMoraleEmoji(p.morale);
  const mt = p.morale>=80?'ممتاز':p.morale>=60?'جيد':p.morale>=40?'متوسط':'سيئ';
  const fm = getFormEmoji(p);
  const it = p.injury
    ? `<div style="background:rgba(127,29,29,.5);color:#fff;padding:8px;border-radius:10px;font-size:11px;margin-top:8px;border:1px solid #ef4444">🚑 ${p.injury.type} - ${p.injury.matchesLeft} مباراة</div>`
    : '';
  const attrs = `<div class="fcard-stats">
    <div><span>⚡سرعة</span><b>${p.pace}</b></div>
    <div><span>🎯تسديد</span><b>${p.shooting}</b></div>
    <div><span>🎨تمرير</span><b>${p.passing}</b></div>
    <div><span>🏃مراوغة</span><b>${p.dribbling}</b></div>
    <div><span>🛡️دفاع</span><b>${p.defending}</b></div>
    <div><span>💪بدنية</span><b>${p.physical}</b></div>
  </div>`;

  let roleBadges = '';
  if(!isO){
    if(G.captain === p.id) roleBadges += '<span style="background:linear-gradient(135deg,#fbbf24,#d97706);color:#000;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:900;margin:2px">👑 كابتن</span>';
    if(G.penaltyTaker === p.id) roleBadges += '<span style="background:rgba(34,211,238,.25);color:#22d3ee;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:900;margin:2px;border:1px solid #22d3ee">🥅 جزاء</span>';
    if(G.freeKickTaker === p.id) roleBadges += '<span style="background:rgba(168,85,247,.25);color:#a855f7;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:900;margin:2px;border:1px solid #a855f7">🎯 حر</span>';
    if(G.cornerTaker === p.id) roleBadges += '<span style="background:rgba(249,115,22,.25);color:#f97316;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:900;margin:2px;border:1px solid #f97316">🚩 ركنية</span>';
  }
  const roleBlock = roleBadges ? `<div style="margin-top:8px;text-align:center">${roleBadges}</div>` : '';

  let contractBlock = '';
  if(!isO && p.contract){
    const years = p.contract.years;
    const yearsColor = years<=0?'#f87171':years===1?'#fbbf24':'#4ade80';
    const salary = p.contract.salary;
    const expected = calcSalary(p.r);
    const salaryStatus = salary>expected*1.4?'🤩 سعيد جداً':salary<expected*0.7?'😠 غير راضٍ':'😐 مقبول';
    contractBlock = `<div class="contract-info">
      <div style="font-size:11px;color:var(--gold);font-weight:900;margin-bottom:8px">📋 العقد</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:5px"><span>الراتب:</span><b>${salary.toFixed(2)}M/مباراة</b></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:5px"><span>السنوات المتبقية:</span><b style="color:${yearsColor}">${years}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:8px"><span>رضا الراتب:</span><b>${salaryStatus}</b></div>
      ${years<=2 ? `<button class="b g" style="padding:10px;font-size:11px;margin-top:4px" onclick="renewContract('${p.id}')">✍️ تجديد العقد</button>` : ''}
    </div>`;
  }

  $('cmc').innerHTML = `<div class="mc mc-warning">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    <div class="mc-head">
      <div class="mc-icon">${p.injury?'🚑':'⚽'}</div>
      <div class="mc-title">${p.name}</div>
      <div class="mc-sub">${team.name} • ${p.pos} • ${p.age} سنة</div>
    </div>
    <div class="fcard" style="background:linear-gradient(160deg,${bg1},${bg2==='#FFFFFF'?'#333':bg2})">
      <div class="fcard-hd">
        <div class="fcard-rt">${p.r}</div>
        <div class="fcard-pos">${p.pos} ${p.secPos!==p.pos?'('+p.secPos+')':''}</div>
        <div class="fcard-lv">L${p.lvl} • ${p.age} سنة • XP ${pct}%</div>
      </div>
      <div class="fcard-nm">${p.name}</div>
      <div class="fcard-tm">${team.name}</div>
      ${attrs}
      <div class="fcard-ft">${p.goals?`⚽${p.goals} • `:''}💰${p.value}M • ${mo}${mt} ${fm}</div>
    </div>
    ${roleBlock}${it}${contractBlock}
    <div class="mc-actions">
      ${isO ? `<button class="b a full" onclick="makeOffer('${p.id}','${teamId}')">💰 عرض شراء</button>` : ''}
      <button class="b ${isO?'':'full'}" style="background:#475569;color:#fff;padding:12px;font-size:12px" onclick="$('cm').hidden=true">إغلاق</button>
    </div>
  </div>`;
  $('cm').hidden = false;
}

// ============================================
// تجديد العقد
// ============================================
function renewContract(pid){
  const t = T[G.my];
  const p = t.ps.find(x => x.id === pid);
  if(!p) return;
  const curSal = p.contract.salary;
  const expected = calcSalary(p.r);
  const askSal = Math.max(expected*1.2, curSal*1.15);
  const askSalRounded = Math.round(askSal*100)/100;
  const years = 3;
  const signingBonus = Math.round(askSalRounded*2*10)/10;
  if(t.budget < signingBonus){
    alert(`❌ ميزانية غير كافية!\nمطلوب: ${signingBonus}M (مكافأة توقيع)\nميزانيتك: ${t.budget.toFixed(1)}M`);
    return;
  }
  if(confirm(`📋 تجديد عقد ${p.name}\n\n💰 الراتب الحالي: ${curSal.toFixed(2)}M/مباراة\n💰 الراتب المطلوب: ${askSalRounded.toFixed(2)}M/مباراة\n📅 المدة: ${years} مواسم\n💵 مكافأة توقيع: ${signingBonus}M\n\nهل توافق؟`)){
    t.budget = Math.round((t.budget-signingBonus)*10)/10;
    p.contract.salary = askSalRounded;
    p.contract.years = years;
    p.morale = Math.min(100, (p.morale||70)+15);
    addNews(`✍️ تجديد عقد ${p.name}!`, `💰 راتب جديد ${askSalRounded.toFixed(2)}M/مباراة • ${years} مواسم • معنويات +15`);
    $('cm').hidden = true;
    save(); dash();
  }
}

// ============================================
// عرض شراء لاعب
// ============================================
function makeOffer(pid, tid){
  if(!checkTransferWindow()) return alert('نافذة مغلقة!');
  const team = T[tid];
  const p = team.ps.find(x => x.id === pid);
  if(!p) return;
  const me = T[G.my];
  if(me.ps.length >= 25) return alert('ممتلئ!');
  if(p.injury) return alert('مصاب!');

  const b11 = autoFillLineup(team, team.form);
  const isN = b11.includes(p.id);
  const mm = isN ? 1.3 : 1.05;
  const sug = Math.ceil(p.value*mm);

  const offer = prompt(`القيمة: ${p.value}M\n${isN?'⚠️ أساسي':'✅ احتياطي'}\nالسعر: ${sug}M\nميزانيتك: ${me.budget}M\n\nعرضك:`, sug);
  if(offer === null) return;
  const on = parseFloat(offer);
  if(isNaN(on) || on <= 0) return alert('قيمة خطأ');
  if(on > me.budget) return alert('ميزانية غير كافية!');

  let th = p.value*mm;
  if(team.ps.length <= 15) th *= 1.25;
  if(team.ps.length <= 12) th *= 1.5;
  if(p.r >= 90) th *= 1.15;
  if(isN) th *= 1.1;

  if(on >= th){
    me.budget = Math.round((me.budget-on)*10)/10;
    team.budget = Math.round((team.budget+on)*10)/10;
    team.ps = team.ps.filter(x => x.id !== pid);
    me.ps.push(p);
    addNews(`💰 ${p.name} ينضم لـ ${me.name}!`, `💸 من ${team.name} بـ${on}M • تقييم ${p.r}`);
    alert(`✅ قبلت!`);
    $('cm').hidden = true;
    save(); dash();
  } else {
    const c = Math.ceil(th);
    alert(`${on>=th*.8?'🤔 رفضت':'❌ رفض!'} تطلب ${c}M`);
  }
}

// ============================================
// سوق الأساطير
// ============================================
function showLegendCard(pid){
  if(!checkTransferWindow()) return alert('نافذة مغلقة!');
  const p = G.legendsMarket.find(x => x.id === pid);
  if(!p) return;
  const me = T[G.my];
  const can = me.budget >= p.value && me.ps.length < 25;
  $('cmc').innerHTML = `<div class="mc" style="border:2px solid #fbbf24">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    <div class="mc-head">
      <div class="mc-icon">🌟</div>
      <div class="mc-title" style="color:#fbbf24">أسطورة!</div>
      <div class="mc-sub">فرصة نادرة لضم نجم عالمي</div>
    </div>
    <div class="fcard legend">
      <div class="fcard-hd">
        <div style="font-size:12px;color:#fbbf24">🌟 أسطورة</div>
        <div class="fcard-rt">${p.r}</div>
        <div class="fcard-pos">${p.pos}</div>
        <div class="fcard-lv">L${p.lvl}</div>
      </div>
      <div class="fcard-nm">${p.name}</div>
      <div class="fcard-tm">أسطورة</div>
      <div class="fcard-stats">
        <div><span>⚡</span><b>${p.pace}</b></div>
        <div><span>🎯</span><b>${p.shooting}</b></div>
        <div><span>🎨</span><b>${p.passing}</b></div>
      </div>
      <div class="fcard-ft">💰 ${p.value}M</div>
    </div>
    <div style="margin-top:10px;font-size:12px;color:${can?'#4ade80':'#f87171'};font-weight:900">${can?'✅ يمكنك ضمه':'⚠️ لا يمكن (ميزانية/فريق ممتلئ)'}</div>
    <div class="mc-actions">
      <button class="b ${can?'':'full'}" style="background:linear-gradient(180deg,#fbbf24,#d97706);color:#000;opacity:${can?1:.4};padding:12px;font-size:12px" ${can?`onclick="buyLegend('${p.id}')"`:'disabled'}>🌟 ${p.value}M</button>
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
  me.budget = Math.round((me.budget-p.value)*10)/10;
  me.ps.push(p);
  G.legendsMarket = G.legendsMarket.filter(x => x.id !== pid);
  G.usedLegends.push(pid);
  addNews(`🌟🌟 ${p.name} ينضم لـ ${me.name}!`, `💸 صفقة أسطورية بـ${p.value}M • تقييم ${p.r}`);
  alert(`🎉 ${p.name} في فريقك!`);
  $('cm').hidden = true;
  save(); dash();
}

// ============================================
// بيع لاعب
// ============================================
function sellPlayer(pid){
  if(!checkTransferWindow()) return alert('نافذة مغلقة!');
  const me = T[G.my];
  const p = me.ps.find(x => x.id === pid);
  if(!p) return;
  if(me.ps.length <= 14) return alert('تحتاج 14 لاعب على الأقل!');

  const ask = prompt(`💰 بيع ${p.name}\nالقيمة: ${p.value}M\n\nالسعر:`, p.value);
  if(ask === null) return;
  const price = parseFloat(ask);
  if(isNaN(price) || price <= 0) return alert('سعر خطأ');

  const ratio = price/p.value;
  let ch = .05;
  if(ratio <= .9) ch = .9;
  else if(ratio <= 1.1) ch = .75;
  else if(ratio <= 1.3) ch = .5;
  else if(ratio <= 1.6) ch = .25;
  else if(ratio <= 2.0) ch = .1;

  if(R() < ch){
    me.budget = Math.round((me.budget+price)*10)/10;
    me.ps = me.ps.filter(x => x.id !== pid);
    G.lu = G.lu.map(id => id === pid ? null : id);
    if(G.captain === pid) G.captain = null;
    if(G.penaltyTaker === pid) G.penaltyTaker = null;
    if(G.freeKickTaker === pid) G.freeKickTaker = null;
    if(G.cornerTaker === pid) G.cornerTaker = null;

    const bs = Object.values(T).filter(t => t.id !== G.my && t.budget >= price);
    if(bs.length){
      const b = bs[Math.floor(R()*bs.length)];
      b.budget = Math.round((b.budget-price)*10)/10;
      b.ps.push(p);
      addNews(`💰 ${p.name} يرحل من ${me.name}!`, `💸 إلى ${b.name} بـ${price}M`);
    } else {
      addNews(`💰 ${p.name} يغادر ${me.name}!`, `💸 بـ${price}M في صفقة انتقال`);
    }
    if(G.lu.includes(null)) G.lu = autoFillLineup(me, G.form);
    alert(`✅ بيع بـ${price}M`);
    save(); dash();
  } else {
    alert(`❌ لا مشترٍ بـ ${price}M`);
  }
}

// ============================================
// شاشة الإعداد (البداية)
// ============================================
function showSetup(){
  $('bottom-nav').hidden = true;
  $('header-badge').textContent = 'إعداد';
  const sv = load();
  $('main').innerHTML = `<div class="setup-hero">
    <div class="setup-icon">⚽</div>
    <div class="setup-title">محاكاة اتحاد الكرة</div>
    <div class="setup-sub">v26 • Pro Edition</div>
    ${sv ? '<button class="b a" style="margin-bottom:12px;padding:14px;font-size:14px" onclick="cont()">▶ متابعة المسيرة</button>' : ''}
    <input type="text" id="inp-user" placeholder="اسمك" value="مستخدم" style="margin-bottom:10px">
    <input type="text" id="inp-manager" placeholder="اسم المدرب" value="المدرب" style="margin-bottom:12px">
    <button class="b" onclick="startNewCareer()" style="padding:14px;font-size:14px">⚽ اختر النادي</button>
  </div>`;
}

function startNewCareer(){
  const u = $('inp-user').value.trim(), m = $('inp-manager').value.trim();
  if(!u || !m) return alert('اكتب البيانات!');
  tempUserData.username = u;
  tempUserData.managerName = m;
  selTeam();
}

function selTeam(){
  $('main').innerHTML = `<h2 style="text-align:center;color:var(--gold);margin:10px 0;font-size:15px">🏟️ اختر ناديك</h2>
    <div class="g2">
      ${Object.values(T).map(t => `<div class="team-select-card" onclick="choose('${t.id}')">
        <div class="bd" style="background:${t.c1};color:${t.c2==='#FFFFFF'?'#000':t.c2}">${t.name[0]}</div>
        <b style="font-size:12px">${t.name}</b>
        <div style="color:var(--gold);font-size:11px;margin-top:4px">⭐${t.R}</div>
      </div>`).join('')}
    </div>`;
}

function choose(id){
  G = {
    my: id, form:'4-3-3', tac:'balanced', tab:'lu',
    username: tempUserData.username, managerName: tempUserData.managerName,
    trophies:0, news:[], inst:{},
    legendsMarket:[], usedLegends:[], lastLegendRound:0,
    seasonNumber:1, history:[], trophyCabinet:[], youthPlayers:[],
    pendingOffer:null, boardObjectives:null,
    managerXp:0, managerLevel:1,
    hallOfFame:[], monthlyAwards:[], lastPOTM:0,
    currentSponsor:null, lossStreak:0, boardAnger:0,
    captain:null, penaltyTaker:null, freeKickTaker:null, cornerTaker:null
  };
  G.season = generateSeason(id, null);
  G.boardObjectives = setBoardObjectives(T[id]);
  G.youthPlayers = [generateYouthPlayer(T[id]), generateYouthPlayer(T[id])];
  G.lu = autoFillLineup(T[id], G.form);
  autoAssignRoles();
  addNews(`🏆 يبدأ الموسم ${SEASON_YEAR}/${SEASON_YEAR+1}!`, `👨‍💼 ${G.managerName} يقود ${T[id].name}`);
  save(); dash();
  setTimeout(() => showSponsorOffers(), 500);
}

// ============================================
// ترحيل الحفظ القديم
// ============================================
function migrateSave(){
  Object.values(T).forEach(t => {
    if(t.budget < 0){
      const fix = Math.round(30+Math.pow(Math.max(0, t.R-60)/10, 1.8)*8);
      t.budget = Math.max(fix, 30);
    }
    t.ps.forEach(p => {
      if(!p.contract){p.contract = {years:2, salary:calcSalary(p.r)};}
      else if(p.contract.salary > p.r*0.02){p.contract.salary = calcSalary(p.r);}
      else if(p.contract.salary < 0.05){p.contract.salary = calcSalary(p.r);}
    });
  });
  if(G.captain === undefined) G.captain = null;
  if(G.penaltyTaker === undefined) G.penaltyTaker = null;
  if(G.freeKickTaker === undefined) G.freeKickTaker = null;
  if(G.cornerTaker === undefined) G.cornerTaker = null;
}

// ============================================
// متابعة المسيرة المحفوظة
// ============================================
function cont(){
  const d = load();
  if(!d){
    try{localStorage.removeItem('c26_egypt_v26');}catch(e){}
    location.reload();
    return;
  }
  T = d.T; G = d.G;

  if(G.trophies === undefined) G.trophies = 0;
  if(!G.news) G.news = [];
  if(!G.inst) G.inst = {};
  if(!G.legendsMarket) G.legendsMarket = [];
  if(!G.usedLegends) G.usedLegends = [];
  if(G.lastLegendRound === undefined) G.lastLegendRound = 0;
  if(!G.seasonNumber) G.seasonNumber = 1;
  if(!G.history) G.history = [];
  if(!G.trophyCabinet) G.trophyCabinet = [];
  if(!G.youthPlayers) G.youthPlayers = [];
  if(!G.boardObjectives) G.boardObjectives = setBoardObjectives(T[G.my]);
  if(!G.managerXp) G.managerXp = 0;
  if(!G.managerLevel) G.managerLevel = 1;
  if(!G.hallOfFame) G.hallOfFame = [];
  if(!G.monthlyAwards) G.monthlyAwards = [];
  if(G.lastPOTM === undefined) G.lastPOTM = 0;
  if(G.lossStreak === undefined) G.lossStreak = 0;
  if(G.boardAnger === undefined) G.boardAnger = 0;
  if(G.captain === undefined) G.captain = null;
  if(G.penaltyTaker === undefined) G.penaltyTaker = null;
  if(G.freeKickTaker === undefined) G.freeKickTaker = null;
  if(G.cornerTaker === undefined) G.cornerTaker = null;

  if(!G.lu || G.lu.length !== 11) G.lu = autoFillLineup(T[G.my], G.form);

  Object.values(T).forEach(t => {
    if(t.budget === undefined) t.budget = Math.round(30+Math.pow(Math.max(0, t.R-60)/10, 1.8)*8);
    if(t.tac === undefined) t.tac = 'balanced';
    t.ps.forEach(p => {
      if(p.lvl === undefined) p.lvl = 1;
      if(p.xp === undefined) p.xp = 0;
      if(p.age === undefined) p.age = 22;
      if(p.value === undefined) p.value = calcVal(p.r, p.lvl, p.age);
      if(p.morale === undefined) p.morale = 70;
      if(p.injury === undefined) p.injury = null;
      if(!p.form) p.form = [6,6,6];
      if(p.chemistry === undefined) p.chemistry = 0;
      if(!p.stats) p.stats = {matches:0, goals:0, assists:0, rating:0};
    });
  });

  if(!G.season.postponedRounds) G.season.postponedRounds = [];
  migrateSave();
  autoAssignRoles();
  dash();
}

// ============================================
// معاينة مختصرة
// ============================================
function prev(t){
  const nm = getNextUserMatch();
  if(!nm) return '';
  const oN = T[nm.opp]?.name || nm.oppName || AFRICAN.find(a=>a[0]===nm.opp)?.[1] || WORLD.find(w=>w[0]===nm.opp)?.[1] || nm.opp;
  const sg = l => l.length ? Math.round(l.reduce((a,p)=>a+ef(p),0)/l.length) : 0;
  const mi = G.lu.map(id => t.ps.find(p => p.id === id)).filter(Boolean);
  let oa = 80;
  if(T[nm.opp]) oa = sg(autoFillLineup(T[nm.opp], T[nm.opp].form).map(id => T[nm.opp].ps.find(p => p.id === id)).filter(Boolean));
  else if(AFRICAN.find(a => a[0] === nm.opp)) oa = AFRICAN.find(a => a[0] === nm.opp)[2];
  else if(WORLD.find(w => w[0] === nm.opp)) oa = WORLD.find(w => w[0] === nm.opp)[2];
  const df = isDerby(G.my, nm.opp) ? '⚔️ ' : '';
  return `<div class="c" style="text-align:center;font-size:11px;background:rgba(22,59,99,.3);padding:8px">
    ${df}⚔️ قوتك <b style="color:var(--gold)">${sg(mi)}</b> ضد ${oN} <b>${oa}</b>
    <small style="color:var(--m)">(${nm.home?'ملعبك 🏟️':'خارج ✈️'})</small>
  </div>`;
}
// ============================================
// تبويب سوق الانتقالات
// ============================================
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
      <div style="color:var(--gold);font-size:20px;font-weight:900;text-shadow:0 0 15px rgba(251,191,36,.5)">${t.budget.toFixed(1)}M</div>
      <div style="font-size:9px;color:var(--m)">${t.ps.length}/25 • رواتب ${totalSal.toFixed(2)}M/مباراة</div>
    </div>
    
    ${G.legendsMarket && G.legendsMarket.length ? `
      <div class="sec" style="color:#fbbf24">🌟 سوق الأساطير</div>
      <div style="max-height:150px;overflow:auto;background:linear-gradient(135deg,rgba(120,53,15,.4),rgba(41,37,36,.6));border-radius:10px;padding:6px;margin-bottom:8px;border:2px solid var(--gold)">
        ${G.legendsMarket.map(p => `
          <div class="pl legend" onclick="${isWindowOpen ? `showLegendCard('${p.id}')` : ''}" style="cursor:${isWindowOpen ? 'pointer' : 'not-allowed'};${!isWindowOpen ? 'opacity:0.5' : ''}">
            <span>🌟</span>
            <span style="flex:1;font-size:11px">${p.name}</span>
            <span style="color:var(--gold);font-weight:900;font-size:10px">⭐${p.r}</span>
            <span style="color:#fbbf24;font-size:10px">${p.value}M</span>
          </div>
        `).join('')}
      </div>
    ` : `<div class="c" style="text-align:center;font-size:10px;color:var(--m);padding:8px;border:1px dashed var(--gold)">🌟 سوق الأساطير بعد كل 4 جولات</div>`}
    
    <div class="sec">🛒 السوق (${surplus.length})</div>
    <div style="max-height:200px;overflow:auto;background:rgba(15,34,56,.5);border-radius:10px;padding:6px;margin-bottom:8px;border:1px solid rgba(251,191,36,.2)">
      ${surplus.length === 0 
        ? '<div style="text-align:center;color:var(--m);padding:10px;font-size:10px">لا لاعبون</div>' 
        : surplus.slice(0, 40).map(x => `
          <div class="pl" style="cursor:${isWindowOpen ? 'pointer' : 'not-allowed'};${!isWindowOpen ? 'opacity:0.5' : ''}" onclick="${isWindowOpen ? `showCard('${x.p.id}','${x.team.id}')` : ''}">
            <span style="flex:1;font-size:11px">${x.p.name}</span>
            <span style="font-size:9px;color:var(--m)">${x.p.pos}</span>
            <span style="color:var(--gold);font-size:10px">⭐${x.p.r}</span>
            <span style="color:#4ade80;font-weight:700;font-size:10px">${x.p.value}M</span>
          </div>
        `).join('')}
    </div>
    
    <div class="sec">📤 لاعبوك</div>
    <div style="max-height:200px;overflow:auto;background:rgba(15,34,56,.5);border-radius:10px;padding:6px;border:1px solid rgba(251,191,36,.2)">
      ${mine.map(p => `
        <div class="pl">
          <span style="flex:1;cursor:pointer;font-size:11px" onclick="showCard('${p.id}')">${p.injury ? '🚑 ' : ''}${p.name}</span>
          <span style="color:#c4b5fd;font-size:9px">L${p.lvl}</span>
          <span style="font-size:9px;color:var(--m)">${p.pos}</span>
          <span style="color:var(--gold);font-size:10px">⭐${p.r}</span>
          <span style="color:#4ade80;font-size:10px">${p.value}M</span>
          <button class="b a sm" style="padding:3px 8px;font-size:9px;opacity:${isWindowOpen ? 1 : .4}" ${isWindowOpen ? `onclick="event.stopPropagation();sellPlayer('${p.id}')"` : 'disabled'}>بيع</button>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================
// season.js - توليد الموسم، الكؤوس، والمحاكاة
// ============================================

function mk(){
  T = {};
  D.forEach(([id, name, Rt, c1, c2, s], i) => {
    const ps = [];
    s.split('|').forEach((g, gi) => {
      g.split(' ').forEach((nm, j) => {
        const r = Math.min(99, Rt+2-((j*2+gi)%6));
        const age = 18+Math.floor(R()*15);
        ps.push(createPlayer(id+ps.length, nm.replace(/_/g, ' '), POS[gi], r, age));
      });
    });
    const budget = Math.round(30+Math.pow(Math.max(0, Rt-60)/10, 1.8)*8);
    T[id] = {
      id, name, R:Rt, c1, c2, ps,
      pts:0, pl:0, w:0, d:0, l:0, gf:0, ga:0,
      form: Object.keys(FM)[i%12],
      budget, tac: 'balanced'
    };
  });
}

function generateSeason(myId, prev){
  const s = {
    year: SEASON_YEAR, currentDay: 1,
    leagueFixtures: {}, cupBracket: null, cafCL: null, cafCC: null,
    egyptSuper: null, cafSuper: null, clubWC: null,
    userCalendar: [], postponedRounds: [],
    qualified: {cafCL:false, cafCC:false, egyptSuper:false, cafSuper:false, clubWC:false}
  };

  const ids = Object.keys(T);
  const sh = [...ids].sort(() => R()-.5);
  const n = sh.length;
  const rounds = [];
  const fixed = sh[0];
  const rot = sh.slice(1);
  const n2 = rot.length;
  const all = [];

  for(let r=0; r<n-1; r++){
    const round = [];
    const opp = rot[r%n2];
    round.push(r%2===0 ? [fixed, opp] : [opp, fixed]);
    for(let i=1; i<=n2/2; i++){
      const t1 = rot[(r+i)%n2], t2 = rot[(r-i+n2)%n2];
      if(t1 !== t2) round.push([t1, t2]);
    }
    all.push(round);
  }
  all.forEach(r => rounds.push(r.map(m => [m[1], m[0]])));

  const cupDayMap = {17:'R32', 49:'R16', 81:'QF', 113:'SF', 145:'F'};
  const cupDaysSorted = [17, 49, 81, 113, 145];
  const cupPostponedRounds = {};
  let cupIdx = 0;
  let cumulativeDelay = 0;

  rounds.forEach((round, ri) => {
    const baseDay = LEAGUE_START_DAY + ri*LEAGUE_ROUND_INTERVAL;
    let day = baseDay + cumulativeDelay;
    let previousDay = day;

    while(cupIdx < cupDaysSorted.length && day >= cupDaysSorted[cupIdx]){
      const cupRound = cupDayMap[cupDaysSorted[cupIdx]];
      if(!cupPostponedRounds[cupRound]){
        cupPostponedRounds[cupRound] = { leagueRound: ri+1, previousDay: previousDay, newDay: previousDay+LEAGUE_ROUND_INTERVAL };
      }
      cumulativeDelay += LEAGUE_ROUND_INTERVAL;
      day += LEAGUE_ROUND_INTERVAL;
      cupIdx++;
    }

    s.leagueFixtures[ri+1] = {day, round, played:[]};

    const um = round.find(m => m[0] === myId || m[1] === myId);
    if(um){
      const home = um[0] === myId;
      const opp = home ? um[1] : um[0];
      s.userCalendar.push({day, comp:'league', round:ri+1, opp, home, played:false, result:null});
    }
  });

  Object.entries(cupPostponedRounds).forEach(([cupRound, info]) => {
    s.postponedRounds.push({ cupRound, leagueRound: info.leagueRound, previousDay: info.previousDay, newDay: info.newDay });
  });

  const cupTeams = [...ids, ...DIV2.slice(0, 12)];
  const cs = [...cupTeams].sort(() => R()-.5);
  const cb = {rounds:{}, currentRound:'R32', userAlive:true, winner:null, userMatches:[]};
  cb.rounds.R32 = [];
  for(let i=0; i<32; i+=2) cb.rounds.R32.push({home:cs[i], away:cs[i+1], played:false, winner:null});
  if(cs.includes(myId)){
    const m = cb.rounds.R32.find(x => x.home === myId || x.away === myId);
    if(m){
      const home = m.home === myId;
      s.userCalendar.push({day:CUP_DAYS.R32, comp:'cup', round:'R32', opp:home?m.away:m.home, home, played:false, result:null});
    }
  }
  s.cupBracket = cb;

  if(prev){
    let cafCL = false, cafCC = false;
    if(prev.userWonCAFCL || prev.userWonCAFCC) cafCL = true;
    else if(prev.leaguePos <= 2) cafCL = true;
    else if(prev.userWonCup) cafCC = true;
    else if(prev.leaguePos >= 3 && prev.leaguePos <= 4) cafCC = true;
    s.qualified.cafCL = cafCL; s.qualified.cafCC = cafCC;
    if(prev.userWonLeague || prev.userWonCup) s.qualified.egyptSuper = true;
    if(prev.userWonCAFCL){ s.qualified.clubWC = true; s.qualified.cafSuper = true; }
    if(prev.userWonCAFCC) s.qualified.cafSuper = true;
  }

  if(s.qualified.cafCL){
    s.cafCL = {rounds:{}, currentRound:'R16', userAlive:true, winner:null};
    const ct = [myId, 'ahly', 'zamalek', 'pyramids', ...AFRICAN.map(a=>a[0])].slice(0, 16);
    const csh = [...new Set(ct)].slice(0, 16).sort(() => R()-.5);
    s.cafCL.rounds.R16 = [];
    for(let i=0; i<16; i+=2) s.cafCL.rounds.R16.push({home:csh[i], away:csh[i+1], played:false, winner:null});
    const m = s.cafCL.rounds.R16.find(x => x.home === myId || x.away === myId);
    if(m){ const home = m.home === myId; s.userCalendar.push({day:CAF_DAYS.R16, comp:'cafCL', round:'R16', opp:home?m.away:m.home, home, played:false, result:null}); }
  }

  if(s.qualified.cafCC){
    s.cafCC = {rounds:{}, currentRound:'R16', userAlive:true, winner:null};
    const ct = [myId, 'masry', 'ittihad', 'ceramica', ...AFRICAN.map(a=>a[0])].slice(0, 16);
    const csh = [...new Set(ct)].slice(0, 16).sort(() => R()-.5);
    s.cafCC.rounds.R16 = [];
    for(let i=0; i<16; i+=2) s.cafCC.rounds.R16.push({home:csh[i], away:csh[i+1], played:false, winner:null});
    const m = s.cafCC.rounds.R16.find(x => x.home === myId || x.away === myId);
    if(m){ const home = m.home === myId; s.userCalendar.push({day:CAF_DAYS.R16, comp:'cafCC', round:'R16', opp:home?m.away:m.home, home, played:false, result:null}); }
  }

  if(s.qualified.egyptSuper && prev){
    const lc = prev.userWonLeague ? myId : (prev.leagueWinnerId || tbl()[0].id);
    const cc = prev.userWonCup ? myId : (prev.cupWinnerId || 'ahly');
    if(lc !== cc){ s.userCalendar.push({day:SUP_CUP_DAY, comp:'super', round:'S', opp:lc===myId?cc:lc, home:true, played:false, result:null}); s.egyptSuper = {opp:lc===myId?cc:lc, played:false, winner:null}; }
  }

  if(s.qualified.cafSuper && prev){
    const cw = prev.userWonCAFCL ? myId : (prev.cafCLWinnerId || 'ahly');
    const cc = prev.userWonCAFCC ? myId : (prev.cafCCWinnerId || 'zamalek');
    if(cw !== cc){ s.userCalendar.push({day:CAF_SUP_DAY, comp:'cafSuper', round:'S', opp:cw===myId?cc:cw, home:true, played:false, result:null}); s.cafSuper = {opp:cw===myId?cc:cw, played:false, winner:null}; }
  }

  if(s.qualified.clubWC && prev && prev.userWonCAFCL){
    s.clubWC = {rounds:{}, currentRound:'QF', userAlive:true, winner:null};
    const wt = [myId, ...WORLD.map(w=>w[0])].slice(0, 8);
    const wsh = [...new Set(wt)].slice(0, 8).sort(() => R()-.5);
    s.clubWC.rounds.QF = [];
    for(let i=0; i<8; i+=2) s.clubWC.rounds.QF.push({home:wsh[i], away:wsh[i+1], played:false, winner:null});
    const m = s.clubWC.rounds.QF.find(x => x.home === myId || x.away === myId);
    if(m){ const home = m.home === myId; s.userCalendar.push({day:CLUB_WC_DAYS.QF, comp:'clubWC', round:'QF', opp:home?m.away:m.home, home, played:false, result:null}); }
  }

  s.userCalendar.sort((a,b) => a.day-b.day);
  return s;
}

function getNextUserMatch(){ if(!G.season || !G.season.userCalendar) return null; return G.season.userCalendar.find(m => !m.played) || null; }
function daysUntilMatch(m){ if(!m || !G.season) return 0; return Math.max(0, m.day-G.season.currentDay); }

// ============================================
// تقدم الأيام (مع تطبيق التدريب وفحص الأساطير)
// ============================================
function advanceToDay(td){
  if(!G.season) return;
  simulateAIUpToDay(td);
  G.season.currentDay = td;
  
  applyTraining(); // تطبيق التدريب اليومي
  updateLegendMarket();
  
  save();
}

function applyTraining() {
  if (!G.training) G.training = { focus: 'balanced', intensity: 'normal' };
  const t = T[G.my];
  const focus = G.training.focus;
  const intensity = G.training.intensity;

  let xpMult = 1;
  let injuryRisk = 0;
  let staminaDrain = 0;

  if (intensity === 'light') { xpMult = 0.5; injuryRisk = 0.001; staminaDrain = 2; }
  else if (intensity === 'normal') { xpMult = 1.0; injuryRisk = 0.005; staminaDrain = 5; }
  else if (intensity === 'intense') { xpMult = 1.8; injuryRisk = 0.015; staminaDrain = 10; }

  const facLevel = G.facilities?.training || 1;
  xpMult *= (1 + (facLevel - 1) * 0.25);

  t.ps.forEach(p => {
    p.fit = Math.max(20, (p.fit || 100) - staminaDrain);
    if (R() < injuryRisk) tryInjure(p);

    let xpGain = 20 * xpMult;

    if (focus === 'attack') {
      p.shooting = Math.min(99, p.shooting + (R() < 0.3 ? 1 : 0));
      p.dribbling = Math.min(99, p.dribbling + (R() < 0.2 ? 1 : 0));
    } else if (focus === 'defense') {
      p.defending = Math.min(99, p.defending + (R() < 0.3 ? 1 : 0));
      p.physical = Math.min(99, p.physical + (R() < 0.2 ? 1 : 0));
    } else if (focus === 'fitness') {
      p.pace = Math.min(99, p.pace + (R() < 0.3 ? 1 : 0));
      p.physical = Math.min(99, p.physical + (R() < 0.2 ? 1 : 0));
    } else if (focus === 'youth' && p.age <= 23) {
      xpGain *= 2;
    }

    gainXp(p, Math.round(xpGain));
  });
}

function simulateAIUpToDay(td){
  Object.entries(G.season.leagueFixtures).forEach(([rn, d]) => {
    if(d.day <= td && d.played.length < d.round.length){
      const um = d.round.find(m => m[0] === G.my || m[1] === G.my);
      d.round.forEach(([h,a]) => {
        if((h === G.my || a === G.my) && um) return;
        const pk = h+'_'+a;
        if(d.played.includes(pk)) return;
        const tH = T[h], tA = T[a];
        if(!tH || !tA) return;

        let p1 = tH.R, p2 = tA.R+2;
        if(tH.tac === 'attack') p1 += 1; else if(tH.tac === 'defense') p1 += .5;
        if(tA.tac === 'attack') p2 += 1; else if(tA.tac === 'defense') p2 += .5;

        const df = (p1-p2)/15;
        const g1 = Math.max(0, Math.round(R()*1.8+df*.5));
        const g2 = Math.max(0, Math.round(R()*1.8-df*.5));

        rec(tH, tA, g1, g2);
        d.played.push(pk);

        const homeScorers = [], awayScorers = [];
        for(let i=0; i<g1; i++){ const el = tH.ps.filter(p => p.pos !== 'GK'); const p = el[Math.floor(R()*el.length)] || tH.ps[0]; if(p){p.goals = (p.goals||0)+1; homeScorers.push(p.name); gainXp(p, 40);} }
        for(let i=0; i<g2; i++){ const el = tA.ps.filter(p => p.pos !== 'GK'); const p = el[Math.floor(R()*el.length)] || tA.ps[0]; if(p){p.goals = (p.goals||0)+1; awayScorers.push(p.name); gainXp(p, 40);} }

        const winN = g1>g2 ? tH.name : g2>g1 ? tA.name : null;
        const desc = winN ? (Math.abs(g1-g2)>=3 ? `🔥 فوز ساحق لـ ${winN}` : Math.abs(g1-g2)===2 ? `✅ فوز مريح لـ ${winN}` : `⚔️ فوز صعب لـ ${winN}`) : (g1+g2>=5 ? `⚡ تعادل مثير ${g1}-${g2}` : g1+g2===0 ? `😴 تعادل سلبي` : `🤝 تعادل ${g1}-${g2}`);

        let scorerInfo = '⚽ ';
        if(homeScorers.length) scorerInfo += `${tH.name}: ${homeScorers.join(', ')}`;
        if(homeScorers.length && awayScorers.length) scorerInfo += ' | ';
        if(awayScorers.length) scorerInfo += `${tA.name}: ${awayScorers.join(', ')}`;
        if(!homeScorers.length && !awayScorers.length) scorerInfo += 'لا أهداف في المباراة';

        addNews(`📢 جولة ${rn}: ${tH.name} ${g1}-${g2} ${tA.name}`, `${desc}\n${scorerInfo}`);
      });
    }
  });

  if(G.season.cupBracket) simulateCupUpToDay(td);
  if(G.season.cafCL) simulateCafComp('cafCL', td);
  if(G.season.cafCC) simulateCafComp('cafCC', td);

  Object.values(T).forEach(t => {
    t.ps.forEach(p => { p.fit = Math.min(100, (p.fit!=null?p.fit:100)+5); });
    recoverInjuries(t);
  });
}

function simulateCupUpToDay(td){
  const cb = G.season.cupBracket;
  const ro = ['R32','R16','QF','SF','F'];

  ro.forEach(round => {
    const rd = CUP_DAYS[round];
    if(!cb.rounds[round]) return;
    if(rd > td) return;

    cb.rounds[round].forEach(m => {
      if(m.played) return;
      if((m.home === G.my || m.away === G.my) && !m.played) return;

      const hT = T[m.home], aT = T[m.away];
      let w;
      if(hT && aT){ const df = (hT.R+2-aT.R)/12; w = R() < .5+df*.1 ? m.home : m.away; }
      else if(hT) w = m.home; else if(aT) w = m.away; else w = R() < .5 ? m.home : m.away;

      m.winner = w; m.played = true;
      const wN = T[w]?.name || w; const lN = T[w === m.home ? m.away : m.home]?.name || (w === m.home ? m.away : m.home);
      addNews(`🏆 كأس مصر - ${round}: ${wN} يتأهل`, `🥅 ${wN} يهزم ${lN}`);
    });

    if(cb.rounds[round].every(m => m.played)){
      const ni = ro.indexOf(round)+1;
      if(ni < ro.length){
        const nr = ro[ni];
        if(!cb.rounds[nr]){
          cb.rounds[nr] = [];
          for(let i=0; i<cb.rounds[round].length; i+=2){
            const m1 = cb.rounds[round][i], m2 = cb.rounds[round][i+1];
            if(m1 && m2 && m1.winner && m2.winner) cb.rounds[nr].push({home:m1.winner, away:m2.winner, played:false, winner:null});
          }
        }
      } else if(cb.rounds.F && cb.rounds.F.every(m => m.played)){
        cb.winner = cb.rounds.F[0].winner;
        addNews(`🏆🏆 ${T[cb.winner]?.name||cb.winner} بطل كأس مصر!`, `🎉 يحقق البطولة بعد رحلة رائعة`);
      }
    }
  });
}

function simulateCafComp(name, td){
  const c = G.season[name];
  if(!c) return;
  const ro = ['R16','QF','SF','F'];
  const compName = name === 'cafCL' ? 'دوري أبطال أفريقيا' : 'كأس الكونفدرالية';

  ro.forEach(round => {
    const rd = CAF_DAYS[round];
    if(!c.rounds[round]) return;
    if(rd > td) return;

    c.rounds[round].forEach(m => {
      if(m.played) return;
      if((m.home === G.my || m.away === G.my) && !m.played) return;

      const hT = T[m.home], aT = T[m.away];
      const hR = hT ? hT.R : (AFRICAN.find(a=>a[0]===m.home)?.[2] || 78);
      const aR = aT ? aT.R : (AFRICAN.find(a=>a[0]===m.away)?.[2] || 78);
      const df = (hR+2-aR)/12;

      m.winner = R() < .5+df*.1 ? m.home : m.away;
      m.played = true;

      const wN = T[m.winner]?.name || AFRICAN.find(a=>a[0]===m.winner)?.[1] || m.winner;
      const lN = T[m.winner===m.home ? m.away : m.home]?.name || AFRICAN.find(a=>a[0]===(m.winner===m.home?m.away:m.home))?.[1] || (m.winner===m.home?m.away:m.home);
      addNews(`🌍 ${compName} - ${round}: ${wN} يتأهل`, `⚔️ ${wN} يقصي ${lN}`);
    });

    if(c.rounds[round].every(m => m.played)){
      const ni = ro.indexOf(round)+1;
      if(ni < ro.length){
        const nr = ro[ni];
        if(!c.rounds[nr]){
          c.rounds[nr] = [];
          for(let i=0; i<c.rounds[round].length; i+=2){
            const m1 = c.rounds[round][i], m2 = c.rounds[round][i+1];
            if(m1 && m2 && m1.winner && m2.winner) c.rounds[nr].push({home:m1.winner, away:m2.winner, played:false, winner:null});
          }
        }
      } else if(c.rounds.F && c.rounds.F.every(m => m.played)){
        c.winner = c.rounds.F[0].winner;
        const wN = T[c.winner]?.name || AFRICAN.find(a=>a[0]===c.winner)?.[1] || c.winner;
        addNews(`🏆 ${wN} بطل ${compName}!`, `🌟 إنجاز قاري كبير`);
      }
    }
  });
}

function advanceCupBracket(){
  const cb = G.season.cupBracket;
  const ro = ['R32','R16','QF','SF','F'];
  const days = {R32:CUP_DAYS.R32, R16:CUP_DAYS.R16, QF:CUP_DAYS.QF, SF:CUP_DAYS.SF, F:CUP_DAYS.F};

  ro.forEach((r, idx) => {
    if(!cb.rounds[r]) return;
    if(cb.rounds[r].every(m => m.played) && idx < ro.length-1){
      const nr = ro[idx+1];
      if(!cb.rounds[nr]){
        cb.rounds[nr] = [];
        for(let i=0; i<cb.rounds[r].length; i+=2){
          const m1 = cb.rounds[r][i], m2 = cb.rounds[r][i+1];
          if(m1 && m2 && m1.winner && m2.winner) cb.rounds[nr].push({home:m1.winner, away:m2.winner, played:false, winner:null});
        }
      }
      const um = cb.rounds[nr].find(m => m.home === G.my || m.away === G.my);
      if(um && !G.season.userCalendar.find(x => x.comp === 'cup' && x.round === nr && !x.played)){
        const home = um.home === G.my;
        G.season.userCalendar.push({day:days[nr], comp:'cup', round:nr, opp:home?um.away:um.home, home, played:false, result:null});
        G.season.userCalendar.sort((a,b) => a.day-b.day);
        addNews(`🎯 تأهلت لدور ${nr} في كأس مصر!`, `📅 المباراة القادمة يوم ${days[nr]}`);
      }
    } else if(idx === ro.length-1 && cb.rounds.F && cb.rounds.F.every(m => m.played)){
      cb.winner = cb.rounds.F[0].winner;
      if(cb.winner === G.my && !cb.trophyAdded){
        cb.trophyAdded = true; G.trophies = (G.trophies||0)+1;
        addTrophy('كأس مصر', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1);
        addNews(`🏆🏆 ${T[G.my].name} بطل كأس مصر!`, `🎉 ${G.trophies} بطولة`);
      }
    }
  });
}

function advanceCafComp(name){
  const c = G.season[name];
  if(!c) return;
  const ro = ['R16','QF','SF','F'];
  const days = {R16:CAF_DAYS.R16, QF:CAF_DAYS.QF, SF:CAF_DAYS.SF, F:CAF_DAYS.F};
  const ar = name === 'cafCL' ? 'دوري أبطال أفريقيا' : 'كأس الكونفدرالية';

  ro.forEach((r, idx) => {
    if(!c.rounds[r]) return;
    if(c.rounds[r].every(m => m.played) && idx < ro.length-1){
      const nr = ro[idx+1];
      if(!c.rounds[nr]){
        c.rounds[nr] = [];
        for(let i=0; i<c.rounds[r].length; i+=2){
          const m1 = c.rounds[r][i], m2 = c.rounds[r][i+1];
          if(m1 && m2 && m1.winner && m2.winner) c.rounds[nr].push({home:m1.winner, away:m2.winner, played:false, winner:null});
        }
      }
      const um = c.rounds[nr].find(m => m.home === G.my || m.away === G.my);
      if(um && !G.season.userCalendar.find(x => x.comp === name && x.round === nr && !x.played)){
        const home = um.home === G.my;
        G.season.userCalendar.push({day:days[nr], comp:name, round:nr, opp:home?um.away:um.home, home, played:false, result:null});
        G.season.userCalendar.sort((a,b) => a.day-b.day);
        addNews(`🎯 تأهلت لدور ${nr} في ${ar}!`, `📅 المباراة القادمة يوم ${days[nr]}`);
      }
    } else if(idx === ro.length-1 && c.rounds.F && c.rounds.F.every(m => m.played)){
      c.winner = c.rounds.F[0].winner;
      const wN = T[c.winner]?.name || AFRICAN.find(a=>a[0]===c.winner)?.[1] || c.winner;
      if(c.winner === G.my && !c.trophyAdded){
        c.trophyAdded = true; G.trophies = (G.trophies||0)+1;
        addTrophy(ar, G.seasonNumber, SEASON_YEAR+G.seasonNumber-1);
        addNews(`🌍🏆 ${wN} بطل ${ar}!`, `🎉 ${G.trophies} بطولة`);
      }
    }
  });
}

function advanceClubWC(){
  const c = G.season.clubWC;
  if(!c) return;
  const ro = ['QF','SF','F'];
  const days = {QF:CLUB_WC_DAYS.QF, SF:CLUB_WC_DAYS.SF, F:CLUB_WC_DAYS.F};

  ro.forEach((r, idx) => {
    if(!c.rounds[r]) return;
    if(c.rounds[r].every(m => m.played) && idx < ro.length-1){
      const nr = ro[idx+1];
      if(!c.rounds[nr]){
        c.rounds[nr] = [];
        for(let i=0; i<c.rounds[r].length; i+=2){
          const m1 = c.rounds[r][i], m2 = c.rounds[r][i+1];
          if(m1 && m2 && m1.winner && m2.winner) c.rounds[nr].push({home:m1.winner, away:m2.winner, played:false, winner:null});
        }
      }
      const um = c.rounds[nr].find(m => m.home === G.my || m.away === G.my);
      if(um && !G.season.userCalendar.find(x => x.comp === 'clubWC' && x.round === nr && !x.played)){
        const home = um.home === G.my;
        G.season.userCalendar.push({day:days[nr], comp:'clubWC', round:nr, opp:home?um.away:um.home, home, played:false, result:null});
        G.season.userCalendar.sort((a,b) => a.day-b.day);
        addNews(`🌐 تأهلت لدور ${nr} في كأس العالم!`, `📅 المباراة القادمة يوم ${days[nr]}`);
      }
    } else if(idx === ro.length-1 && c.rounds.F && c.rounds.F.every(m => m.played)){
      c.winner = c.rounds.F[0].winner;
      if(c.winner === G.my && !c.trophyAdded){
        c.trophyAdded = true; G.trophies = (G.trophies||0)+1;
        addTrophy('كأس العالم للأندية', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1);
        addNews(`🌐🌐 ${T[G.my].name} بطل كأس العالم!`, `🏆 ${G.trophies} بطولة`);
      }
    }
  });
}

function addTrophy(name, seasonNum, year){
  if(!G.trophyCabinet) G.trophyCabinet = [];
  G.trophyCabinet.push({name, season:seasonNum, year});
}

function realPenaltyShootout(tA, tB){
  let sA = 0, sB = 0;
  const log = [];
  let round = 0;

  for(let i=0; i<5; i++){
    round++;
    const shA = R() < .72; const shB = R() < .72;
    if(shA) sA++; if(shB) sB++;
    log.push(`ركلة ${round}: ${tA.name} ${shA?'✅':'❌'} | ${tB.name} ${shB?'✅':'❌'}`);
    const rem = 5-i-1;
    if(sA > sB+rem) break;
    if(sB > sA+rem) break;
  }

  while(sA === sB){
    round++;
    const shA = R() < .68, shB = R() < .68;
    if(shA) sA++; if(shB) sB++;
    log.push(`ركلة ${round} (حاسمة): ${tA.name} ${shA?'✅':'❌'} | ${tB.name} ${shB?'✅':'❌'}`);
    if(round > 15) break;
  }
  return {winner: sA>sB ? 'home' : 'away', scoreA:sA, scoreB:sB, log};
}

function simulateLivingWorld(){
  const ai = Object.values(T).filter(t => t.id !== G.my);
  if(!ai.length) return;

  const st = tbl();
  st.forEach((t,i) => {
    if(t.id === G.my) return;
    if(i > 14){ if(t.tac !== 'attack') t.tac = 'attack'; }
    else if(i < 5){ if(t.tac !== 'defense') t.tac = 'defense'; }
    else t.tac = 'balanced';
  });

  if(R() < .3){
    const b = ai[Math.floor(R()*ai.length)];
    const s = ai[Math.floor(R()*ai.length)];
    if(b.id !== s.id && b.budget > 10 && s.ps.length > 15){
      const b11 = autoFillLineup(s, s.form);
      const sp = s.ps.filter(p => !b11.includes(p.id) && !p.susp && !p.injury);
      if(sp.length){
        const p = sp[Math.floor(R()*sp.length)];
        if(p && b.budget >= p.value && b.ps.length < 25){
          b.budget = Math.round((b.budget-p.value)*10)/10;
          s.budget = Math.round((s.budget+p.value)*10)/10;
          s.ps = s.ps.filter(x => x.id !== p.id);
          b.ps.push(p);
          addNews(`💼 انتقال داخلي: ${b.name} ← ${p.name}`, `💸 من ${s.name} بـ${p.value}M • تقييم ${p.r}`);
        }
      }
    }
  }

  if(R() < .2){
    const ut = T[G.my];
    if(ut.ps.length > 15){
      const b = ai[Math.floor(R()*ai.length)];
      if(b.budget > 15){
        const t = ut.ps[Math.floor(R()*ut.ps.length)];
        if(t && t.value < b.budget && !t.injury){
          const oa = Math.round(t.value*(1.1+R()*.5)*10)/10;
          G.pendingOffer = {playerId:t.id, buyerId:b.id, amount:oa};
        }
      }
    }
  }
}

function checkLegendsMarket(){
  if(!G.season) return;
  if(G.legendsMarket && G.legendsMarket.length > 0) return;

  const r = Object.values(G.season.leagueFixtures).filter(d => d.played.length > 0).length;
  if(r > 0 && r%4 === 0 && G.lastLegendRound !== r){
    G.lastLegendRound = r;
    const av = LEGEND_POOL.filter(l => !G.usedLegends.includes('legend_'+l.name));
    
    if(av.length > 0){
      const idx = Math.floor(R()*av.length);
      const lg = av.splice(idx, 1)[0];
      const id = 'legend_'+lg.name;
      
      G.legendsMarket.push({
        id, name:lg.name, pos:lg.pos, r:lg.r,
        fit:100, goals:0, yc:0, rc:0, susp:0,
        morale:90, injury:null,
        pace:lg.r, shooting:lg.r, passing:lg.r, dribbling:lg.r, defending:lg.r, physical:lg.r, aggr:70,
        lvl:1, xp:0, value:lg.price, isLegend:true,
        contract:{years:3, salary:calcSalary(lg.r)},
        age:28, form:[7,7,7], chemistry:0,
        stats:{matches:0, goals:0, assists:0, rating:0},
        expiresOnDay: G.season.currentDay + 1
      });
      addNews(`🌟 أسطورة في السوق!`, `🎯 ${lg.name} متاح لمدة يوم واحد فقط!`);
    }
  }
}

function updateLegendMarket(){
  if(!G || !G.season || !G.legendsMarket) return;
  const currentDay = G.season.currentDay;
  
  G.legendsMarket = G.legendsMarket.filter(p => {
    if (p.expiresOnDay && currentDay >= p.expiresOnDay) {
      addNews(`⏰ انتهى عرض الأسطورة ${p.name}!`, `🚫 غادر السوق ولن يعود.`);
      G.usedLegends.push(p.id);
      return false;
    }
    return true;
  });
}

function generateYouthPlayer(t){
  const pos = POS[Math.floor(R()*4)];
  const name = YOUTH_NAMES[Math.floor(R()*YOUTH_NAMES.length)]+' '+(10+Math.floor(R()*90));
  
  // تحسين جودة الشباب بناءً على تطوير الأكاديمية
  const facLevel = G.facilities?.youth || 1;
  const rating = 55 + Math.floor(R()*15) + (facLevel * 2);

  const p = createPlayer(t.id+'_youth_'+Date.now()+'_'+Math.floor(R()*10000), name, pos, rating, 16);
  p.isYouth = true;
  p.morale = 90;
  return p;
}

function checkPlayerOfMonth(){
  if(!G || !G.season) return;
  const day = G.season.currentDay;
  if(day > 0 && day%30 === 0 && G.lastPOTM !== day){
    G.lastPOTM = day;
    const all = [];
    Object.values(T).forEach(team => {
      team.ps.forEach(p => { if(p.goals > 0 || p.lvl > 1) all.push({p, team}); });
    });
    if(!all.length) return;
    all.sort((a,b) => (b.p.goals||0)-(a.p.goals||0) || b.p.lvl-a.p.lvl);
    const w = all[0];
    if(!G.monthlyAwards) G.monthlyAwards = [];
    G.monthlyAwards.push({ season:G.seasonNumber, month:Math.ceil(day/30), player:w.p.name, team:w.team.name, goals:w.p.goals||0 });
    gainXp(w.p, 100);
    addNews(`🎖️ لاعب الشهر: ${w.p.name}!`, `⚽ ${w.team.name} • ${w.p.goals||0} هدف • +100 XP`);
  }
}

function checkRetirements(){
  if(!G || !G.season) return;
  const t = T[G.my];
  if(G.seasonNumber < 2) return;
  const tr = [];

  t.ps.forEach(p => {
    if((p.age >= 36 && R() < 0.5) || (p.age >= 38) || (p.contract && p.contract.years <= 0 && p.lvl >= 7 && R() < .3)) tr.push(p);
  });

  tr.forEach(p => {
    if(!G.hallOfFame) G.hallOfFame = [];
    G.hallOfFame.push({ name:p.name, pos:p.pos, r:p.r, lvl:p.lvl, goals:p.goals||0, season:G.seasonNumber, year: SEASON_YEAR+G.seasonNumber-1 });
    t.ps = t.ps.filter(x => x.id !== p.id);
    G.lu = G.lu.map(id => id === p.id ? null : id);
    if(G.captain === p.id) G.captain = null;
    if(G.penaltyTaker === p.id) G.penaltyTaker = null;
    if(G.freeKickTaker === p.id) G.freeKickTaker = null;
    if(G.cornerTaker === p.id) G.cornerTaker = null;
    addNews(`🏛️ اعتزال ${p.name}!`, `⭐ تقييم ${p.r} • ${p.goals||0} هدف طوال المسيرة`);
  });

  if(tr.length && G.lu.includes(null)) G.lu = autoFillLineup(t, G.form);
}

function updatePlayerAges(){
  if(!G || !G.season) return;
  Object.values(T).forEach(t => {
    t.ps.forEach(p => {
      p.age++;
      if(p.age <= 23) p.xp += 100;
      else if(p.age >= 30){ p.r = Math.max(50, p.r-1); p.value = calcVal(p.r, p.lvl, p.age); }
    });
  });
}

function endSeason(){
  const t = T[G.my];
  const st = tbl();
  const myPos = st.findIndex(x => x.id === G.my)+1;
  const lc = st[0].id;
  const cw = G.season.cupBracket?.winner;
  const cw1 = G.season.cafCL?.winner;
  const cw2 = G.season.cafCC?.winner;

  if(lc === G.my){
    G.trophies = (G.trophies||0)+1;
    addTrophy('الدوري المصري', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1);
    addNews(`🏆🏆 ${t.name} بطل الدوري!`, `🎉 ${t.pts} نقطة • المركز الأول`);
  }

  checkBoardObjectives();

  const allP = Object.values(T).flatMap(t => t.ps.map(p => ({p, t})));
  allP.sort((a,b) => b.p.stats.goals-a.p.stats.goals);
  const topScorer = allP[0];
  allP.sort((a,b) => b.p.stats.rating-a.p.stats.rating);
  const bestPlayer = allP[0];

  addNews(`🏆 جوائز الموسم!`, `⚽ الهداف: ${topScorer.p.name} (${topScorer.p.stats.goals} هدف) • 🌟 أفضل لاعب: ${bestPlayer.p.name}`);

  const prev = {
    leaguePos: myPos, userWonLeague: lc === G.my, userWonCup: cw === G.my,
    userWonCAFCL: cw1 === G.my, userWonCAFCC: cw2 === G.my,
    leagueWinnerId: lc, cupWinnerId: cw, cafCLWinnerId: cw1, cafCCWinnerId: cw2
  };

  const ts = [...t.ps].sort((a,b) => (b.goals||0)-(a.goals||0))[0];

  $('main').innerHTML = `<div style="text-align:center;padding:20px">
    <div style="font-size:64px;filter:drop-shadow(0 0 30px rgba(251,191,36,.8))">🏆</div>
    <h2 style="color:var(--gold);font-size:20px;text-shadow:0 0 20px rgba(251,191,36,.6)">${myPos===1?'بطل الدوري!':'المركز '+myPos}</h2>
    <p style="font-size:13px;color:#fff">${t.pts} نقطة (${t.w}ف ${t.d}ت ${t.l}خ)</p>
    <div class="c" style="text-align:right;font-size:12px;padding:12px;margin-top:10px">
      <div style="margin-bottom:6px">🏆 البطولات: <b style="color:var(--gold)">${G.trophies}</b></div>
      <div style="margin-bottom:6px">⚽ هدافك: <b style="color:var(--gold)">${ts?.name} (${ts?.goals||0})</b></div>
      <div>💰 الميزانية: <b style="color:var(--gold)">${t.budget.toFixed(1)}M</b></div>
    </div>
    <button class="b" style="margin-top:14px;padding:14px;font-size:14px" onclick="startNextSeason()">▶ الموسم ${G.seasonNumber+1}</button>
  </div>`;

  G._prevResults = prev;
  save();
}

function startNextSeason(){
  const prevTrophies = G.trophies||0;
  updatePlayerAges();
  checkRetirements();

  Object.values(T).forEach(t => {
    t.pts = 0; t.pl = 0; t.w = 0; t.d = 0; t.l = 0; t.gf = 0; t.ga = 0;
    t.ps.forEach(p => {
      p.fit = 100; p.goals = 0; p.yc = 0; p.rc = 0; p.susp = 0; p.injury = null;
      p.stats = {matches:0, goals:0, assists:0, rating:0};
      p.form = [6,6,6];
      if(p.contract){
        p.contract.years--;
        if(p.contract.years <= 0 && t.id === G.my){
          if(R() < 0.5){
            addNews(`🚪 ${p.name} يرحل كحر!`, `📋 انتهى عقده • ${p.r} تقييم`);
            t.ps = t.ps.filter(x => x.id !== p.id);
            G.lu = G.lu.map(id => id === p.id ? null : id);
            if(G.captain === p.id) G.captain = null;
            if(G.penaltyTaker === p.id) G.penaltyTaker = null;
            if(G.freeKickTaker === p.id) G.freeKickTaker = null;
            if(G.cornerTaker === p.id) G.cornerTaker = null;
          }
        }
      }
    });
  });

  G.seasonNumber++;
  G.trophies = G.trophies||0;
  const pr = G._prevResults || null;
  G.season = generateSeason(G.my, pr);
  G.boardObjectives = setBoardObjectives(T[G.my]);
  G.youthPlayers = [generateYouthPlayer(T[G.my]), generateYouthPlayer(T[G.my])];

  if(!G.lu || G.lu.length !== 11 || G.lu.includes(null)) G.lu = autoFillLineup(T[G.my], G.form);
  G.inst = {}; G.legendsMarket = []; G.usedLegends = []; G.lastLegendRound = 0; G.lossStreak = 0;
  autoAssignRoles();

  addNews(`🏁 يبدأ الموسم ${SEASON_YEAR+G.seasonNumber-1}/${SEASON_YEAR+G.seasonNumber}!`, `👨‍💼 ${G.managerName} يقود ${T[G.my].name} • ${G.boardObjectives.map(o=>o.desc).join(' + ')}`);

  checkSponsorBonus();
  G.currentSponsor = null;
  G._sponsorTrophies = prevTrophies;
  save();
  dash();
  setTimeout(() => showSponsorOffers(), 500);
}

function checkSponsorBonus(){
  if(!G?.currentSponsor) return;
  const s = G.currentSponsor;
  const t = T[G.my];
  const myPos = tbl().findIndex(x => x.id === G.my)+1;
  let bonus = 0;
  if(s.bonus){
    if(s.bonus.includes('بطولة') && G.trophies > (G._sponsorTrophies||0)) bonus = s.bonus.includes('100M') ? 100 : 50;
    if(s.bonus.includes('أفريقيا') && myPos <= 2) bonus = 20;
    if(s.bonus.includes('الدوري') && myPos === 1) bonus = 80;
  }
  if(bonus > 0){
    t.budget = Math.round((t.budget+bonus)*10)/10;
    addNews(`💰 مكافأة الراعي ${s.name}!`, `📈 +${bonus}M ميزانية`);
  }
}

function showSponsorOffers(){
  const shuffled = [...SPONSORS].sort(() => R()-.5);
  const offers = shuffled.slice(0, 3);
  let html = `<div class="mc mc-warning modal-bg-anim">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    <div class="mc-head">
      <div class="mc-icon" style="font-size:45px">💼</div>
      <div class="mc-title">عروض الرعاية</div>
      <div class="mc-sub">اختر الراعي الرسمي لناديك هذا الموسم</div>
    </div>
    <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px">`;
    
  offers.forEach((s, i) => {
    html += `<div class="sponsor-card" onclick="chooseSponsor(${i})" style="border:1px solid rgba(255,255,255,.15); background:linear-gradient(135deg, rgba(30,41,59,.9), rgba(15,23,42,.9)); display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="font-size:32px; background:rgba(255,255,255,.1); padding:8px; border-radius:12px;">${s.logo}</div>
          <div>
            <div style="font-size:16px; font-weight:900; color:#fff">${s.name}</div>
            <div style="font-size:10px; color:#94a3b8">عقد رعاية موسم ${G.seasonNumber}</div>
          </div>
        </div>
        <div style="text-align:left;">
          <div style="color:#4ade80; font-size:20px; font-weight:900">${s.safe}M</div>
          <div style="font-size:9px; color:#94a3b8; background:rgba(74,222,128,.1); padding:2px 6px; border-radius:4px;">دفعة مقدمة</div>
        </div>
      </div>
      ${s.bonus ? `<div style="padding:8px; background:rgba(251,191,36,.1); border-radius:8px; font-size:11px; color:#fbbf24; font-weight:bold; text-align:center;">🎁 ${s.bonus}</div>` : `<div style="padding:8px; background:rgba(255,255,255,.05); border-radius:8px; font-size:11px; color:#94a3b8; text-align:center;">✅ عقد آمن بدون شروط إضافية</div>`}
    </div>`;
  });
  
  html += `</div></div>`;
  $('cmc').innerHTML = html;
  $('cm').hidden = false;
  G._pendingSponsors = offers;
}

function chooseSponsor(idx){
  if(!G._pendingSponsors) return;
  const s = G._pendingSponsors[idx];
  G.currentSponsor = s;
  T[G.my].budget = Math.round((T[G.my].budget+s.safe)*10)/10;
  addNews(`💼 رعاية جديدة: ${s.logo} ${s.name}`, `💰 دفعة أولى ${s.safe}M ${s.bonus?'• '+s.bonus:''}`);
  G._pendingSponsors = null;
  $('cm').hidden = true;
  save(); dash();
}

function showOffer(){
  if(!G.pendingOffer) return;
  const b = T[G.pendingOffer.buyerId];
  const p = T[G.my].ps.find(x => x.id === G.pendingOffer.playerId);
  if(!p){G.pendingOffer = null; return;}
  $('omt').innerHTML = `<div style="text-align:center;padding:12px;background:rgba(34,197,94,.1);border-radius:10px;margin-bottom:8px">
    <div style="font-size:13px;color:#fff;margin-bottom:6px">يقدم <b style="color:#fbbf24">${b.name}</b> عرضاً</div>
    <div style="font-size:24px;color:#4ade80;font-weight:900">${G.pendingOffer.amount}M</div>
  </div>
  <div style="text-align:center;font-size:12px;color:#fff;line-height:1.7">للتعاقد مع <b style="color:#fbbf24">${p.name}</b><br>L${p.lvl} • ⭐${p.r} • ${p.pos}</div>`;
  $('om').hidden = false;
}

function acceptOffer(){
  if(!G.pendingOffer) return;
  const b = T[G.pendingOffer.buyerId], me = T[G.my];
  const pid = G.pendingOffer.playerId;
  const p = me.ps.find(x => x.id === pid);
  const amt = G.pendingOffer.amount;
  if(p){
    me.budget = Math.round((me.budget+amt)*10)/10;
    b.budget = Math.round((b.budget-amt)*10)/10;
    me.ps = me.ps.filter(x => x.id !== pid);
    b.ps.push(p);
    G.lu = G.lu.map(id => id === pid ? null : id);
    if(G.captain === pid) G.captain = null;
    if(G.penaltyTaker === pid) G.penaltyTaker = null;
    if(G.freeKickTaker === pid) G.freeKickTaker = null;
    if(G.cornerTaker === pid) G.cornerTaker = null;
    if(G.lu.includes(null)) G.lu = autoFillLineup(me, G.form);
    addNews(`💰 ${p.name} يُباع لـ ${b.name}!`, `💸 صفقة بـ${amt}M • اللاعب يغادر ${me.name}`);
  }
  G.pendingOffer = null;
  $('om').hidden = true;
  save(); dash();
}

function rejectOffer(){
  if(!G.pendingOffer) return;
  const b = T[G.pendingOffer.buyerId];
  const p = T[G.my].ps.find(x => x.id === G.pendingOffer.playerId);
  if(p) addNews(`🚫 رفض عرض ${b.name}!`, `⚔️ ${T[G.my].name} تحتفظ بـ ${p.name}`);
  G.pendingOffer = null;
  $('om').hidden = true;
  save(); dash();
}

function resolveSuperCups(){
  if(!G.season) return;

  if(G.season.egyptSuper && !G.season.egyptSuper.played){
    const s = G.season.egyptSuper;
    const userMatch = G.season.userCalendar.find(m => m.comp === 'super' && !m.played);
    if(userMatch) return;
    if(s.winner === null){
      const lc = tbl()[0].id; const cc = G.season.cupBracket?.winner || 'ahly';
      const winner = R() < .5 ? lc : cc;
      s.winner = winner; s.played = true;
      if(winner === G.my){ G.trophies = (G.trophies||0)+1; addTrophy('السوبر المصري', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1); addNews(`🏆 ${T[G.my].name} بطل السوبر المصري!`, `🎉 فوز على ${T[s.opp]?.name || s.opp}`); }
    }
  }

  if(G.season.cafSuper && !G.season.cafSuper.played){
    const s = G.season.cafSuper;
    const userMatch = G.season.userCalendar.find(m => m.comp === 'cafSuper' && !m.played);
    if(userMatch) return;
    if(s.winner === null){
      const cw = G.season.cafCL?.winner || 'ahly'; const cc = G.season.cafCC?.winner || 'zamalek';
      const winner = R() < .5 ? cw : cc;
      s.winner = winner; s.played = true;
      if(winner === G.my){ G.trophies = (G.trophies||0)+1; addTrophy('السوبر الأفريقي', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1); addNews(`🌍 ${T[G.my].name} بطل السوبر الأفريقي!`, `🏆 فوز على ${T[s.opp]?.name || s.opp}`); }
    }
  }
}

// ✅ الدالة المعدلة لحل مشكلة التعليق وتكرار المباريات
function nxt(){
  try{
    $('rs').hidden = true; $('ms').hidden = true; pendingLvl = []; 
    
    // 1. إجبار إنهاء المباراة الحالية إذا كانت عالقة
    if (typeof Mt !== 'undefined' && Mt !== null) {
        const currentMatch = G.season.userCalendar.find(m => !m.played);
        if (currentMatch) {
            currentMatch.played = true;
            if(!currentMatch.result) {
                const mg = Mt.s && Mt.s[Mt.hu] ? Mt.s[Mt.hu].g : 0;
                const og = Mt.s && Mt.s[Mt.hu === 'home' ? 'away' : 'home'] ? Mt.s[Mt.hu === 'home' ? 'away' : 'home'].g : 0;
                currentMatch.result = {myGoals: mg, oppGoals: og, won: mg > og, draw: mg === og};
            }
        }
        Mt.fin = 1;
        Mt = null;
    }

    checkLegendsMarket(); checkPlayerOfMonth(); resolveSuperCups();
    
    // 2. البحث عن المباراة التالية
    const nm = getNextUserMatch();
    if(!nm || G.season.currentDay >= 360){ endSeason(); return; }
    
    // 3. تقديم التاريخ لليوم التالي إذا لزم الأمر
    if(nm.day > G.season.currentDay) {
        advanceToDay(nm.day);
    }
    
    simulateLivingWorld(); save(); dash();
    if(G.pendingOffer) setTimeout(() => showOffer(), 300);
  } catch(e){ 
    console.error('nxt err:', e); 
    alert('حدث خطأ أثناء الانتقال لليوم التالي: ' + e.message); 
    save();
  }
}

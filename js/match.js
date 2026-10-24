// ============================================
// match.js - واجهة المباراة
// ============================================

function playTournamentMatch() { G.forcedMatchComp = 'tournament'; play(); }
function playLeagueMatch() { G.forcedMatchComp = 'league'; play(); }

// ... (نفس كود دالة play و createVirtualTeam و loop و ui و man و drawPitch و draw و mtac و pz و spd و subm و doSub و skip و syncMatchStats) ...

function finish(){
  try{
    cancelAnimationFrame(raf);
    if(Mt.fin) return;
    Mt.fin = 1;

    const nm = getNextUserMatch(G.forcedMatchComp || null);
    const s = Mt.s;
    const mg = s[Mt.hu].g;
    const og = s[Mt.hu==='home' ? 'away' : 'home'].g;
    const myT = Mt.s[Mt.hu].t;
    const oppT = Mt.s[Mt.hu==='home' ? 'away' : 'home'].t;
    const cn = {league:'الدوري', cup:'كأس مصر', cafCL:'أبطال أفريقيا', cafCC:'الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم'};

    if(nm){
      nm.played = true;
      let rW = mg > og, rD = mg === og;
      const isKO = ['cup','cafCL','cafCC','super','cafSuper','clubWC'].includes(nm.comp);
      let pr = null;
      
      if(isKO && rD){
        try {
          pr = realPenaltyShootout(Mt.h, Mt.a);
          const pw = pr.winner === 'home' ? Mt.h.id : Mt.a.id;
          if(pw === G.my) rW = true;
          showPenaltyModal(pr, Mt.h.name, Mt.a.name);
        } catch(err){ console.error('Penalty error:', err); }
      }

      nm.result = {myGoals:mg, oppGoals:og, won:rW, draw:rD, penalty:pr};

      // تسجيل الدوري
      if(nm.comp === 'league'){
        try {
          rec(Mt.h, Mt.a, s.home.g, s.away.g);
          const lf = G.season.leagueFixtures[nm.round];
          if(lf){
            const k = `${Mt.h.id}_${Mt.a.id}`;
            if(!lf.played.includes(k)) lf.played.push(k);
            lf.results = lf.results || {};
            lf.results[k] = [s.home.g, s.away.g];
            
            // محاكاة باقي الجولة
            lf.round.forEach(([h,a]) => {
              if(h === G.my || a === G.my) return;
              const pk2 = h+'_'+a;
              if(lf.played.includes(pk2)) return;
              const tH = T[h], tA = T[a];
              if(!tH || !tA) return;
              let p1 = tH.R, p2 = tA.R+2;
              if(tH.tac === 'attack') p1 += 1; else if(tH.tac === 'defense') p1 += .5;
              if(tA.tac === 'attack') p2 += 1; else if(tA.tac === 'defense') p2 += .5;
              const df2 = (p1-p2)/15;
              const g1 = Math.max(0, Math.round(R()*1.8+df2*.5));
              const g2 = Math.max(0, Math.round(R()*1.8-df2*.5));
              rec(tH, tA, g1, g2);
              lf.played.push(pk2);
              lf.results[pk2] = [g1, g2];
            });
          }
        } catch(e){ console.error('League rec error:', e); }
      }

      // تسجيل البطولات الإقصائية
      try {
        if(nm.comp === 'cup' && G.season.cupBracket){
          const m = G.season.cupBracket.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
          if(m){
            m.played = true;
            m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home);
            m.score = [s.home.g, s.away.g];
            advanceCupBracket();
          }
        }
        if(nm.comp === 'cafCL' && G.season.cafCL){
          const m = G.season.cafCL.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
          if(m){
            m.played = true;
            m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home);
            m.score = [s.home.g, s.away.g];
            advanceCafComp('cafCL');
          }
        }
        if(nm.comp === 'cafCC' && G.season.cafCC){
          const m = G.season.cafCC.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
          if(m){
            m.played = true;
            m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home);
            m.score = [s.home.g, s.away.g];
            advanceCafComp('cafCC');
          }
        }
        if(nm.comp === 'super' && G.season.egyptSuper){
          G.season.egyptSuper.played = true;
          G.season.egyptSuper.winner = rW ? G.my : nm.opp;
          G.season.egyptSuper.score = [mg, og];
          if(rW){
            G.trophies = (G.trophies||0)+1;
            addTrophy('السوبر المصري', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1);
            addNews(`🏆 ${myT.name} بطل السوبر المصري!`, `🎉 فوز على ${oppT.name}`);
          }
        }
        if(nm.comp === 'cafSuper' && G.season.cafSuper){
          G.season.cafSuper.played = true;
          G.season.cafSuper.winner = rW ? G.my : nm.opp;
          G.season.cafSuper.score = [mg, og];
          if(rW){
            G.trophies = (G.trophies||0)+1;
            addTrophy('السوبر الأفريقي', G.seasonNumber, SEASON_YEAR+G.seasonNumber-1);
            addNews(`🌍 ${myT.name} بطل السوبر الأفريقي!`, `🏆 فوز على ${oppT.name}`);
          }
        }
        if(nm.comp === 'clubWC' && G.season.clubWC){
          const m = G.season.clubWC.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
          if(m){
            m.played = true;
            m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home);
            m.score = [s.home.g, s.away.g];
            advanceClubWC();
          }
        }
      } catch(e){ console.error('Tournament advancement error:', e); }
    }

    // ... (بقية تحديثات الإحصائيات والميزانية والنتيجة نفسها) ...
    
    // إظهار شاشة النتيجة
    $('rs').hidden = false;
    G.forcedMatchComp = null;

  } catch(e){
    console.error('Fatal finish error:', e);
    const nm = getNextUserMatch(G.forcedMatchComp || null);
    if(nm) nm.played = true;
    G.forcedMatchComp = null;
    save();
    $('rs').hidden = false;
  }
}

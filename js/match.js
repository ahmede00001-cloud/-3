// ============================================
// إنهاء المباراة (نسخة نهائية تمنع التكرار جذرياً)
// ============================================
function finish(){
  try{
    cancelAnimationFrame(raf);
    if(Mt.fin) return;
    Mt.fin = 1;

    // 1. تحديد بيانات المباراة الحالية بدقة
    const nm = Mt.matchData || getNextUserMatch(G.forcedMatchComp || null);
    const s = Mt.s;
    const mg = s[Mt.hu].g;
    const og = s[Mt.hu==='home' ? 'away' : 'home'].g;
    const myT = Mt.s[Mt.hu].t;
    const oppT = Mt.s[Mt.hu==='home' ? 'away' : 'home'].t;
    const cn = {league:'الدوري', cup:'كأس مصر', cafCL:'أبطال أفريقيا', cafCC:'الكونفدرالية', super:'السوبر المصري', cafSuper:'السوبر الأفريقي', clubWC:'كأس العالم'};

    if(nm){
      nm.played = true;
      
      // ✅ الحل الجذري: حذف المباراة نهائياً من جدول التقويم باستخدام خصائصها الفريدة لمنع تكرارها
      if(G.season && G.season.userCalendar){
        G.season.userCalendar = G.season.userCalendar.filter(m => !(m.comp === nm.comp && m.round === nm.round && m.day === nm.day));
      }
      
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

      // حفظ التقويم فوراً بعد الحذف لضمان تحديث الذاكرة المحلية
      save(); 

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
          }
        } catch(e){ console.error('League rec error:', e); }
      }

      // تسجيل التقدم في البطولات الإقصائية (الكأس وأبطال أفريقيا)
      try {
        if(nm.comp === 'cup' && G.season.cupBracket){
          const m = G.season.cupBracket.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
          if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); m.score = [s.home.g, s.away.g]; advanceCupBracket(); }
        }
        if(nm.comp === 'cafCL' && G.season.cafCL){
          const m = G.season.cafCL.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
          if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); m.score = [s.home.g, s.away.g]; advanceCafComp('cafCL'); }
        }
        if(nm.comp === 'cafCC' && G.season.cafCC){
          const m = G.season.cafCC.rounds[nm.round]?.find(x => x.home===G.my || x.away===G.my);
          if(m){ m.played = true; m.winner = rW ? G.my : (m.home===G.my ? m.away : m.home); m.score = [s.home.g, s.away.g]; advanceCafComp('cafCC'); }
        }
      } catch(e){ console.error('Tournament advancement error:', e); }
    }

    // مزامنة إحصائيات اللاعبين والمعنويات
    try {
      syncMatchStats(Mt);
      let rW = mg > og, rD = mg === og;
      updateMorale(myT, rW ? 'win' : (rD ? 'draw' : 'loss'));
      updateMorale(oppT, rW ? 'loss' : (rD ? 'draw' : 'win'));
      updateContractMorale(myT);
    } catch(e){ console.error('Stats sync error:', e); }

    // الاقتصاد والميزانية
    let netIncome = 0;
    try {
      let rW = mg > og, rD = mg === og;
      const totalSalary = myT.ps.reduce((sum, p) => sum+(p.contract?.salary||0), 0);
      const baseIncome = rW ? 15 : rD ? 8 : 3;
      const sponsorInc = G.currentSponsor ? (G.currentSponsor.safe/20) : 0;
      netIncome = Math.round((baseIncome+sponsorInc-totalSalary)*10)/10;
      myT.budget = Math.round((myT.budget+netIncome)*10)/10;
    } catch(e){ console.error('Finance error:', e); }

    save();

    // عرض شاشة النتيجة النهائية
    let rW = mg > og, rD = mg === og;
    const rsIcon = rW ? '🏆' : rD ? '🤝' : '😞';
    const rsTitle = rW ? 'فوز رائع!' : rD ? 'تعادل مثير' : 'خسارة صعبة';
    const rsClass = rW ? 'mc-success' : rD ? 'mc-warning' : 'mc-danger';
    const rsEmoji = rW ? '🎉' : rD ? '🤝' : '😔';

    document.getElementById('rs-mc').className = 'mc '+rsClass;
    $('rs-icon').textContent = rsIcon;
    $('rs-title').textContent = rsTitle;
    $('rcomp').textContent = cn[nm?.comp]||'مباراة';
    $('rst').innerHTML = `📊 <b>استحواذ:</b> ${Math.round(100*s.home.ps/(s.home.ps+s.away.ps||1))}% • <b>تسديدات:</b> ${s.home.sh}-${s.away.sh}`;
    $('rsc').textContent = `${Mt.h.name} ${s.home.g} - ${s.away.g} ${Mt.a.name}`;
    $('rso').innerHTML = `${rsEmoji} ${rW?'فوز!':rD?'تعادل':'خسارة'}`;
    $('rso').style.color = rW ? '#22c55e' : rD ? '#fbbf24' : '#ef4444';
    $('rfin').innerHTML = `💰 صافي المباراة: <b style="color:${netIncome>=0?'#4ade80':'#f87171'}">${netIncome>=0?'+':''}${netIncome.toFixed(1)}M</b>`;
    if(pr){
      $('rpen').style.display = 'block';
      $('rpen').innerHTML = `🥅 ترجيح: ${pr.scoreA}-${pr.scoreB}`;
    } else $('rpen').style.display = 'none';
    
    $('rs').hidden = false;
    G.forcedMatchComp = null;

  } catch(e){
    console.error('Fatal finish error:', e);
    const nm = Mt.matchData || getNextUserMatch();
    if(nm) {
        G.season.userCalendar = G.season.userCalendar.filter(m => !(m.comp === nm.comp && m.round === nm.round && m.day === nm.day));
    }
    G.forcedMatchComp = null;
    save();
    $('rs').hidden = false;
  }
}

// ============================================
// multiplayer.js - نظام الدوريات الجماعية
// ============================================

let currentLeague = null;
let currentLeagueMembers = [];
let currentLeagueFixtures = [];

// ============================================
// توليد كود عشوائي
// ============================================
function genLeagueCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ============================================
// أخذ لقطة (Snapshot) من فريق اللاعب
// ============================================
function buildTeamSnapshot() {
  const team = T[G.my];
  const starterIds = G.lu.filter(id => id);
  const starterPlayers = starterIds.map(id => {
    const p = team.ps.find(x => x.id === id);
    return p ? cleanPlayer(p) : null;
  }).filter(Boolean);
  
  const benchPlayers = team.ps
    .filter(p => !starterIds.includes(p.id) && !p.injury && !p.susp)
    .sort((a, b) => b.r - a.r).slice(0, 7)
    .map(cleanPlayer);
  
  return {
    name: team.name,
    form: G.form,
    tac: G.tac,
    captain: G.captain,
    penaltyTaker: G.penaltyTaker,
    freeKickTaker: G.freeKickTaker,
    cornerTaker: G.cornerTaker,
    starters: starterPlayers,
    bench: benchPlayers
  };
}

function cleanPlayer(p) {
  return {
    id: p.id, name: p.name, pos: p.pos, secPos: p.secPos,
    r: p.r, lvl: p.lvl, age: p.age, xp: p.xp || 0,
    pace: p.pace, shooting: p.shooting, passing: p.passing,
    dribbling: p.dribbling, defending: p.defending, physical: p.physical,
    morale: p.morale || 70, fit: p.fit != null ? p.fit : 100
  };
}

// ============================================
// إعادة بناء فريق من Snapshot للمحرك
// ============================================
function buildTeamFromSnapshot(snapshot, teamId) {
  const ps = [...snapshot.starters, ...snapshot.bench].map(p => ({
    ...p,
    injury: null, susp: null,
    contract: { years: 2, salary: 0 }
  }));
  return {
    id: teamId,
    name: snapshot.name,
    R: Math.round(ps.reduce((a, p) => a + p.r, 0) / ps.length),
    c1: '#1e40af', c2: '#FFFFFF',
    budget: 100, ps, form: snapshot.form
  };
}

// ============================================
// إنشاء دوري جديد
// ============================================
async function createLeague(leagueName, maxPlayers) {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return alert('يجب تسجيل الدخول أولاً!');
  
  if (!G || !G.my) return alert('يجب أن تبدأ مسيرتك أولاً!');
  
  const code = genLeagueCode();
  const { data: league, error } = await _db.from('leagues').insert({
    name: leagueName,
    code: code,
    creator_id: user.id,
    max_players: maxPlayers,
    status: 'waiting',
    total_rounds: maxPlayers - 1
  }).select().single();
  
  if (error) return alert('خطأ: ' + error.message);
  
  // الانضمام التلقائي كمنشئ
  await _joinLeagueInternal(league.id, user.id);
  
  alert(`✅ تم إنشاء الدوري!\n\n🔑 كود الانضمام: ${code}\n\nشارك الكود مع أصدقائك ليدخلوا.`);
  openLeagueDetails(league.id);
}

// ============================================
// الانضمام لدوري بكود
// ============================================
async function joinLeagueByCode(code) {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return alert('يجب تسجيل الدخول أولاً!');
  if (!G || !G.my) return alert('يجب أن تبدأ مسيرتك أولاً!');
  
  const { data: league, error } = await _db.from('leagues')
    .select('*').eq('code', code.toUpperCase()).single();
  
  if (error || !league) return alert('❌ كود غير صحيح!');
  if (league.status !== 'waiting') return alert('❌ هذا الدوري بدأ بالفعل!');
  
  const { data: existing } = await _db.from('league_members')
    .select('id').eq('league_id', league.id).eq('user_id', user.id);
  if (existing && existing.length > 0) {
    openLeagueDetails(league.id);
    return;
  }
  
  const { data: members } = await _db.from('league_members').select('id').eq('league_id', league.id);
  if (members.length >= league.max_players) return alert('❌ الدوري ممتلئ!');
  
  await _joinLeagueInternal(league.id, user.id);
  alert('✅ تم الانضمام للدوري!');
  openLeagueDetails(league.id);
}

async function _joinLeagueInternal(leagueId, userId) {
  const snap = buildTeamSnapshot();
  const team = T[G.my];
  await _db.from('league_members').insert({
    league_id: leagueId,
    user_id: userId,
    manager_name: G.managerName,
    team_id: team.id,
    team_name: team.name,
    team_data: snap
  });
}

// ============================================
// بدء الدوري وتوليد المباريات
// ============================================
async function startLeague(leagueId) {
  const { data: { user } } = await _db.auth.getUser();
  const { data: league } = await _db.from('leagues').select('*').eq('id', leagueId).single();
  
  if (!league) return alert('الدوري غير موجود!');
  if (league.creator_id !== user.id) return alert('فقط منشئ الدوري يمكنه البدء!');
  if (league.status !== 'waiting') return alert('الدوري بدأ بالفعل!');
  
  const { data: members } = await _db.from('league_members').select('*').eq('league_id', leagueId);
  if (members.length < 4) return alert('تحتاج 4 لاعبين على الأقل للبدء!');
  
  // توليد Round Robin
  const fixtures = _roundRobin(members);
  for (const f of fixtures) {
    await _db.from('league_fixtures').insert({
      league_id: leagueId,
      round: f.round,
      home_member_id: f.home.id,
      away_member_id: f.away.id
    });
  }
  
  await _db.from('leagues').update({
    status: 'active',
    total_rounds: fixtures[fixtures.length - 1].round
  }).eq('id', leagueId);
  
  alert('✅ بدأ الدوري! حظاً موفقاً.');
  openLeagueDetails(leagueId);
}

function _roundRobin(members) {
  const teams = [...members];
  if (teams.length % 2 === 1) teams.push(null);
  const numRounds = teams.length - 1;
  const half = teams.length / 2;
  const fixtures = [];
  
  for (let r = 1; r <= numRounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = teams[i];
      const b = teams[teams.length - 1 - i];
      if (a && b) {
        if (r % 2 === 0) fixtures.push({ round: r, home: b, away: a });
        else fixtures.push({ round: r, home: a, away: b });
      }
    }
    teams.splice(1, 0, teams.pop());
  }
  return fixtures;
}

// ============================================
// عرض صفحة الدوريات (القائمة)
// ============================================
async function showLeaguesPage() {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return alert('يجب تسجيل الدخول أولاً!');
  
  $('main').innerHTML = `<div style="text-align:center; padding:20px;">⏳ جاري التحميل...</div>`;
  
  const { data: myLeagues } = await _db.from('league_members')
    .select('league_id, leagues(*)').eq('user_id', user.id);
  
  let html = `<div class="c" style="margin-top:10px;">
    <h2 style="text-align:center;color:var(--gold);margin-bottom:15px;font-size:18px">🏆 الدوريات الجماعية</h2>
    
    <button class="b g full" style="margin-bottom:10px;padding:14px;font-size:14px" onclick="showCreateLeagueModal()">➕ إنشاء دوري جديد</button>
    <button class="b a full" style="margin-bottom:20px;padding:14px;font-size:14px" onclick="showJoinLeagueModal()">🔑 الانضمام بكود</button>
    
    <div class="sec">📋 دورياتي</div>`;
  
  if (!myLeagues || myLeagues.length === 0) {
    html += `<div style="text-align:center;color:#94a3b8;padding:20px;">لا توجد دوريات. أنشئ واحداً أو انضم بكود!</div>`;
  } else {
    myLeagues.forEach(m => {
      const L = m.leagues;
      if (!L) return;
      const badge = L.status === 'waiting' ? '⏳ بانتظار' : (L.status === 'active' ? '🔴 جارٍ' : '✅ منتهي');
      const color = L.status === 'waiting' ? '#fbbf24' : (L.status === 'active' ? '#ef4444' : '#4ade80');
      html += `
        <div class="pl" style="cursor:pointer;padding:12px;" onclick="openLeagueDetails('${L.id}')">
          <div style="flex:1;">
            <b style="color:#fff;font-size:13px;">${L.name}</b>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">🔑 ${L.code}</div>
          </div>
          <div style="color:${color};font-size:11px;font-weight:900;">${badge}</div>
        </div>`;
    });
  }
  
  html += `</div>`;
  $('main').innerHTML = html;
}

function showCreateLeagueModal() {
  const name = prompt('اسم الدوري:', `${G.managerName} League`);
  if (!name) return;
  const maxStr = prompt('عدد اللاعبين (4 أو 6 أو 8):', '4');
  const max = parseInt(maxStr);
  if (![4, 6, 8].includes(max)) return alert('اختر 4 أو 6 أو 8 فقط!');
  createLeague(name, max);
}

function showJoinLeagueModal() {
  const code = prompt('أدخل كود الانضمام:');
  if (!code) return;
  joinLeagueByCode(code);
}

// ============================================
// فتح صفحة تفاصيل الدوري
// ============================================
async function openLeagueDetails(leagueId) {
  $('main').innerHTML = `<div style="text-align:center; padding:20px;">⏳ جاري التحميل...</div>`;
  
  const { data: { user } } = await _db.auth.getUser();
  const { data: league } = await _db.from('leagues').select('*').eq('id', leagueId).single();
  if (!league) return alert('الدوري غير موجود!');
  
  const { data: members } = await _db.from('league_members').select('*').eq('league_id', leagueId);
  const { data: fixtures } = await _db.from('league_fixtures').select('*').eq('league_id', leagueId).order('round');
  
  currentLeague = league;
  currentLeagueMembers = members;
  currentLeagueFixtures = fixtures;
  
  const me = members.find(m => m.user_id === user.id);
  const isCreator = league.creator_id === user.id;
  
  // ترتيب الجدول
  const sorted = [...members].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aGD = a.goals_for - a.goals_against;
    const bGD = b.goals_for - b.goals_against;
    return bGD - aGD;
  });
  
  let html = `<div class="c" style="margin-top:10px;">
    <button class="b sm" style="padding:4px 10px; font-size:10px; margin-bottom:10px;" onclick="showLeaguesPage()">⬅ العودة</button>
    <h2 style="color:var(--gold);font-size:16px;margin-bottom:5px;">🏆 ${league.name}</h2>
    <div style="text-align:center;font-size:11px;color:#94a3b8;margin-bottom:15px;">
      🔑 ${league.code} • 👥 ${members.length}/${league.max_players}
    </div>`;
  
  if (league.status === 'waiting') {
    if (isCreator && members.length >= 2) {
      html += `<button class="b g full" style="padding:14px;margin-bottom:15px;" onclick="startLeague('${league.id}')">🚀 ابدأ الدوري</button>`;
    } else if (isCreator) {
      html += `<div style="text-align:center;padding:10px;background:rgba(251,191,36,.1);border-radius:8px;color:#fbbf24;font-size:11px;margin-bottom:15px;">
        ⏳ بانتظار انضمام لاعبين آخرين (2 على الأقل)
      </div>`;
    } else {
      html += `<div style="text-align:center;padding:10px;background:rgba(251,191,36,.1);border-radius:8px;color:#fbbf24;font-size:11px;margin-bottom:15px;">
        ⏳ بانتظار بدء الدوري من المنشئ
      </div>`;
    }
  }
  
  // جدول الترتيب
  html += `<div class="sec">📊 جدول الترتيب</div>
    <table style="width:100%;font-size:11px;">
      <tr style="color:var(--gold);">
        <th>#</th><th style="text-align:right">المدرب</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>ن</th>
      </tr>`;
  sorted.forEach((m, i) => {
    const isMe = m.user_id === user.id;
    const gd = m.goals_for - m.goals_against;
    html += `<tr style="${isMe ? 'background:rgba(251,191,36,.1);border:1px solid var(--gold);' : ''}">
      <td>${i + 1}</td>
      <td style="text-align:right;font-weight:bold;">${m.team_name} ${isMe ? '⭐' : ''}<div style="font-size:9px;color:#94a3b8;font-weight:normal;">${m.manager_name}</div></td>
      <td>${m.played}</td><td>${m.won}</td><td>${m.drawn}</td><td>${m.lost}</td>
      <td>${gd > 0 ? '+' : ''}${gd}</td>
      <td style="color:var(--gold);font-weight:900;">${m.points}</td>
    </tr>`;
  });
  html += `</table>`;
  
  // المباريات
  if (league.status === 'active' && me) {
    html += `<div class="sec" style="margin-top:15px;">📅 مبارياتي</div>`;
    const myFixtures = fixtures.filter(f => (f.home_member_id === me.id || f.away_member_id === me.id));
    const currentRound = Math.min(...myFixtures.filter(f => !f.played).map(f => f.round));
    
    myFixtures.forEach(f => {
      const isHome = f.home_member_id === me.id;
      const oppId = isHome ? f.away_member_id : f.home_member_id;
      const opp = members.find(m => m.id === oppId);
      if (!opp) return;
      const isCurrent = !f.played && f.round === currentRound;
      
      html += `<div style="background:${isCurrent ? 'rgba(251,191,36,.15)' : 'rgba(15,34,56,.5)'};border:${isCurrent ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,.1)'};border-radius:10px;padding:10px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-bottom:4px;">
          <span>الجولة ${f.round}</span>
          <span>${f.played ? '✅' : '⏳'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">
          <b style="color:#fff;">${T[G.my].name}</b>
          <span style="color:var(--gold);font-weight:900;">${f.played ? `${f.home_score} - ${f.away_score}` : 'VS'}</span>
          <b style="color:#fff;">${opp.team_name}</b>
        </div>
        ${isCurrent ? `<button class="b g full" style="margin-top:8px;padding:10px;" onclick="playLeagueMatch('${f.id}')">⚽ العب المباراة</button>` : ''}
      </div>`;
    });
  }
  
  html += `</div>`;
  $('main').innerHTML = html;
}

// ============================================
// لعب مباراة في الدوري
// ============================================
async function playLeagueMatch(fixtureId) {
  const { data: { user } } = await _db.auth.getUser();
  const fixture = currentLeagueFixtures.find(f => f.id === fixtureId);
  if (!fixture) return alert('المباراة غير موجودة!');
  if (fixture.played) return alert('المباراة لُعبت بالفعل!');
  
  const me = currentLeagueMembers.find(m => m.user_id === user.id);
  if (!me) return alert('أنت لست عضواً!');
  if (fixture.home_member_id !== me.id && fixture.away_member_id !== me.id) return alert('هذه ليست مباراتك!');
  
  const isHome = fixture.home_member_id === me.id;
  const oppId = isHome ? fixture.away_member_id : fixture.home_member_id;
  const opp = currentLeagueMembers.find(m => m.id === oppId);
  if (!opp) return alert('الخصم غير موجود!');
  
  // نبني فريق الخصم من Snapshot
  const oppTeamId = 'OPP_' + opp.id.substring(0, 6);
  T[oppTeamId] = buildTeamFromSnapshot(opp.team_data, oppTeamId);
  
  // نبني التشكيلة الأساسية للخصم
  const oppLineup = opp.team_data.starters.map(p => p.id);
  
  // نبدأ المباراة (نستخدم محرك اللعبة الموجود)
  const matchConfig = {
    h: isHome ? T[G.my] : T[oppTeamId],
    a: isHome ? T[oppTeamId] : T[G.my],
    hl: isHome ? G.lu : oppLineup,
    al: isHome ? oppLineup : G.lu,
    hf: isHome ? G.form : opp.team_data.form,
    af: isHome ? opp.team_data.form : G.form,
    ht: isHome ? G.tac : opp.team_data.tac,
    at: isHome ? opp.team_data.tac : G.tac,
    human: isHome ? 'home' : 'away',
    compName: `🏆 ${currentLeague.name}`,
    weather: WEATHERS[0]
  };
  
  // نفتح شاشة المباراة الحية
  window._leagueFixtureId = fixtureId;
  window._leagueIsHome = isHome;
  
  if (typeof startLiveMatch === 'function') {
    startLiveMatch(matchConfig, 'league');
  } else {
    // محاكاة مباشرة إن لم توجد شاشة حية
    simulateLeagueMatchInstant(matchConfig, fixtureId, isHome);
  }
}

async function simulateLeagueMatchInstant(config, fixtureId, isHome) {
  const m = new Match(config);
  // تشغيل سريع
  let safety = 0;
  while (!m.done && safety < 20000) {
    m.step();
    safety++;
  }
  await finalizeLeagueMatch(fixtureId, isHome, m.s.home.g, m.s.away.g);
}

// ============================================
// إنهاء المباراة وحفظ النتيجة
// ============================================
async function finalizeLeagueMatch(fixtureId, isHome, homeScore, awayScore) {
  const { data: { user } } = await _db.auth.getUser();
  
  // تحديث المباراة
  await _db.from('league_fixtures').update({
    home_score: homeScore,
    away_score: awayScore,
    played: true,
    played_by: user.id,
    played_at: new Date().toISOString()
  }).eq('id', fixtureId);
  
  // تحديث إحصائيات الطرفين
  const fixture = currentLeagueFixtures.find(f => f.id === fixtureId);
  if (!fixture) return;
  
  const homeM = currentLeagueMembers.find(m => m.id === fixture.home_member_id);
  const awayM = currentLeagueMembers.find(m => m.id === fixture.away_member_id);
  if (!homeM || !awayM) return;
  
  const homeWin = homeScore > awayScore;
  const draw = homeScore === awayScore;
  
  // تحديث الفريق المضيف
  await _db.from('league_members').update({
    played: homeM.played + 1,
    won: homeM.won + (homeWin ? 1 : 0),
    drawn: homeM.drawn + (draw ? 1 : 0),
    lost: homeM.lost + (!homeWin && !draw ? 1 : 0),
    goals_for: homeM.goals_for + homeScore,
    goals_against: homeM.goals_against + awayScore,
    points: homeM.points + (homeWin ? 3 : (draw ? 1 : 0))
  }).eq('id', homeM.id);
  
  // تحديث الفريق الضيف
  await _db.from('league_members').update({
    played: awayM.played + 1,
    won: awayM.won + (!homeWin && !draw ? 1 : 0),
    drawn: awayM.drawn + (draw ? 1 : 0),
    lost: awayM.lost + (homeWin ? 1 : 0),
    goals_for: awayM.goals_for + awayScore,
    goals_against: awayM.goals_against + homeScore,
    points: awayM.points + (!homeWin && !draw ? 3 : (draw ? 1 : 0))
  }).eq('id', awayM.id);
  
  alert(`✅ تم حفظ النتيجة: ${homeScore} - ${awayScore}`);
  
  // التحقق من انتهاء الدوري
  await checkLeagueFinished(currentLeague.id);
  
  openLeagueDetails(currentLeague.id);
}

async function checkLeagueFinished(leagueId) {
  const { data: fixtures } = await _db.from('league_fixtures').select('*').eq('league_id', leagueId);
  const allPlayed = fixtures.every(f => f.played);
  if (allPlayed) {
    await _db.from('leagues').update({ status: 'finished' }).eq('id', leagueId);
  }
}

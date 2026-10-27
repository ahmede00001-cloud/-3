// ============================================
// multiplayer.js - نظام الغرف (موسم حقيقي + خيار المحاكاة)
// ============================================

let currentLobby = null;
let currentSlots = [];
let currentMatches = [];
let liveInterval = null;
let timeLeftInterval = null;
let mpCompInterval = null; 
let mySlot = null;
let isSeasonStarting = false;
let globalWatcherInterval = null; 

const BOT_UUID = '00000000-0000-0000-0000-000000000000'; 

function ensureG() { if (typeof G === 'undefined' || !G) G = {}; }

function stopLobbyTimers() {
    if (liveInterval) clearInterval(liveInterval);
    if (timeLeftInterval) clearInterval(timeLeftInterval);
    if (mpCompInterval) clearInterval(mpCompInterval);
    if (globalWatcherInterval) clearInterval(globalWatcherInterval);
    liveInterval = null; timeLeftInterval = null; mpCompInterval = null; globalWatcherInterval = null;
}

async function resignFromLobby() {
    if (!G || !G.multiplayerLeagueId) return alert('أنت لست مشتركاً في أي غرفة حالياً.');
    if (!confirm("هل أنت متأكد من تقديم الاستقالة؟")) return;
    try {
        $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold); font-weight:bold;">⏳ جاري تقديم الاستقالة...</div>`;
        const { data: { user } } = await _db.auth.getUser();
        if (!user) throw new Error("يجب تسجيل الدخول أولاً.");
        await _db.from('lobby_slots').update({ user_id: null, manager_name: null, team_snapshot: null }).eq('lobby_id', G.multiplayerLeagueId).eq('user_id', user.id);
        delete G.multiplayerLeagueId;
        stopLobbyTimers();
        if (typeof stopLiveBroadcast === 'function') stopLiveBroadcast();
        save();
        alert('✅ تم تقديم استقالتك بنجاح.');
        showLeaguesPage();
    } catch (err) { alert('حدث خطأ: ' + err.message); dash(); }
}

function generateBotSnapshot(teamName) {
    const posList = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
    const starters = posList.map((pos, i) => ({
        id: 'BOT_' + Math.random().toString(36).substr(2, 9),
        name: 'لاعب ' + (i+1), pos: pos, r: 70 + Math.floor(Math.random() * 15), lvl: 1, age: 24,
        pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70
    }));
    return { name: teamName, R: 75, c1: '#1e293b', c2: '#fff', form: '4-3-3', tac: 'balanced', starters: starters };
}

function ensureLocalGameReady(slot) {
    try {
        ensureG(); 
        if (typeof T === 'undefined' || Object.keys(T).length === 0) { if (typeof mk === 'function') mk('egypt'); }
        if (slot && slot.team_id && T[slot.team_id]) G.my = slot.team_id;
        else if (!G.my || !T[G.my]) G.my = Object.keys(T)[0];
        G.form = G.form || '4-3-3'; G.tac = G.tac || 'balanced';
        G.lu = autoFillLineup(T[G.my], G.form);
        if (!G.season && typeof generateSeason === 'function') G.season = generateSeason(G.my, null);
    } catch (e) { console.error(e); }
}

async function showLeaguesPage() {
    stopLobbyTimers(); isSeasonStarting = false; ensureG(); 
    
    if (G.multiplayerLeagueId) {
        try {
            const { data: { user } } = await _db.auth.getUser();
            if (user) {
                const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', G.multiplayerLeagueId).eq('user_id', user.id);
                if (slots && slots.length > 0) {
                    mySlot = slots[0]; ensureLocalGameReady(mySlot); startGlobalLobbyWatcher();
                    if (typeof initLiveBroadcast === 'function') initLiveBroadcast(G.multiplayerLeagueId);
                    if (typeof dash === 'function') { dash(); return; }
                }
            }
        } catch (e) { console.error(e); }
    }

    $('main').innerHTML = `<div style="text-align:center; padding:50px 20px;"><div style="font-size:40px; animation: logoBounce 1s infinite alternate;">⏳</div><div style="color:var(--gold); font-weight:bold; margin-top:15px; font-size:16px;">جاري البحث عن غرفة...</div></div>`;

    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) throw new Error("يجب تسجيل الدخول أولاً");

        const { data: mySlots } = await _db.from('lobby_slots').select('lobby_id, lobbies!inner(id, status)').eq('user_id', user.id).in('lobbies.status', ['waiting', 'active']).limit(1);

        if (mySlots && mySlots.length > 0) {
            const { data: lobbyData } = await _db.from('lobbies').select('*').eq('id', mySlots[0].lobby_id).single();
            currentLobby = lobbyData; G.multiplayerLeagueId = currentLobby.id; save();
            await loadLobbyData(); ensureLocalGameReady(mySlot); startGlobalLobbyWatcher();
            if (typeof initLiveBroadcast === 'function') initLiveBroadcast(currentLobby.id);
            
            if (mySlot) { if (typeof dash === 'function') { dash(); return; } } 
            else if (currentLobby.status === 'active') { if (typeof dash === 'function') { dash(); return; } } 
            else { renderWaitingRoom(); startCountdownTimer(); liveInterval = setInterval(fetchUpdates, 3000); }
            return;
        }

        let { data: openLobbies } = await _db.from('lobbies').select('*').eq('status', 'waiting').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true });
        let availableLobbies = [];
        if (openLobbies) {
            for (const l of openLobbies) {
                const { count } = await _db.from('lobby_slots').select('*', { count: 'exact', head: true }).eq('lobby_id', l.id).not('user_id', 'is', null);
                if (count < 10) availableLobbies.push({ lobby: l, count: count });
            }
        }
        availableLobbies.sort((a, b) => b.count - a.count);

        if (availableLobbies.length > 0) { currentLobby = availableLobbies[0].lobby; }
        else {
            const expDate = new Date(Date.now() + 60 * 60000).toISOString();
            const { data: newLobby, error } = await _db.from('lobbies').insert({ status: 'waiting', expires_at: expDate }).select().single();
            if (error) throw error;
            const teams = LEAGUES['egypt'].teams.slice(0, 10);
            await _db.from('lobby_slots').insert(teams.map(t => ({ lobby_id: newLobby.id, team_id: t[0], team_name: t[1] })));
            currentLobby = newLobby;
        }

        await loadLobbyData(); renderWaitingRoom(); startCountdownTimer(); liveInterval = setInterval(fetchUpdates, 3000);
        if (typeof initLiveBroadcast === 'function') initLiveBroadcast(currentLobby.id);
        
    } catch (error) {
        $('main').innerHTML = `<div class="c" style="text-align:center; color:#ef4444; padding:20px;">خطأ: ${error.message}<br><br><button class="b a" onclick="showLeaguesPage()">إعادة المحاولة</button></div>`;
    }
}

async function loadLobbyData() {
    try {
        const { data: { user } } = await _db.auth.getUser();
        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id).order('team_name');
        currentSlots = slots || [];
        mySlot = currentSlots.find(s => s.user_id === user.id) || null;
    } catch (e) { console.error(e); }
}

async function fetchUpdates() {
    if (!currentLobby) return;
    try {
        const { data: lobby } = await _db.from('lobbies').select('*').eq('id', currentLobby.id).single();
        if (lobby) currentLobby = lobby;

        if (currentLobby.status === 'active') { stopLobbyTimers(); ensureLocalGameReady(mySlot); if (typeof dash === 'function') dash(); return; }

        if (currentLobby.status === 'waiting') {
            const timeUp = new Date(currentLobby.expires_at).getTime() <= new Date().getTime();
            const isFull = currentSlots.filter(s => s.user_id && s.user_id !== BOT_UUID).length >= 10;
            if ((timeUp || isFull) && !isSeasonStarting) { isSeasonStarting = true; await tryStartSeason(); return; }
        }

        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id).order('team_name');
        const newSlots = slots || [];
        if (JSON.stringify(newSlots) !== JSON.stringify(currentSlots)) {
            currentSlots = newSlots;
            const { data: { user } } = await _db.auth.getUser();
            mySlot = currentSlots.find(s => s.user_id === user.id) || null;
            renderWaitingRoom();
        }
    } catch (e) { console.error(e); }
}

function startCountdownTimer() {
    if (timeLeftInterval) clearInterval(timeLeftInterval);
    timeLeftInterval = setInterval(() => {
        const el = document.getElementById('live-countdown');
        if (!el || !currentLobby) return;
        const diff = Math.max(0, new Date(currentLobby.expires_at).getTime() - new Date().getTime());
        const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
        el.textContent = `⏳ ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

async function forceGenerateMatches(lobbyId) {
    try {
        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobbyId);
        if (!slots || slots.length < 2) return false;

        for (const slot of slots) {
            if (!slot.user_id) {
                const botSnap = generateBotSnapshot(slot.team_name);
                await _db.from('lobby_slots').update({
                    user_id: BOT_UUID, manager_name: 'مدرب آلي', team_snapshot: botSnap,
                    played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0
                }).eq('id', slot.id);
            }
        }

        const { data: freshSlots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobbyId);
        const fixtures = generateDoubleRoundRobin(freshSlots);

        const now = Date.now();
        const roundInterval = 24 * 60 * 60 * 1000; // ⏱️ 24 ساعة بين كل جولة

        const inserts = fixtures.map(f => ({
            lobby_id: lobbyId, round: f.round, home_slot_id: f.home.id, away_slot_id: f.away.id,
            scheduled_time: new Date(now + (f.round - 1) * roundInterval).toISOString()
        }));
        
        const { error } = await _db.from('lobby_matches').insert(inserts);
        if (error) throw error;
        
        return true;
    } catch (e) {
        console.error("Force Generate Error:", e);
        return false;
    }
}

async function tryStartSeason() {
    if (!currentLobby || currentLobby.status !== 'waiting') return;
    try {
        const { data: freshSlots } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id);
        const activeSlots = freshSlots.filter(s => s.user_id && s.user_id !== BOT_UUID);
        
        if (activeSlots.length < 1) {
            await _db.from('lobbies').update({ status: 'waiting', expires_at: new Date(Date.now() + 60 * 60000).toISOString() }).eq('id', currentLobby.id);
            isSeasonStarting = false; 
            return;
        }

        const { data: updated } = await _db.from('lobbies').update({ status: 'active' }).eq('id', currentLobby.id).eq('status', 'waiting').select();
        if (!updated || updated.length === 0) { isSeasonStarting = false; return; }

        const success = await forceGenerateMatches(currentLobby.id);
        if (!success) throw new Error("فشل في توليد المباريات، يرجى التأكد من إعدادات قاعدة البيانات.");

        if (typeof broadcastEvent === 'function') broadcastEvent('🏆 بدأ الموسم رسمياً! (ذهاب وإياب)', true);
        alert("⏳ بدأ الموسم رسمياً (ذهاب وإياب)!");
        stopLobbyTimers(); startGlobalLobbyWatcher(); ensureLocalGameReady(mySlot);
        if (typeof dash === 'function') dash(); 
    } catch (e) { 
        console.error("Start Season Error:", e); 
        alert("حدث خطأ أثناء بدء الموسم: " + e.message);
        isSeasonStarting = false;
    }
}

function generateDoubleRoundRobin(teams) {
    let ts = [...teams]; if (ts.length % 2 !== 0) ts.push(null);
    const rounds = ts.length - 1, half = ts.length / 2;
    let fixtures = [];
    for (let r = 1; r <= rounds; r++) {
        for (let i = 0; i < half; i++) {
            const a = ts[i], b = ts[ts.length - 1 - i];
            if (a && b) fixtures.push({ round: r, home: a, away: b });
        }
        ts.splice(1, 0, ts.pop());
    }
    const fhl = fixtures.length;
    for (let i = 0; i < fhl; i++) {
        const o = fixtures[i];
        fixtures.push({ round: o.round + rounds, home: o.away, away: o.home });
    }
    return fixtures;
}

async function processDueBotMatches(lobbyId) {
    try {
        const now = new Date().getTime();
        const { data: matches } = await _db.from('lobby_matches').select('*').eq('lobby_id', lobbyId).eq('played', false);
        if (!matches || matches.length === 0) return;
        
        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobbyId);
        if (!slots) return;
        
        for (const m of matches) {
            const matchTime = m.scheduled_time ? new Date(m.scheduled_time).getTime() : 0;
            if (now < matchTime) continue;
            
            const homeSlot = slots.find(s => s.id === m.home_slot_id);
            const awaySlot = slots.find(s => s.id === m.away_slot_id);
            if (!homeSlot || !awaySlot) continue;
            
            const homeIsBot = homeSlot.user_id === BOT_UUID;
            const awayIsBot = awaySlot.user_id === BOT_UUID;
            
            if (homeIsBot && awayIsBot) {
                const hTeam = buildTeamFromSnapshot(homeSlot.team_snapshot, 'BOT_H_'+homeSlot.id);
                const aTeam = buildTeamFromSnapshot(awaySlot.team_snapshot, 'BOT_A_'+awaySlot.id);
                
                const matchConfig = {
                    h: hTeam, a: aTeam,
                    hl: hTeam.ps.slice(0,11), al: aTeam.ps.slice(0,11),
                    hf: hTeam.form, af: aTeam.form, ht: hTeam.tac, at: aTeam.tac,
                    human: 'home', compName: 'AI Match', weather: WEATHERS[0]
                };
                
                const eng = new Match(matchConfig);
                let safety = 0;
                while (!eng.done && safety < 20000) { eng.step(); safety++; }
                
                const hg = eng.s.home.g; const ag = eng.s.away.g;
                
                await _db.from('lobby_matches').update({ home_score: hg, away_score: ag, played: true }).eq('id', m.id);
                await updateStandingsDb(homeSlot, awaySlot, hg, ag);
                
                if (typeof broadcastEvent === 'function') {
                    broadcastEvent(`🤖 ${homeSlot.team_name} ${hg} - ${ag} ${awaySlot.team_name}`, true);
                }
            }
        }
    } catch (e) { console.error("Bot sim error:", e); }
}

async function updateStandingsDb(homeSlot, awaySlot, hg, ag) {
    const homeWin = hg > ag; const draw = hg === ag;
    await _db.from('lobby_slots').update({
        played: (homeSlot.played || 0) + 1, won: (homeSlot.won || 0) + (homeWin ? 1 : 0), drawn: (homeSlot.drawn || 0) + (draw ? 1 : 0),
        lost: (homeSlot.lost || 0) + (!homeWin && !draw ? 1 : 0), goals_for: (homeSlot.goals_for || 0) + hg,
        goals_against: (homeSlot.goals_against || 0) + ag, points: (homeSlot.points || 0) + (homeWin ? 3 : (draw ? 1 : 0))
    }).eq('id', homeSlot.id);
    await _db.from('lobby_slots').update({
        played: (awaySlot.played || 0) + 1, won: (awaySlot.won || 0) + (!homeWin && !draw ? 1 : 0), drawn: (awaySlot.drawn || 0) + (draw ? 1 : 0),
        lost: (awaySlot.lost || 0) + (homeWin ? 1 : 0), goals_for: (awaySlot.goals_for || 0) + ag,
        goals_against: (awaySlot.goals_against || 0) + hg, points: (awaySlot.points || 0) + (!homeWin && !draw ? 3 : (draw ? 1 : 0))
    }).eq('id', awaySlot.id);
}

function renderWaitingRoom() {
    const joinedCount = currentSlots.filter(s => s.user_id && s.user_id !== BOT_UUID).length;
    const hasTeam = !!mySlot;
    const isFull = joinedCount >= 10;

    let html = `<div class="c" style="margin-top:10px; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <button class="b sm" style="padding:5px 10px; font-size:11px; background:#475569;" onclick="stopLobbyTimers(); showSetup()">⬅ خروج</button>
            <button class="b sm" style="padding:5px 10px; font-size:11px; background:#0284c7;" onclick="forceNewLobby()">🔄 غرفة جديدة</button>
        </div>
        
        <div style="text-align:center; margin-bottom:15px;">
            <div style="display:inline-block; background:rgba(239,68,68,.2); border:1px solid #ef4444; padding:4px 12px; border-radius:20px; color:#ef4444; font-size:12px; font-weight:bold; margin-bottom:8px;">🔴 غرفة الانتظار المباشرة</div>
            <h2 style="color:var(--gold); font-size:18px; margin-bottom:5px;">تحدي الـ 10 مدربين</h2>
            <div style="font-size:13px; color:#cbd5e1; margin-bottom:8px;">المنضمون: <b style="color:#4ade80">${joinedCount}</b> / 10</div>
            <div id="live-countdown" style="font-size:20px; font-weight:900; color:#fbbf24; background:rgba(0,0,0,.3); padding:6px 14px; border-radius:8px; display:inline-block;">--:--</div>
            
            ${hasTeam && joinedCount >= 1 ? `<button class="b g full" style="margin-top:10px; padding:10px; font-weight:bold;" onclick="tryStartSeason()">🚀 بدء الموسم الآن (${joinedCount} مدربين)</button>` : ''}
        </div>
        <div class="g2">`;

    currentSlots.forEach(slot => {
        const isTaken = !!slot.user_id && slot.user_id !== BOT_UUID;
        const isMe = mySlot && String(slot.id) === String(mySlot.id);
        let bg = isMe ? 'rgba(251,191,36,.2)' : (isTaken ? 'rgba(15,34,56,.8)' : 'rgba(30,58,138,.4)');
        let border = isMe ? '#fbbf24' : (isTaken ? '#ef4444' : '#22c55e');
        let statusHtml = isMe ? `<div style="font-size:10px; color:#fbbf24; font-weight:bold; margin-top:4px;">⭐ فريقك</div>` : (isTaken ? `<div style="font-size:10px; color:#ef4444; font-weight:bold; margin-top:4px;">🔒 ${slot.manager_name || 'محجوز'}</div>` : `<div style="font-size:10px; color:#4ade80; font-weight:bold; margin-top:4px;">🟢 متاح</div>`);
        let isDisabled = isTaken || isFull || hasTeam;
        let onclick = isDisabled ? '' : `onclick="claimLiveTeam('${slot.id}', this)"`;
        
        html += `<button class="team-select-card" ${onclick} style="cursor:${isDisabled ? 'default' : 'pointer'}; background:${bg}; border:1px solid ${border}; padding:12px; border-radius:10px; width:100%; display:block; text-align:center;">
            <div class="bd" style="font-size:15px; width:36px; height:36px; margin:0 auto 6px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; background:rgba(255,255,255,0.1); color:#fff;">${slot.team_name ? slot.team_name[0] : '⚽'}</div>
            <b style="font-size:12px; display:block; color:#fff;">${slot.team_name}</b>
            ${statusHtml}
        </button>`;
    });
    html += `</div></div>`;
    $('main').innerHTML = html;
}

async function claimLiveTeam(slotId, btnEl) {
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return alert('يجب تسجيل الدخول أولاً!');
        if (mySlot) return alert('لقد اخترت فريقاً في هذه الغرفة بالفعل!');
        if (btnEl) { btnEl.style.opacity = '0.5'; btnEl.style.pointerEvents = 'none'; }
        const chosenSlot = currentSlots.find(s => String(s.id) === String(slotId));
        if (!chosenSlot) throw new Error('الفريق غير موجود!');

        ensureLocalGameReady(chosenSlot); ensureG(); 

        const snap = { 
            name: T[G.my].name, R: T[G.my].R, c1: T[G.my].c1, c2: T[G.my].c2,
            form: G.form, tac: G.tac, starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) 
        };
        const mgrName = G.managerName || 'مدرب';

        const { data: updatedSlot, error } = await _db.from('lobby_slots')
            .update({ user_id: user.id, manager_name: mgrName, team_snapshot: snap, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 })
            .eq('id', slotId).is('user_id', null).select();

        if (error) throw new Error(error.message);
        if (!updatedSlot || updatedSlot.length === 0) {
            if (btnEl) { btnEl.style.opacity = '1'; btnEl.style.pointerEvents = 'auto'; }
            return alert('عذراً، سبقك مدرب آخر!');
        }

        if (!G.season && typeof generateSeason === 'function') G.season = generateSeason(G.my, null);
        
        G.multiplayerLeagueId = currentLobby.id; save(); stopLobbyTimers(); startGlobalLobbyWatcher(); 
        if (typeof initLiveBroadcast === 'function') initLiveBroadcast(currentLobby.id);
        
        alert("✅ تم اختيار الفريق!");
        G.tab = 'lu'; if (typeof dash === 'function') dash(); 
    } catch (err) {
        if (btnEl) { btnEl.style.opacity = '1'; btnEl.style.pointerEvents = 'auto'; }
        alert('تعذر اختيار الفريق: ' + err.message);
    }
}

function startGlobalLobbyWatcher() {
    if (globalWatcherInterval) clearInterval(globalWatcherInterval);
    if (!G || !G.multiplayerLeagueId) return;

    globalWatcherInterval = setInterval(async () => {
        try {
            if (!G || !G.multiplayerLeagueId) return;
            const { data: lobby } = await _db.from('lobbies').select('*').eq('id', G.multiplayerLeagueId).single();
            if (!lobby) return;

            if (lobby.status === 'waiting') {
                const timeUp = new Date(lobby.expires_at).getTime() <= new Date().getTime();
                const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobby.id);
                const realCount = slots.filter(s => s.user_id && s.user_id !== BOT_UUID).length;
                
                if ((timeUp || realCount >= 10) && !isSeasonStarting) {
                    isSeasonStarting = true;
                    currentLobby = lobby; 
                    await tryStartSeason();
                }
            } else if (lobby.status === 'active') {
                await processDueBotMatches(G.multiplayerLeagueId);
                if (G.tab === 'comp' || typeof G.tab === 'undefined') switchTab('comp');
                else if (G.tab === 'lu' || G.tab === 'tb' || G.tab === 'tr') {
                    // يتم التحديث تلقائياً
                }
            }
        } catch(e) { console.error(e); }
    }, 3000); 
}

async function forceNewLobby() {
    try {
        stopLobbyTimers();
        $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold);">⏳ جاري البحث عن غرفة جديدة...</div>`;
        const { data: { user } } = await _db.auth.getUser();
        if (user && currentLobby) {
            await _db.from('lobby_slots').update({ user_id: null, manager_name: null, team_snapshot: null }).eq('lobby_id', currentLobby.id).eq('user_id', user.id);
        }
        showLeaguesPage();
    } catch (e) { alert('خطأ: ' + e.message); showLeaguesPage(); }
}

async function loadMultiplayerCompData() {
    if (mpCompInterval) clearInterval(mpCompInterval);
    
    const fetchAndRender = async () => {
        const containerLu = document.getElementById('mp-mission-content');
        const containerComp = document.getElementById('mp-league-content');
        const container = containerLu || containerComp; 

        if (!container) {
            if (mpCompInterval) clearInterval(mpCompInterval);
            return;
        }

        try {
            if (typeof G === 'undefined' || !G || !G.multiplayerLeagueId) return;
            await processDueBotMatches(G.multiplayerLeagueId);

            const { data: lobby } = await _db.from('lobbies').select('*').eq('id', G.multiplayerLeagueId).single();
            if (!lobby) return;
            currentLobby = lobby;

            const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobby.id).order('team_name');
            let { data: matches } = await _db.from('lobby_matches').select('*').eq('lobby_id', lobby.id).order('round');
            
            if (lobby.status === 'active' && (!matches || matches.length === 0)) {
                const success = await forceGenerateMatches(lobby.id);
                if (success) {
                    const { data: retryMatches } = await _db.from('lobby_matches').select('*').eq('lobby_id', lobby.id).order('round');
                    matches = retryMatches || [];
                }
            }

            const { data: { user } } = await _db.auth.getUser();
            if (!user || !slots) return;
            
            const mySlot = slots.find(s => s.user_id === user.id);
            if (!mySlot) { container.innerHTML = `<div style="color:#ef4444; text-align:center; padding:15px;">أنت لست مشاركاً في هذا الدوري.</div>`; return; }

            let html = '';

            if (lobby.status === 'waiting') {
                const joinedCount = slots.filter(s => s.user_id && s.user_id !== BOT_UUID).length;
                const timeUp = new Date(lobby.expires_at).getTime() <= new Date().getTime();
                const isFull = joinedCount >= 10;
                
                if ((timeUp || isFull) && !isSeasonStarting) {
                    isSeasonStarting = true;
                    await tryStartSeason();
                    return;
                }

                const diff = Math.max(0, new Date(lobby.expires_at).getTime() - new Date().getTime());
                const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
                html = `
                    <div style="text-align:center; padding:15px; background:rgba(0,0,0,.3); border-radius:10px;">
                        <div style="color:#fbbf24; font-size:14px; font-weight:bold; margin-bottom:5px;">⏳ بانتظار بدء الموسم...</div>
                        <div style="font-size:13px; color:#fff;">اللاعبون المنضمون: <b style="color:#4ade80">${joinedCount}</b> / 10</div>
                        <div style="font-size:20px; color:#4ade80; font-weight:900; margin-top:10px;">⏱️ ${m}:${s.toString().padStart(2, '0')}</div>
                    </div>`;
            } else {
                const sorted = slots.filter(s => s.user_id).sort((a, b) => (b.points||0) - (a.points||0) || ((b.goals_for||0) - (b.goals_against||0)) - ((a.goals_for||0) - (a.goals_against||0)));
                
                html = `<div style="font-size:11px; text-align:center; color:var(--gold); margin-bottom:5px;">جدول الترتيب المباشر 🔴</div>
                <table style="width:100%; font-size:11px; text-align:center; margin-bottom:15px;">
                    <tr style="color:#94a3b8;"><th>#</th><th style="text-align:right">الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>ن</th></tr>`;
                sorted.forEach((s, i) => {
                    const isMe = s.id === mySlot.id;
                    html += `<tr style="${isMe ? 'background:rgba(251,191,36,.1);font-weight:bold;color:#fff;' : 'color:#cbd5e1;'}">
                        <td>${i+1}</td><td style="text-align:right;">${s.team_name} <span style="font-size:9px; color:#94a3b8;">(${s.manager_name||'مدرب'})</span> ${isMe?'⭐':''}</td>
                        <td>${s.played||0}</td><td>${s.won||0}</td><td>${s.drawn||0}</td><td>${s.lost||0}</td>
                        <td>${(s.goals_for||0) - (s.goals_against||0)}</td><td style="color:#4ade80; font-weight:bold;">${s.points||0}</td>
                    </tr>`;
                });
                html += `</table>`;

                // ✅ عرض المباراة الحالية فقط
                let myMatches = (matches || []).filter(m => (m.home_slot_id === mySlot.id || m.away_slot_id === mySlot.id));
                myMatches.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
                
                let currentMatch = myMatches.find(m => !m.played);
                
                html += `<div style="font-size:13px; text-align:center; color:#fff; font-weight:bold; margin-bottom:10px; background:rgba(251,191,36,.2); padding:5px; border-radius:5px;">🔥 مباراتك الحالية</div>`;

                if (!currentMatch) {
                    html += `<div style="text-align:center; color:#4ade80; padding:20px; font-size:14px; font-weight:bold; background:rgba(0,0,0,.3); border-radius:10px;">🏆 لقد انتهى الدوري! لقد لعبت جميع مبارياتك.</div>`;
                } else {
                    const isHome = currentMatch.home_slot_id === mySlot.id;
                    const oppId = isHome ? currentMatch.away_slot_id : currentMatch.home_slot_id;
                    const opp = slots.find(s => s.id === oppId) || { team_name: 'خصم' };
                    const matchTime = currentMatch.scheduled_time ? new Date(currentMatch.scheduled_time).getTime() : new Date().getTime();
                    const now = new Date().getTime();
                    const isTimeUp = now >= matchTime;
                    const timeString = new Date(matchTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                    let btnHtml = '';
                    if (isTimeUp) {
                        btnHtml = `
                            <div style="display:flex; gap:8px; width:100%; margin-top:15px;">
                                <button class="b g" style="flex:1; padding:12px; font-size:14px; font-weight:bold;" onclick="playMultiplayerMatch('${currentMatch.id}', '${lobby.id}', false)">▶ العب الآن</button>
                                <button class="b sm" style="flex:1; padding:12px; font-size:14px; background:#8b5cf6; color:#fff; font-weight:bold;" onclick="simulateUserMatch('${currentMatch.id}', '${lobby.id}')">⏩ محاكاة سريعة</button>
                            </div>
                        `;
                    } else {
                        const diffMins = Math.ceil((matchTime - now) / 60000);
                        const diffHours = Math.floor(diffMins / 60);
                        const remMins = diffMins % 60;
                        btnHtml = `<div style="font-size:12px; color:#fbbf24; font-weight:bold; background:rgba(251,191,36,.1); padding:10px; border-radius:8px; text-align:center; width:100%; margin-top:15px;">⏳ تبدأ المباراة بعد: ${diffHours > 0 ? diffHours + ' ساعة و ' : ''}${remMins} دقيقة</div>`;
                    }

                    html += `<div style="display:flex; flex-direction:column; align-items:center; background:linear-gradient(135deg, rgba(15,34,56,.9), rgba(30,58,138,.9)); border:2px solid #fbbf24; padding:20px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.5);">
                        <div style="font-size:12px; color:#22d3ee; font-weight:bold; margin-bottom:10px;">الجولة ${currentMatch.round} • ${timeString}</div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin:10px 0;">
                            <div style="flex:1; text-align:center; font-size:16px; font-weight:bold; color:${isHome ? '#fbbf24' : '#fff'};">
                                ${isHome ? mySlot.team_name : opp.team_name}
                                <div style="font-size:10px; color:#94a3b8; margin-top:5px;">${isHome ? '(أنت)' : '(الخصم)'}</div>
                            </div>
                            <div style="font-size:24px; color:#fff; font-weight:900; margin:0 15px;">VS</div>
                            <div style="flex:1; text-align:center; font-size:16px; font-weight:bold; color:${!isHome ? '#fbbf24' : '#fff'};">
                                ${!isHome ? mySlot.team_name : opp.team_name}
                                <div style="font-size:10px; color:#94a3b8; margin-top:5px;">${!isHome ? '(أنت)' : '(الخصم)'}</div>
                            </div>
                        </div>
                        ${btnHtml}
                    </div>`;
                }
                
                html += `<div style="text-align:center; margin-top:15px;">
                    <button class="b sm" style="background:#1e293b; border:1px solid #475569; font-size:11px;" onclick="showLiveLeagueSchedule()">📅 عرض جدول المباريات كاملاً (في البطولات)</button>
                </div>`;
            }

            if (containerLu) containerLu.innerHTML = html;
            if (containerComp) containerComp.innerHTML = html;

        } catch (e) { console.error("loadMultiplayerCompData error:", e); }
    };

    await fetchAndRender();
    mpCompInterval = setInterval(fetchAndRender, 5000);
}

// ✅ عرض جدول البطولات (الكامل)
async function showLiveLeagueSchedule() {
    if (!G.multiplayerLeagueId) return alert('أنت لست في دوري أونلاين حالياً.');
    $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold);">⏳ جاري تحميل جدول الدوري...</div>`;
    
    try {
        const { data: matches } = await _db.from('lobby_matches').select('*').eq('lobby_id', G.multiplayerLeagueId).order('round');
        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', G.multiplayerLeagueId);
        const { data: { user } } = await _db.auth.getUser();
        const mySlot = slots.find(s => s.user_id === user.id);

        if (!mySlot) return alert('أنت لست مشاركاً في هذا الدوري.');

        const myMatches = (matches || []).filter(m => (m.home_slot_id === mySlot.id || m.away_slot_id === mySlot.id));
        
        let html = `<div class="c" style="margin-top:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <button class="b sm" style="background:#475569;" onclick="dash()">⬅ عودة</button>
                <h2 style="color:var(--gold); font-size:16px;">🏆 جدول الدوري المصري</h2>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">`;

        myMatches.forEach(m => {
            const isHome = m.home_slot_id === mySlot.id;
            const oppId = isHome ? m.away_slot_id : m.home_slot_id;
            const opp = slots.find(s => s.id === oppId) || { team_name: 'خصم' };
            const matchTime = m.scheduled_time ? new Date(m.scheduled_time).getTime() : new Date().getTime();
            const timeString = new Date(matchTime).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            let scoreHtml = m.played ? `<b style="color:${m.home_score > m.away_score ? (isHome ? '#4ade80' : '#ef4444') : (m.home_score < m.away_score ? (isHome ? '#ef4444' : '#4ade80') : '#fbbf24')}">${m.home_score} - ${m.away_score}</b>` : `<span style="color:#fbbf24; font-size:10px;">${timeString}</span>`;

            html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.3); padding:10px; border-radius:8px; border-left:4px solid ${m.played ? '#475569' : '#fbbf24'};">
                <div style="font-size:10px; color:#94a3b8; width:40px;">ج${m.round}</div>
                <div style="font-size:12px; font-weight:bold; color:#fff; flex:1; text-align:center;">
                    ${isHome ? mySlot.team_name : opp.team_name} 
                    <span style="margin:0 8px;">${scoreHtml}</span> 
                    ${isHome ? opp.team_name : mySlot.team_name}
                </div>
                <div style="width:60px; text-align:left;">
                    ${m.played ? `<span style="color:#4ade80; font-size:10px;">انتهت</span>` : `<span style="color:#fbbf24; font-size:10px;">قادمة</span>`}
                </div>
            </div>`;
        });
        html += `</div></div>`;
        $('main').innerHTML = html;

    } catch (e) {
        alert('خطأ في تحميل الجدول: ' + e.message);
        dash();
    }
}

// ✅ محاكاة مباراة المستخدم فوراً (تفتح المحاكي المرئي وتسرعه)
async function simulateUserMatch(matchId, lobbyId) {
    if (!confirm('هل أنت متأكد من محاكاة المباراة بدلاً من لعبها؟')) return;
    
    try {
        $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold); font-weight:bold;">⏳ جاري تحضير المحاكاة...</div>`;
        
        const { data: match } = await _db.from('lobby_matches').select('*').eq('id', matchId).single();
        if (!match) throw new Error('المباراة غير موجودة!');
        if (match.played) throw new Error('تم لعب هذه المباراة بالفعل!');

        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobbyId);
        const { data: { user } } = await _db.auth.getUser();
        const mySlot = slots.find(s => s.user_id === user.id);
        
        const isHome = match.home_slot_id === mySlot.id;
        const oppId = isHome ? match.away_slot_id : match.home_slot_id;
        const oppSlot = slots.find(s => s.id === oppId);

        ensureLocalGameReady(mySlot);

        let oppTeamData = oppSlot?.team_snapshot;
        let myTeamData = { 
            name: T[G.my].name, R: T[G.my].R, c1: T[G.my].c1, c2: T[G.my].c2,
            form: G.form, tac: G.tac, starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) 
        };
        
        const updateData = isHome ? { home_snapshot: myTeamData } : { away_snapshot: myTeamData };
        await _db.from('lobby_matches').update(updateData).eq('id', matchId);

        let oppTeamId = 'OPP_' + oppSlot.id.substring(0, 6);
        let myTeamId = 'MY_' + mySlot.id.substring(0, 6);

        if (!oppTeamData || !oppTeamData.starters || oppTeamData.starters.length < 11) {
            T[oppTeamId] = { id: oppTeamId, name: oppSlot.team_name, R: 75, c1: '#1e40af', c2: '#fff', budget: 100, ps: [], form: '4-3-3', tac: 'balanced' };
            const posList = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
            for(let i=0; i<11; i++) {
                T[oppTeamId].ps.push({ id: oppTeamId+'_'+i, name: oppSlot.team_name+' '+(i+1), pos: posList[i], r: 75, lvl: 1, age: 24, pace:75, shooting:75, passing:75, dribbling:75, defending:75, physical:75, fit:100, morale:85 });
            }
        } else { T[oppTeamId] = buildTeamFromSnapshot(oppTeamData, oppTeamId); }

        const myStarters = G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean);
        const oppStarters = T[oppTeamId].ps.slice(0, 11);

        const matchConfig = {
            h: isHome ? T[G.my] : T[oppTeamId],
            a: isHome ? T[oppTeamId] : T[G.my],
            hl: isHome ? myStarters : oppStarters,
            al: isHome ? oppStarters : myStarters,
            hf: isHome ? (myTeamData.form || '4-3-3') : (oppTeamData?.form || '4-3-3'),
            af: isHome ? (oppTeamData?.form || '4-3-3') : (myTeamData.form || '4-3-3'),
            ht: isHome ? (myTeamData.tac || 'balanced') : (oppTeamData?.tac || 'balanced'),
            at: isHome ? (oppTeamData?.tac || 'balanced') : (myTeamData.tac || 'balanced'),
            human: isHome ? 'home' : 'away',
            compName: `الدوري المباشر 🌐`,
            weather: (typeof WEATHERS !== 'undefined' && WEATHERS[0]) ? WEATHERS[0] : {type:'مشمس', emoji:'☀️', accuracy:1.0, stamina:1.0}
        };

        window._mpMatchCallback = (hg, ag) => {
            finalizeMultiplayerMatch(matchId, lobbyId, isHome, hg, ag, mySlot, oppSlot, slots);
        };

        window._mpMatchConfig = matchConfig;
        window._mpMatchId = matchId;
        window._mpLobbyId = lobbyId;
        window._mpIsHome = isHome;
        window._mpMySlot = mySlot;
        window._mpOppSlot = oppSlot;
        window._mpSlots = slots;
        window._mpIsReplay = false;

        if (typeof play === 'function') {
            play();
            setTimeout(() => {
                if (typeof skip === 'function') skip();
            }, 1000);
        } else {
            alert('محرك المباريات (match.js) غير محمل!');
        }

    } catch (e) {
        console.error("Simulate Error:", e);
        alert('حدث خطأ أثناء المحاكاة: ' + e.message);
        if (typeof dash === 'function') dash();
    }
}

// ✅ تشغيل المباراة المرئية (زر "العب" أو "مشاهدة")
async function playMultiplayerMatch(matchId, lobbyId, isReplay) {
    try {
        const { data: match } = await _db.from('lobby_matches').select('*').eq('id', matchId).single();
        if (!match) return alert('المباراة غير موجودة!');
        if (!isReplay && match.played) return alert('تم لعب هذه المباراة بالفعل!');

        if (!isReplay) {
            const matchTime = match.scheduled_time ? new Date(match.scheduled_time).getTime() : 0;
            if (new Date().getTime() < matchTime) {
                const diffMins = Math.ceil((matchTime - new Date().getTime()) / 60000);
                return alert(`لم يحن وقت هذه المباراة بعد! متبقي ${diffMins} دقيقة.`);
            }
        }

        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobbyId);
        const { data: { user } } = await _db.auth.getUser();
        const mySlot = slots.find(s => s.user_id === user.id);
        
        const isHome = match.home_slot_id === mySlot.id;
        const oppId = isHome ? match.away_slot_id : match.home_slot_id;
        const oppSlot = slots.find(s => s.id === oppId);
        
        const homeSlot = slots.find(s => s.id === match.home_slot_id);
        const awaySlot = slots.find(s => s.id === match.away_slot_id);

        ensureLocalGameReady(mySlot);

        let oppTeamData; let myTeamData;
        if (isReplay) {
            myTeamData = isHome ? match.home_snapshot : match.away_snapshot;
            oppTeamData = isHome ? match.away_snapshot : match.home_snapshot;
            
            if (!myTeamData) {
                myTeamData = { name: isHome ? homeSlot?.team_name : awaySlot?.team_name, R: 75, c1: '#1e40af', c2: '#fff', form: '4-3-3', tac: 'balanced', starters: [] };
            }
            if (!oppTeamData) {
                oppTeamData = { name: isHome ? awaySlot?.team_name : homeSlot?.team_name, R: 75, c1: '#1e40af', c2: '#fff', form: '4-3-3', tac: 'balanced', starters: [] };
            }
        } else {
            myTeamData = { 
                name: T[G.my].name, R: T[G.my].R, c1: T[G.my].c1, c2: T[G.my].c2,
                form: G.form, tac: G.tac, starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) 
            };
            oppTeamData = oppSlot?.team_snapshot;
            const updateData = isHome ? { home_snapshot: myTeamData } : { away_snapshot: myTeamData };
            await _db.from('lobby_matches').update(updateData).eq('id', matchId);
        }

        let oppTeamId = 'OPP_' + oppSlot.id.substring(0, 6);
        let myTeamId = 'MY_' + mySlot.id.substring(0, 6);

        if (!oppTeamData || !oppTeamData.starters || oppTeamData.starters.length < 11) {
            T[oppTeamId] = { id: oppTeamId, name: oppSlot.team_name, R: 75, c1: '#1e40af', c2: '#fff', budget: 100, ps: [], form: '4-3-3', tac: 'balanced' };
            const posList = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
            for(let i=0; i<11; i++) {
                T[oppTeamId].ps.push({ id: oppTeamId+'_'+i, name: oppSlot.team_name+' '+(i+1), pos: posList[i], r: 75, lvl: 1, age: 24, pace:75, shooting:75, passing:75, dribbling:75, defending:75, physical:75, fit:100, morale:85 });
            }
        } else { T[oppTeamId] = buildTeamFromSnapshot(oppTeamData, oppTeamId); }

        if (!myTeamData || !myTeamData.starters || myTeamData.starters.length < 11) {
            T[myTeamId] = { id: myTeamId, name: isHome ? homeSlot?.team_name : awaySlot?.team_name, R: 75, c1: '#1e40af', c2: '#fff', budget: 100, ps: [], form: '4-3-3', tac: 'balanced' };
            const posList = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
            for(let i=0; i<11; i++) {
                T[myTeamId].ps.push({ id: myTeamId+'_'+i, name: 'لاعب '+(i+1), pos: posList[i], r: 75, lvl: 1, age: 24, pace:75, shooting:75, passing:75, dribbling:75, defending:75, physical:75, fit:100, morale:85 });
            }
        } else if (isReplay) {
            T[myTeamId] = buildTeamFromSnapshot(myTeamData, myTeamId);
        }

        const myStarters = isReplay ? T[myTeamId].ps.slice(0, 11) : G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean);
        const oppStarters = T[oppTeamId].ps.slice(0, 11);

        const matchConfig = {
            h: isHome ? (isReplay ? T[myTeamId] : T[G.my]) : T[oppTeamId],
            a: isHome ? T[oppTeamId] : (isReplay ? T[myTeamId] : T[G.my]),
            hl: isHome ? myStarters : oppStarters,
            al: isHome ? oppStarters : myStarters,
            hf: isHome ? (myTeamData.form || '4-3-3') : (oppTeamData?.form || '4-3-3'),
            af: isHome ? (oppTeamData?.form || '4-3-3') : (myTeamData.form || '4-3-3'),
            ht: isHome ? (myTeamData.tac || 'balanced') : (oppTeamData?.tac || 'balanced'),
            at: isHome ? (oppTeamData?.tac || 'balanced') : (myTeamData.tac || 'balanced'),
            human: isHome ? 'home' : 'away',
            compName: `الدوري المباشر 🌐`,
            weather: (typeof WEATHERS !== 'undefined' && WEATHERS[0]) ? WEATHERS[0] : {type:'مشمس', emoji:'☀️', accuracy:1.0, stamina:1.0}
        };

        window._mpMatchCallback = (hg, ag) => {
            if (!isReplay) finalizeMultiplayerMatch(matchId, lobbyId, isHome, hg, ag, mySlot, oppSlot, slots);
        };

        window._mpMatchConfig = matchConfig;
        window._mpMatchId = matchId;
        window._mpLobbyId = lobbyId;
        window._mpIsHome = isHome;
        window._mpMySlot = mySlot;
        window._mpOppSlot = oppSlot;
        window._mpSlots = slots;
        window._mpIsReplay = isReplay;

        if (typeof play === 'function') {
            play();
        } else {
            alert('محرك المباريات (match.js) غير محمل!');
        }

    } catch (err) {
        console.error("MP Match Error:", err);
        alert('حدث خطأ أثناء تجهيز المباراة: ' + err.message);
        if (typeof dash === 'function') dash();
    }
}

function endMultiplayerMatch(hg, ag) {
    if (window._mpMatchCallback) {
        window._mpMatchCallback(hg, ag);
        window._mpMatchCallback = null;
    }
}

async function finalizeMultiplayerMatch(matchId, lobbyId, isHome, hg, ag, mySlot, oppSlot, slots) {
    try {
        await _db.from('lobby_matches').update({ home_score: hg, away_score: ag, played: true }).eq('id', matchId);
        const homeSlot = slots.find(s => s.id === (isHome ? mySlot.id : oppSlot.id));
        const awaySlot = slots.find(s => s.id === (isHome ? oppSlot.id : mySlot.id));
        await updateStandingsDb(homeSlot, awaySlot, hg, ag);
        
        if (typeof broadcastEvent === 'function') {
            broadcastEvent(`🏁 ${homeSlot.team_name} ${hg} - ${ag} ${awaySlot.team_name}`, true);
        }
        
        alert(`⚽ انتهت!\n${isHome ? mySlot.team_name : oppSlot.team_name} ${hg} - ${ag} ${isHome ? oppSlot.team_name : mySlot.team_name}`);
        if (typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData();
        if (typeof dash === 'function') dash();
    } catch (err) { alert('حدث خطأ أثناء حفظ النتيجة.'); }
}

function buildTeamFromSnapshot(snap, teamId) {
    if (!snap) snap = { name: 'فريق', starters: [] };
    const ps = (snap.starters || []).map((p, idx) => ({ ...p, id: p.id || (teamId + '_' + idx), fit: 100, morale: p.morale || 85, susp: 0, injury: null, stats: { passes: 0, tackles: 0, shots: 0 } }));
    const avgR = ps.length ? Math.round(ps.reduce((s, p) => s + (p.r || 75), 0) / ps.length) : 75;
    return { id: teamId, name: snap.name || 'فريق منافس', R: snap.R || avgR, c1: snap.c1 || '#1e40af', c2: snap.c2 || '#ffffff', budget: 100, ps: ps, form: snap.form || '4-3-3', tac: snap.tac || 'balanced' };
}

// ============================================
// 💰 دوال السوق المباشر
// ============================================

async function listPlayerForSale(pid) {
    if (!G.multiplayerLeagueId) return alert('هذا الخيار متاح فقط في اللعب الجماعي.');
    const me = T[G.my];
    if (me.ps.length <= 14) return alert('لا يمكنك بيع لاعب، تحتاج 14 لاعباً على الأقل.');
    
    const p = me.ps.find(x => x.id === pid);
    if (!p) return;
    
    const priceStr = prompt(`عرض اللاعب ${p.name} (تقييم ${p.r}) للبيع في السوق الجماعي.\n\nميزانيتك الحالية: ${me.budget}M\nالقيمة السوقية: ${p.value}M\n\nأدخل سعر البيع (M):`, p.value);
    if (!priceStr) return;
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) return alert('سعر غير صالح!');
    
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return alert('يجب تسجيل الدخول.');
        
        $('cm').hidden = true;
        $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold); font-weight:bold;">⏳ جاري عرض اللاعب في السوق...</div>`;
        
        const snap = { ...p }; 
        const { error: marketErr } = await _db.from('market_listings').insert({
            user_id: user.id,
            manager_name: G.managerName,
            team_name: me.name,
            player_data: snap,
            asking_price: price
        });
        if (marketErr) throw marketErr;
        
        me.ps = me.ps.filter(x => x.id !== pid);
        G.lu = G.lu.map(id => id === pid ? null : id);
        if (G.lu.includes(null)) G.lu = autoFillLineup(me, G.form);
        autoAssignRoles();
        save();
        
        if (typeof updateLobbySnapshot === 'function') await updateLobbySnapshot();
        
        alert(`✅ تم عرض ${p.name} في السوق بسعر ${price}M.`);
        dash(); 
        
    } catch (e) {
        console.error(e);
        alert('حدث خطأ أثناء عرض اللاعب: ' + e.message);
        dash();
    }
}

async function buyMarketPlayer(listingId) {
    if (!G.multiplayerLeagueId) return;
    const me = T[G.my];
    if (me.ps.length >= 25) return alert('فريقك ممتلئ!');
    
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return alert('يجب تسجيل الدخول.');
        
        const { data: listing } = await _db.from('market_listings').select('*').eq('id', listingId).single();
        if (!listing) return alert('هذا العرض لم يعد متاحاً (ربما تم شراؤه أو إلغاؤه).');
        if (listing.user_id === user.id) return alert('لا يمكنك شراء لاعبك!');
        
        const price = listing.asking_price;
        if (me.budget < price) return alert(`ميزانيتك غير كافية! تحتاج ${price}M.`);
        
        me.budget = Math.round((me.budget - price) * 10) / 10;
        
        const newPlayer = { ...listing.player_data, id: 'M_' + Date.now() };
        me.ps.push(newPlayer);
        autoAssignRoles();
        
        const { error: delErr } = await _db.from('market_listings').delete().eq('id', listingId);
        if (delErr) throw delErr;
        
        save();
        if (typeof updateLobbySnapshot === 'function') await updateLobbySnapshot();
        
        alert(`🎉 مبروك! انضم ${newPlayer.name} لفريقك مقابل ${price}M.`);
        if (typeof loadLiveMarket === 'function') loadLiveMarket();
        
    } catch (e) {
        console.error(e);
        alert('حدث خطأ أثناء الشراء: ' + e.message);
    }
}

async function cancelMarketListing(listingId, playerId) {
    if (!confirm('هل أنت متأكد من إلغاء عرض البيع؟ سيعود اللاعب لفريقك.')) return;
    
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return;
        
        const { data: listing } = await _db.from('market_listings').select('*').eq('id', listingId).single();
        if (!listing) return;
        
        const me = T[G.my];
        const newPlayer = { ...listing.player_data, id: playerId };
        me.ps.push(newPlayer);
        autoAssignRoles();
        
        await _db.from('market_listings').delete().eq('id', listingId);
        save();
        if (typeof updateLobbySnapshot === 'function') await updateLobbySnapshot();
        
        alert('✅ تم إلغاء العرض وعاد اللاعب لفريقك.');
        if (typeof loadLiveMarket === 'function') loadLiveMarket();
        
    } catch (e) {
        console.error(e);
        alert('حدث خطأ: ' + e.message);
    }
}

async function updateLobbySnapshot() {
    if (!G.multiplayerLeagueId) return;
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return;
        
        const me = T[G.my];
        const snap = { 
            name: me.name, R: me.R, c1: me.c1, c2: me.c2,
            form: G.form, tac: G.tac, starters: G.lu.map(id => me.ps.find(p => p.id === id)).filter(Boolean) 
        };
        
        await _db.from('lobby_slots').update({ team_snapshot: snap }).eq('lobby_id', G.multiplayerLeagueId).eq('user_id', user.id);
    } catch (e) { console.error(e); }
}

// ============================================
// multiplayer.js - نظام الغرف والمباريات (بدون رسائل متصفح - تصميم داخلي)
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

let broadcastChannel = null;
let activeMatchChannel = null;

const BOT_UUID = '00000000-0000-0000-0000-000000000000'; 
let serverTimeOffset = 0;

function ensureG() { if (typeof G === 'undefined' || !G) G = {}; }

function getLobbyMaxTeams() {
    return (typeof LEAGUES !== 'undefined' && LEAGUES['egypt']) ? LEAGUES['egypt'].teams.length : 18;
}

function getManagerName() {
    if (typeof G !== 'undefined' && G && G.managerName) return G.managerName;
    if (mySlot && mySlot.manager_name) return mySlot.manager_name;
    const saved = localStorage.getItem('managerName');
    if (saved) return saved;
    return 'المدرب';
}

async function syncServerTime() {
    try {
        const start = Date.now();
        const { data, error } = await _db.rpc('get_server_time');
        if (!error && data) {
            const serverNow = new Date(data).getTime();
            const latency = (Date.now() - start) / 2;
            serverTimeOffset = (serverNow + latency) - Date.now();
        }
    } catch (e) { console.error("Server time sync error:", e); }
}

function getServerNow() { return Date.now() + serverTimeOffset; }
setTimeout(syncServerTime, 500);

function stopLobbyTimers() {
    if (liveInterval) clearInterval(liveInterval);
    if (timeLeftInterval) clearInterval(timeLeftInterval);
    if (mpCompInterval) clearInterval(mpCompInterval);
    if (globalWatcherInterval) clearInterval(globalWatcherInterval);
    liveInterval = null; timeLeftInterval = null; mpCompInterval = null; globalWatcherInterval = null;
}

// ============================================
// 🎨 1. نظام النوافذ المخصصة (بديل alert و confirm)
// ============================================
function showGameAlert(msg, icon = 'ℹ️', title = 'تنبيه') {
    $('cmc').innerHTML = `
        <div class="mc mc-warning" style="width: 90%; max-width: 350px; text-align: center;">
            <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
            <div class="mc-head" style="margin-bottom: 15px;">
                <div class="mc-icon" style="font-size: 40px; margin-bottom: 10px;">${icon}</div>
                <div class="mc-title" style="font-size: 18px; color: var(--gold);">${title}</div>
            </div>
            <div style="font-size: 14px; color: #fff; margin-bottom: 20px; line-height: 1.6;">
                ${msg}
            </div>
            <div class="mc-actions">
                <button class="b g full" onclick="$('cm').hidden=true">حسناً</button>
            </div>
        </div>
    `;
    $('cm').hidden = false;
}

function showGameConfirm(msg, onConfirm, icon = '⚠️', title = 'تأكيد') {
    window._tempConfirmCallback = onConfirm;
    $('cmc').innerHTML = `
        <div class="mc mc-warning" style="width: 90%; max-width: 350px; text-align: center;">
            <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
            <div class="mc-head" style="margin-bottom: 15px;">
                <div class="mc-icon" style="font-size: 40px; margin-bottom: 10px;">${icon}</div>
                <div class="mc-title" style="font-size: 18px; color: var(--gold);">${title}</div>
            </div>
            <div style="font-size: 14px; color: #fff; margin-bottom: 20px; line-height: 1.6;">
                ${msg}
            </div>
            <div class="mc-actions" style="display: flex; gap: 10px;">
                <button class="b r" style="flex: 1;" onclick="$('cm').hidden=true">إلغاء</button>
                <button class="b g" style="flex: 1;" onclick="$('cm').hidden=true; if(window._tempConfirmCallback){window._tempConfirmCallback(); window._tempConfirmCallback=null;}">تأكيد</button>
            </div>
        </div>
    `;
    $('cm').hidden = false;
}

function showOnlineToast(msg, icon = '🌐') {
    let old = document.getElementById('mp-live-toast');
    if (old) old.remove();

    const t = document.createElement('div');
    t.id = 'mp-live-toast';
    t.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,58,138,0.96));
        border: 1.5px solid #fbbf24; color: #fff; padding: 10px 18px; border-radius: 30px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.6); z-index: 999999; font-family: 'Cairo', sans-serif;
        font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 8px;
        white-space: nowrap; transition: all 0.3s ease;
    `;
    t.innerHTML = `<span style="font-size:16px;">${icon}</span> <span>${msg}</span>`;
    document.body.appendChild(t);

    if (typeof playSound === 'function') playSound('whistle');

    setTimeout(() => {
        if (t) {
            t.style.opacity = '0';
            t.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => t.remove(), 300);
        }
    }, 4000);
}

function initLiveBroadcast(lobbyId) {
    if (!lobbyId || !window._db) return;
    if (broadcastChannel) _db.removeChannel(broadcastChannel);

    broadcastChannel = _db.channel('lobby_events_' + lobbyId)
        .on('broadcast', { event: 'game_event' }, (payload) => {
            if (payload && payload.payload) {
                showOnlineToast(payload.payload.msg, payload.payload.icon || '🔥');
            }
        })
        .subscribe();
}

function stopLiveBroadcast() {
    if (broadcastChannel && window._db) {
        _db.removeChannel(broadcastChannel);
        broadcastChannel = null;
    }
}

function broadcastEvent(msg, showLocally = true, icon = '📢') {
    if (showLocally) showOnlineToast(msg, icon);
    if (broadcastChannel) {
        broadcastChannel.send({ type: 'broadcast', event: 'game_event', payload: { msg, icon } });
    }
}

// ============================================
// 🏟️ 2. إدارة الغرف والدوريات
// ============================================
async function resignFromLobby() {
    if (!G || !G.multiplayerLeagueId) return showGameAlert('أنت لست مشتركاً في أي غرفة حالياً.', '⚠️');
    
    showGameConfirm("هل أنت متأكد من تقديم الاستقالة ومغادرة الدوري الأونلاين؟", async () => {
        try {
            $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold); font-weight:bold;">⏳ جاري تقديم الاستقالة...</div>`;
            const { data: { user } } = await _db.auth.getUser();
            if (!user) throw new Error("يجب تسجيل الدخول أولاً.");
            await _db.from('lobby_slots').update({ user_id: null, manager_name: null, team_snapshot: null }).eq('lobby_id', G.multiplayerLeagueId).eq('user_id', user.id);
            delete G.multiplayerLeagueId;
            stopLobbyTimers();
            stopLiveBroadcast();
            save();
            showOnlineToast('تم تقديم استقالتك بنجاح', '✅');
            showLeaguesPage();
        } catch (err) { showGameAlert('حدث خطأ: ' + err.message, '❌'); dash(); }
    }, '🚪', 'تقديم استقالة');
}

function generateBotSnapshot(teamName, teamRating = 75) {
    const posList = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
    const starters = posList.map((pos, i) => ({
        id: 'BOT_' + Math.random().toString(36).substr(2, 9),
        name: 'لاعب ' + (i+1), pos: pos, r: Math.max(60, teamRating - 2 + Math.floor(Math.random() * 5)), lvl: 1, age: 24,
        pace: teamRating, shooting: teamRating, passing: teamRating, dribbling: teamRating, defending: teamRating, physical: teamRating
    }));
    return { name: teamName, R: teamRating, c1: '#1e293b', c2: '#fff', form: '4-3-3', tac: 'balanced', starters: starters };
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
    const maxTeams = getLobbyMaxTeams();
    
    if (G.multiplayerLeagueId) {
        try {
            const { data: { user } } = await _db.auth.getUser();
            if (user) {
                const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', G.multiplayerLeagueId).eq('user_id', user.id);
                if (slots && slots.length > 0) {
                    mySlot = slots[0]; ensureLocalGameReady(mySlot); startGlobalLobbyWatcher();
                    initLiveBroadcast(G.multiplayerLeagueId);
                    if (typeof dash === 'function') { dash(); return; }
                }
            }
        } catch (e) { console.error(e); }
    }

    $('main').innerHTML = `<div style="text-align:center; padding:50px 20px;"><div style="font-size:40px; animation: logoBounce 1s infinite alternate;">⏳</div><div style="color:var(--gold); font-weight:bold; margin-top:15px; font-size:16px;">جاري البحث عن غرفة أونلاين...</div></div>`;

    try {
        await syncServerTime();
        const { data: { user } } = await _db.auth.getUser();
        if (!user) throw new Error("يجب تسجيل الدخول أولاً");

        const { data: mySlots } = await _db.from('lobby_slots').select('lobby_id, lobbies!inner(id, status)').eq('user_id', user.id).in('lobbies.status', ['waiting', 'active']).limit(1);

        if (mySlots && mySlots.length > 0) {
            const { data: lobbyData } = await _db.from('lobbies').select('*').eq('id', mySlots[0].lobby_id).single();
            currentLobby = lobbyData; G.multiplayerLeagueId = currentLobby.id; save();
            await loadLobbyData(); ensureLocalGameReady(mySlot); startGlobalLobbyWatcher();
            initLiveBroadcast(currentLobby.id);
            
            if (mySlot || currentLobby.status === 'active') {
                if (typeof dash === 'function') { dash(); return; }
            } else {
                renderWaitingRoom(); startCountdownTimer(); liveInterval = setInterval(fetchUpdates, 3000);
            }
            return;
        }

        let { data: openLobbies } = await _db.from('lobbies').select('*').eq('status', 'waiting').gt('expires_at', new Date(getServerNow()).toISOString()).order('created_at', { ascending: true });
        let availableLobbies = [];
        if (openLobbies) {
            for (const l of openLobbies) {
                const { count } = await _db.from('lobby_slots').select('*', { count: 'exact', head: true }).eq('lobby_id', l.id).not('user_id', 'is', null);
                if (count < maxTeams) availableLobbies.push({ lobby: l, count: count });
            }
        }
        availableLobbies.sort((a, b) => b.count - a.count);

        if (availableLobbies.length > 0) { currentLobby = availableLobbies[0].lobby; }
        else {
            const expDate = new Date(getServerNow() + 60 * 1000).toISOString(); 
            const { data: newLobby, error } = await _db.from('lobbies').insert({ status: 'waiting', expires_at: expDate }).select().single();
            if (error) throw error;
            
            const teams = LEAGUES['egypt'].teams;
            await _db.from('lobby_slots').insert(teams.map(t => ({ lobby_id: newLobby.id, team_id: t[0], team_name: t[1] })));
            currentLobby = newLobby;
        }

        await loadLobbyData(); renderWaitingRoom(); startCountdownTimer(); liveInterval = setInterval(fetchUpdates, 3000);
        initLiveBroadcast(currentLobby.id);
        
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
    const maxTeams = getLobbyMaxTeams();
    try {
        const { data: lobby } = await _db.from('lobbies').select('*').eq('id', currentLobby.id).single();
        if (lobby) currentLobby = lobby;

        if (currentLobby.status === 'active') { stopLobbyTimers(); ensureLocalGameReady(mySlot); if (typeof dash === 'function') dash(); return; }

        if (currentLobby.status === 'waiting') {
            const timeUp = new Date(currentLobby.expires_at).getTime() <= getServerNow();
            const isFull = currentSlots.filter(s => s.user_id && s.user_id !== BOT_UUID).length >= maxTeams;
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
        const diff = Math.max(0, new Date(currentLobby.expires_at).getTime() - getServerNow());
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
                const originalTeam = LEAGUES['egypt'].teams.find(t => t[0] === slot.team_id);
                const teamRating = originalTeam ? originalTeam[2] : 75;
                const botSnap = generateBotSnapshot(slot.team_name, teamRating);
                await _db.from('lobby_slots').update({
                    user_id: BOT_UUID, manager_name: 'مدرب آلي', team_snapshot: botSnap,
                    played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0
                }).eq('id', slot.id);
            }
        }

        const { data: freshSlots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobbyId);
        const fixtures = generateDoubleRoundRobin(freshSlots);

        const baseServerTime = getServerNow();
        const roundInterval = 24 * 60 * 60 * 1000; // 24 ساعة

        const inserts = fixtures.map(f => ({
            lobby_id: lobbyId,
            round: f.round,
            home_slot_id: f.home.id,
            away_slot_id: f.away.id,
            match_seed: Math.floor(Math.random() * 900000) + 100000,
            scheduled_time: new Date(baseServerTime + (f.round * roundInterval)).toISOString()
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
            await _db.from('lobbies').update({ status: 'waiting', expires_at: new Date(getServerNow() + 60 * 1000).toISOString() }).eq('id', currentLobby.id);
            isSeasonStarting = false; 
            return;
        }

        const { data: updated } = await _db.from('lobbies').update({ status: 'active' }).eq('id', currentLobby.id).eq('status', 'waiting').select();
        if (!updated || updated.length === 0) { isSeasonStarting = false; return; }

        const success = await forceGenerateMatches(currentLobby.id);
        if (!success) throw new Error("فشل في توليد المباريات.");

        showOnlineToast('🏆 انطلق الموسم الأونلاين رسمياً! بالتوفيق لجميع المدربين', '🎉');
        stopLobbyTimers(); startGlobalLobbyWatcher(); ensureLocalGameReady(mySlot);
        if (typeof dash === 'function') dash(); 
    } catch (e) { 
        console.error("Start Season Error:", e); 
        showGameAlert("حدث خطأ أثناء بدء الموسم: " + e.message, '❌');
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
        const { data: simulatedCount, error } = await _db.rpc('auto_simulate_due_matches');
        if (!error && simulatedCount > 0) {
            if (typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData();
        }
    } catch (e) { console.error("Auto server sim error:", e); }
}

// ============================================
// 👤 واجهة غرفة الانتظار وتفاصيل الفرق
// ============================================
function renderWaitingRoom() {
    const maxTeams = getLobbyMaxTeams();
    const joinedCount = currentSlots.filter(s => s.user_id && s.user_id !== BOT_UUID).length;
    const hasTeam = !!mySlot;
    const isFull = joinedCount >= maxTeams;
    const currentMgrName = getManagerName();

    let html = `<div class="c" style="margin-top:10px; position:relative;">
        <div style="background: linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95)); border: 1px solid rgba(251,191,36,0.4); padding: 10px 14px; border-radius: 12px; margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:20px;">👨‍💼</span>
                <div>
                    <div style="font-size:10px; color:#94a3b8;">المدرب المستخدم</div>
                    <div style="font-size:14px; font-weight:900; color:#fff;">${currentMgrName}</div>
                </div>
            </div>
            <div style="text-align:left; border-right:1px solid rgba(255,255,255,0.1); padding-right:12px;">
                <div style="font-size:10px; color:#94a3b8;">الفريق المختار</div>
                <div style="font-size:13px; font-weight:bold; color:#4ade80;">${mySlot ? mySlot.team_name : 'لم تختر فريقاً'}</div>
            </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <button class="b sm" style="padding:5px 10px; font-size:11px; background:#475569;" onclick="stopLobbyTimers(); showSetup()">⬅ خروج</button>
            <button class="b sm" style="padding:5px 10px; font-size:11px; background:#0284c7;" onclick="forceNewLobby()">🔄 غرفة جديدة</button>
        </div>
        
        <div style="text-align:center; margin-bottom:12px;">
            <div style="display:inline-block; background:rgba(239,68,68,.2); border:1px solid #ef4444; padding:4px 12px; border-radius:20px; color:#ef4444; font-size:12px; font-weight:bold; margin-bottom:6px;">🔴 غرفة الانتظار المباشرة</div>
            <h2 style="color:var(--gold); font-size:16px; margin-bottom:4px;">الدوري المصري الممتاز (أونلاين)</h2>
            <div style="font-size:12px; color:#cbd5e1; margin-bottom:6px;">المدربون المنضمون: <b style="color:#4ade80">${joinedCount}</b> / ${maxTeams}</div>
            <div id="live-countdown" style="font-size:18px; font-weight:900; color:#fbbf24; background:rgba(0,0,0,.3); padding:4px 12px; border-radius:8px; display:inline-block;">--:--</div>
            
            <div style="font-size:11px; color:#38bdf8; margin-top:6px;">💡 اضغط على أي بطاقة فريق لاستعراض لاعبيه وقوته واسم مدربه</div>

            ${hasTeam && joinedCount >= 1 ? `<button class="b g full" style="margin-top:8px; padding:8px; font-weight:bold;" onclick="tryStartSeason()">🚀 بدء الموسم الآن</button>` : ''}
        </div>
        
        <div class="g2" style="max-height: 48vh; overflow-y: auto; padding-right: 4px;">`;

    currentSlots.forEach(slot => {
        const isTaken = !!slot.user_id && slot.user_id !== BOT_UUID;
        const isMe = mySlot && String(slot.id) === String(mySlot.id);
        let bg = isMe ? 'rgba(251,191,36,.2)' : (isTaken ? 'rgba(15,34,56,.8)' : 'rgba(30,58,138,.4)');
        let border = isMe ? '#fbbf24' : (isTaken ? '#ef4444' : '#22c55e');
        
        let teamManagerLabel = slot.user_id === BOT_UUID ? '🤖 آلي' : (slot.manager_name || 'مدرب');
        let statusHtml = isMe 
            ? `<div style="font-size:10px; color:#fbbf24; font-weight:bold; margin-top:2px;">⭐ فريقك (${currentMgrName})</div>` 
            : (isTaken 
                ? `<div style="font-size:10px; color:#4ade80; font-weight:bold; margin-top:2px;">👤 ${teamManagerLabel}</div>` 
                : `<div style="font-size:10px; color:#94a3b8; margin-top:2px;">🟢 متاح للاختيار</div>`);
        
        let actionBtn = !isTaken && !hasTeam && joinedCount < maxTeams 
            ? `<button class="b g sm" style="padding:3px 8px; font-size:10px; margin-top:4px;" onclick="event.stopPropagation(); claimLiveTeam('${slot.id}', this)">اختيار 🤝</button>` 
            : '';

        html += `<div class="team-select-card" onclick="showTeamDetailsModal('${slot.id}')" style="cursor:pointer; background:${bg}; border:1px solid ${border}; padding:8px; border-radius:10px; text-align:center; margin-bottom:5px;">
            <div class="bd" style="font-size:14px; width:28px; height:28px; margin:0 auto 3px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; background:rgba(255,255,255,0.1); color:#fff;">${slot.team_name ? slot.team_name[0] : '⚽'}</div>
            <b style="font-size:11px; display:block; color:#fff;">${slot.team_name}</b>
            ${statusHtml}
            ${actionBtn}
        </div>`;
    });
    html += `</div></div>`;
    $('main').innerHTML = html;
}

function showTeamDetailsModal(slotId) {
    const slot = currentSlots.find(s => String(s.id) === String(slotId));
    if (!slot) return;

    let teamRating = 75;
    let managerText = 'غير مسجل (متاح)';
    let playersListHtml = '<div style="color:#94a3b8; text-align:center; padding:15px;">لا توجد تفاصيل متاحة لهذا الفريق بعد.</div>';

    if (slot.user_id) {
        managerText = slot.user_id === BOT_UUID ? '🤖 مدرب آلي (بوْت)' : `👤 ${slot.manager_name || 'مدرب بشري'}`;
        if (slot.team_snapshot && slot.team_snapshot.starters) {
            const starters = slot.team_snapshot.starters;
            teamRating = slot.team_snapshot.R || Math.round(starters.reduce((acc, p) => acc + (p.r || 75), 0) / starters.length);
            
            playersListHtml = starters.map(p => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:6px; margin-bottom:4px; font-size:12px;">
                    <span style="color:#fff; font-weight:bold;">${p.name} <span style="font-size:10px; color:#94a3b8;">(${p.pos})</span></span>
                    <span style="color:#fbbf24; font-weight:bold;">⭐ ${p.r || 75}</span>
                </div>
            `).join('');
        }
    } else {
        const originalTeam = (typeof LEAGUES !== 'undefined' && LEAGUES['egypt']) ? LEAGUES['egypt'].teams.find(t => t[0] === slot.team_id) : null;
        teamRating = originalTeam ? originalTeam[2] : 75;
    }

    $('cmc').innerHTML = `
        <div class="mc mc-warning" style="max-height:85vh; display:flex; flex-direction:column; width:95%; max-width:450px;">
            <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
            <div class="mc-head" style="text-align:center; margin-bottom:10px;">
                <div style="font-size:32px;">🛡️</div>
                <div class="mc-title" style="font-size:18px; color:#fff;">${slot.team_name}</div>
                <div class="mc-sub" style="font-size:12px; color:#4ade80; margin-top:4px;">المدرب: <b>${managerText}</b></div>
                <div style="margin-top:6px; display:inline-block; background:rgba(251,191,36,0.15); border:1px solid #fbbf24; padding:2px 10px; border-radius:6px; color:#fbbf24; font-size:12px; font-weight:bold;">
                    ⭐ قوة الفريق الإجمالية: ${teamRating}
                </div>
            </div>

            <div style="font-size:12px; color:#fbbf24; font-weight:bold; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                👥 قائمة اللاعبين الأساسيين:
            </div>
            
            <div style="overflow-y:auto; flex:1; padding-right:4px; max-height:45vh;">
                ${playersListHtml}
            </div>

            ${!slot.user_id && !mySlot ? `
                <button class="b g full" style="margin-top:12px; padding:10px; font-weight:bold;" onclick="$('cm').hidden=true; claimLiveTeam('${slot.id}')">اختيار هذا الفريق والانضمام 🤝</button>
            ` : ''}
        </div>
    `;
    $('cm').hidden = true;
    $('cm').hidden = false;
}

async function claimLiveTeam(slotId, btnEl) {
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return showGameAlert('يجب تسجيل الدخول أولاً!', '⚠️');
        if (mySlot) return showGameAlert('لقد اخترت فريقاً في هذه الغرفة بالفعل!', '⚠️');
        if (btnEl) { btnEl.style.opacity = '0.5'; btnEl.style.pointerEvents = 'none'; }
        
        const chosenSlot = currentSlots.find(s => String(s.id) === String(slotId));
        if (!chosenSlot) throw new Error('الفريق غير موجود!');

        ensureLocalGameReady(chosenSlot); ensureG(); 

        const mgrName = getManagerName();
        if (typeof G !== 'undefined') G.managerName = mgrName;
        localStorage.setItem('managerName', mgrName);

        const snap = { 
            name: T[G.my].name, R: T[G.my].R, c1: T[G.my].c1, c2: T[G.my].c2,
            form: G.form, tac: G.tac, starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) 
        };

        const { data: updatedSlot, error } = await _db.from('lobby_slots')
            .update({ user_id: user.id, manager_name: mgrName, team_snapshot: snap, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 })
            .eq('id', slotId).is('user_id', null).select();

        if (error) throw new Error(error.message);
        if (!updatedSlot || updatedSlot.length === 0) {
            if (btnEl) { btnEl.style.opacity = '1'; btnEl.style.pointerEvents = 'auto'; }
            return showGameAlert('عذراً، سبقك مدرب آخر!', '🏃‍♂️');
        }

        if (!G.season && typeof generateSeason === 'function') G.season = generateSeason(G.my, null);
        
        G.multiplayerLeagueId = currentLobby.id; save(); stopLobbyTimers(); startGlobalLobbyWatcher(); 
        initLiveBroadcast(currentLobby.id);
        broadcastEvent(`انضم المدرب ${mgrName} لقيادة نادي ${chosenSlot.team_name}!`, true, '🤝');
        
        G.tab = 'lu'; if (typeof dash === 'function') dash(); 
    } catch (err) {
        if (btnEl) { btnEl.style.opacity = '1'; btnEl.style.pointerEvents = 'auto'; }
        showGameAlert('تعذر اختيار الفريق: ' + err.message, '❌');
    }
}

function startGlobalLobbyWatcher() {
    if (globalWatcherInterval) clearInterval(globalWatcherInterval);
    if (!G || !G.multiplayerLeagueId) return;
    const maxTeams = getLobbyMaxTeams();

    globalWatcherInterval = setInterval(async () => {
        try {
            if (!G || !G.multiplayerLeagueId) return;
            const { data: lobby } = await _db.from('lobbies').select('*').eq('id', G.multiplayerLeagueId).single();
            if (!lobby) return;

            if (lobby.status === 'waiting') {
                const timeUp = new Date(lobby.expires_at).getTime() <= getServerNow();
                const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobby.id);
                const realCount = slots.filter(s => s.user_id && s.user_id !== BOT_UUID).length;
                
                if ((timeUp || realCount >= maxTeams) && !isSeasonStarting) {
                    isSeasonStarting = true;
                    currentLobby = lobby; 
                    await tryStartSeason();
                }
            } else if (lobby.status === 'active') {
                await processDueBotMatches(G.multiplayerLeagueId);
            }
        } catch(e) { console.error(e); }
    }, 4000); 
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
    } catch (e) { showGameAlert('خطأ: ' + e.message, '❌'); showLeaguesPage(); }
}

// ============================================
// 🏆 3. واجهة البطولات والترتيب والمباريات
// ============================================
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
                const maxTeams = getLobbyMaxTeams();
                const joinedCount = slots.filter(s => s.user_id && s.user_id !== BOT_UUID).length;
                const timeUp = new Date(lobby.expires_at).getTime() <= getServerNow();
                const isFull = joinedCount >= maxTeams;
                
                if ((timeUp || isFull) && !isSeasonStarting) {
                    isSeasonStarting = true;
                    await tryStartSeason();
                    return;
                }

                const diff = Math.max(0, new Date(lobby.expires_at).getTime() - getServerNow());
                const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
                html = `
                    <div style="text-align:center; padding:15px; background:rgba(0,0,0,.3); border-radius:10px;">
                        <div style="color:#fbbf24; font-size:14px; font-weight:bold; margin-bottom:5px;">⏳ بانتظار انطلاق الموسم...</div>
                        <div style="font-size:13px; color:#fff;">المدربون المنضمون: <b style="color:#4ade80">${joinedCount}</b> / ${maxTeams}</div>
                        <div style="font-size:20px; color:#4ade80; font-weight:900; margin-top:10px;">⏱️ ${m}:${s.toString().padStart(2, '0')}</div>
                    </div>`;
            } else {
                let myMatches = (matches || []).filter(m => (m.home_slot_id === mySlot.id || m.away_slot_id === mySlot.id));
                myMatches.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
                
                let currentMatch = myMatches.find(m => !m.played);
                let lastPlayedMatch = [...myMatches].reverse().find(m => m.played); // جلب آخر مباراة لعبت
                
                html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:rgba(251,191,36,.15); padding:6px 12px; border-radius:8px;">
                    <span style="font-size:12px; color:#fbbf24; font-weight:bold;">🔥 مواجهة الدوري الأونلاين</span>
                    <button class="b sm" style="background:#0ea5e9; color:#fff; font-size:10px; padding:4px 10px;" onclick="loadLiveMarket()">🛒 سوق اللاعبين الحي</button>
                </div>`;

                if (!currentMatch && !lastPlayedMatch) {
                    html += `<div style="text-align:center; color:#4ade80; padding:20px; font-size:14px; font-weight:bold; background:rgba(0,0,0,.3); border-radius:10px;">🏆 اكتمل الموسم! لقد خضت جميع مبارياتك.</div>`;
                } else {
                    if (currentMatch) {
                        const isHome = currentMatch.home_slot_id === mySlot.id;
                        const oppId = isHome ? currentMatch.away_slot_id : currentMatch.home_slot_id;
                        const opp = slots.find(s => s.id === oppId) || { team_name: 'خصم' };
                        const isHumanOpp = opp.user_id && opp.user_id !== BOT_UUID;
                        const matchTime = currentMatch.scheduled_time ? new Date(currentMatch.scheduled_time).getTime() : new Date().getTime();
                        const now = getServerNow();
                        const isTimeUp = now >= matchTime;
                        const timeString = new Date(matchTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                        let btnHtml = '';
                        if (isTimeUp) {
                            btnHtml = `
                                <div style="display:flex; gap:8px; width:100%; margin-top:15px;">
                                    <button class="b g" style="flex:1; padding:12px; font-size:13px; font-weight:bold;" onclick="playMultiplayerMatch('${currentMatch.id}', '${lobby.id}', false)">▶ العب المباراة مباشرة 🔴</button>
                                    <button class="b sm" style="flex:1; padding:12px; font-size:13px; background:#8b5cf6; color:#fff; font-weight:bold;" onclick="simulateUserMatch('${currentMatch.id}', '${lobby.id}')">⏩ محاكاة سريعة</button>
                                </div>
                            `;
                        } else {
                            const diffSecs = Math.ceil((matchTime - now) / 1000);
                            const diffMins = Math.floor(diffSecs / 60);
                            const diffHours = Math.floor(diffMins / 60);
                            const remMins = diffMins % 60;

                            let timeLeftText = '';
                            if (diffHours > 0) timeLeftText += `${diffHours} ساعة و `;
                            timeLeftText += `${remMins} دقيقة`;

                            btnHtml = `<div style="font-size:12px; color:#fbbf24; font-weight:bold; background:rgba(251,191,36,.1); padding:10px; border-radius:8px; text-align:center; width:100%; margin-top:15px;">⏳ موعد الجولة الثابت بعد: ${timeLeftText}</div>`;
                        }

                        html += `<div style="display:flex; flex-direction:column; align-items:center; background:linear-gradient(135deg, rgba(15,34,56,.95), rgba(30,58,138,.95)); border:2px solid #fbbf24; padding:18px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.5);">
                            <div style="font-size:11px; color:#22d3ee; font-weight:bold; margin-bottom:8px;">الجولة ${currentMatch.round} • ${timeString} ${isHumanOpp ? '• 👤 ضد مدرب حقيقي' : '• 🤖 ضد مدرب آلي'}</div>
                            
                            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin:8px 0;">
                                <div style="flex:1; text-align:center; font-size:15px; font-weight:bold; color:${isHome ? '#fbbf24' : '#fff'};">
                                    ${isHome ? mySlot.team_name : opp.team_name}
                                    <div style="font-size:10px; color:#94a3b8; margin-top:4px;">${isHome ? '(أنت)' : `(${opp.manager_name||'مدرب'})`}</div>
                                </div>
                                <div style="font-size:22px; color:#fff; font-weight:900; margin:0 12px;">VS</div>
                                <div style="flex:1; text-align:center; font-size:15px; font-weight:bold; color:${!isHome ? '#fbbf24' : '#fff'};">
                                    ${!isHome ? mySlot.team_name : opp.team_name}
                                    <div style="font-size:10px; color:#94a3b8; margin-top:4px;">${!isHome ? '(أنت)' : `(${opp.manager_name||'مدرب'})`}</div>
                                </div>
                            </div>
                            ${btnHtml}
                        </div>`;
                    }

                    if (lastPlayedMatch) {
                        const lpIsHome = lastPlayedMatch.home_slot_id === mySlot.id;
                        const lpOppId = lpIsHome ? lastPlayedMatch.away_slot_id : lastPlayedMatch.home_slot_id;
                        const lpOpp = slots.find(s => s.id === lpOppId) || { team_name: 'خصم' };
                        
                        const myGoals = lpIsHome ? lastPlayedMatch.home_score : lastPlayedMatch.away_score;
                        const oppGoals = lpIsHome ? lastPlayedMatch.away_score : lastPlayedMatch.home_score;

                        html += `
                        <div style="margin-top:15px; background:rgba(0,0,0,.4); border:1px solid #3b82f6; border-radius:10px; padding:12px; text-align:center;">
                            <div style="color:#fbbf24; font-size:12px; font-weight:bold; margin-bottom:5px;">📺 إعادة المباراة السابقة (الجولة ${lastPlayedMatch.round})</div>
                            <div style="font-size:14px; color:#fff; font-weight:bold; margin-bottom:10px;">
                                ${mySlot.team_name} <span style="color:#4ade80; margin:0 5px;">${myGoals} - ${oppGoals}</span> ${lpOpp.team_name}
                            </div>
                            <button class="b sm" style="background:#3b82f6; color:#fff; width:100%; padding:8px; font-weight:bold;" onclick="playMultiplayerMatch('${lastPlayedMatch.id}', '${lobby.id}', true)">▶ مشاهدة المحاكاة الآن</button>
                        </div>`;
                    }
                }
            }

            if (containerLu) containerLu.innerHTML = html;
            if (containerComp) containerComp.innerHTML = html;

        } catch (e) { console.error("loadMultiplayerCompData error:", e); }
    };

    await fetchAndRender();
    mpCompInterval = setInterval(fetchAndRender, 5000);
}

async function showOnlineStandings() {
    if (!G.multiplayerLeagueId) return false;
    $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold);">⏳ جاري تحميل الترتيب...</div>`;
    try {
        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', G.multiplayerLeagueId);
        const { data: { user } } = await _db.auth.getUser();
        const mySlot = slots.find(s => s.user_id === user.id);
        
        if (!mySlot) { $('main').innerHTML = `<div style="color:#ef4444; text-align:center; padding:20px;">أنت لست مشاركاً في هذا الدوري.</div>`; return true; }

        const sorted = slots.sort((a, b) => (b.points||0) - (a.points||0) || ((b.goals_for||0) - (b.goals_against||0)) - ((a.goals_for||0) - (a.goals_against||0)));
        
        let html = `<div class="c" style="margin-top:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 style="color:var(--gold); font-size:16px; margin:0;">🔴 جدول الترتيب المباشر</h2>
                <button class="b sm" style="background:#ef4444; color:#fff; font-size:10px; padding:4px 10px;" onclick="resignFromLobby()">🚪 استقالة</button>
            </div>
            <div style="max-height: 70vh; overflow-y: auto;">
                <table style="width:100%; font-size:12px; text-align:center;">
                    <tr style="color:#94a3b8; background:rgba(0,0,0,.3);"><th style="padding:8px;">#</th><th style="text-align:right;">الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>ن</th></tr>`;
        sorted.forEach((s, i) => {
            const isMe = s.id === mySlot.id;
            const managerName = s.user_id === BOT_UUID ? '🤖 آلي' : (s.manager_name || 'مدرب');
            const gd = (s.goals_for||0) - (s.goals_against||0);
            const gdColor = gd > 0 ? '#4ade80' : (gd < 0 ? '#ef4444' : '#fff');
            
            html += `<tr style="${isMe ? 'background:rgba(251,191,36,.15);font-weight:bold;color:#fff;' : 'color:#cbd5e1;'} border-bottom:1px solid rgba(255,255,255,.05);">
                <td style="padding:8px 5px;">${i+1}</td>
                <td style="text-align:right;">${s.team_name} <span style="font-size:9px; color:#94a3b8;">(${managerName})</span> ${isMe?'⭐':''}</td>
                <td>${s.played||0}</td><td>${s.won||0}</td><td>${s.drawn||0}</td><td>${s.lost||0}</td>
                <td style="color:${gdColor};">${gd}</td>
                <td style="color:#fbbf24; font-weight:bold;">${s.points||0}</td>
            </tr>`;
        });
        html += `</table></div></div>`;
        $('main').innerHTML = html;
        return true;
    } catch(e) {
        console.error(e);
        return false;
    }
}

async function showLiveLeagueSchedule() {
    if (!G.multiplayerLeagueId) return showGameAlert('أنت لست في دوري أونلاين حالياً.', '⚠️');
    $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold);">⏳ جاري تحميل جدول الدوري...</div>`;
    
    try {
        const { data: matches } = await _db.from('lobby_matches').select('*').eq('lobby_id', G.multiplayerLeagueId).order('round');
        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', G.multiplayerLeagueId);
        const { data: { user } } = await _db.auth.getUser();
        const mySlot = slots.find(s => s.user_id === user.id);

        if (!mySlot) return showGameAlert('أنت لست مشاركاً في هذا الدوري.', '⚠️');

        const myMatches = (matches || []).filter(m => (m.home_slot_id === mySlot.id || m.away_slot_id === mySlot.id));
        
        let html = `<div class="c" style="margin-top:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <button class="b sm" style="background:#475569;" onclick="dash()">⬅ عودة</button>
                <h2 style="color:var(--gold); font-size:16px;">🏆 جدول مبارياتي</h2>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; max-height:70vh; overflow-y:auto;">`;

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
                <div style="width:80px; text-align:left; display:flex; flex-direction:column; gap:4px;">
                    ${m.played ? `
                        <span style="color:#4ade80; font-size:10px;">انتهت</span>
                        <button class="b sm" style="background:#3b82f6; color:#fff; font-size:9px; padding:3px;" onclick="playMultiplayerMatch('${m.id}', '${G.multiplayerLeagueId}', true)">📺 مشاهدة</button>
                    ` : `<span style="color:#fbbf24; font-size:10px;">قادمة</span>`}
                </div>
            </div>`;
        });
        html += `</div></div>`;
        $('main').innerHTML = html;

    } catch (e) {
        showGameAlert('خطأ في تحميل الجدول: ' + e.message, '❌');
        if (typeof dash === 'function') dash();
    }
}

// ============================================
// ⚽ 4. محرك المباريات
// ============================================
async function simulateUserMatch(matchId, lobbyId) {
    showGameConfirm('هل أنت متأكد من محاكاة المباراة سريعاً بدلاً من لعبها؟', async () => {
        await playMultiplayerMatch(matchId, lobbyId, false, true);
    }, '⏩', 'محاكاة سريعة');
}

async function playMultiplayerMatch(matchId, lobbyId, isReplay = false, autoSkip = false) {
    try {
        const { data: match } = await _db.from('lobby_matches').select('*').eq('id', matchId).single();
        if (!match) return showGameAlert('المباراة غير موجودة!', '❌');
        if (!isReplay && match.played) return showGameAlert('تم لعب هذه المباراة بالفعل!', '⚠️');

        if (!isReplay) {
            const matchTime = match.scheduled_time ? new Date(match.scheduled_time).getTime() : 0;
            if (getServerNow() < matchTime) {
                const diffMins = Math.ceil((matchTime - getServerNow()) / 60000);
                return showGameAlert(`لم يحن وقت هذه الجولة بعد! متبقي ${diffMins} دقيقة.`, '⏳');
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

        let myTeamData = { 
            name: T[G.my].name, R: T[G.my].R, c1: T[G.my].c1, c2: T[G.my].c2,
            form: G.form, tac: G.tac, starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) 
        };
        let oppTeamData = oppSlot?.team_snapshot;

        if (!isReplay) {
            const updateData = isHome ? { home_snapshot: myTeamData } : { away_snapshot: myTeamData };
            await _db.from('lobby_matches').update(updateData).eq('id', matchId);
            await updateLobbySnapshot();
        } else {
            if (match.home_snapshot) {
                if (isHome) myTeamData = match.home_snapshot;
            }
            if (match.away_snapshot) {
                if (!isHome) myTeamData = match.away_snapshot;
            }
        }

        let oppTeamId = 'OPP_' + oppSlot.id.substring(0, 6);
        if (!oppTeamData || !oppTeamData.starters || oppTeamData.starters.length < 11) {
            T[oppTeamId] = generateBotSnapshot(oppSlot.team_name, 75);
            T[oppTeamId].ps = T[oppTeamId].starters;
        } else {
            T[oppTeamId] = buildTeamFromSnapshot(oppTeamData, oppTeamId);
        }

        let myTeamId = 'MY_' + mySlot.id.substring(0, 6);
        if (isReplay && myTeamData) {
             T[myTeamId] = buildTeamFromSnapshot(myTeamData, myTeamId);
        }

        const myStarters = isReplay ? T[myTeamId].ps.slice(0, 11) : G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean);
        const oppStarters = T[oppTeamId].ps.slice(0, 11);

        let currentSeed = match.match_seed || 543210;
        const originalR = window.R;
        window.R = function() {
            currentSeed = (currentSeed * 9301 + 49297) % 233280;
            return currentSeed / 233280;
        };

        const w = (typeof WEATHERS !== 'undefined' && WEATHERS[0]) ? WEATHERS[0] : {type:'مشمس', emoji:'☀️', accuracy:1.0, stamina:1.0};

        Mt = new Match({
            h: isHome ? (isReplay ? T[myTeamId] : T[G.my]) : T[oppTeamId],
            a: isHome ? T[oppTeamId] : (isReplay ? T[myTeamId] : T[G.my]),
            hl: isHome ? myStarters : oppStarters,
            al: isHome ? oppStarters : myStarters,
            hf: isHome ? (myTeamData.form || '4-3-3') : (oppTeamData?.form || '4-3-3'),
            af: isHome ? (oppTeamData?.form || '4-3-3') : (myTeamData.form || '4-3-3'),
            ht: isHome ? (myTeamData.tac || 'balanced') : (oppTeamData?.tac || 'balanced'),
            at: isHome ? (oppTeamData?.tac || 'balanced') : (myTeamData.tac || 'balanced'),
            human: isHome ? 'home' : 'away',
            compName: isReplay ? `📺 إعادة المباراة` : `الدوري الأونلاين المباشر 🔴`,
            weather: w
        });

        Mt.isOnlineLeagueMatch = !isReplay;
        Mt.restoreRandom = () => { window.R = originalR; };

        if (!isReplay) {
            if (activeMatchChannel) _db.removeChannel(activeMatchChannel);
            activeMatchChannel = _db.channel('live_match_' + matchId)
                .on('broadcast', { event: 'tactic_change' }, (payload) => {
                    if (!Mt || !payload.payload) return;
                    const { side, tac, mgr } = payload.payload;
                    Mt.s[side].tc = tac;
                    showOnlineToast(`المدرب ${mgr} غيّر تكتيكه إلى ${TAC_STYLE[tac]?.label || tac}!`, '🎯');
                })
                .subscribe();
        }

        window._mpMatchCallback = (hg, ag) => {
            if (Mt && Mt.restoreRandom) Mt.restoreRandom();
            if (activeMatchChannel) { _db.removeChannel(activeMatchChannel); activeMatchChannel = null; }
            if (!isReplay) finalizeMultiplayerMatch(matchId, lobbyId, isHome, hg, ag, mySlot, oppSlot, slots);
        };

        if($('mh')) $('mh').textContent = Mt.h.name;
        if($('ma')) $('ma').textContent = Mt.a.name;
        if($('weather-badge')) $('weather-badge').textContent = isReplay ? '📺 إعادة' : `🔴 مباشر • جولة ${match.round}`;
        shown = 0; paused = false; speed = isReplay ? 3 : 2;
        if($('bs')) $('bs').textContent = '×'+speed;
        if($('lg')) $('lg').innerHTML = '';
        if($('mr')) $('mr').textContent = isReplay ? `إعادة: الدوري الأونلاين • الجولة ${match.round}` : `الدوري الأونلاين • الجولة ${match.round}`;
        if($('live-commentary')) $('live-commentary').style.display = 'none';
        if($('momentum-pointer')) $('momentum-pointer').style.left = '50%';
        if(typeof mtac === 'function') mtac(G.tac);
        if($('ms')) $('ms').hidden = false;

        last = performance.now();
        raf = requestAnimationFrame(loop);

        if (autoSkip) {
            setTimeout(() => { if (typeof skip === 'function') skip(); }, 400);
        }

    } catch (err) {
        console.error("MP Match Error:", err);
        showGameAlert('حدث خطأ أثناء تجهيز المباراة: ' + err.message, '❌');
        if (typeof dash === 'function') dash();
    }
}

function syncOnlineTactic(newTac) {
    if (typeof Mt !== 'undefined' && Mt && Mt.isOnlineLeagueMatch && activeMatchChannel) {
        activeMatchChannel.send({
            type: 'broadcast',
            event: 'tactic_change',
            payload: { side: Mt.hu, tac: newTac, mgr: getManagerName() }
        });
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
        const { data: checkM } = await _db.from('lobby_matches').select('played').eq('id', matchId).single();
        if (!checkM || !checkM.played) {
            await _db.from('lobby_matches').update({ home_score: hg, away_score: ag, played: true }).eq('id', matchId);
            const homeSlot = slots.find(s => s.id === (isHome ? mySlot.id : oppSlot.id));
            const awaySlot = slots.find(s => s.id === (isHome ? oppSlot.id : mySlot.id));
            await updateStandingsDb(homeSlot, awaySlot, hg, ag);
            broadcastEvent(`🏁 انتهت: ${homeSlot.team_name} ${hg} - ${ag} ${awaySlot.team_name}`, true, '⚽');
        }
        
        if (typeof saveToCloud === 'function') await saveToCloud();
        if (typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData();
    } catch (err) { console.error('خطأ حفظ النتيجة:', err); }
}

function buildTeamFromSnapshot(snap, teamId) {
    if (!snap) snap = { name: 'فريق', starters: [] };
    const ps = (snap.starters || []).map((p, idx) => ({ ...p, id: p.id || (teamId + '_' + idx), fit: 100, morale: p.morale || 85, susp: 0, injury: null, stats: { matches:0, goals:0, assists:0, rating:0, passes: 0, tackles: 0, shots: 0 } }));
    const avgR = ps.length ? Math.round(ps.reduce((s, p) => s + (p.r || 75), 0) / ps.length) : 75;
    return { id: teamId, name: snap.name || 'فريق منافس', R: snap.R || avgR, c1: snap.c1 || '#1e40af', c2: snap.c2 || '#ffffff', budget: 100, ps: ps, form: snap.form || '4-3-3', tac: snap.tac || 'balanced' };
}

// ============================================
// 💰 5. سوق الانتقالات
// ============================================
async function loadLiveMarket() {
    if (!G || !G.multiplayerLeagueId) return showGameAlert('السوق الحي متاح داخل الدوري الأونلاين فقط!', '⚠️');

    $('cmc').innerHTML = `<div class="mc" style="text-align:center; padding:30px; color:#fbbf24;">⏳ جاري فتح سوق الانتقالات المباشر...</div>`;
    $('cm').hidden = false;

    try {
        const { data: { user } } = await _db.auth.getUser();
        const { data: listings, error } = await _db.from('market_listings').select('*').eq('lobby_id', G.multiplayerLeagueId).order('created_at', { ascending: false }).limit(30);
        if (error) throw error;

        const me = T[G.my];

        let itemsHtml = (listings || []).map(item => {
            const p = item.player_data;
            const isMine = user && item.user_id === user.id;
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.35); padding:10px; border-radius:10px; margin-bottom:8px; border-right:4px solid ${isMine ? '#fbbf24' : '#4ade80'};">
                <div style="text-align:right;">
                    <div style="font-size:13px; font-weight:bold; color:#fff;">${p.name} <span style="font-size:10px; color:#fbbf24;">(⭐${p.r} • ${p.pos})</span></div>
                    <div style="font-size:10px; color:#94a3b8;">البائع: ${item.team_name} (${item.manager_name || 'مدرب'})</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#4ade80; font-weight:900; font-size:13px;">${item.asking_price}M</span>
                    ${isMine 
                        ? `<button class="b r sm" style="padding:5px 10px; font-size:10px;" onclick="cancelMarketListing('${item.id}', '${p.id}')">استرجاع ↩</button>`
                        : `<button class="b g sm" style="padding:5px 12px; font-size:10px;" onclick="buyMarketPlayer('${item.id}')">شراء 💰</button>`
                    }
                </div>
            </div>`;
        }).join('');

        $('cmc').innerHTML = `
            <div class="mc mc-warning" style="max-height:85vh; display:flex; flex-direction:column; width:95%; max-width:480px;">
                <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
                <div class="mc-head">
                    <div class="mc-icon" style="font-size:32px;">🛒</div>
                    <div class="mc-title">سوق الانتقالات المباشر 🔴</div>
                    <div class="mc-sub">ميزانيتك الحالية: <b style="color:#4ade80">${me.budget.toFixed(1)}M</b></div>
                </div>

                <button class="b g full" style="margin:10px 0; padding:10px; font-weight:bold;" onclick="showSellPlayerListModal()">➕ اعرض لاعباً من فريقك للبيع</button>

                <div style="overflow-y:auto; flex:1; padding-right:4px;">
                    ${itemsHtml || '<div style="text-align:center; color:#94a3b8; padding:25px;">لا يوجد لاعبون معروضون حالياً.. كن أول من يعرض نجمه!</div>'}
                </div>
            </div>
        `;
    } catch (e) {
        $('cmc').innerHTML = `<div class="mc" style="padding:20px; text-align:center; color:#ef4444;">تعذر تحميل السوق: ${e.message}</div>`;
    }
}

// دالة جديدة: قائمة مخصصة لاختيار اللاعب للبيع
function showSellPlayerListModal() {
    const me = T[G.my];
    if (me.ps.length <= 14) return showGameAlert('لا يمكنك بيع لاعب، تحتاج 14 لاعباً على الأقل.', '⚠️');

    let listHtml = me.ps.map(p => `
        <div style="cursor:pointer; margin-bottom:6px; padding:10px; border-radius:8px; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.1); display:flex; justify-content:space-between; align-items:center;" onclick="openSellPriceModal('${p.id}')">
            <div style="text-align:right;">
                <div style="font-size:13px; font-weight:bold; color:#fff;">${p.name}</div>
                <div style="font-size:10px; color:#94a3b8;">${p.pos} • العمر: ${p.age}</div>
            </div>
            <div style="text-align:left;">
                <div style="color:#fbbf24; font-weight:bold; font-size:14px;">⭐ ${p.r}</div>
                <div style="font-size:10px; color:#4ade80;">${p.value}M</div>
            </div>
        </div>
    `).join('');

    $('cmc').innerHTML = `
        <div class="mc mc-warning" style="max-height:85vh; display:flex; flex-direction:column; width:95%; max-width:400px;">
            <button class="mc-close" onclick="loadLiveMarket()">✕</button>
            <div class="mc-head" style="margin-bottom:10px;">
                <div class="mc-icon" style="font-size:30px;">👥</div>
                <div class="mc-title">اختر لاعباً للبيع</div>
            </div>
            <div style="overflow-y:auto; flex:1; padding-right:5px; max-height:55vh;">
                ${listHtml}
            </div>
            <button class="b r full" style="margin-top:10px;" onclick="loadLiveMarket()">إلغاء</button>
        </div>
    `;
}

function openSellPriceModal(pid) {
    if (!G.multiplayerLeagueId) return;
    const me = T[G.my];
    
    const p = me.ps.find(x => x.id === pid);
    if (!p) return;

    $('cmc').innerHTML = `
        <div class="mc mc-warning" style="width:95%; max-width:380px; text-align:center;">
            <button class="mc-close" onclick="showSellPlayerListModal()">✕</button>
            <div class="mc-head" style="margin-bottom:12px;">
                <div style="font-size:35px;">🏷️</div>
                <div class="mc-title" style="font-size:16px;">تحديد سعر البيع</div>
                <div class="mc-sub" style="font-size:12px; color:#fff; margin-top:4px;">اللاعب: <b>${p.name}</b> (⭐${p.r})</div>
                <div style="font-size:11px; color:#94a3b8; margin-top:2px;">القيمة السوقية المقدرة: ${p.value}M</div>
            </div>

            <div style="margin-bottom:15px;">
                <input type="number" id="custom-sell-price" value="${p.value}" step="0.5" style="width:80%; background:#0f172a; border:1px solid #334155; color:#fff; padding:10px; border-radius:8px; text-align:center; font-size:16px; font-family:Cairo; font-weight:bold;">
                <div style="font-size:10px; color:#94a3b8; margin-top:5px;">أدخل السعر المطلوب بالمليون (M)</div>
            </div>

            <div style="display:flex; gap:8px;">
                <button class="b r" style="flex:1; padding:10px;" onclick="showSellPlayerListModal()">رجوع ⬅</button>
                <button class="b g" style="flex:1; padding:10px;" onclick="confirmListPlayerForSale('${p.id}')">تأكيد العرض 📢</button>
            </div>
        </div>
    `;
}

async function confirmListPlayerForSale(pid) {
    const priceInput = document.getElementById('custom-sell-price');
    const price = parseFloat(priceInput ? priceInput.value : 0);
    
    if (isNaN(price) || price <= 0) return showGameAlert('يرجى إدخال سعر صالح!', '⚠️');
    
    const me = T[G.my];
    const p = me.ps.find(x => x.id === pid);
    if (!p) return;
    
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return showGameAlert('يجب تسجيل الدخول.', '⚠️');
        
        const snap = { ...p }; 
        const { error: marketErr } = await _db.from('market_listings').insert({
            lobby_id: G.multiplayerLeagueId,
            user_id: user.id,
            manager_name: getManagerName(),
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
        
        await updateLobbySnapshot();
        broadcastEvent(`💼 عرض نادي ${me.name} اللاعب ${p.name} (⭐${p.r}) للبيع بـ ${price}M!`, true, '🛒');
        loadLiveMarket();
        
    } catch (e) {
        console.error(e);
        showGameAlert('حدث خطأ أثناء عرض اللاعب', '❌');
        loadLiveMarket();
    }
}

async function buyMarketPlayer(listingId) {
    if (!G.multiplayerLeagueId) return;
    const me = T[G.my];
    if (me.ps.length >= 25) return showGameAlert('فريقك ممتلئ!', '⚠️');
    
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return showGameAlert('يجب تسجيل الدخول.', '⚠️');
        
        const { data: listing } = await _db.from('market_listings').select('*').eq('id', listingId).single();
        if (!listing) return showGameAlert('هذا العرض لم يعد متاحاً!', '⚠️');
        if (listing.user_id === user.id) return showGameAlert('لا يمكنك شراء لاعبك!', '⚠️');
        
        const price = listing.asking_price;
        if (me.budget < price) return showGameAlert(`ميزانيتك غير كافية! تحتاج ${price}M.`, '⚠️');
        
        me.budget = Math.round((me.budget - price) * 10) / 10;
        
        const newPlayer = { ...listing.player_data, id: 'M_' + Date.now() };
        me.ps.push(newPlayer);
        autoAssignRoles();
        
        const { error: delErr } = await _db.from('market_listings').delete().eq('id', listingId);
        if (delErr) throw delErr;
        
        save();
        await updateLobbySnapshot();
        broadcastEvent(`🔥 صفقة مدوية! اشترى ${me.name} النجم ${newPlayer.name} من ${listing.team_name} مقابل ${price}M!`, true, '💰');
        loadLiveMarket();
        
    } catch (e) {
        console.error(e);
        showGameAlert('حدث خطأ أثناء الشراء', '❌');
    }
}

async function cancelMarketListing(listingId, playerId) {
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return;
        
        const { data: listing } = await _db.from('market_listings').select('*').eq('id', listingId).single();
        if (!listing) return;
        
        const me = T[G.my];
        const newPlayer = { ...listing.player_data, id: playerId || ('R_' + Date.now()) };
        me.ps.push(newPlayer);
        autoAssignRoles();
        
        await _db.from('market_listings').delete().eq('id', listingId);
        save();
        await updateLobbySnapshot();
        
        showOnlineToast(`استعدت اللاعب ${newPlayer.name} لتشكيلتك`, '✅');
        loadLiveMarket();
        
    } catch (e) {
        console.error(e);
        showGameAlert('حدث خطأ', '❌');
    }
}

async function updateLobbySnapshot() {
    if (!G || !G.multiplayerLeagueId) return;
    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) return;
        
        const me = T[G.my];
        const snap = { 
            name: me.name, R: me.R, c1: me.c1, c2: me.c2,
            form: G.form, tac: G.tac, starters: G.lu.map(id => me.ps.find(p => p.id === id)).filter(Boolean) 
        };
        
        await _db.from('lobby_slots').update({ team_snapshot: snap, manager_name: getManagerName() }).eq('lobby_id', G.multiplayerLeagueId).eq('user_id', user.id);
    } catch (e) { console.error(e); }
}

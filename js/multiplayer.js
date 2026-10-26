// ============================================
// multiplayer.js - نظام الغرف المباشرة (النسخة النهائية للانضمام للأصدقاء)
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

// إيقاف جميع المؤقتات
function stopLobbyTimers() {
    if (liveInterval) clearInterval(liveInterval);
    if (timeLeftInterval) clearInterval(timeLeftInterval);
    if (mpCompInterval) clearInterval(mpCompInterval);
    if (globalWatcherInterval) clearInterval(globalWatcherInterval);
    liveInterval = null; 
    timeLeftInterval = null; 
    mpCompInterval = null; 
    globalWatcherInterval = null;
}

// تجهيز اللعبة محلياً إذا لم تكن جاهزة
function ensureLocalGameReady(slot) {
    try {
        if (typeof T === 'undefined' || Object.keys(T).length === 0) {
            if (typeof mk === 'function') mk('egypt');
        }
        if (typeof G === 'undefined' || !G) window.G = {};
        
        if (slot && slot.team_id && T[slot.team_id]) {
            G.my = slot.team_id;
        } else if (!G.my || !T[G.my]) {
            G.my = Object.keys(T)[0];
        }
        
        G.form = G.form || '4-3-3'; 
        G.tac = G.tac || 'balanced';
        G.lu = autoFillLineup(T[G.my], G.form);
        
        if (!G.season && typeof generateSeason === 'function') {
            G.season = generateSeason(G.my, null);
        }
    } catch (e) {
        console.error("Error in ensureLocalGameReady:", e);
    }
}

// ============================================
// 1. صفحة اللوبي (البحث عن الغرفة المناسبة)
// ============================================
async function showLeaguesPage() {
    stopLobbyTimers(); 
    isSeasonStarting = false;
    
    // إذا كان اللاعب يملك فريقاً بالفعل، نوجهه فوراً لواجهة اللعبة
    if (typeof G !== 'undefined' && G && G.multiplayerLeagueId) {
        try {
            const { data: { user } } = await _db.auth.getUser();
            if (user) {
                const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', G.multiplayerLeagueId).eq('user_id', user.id);
                if (slots && slots.length > 0) {
                    mySlot = slots[0];
                    ensureLocalGameReady(mySlot);
                    startGlobalLobbyWatcher();
                    if (typeof dash === 'function') { dash(); return; }
                }
            }
        } catch (e) { console.error("Redirect Error:", e); }
    }

    $('main').innerHTML = `<div style="text-align:center; padding:50px 20px;"><div style="font-size:40px; animation: logoBounce 1s infinite alternate;">⏳</div><div style="color:var(--gold); font-weight:bold; margin-top:15px; font-size:16px;">جاري البحث عن غرفة...</div></div>`;

    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) throw new Error("يجب تسجيل الدخول أولاً");

        // 1. البحث عن غرفة موجود بها المستخدم (في حال كان في غرفة سابقة)
        const { data: mySlots } = await _db.from('lobby_slots')
            .select('lobby_id, lobbies!inner(id, status)')
            .eq('user_id', user.id)
            .in('lobbies.status', ['waiting', 'active'])
            .limit(1);

        if (mySlots && mySlots.length > 0) {
            const { data: lobbyData } = await _db.from('lobbies').select('*').eq('id', mySlots[0].lobby_id).single();
            currentLobby = lobbyData;
            G.multiplayerLeagueId = currentLobby.id; save();
            
            await loadLobbyData();
            ensureLocalGameReady(mySlot);
            startGlobalLobbyWatcher();
            
            if (currentLobby.status === 'active') {
                if (typeof dash === 'function') { dash(); return; }
            } else {
                renderWaitingRoom(); startCountdownTimer(); liveInterval = setInterval(fetchUpdates, 3000);
            }
            return;
        }

        // 2. اللاعب ليس في غرفة. جلب جميع الغرف المفتوحة
        let { data: openLobbies } = await _db.from('lobbies')
            .select('*')
            .eq('status', 'waiting')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: true });

        let availableLobbies = [];
        if (openLobbies) {
            for (const l of openLobbies) {
                const { count } = await _db.from('lobby_slots').select('*', { count: 'exact', head: true }).eq('lobby_id', l.id).not('user_id', 'is', null);
                if (count < 10) {
                    availableLobbies.push({ lobby: l, count: count });
                }
            }
        }

        // ✅ الترتيب الذكي: الانضمام للغرفة التي بها أكبر عدد من اللاعبين (لكي ننضم لأصدقائنا)
        availableLobbies.sort((a, b) => b.count - a.count);

        if (availableLobbies.length > 0) {
            // الانضمام للغرفة الأكثر امتلاءً
            currentLobby = availableLobbies[0].lobby;
        } else {
            // إذا لم توجد أي غرف متاحة، قم بإنشاء غرفة جديدة
            const expDate = new Date(Date.now() + 60 * 60000).toISOString();
            const { data: newLobby, error } = await _db.from('lobbies').insert({ status: 'waiting', expires_at: expDate }).select().single();
            if (error) throw error;
            
            const teams = LEAGUES['egypt'].teams.slice(0, 10);
            await _db.from('lobby_slots').insert(teams.map(t => ({ lobby_id: newLobby.id, team_id: t[0], team_name: t[1] })));
            currentLobby = newLobby;
        }

        await loadLobbyData();
        renderWaitingRoom();
        startCountdownTimer();
        liveInterval = setInterval(fetchUpdates, 3000);

    } catch (error) {
        console.error("Lobby Error:", error);
        $('main').innerHTML = `<div class="c" style="text-align:center; color:#ef4444; padding:20px;">خطأ: ${error.message}<br><br><button class="b a" onclick="showLeaguesPage()">إعادة المحاولة</button></div>`;
    }
}

async function loadLobbyData() {
    try {
        const { data: { user } } = await _db.auth.getUser();
        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id).order('team_name');
        currentSlots = slots || [];
        mySlot = currentSlots.find(s => s.user_id === user.id) || null;
    } catch (e) { console.error("loadLobbyData error:", e); }
}

async function fetchUpdates() {
    if (!currentLobby) return;
    try {
        const { data: lobby } = await _db.from('lobbies').select('*').eq('id', currentLobby.id).single();
        if (lobby) currentLobby = lobby;

        if (currentLobby.status === 'active') { 
            stopLobbyTimers(); 
            ensureLocalGameReady(mySlot);
            if (typeof dash === 'function') dash(); 
            return; 
        }

        if (currentLobby.status === 'waiting') {
            const timeUp = new Date(currentLobby.expires_at).getTime() <= new Date().getTime();
            const isFull = currentSlots.filter(s => s.user_id).length >= 10;
            if ((timeUp || isFull) && !isSeasonStarting) {
                isSeasonStarting = true; 
                await tryStartSeason(); 
                return;
            }
        }

        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id).order('team_name');
        const newSlots = slots || [];
        
        if (JSON.stringify(newSlots) !== JSON.stringify(currentSlots)) {
            currentSlots = newSlots;
            const { data: { user } } = await _db.auth.getUser();
            mySlot = currentSlots.find(s => s.user_id === user.id) || null;
            renderWaitingRoom();
        }
    } catch (e) { console.error("fetchUpdates error:", e); }
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

async function tryStartSeason() {
    if (currentLobby.status !== 'waiting') return;
    try {
        const { data: updated } = await _db.from('lobbies').update({ status: 'active' }).eq('id', currentLobby.id).eq('status', 'waiting').select();
        if (!updated || updated.length === 0) { isSeasonStarting = false; return; }

        const activeSlots = currentSlots.filter(s => s.user_id);
        if (activeSlots.length < 2) {
            await _db.from('lobbies').update({ status: 'waiting', expires_at: new Date(Date.now() + 60 * 60000).toISOString() }).eq('id', currentLobby.id);
            isSeasonStarting = false; 
            return;
        }

        const fixtures = generateRoundRobin(activeSlots);
        await _db.from('lobby_matches').insert(fixtures.map(f => ({ lobby_id: currentLobby.id, round: f.round, home_slot_id: f.home.id, away_slot_id: f.away.id })));
        
        alert("⏳ بدأ الموسم رسمياً! تفقد صفحة البطولات.");
        stopLobbyTimers(); 
        startGlobalLobbyWatcher(); 
        ensureLocalGameReady(mySlot);
        if (typeof dash === 'function') dash(); 
    } catch (e) { console.error("tryStartSeason error:", e); }
}

function generateRoundRobin(teams) {
    let ts = [...teams]; 
    if (ts.length % 2 !== 0) ts.push(null);
    const rounds = ts.length - 1, half = ts.length / 2, fixtures = [];
    for (let r = 1; r <= rounds; r++) {
        for (let i = 0; i < half; i++) {
            const a = ts[i], b = ts[ts.length - 1 - i];
            if (a && b) fixtures.push({ round: r, home: r % 2 === 0 ? b : a, away: r % 2 === 0 ? a : b });
        }
        ts.splice(1, 0, ts.pop());
    }
    return fixtures;
}

function renderWaitingRoom() {
    const joinedCount = currentSlots.filter(s => s.user_id).length;
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
            <div style="margin-top:8px; color:#fbbf24; font-size:12px;">👇 اضغط على فريق لاختياره والدخول للتجهيز</div>
        </div>
        <div class="g2">`;

    currentSlots.forEach(slot => {
        const isTaken = !!slot.user_id;
        const isMe = mySlot && String(slot.id) === String(mySlot.id);
        
        let bg = isMe ? 'rgba(251,191,36,.2)' : (isTaken ? 'rgba(15,34,56,.8)' : 'rgba(30,58,138,.4)');
        let border = isMe ? '#fbbf24' : (isTaken ? '#ef4444' : '#22c55e');
        let statusHtml = isMe 
            ? `<div style="font-size:10px; color:#fbbf24; font-weight:bold; margin-top:4px;">⭐ فريقك</div>`
            : (isTaken ? `<div style="font-size:10px; color:#ef4444; font-weight:bold; margin-top:4px;">🔒 ${slot.manager_name || 'محجوز'}</div>` : `<div style="font-size:10px; color:#4ade80; font-weight:bold; margin-top:4px;">🟢 متاح</div>`);
        
        let isDisabled = isTaken || isFull || hasTeam;
        let onclick = isDisabled ? '' : `onclick="claimLiveTeam('${slot.id}', this)"`;
        let cursor = isDisabled ? 'default' : 'pointer';
        
        html += `<button class="team-select-card" ${onclick} style="cursor:${cursor}; background:${bg}; border:1px solid ${border}; padding:12px; border-radius:10px; transition:0.2s; width:100%; display:block; text-align:center; color:inherit; font-family:inherit;">
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

        ensureLocalGameReady(chosenSlot);

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
            return alert('عذراً، سبقك مدرب آخر واختار هذا الفريق للتو!');
        }

        if (!G.season && typeof generateSeason === 'function') G.season = generateSeason(G.my, null);
        
        G.multiplayerLeagueId = currentLobby.id;
        save(); 
        stopLobbyTimers();
        startGlobalLobbyWatcher(); 
        
        alert("✅ تم اختيار الفريق!\nأنت الآن في واجهة اللعبة، يمكنك تجهيز خطتك وسوق الانتقالات بينما ينتظر باقي اللاعبين.");
        
        G.tab = 'lu'; 
        if (typeof dash === 'function') dash(); 

    } catch (err) {
        console.error('Claim Team Error:', err);
        if (btnEl) { btnEl.style.opacity = '1'; btnEl.style.pointerEvents = 'auto'; }
        alert('تعذر اختيار الفريق: ' + err.message);
    }
}

function startGlobalLobbyWatcher() {
    if (globalWatcherInterval) clearInterval(globalWatcherInterval);
    if (!G || !G.multiplayerLeagueId) return;

    globalWatcherInterval = setInterval(async () => {
        try {
            const { data: lobby } = await _db.from('lobbies').select('*').eq('id', G.multiplayerLeagueId).single();
            if (!lobby) return;

            if (lobby.status === 'active') {
                clearInterval(globalWatcherInterval);
                alert("⏳ بدأ الموسم! توجه إلى صفحة البطولات لترى مبارياتك.");
                if (G.tab === 'comp' || typeof G.tab === 'undefined') switchTab('comp');
            } else if (lobby.status === 'waiting') {
                const { count } = await _db.from('lobby_slots').select('*', { count: 'exact', head: true }).eq('lobby_id', lobby.id).not('user_id', 'is', null);
                const timeUp = new Date(lobby.expires_at).getTime() <= new Date().getTime();
                
                if (count >= 10 || timeUp) {
                    const { data: updated } = await _db.from('lobbies').update({ status: 'active' }).eq('id', lobby.id).eq('status', 'waiting').select();
                    if (updated && updated.length > 0) {
                        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobby.id);
                        const activeSlots = slots.filter(s => s.user_id);
                        if (activeSlots.length >= 2) {
                            const fixtures = generateRoundRobin(activeSlots);
                            await _db.from('lobby_matches').insert(fixtures.map(f => ({ lobby_id: lobby.id, round: f.round, home_slot_id: f.home.id, away_slot_id: f.away.id })));
                        } else {
                            await _db.from('lobbies').update({ status: 'waiting', expires_at: new Date(Date.now() + 60 * 60000).toISOString() }).eq('id', lobby.id);
                        }
                    }
                }
            }
        } catch(e) { console.error("Watcher Error:", e); }
    }, 10000); 
}

async function forceNewLobby() {
    try {
        stopLobbyTimers();
        $('main').innerHTML = `<div style="text-align:center; padding:50px; color:var(--gold);">⏳ جاري إنشاء غرفة جديدة...</div>`;
        const { data: { user } } = await _db.auth.getUser();
        if (user && currentLobby) {
            await _db.from('lobby_slots').update({ user_id: null, manager_name: null, team_snapshot: null }).eq('lobby_id', currentLobby.id).eq('user_id', user.id);
        }
        // العودة للصفحة الرئيسية للبحث وتوزيع المستخدم من جديد
        showLeaguesPage();
    } catch (e) { alert('خطأ: ' + e.message); showLeaguesPage(); }
}

async function loadMultiplayerCompData() {
    if (mpCompInterval) clearInterval(mpCompInterval);
    
    const fetchAndRender = async () => {
        const container = document.getElementById('mp-league-content');
        if (!container) {
            if (mpCompInterval) clearInterval(mpCompInterval);
            return;
        }

        try {
            const { data: lobby } = await _db.from('lobbies').select('*').eq('id', G.multiplayerLeagueId).single();
            if (!lobby) return;

            const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobby.id).order('team_name');
            const { data: matches } = await _db.from('lobby_matches').select('*').eq('lobby_id', lobby.id).order('round');
            const { data: { user } } = await _db.auth.getUser();
            if (!user || !slots) return;
            
            const mySlot = slots.find(s => s.user_id === user.id);
            if (!mySlot) { container.innerHTML = `<div style="color:#ef4444; text-align:center; padding:15px;">أنت لست مشاركاً في هذا الدوري.</div>`; return; }

            if (lobby.status === 'waiting') {
                const joinedCount = slots.filter(s => s.user_id).length;
                const diff = Math.max(0, new Date(lobby.expires_at).getTime() - new Date().getTime());
                const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
                container.innerHTML = `
                    <div style="text-align:center; padding:15px; background:rgba(0,0,0,.3); border-radius:10px;">
                        <div style="color:#fbbf24; font-size:14px; font-weight:bold; margin-bottom:5px;">⏳ بانتظار بدء الموسم...</div>
                        <div style="font-size:13px; color:#fff;">اللاعبون المنضمون: <b style="color:#4ade80">${joinedCount}</b> / 10</div>
                        <div style="font-size:20px; color:#4ade80; font-weight:900; margin-top:10px;">⏱️ ${m}:${s.toString().padStart(2, '0')}</div>
                        <div style="font-size:10px; color:#94a3b8; margin-top:8px;">يمكنك الآن تجهيز خطتك والسوق!</div>
                    </div>
                `;
                return;
            }

            const sorted = slots.filter(s => s.user_id).sort((a, b) => (b.points||0) - (a.points||0) || ((b.goals_for||0) - (b.goals_against||0)) - ((a.goals_for||0) - (a.goals_against||0)));
            
            let html = `<div style="font-size:11px; text-align:center; color:var(--gold); margin-bottom:5px;">جدول الترتيب المباشر 🔴</div>
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

            const myMatches = (matches || []).filter(m => (m.home_slot_id === mySlot.id || m.away_slot_id === mySlot.id));
            html += `<div style="font-size:11px; text-align:center; color:var(--gold); margin-bottom:5px;">مبارياتي في الدوري</div>`;
            
            myMatches.forEach(m => {
                const isHome = m.home_slot_id === mySlot.id;
                const oppId = isHome ? m.away_slot_id : m.home_slot_id;
                const opp = slots.find(s => s.id === oppId) || { team_name: 'خصم' };
                
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.05); padding:6px; margin-bottom:4px; border-radius:6px;">
                    <div style="font-size:10px; color:#94a3b8; width:25px;">ج${m.round}</div>
                    <div style="font-size:11px; font-weight:bold; color:#fff; flex:1; text-align:center;">
                        ${isHome ? mySlot.team_name : opp.team_name} vs ${isHome ? opp.team_name : mySlot.team_name}
                    </div>
                    ${m.played 
                        ? `<div style="font-size:12px; color:var(--gold); font-weight:900; width:45px; text-align:left;">${m.home_score} - ${m.away_score}</div>`
                        : `<button class="b g sm" style="padding:4px 10px; font-size:10px;" onclick="playMultiplayerMatch('${m.id}', '${lobby.id}')">▶ العب</button>`
                    }
                </div>`;
            });

            container.innerHTML = html;
        } catch (e) { console.error("loadMultiplayerCompData error:", e); }
    };

    await fetchAndRender();
    mpCompInterval = setInterval(fetchAndRender, 5000);
}

async function playMultiplayerMatch(matchId, lobbyId) {
    try {
        const { data: match } = await _db.from('lobby_matches').select('*').eq('id', matchId).single();
        if (!match || match.played) return alert('تم لعب هذه المباراة بالفعل!');

        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobbyId);
        const { data: { user } } = await _db.auth.getUser();
        const mySlot = slots.find(s => s.user_id === user.id);
        
        const isHome = match.home_slot_id === mySlot.id;
        const oppId = isHome ? match.away_slot_id : match.home_slot_id;
        const oppSlot = slots.find(s => s.id === oppId);

        ensureLocalGameReady(mySlot);

        let oppTeamData = oppSlot?.team_snapshot;
        let oppTeamId = 'OPP_' + oppSlot.id.substring(0, 6);
        
        if (!oppTeamData || !oppTeamData.starters || oppTeamData.starters.length < 11) {
            T[oppTeamId] = { id: oppTeamId, name: oppSlot.team_name, R: 75, c1: '#1e40af', c2: '#fff', budget: 100, ps: [], form: '4-3-3', tac: 'balanced' };
            const posList = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
            for(let i=0; i<11; i++) {
                T[oppTeamId].ps.push({ id: oppTeamId+'_'+i, name: oppSlot.team_name+' '+(i+1), pos: posList[i], r: 75, lvl: 1, age: 24, pace:75, shooting:75, passing:75, dribbling:75, defending:75, physical:75, fit:100, morale:85 });
            }
        } else {
            T[oppTeamId] = buildTeamFromSnapshot(oppTeamData, oppTeamId);
        }

        const myStarters = G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean);
        const oppStarters = T[oppTeamId].ps.slice(0, 11);

        const newSnap = { name: T[G.my].name, R: T[G.my].R, form: G.form, tac: G.tac, starters: myStarters };
        await _db.from('lobby_slots').update({ team_snapshot: newSnap }).eq('id', mySlot.id);

        const matchConfig = {
            h: isHome ? T[G.my] : T[oppTeamId],
            a: isHome ? T[oppTeamId] : T[G.my],
            hl: isHome ? myStarters : oppStarters,
            al: isHome ? oppStarters : myStarters,
            hf: isHome ? (G.form || '4-3-3') : (oppTeamData?.form || '4-3-3'),
            af: isHome ? (oppTeamData?.form || '4-3-3') : (G.form || '4-3-3'),
            ht: isHome ? (G.tac || 'balanced') : (oppTeamData?.tac || 'balanced'),
            at: isHome ? (oppTeamData?.tac || 'balanced') : (G.tac || 'balanced'),
            human: isHome ? 'home' : 'away',
            compName: `الدوري المباشر 🌐`,
            weather: (typeof WEATHERS !== 'undefined' && WEATHERS[0]) ? WEATHERS[0] : {type:'مشمس', emoji:'☀️', accuracy:1.0, stamina:1.0}
        };

        alert("جاري محاكاة المباراة...");
        const matchEng = new Match(matchConfig);
        let safety = 0;
        while (!matchEng.done && safety < 40000) { matchEng.step(); safety++; }
        
        const hg = matchEng.s.home.g;
        const ag = matchEng.s.away.g;

        await _db.from('lobby_matches').update({ home_score: hg, away_score: ag, played: true }).eq('id', matchId);

        const homeSlot = slots.find(s => s.id === match.home_slot_id);
        const awaySlot = slots.find(s => s.id === match.away_slot_id);

        const updateSlot = async (slot, gf, ga, isWin, isDraw) => {
            await _db.from('lobby_slots').update({
                played: (slot.played || 0) + 1, 
                won: (slot.won || 0) + (isWin ? 1 : 0), 
                drawn: (slot.drawn || 0) + (isDraw ? 1 : 0),
                lost: (slot.lost || 0) + (!isWin && !isDraw ? 1 : 0), 
                goals_for: (slot.goals_for || 0) + gf,
                goals_against: (slot.goals_against || 0) + ga, 
                points: (slot.points || 0) + (isWin ? 3 : (isDraw ? 1 : 0))
            }).eq('id', slot.id);
        };

        const homeWin = hg > ag;
        const draw = hg === ag;

        await updateSlot(homeSlot, hg, ag, homeWin, draw);
        await updateSlot(awaySlot, ag, hg, !homeWin && !draw, draw);

        const homeName = isHome ? mySlot.team_name : oppSlot.team_name;
        const awayName = isHome ? oppSlot.team_name : mySlot.team_name;
        alert(`⚽ انتهت المباراة!\n${homeName} ${hg} - ${ag} ${awayName}`);
        
        if (typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData();

    } catch (err) {
        console.error('MP Match Error:', err);
        alert('حدث خطأ أثناء تشغيل المباراة: ' + err.message);
    }
}

function buildTeamFromSnapshot(snap, teamId) {
    const ps = (snap.starters || []).map((p, idx) => ({
        ...p, id: p.id || (teamId + '_' + idx), fit: 100, morale: p.morale || 85, susp: 0, injury: null,
        stats: { passes: 0, tackles: 0, shots: 0 }
    }));
    const avgR = ps.length ? Math.round(ps.reduce((s, p) => s + (p.r || 75), 0) / ps.length) : 75;
    return { id: teamId, name: snap.name || 'فريق منافس', R: snap.R || avgR, c1: snap.c1 || '#1e40af', c2: snap.c2 || '#ffffff', budget: 100, ps: ps, form: snap.form || '4-3-3', tac: snap.tac || 'balanced' };
}

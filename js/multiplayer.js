// ============================================
// multiplayer.js - نظام الغرف المباشرة (النسخة النهائية المصححة والمحصنة)
// ============================================

let currentLobby = null;
let currentSlots = [];
let currentMatches = [];
let liveInterval = null;
let timeLeftInterval = null;
let mpCompInterval = null; // مؤقت تحديث صفحة البطولات
let mySlot = null;
let isSeasonStarting = false;

function stopLobbyTimers() {
    if (liveInterval) clearInterval(liveInterval);
    if (timeLeftInterval) clearInterval(timeLeftInterval);
    if (mpCompInterval) clearInterval(mpCompInterval);
    liveInterval = null;
    timeLeftInterval = null;
    mpCompInterval = null;
}

// ✅ دالة بناء فريق الخصم من بيانات السحابة (كانت مفقودة وتمت إضافتها)
function buildTeamFromSnapshot(snap, teamId) {
    const ps = (snap.starters || []).map((p, idx) => ({
        ...p,
        id: p.id || (teamId + '_' + idx),
        fit: 100,
        morale: p.morale || 85,
        susp: 0,
        injury: null,
        stats: p.stats || { matches: 0, goals: 0, assists: 0, rating: 0, tackles: 0, passes: 0 }
    }));

    const avgR = ps.length ? Math.round(ps.reduce((s, p) => s + (p.r || 75), 0) / ps.length) : 75;

    return {
        id: teamId,
        name: snap.name || 'فريق منافس',
        R: snap.R || avgR,
        c1: snap.c1 || '#1e40af',
        c2: snap.c2 || '#ffffff',
        gk: snap.gk || '#f9a825',
        budget: 100,
        ps: ps,
        form: snap.form || '4-3-3',
        tac: snap.tac || 'balanced'
    };
}

// ✅ التأكد من تهيئة فريق اللاعب محلياً عند دخول الغرفة النشطة
function ensureLocalGameReady(slot) {
    if (typeof T === 'undefined' || Object.keys(T).length === 0) {
        if (typeof mk === 'function') mk('egypt');
    }
    if (typeof G === 'undefined' || !G) window.G = {};

    if (!G.my || !T[G.my]) {
        const chosenId = (slot && slot.team_id && T[slot.team_id]) ? slot.team_id : Object.keys(T)[0];
        G.my = chosenId;
        G.form = '4-3-3';
        G.tac = 'balanced';
        G.lu = autoFillLineup(T[G.my], G.form);
        G.seasonNumber = G.seasonNumber || 1;
        G.trophies = G.trophies || 0;
        if (!G.season && typeof generateSeason === 'function') {
            G.season = generateSeason(G.my, null);
        }
    }
}

// 1. صفحة اللوبي (البحث عن غرفة)
async function showLeaguesPage() {
    stopLobbyTimers();
    isSeasonStarting = false;
    $('main').innerHTML = `<div style="text-align:center; padding:50px 20px;"><div style="font-size:40px; animation: logoBounce 1s infinite alternate;">⏳</div><div style="color:var(--gold); font-weight:bold; margin-top:15px; font-size:16px;">جاري الاتصال بالدوري...</div></div>`;

    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) throw new Error("يجب تسجيل الدخول أولاً");

        const { data: mySlots } = await _db.from('lobby_slots')
            .select('lobby_id, lobbies!inner(id, status)')
            .eq('user_id', user.id)
            .in('lobbies.status', ['waiting', 'active'])
            .limit(1);

        if (mySlots && mySlots.length > 0) {
            const { data: lobbyData } = await _db.from('lobbies').select('*').eq('id', mySlots[0].lobby_id).single();
            currentLobby = lobbyData;
        } else {
            const { data: openLobbies } = await _db.from('lobbies').select('*').eq('status', 'waiting').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true });
            let foundLobby = null;
            if (openLobbies) {
                for (const l of openLobbies) {
                    const { count } = await _db.from('lobby_slots').select('*', { count: 'exact', head: true }).eq('lobby_id', l.id).not('user_id', 'is', null);
                    if (count < 10) { foundLobby = l; break; }
                }
            }
            
            if (!foundLobby) {
                const expDate = new Date(Date.now() + 15 * 60000).toISOString(); // 15 دقيقة افتراضياً إذا لم يعينها السيرفر
                const { data: newLobby, error } = await _db.from('lobbies').insert({ status: 'waiting', expires_at: expDate }).select().single();
                if (error) throw error;
                foundLobby = newLobby;
                const teams = LEAGUES['egypt'].teams.slice(0, 10);
                await _db.from('lobby_slots').insert(teams.map(t => ({ lobby_id: foundLobby.id, team_id: t[0], team_name: t[1] })));
            }
            currentLobby = foundLobby;
        }

        await loadLobbyData();
        
        // إذا كانت الغرفة نشطة (بدأت) نوجهه فوراً للعبة بعد تأمين البيانات المحلية
        if (currentLobby.status === 'active') {
            ensureLocalGameReady(mySlot);
            G.multiplayerLeagueId = currentLobby.id;
            save();
            if ($('bottom-nav')) $('bottom-nav').hidden = false;
            dash();
            return;
        }

        renderWaitingRoom();
        startCountdownTimer();
        liveInterval = setInterval(fetchUpdates, 3000);

    } catch (error) {
        console.error(error);
        $('main').innerHTML = `<div class="c" style="text-align:center; color:#ef4444; padding:20px;">خطأ: ${error.message}<br><br><button class="b a" onclick="showLeaguesPage()">إعادة المحاولة</button></div>`;
    }
}

async function loadLobbyData() {
    const { data: { user } } = await _db.auth.getUser();
    const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id).order('team_name');
    currentSlots = slots || [];
    mySlot = currentSlots.find(s => s.user_id === user.id);

    if (currentLobby.status === 'active') {
        const { data: matches } = await _db.from('lobby_matches').select('*').eq('lobby_id', currentLobby.id).order('round');
        currentMatches = matches || [];
    }
}

async function fetchUpdates() {
    if (!currentLobby) return;
    const { data: lobby } = await _db.from('lobbies').select('*').eq('id', currentLobby.id).single();
    if (lobby) currentLobby = lobby;

    // إذا تحولت الغرفة إلى نشطة بواسطة لاعب آخر
    if (currentLobby.status === 'active') {
        stopLobbyTimers();
        ensureLocalGameReady(mySlot);
        G.multiplayerLeagueId = currentLobby.id;
        save();
        if ($('bottom-nav')) $('bottom-nav').hidden = false;
        dash();
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
        mySlot = currentSlots.find(s => s.user_id === user.id);
        renderWaitingRoom();
    }
}

function startCountdownTimer() {
    if (timeLeftInterval) clearInterval(timeLeftInterval);
    timeLeftInterval = setInterval(() => {
        const el = document.getElementById('live-countdown');
        if (!el || !currentLobby) return;
        
        const end = new Date(currentLobby.expires_at).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, end - now);
        
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `⏳ ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

async function tryStartSeason() {
    if (currentLobby.status !== 'waiting') return;
    
    const { data: updated } = await _db.from('lobbies').update({ status: 'active' }).eq('id', currentLobby.id).eq('status', 'waiting').select();
    if (!updated || updated.length === 0) { isSeasonStarting = false; return; }

    const activeSlots = currentSlots.filter(s => s.user_id);
    if (activeSlots.length < 2) {
        await _db.from('lobbies').update({ status: 'waiting', expires_at: new Date(Date.now() + 60 * 60000).toISOString() }).eq('id', currentLobby.id);
        isSeasonStarting = false;
        return;
    }

    const fixtures = generateRoundRobin(activeSlots);
    const inserts = fixtures.map(f => ({
        lobby_id: currentLobby.id,
        round: f.round,
        home_slot_id: f.home.id,
        away_slot_id: f.away.id
    }));
    
    await _db.from('lobby_matches').insert(inserts);
    alert("⏳ بدأ الموسم رسمياً! تم نقلك لواجهة اللعبة.");
    
    stopLobbyTimers();
    ensureLocalGameReady(mySlot);
    G.multiplayerLeagueId = currentLobby.id;
    save();
    if ($('bottom-nav')) $('bottom-nav').hidden = false;
    dash(); 
}

function generateRoundRobin(teams) {
    let ts = [...teams];
    if (ts.length % 2 !== 0) ts.push(null);
    const rounds = ts.length - 1;
    const half = ts.length / 2;
    const fixtures = [];
    for (let r = 1; r <= rounds; r++) {
        for (let i = 0; i < half; i++) {
            const a = ts[i], b = ts[ts.length - 1 - i];
            if (a && b) {
                if (r % 2 === 0) fixtures.push({ round: r, home: b, away: a });
                else fixtures.push({ round: r, home: a, away: b });
            }
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
        <button class="b sm" style="padding:4px 10px; font-size:10px; margin-bottom:10px; position:absolute; right:10px; top:10px;" onclick="stopLobbyTimers(); showSetup()">⬅ خروج</button>
        
        <div style="text-align:center; margin-bottom:15px; margin-top:20px;">
            <div style="display:inline-block; background:rgba(239,68,68,.2); border:1px solid #ef4444; padding:4px 12px; border-radius:20px; color:#ef4444; font-size:12px; font-weight:bold; margin-bottom:10px;">🔴 غرفة الانتظار</div>
            <h2 style="color:var(--gold); font-size:18px; margin-bottom:5px;">تحدي الـ 10 مدربين</h2>
            <div style="font-size:13px; color:#cbd5e1; margin-bottom:8px;">المنضمون: <b style="color:#4ade80">${joinedCount}</b> / 10</div>
            <div id="live-countdown" style="font-size:20px; font-weight:900; color:#fbbf24; background:rgba(0,0,0,.3); padding:6px; border-radius:8px; display:inline-block;">--:--</div>
        </div>
        <div class="g2">`;

    currentSlots.forEach(slot => {
        const isTaken = !!slot.user_id;
        const isMe = mySlot && slot.id === mySlot.id;
        
        let bg = isMe ? 'rgba(251,191,36,.15)' : (isTaken ? 'rgba(15,34,56,.8)' : 'rgba(30,58,138,.4)');
        let border = isMe ? '#fbbf24' : (isTaken ? '#ef4444' : '#22c55e');
        let statusHtml = isTaken ? `<div style="font-size:10px; color:#ef4444; font-weight:bold; margin-top:4px;">🔒 ${slot.manager_name}</div>` : `<div style="font-size:10px; color:#4ade80; font-weight:bold; margin-top:4px;">🟢 متاح</div>`;
        
        let isDisabled = isTaken || isFull || hasTeam;
        let onclick = isDisabled ? '' : `onclick="claimLiveTeam('${slot.id}', this)"`;
        let cursor = isDisabled ? 'default' : 'pointer';
        
        html += `<div class="team-select-card" ${onclick} style="cursor:${cursor}; background:${bg}; border:1px solid ${border}; padding:10px;">
            <div class="bd" style="font-size:14px; width:35px; height:35px; margin:0 auto 5px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; background:rgba(255,255,255,0.1);">${slot.team_name[0]}</div>
            <b style="font-size:11px; display:block; text-align:center; color:#fff;">${slot.team_name}</b>
            ${statusHtml}
        </div>`;
    });
    html += `</div></div>`;
    $('main').innerHTML = html;
}

async function claimLiveTeam(slotId, btnEl) {
    const { data: { user } } = await _db.auth.getUser();
    if (!user) return alert('يجب تسجيل الدخول أولاً!');
    if (mySlot) return alert('لقد اخترت فريقاً بالفعل!');
    
    const chosenSlot = currentSlots.find(s => s.id === slotId);
    ensureLocalGameReady(chosenSlot);

    let snap = {};
    if (typeof G !== 'undefined' && G.my && T[G.my]) {
        snap = { 
            name: T[G.my].name, 
            R: T[G.my].R,
            c1: T[G.my].c1,
            c2: T[G.my].c2,
            form: G.form || '4-3-3', 
            tac: G.tac || 'balanced', 
            starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) 
        };
    }

    if (btnEl) btnEl.style.opacity = '0.5';

    const mgrName = (typeof G !== 'undefined' && G.managerName) ? G.managerName : ((typeof tempUserData !== 'undefined' && tempUserData.managerName) ? tempUserData.managerName : 'مدرب');

    const { data: success, error } = await _db.rpc('claim_lobby_team', {
        p_slot_id: slotId, 
        p_user_id: user.id,
        p_manager_name: mgrName,
        p_team_snapshot: snap
    });

    if (error || !success) {
        if (btnEl) btnEl.style.opacity = '1';
        return alert('عذراً، تم اختيار هذا الفريق للتو أو أنك تملك فريقاً بالفعل!');
    }
    
    await fetchUpdates();
}

// ============================================
// الجزء الخاص بـ واجهة اللعبة (صفحة البطولات)
// ============================================

async function loadMultiplayerCompData() {
    if (mpCompInterval) clearInterval(mpCompInterval);
    
    const fetchAndRender = async () => {
        const container = document.getElementById('mp-league-content');
        if (!container) {
            if (mpCompInterval) clearInterval(mpCompInterval);
            return;
        }

        const { data: lobby } = await _db.from('lobbies').select('*').eq('id', G.multiplayerLeagueId).single();
        if (!lobby) return;

        const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobby.id).order('team_name');
        const { data: matches } = await _db.from('lobby_matches').select('*').eq('lobby_id', lobby.id).order('round');
        const { data: { user } } = await _db.auth.getUser();
        if (!user || !slots) return;
        
        const mySlot = slots.find(s => s.user_id === user.id);

        if (!mySlot) {
            container.innerHTML = `<div style="color:#ef4444; text-align:center; padding:15px;">أنت لست مشاركاً في هذا الدوري.</div>`;
            return;
        }

        const sorted = slots.filter(s => s.user_id).sort((a, b) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against));
        
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
    };

    await fetchAndRender();
    mpCompInterval = setInterval(fetchAndRender, 5000);
}

// ✅ دالة لعب مباراة الأونلاين (مصححة بالكامل لتمرير كائنات اللاعبين بشكل سليم)
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
        
        // بناء فريق الخصم بأمان
        if (!oppTeamData || !oppTeamData.starters || oppTeamData.starters.length < 11) {
            if (typeof createVirtualTeam === 'function') {
                T[oppTeamId] = createVirtualTeam(oppTeamId, oppSlot.team_name, 75);
            } else {
                T[oppTeamId] = { id: oppTeamId, name: oppSlot.team_name, R: 75, c1: '#1e40af', c2: '#fff', budget: 100, ps: [], form: '4-3-3', tac: 'balanced' };
                const posList = ['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
                for(let i=0; i<11; i++) {
                    T[oppTeamId].ps.push(createPlayer(oppTeamId+'_'+i, oppSlot.team_name+' '+(i+1), posList[i], 75, 24));
                }
            }
        } else {
            T[oppTeamId] = buildTeamFromSnapshot(oppTeamData, oppTeamId);
        }

        // تجهيز كائنات اللاعبين الـ 11 لكلا الفريقين (وليس مجرد IDs نصية!)
        const myStarters = G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean);
        const oppStarters = T[oppTeamId].ps.slice(0, 11);

        // تحديث تشكيلتك الحالية على السحابة
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

// ============================================
// multiplayer.js - نظام الغرف المباشرة (نهائي)
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

// 1. صفحة اللوبي (البحث عن غرفة)
async function showLeaguesPage() {
    stopLobbyTimers();
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
                const { data: newLobby, error } = await _db.from('lobbies').insert({ status: 'waiting' }).select().single();
                if (error) throw error;
                foundLobby = newLobby;
                const teams = LEAGUES['egypt'].teams.slice(0, 10);
                await _db.from('lobby_slots').insert(teams.map(t => ({ lobby_id: foundLobby.id, team_id: t[0], team_name: t[1] })));
            }
            currentLobby = foundLobby;
        }

        await loadLobbyData();
        
        // إذا كانت الغرفة نشطة (بدأت) نوجهه فوراً للعبة
        if (currentLobby.status === 'active') {
            G.multiplayerLeagueId = currentLobby.id;
            save();
            $('bottom-nav').hidden = false;
            dash();
            return;
        }

        renderWaitingRoom();
        startCountdownTimer();
        liveInterval = setInterval(fetchUpdates, 3000);

    } catch (error) {
        console.error(error);
        $('main').innerHTML = `<div class="c" style="text-align:center; color:#ef4444;">خطأ: ${error.message}<br><br><button class="b a" onclick="showLeaguesPage()">إعادة المحاولة</button></div>`;
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
    if(typeof G !== 'undefined' && G) {
        G.multiplayerLeagueId = currentLobby.id;
        save();
        $('bottom-nav').hidden = false;
        dash(); 
    } else {
        location.reload();
    }
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
        let onclick = isDisabled ? '' : `onclick="claimLiveTeam('${slot.id}')"`;
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

async function claimLiveTeam(slotId) {
    const { data: { user } } = await _db.auth.getUser();
    if (!user) return alert('يجب تسجيل الدخول أولاً!');
    if (mySlot) return alert('لقد اخترت فريقاً بالفعل!');
    
    let snap = {};
    if (typeof G !== 'undefined' && G.season) {
        snap = { name: T[G.my].name, form: G.form, tac: G.tac, starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) };
    }

    const btn = event.currentTarget;
    if (btn) btn.style.opacity = '0.5';

    const { data: success } = await _db.rpc('claim_lobby_team', {
        p_slot_id: slotId, p_user_id: user.id,
        p_manager_name: (typeof tempUserData !== 'undefined' && tempUserData.managerName) ? tempUserData.managerName : 'مدرب',
        p_team_snapshot: snap
    });

    if (!success) {
        if (btn) btn.style.opacity = '1';
        return alert('عذراً، تم اختيار هذا الفريق للتو أو أنك تملك فريقاً بالفعل!');
    }
    
    await fetchUpdates();
}

// ============================================
// الجزء الخاص بـ واجهة اللعبة (صفحة البطولات)
// ============================================

// دالة تُستدعى من ui.js لتحميل بيانات الدوري في صفحة البطولات
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
        
        const mySlot = slots.find(s => s.user_id === user.id);

        if (!mySlot) {
            container.innerHTML = `<div style="color:#ef4444;">أنت لست مشاركاً في هذا الدوري.</div>`;
            return;
        }

        const sorted = slots.filter(s => s.user_id).sort((a, b) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against));
        
        let html = `<div style="font-size:11px; text-align:center; color:var(--gold); margin-bottom:5px;">جدول الترتيب</div>
        <table style="width:100%; font-size:11px; text-align:center; margin-bottom:15px;">
            <tr style="color:#94a3b8;"><th>#</th><th style="text-align:right">الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>ن</th></tr>`;
        sorted.forEach((s, i) => {
            const isMe = s.id === mySlot.id;
            html += `<tr style="${isMe ? 'background:rgba(251,191,36,.1);font-weight:bold;color:#fff;' : 'color:#cbd5e1;'}">
                <td>${i+1}</td><td style="text-align:right;">${s.team_name} ${isMe?'⭐':''}</td>
                <td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td>
                <td>${s.goals_for - s.goals_against}</td><td style="color:#4ade80;">${s.points}</td>
            </tr>`;
        });
        html += `</table>`;

        const myMatches = matches.filter(m => (m.home_slot_id === mySlot.id || m.away_slot_id === mySlot.id));
        html += `<div style="font-size:11px; text-align:center; color:var(--gold); margin-bottom:5px;">مبارياتي</div>`;
        
        myMatches.forEach(m => {
            const isHome = m.home_slot_id === mySlot.id;
            const oppId = isHome ? m.away_slot_id : m.home_slot_id;
            const opp = slots.find(s => s.id === oppId);
            
            html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.05); padding:6px; margin-bottom:4px; border-radius:6px;">
                <div style="font-size:10px; color:#94a3b8; width:20px;">ج${m.round}</div>
                <div style="font-size:11px; font-weight:bold; color:#fff; flex:1; text-align:center;">
                    ${isHome ? mySlot.team_name : opp.team_name} vs ${isHome ? opp.team_name : mySlot.team_name}
                </div>
                ${m.played 
                    ? `<div style="font-size:12px; color:var(--gold); font-weight:900; width:40px; text-align:left;">${m.home_score} - ${m.away_score}</div>`
                    : `<button class="b g sm" style="padding:2px 6px; font-size:10px;" onclick="playMultiplayerMatch('${m.id}', '${lobby.id}')">▶ العب</button>`
                }
            </div>`;
        });

        container.innerHTML = html;
    };

    await fetchAndRender();
    mpCompInterval = setInterval(fetchAndRender, 5000);
}

async function playMultiplayerMatch(matchId, lobbyId) {
    const { data: match } = await _db.from('lobby_matches').select('*').eq('id', matchId).single();
    if (!match || match.played) return;

    const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', lobbyId);
    const { data: { user } } = await _db.auth.getUser();
    const mySlot = slots.find(s => s.user_id === user.id);
    const isHome = match.home_slot_id === mySlot.id;
    const oppId = isHome ? match.away_slot_id : match.home_slot_id;
    const oppSlot = slots.find(s => s.id === oppId);

    let oppTeamData = oppSlot.team_snapshot;
    let oppTeamId = 'OPP_' + oppSlot.id.substring(0,6);
    
    if (!oppTeamData || !oppTeamData.starters || oppTeamData.starters.length < 11) {
        T[oppTeamId] = { id: oppTeamId, name: oppSlot.team_name, R: 70, c1: '#333', c2: '#fff', budget: 100, ps: [], form: '4-3-3' };
        for(let i=0; i<11; i++) T[oppTeamId].ps.push({ id: 'v'+i, name: 'Player '+i, pos: 'MID', r: 70, lvl: 1, pace:70, shooting:70, passing:70, dribbling:70, defending:70, physical:70, fit:100 });
    } else {
        T[oppTeamId] = buildTeamFromSnapshot(oppTeamData, oppTeamId);
    }

    const newSnap = { name: T[G.my].name, form: G.form, tac: G.tac, starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean) };
    await _db.from('lobby_slots').update({ team_snapshot: newSnap }).eq('id', mySlot.id);

    const matchConfig = {
        h: isHome ? T[G.my] : T[oppTeamId],
        a: isHome ? T[oppTeamId] : T[G.my],
        hl: isHome ? G.lu : oppTeamData.starters.map(p=>p.id),
        al: isHome ? oppTeamData.starters.map(p=>p.id) : G.lu,
        hf: isHome ? G.form : oppTeamData.form,
        af: isHome ? oppTeamData.form : G.form,
        ht: isHome ? G.tac : 'balanced',
        at: isHome ? 'balanced' : G.tac,
        human: isHome ? 'home' : 'away',
        compName: `الدوري المباشر`,
        weather: WEATHERS[0]
    };

    alert("جاري محاكاة المباراة...");
    const matchEng = new Match(matchConfig);
    let safety = 0;
    while (!matchEng.done && safety < 20000) { matchEng.step(); safety++; }
    
    const hg = matchEng.s.home.g;
    const ag = matchEng.s.away.g;

    await _db.from('lobby_matches').update({ home_score: hg, away_score: ag, played: true }).eq('id', matchId);

    const homeSlot = slots.find(s => s.id === match.home_slot_id);
    const awaySlot = slots.find(s => s.id === match.away_slot_id);

    const updateSlot = async (slot, gf, ga, isWin, isDraw) => {
        await _db.from('lobby_slots').update({
            played: slot.played + 1, won: slot.won + (isWin?1:0), drawn: slot.drawn + (isDraw?1:0),
            lost: slot.lost + (!isWin && !isDraw ?1:0), goals_for: slot.goals_for + gf,
            goals_against: slot.goals_against + ga, points: slot.points + (isWin?3:(isDraw?1:0))
        }).eq('id', slot.id);
    };

    const homeWin = hg > ag;
    const draw = hg === ag;

    await updateSlot(homeSlot, hg, ag, homeWin, draw);
    await updateSlot(awaySlot, ag, hg, !homeWin && !draw, draw);

    alert(`انتهت المباراة: ${hg} - ${ag}`);
    if (typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData();
}

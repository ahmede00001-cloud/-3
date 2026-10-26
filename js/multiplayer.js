// ============================================
// multiplayer.js - نظام الغرف المباشرة (مصحح)
// ============================================

let currentLobby = null;
let currentSlots = [];
let currentMatches = [];
let liveInterval = null;
let timeLeftInterval = null;
let mySlot = null;
let isSeasonStarting = false; // لمنع تكرار بدء الموسم

function stopLobbyTimers() {
    if (liveInterval) clearInterval(liveInterval);
    if (timeLeftInterval) clearInterval(timeLeftInterval);
    liveInterval = null;
    timeLeftInterval = null;
}

// 1. الدخول للغرفة
async function showLeaguesPage() {
    stopLobbyTimers();
    $('main').innerHTML = `<div style="text-align:center; padding:50px 20px;"><div style="font-size:40px; animation: logoBounce 1s infinite alternate;">⏳</div><div style="color:var(--gold); font-weight:bold; margin-top:15px; font-size:16px;">جاري الاتصال بالدوري...</div></div>`;

    try {
        const { data: { user } } = await _db.auth.getUser();
        if (!user) throw new Error("يجب تسجيل الدخول أولاً");

        // البحث عن غرفة يشارك فيها المستخدم (نشطة أو بانتظار)
        const { data: mySlots } = await _db.from('lobby_slots')
            .select('lobby_id, lobbies!inner(id, status)')
            .eq('user_id', user.id)
            .in('lobbies.status', ['waiting', 'active'])
            .limit(1);

        if (mySlots && mySlots.length > 0) {
            // جلب بيانات الغرفة بشكل صريح لضمان وجود expires_at
            const { data: lobbyData } = await _db.from('lobbies').select('*').eq('id', mySlots[0].lobby_id).single();
            currentLobby = lobbyData;
        } else {
            // البحث عن غرفة بانتظار بها أقل من 10
            const { data: openLobbies } = await _db.from('lobbies').select('*').eq('status', 'waiting').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true });
            let foundLobby = null;
            if (openLobbies) {
                for (const l of openLobbies) {
                    const { count } = await _db.from('lobby_slots').select('*', { count: 'exact', head: true }).eq('lobby_id', l.id).not('user_id', 'is', null);
                    if (count < 10) { foundLobby = l; break; }
                }
            }
            
            if (!foundLobby) {
                // إنشاء غرفة جديدة
                const { data: newLobby, error } = await _db.from('lobbies').insert({ status: 'waiting' }).select().single();
                if (error) throw error;
                foundLobby = newLobby;
                const teams = LEAGUES['egypt'].teams.slice(0, 10);
                await _db.from('lobby_slots').insert(teams.map(t => ({ lobby_id: foundLobby.id, team_id: t[0], team_name: t[1] })));
            }
            currentLobby = foundLobby;
        }

        await loadLobbyData();
        renderUI();
        
        // تشغيل المؤقت المستقل
        startCountdownTimer();
        
        // تشغيل البث المباشر (تحديث الفرق كل 3 ثواني)
        liveInterval = setInterval(fetchUpdates, 3000);

    } catch (error) {
        console.error(error);
        $('main').innerHTML = `<div class="c" style="text-align:center; color:#ef4444;">خطأ: ${error.message}<br><br><button class="b a" onclick="showLeaguesPage()">إعادة المحاولة</button></div>`;
    }
}

// 2. جلب البيانات الأساسية
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

// 3. تحديث مستمر للفرق
async function fetchUpdates() {
    if (!currentLobby) return;
    
    // جلب حالة الغرفة
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

    // جلب الفرق
    const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id).order('team_name');
    const newSlots = slots || [];
    
    // تحديث الشاشة فقط إذا تغيرت البيانات
    if (JSON.stringify(newSlots) !== JSON.stringify(currentSlots)) {
        currentSlots = newSlots;
        const { data: { user } } = await _db.auth.getUser();
        mySlot = currentSlots.find(s => s.user_id === user.id);
        renderUI();
    }
}

// 4. المؤقت المستقل (لا يتأثر بتحديث الشاشة)
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

// 5. بدء الموسم
async function tryStartSeason() {
    if (currentLobby.status !== 'waiting') return;
    
    // محاولة تغيير الحالة (لقفل الغرفة)
    const { data: updated } = await _db.from('lobbies').update({ status: 'active' }).eq('id', currentLobby.id).eq('status', 'waiting').select();
    
    // إذا لم يتم التحديث (شخص آخر سبقك)
    if (!updated || updated.length === 0) { isSeasonStarting = false; return; }

    const activeSlots = currentSlots.filter(s => s.user_id);
    if (activeSlots.length < 2) {
        // لا يوجد لاعبين كافيين، مدد الوقت 60 دقيقة أخرى
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
    alert("⏳ بدأ الموسم رسمياً! استعد لمبارياتك.");
    
    await loadLobbyData();
    renderUI();
}

// توليد جدول المباريات
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

// 6. رسم الواجهة
function renderUI() {
    if (currentLobby.status === 'waiting') renderWaitingRoom();
    else if (currentLobby.status === 'active') renderActiveSeason();
    else $('main').innerHTML = `<div class="c" style="text-align:center; padding:20px;">انتهت هذه الغرفة. <br><button class="b a mt-10" onclick="showLeaguesPage()">🔍 ابحث عن غرفة جديدة</button></div>`;
}

function renderWaitingRoom() {
    const joinedCount = currentSlots.filter(s => s.user_id).length;
    // هل المستخدم يملك فريق بالفعل؟
    const hasTeam = !!mySlot;
    const isFull = joinedCount >= 10;

    let html = `<div class="c" style="margin-top:10px; position:relative;">
        <button class="b sm" style="padding:4px 10px; font-size:10px; margin-bottom:10px; position:absolute; right:10px; top:10px;" onclick="stopLobbyTimers(); showSetup()">⬅ خروج</button>
        
        <div style="text-align:center; margin-bottom:15px; margin-top:20px;">
            <div style="display:inline-block; background:rgba(239,68,68,.2); border:1px solid #ef4444; padding:4px 12px; border-radius:20px; color:#ef4444; font-size:12px; font-weight:bold; margin-bottom:10px;">🔴 غرفة الانتظار</div>
            <h2 style="color:var(--gold); font-size:18px; margin-bottom:5px;">تحدي الـ 10 مدربين</h2>
            <div style="font-size:13px; color:#cbd5e1; margin-bottom:8px;">المنضمون: <b style="color:#4ade80">${joinedCount}</b> / 10</div>
            <div id="live-countdown" style="font-size:20px; font-weight:900; color:#fbbf24; background:rgba(0,0,0,.3); padding:6px; border-radius:8px; display:inline-block;">--:--</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:5px;">سيبدأ الموسم تلقائياً عند اكتمال العدد أو انتهاء الوقت</div>
        </div>
        <div class="g2">`;

    currentSlots.forEach(slot => {
        const isTaken = !!slot.user_id;
        const isMe = mySlot && slot.id === mySlot.id;
        
        let bg = isMe ? 'rgba(251,191,36,.15)' : (isTaken ? 'rgba(15,34,56,.8)' : 'rgba(30,58,138,.4)');
        let border = isMe ? '#fbbf24' : (isTaken ? '#ef4444' : '#22c55e');
        let statusHtml = isTaken ? `<div style="font-size:10px; color:#ef4444; font-weight:bold; margin-top:4px;">🔒 ${slot.manager_name}</div>` : `<div style="font-size:10px; color:#4ade80; font-weight:bold; margin-top:4px;">🟢 متاح</div>`;
        
        // ✅ القفل: إذا كان الفريق محجوزاً، أو الغرفة ممتلئة، أو المستخدم يملك فريقاً بالفعل -> يمنع الضغط
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

function renderActiveSeason() {
    if (!mySlot) {
        $('main').innerHTML = `<div class="c" style="text-align:center; padding:20px;"><h2 style="color:var(--gold);">الموسم جارٍ</h2><p style="color:#94a3b8; font-size:12px;">أنت لا تملك فريقاً هنا. بانتظار انتهاء الموسم.</p><button class="b a mt-10" onclick="showSetup()">العودة</button></div>`;
        return;
    }

    const sorted = [...currentSlots].filter(s => s.user_id).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against);
    });

    let html = `<div class="c" style="margin-top:10px; position:relative;">
        <button class="b sm" style="padding:4px 10px; font-size:10px; margin-bottom:10px; position:absolute; right:10px; top:10px;" onclick="stopLobbyTimers(); showSetup()">⬅ خروج</button>
        <h2 style="color:var(--gold); font-size:18px; text-align:center; margin-bottom:15px;">🏆 الدوري المباشر</h2>
        
        <div class="sec">📊 جدول الترتيب</div>
        <table style="width:100%; font-size:11px; text-align:center;">
            <tr style="color:var(--gold);"><th>#</th><th style="text-align:right">الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>+/-</th><th>ن</th></tr>`;

    sorted.forEach((s, i) => {
        const isMe = s.id === mySlot.id;
        html += `<tr style="${isMe ? 'background:rgba(251,191,36,.1);font-weight:bold;' : ''}">
            <td>${i+1}</td><td style="text-align:right;">${s.team_name} ${isMe?'⭐':''}</td>
            <td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td>
            <td>${s.goals_for - s.goals_against}</td><td style="color:#4ade80;">${s.points}</td>
        </tr>`;
    });
    html += `</table>`;

    html += `<div class="sec" style="margin-top:15px;">📅 مبارياتي</div>`;
    const myMatches = currentMatches.filter(m => (m.home_slot_id === mySlot.id || m.away_slot_id === mySlot.id));
    
    myMatches.forEach(m => {
        const isHome = m.home_slot_id === mySlot.id;
        const oppId = isHome ? m.away_slot_id : m.home_slot_id;
        const opp = currentSlots.find(s => s.id === oppId);
        
        html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15,34,56,.5); border:1px solid rgba(255,255,255,.1); padding:8px; margin-bottom:6px; border-radius:8px;">
            <div style="font-size:10px; color:#94a3b8;">ج${m.round}</div>
            <div style="font-size:12px; font-weight:bold; color:#fff; flex:1; text-align:center;">
                ${isHome ? mySlot.team_name : opp.team_name} vs ${isHome ? opp.team_name : mySlot.team_name}
            </div>
            ${m.played 
                ? `<div style="font-size:14px; color:var(--gold); font-weight:900;">${m.home_score} - ${m.away_score}</div>`
                : `<button class="b g sm" style="padding:4px 8px; font-size:10px;" onclick="playLobbyMatch('${m.id}')">▶ العب</button>`
            }
        </div>`;
    });
    html += `</div>`;
    $('main').innerHTML = html;
}

// 7. حجز الفريق
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

// 8. تشغيل المباراة
async function playLobbyMatch(matchId) {
    const m = currentMatches.find(x => x.id === matchId);
    if (!m || m.played) return;

    const isHome = m.home_slot_id === mySlot.id;
    const oppId = isHome ? m.away_slot_id : m.home_slot_id;
    const oppSlot = currentSlots.find(s => s.id === oppId);
    
    let oppTeamData = oppSlot.team_snapshot;
    let oppTeamId = 'OPP_' + oppSlot.id.substring(0,6);
    
    if (!oppTeamData || !oppTeamData.starters || oppTeamData.starters.length < 11) {
        T[oppTeamId] = { id: oppTeamId, name: oppSlot.team_name, R: 70, c1: '#333', c2: '#fff', budget: 100, ps: [], form: '4-3-3' };
        for(let i=0; i<11; i++) T[oppTeamId].ps.push({ id: 'v'+i, name: 'Player '+i, pos: 'MID', r: 70, lvl: 1, pace:70, shooting:70, passing:70, dribbling:70, defending:70, physical:70, fit:100 });
    } else {
        T[oppTeamId] = buildTeamFromSnapshot(oppTeamData, oppTeamId);
    }

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
    const match = new Match(matchConfig);
    let safety = 0;
    while (!match.done && safety < 20000) { match.step(); safety++; }
    
    await finalizeMatch(m.id, match.s.home.g, match.s.away.g);
}

async function finalizeMatch(matchId, hg, ag) {
    const m = currentMatches.find(x => x.id === matchId);
    if (!m) return;

    await _db.from('lobby_matches').update({ home_score: hg, away_score: ag, played: true }).eq('id', matchId);

    const homeSlot = currentSlots.find(s => s.id === m.home_slot_id);
    const awaySlot = currentSlots.find(s => s.id === m.away_slot_id);

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
    await loadLobbyData();
    renderUI();
}

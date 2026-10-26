// ============================================
// multiplayer.js - نظام الغرف المباشرة (Live Rooms)
// ============================================

let currentLobby = null;
let currentSlots = [];
let liveInterval = null;
let timeLeftInterval = null;

// إيقاف المؤقتات عند الخروج
function stopLobbyTimers() {
    if (liveInterval) clearInterval(liveInterval);
    if (timeLeftInterval) clearInterval(timeLeftInterval);
}

// الدالة الرئيسية للدخول
async function showLeaguesPage() {
    stopLobbyTimers();
    $('main').innerHTML = `
        <div style="text-align:center; padding:50px 20px;">
            <div style="font-size:40px; animation: logoBounce 1s infinite alternate;">⏳</div>
            <div style="color:var(--gold); font-weight:bold; margin-top:15px; font-size:16px;">جاري البحث عن غرفة مباشرة...</div>
        </div>
    `;

    try {
        await assignUserToLobby();
        renderLiveRoom();
        
        // تحديث الغرفة كل 3 ثوانٍ (البث المباشر)
        liveInterval = setInterval(async () => {
            await fetchLobbyUpdates();
        }, 3000);

    } catch (error) {
        console.error("Lobby Error:", error);
        $('main').innerHTML = `
            <div class="c" style="margin-top:20px; text-align:center;">
                <div style="color:#ef4444; font-size:16px; font-weight:bold; margin-bottom:10px;">❌ حدث خطأ في الاتصال</div>
                <div style="font-size:12px; color:#94a3b8; margin-bottom:15px;">${error.message || 'تأكد من اتصالك بالإنترنت'}</div>
                <button class="b a" onclick="showLeaguesPage()">🔄 إعادة المحاولة</button>
            </div>
        `;
    }
}

// البحث عن غرفة أو إنشاء واحدة جديدة
async function assignUserToLobby() {
    const { data: { user } } = await _db.auth.getUser();
    if (!user) throw new Error("يجب تسجيل الدخول أولاً");

    // 1. البحث عن غرف نشطة (لم تنتهي مدتها)
    const now = new Date().toISOString();
    const { data: activeLobbies, error: err1 } = await _db.from('lobbies')
        .select('id')
        .eq('status', 'waiting')
        .gt('expires_at', now);

    if (err1) throw err1;

    let targetLobbyId = null;

    // 2. فحص الغرف لمعرفة إذا كانت هناك غرفة بها أقل من 10 لاعبين
    if (activeLobbies && activeLobbies.length > 0) {
        for (const lobby of activeLobbies) {
            const { count, error: err2 } = await _db.from('lobby_slots')
                .select('*', { count: 'exact', head: true })
                .eq('lobby_id', lobby.id)
                .not('user_id', 'is', null);
            
            if (err2) throw err2;

            if (count < 10) {
                targetLobbyId = lobby.id;
                break;
            }
        }
    }

    // 3. إذا لم توجد غرفة بها مساحة، قم بإنشاء غرفة جديدة
    if (!targetLobbyId) {
        const { data: newLobby, error: err3 } = await _db.from('lobbies')
            .insert({ status: 'waiting' })
            .select().single();
        
        if (err3) throw err3;
        targetLobbyId = newLobby.id;

        // ملء الغرفة بـ 10 فرق (كمثال نأخذ أول 10 فرق من الدوري المصري)
        const teams = LEAGUES['egypt'].teams.slice(0, 10);
        const slotsData = teams.map(t => ({
            lobby_id: targetLobbyId,
            team_id: t[0],
            team_name: t[1]
        }));

        const { error: err4 } = await _db.from('lobby_slots').insert(slotsData);
        if (err4) throw err4;
    }

    // حفظ الغرفة الحالية
    const { data: lobbyData, error: err5 } = await _db.from('lobbies').select('*').eq('id', targetLobbyId).single();
    if (err5) throw err5;
    currentLobby = lobbyData;

    // جلب الفرق
    await fetchLobbyUpdates(true);
}

// جلب التحديثات (البث المباشر)
async function fetchLobbyUpdates(isInitial = false) {
    if (!currentLobby) return;

    // التحقق من انتهاء الوقت
    if (new Date(currentLobby.expires_at) < new Date()) {
        stopLobbyTimers();
        alert("انتهى وقت هذه الغرفة! سيتم نقلك لغرفة جديدة.");
        showLeaguesPage();
        return;
    }

    const { data: slots, error } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id);
    if (error) return;

    // التحقق هل تم تغيير البيانات؟
    if (isInitial || JSON.stringify(slots) !== JSON.stringify(currentSlots)) {
        currentSlots = slots;
        renderLiveRoom();
    }
}

// رسم واجهة الغرفة
function renderLiveRoom() {
    const joinedCount = currentSlots.filter(s => s.user_id).length;
    const myUserId = (typeof G !== 'undefined' && G._userId) ? G._userId : null;

    let html = `<div class="c" style="margin-top:10px; position:relative;">
        <button class="b sm" style="padding:4px 10px; font-size:10px; margin-bottom:10px; position:absolute; right:10px; top:10px;" onclick="stopLobbyTimers(); showSetup()">⬅ خروج</button>
        
        <div style="text-align:center; margin-bottom:15px; margin-top:20px;">
            <div style="display:inline-block; background:rgba(239,68,68,.2); border:1px solid #ef4444; padding:4px 12px; border-radius:20px; color:#ef4444; font-size:12px; font-weight:bold; margin-bottom:10px;">
                🔴 بث مباشر - غرفة #${currentLobby.id.substring(0,4)}
            </div>
            <h2 style="color:var(--gold); font-size:18px; margin-bottom:5px;">تحدي الـ 10 مدربين</h2>
            <div style="font-size:13px; color:#cbd5e1; margin-bottom:8px;">المنضمون: <b style="color:#4ade80">${joinedCount}</b> / 10</div>
            <div id="live-countdown" style="font-size:20px; font-weight:900; color:#fbbf24; background:rgba(0,0,0,.3); padding:6px; border-radius:8px; display:inline-block;">--:--</div>
        </div>

        <div class="g2" style="opacity: ${joinedCount >= 10 ? 0.5 : 1};">`;

    currentSlots.forEach(slot => {
        const isTaken = !!slot.user_id;
        const isMe = slot.user_id === myUserId;
        
        let bg = isMe ? 'rgba(251,191,36,.15)' : (isTaken ? 'rgba(15,34,56,.8)' : 'rgba(30,58,138,.4)');
        let border = isMe ? '#fbbf24' : (isTaken ? '#ef4444' : '#22c55e');
        let statusHtml = isTaken 
            ? `<div style="font-size:10px; color:#ef4444; font-weight:bold; margin-top:4px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">🔒 ${slot.manager_name}</div>`
            : `<div style="font-size:10px; color:#4ade80; font-weight:bold; margin-top:4px;">🟢 متاح</div>`;
        
        let onclick = (isTaken || joinedCount >= 10) ? '' : `onclick="claimLiveTeam('${slot.id}')"`;
        let cursor = (isTaken || joinedCount >= 10) ? 'default' : 'pointer';

        html += `
            <div class="team-select-card" ${onclick} style="cursor:${cursor}; background:${bg}; border:1px solid ${border}; padding:10px;">
                <div class="bd" style="font-size:14px; width:35px; height:35px; margin:0 auto 5px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; background:rgba(255,255,255,0.1);">${slot.team_name[0]}</div>
                <b style="font-size:11px; display:block; text-align:center; color:#fff;">${slot.team_name}</b>
                ${statusHtml}
            </div>
        `;
    });

    html += `</div></div>`;
    $('main').innerHTML = html;

    // تشغيل العداد التنازلي
    if (timeLeftInterval) clearInterval(timeLeftInterval);
    timeLeftInterval = setInterval(() => {
        const el = document.getElementById('live-countdown');
        if (!el || !currentLobby) return;
        const diff = Math.max(0, new Date(currentLobby.expires_at) - new Date());
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `⏳ ${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

// حجز الفريق
async function claimLiveTeam(slotId) {
    const { data: { user } } = await _db.auth.getUser();
    if (!user) return alert('يجب تسجيل الدخول أولاً!');
    
    // نأخذ لقطة من فريق اللاعب الحالي (أو فريق افتراضي إذا كان جديداً)
    let snap = {};
    if (typeof G !== 'undefined' && G.season) {
        snap = { name: T[G.my].name, form: G.form, tac: G.tac, starters: [] };
    }

    const btn = event.currentTarget; // زر الفريق الذي تم ضغطه
    btn.style.opacity = '0.5';

    // استدعاء دالة الحجز في قاعدة البيانات
    const { data: success, error } = await _db.rpc('claim_lobby_team', {
        p_slot_id: slotId,
        p_user_id: user.id,
        p_manager_name: (typeof tempUserData !== 'undefined' && tempUserData.managerName) ? tempUserData.managerName : 'مدرب',
        p_team_snapshot: snap
    });

    if (error) {
        btn.style.opacity = '1';
        return alert('خطأ في الاتصال: ' + error.message);
    }
    
    if (!success) {
        btn.style.opacity = '1';
        return alert('عذراً، قام مدرب آخر باختيار هذا الفريق قبل أجزاء من الثانية!');
    }

    // نجاح
    alert('✅ تم حجز الفريق بنجاح! أنت الآن في الغرفة.');
    await fetchLobbyUpdates(); // تحديث فوري
}

// ============================================
// realtime.js - نظام البث المباشر (Live Broadcast)
// ============================================

let _rtChannel = null;
let _rtActivity = [];

// تشغيل البث المباشر لغرفة معينة
function initLiveBroadcast(lobbyId) {
    if (!window._db || !lobbyId) return;
    stopLiveBroadcast();
    
    _rtChannel = window._db.channel(`live_${lobbyId}`)
        // مراقبة تحديثات المباريات (بدء، انتهاء، هدف)
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'lobby_matches', filter: `lobby_id=eq.${lobbyId}` },
            (payload) => {
                const m = payload.new;
                if (m.played && m.home_score !== null && m.home_score !== undefined) {
                    broadcastEvent(`⚽ انتهت مباراة: ${m.home_score} - ${m.away_score}`, true);
                }
                if (typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData();
                if (typeof dash === 'function' && (G.tab === 'comp' || G.tab === 'lu')) {
                    // لا نعيد رسم الصفحة كاملة لتجنب مقاطعة المستخدم، فقط الجدول
                    if (typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData();
                }
            })
        // مراقبة انضمام مدربين جدد
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'lobby_slots', filter: `lobby_id=eq.${lobbyId}` },
            (payload) => {
                const s = payload.new;
                if (s.user_id && s.manager_name && !String(s.user_id).startsWith('BOT') && s.manager_name !== 'مدرب آلي') {
                    broadcastEvent(`👤 ${s.manager_name} انضم بفريق ${s.team_name}`, false);
                }
                if (typeof loadMultiplayerCompData === 'function') loadMultiplayerCompData();
            })
        .subscribe((status) => {
            console.log("📡 حالة البث المباشر:", status);
        });
}

// إيقاف البث
function stopLiveBroadcast() {
    if (_rtChannel) {
        try { window._db.removeChannel(_rtChannel); } catch(e) {}
        _rtChannel = null;
    }
}

// إضافة حدث للبث
function broadcastEvent(text, important = false) {
    const time = new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
    _rtActivity.unshift({ text, time, important });
    if (_rtActivity.length > 20) _rtActivity.pop();
    renderLiveTicker();
    if (important) showLiveToast(text);
}

// رسم شريط البث المباشر
function renderLiveTicker() {
    const el = document.getElementById('live-ticker');
    if (!el) return;
    if (_rtActivity.length === 0) {
        el.innerHTML = `<span style="color:#ef4444; animation: pulse 1.5s infinite;">🔴</span> <span style="color:#94a3b8;">البث المباشر جاهز... بانتظار الأحداث</span>`;
        return;
    }
    const latest = _rtActivity[0];
    const color = latest.important ? '#fbbf24' : '#22d3ee';
    el.innerHTML = `<span style="color:#ef4444; animation: pulse 1.5s infinite;">🔴</span> <span style="color:#fbbf24; font-weight:bold;">${latest.time}</span> <span style="color:${color}; font-weight:bold;">${latest.text}</span>`;
}

// إظهار إشعار منبثق
function showLiveToast(text) {
    let container = document.getElementById('live-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'live-toast-container';
        container.style.cssText = 'position:fixed; top:70px; left:10px; right:10px; z-index:9999; pointer-events:none; display:flex; flex-direction:column; gap:6px;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = 'background:linear-gradient(135deg,rgba(30,58,138,.98),rgba(15,34,56,.98)); border:1.5px solid var(--gold); color:#fff; padding:12px 14px; border-radius:10px; font-size:12px; box-shadow:0 4px 15px rgba(0,0,0,.7); pointer-events:auto; opacity:0; transform:translateY(-10px); transition:all .3s ease;';
    toast.innerHTML = `<span style="color:#ef4444; animation: pulse 1s infinite;">🔴</span> <b style="color:#fbbf24;">بث مباشر:</b> ${text}`;
    container.appendChild(toast);
    
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 50);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 350);
    }, 4500);
}

// إضافة أحداث محلية (عند محاكاة البوتات)
function logLiveEvent(text, important = false) {
    broadcastEvent(text, important);
}

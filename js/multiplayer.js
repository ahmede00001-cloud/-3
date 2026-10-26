// ============================================
// multiplayer.js - نظام اللوبي (60 دقيقة)
// ============================================

let currentLobby = null;
let currentSlots = [];
let lobbyInterval = null;

// إنشاء أو جلب غرفة
async function getOrCreateLobby() {
  // 1. البحث عن غرفة نشطة
  const { data: lobbies } = await _db.from('lobbies')
    .select('*')
    .eq('status', 'waiting')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(1);

  if (lobbies && lobbies.length > 0) {
    currentLobby = lobbies[0];
  } else {
    // 2. إنشاء غرفة جديدة إذا لم توجد
    const { data: newLobby, error } = await _db.from('lobbies')
      .insert({ status: 'waiting' })
      .select().single();
    
    if (error) throw error;
    currentLobby = newLobby;

    // 3. ملء الغرفة بـ 10 فرق (مثلاً أول 10 فرق في الدوري المصري)
    const egyptTeams = LEAGUES['egypt'].teams.slice(0, 10); 
    const slotsToInsert = egyptTeams.map(t => ({
      lobby_id: currentLobby.id,
      team_id: t[0],
      team_name: t[1]
    }));

    await _db.from('lobby_slots').insert(slotsToInsert);
  }

  // جلب الفرق
  const { data: slots } = await _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id);
  currentSlots = slots;
}

// حجز فريق
async function claimTeam(slotId) {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return alert('يجب تسجيل الدخول أولاً!');
  if (!G || !G.my) return alert('يجب أن تبدأ مسيرتك أولاً لتشارك بفريقك!');

  // أخذ لقطة من فريق اللاعب الحالي
  const snap = {
    name: T[G.my].name,
    form: G.form,
    tac: G.tac,
    starters: G.lu.map(id => T[G.my].ps.find(p => p.id === id)).filter(Boolean)
  };

  // استدعاء دالة RPC للحجز
  const { data: success, error } = await _db.rpc('claim_lobby_team', {
    p_slot_id: slotId,
    p_user_id: user.id,
    p_manager_name: G.managerName,
    p_team_snapshot: snap
  });

  if (error) return alert('خطأ: ' + error.message);
  if (!success) return alert('عذراً، قام شخص آخر باختيار هذا الفريق للتو!');

  alert('✅ تم حجز الفريق بنجاح! أنت الآن مشارك في هذه الغرفة.');
  showLobbyScreen(); // تحديث الشاشة
}

// إيقاف المؤقت عند مغادرة الشاشة
function stopLobbyTimer() {
  if (lobbyInterval) clearInterval(lobbyInterval);
}

// عرض شاشة اللوبي
async function showLeaguesPage() {
  stopLobbyTimer();
  $('main').innerHTML = `<div style="text-align:center; padding:20px;">⏳ جاري البحث عن غرفة...</div>`;

  try {
    await getOrCreateLobby();
  } catch (e) {
    return $('main').innerHTML = `<div class="c">❌ حدث خطأ في الاتصال بالخادم.</div>`;
  }

  renderLobbyUI();

  // تشغيل مؤقت التحديث كل ثانية
  lobbyInterval = setInterval(() => {
    // إذا انتهى الوقت، نعيد التحميل لإنشاء غرفة جديدة
    if (new Date(currentLobby.expires_at) < new Date()) {
      clearInterval(lobbyInterval);
      showLeaguesPage();
      return;
    }
    updateLobbyTimerUI();
  }, 1000);
}

function renderLobbyUI() {
  const { data: { user } } = _db.auth.getUser(); // للتحقق إذا كان اللاعب مشاركاً
  const meSlot = currentSlots.find(s => s.user_id === (G && G._userId)); // نفترض أننا نحفظ الآي دي

  let html = `<div class="c" style="margin-top:10px;">
    <button class="b sm" style="padding:4px 10px; font-size:10px; margin-bottom:10px;" onclick="stopLobbyTimer(); showSetup()">⬅ العودة</button>
    
    <div style="text-align:center; margin-bottom:15px;">
      <h2 style="color:var(--gold);font-size:18px;margin-bottom:5px;">🏆 غرفة التحدي (10 لاعبين)</h2>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:10px;">اختر فريقاً للانضمام. الغرفة تُغلق بعد:</div>
      <div id="lobby-timer" style="font-size:24px;font-weight:900;color:#ef4444;background:rgba(239,68,68,.1);padding:10px;border-radius:10px;display:inline-block;">--:--</div>
    </div>

    <div class="g2">`;

  currentSlots.forEach(slot => {
    const isTaken = !!slot.user_id;
    const isMe = slot.user_id === (G && G._userId);
    
    // تصميم الكارت
    let bgColor = isTaken ? 'rgba(15,34,56,.9)' : 'rgba(30,58,138,.6)';
    let borderColor = isMe ? 'var(--gold)' : (isTaken ? '#ef4444' : '#22c55e');
    let statusText = isTaken ? `🔒 ${slot.manager_name}` : '🟢 متاح';
    let onclick = isTaken ? '' : `onclick="claimTeam('${slot.id}')"`;
    let cursor = isTaken ? 'not-allowed' : 'pointer';

    html += `
      <div class="team-select-card" ${onclick} style="cursor:${cursor}; background:${bgColor}; border:2px solid ${borderColor}; position:relative;">
        <div class="bd" style="font-size:14px;">${slot.team_name[0]}</div>
        <b style="font-size:12px; display:block; text-align:center; color:#fff;">${slot.team_name}</b>
        <div style="font-size:10px; text-align:center; margin-top:5px; font-weight:bold; color:${isTaken ? '#ef4444' : '#4ade80'};">
          ${statusText}
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  $('main').innerHTML = html;
  updateLobbyTimerUI();
}

function updateLobbyTimerUI() {
  const timerEl = document.getElementById('lobby-timer');
  if (!timerEl || !currentLobby) return;

  const now = new Date();
  const end = new Date(currentLobby.expires_at);
  const diff = Math.max(0, end - now);

  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  // تحديث الواجهة بشكل دوري لجلب من انضم حديثاً
  if (secs % 5 === 0) {
    // جلب التحديثات بصمت
    _db.from('lobby_slots').select('*').eq('lobby_id', currentLobby.id).then(({data}) => {
      if (data && JSON.stringify(data) !== JSON.stringify(currentSlots)) {
         currentSlots = data;
         renderLobbyUI(); 
      }
    });
  }
}

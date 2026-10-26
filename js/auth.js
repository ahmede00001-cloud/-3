// ============================================
// auth.js - نظام تسجيل الدخول والسحابة (محدث)
// ============================================

// ✅ مفاتيح Supabase الخاصة بك
const SUPABASE_URL = 'https://yueqfoivwfpxuxrzokto.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L-TNPbuS3sslIa68v_oyiA_6GQ-hmuW';

// تهيئة عميل Supabase
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window._db = _supabase;

// ============================================
// 1. شاشة تسجيل الدخول (الافتراضية)
// ============================================
function showAuthScreen() {
  $('main').innerHTML = `
    <div class="setup-hero" style="margin-top: 30px;">
      <div class="setup-icon">☁️</div>
      <div class="setup-title">تسجيل الدخول</div>
      <div class="setup-sub">سجل دخولك لحفظ تقدمك ومنافسة الآخرين</div>
      
      <input type="email" id="login-email" placeholder="البريد الإلكتروني" style="margin-bottom:10px; text-align:left; direction:ltr;">
      <input type="password" id="login-pass" placeholder="كلمة المرور" style="margin-bottom:15px; text-align:left; direction:ltr;">
      
      <button class="b a full" style="padding:14px; font-size:14px; margin-bottom:10px;" onclick="loginUser(this)">تسجيل الدخول</button>
      
      <div style="text-align:center; font-size:12px; color:#94a3b8; margin-bottom:10px;">ليس لديك حساب؟</div>
      <button class="b g full" style="padding:12px; font-size:13px; margin-bottom:15px;" onclick="showRegisterScreen()">إنشاء حساب جديد</button>
      
      <button class="b" style="background:#475569; padding:10px; font-size:12px;" onclick="showSetup()">تخطي (لعب محلي بدون حفظ سحابي)</button>
    </div>
  `;
}

// ============================================
// 2. شاشة إنشاء حساب جديد
// ============================================
function showRegisterScreen() {
  $('main').innerHTML = `
    <div class="setup-hero" style="margin-top: 30px;">
      <div class="setup-icon">📝</div>
      <div class="setup-title">حساب جديد</div>
      <div class="setup-sub">أنشئ حسابك لحفظ مسيرتك في السحابة</div>
      
      <input type="text" id="reg-name" placeholder="اسم المدرب" style="margin-bottom:10px;">
      <input type="email" id="reg-email" placeholder="البريد الإلكتروني" style="margin-bottom:10px; text-align:left; direction:ltr;">
      <input type="password" id="reg-pass" placeholder="كلمة المرور" style="margin-bottom:15px; text-align:left; direction:ltr;">
      
      <button class="b g full" style="padding:14px; font-size:14px; margin-bottom:10px;" onclick="registerUser(this)">تسجيل الحساب</button>
      
      <div style="text-align:center; font-size:12px; color:#94a3b8; margin-bottom:10px;">لديك حساب بالفعل؟</div>
      <button class="b a full" style="padding:12px; font-size:13px;" onclick="showAuthScreen()">العودة لتسجيل الدخول</button>
    </div>
  `;
}

// ============================================
// 3. دالة إنشاء الحساب (التسجيل)
// ============================================
async function registerUser(btnElement) {
  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const pass = $('reg-pass').value.trim();
  
  if(!name || !email || !pass) return alert('الرجاء إدخال جميع البيانات (الاسم، البريد، كلمة المرور)');
  if(pass.length < 6) return alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

  const originalText = btnElement.textContent;
  btnElement.textContent = 'جاري التسجيل...';
  btnElement.disabled = true;

  // إنشاء المستخدم في Supabase
  const { data, error } = await _db.auth.signUp({ email, password: pass });
  
  if (error) {
    btnElement.textContent = originalText;
    btnElement.disabled = false;
    return alert('خطأ في التسجيل: ' + error.message);
  }

  // إنشاء الملف الشخصي في جدول profiles
  if (data.user) {
    const { error: profileError } = await _db.from('profiles').insert({
      id: data.user.id,
      email: email,
      manager_name: name,
      trophies: 0,
      manager_level: 1,
      manager_xp: 0
    });

    if (profileError) {
      console.error("Profile Error:", profileError);
      alert('تم إنشاء الحساب، لكن حدث خطأ في حفظ الملف الشخصي.');
    } else {
      alert('✅ تم إنشاء الحساب بنجاح!\n\nيرجى تسجيل الدخول الآن لبدء اللعبة.');
    }
    
    // العودة لشاشة تسجيل الدخول
    showAuthScreen(); 
  }
}

// ============================================
// 4. دالة تسجيل الدخول (توجيه ذكي + اللوبي)
// ============================================
async function loginUser(btnElement) {
  const email = $('login-email').value.trim();
  const pass = $('login-pass').value.trim();
  
  if(!email || !pass) return alert('أدخل البريد الإلكتروني وكلمة المرور');

  const originalText = btnElement.textContent;
  btnElement.textContent = 'جاري الدخول...';
  btnElement.disabled = true;

  const { data, error } = await _db.auth.signInWithPassword({ email, password: pass });
  
  if (error) {
    btnElement.textContent = originalText;
    btnElement.disabled = false;
    return alert('خطأ في الدخول: ' + error.message);
  }

  // ✅ حفظ معرف المستخدم (مهم جداً لنظام اللوبي)
  if (data && data.user) {
      if (typeof G === 'undefined' || !G) G = {};
      G._userId = data.user.id; 
  }

  // جلب البيانات من السيرفر (الاسم، البطولات، إلخ)
  await loadProfileFromCloud();
  
  // ✅ التوجيه الذكي:
  if (typeof G !== 'undefined' && G && G.season) {
      // لاعب قديم ولديه مسيرة -> الدخول المباشر للعبة
      $('bottom-nav').hidden = false;
      dash();
  } else {
      // لاعب جديد -> تجهيز بياناته وتوجيهه لصفحة الغرف (اللوبي)
      tempUserData.managerName = (G && G.managerName) ? G.managerName : 'المدرب';
      tempUserData.username = (G && G.username) ? G.username : 'مستخدم';

      alert("تم تسجيل الدخول بنجاح!\nيرجى اختيار فريقك للانضمام إلى الغرفة.");
      
      // التوجه لصفحة الغرف الجديدة (إذا كان ملف multiplayer.js موجوداً)
      if(typeof showLeaguesPage === 'function') {
          showLeaguesPage();
      } else {
          selTeam(); // احتياطي في حال لم يتم تحميل ملف اللوبي
      }
  }
}

// ============================================
// 5. دوال السحابة (الحفظ والتحميل)
// ============================================
async function saveToCloud() {
  if (!G || !G.my) return;
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return; // إذا كان يلعب محلياً

  const t = T[G.my];
  await _db.from('profiles').update({
    manager_name: G.managerName,
    trophies: G.trophies || 0,
    manager_level: G.managerLevel || 1,
    manager_xp: G.managerXp || 0,
    team_name: t ? t.name : '',
    league_name: G.league || ''
  }).eq('id', user.id);
}

async function loadProfileFromCloud() {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return;

  const { data, error } = await _db.from('profiles').select('*').eq('id', user.id).single();
  if (data) {
    if (!G) G = {};
    G.managerName = data.manager_name || G.managerName || 'المدرب';
    G.trophies = data.trophies || 0;
    G.managerLevel = data.manager_level || 1;
    G.managerXp = data.manager_xp || 0;
  }
}

// ============================================
// 6. لوحة المتصدرين
// ============================================
async function showLeaderboard() {
  $('main').innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">⏳ جاري تحميل التصنيف العالمي...</div>`;
  
  const { data, error } = await _db.from('profiles')
    .select('manager_name, trophies, manager_level, team_name')
    .order('trophies', { ascending: false })
    .order('manager_level', { ascending: false })
    .limit(50);

  if (error) return $('main').innerHTML = `<div class="c">❌ حدث خطأ في الاتصال</div>`;

  let html = `<div class="c" style="margin-top:10px;">
    <div class="sec">🏆 أفضل 50 مدرب في العالم</div>
    <div style="max-height:60vh; overflow:auto;">`;
    
  data.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="color:#64748b; font-size:10px;">#${i+1}</span>`;
    const isMe = G && G.managerName === p.manager_name ? 'border:1px solid var(--gold); background:rgba(251,191,36,.1);' : '';
    
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid rgba(255,255,255,.05); ${isMe}">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:25px; text-align:center; font-size:14px;">${medal}</div>
          <div>
            <div style="font-size:12px; font-weight:bold; color:#fff;">${p.manager_name}</div>
            <div style="font-size:9px; color:#94a3b8;">${p.team_name || 'غير معروف'}</div>
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:11px; color:var(--gold);">🏆 ${p.trophies}</div>
          <div style="font-size:9px; color:#4ade80;">⭐ Lv.${p.manager_level}</div>
        </div>
      </div>
    `;
  });
  
  html += `</div><button class="b a" style="margin-top:10px;" onclick="switchTab('lu');">العودة للرئيسية</button></div>`;
  $('main').innerHTML = html;
}

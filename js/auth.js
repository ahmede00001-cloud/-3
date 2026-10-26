// ============================================
// auth.js - نظام تسجيل الدخول والسحابة (محدث بالمفاتيح الجديدة)
// ============================================

// ✅ مفاتيحك الجديدة
const SUPABASE_URL = 'https://yueqfoivwfpxuxrzokto.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L-TNPbuS3sslIa68v_oyiA_6GQ-hmuW';

// تهيئة عميل Supabase (نستخدم window.supabase من الـ CDN)
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window._db = _supabase;

// دالة عرض شاشة تسجيل الدخول
function showAuthScreen() {
  $('main').innerHTML = `
    <div class="setup-hero" style="margin-top: 50px;">
      <div class="setup-icon">☁️</div>
      <div class="setup-title">اللعب الجماعي</div>
      <div class="setup-sub">سجل دخولك لحفظ تقدمك ومنافسة الآخرين</div>
      
      <input type="email" id="auth-email" placeholder="البريد الإلكتروني" style="margin-bottom:10px">
      <input type="password" id="auth-pass" placeholder="كلمة المرور" style="margin-bottom:10px">
      <input type="text" id="auth-name" placeholder="اسم المدرب (للتسجيل الجديد)" style="margin-bottom:15px">
      
      <div style="display:flex; gap:10px;">
        <button class="b a" style="flex:1; padding:14px;" onclick="loginUser()">تسجيل الدخول</button>
        <button class="b g" style="flex:1; padding:14px;" onclick="registerUser()">حساب جديد</button>
      </div>
      <button class="b" style="margin-top:10px; background:#475569; padding:10px;" onclick="showSetup()">تخطي (لعب محلي)</button>
    </div>
  `;
}

// تسجيل الدخول
async function loginUser() {
  const email = $('auth-email').value.trim();
  const pass = $('auth-pass').value.trim();
  if(!email || !pass) return alert('أدخل البريد وكلمة المرور');

  const { data, error } = await _db.auth.signInWithPassword({ email, password: pass });
  if (error) return alert('خطأ: ' + error.message);

  // جلب البيانات من السيرفر
  await loadProfileFromCloud();
  $('bottom-nav').hidden = false;
  dash();
}

// إنشاء حساب جديد
async function registerUser() {
  const email = $('auth-email').value.trim();
  const pass = $('auth-pass').value.trim();
  const name = $('auth-name').value.trim();
  if(!email || !pass || !name) return alert('أدخل جميع البيانات');

  const { data, error } = await _db.auth.signUp({ email, password: pass });
  if (error) return alert('خطأ: ' + error.message);

  // إنشاء الملف الشخصي في قاعدة البيانات
  if (data.user) {
    await _db.from('profiles').insert({
      id: data.user.id,
      email: email,
      manager_name: name,
      trophies: 0,
      manager_level: 1,
      manager_xp: 0
    });
    alert('تم إنشاء الحساب! يمكنك الآن تسجيل الدخول.');
  }
}

// حفظ التقدم في السيرفر (تُستدعى تلقائياً مع دالة save)
async function saveToCloud() {
  if (!G || !G.my) return;
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return; // إذا كان يلعب محلياً بدون حساب

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

// جلب التقدم من السيرفر
async function loadProfileFromCloud() {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return;

  const { data, error } = await _db.from('profiles').select('*').eq('id', user.id).single();
  if (data) {
    if (G) {
      G.managerName = data.manager_name || G.managerName;
      G.trophies = data.trophies || 0;
      G.managerLevel = data.manager_level || 1;
      G.managerXp = data.manager_xp || 0;
    }
  }
}

// عرض لوحة المتصدرين (Top 50)
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
    const isMe = p.manager_name === G.managerName ? 'border:1px solid var(--gold); background:rgba(251,191,36,.1);' : '';
    
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

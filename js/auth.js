// ============================================
// auth.js - حل نهائي صارم (بدون استدعاء اللوبي)
// ============================================

const SUPABASE_URL = 'https://yueqfoivwfpxuxrzokto.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L-TNPbuS3sslIa68v_oyiA_6GQ-hmuW';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window._db = _supabase;

function showAuthScreen() {
  $('main').innerHTML = `
    <div class="setup-hero" style="margin-top: 30px;">
      <div class="setup-icon">☁️</div>
      <div class="setup-title">تسجيل الدخول</div>
      <div class="setup-sub">سجل دخولك لحفظ تقدمك</div>
      <input type="email" id="login-email" placeholder="البريد الإلكتروني" style="margin-bottom:10px; text-align:left; direction:ltr;">
      <input type="password" id="login-pass" placeholder="كلمة المرور" style="margin-bottom:15px; text-align:left; direction:ltr;">
      <button class="b a full" style="padding:14px; font-size:14px; margin-bottom:10px;" onclick="loginUser(this)">تسجيل الدخول</button>
      <button class="b g full" style="padding:12px; font-size:13px; margin-bottom:15px;" onclick="showRegisterScreen()">إنشاء حساب جديد</button>
      <button class="b" style="background:#475569; padding:10px; font-size:12px;" onclick="showSetup()">تخطي (لعب محلي)</button>
    </div>
  `;
}

function showRegisterScreen() {
  $('main').innerHTML = `
    <div class="setup-hero" style="margin-top: 30px;">
      <div class="setup-icon">📝</div>
      <div class="setup-title">حساب جديد</div>
      <input type="text" id="reg-name" placeholder="اسم المدرب" style="margin-bottom:10px;">
      <input type="email" id="reg-email" placeholder="البريد الإلكتروني" style="margin-bottom:10px; text-align:left; direction:ltr;">
      <input type="password" id="reg-pass" placeholder="كلمة المرور" style="margin-bottom:15px; text-align:left; direction:ltr;">
      <button class="b g full" style="padding:14px; font-size:14px; margin-bottom:10px;" onclick="registerUser(this)">تسجيل الحساب</button>
      <button class="b a full" style="padding:12px; font-size:13px;" onclick="showAuthScreen()">العودة</button>
    </div>
  `;
}

async function registerUser(btn) {
  const name = $('reg-name').value.trim(), email = $('reg-email').value.trim(), pass = $('reg-pass').value.trim();
  if(!name || !email || !pass) return alert('أدخل جميع البيانات');
  btn.textContent = 'جاري التسجيل...'; btn.disabled = true;
  const { data, error } = await _db.auth.signUp({ email, password: pass });
  if (error) { btn.textContent = 'تسجيل'; btn.disabled = false; return alert('خطأ: ' + error.message); }
  if (data.user) {
    await _db.from('profiles').insert({ id: data.user.id, email, manager_name: name, trophies: 0, manager_level: 1, manager_xp: 0 });
    alert('✅ تم إنشاء الحساب! سجل دخولك الآن.');
    showAuthScreen();
  }
}

async function loginUser(btn) {
  const email = $('login-email').value.trim(), pass = $('login-pass').value.trim();
  if(!email || !pass) return alert('أدخل البريد وكلمة المرور');
  btn.textContent = 'جاري الدخول...'; btn.disabled = true;
  
  const { data, error } = await _db.auth.signInWithPassword({ email, password: pass });
  if (error) { btn.textContent = 'تسجيل الدخول'; btn.disabled = false; return alert('خطأ: ' + error.message); }

  await loadProfileFromCloud();
  
  $('main').innerHTML = '<div style="text-align:center; padding:50px; color:var(--gold); font-weight:bold;">✅ تم الدخول.. جاري التحويل...</div>';
  
  // ✅ التوجيه القسري المباشر لاختيار الدوري
  setTimeout(() => {
      if (typeof selTeam === 'function') {
          selTeam(); // دالة اختيار الدوري
      } else {
          showSetup();
      }
  }, 100);
}

async function saveToCloud() {
  if (!G || !G.my) return;
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return; 
  const t = T[G.my];
  await _db.from('profiles').update({ manager_name: G.managerName, team_name: t ? t.name : '', league_name: G.league || '' }).eq('id', user.id);
}

async function loadProfileFromCloud() {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return;
  const { data } = await _db.from('profiles').select('*').eq('id', user.id).single();
  if (data) {
    if (!G) G = {};
    G.managerName = data.manager_name || 'المدرب';
    G.trophies = data.trophies || 0;
    G.managerLevel = data.manager_level || 1;
    G.managerXp = data.manager_xp || 0;
  }
}

// ============================================
// auth.js - نظام تسجيل الدخول (نسخة محمية ضد التعليق)
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
      <div class="setup-sub">سجل دخولك للعب مع أصدقائك</div>
      <input type="email" id="login-email" placeholder="البريد الإلكتروني" style="margin-bottom:10px; text-align:left; direction:ltr;">
      <input type="password" id="login-pass" placeholder="كلمة المرور" style="margin-bottom:15px; text-align:left; direction:ltr;">
      <button class="b a full" style="padding:14px; font-size:14px; margin-bottom:10px;" onclick="loginUser(this)">تسجيل الدخول</button>
      <div style="text-align:center; font-size:12px; color:#94a3b8; margin-bottom:10px;">ليس لديك حساب؟</div>
      <button class="b g full" style="padding:12px; font-size:13px; margin-bottom:15px;" onclick="showRegisterScreen()">إنشاء حساب جديد</button>
      <button class="b" style="background:#475569; padding:10px; font-size:12px;" onclick="showSetup()">تخطي (لعب فردي)</button>
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
  if(pass.length < 6) return alert('كلمة المرور 6 أحرف على الأقل');
  
  const originalText = btn.textContent;
  btn.textContent = 'جاري التسجيل...'; btn.disabled = true;

  try {
    const { data, error } = await _db.auth.signUp({ email, password: pass });
    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await _db.from('profiles').insert({ id: data.user.id, email, manager_name: name, trophies: 0, manager_level: 1, manager_xp: 0 });
      if (profileError) console.warn("Profile Create Error:", profileError);
      
      alert('✅ تم إنشاء الحساب! سجل دخولك الآن.');
      showAuthScreen();
    }
  } catch (err) {
    console.error("Register Error:", err);
    btn.textContent = originalText; btn.disabled = false;
    alert('خطأ في التسجيل: ' + (err.message || 'تأكد من اتصالك بالإنترنت'));
  }
}

async function loginUser(btn) {
  const email = $('login-email').value.trim(), pass = $('login-pass').value.trim();
  if(!email || !pass) return alert('أدخل البريد وكلمة المرور');
  
  const originalText = btn.textContent;
  btn.textContent = 'جاري الدخول...'; 
  btn.disabled = true;
  
  try {
    // 1. محاولة تسجيل الدخول من Supabase
    const { data, error } = await _db.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    // 2. حفظ معرف المستخدم
    if (data && data.user) {
        if (typeof G === 'undefined' || !G) window.G = {};
        G._userId = data.user.id; 
    }

    // 3. جلب البيانات (محمي بخطأ منفصل حتى لا يمنع الدخول إذا كان الجدول فارغاً)
    try {
        await loadProfileFromCloud();
    } catch (profileErr) {
        console.warn("Could not load profile, continuing anyway.", profileErr);
    }
    
    $('main').innerHTML = '<div style="text-align:center; padding:50px; color:var(--gold); font-weight:bold;">✅ تم الدخول.. جاري التحويل...</div>';
    
    // 4. التوجيه الذكي
    setTimeout(() => {
        if (typeof showLeaguesPage === 'function') {
            showLeaguesPage();
        } else if (typeof selTeam === 'function') {
            selTeam();
        } else if (typeof showSetup === 'function') {
            showSetup();
        } else {
            location.reload();
        }
    }, 100);

  } catch (err) {
    console.error("Login Error:", err);
    btn.textContent = originalText; 
    btn.disabled = false;
    alert('تعذر تسجيل الدخول: ' + (err.message || 'تأكد من اتصالك بالإنترنت أو من صحة البيانات'));
  }
}

async function saveToCloud() {
  if (!G || !G.my) return;
  try {
    const { data: { user } } = await _db.auth.getUser();
    if (!user) return; 
    const t = T[G.my];
    await _db.from('profiles').update({ manager_name: G.managerName, team_name: t ? t.name : '', league_name: G.league || '' }).eq('id', user.id);
  } catch (e) { console.warn("Save to cloud failed:", e); }
}

async function loadProfileFromCloud() {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return;
  
  const { data, error } = await _db.from('profiles').select('*').eq('id', user.id).single();
  if (error && error.code !== 'PGRST116') {
      // PGRST116 تعني أن المستخدم ليس لديه ملف شخصي بعد (لاعب جديد)
      throw error; 
  }
  
  if (data) {
    if (typeof G === 'undefined' || !G) window.G = {};
    G.managerName = data.manager_name || G.managerName || 'المدرب';
    G.trophies = data.trophies || 0;
    G.managerLevel = data.manager_level || 1;
    G.managerXp = data.manager_xp || 0;
  }
}

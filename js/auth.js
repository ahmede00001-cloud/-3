// ============================================
// auth.js - نظام تسجيل الدخول (مع مؤقت إنقاذ)
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
      <button class="b a full" id="btn-login" style="padding:14px; font-size:14px; margin-bottom:10px;" onclick="loginUser()">تسجيل الدخول</button>
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
      <button class="b g full" id="btn-reg" style="padding:14px; font-size:14px; margin-bottom:10px;" onclick="registerUser()">تسجيل الحساب</button>
      <button class="b a full" style="padding:12px; font-size:13px;" onclick="showAuthScreen()">العودة</button>
    </div>
  `;
}

async function registerUser() {
  const btn = document.getElementById('btn-reg');
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value.trim();
  
  if(!name || !email || !pass) return alert('أدخل جميع البيانات');
  if(pass.length < 6) return alert('كلمة المرور 6 أحرف على الأقل');
  
  btn.textContent = 'جاري التسجيل...'; btn.disabled = true;

  try {
    const { data, error } = await _db.auth.signUp({ email, password: pass });
    if (error) throw error;

    if (data.user) {
      await _db.from('profiles').insert({ id: data.user.id, email, manager_name: name });
      alert('✅ تم إنشاء الحساب! سجل دخولك الآن.');
      showAuthScreen();
    }
  } catch (err) {
    alert('خطأ في التسجيل: ' + err.message);
    btn.textContent = 'تسجيل الحساب'; btn.disabled = false;
  }
}

async function loginUser() {
  const btn = document.getElementById('btn-login');
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  
  if(!email || !pass) return alert('أدخل البريد وكلمة المرور');
  
  btn.textContent = 'جاري الدخول...'; 
  btn.disabled = true;
  
  // ✅ نظام الحماية: إذا لم يرد السيرفر خلال 8 ثوانٍ، سيظهر خطأ بدلاً من التعليق
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('انتهت مهلة الاتصال. تأكد من الإنترنت أو حاول لاحقاً.')), 8000)
  );

  try {
    // سباق بين طلب الدخول والمؤقت
    const { data, error } = await Promise.race([
        _db.auth.signInWithPassword({ email, password: pass }),
        timeoutPromise
    ]);
    
    if (error) throw error;

    $('main').innerHTML = '<div style="text-align:center; padding:50px; color:var(--gold); font-weight:bold;">✅ تم الدخول.. جاري التحويل...</div>';
    
    // تحويل فوري
    setTimeout(() => {
        if (typeof showLeaguesPage === 'function') showLeaguesPage();
        else if (typeof selTeam === 'function') selTeam();
        else location.reload();
    }, 100);

  } catch (err) {
    alert('تعذر الدخول: ' + err.message);
    btn.textContent = 'تسجيل الدخول'; 
    btn.disabled = false;
  }
}

// دوال مساعدة (لن تؤثر على التعليق)
async function saveToCloud() {
  if (!G || !G.my) return;
  try {
    const { data: { user } } = await _db.auth.getUser();
    if (!user) return; 
    await _db.from('profiles').update({ manager_name: G.managerName }).eq('id', user.id);
  } catch (e) {}
}

async function loadProfileFromCloud() {}

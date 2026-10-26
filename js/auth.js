// ============================================
// auth.js - نظام تسجيل الدخول (حل فوري وتخطي اللوبي)
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
      <div class="setup-sub">سجل دخولك لحفظ تقدمك ومنافسة الآخرين</div>
      
      <input type="email" id="login-email" placeholder="البريد الإلكتروني" style="margin-bottom:10px; text-align:left; direction:ltr;">
      <input type="password" id="login-pass" placeholder="كلمة المرور" style="margin-bottom:15px; text-align:left; direction:ltr;">
      
      <button class="b a full" style="padding:14px; font-size:14px; margin-bottom:10px;" onclick="loginUser(this)">تسجيل الدخول</button>
      
      <div style="text-align:center; font-size:12px; color:#94a3b8; margin-bottom:10px;">ليس لديك حساب؟</div>
      <button class="b g full" style="padding:12px; font-size:13px; margin-bottom:15px;" onclick="showRegisterScreen()">إنشاء حساب جديد</button>
      
      <button class="b" style="background:#475569; padding:10px; font-size:12px;" onclick="showSetup()">العودة للبداية</button>
    </div>
  `;
}

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

async function registerUser(btnElement) {
  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const pass = $('reg-pass').value.trim();
  
  if(!name || !email || !pass) return alert('الرجاء إدخال جميع البيانات');
  if(pass.length < 6) return alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

  const originalText = btnElement.textContent;
  btnElement.textContent = 'جاري التسجيل...';
  btnElement.disabled = true;

  const { data, error } = await _db.auth.signUp({ email, password: pass });
  
  if (error) {
    btnElement.textContent = originalText;
    btnElement.disabled = false;
    return alert('خطأ في التسجيل: ' + error.message);
  }

  if (data.user) {
    await _db.from('profiles').insert({
      id: data.user.id,
      email: email,
      manager_name: name,
      trophies: 0,
      manager_level: 1,
      manager_xp: 0
    });
    alert('✅ تم إنشاء الحساب بنجاح!\n\nيرجى تسجيل الدخول الآن لبدء اللعبة.');
    showAuthScreen(); 
  }
}

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

  // جلب البيانات من السيرفر (الاسم، البطولات، إلخ)
  await loadProfileFromCloud();
  
  // ✅ التوجيه المباشر: إذا كان هناك مسيرة محفوظة ادخل للعبة، إذا لا، اذهب لاختيار الدوري
  if (typeof G !== 'undefined' && G && G.season) {
      $('bottom-nav').hidden = false;
      dash();
  } else {
      alert("تم تسجيل الدخول بنجاح!\nيرجى اختيار فريقك لبدء المسيرة.");
      // التوجه لصفحة اختيار الدوري مباشرة (بدون المرور بصفحة الغرف)
      if (typeof selTeam === 'function') {
          selTeam();
      } else {
          location.reload();
      }
  }
}

async function saveToCloud() {
  if (!G || !G.my) return;
  const { data: { user } } = await _db.auth.getUser();
  if (!user) return; 

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

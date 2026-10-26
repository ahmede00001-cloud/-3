// ============================================
// main.js - التهيئة والأحداث العامة (محدث ومحمي)
// ============================================

// ============================================
// معالجة الأخطاء العالمية
// ============================================
window.onerror = function(msg, url, line){
  const m = document.getElementById('main');
  // تجاهل أخطاء الإضافات (Extensions)
  if(msg.includes('Extension context invalidated') || msg.includes('Failed to fetch')) return false;
  
  if(m && m.innerHTML === '') {
      m.innerHTML = '<div style="color:red;padding:20px;text-align:center;">خطأ: '+msg+'<br>سطر: '+line+'</div>';
  }
  return false;
};

// ============================================
// لوحة المفاتيح
// ============================================
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    if($('pm')) $('pm').hidden = true;
    if($('sm')) $('sm').hidden = true;
    if($('cm')) $('cm').hidden = true;
    if($('om')) $('om').hidden = true;
    if($('rs')) $('rs').hidden = true;
  }
  if(e.key === ' ' && $('ms') && !$('ms').hidden){
    e.preventDefault();
    if(typeof pz === 'function') pz();
  }
});

// ============================================
// التهيئة الآمنة عند اكتمال تحميل الصفحة
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. تهيئة البيانات الأساسية (الفرق، اللاعبين، إلخ)
    if (typeof mk === 'function') {
      mk(); 
    }
    
    // 2. التحقق من وجود حفظ محلي للعبة
    const savedData = (typeof load === 'function') ? load() : null;
    
    if (savedData) {
      // يوجد حفظ محلي -> اذهب لشاشة البداية (ستظهر خيار "متابعة المسيرة")
      showSetup();
    } else {
      // لا يوجد حفظ محلي -> تحقق من Supabase لتسجيل الدخول
      if (window._db) {
        try {
          // التحقق من وجود جلسة نشطة (مستخدم مسجل دخول مسبقاً)
          const { data: { session } } = await window._db.auth.getSession();
          
          if (session) {
            // مسجل دخول بالفعل، ولكن لا يوجد حفظ محلي (لاعب جديد)
            // نذهب لشاشة إعداد الفريق
            showSetup(); 
          } else {
            // غير مسجل دخول -> اذهب لشاشة تسجيل الدخول
            if (typeof showAuthScreen === 'function') {
              showAuthScreen();
            } else {
              showSetup();
            }
          }
        } catch (authError) {
          console.error("Supabase Auth Error:", authError);
          showSetup(); // في حالة فشل الاتصال، العب محلياً
        }
      } else {
        // Supabase غير متاح (مثلاً لم يتم تحميله) -> العب محلياً
        showSetup();
      }
    }
  } catch (err) {
    console.error(err);
    const mm = document.getElementById('main');
    if (mm) mm.innerHTML = '<div style="color:red;padding:20px;text-align:center;">خطأ في التهيئة: ' + err.message + '</div>';
  }
});

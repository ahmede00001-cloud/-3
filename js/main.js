// ============================================
// main.js - التهيئة والأحداث العامة
// ============================================

// ============================================
// معالجة الأخطاء العالمية
// ============================================
window.onerror = function(msg, url, line){
  const m = document.getElementById('main');
  if(m) m.innerHTML = '<div style="color:red;padding:20px;text-align:center;">خطأ: '+msg+'<br>سطر: '+line+'</div>';
  return false;
};

// ============================================
// لوحة المفاتيح
// ============================================
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    $('pm').hidden = true;
    $('sm').hidden = true;
    $('cm').hidden = true;
    $('om').hidden = true;
    $('rs').hidden = true;
  }
  if(e.key === ' ' && !$('ms').hidden){
    e.preventDefault();
    pz();
  }
});

// ============================================
// التهيئة
// ============================================
try{
  mk();
  showSetup();
} catch(err){
  const mm = document.getElementById('main');
  if(mm) mm.innerHTML = '<div style="color:red;padding:20px;text-align:center;">خطأ: '+err.message+'</div>';
  console.error(err);
}

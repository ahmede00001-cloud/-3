// ============================================
// main.js - التهيئة والأحداث العامة
// ============================================

window.onerror = function(msg, url, line){
  const m = document.getElementById('main');
  if(msg.includes('Extension context invalidated') || msg.includes('Failed to fetch')) return false;
  if(m && m.innerHTML === '') {
      m.innerHTML = '<div style="color:red;padding:20px;text-align:center;">خطأ: '+msg+'<br>سطر: '+line+'</div>';
  }
  return false;
};

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

window.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof mk === 'function') mk();
    
    const savedData = (typeof load === 'function') ? load() : null;
    
    if (savedData && typeof G !== 'undefined' && G) {
      // ✅ إذا كان اللاعب مسجلاً في غرفة أونلاين، نستأنف الغرفة ونذهب للواجهة
      if (G.multiplayerLeagueId) {
          if (typeof showLeaguesPage === 'function') {
              showLeaguesPage();
              return;
          }
      }
      // إذا كان يملك مسيرة عادية
      showSetup();
    } else {
      if (window._db) {
        try {
          const { data: { session } } = await window._db.auth.getSession();
          if (session) {
            if (typeof showAuthScreen === 'function') showAuthScreen(); // أو showLeaguesPage حسب رغبتك للمستخدم الجديد
            else showSetup();
          } else {
            if (typeof showAuthScreen === 'function') showAuthScreen();
            else showSetup();
          }
        } catch (e) {
          showSetup(); 
        }
      } else {
        showSetup();
      }
    }
  } catch (err) {
    const mm = document.getElementById('main');
    if (mm) mm.innerHTML = '<div style="color:red;padding:20px;text-align:center;">خطأ: ' + err.message + '</div>';
  }
});

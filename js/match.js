// ============================================
// match.js - واجهة المباراة، الرسم، النتيجة (نسخة مصلّحة)
// ============================================

// ✅ يضمن إن خاصية hidden تشتغل دايماً حتى لو الـ CSS عامل display للعنصر
(function(){
  if(document.getElementById('hidden-fix')) return;
  const st = document.createElement('style');
  st.id = 'hidden-fix';
  st.textContent = '[hidden]{display:none !important}';
  document.head.appendChild(st);
})();

// ✅ مؤقت المحاكاة (يعتمد على الزمن الحقيقي مش على معدل الشاشة)
let simAcc = 0;
let loopErrors = 0;
const SIM_STEP_MS = 1000/60;

function play(){
  if(!G.lu || G.lu.length !== 11 || G.lu.includes(null) || G.lu.some(id => !T[G.my].ps.find(p => p.id === id))){
    return alert('التشكيلة غير مكتملة! يرجى التأكد من اختيار 11 لاعباً.');
  }

  const nm = getNextUserMatch();
  if(!nm) return alert('لا مباراة!');

  if(daysUntilMatch(nm) > 0) {
    try { advanceToDay(nm.day); } catch(e) { console.error("Advance error:", e); }
  }

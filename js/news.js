// ============================================
// news.js - نظام الأخبار + المؤتمرات الصحفية
// ============================================

function categorizeNews(text){
  if(!text) return 'general';
  if(/⚽|جوووول|هدف|تسديدة|هاتريك|مباراة|ديربي|فوز|تعادل|خسارة|🏁/.test(text)) return 'match';
  if(/💰.*ينتقل|💼|انضمام|انتقال|صفقة|👋|يرحل|يغادر|ينضم|يُباع|بيع/.test(text)) return 'transfer';
  if(/🚑|🤕|🩹|🏥|إصابة|مصاب|تعافى|غياب/.test(text)) return 'injury';
  if(/🏆|بطل|كأس|دوري|بطولة|تتويج|تأهل|🌍|🌐/.test(text)) return 'trophy';
  if(/💰|💸|M\s|ميزانية|رصيد|دخل|عجز|قرض|مكافأة|رواتب|رعاية|💼/.test(text) && !/ينتقل|صفقة|انضمام/.test(text)) return 'finance';
  if(/📋.*عقد|✍️|تجديد|راتب|ينتهي عقده|انتهى عقد/.test(text)) return 'contract';
  if(/🎖️|لاعب الشهر|جوائز الموسم|أفضل لاعب|هداف/.test(text)) return 'award';
  if(/📖|خطة|تكتيك|تشكيلة|تعليمات|أدوار/.test(text)) return 'tactical';
  return 'general';
}

function setNewsFilter(cat){
  currentNewsFilter = cat;
  dash();
}

function clearAllNews(){
  if(confirm('مسح كل الأخبار؟')){
    G.news = [];
    save();
    dash();
  }
}

// ============================================
// المؤتمر الصحفي
// ============================================
function showPressConference(next){
  const oppName = T[next.opp]?.name
    || next.oppName
    || AFRICAN.find(a => a[0] === next.opp)?.[1]
    || WORLD.find(w => w[0] === next.opp)?.[1]
    || next.opp;

  const html = `<div class="mc mc-info" style="text-align:right">
    <button class="mc-close" onclick="$('cm').hidden=true">✕</button>
    <div class="mc-head" style="text-align:center">
      <div class="mc-icon">🎤</div>
      <div class="mc-title">مؤتمر صحفي</div>
      <div class="mc-sub">قبل مواجهة ${oppName}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${PRESS_OPTIONS.map((o,i) => `<button class="press-option" onclick="pressChoice(${i})">"${o.text}"</button>`).join('')}
      <button class="b a" style="padding:10px;font-size:12px" onclick="$('cm').hidden=true">تجاهل</button>
    </div>
  </div>`;
  $('cmc').innerHTML = html;
  $('cm').hidden = false;
}

function pressChoice(idx){
  const opt = PRESS_OPTIONS[idx];
  const t = T[G.my];
  t.ps.forEach(p => {
    if(!p.morale) p.morale = 70;
    p.morale = Math.max(0, Math.min(100, p.morale+opt.morale));
  });
  addNews(`🎤 المدرب: "${opt.text}"`,
    opt.morale > 0 ? '📈 معنويات ترتفع!' : opt.morale < 0 ? '📉 معنويات تنخفض...' : '😐 رد محايد');
  $('cm').hidden = true;
  save(); dash();
}

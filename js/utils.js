// ============================================
// utils.js - دوال مساعدة + الحالة العامة
// ============================================

// ============ الحالة العامة ============
let T = {};           // الفرق
let G = null;         // حالة اللاعب
let Mt = null;        // المباراة الحالية
let raf, last, speed = 3, paused = false, shown = 0;
let pendingLvl = [];
let audioCtx = null, soundEnabled = true;
let tempUserData = {username:'', managerName:'', tournament:'الدوري المصري الممتاز'};
let pendingPenaltyResult = null;
let dragState = null, activeSlotIdx = -1, currentInstSlot = -1;
let currentNewsFilter = 'all';

// ============ اختصارات ============
const $ = i => document.getElementById(i);
const R = Math.random;

// ============ البذور العشوائية ============
function seedFrom(str){let h=0;for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0}return Math.abs(h)}
function seededRandom(seed){let s=seed;return()=>{s=(s*9301+49297)%233280;return s/233280}}
function hs(id){return [...id].reduce((a,c)=>a+c.charCodeAt(0),0)}

// ============ حفظ/تحميل ============
const save = () => {try{localStorage.setItem('c26_egypt_v26', JSON.stringify({T,G}))}catch(e){}};
const load = () => {try{const d=JSON.parse(localStorage.getItem('c26_egypt_v26'));return d&&d.T&&d.G?d:null}catch(e){return null}};

// ============ سمات اللاعب ============
function playerAttrs(p){
  const rnd = seededRandom(seedFrom(p.id)), b = p.r;
  const j = () => Math.max(42,Math.min(99,Math.round(b+(rnd()-0.5)*10)));
  return {pace:j(),shooting:j(),passing:j(),dribbling:j(),defending:j(),physical:j(),aggr:Math.round(45+rnd()*45)};
}

function calcVal(r,lvl,age){
  let base = Math.pow(Math.max(0,r-50)/10, 2.2)*0.8 + 0.5;
  if(age < 23) base *= 1.2;
  else if(age > 30) base *= 0.8;
  return Math.round(base*(1+(lvl-1)*0.2)*10)/10;
}

function xpNeeded(lvl){return 100+(lvl-1)*50}
function calcSalary(r){return Math.max(0.1, Math.round(r*0.004*100)/100)}

function contractModifier(p){
  if(!p.contract) return 1;
  let mod = 1;
  if(p.contract.years <= 0) mod *= 0.88;
  else if(p.contract.years === 1) mod *= 0.96;
  const expected = calcSalary(p.r);
  if(p.contract.salary > expected*1.5) mod *= 1.03;
  else if(p.contract.salary < expected*0.7) mod *= 0.94;
  return mod;
}

function onLevelUp(p){
  const boost = p.lvl <= 5 ? 2 : 1;
  p.pace = Math.min(99,(p.pace||p.r)+boost);
  p.shooting = Math.min(99,(p.shooting||p.r)+boost);
  p.passing = Math.min(99,(p.passing||p.r)+boost);
  p.dribbling = Math.min(99,(p.dribbling||p.r)+boost);
  p.defending = Math.min(99,(p.defending||p.r)+boost);
  p.physical = Math.min(99,(p.physical||p.r)+boost);
  p.r = Math.min(99,p.r+1);
  p.value = calcVal(p.r,p.lvl,p.age);
  if(G) addNews(`⭐ تطوّر ${p.name} للمستوى ${p.lvl}!`,`📈 سمات +${boost} • تقييم ${p.r} • قيمة ${p.value}M`);
}

function gainXp(p,xp){
  if(!p || p.lvl >= 10) return;
  p.xp = (p.xp||0) + xp;
  while(p.lvl < 10 && p.xp >= xpNeeded(p.lvl)){
    p.xp -= xpNeeded(p.lvl);
    p.lvl++;
    onLevelUp(p);
  }
  if(p.lvl >= 10) p.xp = Math.min(p.xp, xpNeeded(9));
}

function createPlayer(id,name,pos,r,age=22){
  const secPos = POS[Math.floor(R()*4)];
  const b = {id,name,pos,secPos,age,r,fit:100,goals:0,yc:0,rc:0,susp:0,morale:70,injury:null,contract:null,form:[6,6,6],chemistry:0,stats:{matches:0,goals:0,assists:0,rating:0}};
  Object.assign(b, playerAttrs(b));
  b.lvl = 1; b.xp = 0;
  b.value = calcVal(r,1,age);
  b.contract = {years:2+Math.floor(R()*3), salary:calcSalary(r)};
  return b;
}

// ============ المواقع على الملعب ============
function getSlots(f){
  const fm = FM[f] || FM['4-3-3'];
  const s = [];
  s.push({pos:'GK', x:fm.GK[0][0], y:fm.GK[0][1]});
  fm.DEF.forEach(x => s.push({pos:'DEF', x:x[0], y:x[1]}));
  fm.MID.forEach(x => s.push({pos:'MID', x:x[0], y:x[1]}));
  fm.FWD.forEach(x => s.push({pos:'FWD', x:x[0], y:x[1]}));
  return s;
}

function attrScore(p,pos){
  const w = POS_WEIGHTS[pos] || POS_WEIGHTS.MID;
  let s = 0;
  for(const k in w) s += ((p[k] !== undefined ? p[k] : p.r) * w[k]);
  return s;
}

// ============ تقييم اللاعبين ============
const moraleBonus = p => p.morale ? .85+(p.morale/100)*.3 : 1;

function getFormBonus(p){
  if(!p.form || !p.form.length) return 1;
  const a = p.form.reduce((x,y)=>x+y,0)/p.form.length;
  if(a >= 7.5) return 1.10;
  if(a >= 6.5) return 1.05;
  if(a <= 4.5) return 0.90;
  if(a <= 5.5) return 0.95;
  return 1;
}

function getFormEmoji(p){
  if(!p.form || !p.form.length) return '➖';
  const a = p.form.reduce((x,y)=>x+y,0)/p.form.length;
  if(a >= 7.5) return '🔥';
  if(a >= 6.5) return '🌡️';
  if(a <= 4.5) return '🧊';
  if(a <= 5.5) return '❄️';
  return '➖';
}

const ef = p => {
  const pos = p.role || p.pos || 'MID';
  const attr = attrScore(p, pos);
  const blended = attr*0.60 + p.r*0.40;
  let base = (blended+(p.lvl-1)*0.8)*(.55+.45*(p.fit!=null?p.fit:100)/100)*moraleBonus(p)*getFormBonus(p)*contractModifier(p);
  if(p.chemistry) base += (p.chemistry*0.01);
  if(p.isOOP) base *= (p.pos===p.secPos ? 0.95 : 0.82);
  return base;
};

const er = p => {
  const pos = p.role || p.pos || 'MID';
  const attr = attrScore(p, pos);
  const blended = attr*0.60 + p.r*0.40;
  let base = (blended+(p.lvl-1)*0.8)*(.55+.45*(p.st!=null?p.st:100)/100)*moraleBonus(p)*getFormBonus(p)*contractModifier(p);
  if(p.chemistry) base += (p.chemistry*0.01);
  if(p.isOOP) base *= (p.pos===p.secPos ? 0.95 : 0.82);
  return base;
};

const pwr = p => Math.pow(er(p)/74, 3.2);
const shootPower = p => Math.pow(((p.shooting*0.7+p.dribbling*0.15+p.physical*0.15)+(p.lvl-1)*0.8)/74, 3.0);
const savePower = p => Math.pow(((p.defending*0.65+p.physical*0.25+p.pace*0.10)+(p.lvl-1)*0.8)/74, 3.0);
const tacklePower = p => Math.pow(((p.defending*0.60+p.physical*0.25+p.pace*0.15)+(p.lvl-1)*0.8)/74, 3.0);
const dribblePower = p => Math.pow(((p.dribbling*0.55+p.pace*0.25+p.physical*0.20)+(p.lvl-1)*0.8)/74, 3.0);

// ============ التشكيلة التلقائية ============
function autoFillLineup(t,f){
  const slots = getSlots(f);
  const lineup = new Array(11).fill(null);
  const used = new Set();
  const av = t.ps.filter(p => !p.susp && !p.injury).sort((a,b) => er(b)-er(a));
  slots.forEach((s,i) => {
    const p = av.find(x => x.pos === s.pos && !used.has(x.id));
    if(p){lineup[i]=p.id; used.add(p.id);}
  });
  slots.forEach((s,i) => {
    if(!lineup[i]){
      const p = av.find(x => !used.has(x.id));
      if(p){lineup[i]=p.id; used.add(p.id);}
    }
  });
  return lineup;
}

const teamLvl = t => {
  const s = autoFillLineup(t,t.form).map(id => t.ps.find(p => p.id===id)).filter(Boolean);
  return (s.reduce((a,p)=>a+(p.lvl||1),0)/Math.max(1,s.length)).toFixed(1);
};

// ============ جدول الترتيب ============
const tbl = () => Object.values(T).sort((a,b) => b.pts-a.pts || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf);

function rec(a,b,g1,g2){
  a.pl++; b.pl++;
  a.gf+=g1; a.ga+=g2; b.gf+=g2; b.ga+=g1;
  if(g1>g2){a.w++; a.pts+=3; b.l++;}
  else if(g1<g2){b.w++; b.pts+=3; a.l++;}
  else {a.d++; b.d++; a.pts++; b.pts++;}
}

// ============ الموال ============
function updateMorale(t,r){
  t.ps.forEach(p => {
    if(!p.morale) p.morale = 70;
    if(r === 'win') p.morale = Math.min(100, p.morale+3);
    else if(r === 'loss') p.morale = Math.max(0, p.morale-3);
    const isSt = G && G.lu && G.lu.includes(p.id);
    if(isSt) p.morale = Math.min(100, p.morale+1);
    else if(p.morale > 40) p.morale = Math.max(0, p.morale-2);
  });
}

function updateContractMorale(t){
  t.ps.forEach(p => {
    if(!p.contract) return;
    if(p.contract.years <= 0) p.morale = Math.max(0,(p.morale||70)-3);
    else if(p.contract.years === 1) p.morale = Math.max(0,(p.morale||70)-1);
    const expected = calcSalary(p.r);
    if(p.contract.salary > expected*1.4) p.morale = Math.min(100,(p.morale||70)+2);
    else if(p.contract.salary < expected*0.7) p.morale = Math.max(0,(p.morale||70)-2);
  });
}

function getMoraleEmoji(m){
  if(m>=80) return '😊';
  if(m>=60) return '😐';
  if(m>=40) return '😕';
  return '😞';
}

// ============ الديربي والجو ============
function isDerby(t1,t2){
  return DERBIES.some(d => (d[0]===t1&&d[1]===t2)||(d[1]===t1&&d[0]===t2));
}

function getWeather(day){
  const m = Math.floor(((day||1)/30)%12);
  if(m>=5 && m<=8) return R()<.7 ? WEATHERS[3] : WEATHERS[0];
  return WEATHERS[Math.floor(R()*3)];
}

// ============ VAR ============
function checkVAR(){
  if(!Mt || Mt.compName==='الدوري') return true;
  if(R() < .12){
    if(R() < .5){
      Mt.say(Math.floor(Mt.min),'var','⏳ VAR يراجع الهدف...');
      Mt.say(Math.floor(Mt.min),'red','❌ VAR يلغي الهدف!');
      return false;
    } else {
      Mt.say(Math.floor(Mt.min),'var','⏳ VAR يراجع...');
      Mt.say(Math.floor(Mt.min),'goal','✅ الهدف صحيح!');
      return true;
    }
  }
  return true;
}

// ============ أهداف الإدارة ============
function setBoardObjectives(t){
  const r = t.R;
  if(r>=88) return [{id:'win_league',desc:'الفوز بلقب الدوري',reward:80},{id:'win_cup',desc:'الفوز بكأس مصر',reward:50}];
  if(r>=80) return [{id:'top3',desc:'المركز 1-3',reward:60},{id:'cup_sf',desc:'نصف نهائي الكأس',reward:30}];
  if(r>=72) return [{id:'top6',desc:'المركز 1-6',reward:40},{id:'cup_qf',desc:'ربع نهائي الكأس',reward:20}];
  return [{id:'avoid_relegation',desc:'تفادي الهبوط',reward:30}];
}

function checkBoardObjectives(){
  if(!G.boardObjectives || !G.boardObjectives.length) return;
  const t = T[G.my];
  const st = tbl();
  const myPos = st.findIndex(x => x.id===G.my)+1;
  const cupW = G.season?.cupBracket?.winner;
  G.boardObjectives.forEach(o => {
    let ok = false;
    if(o.id==='win_league') ok = myPos===1;
    else if(o.id==='win_cup') ok = cupW===G.my;
    else if(o.id==='top3') ok = myPos<=3;
    else if(o.id==='cup_sf') ok = myPos<=4;
    else if(o.id==='top6') ok = myPos<=6;
    else if(o.id==='cup_qf') ok = myPos<=8;
    else if(o.id==='avoid_relegation') ok = myPos<=14;
    if(ok){
      t.budget = Math.round((t.budget+o.reward)*10)/10;
      addNews(`✅ هدف محقق: ${o.desc}!`,`💰 مكافأة الإدارة: +${o.reward}M`);
    } else addNews(`❌ هدف فائت: ${o.desc}`,`📉 الإدارة غير راضية`);
  });
}

// ============ الشباب ============
function generateYouthPlayer(t){
  const pos = POS[Math.floor(R()*4)];
  const name = YOUTH_NAMES[Math.floor(R()*YOUTH_NAMES.length)]+' '+(10+Math.floor(R()*90));
  const rating = 55+Math.floor(R()*15);
  const p = createPlayer(t.id+'_youth_'+Date.now()+'_'+Math.floor(R()*10000), name, pos, rating, 16);
  p.isYouth = true;
  p.morale = 90;
  return p;
}

function promoteYouth(){
  const t = T[G.my];
  if(t.ps.length>=25) return alert('الفريق ممتلئ!');
  if(!G.youthPlayers || !G.youthPlayers.length) return alert('لا يوجد شباب');
  const yp = G.youthPlayers.shift();
  t.ps.push(yp);
  addNews(`🌱 ${yp.name} يصعد للفريق الأول!`,`⭐ تقييم ${yp.r} • عمر ${yp.age} • ${yp.pos}`);
  save(); dash();
}

// ============ الصوت ============
function initAudio(){
  if(!audioCtx){
    try{audioCtx = new (window.AudioContext||window.webkitAudioContext)();}catch(e){}
  }
}

function playSound(t){
  if(navigator.vibrate && soundEnabled){
    try{navigator.vibrate(t==='goal'?[50,30,50]:15);}catch(e){}
  }
  if(!soundEnabled) return;
  initAudio();
  if(!audioCtx) return;
  try{
    if(t==='goal'){[523,659,784].forEach((f,i)=>setTimeout(()=>beep(f,.15,'sine',.15),i*100));}
    else if(t==='whistle'){beep(2000,.2,'square',.1); setTimeout(()=>beep(2200,.15,'square',.1),200);}
    else if(t==='levelup'){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.2,'sine',.15),i*120));}
    else if(t==='card'){beep(400,.15,'sawtooth',.1);}
    else if(t==='injury'){beep(150,.3,'sawtooth',.15);}
  }catch(e){}
}

function beep(f,d,t='sine',v=.1){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = t; o.frequency.value = f;
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime+d);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+d);
}

function addManagerXp(n){
  if(!G) return;
  G.managerXp = (G.managerXp||0)+n;
  const old = G.managerLevel||1;
  let nl = 1;
  for(let i=0;i<MGR_LEVELS.length;i++) if(G.managerXp >= MGR_LEVELS[i].xp) nl = i+1;
  if(nl > old){
    G.managerLevel = nl;
    addNews(`👑 ترقية المدرب - المستوى ${nl}!`,`🎁 مكافأة جديدة: ${MGR_LEVELS[nl-1].perk}`);
    playSound('levelup');
  }
}

function tryInjure(p){
  if(p.injury) return false;
  const base = .008 + (100-p.physical)*.00025;
  if(R() < base){
    const sev = p.physical<70?2 : p.physical<85?1 : 0;
    const mi = Math.min(INJURY_TYPES.length-1, sev+1+Math.floor(R()*2));
    const inj = INJURY_TYPES[mi];
    const m = inj.matches[0]+Math.floor(R()*(inj.matches[1]-inj.matches[0]+1));
    p.injury = {type:inj.type, emoji:inj.emoji, matchesLeft:m};
    if(G) addNews(`${inj.emoji} إصابة ${p.name}!`,`${inj.type} - يغيب ${m} مباراة`);
    playSound('injury');
    return true;
  }
  return false;
}

function recoverInjuries(t){
  t.ps.forEach(p => {
    if(p.injury){
      p.injury.matchesLeft--;
      if(p.injury.matchesLeft<=0){
        if(G) addNews(`✅ ${p.name} تعافى!`,`⚕️ جاهز للمباراة القادمة`);
        p.injury = null;
      }
    }
  });
}

// ============ الأهداف المتوقعة ============
function calcTeamPower(team, lineup){
  if(!lineup) lineup = autoFillLineup(team, team.form);
  const players = lineup.map(id => team.ps.find(p => p.id===id)).filter(Boolean);
  if(players.length===0) return {att:0, mid:0, def:0, overall:0};
  const slots = getSlots(team.form);
  let attSum=0, midSum=0, defSum=0, attC=0, midC=0, defC=0;
  players.forEach((p,i) => {
    const slot = slots[i] || {pos:p.pos};
    const pos = slot.pos;
    const boost = 1 + ((p.lvl||1)-1)*0.02;
    if(pos==='FWD'){attSum += (p.shooting*0.4+p.pace*0.25+p.dribbling*0.25+p.physical*0.1)*boost; attC++;}
    else if(pos==='MID'){midSum += (p.passing*0.35+p.dribbling*0.2+p.defending*0.2+p.physical*0.15+p.pace*0.1)*boost; midC++; attSum += (p.passing*0.35+p.dribbling*0.35+p.shooting*0.3)*boost; attC++;}
    else if(pos==='DEF'){defSum += (p.defending*0.4+p.physical*0.25+p.pace*0.2+p.passing*0.15)*boost; defC++;}
    else if(pos==='GK'){defSum += (p.defending*0.6+p.physical*0.3+p.pace*0.1)*boost*2; defC += 2;}
  });
  const att = attC>0 ? Math.round(attSum/attC) : 0;
  const mid = midC>0 ? Math.round(midSum/midC) : 0;
  const def = defC>0 ? Math.round(defSum/defC) : 0;
  return {att, mid, def, overall: Math.round((att+mid+def)/3)};
}

function calcMatchPreview(){
  const nm = getNextUserMatch();
  if(!nm) return null;
  const myTeam = T[G.my];
  const myPower = calcTeamPower(myTeam, G.lu);
  let oppPower, oppTeam = T[nm.opp];
  if(oppTeam){oppPower = calcTeamPower(oppTeam);}
  else {
    const rating = AFRICAN.find(a=>a[0]===nm.opp)?.[2] || WORLD.find(w=>w[0]===nm.opp)?.[2] || 68;
    oppPower = {att:rating, mid:rating, def:rating, overall:rating};
  }
  const fmB = FM_STYLE[G.form] || FM_STYLE['4-3-3'];
  const tacB = TAC_STYLE[G.tac] || TAC_STYLE.balanced;
  const homeBonus = nm.home ? 1.08 : 0.94;
  const myEff = (myPower.att*fmB.att*tacB.att*0.5 + myPower.def*fmB.def*tacB.def*0.5)*homeBonus;
  const oppEff = (oppPower.att*0.5 + oppPower.def*0.5);
  const diff = (myEff-oppEff)/20;
  const myWin = 1/(1+Math.exp(-diff*1.2))*0.85;
  const draw = Math.max(0.08, Math.min(0.30, 0.20-Math.abs(diff)*0.05));
  const winC = Math.max(0.05, Math.min(0.85, myWin-draw/2));
  const lossC = Math.max(0.05, 1-winC-draw);
  const xG = Math.round((myEff/75)*(nm.home?1.4:1.1)*10)/10;
  const xGA = Math.round((oppEff/75)*(nm.home?0.9:1.2)*10)/10;
  return {winProb:Math.round(winC*100), drawProb:Math.round(draw*100), lossProb:Math.round(lossC*100), xG, xGA, oppFormation:oppTeam?.form||'4-3-3', oppTactic:oppTeam?.tac||'balanced', isHome:nm.home};
}

function calcUserForm(){
  if(!G.season || !G.season.userCalendar) return [];
  const results = [];
  G.season.userCalendar.filter(m => m.played && m.result).forEach(m => {
    if(m.result.won) results.push('W');
    else if(m.result.draw) results.push('D');
    else results.push('L');
  });
  return results.slice(-5);
}

function calcWarnings(){
  const w = [];
  const t = T[G.my];
  const injured = t.ps.filter(p => p.injury).length;
  const suspended = t.ps.filter(p => p.susp > 0).length;
  const expiring = t.ps.filter(p => p.contract && p.contract.years <= 1).length;
  if(injured > 0) w.push({icon:'🚑', text:`${injured} مصاب`, color:'#ef4444'});
  if(suspended > 0) w.push({icon:'🟥', text:`${suspended} موقوف`, color:'#f87171'});
  if(expiring > 0) w.push({icon:'📋', text:`${expiring} عقد ينتهي`, color:'#fbbf24'});
  const empty = G.lu.filter(id => !id).length;
  if(empty > 0) w.push({icon:'⚠️', text:`${empty} مكان فارغ`, color:'#ef4444'});
  const slots = getSlots(G.form);
  const oop = G.lu.filter((id,i) => {
    if(!id) return false;
    const p = t.ps.find(x=>x.id===id);
    if(!p) return false;
    return p.pos !== slots[i].pos && p.secPos !== slots[i].pos;
  }).length;
  if(oop > 0) w.push({icon:'🔄', text:`${oop} خارج مركزه`, color:'#f97316'});
  return w;
}

function buildHints(){
  const hints = [];
  const t = T[G.my];
  const slots = getSlots(G.form);
  const bench = t.ps.filter(p => !G.lu.includes(p.id) && !p.susp && !p.injury);
  G.lu.forEach((id) => {
    if(!id) return;
    const p = t.ps.find(x=>x.id===id);
    if(p && p.fit < 60) hints.push({icon:'😴', text:`${p.name.split(' ')[0]} متعب (${Math.round(p.fit)}%) — بدّله`, color:'#fbbf24'});
  });
  const bestOut = [...bench].sort((a,b)=>b.r-a.r)[0];
  if(bestOut){
    const avgIn = G.lu.filter(id=>id).map(id=>t.ps.find(p=>p.id===id)?.r||0);
    const avg = avgIn.length ? avgIn.reduce((a,b)=>a+b,0)/avgIn.length : 0;
    if(bestOut.r > avg+3) hints.push({icon:'💎', text:`${bestOut.name.split(' ')[0]} (⭐${bestOut.r}) خارج التشكيلة!`, color:'#22d3ee'});
  }
  slots.forEach((slot,i) => {
    if(!G.lu[i]){
      const bak = bench.find(p => p.pos===slot.pos);
      if(bak) hints.push({icon:'🔧', text:`${slot.pos} فارغ — ضع ${bak.name.split(' ')[0]}`, color:'#4ade80'});
    }
  });
  return hints.slice(0,3);
}

function buildInstSummary(){
  const counts = {attack:0, defense:0, counter:0, press:0, stayback:0, normal:0};
  G.lu.forEach((id,i) => {
    if(!id) return;
    const inst = G.inst[i] || 'normal';
    counts[inst] = (counts[inst]||0)+1;
  });
  return counts;
}

// ============ التاريخ ============
function dayToDate(day){
  const d = new Date(SEASON_YEAR, 8, 1);
  d.setDate(d.getDate()+day-1);
  const mo = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${d.getDate()} ${mo[d.getMonth()]} ${d.getFullYear()}`;
}

// ============ إضافة خبر ============
function addNews(text, subtext){
  if(!G) return;
  if(!G.news) G.news = [];
  let fullText = subtext ? `${text}\n${subtext}` : text;
  if(!fullText.includes('\n')){
    let extra = '';
    if(text.includes('⚽')||text.includes('🥅')) extra = '📊 تابع الترتيب في تبويب الترتيب';
    else if(text.includes('🚑')||text.includes('🩹')) extra = '⚕️ راقب حالة لاعبيك قبل المباراة القادمة';
    else if(text.includes('💰')||text.includes('💼')) extra = '💼 إدارة الميزانية مهمة لاستمرار المسيرة';
    else if(text.includes('🏆')||text.includes('🌟')) extra = '🎉 إنجاز جديد في مسيرتك كمدرب';
    else if(text.includes('🟥')||text.includes('🟨')) extra = '📋 تأكد من توفر البدلاء للمباراة القادمة';
    else if(text.includes('⭐')||text.includes('📈')) extra = '📈 اللاعب في تطور مستمر';
    else if(text.includes('🔄')) extra = '🔄 تبديل مؤثر في سير المباراة';
    else if(text.includes('🎤')) extra = '🎤 تصريحات المدرب تؤثر على المعنويات';
    else if(text.includes('✍️')||text.includes('📋')) extra = '📋 تفاصيل العقد في صفحة اللاعب';
    else extra = `📅 الموسم ${G.season?.year||SEASON_YEAR} • اليوم ${G.season?.currentDay||0}`;
    fullText = text+'\n'+extra;
  }
  G.news.push({day:G.season?G.season.currentDay:0, season:G.season?G.season.year:SEASON_YEAR, text:fullText});
  if(G.news.length > 200) G.news.shift();
}

// ============ نافذة الانتقالات ============
function checkTransferWindow(day){
  if(!G || !G.season) return true;
  const d = day || G.season.currentDay;
  return (d>=1 && d<=60) || (d>=140 && d<=175);
}

// ============================================
// engine.js - محرك المباراة الكامل (Match class)
// ============================================

class Match {
  constructor(c){
    this.h = c.h; this.a = c.a; this.hu = c.human;
    this.compName = c.compName || 'الدوري';
    this.isDerby = isDerby(c.h.id, c.a.id);
    this.weather = c.weather || WEATHERS[0];
    this.momentum = 50;

    [c.h, c.a].forEach(t => {
      t.pt = hs(t.id)%3;
      t.gk = GKC[hs(t.id)%4];
    });

    const ct = (t, l, f, k) => {
      if(!FM[f]) f = '4-3-3';
      const slots = getSlots(f);
      const s = {
        t, f,
        g:0, subs:0, sh:0, co:0, ps:0, fl:0, yc:0, rc:0, off:0,
        tc: k==='home' ? (c.ht||'balanced') : (c.at||'balanced'),
        played:[],
        bn: t.ps
          .filter(p => !l.some(x=>x.id===p.id) && !p.susp && !p.injury)
          .sort((x,y)=>y.r-x.r)
          .slice(0,9)
          .map(p => ({
            ...p, ...playerAttrs(p),
            lvl: p.lvl||1,
            origId: p.id,
            st: p.fit!=null?p.fit:100,
            minSt: p.fit!=null?p.fit:100,
            goals:0, yc:0, rc:0,
            sk: hs(p.id)%9,
            inst:'normal'
          }))
      };

      s.on = l.map((p, index) => {
        const slot = slots[index] || {pos:p.pos, x:.5, y:.5};
        const isOOP = p.pos !== slot.pos && p.secPos !== slot.pos;
        let inst = 'normal';
        if(c.human === k && G && G.inst && G.inst[index]) inst = G.inst[index];
        let chem = 0;
        if(p.pos === slot.pos) chem += 2;
        else if(p.secPos === slot.pos) chem += 1;
        if(p.chemistry) chem += p.chemistry;

        return {
          ...p, ...playerAttrs(p),
          lvl: p.lvl||1,
          origId: p.id, k,
          dir: k==='home' ? 1 : -1,
          st: p.fit!=null?p.fit:100,
          minSt: p.fit!=null?p.fit:100,
          goals:0, yc:0, rc:0,
          sk: hs(p.id)%9,
          role: slot.pos, isOOP, chemistry: chem,
          slotX: slot.x, slotY: slot.y,
          inst,
          bx: (k==='home' ? slot.x : 1-slot.x) * L,
          by: slot.y * WD,
          x: (k==='home' ? slot.x : 1-slot.x) * L,
          y: slot.y * WD,
          vx:0, vy:0, dec:0, kick:0, mv:0, ph: R()*6,
          fc: k==='home' ? 1 : -1,
          stun:0,
          stats:{passes:0, tackles:0, shots:0}
        };
      });
      s.played = [...s.on];
      return s;
    };

    this.s = {
      home: ct(c.h, c.hl, c.hf, 'home'),
      away: ct(c.a, c.al, c.af, 'away')
    };
    this.effectiveRoles = this.computeEffectiveRoles();
    this.t = 0; this.min = 0; this.half = 1;
    this.inj1 = 1+Math.floor(R()*4);
    this.inj2 = 2+Math.floor(R()*5);
    this.done = false;
    this.log = [];
    this.fl = null;
    this.redCards = [];
    this.injuries = [];
    this.ball = {x:L/2, y:WD/2, z:0, vz:0, vx:0, vy:0, o:null, fl:null, lastTouch:'home', trail:[]};
    this.ref = {x:L/2, y:WD/2-8, fc:1};
    this.hold = 0; this.sc = null; this.rs = null; this.ag = null;

    const dt = this.isDerby ? '⚔️ ديربي! ' : '';
    this.say(0, 'info', `${dt}🏁 ${this.compName}: ${c.h.name} × ${c.a.name}`);
    if(this.effectiveRoles.captain){
      const cap = this.s[this.hu].on.find(p => p.origId === this.effectiveRoles.captain);
      if(cap) this.say(0, 'info', `👑 كابتن الفريق: ${cap.name}`);
    }
    this.rest('ko', 'home', L/2, WD/2);
  }

  computeEffectiveRoles(){
    const roster = this.s[this.hu].on;
    const roles = {};
    const resolve = (storedId, attrFn) => {
      if(storedId){
        const found = roster.find(p => p.origId === storedId);
        if(found) return storedId;
      }
      const best = [...roster].filter(p => p.role !== 'GK').sort((a,b) => attrFn(b)-attrFn(a))[0];
      return best ? best.origId : null;
    };
    roles.captain = resolve(G?.captain, p => p.r + p.lvl*2 + (p.morale||70)*0.15 + (p.physical||70)*0.1);
    roles.penaltyTaker = resolve(G?.penaltyTaker, p => (p.shooting||70)*1.0 + (p.dribbling||70)*0.15);
    roles.freeKickTaker = resolve(G?.freeKickTaker, p => (p.shooting||70)*0.6 + (p.passing||70)*0.4);
    roles.cornerTaker = resolve(G?.cornerTaker, p => (p.passing||70)*1.0 + (p.shooting||70)*0.2);
    return roles;
  }

  say(m, t, x){this.log.push({m, t, x})}
  all(){return [...this.s.home.on, ...this.s.away.on]}
  opp(k){return this.s[k==='home' ? 'away' : 'home']}
  banner(txt, ttl = 1.4){this.fl = {x:txt, ttl}}

  teamPower(k){
    const on = this.s[k].on;
    if(!on.length) return 1;
    let avg = on.reduce((a,p) => a+er(p), 0) / on.length;
    if(k === this.hu && this.effectiveRoles.captain){
      const cap = on.find(p => p.origId === this.effectiveRoles.captain);
      if(cap){
        const leadership = (cap.morale/100)*0.40 + (cap.lvl/10)*0.30 + (cap.r/100)*0.30;
        avg *= (1 + leadership*0.08);
      }
    }
    if(k === 'home') avg += 2;
    if(this.isDerby && k === 'home') avg += 2;
    const fmB = FM_STYLE[this.s[k].f] || FM_STYLE['4-3-3'];
    const tacB = TAC_STYLE[this.s[k].tc] || TAC_STYLE.balanced;
    avg *= (fmB.att*0.5 + fmB.def*0.5);
    const rp = (11-on.length)*4;
    return Math.pow(Math.max(45, avg-rp)/74, 3.2);
  }

  sub(k, oId, iId){
    const s = this.s[k];
    if(s.subs >= 5) return false;
    const oi = s.on.findIndex(p => p.id === oId);
    const ii = s.bn.findIndex(p => p.id === iId);
    if(oi < 0 || ii < 0) return false;
    const oP = s.on[oi], iP = s.bn[ii];
    Object.assign(iP, {
      k,
      dir: oP.dir,
      role: oP.role,
      isOOP: iP.pos !== oP.role && iP.secPos !== oP.role,
      slotX: oP.slotX, slotY: oP.slotY,
      inst: oP.inst,
      bx: oP.bx, by: oP.by, x: oP.x, y: oP.y,
      vx:0, vy:0, dec:.6, kick:0, mv:0, ph:0,
      fc: oP.fc, stun:0, minSt: iP.st
    });
    if(this.ball.o === oP) this.ball.o = iP;
    s.on[oi] = iP;
    s.played.push(iP);
    s.bn.splice(ii, 1);
    s.subs++;
    this.say(Math.floor(this.min), 'sub', `🔄 ${iP.name} ⬅️ ${oP.name}`);
    return true;
  }

  rest(type, k, x, y){
    if(this.ball.trail) this.ball.trail = [];
    Object.assign(this.ball, {x, y, z:0, vz:0, vx:0, vy:0, o:null, fl:null, lastTouch:k});
    const s = this.s[k], op = this.opp(k);
    let tk = s.on.find(p => p.role !== 'GK') || s.on[0];
    const isHuman = k === this.hu;

    if(type === 'gk') tk = s.on.find(p => p.role === 'GK') || tk;
    else if(type === 'pen'){
      if(isHuman && this.effectiveRoles.penaltyTaker){
        const spec = s.on.find(p => p.origId === this.effectiveRoles.penaltyTaker);
        if(spec) tk = spec;
        else tk = [...s.on].sort((a,b) => b.shooting-a.shooting)[0] || tk;
      } else {
        tk = [...s.on].sort((a,b) => b.shooting-a.shooting)[0] || tk;
      }
    } else if(type === 'fk'){
      if(isHuman && this.effectiveRoles.freeKickTaker){
        const spec = s.on.find(p => p.origId === this.effectiveRoles.freeKickTaker);
        if(spec) tk = spec;
        else tk = [...s.on].filter(p => p.role !== 'GK').sort((a,b) => Math.hypot(a.bx-x, a.by-y)-Math.hypot(b.bx-x, b.by-y))[0] || tk;
      } else {
        tk = [...s.on].filter(p => p.role !== 'GK').sort((a,b) => Math.hypot(a.bx-x, a.by-y)-Math.hypot(b.bx-x, b.by-y))[0] || tk;
      }
    } else if(type === 'co'){
      if(isHuman && this.effectiveRoles.cornerTaker){
        const spec = s.on.find(p => p.origId === this.effectiveRoles.cornerTaker);
        if(spec) tk = spec;
        else tk = [...s.on].filter(p => p.role !== 'GK').sort((a,b) => Math.hypot(a.bx-x, a.by-y)-Math.hypot(b.bx-x, b.by-y))[0] || tk;
      } else {
        tk = [...s.on].filter(p => p.role !== 'GK').sort((a,b) => Math.hypot(a.bx-x, a.by-y)-Math.hypot(b.bx-x, b.by-y))[0] || tk;
      }
    } else if(type === 'ti'){
      tk = [...s.on].filter(p => p.role !== 'GK').sort((a,b) => Math.hypot(a.bx-x, a.by-y)-Math.hypot(b.bx-x, b.by-y))[0] || tk;
    }

    this.rs = {type, k, x, y, tk, t: type==='pen' ? 1.5 : 1.0};
    this.all().forEach(p => {
      p.x = p.bx; p.y = p.by;
      p.mv = 0; p.stun = 0; p.vx = 0; p.vy = 0;
      if(p.role === 'FWD') p.x -= p.dir*8;
    });

    if(type === 'ko'){
      this.all().forEach(p => {
        if(p.dir > 0 && p.x > L/2-3) p.x = L/2-3-R()*4;
        if(p.dir < 0 && p.x < L/2+3) p.x = L/2+3+R()*4;
      });
    }

    if(type === 'co'){
      const gx = tk.dir > 0 ? L-9 : 9;
      s.on.filter(p => p !== tk).slice(0,5).forEach((p,i) => {
        p.x = gx+(R()-.5)*6;
        p.y = 20+i*5.5;
      });
      op.on.filter(p => p.role !== 'GK').slice(0,6).forEach((p,i) => {
        p.x = gx+(R()-.5)*5;
        p.y = 19+i*5;
      });
    } else if(type === 'pen'){
      const gx = tk.dir > 0 ? L : 0;
      const px = tk.dir > 0 ? L-11 : 11;
      x = px; y = 34;
      this.rs.x = x; this.rs.y = y;
      this.all().forEach(p => {
        if(p.role === 'GK' && p.k !== k){p.x = gx-tk.dir*.5; p.y = 34;}
        else if(p.role === 'GK'){p.x = p.bx; p.y = 34;}
        else {p.x = tk.dir > 0 ? L-22-R()*8 : 22+R()*8; p.y = 16+R()*36;}
      });
    }
    if(tk){tk.x = x; tk.y = y;}
  }

  exec(){
    const r = this.rs;
    this.rs = null;
    if(!r || !r.tk) return;
    const p = r.tk, k = r.k;
    this.ball.x = r.x; this.ball.y = r.y;
    this.ball.lastTouch = k;
    const isHuman = k === this.hu;

    if(r.type === 'pen'){this.shoot(p, 11, true, false); return;}

    if(r.type === 'co'){
      const gx = p.dir > 0 ? L-8 : 8;
      const t = this.s[k].on.filter(q => q !== p).sort((a,b) => Math.hypot(a.x-gx, a.y-34)-Math.hypot(b.x-gx, b.y-34))[0];
      if(t){
        const isCornerSpecialist = isHuman && p.origId === this.effectiveRoles.cornerTaker;
        this.pass(p, t, true, true, isCornerSpecialist);
        return;
      }
    }

    if(r.type === 'ti' || r.type === 'gk'){
      const t = this.s[k].on.filter(q => q !== p && q.role !== 'GK').sort((a,b) => Math.hypot(a.x-p.x, a.y-p.y)-Math.hypot(b.x-p.x, b.y-p.y))[0];
      if(t){this.pass(p, t, false, true); return;}
    }

    if(r.type === 'fk'){
      const gx = p.dir > 0 ? L : 0;
      const dg = Math.hypot(gx-p.x, 34-p.y);
      const isFKSpecialist = isHuman && p.origId === this.effectiveRoles.freeKickTaker;
      const shootChance = isFKSpecialist ? 0.80 : 0.60;
      if(dg < 30 && R() < shootChance){this.shoot(p, dg, false, isFKSpecialist); return;}
    }

    this.ball.o = p;
    p.dec = .7;
  }

  isOffside(pa, re){
    const dr = pa.dir;
    if((re.x-L/2)*dr <= 2) return false;
    if((re.x-pa.x)*dr <= 2) return false;
    const o = this.opp(pa.k).on.slice().sort((a,b) => (b.x*dr)-(a.x*dr));
    const sl = o[1] || o[0];
    return (re.x-sl.x)*dr > 2.2;
  }

  think(p){
    const k = p.k, dr = p.dir, gx = dr > 0 ? L : 0;
    const dg = Math.hypot(gx-p.x, 34-p.y);
    const role = p.role || p.pos;
    const fmB = FM_STYLE[this.s[k].f] || FM_STYLE['4-3-3'];
    const tacB = TAC_STYLE[this.s[k].tc] || TAC_STYLE.balanced;

    if(role === 'GK'){
      const vision = (p.passing/99)*0.6 + (p.defending/99)*0.4;
      const m = this.s[k].on.filter(q => q.role === 'DEF' || q.role === 'MID');
      const t = m[Math.floor(R()*m.length)] || this.s[k].on[1];
      this.pass(p, t, vision < 0.5, true);
      return;
    }

    let msd = role === 'FWD' ? 28 : (role === 'MID' ? 24 : 18);
    if(p.inst === 'attack') msd += 4;
    if(p.inst === 'defense') msd -= 4;
    if(p.inst === 'stayback') msd -= 8;
    if(p.inst === 'press') msd += 2;

    const cd = this.opp(k).on.filter(o => o.role !== 'GK' && Math.hypot(o.x-p.x, o.y-p.y) < 4.8 && (gx-o.x)*dr > 0);

    let shootWilling = role === 'FWD' ? 0.45 : 0.25;
    shootWilling += ((p.shooting/99)-0.5)*0.50;
    shootWilling += (p.dribbling/99-0.5)*0.15;
    shootWilling *= fmB.att*tacB.att;
    if(p.inst === 'attack') shootWilling += .15;
    if(p.inst === 'defense') shootWilling -= .15;
    if(p.inst === 'counter' && dg < 25) shootWilling += .10;
    if(p.inst === 'stayback') shootWilling -= .15;
    if(p.inst === 'press' && dg < 25) shootWilling += .05;
    shootWilling = Math.max(0.05, Math.min(0.88, shootWilling));

    if(dg < msd && (cd.length === 0 || R() < shootWilling)){this.shoot(p, dg); return;}

    if(dg < 34 && (p.y < 16 || p.y > WD-16) && R() < .6){
      const bm = this.s[k].on.filter(q => q !== p && Math.abs(gx-q.x) < 24 && !this.isOffside(p, q));
      if(bm.length){
        this.pass(p, bm[Math.floor(R()*bm.length)], true, true);
        return;
      }
    }

    const passPref = 0.40 + (p.passing/99)*0.50;
    const m = this.s[k].on.filter(q => q !== p && Math.hypot(q.x-p.x, q.y-p.y) < 38);
    const on = m.filter(q => !this.isOffside(p, q));
    const pool = (on.length > 0 && R() > .05) ? on : m;

    const sc = pool.map(q => {
      const no = this.opp(k).on.filter(o => Math.hypot(o.x-q.x, o.y-q.y) < 6.5).length;
      const fg = (q.x-p.x)*dr;
      const sp2 = no === 0 ? 15 : -no*12;
      const vision = (p.passing/99);
      return {q, score: fg*.6 + sp2 + (R()*8-4) + vision*3};
    }).sort((a,b) => b.score-a.score);

    const bm = sc[0];
    if(bm && (cd.length > 0 || R() < passPref)){
      const d = Math.hypot(bm.q.x-p.x, bm.q.y-p.y);
      this.pass(p, bm.q, d > 26, false);
    } else p.dec = .7+R()*.3;
  }

  pass(p, m, loft = false, noOff = false, isCorner = false){
    if(!m) return;
    const b = this.ball;
    b.o = null;
    b.lastTouch = p.k;
    p.stats.passes++;

    const vision = (p.passing/99)*0.70 + (p.dribbling/99)*0.30;
    const sk = vision*(.7+.3*(p.st/100));
    let accuracyBonus = 1;
    if(isCorner && p.origId === this.effectiveRoles.cornerTaker) accuracyBonus = 1.20;
    const err = Math.pow(1-sk, 1.4)*15*(1/this.weather.accuracy)/accuracyBonus;

    const lx = Math.max(3, Math.min(L-3, m.x + p.dir*1.2 + (R()-.5)*err));
    const ly = Math.max(3, Math.min(WD-3, m.y + (R()-.5)*err));

    if(!noOff && this.isOffside(p, m) && R() < .5){
      this.s[p.k].off++;
      const ok = p.k === 'home' ? 'away' : 'home';
      this.say(Math.floor(this.min), 'card', `🚩 تسلل على ${m.name}`);
      this.banner('🚩 تسلل!', 1.1);
      this.rest('fk', ok, m.x, m.y);
      return;
    }

    b.fl = {k: loft ? 'cross' : 'pass', tx:lx, ty:ly, sp: loft ? 20 : 24, pl:m, passer:p};
    b.vz = loft ? 12 : 1.2;
    p.kick = .4;
    p.fc = lx >= p.x ? 1 : -1;
  }

  shoot(p, dg, isPen = false, isFK = false){
    const b = this.ball, k = p.k, gx = p.dir > 0 ? L : 0;
    b.o = null;
    b.lastTouch = k;
    p.kick = .5;
    this.s[k].sh++;
    p.stats.shots++;

    if(!isPen){
      const bl = this.opp(k).on.find(q => q.role !== 'GK' && Math.hypot(q.x-p.x, q.y-p.y) < 4.5 && (gx-q.x)*p.dir > -.5);
      if(bl){
        const blockChance = tacklePower(bl)/Math.max(0.1, tacklePower(bl)+shootPower(p));
        if(R() < blockChance*0.65){
          bl.stats.tackles++;
          this.say(Math.floor(this.min), 'save', `🛡️ ${bl.name} يعترض تسديدة ${p.name}!`);
          if(R() < .35){
            this.s[k].co++;
            this.banner('🚩 ركنية');
            this.rest('co', k, p.dir > 0 ? L-.5 : .5, p.y > 34 ? WD-.5 : .5);
          } else {
            b.o = bl; b.lastTouch = bl.k; bl.dec = .55;
          }
          return;
        }
      }
    }

    let accMult = 1;
    if(isPen){accMult = 1.10; if(p.origId === this.effectiveRoles.penaltyTaker) accMult = 1.30;}
    else if(isFK){accMult = 1.10; if(p.origId === this.effectiveRoles.freeKickTaker) accMult = 1.35;}

    const acc = ((p.shooting/99)*(0.65+0.35*(p.dribbling/99)))*accMult;
    const powerFactor = 0.85+0.30*(p.physical/99);
    const df = isPen ? 0 : Math.max(0, (dg-9)*.4);
    const wp = isPen ? 1 : this.weather.accuracy;
    const spread = isPen ? 3.6 : (14-acc*6.5+df)/(wp*powerFactor);
    const ty = 34+(R()-.5)*spread;

    b.fl = {k:'shot', tx:gx, ty, sp: isPen ? 36 : 33, pl:p, isPen, dg};
    b.vz = R() < .35 ? 8 : 2.5;

    if(isPen){
      const suffix = p.origId === this.effectiveRoles.penaltyTaker ? ' (المتخصص)' : '';
      this.say(Math.floor(this.min), 'shot', `🥅 ${p.name}${suffix} يستعد للجزاء...`);
    } else if(isFK){
      const suffix = p.origId === this.effectiveRoles.freeKickTaker ? ' (المتخصص)' : '';
      this.say(Math.floor(this.min), 'shot', `🎯 ركلة حرة من ${p.name}${suffix}!`);
    } else {
      this.say(Math.floor(this.min), 'shot', '🚀 '+cmt('shot', p));
    }
  }

  foul(def, car){
    const dt = this.s[def.k], at = this.s[car.k];
    dt.fl++;
    const gx = car.dir > 0 ? L : 0;
    const ib = Math.abs(gx-car.x) < 16.5 && Math.abs(car.y-34) < 20.15;
    const sev = R()+(def.aggr||60)/260;

    if(sev > 1.22){
      def.rc = 1;
      dt.rc++;
      this.redCards.push({id:def.origId||def.id, teamId:dt.t.id});
      this.say(Math.floor(this.min), 'red', `🟥 طرد! ${def.name}`);
      this.banner(`🟥 طرد ${def.name}!`);
      playSound('card');
      dt.on = dt.on.filter(x => x !== def);
    } else if(sev > .82){
      def.yc++;
      dt.yc++;
      if(def.yc >= 2){
        def.rc = 1;
        dt.rc++;
        this.redCards.push({id:def.origId||def.id, teamId:dt.t.id});
        this.say(Math.floor(this.min), 'red', `🟨🟥 طرد ثاني ${def.name}!`);
        playSound('card');
        dt.on = dt.on.filter(x => x !== def);
      } else {
        this.say(Math.floor(this.min), 'card', `🟨 أصفر ${def.name}`);
        playSound('card');
      }
    } else {
      this.say(Math.floor(this.min), 'card', `🛑 خطأ لـ ${car.name}`);
    }

    if(R() < .03 && !car.injury){
      const sid = car.origId || car.id;
      this.injuries.push({id:sid, type:'إصابة', emoji:'🚑'});
      this.say(Math.floor(this.min), 'injury', `🚑 ${car.name} مصاب!`);
      if(at.subs < 5 && at.bn.length > 0){
        const rp = at.bn.find(b => b.pos === car.pos) || at.bn[0];
        if(rp) this.sub(car.k, car.id, rp.id);
      }
    }

    if(ib && R() < .32){
      this.say(Math.floor(this.min), 'goal', `🥅 ضربة جزاء لـ ${at.t.name}!`);
      this.banner('🥅 جزاء!');
      this.rest('pen', car.k, car.dir > 0 ? L-11 : 11, 34);
    } else {
      this.rest('fk', car.k, Math.max(18, Math.min(L-18, car.x)), car.y);
    }
  }

  land(f){
    this.ball.trail = [];
    const b = this.ball;
    b.fl = null;
    b.z = 0;
    b.vz = 0;

    if(f.k === 'shot'){
      const ok = f.pl.k === 'home' ? 'away' : 'home';
      const gk = this.s[ok].on.find(p => p.role === 'GK');
      const dy = Math.abs(b.y-34);

      if(dy >= 3.35 && dy <= 3.75){
        this.say(Math.floor(this.min), 'shot', `💥 العارضة!`);
        this.rest('gk', ok, ok === 'home' ? 5.5 : L-5.5, 34);
        return;
      }

      const ot = dy < 3.35;
      const gp = gk ? savePower(gk) : 0.6;
      const sp = shootPower(f.pl);
      const fmDef = FM_STYLE[this.s[ok].f]?.def || 1;
      const tacDef = TAC_STYLE[this.s[ok].tc]?.def || 1;
      const saveBonus = fmDef*tacDef;
      const db = f.isPen ? .5 : Math.min(2.4, Math.max(1, (f.dg||16)/10));
      const sc = (gp*db*saveBonus)/(gp*db*saveBonus+sp*.32);

      if(ot && R() > sc) this.goal(f.pl);
      else if(ot){
        if(gk) gk.dive = .5;
        if(R() < .45){
          this.s[f.pl.k].co++;
          this.say(Math.floor(this.min), 'save', `🧤 تألق الحارس!`);
          this.banner('🚩 ركنية');
          this.rest('co', f.pl.k, f.pl.dir > 0 ? L-.5 : .5, b.y > 34 ? WD-.5 : .5);
        } else {
          this.say(Math.floor(this.min), 'save', `🧤 الحارس يمسك`);
          this.rest('gk', ok, ok === 'home' ? 5.5 : L-5.5, 34);
        }
      } else {
        this.say(Math.floor(this.min), 'shot', `💨 تسديدة بعيدة`);
        this.rest('gk', ok, ok === 'home' ? 5.5 : L-5.5, 34);
      }
      return;
    }

    b.o = f.pl;
    b.x = f.pl.x;
    b.y = f.pl.y;
    f.pl.stun = 0;
    f.pl.dec = .6+R()*.4;
  }

  goal(p){
    if(!checkVAR()) return;
    const k = p.k;
    this.s[k].g++;
    p.goals = (p.goals||0)+1;
    this.say(Math.floor(this.min), 'goal', `⚽ جوووول! ${p.name} لـ ${this.s[k].t.name}!`);
    this.banner(`⚽ هدف! ${this.s[k].t.name}`, 2.0);
    this.sc = {p, k, ttl:1.8};
    this.ag = {k: k === 'home' ? 'away' : 'home', t:1.8};
    this.ball.o = null;
    this.ball.fl = null;
    this.ball.trail = [];
    playSound('goal');
    if(R() < .005 && !p.injury){
      this.injuries.push({id:p.origId||p.id, type:'إصابة', emoji:'🤕'});
      this.say(Math.floor(this.min), 'injury', `🤕 ${p.name} أصيب بالاحتفال!`);
    }
  }

  bounds(){
    const b = this.ball;
    const ok = b.lastTouch === 'home' ? 'away' : 'home';
    if(b.y < 0 || b.y > WD){
      const ty = b.y < 0 ? 1 : WD-1;
      const tx = Math.max(3, Math.min(L-3, b.x));
      b.fl = null;
      this.say(Math.floor(this.min), 'sub', `🤾 رمية تماس`);
      this.rest('ti', ok, tx, ty);
    } else if(b.x < 0 || b.x > L){
      b.fl = null;
      const le = b.x < 0;
      const dk = (this.half === 1) ? (le ? 'home' : 'away') : (le ? 'away' : 'home');
      if(b.lastTouch === dk){
        const ak = dk === 'home' ? 'away' : 'home';
        this.s[ak].co++;
        this.say(Math.floor(this.min), 'shot', `🚩 ركنية`);
        this.banner('🚩 ركنية');
        this.rest('co', ak, le ? .5 : L-.5, b.y > 34 ? WD-.5 : .5);
      } else {
        this.rest('gk', dk, le ? 5.5 : L-5.5, 34);
      }
    }
  }

  fly(dt){
    const b = this.ball, f = b.fl;
    const dx = f.tx-b.x, dy = f.ty-b.y, dd = Math.hypot(dx, dy);
    const drag = f.k === 'shot' ? 0.04 : (f.k === 'cross' ? 0.07 : 0.025);
    f.sp = Math.max(1, f.sp*(1-drag*dt));
    const step = f.sp*dt;

    b.vz = (b.vz||0) - 18*dt;
    const oldZ = b.z||0;
    b.z = Math.max(0, oldZ+b.vz*dt);
    if(b.z <= 0 && b.vz < 0 && oldZ > 0.1){
      b.vz = -b.vz*0.55;
      if(b.vz < 1) b.vz = 0;
      f.sp *= 0.85;
    }

    if(!b.trail) b.trail = [];
    b.trail.push({x:b.x, y:b.y, z:b.z});
    if(b.trail.length > 6) b.trail.shift();

    if(dd <= step){
      b.x = f.tx;
      b.y = f.ty;
      this.land(f);
      return;
    }

    b.x += (dx/dd)*step;
    b.y += (dy/dd)*step;

    if(f.k === 'pass' && b.z < 1.9){
      const op = this.opp(f.pl.k).on.find(q => q.role !== 'GK' && q.stun <= 0 && Math.hypot(q.x-b.x, q.y-b.y) < 2.5);
      if(op){
        const defSkill = tacklePower(op);
        const passSkill = f.passer ? Math.pow(((f.passer.passing*0.7+f.passer.dribbling*0.3)+(f.passer.lvl-1)*0.8)/74, 3.0) : 1;
        const ir = (defSkill/Math.max(0.1, passSkill))*0.5;
        if(R() < Math.min(.55, .32*ir)){
          op.stats.tackles++;
          b.fl = null;
          b.z = 0;
          b.o = op;
          b.lastTouch = op.k;
          op.dec = .65;
          return;
        }
      }
    }
    this.bounds();
  }

  aiManage(){
    ['home','away'].forEach(k => {
      if(k === this.hu) return;
      const s = this.s[k];
      if(this.min > 55 && s.subs < 4 && s.bn.length > 0 && R() < .015){
        const t = [...s.on].filter(p => p.role !== 'GK').sort((a,b) => a.st-b.st)[0];
        if(t && t.st < 80){
          const r = s.bn.find(b => b.pos === t.pos) || s.bn[0];
          if(r) this.sub(k, t.id, r.id);
        }
      }
    });
  }

  step(){
    if(this.done) return;
    const dt = .016;
    this.t += .25;
    this.min = this.t/60;

    if(this.fl){this.fl.ttl -= dt; if(this.fl.ttl <= 0) this.fl = null;}

    if(this.half === 1 && this.min >= 45+this.inj1){
      this.half = 2;
      this.t = 45*60;
      this.min = 45;
      this.say(45, 'info', '⏸️ نهاية الشوط الأول');
      this.all().forEach(p => {p.dir = -p.dir; p.bx = L-p.bx; p.by = WD-p.by;});
      this.rest('ko', 'away', L/2, WD/2);
      return;
    }

    if(this.half === 2 && this.min >= 90+this.inj2){
      this.done = true;
      this.say(90, 'info', '🏁 نهاية المباراة');
      this.banner('🏁 النهاية', 2.5);
      playSound('whistle');
      return;
    }

    if(this.sc){this.sc.ttl -= dt; if(this.sc.ttl <= 0) this.sc = null;}

    if(this.ag){
      this.ag.t -= dt;
      if(this.ag.t <= 0){
        const k = this.ag.k;
        this.ag = null;
        this.sc = null;
        this.rest('ko', k, L/2, WD/2);
      }
      return;
    }

    if(this.rs){
      this.rs.t -= dt;
      if(this.rs.t <= 0) this.exec();
      return;
    }

    this.aiManage();

    const b = this.ball;
    const s = this.s;
    const hm = s.home.sh*2+s.home.g*5+Math.round(s.home.ps/8);
    const am = s.away.sh*2+s.away.g*5+Math.round(s.away.ps/8);
    const tot = hm+am || 1;
    this.momentum = Math.round((hm/tot)*100);

    const rdx = (b.x-4*(b.x > L/2 ? 1 : -1))-this.ref.x;
    const rdy = (b.y > 34 ? b.y-10 : b.y+10)-this.ref.y;
    const rd = Math.hypot(rdx, rdy);
    if(rd > 1){
      this.ref.x += (rdx/rd)*Math.min(8, rd*2)*dt;
      this.ref.y += (rdy/rd)*Math.min(8, rd*2)*dt;
      this.ref.fc = rdx >= 0 ? 1 : -1;
    }

    if(b.o){
      const car = b.o;
      const dfs = this.opp(car.k).on.filter(q => q.role !== 'GK' && q.stun <= 0 && Math.hypot(q.x-car.x, q.y-car.y) < 2.8);
      if(dfs.length > 0){
        const d = dfs[0];
        const tr = this.teamPower(d.k)/this.teamPower(car.k);
        const defSkill = tacklePower(d);
        const attSkill = dribblePower(car);
        const skillRatio = defSkill/Math.max(0.1, attSkill);
        const dT = this.s[d.k].tc === 'defense' ? 1.30 : (this.s[d.k].tc === 'attack' ? .80 : 1);
        const pb = dfs.length > 1 ? 1.50 : 1;
        const tc = 0.24*skillRatio*Math.pow(tr, .6)*dT*pb;

        if(R() < .012*(d.aggr/75)){this.foul(d, car); return;}
        else if(R() < tc){
          d.stats.tackles++;
          b.o = d;
          b.lastTouch = d.k;
          d.dec = .65;
          car.stun = .85;
        } else {
          d.stun = .15;
          car.x -= car.dir*.12;
        }
      }
    }

    const bs = (b.x-L/2)*.4;
    const ws = this.weather.stamina;

    this.all().forEach(p => {
      const role = p.role || p.pos;
      if(p.kick > 0) p.kick = Math.max(0, p.kick-dt);
      if(p.dive > 0) p.dive = Math.max(0, p.dive-dt);
      if(p.stun > 0) p.stun = Math.max(0, p.stun-dt);

      const tc = this.s[p.k].tc;
      const tacB = TAC_STYLE[tc] || TAC_STYLE.balanced;
      const physFactor = 1.4-(p.physical/120);
      let instDrain = 1.0;
      if(p.inst === 'press') instDrain = 1.5;
      if(p.inst === 'counter') instDrain = 0.85;
      if(p.inst === 'stayback') instDrain = 0.75;
      const drainRate = 0.055*physFactor*tacB.staminaDrain*instDrain/ws;
      p.st = Math.max(15, p.st-dt*drainRate);
      if(p.st < p.minSt) p.minSt = p.st;

      const os = this.opp(p.k).on.slice().sort((a,c) => (c.x*p.dir)-(a.x*p.dir));
      const ol = (os[1] || os[0]).x;
      let ts = role === 'GK' ? 0 : (tc === 'attack' ? 6 : (tc === 'defense' ? -7 : (tc === 'counter' ? -3 : (tc === 'press' ? 5 : 0))))*p.dir;
      if(p.inst === 'attack') ts += 8*p.dir;
      if(p.inst === 'defense') ts -= 8*p.dir;
      if(p.inst === 'counter') ts -= 4*p.dir;
      if(p.inst === 'press') ts += 3*p.dir;
      if(p.inst === 'stayback') ts -= 15*p.dir;

      let tx = p.bx+ts+(role === 'GK' ? 0 : bs), ty = p.by;

      if(b.o === p){
        tx = p.x+p.dir*11;
        ty = p.y+(34-p.y)*.2;
        p.dec -= dt;
        if(p.dec <= 0) this.think(p);
      } else if(b.fl && b.fl.pl === p){
        p.stun = 0;
        tx = b.fl.tx;
        ty = b.fl.ty;
      } else if(b.o && b.o.k !== p.k && role !== 'GK'){
        const d = Math.hypot(b.o.x-p.x, b.o.y-p.y);
        if(d < 16 && p.stun <= 0){
          tx = b.o.x-b.o.dir*1.5;
          ty = b.o.y;
          if(p.inst === 'press') tx = b.o.x;
        } else if(role === 'DEF'){
          ty = p.by+(b.y-34)*.4;
        }
      } else if(b.o && b.o.k === p.k && role !== 'GK'){
        tx += p.dir*(role === 'MID' ? 6 : 4.5);
      }

      if(role === 'FWD' && b.o !== p && (!b.fl || b.fl.pl !== p)){
        if(p.inst !== 'defense' && p.inst !== 'stayback' && (tx-ol)*p.dir > -1) tx = ol-p.dir*1.5;
      }

      const dx = tx-p.x, dy = ty-p.y, dist = Math.hypot(dx, dy);
      if(p.vx === undefined) p.vx = 0;
      if(p.vy === undefined) p.vy = 0;

      if(dist > .3 && p.stun <= 0){
        const paceFactor = 0.6+0.4*(p.pace/99);
        const stFactor = 0.55+0.45*(p.st/100);
        const cp = b.o === p ? .82 : 1;
        const instSpeed = p.inst === 'press' ? 1.05 : 1;
        const maxSp = (3.5+4.8*(p.pace/99))*cp*stFactor*instSpeed;
        const dvx = (dx/dist)*maxSp-p.vx;
        const dvy = (dy/dist)*maxSp-p.vy;
        const accel = 22*dt;
        p.vx += Math.max(-accel, Math.min(accel, dvx));
        p.vy += Math.max(-accel, Math.min(accel, dvy));
        p.x += p.vx*dt;
        p.y += p.vy*dt;
        const spd = Math.hypot(p.vx, p.vy);
        p.mv = Math.min(1, spd/5);
        p.ph = (p.ph||0)+dt*spd*2.8;
        p.fc = p.vx >= 0 ? 1 : -1;
      } else {
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.mv = Math.min(1, Math.hypot(p.vx, p.vy)/5);
        p.ph = (p.ph||0)+dt*Math.hypot(p.vx, p.vy)*2.8;
      }

      p.x = Math.max(1.5, Math.min(L-1.5, p.x));
      p.y = Math.max(1.5, Math.min(WD-1.5, p.y));
    });

    if(b.fl) this.fly(dt);
    else if(b.o){
      const o = b.o;
      b.x = o.x+o.dir*.7;
      b.y = o.y;
      b.z = 0;
      this.s[o.k].ps++;
      this.bounds();
    }
  }
}

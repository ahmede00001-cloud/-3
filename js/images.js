// ============================================
// images.js - نظام صور اللاعبين والأندية (النسخة الاحترافية المستقلة)
// الإصدار: 2.0
// يعمل Offline + Online بدون أي أخطاء (404)
// ============================================

// ============================================
// 🛡️ 1. ألوان الأندية (لاستخدامها في رسم الشعارات)
// ============================================
const CLUB_COLORS = {
    'ahly':        { c1: '#c8102e', c2: '#ffffff' },
    'zamalek':     { c1: '#ffffff', c2: '#c8102e' },
    'pyramids':    { c1: '#1e40af', c2: '#fbbf24' },
    'ismaily':     { c1: '#f59e0b', c2: '#dc2626' },
    'masry':       { c1: '#16a34a', c2: '#ffffff' },
    'smouha':      { c1: '#0ea5e9', c2: '#ffffff' },
    'ittihad':     { c1: '#22c55e', c2: '#000000' },
    'future':      { c1: '#7c3aed', c2: '#ffffff' },
    'ceramica':    { c1: '#dc2626', c2: '#fbbf24' },
    'pharco':      { c1: '#0891b2', c2: '#ffffff' },
    'nbe':         { c1: '#1d4ed8', c2: '#f59e0b' },
    'enppi':       { c1: '#dc2626', c2: '#ffffff' },
    'talaea':      { c1: '#16a34a', c2: '#000000' },
    'gouna':       { c1: '#0ea5e9', c2: '#ffffff' },
    'contractors': { c1: '#f59e0b', c2: '#000000' },
    'dakhleya':    { c1: '#dc2626', c2: '#ffffff' },
    'baladeya':    { c1: '#22c55e', c2: '#fbbf24' },
    'zed':         { c1: '#1e40af', c2: '#ffffff' }
};

// ============================================
// 👤 2. صور اللاعبين (DiceBear API)
// ============================================
const AVATAR_STYLE_BY_POS = {
    'GK':  'personas',
    'DEF': 'bottts',
    'MID': 'adventurer',
    'FWD': 'lorelei'
};

const AVATAR_BASE = 'https://api.dicebear.com/7.x/';

const _avatarCache = new Map();

/**
 * توليد رابط صورة اللاعب
 */
function getPlayerAvatarUrl(player, size = 64) {
    if (!player) return '';
    const cacheKey = `p_${player.name}_${size}`;
    if (_avatarCache.has(cacheKey)) return _avatarCache.get(cacheKey);

    const seed = encodeURIComponent(player.name || player.id || 'unknown');
    const style = AVATAR_STYLE_BY_POS[player.pos] || 'adventurer';
    const bg = player.pos === 'GK' ? 'b6e3f4' :
               player.pos === 'DEF' ? 'ffd5dc' :
               player.pos === 'MID' ? 'c0aede' : 'ffdfbf';
    const url = `${AVATAR_BASE}${style}/svg?seed=${seed}&size=${size}&backgroundColor=${bg}`;

    _avatarCache.set(cacheKey, url);
    return url;
}

// ============================================
// 🎨 3. توليد شعارات احترافية للأندية (SVG Data URIs)
// ============================================
// نقوم برسم "درع" (Shield) احترافي لكل فريق يحتوي على الحرف الأول وألوان الفريق
// هذا يغني عن تحميل صور خارجية ويضمن عدم ظهور أخطاء

const _clubCache = new Map();

function generateClubShield(teamId, teamName) {
    if (_clubCache.has(teamId)) return _clubCache.get(teamId);

    const colors = CLUB_COLORS[teamId] || { c1: '#1e293b', c2: '#ffffff' };
    const initial = (teamName || '?').trim()[0] || '?';
    
    // تحديد لون النص بناءً على لون الخلفية (أبيض أو أسود)
    const textColor = colors.c2 === '#FFFFFF' ? '#FFFFFF' : '#000000';
    const outlineColor = colors.c1 === '#FFFFFF' ? '#000000' : '#FFFFFF';

    // رسم شكل الدرع بالـ SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M 50 5 L 90 20 L 90 50 C 90 80 50 95 50 95 C 50 95 10 80 10 50 L 10 20 Z" fill="${colors.c1}" stroke="${outlineColor}" stroke-width="4"/>
        <text x="50" y="55" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${initial}</text>
    </svg>`;
    
    // تحويل الـ SVG إلى Data URI لكي يعمل كصورة
    const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    _clubCache.set(teamId, dataUri);
    return dataUri;
}

/**
 * جلب شعار الفريق
 */
function getClubLogoUrl(teamId, teamName) {
    if (!teamId) return '';
    return generateClubShield(teamId, teamName);
}

/**
 * جلب ألوان الفريق
 */
function getClubColors(teamId) {
    return CLUB_COLORS[teamId] || { c1: '#1e293b', c2: '#ffffff' };
}

// ============================================
// 🎨 4. HTML Builders (الدوال التي تستخدمها الملفات الأخرى)
// ============================================

/**
 * HTML لصورة لاعب مع fallback للحرف الأول
 */
function playerAvatarHtml(player, size = 40, extraStyle = '') {
    if (!player) {
        return `<div style="width:${size}px; height:${size}px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; font-size:${Math.floor(size*0.4)}px;">⚽</div>`;
    }

    const initial = (player.name || '?').trim()[0] || '?';
    const url = getPlayerAvatarUrl(player, size * 2); // x2 للـ retina

    return `
        <div style="position:relative; width:${size}px; height:${size}px; border-radius:50%; overflow:hidden; background:#1e293b; flex-shrink:0; border:1px solid rgba(251,191,36,0.3); ${extraStyle}">
            <img src="${url}" alt="${player.name}"
                 loading="lazy"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-weight:bold;color:#fbbf24;font-size:${Math.floor(size*0.45)}px;\\'>${initial}</div>';"
                 style="width:100%; height:100%; object-fit:cover;">
        </div>
    `;
}

/**
 * HTML لشعار الفريق (يستخدم الدرع المولد تلقائياً)
 */
function clubBadgeHtml(teamId, teamName, size = 36) {
    const logoUrl = getClubLogoUrl(teamId, teamName);
    
    return `
        <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <img src="${logoUrl}" alt="${teamName}"
                 loading="lazy"
                 style="width:100%; height:100%; object-fit:contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
        </div>
    `;
}

// ============================================
// 🚀 5. التحميل المسبق (Performance)
// ============================================
function preloadLobbyImages() {
    if (typeof currentSlots === 'undefined' || !currentSlots || !currentSlots.length) return;

    currentSlots.forEach(slot => {
        // الصور تولد فوراً في الكاش، لكننا نجهزها هنا
        getClubLogoUrl(slot.team_id, slot.team_name);

        if (slot.team_snapshot && slot.team_snapshot.starters) {
            slot.team_snapshot.starters.forEach(p => {
                getPlayerAvatarUrl(p, 64);
            });
        }
    });
}

function preloadTeamPlayers(team) {
    if (!team || !team.ps) return;
    team.ps.forEach(p => {
        const img = new Image();
        img.src = getPlayerAvatarUrl(p, 64);
    });
}

// ============================================
// 🧹 6. تنظيف الكاش
// ============================================
function clearImageCache() {
    _avatarCache.clear();
    _clubCache.clear();
}

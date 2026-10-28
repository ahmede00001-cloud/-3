// ============================================
// images.js - نظام الصور والشعارات الحقيقية للأندية واللاعبين
// الإصدار: 4.0 (Real Logos + Auto Wikipedia Player Photos)
// ============================================

// ============================================
// 🛡️ 1. شعارات الأندية المصرية الـ 18 الحقيقية
// ============================================
const CLUB_LOGOS = {
    'ahly':        'https://upload.wikimedia.org/wikipedia/en/7/70/Al_Ahly_SC_logo.svg',
    'zamalek':     'https://upload.wikimedia.org/wikipedia/en/0/04/Zamalek_SC_logo.svg',
    'pyramids':    'https://upload.wikimedia.org/wikipedia/en/8/87/Pyramids_FC_logo.svg',
    'ismaily':     'https://upload.wikimedia.org/wikipedia/en/f/f6/Ismaily_SC_logo.png',
    'masry':       'https://upload.wikimedia.org/wikipedia/en/1/1a/Al_Masry_SC_logo.png',
    'smouha':      'https://upload.wikimedia.org/wikipedia/en/6/62/Smouha_SC_logo.png',
    'ittihad':     'https://upload.wikimedia.org/wikipedia/en/7/71/Al_Ittihad_Alexandria_Club_logo.png',
    'future':      'https://upload.wikimedia.org/wikipedia/en/b/ba/Modern_Future_FC_logo.png',
    'ceramica':    'https://upload.wikimedia.org/wikipedia/en/4/4e/Ceramica_Cleopatra_FC_logo.png',
    'pharco':      'https://upload.wikimedia.org/wikipedia/en/6/69/Pharco_FC_logo.png',
    'nbe':         'https://upload.wikimedia.org/wikipedia/en/0/07/National_Bank_of_Egypt_SC_logo.png',
    'enppi':       'https://upload.wikimedia.org/wikipedia/en/2/29/ENPPI_SC_logo.png',
    'talaea':      'https://upload.wikimedia.org/wikipedia/en/c/c5/Tala%27ea_El_Gaish_SC_logo.png',
    'gouna':       'https://upload.wikimedia.org/wikipedia/en/8/8c/El_Gouna_FC_logo.png',
    'contractors': 'https://upload.wikimedia.org/wikipedia/en/d/d4/Al_Mokawloon_Al_Arab_SC_logo.png',
    'dakhleya':    'https://upload.wikimedia.org/wikipedia/en/9/9e/El_Dakhleya_SC_logo.png',
    'baladeya':    'https://upload.wikimedia.org/wikipedia/en/5/53/Baladiyat_El_Mahalla_SC_logo.png',
    'zed':         'https://upload.wikimedia.org/wikipedia/en/a/a2/ZED_FC_logo.png'
};

// ألوان الأندية (تُستخدم لتصميم الدرع الاحتياطي في حال انقطاع الإنترنت أو فشل تحميل الشعار)
const CLUB_COLORS = {
    'ahly':        { c1: '#c8102e', c2: '#ffffff' },
    'zamalek':     { c1: '#ffffff', c2: '#c8102e' },
    'pyramids':    { c1: '#1e40af', c2: '#fbbf24' },
    'ismaily':     { c1: '#f59e0b', c2: '#1d4ed8' },
    'masry':       { c1: '#16a34a', c2: '#ffffff' },
    'smouha':      { c1: '#0ea5e9', c2: '#ffffff' },
    'ittihad':     { c1: '#22c55e', c2: '#ffffff' },
    'future':      { c1: '#dc2626', c2: '#1e293b' },
    'ceramica':    { c1: '#991b1b', c2: '#fbbf24' },
    'pharco':      { c1: '#ea580c', c2: '#ffffff' },
    'nbe':         { c1: '#15803d', c2: '#f59e0b' },
    'enppi':       { c1: '#1e3a8a', c2: '#ffffff' },
    'talaea':      { c1: '#b91c1c', c2: '#000000' },
    'gouna':       { c1: '#eab308', c2: '#000000' },
    'contractors': { c1: '#eab308', c2: '#15803d' },
    'dakhleya':    { c1: '#dc2626', c2: '#1e293b' },
    'baladeya':    { c1: '#dc2626', c2: '#ffffff' },
    'zed':         { c1: '#0f172a', c2: '#fbbf24' }
};

// ============================================
// 👤 2. قاعدة بيانات صور اللاعبين الحقيقية المباشرة
// ============================================
const PLAYER_PHOTOS = {
    // نجوم الأهلي والزمالك وبيراميدز والدوري المصري
    'محمد الشناوي': 'https://img.a.transfermarkt.technology/portrait/header/134572-1686129377.jpg',
    'الشناوي': 'https://img.a.transfermarkt.technology/portrait/header/134572-1686129377.jpg',
    'أحمد سيد زيزو': 'https://img.a.transfermarkt.technology/portrait/header/320722-1694609677.jpg',
    'زيزو': 'https://img.a.transfermarkt.technology/portrait/header/320722-1694609677.jpg',
    'إمام عاشور': 'https://img.a.transfermarkt.technology/portrait/header/624267-1694609493.jpg',
    'وسام أبو علي': 'https://img.a.transfermarkt.technology/portrait/header/591949-1713951110.jpg',
    'حسين الشحات': 'https://img.a.transfermarkt.technology/portrait/header/381715-1694609551.jpg',
    'علي معلول': 'https://img.a.transfermarkt.technology/portrait/header/133042-1686129612.jpg',
    'معلول': 'https://img.a.transfermarkt.technology/portrait/header/133042-1686129612.jpg',
    'محمد عبد المنعم': 'https://img.a.transfermarkt.technology/portrait/header/566146-1686129489.jpg',
    'عبد المنعم': 'https://img.a.transfermarkt.technology/portrait/header/566146-1686129489.jpg',
    'مروان عطية': 'https://img.a.transfermarkt.technology/portrait/header/718281-1694609521.jpg',
    'أفشة': 'https://img.a.transfermarkt.technology/portrait/header/344335-1686129712.jpg',
    'بيرسي تاو': 'https://img.a.transfermarkt.technology/portrait/header/312240-1686129788.jpg',
    'محمود كهربا': 'https://img.a.transfermarkt.technology/portrait/header/176053-1686129855.jpg',
    'كهربا': 'https://img.a.transfermarkt.technology/portrait/header/176053-1686129855.jpg',
    'شيكابالا': 'https://img.a.transfermarkt.technology/portrait/header/28463-1686130112.jpg',
    'عبد الله السعيد': 'https://img.a.transfermarkt.technology/portrait/header/66323-1686130222.jpg',
    'السعيد': 'https://img.a.transfermarkt.technology/portrait/header/66323-1686130222.jpg',
    'ناصر ماهر': 'https://img.a.transfermarkt.technology/portrait/header/424789-1686130315.jpg',
    'سيف الدين الجزيري': 'https://img.a.transfermarkt.technology/portrait/header/415108-1686130411.jpg',
    'الجزيري': 'https://img.a.transfermarkt.technology/portrait/header/415108-1686130411.jpg',
    'عمر جابر': 'https://img.a.transfermarkt.technology/portrait/header/146245-1686130519.jpg',
    'جابر': 'https://img.a.transfermarkt.technology/portrait/header/146245-1686130519.jpg',
    'رمضان صبحي': 'https://img.a.transfermarkt.technology/portrait/header/312017-1686130612.jpg',
    'مصطفى فتحي': 'https://img.a.transfermarkt.technology/portrait/header/308523-1686130715.jpg',
    'فيستون ماييلي': 'https://img.a.transfermarkt.technology/portrait/header/886122-1694610112.jpg',
    'إبراهيم عادل': 'https://img.a.transfermarkt.technology/portrait/header/664891-1686130811.jpg',
    'محمد صلاح': 'https://img.a.transfermarkt.technology/portrait/header/148455-1727337594.jpg',
    'عمر مرموش': 'https://img.a.transfermarkt.technology/portrait/header/445939-1724417155.jpg'
};

// صور DiceBear الواقعية كخطة بديلة
const AVATAR_STYLE_BY_POS = {
    'GK':  'avataaars',
    'DEF': 'avataaars',
    'MID': 'avataaars',
    'FWD': 'avataaars'
};
const AVATAR_BASE = 'https://api.dicebear.com/7.x/';
const _avatarCache = new Map();
const _clubCache = new Map();
const _wikiPending = new Set();

/**
 * توليد درع SVG احتياطي بألوان النادي في حال فشل تحميل الشعار الرسمي
 */
function getFallbackClubSvg(teamId, teamName) {
    const colors = CLUB_COLORS[teamId] || { c1: '#1e293b', c2: '#ffffff' };
    const initial = (teamName || '?').trim()[0] || '⚽';
    const textColor = colors.c1 === '#ffffff' ? '#c8102e' : '#ffffff';
    const outlineColor = '#fbbf24';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M 50 5 L 90 20 L 90 50 C 90 80 50 95 50 95 C 50 95 10 80 10 50 L 10 20 Z" fill="${colors.c1}" stroke="${outlineColor}" stroke-width="5"/>
        <path d="M 50 10 L 84 23 L 84 48 C 84 74 50 88 50 88 Z" fill="${colors.c2}" opacity="0.22"/>
        <text x="50" y="55" font-family="Cairo, Arial, sans-serif" font-size="38" font-weight="900" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${initial}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * البحث التلقائي الذكي في ويكيبيديا العربية عن الصورة الحقيقية لأي لاعب غير مسجل
 */
async function fetchWikiPlayerPhoto(playerName, imgElementId) {
    if (!playerName || PLAYER_PHOTOS[playerName] || _wikiPending.has(playerName)) return;
    _wikiPending.add(playerName);

    try {
        const query = encodeURIComponent(playerName + ' لاعب كرة قدم');
        const apiUrl = `https://ar.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrlimit=1&prop=pageimages&pithumbsize=200&format=json&origin=*`;
        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data && data.query && data.query.pages) {
            const pages = Object.values(data.query.pages);
            if (pages.length > 0 && pages[0].thumbnail && pages[0].thumbnail.source) {
                const realPhotoUrl = pages[0].thumbnail.source;
                PLAYER_PHOTOS[playerName] = realPhotoUrl;
                _avatarCache.clear(); // تحديث الكاش ليعتمد الصورة الحقيقية دائماً

                // تحديث الصورة في الشاشة فوراً إذا كانت معروضة حالياً
                const domImg = document.getElementById(imgElementId);
                if (domImg) {
                    domImg.src = realPhotoUrl;
                    domImg.style.objectFit = 'cover';
                }
            }
        }
    } catch (e) {
        // تجاهل الخطأ بهدوء والبقاء على الأفاتار البديل
    }
}

/**
 * توليد رابط صورة اللاعب (حقيقية أو بديلة)
 */
function getPlayerAvatarUrl(player, size = 64) {
    if (!player) return '';
    
    const cleanName = (player.name || '').trim();
    const cacheKey = `p_${cleanName}_${size}`;
    if (_avatarCache.has(cacheKey)) return _avatarCache.get(cacheKey);

    let url = '';

    // 1. البحث المباشر بالاسم الكامل أو المختصر في القائمة الحقيقية
    if (PLAYER_PHOTOS[cleanName]) {
        url = PLAYER_PHOTOS[cleanName];
    } 
    // 2. البحث بالـ ID
    else if (player.id && PLAYER_PHOTOS[player.id]) {
        url = PLAYER_PHOTOS[player.id];
    } 
    // 3. البحث الجزئي (إذا كان اسم اللاعب مركباً)
    else {
        const matchedKey = Object.keys(PLAYER_PHOTOS).find(k => cleanName.includes(k) || k.includes(cleanName));
        if (matchedKey) {
            url = PLAYER_PHOTOS[matchedKey];
        } else {
            // 4. توليد أفاتار رياضي بديل ريثما يجلبه باحث ويكيبيديا التلقائي
            const seed = encodeURIComponent(cleanName || player.id || 'player');
            const style = AVATAR_STYLE_BY_POS[player.pos] || 'avataaars';
            const bg = player.pos === 'GK' ? 'b6e3f4' :
                       player.pos === 'DEF' ? 'ffd5dc' :
                       player.pos === 'MID' ? 'c0aede' : 'ffdfbf';
            url = `${AVATAR_BASE}${style}/svg?seed=${seed}&size=${size}&backgroundColor=${bg}`;
        }
    }

    _avatarCache.set(cacheKey, url);
    return url;
}

/**
 * توليد شعار النادي (حقيقي مع بديل جاهز)
 */
function getClubLogoUrl(teamId, teamName) {
    if (!teamId) return getFallbackClubSvg('default', teamName);
    if (_clubCache.has(teamId)) return _clubCache.get(teamId);

    const url = CLUB_LOGOS[teamId] || getFallbackClubSvg(teamId, teamName);
    _clubCache.set(teamId, url);
    return url;
}

// ============================================
// 🎨 3. دوال بناء الـ HTML الجاهزة للواجهة
// ============================================

function playerAvatarHtml(player, size = 40, extraStyle = '') {
    if (!player) {
        return `<div style="width:${size}px; height:${size}px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; font-size:${Math.floor(size*0.4)}px;">⚽</div>`;
    }

    const cleanName = (player.name || '?').trim();
    const initial = cleanName[0] || '?';
    const url = getPlayerAvatarUrl(player, size * 2); 
    const isRealPhoto = !!PLAYER_PHOTOS[cleanName] || (player.id && !!PLAYER_PHOTOS[player.id]) || url.includes('transfermarkt') || url.includes('wikimedia');
    
    const fitStyle = isRealPhoto ? 'object-fit: cover; border-radius: 50%;' : 'object-fit: contain;';
    const uniqueImgId = 'pimg_' + Math.random().toString(36).substring(2, 9);

    // إذا لم تكن له صورة حقيقية محفوظة، ابحث عنها تلقائياً في الخلفية عبر ويكيبيديا
    if (!isRealPhoto && cleanName.length > 2 && !cleanName.startsWith('لاعب')) {
        setTimeout(() => fetchWikiPlayerPhoto(cleanName, uniqueImgId), 50);
    }

    return `
        <div style="position:relative; width:${size}px; height:${size}px; border-radius:50%; overflow:hidden; background:#1e293b; flex-shrink:0; border:1.5px solid rgba(251,191,36,0.5); box-shadow:0 2px 6px rgba(0,0,0,0.4); ${extraStyle}">
            <img id="${uniqueImgId}" src="${url}" alt="${cleanName}"
                 loading="lazy"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-weight:bold;color:#fbbf24;font-size:${Math.floor(size*0.45)}px;\\'>${initial}</div>';"
                 style="width:100%; height:100%; ${fitStyle}">
        </div>
    `;
}

function clubBadgeHtml(teamId, teamName, size = 36) {
    const logoUrl = getClubLogoUrl(teamId, teamName);
    const fallbackSvg = getFallbackClubSvg(teamId, teamName);
    
    return `
        <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <img src="${logoUrl}" alt="${teamName}"
                 loading="lazy"
                 onerror="this.onerror=null; this.src='${fallbackSvg}';"
                 style="width:100%; height:100%; object-fit:contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
        </div>
    `;
}

function clearImageCache() {
    _avatarCache.clear();
    _clubCache.clear();
}

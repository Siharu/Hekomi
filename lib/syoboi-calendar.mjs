export function syoboiField(record, name) {
  if (!record || typeof record !== 'object') return undefined;
  const wanted = String(name).toLowerCase();
  for (const [key, value] of Object.entries(record)) {
    const canonical = String(key).toLowerCase().split(':').at(-1);
    if (canonical === wanted) return value;
  }
  return undefined;
}

export function syoboiRows(value) {
  if (Array.isArray(value)) {
    return value.map(entry => {
      if (Array.isArray(entry) && entry.length >= 2 && entry[1] && typeof entry[1] === 'object') {
        return { _key: entry[0], ...entry[1] };
      }
      return entry;
    }).filter(item => item && typeof item === 'object' && !Array.isArray(item));
  }
  if (!value || typeof value !== 'object') return [];
  if (syoboiField(value, 'TID') != null || syoboiField(value, 'PID') != null) return [value];
  return Object.entries(value).map(([id, item]) => {
    if (Array.isArray(item) && item.length >= 2 && item[1] && typeof item[1] === 'object') {
      return { _key: id, ...item[1] };
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) return { _key: id, ...item };
    return null;
  }).filter(Boolean);
}

// RSS2 JSON variants have appeared as arrays, keyed maps, or nested feed payloads.
// Walk the response and keep only actual broadcast rows (both PID and TID).
export function extractSyoboiProgramRows(payload) {
  const rows = [];
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (!value || depth > 6) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, depth + 1);
      return;
    }
    if (typeof value !== 'object') return;
    const pid = syoboiField(value, 'PID');
    const tid = syoboiField(value, 'TID');
    if (pid != null && tid != null) {
      const key = String(pid);
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(value);
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object' && !Array.isArray(child) &&
          syoboiField(child, 'TID') != null && syoboiField(child, 'PID') == null) {
        const candidate = { _key: key, ...child };
        if (syoboiField(candidate, 'PID') != null) visit(candidate, depth + 1);
        else visit(child, depth + 1);
      } else {
        visit(child, depth + 1);
      }
    }
  };
  visit(payload);
  return rows;
}

export function parseSyoboiDate(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (/^\d{9,13}$/.test(raw)) {
    const number = Number(raw);
    const date = new Date(raw.length <= 10 ? number * 1000 : number);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})[_T ]?(\d{2})(\d{2})(\d{2})?$/);
  if (compact) {
    const [, y, m, d, h, minute, second = '0'] = compact;
    const parts = [Number(y), Number(m), Number(d), Number(h), Number(minute), Number(second)];
    if (parts[1] < 1 || parts[1] > 12 || parts[2] < 1 || parts[2] > 31 ||
        parts[3] > 47 || parts[4] > 59 || parts[5] > 59) return null;
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3] - 9, parts[4], parts[5]));
  }
  const separated = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (separated) {
    const [, y, m, d, h, minute, second = '0'] = separated;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h) - 9, Number(minute), Number(second)));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function applyAniListAiringFallback(programs, airingAnime, toleranceSeconds = 300) {
  const candidates = (Array.isArray(airingAnime) ? airingAnime : []).map(media => {
    const next = media && media.nextAiringEpisode || {};
    const airingAt = Number(next.airingAt);
    const episode = Number(next.episode);
    return {
      media,
      airingAt,
      episode: Number.isFinite(episode) && episode > 0 ? episode : null
    };
  }).filter(item => Number.isFinite(item.airingAt) && item.airingAt > 0);

  return (Array.isArray(programs) ? programs : []).map(program => {
    if (!program || !program.titleUnavailable) return program;
    const targetAt = Date.parse(program.airingAt || '');
    if (!Number.isFinite(targetAt)) return program;
    const targetSeconds = targetAt / 1000;
    const targetEpisode = Number(program.episode);
    const matches = candidates.filter(candidate => {
      const difference = Math.abs(candidate.airingAt - targetSeconds);
      if (difference > toleranceSeconds) return false;
      if (Number.isFinite(targetEpisode) && targetEpisode > 0 &&
          candidate.episode && candidate.episode !== targetEpisode) return false;
      return true;
    });
    // Do not guess when multiple AniList series share a similar slot.
    if (matches.length !== 1) return program;

    const media = matches[0].media;
    const title = String(
      media.titleEnglish || media.title || media.titleRomaji || media.titleNative || ''
    ).trim();
    if (!title) return program;
    const anilistId = Number(media.id) || null;
    const malId = Number(media.idMal) || null;
    return {
      ...program,
      title,
      shortTitle: String(media.titleRomaji || media.titleNative || program.shortTitle || ''),
      titleUnavailable: false,
      metadataSource: 'AniList',
      anilistId,
      malId,
      cover: String(media.cover || ''),
      url: media.siteUrl || (anilistId ? 'https://anilist.co/anime/' + anilistId : program.url)
    };
  });
}

function normalizeAniListTitle(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}\s]+/gu, '').trim();
}

export function applyAniListTitleMetadata(programs, anime) {
  const catalogue = (Array.isArray(anime) ? anime : []).map(media => {
    const aliases = [
      media && media.title,
      media && media.titleEnglish,
      media && media.titleRomaji,
      media && media.titleNative,
      ...(Array.isArray(media && media.synonyms) ? media.synonyms : [])
    ].map(normalizeAniListTitle).filter(Boolean);
    return { media, aliases: [...new Set(aliases)] };
  }).filter(entry => entry.aliases.length);

  return (Array.isArray(programs) ? programs : []).map(program => {
    if (!program) return program;
    const keys = [program.title, program.shortTitle].map(normalizeAniListTitle).filter(Boolean);
    if (!keys.length) return program;
    const matches = catalogue.filter(entry => entry.aliases.some(alias => keys.includes(alias)));
    // A title collision is not enough evidence to attach the wrong cover/profile.
    if (matches.length !== 1) return program;

    const media = matches[0].media;
    const anilistId = Number(media.id) || null;
    const malId = Number(media.idMal) || null;
    const displayTitle = String(
      media.titleEnglish || media.titleRomaji || media.title || media.titleNative || program.title || ''
    ).trim();
    if (!displayTitle) return program;

    return {
      ...program,
      sourceTitle: program.sourceTitle || program.title,
      title: displayTitle,
      shortTitle: String(media.titleRomaji || media.titleNative || program.shortTitle || ''),
      titleUnavailable: false,
      metadataSource: 'AniList',
      anilistId,
      malId,
      cover: String(media.cover || program.cover || ''),
      animeUrl: anilistId ? '/series/anime/' + anilistId + '-' +
        displayTitle.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) : '',
      siteUrl: String(media.siteUrl || (anilistId ? 'https://anilist.co/anime/' + anilistId : ''))
    };
  });
}

export function syoboiDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value || '00';
  return part('year') + '-' + part('month') + '-' + part('day');
}

export function normalizeSyoboiPrograms(programRows, titleRows = [], feedRows = [], now = new Date()) {
  const titles = new Map(syoboiRows(titleRows).map(item => {
    const tid = String(syoboiField(item, 'TID') ?? item._key ?? '');
    return [tid, item];
  }).filter(([tid]) => tid));

  const feedByPid = new Map();
  const feedByTidAndTime = new Map();
  for (const item of extractSyoboiProgramRows(feedRows)) {
    const pid = String(syoboiField(item, 'PID') ?? '');
    const tid = String(syoboiField(item, 'TID') ?? '');
    const st = String(syoboiField(item, 'StTime') ?? syoboiField(item, 'StTimeU') ?? '');
    if (pid) feedByPid.set(pid, item);
    if (tid && st) feedByTidAndTime.set(tid + ':' + st, item);
  }

  return syoboiRows(programRows).map(item => {
    const pid = String(syoboiField(item, 'PID') ?? '');
    const tid = String(syoboiField(item, 'TID') ?? '');
    const itemStart = syoboiField(item, 'StTime') ?? syoboiField(item, 'StTimeU');
    const feed = feedByPid.get(pid) ||
      feedByTidAndTime.get(tid + ':' + String(itemStart ?? '')) || {};
    const title = titles.get(tid) || {};
    const startAt = parseSyoboiDate(itemStart) ||
      parseSyoboiDate(syoboiField(feed, 'StTime') ?? syoboiField(feed, 'StTimeU'));
    if (!startAt) return null;

    const titleName = syoboiField(title, 'Title') ||
      syoboiField(title, 'ShortTitle') ||
      syoboiField(item, 'Title') ||
      syoboiField(feed, 'Title') ||
      syoboiField(feed, 'ShortTitle') ||
      'Anime broadcast' + (tid ? ' #' + tid : pid ? ' #' + pid : '');
    const episodeRaw = syoboiField(item, 'Count') ?? syoboiField(feed, 'Count');
    const episodeNumber = Number(episodeRaw);
    const category = Number(syoboiField(title, 'Cat') ?? syoboiField(item, 'Cat') ?? syoboiField(feed, 'Cat'));
    const year = syoboiField(title, 'FirstYear');
    const month = syoboiField(title, 'FirstMonth');
    return {
      id: pid || tid + '-' + String(itemStart ?? ''),
      tid: Number(tid) || null,
      title: String(titleName),
      shortTitle: String(syoboiField(title, 'ShortTitle') || syoboiField(feed, 'ShortTitle') || ''),
      titleUnavailable: /^Anime broadcast(?: #|$)/.test(String(titleName)),
      episode: Number.isFinite(episodeNumber) && episodeNumber > 0 ? episodeNumber : null,
      subtitle: String(
        syoboiField(item, 'SubTitle2') || syoboiField(item, 'SubTitle') ||
        syoboiField(feed, 'SubTitleB') || syoboiField(feed, 'SubTitleA') || ''
      ),
      channel: String(syoboiField(item, 'ChName') || syoboiField(feed, 'ChName') || ''),
      firstAired: year && month ? String(year) + '-' + String(month).padStart(2, '0') : null,
      firstEnded: syoboiField(title, 'FirstEndYear') && syoboiField(title, 'FirstEndMonth')
        ? String(syoboiField(title, 'FirstEndYear')) + '-' + String(syoboiField(title, 'FirstEndMonth')).padStart(2, '0')
        : null,
      listingType: category === 10 ? 'REBROADCAST' : category === 7 ? 'OVA' : category === 2 ? 'MOVIE' : 'TV',
      isPremiere: Number.isFinite(episodeNumber) && episodeNumber === 1 && category !== 10,
      date: syoboiDateKey(startAt),
      airingAt: startAt.toISOString(),
      time: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(startAt),
      status: startAt.getTime() > now.getTime() ? 'upcoming' : 'aired',
      category: Number.isFinite(category) ? category : null,
      url: Number(tid) > 0 ? 'https://cal.syoboi.jp/tid/' + Number(tid) : 'https://cal.syoboi.jp/'
    };
  }).filter(Boolean).sort((a, b) => a.airingAt.localeCompare(b.airingAt));
}

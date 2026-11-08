import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { enrichSyoboiPrograms, extractSyoboiProgramRows, normalizeSyoboiPrograms, syoboiAniListSearchTerms, syoboiField, syoboiRows } from './lib/syoboi-calendar.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const USER_AGENT = 'Hekomi/1.0 (personal manga reader; rate-limited public-source requests)';
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json; charset=utf-8' };
const rate = new Map();
const require = createRequire(import.meta.url);
const axios = require('axios');
const { Batoto, MangaBuddy, Mangakakalot } = require('mangascrape');
axios.defaults.headers.common['User-Agent'] = USER_AGENT;
axios.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5';
// Let established manga providers perform ordinary redirects, but only within known
// provider domains. Generic user-submitted URLs use fetchLimited() with per-hop URL
// validation instead of this Axios client.
const MANGA_SOURCE_REDIRECT_ROOTS = [
  'fto.to','bato.to','bato.si','batotoo.com',
  'mangabuddy.com','mangakakalot.com','mangakakalot.tv',
  'chapmanganato.to','manganato.com','manganato.to'
];
axios.defaults.maxRedirects = 4;
axios.defaults.beforeRedirect = options => {
  const protocol = String(options.protocol || '').toLowerCase();
  const hostname = String(options.hostname || options.host || '').toLowerCase().replace(/\.$/, '');
  const port = String(options.port || '');
  const approvedHost = MANGA_SOURCE_REDIRECT_ROOTS.some(root => hostname === root || hostname.endsWith('.' + root));
  const approvedPort = !port || (protocol === 'https:' && port === '443') || (protocol === 'http:' && port === '80');
  if (!['http:','https:'].includes(protocol) || !approvedHost || !approvedPort || options.username || options.password) {
    throw new Error('Manga provider redirected outside its verified public domain.');
  }
};
const mangaScrapeAdapters = {
  batoto: new Batoto({ baseUrl:'https://fto.to', cache:false }),
  mangabuddy: new MangaBuddy({ cache:false }),
  mangakakalot: new Mangakakalot({ cache:false }),
  // JSON APIs are handled here rather than via HTML page scraping.
  mangahook: { cache:false },
  gomanga: { cache:false },
  mangadex: { cache:false }
};
const MANGAHOOK_API_BASE = 'https://mangahook-api.vercel.app';
const GOMANGA_API_BASE = 'https://gomanga-api.vercel.app';
const MANGADEX_API_BASE = 'https://api.mangadex.org';
const mangaScrapeFeedCache = new Map();
const mangaScrapeLastRequest = new Map();
const MANGASCRAPE_SOURCES = {
  batoto: { label:'Bato network', origin:'https://fto.to', allowedHosts:['fto.to'] },
  mangabuddy: { label:'MangaBuddy', origin:'https://mangabuddy.com', allowedHosts:['mangabuddy.com'] },
  mangakakalot: { label:'Mangakakalot', origin:'https://mangakakalot.com', allowedHosts:['mangakakalot.com','chapmanganato.to'] },
  mangahook: { label:'Manga Hook API', origin:MANGAHOOK_API_BASE, allowedHosts:['mangahook-api.vercel.app'] },
  gomanga: { label:'GoManga API', origin:GOMANGA_API_BASE, allowedHosts:['gomanga-api.vercel.app'] },
  mangadex: { label:'MangaDex', origin:MANGADEX_API_BASE, allowedHosts:['api.mangadex.org','uploads.mangadex.org','mangadex.network'] }
};

function send(res, status, payload, headers={}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers });
  res.end(body);
}
function readBody(req, maxBytes=24_000) {
  return new Promise((resolve, reject) => {
    let data='';
    req.on('data', chunk => { data += chunk; if (data.length > maxBytes) { reject(new Error('Request too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function isPrivateIPv4(ip) {
  const a = ip.split('.').map(Number); if (a.length !== 4 || a.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  return a[0] === 0 || a[0] === 10 || a[0] === 127 || a[0] >= 224 ||
    (a[0] === 169 && a[1] === 254) || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && a[1] === 168) || (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
    (a[0] === 192 && a[1] === 0) || (a[0] === 198 && (a[1] === 18 || a[1] === 19));
}
function isPrivateIPv6(ip) {
  const s = ip.toLowerCase();
  return s === '::' || s === '::1' || s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb') || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('ff') || s.startsWith('::ffff:127.') || s.startsWith('::ffff:10.') || s.startsWith('::ffff:192.168.');
}
async function validatePublicUrl(raw) {
  let u; try { u = new URL(raw); } catch { throw new Error('Enter a valid website URL.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only HTTP and HTTPS websites are supported.');
  if (u.username || u.password) throw new Error('URLs containing usernames or passwords are not supported.');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Local and private network addresses cannot be crawled.');
  if (net.isIP(host)) {
    if (net.isIPv4(host) ? isPrivateIPv4(host) : isPrivateIPv6(host)) throw new Error('Private or reserved IP addresses cannot be crawled.');
  } else {
    let results; try { results = await dns.lookup(host, { all:true, verbatim:true }); } catch { throw new Error('The website hostname could not be resolved.'); }
    if (!results.length || results.some(r => net.isIPv4(r.address) ? isPrivateIPv4(r.address) : isPrivateIPv6(r.address))) throw new Error('The hostname resolves to a private or reserved address, so it was blocked.');
  }
  u.hash = '';
  return u;
}
async function fetchLimited(url, maxRedirects=4, maxBytes=2_000_000) {
  let current = await validatePublicUrl(url);
  for (let i=0; i<=maxRedirects; i++) {
    const response = await fetch(current, { method:'GET', redirect:'manual', signal:AbortSignal.timeout(12000), headers:{ 'User-Agent':USER_AGENT, 'Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' } });
    if ([301,302,303,307,308].includes(response.status)) {
      const loc = response.headers.get('location');
      if (!loc || i === maxRedirects) throw new Error('Too many or invalid redirects.');
      current = await validatePublicUrl(new URL(loc, current).href); continue;
    }
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
    const type = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) throw new Error('This URL did not return an HTML page.');
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > maxBytes) throw new Error('Page is too large to inspect safely.');
    const reader = response.body.getReader(); const chunks=[]; let size=0;
    while (true) { const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>maxBytes){reader.cancel();throw new Error('Page exceeded the 2 MB inspection limit.');} chunks.push(value); }
    return { url:current.href, html:new TextDecoder('utf-8').decode(Buffer.concat(chunks)) };
  }
  throw new Error('Could not follow website redirects.');
}
function decodeEntities(s='') {
  return s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}
function cleanText(s='') { return decodeEntities(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\\u[\da-f]{4}/gi,' ')).replace(/\s+/g,' ').trim(); }
function attr(tag, name) { const re = new RegExp("(?:^|\\s)"+name+"\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i"); const m=tag.match(re); return m ? decodeEntities(m[2]).trim() : ''; }
function meta(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const t of tags) { const k=attr(t,'property') || attr(t,'name') || attr(t,'itemprop'); if (k.toLowerCase()===key.toLowerCase()) return attr(t,'content'); }
  return '';
}
function robotsAllowed(url, robotsText) {
  // Practical robots.txt parser: honor wildcard user-agent group and our declared crawler name.
  let groups=[], group={agents:[],rules:[]};
  for (const line of robotsText.split(/\r?\n/)) {
    const clean=line.split('#')[0].trim(); if(!clean) continue;
    const m=clean.match(/^([^:]+):\s*(.*)$/); if(!m) continue;
    const key=m[1].trim().toLowerCase(), val=m[2].trim();
    if(key==='user-agent') { if(group.rules.length) { groups.push(group); group={agents:[],rules:[]}; } group.agents.push(val.toLowerCase()); }
    else if(['allow','disallow'].includes(key) && group.agents.length && val) group.rules.push({allow:key==='allow',path:val});
    else if(key==='crawl-delay' && group.agents.length) group.delay=Number(val)||0;
  }
  if(group.agents.length) groups.push(group);
  let best=groups.filter(g=>g.agents.some(a=>a!=='*' && USER_AGENT.toLowerCase().includes(a))).sort((a,b)=>Math.max(...b.agents.map(x=>x.length))-Math.max(...a.agents.map(x=>x.length)))[0];
  if(!best) best=groups.find(g=>g.agents.includes('*'));
  if(!best) return {allowed:true, delay:0};
  const pathToTest=url.pathname+url.search;
  const matches=best.rules.filter(r=>pathToTest.startsWith(r.path)).sort((a,b)=>b.path.length-a.path.length);
  if(!matches.length) return {allowed:true, delay:best.delay||0};
  return {allowed:matches[0].allow, delay:best.delay||0};
}
function mangaScrapeProvider(raw) {
  const key = String(raw || '').trim().toLowerCase();
  const source = MANGASCRAPE_SOURCES[key];
  const adapter = mangaScrapeAdapters[key];
  if (!source || !adapter) throw new Error('Choose one of the supported MangaScrape sources.');
  return { key, source, adapter };
}
function mangaScrapeQuery(raw) {
  const query = String(raw || '').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[?#&=]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 100);
  if (query.length < 2) throw new Error('Enter a manga title with at least two characters.');
  return query;
}
function mangaScrapeId(raw) {
  const id = String(raw || '').trim();
  if (!id || id.length > 180 || !/^[\p{L}\p{N}_-]+$/u.test(id)) {
    throw new Error('The source returned an invalid manga ID.');
  }
  return id;
}
function mangaScrapeCleanId(provider, raw) {
  let id = mangaScrapeId(raw);
  if (provider === 'mangadex' && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    throw new Error('MangaDex returned an invalid manga or chapter ID.');
  }
  // The Manga List endpoint prefixes some IDs with "1"; the detail API expects the raw ID.
  if (provider === 'mangahook' && id.startsWith('1manga-')) id = id.slice(1);
  return id;
}
function mangaScrapeSourceKind(provider, raw) {
  if (provider !== 'mangakakalot') return '';
  return raw === 'chapmanganato' ? 'chapmanganato' : 'mangakakalot';
}
function mangaScrapeSearchUrl(provider, query) {
  if (provider === 'mangahook') return MANGAHOOK_API_BASE + '/api/search/' + encodeURIComponent(query) + '?page=1';
  if (provider === 'gomanga') return GOMANGA_API_BASE + '/api/search/' + encodeURIComponent(query);
  if (provider === 'batoto') return 'https://fto.to/v3x-search?word=' + encodeURIComponent(query);
  if (provider === 'mangabuddy') return 'https://mangabuddy.com/search?q=' + encodeURIComponent(query);
  if (provider === 'mangakakalot') {
    const pathQuery = query.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!pathQuery) throw new Error('Use an English or numeric title for this provider search.');
    return 'https://mangakakalot.com/search/story/' + pathQuery;
  }
  throw new Error('This provider does not have a working search adapter.');
}
function mangaScrapeTitleUrl(provider, id, rawSourceKind) {
  const safeId = mangaScrapeCleanId(provider, id);
  const sourceKind = mangaScrapeSourceKind(provider, rawSourceKind);
  if (provider === 'gomanga') return GOMANGA_API_BASE + '/api/manga/' + encodeURIComponent(safeId);
  if (provider === 'mangadex') return 'https://mangadex.org/title/' + encodeURIComponent(safeId);
  if (provider === 'mangahook') return 'https://ww6.mangakakalot.tv/manga/' + safeId;
  if (provider === 'batoto') return 'https://fto.to/title/' + safeId;
  if (provider === 'mangabuddy') return 'https://mangabuddy.com/' + safeId;
  if (sourceKind === 'chapmanganato') return 'https://chapmanganato.to/manga-' + safeId;
  if (provider === 'mangakakalot') return 'https://mangakakalot.com/manga/' + safeId;
  throw new Error('Choose a supported MangaScrape source.');
}
function mangaScrapeChapterUrl(provider, mangaId, chapterId, rawSourceKind) {
  const safeMangaId = mangaScrapeCleanId(provider, mangaId);
  const safeChapterId = mangaScrapeId(chapterId);
  const sourceKind = mangaScrapeSourceKind(provider, rawSourceKind);
  if (provider === 'gomanga') return GOMANGA_API_BASE + '/api/manga/' + encodeURIComponent(safeMangaId) + '/' + encodeURIComponent(safeChapterId);
  if (provider === 'mangadex') return 'https://mangadex.org/chapter/' + encodeURIComponent(safeChapterId);
  if (provider === 'mangahook') return 'https://ww6.mangakakalot.tv/chapter/' + safeMangaId + '/' + safeChapterId;
  if (provider === 'batoto') return 'https://fto.to/title/' + safeMangaId + '/' + safeChapterId;
  if (provider === 'mangabuddy') return 'https://mangabuddy.com/' + safeMangaId + '/' + safeChapterId;
  if (sourceKind === 'chapmanganato') return 'https://chapmanganato.to/manga-' + safeMangaId + '/' + safeChapterId;
  if (provider === 'mangakakalot') return 'https://mangakakalot.com/chapter/' + safeMangaId + '/' + safeChapterId;
  throw new Error('This provider does not expose a supported chapter URL.');
}
async function gomangaApiRequest(path) {
  if (typeof path !== 'string' || !path.startsWith('/api/')) throw new Error('Invalid GoManga API path.');
  const target = new URL(path, GOMANGA_API_BASE);
  if (target.origin !== GOMANGA_API_BASE) throw new Error('Invalid GoManga API host.');
  await validatePublicUrl(target.href);
  const now = Date.now();
  const last = mangaScrapeLastRequest.get(target.origin) || 0;
  const waitMs = 1400 - (now - last);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  mangaScrapeLastRequest.set(target.origin, Date.now());
  let response;
  try {
    response = await fetch(target.href, {
      redirect:'manual', signal:AbortSignal.timeout(10000),
      headers:{'User-Agent':USER_AGENT,'Accept':'application/json'}
    });
  } catch {
    throw new Error('GoManga API could not be reached. The upstream service may be unavailable.');
  }
  if (response.status >= 300 && response.status < 400) throw new Error('GoManga API redirected this request; it was stopped for safety.');
  if (!response.ok) throw new Error('GoManga API returned HTTP ' + response.status + '.');
  const body = await response.text();
  if (body.length > 8_000_000) throw new Error('GoManga returned an unexpectedly large response.');
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error('GoManga returned an invalid JSON response.'); }
  if (!payload || typeof payload !== 'object') throw new Error('GoManga returned an empty response.');
  return payload;
}
async function mangaHookApiRequest(path) {
  if (typeof path !== 'string' || !path.startsWith('/api/')) throw new Error('Invalid Manga Hook API path.');
  const target = new URL(path, MANGAHOOK_API_BASE);
  if (target.origin !== MANGAHOOK_API_BASE) throw new Error('Invalid Manga Hook API host.');

  // Manga Hook is a documented public JSON API, not a page Hekomi is crawling.
  // Validate the fixed public endpoint and throttle requests, but do not reject API
  // calls just because the separate robots.txt URL is unavailable/redirected at Vercel.
  await validatePublicUrl(target.href);
  const now = Date.now();
  const last = mangaScrapeLastRequest.get(target.origin) || 0;
  const waitMs = 1400 - (now - last);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  mangaScrapeLastRequest.set(target.origin, Date.now());

  let response;
  try {
    response = await fetch(target.href, {
      redirect:'manual', signal:AbortSignal.timeout(10000),
      headers:{'User-Agent':USER_AGENT,'Accept':'application/json'}
    });
  } catch {
    throw new Error('Manga Hook API could not be reached. Please try again shortly.');
  }
  if (response.status >= 300 && response.status < 400) throw new Error('Manga Hook API redirected this request; it was stopped for safety.');
  if (!response.ok) throw new Error('Manga Hook API returned HTTP ' + response.status + '.');
  const body = await response.text();
  if (body.length > 8_000_000) throw new Error('Manga Hook returned an unexpectedly large response.');
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error('Manga Hook returned an invalid JSON response.'); }
  if (!payload || typeof payload !== 'object') throw new Error('Manga Hook returned an empty response.');
  return payload;
}
async function assertMangaSourceRequestAllowed(rawUrl) {
  // Dedicated adapters target fixed public manga-provider domains. Do not make feed,
  // metadata, or chapter requests fail solely because robots.txt is missing, redirects,
  // or lists a path as disallowed. Public-URL/SSRF validation and per-origin throttling
  // still apply, and the generic user-submitted website inspector remains robots-aware.
  const url = await validatePublicUrl(rawUrl);
  const now = Date.now();
  const last = mangaScrapeLastRequest.get(url.origin) || 0;
  const waitMs = 1400 - (now - last);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  mangaScrapeLastRequest.set(url.origin, Date.now());
  return url;
}
function mangaScrapeSafeAsset(raw) {
  const local = String(raw || '').trim();
  if (local.startsWith('/api/mangadex/image?src=') && !local.startsWith('//')) return local;
  try {
    const url = new URL(local);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) return '';
    // GoManga's documentation examples contain http:// image-proxy links; keep those
    // same-host assets on HTTPS so modern browsers do not block them as mixed content.
    if (url.protocol === 'http:' && url.hostname.toLowerCase() === 'gomanga-api.vercel.app') url.protocol = 'https:';
    return url.href;
  } catch { return ''; }
}
function mangaScrapeExtractChapterImages(payload) {
  const objects = [];
  const addObject = value => {
    if (value && typeof value === 'object') objects.push(value);
  };
  addObject(payload);
  addObject(payload && payload.chapter);
  addObject(payload && payload.data);
  addObject(payload && payload.data && payload.data.chapter);
  let rawImages = [];
  const keys = ['images','imageUrls','pages','pageImages','chapterImages','readerImages','imageList'];
  for (const object of objects) {
    if (Array.isArray(object)) { rawImages = object; break; }
    for (const key of keys) {
      if (Array.isArray(object[key]) && object[key].length) { rawImages = object[key]; break; }
    }
    if (rawImages.length) break;
  }
  const seen = new Set();
  return rawImages.map(item => {
    const raw = typeof item === 'string' ? item
      : item && (item.url || item.src || item.imageUrl || item.image_url || item.pageUrl ||
        item.original || item.image || (item.data && (item.data.url || item.data.image)));
    let candidate = String(raw || '').trim();
    if (candidate.startsWith('//')) candidate = 'https:' + candidate;
    const url = mangaScrapeSafeAsset(candidate);
    if (!url || seen.has(url)) return null;
    seen.add(url);
    return {url,alt:String(item && typeof item === 'object' ? (item.alt || item.title || '') : '').slice(0,200)};
  }).filter(Boolean).slice(0,300);
}
function mangaScrapeTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => typeof item === 'string' ? item : String(item && item.name || '')).map(item => item.trim()).filter(Boolean).slice(0, 30);
}
function mangaScrapeTitleText(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return String(value.original || value.english || value.romaji || value.title || '').trim();
  return '';
}
function mangaDexImageProxyUrl(rawUrl) {
  return '/api/mangadex/image?src=' + encodeURIComponent(String(rawUrl || ''));
}
function mangaDexTitle(attributes) {
  const a = attributes || {};
  const title = a.title && typeof a.title === 'object' ? a.title : {};
  if (title.en) return String(title.en);
  for (const alt of Array.isArray(a.altTitles) ? a.altTitles : []) {
    if (alt && alt.en) return String(alt.en);
  }
  return String(title['ja-ro'] || title['ko-ro'] || title.ja || title.romaji || Object.values(title)[0] || 'Untitled manga');
}
function mangaDexMapManga(item) {
  if (!item || typeof item !== 'object' || !item.id) return null;
  const attrs = item.attributes || {};
  const relationships = Array.isArray(item.relationships) ? item.relationships : [];
  const coverRel = relationships.find(rel => rel && rel.type === 'cover_art');
  const coverName = coverRel && coverRel.attributes && coverRel.attributes.fileName;
  const cover = coverName
    ? mangaDexImageProxyUrl('https://uploads.mangadex.org/covers/' + encodeURIComponent(item.id) + '/' + encodeURIComponent(String(coverName)) + '.256.jpg')
    : '';
  const namesFor = type => relationships.filter(rel => rel && rel.type === type && rel.attributes && rel.attributes.name).map(rel => String(rel.attributes.name));
  const genres = (Array.isArray(attrs.tags) ? attrs.tags : []).map(tag => {
    const names = tag && tag.attributes && tag.attributes.name;
    return String(names && (names.en || Object.values(names)[0]) || '');
  }).filter(Boolean);
  const descriptions = attrs.description && typeof attrs.description === 'object' ? attrs.description : {};
  const description = String(descriptions.en || descriptions['en-us'] || Object.values(descriptions)[0] || '');
  return {
    id:String(item.id), title:mangaDexTitle(attrs), name:mangaDexTitle(attrs),
    url:'https://mangadex.org/title/' + encodeURIComponent(String(item.id)),
    cover, image:cover, poster:cover, description,
    genres, authors:namesFor('author'), artists:namesFor('artist'),
    status:String(attrs.status || ''), lastUpdate:String(attrs.updatedAt || attrs.createdAt || ''),
    latestChapter:String(attrs.latestUploadedChapter || ''), score:0,
    source:'mangadex', mature:(attrs.contentRating === 'erotica' || attrs.contentRating === 'pornographic')
  };
}
function mangaDexQuery(path, extra = {}) {
  const params = new URLSearchParams();
  for (const [key,value] of Object.entries(extra)) {
    if (Array.isArray(value)) value.forEach(entry => params.append(key, String(entry)));
    else if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  return path + (params.size ? '?' + params.toString() : '');
}
function mangaDexIncludes() {
  return {'includes[]':['cover_art','author','artist'],'contentRating[]':['safe','suggestive','erotica','pornographic']};
}
function mangaDexSearchPath(query, limit=30) {
  return mangaDexQuery('/manga',{limit,offset:0,title:query,...mangaDexIncludes()});
}
function mangaDexImageHostAllowed(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/,'');
  return host === 'uploads.mangadex.org' || host === 'mangadex.network' || host.endsWith('.mangadex.network');
}
async function mangaDexApiRequest(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid MangaDex API path.');
  const target = new URL(path, MANGADEX_API_BASE);
  if (target.origin !== MANGADEX_API_BASE) throw new Error('Invalid MangaDex API host.');
  await validatePublicUrl(target.href);
  const now = Date.now();
  const last = mangaScrapeLastRequest.get(target.origin) || 0;
  const waitMs = 400 - (now - last);
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
  mangaScrapeLastRequest.set(target.origin,Date.now());
  let response;
  try {
    response = await fetch(target.href,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':USER_AGENT + '; contact: https://hekomi.vercel.app',Accept:'application/json'}});
  } catch(error) {
    throw new Error('MangaDex API could not be reached: ' + String(error && error.message || 'network error'));
  }
  if (response.status >= 300 && response.status < 400) throw new Error('MangaDex API redirected this request unexpectedly.');
  if (!response.ok) throw new Error('MangaDex API returned HTTP ' + response.status + '.');
  const body = await response.text();
  if (body.length > 8_000_000) throw new Error('MangaDex returned an unexpectedly large response.');
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error('MangaDex returned invalid JSON.'); }
  if (!payload || typeof payload !== 'object' || payload.result === 'error' || (Array.isArray(payload.errors) && payload.errors.length)) {
    throw new Error('MangaDex could not complete the request.');
  }
  return payload;
}
async function mangaDexGetDetails(id) {
  mangaScrapeCleanId('mangadex',id);
  const detailPayload = await mangaDexApiRequest(mangaDexQuery('/manga/' + encodeURIComponent(id),{'includes[]':['cover_art','author','artist']}));
  const raw = detailPayload && detailPayload.data;
  if (!raw) throw new Error('MangaDex returned no manga details.');
  const feedPayload = await mangaDexApiRequest(mangaDexQuery('/manga/' + encodeURIComponent(id) + '/feed',{
    limit:100,offset:0,'translatedLanguage[]':['en'],'order[chapter]':'desc','includes[]':['scanlation_group','user']
  }));
  const chapters = (Array.isArray(feedPayload.data) ? feedPayload.data : []).map(chapter => {
    const attrs = chapter && chapter.attributes || {};
    const groups = (Array.isArray(chapter && chapter.relationships) ? chapter.relationships : [])
      .filter(rel => rel && rel.type === 'scanlation_group')
      .map(rel => rel.attributes && rel.attributes.name || '')
      .filter(Boolean);
    const n = attrs.chapter ? 'Chapter ' + attrs.chapter : '';
    const subtitle = attrs.title ? String(attrs.title) : '';
    const chapterTitle = [n,subtitle].filter(Boolean).join(' · ') || 'Chapter';
    return {
      id:String(chapter.id), title:chapterTitle,
      url:attrs.externalUrl || ('https://mangadex.org/chapter/' + chapter.id),
      externalUrl:String(attrs.externalUrl || ''),
      pageCount:Number(attrs.pages)||0,
      isUnavailable:attrs.isUnavailable === true,
      readerGroup:groups.join(', '),
      update:String(attrs.readableAt || attrs.publishAt || attrs.updatedAt || ''),
      views:''
    };
  });
  return {...mangaDexMapManga(raw),chapters};
}
function mangaScrapeNormalizeSearch(provider, item) {
  if (!item || typeof item !== 'object') return null;
  if (provider === 'mangadex') item = mangaDexMapManga(item);
  if (!item) return null;
  let id;
  try { id = mangaScrapeCleanId(provider, item.id); } catch { return null; }
  const sourceKind = mangaScrapeSourceKind(provider, item.source);
  const title = mangaScrapeTitleText(item.title || item.name) || 'Untitled manga';
  const chapterValue = item.lastChapter || item.latestChapter ||
    (Array.isArray(item.latestChapters) ? item.latestChapters[0] : null) ||
    (Array.isArray(item.lastChapters) ? item.lastChapters[0] : null) || item.chapter || {};
  const chapter = typeof chapterValue === 'string' ? {title:chapterValue,id:chapterValue} : chapterValue;
  return {
    id, provider, sourceKind, title,
    url: mangaScrapeTitleUrl(provider, id, sourceKind),
    cover: mangaScrapeSafeAsset(item.poster || item.cover || item.image || item.imgUrl || ''),
    description: String(item.description || item.summary || '').replace(/\s+/g, ' ').trim().slice(0, 1400),
    genres: mangaScrapeTextList(item.genres),
    authors: mangaScrapeTextList(Array.isArray(item.authors) ? item.authors : (item.authors ? [item.authors] : (item.author ? [item.author] : []))),
    status: String(item.status || ''),
    score: Number(item.score || item.rating) || 0,
    mature: Boolean(item.mature),
    lastUpdate: String(item.lastUpdate || item.update || ''),
    latestChapter: String(chapter.title || chapter.name || chapter.chapter || ''),
    latestChapterId: String(chapter.id || chapter.chapterId || chapter.chapter || ''),
    source: String(provider)
  };
}
function mangaScrapeNormalizeDetails(provider, id, rawSourceKind, item) {
  if (!item || typeof item !== 'object') throw new Error('The provider did not return manga details.');
  const safeId = mangaScrapeCleanId(provider, item.id || id);
  const sourceKind = mangaScrapeSourceKind(provider, rawSourceKind || item.source);
  const title = mangaScrapeTitleText(item.title || item.name) || 'Untitled manga';
  const rawChapters = provider === 'mangahook' ? item.chapterList : item.chapters;
  const chapters = (Array.isArray(rawChapters) ? rawChapters : []).map(chapter => {
    let chapterId = '';
    try { chapterId = mangaScrapeId(chapter && (chapter.id || chapter.chapterId || chapter.chapter)); } catch { return null; }
    return {
      id: chapterId,
      title: String(chapter.title || chapter.name || ('Chapter ' + chapterId)).replace(/\s+/g, ' ').trim().slice(0, 240),
      url: provider === 'mangadex' && chapter.externalUrl ? (mangaScrapeSafeAsset(chapter.externalUrl) || mangaScrapeChapterUrl(provider, safeId, chapterId, sourceKind)) : mangaScrapeChapterUrl(provider, safeId, chapterId, sourceKind),
      readerProvider: provider === 'mangadex' && (chapter.externalUrl || chapter.isUnavailable || !(Number(chapter.pageCount) > 0)) ? '' : provider,
      readerGroup: String(chapter.readerGroup || ''),
      externalUrl: String(chapter.externalUrl || ''),
      pageCount: Number(chapter.pageCount) || 0,
      update: String(chapter.update || chapter.uploaded || chapter.createdAt || chapter.timestamp || chapter.date || ''),
      views: String(chapter.views || chapter.view || '')
    };
  }).filter(Boolean);
  return {
    id: safeId, provider, sourceKind, providerLabel: MANGASCRAPE_SOURCES[provider].label,
    title, url: mangaScrapeTitleUrl(provider, safeId, sourceKind),
    cover: mangaScrapeSafeAsset(item.poster || item.cover || item.image || item.imgUrl || item.imageUrl || ''),
    description: String(item.description || item.summary || '').replace(/\s+/g, ' ').trim().slice(0, 12000),
    genres: mangaScrapeTextList(item.genres),
    authors: mangaScrapeTextList(Array.isArray(item.authors) ? item.authors : (item.authors ? [item.authors] : (item.author ? [item.author] : []))),
    artists: mangaScrapeTextList(item.artists),
    status: String(item.status || ''),
    score: Number((item.rating && item.rating.average) || item.rating || item.score) || 0,
    lastUpdate: String(item.lastUpdate || item.updated || item.update || ''),
    chapters
  };
}
async function getMangaScrapeProviderFeed(provider, feed) {
  const { source, adapter } = mangaScrapeProvider(provider);
  let target = source.origin + '/';
  let raw = [];
  if (provider === 'batoto') {
    target = 'https://fto.to/v3x';
    await assertMangaSourceRequestAllowed(target);
    const home = await adapter.home();
    raw = feed === 'latest' ? (home.latestReleases || []) : (home.popularUpdates || []);
  } else if (provider === 'mangabuddy') {
    target = source.origin + (feed === 'latest' ? '/latest' : '/popular');
    await assertMangaSourceRequestAllowed(target);
    raw = feed === 'latest' ? await adapter.latest() : await adapter.popular();
  } else if (provider === 'mangakakalot') {
    target = source.origin + '/';
    await assertMangaSourceRequestAllowed(target);
    const home = await adapter.home();
    raw = feed === 'latest' ? (home.latestUpdates || []) : (home.populars || []);
  } else if (provider === 'mangahook') {
    // Manga Hook's own middleware validates the human-readable filter labels,
    // not just the filter IDs. "Top read" is normalized to "topview" by its controller.
    const type = feed === 'latest' ? 'Latest' : 'Top read';
    const query = new URLSearchParams({ page:'1', type, category:'ALL', state:'all' });
    const payload = await mangaHookApiRequest('/api/mangaList?' + query.toString());
    raw = Array.isArray(payload.mangaList) ? payload.mangaList : [];
    if (!raw.length) throw new Error('Manga Hook /api/mangaList returned no titles.');
  } else if (provider === 'gomanga') {
    const payload = feed === 'latest'
      ? await gomangaApiRequest('/api/manga-list/1')
      : await gomangaApiRequest('/api/genre/top%20read/1');
    raw = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.manga) ? payload.manga : []);
    if (!raw.length) throw new Error('GoManga returned no titles for its ' + (feed === 'latest' ? 'latest' : 'Top read') + ' feed.');
  } else if (provider === 'mangadex') {
    const query = mangaDexQuery('/manga',{
      limit:24,offset:0,
      'order[followedCount]':feed === 'latest' ? undefined : 'desc',
      'order[latestUploadedChapter]':feed === 'latest' ? 'desc' : undefined,
      ...mangaDexIncludes()
    });
    const payload = await mangaDexApiRequest(query);
    raw = Array.isArray(payload.data) ? payload.data : [];
    if (!raw.length) throw new Error('MangaDex returned no titles for its ' + (feed === 'latest' ? 'latest' : 'trending') + ' feed.');
  }
  const normalized = (Array.isArray(raw) ? raw : [])
    .slice(0, 24)
    .map(item => mangaScrapeNormalizeSearch(provider, item))
    .filter(Boolean)
    .map(item => ({ ...item, providerLabel:source.label }));
  if (['mangahook','gomanga'].includes(provider) && !normalized.length) {
    throw new Error(source.label + ' returned entries, but none had valid manga IDs.');
  }
  return normalized;
}
async function loadMangaScrapeDiscovery(provider, feed, force=false) {
  const cacheKey = provider + ':' + feed;
  const cached = mangaScrapeFeedCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.cachedAt < 8 * 60 * 1000) return cached.payload;

  const errors = [];
  let results = [];
  let sourceFallback = '';
  if (provider === 'mangahook') {
    // Keep Manga Hook as the preferred source. If its API is down, try every other
    // supported public provider so one broken API does not blank the whole reader.
    try {
      results = await getMangaScrapeProviderFeed('mangahook', feed);
    } catch (primaryError) {
      errors.push({
        provider:'mangahook', label:MANGASCRAPE_SOURCES.mangahook.label,
        message:String(primaryError && primaryError.message || 'Manga Hook feed failed.')
      });
    }
    if (!results.length) {
      // MangaDex is the direct JSON/API backup. Prefer it before slower HTML scrapers;
      // a dead scraper must not hold up a live feed that already returned titles.
      try {
        results = await getMangaScrapeProviderFeed('mangadex', feed);
        sourceFallback = results.length ? 'mangadex' : '';
      } catch(error) {
        errors.push({provider:'mangadex',label:MANGASCRAPE_SOURCES.mangadex.label,message:String(error&&error.message||'MangaDex feed failed.')});
      }
      if (!results.length) {
        const backupProviders = ['gomanga','batoto','mangabuddy','mangakakalot'];
        const backupSettled = await Promise.allSettled(backupProviders.map(key => getMangaScrapeProviderFeed(key, feed)));
        const successfulBackups = [];
        backupSettled.forEach((item,index) => {
          const key = backupProviders[index];
          if (item.status === 'fulfilled' && item.value.length) {
            results.push(...item.value);
            successfulBackups.push(key);
          } else {
            errors.push({
              provider:key,
              label:MANGASCRAPE_SOURCES[key].label,
              message:item.status === 'rejected'
                ? String(item.reason && item.reason.message || 'Backup source failed.')
                : MANGASCRAPE_SOURCES[key].label + ' returned no titles.'
            });
          }
        });
        if (successfulBackups.length === 1) sourceFallback = successfulBackups[0];
        else if (successfulBackups.length > 1) sourceFallback = 'multiple';
      }
    }
  } else {
    const providers = provider === 'all' ? Object.keys(MANGASCRAPE_SOURCES) : [provider];
    const settled = await Promise.allSettled(providers.map(key => getMangaScrapeProviderFeed(key, feed)));
    settled.forEach((item,index) => {
      if (item.status === 'fulfilled') results.push(...item.value);
      else errors.push({
        provider:providers[index],
        label:MANGASCRAPE_SOURCES[providers[index]].label,
        message:String(item.reason && item.reason.message || 'This source could not be reached.')
      });
    });
  }

  // Keep results diverse and stable, without pretending failed providers succeeded.
  const seen = new Set();
  let unique = results.filter(item => {
    const key = item.provider + ':' + item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 60);
  let fallback = false;

  // AniList remains available only when the user explicitly selects all sources.
  // The Manga Hook preference tries the other providers before falling back; AniList is still only used for explicit All sources.
  if (!unique.length && provider === 'all') {
    try {
      const catalog = await getPublicCatalog();
      const manga = Array.isArray(catalog.manga) ? catalog.manga.slice() : [];
      if (feed === 'trending') manga.sort((a,b) => (Number(b.popularity)||0) - (Number(a.popularity)||0));
      else manga.sort((a,b) => (Number(b.updatedAt)||0) - (Number(a.updatedAt)||0));
      unique = manga.slice(0, 48).map(item => ({
        id:String(item.id), provider:'catalog', providerLabel:'AniList catalog',
        title:item.title || 'Untitled manga', url:item.siteUrl || ('https://anilist.co/manga/'+Number(item.id)+'/'),
        cover:item.cover || '', description:item.description || '',
        genres:Array.isArray(item.genres)?item.genres:[], authors:[], artists:[],
        status:item.status || '', score:Number(item.averageScore)||0,
        lastUpdate:item.updatedAt ? new Date(Number(item.updatedAt)*1000).toISOString() : '',
        latestChapter:'', latestChapterId:'', source:'catalog', sourceKind:'',
        popularity:Number(item.popularity)||0, format:item.format||''
      }));
      fallback = unique.length > 0;
    } catch (error) {
      errors.push({provider:'catalog',label:'AniList catalog',message:String(error && error.message || 'Catalog fallback unavailable.')});
    }
  }
  const payload = {
    feed, provider, results:unique, errors, fallback, sourceFallback,
    fetchedAt:new Date().toISOString(),
    notice:sourceFallback
      ? 'Manga Hook did not return a live feed. Showing results from ' + (sourceFallback === 'multiple' ? 'multiple backup sources' : (MANGASCRAPE_SOURCES[sourceFallback] && MANGASCRAPE_SOURCES[sourceFallback].label || sourceFallback)) + '.'
      : fallback
        ? 'Showing catalogue recommendations because live source feeds are unavailable. Open a title on AniList.'
        : errors.length
          ? 'No live manga feed was available from the selected sources. Check the source error details below.'
          : 'Chapter details and reader support depend on each provider.'
  };
  // Do not cache empty/error responses: a transient upstream failure should be retryable immediately.
  if (unique.length) mangaScrapeFeedCache.set(cacheKey,{cachedAt:Date.now(),payload});
  return payload;
}
async function inspectWebsite(rawUrl) {
  const url=await validatePublicUrl(rawUrl);
  const hostKey=url.host;
  const now=Date.now(), last=rate.get(hostKey)||0;
  if(now-last<2500) throw new Error('Please wait a moment before inspecting this website again.');
  rate.set(hostKey,now);
  let robots='';
  try {
    const rr=await fetch(new URL('/robots.txt',url.origin), { redirect:'manual', signal:AbortSignal.timeout(5000), headers:{'User-Agent':USER_AGENT,'Accept':'text/plain'} });
    if(rr.ok) robots=(await rr.text()).slice(0,200000);
    else if(rr.status !== 404 && rr.status !== 410) throw new Error(`robots.txt could not be checked (HTTP ${rr.status}); inspection stopped out of caution.`);
  } catch(e) { if(e.message.includes('inspection stopped')) throw e; throw new Error('Could not verify robots.txt for this site, so inspection was stopped.'); }
  const rule=robotsAllowed(url,robots);
  if(!rule.allowed) throw new Error('This URL is disallowed by the website robots.txt rules.');
  if(rule.delay > 5) await new Promise(r=>setTimeout(r,Math.min(rule.delay,10)*1000));
  const {url:finalUrl,html}=await fetchLimited(url.href);
  const title=cleanText((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||meta(html,'og:title')||meta(html,'twitter:title')||new URL(finalUrl).hostname);
  const description=cleanText(meta(html,'description')||meta(html,'og:description')||meta(html,'twitter:description'));
  let image=meta(html,'og:image')||meta(html,'twitter:image')||meta(html,'og:image:url');
  if(image) { try { image=new URL(image,finalUrl).href; } catch { image=''; } }
  const links=[]; const seen=new Set(); const re=/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html)) && links.length<3000) {
    const href=decodeEntities(m[2]).trim(), text=cleanText(m[3]); if(!href||!text||href.startsWith('#')||/^(javascript:|mailto:|tel:|data:)/i.test(href)) continue;
    let abs; try { abs=new URL(href,finalUrl); } catch { continue; }
    if(abs.origin!==new URL(finalUrl).origin || seen.has(abs.href)) continue;
    seen.add(abs.href);
    const ctx=(m[0].slice(0,300)+' '+text+' '+abs.pathname).toLowerCase();
    const chapter=/\b(chapter|ch\.?\s*\d|episode|ep\.?\s*\d|read\s+now|\bscan\b)/i.test(ctx);
    const manga=/\b(manga|manhwa|manhua|comic|series|title|book|webtoon)\b/i.test(ctx) || /\/(manga|manhwa|manhua|series|title|comic|webtoon)\//i.test(abs.pathname);
    if(chapter||manga) links.push({title:text.slice(0,140),url:abs.href,type:chapter?'chapter':'manga'});
  }
  const mangaLinks=links.filter(x=>x.type==='manga').slice(0,80);
  const chapterLinks=links.filter(x=>x.type==='chapter').slice(0,120);
  return {url:finalUrl,title,description,image,mangaLinks,chapterLinks,checkedAt:new Date().toISOString(),notice:'Generic extraction is heuristic. Some sites need a dedicated source adapter; only publicly accessible pages permitted by the site rules are inspected.'};
}

async function searchMangaWebsites(rawQuery) {
  const query=String(rawQuery||'').trim().slice(0,160);
  if(query.length<2) throw new Error('Enter a manga title or search phrase.');
  // Search for public source pages; this does not crawl result sites until the user chooses one.
  const q=`${query} manga manhwa read chapters`;
  const endpoint='https://html.duckduckgo.com/html/?q='+encodeURIComponent(q);
  let response, html='';
  try {
    response=await fetch(endpoint,{redirect:'follow',signal:AbortSignal.timeout(12000),headers:{'User-Agent':USER_AGENT,'Accept':'text/html,application/xhtml+xml'}});
    if(!response.ok) throw new Error(`Web search returned HTTP ${response.status}.`);
    html=(await response.text()).slice(0,2_000_000);
  } catch {
    const encoded=encodeURIComponent(q);
    return {query,results:[
      {title:'Search the web with DuckDuckGo',url:`https://duckduckgo.com/?q=${encoded}`,origin:'https://duckduckgo.com',domain:'duckduckgo.com',snippet:'Open search results, then copy a public manga or chapter URL into Hekomi.',searchPage:true},
      {title:'Search the web with Bing',url:`https://www.bing.com/search?q=${encoded}`,origin:'https://www.bing.com',domain:'bing.com',snippet:'Alternative search provider if direct result retrieval is unavailable.',searchPage:true},
      {title:'Search the web with Google',url:`https://www.google.com/search?q=${encoded}`,origin:'https://www.google.com',domain:'google.com',snippet:'Alternative search provider. Paste a chosen public result URL into Hekomi to inspect it.',searchPage:true}
    ],notice:'Direct search retrieval is unavailable from this server right now. Open a search provider, then paste a chosen public result URL into the crawler.'};
  }
  const results=[],seen=new Set();
  const re=/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html))&&results.length<12){
    let href=decodeEntities(m[1]);
    try {
      if(href.startsWith('//')) href='https:'+href;
      const parsed=new URL(href);
      if(parsed.hostname.includes('duckduckgo.com')&&parsed.searchParams.has('uddg')) href=parsed.searchParams.get('uddg');
      const u=await validatePublicUrl(href);
      if(seen.has(u.origin)||/duckduckgo\.com$/i.test(u.hostname)) continue;
      seen.add(u.origin);
      const title=cleanText(m[2])||u.hostname;
      const snippetMatch=html.slice(Math.max(0,m.index-100),Math.min(html.length,m.index+1800)).match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
      results.push({title:title.slice(0,180),url:u.href,origin:u.origin,domain:u.hostname,snippet:snippetMatch?cleanText(snippetMatch[1]).slice(0,300):'Search result for manga or manhwa.'});
    } catch {}
  }
  if(!results.length) throw new Error('The web search returned no readable results. Try a different title or use a website URL directly.');
  return {query,results,notice:'Search results are suggestions, not endorsements. Choose a result to inspect its public page; source restrictions are checked before crawling.'};
}

async function extractChapterImages(rawUrl) {
  const url=await validatePublicUrl(rawUrl);
  const hostKey=url.host, now=Date.now(), last=rate.get(hostKey)||0;
  if(now-last<2500) throw new Error('Please wait a moment before loading another chapter from this website.');
  rate.set(hostKey,now);
  // Reading a publicly reachable chapter is not gated by a robots.txt probe.
  // The URL is still validated, requests are throttled, redirects are revalidated,
  // and page/download size limits remain in place.
  const {url:finalUrl,html}=await fetchLimited(url.href,4,4_000_000);
  const found=[], seen=new Set();
  const tags=html.match(/<(?:img|source)\b[^>]*>/gi)||[];
  for(const tag of tags){
    let src=attr(tag,'src')||attr(tag,'data-src')||attr(tag,'data-lazy-src')||attr(tag,'data-original')||attr(tag,'data-url')||attr(tag,'srcset');
    if(!src) continue;
    if(src.includes(',')) src=src.split(',')[0].trim().split(/\s+/)[0];
    try { const u=new URL(src,finalUrl); if(!['http:','https:'].includes(u.protocol)||seen.has(u.href)) continue; seen.add(u.href);
      const info=(attr(tag,'alt')+' '+attr(tag,'class')+' '+attr(tag,'id')+' '+u.pathname).toLowerCase();
      if(/logo|avatar|icon|banner|advert|adsense|profile/.test(info)) continue;
      found.push({url:u.href,alt:attr(tag,'alt')||'',width:Number(attr(tag,'width'))||0,height:Number(attr(tag,'height'))||0});
    }catch{}
  }
  // Manga pages are often lazy-loaded with data attributes or embedded JSON.
  const jsonImages=html.match(/(?:https?:\\?\/\\?\/[^"'\\\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s<>]*)?)/gi)||[];
  for(let raw of jsonImages){raw=raw.replace(/\\\//g,'/').replace(/\\u0026/g,'&');try{const u=new URL(raw,finalUrl);if(!seen.has(u.href)){seen.add(u.href);found.push({url:u.href,alt:'',width:0,height:0});}}catch{}}
  const filtered=found.filter(x=>/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(x.url)||/chapter|page|image|uploads|manga|comic/i.test(x.url));
  if(!filtered.length) throw new Error('No chapter page images were detected. This site may use JavaScript rendering or protected image delivery; a dedicated adapter may be needed.');
  return {url:finalUrl,title:cleanText((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'Chapter'),images:filtered.slice(0,250),notice:'Pages were extracted from the chapter HTML. Some sources require JavaScript or a source-specific reader.'};
}


const MAL_SESSION_COOKIE = 'folio_mal_session';
const MAL_FLOW_COOKIE = 'folio_mal_oauth';
const SESSION_SECRET = process.env.FOLIO_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('base64url'));

function malAuthConfigured() {
  return Boolean(process.env.MAL_CLIENT_ID && process.env.MAL_CLIENT_SECRET && SESSION_SECRET);
}
function sessionKey() {
  if (!SESSION_SECRET) throw new Error('Hekomi MAL sign-in has not been configured by the app maintainer.');
  return crypto.createHash('sha256').update(SESSION_SECRET).digest();
}
function sealJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
function unsealJson(value) {
  try {
    const raw = Buffer.from(String(value || ''), 'base64url');
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
  } catch { return null; }
}
function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return '';
}
function isSecureRequest(req) {
  return process.env.NODE_ENV === 'production' || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
function cookieHeader(req, name, value, maxAge) {
  return name + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (isSecureRequest(req) ? '; Secure' : '');
}
function clearMalCookies(req, res) {
  res.setHeader('Set-Cookie', [
    cookieHeader(req, MAL_SESSION_COOKIE, '', 0),
    cookieHeader(req, MAL_FLOW_COOKIE, '', 0)
  ]);
}
function getMalRedirectUri(req) {
  const configured = String(process.env.MAL_REDIRECT_URI || '').trim();
  if (configured) return configured;
  const renderUrl = String(process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
  if (renderUrl) return renderUrl + '/api/mal/auth/callback';
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers.host || ('localhost:' + PORT);
  return proto + '://' + host + '/api/mal/auth/callback';
}
function redirect(res, location, status=303) {
  res.writeHead(status, { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  res.end();
}
async function postMalToken(form) {
  const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: form,
    signal: AbortSignal.timeout(12000)
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.message || ('MAL token exchange failed (' + response.status + ').'));
  return data;
}
async function refreshMalSession(req, res, session) {
  if (session && session.accessToken && Number(session.expiresAt || 0) > Date.now() + 60000) return session;
  if (!session || !session.refreshToken || !malAuthConfigured()) return null;
  try {
    const form = new URLSearchParams({
      client_id: process.env.MAL_CLIENT_ID,
      client_secret: process.env.MAL_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken
    });
    const token = await postMalToken(form);
    const updated = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || session.refreshToken,
      expiresAt: Date.now() + (Number(token.expires_in) || 2592000) * 1000,
      username: session.username || ''
    };
    res.setHeader('Set-Cookie', cookieHeader(req, MAL_SESSION_COOKIE, sealJson(updated), 60 * 60 * 24 * 180));
    return updated;
  } catch (error) {
    console.warn('MAL token refresh failed:', error.message);
    res.setHeader('Set-Cookie', cookieHeader(req, MAL_SESSION_COOKIE, '', 0));
    return null;
  }
}
async function getMalSession(req, res) {
  const initial = unsealJson(readCookie(req, MAL_SESSION_COOKIE));
  return refreshMalSession(req, res, initial);
}
async function malAuthStatus(req, res) {
  let session = null;
  if (malAuthConfigured()) session = await getMalSession(req, res);
  return send(res, 200, {
    configured: malAuthConfigured(),
    connected: Boolean(session && session.accessToken),
    username: session ? session.username || '' : ''
  });
}
async function startMalAuth(req, res) {
  if (!malAuthConfigured()) return send(res, 503, { error: 'Hekomi MAL sign-in is not configured yet. The app maintainer must add MAL_CLIENT_ID, MAL_CLIENT_SECRET, and FOLIO_SESSION_SECRET to the server environment.' });
  const state = crypto.randomBytes(24).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const redirectUri = getMalRedirectUri(req);
  const flow = { state, verifier, redirectUri, expiresAt: Date.now() + 10 * 60 * 1000 };
  const authorize = new URL('https://myanimelist.net/v1/oauth2/authorize');
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.MAL_CLIENT_ID,
    code_challenge: verifier,
    code_challenge_method: 'plain',
    state,
    redirect_uri: redirectUri
  }).toString();
  res.setHeader('Set-Cookie', cookieHeader(req, MAL_FLOW_COOKIE, sealJson(flow), 600));
  redirect(res, authorize.toString(), 302);
}
async function completeMalAuth(req, res, query) {
  const flow = unsealJson(readCookie(req, MAL_FLOW_COOKIE));
  const state = query.get('state') || '';
  const code = query.get('code') || '';
  if (!malAuthConfigured() || query.get('error') || !flow || !state || state !== flow.state || Date.now() > Number(flow.expiresAt || 0) || !code) {
    res.setHeader('Set-Cookie', cookieHeader(req, MAL_FLOW_COOKIE, '', 0));
    console.warn('MAL OAuth callback rejected: configuration, code, state, or expiry check failed.');
    return redirect(res, '/?mal=error');
  }
  try {
    const form = new URLSearchParams({
      client_id: process.env.MAL_CLIENT_ID,
      client_secret: process.env.MAL_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      code_verifier: flow.verifier,
      redirect_uri: flow.redirectUri
    });
    const token = await postMalToken(form);
    let username = '';
    try {
      const profile = await fetch('https://api.myanimelist.net/v2/users/@me', {
        headers: { 'X-MAL-CLIENT-ID': process.env.MAL_CLIENT_ID, Authorization: 'Bearer ' + token.access_token, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (profile.ok) {
        const data = await profile.json();
        username = String(data.name || '');
      }
    } catch {}
    const session = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || '',
      expiresAt: Date.now() + (Number(token.expires_in) || 2592000) * 1000,
      username
    };
    res.setHeader('Set-Cookie', [
      cookieHeader(req, MAL_SESSION_COOKIE, sealJson(session), 60 * 60 * 24 * 180),
      cookieHeader(req, MAL_FLOW_COOKIE, '', 0)
    ]);
    return redirect(res, '/?mal=connected');
  } catch (error) {
    console.error('MAL OAuth token exchange failed:', error.message);
    res.setHeader('Set-Cookie', cookieHeader(req, MAL_FLOW_COOKIE, '', 0));
    return redirect(res, '/?mal=error');
  }
}
async function malLogout(req, res) {
  clearMalCookies(req, res);
  return send(res, 200, { ok: true });
}
async function malRequest(req, res, pathname, query) {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return send(res, 503, { error: 'MAL catalog search is not configured by the Hekomi maintainer yet.' });
  if (!['/search','/details','/me','/list','/update'].includes(pathname)) return send(res,404,{error:'Unknown MAL endpoint.'});
  let session = null;
  if (!['/search','/details'].includes(pathname)) {
    session = await getMalSession(req, res);
    if (!session || !session.accessToken) return send(res,401,{error:'Sign in with MyAnimeList first.'});
  }
  let apiPath = '';
  let method = 'GET';
  let body;
  const animeFields='alternative_titles,synopsis,mean,rank,popularity,num_list_users,num_scoring_users,genres,num_episodes,media_type,main_picture,start_date,end_date,status,start_season,broadcast,source,average_episode_duration,rating,studios,updated_at';
  if (pathname === '/search') apiPath='/anime?q='+encodeURIComponent(query.get('q')||'')+'&limit=10&fields='+animeFields;
  if (pathname === '/details') { const id=Number(query.get('id')); if(!Number.isSafeInteger(id)||id<1)return send(res,400,{error:'A valid anime ID is required.'}); apiPath='/anime/'+id+'?fields='+animeFields; }
  if (pathname === '/me') apiPath='/users/@me?fields=name,picture';
  if (pathname === '/list') apiPath='/users/@me/animelist?limit=1000&fields=list_status,updated_at,alternative_titles,synopsis,mean,rank,popularity,num_list_users,num_scoring_users,genres,num_episodes,media_type,main_picture,start_date,end_date,status,start_season,broadcast,source,average_episode_duration,rating,studios,updated_at';
  if (pathname === '/update') {
    const data = await readBody(req);
    if (!Number.isInteger(Number(data.id))) return send(res,400,{error:'A valid anime ID is required.'});
    apiPath='/anime/'+Number(data.id)+'/my_list_status'; method='PATCH';
    const form=new URLSearchParams();
    for(const k of ['status','score','num_watched_episodes']) if(data[k]!==undefined && data[k]!==null && data[k]!=='') form.set(k,String(data[k]));
    body=form;
  }
  const headers = { 'X-MAL-CLIENT-ID': clientId, Accept: 'application/json' };
  if (session) headers.Authorization = 'Bearer ' + session.accessToken;
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  try {
    const malApiOrigin = 'https://api.myanimelist.net';
    const requestJson = async target => {
      const response = await fetch(target, { method, headers, body, signal: AbortSignal.timeout(12000) });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 500) }; }
      return { response, data };
    };

    if (pathname === '/list') {
      const listPath = '/v2/users/@me/animelist';
      const entries = [];
      const seenEntryIds = new Set();
      const seenPages = new Set();
      let nextPage = malApiOrigin + '/v2' + apiPath;
      let firstData = null;
      let lastPaging = {};
      let pagesLoaded = 0;

      while (nextPage) {
        const pageUrl = new URL(nextPage);
        if (pageUrl.origin !== malApiOrigin || decodeURIComponent(pageUrl.pathname) !== listPath) {
          return send(res, 502, { error: 'MyAnimeList returned an unexpected list pagination URL.' });
        }
        const canonicalPageUrl = pageUrl.href;
        if (seenPages.has(canonicalPageUrl)) {
          return send(res, 502, { error: 'MyAnimeList repeated a list page. Hekomi did not apply an incomplete sync.' });
        }
        seenPages.add(canonicalPageUrl);

        const { response, data } = await requestJson(canonicalPageUrl);
        if (!response.ok) return send(res, response.status, data);
        if (!firstData) firstData = data;

        const pageEntries = Array.isArray(data.data) ? data.data : [];
        for (const entry of pageEntries) {
          const entryId = Number(entry && entry.node && entry.node.id);
          if (Number.isSafeInteger(entryId) && entryId > 0) {
            if (seenEntryIds.has(entryId)) continue;
            seenEntryIds.add(entryId);
          }
          entries.push(entry);
        }

        lastPaging = data.paging && typeof data.paging === 'object' ? data.paging : {};
        const rawNext = typeof lastPaging.next === 'string' ? lastPaging.next.trim() : '';
        pagesLoaded += 1;
        if (!rawNext) {
          nextPage = '';
          break;
        }
        if (pagesLoaded >= 1000) {
          return send(res, 502, { error: 'Your MyAnimeList list exceeded Hekomi’s pagination safety limit. No partial list was applied.' });
        }

        const nextUrl = new URL(rawNext, canonicalPageUrl);
        if (nextUrl.origin !== malApiOrigin || decodeURIComponent(nextUrl.pathname) !== listPath) {
          return send(res, 502, { error: 'MyAnimeList returned an unexpected next-page URL. Hekomi did not apply an incomplete sync.' });
        }
        nextPage = nextUrl.href;
        await new Promise(resolve => setTimeout(resolve, 1050));
      }

      const base = firstData || {};
      return send(res, 200, {
        ...base,
        data: entries,
        paging: { ...(base.paging || {}), ...lastPaging, next: null }
      });
    }

    const { response, data } = await requestJson(malApiOrigin + '/v2' + apiPath);
    return send(res, response.status, data);
  } catch (e) {
    return send(res, 502, { error: 'Could not reach the MyAnimeList API: ' + e.message });
  }
}


const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const MEDIA_CATALOG_FIELDS = 'id idMal type title { romaji english native } coverImage { color extraLarge large medium } bannerImage description(asHtml:false) genres averageScore popularity favourites status episodes chapters volumes season seasonYear format countryOfOrigin source duration startDate { year month day } endDate { year month day } studios(isMain:true) { nodes { name } } nextAiringEpisode { airingAt timeUntilAiring episode } trailer { id site thumbnail } siteUrl updatedAt isLicensed isAdult';
const HOME_CATALOG_QUERY = 'query HekomiHomeCatalog { anime: Page(page:1,perPage:10) { media(type:ANIME,sort:[TRENDING_DESC,POPULARITY_DESC],isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } } manga: Page(page:1,perPage:10) { media(type:MANGA,sort:[TRENDING_DESC,POPULARITY_DESC],isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } } }';
function currentAnimeSeason(date=new Date()) { const month=date.getUTCMonth()+1; return month<=3?'WINTER':month<=6?'SPRING':month<=9?'SUMMER':'FALL'; }
const FULL_ANIME_COLLECTION_QUERY = 'query HekomiFullAnimeCollection($page:Int!,$season:MediaSeason,$seasonYear:Int) { results: Page(page:$page,perPage:50) { pageInfo { currentPage hasNextPage total } media(type:ANIME,season:$season,seasonYear:$seasonYear,status:RELEASING,sort:[POPULARITY_DESC],isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } } }';
const seasonCatalogCache = new Map();
const CATALOG_SEARCH_QUERY = 'query HekomiCatalogSearch($search:String!,$page:Int!) { anime: Page(page:$page,perPage:24) { pageInfo { currentPage hasNextPage } media(search:$search,type:ANIME,sort:[SEARCH_MATCH],isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } } manga: Page(page:$page,perPage:24) { pageInfo { currentPage hasNextPage } media(search:$search,type:MANGA,sort:[SEARCH_MATCH],isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } } }';
const MEDIA_DETAIL_QUERY = 'query HekomiMediaDetail($id:Int!) { Media(id:$id) { ' + MEDIA_CATALOG_FIELDS + ' } }';
const MEDIA_MAL_DETAIL_QUERY = 'query HekomiMalMediaDetail($idMal:Int!) { Media(idMal:$idMal,type:ANIME) { ' + MEDIA_CATALOG_FIELDS + ' } }';
const MEDIA_RECOMMENDATIONS_QUERY = 'query HekomiRecommendations($idMal:Int!) { Media(idMal:$idMal,type:ANIME) { recommendations(page:1,perPage:20,sort:[RATING_DESC]) { nodes { rating mediaRecommendation { ' + MEDIA_CATALOG_FIELDS + ' } } } } }';
const publicCatalogCache = { data:null, expiresAt:0 };
const publicCatalogSearchCache = new Map();
const mediaDetailCache = new Map();
let publicCatalogInFlight = null;

function insertBeforeClosingBody(html, markup) {
  const source = String(html);
  const closingTag = source.toLowerCase().lastIndexOf('</body>');
  return closingTag < 0 ? source + markup : source.slice(0, closingTag) + markup + source.slice(closingTag);
}

function htmlEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function mediaSlug(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90) || 'series';
}
function publicOrigin(req) {
  const configured = String(process.env.HEKOMI_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim();
  if (configured) {
    try { const parsed = new URL(configured); if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.origin; } catch {}
  }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || ('localhost:' + PORT)).split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim().toLowerCase();
  try { return new URL((proto === 'https' ? 'https://' : 'http://') + host).origin; }
  catch { return 'http://localhost:' + PORT; }
}
async function requestAniList(query, variables={}) {
  const response = await fetch(ANILIST_ENDPOINT, {
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({query,variables}),
    signal:AbortSignal.timeout(12000)
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('The catalog source returned an unreadable response.'); }
  if (!response.ok || payload.errors || !payload.data) {
    const message = payload.errors && payload.errors[0] && payload.errors[0].message;
    throw new Error(message || ('The catalog source returned HTTP ' + response.status + '.'));
  }
  return payload.data;
}
function packMedia(item) {
  if (!item || item.isAdult) return null;
  const title = item.title && (item.title.english || item.title.romaji || item.title.native) || 'Untitled';
  const cover = item.coverImage && (item.coverImage.extraLarge || item.coverImage.large || item.coverImage.medium) || '';
  const studios = item.studios && Array.isArray(item.studios.nodes) ? item.studios.nodes.map(studio=>studio&&studio.name).filter(Boolean) : [];
  const nextAiringEpisode = item.nextAiringEpisode ? {
    episode:Number(item.nextAiringEpisode.episode)||null,
    airingAt:Number(item.nextAiringEpisode.airingAt)||null,
    timeUntilAiring:Number(item.nextAiringEpisode.timeUntilAiring)||null
  } : null;
  const trailer = item.trailer ? {id:item.trailer.id||'',site:item.trailer.site||'',thumbnail:item.trailer.thumbnail||''} : null;
  return {
    id:Number(item.id), idMal:item.idMal || null, type:item.type || '',
    accentColor:item.coverImage && item.coverImage.color || '',
    title,titleEnglish:item.title && item.title.english || '',
    titleRomaji:item.title && item.title.romaji || '',
    titleNative:item.title && item.title.native || '',
    cover:cover, bannerImage:item.bannerImage || '',
    description:cleanText(item.description || ''),
    genres:Array.isArray(item.genres)?item.genres.slice(0,8):[],
    averageScore:Number(item.averageScore)||0,popularity:Number(item.popularity)||0,
    favourites:Number(item.favourites)||0,
    status:item.status||'',episodes:item.episodes||null,chapters:item.chapters||null,
    volumes:item.volumes||null,season:item.season||'',seasonYear:item.seasonYear||(item.startDate&&item.startDate.year)||null,
    format:item.format||'',countryOfOrigin:item.countryOfOrigin||'',source:item.source||'',
    duration:Number(item.duration)||null,studios,nextAiringEpisode,trailer,
    siteUrl:item.siteUrl||'',isLicensed:!!item.isLicensed,isAdult:false,
    startDate:item.startDate||null,endDate:item.endDate||null,updatedAt:Number(item.updatedAt)||null
  };
}
async function fetchAllAnimeCollection({season=null,seasonYear=null,status=null}={}) {
  const all=[];
  const seen=new Set();
  const maxPages=12;
  let hasNextPage=true,page=1,total=0;
  while(hasNextPage&&page<=maxPages) {
    const query = status
      ? 'query HekomiFullAiring($page:Int!) { results: Page(page:$page,perPage:50) { pageInfo { currentPage hasNextPage total } media(type:ANIME,status:RELEASING,sort:[POPULARITY_DESC],isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } } }'
      : 'query HekomiFullSeason($page:Int!,$season:MediaSeason!,$seasonYear:Int!) { results: Page(page:$page,perPage:50) { pageInfo { currentPage hasNextPage total } media(type:ANIME,season:$season,seasonYear:$seasonYear,sort:[POPULARITY_DESC],isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } } }';
    const variables=status?{page}:{page,season,seasonYear};
    const payload=await requestAniList(query,variables);
    const result=payload.results||{};
    const pageInfo=result.pageInfo||{};
    for(const raw of (Array.isArray(result.media)?result.media:[])) {
      const media=packMedia(raw);
      if(media&&!seen.has(media.id)){seen.add(media.id);all.push(media);}
    }
    total=Number(pageInfo.total)||total;
    hasNextPage=!!pageInfo.hasNextPage;
    page++;
  }
  return {anime:all,total,hasMore:hasNextPage,source:'AniList',pagesFetched:page-1};
}

const syoboiAniListFallbackCache = { data: null, expiresAt: 0, pending: null };
const syoboiAniListTitleSearchCache = new Map();
const SYOBOI_ANILIST_SEARCH_FIELDS = 'id idMal type title { romaji english native } coverImage { color extraLarge large medium } nextAiringEpisode { airingAt timeUntilAiring episode } siteUrl startDate { year month day } endDate { year month day } episodes';
async function getSyoboiAniListCurrentlyReleasingAnime() {
  if (syoboiAniListFallbackCache.data && Date.now() < syoboiAniListFallbackCache.expiresAt) {
    return syoboiAniListFallbackCache.data;
  }
  if (syoboiAniListFallbackCache.pending) return syoboiAniListFallbackCache.pending;
  syoboiAniListFallbackCache.pending = (async () => {
    try {
      const collection = await fetchAllAnimeCollection({ status: 'RELEASING' });
      const anime = Array.isArray(collection.anime) ? collection.anime : [];
      syoboiAniListFallbackCache.data = anime;
      syoboiAniListFallbackCache.expiresAt = Date.now() + 15 * 60 * 1000;
      return anime;
    } finally {
      syoboiAniListFallbackCache.pending = null;
    }
  })();
  return syoboiAniListFallbackCache.pending;
}

async function searchSyoboiAniListTitles(programs) {
  const terms = syoboiAniListSearchTerms(programs, 96);
  const now = Date.now();
  const missing = [];
  for (const term of terms) {
    const key = term.normalize('NFKC').toLocaleLowerCase();
    if (!key) continue;
    const cached = syoboiAniListTitleSearchCache.get(key);
    if (cached && now < cached.expiresAt) continue;
    missing.push({ key, term });
  }

  // AniList search supports Japanese, romanized, and English title queries.
  // Batch aliases into a single GraphQL request instead of making one request
  // for every channel/episode row in the broadcast feed.
  for (let offset = 0; offset < missing.length; offset += 12) {
    const batch = missing.slice(offset, offset + 12);
    const definitions = batch.map((_, index) => '$term' + index + ':String!').join(',');
    const fields = batch.map((_, index) =>
      'match' + index + ':Media(search:$term' + index + ',type:ANIME,sort:[SEARCH_MATCH],isAdult:false){' +
      SYOBOI_ANILIST_SEARCH_FIELDS + '}'
    ).join(' ');
    const variables = Object.fromEntries(batch.map((item, index) => ['term' + index, item.term]));
    try {
      const payload = await requestAniList(
        'query HekomiSyoboiTitleSearch(' + definitions + '){' + fields + '}',
        variables
      );
      for (let index = 0; index < batch.length; index++) {
        const packed = packMedia(payload['match' + index]);
        syoboiAniListTitleSearchCache.set(batch[index].key, {
          data: packed ? [packed] : [],
          expiresAt: Date.now() + 12 * 60 * 60 * 1000
        });
      }
    } catch {
      // A temporary AniList failure must not poison the title cache for long.
      for (const item of batch) {
        syoboiAniListTitleSearchCache.set(item.key, {
          data: [],
          expiresAt: Date.now() + 60 * 1000
        });
      }
    }
  }

  const matches = new Map();
  for (const term of terms) {
    const key = term.normalize('NFKC').toLocaleLowerCase();
    const cached = syoboiAniListTitleSearchCache.get(key);
    for (const media of cached && Array.isArray(cached.data) ? cached.data : []) {
      if (media && media.id) matches.set(Number(media.id), media);
    }
  }
  return [...matches.values()];
}

async function getSyoboiAniListFallbackAnime(programs = []) {
  const [currentlyReleasing, titleMatches] = await Promise.all([
    getSyoboiAniListCurrentlyReleasingAnime().catch(() => []),
    searchSyoboiAniListTitles(programs).catch(() => [])
  ]);
  const merged = new Map();
  for (const media of [...titleMatches, ...currentlyReleasing]) {
    if (media && media.id && !merged.has(Number(media.id))) merged.set(Number(media.id), media);
  }
  return [...merged.values()];
}

let syoboiLastRequestAt = 0;
let syoboiRequestQueue = Promise.resolve();
async function fetchSyoboi(endpoint, options) {
  const task = syoboiRequestQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - syoboiLastRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    syoboiLastRequestAt = Date.now();
    return fetch(endpoint, options);
  });
  syoboiRequestQueue = task.catch(() => {});
  return task;
}

const syoboiCalendarCache = new Map();
const syoboiCalendarInFlight = new Map();

async function fetchSyoboiRssPrograms(start, days) {
  const [year, month, day] = start.split('-').map(Number);
  const allRows = [];
  // rss2.php documents a maximum 14-day window. Seven-day chunks stay
  // comfortably within its supported range and avoid month-size requests.
  for (let offset = 0; offset < days; offset += 7) {
    const chunkStart = new Date(Date.UTC(year, month - 1, day + offset));
    const ymd = chunkStart.getUTCFullYear() +
      String(chunkStart.getUTCMonth() + 1).padStart(2, '0') +
      String(chunkStart.getUTCDate()).padStart(2, '0') + '0000';
    const chunkDays = Math.min(7, days - offset);
    const endpoint = new URL('https://cal.syoboi.jp/rss2.php');
    endpoint.searchParams.set('start', ymd);
    endpoint.searchParams.set('days', String(chunkDays));
    endpoint.searchParams.set('alt', 'json');
    const response = await fetchSyoboi(endpoint, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Hekomi/1.0 (+https://hekomi.vercel.app; anime broadcast calendar)'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('Syoboi RSS fallback returned HTTP ' + response.status + '.');
    const payload = await response.json();
    allRows.push(...extractSyoboiProgramRows(payload));
  }
  const unique = new Map();
  for (const row of allRows) {
    const pid = String(syoboiField(row, 'PID') ?? '');
    const key = pid || [
      syoboiField(row, 'TID'),
      syoboiField(row, 'StTime') ?? syoboiField(row, 'StTimeU'),
      syoboiField(row, 'ChID')
    ].join(':');
    if (key) unique.set(key, row);
  }
  return [...unique.values()];
}

async function getSyoboiCalendar(rawStart, rawDays) {
  const start = String(rawStart || ''), days = Math.floor(Number(rawDays) || 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || days < 1 || days > 32) {
    throw new Error('Choose a valid calendar month.');
  }
  const startDate = new Date(start + 'T00:00:00Z');
  if (Number.isNaN(startDate.getTime()) || startDate.toISOString().slice(0, 10) !== start) {
    throw new Error('Choose a valid calendar date.');
  }
  const key = start + ':' + days, cached = syoboiCalendarCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  if (syoboiCalendarInFlight.has(key)) return syoboiCalendarInFlight.get(key);

  const request = (async () => {
    try {
      let programRows = [], titleRows = [], primaryError = null, feedRows = [], rss2Succeeded = false;
      // RSS2 is the date-scoped broadcast feed. The experimental json.php
      // ProgramByDate endpoint has returned current-week rows for past Start
      // dates, so it must not be the primary source for historical navigation.
      try {
        feedRows = await fetchSyoboiRssPrograms(start, days);
        rss2Succeeded = true;
        programRows = feedRows;
      } catch (error) {
        primaryError = error;
      }

      // If RSS2 is temporarily unavailable, keep the JSON endpoint as a
      // carefully date-validated fallback. Never show its current-week rows
      // when the user has navigated to another week.
      if (!programRows.length && primaryError) {
        try {
          const endpoint = new URL('https://cal.syoboi.jp/json.php');
          endpoint.searchParams.set('Req', 'ProgramByDate,TitleLarge');
          endpoint.searchParams.set('Start', start);
          endpoint.searchParams.set('Days', String(days));
          const response = await fetchSyoboi(endpoint, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Hekomi/1.0 (+https://hekomi.vercel.app; anime broadcast calendar)'
            },
            signal: AbortSignal.timeout(14000)
          });
          if (!response.ok) throw new Error('Syoboi Calendar returned HTTP ' + response.status + '.');
          const payload = await response.json();
          titleRows = syoboiRows(payload && (payload.Titles || payload.TitleLarge || payload.Title));
          programRows = extractSyoboiProgramRows(payload && (payload.Programs || payload));
        } catch (error) {
          primaryError = new Error(
            (primaryError && primaryError.message ? primaryError.message + ' ' : '') +
            'Date-validated Syoboi fallback failed: ' + String(error && error.message || error)
          );
        }
      }

      const now = new Date();
      const rangeEnd = new Date(startDate.getTime() + days * 86400000).toISOString().slice(0, 10);
      const allNormalizedPrograms = normalizeSyoboiPrograms(programRows, titleRows, feedRows, now);
      const normalizedPrograms = allNormalizedPrograms.filter(item =>
        item.date >= start && item.date < rangeEnd
      );
      if (!normalizedPrograms.length && !feedRows.length && primaryError) {
        throw primaryError;
      }

      // Enrich titles independently of nextAiringEpisode. Title searches also
      // find finished shows, so historical weeks do not depend on the current
      // RELEASING-only catalogue.
      let programs = [];
      try {
        const animeMetadata = await getSyoboiAniListFallbackAnime(normalizedPrograms);
        programs = enrichSyoboiPrograms(normalizedPrograms, animeMetadata, 300);
      } catch {
        // Fail closed instead of rendering Japanese-only, posterless records.
        programs = [];
      }
      const aniListFallbackCount = programs.length;
      const unresolvedTitles = Math.max(0, normalizedPrograms.length - programs.length);
      const data = {
        start, days, programs, total: programs.length,
        rawProgramCount: programRows.length,
        normalizedProgramCount: normalizedPrograms.length,
        titleCount: titleRows.length,
        fallbackProgramCount: feedRows.length,
        unresolvedTitleCount: unresolvedTitles,
        aniListFallbackCount,
        englishTitleOnly: true,
        source: (rss2Succeeded ? 'Syoboi RSS2 dated schedule' : 'Syoboi JSON date-validated fallback') + ' + AniList title search',
        timezone: 'Asia/Tokyo',
        updatedAt: new Date().toISOString()
      };
      const isHistorical = startDate.getTime() + days * 86400000 < Date.now();
      syoboiCalendarCache.set(key, {
        data,
        expiresAt: Date.now() + (isHistorical ? 12 * 60 * 60 * 1000 : 10 * 60 * 1000)
      });
      if (syoboiCalendarCache.size > 48) {
        syoboiCalendarCache.delete(syoboiCalendarCache.keys().next().value);
      }
      return data;
    } finally {
      syoboiCalendarInFlight.delete(key);
    }
  })();
  syoboiCalendarInFlight.set(key, request);
  return request;
}
async function getPublicCatalog(force=false) {
  if (!force && publicCatalogCache.data && Date.now() < publicCatalogCache.expiresAt) return publicCatalogCache.data;
  if (publicCatalogInFlight) return publicCatalogInFlight;
  publicCatalogInFlight = (async()=>{
    try {
      const now = new Date();
      const season=currentAnimeSeason(now),seasonYear=now.getUTCFullYear();
      const [data,airing,seasonal]=await Promise.all([
        requestAniList(HOME_CATALOG_QUERY,{}),
        fetchAllAnimeCollection({status:'RELEASING'}),
        fetchAllAnimeCollection({season,seasonYear})
      ]);
      const result = {
        anime:(data.anime && data.anime.media || []).map(packMedia).filter(Boolean),
        manga:(data.manga && data.manga.media || []).map(packMedia).filter(Boolean),
        airing:airing.anime,airingTotal:airing.total,airingHasMore:airing.hasMore,
        seasonal:seasonal.anime,seasonalTotal:seasonal.total,seasonalHasMore:seasonal.hasMore,
        season,seasonYear,
        source:'AniList',updatedAt:new Date().toISOString(),stale:false
      };
      publicCatalogCache.data = result;
      publicCatalogCache.expiresAt = Date.now() + 20*60*1000;
      return result;
    } catch (error) {
      if (publicCatalogCache.data) return {...publicCatalogCache.data,stale:true};
      throw error;
    } finally { publicCatalogInFlight = null; }
  })();
  return publicCatalogInFlight;
}
async function getSeasonCatalog(rawSeason,rawYear) {
  const season=String(rawSeason||'').toUpperCase();
  const year=Math.floor(Number(rawYear)||new Date().getUTCFullYear());
  if(!['WINTER','SPRING','SUMMER','FALL'].includes(season)) throw new Error('Choose a valid anime season.');
  if(year<1940||year>new Date().getUTCFullYear()+2) throw new Error('Choose a valid season year.');
  const key=season+':'+year, cached=seasonCatalogCache.get(key);
  if(cached&&Date.now()<cached.expiresAt)return cached.data;
  const collection=await fetchAllAnimeCollection({season,seasonYear:year});
  const data={season,seasonYear:year,anime:collection.anime,total:collection.total,hasMore:collection.hasMore,pagesFetched:collection.pagesFetched,source:'AniList',updatedAt:new Date().toISOString()};
  seasonCatalogCache.set(key,{data,expiresAt:Date.now()+30*60*1000});
  if(seasonCatalogCache.size>24)seasonCatalogCache.delete(seasonCatalogCache.keys().next().value);
  return data;
}

async function searchPublicCatalog(rawQuery, rawPage=1, rawFilters={}) {
  const query = String(rawQuery || '').trim().replace(/\s+/g,' ').slice(0,100);
  if (query && query.length < 2) throw new Error('Enter at least two characters, or leave the title empty to discover by filters.');
  const page = Math.max(1,Math.min(50,Math.floor(Number(rawPage)||1)));
  const typeValue = String(rawFilters.type || 'all').toUpperCase();
  const type = ['ANIME','MANGA'].includes(typeValue) ? typeValue : 'all';
  const validGenres = ['Action','Adventure','Avant Garde','Award Winning','Boys Love','Comedy','Drama','Ecchi','Fantasy','Girls Love','Gourmet','Hentai','Horror','Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Suspense','Thriller'];
  const parseGenres = value => [...new Set(String(value || '').split(',').map(g=>g.trim()).filter(g=>validGenres.includes(g)))].slice(0,validGenres.length);
  const genreIn = parseGenres(rawFilters.genreIn);
  const genreNotIn = parseGenres(rawFilters.genreNotIn).filter(g=>!genreIn.includes(g));
  const formats = ['TV','TV_SHORT','MOVIE','SPECIAL','OVA','ONA','MUSIC','MANGA','NOVEL','ONE_SHOT'];
  const statuses = ['RELEASING','FINISHED','NOT_YET_RELEASED','CANCELLED','HIATUS'];
  const seasons = ['WINTER','SPRING','SUMMER','FALL'];
  const format = formats.includes(String(rawFilters.format || '').toUpperCase()) ? String(rawFilters.format).toUpperCase() : null;
  const status = statuses.includes(String(rawFilters.status || '').toUpperCase()) ? String(rawFilters.status).toUpperCase() : null;
  const season = seasons.includes(String(rawFilters.season || '').toUpperCase()) ? String(rawFilters.season).toUpperCase() : null;
  const yearNumber = Math.floor(Number(rawFilters.year));
  const year = yearNumber >= 1940 && yearNumber <= 2100 ? yearNumber : null;
  const scoreNumber = Math.max(0,Math.min(10,Number(rawFilters.minScore)||0));
  const minScore = scoreNumber > 0 ? Math.max(0,Math.ceil(scoreNumber*10)-1) : null;
  const sortKey = String(rawFilters.sort || 'match');
  const sortMap = {match:query ? ['SEARCH_MATCH'] : ['TRENDING_DESC','POPULARITY_DESC'],score:['SCORE_DESC'],popular:['POPULARITY_DESC'],title:['TITLE_ROMAJI'],newest:['START_DATE_DESC']};
  const sort = sortMap[sortKey] || sortMap.match;
  const typeFilters = type === 'all' ? (season ? ['ANIME'] : ['ANIME','MANGA']) : [type];
  const filters = {type,genreIn,genreNotIn,format,status,season,year,score:scoreNumber,sort:sortKey};
  const key = JSON.stringify({query,page,filters});
  const cached = publicCatalogSearchCache.get(key);
  if (cached && Date.now() - cached.at < 10*60*1000) return cached.value;
  const pageFields = typeFilters.map(mediaType => {
    const alias = mediaType.toLowerCase();
    const animeSeasonArgs = mediaType === 'ANIME' ? ',season:$season,seasonYear:$seasonYear' : '';
    return alias + ': Page(page:$page,perPage:24) { pageInfo { currentPage hasNextPage } media(type:' + mediaType +
      ',search:$search,genre_in:$genreIn,genre_not_in:$genreNotIn,format_in:$formats,status:$status' + animeSeasonArgs +
      ',startDate_like:$startDateLike,averageScore_greater:$minScore,sort:$sort,isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } }';
  }).join(' ');
  const discoveryQuery = 'query HekomiCatalogDiscovery($search:String,$page:Int!,$genreIn:[String],$genreNotIn:[String],$formats:[MediaFormat],$status:MediaStatus,$season:MediaSeason,$seasonYear:Int,$startDateLike:String,$minScore:Int,$sort:[MediaSort]) { ' + pageFields + ' }';
  const variables = {search:query || null,page,genreIn:genreIn.length?genreIn:null,genreNotIn:genreNotIn.length?genreNotIn:null,formats:format?[format]:null,status,season,seasonYear:season ? (year || null) : null,startDateLike:year ? String(year)+'%' : null,minScore,sort};
  const data = await requestAniList(discoveryQuery,variables);
  const animePage=data.anime||{},mangaPage=data.manga||{};
  const result = {anime:(animePage.media||[]).map(packMedia).filter(Boolean),manga:(mangaPage.media||[]).map(packMedia).filter(Boolean),page,hasNextPage:!!((animePage.pageInfo&&animePage.pageInfo.hasNextPage)||(mangaPage.pageInfo&&mangaPage.pageInfo.hasNextPage)),source:'AniList',updatedAt:new Date().toISOString(),filters};
  publicCatalogSearchCache.set(key,{at:Date.now(),value:result});
  if (publicCatalogSearchCache.size > 160) publicCatalogSearchCache.delete(publicCatalogSearchCache.keys().next().value);
  return result;
}
async function getMediaByMalId(idMal) {
  const id=Number(idMal);
  if(!Number.isSafeInteger(id)||id<1) return null;
  const key='mal:'+id, cached=mediaDetailCache.get(key);
  if(cached&&Date.now()<cached.expiresAt)return cached.value;
  const data=await requestAniList(MEDIA_MAL_DETAIL_QUERY,{idMal:id});
  const media=packMedia(data.Media);
  if(media){mediaDetailCache.set(key,{value:media,expiresAt:Date.now()+60*60*1000});if(mediaDetailCache.size>300)mediaDetailCache.delete(mediaDetailCache.keys().next().value);}
  return media;
}
async function getMediaDetail(id, expectedKind) {
  const key = String(id);
  const cached = mediaDetailCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    if (!expectedKind || String(cached.value.type).toLowerCase() === expectedKind) return cached.value;
    return null;
  }
  const data = await requestAniList(MEDIA_DETAIL_QUERY,{id:Number(id)});
  const raw = data.Media;
  if (!raw || raw.isAdult || (expectedKind && String(raw.type).toLowerCase() !== expectedKind)) return null;
  const media = packMedia(raw);
  if (media) {
    mediaDetailCache.set(key,{value:media,expiresAt:Date.now()+60*60*1000});
    if (mediaDetailCache.size > 300) mediaDetailCache.delete(mediaDetailCache.keys().next().value);
  }
  return media;
}
function sendHtml(res,status,body,headers={}) {
  res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'public, max-age=300, stale-while-revalidate=1800',...headers});
  res.end(body);
}
function renderMediaPage(req,kind,media) {
  const origin = publicOrigin(req);
  const canonical = origin + '/series/' + kind + '/' + media.id + '-' + mediaSlug(media.title);
  const label = kind === 'anime' ? 'Anime' : (media.countryOfOrigin==='KR'?'Manhwa':media.countryOfOrigin==='CN'?'Manhua':'Manga');
  const synopsis = String(media.description || '').replace(/\s+/g,' ').trim();
  const titleLead = String(media.title || 'Untitled').trim();
  const compactTitle = titleLead.length > 42 ? titleLead.slice(0,39).replace(/\s+\S*$/,'') + '…' : titleLead;
  const pageTitle = compactTitle + ' — ' + label + ' | Hekomi';
  const descriptionSuffix = ' Explore the synopsis, genres and details on Hekomi.';
  const descriptionLead = synopsis || ('Discover ' + titleLead + ' and its catalog information.');
  const description = descriptionLead.slice(0,Math.max(0,155-descriptionSuffix.length)).replace(/\s+\S*$/,'') + descriptionSuffix;
  const cover = media.cover && /^https:\/\//i.test(media.cover) ? media.cover : '';
  const score = media.averageScore ? (media.averageScore/10).toFixed(1) + '/10' : 'Not rated';
  const firstGenre=Array.isArray(media.genres)?media.genres[0]||'':'';
  const mainGenre=String(typeof firstGenre==='string'?firstGenre:firstGenre&&firstGenre.name||'').toLowerCase().trim();
  const detailGenre=/horror|thriller|psychological/.test(mainGenre)?'horror':/romance/.test(mainGenre)?'romance':/fantasy|magic|myth/.test(mainGenre)?'fantasy':/science fiction|sci-fi|science-fiction|cyberpunk|space/.test(mainGenre)?'scifi':/mystery|suspense/.test(mainGenre)?'mystery':/comedy|parody/.test(mainGenre)?'comedy':/slice of life/.test(mainGenre)?'slice':/sports/.test(mainGenre)?'sports':/action|adventure|martial arts|mecha/.test(mainGenre)?'action':/drama/.test(mainGenre)?'drama':'dream';
  const dateText = value => {
    if(!value)return '';
    const year=Number(value.year)||null,month=Number(value.month)||null,day=Number(value.day)||null;
    if(!year)return '';
    if(!month)return String(year);
    if(!day)return new Date(Date.UTC(year,month-1,1)).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
    return new Date(Date.UTC(year,month-1,day)).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
  };
  const sourceLabel = String(media.source||'').replace(/_/g,' ').toLowerCase().replace(/\b\w/g,ch=>ch.toUpperCase());
  const seasonLabel = [media.season,media.seasonYear].filter(Boolean).join(' ');
  const nextEpisodeLabel = media.nextAiringEpisode && media.nextAiringEpisode.airingAt
    ? 'Episode '+(media.nextAiringEpisode.episode||'?')+' · '+new Date(media.nextAiringEpisode.airingAt*1000).toISOString().replace('T',' ').slice(0,16)+' UTC'
    : '';
  const details = [
    ['Format',media.format],['Release status',String(media.status||'').replace(/_/g,' ')],
    ['First aired',dateText(media.startDate)],['Last aired',dateText(media.endDate)],
    ['Season',seasonLabel],['Episodes',kind==='anime'?media.episodes:null],
    ['Episode length',kind==='anime'&&media.duration?media.duration+' minutes':null],
    ['Next episode',kind==='anime'?nextEpisodeLabel:null],
    ['Source material',sourceLabel],['Studio',(media.studios||[]).join(', ')],
    ['Country',media.countryOfOrigin],['Popularity',media.popularity?Number(media.popularity).toLocaleString():null],
    ['Favorites',media.favourites?Number(media.favourites).toLocaleString():null],
    ['Chapters',kind==='manga'?media.chapters:null],['Volumes',kind==='manga'?media.volumes:null]
  ].filter(pair=>pair[1] !== null && pair[1] !== undefined && pair[1] !== '');
  const infoRows = details.map(pair=>'<div class="info-cell"><dt>'+htmlEscape(pair[0])+'</dt><dd>'+htmlEscape(String(pair[1]).replace(/_/g,' '))+'</dd></div>').join('');
  const seriesSchema = {
    '@type':kind==='anime' && media.format==='MOVIE'?'Movie':kind==='anime'?'TVSeries':'ComicSeries',
    name:media.title,description:synopsis || description,url:canonical,
    image:cover || undefined,genre:media.genres && media.genres.length ? media.genres : undefined,
    inLanguage:'en'
  };
  const breadcrumbSchema = {
    '@type':'BreadcrumbList',
    itemListElement:[
      {'@type':'ListItem',position:1,name:'Home',item:origin+'/'},
      {'@type':'ListItem',position:2,name:label,item:origin+'/catalog/'+kind},
      {'@type':'ListItem',position:3,name:media.title}
    ]
  };
  const jsonLd = JSON.stringify({'@context':'https://schema.org','@graph':[seriesSchema,breadcrumbSchema]}).replace(/</g,'\\u003c');
  const coverHtml = cover ? '<img class="detail-cover" src="'+htmlEscape(cover)+'" alt="Cover artwork for '+htmlEscape(media.title)+' ('+label+')" title="Cover artwork for '+htmlEscape(media.title)+'" width="280" height="420" fetchpriority="high" decoding="async" referrerpolicy="no-referrer">' : '<div class="detail-cover detail-cover-missing" role="img" aria-label="No cover artwork available">H</div>';
  const detailBackdropHtml = cover ? '<div class="detail-art-backdrop" aria-hidden="true"><img src="'+htmlEscape(cover)+'" alt="Blurred background artwork for '+htmlEscape(media.title)+'" fetchpriority="high" decoding="async" referrerpolicy="no-referrer"></div>' : '<div class="detail-art-backdrop detail-art-backdrop-empty" aria-hidden="true"></div>';
  const metaImage = cover || (origin + '/assets/hekomi-social.svg');
  const malLink = kind==='anime' && media.idMal ? '<a class="detail-secondary" href="https://myanimelist.net/anime/'+Number(media.idMal)+'" rel="noreferrer" target="_blank">Open on MyAnimeList ↗</a>' : '';
  const trailerRawId = kind==='anime' && media.trailer && String(media.trailer.site||'').toLowerCase()==='youtube' ? String(media.trailer.id||'').trim() : '';
  const trailerVideoId = /^[A-Za-z0-9_-]{11}$/.test(trailerRawId) ? trailerRawId : '';
  const trailerThumbnailRaw = trailerVideoId && media.trailer && /^https:\/\/(?:img\.youtube\.com|i\.ytimg\.com)\//i.test(String(media.trailer.thumbnail||'')) ? String(media.trailer.thumbnail) : '';
  const trailerThumbnail = trailerThumbnailRaw || (trailerVideoId ? 'https://img.youtube.com/vi/'+trailerVideoId+'/hqdefault.jpg' : '');
  const trailerHtml = kind!=='anime' ? '' : trailerVideoId
    ? '<section class="detail-trailer" aria-labelledby="detail-trailer-title"><div class="detail-trailer-heading"><div><span class="detail-trailer-kicker">WATCH THE TRAILER</span><h2 id="detail-trailer-title">A first look at '+htmlEscape(media.title)+'</h2><p>Watch the trailer without leaving Hekomi.</p></div><a class="detail-trailer-youtube" href="https://www.youtube.com/watch?v='+trailerVideoId+'" target="_blank" rel="noopener noreferrer">View on YouTube ↗</a></div><div class="detail-trailer-stage" data-trailer-stage><button class="detail-trailer-play" type="button" data-trailer-play data-trailer-id="'+trailerVideoId+'" aria-label="Play trailer for '+htmlEscape(media.title)+'"><img src="'+htmlEscape(trailerThumbnail)+'" alt="Trailer thumbnail for '+htmlEscape(media.title)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="detail-trailer-shade"></span><span class="detail-trailer-play-icon" aria-hidden="true">▶</span><span class="detail-trailer-play-label">Play trailer</span></button></div><p class="detail-trailer-caption">Trailer listed by AniList · Playback hosted by YouTube</p></section>'
    : '<section class="detail-trailer detail-trailer-empty" aria-labelledby="detail-trailer-title"><div><span class="detail-trailer-kicker">TRAILER</span><h2 id="detail-trailer-title">No trailer listed yet</h2><p>No YouTube trailer is listed in the catalogue for this title yet.</p></div></section>';
  const trailerStyles = '<style>.detail-trailer{margin:0 0 28px;padding:clamp(16px,3vw,26px);border:1px solid #35304a;border-radius:18px;background:radial-gradient(ellipse at 90% 5%,#7c5bb52a,transparent 36%),linear-gradient(135deg,#131225,#0d121a 80%);box-shadow:0 16px 40px #0004}.detail-trailer-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px}.detail-trailer-kicker{font-size:10px;letter-spacing:.18em;color:#b9a6ff;font-weight:850}.detail-trailer h2{font-size:clamp(20px,3vw,27px);line-height:1.15;letter-spacing:-.035em;margin:6px 0}.detail-trailer p{margin:0;color:#aeb1c2;font-size:12px}.detail-trailer-youtube{color:#d2c7ff;text-decoration:none;font-size:12px;white-space:nowrap}.detail-trailer-youtube:hover{text-decoration:underline}.detail-trailer-stage{position:relative;width:100%;aspect-ratio:16/9;max-height:650px;overflow:hidden;border-radius:12px;background:#05060b}.detail-trailer-play{position:relative;display:grid;place-items:center;width:100%;height:100%;padding:0;border:0;background:#05060b;color:#fff;cursor:pointer;overflow:hidden}.detail-trailer-play img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .5s,filter .35s}.detail-trailer-play:hover img{transform:scale(1.025);filter:brightness(.7)}.detail-trailer-shade{position:absolute;inset:0;background:linear-gradient(0deg,#070712aa,transparent 58%),linear-gradient(90deg,#05050d35,transparent)}.detail-trailer-play-icon{position:relative;display:grid;place-items:center;width:68px;height:68px;padding-left:5px;border:1px solid #ffffffb0;border-radius:50%;background:#100f20b8;box-shadow:0 8px 32px #0008;font-size:23px;backdrop-filter:blur(8px);transition:transform .2s}.detail-trailer-play:hover .detail-trailer-play-icon{transform:scale(1.08)}.detail-trailer-play:focus-visible{outline:3px solid #b9a6ff;outline-offset:-4px}.detail-trailer-play-label{position:absolute;left:20px;bottom:17px;color:#fff;font-weight:750;font-size:13px;text-shadow:0 2px 8px #000}.detail-trailer-stage iframe{display:block;width:100%;height:100%;border:0}.detail-trailer-caption{margin-top:9px!important;font-size:10px!important}.detail-trailer-empty{display:flex;align-items:center;min-height:135px}.detail-trailer-empty h2{margin-bottom:7px}@media(max-width:650px){.detail-trailer{padding:13px;border-radius:13px}.detail-trailer-heading{align-items:flex-start;flex-direction:column;gap:8px}.detail-trailer-youtube{font-size:11px}.detail-trailer-stage{border-radius:9px}.detail-trailer-play-icon{width:54px;height:54px;font-size:19px}.detail-trailer-play-label{left:12px;bottom:10px;font-size:11px}}@media(prefers-color-scheme:light){.detail-trailer{border-color:#ded2e5;background:radial-gradient(ellipse at 90% 5%,#bca9df38,transparent 36%),linear-gradient(135deg,#fffaff,#f1edf7 80%);box-shadow:0 12px 30px #39234b12}.detail-trailer-kicker,.detail-trailer-youtube{color:#7050a4}.detail-trailer p{color:#6e6577}}</style>';
  const detailVisualStyles = `<style>
body{position:relative;isolation:isolate;overflow-x:hidden}
.detail-art-backdrop{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;--detail-accent:#a9f0db}
.detail-art-backdrop img{display:block;width:100%;height:100%;object-fit:cover;filter:blur(34px) saturate(.68);opacity:.23;transform:scale(1.15);animation:hkDetailBackdrop 1.1s ease-out both}
.detail-art-backdrop:before,.detail-art-backdrop:after{content:"";position:absolute;inset:0;pointer-events:none}
.detail-art-backdrop:before{background:radial-gradient(ellipse at 72% 8%,color-mix(in srgb,var(--detail-accent) 28%,transparent),transparent 55%)}
.detail-art-backdrop:after{background:linear-gradient(180deg,#08091655 0%,#080916bd 45%,#080916 100%),linear-gradient(90deg,#080916aa,transparent 65%)}
.detail-wrap{position:relative;z-index:1}
.detail-cover{animation:hkDetailCover .72s cubic-bezier(.16,.78,.2,1) both}
.detail-hero>div:last-child{animation:hkDetailCopy .62s ease-out .12s both}
.detail-trailer,.detail-info{animation:hkDetailCopy .65s ease-out .2s both}
body[data-detail-genre="action"] .detail-art-backdrop{--detail-accent:#ff684f}
body[data-detail-genre="romance"] .detail-art-backdrop{--detail-accent:#ff91c7}
body[data-detail-genre="fantasy"] .detail-art-backdrop{--detail-accent:#a98bff}
body[data-detail-genre="horror"] .detail-art-backdrop{--detail-accent:#d83e56}
body[data-detail-genre="scifi"] .detail-art-backdrop{--detail-accent:#66e8ed}
body[data-detail-genre="mystery"] .detail-art-backdrop{--detail-accent:#7289df}
body[data-detail-genre="comedy"] .detail-art-backdrop{--detail-accent:#f7d56a}
body[data-detail-genre="slice"] .detail-art-backdrop{--detail-accent:#8de0bd}
body[data-detail-genre="sports"] .detail-art-backdrop{--detail-accent:#f6a55d}
body[data-detail-genre="drama"] .detail-art-backdrop{--detail-accent:#b2a1d8}
@keyframes hkDetailBackdrop{from{opacity:0;transform:scale(1.22)}to{opacity:.23;transform:scale(1.15)}}
@keyframes hkDetailCover{from{opacity:0;transform:translateY(22px) scale(.94) rotate(-1deg)}to{opacity:1;transform:translateY(0) scale(1) rotate(0)}}
@keyframes hkDetailCopy{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.detail-art-backdrop img,.detail-cover,.detail-hero>div:last-child,.detail-trailer,.detail-info{animation:none!important}}
@media(prefers-color-scheme:light){.detail-art-backdrop img{opacity:.14}.detail-art-backdrop:after{background:linear-gradient(180deg,#f6f1f988 0%,#f6f1f9e8 50%,#f6f1f9 100%),linear-gradient(90deg,#f6f1f9dd,transparent 70%)}}
</style>`;
  const trailerPlayerScript = trailerVideoId ? '<script>(function(){document.querySelectorAll("[data-trailer-play]").forEach(function(button){button.addEventListener("click",function(){var id=button.getAttribute("data-trailer-id");if(!/^[A-Za-z0-9_-]{11}$/.test(id||""))return;var stage=button.closest("[data-trailer-stage]");if(!stage)return;var frame=document.createElement("iframe");frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(id)+"?autoplay=1&playsinline=1&rel=0";frame.title="YouTube anime trailer";frame.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";frame.allowFullscreen=true;frame.referrerPolicy="strict-origin-when-cross-origin";frame.loading="eager";stage.replaceChildren(frame);},{once:true});});})();</script>' : '';
  const genreTags = (media.genres||[]).map(g=>{const name=String(g||'');const match=SEO_GENRES.find(item=>item.name.toLowerCase()===name.toLowerCase());return match?'<a class="genre-pill" href="/genres/'+kind+'/'+match.slug+'">'+htmlEscape(name)+'</a>':'<span class="genre-pill">'+htmlEscape(name)+'</span>';}).join('');
  const descriptionHtml = synopsis ? '<p class="detail-synopsis">'+htmlEscape(synopsis).replace(/\n/g,'<br>')+'</p>' : '<p class="detail-synopsis">No synopsis is available from the catalog source yet.</p>';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<title>'+htmlEscape(pageTitle)+'</title><meta name="description" content="'+htmlEscape(description)+'">',
    '<meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#080916">',
    '<link rel="canonical" href="'+htmlEscape(canonical)+'"><link rel="icon" href="/favicon.ico?v=20261101" type="image/x-icon" sizes="any">',
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Hekomi"><meta property="og:title" content="'+htmlEscape(pageTitle)+'"><meta property="og:description" content="'+htmlEscape(description)+'"><meta property="og:url" content="'+htmlEscape(canonical)+'"><meta property="og:image" content="'+htmlEscape(metaImage)+'"><meta property="og:image:alt" content="Cover artwork for '+htmlEscape(media.title)+'"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+htmlEscape(pageTitle)+'"><meta name="twitter:description" content="'+htmlEscape(description)+'"><meta name="twitter:image" content="'+htmlEscape(metaImage)+'"><meta name="twitter:image:alt" content="Cover artwork for '+htmlEscape(media.title)+'">',
    '<script type="application/ld+json">'+jsonLd+'</script>',
    trailerStyles,
    detailVisualStyles,
    '<link rel="stylesheet" href="/assets/hekomi-chan.css?v=20261102-activities">',
    '<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;color:#f2f4f8;background:radial-gradient(ellipse at 75% 0,rgba(116,75,160,.2),transparent 45%),#080916;font:16px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}.detail-wrap{width:min(1120px,calc(100% - 36px));margin:auto}.detail-header{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #292d4b}.detail-brand{color:#c6b7ff;font-weight:850;font-size:21px;text-decoration:none;letter-spacing:.03em}.detail-back{color:#c6b7ff;text-decoration:none;font-size:13px}.breadcrumbs{margin:25px 0;color:#9ca4c4;font-size:12px}.breadcrumbs a{color:#b9a6ff;text-decoration:none}.detail-hero{display:grid;grid-template-columns:minmax(180px,280px) minmax(0,1fr);gap:clamp(25px,5vw,65px);align-items:start;padding:20px 0 45px}.detail-cover{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:cover;border-radius:15px;border:1px solid #ffffff1c;background:#151327;box-shadow:0 25px 55px #0008}.detail-cover-missing{display:grid;place-items:center;color:#b9a6ff;font-size:70px}.detail-type{color:#8be1cf;font-size:11px;letter-spacing:.17em;font-weight:850;text-transform:uppercase}.detail-title{font-size:clamp(32px,5vw,55px);line-height:1.05;letter-spacing:-.05em;margin:9px 0 13px}.detail-score{display:inline-flex;gap:8px;align-items:center;padding:7px 11px;border-radius:9px;background:#19172a;border:1px solid #41385b;color:#e3d7ff;font-weight:750;font-size:13px}.detail-genres{display:flex;gap:7px;flex-wrap:wrap;margin:16px 0}.genre-pill{text-decoration:none;transition:background .2s,border-color .2s}.genre-pill:hover{background:#ffffff10;border-color:#8e82b4}.genre-pill{font-size:12px;color:#c4bdd9;border:1px solid #39334a;border-radius:99px;padding:5px 9px}.detail-synopsis{margin:18px 0 23px;color:#c3c5d1;white-space:normal}.detail-actions{display:flex;flex-wrap:wrap;gap:10px}.detail-primary,.detail-secondary{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;padding:10px 15px;border-radius:11px;font-weight:750;font-size:13px}.detail-primary{background:#b9a6ff;color:#171222}.detail-secondary{border:1px solid #39334a;color:#e8e3f3}.detail-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:0 0 28px}.info-cell{border:1px solid #292d4b;background:#101327;border-radius:12px;padding:12px}.info-cell dt{font-size:11px;color:#9ca4c4;text-transform:uppercase;letter-spacing:.08em}.info-cell dd{margin:5px 0 0;font-size:14px;font-weight:750}.detail-credit{border-top:1px solid #292d4b;padding:19px 0 35px;color:#8f96ad;font-size:11px}.detail-credit a{color:#b9a6ff}@media(max-width:650px){.detail-hero{grid-template-columns:110px minmax(0,1fr);gap:17px;padding-top:8px}.detail-title{font-size:28px}.detail-cover{border-radius:9px}.detail-synopsis{grid-column:1/-1;margin-top:10px}.detail-info{grid-template-columns:repeat(2,minmax(0,1fr))}.detail-header{height:64px}.detail-wrap{width:calc(100% - 26px)}}@media(prefers-color-scheme:light){body{background:#f6f1f9;color:#282333}.detail-header,.detail-credit{border-color:#ded2e5}.detail-brand,.breadcrumbs a,.detail-back,.detail-credit a{color:#7050a4}.detail-type{color:#287a6b}.detail-score{background:#eee6f6;border-color:#d9cae8;color:#4c3670}.genre-pill,.detail-secondary{color:#554563;border-color:#ded2e5}.detail-synopsis{color:#61576a}.info-cell{background:#fffaff;border-color:#ded2e5}.info-cell dt{color:#756b7b}.detail-primary{background:#7050a4;color:#fff}}</style>',
    '</head><body data-detail-genre="'+detailGenre+'">'+detailBackdropHtml+'<div class="detail-wrap"><header class="detail-header"><a class="detail-brand" href="/">Hekomi</a><a class="detail-back" href="/">← Back to discovery</a></header>',
    '<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/catalog/'+kind+'">'+label+'</a> / <span aria-current="page">'+htmlEscape(media.title)+'</span></nav>',
    '<main><article class="detail-article"><section class="detail-hero"><div>'+coverHtml+'</div><div><div class="detail-type">'+label+' / '+htmlEscape(media.format||'SERIES')+'</div><h1 class="detail-title">'+htmlEscape(media.title)+'</h1><div class="detail-score">★ '+score+'</div><div class="detail-genres">'+genreTags+'</div>'+descriptionHtml+'<div class="detail-actions"><a class="detail-primary" href="/">Explore Hekomi ↗</a><a class="detail-secondary" href="https://anilist.co/'+kind+'/'+Number(media.id)+'/" target="_blank" rel="noreferrer">Source details ↗</a>'+malLink+'</div></div></section>',
    trailerHtml,
    trailerPlayerScript,
    '<dl class="detail-info">'+infoRows+'</dl></article></main>',
    '<footer class="detail-credit">Catalog metadata supplied by <a href="https://anilist.co/" target="_blank" rel="noreferrer">AniList</a>. Cover artwork belongs to its respective rights holders. Hekomi is an independent project and is not affiliated with AniList, MyAnimeList, studios, or publishers.</footer></div>',
    '<div class="home-visual hekomi-profile-companion" aria-label="Hekomi-chan, your wandering pixel companion"><div class="home-mascot-bubble"><span>HEKOMI-CHAN / ONLINE</span><strong id="hekomiChanMessage" aria-live="polite">I’m keeping an eye on this series.</strong></div><canvas class="home-mascot" id="hekomiChanCanvas" width="64" height="80" role="img" aria-label="Hekomi-chan, the pixel-art Hekomi mascot.">Hekomi-chan</canvas></div>',
    '<script defer src="/assets/hekomi-chan.js?v=20261102-activities-2"></script></body></html>'
  ].join('');
}

const SEO_GENRES = [
  {
    slug:'action',name:'Action',
    anime:'Action anime puts momentum first: high-pressure confrontations, training arcs, tactical fights and characters forced to adapt. This collection is a starting point for exploring the genre, with a full series page behind every title.',
    manga:'Explore action manga built around decisive clashes, ambitious journeys and characters tested by difficult choices. Each listing opens a title page with its catalog synopsis, genres and available details.'
  },
  {
    slug:'adventure',name:'Adventure',
    anime:'Adventure anime is about the pull of the unknown: unfamiliar places, long journeys, discoveries and the people met along the way. Browse popular starting points and follow the detail pages to compare each series.',
    manga:'Adventure manga follows journeys that keep expanding, from new worlds and strange places to personal quests. This collection makes it easier to move from one premise to the next without relying on a title search.'
  },
  {
    slug:'fantasy',name:'Fantasy',
    anime:'Fantasy anime ranges from elaborate magic systems and other worlds to folklore, myth and quiet wonder. Use this collection to explore different kinds of fantasy, then open each series for its synopsis and catalog details.',
    manga:'Discover fantasy manga shaped by magic, mythology, invented worlds and unusual rules. The titles below are drawn from the live catalog, so each series page can be checked before adding it to a reading list.'
  },
  {
    slug:'horror',name:'Horror',
    anime:'Horror anime explores dread in many forms, including supernatural threats, unsettling mysteries and psychological fear. Start with the titles below and compare their premises, genres and release information.',
    manga:'Horror manga can build tension through the uncanny, body horror, folklore or an atmosphere that slowly turns hostile. Browse the current catalog and open a series page for its synopsis and listed genres.'
  },
  {
    slug:'mystery',name:'Mystery',
    anime:'Mystery anime rewards attention: hidden motives, incomplete clues and stories that invite you to question what you have seen. This collection is a practical route into mystery titles from the wider anime catalog.',
    manga:'Explore mystery manga where secrets, investigations and uncertain motives drive the story. Each listing leads to a detail page, making it easier to compare premises before choosing what to read.'
  },
  {
    slug:'psychological',name:'Psychological',
    anime:'Psychological anime turns inward, examining perception, pressure, identity and the choices people make under stress. Browse the popular catalog picks below and open a title to read its full synopsis and metadata.',
    manga:'Psychological manga focuses on inner conflict, shifting perspectives and the tension between what characters believe and what is true. Explore the live catalog below rather than relying on a static recommendation list.'
  },
  {
    slug:'romance',name:'Romance',
    anime:'Romance anime covers everything from quiet character studies to dramatic relationships and comedy. This collection gives you a genre-first way to discover titles and compare their catalog details.',
    manga:'Find romance manga across different tones, from gentle everyday relationships to high-drama stories. Open any title for its synopsis, genre information and available publication details.'
  },
  {
    slug:'sci-fi',name:'Sci-Fi',
    anime:'Science-fiction anime uses technology, space, speculative futures and unfamiliar systems to explore what might come next. Browse the titles below and follow their detail pages for more context.',
    manga:'Sci-fi manga explores imagined technologies, futures and realities, from grounded speculation to far-reaching space stories. This collection links directly to individual series pages in the Hekomi catalog.'
  },
  {
    slug:'slice-of-life',name:'Slice of Life',
    anime:'Slice of life anime finds its stories in everyday routines, friendships, family and small changes over time. Explore the catalog below for a calmer route into anime discovery.',
    manga:'Slice of life manga gives everyday moments room to matter, following relationships, routines and gradual personal change. Browse current catalog entries and open each title for its synopsis.'
  },
  {
    slug:'supernatural',name:'Supernatural',
    anime:'Supernatural anime brings spirits, unexplained phenomena and otherworldly rules into its stories. Browse the available titles below and use each detail page to check the premise and genres.',
    manga:'Explore supernatural manga about spirits, strange encounters and the hidden side of ordinary places. The listings connect to individual series pages with source metadata and synopses.'
  }
];

function seoCatalogPath(kind, genre) {
  return genre ? '/genres/' + kind + '/' + genre.slug : '/catalog/' + kind;
}

async function getSeoCatalogItems(kind, genre) {
  const mediaType = kind === 'anime' ? 'ANIME' : 'MANGA';
  const genreArgument = genre ? ',genre_in:$genreIn' : '';
  const query = 'query HekomiSeoCollection($page:Int!,$genreIn:[String]) { results: Page(page:$page,perPage:24) { pageInfo { currentPage hasNextPage } media(type:' + mediaType + genreArgument + ',sort:[POPULARITY_DESC],isAdult:false) { ' + MEDIA_CATALOG_FIELDS + ' } } }';
  const data = await requestAniList(query,{page:1,genreIn:genre?[genre.name]:null});
  const results = data.results && Array.isArray(data.results.media) ? data.results.media : [];
  return results.map(packMedia).filter(Boolean);
}

async function getSeoCatalogFallback(kind, genre) {
  const catalog = await getPublicCatalog();
  const source = kind === 'anime'
    ? [...(catalog.anime||[]),...(catalog.airing||[]),...(catalog.seasonal||[])]
    : [...(catalog.manga||[])];
  const unique = new Map();
  for (const item of source) {
    const id = Number(item && item.id);
    if (Number.isSafeInteger(id) && id > 0 && !unique.has(id)) unique.set(id,item);
  }
  let items = [...unique.values()];
  if (genre) {
    items = items.filter(item => (Array.isArray(item.genres)?item.genres:[])
      .some(name => String(name||'').toLowerCase() === genre.name.toLowerCase()));
  }
  return items.sort((a,b)=>(Number(b.popularity)||0)-(Number(a.popularity)||0)).slice(0,24);
}

function renderSeoCatalogPage(req, kind, genre, items) {
  const origin = publicOrigin(req);
  const isAnime = kind === 'anime';
  const kindLabel = isAnime ? 'Anime' : 'Manga';
  const title = genre
    ? 'Popular ' + genre.name + ' ' + kindLabel + ' to Discover | Hekomi'
    : (isAnime ? 'Anime Discovery & Popular Series | Hekomi' : 'Manga Discovery & Popular Series | Hekomi');
  const description = genre
    ? (genre.name + ' ' + kindLabel.toLowerCase() + ': ' + genre[isAnime ? 'anime' : 'manga']).replace(/\s+/g,' ').slice(0,158)
    : (isAnime
      ? 'Explore popular anime by genre, compare series synopses and open detailed catalog pages for release information, scores and more.'
      : 'Explore popular manga by genre, compare series synopses and open detailed catalog pages for story information, genres and more.');
  const canonicalPath = seoCatalogPath(kind, genre);
  const canonical = origin + canonicalPath;
  const heading = genre ? 'Explore ' + genre.name + ' ' + kindLabel : 'Explore ' + kindLabel;
  const intro = genre
    ? genre[isAnime ? 'anime' : 'manga']
    : (isAnime
      ? 'A genre-first way to find your next series. Browse popular anime, move between themes, and open a title for its synopsis, genres, score and release details.'
      : 'A genre-first way to find your next read. Browse popular manga, move between themes, and open a title for its synopsis, genres and available publication details.');
  const safeItems = (Array.isArray(items) ? items : []).filter(item => Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0).slice(0,24);
  const itemList = safeItems.map((item,index) => ({
    '@type':'ListItem',
    position:index + 1,
    name:item.title,
    url:origin + '/series/' + kind + '/' + Number(item.id) + '-' + mediaSlug(item.title)
  }));
  const jsonLd = JSON.stringify({
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'CollectionPage',name:title,description,url:canonical,isPartOf:{'@type':'WebSite',name:'Hekomi',url:origin+'/'}},
      {'@type':'ItemList',name:heading + ' catalog',itemListElement:itemList},
      {'@type':'BreadcrumbList',itemListElement:[
        {'@type':'ListItem',position:1,name:'Home',item:origin+'/'},
        {'@type':'ListItem',position:2,name:kindLabel,item:origin+'/catalog/'+kind},
        ...(genre ? [{'@type':'ListItem',position:3,name:genre.name + ' ' + kindLabel,item:canonical}] : [])
      ]}
    ]
  }).replace(/</g,'\\u003c');
  const genreNav = SEO_GENRES.map(entry => {
    const selected = genre && genre.slug === entry.slug;
    return '<a class="genre-link' + (selected ? ' is-current' : '') + '" href="' + seoCatalogPath(kind,entry) + '"' + (selected ? ' aria-current="page"' : '') + '>' + htmlEscape(entry.name) + '</a>';
  }).join('');
  const cards = safeItems.map(item => {
    const itemUrl = '/series/' + kind + '/' + Number(item.id) + '-' + mediaSlug(item.title);
    const cover = item.cover && /^https:\/\//i.test(item.cover) ? item.cover : '';
    const score = Number(item.averageScore) > 0 ? (Number(item.averageScore)/10).toFixed(1) : '';
    const synopsis = String(item.description || '').replace(/\s+/g,' ').trim();
    const shortSynopsis = synopsis.length > 190 ? synopsis.slice(0,187).replace(/\s+\S*$/,'') + '…' : synopsis;
    const coverHtml = cover
      ? '<img src="' + htmlEscape(cover) + '" alt="Cover artwork for ' + htmlEscape(item.title) + '" loading="lazy" decoding="async" width="160" height="240" referrerpolicy="no-referrer">'
      : '<span class="cover-fallback" aria-hidden="true">H</span>';
    const status = String(item.status || '').replace(/_/g,' ').toLowerCase().replace(/\b\w/g,ch=>ch.toUpperCase());
    const format = String(item.format || '').replace(/_/g,' ');
    return '<article class="series-card"><a class="series-cover" href="' + htmlEscape(itemUrl) + '">' + coverHtml + '</a><div class="series-copy"><div class="series-meta">' + (format ? '<span>' + htmlEscape(format) + '</span>' : '') + (status ? '<span>' + htmlEscape(status) + '</span>' : '') + (score ? '<span>★ ' + score + '/10</span>' : '') + '</div><h2><a href="' + htmlEscape(itemUrl) + '">' + htmlEscape(item.title) + '</a></h2><p>' + htmlEscape(shortSynopsis || 'Open the series page for its catalog synopsis and available details.') + '</p><a class="series-more" href="' + htmlEscape(itemUrl) + '">View series details <span aria-hidden="true">↗</span></a></div></article>';
  }).join('');
  const breadcrumb = '<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/catalog/' + kind + '">' + kindLabel + '</a>' + (genre ? '<span>/</span><span aria-current="page">' + htmlEscape(genre.name) + '</span>' : '') + '</nav>';
  const catalogLink = isAnime ? '/catalog/manga' : '/catalog/anime';
  const otherLabel = isAnime ? 'Manga' : 'Anime';
  const metaImage = origin + '/assets/hekomi-social.svg';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<title>' + htmlEscape(title) + '</title><meta name="description" content="' + htmlEscape(description) + '">',
    '<meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#080916">',
    '<link rel="canonical" href="' + htmlEscape(canonical) + '"><link rel="icon" href="/favicon.ico?v=20261101" type="image/x-icon" sizes="any">',
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Hekomi"><meta property="og:title" content="' + htmlEscape(title) + '"><meta property="og:description" content="' + htmlEscape(description) + '"><meta property="og:url" content="' + htmlEscape(canonical) + '"><meta property="og:image" content="' + htmlEscape(metaImage) + '">',
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + htmlEscape(title) + '"><meta name="twitter:description" content="' + htmlEscape(description) + '"><meta name="twitter:image" content="' + htmlEscape(metaImage) + '">',
    '<script type="application/ld+json">' + jsonLd + '</script>',
    '<style>*{box-sizing:border-box}html{color-scheme:dark}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 82% 0,#68509a30,transparent 42%),#080916;color:#f1eff8;font:15px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.catalog-shell{width:min(1160px,calc(100% - 40px));margin:auto}.catalog-header{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #29283d}.brand{font-size:22px;font-weight:850;letter-spacing:.025em;color:#cbbcff;text-decoration:none}.header-links{display:flex;gap:20px}.header-links a,.crumbs a{color:#b9a9e8;text-decoration:none;font-size:13px}.header-links a:hover,.crumbs a:hover{color:#e4dcff}.crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:25px 0 20px;color:#85849a;font-size:12px}.catalog-hero{padding:28px 0 25px;max-width:820px}.eyebrow{color:#9ce4d2;font-size:10px;font-weight:850;letter-spacing:.2em;text-transform:uppercase}.catalog-hero h1{margin:8px 0 13px;font-size:clamp(34px,6vw,57px);line-height:1.04;letter-spacing:-.055em}.catalog-hero p{max-width:760px;margin:0;color:#b9b8c9;font-size:15px;line-height:1.8}.genre-nav{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 35px;padding:16px 0;border-top:1px solid #27263a;border-bottom:1px solid #27263a}.genre-link{padding:7px 11px;border:1px solid #37334b;border-radius:99px;color:#c7bddf;text-decoration:none;font-size:12px;transition:background .2s,border-color .2s}.genre-link:hover,.genre-link.is-current{background:#b9a6ff1a;border-color:#8875b8;color:#e6deff}.section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 17px}.section-heading h2{margin:0;font-size:20px;letter-spacing:-.025em}.section-heading span{color:#9693a9;font-size:11px}.series-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.series-card{min-width:0;display:grid;grid-template-columns:112px minmax(0,1fr);gap:15px;padding:12px;border:1px solid #2a293d;border-radius:15px;background:linear-gradient(135deg,#171629d9,#101321e8);box-shadow:0 12px 30px #0002}.series-cover{display:block;overflow:hidden;align-self:start;aspect-ratio:2/3;border-radius:9px;background:#222035}.series-cover img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s}.series-card:hover .series-cover img{transform:scale(1.035)}.cover-fallback{display:grid;place-items:center;width:100%;height:100%;color:#b9a6ff;font-size:42px}.series-copy{min-width:0;display:flex;flex-direction:column;align-items:flex-start}.series-meta{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 8px}.series-meta span{color:#a9e6d7;font-size:9px;text-transform:uppercase;letter-spacing:.07em}.series-meta span+span:before{content:"·";padding-right:6px;color:#5f5a76}.series-copy h2{margin:0 0 7px;font-size:16px;line-height:1.35;letter-spacing:-.02em}.series-copy h2 a{color:#f0ebfa;text-decoration:none}.series-copy p{margin:0;color:#aaa9ba;font-size:11px;line-height:1.65;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.series-more{margin-top:auto;padding-top:10px;color:#c3b2ff;text-decoration:none;font-size:11px;font-weight:750}.catalog-note{margin:28px 0 0;padding:16px 0 25px;border-top:1px solid #29283d;color:#88869b;font-size:11px}.catalog-note a{color:#bdadf2}.catalog-footer{display:flex;flex-wrap:wrap;gap:10px 18px;padding:20px 0 32px;border-top:1px solid #29283d}.catalog-footer a{color:#a99dc9;text-decoration:none;font-size:12px}.catalog-footer a:hover{color:#eee7ff}@media(max-width:760px){.catalog-shell{width:calc(100% - 28px)}.catalog-header{height:64px}.header-links{gap:12px}.header-links a{font-size:11px}.series-grid{grid-template-columns:1fr}.catalog-hero{padding-top:22px}.series-card{grid-template-columns:100px minmax(0,1fr);gap:12px;padding:10px}.series-copy h2{font-size:15px}}@media(max-width:390px){.header-links{gap:8px}.header-links a{font-size:10px}.series-card{grid-template-columns:86px minmax(0,1fr)}.catalog-hero h1{font-size:35px}}@media(prefers-reduced-motion:reduce){.series-cover img,.genre-link{transition:none}}@media(prefers-color-scheme:light){html{color-scheme:light}body{background:radial-gradient(ellipse at 82% 0,#d8c8ee77,transparent 42%),#f7f3fa;color:#2c2636}.catalog-header,.genre-nav,.catalog-note,.catalog-footer{border-color:#e1d8e8}.brand{color:#7050a4}.header-links a,.crumbs a,.catalog-footer a{color:#765a9b}.crumbs{color:#8e8497}.catalog-hero p{color:#655d6e}.genre-link{border-color:#ded3e8;color:#655575}.genre-link:hover,.genre-link.is-current{background:#8c70b51a;border-color:#9b81bd;color:#543d76}.series-card{border-color:#e1d8e8;background:linear-gradient(135deg,#fffaff,#f3eef8);box-shadow:0 12px 30px #39234b0b}.series-copy h2 a{color:#2c2636}.series-copy p{color:#6c6474}.series-meta span{color:#397c70}.series-more{color:#7050a4}.catalog-note{color:#807587}}</style>',
    '</head><body><div class="catalog-shell"><header class="catalog-header"><a class="brand" href="/">Hekomi</a><nav class="header-links" aria-label="Main navigation"><a href="/catalog/anime">Anime</a><a href="/catalog/manga">Manga</a><a href="/discover">Full discovery</a></nav></header>',
    breadcrumb,
    '<main><section class="catalog-hero"><div class="eyebrow">HEKOMI · GENRE-FIRST DISCOVERY</div><h1>' + htmlEscape(heading) + '</h1><p>' + htmlEscape(intro) + '</p></section>',
    '<nav class="genre-nav" aria-label="' + kindLabel + ' genres">' + genreNav + '</nav>',
    '<section aria-labelledby="catalog-list-heading"><div class="section-heading"><h2 id="catalog-list-heading">' + (genre ? 'Popular ' + htmlEscape(genre.name.toLowerCase()) + ' picks' : 'Popular ' + kindLabel.toLowerCase() + ' to start with') + '</h2><span>' + safeItems.length + ' titles · catalog refreshed periodically</span></div><div class="series-grid">' + cards + '</div></section>',
    '<p class="catalog-note">Catalog details and scores are supplied by <a href="https://anilist.co/" target="_blank" rel="noreferrer">AniList</a>. Cover artwork belongs to its respective rights holders. Hekomi is an independent discovery and tracking project.</p>',
    '<footer class="catalog-footer"><a href="/">Hekomi home</a><a href="/catalog/' + kind + '">' + kindLabel + ' catalog</a><a href="' + catalogLink + '">Explore ' + otherLabel + '</a><a href="/discover">Search and advanced filters</a></footer></main></div></body></html>'
  ].join('');
}

async function serveSitemap(req,res) {
  const origin=publicOrigin(req);
  const staticPaths=['/','/discover','/calendar','/manga','/catalog/anime','/catalog/manga',...SEO_GENRES.flatMap(genre=>['/genres/anime/'+genre.slug,'/genres/manga/'+genre.slug])];
  const entries=staticPaths.map(route=>({loc:origin+route,lastmod:''}));
  const mediaEntries=new Map();
  try {
    const catalog=await getPublicCatalog();
    const mediaItems=[
      ...(catalog.anime||[]),...(catalog.manga||[]),
      ...(catalog.airing||[]),...(catalog.seasonal||[])
    ];
    for(const media of mediaItems) {
      const kind=String(media.type||'').toUpperCase()==='ANIME'?'anime':
        String(media.type||'').toUpperCase()==='MANGA'?'manga':'';
      const id=Number(media.id);
      if(!kind||!Number.isSafeInteger(id)||id<1)continue;
      const loc=origin+'/series/'+kind+'/'+id+'-'+mediaSlug(media.title);
      const timestamp=Number(media.updatedAt)||0;
      const lastmod=timestamp>0?new Date(timestamp*1000).toISOString().slice(0,10):'';
      const existing=mediaEntries.get(loc);
      if(!existing||lastmod>existing.lastmod)mediaEntries.set(loc,{loc,lastmod});
    }
  } catch {}
  entries.push(...mediaEntries.values());
  const xmlEscape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const body='<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    entries.map(entry=>'<url><loc>'+xmlEscape(entry.loc)+'</loc>'+(entry.lastmod?'<lastmod>'+xmlEscape(entry.lastmod)+'</lastmod>':'')+'</url>').join('') +
    '</urlset>';
  res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=1800'});
  res.end(body);
}

const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin && !origin.startsWith(`http://localhost:${PORT}`) && !origin.startsWith(`http://127.0.0.1:${PORT}`)) { /* no permissive cross-origin access */ }
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(req.method==='GET' && url.pathname==='/api/config') return send(res,200,{supabaseUrl:process.env.SUPABASE_URL||'',supabasePublishableKey:process.env.SUPABASE_PUBLISHABLE_KEY||''},{'Cache-Control':'no-store'});
  if(req.method==='GET' && url.pathname==='/api/health') return send(res,200,{ok:true,app:'Hekomi',crawler:'robots-aware chapter image extractor',malProxy:true});

  if(req.method==='GET' && url.pathname==='/robots.txt') {
    const base=publicOrigin(req);
    res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'});
    return res.end('User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: '+base+'/sitemap.xml\n');
  }
  if(req.method==='GET' && url.pathname==='/sitemap.xml') return serveSitemap(req,res);
  if(req.method==='GET' && url.pathname==='/api/calendar') {
    try {
      const data=await getSyoboiCalendar(url.searchParams.get('start'),url.searchParams.get('days'));
      return send(res,200,data,{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'});
    } catch(e) {
      return send(res,502,{error:'The anime broadcast calendar could not be loaded. '+(e.message||'Please try again shortly.')});
    }
  }
  if(req.method==='GET' && url.pathname==='/api/catalog') {
    try { return send(res,200,await getPublicCatalog(url.searchParams.get('refresh')==='1'),{'Cache-Control':'public, max-age=300'}); }
    catch(e) { return send(res,502,{error:'The public catalog is temporarily unavailable. '+(e.message||'')}); }
  }
  if(req.method==='GET' && url.pathname==='/api/catalog/detail') {
    const id=Number(url.searchParams.get('id'));
    const kind=String(url.searchParams.get('kind')||'anime').toLowerCase();
    if(!Number.isSafeInteger(id)||id<1||!['anime','manga'].includes(kind)) return send(res,400,{error:'Provide a valid catalog ID and kind.'});
    try {
      const media=await getMediaDetail(id,kind);
      if(!media)return send(res,404,{error:'This title was not found in the public catalog.'});
      return send(res,200,media,{'Cache-Control':'public, max-age=600, stale-while-revalidate=3600'});
    } catch(e) {
      return send(res,502,{error:'The title details are temporarily unavailable. '+(e.message||'')});
    }
  }
  if(req.method==='GET' && url.pathname==='/api/catalog/mal-detail') {
    const idMal=Number(url.searchParams.get('id'));
    if(!Number.isSafeInteger(idMal)||idMal<1)return send(res,400,{error:'Provide a valid MyAnimeList ID.'});
    try { const media=await getMediaByMalId(idMal);if(!media)return send(res,404,{error:'No AniList airing record is linked to this MAL title.'});return send(res,200,media,{'Cache-Control':'public, max-age=600, stale-while-revalidate=3600'}); }
    catch(e) { return send(res,502,{error:'Airing information is temporarily unavailable. '+(e.message||'')}); }
  }
  if(req.method==='GET' && url.pathname==='/api/catalog/recommendations') {
    const ids=[...new Set(String(url.searchParams.get('ids')||'').split(',').map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,6);
    const listIds=new Set(String(url.searchParams.get('list')||'').split(',').map(Number).filter(id=>Number.isSafeInteger(id)&&id>0));
    if(!ids.length)return send(res,400,{error:'Sync your anime list to generate recommendations.'});
    try {
      const responses=await Promise.all(ids.map(async id=>{
        const payload=await requestAniList(MEDIA_RECOMMENDATIONS_QUERY,{idMal:id});
        return {id,items:payload.Media&&payload.Media.recommendations&&payload.Media.recommendations.nodes||[]};
      }));
      const merged=new Map();
      for(const group of responses)for(const entry of group.items){
        const media=packMedia(entry&&entry.mediaRecommendation);if(!media||!media.idMal||ids.includes(Number(media.idMal)))continue;
        const key=String(media.idMal),record=merged.get(key)||{media,ratings:[],seeds:[]};
        record.ratings.push(Number(entry.rating)||0);record.seeds.push(group.id);merged.set(key,record);
      }
      const results=[...merged.values()].map(record=>{
        const rating=record.ratings.length?record.ratings.reduce((a,b)=>a+b,0)/record.ratings.length:0;
        const score=Math.min(99,Math.round(48+rating/10+Math.min(3,record.seeds.length-1)*7));
        return {...record.media,similarity:score,matchedSeeds:record.seeds.length,inList:listIds.has(Number(record.media.idMal))};
      }).sort((a,b)=>b.similarity-a.similarity||b.popularity-a.popularity);
      return send(res,200,{recommendations:results,seedCount:ids.length,source:'AniList community recommendations',updatedAt:new Date().toISOString()},{'Cache-Control':'private, max-age=300'});
    } catch(e) { return send(res,502,{error:'Recommendations could not be generated right now. '+(e.message||'')}); }
  }
  if(req.method==='GET' && url.pathname==='/api/catalog/season') {
    try { return send(res,200,await getSeasonCatalog(url.searchParams.get('season'),url.searchParams.get('year')) ,{'Cache-Control':'public, max-age=1800'}); }
    catch(e) { return send(res,400,{error:e.message||'Seasonal catalog could not be loaded.'}); }
  }
  if(req.method==='GET' && url.pathname==='/api/catalog/search') {
    const filters = {type:url.searchParams.get('type'),genreIn:url.searchParams.get('genreIn'),genreNotIn:url.searchParams.get('genreNotIn'),format:url.searchParams.get('format'),status:url.searchParams.get('status'),year:url.searchParams.get('year'),season:url.searchParams.get('season'),minScore:url.searchParams.get('minScore'),sort:url.searchParams.get('sort')};
    try { return send(res,200,await searchPublicCatalog(url.searchParams.get('q'),url.searchParams.get('page'),filters),{'Cache-Control':'public, max-age=300'}); }
    catch(e) { return send(res,400,{error:e.message||'Catalog search failed.'}); }
  }
  const catalogRoute=url.pathname.match(/^\/catalog\/(anime|manga)\/?$/i);
  const genreRoute=url.pathname.match(/^\/genres\/(anime|manga)\/([a-z0-9-]+)\/?$/i);
  if((req.method==='GET'||req.method==='HEAD') && (catalogRoute||genreRoute)) {
    const kind=String((catalogRoute||genreRoute)[1]).toLowerCase();
    const genre=genreRoute?SEO_GENRES.find(item=>item.slug===genreRoute[2].toLowerCase()):null;
    if(genreRoute&&!genre) return sendHtml(res,404,'<!doctype html><title>Collection not found | Hekomi</title><meta name="robots" content="noindex"><h1>Collection not found</h1><a href="/catalog/'+kind+'">Browse '+kind+'</a>',{'X-Robots-Tag':'noindex'});
    try {
      let items=[];
      try {
        items=await getSeoCatalogItems(kind,genre);
      } catch(queryError) {
        console.warn('[Hekomi SEO catalog query fallback]',{kind,genre:genre&&genre.slug,message:String(queryError&&queryError.message||queryError)});
      }
      if(!items.length) items=await getSeoCatalogFallback(kind,genre);
      if(!items.length) throw new Error('The catalog has no matching titles available for this collection.');
      const page=renderSeoCatalogPage(req,kind,genre,items);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'public, max-age=600, stale-while-revalidate=3600'});
      return req.method==='HEAD'?res.end():res.end(page);
    } catch(error) {
      console.error('[Hekomi SEO landing page failed]',{kind,genre:genre&&genre.slug,message:String(error&&error.message||error)});
      return sendHtml(res,503,'<!doctype html><title>Catalog temporarily unavailable | Hekomi</title><meta name="robots" content="noindex"><h1>The catalog is temporarily unavailable</h1><p>Please try this collection again shortly.</p><a href="/discover">Open Hekomi discovery</a>',{'X-Robots-Tag':'noindex','Retry-After':'60','Cache-Control':'no-store'});
    }
  }
  const seriesRoute=url.pathname.match(/^\/series\/(anime|manga)\/(\d+)(?:-[a-z0-9-]*)?\/?$/i);
  if((req.method==='GET'||req.method==='HEAD') && seriesRoute) {
    const kind=seriesRoute[1].toLowerCase(), id=Number(seriesRoute[2]);
    if(!Number.isSafeInteger(id)||id<1) return sendHtml(res,404,'<!doctype html><title>Not found | Hekomi</title><h1>Series not found</h1><a href="/">Back to Hekomi</a>',{'X-Robots-Tag':'noindex'});
    try {
      const media=await getMediaDetail(id,kind);
      if(!media) return sendHtml(res,404,'<!doctype html><title>Series not found | Hekomi</title><h1>Series not found</h1><p>This title may be unavailable in the public catalog.</p><a href="/">Back to Hekomi</a>',{'X-Robots-Tag':'noindex'});
      const page=renderMediaPage(req,kind,media);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'public, max-age=600, stale-while-revalidate=3600'});
      return req.method==='HEAD'?res.end():res.end(page);
    } catch(e) {
      return sendHtml(res,503,'<!doctype html><title>Catalog temporarily unavailable | Hekomi</title><meta name="robots" content="noindex"><h1>The catalog is temporarily unavailable</h1><p>Please try again shortly.</p><a href="/">Back to Hekomi</a>',{'Retry-After':'60','Cache-Control':'no-store'});
    }
  }

if(req.method==='GET' && url.pathname==='/api/mangadex/image') {
    try {
      let target=await validatePublicUrl(String(url.searchParams.get('src')||''));
      if(!mangaDexImageHostAllowed(target.hostname)) throw new Error('This image is not hosted by MangaDex.');
      let response;
      for(let hop=0;hop<=3;hop++) {
        response=await fetch(target.href,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':USER_AGENT+'; contact: https://hekomi.vercel.app','Accept':'image/avif,image/webp,image/apng,image/*;q=0.9','Referer':'https://mangadex.org/'}});
        if(![301,302,303,307,308].includes(response.status)) break;
        const location=response.headers.get('location');
        if(!location||hop===3) throw new Error('MangaDex image server returned too many redirects.');
        target=await validatePublicUrl(new URL(location,target).href);
        if(!mangaDexImageHostAllowed(target.hostname)) throw new Error('MangaDex redirected this image outside its image network.');
      }
      if(!response||!response.ok) throw new Error('MangaDex image returned HTTP '+(response&&response.status||502)+'.');
      const type=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if(!/^image\/(?:jpeg|png|webp|avif|gif)$/.test(type)) throw new Error('MangaDex did not return an image for this page.');
      const declared=Number(response.headers.get('content-length')||0);
      if(declared>25_000_000) throw new Error('MangaDex image is larger than the 25 MB reader limit.');
      const reader=response.body.getReader(),chunks=[];let size=0;
      while(true) {
        const part=await reader.read(); if(part.done) break;
        size+=part.value.byteLength;
        if(size>25_000_000) { reader.cancel(); throw new Error('MangaDex image exceeded the 25 MB reader limit.'); }
        chunks.push(Buffer.from(part.value));
      }
      res.writeHead(200,{'Content-Type':type,'Content-Length':String(size),'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'});
      return res.end(Buffer.concat(chunks));
    } catch(error) {
      const message=String(error&&error.message||'MangaDex image could not be loaded.');
      return send(res,/HTTP 429/i.test(message)?429:400,{error:message});
    }
  }
  if(req.method==='GET' && url.pathname==='/api/mangascrape/providers') {
    return send(res,200,{providers:Object.entries(MANGASCRAPE_SOURCES).map(([id,source])=>({id,label:source.label,origin:source.origin}))});
  }
if(req.method==='POST' && url.pathname==='/api/mangascrape/discover') {
    try {
      const data=await readBody(req);
      const provider=String(data.provider||'mangahook').trim().toLowerCase();
      const feed=String(data.feed||'trending').trim().toLowerCase();
      if(provider!=='all'&&!MANGASCRAPE_SOURCES[provider]) throw new Error('Choose a supported source or All sources.');
      if(!['trending','latest'].includes(feed)) throw new Error('Choose Trending or Latest updates.');
      const payload=await loadMangaScrapeDiscovery(provider,feed,data.refresh===true);
      // Source outages are application data, not an endpoint crash. Return the diagnostic
      // payload as JSON so the UI can show which upstream API failed without console 503 noise.
      return send(res,200,payload,{'Cache-Control':'no-store'});
    } catch(error) {
      const message=String(error && error.message || 'Manga discovery could not be loaded.');
      return send(res,/temporarily unavailable|could not verify robots|robots\.txt could not be checked/i.test(message)?503:400,{error:message});
    }
  }
  if(req.method==='POST' && url.pathname==='/api/mangascrape/search') {
    try {
      const data=await readBody(req);
      const query=mangaScrapeQuery(data.query);
      const requested=String(data.provider||'mangahook').trim().toLowerCase();
      let providers;
      if(requested==='all') {
        const enabled=Array.isArray(data.enabledProviders)?data.enabledProviders.map(x=>String(x).toLowerCase()):Object.keys(MANGASCRAPE_SOURCES);
        providers=Object.keys(MANGASCRAPE_SOURCES).filter(key=>enabled.includes(key));
        if(!providers.length) throw new Error('Enable at least one manga extension in Extension manager.');
      } else {
        mangaScrapeProvider(requested);
        providers=[requested];
      }
      const settled=await Promise.allSettled(providers.map(async key=>{
        let selectedProvider=key;
        const selected=mangaScrapeProvider(key);
        let raw;
        if (key === 'mangadex') {
          const payload = await mangaDexApiRequest(mangaDexSearchPath(query));
          raw = Array.isArray(payload.data) ? payload.data : [];
        } else if (key === 'mangahook') {
          try {
            const target = new URL(mangaScrapeSearchUrl(key, query));
            const payload = await mangaHookApiRequest(target.pathname + target.search);
            raw = Array.isArray(payload.mangaList) ? payload.mangaList : [];
            if (!raw.length) throw new Error('Manga Hook search returned no titles.');
          } catch (primaryError) {
            if (requested === 'all') throw primaryError;
            // Preserve Manga Hook as the preferred source, then query MangaDex first.
            // It is a direct API and returns quickly; do not hold a successful search open
            // while slow HTML scrapers time out.
            let mangaDexFailure = '';
            try {
              const mdPayload = await mangaDexApiRequest(mangaDexSearchPath(query));
              const mdResults = (Array.isArray(mdPayload.data) ? mdPayload.data : [])
                .slice(0,30).map(item => mangaScrapeNormalizeSearch('mangadex',item)).filter(Boolean)
                .map(item => ({...item,providerLabel:MANGASCRAPE_SOURCES.mangadex.label}));
              if (mdResults.length) return mdResults;
              mangaDexFailure = 'MangaDex returned no titles.';
            } catch(error) {
              mangaDexFailure = String(error&&error.message||'MangaDex search failed.');
            }
            const backupProviders = ['gomanga','batoto','mangabuddy','mangakakalot'];
            const backupSettled = await Promise.allSettled(backupProviders.map(async backupKey => {
              const backup = mangaScrapeProvider(backupKey);
              let backupRaw = [];
              if (backupKey === 'gomanga') {
                const payload = await gomangaApiRequest('/api/search/' + encodeURIComponent(query));
                backupRaw = Array.isArray(payload.manga) ? payload.manga : [];
              } else if (backupKey === 'mangadex') {
                const payload = await mangaDexApiRequest(mangaDexSearchPath(query));
                backupRaw = Array.isArray(payload.data) ? payload.data : [];
              } else {
                const target = mangaScrapeSearchUrl(backupKey,query);
                await assertMangaSourceRequestAllowed(target);
                if (backupKey === 'batoto') {
                  const result = await backup.adapter.search({query});
                  backupRaw = result && Array.isArray(result.results) ? result.results : [];
                } else if (backupKey === 'mangabuddy') {
                  backupRaw = await backup.adapter.search(encodeURIComponent(query));
                } else {
                  backupRaw = await backup.adapter.search(query);
                }
              }
              const normalized = (Array.isArray(backupRaw) ? backupRaw : []).slice(0,30)
                .map(item => mangaScrapeNormalizeSearch(backupKey,item))
                .filter(Boolean)
                .map(item => ({...item,providerLabel:backup.source.label}));
              if (!normalized.length) throw new Error(backup.source.label + ' returned no titles.');
              return normalized;
            }));
            const backupResults = [];
            const backupErrors = ['mangadex: '+mangaDexFailure];
            backupSettled.forEach((item,index) => {
              if (item.status === 'fulfilled') backupResults.push(...item.value);
              else backupErrors.push(backupProviders[index] + ': ' + String(item.reason && item.reason.message || 'search failed'));
            });
            if (!backupResults.length) {
              throw new Error('Manga Hook search failed: ' + String(primaryError && primaryError.message || 'unavailable') + ' Backup sources failed: ' + backupErrors.join(' · '));
            }
            return backupResults;
          }
        } else if (key === 'gomanga') {
          const payload = await gomangaApiRequest('/api/search/' + encodeURIComponent(query));
          raw = Array.isArray(payload.manga) ? payload.manga : [];
        } else {
          const target = mangaScrapeSearchUrl(key,query);
          await assertMangaSourceRequestAllowed(target);
          if (key === 'batoto') {
            const result = await selected.adapter.search({query});
            raw = result && Array.isArray(result.results) ? result.results : [];
          } else if (key === 'mangabuddy') {
            raw = await selected.adapter.search(encodeURIComponent(query));
          } else {
            raw = await selected.adapter.search(query);
          }
        }
        const resultSource=MANGASCRAPE_SOURCES[selectedProvider];
        return (Array.isArray(raw)?raw:[]).slice(0,30).map(item=>mangaScrapeNormalizeSearch(selectedProvider,item)).filter(Boolean).map(item=>({...item,providerLabel:resultSource.label}));
      }));
      const results=[],errors=[];
      settled.forEach((item,index)=>{
        if(item.status==='fulfilled') results.push(...item.value);
        else errors.push({provider:providers[index],label:MANGASCRAPE_SOURCES[providers[index]].label,message:String(item.reason&&item.reason.message||'Extension search failed.')});
      });
      const seen=new Set();
      const unique=results.filter(item=>{const key=(item.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key)return true;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,60);
      return send(res,200,{provider:requested,providerLabel:requested==='all'?'Enabled extensions':MANGASCRAPE_SOURCES[requested].label,query,results:unique,errors,notice:'Search runs across enabled extensions. Results contain source metadata; chapter availability and reading access depend on each source.'});
    } catch(error) {
      const message=String(error && error.message || 'Manga source search failed.');
      const status=/HTTP 429|wait a moment/i.test(message)?429:/HTTP 5\d\d|temporarily unavailable|could not verify robots|robots\.txt could not be checked/i.test(message)?503:400;
      return send(res,status,{error:message});
    }
  }
  if(req.method==='POST' && url.pathname==='/api/mangascrape/details') {
    try {
      const data=await readBody(req);
      const selected=mangaScrapeProvider(data.provider);
      const id=mangaScrapeId(data.id);
      const sourceKind=mangaScrapeSourceKind(selected.key,data.sourceKind);
      let item;
      if (selected.key === 'mangadex') {
        item = await mangaDexGetDetails(id);
      } else if (selected.key === 'mangahook') {
        item = await mangaHookApiRequest('/api/manga/' + encodeURIComponent(mangaScrapeCleanId(selected.key, id)));
      } else if (selected.key === 'gomanga') {
        item = await gomangaApiRequest('/api/manga/' + encodeURIComponent(mangaScrapeCleanId(selected.key, id)));
      } else {
        const target = mangaScrapeTitleUrl(selected.key,id,sourceKind);
        await assertMangaSourceRequestAllowed(target);
        if (selected.key === 'batoto') item = await selected.adapter.id(id);
        else if (selected.key === 'mangabuddy') item = await selected.adapter.id(id);
        else item = await selected.adapter.id(id,sourceKind);
      }
            const detail=mangaScrapeNormalizeDetails(selected.key,id,sourceKind,item);
      return send(res,200,detail);
    } catch(error) {
      const message=String(error && error.message || 'Manga details could not be loaded.');
      const status=/HTTP 429|wait a moment/i.test(message)?429:/HTTP 5\d\d|temporarily unavailable|could not verify robots|robots\.txt could not be checked/i.test(message)?503:400;
      return send(res,status,{error:message});
    }
  }
  if(req.method==='POST' && url.pathname==='/api/mangascrape/chapter') {
    try {
      const data=await readBody(req);
      const provider=String(data.provider||'mangahook').trim().toLowerCase();
      const selected=mangaScrapeProvider(provider);
      const id=mangaScrapeCleanId(provider,data.id);
      const chapterId=provider==='mangadex'
        ? mangaScrapeCleanId('mangadex',data.chapterId)
        : mangaScrapeId(data.chapterId);
      const sourceKind=mangaScrapeSourceKind(provider,data.sourceKind);
      const apiPath='/api/manga/'+encodeURIComponent(id)+'/'+encodeURIComponent(chapterId);
      let payload;
      let title='Chapter '+chapterId;
      let images=[];
      let notice='Chapter pages are served by the selected source; images may load progressively.';
      if(provider==='mangadex') {
        title=String(data.chapterTitle||('Chapter '+chapterId)).replace(/\s+/g,' ').trim().slice(0,240);
        const atHome=await mangaDexApiRequest('/at-home/server/'+encodeURIComponent(chapterId));
        const chapter=atHome&&atHome.chapter||{};
        const fullPages=Array.isArray(chapter.data)?chapter.data:[];
        const saverPages=Array.isArray(chapter.dataSaver)?chapter.dataSaver:[];
        const quality=saverPages.length?'data-saver':'data';
        const files=saverPages.length?saverPages:fullPages;
        if(!atHome.baseUrl||!chapter.hash||!files.length) {
          throw new Error('MangaDex has no readable page images for this chapter. It may be externally hosted or unavailable.');
        }
        if(!mangaDexImageHostAllowed(new URL(atHome.baseUrl).hostname)) throw new Error('MangaDex assigned an unexpected chapter image host.');
        images=files.slice(0,300).map((file,index)=>({
          url:mangaDexImageProxyUrl(String(atHome.baseUrl).replace(/\/$/,'')+'/'+quality+'/'+encodeURIComponent(chapter.hash)+'/'+encodeURIComponent(String(file))),
          alt:'Page '+(index+1)
        }));
        notice='Chapter pages provided by MangaDex. Translation group: '+String(data.readerGroup||'not supplied by the source')+'. Pages are proxied for the reader and source attribution is retained.';
      } else if(provider==='gomanga' || provider==='mangahook') {
        payload=provider==='gomanga'
          ? await gomangaApiRequest(apiPath)
          : await mangaHookApiRequest(apiPath);
        const chapterObject=payload && payload.chapter && typeof payload.chapter==='object' ? payload.chapter : payload;
        title=String(chapterObject.currentChapter||chapterObject.title||chapterObject.name||('Chapter '+chapterId)).slice(0,240);
        images=mangaScrapeExtractChapterImages(payload);
      } else {
        const chapterUrl=mangaScrapeChapterUrl(provider,id,chapterId,sourceKind);
        await assertMangaSourceRequestAllowed(chapterUrl);
        let adapterError=null;
        try {
          payload=await selected.adapter.chapter(id,chapterId);
          const chapterObject=payload && payload.chapter && typeof payload.chapter==='object' ? payload.chapter : payload;
          title=String(chapterObject && (chapterObject.title||chapterObject.name||chapterObject.chapter)||('Chapter '+chapterId)).slice(0,240);
          images=mangaScrapeExtractChapterImages(payload);
        } catch(error) {
          adapterError=error;
        }
        if(!images.length) {
          try {
            const extracted=await extractChapterImages(chapterUrl);
            images=mangaScrapeExtractChapterImages(extracted);
            title=String(extracted.title||title).slice(0,240);
            notice=extracted.notice||notice;
          } catch(error) {
            const adapterMessage=adapterError ? String(adapterError.message||adapterError) : 'The adapter returned no page images.';
            throw new Error(selected.source.label+' chapter reader failed: '+adapterMessage+' Page extraction failed: '+String(error.message||error));
          }
        }
      }
      const safeImages=mangaScrapeExtractChapterImages(images);
      if(!safeImages.length) throw new Error(selected.source.label+' did not return readable page images for this chapter.');
      return send(res,200,{title,images:safeImages,notice});
    } catch(error) {
      const message=String(error && error.message || 'Manga chapter could not be loaded.');
      const status=/HTTP 429|wait a moment/i.test(message)?429:/HTTP 5\d\d|temporarily unavailable/i.test(message)?503:400;
      return send(res,status,{error:message});
    }
  }
  if(req.method==='POST' && url.pathname==='/api/search-manga-sites') {
    try { const data=await readBody(req); return send(res,200,await searchMangaWebsites(data.query)); } catch(e) { return send(res,400,{error:e.message||'Manga website search failed.'}); }
  }
  if(req.method==='POST' && url.pathname==='/api/chapter-images') {
    try { const data=await readBody(req); if(!data.url) return send(res,400,{error:'Chapter URL required.'}); return send(res,200,await extractChapterImages(String(data.url))); } catch(e) { return send(res,400,{error:e.message||'Chapter extraction failed.'}); }
  }
  if(req.method==='POST' && url.pathname==='/api/inspect') {
    try { const data=await readBody(req); if(!data.url) return send(res,400,{error:'Website URL required.'}); const result=await inspectWebsite(String(data.url)); return send(res,200,result); }
    catch(e) { return send(res,400,{error:e.message||'Website inspection failed.'}); }
  }
  if(req.method==='GET' && url.pathname==='/api/mal/auth/status') return malAuthStatus(req,res).catch(e=>send(res,500,{error:e.message||'Could not check MAL connection.'}));
  if(req.method==='GET' && url.pathname==='/api/mal/auth/start') return startMalAuth(req,res).catch(e=>send(res,500,{error:e.message||'Could not start MAL sign-in.'}));
  if(req.method==='GET' && url.pathname==='/api/mal/auth/callback') return completeMalAuth(req,res,url.searchParams);
  if(req.method==='POST' && url.pathname==='/api/mal/auth/logout') return malLogout(req,res);
  if(url.pathname.startsWith('/api/mal/')) return malRequest(req,res,url.pathname.slice('/api/mal'.length),url.searchParams).catch(e=>send(res,500,{error:e.message||'MAL request failed.'}));
  if(req.method!=='GET' && req.method!=='HEAD') return send(res,405,{error:'Method not allowed.'});
  const normalizedPath=decodeURIComponent(url.pathname).replace(/\/+$/,'')||'/';
  // Keep the root favicon URL stable while reusing the project's original ICO asset.
  const assetPath=normalizedPath==='/favicon.ico'?'/Anime Manga Duality Emblem.ico':normalizedPath;
  const appPath=assetPath==='/index.html'?'/':assetPath;
  const pageRoutes=new Set(['/','/discover','/calendar','/anime','/manga','/profile']);
  const isAppPage=pageRoutes.has(appPath);
  let filePath=path.resolve(__dirname, '.'+(isAppPage?'/index.html':assetPath));
  if(!filePath.startsWith(__dirname+path.sep) && filePath!==path.join(__dirname,'index.html')) return send(res,403,'Forbidden');
  try {
    const data=await fs.readFile(filePath);
    let body=data;
    let pageRobotsHeader={};
    if(filePath===path.join(__dirname,'index.html')) {
      const origin=publicOrigin(req);
      const pageName=appPath==='/'?'home':appPath.slice(1);
      const pageSeo={
        home:{
          title:'Hekomi — Discover Anime & Manga, Track Your Watchlist',
          description:'Discover anime and manga by genre, explore trending series, track your MyAnimeList watchlist, and keep your manga library in one place.',
          robots:'index,follow,max-image-preview:large'
        },
        discover:{
          title:'Anime & Manga Discovery — Search & Trending | Hekomi',
          description:'Explore trending anime and manga, search series by title, filter by genre and format, and find your next favourite story with Hekomi.',
          robots:'index,follow,max-image-preview:large'
        },
        calendar:{
          title:'Weekly Anime Episode Schedule | Hekomi',
          description:'Browse anime episodes grouped by weekday, check Japanese broadcast times, and see which scheduled shows are in your watchlist.',
          robots:'index,follow,max-image-preview:large'
        },
        anime:{
          title:'Anime Tracker & MyAnimeList Client | Hekomi',
          description:'Manage your anime watchlist with a MyAnimeList-connected tracker. Organize watching, completed, on-hold, dropped and plan-to-watch titles.',
          robots:'noindex,follow'
        },
        manga:{
          title:'Manga Discovery & Personal Library | Hekomi',
          description:'Discover manga, search series, organize your reading library, and manage manga sources in Hekomi’s personal reading workspace.',
          robots:'index,follow,max-image-preview:large'
        },
        profile:{
          title:'Your Hekomi Profile & Settings',
          description:'Manage your Hekomi profile, connected accounts, recommendations and personal discovery preferences.',
          robots:'noindex,follow'
        }
      };
      const seo=pageSeo[pageName]||pageSeo.home;
      const canonicalPath=appPath==='/'?'/':appPath;
      let html=data.toString('utf8');
      // This shared shell contains several hidden route views. Emit only the active route's H1.
      html=html.replace(/<h1\b([^>]*)>/gi,'<h2$1>').replace(/<\/h1>/gi,'</h2>');
      const pageHeadingIds={home:'homeHeroTitle',discover:'catalogTitle',calendar:'calendarPageTitle',anime:'animePageTitle',manga:'mangaPageTitle',profile:'profilePageTitle'};
      const pageHeadingId=pageHeadingIds[pageName]||pageHeadingIds.home;
      const headingOpen='<h2 id="'+pageHeadingId+'">';
      const headingStart=html.indexOf(headingOpen);
      if(headingStart>=0){
        const selected=html.slice(headingStart).replace(headingOpen,'<h1 id="'+pageHeadingId+'">').replace('</h2>','</h1>');
        html=html.slice(0,headingStart)+selected;
      }
      body=Buffer.from(html
        .replaceAll('__HEKOMI_PUBLIC_URL__',origin)
        .replaceAll('__HEKOMI_CANONICAL_URL__',origin+canonicalPath)
        .replaceAll('__HEKOMI_PAGE__',pageRoutes.has(appPath)?pageName:'home')
        .replaceAll('__HEKOMI_PAGE_TITLE__',htmlEscape(seo.title))
        .replaceAll('__HEKOMI_PAGE_DESCRIPTION__',htmlEscape(seo.description))
        .replaceAll('__HEKOMI_PAGE_ROBOTS__',seo.robots),'utf8');
      // Load the optional local Hekomi-chan conversation engine on every app route.
      body=Buffer.from(insertBeforeClosingBody(body.toString('utf8'),'<script type="module" src="/assets/hekomi-core-ui.js"></script>'),'utf8');
      if(!seo.robots.startsWith('noindex')) {
        const footerLinks=[['Anime catalog','/catalog/anime'],['Manga catalog','/catalog/manga'],['Psychological anime','/genres/anime/psychological'],['Fantasy anime','/genres/anime/fantasy'],['Horror anime','/genres/anime/horror'],['Mystery anime','/genres/anime/mystery'],['Romance anime','/genres/anime/romance'],['Sci-Fi anime','/genres/anime/sci-fi'],['Slice of Life anime','/genres/anime/slice-of-life']];
        const footer='<style>.hk-seo-footer{width:min(1120px,calc(100% - 36px));margin:44px auto 0;padding:22px 0 30px;border-top:1px solid #ffffff18;display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;color:#9995aa;font-size:11px}.hk-seo-footer strong{color:#bcb2d7;letter-spacing:.08em;text-transform:uppercase;font-size:9px}.hk-seo-footer a{color:#b9a6ff;text-decoration:none}.hk-seo-footer a:hover{text-decoration:underline}@media(max-width:600px){.hk-seo-footer{gap:9px 13px;margin-top:30px}}</style><footer class="hk-seo-footer" aria-label="Explore Hekomi collections"><strong>Explore Hekomi</strong>'+footerLinks.map(link=>'<a href="'+link[1]+'">'+link[0]+'</a>').join('')+'</footer>';
        body=Buffer.from(insertBeforeClosingBody(body.toString('utf8'),footer),'utf8');
      }
      if(seo.robots.startsWith('noindex'))pageRobotsHeader={'X-Robots-Tag':'noindex, follow'};
    }
    res.writeHead(200,{'Content-Type':MIME[path.extname(filePath)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache',...pageRobotsHeader});
    return req.method==='HEAD'?res.end():res.end(body);
  }
  catch { return send(res,404,'Not found'); }
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Hekomi running at http://localhost:${PORT}`));

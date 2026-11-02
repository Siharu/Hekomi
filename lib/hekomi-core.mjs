const STORAGE_KEY = 'hekomi_core_memory_v1';
const MAX_MEMORIES = 40;

export function classifyHekomiIntent(input = '') {
  const text = String(input).trim().toLowerCase();
  if (!text) return 'empty';
  if (/\b(forget|delete|clear|remove)\b.*\b(memory|memories|remembered|what you know)\b/.test(text)) return 'forget';
  if (/\b(remember|save|keep in mind)\b/.test(text)) return 'remember';
  if (/\b(what is my name|what's my name|what do you remember|what do you know about me|do you remember)\b/.test(text)) return 'recall';
  if (/\b(hello|hi|hey|yo|sup|good morning|good evening|good afternoon)\b/.test(text)) return 'greeting';
  if (/\b(hekomi|yourself|who are you|what are you)\b/.test(text)) return 'identity';
  if (/\b(anime|show|watch|series|recommend|recommendation)\b/.test(text)) return 'anime';
  if (/\b(manga|manhwa|comic|read|chapter)\b/.test(text)) return 'manga';
  if (/\b(sad|upset|lonely|tired|stressed|anxious|bad day|happy|excited|angry)\b/.test(text)) return 'mood';
  if (/\b(help|what can you do|commands|features)\b/.test(text)) return 'help';
  return 'unknown';
}

export class HekomiMemory {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }
  read() {
    try {
      const data = JSON.parse(this.storage?.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data.filter(x => x && typeof x.text === 'string').slice(-MAX_MEMORIES) : [];
    } catch { return []; }
  }
  add(text, category = 'about you') {
    const clean = String(text || '').trim().slice(0, 180);
    if (!clean || !this.storage) return false;
    const items = this.read().filter(x => x.text.toLowerCase() !== clean.toLowerCase());
    items.push({ text: clean, category, createdAt: new Date().toISOString() });
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_MEMORIES))); return true; }
    catch { return false; }
  }
  forget() {
    try { this.storage?.removeItem(STORAGE_KEY); return true; } catch { return false; }
  }
  summary() {
    return this.read().map(x => x.text);
  }
}

const choose = (items, seed = Date.now()) => items[Math.abs(seed) % items.length];
export function replyAsHekomi(input, memory = new HekomiMemory(), context = {}) {
  const text = String(input || '').trim();
  const intent = classifyHekomiIntent(text);
  const facts = memory.summary();
  if (intent === 'empty') return { intent, text: 'Psst. You can talk to me, you know. ✨', mood: 'curious' };
  if (intent === 'forget') {
    memory.forget();
    return { intent, text: 'All the little notes I kept on this device are cleared. Fresh start! 🌱', mood: 'soft' };
  }
  if (intent === 'remember') {
    const fact = text.replace(/^.*?\b(?:remember|save|keep in mind)\b\s*(?:that\s*)?/i, '').replace(/[.!?]+$/, '').trim();
    if (!fact || /^(that|this|it)$/i.test(fact)) return { intent, text: 'Tell me the exact thing you want me to remember, bruda.', mood: 'curious' };
    const saved = memory.add(fact);
    return { intent, text: saved ? 'Got it! I’ll keep that note on this device. You can ask me what I remember or tell me to forget it anytime. 💜' : 'I couldn’t save that note. Your browser storage might be full or unavailable.', mood: 'happy' };
  }
  if (intent === 'recall') return { intent, text: facts.length ? 'Here are the notes I’ve saved on this device:\n• ' + facts.join('\n• ') : 'I don’t have any saved notes about you yet. Say “remember that…” and I’ll keep a small note.', mood: 'curious' };
  if (intent === 'greeting') return { intent, text: choose(['Hiii! You came back! ✨','Hey hey! What are we getting into today?','Yo! I was just wandering around Hekomi. Need company?','Good to see you! Got any anime plans today?']), mood: 'happy' };
  if (intent === 'identity') return { intent, text: 'I’m Hekomi-chan! A tiny companion living inside this corner of Hekomi. I can chat about the app, anime and manga, remember a few notes you choose to share, and keep you company. I’m a handcrafted little brain, not a full language model. 💜', mood: 'happy' };
  if (intent === 'anime') return { intent, text: 'Anime time?! I can help you explore the catalog. Tell me a genre or a vibe—mystery, psychological, cozy, chaotic, anything—or open Discover and we can browse together.', mood: 'curious', action: { label: 'Explore anime', href: '/discover?kind=anime' } };
  if (intent === 'manga') return { intent, text: 'Manga time! Tell me what kind of story you want, or jump into the manga shelves and discover something new.', mood: 'curious', action: { label: 'Explore manga', href: '/manga' } };
  if (intent === 'mood') return { intent, text: choose(['Oh… want to tell me what happened? I can listen. No pressure. 💜','That sounds like a lot to carry. We can take it one little step at a time.','I’m here with you. Want a distraction, a recommendation, or just someone to listen?']), mood: 'soft' };
  if (intent === 'help') return { intent, text: 'I can chat, talk about Hekomi, help you explore anime and manga, and save small notes when you explicitly ask me to remember something. I’m still learning my little set of tricks!', mood: 'happy' };
  const name = context.displayName ? ' ' + context.displayName : '';
  return { intent, text: choose(['Hmm… I’m not clever enough to answer everything yet' + name + '. Try asking me about Hekomi, anime, manga, or tell me something to remember.','I’m still a tiny handcrafted brain, so I might miss what you mean. Give me a hint?','I don’t know that one yet—but I’m listening! Try an anime or manga question, or tell me what’s on your mind.']), mood: 'curious' };
}

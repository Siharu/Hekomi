/* Hekomi Meme Corner — a tidy anime + gaming meme feed. */
(function(){
  'use strict';
  const root=document.getElementById('hkMemeCorner');
  if(!root)return;
  const button=document.getElementById('hkMemeNext');
  const buttonLabel=document.getElementById('hkMemeButtonLabel');
  const card=document.getElementById('hkMemeCard');
  const media=document.getElementById('hkMemeMedia');
  const caption=document.getElementById('hkMemeCaption');
  const categoryLabel=document.getElementById('hkMemeSubreddit');
  const scoreLabel=document.getElementById('hkMemeScore');
  const sourceLink=document.getElementById('hkMemeSource');
  const status=document.getElementById('hkMemeStatus');
  if(!button||!buttonLabel||!card||!media||!caption||!categoryLabel||!scoreLabel||!sourceLink||!status)return;

  const groups=[
    {category:'ANIME',subreddits:['Animemes','anime_irl']},
    {category:'GAMES',subreddits:['gamingmemes','gamingcirclejerk']}
  ];
  const subredditCursor={ANIME:0,GAMES:0};
  let nextGroupIndex=0;
  let loading=false,requestId=0,lastPost='',currentMeme=null,refreshTimer=0;
  const AUTO_REFRESH_MS=40000;

  function safeImageUrl(raw){
    try{
      const url=new URL(String(raw||''));
      const allowedHosts=['i.redd.it','preview.redd.it','external-preview.redd.it'];
      if(url.protocol!=='https:'||!allowedHosts.includes(url.hostname.toLowerCase()))return '';
      if(!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname))return '';
      return url.href;
    }catch{return '';}
  }
  function safeRedditUrl(raw){
    try{
      const url=new URL(String(raw||''));
      const host=url.hostname.toLowerCase();
      return url.protocol==='https:'&&['redd.it','www.reddit.com','reddit.com'].includes(host)?url.href:'';
    }catch{return '';}
  }
  function cleanCaption(raw){
    let title=String(raw||'').normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g,'')
      .replace(/https?:\/\/\S+/gi,' ')
      .replace(/^\s*\[(?:oc|original content|meme|spoiler|repost|crosspost|template)\]\s*/i,'')
      .replace(/\s+\|\s*(?:r\/[a-z0-9_]+|via reddit)\s*$/i,'')
      .replace(/\s+/g,' ')
      .replace(/^[\s\-—:|]+|[\s\-—:|]+$/g,'')
      .trim();
    title=title.replace(/([!?])\1{2,}/g,'$1$1');
    if(title.length>132)title=title.slice(0,129).trimEnd()+'…';
    return title;
  }
  function normalizeMeme(item,group,requestedSubreddit){
    if(!item||item.nsfw===true||item.spoiler===true||item.over_18===true)return null;
    const previews=Array.isArray(item.preview)?item.preview:[];
    const image=[...previews].reverse().map(safeImageUrl).find(Boolean)||safeImageUrl(item.url);
    const fallback=safeImageUrl(item.url);
    const postLink=safeRedditUrl(item.postLink);
    const title=cleanCaption(item.title);
    if(!image||!postLink||!title||!/[a-z0-9]{3}/i.test(title))return null;
    return {
      image,
      fallback:fallback&&fallback!==image?fallback:'',
      postLink,
      title,
      category:group.category,
      subreddit:String(item.subreddit||requestedSubreddit||'').replace(/[^a-z0-9_]/gi,'').slice(0,32),
      ups:Number.isFinite(Number(item.ups))?Number(item.ups):null
    };
  }
  function placeholder(message){
    const wrap=document.createElement('div');
    wrap.className='hk-meme-placeholder';
    const mark=document.createElement('span');
    mark.className='hk-meme-placeholder-mark';
    mark.textContent='✦';
    const text=document.createElement('span');
    text.textContent=message;
    wrap.append(mark,text);
    media.replaceChildren(wrap);
  }
  function renderMeme(meme,id){
    currentMeme=meme;
    lastPost=meme.postLink;
    const image=document.createElement('img');
    image.className='hk-meme-image';
    image.alt=meme.title;
    image.loading='lazy';
    image.decoding='async';
    image.referrerPolicy='no-referrer';
    image.addEventListener('error',()=>{
      if(id!==requestId)return;
      if(meme.fallback&&!image.dataset.fallbackUsed){
        image.dataset.fallbackUsed='true';
        image.src=meme.fallback;
        return;
      }
      placeholder('This image is unavailable. Try another meme.');
    });
    image.src=meme.image;
    media.replaceChildren(image);
    caption.textContent=meme.title;
    categoryLabel.textContent=meme.category+' MEME';
    scoreLabel.textContent=meme.ups===null?'—':new Intl.NumberFormat().format(meme.ups);
    sourceLink.href=meme.postLink;
    sourceLink.hidden=false;
    sourceLink.textContent='View original post';
    root.dataset.memeCategory=meme.category.toLowerCase();
    status.textContent='Updated just now';
    card.setAttribute('aria-busy','false');
  }
  async function fetchBatch(subreddit,group){
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),8500);
    try{
      const response=await fetch('https://meme-api.com/gimme/'+encodeURIComponent(subreddit)+'/5',{
        method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
        headers:{Accept:'application/json'},signal:controller.signal
      });
      if(!response.ok)throw new Error('Meme feed returned '+response.status);
      const data=await response.json();
      const items=Array.isArray(data.memes)?data.memes:(data&&data.url?[data]:[]);
      return items.map(item=>normalizeMeme(item,group,subreddit)).filter(Boolean);
    }finally{window.clearTimeout(timeout);}
  }
  async function findNextMeme(){
    for(let offset=0;offset<groups.length;offset++){
      const groupIndex=(nextGroupIndex+offset)%groups.length;
      const group=groups[groupIndex];
      const start=subredditCursor[group.category]%group.subreddits.length;
      subredditCursor[group.category]=(start+1)%group.subreddits.length;
      const ordered=group.subreddits.slice(start).concat(group.subreddits.slice(0,start));
      for(const subreddit of ordered){
        try{
          const candidates=await fetchBatch(subreddit,group);
          const next=candidates.find(item=>item.postLink!==lastPost);
          if(next){
            nextGroupIndex=(groupIndex+1)%groups.length;
            return next;
          }
        }catch(error){
          status.textContent=error&&error.name==='AbortError'?'A meme source took too long.':'Checking another meme source…';
        }
      }
    }
    return null;
  }
  function scheduleAutoRefresh(){
    if(refreshTimer)window.clearTimeout(refreshTimer);
    refreshTimer=window.setTimeout(()=>{
      refreshTimer=0;
      void loadMeme();
    },AUTO_REFRESH_MS);
  }
  async function loadMeme(){
    if(loading){
      scheduleAutoRefresh();
      return;
    }
    loading=true;
    if(refreshTimer){window.clearTimeout(refreshTimer);refreshTimer=0;}
    const id=++requestId;
    button.disabled=true;
    buttonLabel.textContent='Refreshing…';
    card.setAttribute('aria-busy','true');
    status.textContent=currentMeme?'Finding another meme…':'Loading memes…';
    if(!currentMeme)placeholder('Loading a fresh meme…');

    const next=await findNextMeme();
    if(id===requestId){
      if(next)renderMeme(next,id);
      else{
        card.setAttribute('aria-busy','false');
        if(!currentMeme)placeholder('No meme is available right now.');
        status.textContent=currentMeme?'Could not refresh. Keeping the last meme.':'Meme feed unavailable. Try again.';
      }
      loading=false;
      button.disabled=false;
      buttonLabel.textContent=currentMeme?'Another meme':'Try again';
      scheduleAutoRefresh();
    }
  }

  button.addEventListener('click',()=>{void loadMeme();});
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        observer.disconnect();
        void loadMeme();
      }
    },{rootMargin:'260px 0px'});
    observer.observe(root);
  }else{
    void loadMeme();
  }
})();
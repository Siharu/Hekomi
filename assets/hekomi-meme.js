/* Hekomi Meme Corner — lazy, single-image random anime meme feed. */
(function(){
  'use strict';
  const root=document.getElementById('hkMemeCorner');
  if(!root)return;
  const button=document.getElementById('hkMemeNext');
  const buttonLabel=document.getElementById('hkMemeButtonLabel');
  const card=document.getElementById('hkMemeCard');
  const media=document.getElementById('hkMemeMedia');
  const caption=document.getElementById('hkMemeCaption');
  const subredditLabel=document.getElementById('hkMemeSubreddit');
  const scoreLabel=document.getElementById('hkMemeScore');
  const sourceLink=document.getElementById('hkMemeSource');
  const status=document.getElementById('hkMemeStatus');
  if(!button||!buttonLabel||!card||!media||!caption||!subredditLabel||!scoreLabel||!sourceLink||!status)return;

  const subreddits=['Animemes','anime_irl'];
  let loading=false,requestId=0,lastPost='',currentMeme=null;

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
  function normalizeMeme(item){
    if(!item||item.nsfw===true||item.spoiler===true||item.over_18===true)return null;
    const previews=Array.isArray(item.preview)?item.preview:[];
    const image=[...previews].reverse().map(safeImageUrl).find(Boolean)||safeImageUrl(item.url);
    const fallback=safeImageUrl(item.url);
    const postLink=safeRedditUrl(item.postLink);
    if(!image||!postLink)return null;
    return {
      image,
      fallback:fallback&&fallback!==image?fallback:'',
      postLink,
      title:String(item.title||'Anime moment').trim().slice(0,180)||'Anime moment',
      subreddit:String(item.subreddit||'Animemes').replace(/[^a-z0-9_]/gi,'').slice(0,32)||'Animemes',
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
      placeholder('That image wandered off. Try another meme.');
    });
    image.src=meme.image;
    media.replaceChildren(image);
    caption.textContent=meme.title;
    subredditLabel.textContent='R/'+meme.subreddit;
    scoreLabel.textContent=meme.ups===null?'—':new Intl.NumberFormat().format(meme.ups);
    sourceLink.href=meme.postLink;
    sourceLink.hidden=false;
    sourceLink.textContent='Open original post ↗';
    status.textContent='Community post · image loaded on demand';
    card.setAttribute('aria-busy','false');
  }
  async function fetchBatch(subreddit){
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
      return items.map(normalizeMeme).filter(Boolean);
    }finally{window.clearTimeout(timeout);}
  }
  async function loadMeme(){
    if(loading)return;
    loading=true;
    const id=++requestId;
    button.disabled=true;
    buttonLabel.textContent='Finding…';
    card.setAttribute('aria-busy','true');
    status.textContent=currentMeme?'Looking for another one…':'Looking through the anime meme feed…';
    if(!currentMeme)placeholder('Finding a little anime chaos…');
    let next=null;
    for(const subreddit of subreddits){
      try{
        const candidates=await fetchBatch(subreddit);
        next=candidates.find(item=>item.postLink!==lastPost)||candidates[0]||null;
        if(next)break;
      }catch(error){
        status.textContent=error&&error.name==='AbortError'?'The meme feed took too long.':'Trying another anime meme shelf…';
      }
    }
    if(id===requestId){
      if(next)renderMeme(next,id);
      else{
        card.setAttribute('aria-busy','false');
        if(!currentMeme)placeholder('No meme made it through this time.');
        status.textContent=currentMeme?'Could not refresh the feed. Your last meme is still here.':'Meme feed unavailable. Tap to try again.';
      }
      loading=false;
      button.disabled=false;
      buttonLabel.textContent=currentMeme?'Another meme':'Try again';
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

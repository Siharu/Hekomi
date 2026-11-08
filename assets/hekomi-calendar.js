/* Hekomi weekly anime episode schedule */
(function(){
  'use strict';
  const root=document.getElementById('hkCalendar');
  if(!root||document.body?.dataset.page!=='calendar')return;
  const el=id=>document.getElementById(id);
  (function loadCalendarWallpaper(){
    const endpoint='https://imgapi.lie.moe/random?sort=pc&type=json&thumbnail=large';
    const apply=url=>{
      if(!url||!/^https:\/\//i.test(url))return;
      const image=new Image();
      image.onload=()=>root.style.setProperty('--hk-calendar-wallpaper','url("'+url.replace(/["\\]/g,'')+'")');
      image.referrerPolicy='no-referrer';
      image.src=url;
    };
    fetch(endpoint+'&v='+Date.now(),{mode:'cors',cache:'no-store'})
      .then(response=>{if(!response.ok)throw new Error('Wallpaper API unavailable');return response.json();})
      .then(data=>apply(Array.isArray(data.pic)?data.pic[0]:data.pic))
      .catch(()=>{});
  })();

  const grid=el('hkCalGrid');
  const weekLabel=el('hkCalWeekLabel');
  const weekRange=el('hkCalWeekRange');
  const weekTotal=el('hkCalWeekTotal');
  const state={weekStart:'',programs:[],loading:false,error:'',request:0};
  const todayParts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date());
  const part=type=>todayParts.find(item=>item.type===type)?.value||'01';
  const today=part('year')+'-'+part('month')+'-'+part('day');
  const dateFromKey=key=>{
    const [year,month,day]=key.split('-').map(Number);
    return new Date(Date.UTC(year,month-1,day));
  };
  const keyFor=date=>{
    return date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0')+'-'+String(date.getUTCDate()).padStart(2,'0');
  };
  const addDays=(key,amount)=>{
    const date=dateFromKey(key);
    date.setUTCDate(date.getUTCDate()+amount);
    return keyFor(date);
  };
  const startOfWeek=key=>{
    const date=dateFromKey(key);
    date.setUTCDate(date.getUTCDate()-date.getUTCDay());
    return keyFor(date);
  };
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeCover=value=>{
    try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:'';}
    catch{return '';}
  };
  const normalizeTitle=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\p{Z}\s]+/gu,'').trim();
  const hasJapaneseOrCjkScript=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  const hasEnglishScheduleTitle=value=>{
    const title=String(value||'').trim();
    return !!title&&/[A-Za-z]/.test(title)&&!hasJapaneseOrCjkScript.test(title);
  };
  const displayTitleFor=item=>{
    const watched=findWatchedMatch(item);
    return item.title&&!item.titleUnavailable?item.title:(watched&&watched.title)||item.title||'';
  };
  const posterFor=item=>{
    const watched=findWatchedMatch(item);
    return safeCover(item.cover)||(watched&&watched.cover)||'';
  };
  const isRenderableProgram=item=>hasEnglishScheduleTitle(displayTitleFor(item))&&!!posterFor(item);
  let remoteWatchlist=[],remoteWatchlistFetchedAt=0,remoteWatchlistTask=null;
  function readLocalAnime(){
    try{
      const value=JSON.parse(localStorage.getItem('folio_local_anime_v1')||'[]');
      return Array.isArray(value)?value:[];
    }catch{return [];}
  }
  function watchEntryDetails(entry){
    const node=entry&&entry.node&&typeof entry.node==='object'?entry.node:entry||{};
    const status=String(entry&&entry.list_status&&entry.list_status.status||entry&&entry.status||'').toLowerCase();
    if(status!=='watching')return null;
    const alternative=node.alternative_titles||node.alternativeTitles||{};
    const titles=[
      node.title,node.titleEnglish,node.titleRomaji,node.titleNative,
      alternative.en,alternative.ja,
      ...(Array.isArray(alternative.synonyms)?alternative.synonyms:[]),
      ...(Array.isArray(node.synonyms)?node.synonyms:[])
    ].filter(Boolean).map(normalizeTitle).filter(Boolean);
    const rawId=String(entry&&entry.id||node.id||'');
    const anilistId=Number(node.anilistId||(rawId.startsWith('anilist-')?rawId.slice(8):0))||null;
    const malId=Number(node.malId||(rawId.startsWith('mal-')?rawId.slice(4):(entry&&entry.node?node.id:0)))||null;
    const picture=node.main_picture||node.mainPicture||{};
    const images=node.images&&node.images.jpg||{};
    const cover=safeCover(node.cover||node.image||node.picture||picture.large||picture.medium||images.large_image_url||images.image_url||'');
    return (titles.length||anilistId||malId)?{
      titles,cover,anilistId,malId,
      title:String(node.title||node.titleEnglish||node.titleRomaji||'')
    }:null;
  }
  function findWatchedMatch(item){
    const keys=[normalizeTitle(item.title),normalizeTitle(item.shortTitle)].filter(Boolean);
    for(const entry of [...readLocalAnime(),...remoteWatchlist]){
      const details=watchEntryDetails(entry);
      if(!details)continue;
      const anilistMatch=item.anilistId&&details.anilistId&&Number(item.anilistId)===Number(details.anilistId);
      const malMatch=item.malId&&details.malId&&Number(item.malId)===Number(details.malId);
      if(anilistMatch||malMatch||details.titles.some(title=>keys.includes(title)))return details;
    }
    return null;
  }
  async function refreshRemoteWatchlist(){
    if(remoteWatchlistTask)return remoteWatchlistTask;
    if(Date.now()-remoteWatchlistFetchedAt<180000)return;
    remoteWatchlistTask=(async()=>{
      try{
        const response=await fetch('/api/mal/list',{
          headers:{Accept:'application/json'},credentials:'same-origin'
        });
        if(!response.ok){
          remoteWatchlist=[];
          remoteWatchlistFetchedAt=Date.now();
          return;
        }
        const data=await response.json();
        remoteWatchlist=Array.isArray(data.data)?data.data:[];
        remoteWatchlistFetchedAt=Date.now();
        renderWeek();
      }catch{
        remoteWatchlist=[];
        remoteWatchlistFetchedAt=Date.now();
      }finally{remoteWatchlistTask=null;}
    })();
    return remoteWatchlistTask;
  }

  const fmtWeekday=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long'});
  const fmtShortDate=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
  const fmtFullDate=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'});
  function weekDays(){
    return Array.from({length:7},(_,index)=>{
      const key=addDays(state.weekStart,index);
      const date=dateFromKey(key);
      return {key,date,weekday:fmtWeekday.format(date),shortDate:fmtShortDate.format(date)};
    });
  }
  function setWeek(key){
    state.weekStart=startOfWeek(key);
    loadWeek();
  }
  function selectedItemsForDay(key){
    return state.programs
      .filter(item=>item.date===key&&isRenderableProgram(item))
      .sort((a,b)=>String(a.airingAt||a.time||'').localeCompare(String(b.airingAt||b.time||'')));
  }
  function renderEpisode(item,index){
    const watched=findWatchedMatch(item);
    const title=displayTitleFor(item);
    const episode=item.episode?'Episode '+item.episode:'Episode listing';
    const cover=posterFor(item);
    const watchTag=watched?'<span class="hk-week-watch-tag">IN YOUR WATCHLIST</span>':'';
    const stateLabel=item.status==='upcoming'?'UPCOMING':'AIRED';
    const listingType=String(item.listingType||'TV').toUpperCase();
    const href=/^https:\/\//i.test(String(item.url||''))?item.url:'https://cal.syoboi.jp/';
    const poster='<a class="hk-week-event-poster" href="'+escape(href)+'" target="_blank" rel="noopener noreferrer" aria-label="View '+escape(title)+'">'+
      '<img class="hk-week-event-cover" src="'+escape(cover)+'" alt="'+escape(title)+' poster" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>';
    return '<article class="hk-week-event" data-state="'+escape(item.status)+'"'+(watched?' data-watching="true"':'')+' style="--hk-episode-index:'+index+'">'+
      '<div class="hk-week-event-time">'+escape(item.time||'TBA')+'<small>JST</small></div>'+
      poster+
      '<div class="hk-week-event-copy"><div class="hk-week-event-meta"><span class="hk-week-event-kind">'+escape(listingType)+'</span><span class="hk-week-event-state">'+stateLabel+'</span></div>'+
      '<h4><a href="'+escape(href)+'" target="_blank" rel="noopener noreferrer">'+escape(title)+'</a></h4>'+
      '<p class="hk-week-event-episode">'+escape(episode)+'</p>'+watchTag+
      '</div></article>';
  }
  function renderDay(day){
    const items=selectedItemsForDay(day.key);
    const isToday=day.key===today;
    let body='';
    if(state.loading)body='<div class="hk-week-empty">Loading episodes…</div>';
    else if(state.error)body='<div class="hk-week-empty">'+escape(state.error)+'</div>';
    else if(!items.length)body='<div class="hk-week-empty">No matched English-title episodes with poster art today.</div>'+'';
    else body='<div class="hk-week-events">'+items.map(renderEpisode).join('')+'</div>';
    return '<section class="hk-week-day-card'+(isToday?' is-today':'')+'" data-date="'+day.key+'" aria-label="'+escape(day.weekday)+' episode schedule">'+
      '<header class="hk-week-day-heading"><div><span class="hk-week-day-name">'+escape(day.weekday)+'</span><span class="hk-week-day-date">'+escape(day.shortDate)+'</span></div>'+
      '<div class="hk-week-day-count">'+(state.loading?'…':items.length+' '+(items.length===1?'EP':'EPS'))+'</div></header>'+body+'</section>';
  }
  function renderWeek(){
    const days=weekDays();
    const startDate=days[0].date,endDate=days[6].date;
    const label=fmtShortDate.format(startDate)+' — '+fmtFullDate.format(endDate);
    weekLabel.textContent='WEEK OF '+fmtShortDate.format(startDate).toUpperCase();
    weekRange.textContent=label;
    weekTotal.textContent=state.loading?'UPDATING…':state.error?'SOURCE UNAVAILABLE':state.programs.length+' EPISODES THIS WEEK';
    grid.innerHTML=days.map(renderDay).join('');
    grid.classList.remove('is-changing');
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      void grid.offsetWidth;
      grid.classList.add('is-changing');
    }
  }
  async function loadWeek(){
    const request=++state.request;
    state.loading=true;
    state.error='';
    state.programs=[];
    renderWeek();
    try{
      const response=await fetch('/api/calendar?start='+encodeURIComponent(state.weekStart)+'&days=7',{
        headers:{Accept:'application/json'},cache:'no-store'
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Episode schedule unavailable.');
      if(!Array.isArray(data.programs))throw new Error('Schedule response is missing its episode list.');
      if(request!==state.request)return;
      state.programs=data.programs.filter(isRenderableProgram);
      if(data.rawProgramCount>0&&!state.programs.length){
        throw new Error('No anime with a verified English title and poster could be matched for this week.');
      }
    }catch(error){
      if(request!==state.request)return;
      state.programs=[];
      state.error=error&&error.message?error.message:'Could not load the weekly episode schedule.';
    }finally{
      if(request===state.request){
        state.loading=false;
        renderWeek();
      }
    }
  }

  el('hkCalPrev').addEventListener('click',()=>setWeek(addDays(state.weekStart,-7)));
  el('hkCalNext').addEventListener('click',()=>setWeek(addDays(state.weekStart,7)));
  el('hkCalToday').addEventListener('click',()=>setWeek(today));
  const collapseButton=el('hkCalCollapse');
  if(collapseButton){
    const setCollapsed=collapsed=>{
      root.dataset.collapsed=String(collapsed);
      collapseButton.setAttribute('aria-expanded',String(!collapsed));
      collapseButton.setAttribute('aria-label',collapsed?'Expand weekly episode schedule':'Collapse weekly episode schedule');
      collapseButton.textContent=collapsed?'Expand':'Collapse';
    };
    setCollapsed(root.dataset.collapsed==='true');
    collapseButton.addEventListener('click',()=>setCollapsed(root.dataset.collapsed!=='true'));
  }
  window.addEventListener('storage',event=>{
    if(event.key==='folio_local_anime_v1')renderWeek();
  });
  window.addEventListener('hekomi:anime-list-updated',renderWeek);
  window.addEventListener('focus',()=>{void refreshRemoteWatchlist();renderWeek();});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){void refreshRemoteWatchlist();renderWeek();}
  });
  setWeek(today);
  void refreshRemoteWatchlist();
})();
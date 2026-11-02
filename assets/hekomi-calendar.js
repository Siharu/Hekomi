/* Hekomi dedicated anime calendar client */
(function(){
  'use strict';
  const root=document.getElementById('hkCalendar');
  if(!root)return;
  const el=id=>document.getElementById(id);
  const grid=el('hkCalGrid'),monthLabel=el('hkCalMonthLabel'),selectedLabel=el('hkCalSelectedDate'),eventsNode=el('hkCalEvents');
  const state={year:0,month:0,selected:'',programs:[],loading:false,error:'',request:0};
  const todayParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=type=>todayParts.find(x=>x.type===type)?.value||'01';
  const today=part('year')+'-'+part('month')+'-'+part('day');
  const dateFromKey=key=>{const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d));};
  const keyFor=(y,m,d)=>String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeCover=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:'';}catch{return '';}};
  const normalizeTitle=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\p{Z}\s]+/gu,'').trim();
  let remoteWatchlist=[],remoteWatchlistFetchedAt=0,remoteWatchlistTask=null;
  function readLocalAnime(){
    try{const value=JSON.parse(localStorage.getItem('folio_local_anime_v1')||'[]');return Array.isArray(value)?value:[];}
    catch{return [];}
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
    const cover=safeCover(
      node.cover||node.image||node.picture||picture.large||picture.medium||images.large_image_url||images.image_url||''
    );
    return (titles.length||anilistId||malId)?{titles,cover,anilistId,malId,title:String(node.title||node.titleEnglish||node.titleRomaji||'')}:null;
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
        const response=await fetch('/api/mal/list',{headers:{Accept:'application/json'},credentials:'same-origin'});
        if(!response.ok){remoteWatchlist=[];remoteWatchlistFetchedAt=Date.now();return;}
        const data=await response.json();
        remoteWatchlist=Array.isArray(data.data)?data.data:[];
        remoteWatchlistFetchedAt=Date.now();
        if(state.programs.length)renderEvents();
      }catch{
        remoteWatchlist=[];remoteWatchlistFetchedAt=Date.now();
      }finally{remoteWatchlistTask=null;}
    })();
    return remoteWatchlistTask;
  }
  const fmtDay=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const fmtMonth=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',year:'numeric'});
  function setMonth(year,month,day){
    const previous=state.year&&state.month?Date.UTC(state.year,state.month-1,1):0;
    const normalized=new Date(Date.UTC(year,month-1,1));
    const next=Date.UTC(normalized.getUTCFullYear(),normalized.getUTCMonth(),1);
    state.direction=previous&&next<previous?-1:1;
    state.year=normalized.getUTCFullYear();state.month=normalized.getUTCMonth()+1;
    const last=new Date(Date.UTC(state.year,state.month,0)).getUTCDate();
    state.selected=keyFor(state.year,state.month,Math.max(1,Math.min(last,Number(day)||1)));
    loadMonth();
  }
  function selectedItems(){
    return state.programs.filter(item=>item.date===state.selected).sort((a,b)=>String(a.airingAt||'').localeCompare(String(b.airingAt||'')));
  }
  function renderEvents(){
    selectedLabel.textContent=fmtDay.format(dateFromKey(state.selected));
    eventsNode.classList.remove('is-updating');
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      void eventsNode.offsetWidth;
      eventsNode.classList.add('is-updating');
    }
    const items=selectedItems();
    el('hkCalDayCount').textContent=state.loading?'LOADING':items.length+' '+(items.length===1?'BROADCAST':'BROADCASTS');
    if(state.loading){eventsNode.innerHTML='<div class="hk-cal-loading">Loading broadcast records…</div>';return;}
    if(state.error){eventsNode.innerHTML='<div class="hk-cal-empty">'+escape(state.error)+'</div>';return;}
    if(!items.length){eventsNode.innerHTML='<div class="hk-cal-empty">No broadcast records are listed for this date.<br>Try another date or month.</div>';return;}
    eventsNode.innerHTML=items.map(item=>{
      const watched=findWatchedMatch(item);
      const title=item.title&&!item.titleUnavailable?item.title:(watched&&watched.title)||item.title||'Anime broadcast';
      const episode=item.episode?'Episode '+escape(item.episode):'Broadcast listing';
      const subtitle=item.subtitle?'<p class="hk-cal-event-subtitle">'+escape(item.subtitle)+'</p>':'';
      const run=item.firstAired?'<p class="hk-cal-event-subtitle">Series run: '+escape(item.firstAired)+(item.firstEnded?' → '+escape(item.firstEnded):'')+'</p>':'';
      const stateLabel=item.status==='upcoming'?'UPCOMING':'AIRED';
      const channel=item.channel?'<span>'+escape(item.channel)+'</span>':'';
      const type=item.isPremiere?'PREMIERE':item.listingType||'TV';
      const poster=watched&&watched.cover?'<img class="hk-cal-event-cover" src="'+escape(watched.cover)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'';
      const watchTag=watched?'<span class="hk-cal-event-watch-tag">IN YOUR WATCHLIST</span>':'';
      return '<article class="hk-cal-event" data-state="'+escape(item.status)+'"'+(watched?' data-watching="true"':'')+'><div class="hk-cal-event-time">'+escape(item.time||'—')+'<small style="display:block;color:var(--muted);font-size:8px;font-weight:600">JST</small></div><div class="hk-cal-event-content">'+poster+'<div class="hk-cal-event-copy"><h4><a href="'+escape(item.url||'https://cal.syoboi.jp/')+'" target="_blank" rel="noopener noreferrer">'+escape(title)+'</a></h4>'+watchTag+'<p class="hk-cal-event-subtitle">'+episode+'</p>'+subtitle+run+'<div class="hk-cal-event-meta"><span>'+escape(type)+'</span>'+channel+'<span class="hk-cal-event-state">'+stateLabel+'</span></div></div></div></article>';
    }).map((markup,index)=>markup.replace('<article class="hk-cal-event"','<article style="--hk-event-index:'+index+'" class="hk-cal-event"')).join('');
  }
  function renderGrid(){
    const offset=new Date(Date.UTC(state.year,state.month-1,1)).getUTCDay();
    const days=new Date(Date.UTC(state.year,state.month,0)).getUTCDate();
    const slots=Math.ceil((offset+days)/7)*7;
    const counts=new Map();
    state.programs.forEach(item=>counts.set(item.date,(counts.get(item.date)||0)+1));
    const html=[];
    for(let slot=0;slot<slots;slot++){
      const day=slot-offset+1;
      if(day<1||day>days){html.push('<div class="hk-calendar-day-cell is-outside" aria-hidden="true"></div>');continue;}
      const key=keyFor(state.year,state.month,day),count=counts.get(key)||0;
      const classes=['hk-calendar-day-cell',key===state.selected?'is-selected':'',key===today?'is-today':''].filter(Boolean).join(' ');
      const countHtml=count?'<span class="hk-cal-event-count">'+count+'</span>':'<span class="hk-cal-day-dots" aria-hidden="true"></span>';
      html.push('<button type="button" class="'+classes+'" data-calendar-date="'+key+'" aria-pressed="'+(key===state.selected)+'" aria-label="'+key+(count?', '+count+' broadcasts':'')+'"><span class="hk-cal-day-number">'+day+'</span>'+countHtml+'</button>');
    }
    grid.innerHTML=html.join('');
    grid.querySelectorAll('.hk-calendar-day-cell:not(.is-outside)').forEach((cell,index)=>cell.style.setProperty('--hk-tile-index',index));
    grid.style.setProperty('--hk-cal-shift',(state.direction||1)>0?'12px':'-12px');
    grid.classList.remove('is-changing');
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      void grid.offsetWidth;
      grid.classList.add('is-changing');
    }
    monthLabel.textContent=fmtMonth.format(new Date(Date.UTC(state.year,state.month-1,1)));
    el('hkCalMonthTotal').textContent=state.loading?'UPDATING…':state.error?'SOURCE ERROR':state.programs.length+' '+(state.programs.length===1?'ENTRY':'ENTRIES');
    renderEvents();
  }
  async function loadMonth(){
    const request=++state.request;
    state.loading=true;state.error='';state.programs=[];renderGrid();
    const start=keyFor(state.year,state.month,1);
    const days=new Date(Date.UTC(state.year,state.month,0)).getUTCDate();
    try{
      const response=await fetch('/api/calendar?start='+encodeURIComponent(start)+'&days='+days,{headers:{Accept:'application/json'},cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Calendar source unavailable.');
      if(!Array.isArray(data.programs))throw new Error('Calendar response is missing its programs list.');
      if(request!==state.request)return;
      state.programs=data.programs;
      if(data.rawProgramCount>0&&!data.programs.length)throw new Error('The source returned '+data.rawProgramCount+' records, but none could be displayed.');
    }catch(error){
      if(request!==state.request)return;
      state.programs=[];state.error=error&&error.message?error.message:'Could not load the anime schedule.';
    }finally{
      if(request===state.request){state.loading=false;renderGrid();}
    }
  }
  grid.addEventListener('click',event=>{
    const button=event.target.closest('[data-calendar-date]');
    if(!button)return;
    state.selected=button.dataset.calendarDate;renderGrid();
  });
  el('hkCalPrev').addEventListener('click',()=>setMonth(state.year,state.month-1,1));
  el('hkCalNext').addEventListener('click',()=>setMonth(state.year,state.month+1,1));
  el('hkCalToday').addEventListener('click',()=>setMonth(Number(today.slice(0,4)),Number(today.slice(5,7)),Number(today.slice(8,10))));
  window.addEventListener('storage',event=>{if(event.key==='folio_local_anime_v1')renderEvents();});
  window.addEventListener('hekomi:anime-list-updated',()=>renderEvents());
  window.addEventListener('focus',()=>{void refreshRemoteWatchlist();renderEvents();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){void refreshRemoteWatchlist();renderEvents();}});
  setMonth(Number(today.slice(0,4)),Number(today.slice(5,7)),Number(today.slice(8,10)));
  void refreshRemoteWatchlist();
})();
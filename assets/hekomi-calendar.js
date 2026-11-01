(function(){
  'use strict';
  const root=document.getElementById('hkCalendar');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const grid=$('hkCalGrid'),monthLabel=$('hkCalMonthLabel'),selectedLabel=$('hkCalSelectedDate'),eventsNode=$('hkCalEvents');
  const state={year:0,month:0,selected:'',programs:[],loading:false,error:''};
  const dateParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=type=>dateParts.find(item=>item.type===type)?.value||'01';
  const todayKey=part('year')+'-'+part('month')+'-'+part('day');
  const parseKey=key=>{const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d));};
  const keyFor=(year,month,day)=>year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const monthFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',year:'numeric'});
  function setMonth(year,month,selectedDay){
    const date=new Date(Date.UTC(year,month-1,1));
    state.year=date.getUTCFullYear();state.month=date.getUTCMonth()+1;
    const max=new Date(Date.UTC(state.year,state.month,0)).getUTCDate();
    const day=Math.max(1,Math.min(max,Number(selectedDay)||1));
    state.selected=keyFor(state.year,state.month,day);
    loadMonth();
  }
  function renderEvents(){
    selectedLabel.textContent=dayFormatter.format(parseKey(state.selected));
    const items=state.programs.filter(item=>item.date===state.selected).sort((a,b)=>String(a.airingAt).localeCompare(String(b.airingAt)));
    $('hkCalDayCount').textContent=items.length+' '+(items.length===1?'BROADCAST':'BROADCASTS');
    if(state.loading){eventsNode.innerHTML='<div class="hk-cal-loading">Loading the selected date…</div>';return;}
    if(state.error){eventsNode.innerHTML='<div class="hk-cal-empty">'+escapeHtml(state.error)+'</div>';return;}
    if(!items.length){eventsNode.innerHTML='<div class="hk-cal-empty">No anime broadcast records for this date.<br>Try another day or browse a different month.</div>';return;}
    eventsNode.innerHTML=items.map(item=>{
      const episode=item.episode?'Episode '+escapeHtml(item.episode):'Broadcast listing';
      const subtitle=item.subtitle?'<p class="hk-cal-event-subtitle">'+escapeHtml(item.subtitle)+'</p>':'';
      const channel=item.channel?'<span>'+escapeHtml(item.channel)+'</span>':'';
      const stateLabel=item.status==='upcoming'?'UPCOMING':'AIRED';
      return '<article class="hk-cal-event" data-state="'+escapeHtml(item.status)+'"><div class="hk-cal-event-time">'+escapeHtml(item.time||'—')+'<small style="display:block;color:var(--muted);font-size:8px;font-weight:600">JST</small></div><div><h4><a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(item.title)+'</a></h4><p class="hk-cal-event-subtitle">'+episode+'</p>'+subtitle+'<div class="hk-cal-event-meta">'+channel+'<span class="hk-cal-event-state">'+stateLabel+'</span></div></div></article>';
    }).join('');
  }
  function renderGrid(){
    const first=new Date(Date.UTC(state.year,state.month-1,1)).getUTCDay();
    const totalDays=new Date(Date.UTC(state.year,state.month,0)).getUTCDate();
    const weeks=Math.ceil((first+totalDays)/7);
    const eventCounts=new Map();
    state.programs.forEach(item=>eventCounts.set(item.date,(eventCounts.get(item.date)||0)+1));
    const cells=[];
    for(let index=0;index<weeks*7;index++){
      const day=index-first+1;
      if(day<1||day>totalDays){cells.push('<div class="hk-calendar-day-cell is-outside" aria-hidden="true"></div>');continue;}
      const key=keyFor(state.year,state.month,day),count=eventCounts.get(key)||0;
      const classes=['hk-calendar-day-cell',key===state.selected?'is-selected':'',key===todayKey?'is-today':''].filter(Boolean).join(' ');
      const dots=count?'<span class="hk-cal-day-dots" aria-hidden="true">'+Array.from({length:Math.min(3,count)},()=>'<i></i>').join('')+'</span>':'<span class="hk-cal-day-dots" aria-hidden="true"></span>';
      const countMarkup=count?'<span class="hk-cal-event-count">'+count+'</span>':'<span class="hk-cal-day-dots" aria-hidden="true"></span>';
      cells.push('<button type="button" class="'+classes+'" data-calendar-date="'+key+'" aria-pressed="'+(key===state.selected?'true':'false')+'" aria-label="'+key+(count?', '+count+' broadcasts':'')+'"><span class="hk-cal-day-number">'+day+'</span>'+countMarkup+(!count?dots:'')+'</button>');
    }
    grid.innerHTML=cells.join('');
    monthLabel.textContent=monthFormatter.format(new Date(Date.UTC(state.year,state.month-1,1)));
    const total=state.programs.length;
    $('hkCalMonthTotal').textContent=state.loading?'UPDATING…':state.error?'SOURCE UNAVAILABLE':total+' '+(total===1?'ENTRY':'ENTRIES');
    renderEvents();
  }
  async function loadMonth(){
    if(state.loading)return;
    state.loading=true;state.error='';renderGrid();
    const start=keyFor(state.year,state.month,1);
    const days=new Date(Date.UTC(state.year,state.month,0)).getUTCDate();
    try{
      const response=await fetch('/api/calendar?start='+encodeURIComponent(start)+'&days='+days,{headers:{Accept:'application/json'},cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'The schedule source is unavailable.');
      state.programs=Array.isArray(data.programs)?data.programs:[];
    }catch(error){
      state.programs=[];state.error=error.message||'The schedule could not be loaded.';
    }finally{
      state.loading=false;renderGrid();
    }
  }
  grid.addEventListener('click',event=>{
    const button=event.target.closest('[data-calendar-date]');if(!button)return;
    state.selected=button.dataset.calendarDate;renderGrid();
  });
  $('hkCalPrev').addEventListener('click',()=>setMonth(state.year,state.month-1,1));
  $('hkCalNext').addEventListener('click',()=>setMonth(state.year,state.month+1,1));
  $('hkCalToday').addEventListener('click',()=>setMonth(Number(todayKey.slice(0,4)),Number(todayKey.slice(5,7)),Number(todayKey.slice(8,10))));
  setMonth(Number(todayKey.slice(0,4)),Number(todayKey.slice(5,7)),Number(todayKey.slice(8,10)));
})();
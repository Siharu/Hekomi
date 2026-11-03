import { HekomiMemory, replyAsHekomi } from '../lib/hekomi-core.mjs';

(() => {
  if (window.__hekomiCoreMounted) return;
  window.__hekomiCoreMounted = true;
  const style = document.createElement('style');
  style.textContent = `
    .hk-core-launch{position:fixed;right:18px;bottom:18px;z-index:1200;border:1px solid #a9f0db55;border-radius:999px;background:#211d30;color:#f6efff;padding:10px 15px;box-shadow:0 8px 30px #0005;font:600 13px system-ui;cursor:pointer}
    .hk-core-launch:hover{transform:translateY(-2px);border-color:#a9f0db}
    .hk-core-panel{position:fixed;right:18px;bottom:72px;z-index:1201;width:min(360px,calc(100vw - 24px));height:min(490px,calc(100dvh - 100px));display:none;flex-direction:column;overflow:hidden;border:1px solid #a9f0db55;border-radius:18px;background:#171522;color:#f6efff;box-shadow:0 18px 60px #0009;font:14px system-ui}
    .hk-core-panel.open{display:flex}.hk-core-head{padding:14px 16px;background:linear-gradient(120deg,#30253f,#203b3a);display:flex;align-items:center;justify-content:space-between}
    .hk-core-head strong{font-size:14px}.hk-core-head small{display:block;color:#c8c0d5;font-size:11px;margin-top:3px}
    .hk-core-close{background:none;border:0;color:inherit;font-size:22px;cursor:pointer}
    .hk-core-log{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
    .hk-core-msg{max-width:88%;white-space:pre-wrap;line-height:1.45;padding:10px 12px;border-radius:14px;background:#292437;align-self:flex-start}
    .hk-core-msg.user{background:#31534f;align-self:flex-end}.hk-core-action{color:#a9f0db;display:inline-block;margin-top:7px}
    .hk-core-form{display:flex;gap:8px;padding:12px;border-top:1px solid #ffffff18}
    .hk-core-input{min-width:0;flex:1;border:1px solid #ffffff25;border-radius:12px;background:#242132;color:#fff;padding:11px;font:inherit}
    .hk-core-send{border:0;border-radius:12px;padding:0 14px;background:#a9f0db;color:#18211f;font-weight:700}
    .hk-core-foot{padding:0 13px 10px;color:#a9a2b7;font-size:10px;display:flex;justify-content:space-between;gap:8px}
    .hk-core-foot button{background:none;border:0;color:#c5b5ff;text-decoration:underline;cursor:pointer;font:inherit}
    @media(max-width:520px){.hk-core-launch{right:12px;bottom:12px}.hk-core-panel{right:8px;bottom:64px;width:calc(100vw - 16px);height:min(70dvh,520px)}}
  `;
  document.head.appendChild(style);
  const memory = new HekomiMemory();
  const launch = document.createElement('button');
  launch.className = 'hk-core-launch'; launch.type = 'button'; launch.textContent = '✦ Talk to Hekomi-chan';
  launch.setAttribute('aria-expanded','false');
  const panel = document.createElement('section');
  panel.className = 'hk-core-panel'; panel.setAttribute('aria-label','Chat with Hekomi-chan');
  panel.innerHTML = '<header class="hk-core-head"><div><strong>Hekomi-chan</strong><small>Your tiny Hekomi companion</small></div><button class="hk-core-close" type="button" aria-label="Close chat">×</button></header><div class="hk-core-log" aria-live="polite"></div><form class="hk-core-form"><input class="hk-core-input" maxlength="500" placeholder="Say something…" aria-label="Message Hekomi-chan"><button class="hk-core-send" type="submit">Send</button></form><div class="hk-core-foot"><span>Notes stay in this browser</span><button type="button" class="hk-core-forget">Forget my notes</button></div>';
  document.body.append(launch,panel);
  const log=panel.querySelector('.hk-core-log'),form=panel.querySelector('form'),input=panel.querySelector('input');
  function bubble(text,who='bot',action){const el=document.createElement('div');el.className='hk-core-msg'+(who==='user'?' user':'');el.textContent=text;if(action){const a=document.createElement('a');a.className='hk-core-action';a.href=action.href;a.textContent=action.label+' ↗';el.append(document.createElement('br'),a);}log.appendChild(el);log.scrollTop=log.scrollHeight;}
  bubble('Hiii! I’m Hekomi-chan. We can talk about anime, manga, Hekomi, or just hang out. If you want me to remember something, say “remember that…”. ✨');
  function open(){panel.classList.add('open');launch.setAttribute('aria-expanded','true');input.focus();}
  function close(){panel.classList.remove('open');launch.setAttribute('aria-expanded','false');launch.focus();}
  launch.addEventListener('click',()=>panel.classList.contains('open')?close():open());
  panel.querySelector('.hk-core-close').addEventListener('click',close);
  panel.querySelector('.hk-core-forget').addEventListener('click',()=>{if(!confirm('Forget all Hekomi-chan notes saved in this browser?'))return;memory.forget();bubble('All saved notes cleared. Fresh start! 🌱');});
  form.addEventListener('submit',event=>{event.preventDefault();const value=input.value.trim();if(!value)return;input.value='';bubble(value,'user');const profile=(()=>{try{return JSON.parse(localStorage.getItem('hekomi_profile_v1')||'{}');}catch{return {};}})();const result=replyAsHekomi(value,memory,{displayName:profile.displayName||''});bubble(result.text,'bot',result.action);if(window.hekomiChan?.say)window.hekomiChan.say(result.text.replace(/\n/g,' '),6500,true);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.classList.contains('open'))close();});
})();

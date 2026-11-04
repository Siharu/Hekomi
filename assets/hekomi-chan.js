/* Hekomi-chan — handcrafted pixel companion.
   64×80 logical canvas. All drawing is aligned to an integer pixel grid. */
(() => {
  'use strict';
  const W=64,H=80;
  const P={
    ink:'#171522',hair0:'#211b30',hair1:'#30253f',hair2:'#49365d',hair3:'#654b7d',hair4:'#8b6a9e',
    skin0:'#ce8e88',skin1:'#e9b3a4',skin2:'#f7cbbb',skin3:'#ffe0cf',blush:'#e99b9e',
    eye0:'#2a2039',eye1:'#5a3c7c',eye2:'#9871cc',eye3:'#c8a8f0',white:'#fff0e8',
    shirt0:'#40364f',shirt1:'#65577f',shirt2:'#8875a9',shirt3:'#ad9acb',
    mint0:'#4d9f91',mint1:'#8be1cf',pant0:'#1d2232',pant1:'#2c3145',pant2:'#41465c',
    shoe0:'#171925',shoe1:'#77718d',accent:'#c5b5ff'
  };
  const BACK_HAIR=[
    [15,7,34,7,'ink'],[12,11,40,12,'ink'],[10,20,44,22,'ink'],
    [10,37,9,17,'ink'],[11,50,9,11,'ink'],[15,57,7,8,'ink'],
    [43,38,10,18,'ink'],[45,51,8,12,'ink'],[43,60,8,6,'ink'],[17,61,7,5,'ink'],[40,64,8,4,'ink'],
    [15,10,34,7,'hair0'],[13,15,38,12,'hair0'],[12,27,7,26,'hair0'],
    [13,49,7,11,'hair0'],[17,57,5,7,'hair0'],[46,27,6,27,'hair0'],
    [46,50,6,12,'hair0'],[43,58,7,7,'hair0'],[20,61,5,4,'hair0'],
    [17,14,4,16,'hair1'],[13,29,4,17,'hair1'],[15,47,4,12,'hair1'],
    [45,29,4,17,'hair1'],[47,45,3,12,'hair1'],[43,58,4,6,'hair1'],
    [20,9,8,3,'hair2'],[30,8,8,3,'hair2'],[39,11,7,3,'hair2'],
    [14,22,3,7,'hair2'],[47,23,3,8,'hair2'],[17,17,3,8,'hair3'],
    [19,12,7,2,'hair3'],[33,10,6,2,'hair3'],[42,15,4,3,'hair3'],
    [14,42,2,6,'hair3'],[48,40,2,7,'hair3'],[17,54,2,5,'hair2'],[46,54,2,5,'hair2']
  ];
  const LEGS=[
    [20,61,25,15,'ink'],[21,62,10,14,'pant0'],[34,62,10,14,'pant0'],
    [23,63,7,10,'pant1'],[35,63,7,10,'pant1'],[30,64,4,12,'ink'],
    [21,70,8,3,'pant2'],[36,69,7,3,'pant2'],[22,74,10,3,'shoe0'],
    [34,74,11,3,'shoe0'],[19,76,13,3,'ink'],[33,76,13,3,'ink'],
    [21,74,9,2,'shoe1'],[35,74,8,2,'shoe1'],[24,67,2,5,'pant2'],[39,65,2,5,'pant2'],
    [28,63,2,3,'pant1'],[33,63,2,3,'pant1']
  ];
  const TORSO=[
    [27,39,10,9,'skin0'],[28,39,8,6,'skin2'],[29,42,6,4,'skin1'],
    [17,46,30,19,'ink'],[15,48,34,15,'ink'],[17,47,30,17,'shirt0'],
    [15,49,6,10,'shirt0'],[43,49,6,10,'shirt0'],[18,48,28,13,'shirt1'],
    [17,53,30,9,'shirt1'],[20,48,24,3,'shirt2'],[17,50,4,7,'shirt2'],
    [41,50,4,7,'shirt2'],[22,52,3,7,'shirt2'],[38,52,3,7,'shirt2'],
    [21,58,23,3,'shirt0'],[19,62,26,3,'ink'],[25,47,4,3,'shirt3'],
    [35,47,4,3,'shirt3'],[29,48,6,3,'mint0'],[30,49,4,2,'mint1'],
    [34,53,2,2,'accent'],[36,55,2,2,'accent'],[34,57,2,2,'accent'],
    [31,55,2,2,'accent'],[32,53,2,2,'accent'],[19,59,5,2,'shirt2'],[39,59,4,2,'shirt2']
  ];
  const FACE=[
    [17,17,31,26,'ink'],[19,18,27,25,'skin1'],[22,17,21,27,'skin2'],
    [19,21,3,17,'skin0'],[43,21,3,17,'skin0'],[21,19,22,3,'skin3'],
    [24,22,16,2,'skin3'],[22,39,21,3,'skin1'],[25,42,14,2,'skin0'],
    [16,27,4,6,'skin0'],[45,27,4,6,'skin0'],[18,29,2,3,'skin2'],
    [45,29,2,3,'skin2'],[21,36,3,2,'blush'],[41,36,3,2,'blush']
  ];
  const FRINGE=[
    [13,9,37,9,'ink'],[11,13,41,8,'ink'],[13,20,36,7,'ink'],
    [15,12,34,6,'hair0'],[13,17,38,6,'hair0'],[15,22,34,4,'hair0'],
    [17,9,9,5,'hair1'],[28,8,9,4,'hair1'],[39,10,8,4,'hair1'],
    [13,15,5,9,'hair1'],[46,15,5,10,'hair1'],[19,16,6,7,'hair2'],
    [30,13,6,7,'hair2'],[40,15,6,6,'hair2'],[17,21,5,8,'hair0'],
    [23,19,5,8,'hair1'],[29,18,6,8,'hair0'],[36,19,5,7,'hair1'],
    [42,21,5,7,'hair0'],[15,28,4,16,'hair0'],[13,37,4,15,'hair1'],
    [16,47,4,8,'hair0'],[44,28,4,16,'hair0'],[47,36,4,16,'hair1'],
    [44,47,4,10,'hair0'],[18,13,5,2,'hair3'],[32,11,5,2,'hair3'],
    [43,13,4,2,'hair3'],[15,24,2,5,'hair3'],[47,25,2,5,'hair3'],
    [18,34,2,7,'hair2'],[45,35,2,8,'hair2']
  ];
  function blocks(ctx,list,dy=0){
    for(const [x,y,w,h,color] of list){ctx.fillStyle=P[color];ctx.fillRect(x,y+dy,w,h);}
  }
  function drawLeftArm(ctx,dy){
    blocks(ctx,[
      [14,48,7,11,'ink'],[15,49,5,8,'shirt0'],[16,50,4,5,'shirt2'],
      [14,57,5,8,'skin0'],[13,60,6,5,'skin1'],[14,64,5,2,'skin2'],[16,62,3,2,'skin2'],[14,58,2,3,'skin1']
    ],dy);
  }
  // The waving hand is drawn as a connected shoulder → elbow → wrist → palm,
  // with separate fingers. Small pose changes keep the pixel silhouette readable.
  function drawWaveArm(ctx,frame,dy){
    const lift=[0,-1,-2,-1,0,1][frame%6];
    const tilt=[0,0,1,1,0,-1][frame%6];
    blocks(ctx,[
      [41,47,9,12,'ink'],[43,48,6,9,'shirt0'],[43,49,5,6,'shirt2'],
      [47,47,5,8,'skin0'],[48,46,4,8,'skin1'],
      [49+tilt,39+lift,4,10,'skin0'],[50+tilt,38+lift,3,9,'skin2'],
      [49+tilt,31+lift,8,9,'skin0'],[50+tilt,30+lift,6,8,'skin2'],
      [49+tilt,23+lift,2,9,'skin1'],[52+tilt,20+lift,2,12,'skin3'],
      [55+tilt,22+lift,2,10,'skin2'],[58+tilt,26+lift,2,7,'skin1'],
      [47+tilt,32+lift,3,5,'skin0'],[48+tilt,34+lift,3,3,'skin2'],
      [50+tilt,32+lift,1,2,'skin3'],[53+tilt,30+lift,1,2,'skin3'],
      [56+tilt,31+lift,1,2,'skin3'],[50+tilt,39+lift,2,2,'skin3']
    ],dy);
  }
  function drawMakingBedArm(ctx,frame,dy){
    const reach=frame%4<2?0:2;
    blocks(ctx,[
      [41,47,9,12,'ink'],[43,48,6,9,'shirt0'],[43,49,5,6,'shirt2'],
      [46,53,5,7,'skin0'],[44,57,5,6,'skin1'],
      [40-reach,60,7,4,'skin0'],[36-reach,61,7,3,'skin2'],
      [34-reach,60,3,2,'skin3'],[39-reach,58,2,2,'skin3']
    ],dy);
  }
  function drawEatingArm(ctx,frame,dy){
    const chew=frame%4<2?0:1;
    blocks(ctx,[
      [41,47,9,12,'ink'],[43,48,6,9,'shirt0'],[43,49,5,6,'shirt2'],
      [46,45,5,7,'skin0'],[47,41,5,7,'skin1'],
      [45,37-chew,5,7,'skin0'],[44,35-chew,5,6,'skin2'],
      [43,34-chew,4,5,'skin1'],[42,35-chew,3,3,'skin3'],
      [47,37-chew,2,3,'skin3'],[45,41,2,2,'skin3']
    ],dy);
  }
  function drawPerchArms(ctx,frame,dy){
    const press=frame%4<2?0:1;
    blocks(ctx,[
      [14,48,7,11,'ink'],[15,49,5,8,'shirt0'],[16,50,4,5,'shirt2'],
      [13,58,5,6,'skin0'],[12,62+press,5,4,'skin1'],[12,64+press,4,2,'skin2'],
      [41,47,9,11,'ink'],[43,48,6,8,'shirt0'],[44,49,4,6,'shirt2'],
      [47,57,5,6,'skin0'],[48,62+press,5,4,'skin1'],[49,65+press,4,2,'skin2']
    ],dy);
  }
  function drawPerchLegs(ctx,frame,dy){
    const swing=frame%6<3?0:1;
    blocks(ctx,[
      [20,61,25,7,'ink'],[21,62,10,7,'pant0'],[34,62,10,7,'pant0'],
      [20,67,8,6,'pant1'],[35,67,8,6,'pant1'],
      [17,72+swing,10,4,'pant0'],[37,71-swing,9,5,'pant0'],
      [15,76+swing,13,3,'ink'],[36,75-swing,13,3,'ink'],
      [17,75+swing,9,2,'shoe1'],[38,74-swing,9,2,'shoe1'],
      [24,66,2,3,'pant2'],[37,66,2,3,'pant2']
    ],dy);
  }
  function drawEyes(ctx,expression,blink,gazeX=0,gazeY=0){
    if(blink){
      blocks(ctx,[[22,31,8,2,'eye0'],[23,32,6,1,'eye2'],[36,31,8,2,'eye0'],[37,32,6,1,'eye2']]);
      return;
    }
    if(expression==='happy'){
      blocks(ctx,[[22,31,2,2,'eye0'],[24,33,5,2,'eye0'],[29,31,2,2,'eye0'],
        [36,31,2,2,'eye0'],[38,33,5,2,'eye0'],[43,31,2,2,'eye0'],[25,34,3,1,'eye2'],[39,34,3,1,'eye2']]);
      return;
    }
    if(expression==='sleepy'){
      blocks(ctx,[[22,31,8,2,'eye0'],[23,32,6,2,'eye1'],[36,31,8,2,'eye0'],[37,32,6,2,'eye1']]);
      return;
    }
    const surprised=expression==='surprised';
    blocks(ctx,[
      [21,28,10,2,'eye0'],[35,28,10,2,'eye0'],
      [22,30,8,surprised?7:5,'white'],[36,30,8,surprised?7:5,'white'],
      [24,30,5,surprised?7:5,'eye1'],[38,30,5,surprised?7:5,'eye1'],
      [25,31,4,surprised?6:4,'eye2'],[39,31,4,surprised?6:4,'eye2'],
      [26+gazeX,31+gazeY,2,3,'eye3'],[40+gazeX,31+gazeY,2,3,'eye3'],[25+gazeX,31+gazeY,1,1,'white'],[39+gazeX,31+gazeY,1,1,'white'],
      [22,29,3,1,'hair0'],[42,29,3,1,'hair0']
    ]);
  }
  function drawFaceDetails(ctx,expression,chewFrame=0){
    blocks(ctx,[[18,30,2,4,'skin1'],[45,30,2,4,'skin1'],[21,37,4,2,'blush'],[41,37,4,2,'blush'],[31,36,2,3,'skin0'],[32,37,2,2,'skin2']]);
    if(expression==='surprised')blocks(ctx,[[31,40,4,4,'skin0'],[32,40,2,2,'ink']]);
    else if(expression==='annoyed')blocks(ctx,[[29,39,6,2,'eye0'],[30,41,4,1,'eye0']]);
    else if(expression==='sleepy')blocks(ctx,[[30,40,5,1,'eye0'],[34,41,2,1,'skin0']]);
    else if(expression==='happy')blocks(ctx,[[29,39,2,2,'eye0'],[31,41,4,2,'eye0'],[35,39,2,2,'eye0']]);
    else if(expression==='eating'){
      if(chewFrame%2===0)blocks(ctx,[[30,40,5,3,'eye0'],[31,41,3,1,'skin1']]);
      else blocks(ctx,[[30,40,5,1,'eye0'],[34,41,2,1,'eye0']]);
    }else blocks(ctx,[[30,40,5,1,'eye0'],[34,41,2,1,'eye0']]);
  }
  function drawSprite(ctx,frame){
    ctx.clearRect(0,0,W,H);
    const dy=frame.bob;
    blocks(ctx,BACK_HAIR,dy);
    if(frame.sitting)drawPerchLegs(ctx,frame.step,dy);
    else if(frame.walking)drawWalkLegs(ctx,frame.step,dy);
    else blocks(ctx,LEGS,dy);
    blocks(ctx,TORSO,dy);
    if(frame.sleeping)drawSleepArms(ctx,dy);
    else if(frame.walking)drawWalkArms(ctx,frame.step,dy);
    else if(frame.action==='making-bed')drawMakingBedArm(ctx,frame.wave,dy);
    else if(frame.action==='eating')drawLeftArm(ctx,dy);
    else if(frame.sitting)drawPerchArms(ctx,frame.step,dy);
    else {drawLeftArm(ctx,dy);drawWaveArm(ctx,frame.wave,dy);}
    blocks(ctx,FACE,dy);
    blocks(ctx,FRINGE,dy);
    blocks(ctx,[
      [13,45,5,12,'hair0'],[14,54,4,7,'hair1'],[45,46,5,12,'hair0'],
      [46,54,4,8,'hair1'],[17,58,3,5,'hair0'],[44,60,3,5,'hair1']
    ],dy);
    drawEyes(ctx,frame.expression,frame.blink,frame.gazeX||0,frame.gazeY||0);
    drawFaceDetails(ctx,frame.expression,frame.chewFrame||0);
    if(frame.action==='eating'){
      drawEatingArm(ctx,frame.chewFrame||0,dy);
      blocks(ctx,[
        [42,34,5,4,'white'],[41,35,2,3,'skin1'],
        [43,37,4,1,'mint0'],[44,34,1,1,'skin3']
      ],dy);
    }
    blocks(ctx,[
      [43,22,3,1,'mint1'],[44,21,1,3,'mint1'],[46,22,2,1,'accent'],
      [17,18,2,1,'hair4'],[48,35,1,3,'hair3'],[13,44,1,4,'hair3'],
      [26,49,2,1,'shirt3'],[37,56,2,1,'shirt3'],[23,66,2,1,'pant2'],[37,66,2,1,'pant2']
    ],dy);
  }

  function drawWalkLegs(ctx,step,dy){
    const poses=[
      [[20,61,25,5,'ink'],[21,65,9,7,'pant0'],[35,65,9,7,'pant0'],[21,70,9,3,'pant1'],[36,70,8,3,'pant1'],[17,74,14,4,'shoe0'],[36,74,13,4,'shoe0'],[20,74,9,2,'shoe1'],[38,74,8,2,'shoe1'],[30,65,4,10,'ink']],
      [[21,61,24,5,'ink'],[21,65,9,8,'pant0'],[34,65,9,6,'pant0'],[18,71,10,3,'pant1'],[38,69,8,3,'pant1'],[14,74,14,4,'shoe0'],[38,72,12,4,'shoe0'],[17,74,9,2,'shoe1'],[40,72,8,2,'shoe1'],[30,65,4,10,'ink']],
      [[20,61,25,5,'ink'],[22,65,8,7,'pant0'],[34,65,9,8,'pant0'],[24,70,8,3,'pant1'],[33,72,9,3,'pant1'],[23,73,12,4,'shoe0'],[33,74,14,4,'shoe0'],[25,73,8,2,'shoe1'],[36,74,9,2,'shoe1'],[30,65,4,10,'ink']],
      [[20,61,25,5,'ink'],[20,65,9,6,'pant0'],[35,65,9,8,'pant0'],[16,69,10,3,'pant1'],[38,72,8,3,'pant1'],[12,72,14,4,'shoe0'],[37,74,13,4,'shoe0'],[15,72,9,2,'shoe1'],[39,74,8,2,'shoe1'],[30,65,4,10,'ink']]
    ];
    blocks(ctx,poses[step%4],dy);
  }
  function drawWalkArms(ctx,step,dy){
    const poses=[
      [[14,48,7,11,'ink'],[15,49,5,8,'shirt0'],[16,50,4,5,'shirt2'],[14,57,5,7,'skin0'],[15,59,5,5,'skin1'],[41,47,9,11,'ink'],[43,48,6,8,'shirt0'],[44,49,4,6,'shirt2'],[46,56,5,7,'skin0'],[46,58,5,5,'skin1']],
      [[13,48,7,12,'ink'],[14,49,5,8,'shirt0'],[15,50,4,5,'shirt2'],[13,59,5,7,'skin0'],[12,62,5,4,'skin1'],[42,47,8,10,'ink'],[44,48,5,7,'shirt0'],[45,49,4,5,'shirt2'],[47,55,5,7,'skin0'],[48,58,5,4,'skin1']],
      [[14,48,7,11,'ink'],[15,49,5,8,'shirt0'],[16,50,4,5,'shirt2'],[14,57,5,7,'skin0'],[13,60,6,5,'skin1'],[41,47,9,11,'ink'],[43,48,6,8,'shirt0'],[44,49,4,6,'shirt2'],[46,56,5,7,'skin0'],[46,59,5,4,'skin1']],
      [[15,48,7,10,'ink'],[16,49,5,7,'shirt0'],[17,50,4,5,'shirt2'],[15,56,5,7,'skin0'],[15,59,5,5,'skin1'],[40,47,9,12,'ink'],[42,48,6,9,'shirt0'],[43,49,4,6,'shirt2'],[45,57,5,7,'skin0'],[45,60,5,4,'skin1']]
    ];
    blocks(ctx,poses[step%4],dy);
  }
  function drawSleepArms(ctx,dy){
    blocks(ctx,[
      [14,48,7,11,'ink'],[15,49,5,8,'shirt0'],[16,50,4,5,'shirt2'],
      [17,54,5,8,'skin0'],[19,56,5,5,'skin1'],[40,48,8,10,'ink'],
      [42,49,5,7,'shirt0'],[43,50,4,5,'shirt2'],[38,55,5,7,'skin0'],
      [36,57,5,5,'skin1'],[25,49,4,2,'skin2'],[35,49,4,2,'skin2']
    ],dy);
  }

  class HekomiWanderer{
    constructor(canvas,message,root,bubble){
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});this.message=message;
      this.root=root;this.bubble=bubble;this.state='idle';this.target=null;this.face=1;
      this.x=12;this.y=12;this.last=0;this.lastSpeech=0;this.speechUntil=0;this.lastObstacleCheck=0;
      this.stateUntil=0;this.walkFrame=0;this.stops=0;this.sleepCount=0;this.hiddenPause=false;
      this.nextBlink=performance.now()+1800+Math.random()*2600;this.blinkUntil=0;this.gazeX=0;this.gazeY=0;this.nextGlance=performance.now()+2200+Math.random()*3800;this.activity='idle';
      this.scrollTimer=0;this.lastScrollSpeechAt=0;this.lastSpecialAt=0;
      this.airingPromise=null;this.airingPool=[];this.lastRecommendedId=0;this.recommendationToken=0;this.nextPose='';
      this.bed=root.querySelector('.hekomi-bed');this.snack=root.querySelector('.hekomi-snack');
      this.recommendLink=bubble&&bubble.querySelector('.hekomi-recommend-link');
      this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.canvas.width=W;this.canvas.height=H;this.ctx.imageSmoothingEnabled=false;
      this.canvas.style.imageRendering='pixelated';this.canvas.setAttribute('role','button');
      this.canvas.setAttribute('tabindex','0');this.canvas.setAttribute('aria-label','Hekomi-chan, wandering around Hekomi. Activate to say hello.');
      this.canvas.title='Say hi to Hekomi-chan';
      this.lines=this.dialogueForPage();
      this.root.addEventListener('click',event=>{
        if(event.target.closest('a,button'))return;
        if(event.target===this.canvas)this.interact();
      });
      this.canvas.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();this.interact();}
      });
      window.addEventListener('resize',()=>this.onResize(),{passive:true});
      window.addEventListener('scroll',()=>this.onScroll(),{passive:true});
      document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.last=performance.now();this.paint(this.last,true);}});
      const startsPerched=this.placeInitially();
      const now=performance.now();
      if(startsPerched){
        this.state='perch';this.root.classList.add('is-perching');
        this.say('This is the best seat in the house.',6500,true);
        this.stateUntil=now+9000;
      }else{
        this.say(this.pick(['Hey! I live here now.','Oh, a visitor!','Psst… need a guide?']),6200,true);
      }
      this.paint(now,true);
      if(!this.reduced){if(!startsPerched)this.stateUntil=now+1800;requestAnimationFrame(time=>this.tick(time));}
    }

    dialogueForPage(){
      const path=location.pathname.toLowerCase();
      if(path.startsWith('/manga'))return ['One more chapter?','The best pages are read slowly.','I found a quiet corner.','Don’t forget to rest your eyes!'];
      if(path.startsWith('/anime'))return ['What are we watching tonight?','I saved you a seat.','That opening song is stuck in my head.','Your watchlist misses you.'];
      if(path.startsWith('/discover'))return ['There’s a whole world in here.','Shall we find something lovely?','I like this little corner.','Look at all those stories!'];
      if(path.startsWith('/profile'))return ['Keeping your little corner tidy?','Your collection has a personality.','I’ll watch over your shelf.'];
      return ['Hey! I live here now.','Oh, a visitor!','Psst… need a guide?','Take your time. Stories can wait.','I found a quiet corner.','The night is good for one more chapter.'];
    }
    pick(items){return items[Math.floor(Math.random()*items.length)];}
    bounds(){
      const w=this.root.offsetWidth||176,h=this.root.offsetHeight||194;
      const mobile=window.matchMedia('(max-width:760px)').matches;
      const visibleHeight=mobile?(window.visualViewport?.height||innerHeight):innerHeight;
      const bottomReserve=mobile?92:10;
      return {minX:8,maxX:Math.max(8,innerWidth-w-8),minY:74,maxY:Math.max(74,visibleHeight-h-bottomReserve),w,h};
    }
    findPerchTarget(){
      if(!location.pathname.toLowerCase().startsWith('/series/anime/'))return null;
      const card=document.querySelector('.detail-cover:not(.detail-cover-missing)');
      if(!card)return null;
      const rect=card.getBoundingClientRect();
      if(rect.width<70||rect.height<100||rect.bottom<30||rect.top>innerHeight-20)return null;
      const b=this.bounds();
      const x=rect.right-142;
      const y=rect.bottom-170;
      return {
        x:Math.max(b.minX,Math.min(x,b.maxX)),
        y:Math.max(b.minY,Math.min(y,b.maxY))
      };
    }
    placeInitially(){
      const b=this.bounds();
      const perch=this.findPerchTarget();
      if(perch){this.x=perch.x;this.y=perch.y;}
      else if(window.matchMedia('(max-width:760px)').matches){
        this.x=b.minX;
        this.y=b.maxY;
        if(this.blocked(this.x,this.y)){const safe=this.findSpot();this.x=safe.x;this.y=safe.y;}
      }else{
        this.x=Math.max(b.minX,b.maxX-(document.body.dataset.page==='home'?24:8));
        this.y=document.body.dataset.page==='home'
          ?Math.max(b.minY,Math.min(190,b.maxY))
          :b.maxY;
        if(this.blocked(this.x,this.y)){
          const safe=this.findSpot();
          this.x=safe.x;this.y=safe.y;
        }
      }
      this.applyPosition();
      this.setInteractable();
      return Boolean(perch);
    }
    blocked(x,y){
      const b=this.bounds();
      const area={left:x+6,right:x+b.w-6,top:y+6,bottom:y+b.h-6};
      const nodes=document.querySelectorAll('a,button,input,select,textarea,[role="button"],.topbar,.modal,.reader-modal,.chapter-pages,.back-top');
      for(const node of nodes){
        if(this.root.contains(node))continue;
        const style=getComputedStyle(node);
        if(style.display==='none'||style.visibility==='hidden'||style.pointerEvents==='none'||Number(style.opacity)===0)continue;
        const r=node.getBoundingClientRect();
        if(r.width<2||r.height<2||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;
        const overlapW=Math.min(area.right,r.right)-Math.max(area.left,r.left);
        const overlapH=Math.min(area.bottom,r.bottom)-Math.max(area.top,r.top);
        if(overlapW>14&&overlapH>16)return true;
      }
      return false;
    }
    findSpot(){
      const b=this.bounds();
      for(let i=0;i<28;i++){
        const x=b.minX+Math.random()*Math.max(1,b.maxX-b.minX);
        const y=b.minY+Math.random()*Math.max(1,b.maxY-b.minY);
        if(!this.blocked(x,y))return {x,y};
      }
      // A slim fallback lane along the bottom edge remains usable on dense pages.
      const y=b.maxY;
      for(let i=0;i<12;i++){
        const x=b.minX+Math.random()*Math.max(1,b.maxX-b.minX);
        if(!this.blocked(x,y))return {x,y};
      }
      return {x:b.maxX,y:b.maxY};
    }
    moveToNext(){
      const perch=this.findPerchTarget();
      const goPerch=Boolean(perch)&&Math.random()<.38;
      const next=goPerch?perch:this.findSpot();
      const distance=Math.hypot(next.x-this.x,next.y-this.y);
      if(distance<50){if(goPerch){this.nextPose='perch';this.arrive();}else this.arrive();return;}
      this.nextPose=goPerch?'perch':'';
      this.target=next;this.state='walk';this.activity='idle';
      this.root.classList.remove('is-sleeping','is-making-bed','is-waking-up','is-eating','is-perching');
      this.canvas.style.transform=this.face<0?'scaleX(-1)':'none';
      this.canvas.style.pointerEvents='none';this.hideSpeech();
    }
    setInteractable(){
      this.canvas.style.pointerEvents=this.blocked(this.x,this.y)?'none':'auto';
    }
    arrive(){
      this.target=null;this.stops++;this.setInteractable();
      const now=performance.now();
      if(this.nextPose==='perch'){
        this.nextPose='';this.state='perch';this.activity='content';
        this.root.classList.add('is-perching');
        this.say(this.pick(['I can see the whole series from here.','This cover is surprisingly comfy.','I’m guarding this anime for you.']),6200);
        this.stateUntil=now+7600+Math.random()*3500;
        return;
      }
      this.state='idle';this.root.classList.remove('is-perching','is-waking-up');
      if(this.stops>=2&&now-this.lastSpecialAt>22000){
        const chance=Math.random();
        if(chance<.13){this.startBedtime(now);return;}
        if(chance<.29){this.startEating(now);return;}
        if(chance<.43){this.recommendAiring(now);return;}
      }
      if(Math.random()<.68)this.say(this.pick(this.lines),5600+Math.random()*900);
      this.stateUntil=now+3400+Math.random()*3300;
    }
    startBedtime(now){
      this.lastSpecialAt=now;this.state='make-bed';this.activity='nesting';
      this.root.classList.remove('is-sleeping','is-eating','is-perching','is-waking-up');
      this.root.classList.add('is-making-bed');
      this.canvas.style.transform=this.face<0?'scaleX(-1)':'none';
      this.say(this.pick(['Let me make the bed first.','Pillow straight… blanket tucked…','Bedtime routine!']),6200,true);
      this.stateUntil=now+2600;
    }
    sleep(now){
      this.state='sleep';this.sleepCount++;this.root.classList.remove('is-making-bed');
      this.root.classList.add('is-sleeping');
      this.canvas.style.transform='rotate(90deg)';
      this.say(this.pick(['All tucked in. Good night…','Wake me when the next episode airs.','Five more minutes…','Zzz…']),9500,true);
      this.stateUntil=now+8500+Math.random()*6500;
    }
    wake(now){
      this.state='wake';this.root.classList.remove('is-sleeping');this.root.classList.add('is-waking-up');
      this.canvas.style.transform=this.face<0?'scaleX(-1)':'none';
      this.say(this.pick(['Mmm… good morning.','I’m awake! I think.','That was a very important nap.']),6200,true);
      this.stateUntil=now+1800;
    }
    startEating(now){
      this.lastSpecialAt=now;this.state='eat';this.activity='snacking';
      this.root.classList.remove('is-sleeping','is-making-bed','is-perching','is-waking-up');
      this.root.classList.add('is-eating');
      this.canvas.style.transform=this.face<0?'scaleX(-1)':'none';
      this.say(this.pick(['Snack break!','Just a little bite.','Want one? I brought extra.']),5600,true);
      this.stateUntil=now+4600+Math.random()*1300;
    }
    async loadAiringAnime(){
      if(this.airingPool.length)return this.airingPool;
      if(this.airingPromise)return this.airingPromise;
      this.airingPromise=fetch('/api/catalog',{headers:{Accept:'application/json'},credentials:'same-origin'})
        .then(response=>{if(!response.ok)throw new Error('Airing catalog unavailable');return response.json();})
        .then(data=>{
          const all=Array.isArray(data&&data.airing)?data.airing:[];
          const now=Date.now();
          const near=all.filter(item=>{
            const at=Number(item&&item.nextAiringEpisode&&item.nextAiringEpisode.airingAt)*1000;
            return Number(item&&item.id)>0&&item.title&&item.cover&&at>now-3600000&&at<now+14*86400000;
          });
          const usable=near.length?near:all.filter(item=>Number(item&&item.id)>0&&item.title&&item.cover);
          this.airingPool=usable;
          return usable;
        })
        .catch(()=>[])
        .finally(()=>{this.airingPromise=null;});
      return this.airingPromise;
    }
    async recommendAiring(now){
      this.lastSpecialAt=now;this.state='recommend';this.activity='curious';
      this.root.classList.remove('is-sleeping','is-making-bed','is-eating','is-perching','is-waking-up');
      const token=++this.recommendationToken;
      this.stateUntil=now+15000;
      this.say('Let me check what is airing right now…',6200,true);
      const list=await this.loadAiringAnime();
      if(this.state!=='recommend'||token!==this.recommendationToken)return;
      if(!list.length){
        this.say('The airing list is shy today. Let’s explore the catalog instead.',6200,true);
        this.stateUntil=performance.now()+6200;
        return;
      }
      const choices=list.filter(item=>Number(item.id)!==this.lastRecommendedId);
      const pick=choices.length?this.pick(choices):this.pick(list);
      this.lastRecommendedId=Number(pick.id)||0;
      const title=String(pick.titleEnglish||pick.title||pick.titleRomaji||'this airing anime');
      const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'series';
      if(this.recommendLink){
        this.recommendLink.href='/series/anime/'+Number(pick.id)+'-'+slug;
        this.recommendLink.textContent='Meet '+title+' ↗';
        this.recommendLink.hidden=false;
      }
      this.say('This one is airing right now. I think you might like it:',8200,true);
      this.stateUntil=performance.now()+8200;
    }
    say(text,duration=5600,force=false){
      if(!this.message||!this.bubble)return false;
      const now=performance.now();
      if(!force&&now<this.speechUntil)return false;
      if(this.recommendLink)this.recommendLink.hidden=true;
      this.message.textContent=text;
      this.speechUntil=now+Math.max(5200,duration);
      this.bubble.classList.add('is-visible');
      this.lastSpeech=now;
      return true;
    }
    hideSpeech(){
      if(performance.now()>this.speechUntil&&this.bubble)this.bubble.classList.remove('is-visible');
    }
    interact(){
      const now=performance.now();
      this.recommendationToken++;
      if(this.scrollTimer){clearTimeout(this.scrollTimer);this.scrollTimer=0;}
      if(this.state==='sleep'){this.say('Huh?! I wasn’t sleeping!',5000,true);this.wake(now);return;}
      const line=this.pick(['Hehe! You noticed me!','Need a little company?','I like it here.','Let’s explore!','I was just stretching.']);
      this.state='greet';this.activity='noticed';this.gazeX=0;this.gazeY=-1;
      this.root.classList.remove('is-making-bed','is-eating','is-perching','is-waking-up');
      this.say(line,6200,true);this.stateUntil=now+3000;
      this.canvas.style.pointerEvents='auto';
      this.paint(now,true);
    }
    onResize(){
      const perch=this.state==='perch'?this.findPerchTarget():null;
      const b=this.bounds();
      if(perch){this.x=perch.x;this.y=perch.y;}
      else{
        this.x=Math.max(b.minX,Math.min(this.x,b.maxX));this.y=Math.max(b.minY,Math.min(this.y,b.maxY));
        if(this.target){this.target.x=Math.max(b.minX,Math.min(this.target.x,b.maxX));this.target.y=Math.max(b.minY,Math.min(this.target.y,b.maxY));}
      }
      this.applyPosition();
    }
    onScroll(){
      const now=performance.now();
      if(this.state==='perch'){
        const perch=this.findPerchTarget();
        if(perch){this.x=perch.x;this.y=perch.y;this.applyPosition();}
        else{this.state='idle';this.root.classList.remove('is-perching');}
      }
      if(this.state==='walk'||this.state==='sleep'||this.state==='make-bed'||this.state==='eat')return;
      this.lastScrollAt=now;
      if(this.scrollTimer)clearTimeout(this.scrollTimer);
      this.scrollTimer=setTimeout(()=>{
        this.scrollTimer=0;
        const settled=performance.now();
        if(document.hidden||this.state==='walk'||this.state==='sleep'||this.state==='make-bed'||this.state==='eat')return;
        if(settled-this.lastScrollSpeechAt<15000||settled<this.speechUntil)return;
        this.lastScrollSpeechAt=settled;
        if(this.state==='idle')this.activity='curious';
        this.say(this.pick(['Oh, we found another corner.','Take your time. I can wait.','There is a lot to discover here.']),6600);
      },950);
    }
    applyPosition(){
      const b=this.bounds(),x=Math.max(b.minX,Math.min(this.x,b.maxX)),y=Math.max(b.minY,Math.min(this.y,b.maxY));
      this.x=x;this.y=y;
      this.root.style.transform='translate3d('+Math.round(x)+'px,'+Math.round(y)+'px,0)';
      this.root.classList.toggle('face-left',this.face<0);
    }
    tick(time){
      if(document.hidden){requestAnimationFrame(t=>this.tick(t));return;}
      const dt=this.last?Math.min((time-this.last)/1000,.05):.016;this.last=time;
      if(time>=this.nextBlink){this.blinkUntil=time+115;this.nextBlink=time+2600+Math.random()*4300;}
      if(time>=this.nextGlance&&this.state==='idle'){const glance=Math.random();this.gazeX=glance<.33?-1:glance<.66?1:0;this.gazeY=glance>.72?1:0;this.nextGlance=time+900+Math.random()*1700;}
      if(this.state!=='idle'&&this.state!=='greet'){this.gazeX=0;this.gazeY=0;}
      if(this.state!=='walk'&&time-this.lastObstacleCheck>900){
        this.lastObstacleCheck=time;this.setInteractable();
      }
      if(this.state==='walk'&&this.target){
        const dx=this.target.x-this.x,dy=this.target.y-this.y,dist=Math.hypot(dx,dy);
        if(dist<4)this.arrive();
        else{
          const step=Math.min(dist,62*dt);
          this.x+=dx/dist*step;this.y+=dy/dist*step;
          this.walkFrame=(this.walkFrame+1)%4;
          this.root.classList.toggle('face-left',this.face<0);
          this.canvas.style.transform=this.face<0?'scaleX(-1)':'none';
          this.canvas.style.pointerEvents='none';
          this.applyPosition();
        }
      }else if(time>=this.stateUntil){
        if(this.state==='make-bed')this.sleep(time);
        else if(this.state==='sleep')this.wake(time);
        else if(this.state==='eat'){
          this.state='idle';this.root.classList.remove('is-eating');
          this.say('Mmm. That hit the spot.',5600);
          this.stateUntil=time+1700;
        }else if(this.state==='perch'){
          this.root.classList.remove('is-perching');this.state='idle';this.moveToNext();
        }else if(this.state==='wake'){
          this.root.classList.remove('is-waking-up');this.moveToNext();
        }else if(this.state==='recommend'||this.state==='greet'||this.state==='idle')this.moveToNext();
      }
      this.hideSpeech();
      if(this.state!=='walk')this.canvas.style.pointerEvents='auto';
      this.paint(time,false);
      requestAnimationFrame(t=>this.tick(t));
    }
    paint(time,force){
      if(!force&&this.state!=='walk'&&time-this.lastPaint<150)return;
      this.lastPaint=time;
      const walking=this.state==='walk',sleeping=this.state==='sleep';
      const makingBed=this.state==='make-bed',eating=this.state==='eat',sitting=this.state==='perch';
      const frame=Math.floor(time/130);
      const blink=sleeping||time<this.blinkUntil;
      const expression=sleeping?'sleepy':eating?'eating':this.state==='greet'?'happy':this.state==='wake'?'surprised':this.activity==='curious'?'surprised':this.activity==='annoyed'?'annoyed':'normal';
      const bob=sleeping?(Math.floor(time/700)%2):walking?frame%2:(Math.floor(time/520)%2);
      const sway=walking?0:Math.round(Math.sin(time/760)*0.5);
      drawSprite(this.ctx,{
        expression,blink,walking,sleeping,sitting,
        action:makingBed?'making-bed':eating?'eating':'',
        step:frame%6,wave:Math.floor(time/210)%6,chewFrame:Math.floor(time/240)%2,
        bob:bob+sway,gazeX:this.gazeX,gazeY:this.gazeY
      });
    }
  }

    function boot(){
    const canvas=document.getElementById('hekomiChanCanvas');
    if(!canvas||canvas.dataset.hekomiReady)return;
    canvas.dataset.hekomiReady='true';
    const visual=canvas.closest('.home-visual');
    const bubble=visual&&visual.querySelector('.home-mascot-bubble');
    const root=document.createElement('div');
    root.id='hekomiCompanion';root.className='hekomi-companion';
    root.setAttribute('aria-label','Hekomi-chan, your wandering pixel companion');
    if(bubble){
      const recommendation=document.createElement('a');
      recommendation.className='hekomi-recommend-link';recommendation.hidden=true;
      recommendation.setAttribute('aria-label','Open Hekomi-chan’s airing recommendation');
      bubble.appendChild(recommendation);
      root.appendChild(bubble);bubble.classList.remove('is-visible');
    }
    const bed=document.createElement('div');
    bed.className='hekomi-bed';bed.setAttribute('aria-hidden','true');
    bed.innerHTML='<span class="hekomi-bed-frame"></span><span class="hekomi-bed-mattress"></span><span class="hekomi-bed-pillow"></span><span class="hekomi-bed-blanket"></span>';
    const snack=document.createElement('span');snack.className='hekomi-snack';snack.setAttribute('aria-hidden','true');
    const zzz=document.createElement('span');zzz.className='hekomi-zzz';zzz.textContent='Z z z';zzz.setAttribute('aria-hidden','true');
    root.appendChild(bed);root.appendChild(snack);root.appendChild(zzz);root.appendChild(canvas);document.body.appendChild(root);
    if(visual)visual.remove();
    const companion=new HekomiWanderer(canvas,document.getElementById('hekomiChanMessage'),root,bubble);
    window.hekomiChan=companion;window.HekomiChan=HekomiWanderer;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
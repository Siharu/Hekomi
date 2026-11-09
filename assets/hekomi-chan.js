/* Hekomi-chan — high-resolution 2D anime canvas with a shared head-and-hair rig. */
(() => {
  'use strict';
  const WARDROBE_PRESETS=Object.freeze({
    school:{name:'School dress',detail:'Sailor collar · side ponytail',hair:'school-ponytail',makeup:'fresh',emoji:'🎒',line:'Uniform on! I even remembered my ribbon today.'},
    formal:{name:'Formal dress',detail:'Tailored jacket · neat updo',hair:'formal-bun',makeup:'elegant',emoji:'✦',line:'A little polished, a little elegant. How do I look?'},
    lazy:{name:'Lazy dress',detail:'Oversized hoodie · messy bun',hair:'messy-bun',makeup:'soft',emoji:'☁',line:'Comfy clothes, messy hair… this is my natural habitat.'},
    swimsuit:{name:'Swimsuit dress',detail:'Sporty one-piece · twin buns',hair:'twin-buns',makeup:'sun-kissed',emoji:'🌊',line:'Beach day! I packed sunscreen. You did too, right?'},
    date:{name:'Going on a date',detail:'Rose dress · half-up waves',hair:'date-half-up',makeup:'rosy',emoji:'♡',line:'Wait, is this outfit too much? No? Okay… let’s go.'}
  });
  const CANVAS_W=256,CANVAS_H=320;
  const ANIME_LOOKS={
    school:{top:'#344c70',topLight:'#6f8eae',bottom:'#263956',accent:'#c66f91',trim:'#f5f0eb',shoe:'#263047'},
    formal:{top:'#41344f',topLight:'#786181',bottom:'#44344e',accent:'#d6b8dc',trim:'#f3e8ef',shoe:'#332c42'},
    lazy:{top:'#37685f',topLight:'#79aa9a',bottom:'#30394a',accent:'#a9e5d6',trim:'#dcefe8',shoe:'#292d3e'},
    swimsuit:{top:'#287987',topLight:'#72c2ba',bottom:'#246476',accent:'#f2b7c4',trim:'#e3f7ed',shoe:'#e9e4ef'},
    date:{top:'#8b4f6d',topLight:'#d78ca5',bottom:'#9f5577',accent:'#f5c1d1',trim:'#fff0f0',shoe:'#713e5c'}
  };
  function animeLinear(ctx,x1,y1,x2,y2,stops){
    const g=ctx.createLinearGradient(x1,y1,x2,y2);
    for(const [at,color] of stops)g.addColorStop(at,color);
    return g;
  }
  function animeShape(ctx,draw,fill,stroke,lineWidth=2){
    ctx.beginPath();draw();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
  }
  function animeStroke(ctx,draw,color,width=1.5){
    ctx.beginPath();draw();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
  }
  function withAnimeHead(ctx,angle,draw){
    ctx.save();ctx.translate(128,106);ctx.rotate(angle);ctx.translate(-128,-106);draw();ctx.restore();
  }
  function animeHairPaint(ctx){
    return animeLinear(ctx,60,30,194,222,[[0,'#171323'],[.26,'#30233f'],[.55,'#49345e'],[.78,'#2c213d'],[1,'#171323']]);
  }
  function drawAnimeBackHair(ctx,style,swing,direction){
    const hair=animeHairPaint(ctx);
    animeShape(ctx,()=>{
      if(direction==='north'){
        ctx.moveTo(76,101);ctx.bezierCurveTo(62,53,88,25,128,25);
        ctx.bezierCurveTo(170,24,195,57,181,108);
        ctx.bezierCurveTo(198,144,198,192,178,222);
        ctx.bezierCurveTo(164,244,151,220,151,196);
        ctx.bezierCurveTo(139,222,119,232,111,206);
        ctx.bezierCurveTo(97,230,82,222,77,198);
        ctx.bezierCurveTo(61,165,60,132,76,101);
      }else{
        ctx.moveTo(75,100);ctx.bezierCurveTo(61,53,87,24,128,24);
        ctx.bezierCurveTo(171,24,195,57,181,107);
        ctx.bezierCurveTo(198,141,196,189,178,221);
        ctx.bezierCurveTo(165,241,153,218,151,193);
        ctx.bezierCurveTo(141,217,120,230,111,205);
        ctx.bezierCurveTo(99,229,82,220,77,196);
        ctx.bezierCurveTo(60,164,59,132,75,100);
      }
    },hair,'#171323',3);
    animeShape(ctx,()=>{
      ctx.moveTo(78,91);ctx.bezierCurveTo(75,55,96,34,128,32);
      ctx.bezierCurveTo(160,33,181,57,177,94);
      ctx.bezierCurveTo(163,117,94,118,78,91);
    },animeLinear(ctx,88,38,162,113,[[0,'#58436c'],[.45,'#30243f'],[1,'#241b34']]));
    const locks=[
      [84,83,70,127,86,187,77,205],
      [97,76,88,130,103,183,98,211],
      [117,83,106,130,127,177,119,213],
      [140,78,151,126,135,176,149,212],
      [159,81,178,126,156,178,171,207],
      [176,93,193,130,181,173,181,194]
    ];
    for(let i=0;i<locks.length;i++){
      const a=locks[i],tip=swing*(i%2?1:-1);
      animeStroke(ctx,()=>{
        ctx.moveTo(a[0],a[1]);ctx.bezierCurveTo(a[2],a[3],a[4]+tip,a[5],a[6]+tip*.7,a[7]);
      },i%2?'#765a91':'#5c456f',i===2||i===3?2.2:1.55);
    }
    animeStroke(ctx,()=>{ctx.moveTo(89,61);ctx.bezierCurveTo(104,38,136,34,157,52);},'#9076a7',2.2);
    animeStroke(ctx,()=>{ctx.moveTo(101,71);ctx.bezierCurveTo(116,54,139,52,153,63);},'#6b527f',1.4);

    if(style==='formal-bun'||style==='messy-bun'||style==='date-half-up'){
      const bunX=style==='date-half-up'?140:128,bunY=style==='messy-bun'?18:24;
      animeShape(ctx,()=>{ctx.ellipse(bunX,bunY,style==='messy-bun'?25:22,style==='messy-bun'?17:16,-.2,0,Math.PI*2);},animeLinear(ctx,bunX-15,bunY-16,bunX+15,bunY+15,[[0,'#725985'],[.5,'#30223f'],[1,'#171323']]),'#171323',2.4);
      animeStroke(ctx,()=>{ctx.moveTo(bunX-12,bunY-3);ctx.quadraticCurveTo(bunX,bunY-15,bunX+12,bunY-7);},'#9a7cab',2);
    }else if(style==='twin-buns'){
      for(const x of [84,172]){
        animeShape(ctx,()=>{ctx.ellipse(x,36,18,15,.1,0,Math.PI*2);},animeLinear(ctx,x-12,22,x+12,50,[[0,'#745a8c'],[.5,'#30233f'],[1,'#171323']]),'#171323',2.3);
        animeStroke(ctx,()=>{ctx.moveTo(x-9,34);ctx.quadraticCurveTo(x,23,x+9,31);},'#967ca8',1.8);
      }
    }
    if(style==='school-ponytail'){
      animeShape(ctx,()=>{
        ctx.moveTo(166,55);ctx.bezierCurveTo(199,58,214,89,205,126);
        ctx.bezierCurveTo(219,157,206,190,185,201);
        ctx.bezierCurveTo(193,161,176,131,181,105);
        ctx.bezierCurveTo(177,84,163,76,166,55);
      },animeLinear(ctx,174,58,203,197,[[0,'#59426e'],[.48,'#2e213e'],[1,'#171323']]),'#171323',2);
      animeStroke(ctx,()=>{ctx.moveTo(185,81);ctx.bezierCurveTo(203,116,197,154,189,181);},'#816692',2);
    }
  }
  function drawAnimeLeg(ctx,side,phase,look,walking,sitting){
    ctx.save();ctx.translate(side<0?105:151,228);
    const swing=walking?Math.sin(phase*Math.PI*2+(side<0?0:Math.PI))*.22:0;
    ctx.rotate(sitting?(side<0?-.46:.5):swing);
    const skin=look==='swimsuit'||look==='date'||look==='school';
    const legFill=skin
      ?animeLinear(ctx,-10,0,12,73,[[0,'#f4c6b8'],[.55,'#e7a99f'],[1,'#bf7e80']])
      :animeLinear(ctx,-10,0,12,73,[[0,'#3e4055'],[.55,'#25293b'],[1,'#171b2b']]);
    animeShape(ctx,()=>{
      ctx.moveTo(-11,0);ctx.bezierCurveTo(-17,18,-12,37,-9,55);
      ctx.lineTo(-7,69);ctx.quadraticCurveTo(0,74,9,69);
      ctx.lineTo(12,54);ctx.bezierCurveTo(12,35,17,16,10,0);ctx.closePath();
    },legFill,'#272135',2);
    if(look==='school'||look==='formal'){
      animeShape(ctx,()=>{
        ctx.moveTo(-10,17);ctx.bezierCurveTo(-8,28,-7,43,-5,58);
        ctx.lineTo(7,58);ctx.bezierCurveTo(8,41,11,26,10,17);
      },animeLinear(ctx,-7,20,8,60,[[0,'#f5e9ed'],[1,'#c8c0d2']]));
      animeShape(ctx,()=>{ctx.rect(-8,57,17,11);},animeLinear(ctx,-8,58,8,70,[[0,'#e9dfe9'],[1,'#a69eb9']]));
    }else if(look==='date'){
      animeStroke(ctx,()=>{ctx.moveTo(-6,25);ctx.bezierCurveTo(-2,36,3,45,6,57);},'#f6d6df',1.3);
    }
    animeShape(ctx,()=>{
      ctx.moveTo(-8,63);ctx.quadraticCurveTo(-12,70,-12,76);
      ctx.quadraticCurveTo(-4,82,13,77);ctx.quadraticCurveTo(15,70,8,64);
      ctx.lineTo(4,62);ctx.closePath();
    },animeLinear(ctx,-8,64,12,80,[[0,'#f7d2c4'],[.45,'#f0b6ac'],[1,'#d18f91']]),'#211b2d',1.7);
    animeShape(ctx,()=>{
      ctx.moveTo(-13,75);ctx.quadraticCurveTo(-6,69,5,73);
      ctx.quadraticCurveTo(15,75,17,82);
      ctx.quadraticCurveTo(4,88,-15,83);ctx.closePath();
    },animeLinear(ctx,-10,73,12,86,[[0,look==='swimsuit'?'#f9f4f1':'#665b78'],[.55,look==='swimsuit'?'#c9d8df':'#373348'],[1,'#1c1a2a']]),'#171323',2);
    animeShape(ctx,()=>{ctx.moveTo(-8,76);ctx.quadraticCurveTo(0,73,9,77);},null,'#d5c7dc',1.3);
    ctx.restore();
  }
  function drawAnimeLegs(ctx,frame,look){
    const sitting=!!frame.sitting,walking=!!frame.walking,phase=frame.phase||0;
    drawAnimeLeg(ctx,-1,phase,look,walking,sitting);
    drawAnimeLeg(ctx,1,phase,look,walking,sitting);
  }
  function drawAnimeTorso(ctx,look,direction){
    const p=ANIME_LOOKS[look]||ANIME_LOOKS.lazy;
    const rear=direction==='north';
    const top=animeLinear(ctx,78,151,178,245,[[0,p.topLight],[.35,p.top],[1,p.top]]);
    animeShape(ctx,()=>{
      ctx.moveTo(105,143);ctx.lineTo(151,143);ctx.lineTo(157,169);
      ctx.lineTo(177,181);ctx.lineTo(185,239);ctx.quadraticCurveTo(128,255,71,239);
      ctx.lineTo(79,181);ctx.lineTo(99,169);ctx.closePath();
    },rear?animeLinear(ctx,72,151,183,246,[[0,p.top],[1,p.bottom]]):top,'#282035',3);
    animeShape(ctx,()=>{
      ctx.moveTo(105,145);ctx.quadraticCurveTo(128,158,151,145);
      ctx.lineTo(151,166);ctx.quadraticCurveTo(128,184,105,166);ctx.closePath();
    },animeLinear(ctx,104,145,151,176,[[0,'#f9d4c7'],[1,'#d89691']]));
    if(look==='lazy'){
      animeShape(ctx,()=>{
        ctx.moveTo(96,163);ctx.quadraticCurveTo(128,188,160,163);
        ctx.lineTo(176,237);ctx.quadraticCurveTo(128,249,80,237);ctx.closePath();
      },animeLinear(ctx,86,163,171,243,[[0,'#80b5a3'],[.4,'#477e72'],[1,'#2e5c56']]),'#294942',2);
      animeShape(ctx,()=>{
        ctx.moveTo(112,172);ctx.quadraticCurveTo(128,188,144,172);
        ctx.quadraticCurveTo(137,202,128,203);ctx.quadraticCurveTo(119,200,112,172);
      },'#315f58','#a0cbbb',1.5);
      animeStroke(ctx,()=>{ctx.moveTo(119,193);ctx.lineTo(118,207);ctx.moveTo(137,193);ctx.lineTo(138,207);},'#d0e9df',2);
      animeShape(ctx,()=>{ctx.roundRect(101,209,54,22,8);},'#386c63','#80aa9d',1.7);
      animeShape(ctx,()=>{ctx.moveTo(125,213);ctx.lineTo(128,213);ctx.lineTo(129,220);ctx.lineTo(125,220);ctx.closePath();},p.accent);
    }else if(look==='school'){
      animeShape(ctx,()=>{ctx.moveTo(98,163);ctx.lineTo(128,184);ctx.lineTo(158,163);ctx.lineTo(151,177);ctx.lineTo(128,197);ctx.lineTo(105,177);ctx.closePath();},'#f2f2ed','#c7d2d8',1.8);
      animeShape(ctx,()=>{ctx.moveTo(119,181);ctx.quadraticCurveTo(128,187,137,181);ctx.lineTo(132,211);ctx.lineTo(124,211);ctx.closePath();},'#c66e90','#8d4967',1.4);
      animeShape(ctx,()=>{ctx.moveTo(93,169);ctx.lineTo(111,181);ctx.lineTo(128,197);ctx.lineTo(117,208);ctx.lineTo(89,181);ctx.closePath();},'#f4f3ee','#bacbd5',1.5);
      animeShape(ctx,()=>{ctx.moveTo(163,169);ctx.lineTo(145,181);ctx.lineTo(128,197);ctx.lineTo(139,208);ctx.lineTo(167,181);ctx.closePath();},'#f4f3ee','#bacbd5',1.5);
      animeStroke(ctx,()=>{ctx.moveTo(91,184);ctx.lineTo(112,204);ctx.moveTo(165,184);ctx.lineTo(144,204);},'#b7c9d7',1.6);
    }else if(look==='formal'){
      animeShape(ctx,()=>{ctx.moveTo(100,163);ctx.lineTo(128,184);ctx.lineTo(118,230);ctx.lineTo(92,211);ctx.closePath();},'#f0e5ed','#b7a5bd',1.5);
      animeShape(ctx,()=>{ctx.moveTo(156,163);ctx.lineTo(128,184);ctx.lineTo(139,230);ctx.lineTo(165,211);ctx.closePath();},'#f0e5ed','#b7a5bd',1.5);
      animeShape(ctx,()=>{ctx.moveTo(128,184);ctx.lineTo(116,196);ctx.lineTo(128,211);ctx.lineTo(140,196);ctx.closePath();},'#624a68','#a68cae',1.5);
      animeShape(ctx,()=>{ctx.roundRect(94,224,68,7,3);},'#d4b7cc');
      animeShape(ctx,()=>{ctx.roundRect(120,222,16,12,4);},'#e7d7e4','#a98eae',1.4);
      animeShape(ctx,()=>{ctx.arc(128,228,2,0,Math.PI*2);},'#f3d6a2');
    }else if(look==='swimsuit'){
      animeShape(ctx,()=>{ctx.moveTo(103,159);ctx.quadraticCurveTo(128,174,153,159);ctx.lineTo(164,235);ctx.quadraticCurveTo(128,244,92,235);ctx.closePath();},animeLinear(ctx,95,160,164,236,[[0,'#70c3bd'],[.5,'#277d89'],[1,'#185767']]),'#183f57',2);
      animeShape(ctx,()=>{ctx.moveTo(108,159);ctx.lineTo(118,177);ctx.lineTo(128,185);ctx.lineTo(138,177);ctx.lineTo(148,159);},null,'#d9f0e9',3);
      animeShape(ctx,()=>{ctx.moveTo(118,200);ctx.quadraticCurveTo(128,207,138,200);ctx.lineTo(135,236);ctx.lineTo(121,236);ctx.closePath();},'#4e9da4');
      animeStroke(ctx,()=>{ctx.moveTo(106,213);ctx.quadraticCurveTo(128,221,150,213);},'#91d9cf',2);
    }else if(look==='date'){
      animeShape(ctx,()=>{ctx.moveTo(100,162);ctx.quadraticCurveTo(128,181,156,162);ctx.lineTo(168,236);ctx.quadraticCurveTo(128,249,88,236);ctx.closePath();},animeLinear(ctx,88,164,168,242,[[0,'#e69ab5'],[.48,'#ac5e83'],[1,'#7a405f']]),'#71384f',2);
      animeShape(ctx,()=>{ctx.moveTo(111,164);ctx.lineTo(128,177);ctx.lineTo(145,164);ctx.quadraticCurveTo(138,197,128,199);ctx.quadraticCurveTo(118,197,111,164);},'#ffe6e9','#d990ac',1.6);
      animeShape(ctx,()=>{ctx.moveTo(128,184);ctx.bezierCurveTo(118,177,111,190,128,201);ctx.bezierCurveTo(145,190,138,177,128,184);},'#f4bfd0','#a95879',1.5);
      animeShape(ctx,()=>{ctx.ellipse(128,220,5,3,0,0,Math.PI*2);},'#f8d4df');
    }
    if(rear){
      animeStroke(ctx,()=>{ctx.moveTo(92,184);ctx.quadraticCurveTo(128,203,164,184);},p.topLight,1.5);
    }
  }
  function drawAnimeArm(ctx,side,angle,look,action,frame){
    const p=ANIME_LOOKS[look]||ANIME_LOOKS.lazy;
    ctx.save();ctx.translate(side<0?84:172,174);ctx.scale(side,1);ctx.rotate(angle);
    const sleeve=animeLinear(ctx,0,0,34,33,[[0,p.topLight],[.45,p.top],[1,p.bottom]]);
    animeShape(ctx,()=>{
      ctx.moveTo(-5,-7);ctx.quadraticCurveTo(12,-15,22,1);
      ctx.lineTo(35,26);ctx.quadraticCurveTo(27,38,18,34);
      ctx.lineTo(6,19);ctx.quadraticCurveTo(-8,8,-5,-7);ctx.closePath();
    },sleeve,'#2a2037',2.4);
    animeStroke(ctx,()=>{ctx.moveTo(21,27);ctx.quadraticCurveTo(28,31,34,26);},p.accent,1.5);
    animeShape(ctx,()=>{
      ctx.moveTo(27,28);ctx.quadraticCurveTo(39,37,38,54);
      ctx.quadraticCurveTo(36,61,29,59);ctx.quadraticCurveTo(25,49,25,39);ctx.closePath();
    },animeLinear(ctx,26,28,39,60,[[0,'#f9d7c8'],[.5,'#e9ad9f'],[1,'#ce8989']]),'#a96870',1.5);
    const handY=action==='greeting'?-2:action==='eating'?51:action==='sleeping'?51:56;
    animeShape(ctx,()=>{
      ctx.moveTo(27,handY);ctx.quadraticCurveTo(22,handY+3,24,handY+11);
      ctx.quadraticCurveTo(28,handY+17,37,handY+13);
      ctx.quadraticCurveTo(44,handY+9,39,handY+2);
      ctx.quadraticCurveTo(34,handY-3,27,handY);ctx.closePath();
    },animeLinear(ctx,25,handY,42,handY+15,[[0,'#ffe0d1'],[1,'#d8918f']]),'#a96870',1.3);
    if(action==='greeting'){
      for(let i=0;i<4;i++)animeStroke(ctx,()=>{ctx.moveTo(26+i*3,handY+2);ctx.quadraticCurveTo(21+i*3,handY-10,24+i*3,handY-17);},'#e9b1a7',2);
    }
    if(action==='eating'){
      animeShape(ctx,()=>{ctx.ellipse(34,handY+5,4,5,0,0,Math.PI*2);},'#fff0dc','#d8c2b6',1);
    }
    ctx.restore();
  }
  function drawAnimeEyes(ctx,frame,sideView){
    const expression=frame.expression||'normal',blink=!!frame.blink||expression==='sleepy';
    const gazeX=frame.gazeX||0,gazeY=frame.gazeY||0;
    function eye(x,y,scale){
      ctx.save();ctx.translate(x,y);ctx.scale(scale,1);
      if(blink){
        animeStroke(ctx,()=>{ctx.moveTo(-15,2);ctx.quadraticCurveTo(0,8,15,1);},'#38263e',3.7);
        animeStroke(ctx,()=>{ctx.moveTo(-10,5);ctx.quadraticCurveTo(0,9,10,4);},'#b56f80',1.5);
      }else if(expression==='happy'){
        animeStroke(ctx,()=>{ctx.moveTo(-15,4);ctx.quadraticCurveTo(-2,-8,14,3);},'#33223b',4);
        animeStroke(ctx,()=>{ctx.moveTo(-10,5);ctx.quadraticCurveTo(0,-2,9,4);},'#a56c9e',1.6);
      }else{
        const h=expression==='surprised'?27:expression==='sleepy'?13:22;
        animeShape(ctx,()=>{ctx.moveTo(-16,0);ctx.quadraticCurveTo(-13,-h,0,-h*.83);ctx.quadraticCurveTo(14,-h,16,0);ctx.quadraticCurveTo(0,9,-16,0);},'#fff8f4','#33243e',2.5);
        const iris=animeLinear(ctx,-8,-h*.5,9,8,[[0,'#c3a4eb'],[.4,'#7856ac'],[1,'#38264f']]);
        animeShape(ctx,()=>{ctx.ellipse(gazeX*2,-h*.12+gazeY*2,9,Math.max(8,h*.55),0,0,Math.PI*2);},iris,'#352442',1.2);
        animeShape(ctx,()=>{ctx.ellipse(gazeX*2+1,-h*.08+gazeY*2,4,Math.max(6,h*.43),0,0,Math.PI*2);},'#251a36');
        animeShape(ctx,()=>{ctx.ellipse(-3,-h*.42,3.8,4.5,0,0,Math.PI*2);},'#fff9f0');
        animeShape(ctx,()=>{ctx.ellipse(5,1,1.8,2,0,0,Math.PI*2);},'#e4d5f8');
        animeStroke(ctx,()=>{ctx.moveTo(-16,0);ctx.quadraticCurveTo(-7,-h-5,3,-h+1);ctx.quadraticCurveTo(12,-h-2,16,0);},'#21182d',3.2);
        animeStroke(ctx,()=>{ctx.moveTo(-13,-h+1);ctx.lineTo(-17,-h+6);ctx.moveTo(12,-h+1);ctx.lineTo(17,-h+6);},'#21182d',1.8);
      }
      ctx.restore();
    }
    if(sideView){
      eye(151,108,.72);
      animeStroke(ctx,()=>{ctx.moveTo(126,84);ctx.quadraticCurveTo(145,73,163,83);},'#5b3c54',2.3);
    }else{
      eye(101,108,1);eye(155,108,1);
      animeStroke(ctx,()=>{ctx.moveTo(83,88);ctx.quadraticCurveTo(100,80,116,88);},'#5a3e55',2.8);
      animeStroke(ctx,()=>{ctx.moveTo(140,88);ctx.quadraticCurveTo(157,80,174,88);},'#5a3e55',2.8);
    }
  }
  function drawAnimeFace(ctx,frame,direction){
    const side=direction==='east'||direction==='west';
    if(direction==='north'){
      animeShape(ctx,()=>{
        ctx.moveTo(79,95);ctx.quadraticCurveTo(75,42,128,37);
        ctx.quadraticCurveTo(183,42,177,96);ctx.quadraticCurveTo(165,139,128,158);
        ctx.quadraticCurveTo(90,139,79,95);
      },animeHairPaint(ctx),'#171323',2);
      animeStroke(ctx,()=>{ctx.moveTo(94,72);ctx.quadraticCurveTo(128,54,162,72);},'#806494',2);
      return;
    }
    if(side){
      animeShape(ctx,()=>{
        ctx.moveTo(102,62);ctx.quadraticCurveTo(149,44,170,83);
        ctx.quadraticCurveTo(184,105,176,124);
        ctx.lineTo(190,132);ctx.quadraticCurveTo(180,139,169,139);
        ctx.quadraticCurveTo(161,162,137,164);
        ctx.quadraticCurveTo(108,157,101,128);ctx.closePath();
      },animeLinear(ctx,111,52,176,162,[[0,'#ffe1d1'],[.45,'#f2c0b2'],[1,'#d99391']]),'#35243a',2.6);
      animeShape(ctx,()=>{ctx.ellipse(169,108,8,13,.12,0,Math.PI*2);},'#efb6aa','#ca8886',1.2);
      drawAnimeEyes(ctx,frame,true);
      animeStroke(ctx,()=>{ctx.moveTo(181,129);ctx.quadraticCurveTo(186,127,190,130);},'#ad6e76',1.4);
      animeStroke(ctx,()=>{ctx.moveTo(169,143);ctx.quadraticCurveTo(176,147,182,142);},'#a35d71',1.7);
      animeShape(ctx,()=>{ctx.ellipse(153,138,9,4,.1,0,Math.PI*2);},'rgba(221,119,139,.27)');
    }else{
      animeShape(ctx,()=>{
        ctx.moveTo(78,92);ctx.bezierCurveTo(74,65,94,48,128,47);
        ctx.bezierCurveTo(162,47,182,66,178,101);
        ctx.lineTo(173,127);ctx.quadraticCurveTo(160,157,128,165);
        ctx.quadraticCurveTo(95,157,82,127);ctx.closePath();
      },animeLinear(ctx,82,54,172,165,[[0,'#ffe8d9'],[.42,'#f5cabc'],[.78,'#edb3a9'],[1,'#d88e90']]),'#35233a',2.5);
      animeShape(ctx,()=>{ctx.ellipse(76,112,8,13,-.1,0,Math.PI*2);},'#efb5a9','#c98785',1.4);
      animeShape(ctx,()=>{ctx.ellipse(180,112,8,13,.1,0,Math.PI*2);},'#efb5a9','#c98785',1.4);
      animeShape(ctx,()=>{ctx.ellipse(90,134,13,6,0,0,Math.PI*2);},'rgba(221,119,139,.28)');
      animeShape(ctx,()=>{ctx.ellipse(166,134,13,6,0,0,Math.PI*2);},'rgba(221,119,139,.28)');
      animeStroke(ctx,()=>{ctx.moveTo(128,114);ctx.quadraticCurveTo(124,126,129,128);},'#ce8b88',1.5);
      drawAnimeEyes(ctx,frame,false);
      if(frame.expression==='surprised'){
        animeShape(ctx,()=>{ctx.ellipse(128,145,7,9,0,0,Math.PI*2);},'#8e465f');
      }else if(frame.expression==='happy'){
        animeStroke(ctx,()=>{ctx.moveTo(116,143);ctx.quadraticCurveTo(128,155,140,143);},'#9d526d',2.8);
      }else if(frame.expression==='sleepy'){
        animeStroke(ctx,()=>{ctx.moveTo(119,145);ctx.quadraticCurveTo(128,148,137,145);},'#9d5868',2);
      }else{
        animeStroke(ctx,()=>{ctx.moveTo(119,144);ctx.quadraticCurveTo(128,148,137,144);},'#a65d70',2);
        animeShape(ctx,()=>{ctx.ellipse(128,144,3,1.8,0,0,Math.PI*2);},'#fff1ec');
      }
    }
    if(frame.makeup!=='soft'){
      animeStroke(ctx,()=>{ctx.moveTo(88,137);ctx.quadraticCurveTo(97,143,106,139);ctx.moveTo(150,139);ctx.quadraticCurveTo(160,143,169,137);},frame.makeup==='sun-kissed'?'#e6a17f':'#d18b9e',1.3);
    }
  }
  function drawAnimeFrontHair(ctx,style,swing,direction){
    const g=animeHairPaint(ctx);
    if(direction==='north'){
      animeShape(ctx,()=>{ctx.moveTo(76,98);ctx.bezierCurveTo(68,58,88,27,128,25);ctx.bezierCurveTo(170,24,190,60,180,98);ctx.bezierCurveTo(152,82,105,82,76,98);},g,'#171323',2.8);
      return;
    }
    if(direction==='east'||direction==='west'){
      animeShape(ctx,()=>{
        ctx.moveTo(77,97);ctx.bezierCurveTo(72,47,103,26,143,31);
        ctx.bezierCurveTo(179,38,190,68,178,105);
        ctx.bezierCurveTo(160,86,145,76,129,79);
        ctx.bezierCurveTo(116,82,107,105,91,119);
        ctx.bezierCurveTo(91,102,84,96,77,97);ctx.closePath();
      },g,'#171323',2.8);
      animeShape(ctx,()=>{ctx.moveTo(94,53);ctx.bezierCurveTo(125,23,170,42,176,78);ctx.bezierCurveTo(145,59,126,66,108,82);ctx.closePath();},'#3d2b50');
      animeStroke(ctx,()=>{ctx.moveTo(104,55);ctx.quadraticCurveTo(143,35,165,63);},'#8e73a3',2);
      animeStroke(ctx,()=>{ctx.moveTo(92,92);ctx.quadraticCurveTo(109,113,97,147);},'#6e537f',2.2);
    }else{
      animeShape(ctx,()=>{
        ctx.moveTo(76,101);ctx.bezierCurveTo(68,51,89,24,128,23);
        ctx.bezierCurveTo(169,23,190,53,181,101);
        ctx.bezierCurveTo(169,88,161,85,153,94);
        ctx.bezierCurveTo(145,109,141,117,136,120);
        ctx.bezierCurveTo(135,103,132,91,128,90);
        ctx.bezierCurveTo(119,110,109,121,103,123);
        ctx.bezierCurveTo(105,105,101,96,95,95);
        ctx.bezierCurveTo(88,99,83,108,78,118);ctx.closePath();
      },g,'#171323',2.8);
      animeShape(ctx,()=>{ctx.moveTo(84,72);ctx.bezierCurveTo(105,31,153,31,174,69);ctx.bezierCurveTo(149,57,117,56,84,86);ctx.closePath();},'#3b2a4f');
      animeStroke(ctx,()=>{ctx.moveTo(88,66);ctx.bezierCurveTo(113,37,146,39,164,56);},'#8b719f',2.5);
      animeStroke(ctx,()=>{ctx.moveTo(108,83);ctx.quadraticCurveTo(125,66,133,91);ctx.quadraticCurveTo(134,106,126+swing*.2,119);},'#6c527e',2);
      animeStroke(ctx,()=>{ctx.moveTo(151,78);ctx.quadraticCurveTo(165,91,151,120);},'#7b628e',2);
    }
    if(style==='school-ponytail'){
      animeShape(ctx,()=>{ctx.ellipse(164,41,16,11,.35,0,Math.PI*2);},'#382847','#171323',2);
      animeShape(ctx,()=>{ctx.moveTo(154,43);ctx.quadraticCurveTo(167,35,177,44);ctx.lineTo(174,58);ctx.quadraticCurveTo(162,54,154,43);},'#c66f91');
    }else if(style==='formal-bun'){
      animeShape(ctx,()=>{ctx.arc(140,29,8,0,Math.PI*2);},'#d4b5d6','#9d83a7',1.4);
    }else if(style==='twin-buns'){
      animeShape(ctx,()=>{ctx.arc(84,36,8,0,Math.PI*2);ctx.arc(172,36,8,0,Math.PI*2);},'#74bfb5');
    }else if(style==='date-half-up'){
      animeShape(ctx,()=>{ctx.ellipse(146,44,9,5,-.35,0,Math.PI*2);},'#d98da8','#fff0f2',1.2);
      animeShape(ctx,()=>{ctx.arc(151,43,2,0,Math.PI*2);},'#f7d5df');
    }else if(style==='messy-bun'){
      animeStroke(ctx,()=>{ctx.moveTo(102,30);ctx.quadraticCurveTo(90,19,103,11);ctx.moveTo(151,30);ctx.quadraticCurveTo(164,18,153,10);},'#564066',3);
    }
    animeStroke(ctx,()=>{ctx.moveTo(78,108);ctx.bezierCurveTo(71,137,76+swing*.25,165,84+swing*.35,179);},'#725a87',2.1);
    animeStroke(ctx,()=>{ctx.moveTo(179,103);ctx.bezierCurveTo(188,135,180-swing*.3,165,173-swing*.4,180);},'#6c527e',2.1);
  }
  function drawAnimeSprite(ctx,frame){
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    const direction=frame.direction||'south';
    const look=frame.outfit||'lazy';
    const style=frame.hair||'long';
    const time=(frame.time||0)/1000;
    const phase=frame.phase||0;
    const walking=!!frame.walking;
    const swing=walking?Math.sin(phase*Math.PI*2):Math.sin(time*1.45)*.16;
    const hairSwing=walking?Math.sin(phase*Math.PI*2-.75)*10:Math.sin(time*1.3)*3.6;
    const headAngle=(walking?Math.sin(phase*Math.PI*2)*.045:Math.sin(time*1.2)*.018)+(frame.greeting?.035:0);
    const bodyBob=(frame.bob||0)*2.3;
    const action=frame.sleeping?'sleeping':frame.greeting?'greeting':frame.action||'';
    ctx.save();ctx.translate(0,bodyBob);
    // Back hair belongs to the head rig, not to the stage. It follows every head turn.
    withAnimeHead(ctx,headAngle,()=>drawAnimeBackHair(ctx,style,hairSwing,direction));
    drawAnimeLegs(ctx,frame,look);
    drawAnimeTorso(ctx,look,direction);
    const idleArm=Math.sin(time*1.7)*.045;
    let leftAngle=-.10+swing*.32+idleArm;
    let rightAngle=.10-swing*.32-idleArm;
    if(action==='greeting')rightAngle=-1.05+Math.sin(time*8)*.08;
    if(action==='making-bed')rightAngle=.9+Math.sin(time*5)*.08;
    if(action==='eating')rightAngle=-.62+Math.sin(time*8)*.025;
    if(action==='sleeping'){leftAngle=.65;rightAngle=-.62;}
    if(frame.sitting){leftAngle=.38;rightAngle=-.38;}
    drawAnimeArm(ctx,-1,leftAngle,look,action,frame);
    drawAnimeArm(ctx,1,rightAngle,look,action,frame);
    // Face, scalp, fringe and loose locks share one transform so the hair cannot lag behind her head.
    withAnimeHead(ctx,headAngle,()=>{
      drawAnimeFace(ctx,frame,direction);
      drawAnimeFrontHair(ctx,style,hairSwing,direction);
      if(direction!=='north'){
        animeStroke(ctx,()=>{ctx.moveTo(94,58);ctx.quadraticCurveTo(128,36,161,57);},'#a38ab2',1.35);
      }
    });
    if(action==='eating'&&direction!=='north'){
      animeShape(ctx,()=>{ctx.ellipse(170,148+bodyBob,6,8,-.25,0,Math.PI*2);},'#fff0db','#c7acaa',1.1);
      animeStroke(ctx,()=>{ctx.moveTo(166,144);ctx.lineTo(172,151);},'#d6c1b6',1);
    }
    ctx.restore();
  }
  class HekomiWanderer{
    constructor(canvas,message,root,bubble){
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});this.message=message;
      this.root=root;this.bubble=bubble;this.state='idle';this.target=null;this.face=1;
      this.direction='south';this.walkSpeed=0;this.walkPhase=0;this.route=[];
      this.x=12;this.y=12;this.last=0;this.lastSpeech=0;this.speechUntil=0;this.lastObstacleCheck=0;
      this.stateUntil=0;this.walkFrame=0;this.stops=0;this.sleepCount=0;this.hiddenPause=false;
      this.nextBlink=performance.now()+1800+Math.random()*2600;this.blinkUntil=0;this.gazeX=0;this.gazeY=0;this.nextGlance=performance.now()+2200+Math.random()*3800;this.activity='idle';
      this.scrollTimer=0;this.lastScrollSpeechAt=0;this.lastSpecialAt=0;
      this.airingPromise=null;this.airingPool=[];this.lastRecommendedId=0;this.recommendationToken=0;this.nextPose='';
      this.bed=root.querySelector('.hekomi-bed');this.snack=root.querySelector('.hekomi-snack');
      this.recommendLink=bubble&&bubble.querySelector('.hekomi-recommend-link');
      this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.canvas.width=CANVAS_W;this.canvas.height=CANVAS_H;this.ctx.imageSmoothingEnabled=true;
      this.mountWardrobe();
      this.setDirection('south');
      this.canvas.style.imageRendering='auto';this.canvas.setAttribute('role','button');
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
      if(!this.reduced){if(!startsPerched)this.stateUntil=now+3600;requestAnimationFrame(time=>this.tick(time));}
    }


    mountWardrobe(){
      let saved='lazy';
      try{const value=localStorage.getItem('hekomi_wardrobe_v1');if(value&&WARDROBE_PRESETS[value])saved=value;}catch{}
      this.outfit=saved;
      const toggle=document.createElement('button');toggle.type='button';toggle.className='hekomi-wardrobe-toggle';
      toggle.setAttribute('aria-label',"Open Hekomi-chan's wardrobe");toggle.setAttribute('aria-haspopup','dialog');toggle.setAttribute('aria-expanded','false');toggle.title="Choose Hekomi-chan's outfit";
      toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M12 7 3 13v1h18v-1L12 7Z"/><path d="M5 16h14v4H5z"/></svg>';
      toggle.addEventListener('click',event=>{event.stopPropagation();this.openWardrobe();});this.root.appendChild(toggle);this.wardrobeToggle=toggle;
      const overlay=document.createElement('div');overlay.className='hekomi-wardrobe-backdrop';overlay.hidden=true;overlay.setAttribute('aria-hidden','true');
      const cards=Object.entries(WARDROBE_PRESETS).map(([key,preset])=>'<button type="button" class="hekomi-wardrobe-card" data-hekomi-outfit="'+key+'" aria-pressed="'+(key===this.outfit?'true':'false')+'"><span class="hekomi-wardrobe-swatch" data-look="'+key+'" aria-hidden="true">'+preset.emoji+'</span><span class="hekomi-wardrobe-card-copy"><strong>'+preset.name+'</strong><small>'+preset.detail+'</small></span><span class="hekomi-wardrobe-check" aria-hidden="true">✓</span></button>').join('');
      overlay.innerHTML='<section class="hekomi-wardrobe" role="dialog" aria-modal="true" aria-labelledby="hekomiWardrobeTitle"><header class="hekomi-wardrobe-head"><div><span class="hekomi-wardrobe-kicker">HEKOMI-CHAN / CLOSET</span><h2 id="hekomiWardrobeTitle">A change of look?</h2><p>Every outfit comes with its own hair and makeup.</p></div><button type="button" class="hekomi-wardrobe-close" data-hekomi-wardrobe-close aria-label="Close wardrobe">×</button></header><div class="hekomi-wardrobe-grid">'+cards+'</div><footer class="hekomi-wardrobe-foot"><span>✧</span> Your current look is saved on this device.</footer></section>';
      overlay.addEventListener('click',event=>{const choice=event.target.closest('[data-hekomi-outfit]');if(choice){this.setOutfit(choice.dataset.hekomiOutfit);return;}if(event.target===overlay||event.target.closest('[data-hekomi-wardrobe-close]'))this.closeWardrobe();});
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&this.wardrobeOverlay&&!this.wardrobeOverlay.hidden)this.closeWardrobe();});
      document.body.appendChild(overlay);this.wardrobeOverlay=overlay;this.updateWardrobeSelection();
    }
    updateWardrobeSelection(){if(!this.wardrobeOverlay)return;this.wardrobeOverlay.querySelectorAll('[data-hekomi-outfit]').forEach(card=>{const selected=card.dataset.hekomiOutfit===this.outfit;card.classList.toggle('is-selected',selected);card.setAttribute('aria-pressed',selected?'true':'false');});}
    openWardrobe(){if(!this.wardrobeOverlay)return;this.wardrobeOverlay.hidden=false;this.wardrobeOverlay.setAttribute('aria-hidden','false');this.wardrobeToggle.setAttribute('aria-expanded','true');const selected=this.wardrobeOverlay.querySelector('[data-hekomi-outfit="'+this.outfit+'"]');if(selected)selected.focus();}
    closeWardrobe(){if(!this.wardrobeOverlay)return;this.wardrobeOverlay.hidden=true;this.wardrobeOverlay.setAttribute('aria-hidden','true');this.wardrobeToggle.setAttribute('aria-expanded','false');this.wardrobeToggle.focus();}
    setOutfit(name){if(!WARDROBE_PRESETS[name])return;this.outfit=name;try{localStorage.setItem('hekomi_wardrobe_v1',name);}catch{}this.updateWardrobeSelection();this.paint(performance.now(),true);this.closeWardrobe();this.say(WARDROBE_PRESETS[name].line,6800,true);}

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
      const detailPage=location.pathname.toLowerCase().startsWith('/series/anime/');
      // Keep the companion animated but out of the reading/tap area on phones.
      // Series pages retain the wider stage so her existing cover-perch behavior works.
      if(mobile&&!detailPage){
        const dockY=Math.max(74,visibleHeight-h-92);
        const dockMaxX=Math.max(8,Math.min(90,innerWidth-w-8));
        return {minX:8,maxX:dockMaxX,minY:dockY,maxY:dockY,w,h};
      }
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
    directionForVector(dx,dy){
      if(Math.abs(dx)>Math.abs(dy)*1.08)return dx<0?'west':'east';
      return dy<0?'north':'south';
    }
    setDirection(direction){
      if(!['north','south','east','west'].includes(direction))return;
      this.direction=direction;
      this.face=direction==='west'?-1:1;
      this.canvas.dataset.direction=direction;
      this.root.classList.toggle('face-left',direction==='west');
      this.canvas.style.transform=direction==='west'?'scaleX(-1)':'none';
    }

    moveToNext(){
      const perch=this.findPerchTarget();
      const goPerch=Boolean(perch)&&Math.random()<.38;
      const next=goPerch?perch:this.findSpot();
      const dx=next.x-this.x,dy=next.y-this.y;
      const distance=Math.hypot(dx,dy);
      if(distance<26){if(goPerch){this.nextPose='perch';this.arrive();}else this.arrive();return;}
      this.nextPose=goPerch?'perch':'';
      this.route=[];
      if(Math.abs(dx)>18&&Math.abs(dy)>18){
        const options=Math.random()<.5
          ?[{x:next.x,y:this.y},{x:this.x,y:next.y}]
          :[{x:this.x,y:next.y},{x:next.x,y:this.y}];
        const waypoint=options.find(point=>Math.hypot(point.x-this.x,point.y-this.y)>8&&Math.hypot(next.x-point.x,next.y-point.y)>8&&!this.blocked(point.x,point.y));
        if(waypoint)this.route.push(waypoint,next);
      }
      this.target=this.route.length?this.route.shift():next;
      this.state='walk';this.activity='idle';
      this.walkSpeed=0;this.walkPhase=0;
      this.setDirection(this.directionForVector(this.target.x-this.x,this.target.y-this.y));
      this.root.classList.remove('is-sleeping','is-making-bed','is-waking-up','is-eating','is-perching');
      this.canvas.style.pointerEvents='none';this.hideSpeech();
    }
    setInteractable(){
      this.canvas.style.pointerEvents=this.blocked(this.x,this.y)?'none':'auto';
    }
    arrive(){
      this.target=null;this.route=[];this.walkSpeed=0;this.stops++;this.setInteractable();
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
      this.stateUntil=now+5600;
    }
    sleep(now){
      this.state='sleep';this.sleepCount++;this.root.classList.remove('is-making-bed');
      this.root.classList.add('is-sleeping');
      this.canvas.style.transform='rotate(90deg) translateY(0)';
      this.say(this.pick(['All tucked in. Good night…','Wake me when the next episode airs.','Five more minutes…','Zzz…']),9500,true);
      this.stateUntil=now+22000+Math.random()*10000;
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
      this.state='greet';this.activity='noticed';this.gazeX=0;this.gazeY=-1;this.setDirection('south');
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
        if(dist<2.2){
          this.x=this.target.x;this.y=this.target.y;this.walkSpeed=0;
          this.applyPosition();
          if(this.route.length){
            this.target=this.route.shift();
            this.setDirection(this.directionForVector(this.target.x-this.x,this.target.y-this.y));
          }else this.arrive();
        }else{
          const nextDirection=this.directionForVector(dx,dy);
          if(nextDirection!==this.direction)this.setDirection(nextDirection);
          const brakingSpeed=Math.sqrt(Math.max(0,2*110*dist));
          const wantedSpeed=Math.min(64,brakingSpeed);
          this.walkSpeed+=(wantedSpeed-this.walkSpeed)*Math.min(1,dt*8);
          const step=Math.min(dist,Math.max(5,this.walkSpeed)*dt);
          this.x+=dx/dist*step;this.y+=dy/dist*step;
          this.walkPhase+=dt*(this.walkSpeed/64)*2.15;
          this.walkFrame=Math.floor(this.walkPhase*4)%4;
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
      const gaitStep=walking?Math.floor(this.walkPhase*4)%4:Math.floor(time/300)%4;
      const blink=sleeping||time<this.blinkUntil;
      const expression=sleeping?'sleepy':eating?'eating':this.state==='greet'?'happy':this.state==='wake'?'surprised':this.activity==='curious'?'surprised':this.activity==='annoyed'?'annoyed':'normal';
      const bob=sleeping?Math.round(Math.sin(time/1150)*.6):walking?Math.round(Math.sin(this.walkPhase*Math.PI*2)*.8):Math.round(Math.sin(time/900)*.45);
      drawAnimeSprite(this.ctx,{
        expression,blink,walking,sleeping,sitting,greeting:this.state==='greet',
        action:makingBed?'making-bed':eating?'eating':'',
        step:gaitStep,phase:this.walkPhase,time,chewFrame:Math.floor(time/480)%2,
        bob,gazeX:this.gazeX,gazeY:this.gazeY,direction:this.direction,
        outfit:this.outfit,hair:WARDROBE_PRESETS[this.outfit].hair,makeup:WARDROBE_PRESETS[this.outfit].makeup
      });;
    }
  }

    function boot(){
    if(document.getElementById('hekomiCompanion'))return;
    // Older layouts supplied this canvas in .home-visual. Create a mount when
    // that legacy element is absent so Hekomi never disappears with a redesign.
    let canvas=document.getElementById('hekomiChanCanvas');
    const visual=canvas&&canvas.closest('.home-visual');
    let bubble=(visual&&visual.querySelector('.home-mascot-bubble'))||document.querySelector('.home-mascot-bubble');
    let message=document.getElementById('hekomiChanMessage');

    if(!canvas){
      canvas=document.createElement('canvas');
      canvas.id='hekomiChanCanvas';
      canvas.className='home-mascot';
      canvas.width=W;
      canvas.height=H;
      canvas.textContent='Hekomi-chan';
    }
    if(canvas.dataset.hekomiReady)return;
    canvas.dataset.hekomiReady='true';

    if(!bubble){
      bubble=document.createElement('div');
      bubble.className='home-mascot-bubble';
    }
    if(!bubble.querySelector('span')){
      const label=document.createElement('span');
      label.textContent='HEKOMI-CHAN / ONLINE';
      bubble.appendChild(label);
    }
    if(!message){
      message=document.createElement('strong');
      message.id='hekomiChanMessage';
      message.setAttribute('aria-live','polite');
      message.textContent='I saved you a little company.';
    }
    if(!bubble.contains(message))bubble.appendChild(message);

    const root=document.createElement('div');
    root.id='hekomiCompanion';
    root.className='hekomi-companion';
    root.setAttribute('aria-label','Hekomi-chan, your wandering pixel companion');
    root.appendChild(bubble);
    bubble.classList.remove('is-visible');

    const bed=document.createElement('div');
    bed.className='hekomi-bed';
    bed.setAttribute('aria-hidden','true');
    bed.innerHTML='<span class="hekomi-bed-frame"></span><span class="hekomi-bed-mattress"></span><span class="hekomi-bed-pillow"></span><span class="hekomi-bed-blanket"></span>';
    const snack=document.createElement('span');
    snack.className='hekomi-snack';
    snack.setAttribute('aria-hidden','true');
    const zzz=document.createElement('span');
    zzz.className='hekomi-zzz';
    zzz.textContent='Z z z';
    zzz.setAttribute('aria-hidden','true');

    root.appendChild(bed);
    root.appendChild(snack);
    root.appendChild(zzz);
    root.appendChild(canvas);
    document.body.appendChild(root);
    if(visual)visual.remove();

    const companion=new HekomiWanderer(canvas,message,root,bubble);
    window.hekomiChan=companion;
    window.HekomiChan=HekomiWanderer;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

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
    shoe0:'#171925',shoe1:'#77718d',accent:'#c5b5ff',
    uniform0:'#26344e',uniform1:'#455b78',uniform2:'#edf0ec',uniform3:'#c7d8da',
    formal0:'#35283f',formal1:'#624b68',formal2:'#b39bbf',formal3:'#f3e8ef',
    lazy0:'#31564f',lazy1:'#4d7b70',lazy2:'#9acbbb',lazy3:'#deebe1',
    swim0:'#246b78',swim1:'#4da9a8',swim2:'#b5e7df',swim3:'#f1c3c6',
    date0:'#713d5b',date1:'#b65f82',date2:'#efa5bb',date3:'#ffe1e9',
    makeupShadow:'#a87592',makeupRose:'#d28ba1',makeupCoral:'#e8a08e',
    makeupLip:'#bd647e',makeupGold:'#f0d39a'
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

  const WARDROBE_PRESETS=Object.freeze({
    school:{name:'School dress',detail:'Sailor collar · side ponytail',hair:'school-ponytail',makeup:'fresh',emoji:'🎒',line:'Uniform on! I even remembered my ribbon today.'},
    formal:{name:'Formal dress',detail:'Tailored jacket · neat updo',hair:'formal-bun',makeup:'elegant',emoji:'✦',line:'A little polished, a little elegant. How do I look?'},
    lazy:{name:'Lazy dress',detail:'Oversized hoodie · messy bun',hair:'messy-bun',makeup:'soft',emoji:'☁',line:'Comfy clothes, messy hair… this is my natural habitat.'},
    swimsuit:{name:'Swimsuit dress',detail:'Sporty one-piece · twin buns',hair:'twin-buns',makeup:'sun-kissed',emoji:'🌊',line:'Beach day! I packed sunscreen. You did too, right?'},
    date:{name:'Going on a date',detail:'Rose dress · half-up waves',hair:'date-half-up',makeup:'rosy',emoji:'♡',line:'Wait, is this outfit too much? No? Okay… let’s go.'}
  });
  function drawBackHair(ctx,style,dy){
    if(style==='formal-bun'||style==='twin-buns'){
      blocks(ctx,BACK_HAIR.filter(([,y,,h])=>y<48||(y<56&&h<=5)),dy);
      if(style==='formal-bun')blocks(ctx,[[18,3,28,10,'ink'],[20,1,24,10,'hair0'],[23,2,18,7,'hair1'],[17,8,30,7,'hair0'],[21,5,5,2,'hair3'],[36,4,5,2,'hair3'],[13,46,5,10,'hair0'],[45,46,5,10,'hair0']],dy);
      else blocks(ctx,[[8,5,13,11,'ink'],[10,3,10,10,'hair0'],[12,4,7,6,'hair1'],[43,5,13,11,'ink'],[45,3,10,10,'hair0'],[47,4,7,6,'hair1'],[13,16,5,29,'hair0'],[46,16,5,29,'hair0'],[15,42,4,11,'hair1'],[44,42,4,11,'hair1']],dy);
      return;
    }
    blocks(ctx,BACK_HAIR,dy);
    if(style==='school-ponytail')blocks(ctx,[[42,10,11,9,'ink'],[47,16,10,9,'ink'],[51,23,8,16,'ink'],[53,37,7,12,'ink'],[51,47,7,9,'hair0'],[48,53,6,8,'hair1'],[44,13,7,5,'hair1'],[50,21,5,5,'hair2']],dy);
    else if(style==='messy-bun')blocks(ctx,[[19,3,25,9,'ink'],[21,1,21,9,'hair0'],[23,3,15,5,'hair1'],[14,7,8,7,'hair0'],[43,5,7,7,'hair0'],[18,10,5,4,'hair3'],[47,8,5,4,'hair3']],dy);
    else if(style==='date-half-up')blocks(ctx,[[20,5,24,8,'ink'],[22,3,20,8,'hair0'],[25,4,13,4,'hair1'],[16,11,7,5,'hair0'],[41,11,7,5,'hair0']],dy);
  }
  function drawHairAccessories(ctx,style,dy){
    if(style==='school-ponytail')blocks(ctx,[[47,19,5,4,'date1'],[49,16,3,5,'date2'],[45,20,4,3,'uniform2'],[52,20,4,2,'date2']],dy);
    else if(style==='formal-bun')blocks(ctx,[[39,7,6,2,'makeupGold'],[41,5,2,6,'makeupGold'],[36,9,3,2,'makeupGold']],dy);
    else if(style==='messy-bun')blocks(ctx,[[17,15,5,2,'lazy2'],[18,13,2,5,'lazy3'],[13,17,3,2,'lazy1']],dy);
    else if(style==='twin-buns')blocks(ctx,[[9,13,5,3,'swim2'],[10,11,3,6,'swim3'],[7,15,4,2,'swim1'],[49,13,5,3,'swim2'],[50,11,3,6,'swim3'],[52,15,4,2,'swim1']],dy);
    else if(style==='date-half-up')blocks(ctx,[[40,12,6,3,'date2'],[42,10,3,7,'date1'],[38,13,4,2,'date3'],[45,13,3,2,'date3']],dy);
  }
  function drawWardrobeOutfit(ctx,outfit,dy){
    if(outfit==='school')blocks(ctx,[[17,47,30,15,'ink'],[19,48,26,12,'uniform2'],[15,48,8,10,'ink'],[41,48,8,10,'ink'],[16,49,6,7,'uniform0'],[42,49,6,7,'uniform0'],[23,47,18,6,'uniform2'],[25,48,5,5,'uniform3'],[34,48,5,5,'uniform3'],[29,50,6,8,'uniform0'],[30,52,4,4,'date1'],[27,59,10,3,'uniform1'],[18,61,28,12,'ink'],[19,62,26,10,'uniform0'],[20,64,24,2,'uniform1'],[24,63,2,7,'uniform1'],[31,63,2,8,'uniform1'],[38,63,2,7,'uniform1'],[20,70,8,4,'uniform2'],[36,70,8,4,'uniform2'],[22,71,4,2,'uniform3'],[38,71,4,2,'uniform3']],dy);
    else if(outfit==='formal')blocks(ctx,[[17,47,30,15,'ink'],[19,48,26,12,'formal3'],[15,48,8,10,'ink'],[41,48,8,10,'ink'],[16,49,6,8,'formal0'],[42,49,6,8,'formal0'],[20,48,8,11,'formal1'],[36,48,8,11,'formal1'],[25,48,14,9,'formal3'],[27,49,10,7,'formal2'],[29,49,6,8,'formal0'],[30,51,4,5,'makeupGold'],[27,59,10,3,'formal1'],[19,61,26,13,'ink'],[21,62,22,10,'formal0'],[22,64,20,2,'formal1'],[27,63,2,8,'formal1'],[35,63,2,8,'formal1'],[22,71,7,3,'formal3'],[37,71,7,3,'formal3']],dy);
    else if(outfit==='lazy')blocks(ctx,[[17,47,30,16,'ink'],[19,48,26,13,'lazy0'],[14,48,9,11,'ink'],[41,48,9,11,'ink'],[16,49,6,9,'lazy1'],[42,49,6,9,'lazy1'],[20,49,24,7,'lazy1'],[19,55,26,7,'lazy0'],[24,56,16,5,'lazy1'],[26,57,12,4,'lazy0'],[27,54,2,7,'lazy3'],[35,54,2,7,'lazy3'],[24,60,16,3,'lazy0'],[25,61,14,2,'lazy1'],[27,62,2,2,'lazy2'],[36,62,2,2,'lazy2']],dy);
    else if(outfit==='swimsuit')blocks(ctx,[[16,48,7,9,'skin0'],[42,48,7,9,'skin0'],[17,48,5,7,'skin1'],[43,48,5,7,'skin1'],[21,47,22,15,'ink'],[23,48,18,12,'swim0'],[24,48,4,4,'swim2'],[36,48,4,4,'swim2'],[27,49,10,8,'swim1'],[29,50,6,7,'swim0'],[30,52,4,4,'swim3'],[22,57,20,5,'swim1'],[27,60,10,3,'swim2'],[19,62,26,9,'ink'],[21,63,22,7,'swim0'],[22,64,20,2,'swim1'],[24,63,2,6,'swim2'],[38,63,2,6,'swim2'],[22,70,7,3,'swim2'],[36,70,7,3,'swim2']],dy);
    else if(outfit==='date')blocks(ctx,[[17,47,30,15,'ink'],[19,48,26,12,'date2'],[14,48,9,10,'ink'],[41,48,9,10,'ink'],[16,49,6,8,'date1'],[42,49,6,8,'date1'],[20,48,8,8,'date2'],[36,48,8,8,'date2'],[25,48,14,10,'date3'],[27,51,10,7,'date2'],[29,49,6,10,'date1'],[30,52,4,4,'makeupGold'],[27,59,10,3,'date1'],[18,61,28,14,'ink'],[20,62,24,11,'date1'],[21,63,22,3,'date2'],[23,66,18,2,'date2'],[26,69,12,2,'date2'],[29,60,6,4,'date3'],[30,61,4,2,'date1']],dy);
  }
  function drawEyeMakeup(ctx,style){
    if(style==='soft')return;
    const shadow=style==='sun-kissed'?'makeupCoral':style==='fresh'?'makeupRose':'makeupShadow';
    blocks(ctx,[[21,27,10,2,shadow],[35,27,10,2,shadow],[22,29,8,1,'eye0'],[36,29,8,1,'eye0']]);
  }
  function drawMakeupDetails(ctx,style){
    if(style==='soft')return;
    if(style==='fresh')blocks(ctx,[[21,28,2,1,'eye0'],[43,28,2,1,'eye0'],[29,41,6,1,'makeupCoral']]);
    else if(style==='elegant')blocks(ctx,[[20,29,3,1,'eye0'],[43,29,3,1,'eye0'],[20,37,6,2,'makeupRose'],[38,37,6,2,'makeupRose'],[29,41,6,2,'makeupLip']]);
    else if(style==='sun-kissed')blocks(ctx,[[19,37,7,3,'makeupCoral'],[38,37,7,3,'makeupCoral'],[22,40,1,1,'makeupGold'],[26,41,1,1,'makeupGold'],[38,41,1,1,'makeupGold'],[42,40,1,1,'makeupGold'],[29,41,6,2,'makeupCoral']]);
    else if(style==='rosy')blocks(ctx,[[20,29,3,1,'eye0'],[43,29,3,1,'eye0'],[19,37,7,3,'makeupRose'],[38,37,7,3,'makeupRose'],[29,41,6,2,'makeupLip']]);
  }

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
  function drawRearHead(ctx,style,dy){
    // A rounded crown replaces the old solid rectangle. Each stepped row keeps
    // the crisp pixel-art silhouette while giving the back of her head volume.
    if(style==='formal-bun')blocks(ctx,[
      [20,2,24,9,'ink'],[22,1,20,8,'hair0'],[25,2,14,5,'hair1'],
      [27,5,10,3,'hair2'],[24,8,16,3,'hair0']
    ],dy);
    else if(style==='messy-bun')blocks(ctx,[
      [18,3,28,9,'ink'],[20,1,24,9,'hair0'],[24,3,16,5,'hair1'],
      [17,7,6,4,'hair0'],[42,6,6,4,'hair0'],[22,8,4,2,'hair3'],[39,7,4,2,'hair3']
    ],dy);
    else if(style==='twin-buns')blocks(ctx,[
      [7,5,14,11,'ink'],[9,3,10,10,'hair0'],[12,5,5,5,'hair1'],
      [43,5,14,11,'ink'],[45,3,10,10,'hair0'],[48,5,5,5,'hair1']
    ],dy);

    blocks(ctx,[
      [21,6,22,3,'ink'],[17,9,30,4,'ink'],[14,13,36,5,'ink'],
      [12,18,40,7,'ink'],[12,25,40,7,'ink'],[14,32,36,6,'ink'],[19,38,26,3,'ink'],
      [21,8,22,3,'hair0'],[18,12,28,4,'hair0'],[15,17,34,5,'hair1'],
      [14,23,36,6,'hair0'],[17,30,30,6,'hair1'],[21,36,22,3,'hair0'],
      [18,15,7,2,'hair2'],[28,11,8,2,'hair2'],[39,16,6,2,'hair2'],
      [15,22,3,7,'hair2'],[46,23,3,7,'hair2'],
      [18,30,2,7,'hair3'],[44,31,2,7,'hair3'],
      [22,34,3,3,'hair2'],[39,34,3,3,'hair2'],
      [30,14,2,11,'hair2'],[31,17,1,8,'hair3'],[32,26,2,7,'hair2']
    ],dy);

    // A narrow nape and two loose locks stop the hair from swallowing her neck.
    blocks(ctx,[
      [27,38,10,8,'ink'],[29,39,6,6,'skin0'],[30,39,4,5,'skin1'],[30,43,4,2,'skin0'],
      [12,28,5,11,'hair0'],[13,37,5,9,'hair1'],[15,45,4,7,'hair0'],
      [47,28,5,11,'hair0'],[46,37,5,9,'hair1'],[45,45,4,7,'hair0'],
      [14,31,2,7,'hair3'],[48,32,2,7,'hair3'],
      [17,43,2,5,'hair2'],[45,43,2,5,'hair2']
    ],dy);

    if(style==='school-ponytail')blocks(ctx,[
      [49,17,7,5,'date1'],[51,15,3,8,'date2'],[48,20,5,3,'uniform2'],
      [53,22,5,2,'date2'],[50,25,3,3,'hair3']
    ],dy);
    else if(style==='formal-bun')blocks(ctx,[
      [38,4,7,2,'makeupGold'],[40,3,2,6,'makeupGold'],[36,7,3,2,'formal2'],
      [29,10,6,2,'formal2']
    ],dy);
    else if(style==='twin-buns')blocks(ctx,[
      [10,11,4,2,'swim2'],[49,11,4,2,'swim2'],[8,14,4,2,'swim3'],[52,14,4,2,'swim3']
    ],dy);
    else if(style==='messy-bun')blocks(ctx,[
      [18,11,5,2,'lazy2'],[43,9,4,2,'lazy3'],[24,7,3,2,'hair3']
    ],dy);
    else if(style==='date-half-up')blocks(ctx,[
      [40,13,7,3,'date2'],[42,11,3,7,'date1'],[38,15,4,2,'date3'],[46,15,3,2,'date3']
    ],dy);
  }

  function drawSideFace(ctx,frame,dy){
    blocks(ctx,[
      [22,18,25,27,'ink'],[25,19,20,24,'skin0'],[28,20,16,22,'skin1'],
      [31,21,12,19,'skin2'],[42,28,4,7,'skin0'],[44,34,3,3,'skin0'],
      [45,35,3,2,'skin2'],[27,24,3,13,'skin0']
    ],dy);
    // One visible eye and a small nose bridge give her a real profile silhouette.
    if(frame.blink||frame.expression==='sleepy'){
      blocks(ctx,[[36,31,7,2,'eye0'],[37,32,5,1,'eye2']],dy);
    }else if(frame.expression==='happy'){
      blocks(ctx,[[36,31,2,2,'eye0'],[38,33,4,2,'eye0'],[39,34,2,1,'eye2']],dy);
    }else{
      const shadow=frame.makeup==='sun-kissed'?'makeupCoral':frame.makeup==='fresh'?'makeupRose':'makeupShadow';
      blocks(ctx,[[35,28,8,2,shadow],[36,30,7,2,'eye0'],[37,32,5,4,'white'],[39,32,3,4,'eye2'],[40,32,1,2,'eye3']],dy);
    }
    blocks(ctx,[
      [42,35,3,1,'skin0'],[44,36,2,1,'skin2'],
      [37,38,6,2,frame.makeup==='soft'?'blush':'makeupRose'],
      [40,41,5,1,'eye0'],[42,42,3,1,'skin0']
    ],dy);
    // A loose front lock hides the far eye instead of showing two eyes on a side view.
    blocks(ctx,[
      [17,20,13,25,'hair0'],[19,27,9,16,'hair1'],[20,37,6,9,'hair0'],
      [21,20,3,8,'hair2'],[22,32,2,7,'hair2']
    ],dy);
    blocks(ctx,FRINGE,dy);
    blocks(ctx,[
      [13,43,5,12,'hair0'],[14,52,4,8,'hair1'],[45,45,5,12,'hair0'],
      [46,53,4,7,'hair1'],[17,57,3,5,'hair0'],[44,59,3,5,'hair1']
    ],dy);
    drawHairAccessories(ctx,frame.hair||'long',dy);
  }

  function drawRearOutfit(ctx,outfit,dy){
    const back={school:'uniform0',formal:'formal0',lazy:'lazy0',swimsuit:'swim0',date:'date1'}[outfit]||'shirt0';
    const shade={school:'uniform1',formal:'formal1',lazy:'lazy1',swimsuit:'swim1',date:'date0'}[outfit]||'shirt1';
    // Rebuild the back as a proper shoulder-to-waist silhouette rather than
    // leaving the tiny generic stripe that used to sit between her shoulders.
    blocks(ctx,[
      [17,46,30,17,'ink'],[18,47,28,14,back],[20,48,24,10,shade],
      [19,57,26,5,back],[18,60,28,3,'ink'],[20,60,24,1,shade]
    ],dy);

    if(outfit==='lazy'){
      // Hood seam, shoulder folds and the lower hoodie ribbing.
      blocks(ctx,[
        [22,46,20,3,'ink'],[24,47,16,2,'lazy2'],[26,48,12,3,'lazy0'],
        [28,50,8,5,'lazy1'],[30,51,4,5,'lazy0'],
        [22,50,3,2,'lazy2'],[39,50,3,2,'lazy2'],
        [20,54,3,2,'lazy2'],[41,54,3,2,'lazy2'],
        [23,58,18,2,'lazy1'],[25,61,14,1,'lazy2'],
        [27,53,2,2,'lazy2'],[35,53,2,2,'lazy2']
      ],dy);
    }else if(outfit==='school'){
      // The sailor collar is visible from behind, with the ribbon at the nape.
      blocks(ctx,[
        [20,47,24,3,'uniform2'],[22,50,20,3,'uniform3'],
        [25,53,14,3,'uniform2'],[27,55,10,3,'uniform0'],
        [21,48,22,1,'uniform1'],[23,51,18,1,'uniform1'],
        [29,54,6,5,'date1'],[30,54,4,3,'date2'],[31,55,2,4,'date1'],
        [20,58,24,2,'uniform1']
      ],dy);
    }else if(outfit==='formal'){
      // Tailored jacket seams, back collar and a short row of buttons.
      blocks(ctx,[
        [20,47,8,4,'formal2'],[36,47,8,4,'formal2'],
        [22,49,6,2,'formal3'],[36,49,6,2,'formal3'],
        [30,49,4,12,'formal1'],[31,50,2,10,'formal2'],
        [21,53,8,2,'formal1'],[35,53,8,2,'formal1'],
        [23,58,18,2,'formal2'],[26,61,12,1,'formal3'],
        [32,53,1,1,'makeupGold'],[32,56,1,1,'makeupGold'],[32,59,1,1,'makeupGold']
      ],dy);
    }else if(outfit==='swimsuit'){
      // Sporty crossed straps and a clean horizontal back band.
      blocks(ctx,[
        [21,47,5,5,'swim2'],[38,47,5,5,'swim2'],
        [24,49,4,3,'swim3'],[36,49,4,3,'swim3'],
        [25,50,4,2,'swim2'],[35,50,4,2,'swim2'],
        [28,51,8,2,'swim0'],[22,54,20,2,'swim2'],
        [24,57,16,2,'swim0'],[29,60,6,1,'swim3']
      ],dy);
    }else if(outfit==='date'){
      // A ribbon bow and a fine centre seam on the rose dress.
      blocks(ctx,[
        [21,47,8,3,'date2'],[35,47,8,3,'date2'],
        [28,49,8,3,'date3'],[24,50,7,4,'date2'],[33,50,7,4,'date2'],
        [30,51,4,3,'date1'],[31,52,2,2,'date3'],
        [31,55,2,6,'date2'],[23,58,18,2,'date0'],
        [26,61,12,1,'date3']
      ],dy);
    }
  }

  function drawWalkLegsVertical(ctx,step,dy,direction){
    const lead=[0,1,3,1][step%4],trail=[3,1,0,1][step%4];
    blocks(ctx,[
      [20,61,25,6,'ink'],
      [21,65-lead,9,10+lead,'pant0'],
      [35,65-trail,9,10+trail,'pant0'],
      [22,69-lead,7,3,'pant1'],[36,69-trail,7,3,'pant1'],
      [24,66-lead,2,4,'pant2'],[37,66-trail,2,4,'pant2']
    ],dy);
  }
  function drawWalkArmsVertical(ctx,step,dy){
    const swing=[-2,0,2,0][step%4];
    blocks(ctx,[
      [13,47,9,12,'ink'],[15,48,6,9,'shirt0'],[16,49,4,6,'shirt2'],
      [14,55+swing,5,8,'skin0'],[13,60+swing,6,4,'skin1'],
      [41,47,10,12,'ink'],[43,48,6,9,'shirt0'],[43,49,5,6,'shirt2'],
      [46,55-swing,5,8,'skin0'],[46,60-swing,6,4,'skin1'],
      [15,62+swing,3,2,'skin2'],[48,62-swing,3,2,'skin2']
    ],dy);
  }

  function drawIdleArms(ctx,frame,dy){
    const sway=[0,-1,0,1][frame%4];
    blocks(ctx,[
      [14,48,7,10,'ink'],[15,49,5,8,'shirt0'],[16,50,4,5,'shirt2'],
      [14,57+sway,5,7,'skin0'],[15,59+sway,5,4,'skin1'],[16,62+sway,3,2,'skin2'],
      [41,48,9,10,'ink'],[43,49,6,8,'shirt0'],[43,50,5,5,'shirt2'],
      [46,57-sway,5,7,'skin0'],[46,59-sway,5,4,'skin1'],[47,62-sway,3,2,'skin2']
    ],dy);
  }

  function drawShoes(ctx,step,walking,direction,dy){
    let feet;
    if(walking&&(direction==='east'||direction==='west')){
      const side=[
        [[17,74,14,4],[36,74,13,4]],
        [[14,74,14,4],[38,72,12,4]],
        [[23,73,12,4],[33,74,14,4]],
        [[12,72,14,4],[37,74,13,4]]
      ];
      feet=side[step%4];
    }else if(walking){
      const lead=[0,1,3,1][step%4],trail=[3,1,0,1][step%4];
      feet=[[19,75-lead,13,4],[34,75-trail,13,4]];
    }else{
      feet=[[19,74,13,4],[33,74,13,4]];
    }
    const back=direction==='north';
    for(const [x,y,w,h] of feet){
      blocks(ctx,[[x,y,w,h,'ink'],[x+2,y,w-4,1,back?'pant2':'shoe1']],dy);
    }
  }
  function drawSprite(ctx,frame){
    ctx.clearRect(0,0,W,H);
    const dy=Math.round(frame.bob||0);
    const direction=frame.direction||'south';
    const side=direction==='east'||direction==='west';
    const rear=direction==='north';
    const walking=!!frame.walking;
    const step=frame.step||0;

    // Hair behind the body, feet first, then the outfit so sleeves and shoes
    // can be drawn on top. This avoids the old "floating hand under the shirt" look.
    drawBackHair(ctx,frame.hair||'long',dy);
    if(frame.sitting)drawPerchLegs(ctx,step,dy);
    else if(walking&&side)drawWalkLegs(ctx,step,dy);
    else if(walking)drawWalkLegsVertical(ctx,step,dy,direction);
    else blocks(ctx,LEGS,dy);

    blocks(ctx,TORSO,dy);
    drawWardrobeOutfit(ctx,frame.outfit||'lazy',dy);
    if(rear)drawRearOutfit(ctx,frame.outfit||'lazy',dy);

    if(frame.sleeping)drawSleepArms(ctx,dy);
    else if(walking&&side)drawWalkArms(ctx,step,dy);
    else if(walking)drawWalkArmsVertical(ctx,step,dy);
    else if(frame.action==='making-bed')drawMakingBedArm(ctx,frame.wave,dy);
    else if(frame.action==='eating')drawLeftArm(ctx,dy);
    else if(frame.sitting)drawPerchArms(ctx,step,dy);
    else if(frame.greeting) {drawLeftArm(ctx,dy);drawWaveArm(ctx,frame.wave,dy);}
    else drawIdleArms(ctx,frame.idleFrame||0,dy);

    if(rear){
      drawRearHead(ctx,frame.hair||'long',dy);
    }else if(side){
      drawSideFace(ctx,frame,dy);
    }else{
      blocks(ctx,FACE,dy);
      blocks(ctx,FRINGE,dy);
      drawHairAccessories(ctx,frame.hair||'long',dy);
      blocks(ctx,[
        [13,45,5,12,'hair0'],[14,54,4,7,'hair1'],[45,46,5,12,'hair0'],
        [46,54,4,8,'hair1'],[17,58,3,5,'hair0'],[44,60,3,5,'hair1']
      ],dy);
      drawEyeMakeup(ctx,frame.makeup||'soft');
      drawEyes(ctx,frame.expression,frame.blink,frame.gazeX||0,frame.gazeY||0);
      drawFaceDetails(ctx,frame.expression,frame.chewFrame||0);
      drawMakeupDetails(ctx,frame.makeup||'soft');
    }

    if(frame.action==='eating'&&!rear){
      drawEatingArm(ctx,frame.chewFrame||0,dy);
      blocks(ctx,[[42,34,5,4,'white'],[41,35,2,3,'skin1'],[43,37,4,1,'mint0'],[44,34,1,1,'skin3']],dy);
    }
    if(!frame.sleeping)drawShoes(ctx,step,walking,direction,dy);
    if(!rear){
      blocks(ctx,[
        [43,22,3,1,'mint1'],[44,21,1,3,'mint1'],[46,22,2,1,'accent'],
        [17,18,2,1,'hair4'],[48,35,1,3,'hair3'],[13,44,1,4,'hair3']
      ],dy);
    }
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
      this.direction='south';this.walkSpeed=0;this.walkPhase=0;this.route=[];
      this.x=12;this.y=12;this.last=0;this.lastSpeech=0;this.speechUntil=0;this.lastObstacleCheck=0;
      this.stateUntil=0;this.walkFrame=0;this.stops=0;this.sleepCount=0;this.hiddenPause=false;
      this.nextBlink=performance.now()+1800+Math.random()*2600;this.blinkUntil=0;this.gazeX=0;this.gazeY=0;this.nextGlance=performance.now()+2200+Math.random()*3800;this.activity='idle';
      this.scrollTimer=0;this.lastScrollSpeechAt=0;this.lastSpecialAt=0;
      this.airingPromise=null;this.airingPool=[];this.lastRecommendedId=0;this.recommendationToken=0;this.nextPose='';
      this.bed=root.querySelector('.hekomi-bed');this.snack=root.querySelector('.hekomi-snack');
      this.recommendLink=bubble&&bubble.querySelector('.hekomi-recommend-link');
      this.reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.canvas.width=W;this.canvas.height=H;this.ctx.imageSmoothingEnabled=false;
      this.mountWardrobe();
      this.setDirection('south');
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
      drawSprite(this.ctx,{
        expression,blink,walking,sleeping,sitting,greeting:this.state==='greet',
        action:makingBed?'making-bed':eating?'eating':'',
        step:gaitStep,wave:Math.floor(time/300)%6,chewFrame:Math.floor(time/480)%2,
        idleFrame:Math.floor(time/420)%4,bob,gazeX:this.gazeX,gazeY:this.gazeY,direction:this.direction,
        outfit:this.outfit,hair:WARDROBE_PRESETS[this.outfit].hair,makeup:WARDROBE_PRESETS[this.outfit].makeup
      });
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

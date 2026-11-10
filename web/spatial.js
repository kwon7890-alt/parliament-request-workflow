(function initializeGlobalResponseMap() {
  "use strict";
  const canvas = document.querySelector("#globe3d"), hero = document.querySelector(".committee-hero"), tiltCard = document.querySelector('[data-tilt="3d"]');
  if (!canvas || !hero || !tiltCard) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches, context = canvas.getContext("2d");
  const seoul = { lat: 37.5665, lon: 126.978 };
  const destinations = [
    ["TOKYO",35.6762,139.6503,.02],["SYDNEY",-33.8688,151.2093,.18],["NEW DELHI",28.6139,77.209,.31],
    ["ADDIS ABABA",8.9806,38.7578,.46],["PARIS",48.8566,2.3522,.62],["WASHINGTON",38.9072,-77.0369,.78],["MEXICO CITY",19.4326,-99.1332,.9],
  ].map(([name,lat,lon,offset])=>({name,lat,lon,offset}));
  const land = [
    [[-168,72],[-140,70],[-125,55],[-102,50],[-82,25],[-98,15],[-122,27],[-135,48],[-168,60]],
    [[-82,12],[-67,8],[-50,-5],[-36,-18],[-52,-55],[-73,-48],[-80,-10]],
    [[-12,36],[5,44],[28,40],[42,53],[75,61],[105,72],[150,60],[164,44],[140,34],[126,12],[105,7],[85,22],[63,24],[46,12],[32,30],[15,31],[5,36]],
    [[-18,34],[8,37],[34,30],[50,8],[40,-30],[18,-35],[-2,-25],[-15,4]],
    [[112,-11],[154,-12],[151,-39],[130,-44],[113,-31]], [[-54,83],[-24,80],[-20,62],[-42,58],[-60,68]],
    [[130,34],[142,45],[145,38],[136,31]], [[124,39],[130,42],[129,35],[125,33]],
  ];
  let width=0,height=0,map={x:0,y:0,width:0,height:0},pointerX=0,pointerY=0,targetX=0,targetY=0;
  function fitCanvas(){
    const b=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1); width=b.width;height=b.height;
    map={x:width*.35,y:height*.08,width:width*.92,height:height*.84}; canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));
    context.setTransform(dpr,0,0,dpr,0,0);Object.assign(canvas.dataset,{renderer:"world-air-routes",motion:reduceMotion?"static":"animated",routes:String(destinations.length),hub:"Seoul",hubAnchor:"0.35"});
  }
  function project(lon,lat){let delta=lon-seoul.lon;while(delta<-180)delta+=360;while(delta>180)delta-=360;return{x:map.x+map.width*(delta/360)+pointerX*8,y:map.y+map.height*(.5-lat/180)+pointerY*5};}
  function drawGrid(){
    context.save();context.strokeStyle="rgba(124,246,212,.08)";context.lineWidth=.7;
    for(let lat=-60;lat<=60;lat+=30){context.beginPath();for(let lon=-180;lon<=180;lon+=4){const p=project(lon,lat);lon===-180?context.moveTo(p.x,p.y):context.lineTo(p.x,p.y);}context.stroke();}
    for(let d=-150;d<=150;d+=30){context.beginPath();for(let lat=-80;lat<=80;lat+=4){const p=project(seoul.lon+d,lat);lat===-80?context.moveTo(p.x,p.y):context.lineTo(p.x,p.y);}context.stroke();}context.restore();
  }
  function drawLand(){context.save();context.fillStyle="rgba(80,217,255,.09)";context.strokeStyle="rgba(124,246,212,.42)";context.lineWidth=1;for(const polygon of land){context.beginPath();polygon.forEach(([lon,lat],i)=>{const p=project(lon,lat);i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y);});context.closePath();context.fill();context.stroke();}context.restore();}
  function geometry(d){const from=project(seoul.lon,seoul.lat),to=project(d.lon,d.lat),distance=Math.hypot(to.x-from.x,to.y-from.y);return{from,to,control:{x:(from.x+to.x)/2,y:Math.min(from.y,to.y)-Math.min(115,Math.max(24,distance*.25))}};}
  function bezier(g,t){const u=1-t;return{x:u*u*g.from.x+2*u*t*g.control.x+t*t*g.to.x,y:u*u*g.from.y+2*u*t*g.control.y+t*t*g.to.y,angle:Math.atan2(2*u*(g.control.y-g.from.y)+2*t*(g.to.y-g.control.y),2*u*(g.control.x-g.from.x)+2*t*(g.to.x-g.control.x))};}
  function drawPlane(p){context.save();context.translate(p.x,p.y);context.rotate(p.angle);context.fillStyle="#f6fffc";context.shadowColor="rgba(124,246,212,.9)";context.shadowBlur=12;context.beginPath();context.moveTo(9,0);context.lineTo(-5,-3);context.lineTo(-2,0);context.lineTo(-7,5);context.lineTo(-3,6);context.lineTo(2,1);context.lineTo(-3,-1);context.lineTo(-7,-6);context.lineTo(-3,-6);context.closePath();context.fill();context.restore();}
  function drawRoutes(timestamp){
    const hub=project(seoul.lon,seoul.lat);
    for(const d of destinations){const g=geometry(d),gradient=context.createLinearGradient(g.from.x,g.from.y,g.to.x,g.to.y);gradient.addColorStop(0,"rgba(124,246,212,.72)");gradient.addColorStop(1,"rgba(80,217,255,.18)");context.strokeStyle=gradient;context.lineWidth=1.15;context.setLineDash([4,6]);context.beginPath();context.moveTo(g.from.x,g.from.y);context.quadraticCurveTo(g.control.x,g.control.y,g.to.x,g.to.y);context.stroke();context.setLineDash([]);context.fillStyle="rgba(124,246,212,.9)";context.beginPath();context.arc(g.to.x,g.to.y,2.2,0,Math.PI*2);context.fill();if(width>950){context.fillStyle="rgba(213,255,245,.68)";context.font='700 8px "Segoe UI",sans-serif';context.textAlign="center";context.fillText(d.name,g.to.x,g.to.y-7);}drawPlane(bezier(g,reduceMotion?.58:(timestamp*.000055+d.offset)%1));}
    context.fillStyle="#7cf6d4";context.shadowColor="#7cf6d4";context.shadowBlur=16;context.beginPath();context.arc(hub.x,hub.y,4.4,0,Math.PI*2);context.fill();context.shadowBlur=0;context.fillStyle="#eafff9";context.font='900 10px "Segoe UI",sans-serif';context.textAlign="center";context.fillText("SEOUL · KOREA HUB",hub.x,hub.y-11);
  }
  function draw(timestamp=0){pointerX+=(targetX-pointerX)*.06;pointerY+=(targetY-pointerY)*.06;context.clearRect(0,0,width,height);const glow=context.createRadialGradient(width*.72,height*.48,0,width*.72,height*.48,width*.44);glow.addColorStop(0,"rgba(38,146,183,.18)");glow.addColorStop(1,"rgba(38,146,183,0)");context.fillStyle=glow;context.fillRect(0,0,width,height);drawGrid();drawLand();drawRoutes(timestamp);if(!reduceMotion)requestAnimationFrame(draw);}
  function applyTilt(event){if(reduceMotion)return;const b=tiltCard.getBoundingClientRect(),x=(event.clientX-b.left)/b.width-.5,y=(event.clientY-b.top)/b.height-.5;tiltCard.style.transform=`rotateX(${(-y*4).toFixed(2)}deg) rotateY(${(x*5).toFixed(2)}deg) translateZ(8px)`;}
  hero.addEventListener("pointermove",event=>{const b=hero.getBoundingClientRect();targetX=(event.clientX-b.left)/b.width-.5;targetY=(event.clientY-b.top)/b.height-.5;},{passive:true});hero.addEventListener("pointerleave",()=>{targetX=0;targetY=0;},{passive:true});tiltCard.addEventListener("pointermove",applyTilt,{passive:true});tiltCard.addEventListener("pointerleave",()=>{tiltCard.style.transform="";},{passive:true});new ResizeObserver(fitCanvas).observe(canvas);fitCanvas();draw(0);
}());

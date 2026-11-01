/* Round the Bases! — field drawing, animation loop and scoreboard. Needs js/physics.js first. */
(function () {
"use strict";
const { VMAX, BASES, MOUND, add, sub, mul, dist, norm, squarePath, bananaPath, rayPath, profile, at } = window.RTB;
const sam=profile(squarePath()), bea=profile(bananaPath()), ray=profile(rayPath(),true);
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let W=0,k=1,ox=0,oy=0;
const S=(p)=>{const u=(p[0]-p[1])/Math.SQRT2, v=(p[0]+p[1])/Math.SQRT2; return [ox+u*k, oy-v*k];};
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}

function size(){
  const r=cv.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  W=r.width; cv.width=Math.round(W*dpr); cv.height=Math.round(W*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  k=W/178.2; ox=W/2; oy=152.7*k;
}
function poly(list){ctx.beginPath(); list.forEach((p,i)=>{const s=S(p); i?ctx.lineTo(s[0],s[1]):ctx.moveTo(s[0],s[1]);}); ctx.closePath();}
function circle(c,r){const s=S(c); ctx.beginPath(); ctx.arc(s[0],s[1],r*k,0,Math.PI*2);}

function drawField(){
  ctx.fillStyle='#2f7a35'; ctx.fillRect(0,0,W,W);
  ctx.fillStyle='#378a3c';
  for(let x=-200;x<300;x+=20){ poly([[x,-200],[x+10,-200],[x+10,300],[x,300]]); ctx.fill(); }
  const dirt='#c98b56';
  ctx.save(); poly([[-8,-8],[200,-8],[200,200],[-8,200]]); ctx.clip();
  ctx.fillStyle=dirt; circle(MOUND,95); ctx.fill(); ctx.restore();
  ctx.fillStyle='#3a8f3f'; poly([[3,3],[87,3],[87,87],[3,87]]); ctx.fill();
  ctx.fillStyle=dirt;
  for(let i=0;i<4;i++){const A=BASES[i],B=BASES[(i+1)%4],d=norm(sub(B,A)),n=[d[1],-d[0]];
    poly([add(A,mul(n,3)),add(B,mul(n,3)),add(B,mul(n,-3)),add(A,mul(n,-3))]); ctx.fill();}
  BASES.forEach((b,i)=>{circle(b,i?10:13); ctx.fill();});
  circle(MOUND,9); ctx.fill();
  ctx.fillStyle='#e6d2b5'; const m=S(MOUND); ctx.fillRect(m[0]-1.2*k,m[1]-.4*k,2.4*k,.8*k);
  ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=Math.max(1.5,.45*k);
  [[0,0,200,0],[0,0,0,200]].forEach(([a,b,c,d])=>{const s=S([a,b]),e=S([c,d]);ctx.beginPath();ctx.moveTo(s[0],s[1]);ctx.lineTo(e[0],e[1]);ctx.stroke();});
  ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=1;
  for(let i=1;i<4;i++){const b=BASES[i],h=1.8; poly([[b[0]-h,b[1]-h],[b[0]+h,b[1]-h],[b[0]+h,b[1]+h],[b[0]-h,b[1]+h]]); ctx.fill(); ctx.stroke();}
  poly([[1.8,-.4],[1.8,1.8],[-.4,1.8],[-2,0],[0,-2]].map(p=>p)); ctx.fill(); ctx.stroke();
  ctx.font=`700 ${Math.max(12,4.2*k)}px ${css('--body')}`; ctx.fillStyle='rgba(255,255,255,.92)'; ctx.textAlign='center'; ctx.textBaseline='middle';
  [['1st',[104,-6]],['2nd',[100,100]],['3rd',[-6,104]],['Home',[-9,-9]]].forEach(([t,p])=>{const s=S(p);ctx.fillText(t,s[0],s[1]);});
}
function drawPlan(R,color){
  ctx.save(); ctx.setLineDash([2*k,2*k]); ctx.strokeStyle=color; ctx.globalAlpha=.55; ctx.lineWidth=Math.max(2,.7*k);
  ctx.beginPath(); R.pts.forEach((p,i)=>{if(i%4)return; const s=S(p); i?ctx.lineTo(s[0],s[1]):ctx.moveTo(s[0],s[1]);});
  const e=S(R.pts[R.pts.length-1]); ctx.lineTo(e[0],e[1]); ctx.stroke(); ctx.restore();
}
function drawFeet(R,time,color,edge){
  ctx.fillStyle=color; ctx.strokeStyle=edge; ctx.lineWidth=1;
  for(const f of R.feet){ if(f.t>time) break; const s=S(f.p); ctx.beginPath(); ctx.arc(s[0],s[1],Math.max(2.5,.85*k),0,Math.PI*2); ctx.fill(); ctx.stroke(); }
}
function bubble(s,text,fill,ink,dy){
  ctx.font=`700 ${Math.max(12,4*k)}px ${css('--body')}`;
  const w=ctx.measureText(text).width+14, h=Math.max(22,7*k), x=Math.min(Math.max(s[0]-w/2,4),W-w-4), y=s[1]+dy-h;
  ctx.fillStyle=fill; ctx.beginPath(); ctx.roundRect(x,y,w,h,h/2); ctx.fill();
  ctx.fillStyle=ink; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,x+w/2,y+h/2+1);
}
function nearBase(p){for(let i=1;i<4;i++) if(dist(p,BASES[i])<6) return true; return false;}
function drawRunner(R,time,color,edge,name,isSam){
  const st=at(R,time), s=S(st.p), r=Math.max(7,2.4*k);
  ctx.beginPath(); ctx.arc(s[0],s[1],r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle=edge; ctx.stroke();
  let label=name;
  if(isSam==='ray'){
    if(time>0 && Math.abs(time-R.first)<1.2) label='Run THROUGH!';
    else if(time>R.first) label='Safe at 1st!';
    bubble(s,label,'#8a1f17','#fff',r+4+Math.max(22,7*k)); return st;
  }
  if(time>0 && !st.done){
    if(isSam && st.v<VMAX*.45 && time>1.6) label='STOP… turn…';
    if(!isSam && nearBase(st.p)) label='Lean & tap!';
  }
  if(st.done) label=name+' is home!';
  bubble(s,label,isSam?'#163a8a':'#fff3b0',isSam?'#fff':'#3a2c00',isSam?-r-4:r+4+Math.max(22,7*k));
  return st;
}

const ui={tRay:document.getElementById('tRay'),fRay:document.getElementById('fRay'),sRay:document.getElementById('sRay'),pRay:document.getElementById('pRay'),pSam:document.getElementById('pSam'),pBea:document.getElementById('pBea'),tSam:document.getElementById('tSam'),tBea:document.getElementById('tBea'),fSam:document.getElementById('fSam'),fBea:document.getElementById('fBea'),
  sSam:document.getElementById('sSam'),sBea:document.getElementById('sBea'),result:document.getElementById('result'),play:document.getElementById('play'),slow:document.getElementById('slow')};
function status(st,time){
  if(time<=0) return 'Ready…';
  if(st.done) return 'Safe at home!';
  if(time<1.4) return 'Taking off!';
  const f=st.v/VMAX; return f>.85?'Full speed!':f>.5?'Turning…':'Slowing way down!';
}
let sim=0, running=false, last=0;
function render(){
  const cSam=css('--sam'), cBea=css('--bea'), cRay=css('--ray');
  drawField(); drawPlan(ray,cRay); drawPlan(sam,cSam); drawPlan(bea,cBea);
  drawFeet(ray,sim,cRay,'#fff'); drawFeet(sam,sim,cSam,'#fff'); drawFeet(bea,sim,cBea,'#3a2c00');
  const c=drawRunner(ray,sim,cRay,'#fff','Ray','ray');
  ui.tRay.textContent=Math.min(sim,ray.first).toFixed(1); ui.fRay.style.width=(c.v/VMAX*100)+'%';
  ui.sRay.textContent=sim<=0?'Ready…':sim>=ray.first?'Safe at 1st!':sim<1.4?'Taking off!':'Full speed! Straight line!';
  [[ui.pRay,ray],[ui.pSam,sam],[ui.pBea,bea]].forEach(([el,R])=>{el.innerHTML='To 1st: '+(sim>=R.first?`<b>${R.first.toFixed(1)} s</b> · hit the bag at ${Math.round(R.firstV/VMAX*100)}% speed`:'<b>–</b>');});
  if(running && sim>=ray.first && !ray.told){ray.told=true; ui.result.textContent=`Ray is safe at first in ${ray.first.toFixed(1)} s! Running straight through is fastest when you only need one base.`;}
  const a=drawRunner(sam,sim,cSam,'#fff','Sam',true), b=drawRunner(bea,sim,cBea,'#3a2c00','Bea',false);
  ui.tSam.textContent=Math.min(sim,sam.T).toFixed(1); ui.tBea.textContent=Math.min(sim,bea.T).toFixed(1);
  ui.fSam.style.width=(a.v/VMAX*100)+'%'; ui.fBea.style.width=(b.v/VMAX*100)+'%';
  ui.sSam.textContent=status(a,sim); ui.sBea.textContent=status(b,sim);
}
function finish(){
  const gap=(sam.T-bea.T).toFixed(1), extra=Math.round(bea.len-sam.len);
  ui.result.textContent=`To first: Ray ${ray.first.toFixed(1)} s, Bea ${bea.first.toFixed(1)} s, Sam ${sam.first.toFixed(1)} s. All the way home: Bea beats Sam by ${gap} seconds, even with ${extra} extra feet.`;
  ui.play.textContent='Race again';
}
function tick(now){
  if(!running) return;
  const dt=Math.min(.05,(now-last)/1000); last=now;
  sim+=dt*(ui.slow.getAttribute('aria-pressed')==='true'?1:2.5);
  if(sim>=sam.T+.4){sim=sam.T+.4; running=false; render(); finish(); return;}
  render(); requestAnimationFrame(tick);
}
function start(){
  sim=0; ray.told=false; running=true; last=performance.now(); ui.play.textContent='Running…';
  ui.result.textContent='And they\'re off! Watch the corners.'; requestAnimationFrame(tick);
}
ui.play.addEventListener('click',start);
ui.slow.addEventListener('click',()=>ui.slow.setAttribute('aria-pressed',ui.slow.getAttribute('aria-pressed')==='true'?'false':'true'));
new ResizeObserver(()=>{size(); render();}).observe(cv);
size(); render();
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const doneFont=document.fonts?document.fonts.ready:Promise.resolve();
doneFont.then(()=>{ if(!running) render(); if(!reduce) setTimeout(()=>{ if(!running && sim===0) start(); },900); });
})();

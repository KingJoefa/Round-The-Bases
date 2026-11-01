/*
 * Round the Bases! — runner physics (no DOM; runs in the browser and in Node).
 * Units: feet and seconds. Field coords: home (0,0), 1st (90,0), 2nd (90,90), 3rd (0,90).
 * Each path is sampled every DS feet. Speed at each sample is capped by:
 *   - top speed VMAX
 *   - turning grip: v <= sqrt(ALAT * turnRadius)
 *   - how fast a runner can speed up (ACC) and slow down (DEC)
 */
(function (root) {
"use strict";
const VMAX=19, ACC=9, DEC=14, ALAT=16, DS=0.25, STEP=0.33;
// Sliding: start ~9 ft before the bag (Baseball Canada says 9-10 ft); dirt friction brakes harder than feet.
const SLIDE_LEN=9, SLIDE_DEC=19;
const BASES=[[0,0],[90,0],[90,90],[0,90]];
const MOUND=[42.8,42.8];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], mul=(a,s)=>[a[0]*s,a[1]*s];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]), norm=a=>{const l=Math.hypot(a[0],a[1])||1;return [a[0]/l,a[1]/l]};

function resample(poly){
  const out=[poly[0]]; let carry=0;
  for(let i=1;i<poly.length;i++){
    const a=poly[i-1], b=poly[i], L=dist(a,b); if(L<1e-9) continue;
    let s=DS-carry;
    while(s<=L){ out.push(add(a,mul(sub(b,a),s/L))); s+=DS; }
    carry=L-(s-DS);
  }
  out.push(poly[poly.length-1]);
  return out;
}
function squarePath(){
  const C=[[0,0],[90,0],[90,90],[0,90],[0,0]], r=2, poly=[[0,0]];
  for(let i=1;i<4;i++){
    const P=C[i], a=norm(sub(P,C[i-1])), b=norm(sub(C[i+1],P));
    const p0=sub(P,mul(a,r)), p2=add(P,mul(b,r));
    for(let j=0;j<=24;j++){const t=j/24,u=1-t;
      poly.push([u*u*p0[0]+2*u*t*P[0]+t*t*p2[0], u*u*p0[1]+2*u*t*P[1]+t*t*p2[1]]);}
  }
  poly.push([0,0]); return resample(poly);
}
function catmull(pts,segs){
  const P=[sub(mul(pts[0],2),pts[1]),...pts,sub(mul(pts[pts.length-1],2),pts[pts.length-2])], out=[];
  const tj=(ti,a,b)=>ti+Math.sqrt(dist(a,b))||ti+1e-4;
  for(let i=0;i<P.length-3;i++){
    const [p0,p1,p2,p3]=[P[i],P[i+1],P[i+2],P[i+3]];
    const t0=0,t1=tj(t0,p0,p1),t2=tj(t1,p1,p2),t3=tj(t2,p2,p3);
    for(let j=0;j<segs;j++){
      const t=t1+(t2-t1)*j/segs;
      const A1=add(mul(p0,(t1-t)/(t1-t0)),mul(p1,(t-t0)/(t1-t0)));
      const A2=add(mul(p1,(t2-t)/(t2-t1)),mul(p2,(t-t1)/(t2-t1)));
      const A3=add(mul(p2,(t3-t)/(t3-t2)),mul(p3,(t-t2)/(t3-t2)));
      const B1=add(mul(A1,(t2-t)/(t2-t0)),mul(A2,(t-t0)/(t2-t0)));
      const B2=add(mul(A2,(t3-t)/(t3-t1)),mul(A3,(t-t1)/(t3-t1)));
      out.push(add(mul(B1,(t2-t)/(t2-t1)),mul(B2,(t-t1)/(t2-t1))));
    }
  }
  out.push(pts[pts.length-1]); return out;
}
// Banana leg waypoints from base A to base B. `w` = how far (ft) the runner swings out into foul ground.
// 0 = runs right down the line, then has to turn sharply at the bag.
const BANANA_W=7.5;
function bananaLeg(A,B,w){
  const d=norm(sub(B,A)), n=[d[1],-d[0]], L=90, f=w/BANANA_W;
  const at=(t,o)=>add(A,add(mul(d,L*t),mul(n,o*f)));
  return [at(.42,1),at(.68,6.5),at(.86,7.5),at(.95,4.8),add(B,mul(norm(sub(MOUND,B)),1.2))];
}
function bananaPath(w){
  w=w==null?BANANA_W:w;
  const wp=[[0,0]];
  for(let i=0;i<3;i++) wp.push(...bananaLeg(BASES[i],BASES[i+1],w));
  wp.push([0,45],[0,0]);
  return resample(catmull(clean(wp),40));
}
function rayPath(){ return resample([[0,0],[106,0]]); }
// Banana around 1st, straight to 2nd; feet reach the front edge of the bag.
function sidPath(w){
  w=w==null?BANANA_W:w;
  return resample(catmull(clean([[0,0],...bananaLeg(BASES[0],BASES[1],w),[90.6,40],[90.2,65],[90,88.2]]),40));
}
// Banana around 1st, then a few hard steps toward 2nd and back to the bag (a single, "rounding" first).
function roundPath(w){
  w=w==null?BANANA_W:w;
  return resample(catmull(clean([[0,0],...bananaLeg(BASES[0],BASES[1],w),[90.8,8],[91,14]]),40));
}
// Ran through 1st, stopped, then heads for 2nd from a standstill.
function runThroughThen2nd(){
  const a=profile(rayPath(),true), b=profile(resample([[106,0],[98,44],[90,88.2]]),true,SLIDE_LEN);
  return chain(a,b);
}
function chain(a,b){
  const off=a.pts.length-1;
  return {pts:a.pts.concat(b.pts.slice(1)), v:a.v.concat(b.v.slice(1)), t:a.t.concat(b.t.slice(1).map(x=>x+a.T)),
    T:a.T+b.T, len:a.len+b.len, feet:a.feet.concat(b.feet.map(f=>({t:f.t+a.T,p:f.p}))),
    first:a.first, firstV:a.firstV, slideIdx:off+b.slideIdx, slideT:a.T+b.slideT, slideV:b.slideV};
}
// Drop waypoints that sit on top of each other (w=0 makes some collinear duplicates).
function clean(wp){ return wp.filter((p,i)=>i===0||dist(p,wp[i-1])>0.5); }
function profile(pts,stop,slideLen){
  slideLen=slideLen||0;
  const n=pts.length, lim=new Array(n).fill(VMAX), k=4;
  for(let i=k;i<n-k;i++){
    const p=pts[i-k],q=pts[i],r=pts[i+k];
    const area=Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))/2;
    if(area>1e-6){const R=dist(p,q)*dist(q,r)*dist(p,r)/(4*area); lim[i]=Math.min(VMAX,Math.sqrt(ALAT*R));}
  }
  if(stop) lim[n-1]=0;
  const v=new Array(n); v[0]=0;
  for(let i=1;i<n;i++) v[i]=Math.min(lim[i],Math.sqrt(v[i-1]*v[i-1]+2*ACC*DS));
  const slideIdx=slideLen?n-1-Math.round(slideLen/DS):n;
  for(let i=n-2;i>0;i--){const dec=i>=slideIdx?SLIDE_DEC:DEC; v[i]=Math.min(v[i],Math.sqrt(v[i+1]*v[i+1]+2*dec*DS));}
  const t=new Array(n); t[0]=0;
  for(let i=1;i<n;i++) t[i]=t[i-1]+DS/Math.max((v[i]+v[i-1])/2,0.05);
  const feet=[]; let next=STEP;
  for(let i=1;i<slideIdx&&i<n;i++) if(t[i]>=next){feet.push({t:t[i],p:pts[i]}); next+=STEP;}
  let bi=0,bd=1e9; pts.forEach((p,i)=>{const d=dist(p,BASES[1]); if(d<bd){bd=d;bi=i;}});
  return {pts,v,t,T:t[n-1],len:(n-1)*DS,feet,first:t[bi],firstV:v[bi],slideIdx,slideT:slideIdx<n?t[slideIdx]:Infinity,slideV:slideIdx<n?v[slideIdx]:0};
}
function at(R,time){
  if(time>=R.T){const i=R.pts.length-1;return {p:R.pts[i],v:0,i,done:true};}
  let lo=0,hi=R.t.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1; if(R.t[m]<=time) lo=m; else hi=m;}
  const f=(time-R.t[lo])/((R.t[hi]-R.t[lo])||1);
  return {p:add(R.pts[lo],mul(sub(R.pts[hi],R.pts[lo]),f)),v:R.v[lo]+(R.v[hi]-R.v[lo])*f,i:lo,done:false};
}


const RTB = { VMAX, ACC, DEC, ALAT, DS, STEP, SLIDE_LEN, SLIDE_DEC, BASES, MOUND, add, sub, mul, dist, norm,
  BANANA_W, resample, bananaLeg, squarePath, bananaPath, rayPath, sidPath, roundPath, runThroughThen2nd, chain, profile, at };
if (typeof module !== "undefined" && module.exports) module.exports = RTB;
root.RTB = RTB;
})(typeof globalThis !== "undefined" ? globalThis : this);

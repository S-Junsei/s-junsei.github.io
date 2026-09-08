/* Exact Euclidean model. The renderer never chooses vertex coordinates by eye. */
(function(root){
'use strict';
const P={A:[0,6,0],B:[0,0,0],C:[2,0,0],D:[9/5,3/5,0],E:[9/2,0,0],F:[18/5,6/5,0],G:[0,9/4,0],I:[3/2,3/2,0],O:[1,0,0]};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,t)=>a.map(v=>v*t);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.sqrt(dot(a,a));
const unit=a=>mul(a,1/norm(a));
const distance=(a,b)=>norm(sub(a,b));
const angle=(a,o,b)=>Math.acos(Math.max(-1,Math.min(1,dot(unit(sub(a,o)),unit(sub(b,o))))))*180/Math.PI;
const axis=unit(sub(P.C,P.A));
function fold(p,degrees){
 const t=degrees*Math.PI/180,v=sub(p,P.D);
 return add(P.D,add(add(mul(v,Math.cos(t)),mul(cross(axis,v),Math.sin(t))),mul(axis,dot(axis,v)*(1-Math.cos(t)))));
}
const area=vertices=>Math.abs(vertices.reduce((s,p,i)=>{const q=vertices[(i+1)%vertices.length];return s+p[0]*q[1]-p[1]*q[0];},0))/2;
const M={P,sub,add,mul,dot,cross,norm,unit,distance,angle,axis,fold,area,baseArea:21/8,height:3*Math.sqrt(10)/5,volume:21*Math.sqrt(10)/40};
if(typeof module!=='undefined'&&module.exports)module.exports=M;else root.Geometry=M;
})(typeof window!=='undefined'?window:globalThis);

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./dist/app.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function buildSignet('),source.indexOf('\nfunction build(){'));
function generate(sample,gain=1){let result;vm.runInNewContext(`${fn}\nbuildSignet();`,{N:96,loaded:{radius:2},$:()=>({value:gain}),sample,mesh:(positions,indices)=>{result={positions,indices};},Math});return result;}
const flat=generate(()=>1000);
const shaped=generate((u,v)=>1000+1800*Math.sin(u*4)*Math.cos(v*3),3);
assert(shaped.positions.every(Number.isFinite));
let raised=0,recessed=0;
for(let k=0;k<shaped.positions.length;k+=3){const [x,y]=shaped.positions.slice(k,k+2);assert(Math.hypot(x,y)>=6.7-1e-8,'Terrain crossed finger opening');const delta=y-flat.positions[k+1];if(delta>.01)raised++;if(delta<-.01)recessed++;}
assert(raised>0&&recessed>0,'Both peaks and valleys must be represented');
const edges=new Map();for(let k=0;k<shaped.indices.length;k+=3){const triangle=shaped.indices.slice(k,k+3);for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);}}
assert([...edges.values()].every(count=>count===2),'Mesh contains an open edge');
console.log(`PASS: peaks (${raised}), valleys (${recessed}), finite geometry, closed edges and clear finger opening at maximum relief.`);

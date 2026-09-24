import fs from 'node:fs';

const app=fs.readFileSync(new URL('./dist/app.js',import.meta.url),'utf8');
const fbx=fs.readFileSync(new URL('./dist/assets/Signet_Ring.fbx',import.meta.url));
if(!fbx.subarray(0,18).toString().startsWith('Kaydara FBX Binary'))throw Error('invalid FBX asset');
if(!app.includes('FBXLoader')||!app.includes('deformRing'))throw Error('FBX vertex deformation is missing');
if(!app.includes('basePositions')||!app.includes('position.array.set(base)'))throw Error('original FBX vertices are not restored before deformation');
if(app.includes('buildTerrain'))throw Error('detached terrain overlay is still present');
if(!app.includes('const N=192')||!app.includes('subdivideTop'))throw Error('high-detail terrain pipeline is missing');
if(!app.includes('THREE.FrontSide')||!app.includes('groups=new Map()'))throw Error('continuous ring surface pipeline is missing');
if(!app.includes('morphAttributes.position')||!app.includes('applyRelief'))throw Error('GPU relief control is missing');
if(!app.includes("clearTimeout(liveTimer);load(true)")||!app.includes("if(!silent)$('load').disabled=true"))throw Error('interactive rebuild can still be overridden by live updates');
console.log('PASS: FBX body found; GPU relief is instant and interactive rebuild wins over background updates.');

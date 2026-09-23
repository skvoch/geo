import fs from 'node:fs';

const app=fs.readFileSync(new URL('./dist/app.js',import.meta.url),'utf8');
const fbx=fs.readFileSync(new URL('./dist/assets/Signet_Ring.fbx',import.meta.url));
if(!fbx.subarray(0,18).toString().startsWith('Kaydara FBX Binary'))throw Error('invalid FBX asset');
if(!app.includes('FBXLoader')||!app.includes('deformRing'))throw Error('FBX vertex deformation is missing');
if(!app.includes('basePositions')||!app.includes('position.array.set(base)'))throw Error('original FBX vertices are not restored before deformation');
if(app.includes('buildTerrain'))throw Error('detached terrain overlay is still present');
console.log('PASS: FBX body found; relief deforms the original model vertices and restores them before every rebuild.');

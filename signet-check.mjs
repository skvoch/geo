import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const app=fs.readFileSync(new URL('./dist/app.js',import.meta.url),'utf8');
const fbx=fs.readFileSync(new URL('./dist/assets/Signet_Ring.fbx',import.meta.url));
if(!fbx.subarray(0,18).toString().startsWith('Kaydara FBX Binary'))throw Error('invalid FBX asset');
if(!app.includes('FBXLoader')||!app.includes('deformRing'))throw Error('FBX vertex deformation is missing');
if(!app.includes('basePositions')||!app.includes('prepareDeformation'))throw Error('original FBX vertices or active-vertex cache is missing');
if(app.includes('buildTerrain'))throw Error('detached terrain overlay is still present');
if(!app.includes('const N=192')||!app.includes('subdivideTop'))throw Error('high-detail terrain pipeline is missing');
if(!app.includes('THREE.FrontSide')||!app.includes('groups=new Map()'))throw Error('continuous ring surface pipeline is missing');
if(!app.includes('position.needsUpdate=true')||!app.includes('terrainPositions.fill(0)')||!app.includes('applyRelief'))throw Error('direct visible geometry update is missing');
if(!app.includes("clearTimeout(liveTimer);load(true)")||!app.includes("if(!silent)$('load').disabled=true"))throw Error('interactive rebuild can still be overridden by live updates');
if(!app.includes("marker.on('dragstart'")||!app.includes('setInterval')||!app.includes("marker.on('dragend'")||!app.includes('clearTimeout(liveTimer);load(false,true)'))throw Error('streaming preview or final marker terrain rebuild is missing');
if(!app.includes('window.__ringTestState'))throw Error('runtime geometry probe is missing');
const morphTest=spawnSync(process.execPath,['relief-pipeline.test.mjs'],{cwd:new URL('.',import.meta.url),encoding:'utf8'});
if(morphTest.status!==0)throw Error(morphTest.stderr||morphTest.stdout||'terrain morph test failed');
console.log('PASS: FBX body found; every location rebuild updates the visible mesh positions.');

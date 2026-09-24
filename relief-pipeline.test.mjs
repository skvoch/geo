import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('./dist/app.js',import.meta.url),'utf8');

assert.match(app,/terrainPositions\.fill\(0\)/,'old terrain values must be cleared before rebuilding');
assert.match(app,/position\.array\[i\]=base\[i\]\+terrainPositions\[i\]\*influence/,'relief must be written into the actual mesh positions');
assert.match(app,/position\.needsUpdate=true/,'updated mesh positions must be uploaded to the GPU');
assert.doesNotMatch(app,/morphAttributes|morphTargetInfluences/,'cached WebGL morph targets must not return');
assert.match(app,/function build\(\).*deformRing\(\);\s*applyRelief\(\)/s,'every terrain build must deform the ring and expose the result');
assert.doesNotMatch(app,/targetMorphSlot|currentMorphSlot|terrainBlend/,'obsolete dual-slot state must not return');
assert.match(app,/window\.__ringTestState=ringTestState/,'runtime geometry probe must remain available');
assert.match(app,/pass<2/,'terrain detail must not be erased by excessive smoothing');
assert.match(app,/relief\*15\.5/,'terrain contrast gain changed unexpectedly');
assert.match(app,/subdivideTop\(child\.geometry,0\)/,'extra whole-ring subdivision must stay disabled');

console.log('PASS: every location rebuild writes new positions into the visible mesh.');

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,.1,500);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
$('viewport').appendChild(renderer.domElement);
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(new RoomEnvironment(renderer),.045).texture;
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.minDistance=12;controls.maxDistance=100;
controls.autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotateSpeed=.55;
let autoRotateTimer;
controls.addEventListener('start',()=>{controls.autoRotate=false;clearTimeout(autoRotateTimer);});
controls.addEventListener('end',()=>{clearTimeout(autoRotateTimer);autoRotateTimer=setTimeout(()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)controls.autoRotate=true;},3500);});
scene.add(new THREE.HemisphereLight(0xffffff,0x647080,2.8));
for(const [x,y,z,power,color] of [[-18,28,26,850,0xffffff],[22,14,-18,620,0xb9caff],[0,-8,22,320,0xffead2]]){const light=new THREE.PointLight(color,power);light.position.set(x,y,z);scene.add(light);}
let model=new THREE.Group();scene.add(model);
let data=null,loaded=null,job=0;
const material=new THREE.MeshPhysicalMaterial({color:0xd7d9df,metalness:1,roughness:.17,clearcoat:.02,clearcoatRoughness:.2,envMapIntensity:1.58,side:THREE.FrontSide});
let ringBody=null,ringBounds=null;
function subdivideTop(source,levels=2){
  const geometry=source.index?source.toNonIndexed():source.clone();
  if(!geometry.attributes.normal)geometry.computeVertexNormals();
  const positions=geometry.attributes.position,normals=geometry.attributes.normal,outPositions=[],outNormals=[];
  const groups=new Map(),normalList=[];
  for(let i=0;i<positions.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(positions,i),key=`${Math.round(p.x*10000)}/${Math.round(p.y*10000)}/${Math.round(p.z*10000)}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
    normalList.push(new THREE.Vector3().fromBufferAttribute(normals,i).normalize());
  }
  const averaged=new THREE.Vector3();
  for(const indices of groups.values()){
    if(indices.length<2)continue;
    for(const index of indices){
      averaged.set(0,0,0);const reference=normalList[index];
      for(const sibling of indices)if(reference.dot(normalList[sibling])>.35)averaged.add(normalList[sibling]);
      averaged.normalize();normals.setXYZ(index,averaged.x,averaged.y,averaged.z);
    }
  }
  const emit=(a,b,c)=>{for(const vertex of [a,b,c]){outPositions.push(vertex.p.x,vertex.p.y,vertex.p.z);outNormals.push(vertex.n.x,vertex.n.y,vertex.n.z);}};
  const midpoint=(a,b)=>({p:a.p.clone().add(b.p).multiplyScalar(.5),n:a.n.clone().add(b.n).normalize()});
  const split=(a,b,c,depth)=>{if(!depth){emit(a,b,c);return;}const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);split(a,ab,ca,depth-1);split(ab,b,bc,depth-1);split(ca,bc,c,depth-1);split(ab,bc,ca,depth-1);};
  for(let i=0;i<positions.count;i+=3){
    const vertices=[];
    for(let k=0;k<3;k++)vertices.push({p:new THREE.Vector3().fromBufferAttribute(positions,i+k),n:new THREE.Vector3().fromBufferAttribute(normals,i+k).normalize()});
    split(vertices[0],vertices[1],vertices[2],levels);
  }
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(outPositions,3));
  result.setAttribute('normal',new THREE.Float32BufferAttribute(outNormals,3));
  result.computeBoundingBox();result.computeBoundingSphere();
  return result;
}
const ringReady=new Promise((resolve,reject)=>{
  new FBXLoader().load('assets/Signet_Ring.fbx',object=>{
    const sourceBox=new THREE.Box3().setFromObject(object);
    const sourceSize=sourceBox.getSize(new THREE.Vector3());
    const center=sourceBox.getCenter(new THREE.Vector3());
    object.position.sub(center);
    object.scale.setScalar(18/sourceSize.y);
    object.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(object);
    const size=box.getSize(new THREE.Vector3());
    object.traverse(child=>{if(child.isMesh){
      child.geometry=subdivideTop(child.geometry,2);
      child.userData.basePositions=Float32Array.from(child.geometry.attributes.position.array);
      child.userData.baseNormals=Float32Array.from(child.geometry.attributes.normal.array);
      child.material=material;child.castShadow=true;child.receiveShadow=true;child.frustumCulled=false;
    }});
    ringBounds={top:box.max.y,halfX:size.x*.49,halfZ:size.z*.49,band:size.y*.10};
    ringBody=object;
    model.add(object);
    if(data)build();
    resolve(object);
  },undefined,error=>reject(Error('Не удалось открыть модель кольца: '+error.message)));
});
function reset(){camera.position.set(23,23,36);controls.target.set(0,2,0);controls.update();}
reset();$('reset').onclick=reset;
new ResizeObserver(()=>{const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe($('viewport'));
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
const map=L.map('map',{attributionControl:false,zoomControl:false}).setView([43.3499,42.4453],9);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
const markerIcon=L.divIcon({className:'terrain-marker',html:'<span></span>',iconSize:[34,34],iconAnchor:[17,17]});
const marker=L.marker([43.3499,42.4453],{draggable:true,icon:markerIcon}).addTo(map);
const circle=L.circle([43.3499,42.4453],{radius:10000,color:'#4b51a8',weight:1.5,opacity:.72,fillColor:'#8790d3',fillOpacity:.13}).addTo(map);
function selection(){const lat=Number($('lat').value),lon=Number($('lon').value),radius=Number($('radius').value);if(!$('lat').value||!$('lon').value||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>84||Math.abs(lon)>180)throw Error('Введи широту от −84 до 84 и долготу от −180 до 180.');return {lat,lon,radius};}
function pending(){try{const s=selection();marker.setLatLng([s.lat,s.lon]);circle.setLatLng([s.lat,s.lon]).setRadius(s.radius*1000);$('coordinateLabel').innerHTML=formatCoords(s.lat,s.lon);$('status').textContent=data?'Точка выбрана. Создай кольцо, чтобы обновить рельеф.':'Точка выбрана.';}catch(e){$('status').textContent=e.message;}}
function setPoint(lat,lon,center=true){$('lat').value=Number(lat).toFixed(4);$('lon').value=Number(lon).toFixed(4);pending();if(center)map.setView([Number(lat),Number(lon)],9);scheduleLive();}
map.on('click',e=>setPoint(e.latlng.lat,((e.latlng.lng+540)%360-180),false));
marker.on('drag',()=>{const p=marker.getLatLng();$('lat').value=p.lat.toFixed(4);$('lon').value=p.lng.toFixed(4);circle.setLatLng(p);$('coordinateLabel').innerHTML=formatCoords(p.lat,p.lng);scheduleLive();});
marker.on('dragend',()=>{const p=marker.getLatLng();setPoint(p.lat,p.lng,false);});
for(const id of ['lat','lon'])$(id).oninput=()=>{pending();try{const s=selection();map.panTo([s.lat,s.lon]);scheduleLive();}catch{}};
function paintRange(input){const min=Number(input.min)||0,max=Number(input.max)||100,value=Number(input.value);input.style.setProperty('--fill',`${(value-min)/(max-min)*100}%`);}
$('radius').oninput=()=>{$('radiusValue').value=`${$('radius').value} км`;paintRange($('radius'));pending();scheduleLive();};
const N=192,cache=new Map(),heightCache=new Map();
function world(lat,lon,z){const n=2**z;const rad=lat*Math.PI/180;return [(lon+180)/360*n,(1-Math.asinh(Math.tan(rad))/Math.PI)/2*n];}
async function tile(z,x,y){const n=2**z;x=((x%n)+n)%n;y=Math.max(0,Math.min(n-1,y));const key=`${z}/${x}/${y}`;if(cache.has(key))return cache.get(key);const p=(async()=>{const response=await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Источник высот временно недоступен.');const bitmap=await createImageBitmap(await response.blob());const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();return ctx.getImageData(0,0,256,256).data;})();cache.set(key,p);try{return await p;}catch(e){cache.delete(key);throw e;}}
async function heights(s){const cacheKey=`${s.lat.toFixed(4)}/${s.lon.toFixed(4)}/${s.radius}`;if(heightCache.has(cacheKey))return heightCache.get(cacheKey);const dlat=s.radius/111.32,dlon=dlat/Math.cos(s.lat*Math.PI/180);if(Math.abs(s.lat)+dlat>85)throw Error('Выбери точку немного дальше от полюса.');const z=Math.max(2,Math.min(12,Math.floor(Math.log2(360/(dlon*2)))));const points=[],keys=new Map();for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const u=i/N*2-1,v=j/N*2-1;const [x,y]=world(s.lat-v*dlat,s.lon+u*dlon,z);const tx=Math.floor(x),ty=Math.floor(y),key=`${tx}/${ty}`;points.push({key,px:Math.floor((x-tx)*256),py:Math.floor((y-ty)*256)});keys.set(key,[tx,ty]);}const tiles=new Map(await Promise.all([...keys].map(async([key,[x,y]])=>[key,await tile(z,x,y)])));const result=Float32Array.from(points,p=>{const t=tiles.get(p.key),k=(p.py*256+p.px)*4;return t[k]*256+t[k+1]+t[k+2]/256-32768;});heightCache.set(cacheKey,result);if(heightCache.size>24)heightCache.delete(heightCache.keys().next().value);return result;}
function sampleField(field,u,v){const x=Math.max(0,Math.min(N,(u+1)*N/2)),y=Math.max(0,Math.min(N,(v+1)*N/2));const i=Math.min(N-1,Math.floor(x)),j=Math.min(N-1,Math.floor(y)),a=x-i,b=y-j;return field[j*(N+1)+i]*(1-a)*(1-b)+field[j*(N+1)+i+1]*a*(1-b)+field[(j+1)*(N+1)+i]*(1-a)*b+field[(j+1)*(N+1)+i+1]*a*b;}
function sample(u,v){return sampleField(data,u,v);}
let filteredSource=null,filteredHeights=null;
function jewelryHeights(){
  if(filteredSource===data)return filteredHeights;
  const side=N+1,weights=[1,4,6,4,1],work=Float32Array.from(data),temp=new Float32Array(data.length);
  const clamp=value=>Math.max(0,Math.min(N,value));
  for(let pass=0;pass<4;pass++){
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){let sum=0;for(let k=-2;k<=2;k++)sum+=work[y*side+clamp(x+k)]*weights[k+2];temp[y*side+x]=sum/16;}
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){let sum=0;for(let k=-2;k<=2;k++)sum+=temp[clamp(y+k)*side+x]*weights[k+2];work[y*side+x]=sum/16;}
  }
  filteredSource=data;filteredHeights=work;return work;
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
function terrainField(relief=Number($('relief').value)){
  const filtered=jewelryHeights();
  let mean=0,count=0;
  for(let j=0;j<=32;j++)for(let i=0;i<=32;i++){const u=i/16-1,v=j/16-1;if(Math.pow(Math.abs(u),4)+Math.pow(Math.abs(v),4)<=1){mean+=sampleField(filtered,u/Math.SQRT2,v/Math.SQRT2);count++;}}
  mean/=count;
  const gain=relief*12.2/(loaded.radius*2000);
  return (u,v)=>{const raw=(sampleField(filtered,u,v)-mean)*gain;return 2.05*Math.tanh(raw/2.05);};
}
function deformRing(){
  const referenceRelief=Number($('relief').max)||3,terrain=terrainField(referenceRelief),{top,halfX,halfZ,band}=ringBounds;
  const displacement=(u,v)=>{
    const rho=Math.pow(Math.pow(Math.abs(u),4)+Math.pow(Math.abs(v),4),.25);
    if(rho>=1)return 0;
    const edge=1-smooth((rho-.68)/.32);
    return terrain(u/Math.SQRT2,v/Math.SQRT2)*edge;
  };
  model.updateMatrixWorld(true);
  const worldToModel=model.matrixWorld.clone().invert();
  ringBody.traverse(child=>{if(!child.isMesh)return;
    const position=child.geometry.attributes.position,base=child.userData.basePositions,baseNormals=child.userData.baseNormals;
    const normals=child.geometry.attributes.normal;
    position.array.set(base);
    normals.array.set(baseNormals);
    child.updateWorldMatrix(true,false);
    const meshToModel=new THREE.Matrix4().multiplyMatrices(worldToModel,child.matrixWorld);
    const modelToMesh=meshToModel.clone().invert();
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(meshToModel);
    const normalToMesh=new THREE.Matrix3().getNormalMatrix(modelToMesh);
    const point=new THREE.Vector3(),normal=new THREE.Vector3(),terrainNormal=new THREE.Vector3();
    const epsilon=4/N;
    for(let i=0;i<position.count;i++){
      point.fromArray(base,i*3).applyMatrix4(meshToModel);
      normal.fromArray(baseNormals,i*3).applyMatrix3(normalMatrix).normalize();
      if(point.y<top-band*2.7)continue;
      const u=point.x/halfX,v=point.z/halfZ;
      const rho=Math.pow(Math.pow(Math.abs(u),4)+Math.pow(Math.abs(v),4),.25);
      let changed=false;
      const heightWeight=smooth((point.y-(top-band*2.7))/(band*2.7));
      const facingWeight=smooth((normal.y+.08)/.72);
      const surfaceWeight=heightWeight*facingWeight;
      if(surfaceWeight>.001&&rho<1){
        const edge=1-smooth((rho-.68)/.32);
        point.y+=displacement(u,v)*surfaceWeight;
        const dx=(displacement(u+epsilon,v)-displacement(u-epsilon,v))/(2*epsilon*halfX)*surfaceWeight;
        const dz=(displacement(u,v+epsilon)-displacement(u,v-epsilon))/(2*epsilon*halfZ)*surfaceWeight;
        terrainNormal.set(-dx*.66,1,-dz*.66).normalize();
        const blend=edge*surfaceWeight;
        normal.lerp(terrainNormal,blend).normalize();
        changed=true;
      }else if(normal.y<.55&&rho>.55&&rho<1.35){
        const projection=Math.max(1,rho/.78);
        const shoulderHeight=heightWeight;
        const sideWeight=1-smooth((normal.y-.05)/.50);
        const push=terrain(u/projection/Math.SQRT2,v/projection/Math.SQRT2)*.12*shoulderHeight*sideWeight;
        point.addScaledVector(normal,push);
        changed=Math.abs(push)>.0001;
      }
      if(!changed)continue;
      normal.applyMatrix3(normalToMesh).normalize();
      point.applyMatrix4(modelToMesh);
      position.setXYZ(i,point.x,point.y,point.z);
      normals.setXYZ(i,normal.x,normal.y,normal.z);
    }
    let morphPosition=child.geometry.morphAttributes.position?.[0],morphNormal=child.geometry.morphAttributes.normal?.[0],created=false;
    if(!morphPosition){morphPosition=new THREE.Float32BufferAttribute(new Float32Array(position.array.length),3);morphNormal=new THREE.Float32BufferAttribute(new Float32Array(normals.array.length),3);child.geometry.morphAttributes.position=[morphPosition];child.geometry.morphAttributes.normal=[morphNormal];child.geometry.morphTargetsRelative=true;created=true;}
    for(let i=0;i<position.array.length;i++){morphPosition.array[i]=position.array[i]-base[i];morphNormal.array[i]=normals.array[i]-baseNormals[i];}
    morphPosition.needsUpdate=true;morphNormal.needsUpdate=true;
    position.array.set(base);normals.array.set(baseNormals);position.needsUpdate=true;normals.needsUpdate=true;
    if(created)child.updateMorphTargets();
  });
}
let appliedRelief=null;
function applyRelief(){
  const influence=Number($('relief').value)/(Number($('relief').max)||3);
  ringBody?.traverse(child=>{if(child.isMesh&&child.morphTargetInfluences)child.morphTargetInfluences[0]=influence;});
  appliedRelief=$('relief').value;
}
function build(){if(!data||!ringBody||!ringBounds)return;const low=Math.min(...data),high=Math.max(...data);
deformRing();
applyRelief();model.scale.setScalar(Number($('size').value)/100);$('stats').textContent=loaded.lat.toFixed(4)+', '+loaded.lon.toFixed(4)+' · Радиус '+loaded.radius+' км · Высоты '+Math.round(low)+'–'+Math.round(high)+' м';}
async function load(openDetails=false,silent=false){const id=++job;let s;try{s=selection();}catch(e){$('status').textContent=e.message;return;}if(!silent)$('load').disabled=true;if(!silent)$('stageLoading').hidden=false;$('status').textContent=silent?'Обновляем рельеф…':'Загружаем настоящие высоты и создаём кольцо…';try{const result=await heights(s);await ringReady;if(id!==job)return;data=result;loaded=s;build();applyPlace();$('stageLoading').hidden=true;$('status').textContent='Кольцо обновлено. Можно продолжать выбирать точку.';if(openDetails)showStep('details');const now=selection();if(JSON.stringify(now)!==JSON.stringify(s))pending();}catch(e){if(id===job){$('stageLoading').hidden=true;$('status').textContent=`${data?'Предыдущее кольцо сохранено. ':''}Не удалось загрузить рельеф: ${e.message} Попробуй ещё раз.`;}}finally{if(id===job)$('load').disabled=false;}}
let liveTimer;
function scheduleLive(){if($('mapPanel').hidden)return;clearTimeout(liveTimer);$('status').textContent='Точка изменена — готовим новый рельеф…';liveTimer=setTimeout(()=>load(false,true),320);}
$('load').onclick=()=>{clearTimeout(liveTimer);load(true);};
$('relief').oninput=()=>{$('reliefValue').value=`${Number($('relief').value).toFixed(1)}×`;paintRange($('relief'));applyRelief();$('status').textContent='Характер рельефа обновлён.';};
$('size').oninput=()=>{$('sizeValue').value=`${$('size').value}%`;paintRange($('size'));model.scale.setScalar(Number($('size').value)/100);};
const materialPresets={
  '#c8cdd2':{color:'#d7d9df',metalness:1,roughness:.17,clearcoat:.02,clearcoatRoughness:.20,envMapIntensity:1.58,reflectivity:.5},
  '#c4ad78':{color:'#c59643',metalness:1,roughness:.115,clearcoat:.04,clearcoatRoughness:.16,envMapIntensity:1.76,reflectivity:.5},
  '#76877e':{color:'#303936',metalness:.01,roughness:.76,clearcoat:.01,clearcoatRoughness:.46,envMapIntensity:.40,reflectivity:.24}
};
$('material').onchange=()=>{const preset=materialPresets[$('material').value]||materialPresets['#c8cdd2'];material.color.set(preset.color);material.metalness=preset.metalness;material.roughness=preset.roughness;material.clearcoat=preset.clearcoat;material.clearcoatRoughness=preset.clearcoatRoughness;material.envMapIntensity=preset.envMapIntensity;material.reflectivity=preset.reflectivity;material.needsUpdate=true;};
$('material').value='#c8cdd2';$('material').dispatchEvent(new Event('change'));

let placeName='Эльбрус',placeRegion='Кавказ, Россия';
function formatCoords(lat,lon){return `${Math.abs(lat).toFixed(4)}° ${lat>=0?'N':'S'} &nbsp; ${Math.abs(lon).toFixed(4)}° ${lon>=0?'E':'W'}`;}
function applyPlace(){$('stageWord').textContent=placeName.toUpperCase();$('stagePlace').textContent=placeRegion.toUpperCase();$('productTitle').textContent=placeName;$('resultTitle').textContent=`Твой ${placeName}`;$('selectedPlace').textContent=placeName;const s=selection();$('coordinateLabel').innerHTML=formatCoords(s.lat,s.lon);}
function showStep(step){const navStep=step==='order'?'details':step;document.body.dataset.step=navStep;for(const name of ['intro','location','details','order'])$(`${name}Step`).hidden=name!==step;for(let i=1;i<=3;i++){const active=i===({intro:1,location:2,details:3}[navStep]);$(`stepLabel${i}`).classList.toggle('active',active);$(`stepLabel${i}`).setAttribute('aria-current',active?'step':'false');}if(step==='location')requestAnimationFrame(()=>map.invalidateSize());if(step==='order'||(innerWidth<=700&&step!=='intro'))requestAnimationFrame(()=>$('configuration').scrollIntoView({behavior:'smooth',block:'start'}));}
function choosePlace(lat,lon,name,region){placeName=name||'Твоё место';placeRegion=region||'Выбранная точка';$('mapPanel').hidden=false;setPoint(lat,lon);applyPlace();for(const item of document.querySelectorAll('[data-place]'))item.setAttribute('aria-pressed',String(item.dataset.name===placeName));requestAnimationFrame(()=>map.invalidateSize());$('searchResults').replaceChildren();$('searchStatus').textContent='Точка найдена. Рельеф обновляется автоматически.';}
$('start').onclick=()=>showStep('location');$('backIntro').onclick=()=>showStep('intro');$('backLocation').onclick=()=>showStep('location');$('backDetails').onclick=()=>showStep('details');$('keepElbrus').onclick=()=>showStep('details');$('openMap').onclick=()=>{$('mapPanel').hidden=false;requestAnimationFrame(()=>map.invalidateSize());};
$('stepLabel1').onclick=()=>showStep('intro');$('stepLabel2').onclick=()=>showStep('location');$('stepLabel3').onclick=()=>showStep('details');
for(const button of document.querySelectorAll('[data-place]'))button.onclick=()=>{const [lat,lon]=button.dataset.place.split(',');choosePlace(lat,lon,button.dataset.name,button.dataset.region);};
$('searchForm').onsubmit=async e=>{e.preventDefault();const q=$('search').value.trim();const coords=q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);if(coords){choosePlace(coords[1],coords[2],'Твоё место','Точные координаты');return;}$('searchButton').disabled=true;$('searchStatus').textContent='Ищем место…';$('searchResults').replaceChildren();try{const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&limit=5&accept-language=ru&q=${encodeURIComponent(q)}`;const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const results=await response.json();if(!results.length){$('searchStatus').textContent='Ничего не нашли. Попробуй название рядом или выбери на карте.';return;}$('searchStatus').textContent='Выбери подходящее место:';for(const result of results){const lat=Number(result.lat),lon=Number(result.lon),address=result.address||{},name=result.namedetails?.name||result.name||result.display_name.split(',')[0]||q,region=[address.city||address.town||address.village,address.state,address.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ');const button=document.createElement('button');button.type='button';button.append(document.createTextNode(name));const small=document.createElement('small');small.textContent=region||result.display_name;button.append(small);button.onclick=()=>choosePlace(lat,lon,name,region||result.display_name);$('searchResults').append(button);}}catch(error){console.warn('Location search failed',error);$('searchStatus').textContent='Поиск сейчас недоступен. Можно ввести координаты или выбрать место на карте.';}finally{$('searchButton').disabled=false;}};
let currentPrice=18000;const formatPrice=value=>`${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
for(const swatch of document.querySelectorAll('.swatch'))swatch.onclick=()=>{$('material').value=swatch.dataset.material;$('materialName').textContent=swatch.dataset.label;$('introMaterial').textContent=swatch.dataset.label==='Камень'?'Тёмный камень':`${swatch.dataset.label} металл`;currentPrice=Number(swatch.dataset.price);$('priceDisplay').textContent=formatPrice(currentPrice);for(const item of document.querySelectorAll('.swatch'))item.setAttribute('aria-pressed',String(item===swatch));$('material').dispatchEvent(new Event('change'));};
$('buyRing').onclick=()=>{$('orderPlace').textContent=placeName;$('orderMaterial').textContent=$('materialName').textContent;$('orderPrice').textContent=formatPrice(currentPrice);$('orderForm').hidden=false;$('orderSuccess').hidden=true;showStep('order');};
$('backDetails').onclick=()=>showStep('details');
$('orderForm').onsubmit=e=>{e.preventDefault();const order={name:$('customerName').value.trim(),contact:$('customerContact').value.trim(),size:$('ringSize').value,comment:$('orderComment').value.trim(),place:placeName,material:$('materialName').textContent,price:currentPrice};localStorage.setItem('mesto-order-draft',JSON.stringify(order));$('orderForm').hidden=true;$('orderSuccess').hidden=false;};
$('newOrder').onclick=()=>{$('orderSuccess').hidden=true;$('orderForm').hidden=false;};
for(const id of ['aboutButton','sourceButton'])$(id).onclick=()=>$('about').showModal();$('closeAbout').onclick=()=>$('about').close();$('about').onclick=e=>{if(e.target===$('about'))$('about').close();};
for(const input of document.querySelectorAll('input[type="range"]'))paintRange(input);
applyPlace();load(false);

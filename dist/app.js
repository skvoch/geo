import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
const material=new THREE.MeshPhysicalMaterial({color:0xc7cbd2,metalness:1,roughness:.14,clearcoat:.28,clearcoatRoughness:.08,envMapIntensity:1.68,side:THREE.DoubleSide});
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
const N=96,cache=new Map(),heightCache=new Map();
function world(lat,lon,z){const n=2**z;const rad=lat*Math.PI/180;return [(lon+180)/360*n,(1-Math.asinh(Math.tan(rad))/Math.PI)/2*n];}
async function tile(z,x,y){const n=2**z;x=((x%n)+n)%n;y=Math.max(0,Math.min(n-1,y));const key=`${z}/${x}/${y}`;if(cache.has(key))return cache.get(key);const p=(async()=>{const response=await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Источник высот временно недоступен.');const bitmap=await createImageBitmap(await response.blob());const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();return ctx.getImageData(0,0,256,256).data;})();cache.set(key,p);try{return await p;}catch(e){cache.delete(key);throw e;}}
async function heights(s){const cacheKey=`${s.lat.toFixed(4)}/${s.lon.toFixed(4)}/${s.radius}`;if(heightCache.has(cacheKey))return heightCache.get(cacheKey);const dlat=s.radius/111.32,dlon=dlat/Math.cos(s.lat*Math.PI/180);if(Math.abs(s.lat)+dlat>85)throw Error('Выбери точку немного дальше от полюса.');const z=Math.max(2,Math.min(12,Math.floor(Math.log2(360/(dlon*2)))));const points=[],keys=new Map();for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const u=i/N*2-1,v=j/N*2-1;const [x,y]=world(s.lat-v*dlat,s.lon+u*dlon,z);const tx=Math.floor(x),ty=Math.floor(y),key=`${tx}/${ty}`;points.push({key,px:Math.floor((x-tx)*256),py:Math.floor((y-ty)*256)});keys.set(key,[tx,ty]);}const tiles=new Map(await Promise.all([...keys].map(async([key,[x,y]])=>[key,await tile(z,x,y)])));const result=Float32Array.from(points,p=>{const t=tiles.get(p.key),k=(p.py*256+p.px)*4;return t[k]*256+t[k+1]+t[k+2]/256-32768;});heightCache.set(cacheKey,result);if(heightCache.size>24)heightCache.delete(heightCache.keys().next().value);return result;}
function sample(u,v){const x=Math.max(0,Math.min(N,(u+1)*N/2)),y=Math.max(0,Math.min(N,(v+1)*N/2));const i=Math.min(N-1,Math.floor(x)),j=Math.min(N-1,Math.floor(y)),a=x-i,b=y-j;return data[j*(N+1)+i]*(1-a)*(1-b)+data[j*(N+1)+i+1]*a*(1-b)+data[(j+1)*(N+1)+i]*(1-a)*b+data[(j+1)*(N+1)+i+1]*a*b;}
function mesh(positions,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();model.add(new THREE.Mesh(g,material));}
function buildSignet(){
  const A=384,B=192,inner=6.7,positions=[],indices=[];
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
  // Use the actual top patch's mean: valleys cut into the body, peaks rise above it.
  let mean=0;
  for(let j=0;j<=32;j++)for(let i=0;i<=32;i++)mean+=sample((i/16-1)/Math.SQRT2,(j/16-1)/Math.SQRT2);
  mean/=33*33;
  const gain=Number($('relief').value)*14.08/(loaded.radius*2000);
  function terrain(u,v){let sum=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)sum+=sample(u+i/N,v+j/N)*(i===0?2:1)*(j===0?2:1);return (sum/16-mean)*gain;}
  // A closed, rounded cross-section joins the top, shoulders and finger opening.
  // Shared vertices around both loops also keep the lighting smooth at every join.
  for(let i=0;i<A;i++){
    const t=-Math.PI+i/A*Math.PI*2,c=Math.cos(t),s=Math.sin(t);
    const shoulder=smooth((c+.20)/1.20);
    const tableBlend=1-smooth((Math.abs(t)-.46)/.25);
    const bodyOuter=8.15+1.15*shoulder;
    const flatOuter=10.25/Math.max(c,.4);
    const outer=bodyOuter+(flatOuter-bodyOuter)*tableBlend;
    const topX=s*outer,tableRadius=6.2;
    const diskHalf=Math.sqrt(Math.max(0,tableRadius*tableRadius-Math.min(tableRadius,Math.abs(topX))**2));
    const bodyWidth=2.0+1.5*shoulder;
    const tableWidth=Math.max(.65,diskHalf);
    const w=bodyWidth+(tableWidth-bodyWidth)*tableBlend;
    const mid=(outer+inner)/2,thickness=(outer-inner)/2;
    for(let j=0;j<B;j++){
      const q=j/B*Math.PI*2,cq=Math.cos(q),sq=Math.sin(q);
      const radialExponent=.5-.22*tableBlend;
      const r=mid+thickness*Math.sign(cq)*Math.pow(Math.abs(cq),radialExponent);
      const z=w*Math.sign(sq)*Math.sqrt(Math.abs(sq));
      let x=s*r,y=c*r;
      const diskDistance=Math.hypot(x/tableRadius,z/tableRadius);
      const diskFade=1-smooth((diskDistance-.78)/.22);
      const blend=tableBlend*smooth(cq/.65)*diskFade;
      if(blend>0){
        const u=Math.max(-1,Math.min(1,x/tableRadius)),v=Math.max(-1,Math.min(1,z/tableRadius));
        let d=terrain(u/Math.SQRT2,v/Math.SQRT2)*blend;
        // Smoothly limit deep valleys before they reach the finger opening.
        const floor=Math.sqrt(Math.max(0,(inner+.65)**2-x*x));
        const room=Math.max(.05,y-floor);
        if(d<0)d=room*Math.tanh(d/room);
        y+=d;
      }
      positions.push(x,y,z);
      const a=i*B+j,b=((i+1)%A)*B+j,an=i*B+(j+1)%B,bn=((i+1)%A)*B+(j+1)%B;
      indices.push(a,an,b,b,an,bn);
    }
  }
  mesh(positions,indices);
}
function build(){if(!data)return;for(const child of [...model.children]){child.geometry.dispose();model.remove(child);}const low=Math.min(...data),high=Math.max(...data);
buildSignet();
model.scale.setScalar(Number($('size').value)/100);$('stats').textContent=`${loaded.lat.toFixed(4)}, ${loaded.lon.toFixed(4)} · Радиус ${loaded.radius} км · Высоты ${Math.round(low)}–${Math.round(high)} м`;}
async function load(openDetails=false,silent=false){const id=++job;let s;try{s=selection();}catch(e){$('status').textContent=e.message;return;}$('load').disabled=true;if(!silent)$('stageLoading').hidden=false;$('status').textContent=silent?'Обновляем рельеф…':'Загружаем настоящие высоты и создаём кольцо…';try{const result=await heights(s);if(id!==job)return;data=result;loaded=s;build();applyPlace();$('stageLoading').hidden=true;$('status').textContent='Кольцо обновлено. Можно продолжать выбирать точку.';if(openDetails)showStep('details');const now=selection();if(JSON.stringify(now)!==JSON.stringify(s))pending();}catch(e){if(id===job){$('stageLoading').hidden=true;$('status').textContent=`${data?'Предыдущее кольцо сохранено. ':''}Не удалось загрузить рельеф: ${e.message} Попробуй ещё раз.`;}}finally{if(id===job)$('load').disabled=false;}}
let liveTimer;
function scheduleLive(){if($('mapPanel').hidden)return;clearTimeout(liveTimer);$('status').textContent='Точка изменена — готовим новый рельеф…';liveTimer=setTimeout(()=>load(false,true),320);}
$('load').onclick=()=>load(true);
$('relief').oninput=()=>{$('reliefValue').value=`${Number($('relief').value).toFixed(1)}×`;paintRange($('relief'));build();};
$('size').oninput=()=>{$('sizeValue').value=`${$('size').value}%`;paintRange($('size'));model.scale.setScalar(Number($('size').value)/100);};
$('material').onchange=()=>{const value=$('material').value;if(value==='#76877e'){material.color.set('#6f7d76');material.metalness=.06;material.roughness=.72;material.clearcoat=.08;material.clearcoatRoughness=.18;material.envMapIntensity=.55;}else if(value==='#c4ad78'){material.color.set('#d1a13f');material.metalness=1;material.roughness=.075;material.clearcoat=.42;material.clearcoatRoughness=.035;material.envMapIntensity=2.15;}else{material.color.set('#c7cbd2');material.metalness=1;material.roughness=.14;material.clearcoat=.28;material.clearcoatRoughness=.08;material.envMapIntensity=1.68;}material.needsUpdate=true;};
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
